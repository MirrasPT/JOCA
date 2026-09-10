// SessionManager: owns the lifecycle of N Claude Code PTYs. Encapsulates the sessions Map,
// spawn/input/resize/kill, the rolling output buffer, and the idle→done heuristic. All timings
// and constants are IDENTICAL to the original god-file (BUFFER_MAX, IDLE_DEBOUNCE_MS,
// DONE_MIN_WORK_MS, MAX_SESSIONS). Shared state lives in the single exported `sessionManager`
// singleton — whoever dispatches work programmatically talks to that instance.
//
// Eventing: extends EventEmitter and emits:
//   'spawn'  { session }                     — session created (forwarded as 'session_created'); the
//                                              SINGLE broadcast source for both UI- and auto-spawned PTYs
//   'output' { sessionId, data }            — every PTY chunk (server forwards to WS as 'output')
//   'status' { sessionId, status, isDone }   — working↔idle transitions (forwarded as 'session_status')
//   'closed' { sessionId, finalOutput }      — PTY exit (forwarded as 'session_closed'). `finalOutput`
//                                              is the final buffer already without ANSI: whoever
//                                              hears this cannot fetch it afterwards, because the session already left the map.
//   'done'   { sessionId }                   — ADDITIVE: fired once when a programmatically dispatched
//                                              work burst ends; the dispatcher waits for this.
// The existing WS flows are unchanged — the additive API (spawn/input/readBuffer/kill/resize +
// the 'done' subscription) does not alter any pre-existing behavior.
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import * as pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { JOCA_LOGIC_ROOT } from './toolkit-registry';
import { loadProjectMemory, saveProjectMemory, loadUiSettings } from './project-store';
import { getCliProfile, buildLaunchLine, type CliId } from './cli-profiles';
import { jocaAgentEnv } from './agent-bridge';

export interface Session {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin: 'user' | 'auto';   // who created it: 'user' (UI) or 'auto' (programmatic spawn, e.g. `joca open`)
  cli: CliId;                // which coding CLI runs inside the PTY (claude | codex | agy | opencode)
  // Area label inherited from the pool the project manager used. The manager was removed and nothing
  // fills this today; it stays in the type because it is optional and written in the old sessions file.
  area?: string;
  pty: pty.IPty;
  buffer: string;
  status: 'working' | 'idle';
  lastOutputTime: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  workingSince: number | null;
  notifyOnIdle: boolean;    // any work burst was initiated (user OR programmatic) → drives isDone (toast/unread)
  awaitingDone: boolean;    // a PROGRAMMATIC dispatch (submitMessage / initial brief) → drives 'done' (wakes
                            // the awaiting runner). User keystrokes set notifyOnIdle but NOT this.
  writeQueue: WriteJob[];   // paced-write queue (see chunkText) — serialises concurrent submits
  writeTimer: ReturnType<typeof setTimeout> | null;
  writing: boolean;
}

interface WriteJob { payload: string; submit: boolean }

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin: 'user' | 'auto';
  cli: CliId;
  area?: string;
  status: 'working' | 'idle';
}

export interface SpawnOptions {
  cwd?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
  origin?: 'user' | 'auto';   // default 'user'
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
  model?: string;             // passed to the CLI's model flag when the profile has one
  area?: string;              // see `Session.area` — never filled today
  /** Starts Claude Code with `--remote-control` (startup flag; claude only). */
  remoteControl?: boolean;
  // OPAQUE label of whoever asked for this session (the browser that clicked "+"). It comes back in
  // the 'spawn' event and from there in the broadcast: without it, `session_created` arrives the
  // same for everyone and EVERY open client jumps to the new terminal — a second tab was thrown out
  // of what it was doing every time someone else created a terminal.
  requestedBy?: string;
}

const IS_WINDOWS = process.platform === 'win32';
const SHELL = IS_WINDOWS
  ? 'powershell.exe'
  : (process.env.SHELL || '/bin/zsh');
// Rolling per-session output buffer. 5 MB × 30 sessions was 150 MB of live strings and a real
// cause of the "JOCA gets slow after a while" reports; 1.5 MB still covers a long scrollback for
// the judge/tail readers (which only ever look at the last few KB).
const BUFFER_MAX = 1_500_000;
const IDLE_DEBOUNCE_MS = 1500;
const DONE_MIN_WORK_MS = 2000;
export const MAX_SESSIONS = 30;

function ensureNodePtyHelpersExecutable() {
  const prebuildsDir = path.resolve(__dirname, '../node_modules/node-pty/prebuilds');
  try {
    if (!fs.existsSync(prebuildsDir)) return;
    for (const platformDir of fs.readdirSync(prebuildsDir)) {
      const helperPath = path.join(prebuildsDir, platformDir, 'spawn-helper');
      if (fs.existsSync(helperPath) && !IS_WINDOWS) fs.chmodSync(helperPath, 0o755);
    }
  } catch (e) {
    console.warn('Could not chmod node-pty spawn-helper:', e);
  }
}

// PATH lookup with cache — one execSync per distinct binary, reused across spawns.
const binCache = new Map<string, string>();
function findBin(bin: string): string {
  const cached = binCache.get(bin);
  if (cached) return cached;
  const cmd = IS_WINDOWS ? `where.exe ${bin}` : `which ${bin}`;
  let resolved = bin;
  try { resolved = execSync(cmd, { encoding: 'utf8' }).trim().split(/\r?\n/)[0] || bin; } catch { /* keep name */ }
  binCache.set(bin, resolved);
  return resolved;
}

// CSI/OSC/SGR escape stripper for readBuffer({ strip: true }) — leaves plain text for programmatic readers.
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

/**
 * Did this burst bring anything VISIBLE, or is it just the terminal painting itself?
 *
 * Take away the escape sequences and the control characters and what is left is what a human would
 * read. If nothing is left, nobody wrote anything: it was cursor, color, clear line, move position.
 *
 * Exported so it is testable — it is a decision that affects the WHOLE state system (the `done`,
 * the judge, what the UI shows), and a regression here is silent.
 */
/**
 * Is the CLI asking to trust this folder?
 *
 * Two pitfalls, both paid for in the field:
 *
 * 1. **Each CLI writes the request its own way.** Claude says "Do you trust the files in this
 *    folder?", codex says "Do you trust the contents of this directory?". The previous version only
 *    knew Claude's — and a codex worker sat stuck on the dialog forever, with JOCA reporting it
 *    as `idle`, that is, free.
 * 2. **The TUI text has no spaces.** These interfaces position each word with cursor movements
 *    instead of writing spaces, so the buffer without ANSI reads
 *    `Doyoutrustthecontentsofthisdirectory`. Any pattern with spaces fails. Hence normalizing
 *    to letters only before comparing.
 *
 * In both CLIs Enter accepts the safe default option (Claude: trust; codex: "1. Yes, continue"
 * already selected, "Press enter to continue"). These are folders the owner opened deliberately.
 */
export function pedeConfiancaNaPasta(buffer: string): boolean {
  const t = buffer.replace(ANSI_RE, '').toLowerCase().replace(/[^a-z]/g, '');
  return t.includes('doyoutrustthefiles')
    || t.includes('doyoutrustthecontents')
    || t.includes('trustthefilesinthisfolder')
    || t.includes('trustthecontentsofthisdirectory');
}

/**
 * Is the CLI offering to UPDATE itself? It is never accepted mid-startup.
 *
 * This is not pedantry: in codex the default option is "Update now", and accepting it runs an
 * `npm install -g` and kills the session right after ("Please restart Codex"). An update is the
 * owner's decision, at a moment chosen by them — not a side effect of dispatching work.
 * Same space-less normalization as `pedeConfiancaNaPasta`, and for the same reason.
 */
export function ofereceActualizacao(buffer: string): boolean {
  const t = buffer.replace(ANSI_RE, '').toLowerCase().replace(/[^a-z]/g, '');
  return t.includes('updateavailable') || t.includes('updatenowruns') || t.includes('anewversionisavailable');
}

export function temConteudoVisivel(chunk: string): boolean {
  // \r and \b are movement (back to the start of the line, delete backwards), not content.
  return chunk.replace(ANSI_RE, '').replace(/[\x00-\x08\x0b-\x1f\x7f\r]/g, '').trim().length > 0;
}

// Paced writes into a CLI TUI over a PTY. Three separate problems, one mechanism:
//   1. A multi-line message written raw makes the TUI submit early on the first embedded '\n'
//      (only the first line lands) → wrap multi-line bodies in bracketed-paste (ESC[200~ … ESC[201~)
//      so newlines are literal.
//   2. A single big write OVERFLOWS the pty line-discipline buffer (a few KB) and the excess is
//      dropped SILENTLY — this is the "long message arrives truncated" bug → write in small chunks
//      with a gap so the TUI's reader drains between them.
//   3. A CR sent too soon after a paste is swallowed → delay the submit CR, scaled with payload size.
// Writes are queued per session so two rapid messages can never interleave their chunks.
const CHUNK_SIZE = 800;        // chars per write — comfortably under the line-discipline buffer
const CHUNK_DELAY_MS = 12;     // gap between chunks
const CR_BASE_DELAY_MS = 200;  // floor for the submit CR (unchanged for short messages)
const CR_PER_KB_MS = 70;       // extra settle time per KB pasted
const CR_MAX_DELAY_MS = 4000;

// Split without ever cutting a surrogate pair in half — an emoji written as two separate writes
// reaches the TUI as two invalid code units.
export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const code = text.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) end--; // high surrogate would be orphaned
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

export function submitCrDelay(payloadLength: number): number {
  return Math.min(CR_MAX_DELAY_MS, CR_BASE_DELAY_MS + Math.floor(payloadLength / 1024) * CR_PER_KB_MS);
}


/**
 * Writing to a PTY that may already be dead.
 *
 * A worker that starts badly (missing CLI, folder without permissions, `claude` exiting right away)
 * leaves the PTY closed, and writing to it throws `EPIPE`. When that write is inside a `setTimeout`
 * or an `async` without a `catch`, the error rises as an uncaught exception and Node kills the
 * PROCESS — that is: one dead terminal took the whole backend down, with all the other sessions
 * behind it. Returns `false` instead of blowing up; the writer decides what to do.
 */
function safePtyWrite(pty: { write(d: string): void }, data: string): boolean {
  try { pty.write(data); return true; } catch { return false; }
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>();
  private sessionCounter = 0;
  readonly shell = SHELL;
  readonly claudeBin: string;

  constructor() {
    super();
    ensureNodePtyHelpersExecutable();
    this.claudeBin = findBin('claude');
  }

  get size() { return this.sessions.size; }

  list(): Session[] { return [...this.sessions.values()]; }

  get(id: string): Session | undefined { return this.sessions.get(id); }

  info(s: Session): SessionInfo {
    return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, origin: s.origin, cli: s.cli, area: s.area, status: s.status };
  }

  listInfo(): SessionInfo[] { return this.list().map((s) => this.info(s)); }

  spawn(opts: SpawnOptions = {}): Session {
    const { sessionName, projectId, initialInput } = opts;
    const origin = opts.origin ?? 'user';
    // Explicit cli wins; otherwise the user's configured default (Settings → Default CLI).
    const profile = getCliProfile(opts.cli ?? loadUiSettings().defaultCli);

    const cwd = opts.cwd ?? JOCA_LOGIC_ROOT;
    this.sessionCounter++;
    const id = randomUUID();
    const name = sessionName ?? `Session ${this.sessionCounter}`;

    const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
    const ptyProcess = pty.spawn(SHELL, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      // Every session is born knowing how to talk back to JOCA: the agent inside can open and
      // message other terminals, etc. via the `joca` CLI (JOCA_OS/cli/joca.mjs).
      // JOCA_SESSION_ID lets it identify itself.
      env: { ...process.env, ...jocaAgentEnv(id) } as Record<string, string>,
    });

    const session: Session = {
      id, name, cwd, projectId, origin,
      cli: profile.id,
      area: opts.area,
      pty: ptyProcess,
      buffer: '',
      status: 'idle',
      lastOutputTime: Date.now(),
      idleTimer: null,
      workingSince: null,
      notifyOnIdle: false,
      awaitingDone: false,
      writeQueue: [],
      writeTimer: null,
      writing: false,
    };
    this.sessions.set(id, session);

    if (projectId) {
      const memory = loadProjectMemory();
      const current = memory[projectId] ?? {
        projectId,
        recentSessions: [],
        favoriteSkills: [],
        favoriteAgents: [],
        quickCommands: ['start', 'save', 'compact', 'plan'],
        openFiles: [],
          updatedAt: new Date().toISOString(),
      };
      memory[projectId] = {
        ...current,
        recentSessions: [id, ...current.recentSessions.filter((item) => item !== id)].slice(0, 12),
        updatedAt: new Date().toISOString(),
      };
      saveProjectMemory(memory);
    }

    // Launch the selected CLI. The autonomous toggle maps to each profile's own flags
    // (claude → --dangerously-skip-permissions, codex → --dangerously-bypass-approvals-and-sandbox, …).
    const launchLine = buildLaunchLine(profile, findBin(profile.bin), {
      model: opts.model,
      autonomous: loadUiSettings().skipPermissions,
      remoteControl: opts.remoteControl,
    });
    setTimeout(() => safePtyWrite(ptyProcess, `${launchLine}\r`), 100);

    // NO context command is injected at startup. `/resume` is MANUAL: the owner clicks the resume
    // button on the chat bar when they want to load the project context (the frontend composes the
    // command from `profile.resumeCmd`). A terminal that starts by spending a whole turn loading
    // context nobody asked for is work piled on top of the owner.
    //
    // `/init-project` is also NEVER sent from here, for the same reason: it opened a questionnaire
    // on top of work the user did not even ask for.
    //
    // The startup choreography runs with or without a brief: it is what recognizes and answers the
    // "trust this folder?" and the "Update available!" — leaving a terminal stuck on one of those
    // dialogs is worse than any missing context (see limparDialogosDeArranque). What turns it off
    // is the CLI profile (`startupSequence: false`), for a CLI that has no startup dialogs at all.
    // What IS SENT is only the brief (initialInput) of whoever created the session — and only when
    // the TUI is ready and the dialogs cleared. Fixed timers were the bug behind "sometimes it does
    // not send the message". Without the choreography the brief goes anyway, just without the wait.
    if (profile.startupSequence) void this.runStartupSequence(session, initialInput);
    else if (initialInput) this.enqueueWrite(session, initialInput, true);

    ptyProcess.onData((data: string) => {
      session.buffer += data;
      if (session.buffer.length > BUFFER_MAX) {
        let cutAt = session.buffer.length - BUFFER_MAX;
        // NEVER cut in the middle of an escape sequence. `cutAt` is an arbitrary index; if the
        // leading `\x1b` ends up on the discarded side, the parameters left over (`38;2;255;0;0m`)
        // reach xterm as TEXT and the replay shows up with garbage and repeated lines. Aligning to
        // the next `\x1b` is always safe — every sequence starts there. A TUI repaints with
        // positioning CSI, not with `\n`, which is why line alignment (fallback) often fails.
        const escPos = session.buffer.indexOf('\x1b', cutAt);
        if (escPos !== -1 && escPos < cutAt + 2000) {
          cutAt = escPos;
        } else {
          const nlPos = session.buffer.indexOf('\n', cutAt);
          if (nlPos !== -1 && nlPos < cutAt + 500) cutAt = nlPos + 1;
        }
        session.buffer = '\x1b[0m' + session.buffer.slice(cutAt);
      }
      this.emit('output', { sessionId: id, data });

      // Repainting is not work. A TUI moves the cursor, restores colors and clears lines with
      // nothing new happening — and since the state was "bytes arrived = it is working", a session
      // sitting on a screen with a blinking cursor never went back to `idle`: the IDLE_DEBOUNCE_MS
      // silence never came. This was the origin of the eternally "working" terminals.
      //
      // What is left out: a spinner or a clock DO WRITE visible characters, and still count as
      // work. Solving that means comparing the SCREEN over time, not the byte stream — another
      // undertaking. This catches the cheap and frequent case without touching the end-of-work
      // detection.
      if (!temConteudoVisivel(data)) return;

      // Status: transition to working
      const wasIdle = session.status === 'idle';
      session.status = 'working';
      session.lastOutputTime = Date.now();
      if (session.workingSince === null) session.workingSince = Date.now();

      if (wasIdle) {
        this.emit('status', { sessionId: id, status: 'working' as const });
      }

      // Debounce idle detection
      if (session.idleTimer) clearTimeout(session.idleTimer);
      session.idleTimer = setTimeout(() => {
        const wasWorking = session.status === 'working';
        const workedFor = session.workingSince ? Date.now() - session.workingSince : 0;
        const substantial = wasWorking && workedFor > DONE_MIN_WORK_MS;
        const isDone = session.notifyOnIdle && substantial;         // toast/unread: any initiated burst finished
        const dispatchDone = session.awaitingDone && substantial;   // wakes an awaiting runner: ONLY programmatic dispatches

        session.status = 'idle';
        session.workingSince = null;
        // `notifyOnIdle` is a toast: losing it costs a warning. `awaitingDone` is a RUNNER waiting:
        // losing it costs the project's whole queue.
        //
        // Both were cleared here ALWAYS, even when the burst was too short to count as work
        // (`substantial`). A settle of under 2s was enough — the echo of the brief's paste, a pause
        // between two tools — to consume the "arm" without emitting `done`. From then on no
        // following burst woke `waitForDone`, which only gave up after 1 HOUR, with the `busy` lock
        // held that whole time and nothing else running in that project. It was measured at ~1 in
        // every 5 runs.
        //
        // Only whoever did fire gets disarmed.
        session.notifyOnIdle = isDone ? false : session.notifyOnIdle;
        session.awaitingDone = dispatchDone ? false : session.awaitingDone;
        session.idleTimer = null;

        this.emit('status', { sessionId: id, status: 'idle' as const, isDone });
        // 'done' wakes whoever dispatched work programmatically (POST /sessions, `joca open`).
        // Gated on awaitingDone so that YOU typing in a worker never fires a spurious 'done'.
        if (dispatchDone) this.emit('done', { sessionId: id });
      }, IDLE_DEBOUNCE_MS);
    });

    // node-pty emits 'error' on the internal socket when the process dies mid-write. An 'error'
    // with no listener is an uncaught exception in Node — it kills the whole backend. This listener
    // exists ONLY to absorb it; the real close is still handled in the onExit below.
    const ptySocket = (ptyProcess as unknown as { _socket?: { on(e: string, f: (err: Error) => void): void } })._socket;
    ptySocket?.on('error', (err: Error) => {
      console.warn(`[pty] socket of session ${session.id} failed: ${err.message}`);
    });

    ptyProcess.onExit(() => {
      // Careful: this cancels a pending `idleTimer`, so the 'done' of this burst NEVER goes out. A
      // process that finishes fast (or that dies) closes without ever having said "I am done" —
      // whoever was waiting for the 'done' waited forever. That is why 'closed' carries the final
      // output: it is the only place where it still exists (the `sessions.delete` below makes it
      // unreachable), and it is what lets the listener report the close instead of swallowing it.
      if (session.idleTimer) clearTimeout(session.idleTimer);
      if (session.writeTimer) clearTimeout(session.writeTimer);
      session.writeQueue.length = 0;
      const finalOutput = session.buffer.replace(ANSI_RE, '');
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id, finalOutput });
    });

    // Announce creation so the WS layer broadcasts 'session_created' to all clients. This is the
    // single source of the broadcast — workers created programmatically (origin:'auto')
    // become visible in the UI exactly like UI-created sessions.
    this.emit('spawn', { session, requestedBy: opts.requestedBy });
    return session;
  }

  // Queue a paced write. `submit` appends the CR that makes the TUI send the message. Queued per
  // session so two rapid messages never interleave their chunks (see CHUNK_SIZE notes above).
  private enqueueWrite(session: Session, body: string, submit: boolean): void {
    const payload = body.includes('\n') ? `\x1b[200~${body}\x1b[201~` : body;
    session.writeQueue.push({ payload, submit });
    if (!session.writing) this.drainWrites(session);
  }

  // Drain one job at a time: chunk → gap → chunk … → (optional) CR → next job. Every step re-checks
  // that the session is alive, so a PTY killed mid-paste never gets written to (which would throw
  // inside a timer and take the process down).
  private drainWrites(session: Session): void {
    const job = session.writeQueue.shift();
    if (!job) { session.writing = false; return; }
    session.writing = true;

    const chunks = chunkText(job.payload);
    const crDelay = submitCrDelay(job.payload.length);
    let i = 0;

    const abort = () => { session.writing = false; session.writeQueue.length = 0; session.writeTimer = null; };
    const write = (data: string): boolean => {
      if (!this.sessions.has(session.id)) { abort(); return false; }
      try { session.pty.write(data); return true; }
      catch { abort(); return false; }
    };

    const step = (): void => {
      session.writeTimer = null;
      if (i < chunks.length) {
        if (!write(chunks[i++])) return;
        // More chunks pending → gap. Last chunk written → wait crDelay before the submit CR.
        const done = i >= chunks.length;
        if (!done) { session.writeTimer = setTimeout(step, CHUNK_DELAY_MS); return; }
        if (job.submit) { session.writeTimer = setTimeout(step, crDelay); return; }
        this.drainWrites(session);
        return;
      }
      // Chunks exhausted and a CR is still owed.
      if (job.submit && !write('\r')) return;
      this.drainWrites(session);
    };

    step(); // first chunk goes out immediately
  }

  // Resolve once the PTY has produced output and then gone quiet for `quietMs` (the Claude TUI
  // finished rendering its current screen), or after `capMs` as a hard fallback. Poll-based; reads the
  // live session fields the onData handler keeps fresh. Resolves early if the session is gone.
  private waitForQuiet(session: Session, quietMs: number, capMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!this.sessions.has(session.id)) return resolve();
        const quietFor = Date.now() - session.lastOutputTime;
        const booted = session.buffer.length > 0;
        if ((booted && quietFor >= quietMs) || Date.now() - start >= capMs) return resolve();
        setTimeout(tick, 150);
      };
      setTimeout(tick, quietMs);
    });
  }

  /**
   * Waits until the TUI is REALLY ready to receive text.
   *
   * `waitForQuiet` alone is not enough: during a CLI's startup there are pauses of more than 700ms
   * (loading, resolving the model) in which the process is alive but has not yet mounted the input
   * box. Writing there is writing into the void — the text shows up nowhere and the terminal stays
   * on the clean prompt. Since nothing was written, `awaitingDone` never gets armed and the runner
   * waiting for the task hangs until the one-hour timeout, with the project's queue stuck behind
   * it. That is how one task in every five died at startup.
   *
   * The "ready" signal is the CLI's own prompt. If it does not show up within the cap, it moves on
   * anyway (a CLI we do not know cannot block startup forever) — hence the `capMs`.
   */
  private waitForTuiReady(session: Session, capMs: number): Promise<void> {
    // `❯` covers Claude Code and Codex; the other two are Claude Code's status bar, which only
    // shows up after the input box exists.
    const PRONTO = /[❯›»]|bypass permissions|for agents|\? for shortcuts/;
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!this.sessions.has(session.id)) return resolve();
        const tail = session.buffer.slice(-4000).replace(ANSI_RE, '');
        const quietFor = Date.now() - session.lastOutputTime;
        if ((PRONTO.test(tail) && quietFor >= 400) || Date.now() - start >= capMs) return resolve();
        setTimeout(tick, 150);
      };
      setTimeout(tick, 400);
    });
  }

  // Startup choreography for a freshly spawned Claude Code PTY: wait for the TUI to be ready, clear a
  // "trust this folder?" prompt if present, THEN submit the brief. No `/resume` is injected —
  // the resume is manual, from the chat bar button.
  // Every step waits for the TUI to settle before the next — robust vs the old fixed-offset timers.
  /**
   * Clears the modal dialogs a CLI starts with, BEFORE handing it work.
   *
   * Why this is not "press Enter": Enter accepts the DEFAULT option, and the default option is not
   * always harmless. Measured in the field with codex 0.143.0: a blind Enter on the
   * "Update available!" dialog picks **"1. Update now"** — the CLI ran `npm install -g`, changed
   * the owner's system and exited with "Please restart Codex". The terminal was left on a shell
   * prompt, JOCA reported it as `idle` (free) and the work never got started.
   *
   * That is why each dialog is RECOGNIZED and answered to measure: trust the folder, yes (the owner
   * is the one who opened it); update itself mid-startup, never. In a loop, because they come in
   * series — the update shows up before the trust.
   */
  private async limparDialogosDeArranque(session: Session): Promise<void> {
    const p = session.pty;
    for (let i = 0; i < 4; i++) {
      if (!this.sessions.has(session.id)) return;
      const tail = session.buffer.slice(-4000);
      if (ofereceActualizacao(tail)) {
        // "2. Skip" in both known formats; the digit selects, the CR confirms.
        safePtyWrite(p, '2');
        await new Promise((r) => setTimeout(r, 120));
        safePtyWrite(p, '\r');
      } else if (pedeConfiancaNaPasta(tail)) {
        safePtyWrite(p, '\r');
      } else {
        return;
      }
      await this.waitForQuiet(session, 700, 8000);
    }
  }

  private async runStartupSequence(session: Session, initialInput?: string): Promise<void> {
    await this.waitForTuiReady(session, 25000);
    await this.limparDialogosDeArranque(session);
    if (initialInput && this.sessions.has(session.id)) {
      // Arm the done-on-idle signal: the brief is a real work burst, so the next idle is a 'done'
      // (this is what lets the dispatcher wait for the worker to finish).
      session.notifyOnIdle = true;
      session.awaitingDone = true;
      // Bracketed-paste submit: the brief is multi-line; raw newlines would submit only the first line
      // into the Claude TUI. Paced+chunked so a long brief isn't truncated by the pty buffer.
      this.enqueueWrite(session, initialInput, true);

      // Safety net: confirm the brief ARRIVED. A lost paste gives no error at all — the terminal
      // stays on the clean prompt and whoever is waiting for the task hangs. It is checked by a
      // marker from the text itself and, if it is not there, it is retried ONCE.
      const marca = initialInput.trim().split('\n')[0].slice(0, 40);
      await new Promise((r) => setTimeout(r, 3500));
      if (!this.sessions.has(session.id)) return;
      const visto = session.buffer.slice(-8000).replace(ANSI_RE, '').includes(marca);
      if (!visto) {
        console.warn(`[session ${session.id.slice(0, 8)}] the brief did not show up in the terminal — retrying`);
        await this.waitForTuiReady(session, 10000);
        if (this.sessions.has(session.id)) this.enqueueWrite(session, initialInput, true);
      }
    }
  }

  // Write to a session, replicating the WS 'input' semantics: a multi-char line ending in CR is
  // split so the CR lands ~80ms later (lets the CLI register the paste before submit). Marks the
  // session as work-initiating so the next idle counts as a 'done'.
  input(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || data === undefined) return false;
    if (data.trim().length > 0) session.notifyOnIdle = true;
    if (data.length > 1 && data.endsWith('\r')) {
      // A submitted line (typed message or a paste from the UI composer): queue it paced+chunked,
      // otherwise a long body overflows the pty buffer and arrives truncated.
      this.enqueueWrite(session, data.slice(0, -1), true);
    } else if (data.length > CHUNK_SIZE) {
      this.enqueueWrite(session, data, false); // large paste straight into the terminal, no submit
    } else {
      // Single keystrokes / control chars: write through, no queueing (latency matters here).
      try { session.pty.write(data); } catch { return false; }
    }
    return true;
  }

  // Programmatic message submit (runner → worker). Unlike input() (which mirrors raw UI keystrokes),
  // this guarantees the whole message is entered and submitted once, via bracketed-paste for
  // multi-line bodies. Use for any programmatically-driven message.
  submitMessage(sessionId: string, text: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || text === undefined) return false;
    // Programmatic dispatch → arm BOTH: notifyOnIdle (toast) and awaitingDone (so the completion
    // fires 'done' and wakes the awaiting runner).
    if (text.trim().length > 0) { session.notifyOnIdle = true; session.awaitingDone = true; }
    this.enqueueWrite(session, text.endsWith('\r') ? text.slice(0, -1) : text, true);
    return true;
  }

  interrupt(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return safePtyWrite(session.pty, '\x03');
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const c = Math.max(10, Math.min(Math.floor(cols), 500));
    const r = Math.max(5, Math.min(Math.floor(rows), 200));
    try { session.pty.resize(c, r); } catch {}
    return true;
  }

  // Cooperative close used by the WS 'close_session' path: clears the idle timer, kills the PTY,
  // removes it from the map, and emits 'closed'. (PTY-driven exit also emits 'closed' via onExit;
  // calling this after a natural exit is a no-op because the session is already gone.)
  kill(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    if (session.writeTimer) clearTimeout(session.writeTimer);
    session.writeQueue.length = 0;
    try { session.pty.kill(); } catch {}
    const finalOutput = session.buffer.replace(ANSI_RE, '');
    this.sessions.delete(sessionId);
    this.emit('closed', { sessionId, finalOutput });
    return true;
  }

  // Returns the cleaned name on success, or null if the session is missing / the name is empty.
  rename(sessionId: string, name: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const cleaned = name.replace(/[\x00-\x1f]/g, '').slice(0, 80).trim();
    if (cleaned.length === 0) return null;
    session.name = cleaned;
    return cleaned;
  }

  // Raw rolling buffer (with ANSI), matching the WS 'get_buffer' response.
  getBuffer(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.buffer;
  }

  // Programmatic read. strip=true removes the ANSI escapes for plain-text consumption.
  readBuffer(sessionId: string, opts: { strip?: boolean } = {}): string | undefined {
    const buf = this.sessions.get(sessionId)?.buffer;
    if (buf === undefined) return undefined;
    return opts.strip ? buf.replace(ANSI_RE, '') : buf;
  }

  // Await the completion of a programmatic dispatch on a session: resolves 'done' when the armed
  // work burst finishes, 'closed' if the PTY exits first, 'timeout' after timeoutMs. Used by the
  // one who dispatched the work (the worker stays open — this only observes).
  waitForDone(sessionId: string, timeoutMs: number): Promise<'done' | 'closed' | 'timeout'> {
    return new Promise((resolve) => {
      if (!this.sessions.has(sessionId)) return resolve('closed');
      const cleanup = () => {
        clearTimeout(timer);
        this.off('done', onDone);
        this.off('closed', onClosed);
      };
      const onDone = ({ sessionId: sid }: { sessionId: string }) => { if (sid === sessionId) { cleanup(); resolve('done'); } };
      const onClosed = ({ sessionId: sid }: { sessionId: string }) => { if (sid === sessionId) { cleanup(); resolve('closed'); } };
      const timer = setTimeout(() => { cleanup(); resolve('timeout'); }, timeoutMs);
      this.on('done', onDone);
      this.on('closed', onClosed);
    });
  }
}

export const sessionManager = new SessionManager();

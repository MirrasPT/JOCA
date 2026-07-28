// SessionManager: owns the lifecycle of N Claude Code PTYs. Encapsulates the sessions Map,
// spawn/input/resize/kill, the rolling output buffer, and the idle→done heuristic. All timings
// and constants are IDENTICAL to the original god-file (BUFFER_MAX, IDLE_DEBOUNCE_MS,
// DONE_MIN_WORK_MS, MAX_SESSIONS). Shared state lives in the single exported `sessionManager`
// singleton — server.ts, the automations runner and the tasks engine all talk to that instance.
//
// Eventing: extends EventEmitter and emits:
//   'spawn'  { session }                     — session created (forwarded as 'session_created'); the
//                                              SINGLE broadcast source for both UI- and auto-spawned PTYs
//   'output' { sessionId, data }            — every PTY chunk (server forwards to WS as 'output')
//   'status' { sessionId, status, isDone }   — working↔idle transitions (forwarded as 'session_status')
//   'closed' { sessionId }                   — PTY exit (forwarded as 'session_closed')
//   'done'   { sessionId }                   — ADDITIVE: fired once when a programmatically dispatched
//                                              work burst ends; automations/tasks await this.
// The existing WS flows are unchanged — the additive API (spawn/input/readBuffer/kill/resize +
// the 'done' subscription) does not alter any pre-existing behavior.
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import * as pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { PATH_SAFE, safePath } from './security-fs';
import { JOCA_LOGIC_ROOT } from './toolkit-registry';
import { loadProjectMemory, saveProjectMemory, loadUiSettings } from './project-store';
import { getCliProfile, buildLaunchLine, type CliId } from './cli-profiles';
import { jocaAgentEnv } from './agent-bridge';

export interface Session {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin: 'user' | 'auto';   // who spawned it: 'user' (UI) or 'auto' (automations/tasks worker)
  cli: CliId;                // which coding CLI runs inside the PTY (claude | codex | agy | opencode)
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
  status: 'working' | 'idle';
}

export interface SpawnOptions {
  cwd?: string;
  resumePath?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
  origin?: 'user' | 'auto';   // default 'user'
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
  model?: string;             // passed to the CLI's model flag when the profile has one
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
    return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, origin: s.origin, cli: s.cli, status: s.status };
  }

  listInfo(): SessionInfo[] { return this.list().map((s) => this.info(s)); }

  spawn(opts: SpawnOptions = {}): Session {
    const { resumePath, sessionName, projectId, initialInput } = opts;
    const origin = opts.origin ?? 'user';
    // Explicit cli wins; otherwise the user's configured default (Settings → CLI por defeito).
    const profile = getCliProfile(opts.cli ?? loadUiSettings().defaultCli);

    // Resolve the resume folder once — Claude Code consumes it as /resume|/init-project (see
    // runStartupSequence); the other CLIs have no such commands, so project context is provided by
    // simply STARTING the CLI inside the project folder (cwd).
    let resumeResolved: string | null = null;
    if (resumePath) {
      try {
        const r = safePath(resumePath);
        if (PATH_SAFE.test(r) && fs.existsSync(r)) resumeResolved = r;
      } catch { /* invalid resume path → ignored */ }
    }
    const cwd = opts.cwd ?? (!profile.startupSequence && resumeResolved ? resumeResolved : JOCA_LOGIC_ROOT);
    this.sessionCounter++;
    const id = randomUUID();
    const name = sessionName ?? `Session ${this.sessionCounter}`;

    const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
    const ptyProcess = pty.spawn(SHELL, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      // Every session is born knowing how to talk back to JOCA: the agent inside can list/comment/
      // move tasks, open and message other terminals, etc. via the `joca` CLI (JOCA_OS/cli/joca.mjs).
      // JOCA_SESSION_ID lets it identify itself; the tasks engine adds JOCA_TASK_ID per dispatch.
      env: { ...process.env, ...jocaAgentEnv(id) } as Record<string, string>,
    });

    const session: Session = {
      id, name, cwd, projectId, origin,
      cli: profile.id,
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
        quickCommands: ['save', 'compact', 'clear'],
        openFiles: [],
        rightPanel: 'files',
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
    // (claude → --dangerously-skip-permissions, codex → --full-auto, …).
    const launchLine = buildLaunchLine(profile, findBin(profile.bin), {
      model: opts.model,
      autonomous: loadUiSettings().skipPermissions,
    });
    setTimeout(() => ptyProcess.write(`${launchLine}\r`), 100);

    // Resolve the /resume|/init-project command synchronously (cheap fs checks). It is SENT only once
    // the Claude TUI is actually ready (see runStartupSequence). Fixed timers were the bug behind
    // "sometimes it doesn't send /resume": on a slow boot or a "trust this folder?" prompt the command
    // landed before the CLI could receive it and was lost. Claude Code only — the other CLIs get
    // project context via cwd (resolved above) instead.
    let startupCmd: string | null = null;
    if (profile.startupSequence && resumeResolved) {
      const hasClaudeMd = fs.existsSync(path.join(resumeResolved, 'CLAUDE.md'));
      startupCmd = hasClaudeMd ? `/resume "${resumeResolved}"` : `/init-project "${resumeResolved}"`;
    }

    if (startupCmd || initialInput) {
      void this.runStartupSequence(session, startupCmd, initialInput);
    }

    ptyProcess.onData((data: string) => {
      session.buffer += data;
      if (session.buffer.length > BUFFER_MAX) {
        let cutAt = session.buffer.length - BUFFER_MAX;
        const nlPos = session.buffer.indexOf('\n', cutAt);
        if (nlPos !== -1 && nlPos < cutAt + 500) cutAt = nlPos + 1;
        session.buffer = '\x1b[0m' + session.buffer.slice(cutAt);
      }
      this.emit('output', { sessionId: id, data });

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
        session.notifyOnIdle = false;
        session.awaitingDone = false;
        session.idleTimer = null;

        this.emit('status', { sessionId: id, status: 'idle' as const, isDone });
        // 'done' wakes whoever dispatched work programmatically (automations runner / tasks engine).
        // Gated on awaitingDone so that YOU typing in a worker never fires a spurious 'done'.
        if (dispatchDone) this.emit('done', { sessionId: id });
      }, IDLE_DEBOUNCE_MS);
    });

    ptyProcess.onExit(() => {
      if (session.idleTimer) clearTimeout(session.idleTimer);
      if (session.writeTimer) clearTimeout(session.writeTimer);
      session.writeQueue.length = 0;
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id });
    });

    // Announce creation so the WS layer broadcasts 'session_created' to all clients. This is the
    // single source of the broadcast — workers spawned programmatically (automations/tasks)
    // become visible in the UI exactly like UI-created sessions.
    this.emit('spawn', { session });
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

  // Startup choreography for a freshly spawned Claude Code PTY: wait for the TUI to be ready, clear a
  // "trust this folder?" prompt if present, THEN send /resume|/init-project, THEN submit any brief.
  // Every step waits for the TUI to settle before the next — robust vs the old fixed-offset timers.
  private async runStartupSequence(session: Session, startupCmd: string | null, initialInput?: string): Promise<void> {
    const p = session.pty;
    await this.waitForQuiet(session, 700, 12000);
    // First-time folders show "Do you trust the files in this folder?" — accept the default (Enter) so
    // the CLI reaches its prompt. These are folders the user explicitly opened in JOCA.
    if (/trust the files in this folder|Do you trust the files/i.test(session.buffer.slice(-2000))) {
      p.write('\r');
      await this.waitForQuiet(session, 700, 8000);
    }
    if (!this.sessions.has(session.id)) return;
    if (startupCmd) {
      p.write(startupCmd);
      await new Promise((r) => setTimeout(r, 120)); // let the line register before the submit CR
      p.write('\r');
      if (initialInput) await this.waitForQuiet(session, 900, 20000); // /resume loads context — let it settle
    }
    if (initialInput && this.sessions.has(session.id)) {
      // Arm the done-on-idle signal: the brief is a real work burst, so the next idle is a 'done'
      // (this is what lets the automations runner / tasks engine await the worker's completion).
      session.notifyOnIdle = true;
      session.awaitingDone = true;
      // Bracketed-paste submit: the brief is multi-line; raw newlines would submit only the first line
      // into the Claude TUI. Paced+chunked so a long brief isn't truncated by the pty buffer.
      this.enqueueWrite(session, initialInput, true);
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
  // multi-line bodies. Use for any programmatically-driven message (tasks tester pass, etc.).
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
    session.pty.write('\x03');
    return true;
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
    this.sessions.delete(sessionId);
    this.emit('closed', { sessionId });
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

  // Programmatic read (automations/tasks). strip=true removes ANSI escapes for plain-text consumption.
  readBuffer(sessionId: string, opts: { strip?: boolean } = {}): string | undefined {
    const buf = this.sessions.get(sessionId)?.buffer;
    if (buf === undefined) return undefined;
    return opts.strip ? buf.replace(ANSI_RE, '') : buf;
  }

  // Await the completion of a programmatic dispatch on a session: resolves 'done' when the armed
  // work burst finishes, 'closed' if the PTY exits first, 'timeout' after timeoutMs. Used by the
  // automations runner and the tasks engine (the worker stays open — this only observes).
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

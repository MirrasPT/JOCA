// SessionManager: owns the lifecycle of N Claude Code PTYs. Encapsulates the sessions Map,
// spawn/input/resize/kill, the rolling output buffer, and the idle→done heuristic. All timings
// and constants are IDENTICAL to the original god-file (BUFFER_MAX, IDLE_DEBOUNCE_MS,
// DONE_MIN_WORK_MS, MAX_SESSIONS). Shared state lives in the single exported `sessionManager`
// singleton — server.ts and the future Master both talk to that instance.
//
// Eventing: extends EventEmitter and emits:
//   'spawn'  { session }                     — session created (forwarded as 'session_created'); the
//                                              SINGLE broadcast source for both UI- and Master-spawned PTYs
//   'output' { sessionId, data }            — every PTY chunk (server forwards to WS as 'output')
//   'status' { sessionId, status, isDone }   — working↔idle transitions (forwarded as 'session_status')
//   'closed' { sessionId }                   — PTY exit (forwarded as 'session_closed')
//   'done'   { sessionId }                   — ADDITIVE: fired once when a real work burst ends
//                                              (isDone === true); for the Master orchestrator.
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

export interface Session {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  pty: pty.IPty;
  buffer: string;
  status: 'working' | 'idle';
  lastOutputTime: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  workingSince: number | null;
  notifyOnIdle: boolean;
}

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  status: 'working' | 'idle';
}

export interface SpawnOptions {
  cwd?: string;
  resumePath?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
}

const IS_WINDOWS = process.platform === 'win32';
const SHELL = IS_WINDOWS
  ? 'powershell.exe'
  : (process.env.SHELL || '/bin/zsh');
const BUFFER_MAX = 5_000_000;
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

function findClaude(): string {
  const cmd = IS_WINDOWS ? 'where.exe claude' : 'which claude';
  try { return execSync(cmd, { encoding: 'utf8' }).trim().split(/\r?\n/)[0]; }
  catch { return 'claude'; }
}

// CSI/OSC/SGR escape stripper for readBuffer({ strip: true }) — leaves plain text for the Master.
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

// Reliable programmatic submit into a Claude Code TUI over a PTY. The problem: a multi-line
// message written raw makes the TUI submit early on the first embedded '\n' (only the first line
// lands), and a CR sent too soon after a paste is dropped. Fix: wrap multi-line bodies in
// bracketed-paste (ESC[200~ … ESC[201~) so newlines are literal, then send ONE CR after a delay
// long enough for the TUI to absorb the paste. Single-line bodies skip the wrapper.
function writeSubmit(p: pty.IPty, text: string, crDelay = 200): void {
  const body = text.endsWith('\r') ? text.slice(0, -1) : text;
  const payload = body.includes('\n') ? `\x1b[200~${body}\x1b[201~` : body;
  p.write(payload);
  setTimeout(() => p.write('\r'), crDelay);
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>();
  private sessionCounter = 0;
  readonly shell = SHELL;
  readonly claudeBin: string;

  constructor() {
    super();
    ensureNodePtyHelpersExecutable();
    this.claudeBin = findClaude();
  }

  get size() { return this.sessions.size; }

  list(): Session[] { return [...this.sessions.values()]; }

  get(id: string): Session | undefined { return this.sessions.get(id); }

  info(s: Session): SessionInfo {
    return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, status: s.status };
  }

  listInfo(): SessionInfo[] { return this.list().map((s) => this.info(s)); }

  spawn(opts: SpawnOptions = {}): Session {
    const cwd = opts.cwd ?? JOCA_LOGIC_ROOT;
    const { resumePath, sessionName, projectId, initialInput } = opts;
    this.sessionCounter++;
    const id = randomUUID();
    const name = sessionName ?? `Session ${this.sessionCounter}`;

    const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
    const ptyProcess = pty.spawn(SHELL, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env } as Record<string, string>,
    });

    const session: Session = {
      id, name, cwd, projectId,
      pty: ptyProcess,
      buffer: '',
      status: 'idle',
      lastOutputTime: Date.now(),
      idleTimer: null,
      workingSince: null,
      notifyOnIdle: false,
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

    const claudeArgs = loadUiSettings().skipPermissions ? ' --dangerously-skip-permissions' : '';
    setTimeout(() => ptyProcess.write(`${this.claudeBin}${claudeArgs}\r`), 100);

    if (resumePath) {
      let resolved: string | null = null;
      try { resolved = safePath(resumePath); } catch {}
      const safe = resolved && PATH_SAFE.test(resolved) && fs.existsSync(resolved);
      if (safe && resolved) {
        const hasClaudeMd = fs.existsSync(path.join(resolved, 'CLAUDE.md'));
        const cmd = hasClaudeMd ? `/resume "${resolved}"` : `/init-project "${resolved}"`;
        setTimeout(() => {
          ptyProcess.write(cmd);
          setTimeout(() => ptyProcess.write('\r'), 80);
        }, 1200);
      }
    }

    if (initialInput) {
      setTimeout(() => {
        // Bracketed-paste submit: the brief is multi-line; raw newlines would submit only the
        // first line into the Claude TUI. writeSubmit enters the whole body then one CR submits.
        writeSubmit(ptyProcess, initialInput);
      }, resumePath ? 2200 : 1200);
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
        const isDone = session.notifyOnIdle && wasWorking && workedFor > DONE_MIN_WORK_MS;

        session.status = 'idle';
        session.workingSince = null;
        session.notifyOnIdle = false;
        session.idleTimer = null;

        this.emit('status', { sessionId: id, status: 'idle' as const, isDone });
        if (isDone) this.emit('done', { sessionId: id });
      }, IDLE_DEBOUNCE_MS);
    });

    ptyProcess.onExit(() => {
      if (session.idleTimer) clearTimeout(session.idleTimer);
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id });
    });

    // Announce creation so the WS layer broadcasts 'session_created' to all clients. This is the
    // single source of the broadcast — workers spawned programmatically by the Master (via the
    // MCP spawn_worker tool) become visible in the UI exactly like UI-created sessions.
    this.emit('spawn', { session });
    return session;
  }

  // Write to a session, replicating the WS 'input' semantics: a multi-char line ending in CR is
  // split so the CR lands ~80ms later (lets the CLI register the paste before submit). Marks the
  // session as work-initiating so the next idle counts as a 'done'.
  input(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || data === undefined) return false;
    if (data.trim().length > 0) session.notifyOnIdle = true;
    if (data.length > 1 && data.endsWith('\r')) {
      session.pty.write(data.slice(0, -1));
      setTimeout(() => session.pty.write('\r'), 80);
    } else {
      session.pty.write(data);
    }
    return true;
  }

  // Programmatic message submit (Master → worker). Unlike input() (which mirrors raw UI keystrokes),
  // this guarantees the whole message is entered and submitted once, via bracketed-paste for
  // multi-line bodies. Use for send_to_worker / any orchestrator-driven message.
  submitMessage(sessionId: string, text: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || text === undefined) return false;
    if (text.trim().length > 0) session.notifyOnIdle = true;
    writeSubmit(session.pty, text);
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

  // Programmatic read for the Master. strip=true removes ANSI escapes for plain-text consumption.
  readBuffer(sessionId: string, opts: { strip?: boolean } = {}): string | undefined {
    const buf = this.sessions.get(sessionId)?.buffer;
    if (buf === undefined) return undefined;
    return opts.strip ? buf.replace(ANSI_RE, '') : buf;
  }
}

export const sessionManager = new SessionManager();

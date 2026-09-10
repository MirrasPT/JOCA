// On-disk snapshot of the live sessions — the net that catches the backend dying.
//
// The problem: the PTYs live ONLY in memory (`SessionManager`). When the backend process dies
// — crash, SIGKILL from `start.sh`, machine suspending — all the terminals die with it and the
// conversations vanish from the UI without a line of explanation. None of it is really recoverable:
// a dead PTY is not resumed. What CAN be done is not leaving the owner not knowing what was there.
//
// What this does: writes `data/sessions-snapshot.json` with the metadata of each live session plus
// the TAIL of the output (RAW, with ANSI, so xterm can repaint it). The next instance reads that
// file BEFORE rewriting it and offers the content through the `/sessions/recovered*` routes — the
// client decides whether to show the warning or to dismiss it (DELETE).
//
// What this does NOT do: resume processes. There is no PTY reattach and no detached processes — it
// is out of scope and does not work in this architecture.
//
// Write cadence: 5s debounce (the PTY's `output` fires hundreds of times per second — one write
// per chunk was unthinkable) + IMMEDIATE flush on SIGTERM, SIGINT and when creating/closing a
// session. SIGTERM catches the normal shutdown of `start.sh`; the periodic write is the only
// thing that covers the SIGKILL 2s later and the crash.
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeFileAtomic } from './project-store';
import { sessionManager } from './session-manager';
import type { CliId } from './cli-profiles';

export interface SnapshotSession {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  cli: CliId;
  origin: 'user' | 'auto';
  status: 'working' | 'idle';
  /**
   * Geometry of the PTY at the moment the snapshot was taken.
   *
   * It is not decoration: the stored output is that of a TUI (`claude` is the default CLI), and a TUI
   * redraws the screen by POSITION — deletes lines, moves the cursor up, writes over. Replaying that
   * at another width breaks the drawing in half, and at another height sends off screen everything the
   * app positioned absolutely (measured: the same snapshot replayed at 180x32 gives the whole screen;
   * at 180x24 6 lines are left over). Whoever reads it needs both measurements or cannot repaint it.
   */
  cols: number;
  rows: number;
  /** Last <= TAIL_MAX_BYTES of the buffer, RAW (with ANSI) — it is what xterm knows how to repaint. */
  tail: string;
}

/**
 * Fallback geometry, for snapshots written by a version older than these fields.
 *
 * 120x30 and not 80x24: it is the size `session-manager` creates every PTY with (`pty.spawn`), so
 * it is what a session that was never resized actually has. The limits are the same as
 * `sessionManager.resize` — a corrupt file cannot ask for a terminal a million lines tall.
 */
const COLS_FALLBACK = 120;
const ROWS_FALLBACK = 30;

function geometriaValida(valor: unknown, fallback: number, min: number, max: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return fallback;
  return Math.max(min, Math.min(Math.floor(valor), max));
}

export interface SessionsSnapshot {
  bootId: string;
  savedAt: number;
  sessions: SnapshotSession[];
}

export const SNAPSHOT_FILE = path.join(DATA_DIR, 'sessions-snapshot.json');

/**
 * Snapshot STILL TO BE RECOVERED, in a file separate from the snapshot of the live sessions.
 *
 * Having only one file lost the most likely case of all: `start.sh` runs in a terminal, very often
 * with no browser open. Restarting twice in a row made the second startup read a file the first had
 * already rewritten with `sessions: []` — and the record of the dead conversations, which is the
 * only reason this exists, disappeared without anyone having seen it.
 *
 * With two files: the one that dies with live conversations is PROMOTED to `.prev` on the next
 * startup, and `.prev` only leaves here when the user dismisses the warning. Starting deletes nothing.
 */
export const SNAPSHOT_PREV_FILE = path.join(DATA_DIR, 'sessions-snapshot.prev.json');

/** Identity of this backend instance. Changes on every startup — this is how the client tells
 *  "the sessions that are running" from "the sessions that died with the previous backend". */
export const BOOT_ID = randomUUID();

const FLUSH_DEBOUNCE_MS = 5000;
const TAIL_MAX_BYTES = 256 * 1024;

/**
 * Tail of the buffer, cut in BYTES and in a safe place.
 *
 * Two pitfalls, the same ones the `BUFFER_MAX` cut in `session-manager` already pays:
 *
 * 1. **Never cut in the middle of a code point.** The cut is by UTF-8 bytes; backing up to a
 *    leading byte stops the tail from starting with a replacement character.
 * 2. **Never cut in the middle of an escape sequence.** If the leading `\x1b` ends up on the
 *    discarded side, the parameters left over (`38;2;255;0;0m`) reach xterm as TEXT and the replay
 *    shows up with garbage. Aligning to the next `\x1b` is always safe; the `\x1b[0m` at the head
 *    restores the color state the cut threw away.
 *
 * Exported so it is testable — a regression here is silent (the file gets written all the same).
 */
export function snapshotTail(buffer: string, maxBytes = TAIL_MAX_BYTES): string {
  if (Buffer.byteLength(buffer, 'utf8') <= maxBytes) return buffer;

  const bytes = Buffer.from(buffer, 'utf8');
  let start = bytes.length - maxBytes;
  // 0b10xxxxxx = continuation byte; advance to the start of the next code point.
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
  let tail = bytes.subarray(start).toString('utf8');

  const escPos = tail.indexOf('\x1b');
  if (escPos !== -1 && escPos < 2000) {
    tail = tail.slice(escPos);
  } else {
    const nlPos = tail.indexOf('\n');
    if (nlPos !== -1 && nlPos < 500) tail = tail.slice(nlPos + 1);
  }
  return `\x1b[0m${tail}`;
}

// ── Snapshot of the PREVIOUS instance ────────────────────────────────────────────────────────
// Read ONCE, at module load — before any write can happen. From here on the file belongs to this
// instance, and what was in it exists only in this variable.
let previous: SessionsSnapshot | null = promotePreviousSnapshot();

/**
 * Runs ONCE, at module load, before any write.
 *
 * If the snapshot of the live sessions left on disk has conversations, it was a death with work
 * inside it: it is promoted to `.prev`. If it is empty (clean shutdown, or one startup right
 * after another), whatever is still to be recovered stays where it is — starting the backend
 * never throws away what nobody got to see.
 */
function promotePreviousSnapshot(): SessionsSnapshot | null {
  const vivas = readSnapshotFile(SNAPSHOT_FILE);
  if (vivas && vivas.sessions.length > 0) {
    try {
      writeFileAtomic(SNAPSHOT_PREV_FILE, JSON.stringify(vivas));
      // CONSUMING the file of the live ones is part of the promotion, and has to happen here — not
      // waiting for `installSessionsSnapshot()`. Otherwise the promotion stops being idempotent:
      // whoever loads the module without installing it leaves the old snapshot on disk, and the
      // next startup promotes it AGAIN — including one the user had already dismissed.
      writeFileAtomic(SNAPSHOT_FILE, JSON.stringify({ bootId: BOOT_ID, savedAt: Date.now(), sessions: [] }));
    } catch (e) {
      console.warn('[sessions-snapshot] could not promote the previous snapshot:', e);
    }
    return vivas;
  }
  return readSnapshotFile(SNAPSHOT_PREV_FILE);
}

function readSnapshotFile(file: string): SessionsSnapshot | null {
  const raw = readJsonFile<unknown>(file, null);
  if (!raw || typeof raw !== 'object') return null;
  const snap = raw as Partial<SessionsSnapshot>;
  if (typeof snap.bootId !== 'string' || !Array.isArray(snap.sessions)) return null;
  return {
    bootId: snap.bootId,
    savedAt: typeof snap.savedAt === 'number' ? snap.savedAt : 0,
    // The geometry is normalized HERE, once: from here on (routes, client) it is always two
    // usable numbers, and not "sometimes undefined because the file is old".
    sessions: snap.sessions
      .filter((s): s is SnapshotSession => !!s && typeof s.id === 'string')
      .map((s) => ({
        ...s,
        cols: geometriaValida(s.cols, COLS_FALLBACK, 10, 500),
        rows: geometriaValida(s.rows, ROWS_FALLBACK, 5, 200),
      })),
  };
}

/** Metadata of the previous instance's sessions — WITHOUT the `tail` (it is big; it goes apart). */
export function recoveredSessions(): {
  bootId: string;
  previousBootId?: string;
  savedAt?: number;
  sessions: Array<Omit<SnapshotSession, 'tail'> & { tailBytes: number }>;
} {
  if (!previous) return { bootId: BOOT_ID, sessions: [] };
  return {
    bootId: BOOT_ID,
    previousBootId: previous.bootId,
    savedAt: previous.savedAt,
    sessions: previous.sessions.map(({ tail, ...meta }) => ({
      ...meta,
      tailBytes: Buffer.byteLength(tail ?? '', 'utf8'),
    })),
  };
}

/** Raw tail of a session from the previous instance, or `undefined` if it does not exist. */
export function recoveredTail(id: string): string | undefined {
  const found = previous?.sessions.find((s) => s.id === id);
  return found ? (found.tail ?? '') : undefined;
}

/**
 * Dismiss the warning. Clears the memory AND the `.prev` — it is the only place that deletes it,
 * and that is what makes restarting the backend not lose what nobody has dismissed yet.
 * `SNAPSHOT_FILE` is not touched: since startup it has been the snapshot of the LIVE sessions, and
 * deleting it could only lose the conversations that are running right now.
 */
export function clearRecovered(): void {
  previous = null;
  try {
    fs.rmSync(SNAPSHOT_PREV_FILE, { force: true });
  } catch (e) {
    console.warn('[sessions-snapshot] could not delete the snapshot still to be recovered:', e);
  }
}

// ── Writing ───────────────────────────────────────────────────────────────────────────────────
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function currentSnapshot(): SessionsSnapshot {
  return {
    bootId: BOOT_ID,
    savedAt: Date.now(),
    sessions: sessionManager.list().map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
      ...(s.projectId ? { projectId: s.projectId } : {}),
      cli: s.cli,
      origin: s.origin,
      status: s.status,
      // The LIVE geometry of the PTY, not the startup one: the browser resizes the session when it
      // opens the panel, and it is the last measurement that matches the drawing left in the buffer.
      cols: geometriaValida(s.pty.cols, COLS_FALLBACK, 10, 500),
      rows: geometriaValida(s.pty.rows, ROWS_FALLBACK, 5, 200),
      tail: snapshotTail(s.buffer),
    })),
  };
}

/**
 * Writes right away, atomically (tmp + rename, via `project-store`). With no live sessions the file
 * is left with `sessions: []` — a clean shutdown with no conversations raises no warning next time.
 *
 * Synchronous deliberately: it is what runs it in the SIGTERM handler, and `start.sh` gives SIGKILL
 * 2s later.
 */
export function flushSessionsSnapshot(): void {
  dirty = false;
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    writeFileAtomic(SNAPSHOT_FILE, JSON.stringify(currentSnapshot()));
  } catch (e) {
    console.warn('[sessions-snapshot] could not write the sessions snapshot:', e);
  }
}

/** Marks changes; writes at most 1x every FLUSH_DEBOUNCE_MS. */
export function scheduleSessionsSnapshot(): void {
  if (!installed) return;
  dirty = true;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    if (dirty) flushSessionsSnapshot();
  }, FLUSH_DEBOUNCE_MS);
  timer.unref?.();
}

/**
 * Wires the snapshot to the sessions' lifecycle and to the shutdown signals.
 *
 * The signal handler removes itself (`once`) and sends the same signal again, so the process dies
 * with the state it would die with without this code — a `process.exit(0)` would change the exit
 * code for whoever is watching.
 */
export function installSessionsSnapshot(): void {
  if (installed) return;
  installed = true;

  sessionManager.on('output', scheduleSessionsSnapshot);
  sessionManager.on('status', scheduleSessionsSnapshot);
  // Creating and closing are rare moments and expensive to lose → immediate flush.
  sessionManager.on('spawn', flushSessionsSnapshot);
  sessionManager.on('closed', flushSessionsSnapshot);

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      flushSessionsSnapshot();
      process.kill(process.pid, sig);
    });
  }

  // Initial state on disk: without this, a backend that starts and dies before the first session
  // left the previous instance's snapshot there and the next one warned about the same thing again.
  flushSessionsSnapshot();
}

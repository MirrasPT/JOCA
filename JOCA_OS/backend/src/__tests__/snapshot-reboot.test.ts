// Restarting the backend TWICE in a row cannot erase what nobody ever got to see.
//
// It is the likeliest path of all and the easiest to break without noticing: `start.sh` runs in a
// terminal, often with no browser open. With a single file, the second startup read what the first
// had already rewritten with `sessions: []` and the record of the dead conversations disappeared — the
// feature kept on "working" and the one thing it exists to save was gone.
//
// Every `bootInstance()` is a backend STARTUP: `resetModules` + a fresh import makes the module
// run the promotion again, which is exactly what happens in a new process.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-snapshot-reboot-'));
process.env.JOCA_DATA_DIR = DATA_DIR;

const LIVE_FILE = path.join(DATA_DIR, 'sessions-snapshot.json');
const PREV_FILE = path.join(DATA_DIR, 'sessions-snapshot.prev.json');

/** The snapshot an instance leaves on disk when it dies with a conversation inside it. */
function writeSnapshotWithConversation(bootId: string) {
  fs.writeFileSync(LIVE_FILE, JSON.stringify({
    bootId,
    savedAt: Date.now(),
    sessions: [{
      id: 'session-1', name: 'Session 1', cwd: '/tmp/project',
      cli: 'claude', origin: 'user', status: 'idle',
      tail: 'output the user has not read yet',
    }],
  }));
}

async function bootInstance() {
  vi.resetModules();
  return await import('../sessions-snapshot');
}

beforeEach(() => {
  fs.rmSync(LIVE_FILE, { force: true });
  fs.rmSync(PREV_FILE, { force: true });
});

afterAll(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  delete process.env.JOCA_DATA_DIR;
});

describe('surviving back-to-back startups', () => {
  it('promotes the snapshot of whoever died with live conversations', async () => {
    writeSnapshotWithConversation('instance-A');
    const m = await bootInstance();

    const rec = m.recoveredSessions();
    expect(rec.previousBootId).toBe('instance-A');
    expect(rec.sessions.map((s) => s.id)).toEqual(['session-1']);
    expect(fs.existsSync(PREV_FILE)).toBe(true);
  });

  it('TWO back-to-back startups with nobody seeing the warning — the snapshot is still there', async () => {
    writeSnapshotWithConversation('instance-A');

    // Startup 1: promotes and writes its own empty snapshot (there are no live sessions).
    const first = await bootInstance();
    first.flushSessionsSnapshot();
    expect(JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8')).sessions).toEqual([]);

    // Startup 2: the live file is empty. This is where the single-file version lost everything.
    const second = await bootInstance();
    const rec = second.recoveredSessions();

    expect(rec.previousBootId).toBe('instance-A');
    expect(rec.sessions.map((s) => s.id)).toEqual(['session-1']);
    expect(second.recoveredTail('session-1')).toBe('output the user has not read yet');
  });

  it('dismissing is the ONLY gesture that deletes — and it really does delete, including from disk', async () => {
    writeSnapshotWithConversation('instance-A');
    const first = await bootInstance();

    first.clearRecovered();
    expect(first.recoveredSessions().sessions).toEqual([]);
    expect(fs.existsSync(PREV_FILE)).toBe(false);

    // And it does not come back on the next startup.
    const second = await bootInstance();
    expect(second.recoveredSessions().sessions).toEqual([]);
  });

  it('a clean startup does not invent any warning', async () => {
    const m = await bootInstance();
    const rec = m.recoveredSessions();
    expect(rec.sessions).toEqual([]);
    expect(rec.previousBootId).toBeUndefined();
  });
});

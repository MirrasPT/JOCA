// The snapshot of the sessions on disk — the net that catches the backend dying.
//
// Two things worth a test because they fail SILENTLY:
//   1. the tail cut (the file gets written all the same, with garbage inside it);
//   2. the ORDER of the routes — `DELETE /sessions/recovered` has to come before `DELETE /sessions/:id`,
//      otherwise "recovered" is treated as a terminal's id and the response changes shape with no error.
import fs from 'fs';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, afterAll } from 'vitest';
import { sessionsRouter } from '../http/sessions-routes';
import { sessionManager } from '../session-manager';
import {
  snapshotTail,
  flushSessionsSnapshot,
  SNAPSHOT_FILE,
  BOOT_ID,
  type SessionsSnapshot,
} from '../sessions-snapshot';

function app() {
  const a = express();
  a.use(sessionsRouter());
  return a;
}

afterAll(() => {
  if (fs.existsSync(SNAPSHOT_FILE)) fs.rmSync(SNAPSHOT_FILE);
});

describe('snapshotTail', () => {
  it('returns the whole buffer when it fits', () => {
    expect(snapshotTail('hello world', 1024)).toBe('hello world');
  });

  it('cuts from the end and fits within the BYTE limit', () => {
    const buffer = 'x'.repeat(5000);
    const tail = snapshotTail(buffer, 1000);
    // The color-reset prefix is added AFTER the cut.
    expect(Buffer.byteLength(tail.replace(/^\x1b\[0m/, ''), 'utf8')).toBeLessThanOrEqual(1000);
    expect(buffer.endsWith(tail.replace(/^\x1b\[0m/, ''))).toBe(true);
  });

  it('puts the color state back at the head', () => {
    expect(snapshotTail('y'.repeat(5000), 1000).startsWith('\x1b[0m')).toBe(true);
  });

  it('never splits a multi-byte character down the middle', () => {
    // 3 bytes per 'ç' → the cut lands mid code point unless it backs off.
    const tail = snapshotTail('ç'.repeat(4000), 1001);
    expect(tail).not.toContain('�');
  });

  it('aligns the cut to the start of an escape sequence', () => {
    // Without alignment, the cut would leave `31mRED` (loose parameters that xterm prints
    // as text). With alignment, the tail starts at the next `\x1b`.
    const buffer = 'a'.repeat(2000) + '\x1b[31mRED' + 'b'.repeat(300);
    const tail = snapshotTail(buffer, 400).replace(/^\x1b\[0m/, '');
    expect(tail.startsWith('\x1b[31m')).toBe(true);
  });
});

describe('flushSessionsSnapshot', () => {
  it('writes a file with the agreed contract', () => {
    const session = sessionManager.spawn({ sessionName: 'Snapshot (test)' });
    try {
      flushSessionsSnapshot();
      const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
      expect(snap.bootId).toBe(BOOT_ID);
      expect(typeof snap.savedAt).toBe('number');
      const entry = snap.sessions.find((s) => s.id === session.id);
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({
        name: 'Snapshot (test)',
        cwd: session.cwd,
        cli: session.cli,
        origin: 'user',
      });
      expect(typeof entry!.tail).toBe('string');
      expect(['idle', 'working']).toContain(entry!.status);
    } finally {
      sessionManager.kill(session.id);
    }
  });

  // The geometry is what lets the tail be REPAINTED: the default CLI is a TUI, it draws by position,
  // and replayed at another size the drawing breaks. What must be stored is the LIVE geometry (the
  // browser resizes the session on opening the panel), not the startup one — hence the resize midway.
  it('stores the live PTY geometry, not the startup one', () => {
    const session = sessionManager.spawn({ sessionName: 'Geometry (test)' });
    try {
      sessionManager.resize(session.id, 180, 32);
      flushSessionsSnapshot();
      const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
      const entry = snap.sessions.find((s) => s.id === session.id);
      expect(entry).toMatchObject({ cols: 180, rows: 32 });
    } finally {
      sessionManager.kill(session.id);
    }
  });

  it('with no live sessions it writes an empty list — a clean shutdown raises no warning', () => {
    for (const s of sessionManager.list()) sessionManager.kill(s.id);
    flushSessionsSnapshot();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
    expect(snap.sessions).toEqual([]);
  });
});

describe('/sessions/recovered routes', () => {
  it('GET always returns the bootId of this instance and a list', async () => {
    const res = await request(app()).get('/sessions/recovered');
    expect(res.status).toBe(200);
    expect(res.body.bootId).toBe(BOOT_ID);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    // The `tail` never goes in the listing — only its size. The geometry does, because it is what the
    // client repaints the tail with: without cols/rows it does not know what terminal to write into.
    for (const s of res.body.sessions) {
      expect(s.tail).toBeUndefined();
      expect(typeof s.tailBytes).toBe('number');
      expect(typeof s.cols).toBe('number');
      expect(typeof s.rows).toBe('number');
    }
  });

  it('GET of the tail of a nonexistent session is 404', async () => {
    const res = await request(app()).get('/sessions/recovered/does-not-exist/tail');
    expect(res.status).toBe(404);
  });

  it('DELETE dismisses the warning and returns 204 (does not fall into DELETE /sessions/:id)', async () => {
    const del = await request(app()).delete('/sessions/recovered');
    expect(del.status).toBe(204);

    const res = await request(app()).get('/sessions/recovered');
    expect(res.body.sessions).toEqual([]);
    expect(res.body.previousBootId).toBeUndefined();
  });
});

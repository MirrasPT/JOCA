// HTTP contract tests — analysis 2026-08-19 §3: 54 endpoints, zero route tests.
// Starts with the biggest risk per euro: /projects and /sessions. The real routers are mounted on
// a test Express app (no auth — requireAuth is server middleware, tested separately),
// with JOCA_DATA_DIR in a tmpdir so the real data/ is never touched.
//
// The isolation of the real data/ comes from vitest's global setup (JOCA_DATA_DIR → shared test
// dir). ALWAYS clean via the imported DATA_DIR — a tmpdir of our own here cleans the wrong
// place and the tests inherit state from one another (it happened in the 1st version of this file).
import os from 'os';
import path from 'path';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DATA_DIR } from '../project-store';
import express from 'express';
import request from 'supertest';
import { projectsRouter } from '../http/projects-routes';
import { sessionsRouter } from '../http/sessions-routes';

function app() {
  const a = express();
  a.use(projectsRouter());
  a.use(sessionsRouter());
  return a;
}

// real folder inside the home — safePath requires it
const projectDir = fs.mkdtempSync(path.join(os.homedir(), '.joca-test-'));

beforeEach(() => {
  for (const f of ['projects.json', 'project-memory.json', 'project-groups.json']) {
    const fp = path.join(DATA_DIR, f);
    if (fs.existsSync(fp)) fs.rmSync(fp);
  }
});

afterAll(() => {
  for (const f of ['projects.json', 'project-memory.json', 'project-groups.json']) {
    const fp = path.join(DATA_DIR, f);
    if (fs.existsSync(fp)) fs.rmSync(fp);
  }
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('GET /projects', () => {
  it('returns a list, even with no state on disk', async () => {
    const res = await request(app()).get('/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /projects', () => {
  it('400 without path', async () => {
    const res = await request(app()).post('/projects').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path/i);
  });

  it('400 with a path outside the home (traversal)', async () => {
    const res = await request(app()).post('/projects').send({ path: '/etc' });
    expect(res.status).toBe(400);
  });

  it('400 with a path that does not exist', async () => {
    const res = await request(app()).post('/projects').send({ path: path.join(os.homedir(), 'does-not-exist-' + Date.now()) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exist/i);
  });

  it('creates with a valid path: returns id, derives the name from the folder, and the duplicate gives 409', async () => {
    const a = app();
    const res = await request(a).post('/projects').send({ path: projectDir });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe(path.basename(projectDir));
    // memory contract: it is born with quick commands
    const dup = await request(a).post('/projects').send({ path: projectDir });
    expect(dup.status).toBe(409);
  });

  it('truncates the name to 120 chars and ignores non-boolean hasCode', async () => {
    const res = await request(app()).post('/projects').send({ path: projectDir, name: 'a'.repeat(300), hasCode: 'yes' });
    expect(res.status).toBe(200);
    expect(res.body.name.length).toBeLessThanOrEqual(120);
    expect(res.body.hasCode).toBeUndefined();
  });
});

describe('PATCH and DELETE /projects/:id', () => {
  it('PATCH gives 404 for a nonexistent id; DELETE is idempotent (always 200)', async () => {
    const a = app();
    expect((await request(a).patch('/projects/nope').send({ name: 'x' })).status).toBe(404);
    // real contract: DELETE deletes-if-present and returns ok — repeating the removal is not an error
    expect((await request(a).delete('/projects/nope')).status).toBe(200);
    expect((await request(a).delete('/projects/nope')).body).toEqual({ ok: true });
  });

  it('PATCH renames and persists', async () => {
    const a = app();
    const created = await request(a).post('/projects').send({ path: projectDir });
    const res = await request(a).patch(`/projects/${created.body.id}`).send({ name: 'renamed' });
    expect(res.status).toBe(200);
    const list = await request(a).get('/projects');
    expect(list.body.find((p: { id: string }) => p.id === created.body.id)?.name).toBe('renamed');
  });
});

describe('GET /sessions', () => {
  it('returns a list without spawning PTYs', async () => {
    const res = await request(app()).get('/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('session routes with a nonexistent id', () => {
  it('input validates the body BEFORE looking up the session (400 without text, 404 with)', async () => {
    const a = app();
    expect((await request(a).post('/sessions/nope/input').send({})).status).toBe(400);
    expect((await request(a).post('/sessions/nope/input').send({ text: 'x' })).status).toBe(404);
  });

  it('buffer gives 404; interrupt/delete are soft-fail (200 + ok:false)', async () => {
    const a = app();
    expect((await request(a).get('/sessions/nope/buffer')).status).toBe(404);
    // real contract: interrupting/killing what no longer exists is not an error — it reports ok:false
    const int = await request(a).post('/sessions/nope/interrupt');
    expect(int.status).toBe(200);
    expect(int.body.ok).toBe(false);
    const del = await request(a).delete('/sessions/nope');
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(false);
  });
});

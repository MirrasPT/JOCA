// Testes de contrato HTTP — análise 2026-08-19 §3: 54 endpoints, zero testes de rota.
// Começa pelo maior risco por euro: /projects e /sessions. Montam-se os routers reais num
// app Express de teste (sem auth — o requireAuth é middleware do server, testado à parte),
// com JOCA_DATA_DIR num tmpdir para não tocar no data/ real.
//
// O isolamento do data/ real vem do setup global do vitest (JOCA_DATA_DIR → dir de teste
// partilhado). Limpar SEMPRE via DATA_DIR importado — um tmpdir próprio aqui limpa o sítio
// errado e os testes herdam estado uns dos outros (aconteceu na 1ª versão deste ficheiro).
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

// pasta real dentro da home — o safePath exige-o
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
  it('devolve uma lista, mesmo sem estado no disco', async () => {
    const res = await request(app()).get('/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /projects', () => {
  it('400 sem path', async () => {
    const res = await request(app()).post('/projects').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path/i);
  });

  it('400 com path fora da home (traversal)', async () => {
    const res = await request(app()).post('/projects').send({ path: '/etc' });
    expect(res.status).toBe(400);
  });

  it('400 com path que não existe', async () => {
    const res = await request(app()).post('/projects').send({ path: path.join(os.homedir(), 'nao-existe-' + Date.now()) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exist/i);
  });

  it('cria com path válido: devolve id, deriva o nome da pasta, e o duplicado dá 409', async () => {
    const a = app();
    const res = await request(a).post('/projects').send({ path: projectDir });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe(path.basename(projectDir));
    // contrato da memória: nasce com quick commands
    const dup = await request(a).post('/projects').send({ path: projectDir });
    expect(dup.status).toBe(409);
  });

  it('trunca nome a 120 chars e ignora hasCode não-booleano', async () => {
    const res = await request(app()).post('/projects').send({ path: projectDir, name: 'a'.repeat(300), hasCode: 'yes' });
    expect(res.status).toBe(200);
    expect(res.body.name.length).toBeLessThanOrEqual(120);
    expect(res.body.hasCode).toBeUndefined();
  });
});

describe('PATCH e DELETE /projects/:id', () => {
  it('PATCH dá 404 para id inexistente; DELETE é idempotente (200 sempre)', async () => {
    const a = app();
    expect((await request(a).patch('/projects/nope').send({ name: 'x' })).status).toBe(404);
    // contrato real: o DELETE apaga-se-existir e devolve ok — repetir a remoção não é erro
    expect((await request(a).delete('/projects/nope')).status).toBe(200);
    expect((await request(a).delete('/projects/nope')).body).toEqual({ ok: true });
  });

  it('PATCH renomeia e persiste', async () => {
    const a = app();
    const created = await request(a).post('/projects').send({ path: projectDir });
    const res = await request(a).patch(`/projects/${created.body.id}`).send({ name: 'renomeado' });
    expect(res.status).toBe(200);
    const list = await request(a).get('/projects');
    expect(list.body.find((p: { id: string }) => p.id === created.body.id)?.name).toBe('renomeado');
  });
});

describe('GET /sessions', () => {
  it('devolve lista sem lançar PTYs', async () => {
    const res = await request(app()).get('/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('rotas de sessão com id inexistente', () => {
  it('input valida o corpo ANTES de procurar a sessão (400 sem text, 404 com)', async () => {
    const a = app();
    expect((await request(a).post('/sessions/nope/input').send({})).status).toBe(400);
    expect((await request(a).post('/sessions/nope/input').send({ text: 'x' })).status).toBe(404);
  });

  it('buffer dá 404; interrupt/delete são soft-fail (200 + ok:false)', async () => {
    const a = app();
    expect((await request(a).get('/sessions/nope/buffer')).status).toBe(404);
    // contrato real: interromper/matar o que já não existe não é erro — reporta ok:false
    const int = await request(a).post('/sessions/nope/interrupt');
    expect(int.status).toBe(200);
    expect(int.body.ok).toBe(false);
    const del = await request(a).delete('/sessions/nope');
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(false);
  });
});

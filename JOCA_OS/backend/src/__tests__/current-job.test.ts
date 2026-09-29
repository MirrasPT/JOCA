// Linha de estado escrita pelo agente no cartão (issue #7, `joca status`).
//
// O que se protege: (1) a linha chega limpa e curta — nada de quebras, ANSI ou relatórios no cartão;
// (2) vai no `info()` (lista HTTP e `sessions_list` do WS) e só emite quando muda; (3) um prompt
// novo limpa-a; (4) a rota só deixa a PRÓPRIA sessão escrever a sua linha; (5) o CLI fala com a rota.
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

// DATA_DIR próprio: os ficheiros de teste correm em paralelo e partilhariam o notifications.json.
vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-current-job-${process.pid}`;
});

// PTY falso, como no agent-state.test.ts.
vi.mock('node-pty', () => ({
  spawn: () => ({
    pid: 1,
    onData: () => ({ dispose() {} }),
    onExit: () => ({ dispose() {} }),
    write() {}, kill() {}, resize() {},
  }),
}));

import fs from 'fs';
import http from 'http';
import type { AddressInfo } from 'net';
import { spawn } from 'child_process';
import express from 'express';
import request from 'supertest';
import { DATA_DIR } from '../project-store';
import { sessionManager, limparLinhaDeEstado, CURRENT_JOB_MAX } from '../session-manager';
import { sessionsRouter } from '../http/sessions-routes';
import { authRouter, requireAuth, mintAgentToken } from '../auth';
import { JOCA_CLI_PATH } from '../agent-bridge';

afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

const spawned: string[] = [];
const abrir = (nome = 'Linha (teste)') => {
  const s = sessionManager.spawn({ sessionName: nome, cli: 'opencode' });
  spawned.push(s.id);
  return s;
};
afterEach(() => { for (const id of spawned.splice(0)) sessionManager.kill(id); });

describe('limparLinhaDeEstado', () => {
  it('tira controlo, ANSI e quebras, colapsa espaços e corta ao tecto', () => {
    expect(limparLinhaDeEstado('  a rever\n o PR\t#7\r\n ')).toBe('a rever o PR #7');
    expect(limparLinhaDeEstado('\x1b[31mvermelho\x1b[0m e \x07sino')).toBe('vermelho e sino');
    expect(limparLinhaDeEstado('abc‮def ghi')).toBe('abc def ghi');
    expect(limparLinhaDeEstado('x'.repeat(500))).toBe('x'.repeat(CURRENT_JOB_MAX));
    // Corta por caracteres, não por unidades UTF-16: um emoji no limite não fica partido ao meio.
    expect([...limparLinhaDeEstado('😀'.repeat(200))!]).toHaveLength(CURRENT_JOB_MAX);
  });

  it('vazio, só espaços ou não-texto = sem linha', () => {
    expect(limparLinhaDeEstado('')).toBeUndefined();
    expect(limparLinhaDeEstado(' \n\t ')).toBeUndefined();
    expect(limparLinhaDeEstado(undefined)).toBeUndefined();
    expect(limparLinhaDeEstado(42)).toBeUndefined();
  });
});

describe('sessionManager.setCurrentJob', () => {
  it('guarda no info(), emite só quando muda e um prompt novo limpa', () => {
    const s = abrir();
    const vistos: unknown[] = [];
    const on = (e: unknown) => vistos.push(e);
    sessionManager.on('current_job', on);
    try {
      expect(sessionManager.setCurrentJob(s.id, 'a correr os testes')).toBe(true);
      expect(sessionManager.info(s).currentJob).toBe('a correr os testes');
      expect(sessionManager.listInfo().find((i) => i.id === s.id)?.currentJob).toBe('a correr os testes');
      sessionManager.setCurrentJob(s.id, '  a correr os testes\n');   // igual depois de limpo → sem evento
      sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });  // outros hooks não mexem
      expect(sessionManager.info(s).currentJob).toBe('a correr os testes');
      sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'agora outra coisa' });
      expect(sessionManager.info(s).currentJob).toBeUndefined();
    } finally { sessionManager.off('current_job', on); }
    expect(vistos).toEqual([
      { sessionId: s.id, currentJob: 'a correr os testes' },
      { sessionId: s.id, currentJob: undefined },
    ]);
  });

  it('sessão inexistente devolve false', () => {
    expect(sessionManager.setCurrentJob('nope', 'x')).toBe(false);
  });
});

describe('POST /sessions/:id/current-job', () => {
  const app = () => { const a = express(); a.use(sessionsRouter()); return a; };

  it('valida o corpo, a sessão e quem chama; devolve a linha já limpa', async () => {
    const s = abrir();
    const outra = abrir('Outra (teste)');
    const a = app();
    const post = (id: string, body: unknown, quem?: string) => {
      const r = request(a).post(`/sessions/${id}/current-job`);
      if (quem) r.set('X-Joca-Session', quem);
      return r.send(body as object);
    };
    expect((await post(s.id, { text: 42 }, s.id)).status).toBe(400);
    expect((await post('nope', { text: 'x' })).status).toBe(404);
    expect((await post(s.id, { text: 'x' }, outra.id)).status).toBe(403);
    expect((await post(s.id, { text: 'x' }, 'inventada')).status).toBe(403);
    expect(sessionManager.info(s).currentJob).toBeUndefined();

    const ok = await post(s.id, { text: `a rever\no PR ${'y'.repeat(300)}` }, s.id);
    expect(ok.status).toBe(200);
    expect(ok.body.currentJob).toHaveLength(CURRENT_JOB_MAX);
    expect(ok.body.currentJob.startsWith('a rever o PR y')).toBe(true);
    // Vai na listagem que o `joca sessions` lê.
    const lista = await request(a).get('/sessions');
    expect(lista.body.find((x: { id: string }) => x.id === s.id).currentJob).toBe(ok.body.currentJob);

    const limpa = await post(s.id, { text: '' }, s.id);
    expect(limpa.body).toEqual({ ok: true, currentJob: null });
    expect(sessionManager.info(s).currentJob).toBeUndefined();
    expect(sessionManager.info(outra).currentJob).toBeUndefined();
  });
});

describe('POST /sessions/:id/current-job com auth ligada', () => {
  const antes = process.env.JOCA_PASSWORD;
  beforeEach(() => { process.env.JOCA_PASSWORD = 'palavra-passe-de-teste'; });
  afterEach(() => { if (antes === undefined) delete process.env.JOCA_PASSWORD; else process.env.JOCA_PASSWORD = antes; });

  it('o token de agente só escreve a linha da PRÓPRIA sessão', async () => {
    const a = abrir('A (auth)');
    const b = abrir('B (auth)');
    const app = express();
    app.use(authRouter());
    app.use(requireAuth, sessionsRouter());
    const tokA = mintAgentToken(a.id);
    const post = (id: string, tok?: string) => {
      const r = request(app).post(`/sessions/${id}/current-job`);
      if (tok) r.set('Authorization', `Bearer ${tok}`);
      return r.send({ text: 'a trabalhar' });
    };
    expect((await post(a.id)).status).toBe(401);                 // sem token
    expect((await post(a.id, tokA)).status).toBe(200);            // própria sessão
    expect((await post(b.id, tokA)).status).toBe(403);            // outra, mesmo sem X-Joca-Session
    expect(sessionManager.info(b).currentJob).toBeUndefined();
    expect(sessionManager.info(a).currentJob).toBe('a trabalhar');
  });
});

describe('joca status (CLI)', () => {
  function correr(args: string[], env: Record<string, string>) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(process.execPath, [JOCA_CLI_PATH, 'status', ...args], {
        env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...env },
      });
      let stdout = '', stderr = '';
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  }

  it('escreve e limpa a linha da sessão deste terminal', async () => {
    const recebidos: { url?: string; body: string; sessao?: string }[] = [];
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        recebidos.push({ url: req.url, body, sessao: req.headers['x-joca-session'] as string });
        const text = JSON.parse(body).text as string;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, currentJob: text || null }));
      });
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
    const env = { JOCA_SESSION_ID: 'sessao-x', JOCA_API_URL: `http://127.0.0.1:${(srv.address() as AddressInfo).port}` };
    try {
      const set = await correr(['a', 'rever', 'o', 'PR'], env);
      expect(set).toMatchObject({ code: 0, stdout: 'linha de estado: a rever o PR\n' });
      const clear = await correr(['--clear'], env);
      expect(clear).toMatchObject({ code: 0, stdout: 'linha de estado limpa\n' });
    } finally { srv.close(); }
    expect(recebidos.map((r) => r.url)).toEqual(['/sessions/sessao-x/current-job', '/sessions/sessao-x/current-job']);
    expect(recebidos[0].sessao).toBe('sessao-x');
    expect(recebidos.map((r) => JSON.parse(r.body))).toEqual([{ text: 'a rever o PR' }, { text: '' }]);
  });

  it('fora de um terminal do JOCA, ou sem texto, recusa sem chamar o backend', async () => {
    const fora = await correr(['x'], { JOCA_API_URL: 'http://127.0.0.1:1' });
    expect(fora.code).toBe(1);
    expect(fora.stderr).toMatch(/JOCA_SESSION_ID/);
    const vazio = await correr([], { JOCA_SESSION_ID: 'sessao-x', JOCA_API_URL: 'http://127.0.0.1:1' });
    expect(vazio.code).toBe(1);
    expect(vazio.stderr).toMatch(/falta o texto/);
  });
});

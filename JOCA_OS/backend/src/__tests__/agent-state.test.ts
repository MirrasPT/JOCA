// Estado real do agente pelos hooks do Claude Code (issue #6).
//
// O que se protege: (1) a regra evento → estado de que a UI e a inbox dependem; (2) que o
// «à espera de ti» chega à inbox como ACÇÃO e sem encher a inbox; (3) que o settings gerado não
// deixa passar o `idle_prompt` (punha todas as sessões acabadas em espera); (4) que a rota só aceita
// a própria sessão.
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

// DATA_DIR próprio deste ficheiro: o notifications.test.ts apaga o notifications.json partilhado e
// os ficheiros de teste correm em paralelo. `vi.hoisted` corre antes dos imports.
vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-agent-state-${process.pid}`;
});

// PTY falso: nada disto precisa de um terminal a sério, e abrir/matar PowerShells às dezenas no
// Windows fazia o node-pty rebentar o worker do vitest de vez em quando («AttachConsole failed»).
vi.mock('node-pty', () => ({
  spawn: () => ({
    pid: 1,
    onData: () => ({ dispose() {} }),
    onExit: () => ({ dispose() {} }),
    write() {}, kill() {}, resize() {},
  }),
}));

import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { DATA_DIR } from '../project-store';
import { sessionManager, estadoDoEvento } from '../session-manager';
import { loadNotifications } from '../notifications/store';
import { claudeHooksSettings, prepareClaudeHooksSettings } from '../agent-bridge';
import { buildLaunchLine, getCliProfile } from '../cli-profiles';
import { sessionsRouter } from '../http/sessions-routes';
import { authRouter, requireAuth, mintAgentToken } from '../auth';

const notifFile = path.join(DATA_DIR, 'notifications.json');
const wipe = () => { try { fs.rmSync(notifFile, { force: true }); } catch { /* ok */ } };
// A pasta é deste processo (pid no nome): sem isto ficava uma no tmp por cada corrida.
afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

describe('estadoDoEvento', () => {
  it('mapeia cada hook para o estado do contrato', () => {
    expect(estadoDoEvento('UserPromptSubmit')).toBe('working');
    expect(estadoDoEvento('PreToolUse')).toBe('working');
    expect(estadoDoEvento('PostToolUse')).toBe('working');
    expect(estadoDoEvento('Notification')).toBe('waiting');
    expect(estadoDoEvento('StopFailure')).toBe('waiting');
    expect(estadoDoEvento('Stop')).toBe('done');
    expect(estadoDoEvento('SessionStart')).toBeUndefined();
  });
});

describe('settings de hooks do claude', () => {
  it('liga os 8 eventos em forma exec (sem shell), com o node deste processo', () => {
    const s = claudeHooksSettings('C:\\Users\\x y\\JOCA_OS\\cli\\joca.mjs', 'C:\\Program Files\\nodejs\\node.exe');
    expect(Object.keys(s.hooks).sort()).toEqual(
      ['Notification', 'PostToolUse', 'PostToolUseFailure', 'PreToolUse', 'SessionStart', 'Stop', 'StopFailure', 'UserPromptSubmit']);
    const stop = s.hooks.Stop[0] as { hooks: { command: string; args: string[] }[] };
    // Caminhos com espaços passam intactos: não há shell a partir o comando.
    expect(stop.hooks[0].command).toBe('C:\\Program Files\\nodejs\\node.exe');
    expect(stop.hooks[0].args).toEqual(['C:\\Users\\x y\\JOCA_OS\\cli\\joca.mjs', 'hook', 'Stop']);
    const def = claudeHooksSettings().hooks.Stop[0] as { hooks: { command: string }[] };
    expect(def.hooks[0].command).toBe(process.execPath);
  });

  it('o ficheiro vive numa pasta privada de nome aleatório, sem a porta no nome', () => {
    const file = prepareClaudeHooksSettings()!;
    expect(file).toBeTruthy();
    expect(path.basename(path.dirname(file))).toMatch(/^joca-os-hooks-\d+-.{6}$/);
    expect(file).not.toMatch(/7491/);
    expect(prepareClaudeHooksSettings()).toBe(file);           // uma por processo, reutilizada
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.StopFailure).toBeTruthy();
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    } else {
      // Sem herança do %TEMP%: nenhuma entrada (I) e só o utilizador actual.
      const acl = execFileSync('icacls', [path.dirname(file)], { encoding: 'utf8' });
      expect(acl).not.toMatch(/\(I\)/);
      expect(acl).toContain(os.userInfo().username);
      expect(acl.split('\n').filter((l) => l.includes(':(')).length).toBe(1);
    }
  });

  it('o Notification só apanha pedidos de resposta, nunca o idle_prompt', () => {
    const n = claudeHooksSettings().hooks.Notification[0] as { matcher: string };
    const re = new RegExp(`^(${n.matcher})$`);
    expect(re.test('permission_prompt')).toBe(true);
    expect(re.test('elicitation_dialog')).toBe(true);
    expect(re.test('idle_prompt')).toBe(false);
    expect(re.test('auth_success')).toBe(false);
  });

  it('só o claude arranca com --settings', () => {
    const claude = buildLaunchLine(getCliProfile('claude'), 'claude', { hooksSettings: '/tmp/h.json' });
    const codex = buildLaunchLine(getCliProfile('codex'), 'codex', { hooksSettings: '/tmp/h.json' });
    expect(claude).toContain('--settings "/tmp/h.json"');
    expect(codex).not.toContain('--settings');
  });
});

describe('sessionManager.agentEvent', () => {
  const spawned: string[] = [];
  beforeEach(wipe);
  afterEach(() => {
    for (const id of spawned.splice(0)) sessionManager.kill(id);
    wipe();
  });
  // opencode: o claude não traz nada a estes testes (o PTY é falso).
  const abrir = () => {
    const s = sessionManager.spawn({ sessionName: 'Hooks (teste)', cli: 'opencode' });
    spawned.push(s.id);
    return s;
  };

  it('segue working → waiting → done e emite agent_event com o detalhe', () => {
    const s = abrir();
    const eventos: unknown[] = [];
    const estados: unknown[] = [];
    const onEv = (e: unknown) => eventos.push(e);
    const onSt = (e: unknown) => estados.push(e);
    sessionManager.on('agent_event', onEv);
    sessionManager.on('agent_state', onSt);
    try {
      expect(sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'responde só ok' })).toBe(true);
      expect(sessionManager.info(s).agentState).toBe('working');
      sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
      sessionManager.agentEvent(s.id, 'Notification', { message: 'Claude needs your permission to use Bash' });
      expect(sessionManager.info(s)).toMatchObject({ agentState: 'waiting', waitingReason: 'Claude needs your permission to use Bash' });
      sessionManager.agentEvent(s.id, 'Stop');
      const info = sessionManager.info(s);
      expect(info.agentState).toBe('done');
      expect(info.waitingReason).toBeUndefined();
      expect(typeof info.agentStateAt).toBe('number');
    } finally {
      sessionManager.off('agent_event', onEv);
      sessionManager.off('agent_state', onSt);
    }
    expect(eventos[0]).toEqual({ sessionId: s.id, event: 'UserPromptSubmit', detail: { prompt: 'responde só ok' } });
    expect(eventos).toHaveLength(4);
    // PreToolUse a seguir a UserPromptSubmit não muda o estado → sem broadcast repetido.
    expect(estados.map((e) => (e as { agentState?: string }).agentState)).toEqual(['working', 'waiting', 'done']);
  });

  it('«à espera de ti» cria UMA notificação de acção, resolvida quando a sessão sai da espera', () => {
    const s = abrir();
    sessionManager.agentEvent(s.id, 'Notification', { message: 'permissão para Bash' });
    sessionManager.agentEvent(s.id, 'Notification', { message: 'permissão para Edit' }); // já em espera
    let list = loadNotifications();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ priority: 'action', read: false, meta: { sessionId: s.id } });
    expect(list[0].text).toContain('permissão para Bash');

    sessionManager.agentEvent(s.id, 'PostToolUse', { tool: 'Bash' });   // aprovaste → correu
    list = loadNotifications();
    expect(list[0].read).toBe(true);
    expect(sessionManager.info(s).agentState).toBe('working');

    // O bloqueio seguinte é uma decisão nova: entrada nova, por ler.
    sessionManager.agentEvent(s.id, 'Notification', { message: 'outra vez' });
    list = loadNotifications();
    expect(list).toHaveLength(2);
    expect(list.map((n) => n.read)).toEqual([true, false]);
  });

  it('StopFailure põe a sessão à espera com a razão do limite', () => {
    const s = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'StopFailure', { message: 'rate_limit' });
    expect(sessionManager.info(s)).toMatchObject({
      agentState: 'waiting', waitingReason: 'Bateu no limite ou erro da API: rate_limit',
    });
    sessionManager.agentEvent(s.id, 'StopFailure');
    expect(sessionManager.info(s).waitingReason).toBe('Bateu no limite ou erro da API');
  });

  it('fechar uma sessão à espera resolve o «precisa de ti»', () => {
    const s = abrir();
    sessionManager.agentEvent(s.id, 'Notification', { message: 'x' });
    expect(loadNotifications()[0].read).toBe(false);
    sessionManager.kill(s.id);
    expect(loadNotifications()[0].read).toBe(true);
  });

  it('duas sessões bloqueadas são duas decisões', () => {
    const a = abrir();
    const b = abrir();
    sessionManager.agentEvent(a.id, 'Notification', { message: 'x' });
    sessionManager.agentEvent(b.id, 'Notification', { message: 'y' });
    expect(loadNotifications()).toHaveLength(2);
  });

  it('sessão inexistente devolve false', () => {
    expect(sessionManager.agentEvent('nope', 'Stop')).toBe(false);
  });
});

describe('POST /sessions/:id/agent-event', () => {
  const spawned: string[] = [];
  afterEach(() => { for (const id of spawned.splice(0)) sessionManager.kill(id); wipe(); });
  const app = () => { const a = express(); a.use(sessionsRouter()); return a; };

  it('valida o evento, a sessão e quem chama', async () => {
    const s = sessionManager.spawn({ sessionName: 'Rota (teste)', cli: 'opencode' });
    const outra = sessionManager.spawn({ sessionName: 'Outra (teste)', cli: 'opencode' });
    spawned.push(s.id, outra.id);
    const a = app();
    expect((await request(a).post(`/sessions/${s.id}/agent-event`).send({ event: 'Nada' })).status).toBe(400);
    expect((await request(a).post('/sessions/nope/agent-event').send({ event: 'Stop' })).status).toBe(404);
    expect((await request(a).post(`/sessions/${s.id}/agent-event`).set('X-Joca-Session', outra.id).send({ event: 'Stop' })).status).toBe(403);
    const ok = await request(a).post(`/sessions/${s.id}/agent-event`).set('X-Joca-Session', s.id)
      .send({ event: 'Notification', detail: { message: 'precisa de permissão', lixo: 'x'.repeat(10) } });
    expect(ok.status).toBe(200);
    expect(sessionManager.info(sessionManager.get(s.id)!)).toMatchObject({ agentState: 'waiting', waitingReason: 'precisa de permissão' });
    // Um X-Joca-Session que nem existe continua a ser «outra sessão».
    expect((await request(a).post(`/sessions/${s.id}/agent-event`).set('X-Joca-Session', 'inventada').send({ event: 'Stop' })).status).toBe(403);
  });

  it('o detail chega filtrado e cortado — nunca o JSON cru do agente', async () => {
    const s = sessionManager.spawn({ sessionName: 'Detail (teste)', cli: 'opencode' });
    spawned.push(s.id);
    const vistos: { detail: Record<string, unknown> }[] = [];
    const on = (e: { detail: Record<string, unknown> }) => vistos.push(e);
    sessionManager.on('agent_event', on);
    try {
      const r = await request(app()).post(`/sessions/${s.id}/agent-event`)
        .send({ event: 'Notification', detail: { message: 'm'.repeat(900), prompt: 42, lixo: 'x', transcript_path: '/a' } });
      expect(r.status).toBe(200);
    } finally { sessionManager.off('agent_event', on); }
    expect(vistos).toHaveLength(1);
    expect(Object.keys(vistos[0].detail).filter((k) => vistos[0].detail[k] !== undefined)).toEqual(['message']);
    expect(vistos[0].detail.message).toBe('m'.repeat(500));
  });
});

describe('POST /sessions/:id/agent-event com auth ligada', () => {
  const spawned: string[] = [];
  const antes = process.env.JOCA_PASSWORD;
  beforeEach(() => { process.env.JOCA_PASSWORD = 'palavra-passe-de-teste'; });
  afterEach(() => {
    for (const id of spawned.splice(0)) sessionManager.kill(id);
    if (antes === undefined) delete process.env.JOCA_PASSWORD; else process.env.JOCA_PASSWORD = antes;
    wipe();
  });

  it('o token de agente só muda a PRÓPRIA sessão', async () => {
    const a = sessionManager.spawn({ sessionName: 'A (auth)', cli: 'opencode' });
    const b = sessionManager.spawn({ sessionName: 'B (auth)', cli: 'opencode' });
    spawned.push(a.id, b.id);
    const app = express();
    app.use(authRouter());
    app.use(requireAuth, sessionsRouter());
    const tokA = mintAgentToken(a.id);
    const post = (id: string, tok?: string) => {
      const r = request(app).post(`/sessions/${id}/agent-event`);
      if (tok) r.set('Authorization', `Bearer ${tok}`);
      return r.send({ event: 'Stop' });
    };
    expect((await post(a.id)).status).toBe(401);                 // sem token
    expect((await post(a.id, tokA)).status).toBe(200);            // própria sessão
    expect((await post(b.id, tokA)).status).toBe(403);            // outra sessão, mesmo sem X-Joca-Session
    expect((await post('nope', tokA)).status).toBe(404);          // sessão inexistente
    expect(sessionManager.info(b).agentState).toBeUndefined();    // B ficou intacta
    // O token do dono (login) não está preso a sessão nenhuma.
    const login = await request(app).post('/auth/login').send({ password: 'palavra-passe-de-teste' });
    expect((await post(b.id, login.body.token)).status).toBe(200);
    // O token de agente continua a abrir o resto da API (é o que o `joca` CLI usa).
    expect((await request(app).get('/sessions').set('Authorization', `Bearer ${tokA}`)).status).toBe(200);
  });
});

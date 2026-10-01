// Nome do terminal a partir do 1.º pedido (issue #12).
//
// O que se protege: (1) a regra que tira um nome curto de um pedido; (2) que só o 1.º pedido que
// dá nome o muda, e só enquanto o nome é o «Session N»; (3) que um nome teu nunca é pisado;
// (4) que a origem do nome vai para o retrato em disco.
import { vi, describe, it, expect, afterEach, afterAll } from 'vitest';

vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-session-name-${process.pid}`;
});

vi.mock('node-pty', () => ({
  spawn: () => ({
    pid: 1, cols: 120, rows: 30,
    onData: () => ({ dispose() {} }),
    onExit: () => ({ dispose() {} }),
    write() {}, kill() {}, resize() {},
  }),
}));

import fs from 'fs';
import express from 'express';
import request from 'supertest';
import { DATA_DIR } from '../project-store';
import { sessionManager, nomeDoPedido, NOME_AUTO_MAX } from '../session-manager';
import { sessionsRouter } from '../http/sessions-routes';
import { flushSessionsSnapshot, SNAPSHOT_FILE, type SessionsSnapshot } from '../sessions-snapshot';

afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

describe('nomeDoPedido', () => {
  it('/resume só com a pasta não dá nome: espera pelo pedido seguinte', () => {
    expect(nomeDoPedido('/resume "/Users/x/Projetos/Acme"')).toBeNull();
    expect(nomeDoPedido('/resume "/Users/x/Projetos/Acme" vamos fazer o deploy')).toBe('vamos fazer o deploy');
  });

  it('pedido curto fica tal e qual, com os acentos', () => {
    expect(nomeDoPedido('Corrige a navegação do cabeçalho')).toBe('Corrige a navegação do cabeçalho');
  });

  it('pedido longo corta numa fronteira de palavra, com «…», dentro do limite', () => {
    const nome = nomeDoPedido('Revê a página de preços e acrescenta uma tabela comparativa dos três planos');
    expect(nome).toBe('Revê a página de preços e acrescenta…');
    expect(nome!.length).toBeLessThanOrEqual(NOME_AUTO_MAX);
  });

  it('palavra única sem espaços corta a seco', () => {
    const nome = nomeDoPedido('x'.repeat(100))!;
    expect(nome.endsWith('…')).toBe(true);
    expect(nome.length).toBeLessThanOrEqual(NOME_AUTO_MAX);
  });

  it('multilinha: fica a 1.ª linha com texto, espaços colapsados', () => {
    expect(nomeDoPedido('\n\n  Faz   o   deploy\tdo site\nsegunda linha\nterceira')).toBe('Faz o deploy do site');
  });

  it('comando de barra: tira o comando, fica o pedido', () => {
    expect(nomeDoPedido('/goal faz X')).toBe('faz X');
    expect(nomeDoPedido('/plugin:cmd  revê o login')).toBe('revê o login');
    expect(nomeDoPedido('/goal\n\nmigra a base de dados')).toBe('migra a base de dados');
  });

  it('só o comando, ou vazio, não dá nome', () => {
    expect(nomeDoPedido('/clear')).toBeNull();
    expect(nomeDoPedido('  /compact  ')).toBeNull();
    expect(nomeDoPedido('')).toBeNull();
    expect(nomeDoPedido('   \n  ')).toBeNull();
    expect(nomeDoPedido('**``**')).toBeNull();
  });

  it('um caminho não é um comando de barra', () => {
    expect(nomeDoPedido('/Users/x/app.ts dá erro')).toBe('/Users/x/app.ts dá erro');
  });

  it('limpa markdown e caracteres de controlo', () => {
    expect(nomeDoPedido('## **Refactor** do `login`')).toBe('Refactor do login');
    expect(nomeDoPedido('- vê o [README](https://x.test/readme)')).toBe('vê o README');
    expect(nomeDoPedido('> olá\x07mundo\x00!')).toBe('olá mundo !');
  });
});

describe('nome automático no sessionManager', () => {
  const spawned: string[] = [];
  const nova = (sessionName?: string) => {
    const s = sessionManager.spawn(sessionName ? { sessionName } : {});
    spawned.push(s.id);
    return s;
  };
  afterEach(() => { for (const id of spawned.splice(0)) sessionManager.kill(id); });

  it('nasce «Session N» e o 1.º pedido dá-lhe o nome, com o evento de rename', () => {
    const s = nova();
    expect(s.name).toMatch(/^Session \d+$/);
    expect(s.nameSource).toBe('default');
    const renamed = vi.fn();
    sessionManager.on('renamed', renamed);
    try {
      sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'Corrige o formulário de contacto' });
    } finally { sessionManager.off('renamed', renamed); }
    expect(s.name).toBe('Corrige o formulário de contacto');
    expect(s.nameSource).toBe('auto');
    expect(renamed).toHaveBeenCalledWith({ sessionId: s.id, name: 'Corrige o formulário de contacto' });
  });

  it('só o 1.º pedido: os seguintes não mudam o nome', () => {
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'primeiro pedido' });
    sessionManager.agentEvent(s.id, 'Stop');
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'segundo pedido' });
    expect(s.name).toBe('primeiro pedido');
  });

  it('um `/clear` sozinho não conta: o pedido seguinte ainda dá o nome', () => {
    const s = nova();
    const antes = s.name;
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: '/clear' });
    expect(s.name).toBe(antes);
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', {});
    expect(s.name).toBe(antes);
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'agora a sério' });
    expect(s.name).toBe('agora a sério');
  });

  it('`/resume "pasta"` sozinho não dá nome; o pedido seguinte dá', () => {
    const s = nova();
    const antes = s.name;
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: '/resume "/Users/x/Projetos/Acme"' });
    expect(s.name).toBe(antes);
    expect(s.nameSource).toBe('default');
    sessionManager.agentEvent(s.id, 'Stop');
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'vamos fazer o deploy da loja' });
    expect(s.name).toBe('vamos fazer o deploy da loja');
    expect(s.nameSource).toBe('auto');
  });

  it('rename manual antes do 1.º pedido bloqueia o automático', () => {
    const s = nova();
    expect(sessionManager.rename(s.id, 'O meu nome')).toBe('O meu nome');
    expect(s.nameSource).toBe('user');
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'isto não pode ser o nome' });
    expect(s.name).toBe('O meu nome');
  });

  it('nome dado ao criar (projecto, skill) conta como teu', () => {
    const s = nova('Acme');
    expect(s.nameSource).toBe('user');
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'faz o deploy' });
    expect(s.name).toBe('Acme');
  });

  it('rename manual depois do automático fica teu', () => {
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'primeiro' });
    sessionManager.rename(s.id, 'Renomeado');
    expect(s.nameSource).toBe('user');
    expect(s.name).toBe('Renomeado');
  });

  it('pela rota do hook (o caminho do `joca hook UserPromptSubmit`)', async () => {
    const s = nova();
    const app = express();
    app.use(sessionsRouter());
    await request(app).post(`/sessions/${s.id}/agent-event`)
      .send({ event: 'UserPromptSubmit', detail: { prompt: '/goal revê o checkout' } })
      .expect(200);
    expect(s.name).toBe('revê o checkout');
  });

  it('a origem do nome vai para o retrato em disco', () => {
    const auto = nova();
    const meu = nova();
    const intacta = nova();
    sessionManager.agentEvent(auto.id, 'UserPromptSubmit', { prompt: 'pedido' });
    sessionManager.rename(meu.id, 'Meu');
    flushSessionsSnapshot();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as SessionsSnapshot;
    const de = (id: string) => snap.sessions.find((x) => x.id === id);
    expect(de(auto.id)).toMatchObject({ name: 'pedido', nameSource: 'auto' });
    expect(de(meu.id)).toMatchObject({ name: 'Meu', nameSource: 'user' });
    expect(de(intacta.id)).toMatchObject({ nameSource: 'default' });
  });
});

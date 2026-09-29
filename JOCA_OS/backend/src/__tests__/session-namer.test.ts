// Nome do terminal pelo Haiku (issue #12, 2.º passo).
//
// O que se protege: (1) a limpeza da resposta do modelo até 1-2 palavras; (2) que o nome do modelo
// só entra se a sessão ainda existe e ainda tem o nome da heurística; (3) que uma falha deixa a
// heurística; (4) uma só chamada por sessão. O nomeador é sempre falso — nunca o `claude` real.
import { vi, describe, it, expect, afterEach, afterAll, beforeEach } from 'vitest';

vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-session-namer-${process.pid}`;
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
import { DATA_DIR } from '../project-store';
import { sessionManager } from '../session-manager';
import { higienizarNome, NOME_MODELO_MAX, type Nomeador } from '../session-namer';

afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

describe('higienizarNome', () => {
  it('tira aspas, crases e pontuação final', () => {
    expect(higienizarNome('"Deploy site"')).toBe('Deploy site');
    expect(higienizarNome('«Formulário contacto».')).toBe('Formulário contacto');
    expect(higienizarNome('`Checkout`!')).toBe('Checkout');
    expect(higienizarNome('**Login quebrado**')).toBe('Login quebrado');
  });

  it('3+ palavras ficam 2', () => {
    expect(higienizarNome('Corrigir o formulário de contacto')).toBe('Corrigir o');
    expect(higienizarNome('Revisão página preços')).toBe('Revisão página');
  });

  it('multilinha: 1.ª linha com texto; rótulo «Nome:» sai', () => {
    expect(higienizarNome('\n\n  Migração BD  \nExplicação a mais')).toBe('Migração BD');
    expect(higienizarNome('Nome: Deploy VPS')).toBe('Deploy VPS');
  });

  it('vazio, só pontuação ou frase comprida não dá nome', () => {
    expect(higienizarNome('')).toBeNull();
    expect(higienizarNome('  \n ')).toBeNull();
    expect(higienizarNome('"..."')).toBeNull();
    expect(higienizarNome('Não consigo dar um nome a esta conversa sem mais contexto')).toBeNull();
  });

  it('corta no limite de caracteres', () => {
    const nome = higienizarNome('Supercalifragilisticexpialidocious Extra')!;
    expect(nome.length).toBeLessThanOrEqual(NOME_MODELO_MAX);
    expect(higienizarNome('Internacionalização Configuração')).toBe('Internacionalização');
  });
});

describe('nome pelo Haiku no sessionManager', () => {
  const spawned: string[] = [];
  const original = sessionManager.nomeador;
  const nova = () => { const s = sessionManager.spawn({}); spawned.push(s.id); return s; };
  // Nomeador que só responde quando o teste manda.
  const adiado = () => {
    let responder!: (v: string | null) => void;
    const chamadas: string[] = [];
    const nomeador: Nomeador = (prompt) => { chamadas.push(prompt); return new Promise((r) => { responder = r; }); };
    return { nomeador, chamadas, responder: (v: string | null) => responder(v) };
  };
  const esperar = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => { vi.stubEnv('JOCA_AUTO_NAME_MODEL', 'on'); });
  afterEach(() => {
    vi.unstubAllEnvs();
    sessionManager.nomeador = original;
    for (const id of spawned.splice(0)) sessionManager.kill(id);
  });

  it('heurística na hora; o nome do modelo entra depois, como auto, com evento', async () => {
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const s = nova();
    const renamed = vi.fn();
    sessionManager.on('renamed', renamed);
    try {
      sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'Corrige o formulário de contacto' });
      expect(s.name).toBe('Corrige o formulário de contacto');
      f.responder('Formulário contacto');
      await esperar();
    } finally { sessionManager.off('renamed', renamed); }
    expect(s.name).toBe('Formulário contacto');
    expect(s.nameSource).toBe('auto');
    expect(renamed).toHaveBeenLastCalledWith({ sessionId: s.id, name: 'Formulário contacto' });
  });

  it('rename teu entretanto: o do modelo é deitado fora', async () => {
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'faz o deploy' });
    sessionManager.rename(s.id, 'O meu nome');
    f.responder('Deploy');
    await esperar();
    expect(s.name).toBe('O meu nome');
    expect(s.nameSource).toBe('user');
  });

  it('sessão fechada entretanto: nada rebenta, nada é emitido', async () => {
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'faz o deploy' });
    sessionManager.kill(s.id);
    const renamed = vi.fn();
    sessionManager.on('renamed', renamed);
    try { f.responder('Deploy'); await esperar(); } finally { sessionManager.off('renamed', renamed); }
    expect(renamed).not.toHaveBeenCalled();
    expect(sessionManager.get(s.id)).toBeUndefined();
  });

  it('falha do modelo (null ou rejeição) deixa a heurística', async () => {
    sessionManager.nomeador = async () => null;
    const a = nova();
    sessionManager.agentEvent(a.id, 'UserPromptSubmit', { prompt: 'revê o checkout' });
    sessionManager.nomeador = () => Promise.reject(new Error('sem binário'));
    const b = nova();
    sessionManager.agentEvent(b.id, 'UserPromptSubmit', { prompt: 'migra a base' });
    await esperar();
    expect(a.name).toBe('revê o checkout');
    expect(b.name).toBe('migra a base');
  });

  it('uma só chamada por sessão, mesmo com vários pedidos', async () => {
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'primeiro' });
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'segundo' });
    f.responder('Primeiro');
    await esperar();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'terceiro' });
    expect(f.chamadas).toEqual(['primeiro']);
  });

  it('JOCA_AUTO_NAME_MODEL=off: nem chama o modelo', () => {
    vi.stubEnv('JOCA_AUTO_NAME_MODEL', 'off');
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'faz o deploy' });
    expect(f.chamadas).toEqual([]);
    expect(s.name).toBe('faz o deploy');
  });
});

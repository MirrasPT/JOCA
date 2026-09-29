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
import os from 'os';
import path from 'path';
import { DATA_DIR } from '../project-store';
import { sessionManager } from '../session-manager';
import {
  higienizarNome, avaliarResposta, pedidoParaModelo, embrulharPedido, ambienteDoFilho, escolherBinWindows,
  criarNomeadorHaiku, ARGS_HAIKU, NOME_MODELO_MAX, semComando, type Nomeador,
} from '../session-namer';

afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

describe('higienizarNome / avaliarResposta', () => {
  it('tira aspas, crases e pontuação final', () => {
    expect(higienizarNome('"Deploy site"')).toBe('Deploy site');
    expect(higienizarNome('«Formulário contacto».')).toBe('Formulário contacto');
    expect(higienizarNome('`Checkout`!')).toBe('Checkout');
    expect(higienizarNome('**Login quebrado**')).toBe('Login quebrado');
    expect(higienizarNome("'Deploy VPS'")).toBe('Deploy VPS');
  });

  it('apóstrofo por dentro fica', () => {
    expect(higienizarNome("Royal d'Ouro")).toBe("Royal d'Ouro");
  });

  it('palavras vazias não contam: aceita-se inteiro até 2 de conteúdo e 3 ao todo', () => {
    expect(higienizarNome('Página de preços')).toBe('Página de preços');
    expect(higienizarNome('Deploy do site')).toBe('Deploy do site');
  });

  it('nunca corta a meio: mais que isso descarta-se inteiro', () => {
    expect(higienizarNome('Corrigir o formulário de contacto')).toBeNull();
    expect(higienizarNome('Revisão página preços')).toBeNull();
    expect(higienizarNome('Olá! Como posso ajudar?')).toBeNull();
    expect(higienizarNome('Não consigo dar um nome a esta conversa sem mais contexto')).toBeNull();
    expect(avaliarResposta('Corrigir o formulário de contacto')).toEqual({ rejeitado: 'descartada' });
  });

  it('só palavras vazias ou restos («Deploy -») não passam por nome errado', () => {
    expect(higienizarNome('de o')).toBeNull();
    expect(higienizarNome('Deploy -')).toBe('Deploy');
  });

  it('multilinha: 1.ª linha com texto; rótulo «Nome:» sai, mesmo em negrito', () => {
    expect(higienizarNome('\n\n  Migração BD  \nExplicação a mais')).toBe('Migração BD');
    expect(higienizarNome('Nome: Deploy VPS')).toBe('Deploy VPS');
    expect(higienizarNome('**Nome:** Deploy VPS')).toBe('Deploy VPS');
  });

  it('vazio ou só pontuação: «vazia»', () => {
    expect(avaliarResposta('')).toEqual({ rejeitado: 'vazia' });
    expect(avaliarResposta('  \n ')).toEqual({ rejeitado: 'vazia' });
    expect(avaliarResposta('"..."')).toEqual({ rejeitado: 'vazia' });
  });

  it('acima do limite de caracteres descarta-se, não se corta', () => {
    expect(higienizarNome('Internacionalização Configuração')).toBeNull();
    expect(higienizarNome('Internacionalização')!.length).toBeLessThanOrEqual(NOME_MODELO_MAX);
  });
});

describe('semComando — comando só com caminho fica à espera', () => {
  it('/resume com caminho e nada mais não diz em que se vai trabalhar', () => {
    expect(semComando('/resume "/Users/x/Projetos/Bigorna"')).toBe('');
    expect(semComando("/resume '/Users/x/Meu Projeto'")).toBe('');
    expect(semComando('/resume ~/Projetos/Bigorna')).toBe('');
    expect(semComando('/resume ./app')).toBe('');
    expect(semComando('/resume C:\\Users\\renat\\Bigorna')).toBe('');
    expect(semComando('/resume')).toBe('');
  });
  it('com texto depois do caminho, o nome sai do texto', () => {
    expect(semComando('/resume "/Users/x/Bigorna" vamos corrigir o checkout')).toBe('vamos corrigir o checkout');
    expect(semComando('/goal corrige o login')).toBe('corrige o login');
  });
  it('sem comando, o caminho é o assunto e fica', () => {
    expect(semComando('/Users/x/app.ts dá erro')).toBe('/Users/x/app.ts dá erro');
  });
  it('pedidoParaModelo e nomeDoPedido seguem a mesma regra', () => {
    expect(pedidoParaModelo('/resume "/Users/x/Bigorna"')).toBeNull();
    expect(pedidoParaModelo('/resume "/Users/x/Bigorna" vamos fazer o deploy')).toBe('vamos fazer o deploy');
  });
});

describe('pedidoParaModelo / embrulharPedido', () => {
  it('tira o comando de barra; só o comando não dá pedido', () => {
    expect(pedidoParaModelo('/goal corrige o login')).toBe('corrige o login');
    expect(pedidoParaModelo('/cost do mês')).toBe('do mês');
    expect(pedidoParaModelo('/clear')).toBeNull();
    expect(pedidoParaModelo('   ')).toBeNull();
    expect(pedidoParaModelo('x'.repeat(900))!.length).toBe(500);
  });

  it('o embrulho nunca começa por barra', () => {
    const e = embrulharPedido('/help isto');
    expect(e.startsWith('/')).toBe(false);
    expect(e).toBe('Pedido:\n"""\n/help isto\n"""');
  });
});

describe('ambienteDoFilho', () => {
  it('tira as variáveis do JOCA e do Claude Code, fica a autenticação', () => {
    const env = ambienteDoFilho({
      PATH: '/bin', HOME: '/h', JOCA_API_URL: 'u', JOCA_CLI: 'c', JOCA_SESSION_ID: 's', JOCA_API_TOKEN: 't',
      CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_OAUTH_TOKEN: 'o', JOCA_DATA_DIR: 'd',
    });
    expect(Object.keys(env).sort()).toEqual(['CLAUDE_CODE_OAUTH_TOKEN', 'HOME', 'JOCA_DATA_DIR', 'PATH']);
  });
});

describe('escolherBinWindows', () => {
  it('prefere o .exe; só shim ou .cmd → null', () => {
    expect(escolherBinWindows('C:\\npm\\claude\r\nC:\\npm\\claude.cmd\r\nC:\\x\\claude.exe\r\n')).toBe('C:\\x\\claude.exe');
    expect(escolherBinWindows('C:\\npm\\claude\r\nC:\\npm\\claude.cmd')).toBeNull();
  });
});

// Um `claude` falso (script node): grava args, nomes das variáveis e stdin, e porta-se conforme
// FAKE_MODE. Nunca o CLI real.
describe.skipIf(process.platform === 'win32')('criarNomeadorHaiku com binário falso', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-fake-claude-'));
  const bin = path.join(dir, 'claude');
  const saida = path.join(dir, 'saida.json');
  fs.writeFileSync(bin, `#!/usr/bin/env node
let stdin = '';
process.stdin.on('data', (d) => { stdin += d; });
process.stdin.on('end', () => {
  require('fs').writeFileSync(process.env.FAKE_OUT, JSON.stringify({
    args: process.argv.slice(2), envKeys: Object.keys(process.env), stdin, cwd: process.cwd(),
  }));
  const modo = process.env.FAKE_MODE;
  if (modo === 'falha') { process.stderr.write('auth error'); process.exit(1); }
  if (modo === 'pendura') { setTimeout(() => {}, 60000); return; }
  process.stdout.write(modo === 'lixo' ? 'Claro! Aqui vai uma sugestão de nome\\n' : '"Deploy VPS".\\n');
});
`, { mode: 0o755 });
  const lido = () => JSON.parse(fs.readFileSync(saida, 'utf8')) as { args: string[]; envKeys: string[]; stdin: string; cwd: string };

  beforeEach(() => {
    try { fs.rmSync(saida); } catch { /* ok */ }
    vi.stubEnv('FAKE_OUT', saida);
    vi.stubEnv('JOCA_API_TOKEN', 'segredo');
    vi.stubEnv('JOCA_SESSION_ID', 'sessao');
    vi.stubEnv('CLAUDECODE', '1');
    vi.stubEnv('CLAUDE_CODE_ENTRYPOINT', 'cli');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('passa as flags, limpa o ambiente, embrulha o stdin e higieniza a resposta', async () => {
    vi.stubEnv('FAKE_MODE', 'ok');
    expect(await criarNomeadorHaiku(bin)('corrige o login')).toBe('Deploy VPS');
    const r = lido();
    expect(r.args).toEqual(ARGS_HAIKU);
    expect(r.args).not.toContain('--bare');
    expect(r.args[r.args.indexOf('--settings') + 1]).toBe('{"disableAllHooks":true,"alwaysThinkingEnabled":false}');
    for (const k of ['JOCA_API_TOKEN', 'JOCA_SESSION_ID', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) expect(r.envKeys).not.toContain(k);
    expect(r.envKeys).toContain('FAKE_OUT');
    expect(r.stdin).toBe(embrulharPedido('corrige o login'));
    expect(fs.realpathSync(r.cwd)).toBe(fs.realpathSync(os.tmpdir()));
  });

  it('exit ≠ 0 → null, com aviso sem o pedido', async () => {
    vi.stubEnv('FAKE_MODE', 'falha');
    expect(await criarNomeadorHaiku(bin)('pedido secreto')).toBeNull();
    const avisos = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(' ');
    expect(avisos).toMatch(/erro 1/);
    expect(avisos).not.toMatch(/secreto/);
  });

  it('resposta que não é nome → null, «descartada»', async () => {
    vi.stubEnv('FAKE_MODE', 'lixo');
    expect(await criarNomeadorHaiku(bin)('x')).toBeNull();
    expect((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(' ')).toMatch(/descartada/);
  });

  it('timeout mata o filho → null', async () => {
    vi.stubEnv('FAKE_MODE', 'pendura');
    const t0 = Date.now();
    expect(await criarNomeadorHaiku(bin, { timeoutMs: 500 })('x')).toBeNull();
    expect(Date.now() - t0).toBeLessThan(5000);
    expect((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(' ')).toMatch(/timeout/);
  });

  it('sem binário utilizável → null, sem aviso', async () => {
    expect(await criarNomeadorHaiku(null)('x')).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
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

  it('comando de barra: vai ao modelo o pedido sem o comando; só o comando não chama', () => {
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const a = nova();
    sessionManager.agentEvent(a.id, 'UserPromptSubmit', { prompt: '/goal corrige o login' });
    const b = nova();
    sessionManager.agentEvent(b.id, 'UserPromptSubmit', { prompt: '/clear' });
    expect(f.chamadas).toEqual(['corrige o login']);
  });

  it('um erro de quem ouve o rename do modelo não é engolido', async () => {
    const f = adiado();
    sessionManager.nomeador = f.nomeador;
    const s = nova();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'faz o deploy' });
    const erros: unknown[] = [];
    const apanhar = (e: unknown) => { erros.push(e); };
    process.on('unhandledRejection', apanhar);
    const rebenta = () => { throw new Error('listener partido'); };
    sessionManager.on('renamed', rebenta);
    try {
      f.responder('Deploy');
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      sessionManager.off('renamed', rebenta);
      process.off('unhandledRejection', apanhar);
    }
    expect(s.name).toBe('Deploy');
    expect(erros).toHaveLength(1);
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

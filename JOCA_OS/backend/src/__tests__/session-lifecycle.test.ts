// Arranque e fecho de um terminal (onda D: #22, #24/#18, #26, #29).
//
// O que se protege: (1) o diálogo novo de confiança do claude é reconhecido e respondido com
// «Yes», e o pedido inicial só sai depois dele; (2) o terminal não herda a sessão do Claude que
// arrancou o backend nem variáveis que injectam código; (3) o token de agente morre com o terminal;
// (4) reiniciar uma «Session N» não a marca como nome teu, e um rename chega 1× a cada cliente.
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

interface FakePty {
  env: Record<string, string>;
  writes: string[];
  onWrite?: (d: string) => void;
  emit(d: string): void;
  exit(): void;
}

// PTY falso controlável: cada teste decide o que o «CLI» responde a cada escrita.
const ptys = vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-session-lifecycle-${process.pid}`;
  return [] as FakePty[];
});

vi.mock('node-pty', () => ({
  spawn: (_file: string, _args: string[], opts: { env: Record<string, string> }) => {
    const dados: Array<(d: string) => void> = [];
    const saidas: Array<() => void> = [];
    const p = {
      pid: 1, cols: 120, rows: 30,
      env: opts.env,
      writes: [] as string[],
      onWrite: undefined as ((d: string) => void) | undefined,
      onData: (cb: (d: string) => void) => { dados.push(cb); return { dispose() {} }; },
      onExit: (cb: () => void) => { saidas.push(cb); return { dispose() {} }; },
      write(d: string) { p.writes.push(d); p.onWrite?.(d); },
      emit(d: string) { for (const cb of dados) cb(d); },
      exit() { for (const cb of saidas) cb(); },
      kill() {}, resize() {},
    };
    ptys.push(p);
    return p;
  },
}));

import fs from 'fs';
import net from 'net';
import { WebSocket } from 'ws';
import { DATA_DIR } from '../project-store';
import { sessionManager, pedeConfiancaNaPasta, recusaPorOmissao } from '../session-manager';
import { ambienteDoTerminal } from '../session-namer';
import { isAuthenticated } from '../auth';

afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

const spawned: string[] = [];
afterEach(() => { for (const id of spawned.splice(0)) sessionManager.kill(id); });
const ultimoPty = () => ptys[ptys.length - 1];

// Ecrã real do claude 2.1.288 numa pasta nova, capturado num PTY (bytes tal e qual, sem o link).
const C = '\x1b[1C';
const DIALOGO_NOVO =
  `\x1b[1m\x1b[3;2HAccessing${C}workspace:\x1b[m\x1b[1m\x1b[5;2HC:\\pasta-nova\x1b[22m`
  + `\x1b[7;2HQuick${C}safety${C}check:${C}Is${C}this${C}a${C}project${C}you${C}created${C}or${C}one${C}you${C}trust?`
  + `${C}(Like${C}your${C}own${C}code,${C}a${C}well-known${C}open${C}source\x1b[8;2Hproject,${C}or${C}work${C}from${C}your${C}team).`
  + `\x1b[10;2HClaude${C}Code'll${C}be${C}able${C}to${C}read,${C}edit,${C}and${C}execute${C}files${C}here.`
  + `\x1b[12;2HSecurity guide\x1b[14;2H❯${C}No,${C}exit\x1b[m\x1b[15;4HYes,${C}I${C}trust${C}this${C}folder`
  + `\x1b[38;2;153;153;153m\x1b[17;2HEnter${C}to${C}confirm${C}·${C}Esc${C}to${C}cancel`;
// O que o TUI repinta depois da seta para baixo: só as duas linhas das opções.
const REPINTA_YES = `\x1b[14;2H  No,${C}exit\x1b[15;2H❯${C}Yes,${C}I${C}trust${C}this${C}folder`;
const PROMPT_PRONTO = `\x1b[2J\x1b[20;2H❯ \x1b[22;2H? for shortcuts`;

describe('diálogo de confiança (#22)', () => {
  it('reconhece o diálogo novo e vê que a selecção por omissão é sair', () => {
    expect(pedeConfiancaNaPasta(DIALOGO_NOVO)).toBe(true);
    expect(recusaPorOmissao(DIALOGO_NOVO)).toBe(true);
    // Depois da seta, o último cursor está no «Yes».
    expect(recusaPorOmissao(DIALOGO_NOVO + REPINTA_YES)).toBe(false);
  });

  it('formulações tolerantes, com e sem espaços', () => {
    expect(pedeConfiancaNaPasta('Quick safety check: is this a project you created or one you trust?')).toBe(true);
    expect(pedeConfiancaNaPasta('Is this a project you created or one you trust?')).toBe(true);
    expect(pedeConfiancaNaPasta('❯ Yes, I trust this folder')).toBe(true);
    expect(pedeConfiancaNaPasta('Do you trust the files in this folder?')).toBe(true);
    expect(pedeConfiancaNaPasta('Doyoutrustthecontentsofthisdirectory')).toBe(true);
    expect(pedeConfiancaNaPasta('❯ olá, em que posso ajudar?')).toBe(false);
  });

  it('diálogos antigos têm «Yes» seleccionado: Enter directo', () => {
    expect(recusaPorOmissao('Do you trust the files in this folder?\n❯ 1. Yes, proceed\n  2. No, exit')).toBe(false);
    expect(recusaPorOmissao('Do you trust the contents of this directory?\n› 1. Yes, continue\n  2. No, quit')).toBe(false);
    expect(recusaPorOmissao('  1. Yes, proceed\n❯ 2. No, exit')).toBe(true);
    expect(recusaPorOmissao('sem cursor nenhum')).toBe(false);
  });

  // Um claude falso com o diálogo novo: Enter em «No» sai, a seta move para «Yes».
  function claudeComDialogo(opts: { ignoraTeclas?: boolean } = {}) {
    const estado = { selec: 'no' as 'no' | 'yes', dialogo: false, saiu: false };
    return (p: FakePty) => {
      p.onWrite = (d) => {
        if (!estado.dialogo && !estado.saiu && d.endsWith('\r') && d.length > 1 && p.writes.length === 1) {
          estado.dialogo = true;
          setTimeout(() => p.emit(DIALOGO_NOVO), 20);
          return;
        }
        if (estado.dialogo && !opts.ignoraTeclas) {
          if (d === '\x1b[B') { estado.selec = 'yes'; setTimeout(() => p.emit(REPINTA_YES), 20); return; }
          if (d === '\r') {
            estado.dialogo = false;
            if (estado.selec === 'no') { estado.saiu = true; setTimeout(() => p.exit(), 10); return; }
            setTimeout(() => p.emit(PROMPT_PRONTO), 20);
            return;
          }
          return;
        }
        if (!estado.dialogo && d !== '\r') p.emit(d);   // eco do que se escreve na caixa de input
      };
      return estado;
    };
  }

  it('responde «Yes» ao diálogo novo e só depois envia o pedido inicial', async () => {
    const s = sessionManager.spawn({ cli: 'claude', initialInput: 'faz o deploy do site' });
    spawned.push(s.id);
    const p = ultimoPty();
    const estado = claudeComDialogo()(p);
    await vi.waitFor(() => expect(p.writes.some((w) => w.includes('faz o deploy do site'))).toBe(true), { timeout: 12000, interval: 100 });
    expect(estado.saiu).toBe(false);
    expect(sessionManager.get(s.id)).toBeDefined();
    const seta = p.writes.indexOf('\x1b[B');
    const brief = p.writes.findIndex((w) => w.includes('faz o deploy do site'));
    expect(seta).toBeGreaterThan(0);
    // O Enter que aceita vem depois da seta e antes do pedido.
    const enter = p.writes.indexOf('\r', seta);
    expect(enter).toBeGreaterThan(seta);
    expect(brief).toBeGreaterThan(enter);
  }, 20000);

  it('diálogo que não se resolve: o pedido inicial não é escrito por cima', async () => {
    const s = sessionManager.spawn({ cli: 'claude', initialInput: 'pedido que não pode sair' });
    spawned.push(s.id);
    const p = ultimoPty();
    claudeComDialogo({ ignoraTeclas: true })(p);
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await vi.waitFor(() => expect(aviso.mock.calls.some((c) => String(c[0]).includes('diálogo de arranque por resolver'))).toBe(true), { timeout: 15000, interval: 200 });
    aviso.mockRestore();
    expect(p.writes.some((w) => w.includes('pedido que não pode sair'))).toBe(false);
    // Nenhum Enter cego com «No, exit» seleccionado: só setas.
    expect(p.writes.filter((w) => w === '\r')).toHaveLength(0);
  }, 25000);
});

describe('ambiente do terminal (#24, #18)', () => {
  it('tira a sessão do Claude, os JOCA_* herdados e as variáveis de injecção; mantém o resto', () => {
    const env = ambienteDoTerminal({
      PATH: '/usr/bin', HOME: '/home/x', LANG: 'pt_PT.UTF-8', TERM: 'xterm',
      CLAUDECODE: '1', AI_AGENT: 'x', CLAUDE_PID: '1', CLAUDE_EFFORT: 'x',
      CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_SESSION_ID: 'x', CLAUDE_CODE_CHILD_SESSION: '1',
      CLAUDE_CODE_MESSAGING_TOKEN: 'x', CLAUDE_CODE_EXECPATH: 'x',
      CLAUDE_CODE_OAUTH_TOKEN: 'x', CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CONFIG_DIR: '/c',
      JOCA_API_TOKEN: 'x', JOCA_SESSION_ID: 'x',
      NODE_OPTIONS: '--require x', LD_PRELOAD: 'x.so', LD_AUDIT: 'x', DYLD_INSERT_LIBRARIES: 'x',
      BASH_ENV: 'x', ENV: 'x', node_options: '--inspect',
      GIT_EDITOR: 'true', COREPACK_ENABLE_AUTO_PIN: '0', NoDefaultCurrentDirectoryInExePath: '1',
    });
    expect(Object.keys(env).sort()).toEqual([
      'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CONFIG_DIR', 'HOME', 'LANG', 'PATH', 'TERM',
    ]);
  });

  it('sem sinal da sessão do Claude, GIT_EDITOR e afins são do dono e ficam', () => {
    const env = ambienteDoTerminal({ PATH: '/usr/bin', GIT_EDITOR: 'vim', COREPACK_ENABLE_AUTO_PIN: '0' });
    expect(Object.keys(env).sort()).toEqual(['COREPACK_ENABLE_AUTO_PIN', 'GIT_EDITOR', 'PATH']);
  });

  it('o PTY nasce com esse ambiente mais o do JOCA', () => {
    const antes = { NODE_OPTIONS: process.env.NODE_OPTIONS, CLAUDECODE: process.env.CLAUDECODE };
    process.env.NODE_OPTIONS = '--max-old-space-size=64';
    process.env.CLAUDECODE = '1';
    try {
      const s = sessionManager.spawn({ sessionName: 'Ambiente (teste)', cli: 'opencode' });
      spawned.push(s.id);
      const env = ultimoPty().env;
      expect(env.NODE_OPTIONS).toBeUndefined();
      expect(env.CLAUDECODE).toBeUndefined();
      expect(env.JOCA_SESSION_ID).toBe(s.id);
      expect(env.PATH ?? env.Path).toBeTruthy();
    } finally {
      for (const [k, v] of Object.entries(antes)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
});

describe('token de agente morre com o terminal (#26)', () => {
  const antes = process.env.JOCA_PASSWORD;
  beforeEach(() => { process.env.JOCA_PASSWORD = 'palavra-passe-de-teste'; });
  afterEach(() => { if (antes === undefined) delete process.env.JOCA_PASSWORD; else process.env.JOCA_PASSWORD = antes; });
  const valido = (tok: string) => isAuthenticated({ headers: { authorization: `Bearer ${tok}` } });

  it('fechar pela UI (kill) revoga o token', () => {
    const s = sessionManager.spawn({ sessionName: 'Token kill (teste)', cli: 'opencode' });
    const tok = ultimoPty().env.JOCA_API_TOKEN;
    expect(tok).toBeTruthy();
    expect(valido(tok)).toBe(true);
    sessionManager.kill(s.id);
    expect(valido(tok)).toBe(false);
  });

  it('o processo sair sozinho (onExit) também revoga, e não mexe no token de outro terminal', () => {
    const a = sessionManager.spawn({ sessionName: 'Token exit (teste)', cli: 'opencode' });
    const pa = ultimoPty();
    const b = sessionManager.spawn({ sessionName: 'Token outro (teste)', cli: 'opencode' });
    spawned.push(b.id);
    const tokB = ultimoPty().env.JOCA_API_TOKEN;
    pa.exit();
    expect(sessionManager.get(a.id)).toBeUndefined();
    expect(valido(pa.env.JOCA_API_TOKEN)).toBe(false);
    expect(valido(tokB)).toBe(true);
  });
});

describe('evento closed sai uma só vez (#106)', () => {
  const contar = (id: string) => {
    const vistos: string[] = [];
    const ouvir = ({ sessionId }: { sessionId: string }) => { if (sessionId === id) vistos.push(sessionId); };
    sessionManager.on('closed', ouvir);
    return { vistos, parar: () => sessionManager.off('closed', ouvir) };
  };

  it('fechar pela UI: o onExit que o node-pty dispara depois do kill não repete o closed', () => {
    const s = sessionManager.spawn({ sessionName: 'Closed kill (teste)', cli: 'opencode' });
    const p = ultimoPty();
    const c = contar(s.id);
    try {
      sessionManager.kill(s.id);
      p.exit();   // o que o PTY real faz quando o processo morre a seguir ao kill
      expect(c.vistos).toHaveLength(1);
    } finally { c.parar(); }
  });

  it('o processo sair sozinho continua a emitir closed', () => {
    const s = sessionManager.spawn({ sessionName: 'Closed exit (teste)', cli: 'opencode' });
    const c = contar(s.id);
    try {
      ultimoPty().exit();
      expect(c.vistos).toHaveLength(1);
      expect(sessionManager.get(s.id)).toBeUndefined();
    } finally { c.parar(); }
  });
});

// Servidor real (server.ts): é lá que estão ligados os broadcasts. Porta livre, nunca a do JOCA vivo.
async function portaLivre(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

interface Cliente { ws: WebSocket; msgs: Array<Record<string, unknown>> }
async function ligar(port: number): Promise<Cliente> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const c: Cliente = { ws, msgs: [] };
  ws.on('message', (raw) => c.msgs.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
  return c;
}

describe('nome e reinício pela UI (#29)', () => {
  let port = 0;
  const clientes: Cliente[] = [];
  beforeEach(async () => {
    if (!port) {
      port = await portaLivre();
      process.env.PORT = String(port);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await import('../server');
      await vi.waitFor(async () => { (await ligar(port)).ws.close(); }, { timeout: 5000 });
    }
  });
  afterEach(() => { for (const c of clientes.splice(0)) c.ws.close(); });

  const criada = async (c: Cliente, antes: number) => {
    let id = '';
    await vi.waitFor(() => {
      const m = c.msgs.slice(antes).find((x) => x.type === 'session_created');
      expect(m).toBeDefined();
      id = (m!.session as { id: string }).id;
    }, { timeout: 3000 });
    spawned.push(id);
    return id;
  };

  it('reiniciar uma «Session N» sem pedido deixa-a à espera do nome automático', async () => {
    const c = await ligar(port); clientes.push(c);
    let n = c.msgs.length;
    c.ws.send(JSON.stringify({ type: 'create_session', cli: 'opencode' }));
    const id = await criada(c, n);
    const nome = sessionManager.get(id)!.name;
    expect(sessionManager.get(id)!.nameSource).toBe('default');

    n = c.msgs.length;
    c.ws.send(JSON.stringify({ type: 'create_session', restartOf: id, sessionName: nome, cli: 'opencode' }));
    const novo = await criada(c, n);
    expect(sessionManager.get(id)).toBeUndefined();          // a antiga fechou
    expect(c.msgs.some((m) => m.type === 'session_closed' && m.sessionId === id)).toBe(true);
    expect(sessionManager.get(novo)!.name).toBe(nome);
    expect(sessionManager.get(novo)!.nameSource).toBe('default');

    sessionManager.agentEvent(novo, 'UserPromptSubmit', { prompt: 'Corrige o login' });
    expect(sessionManager.get(novo)!.name).toBe('Corrige o login');
  });

  it('reiniciar uma sessão com nome teu mantém-no teu', async () => {
    const c = await ligar(port); clientes.push(c);
    let n = c.msgs.length;
    c.ws.send(JSON.stringify({ type: 'create_session', sessionName: 'Backoffice', cli: 'opencode' }));
    const id = await criada(c, n);
    n = c.msgs.length;
    c.ws.send(JSON.stringify({ type: 'create_session', restartOf: id, sessionName: 'Backoffice', cli: 'opencode' }));
    const novo = await criada(c, n);
    expect(sessionManager.get(novo)!.nameSource).toBe('user');
    sessionManager.agentEvent(novo, 'UserPromptSubmit', { prompt: 'Corrige o login' });
    expect(sessionManager.get(novo)!.name).toBe('Backoffice');
  });

  it('rename pela UI chega exatamente 1× a cada cliente', async () => {
    const a = await ligar(port); const b = await ligar(port); clientes.push(a, b);
    const n0 = a.msgs.length;
    a.ws.send(JSON.stringify({ type: 'create_session', cli: 'opencode' }));
    const id = await criada(a, n0);
    const na = a.msgs.length, nb = b.msgs.length;
    a.ws.send(JSON.stringify({ type: 'rename_session', sessionId: id, name: 'Novo nome' }));
    await vi.waitFor(() => expect(b.msgs.slice(nb).some((m) => m.type === 'session_renamed')).toBe(true), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 200));   // um 2.º envio teria chegado entretanto
    for (const [c, desde] of [[a, na], [b, nb]] as const) {
      const renames = c.msgs.slice(desde).filter((m) => m.type === 'session_renamed' && m.sessionId === id);
      expect(renames).toEqual([{ type: 'session_renamed', sessionId: id, name: 'Novo nome' }]);
    }
    expect(sessionManager.get(id)!.nameSource).toBe('user');
  });

  it('nome automático e limpeza da linha de estado (#7) no mesmo pedido, numa «Session N»', async () => {
    const s = sessionManager.spawn({ cli: 'opencode' });
    spawned.push(s.id);
    sessionManager.setCurrentJob(s.id, 'a rever o pedido anterior');
    const eventos: string[] = [];
    const onRenamed = ({ sessionId }: { sessionId: string }) => { if (sessionId === s.id) eventos.push('renamed'); };
    const onJob = ({ sessionId, currentJob }: { sessionId: string; currentJob?: string }) => {
      if (sessionId === s.id) eventos.push(`job:${currentJob ?? ''}`);
    };
    sessionManager.on('renamed', onRenamed);
    sessionManager.on('current_job', onJob);
    try {
      sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'Migra a base de dados' });
    } finally {
      sessionManager.off('renamed', onRenamed);
      sessionManager.off('current_job', onJob);
    }
    expect(eventos).toEqual(['renamed', 'job:']);
    const info = sessionManager.info(s);
    expect(info.name).toBe('Migra a base de dados');
    expect(info.currentJob).toBeUndefined();
    expect(sessionManager.get(s.id)!.nameSource).toBe('auto');
  });
});

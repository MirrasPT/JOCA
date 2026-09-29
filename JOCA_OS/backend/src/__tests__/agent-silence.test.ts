// Estado do agente ao longo do TEMPO, com um PTY falso (issue #6, correcção).
//
// O que se protege — tudo coisas que só se vêem com saída do terminal e relógio a andar:
//   (1) sem hooks, a heurística de rajadas alimenta o `agentState`; com hooks deixa de lhe mexer
//       (as duas guardas do onData e do fim de rajada);
//   (2) o 1.º hook deita fora o estado que a heurística lá tinha posto;
//   (3) a rede de silêncio: um turno interrompido (Esc/Ctrl+C) não emite Stop, e a sessão não pode
//       ficar «a trabalhar» para sempre — mas enquanto o spinner mexe, continua a trabalhar;
//   (4) responder a um «à espera de ti» (Enter/Esc/Ctrl+C) tira-o da espera e resolve a notificação.
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

const h = vi.hoisted(() => {
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  process.env.JOCA_DATA_DIR = `${tmp}/joca-os-test-agent-silence-${process.pid}`;
  type Fake = { emit(d: string): void; write: (d: string) => void; writes: string[] };
  return { ptys: [] as Fake[] };
});

// PTY falso: o teste decide quando chegam bytes. Nada de shell nem de CLI a arrancar de verdade.
vi.mock('node-pty', () => ({
  spawn: () => {
    let onData: (d: string) => void = () => {};
    const fake = {
      pid: 1,
      writes: [] as string[],
      onData(cb: (d: string) => void) { onData = cb; return { dispose() {} }; },
      onExit() { return { dispose() {} }; },
      write(d: string) { fake.writes.push(d); },
      emit(d: string) { onData(d); },
      kill() {},
      resize() {},
    };
    h.ptys.push(fake);
    return fake;
  },
}));

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../project-store';
import { sessionManager, AGENT_SILENCE_DONE_MS, FERRAMENTA_ABERTA_MAX_MS } from '../session-manager';
import { loadNotifications } from '../notifications/store';

const notifFile = path.join(DATA_DIR, 'notifications.json');
afterAll(() => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ok */ } });

describe('estado do agente com o relógio a andar', () => {
  const spawned: string[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    try { fs.rmSync(notifFile, { force: true }); } catch { /* ok */ }
  });
  afterEach(() => {
    for (const id of spawned.splice(0)) sessionManager.kill(id);
    vi.useRealTimers();
  });
  const abrir = () => {
    const s = sessionManager.spawn({ sessionName: 'Silêncio (teste)', cli: 'opencode' });
    spawned.push(s.id);
    return { s, pty: h.ptys[h.ptys.length - 1] };
  };
  const estado = (id: string) => sessionManager.info(sessionManager.get(id)!).agentState;

  it('sem hooks a heurística manda; depois do 1.º hook deixa de mexer no agentState', () => {
    const { s, pty } = abrir();
    pty.emit('olá');
    expect(estado(s.id)).toBe('working');            // heurística: rajada → a trabalhar
    vi.advanceTimersByTime(1600);
    expect(estado(s.id)).toBeUndefined();            // rajada sem dono → sem estado

    sessionManager.agentEvent(s.id, 'SessionStart');
    pty.emit('repintura da TUI com texto');
    expect(estado(s.id)).toBeUndefined();            // com hooks, bytes não são «a trabalhar»
  });

  it('o 1.º hook deita fora o «a trabalhar» que a heurística deixou', () => {
    const { s, pty } = abrir();
    pty.emit('arranque da TUI');
    expect(estado(s.id)).toBe('working');
    sessionManager.agentEvent(s.id, 'SessionStart');
    expect(estado(s.id)).toBeUndefined();
  });

  it('com hooks, o fim de uma rajada não tira a sessão de «a trabalhar»', () => {
    const { s, pty } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    pty.emit('✻ Thinking…');
    vi.advanceTimersByTime(1600);                    // a heurística fecha a rajada aqui
    expect(estado(s.id)).toBe('working');
  });

  it('spinner a mexer = a trabalhar; silêncio acima do limiar = acabou', () => {
    const { s, pty } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    for (let i = 1; i <= 12; i++) {                  // 12 s de ferramenta longa, spinner a 1 Hz
      vi.advanceTimersByTime(1000);
      pty.emit(`✻ Running… (${i}s)`);
    }
    expect(estado(s.id)).toBe('working');
    // Repintura sem texto (cursor, cores) não conta como sinal de vida.
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS - 100);
    pty.emit('\x1b[?25l\x1b[2K\r');
    expect(estado(s.id)).toBe('working');
    vi.advanceTimersByTime(200);
    expect(estado(s.id)).toBe('done');
  });

  it('Ctrl+C a meio: sem Stop, sai de «a trabalhar» dentro do limiar', () => {
    const { s, pty } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    pty.emit('✻ Thinking…');
    sessionManager.input(s.id, '\x03');
    pty.emit('Interrupted · What should Claude do instead?');
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('responder ao «à espera de ti» tira-o da espera e resolve a notificação', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'Notification', { message: 'Claude needs your permission to use Bash' });
    expect(estado(s.id)).toBe('waiting');
    sessionManager.input(s.id, '\x1b[B');            // seta: ainda a escolher
    sessionManager.input(s.id, 'a');
    expect(estado(s.id)).toBe('waiting');
    expect(loadNotifications()[0].read).toBe(false);

    sessionManager.input(s.id, '\r');                 // escolheu
    expect(estado(s.id)).toBe('working');
    expect(loadNotifications()[0].read).toBe(true);
    // Recusou (nenhum hook chega): o silêncio fecha o turno.
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('Esc ou o interromper do JOCA num pedido de permissão também contam como resposta', () => {
    const a = abrir().s;
    sessionManager.agentEvent(a.id, 'Notification', { message: 'p' });
    sessionManager.input(a.id, '\x1b');
    expect(estado(a.id)).toBe('working');

    const b = abrir().s;
    sessionManager.agentEvent(b.id, 'Notification', { message: 'p' });
    sessionManager.interrupt(b.id);
    expect(estado(b.id)).toBe('working');
  });

  it('AskUserQuestion com 2 perguntas: fica à espera até ao PostToolUse, não ao 1.º Enter', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'AskUserQuestion' });
    // O diálogo está desenhado e parado, o aviso ainda não chegou (medido: ~6 s): não é «acabou».
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS * 3);
    expect(estado(s.id)).toBe('working');
    sessionManager.agentEvent(s.id, 'Notification', { message: 'Claude needs your input' });
    expect(estado(s.id)).toBe('waiting');
    sessionManager.input(s.id, '\r');                 // 1.ª pergunta respondida
    sessionManager.input(s.id, '2');                  // escolhe na 2.ª
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS * 3);
    expect(estado(s.id)).toBe('waiting');
    expect(loadNotifications()[0].read).toBe(false);
    sessionManager.agentEvent(s.id, 'PostToolUse', { tool: 'AskUserQuestion' });   // submeteu
    expect(estado(s.id)).toBe('working');
    expect(loadNotifications()[0].read).toBe(true);
  });

  it('AskUserQuestion: Esc cancela e tira da espera', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'AskUserQuestion' });
    sessionManager.agentEvent(s.id, 'Notification', { message: 'q' });
    sessionManager.input(s.id, '\x1b');
    expect(estado(s.id)).toBe('working');
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('permissão respondida com um dígito sai logo da espera', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    sessionManager.agentEvent(s.id, 'Notification', { message: 'Claude needs your permission to use Bash' });
    sessionManager.input(s.id, '1');
    expect(estado(s.id)).toBe('working');
    expect(loadNotifications()[0].read).toBe(true);
    // O aviso já tinha fechado a «ferramenta aberta»: se nada correr (recusou), o silêncio fecha o turno.
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('`joca send` a uma permissão conta como resposta', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    sessionManager.agentEvent(s.id, 'Notification', { message: 'p' });
    sessionManager.submitMessage(s.id, '1');
    expect(estado(s.id)).toBe('working');
  });

  it('entre PreToolUse e PostToolUse a rede de silêncio não corre; Esc volta a ligá-la', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS * 3);
    expect(estado(s.id)).toBe('working');
    sessionManager.agentEvent(s.id, 'PostToolUse', { tool: 'Bash' });
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');                // depois do PostToolUse volta a valer

    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'y' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    sessionManager.input(s.id, '\x1b');               // interrompeste a ferramenta: não há Post
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('recusar com «3» ANTES do aviso: sem hook nenhum, sai de «a trabalhar» em ~5 s', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    sessionManager.input(s.id, '3');                  // «No» no diálogo; o aviso nunca chega
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('`joca send` antes do aviso também fecha a ferramenta aberta', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    sessionManager.submitMessage(s.id, '3');
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('ferramenta aberta sem saída nenhuma: o tecto fecha-a e a rede de 5 s volta', () => {
    const { s, pty } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });   // cancelada pelo remote control
    vi.advanceTimersByTime(FERRAMENTA_ABERTA_MAX_MS - 1000);
    pty.emit('✻ Running…');                           // saída visível adia o tecto
    vi.advanceTimersByTime(FERRAMENTA_ABERTA_MAX_MS - 1000);
    expect(estado(s.id)).toBe('working');
    vi.advanceTimersByTime(1000 + AGENT_SILENCE_DONE_MS + 100);
    expect(estado(s.id)).toBe('done');
  });

  it('ferramentas em paralelo: o Post de uma não reabre a rede enquanto outra está aberta', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'UserPromptSubmit', { prompt: 'x' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Read' });
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Bash' });
    sessionManager.agentEvent(s.id, 'PostToolUse', { tool: 'Read' });
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS * 3);            // Bash parada à espera do aviso
    expect(estado(s.id)).toBe('working');
    sessionManager.agentEvent(s.id, 'PostToolUse', { tool: 'Bash' });
    sessionManager.agentEvent(s.id, 'PostToolUse', { tool: 'Bash' });   // Post a mais não fica negativo
    sessionManager.agentEvent(s.id, 'PreToolUse', { tool: 'Glob' });
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS * 3);
    expect(estado(s.id)).toBe('working');
  });

  it('à espera de ti não expira sozinho: silêncio em espera é normal', () => {
    const { s } = abrir();
    sessionManager.agentEvent(s.id, 'Notification', { message: 'p' });
    vi.advanceTimersByTime(AGENT_SILENCE_DONE_MS * 10);
    expect(estado(s.id)).toBe('waiting');
  });
});

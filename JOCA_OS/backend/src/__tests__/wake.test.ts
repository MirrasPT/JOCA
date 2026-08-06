// Os caminhos que acordam o gestor: o FECHO de um worker e as MUDANÇAS NO QUADRO DE TAREFAS.
//
// ── Fecho ──
//
// Porque é que isto merece teste próprio: o `onExit` do node-pty cancela o `idleTimer` pendente,
// portanto uma rajada que acabe antes dos DONE_MIN_WORK_MS (2s) nunca chega a emitir 'done'. O
// 'closed' era tratado só com `forgetSession` — o worker desaparecia do pool em silêncio e o gestor
// que estava à espera dele ficava à espera para sempre. A varredura de encalhados também não salva
// o caso: `estaEncalhado` desiste quando a sessão já não existe.
//
// Estes testes prendem as três decisões: fecho com o gestor à espera acorda-o; fecho de um worker
// parado não; e o 'done' normal continua a funcionar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Emissor mínimo + estado partilhado. `vi.hoisted` porque as fábricas do `vi.mock` sobem acima dos
// imports e não podem fechar sobre consts normais.
const h = vi.hoisted(() => {
  const handlers: Record<string, Array<(p: unknown) => void>> = {};
  const workers = new Map<string, { sessionId: string; projectId: string; area: string; busy: boolean; currentJob?: string }>();
  const turnos: Array<{ id: string; texto: string; tipo: string }> = [];
  return {
    handlers,
    workers,
    turnos,
    esquecidos: [] as string[],
    sessionManager: {
      on(evento: string, fn: (p: unknown) => void) { (handlers[evento] ??= []).push(fn); },
      get: (id: string) => (workers.has(id) || id.startsWith('gestor-') ? { status: 'idle' as const, lastOutputTime: 0 } : undefined),
      readBuffer: () => 'output vivo do terminal',
      // Canal actual: com o SDK desligado, o drain entrega o relatório no TERMINAL do gestor.
      submitMessage: (id: string, texto: string) => { turnos.push({ id, texto, tipo: 'terminal' }); return true; },
    },
    emitir(evento: string, payload: unknown) { for (const fn of handlers[evento] ?? []) fn(payload); },
  };
});

vi.mock('../session-manager', () => ({ sessionManager: h.sessionManager }));
// Um projecto por teste, de propósito: o travão de progresso do `wake` é por gestor e vive em
// memória do módulo, logo dois testes seguidos no mesmo projecto com a mesma impressão digital
// travavam-se um ao outro e o segundo nunca corria o turno.
vi.mock('../project-store', () => ({
  loadProjects: () => [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, name: `Teste ${n}`, path: `/tmp/p${n}` })),
}));
vi.mock('../tasks/engine', () => ({
  judgeWorkerOutput: async () => ({ state: 'done', summary: 'fez o que foi pedido' }),
}));
vi.mock('../tasks/store', () => ({ loadTasks: () => [] }));
vi.mock('../heartbeat', () => ({ getMaxAutoWakes: () => 5 }));
vi.mock('../notifications/store', () => ({ pushNotification: vi.fn() }));
vi.mock('../manager/manager', () => ({
  GLOBAL_MANAGER_ID: '__global__',
  // Como na app real: SDK desligado → o drain entrega no terminal do gestor via submitMessage.
  isManagerSdkEnabled: () => false,
  runManagerTurn: async (id: string, texto: string, tipo: string) => { h.turnos.push({ id, texto, tipo }); },
  runGlobalManagerTurn: async () => {},
  // Usado pelo `drain` para distinguir limite de plano de avaria. O mock devolve sempre `false`:
  // aqui nenhum turno falha, e um mock a mais era um caminho a testar que não é o desta suite.
  erroDeLimite: () => false,
}));
vi.mock('../manager/store', () => ({
  getState: () => ({ autoWakeCount: 0 }),
  patchState: vi.fn(),
  appendMessage: vi.fn(),
}));
vi.mock('../manager/worker-pool', () => ({
  findBySession: (id: string) => h.workers.get(id),
  markIdle: (id: string) => { const w = h.workers.get(id); if (w) { w.busy = false; w.currentJob = undefined; } return w; },
  forgetSession: (id: string) => { h.esquecidos.push(id); h.workers.delete(id); },
  // Cada projecto tem o seu terminal de gestor aberto (é para lá que o drain entrega).
  listWorkers: (projectId: string) => [{ sessionId: `gestor-${projectId}`, projectId, area: 'gestor', busy: false, lastUsedAt: 0 }],
  listAllWorkers: () => [...h.workers.values()],
}));

import { startManagerWatch, acordarPorTarefas } from '../manager/wake';

const DEBOUNCE_MS = 1500;

function porWorker(sessionId: string, busy: boolean, projectId: string) {
  h.workers.set(sessionId, { sessionId, projectId, area: 'design', busy, currentJob: busy ? 'faz o brand book' : undefined });
}

describe('worker que fecha sem chegar a emitir done', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const k of Object.keys(h.handlers)) delete h.handlers[k];
    h.workers.clear();
    h.turnos.length = 0;
    h.esquecidos.length = 0;
    startManagerWatch();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('acorda o gestor que estava à espera dele', async () => {
    porWorker('s1', true, 'p1');
    h.emitir('closed', { sessionId: 's1', finalOutput: 'ultimo ecra do agente' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

    expect(h.turnos).toHaveLength(1);
    expect(h.turnos[0].id).toBe('gestor-p1');
    expect(h.turnos[0].tipo).toBe('terminal');
    expect(h.turnos[0].texto).toContain('FECHOU');
    // O último ecrã tem de viajar: é a única coisa que resta do agente.
    expect(h.turnos[0].texto).toContain('ultimo ecra do agente');
    // E o trabalho que lhe tinha sido dado, senão o gestor não sabe o que verificar.
    expect(h.turnos[0].texto).toContain('faz o brand book');
    // Não o pode mandar responder a um terminal que já não existe.
    expect(h.turnos[0].texto).not.toContain('responder_worker');
  });

  it('esquece o worker à mesma, depois de reportar', async () => {
    porWorker('s1', true, 'p2');
    h.emitir('closed', { sessionId: 's1', finalOutput: 'x' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(h.esquecidos).toEqual(['s1']);
  });

  it('não acorda ninguém quando o worker fechado estava parado', async () => {
    porWorker('s2', false, 'p3');
    h.emitir('closed', { sessionId: 's2', finalOutput: 'nada de novo' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(h.turnos).toHaveLength(0);
    expect(h.esquecidos).toEqual(['s2']);
  });

  it('ignora o fecho de uma sessão que não é worker de gestor', async () => {
    h.emitir('closed', { sessionId: 'sessao-do-utilizador', finalOutput: 'x' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(h.turnos).toHaveLength(0);
  });

  it('o caminho normal do done continua a reportar', async () => {
    porWorker('s3', true, 'p4');
    h.emitir('done', { sessionId: 's3' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(h.turnos).toHaveLength(1);
    expect(h.turnos[0].texto).toContain('terminou o trabalho');
    expect(h.turnos[0].texto).toContain('output vivo do terminal');
  });
});

// Mudanças no quadro: o gestor tem de saber que o quadro mexeu, senão nunca pega em trabalho
// sozinho — só reage a workers que acabam. Quem chama isto é SÓ a camada HTTP das tarefas; as
// ferramentas do próprio gestor escrevem directamente no store e por isso não o acordam a ele
// mesmo. É essa assimetria que evita o ciclo, e é ela que estes testes protegem.
describe('acordarPorTarefas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const k of Object.keys(h.handlers)) delete h.handlers[k];
    h.workers.clear();
    h.turnos.length = 0;
  });
  afterEach(() => { vi.useRealTimers(); });

  it('acorda o gestor do projecto com o que mudou', async () => {
    acordarPorTarefas('p1', 'Tarefa NOVA na coluna "a-executar": "arranjar o header".');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

    expect(h.turnos).toHaveLength(1);
    expect(h.turnos[0].id).toBe('gestor-p1');
    expect(h.turnos[0].tipo).toBe('terminal');
    expect(h.turnos[0].texto).toContain('QUADRO DE TAREFAS');
    expect(h.turnos[0].texto).toContain('arranjar o header');
    // Tem de poder ficar calado: senão cada arrastar de cartão vira uma mensagem no chat.
    expect(h.turnos[0].texto).toContain('não respondas');
  });

  it('uma rajada de mudanças dá UM turno, não um por mudança', async () => {
    acordarPorTarefas('p2', 'mudanca 1');
    acordarPorTarefas('p2', 'mudanca 2');
    acordarPorTarefas('p2', 'mudanca 3');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

    expect(h.turnos).toHaveLength(1);
    for (const n of ['mudanca 1', 'mudanca 2', 'mudanca 3']) {
      expect(h.turnos[0].texto).toContain(n);
    }
  });

  it('projectos diferentes acordam gestores diferentes', async () => {
    acordarPorTarefas('p3', 'mexeu no p3');
    acordarPorTarefas('p4', 'mexeu no p4');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

    expect(h.turnos.map((t) => t.id).sort()).toEqual(['gestor-p3', 'gestor-p4']);
  });
});

// Wake queue — how the manager finds out that a worker finished, without the races that killed
// the previous Master.
//
// The old design was fire-and-forget plus a watcher that re-invoked the brain on every 'done'; it
// needed activeRuns, draining, queue, autoCount and DEFER_MS bolted on afterwards. Here those
// guards ARE the design:
//
//   • one queue per project, strictly serialised — two turns of the same manager never overlap;
//   • a debounce, so a burst of 'done' events collapses into one wake;
//   • a budget of consecutive automatic wakes, reset only by the user talking — an agent loop
//     cannot burn tokens forever;
//   • the manager receives the JUDGE's verdict plus a short tail, never the whole buffer.
import { sessionManager } from '../session-manager';
import { loadProjects } from '../project-store';
import { judgeWorkerOutput } from '../tasks/engine';
import { runManagerTurn } from './manager';
import { getState, patchState, appendMessage } from './store';
import { markIdle, findBySession, forgetSession } from './worker-pool';

const DEBOUNCE_MS = 1500;
const MAX_AUTO_WAKES = 6;     // consecutive system wakes without the user saying anything

interface Pending { texts: string[]; timer: ReturnType<typeof setTimeout> | null }

const queues = new Map<string, Pending>();
const running = new Set<string>();

// Called when the user sends a message: their attention resets the automatic budget.
export function resetWakeBudget(projectId: string): void {
  patchState(projectId, { autoWakeCount: 0 });
}

function enqueue(projectId: string, text: string): void {
  let p = queues.get(projectId);
  if (!p) { p = { texts: [], timer: null }; queues.set(projectId, p); }
  p.texts.push(text);
  if (p.timer) clearTimeout(p.timer);
  p.timer = setTimeout(() => { p!.timer = null; void drain(projectId); }, DEBOUNCE_MS);
}

async function drain(projectId: string): Promise<void> {
  if (running.has(projectId)) return;            // a turn is in flight; it will re-drain at the end
  const p = queues.get(projectId);
  if (!p || p.texts.length === 0) return;

  const state = getState(projectId);
  if (state.autoWakeCount >= MAX_AUTO_WAKES) {
    // Budget spent: stop waking the manager and leave a visible trace instead of looping silently.
    p.texts.length = 0;
    appendMessage(projectId, {
      role: 'system',
      text: `Pausei os avisos automáticos deste projecto (${MAX_AUTO_WAKES} seguidos sem interacção tua). Escreve alguma coisa para eu retomar.`,
    });
    return;
  }

  const batch = p.texts.splice(0, p.texts.length).join('\n\n');
  running.add(projectId);
  patchState(projectId, { autoWakeCount: state.autoWakeCount + 1 });
  try {
    await runManagerTurn(projectId, batch, 'system');
  } catch (e) {
    console.error('[manager/wake] turno falhou:', e instanceof Error ? e.message : e);
  } finally {
    running.delete(projectId);
  }
  // Anything that arrived while we were running gets its own turn.
  if ((queues.get(projectId)?.texts.length ?? 0) > 0) void drain(projectId);
}

// Wire the SessionManager events to the wake queue. Called once from server.ts.
export function startManagerWatch(): void {
  sessionManager.on('done', ({ sessionId }: { sessionId: string }) => {
    const worker = findBySession(sessionId);
    if (!worker) return;                          // not a manager-owned worker (task worker / user session)
    markIdle(sessionId);

    const session = sessionManager.get(sessionId);
    const project = loadProjects().find((p) => p.id === worker.projectId);
    if (!session || !project) return;

    const job = worker.currentJob ?? '';
    void (async () => {
      // Reuse the tasks judge: a cheap, tool-less classification of what the terminal ended with.
      // The manager gets the verdict + a short tail, never the whole buffer (cost + noise).
      const tail = (sessionManager.readBuffer(sessionId, { strip: true }) ?? '').slice(-4000);
      const verdict = await judgeWorkerOutput(`worker de ${worker.area}`, tail);
      const head = verdict.state === 'question'
        ? `O worker de "${worker.area}" está À ESPERA DE RESPOSTA.`
        : verdict.state === 'error'
          ? `O worker de "${worker.area}" terminou COM PROBLEMAS.`
          : `O worker de "${worker.area}" terminou o trabalho.`;
      enqueue(worker.projectId, [
        head,
        job ? `Trabalho que lhe tinhas dado: ${job}` : '',
        `Veredicto: ${verdict.summary}`,
        `Fim do terminal:\n"""\n${tail.slice(-1500)}\n"""`,
        verdict.state === 'question'
          ? 'Decide: se a escolha for reversível e óbvia, responde-lhe com responder_worker; se for importante ou irreversível, pergunta ao utilizador.'
          : 'Diz ao utilizador o que ficou feito (curto). Se houver passo seguinte natural, propõe-o.',
      ].filter(Boolean).join('\n'));
    })();
  });

  sessionManager.on('closed', ({ sessionId }: { sessionId: string }) => {
    forgetSession(sessionId);
  });

  console.log('[manager] watch on (workers acordam o gestor do projecto)');
}

// Used by the HTTP route: the user talking is what resets the automatic budget and gets priority.
export async function handleUserMessage(projectId: string, text: string): Promise<void> {
  resetWakeBudget(projectId);
  if (running.has(projectId)) {
    // A system turn is mid-flight. Queue the user's message so it is answered right after, instead
    // of running two turns of the same manager at once.
    enqueue(projectId, `[MENSAGEM DO UTILIZADOR]\n${text}`);
    return;
  }
  running.add(projectId);
  try {
    await runManagerTurn(projectId, text, 'user');
  } finally {
    running.delete(projectId);
  }
  if ((queues.get(projectId)?.texts.length ?? 0) > 0) void drain(projectId);
}

export function isManagerBusy(projectId: string): boolean {
  return running.has(projectId);
}

// Worker-done watcher — closes the Master's orchestration loop. Without this, the Master is
// fire-and-forget: it dispatches a worker, ends its brain turn, and NOTHING re-invokes it when the
// worker actually finishes minutes later (the SessionManager emits 'done' but nobody consumed it).
//
// Here we subscribe to that 'done' event and, for MASTER-spawned workers only (not the user's own
// terminals), kick off a follow-up Master turn: "worker X went idle — read it, then continue or
// answer the user". The brain reads the output and either sends the next step (worker works again →
// idle → another follow-up: the natural continuation loop) or replies in the chat (no new work → the
// loop ends). Output streams to all clients via broadcast + persists to master-chat.
//
// Guards against runaway: follow-ups are serialized (never two brains at once) AND deferred while any
// brain turn is live (masterRunsActive), so we never double-read a worker. A per-worker auto-count
// caps how many times a single worker can auto-continue without fresh user input.
import { randomUUID } from 'crypto';
import { sessionManager } from '../session-manager';
import { runMaster, masterRunsActive } from './orchestrator';
import { isMasterWorker, getWorkerObjective } from './master-tools';
import { appendMasterChat, loadUiSettings } from '../project-store';
import { broadcast } from '../ws/broadcast';

const MAX_AUTO_PER_WORKER = 8;   // safety cap: stop a worker auto-continuing forever (anti-loop)
const DEFER_MS = 1500;           // retry delay while another brain turn is still running

const queue: string[] = [];
const autoCount = new Map<string, number>();
let draining = false;
let hooked = false;

// Reset the per-worker auto-continuation budget when the user sends a fresh instruction — a new
// intent should get its full allowance again. Called from the WS master_message handler.
export function resetWorkerAutoCounts(): void {
  autoCount.clear();
}

function enqueue(workerId: string): void {
  if ((autoCount.get(workerId) ?? 0) >= MAX_AUTO_PER_WORKER) return; // capped → stop auto-continuing
  if (!queue.includes(workerId)) queue.push(workerId);
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  // Don't run a follow-up while any brain turn (user or auto) is live — avoids two brains driving the
  // same worker. Retry shortly; the queue keeps the pending workers.
  if (masterRunsActive() > 0) {
    setTimeout(() => { void drain(); }, DEFER_MS);
    return;
  }
  const workerId = queue.shift();
  if (!workerId) return;

  draining = true;
  try {
    const session = sessionManager.get(workerId);
    if (!session || !isMasterWorker(workerId)) return; // worker gone / no longer tracked

    autoCount.set(workerId, (autoCount.get(workerId) ?? 0) + 1);
    const objective = getWorkerObjective(workerId) ?? '';
    const prompt =
      `[EVENTO AUTOMÁTICO DO SISTEMA — não é o utilizador a falar]\n` +
      `O worker ${workerId}${objective ? ` (objectivo: "${objective}")` : ''} passou a IDLE (pode ter terminado ou estar à espera de uma escolha).\n` +
      `1) Lê o output com read_worker("${workerId}").\n` +
      `2) Decide:\n` +
      `   - awaitingChoice=true → resolve o menu conforme as regras (reversível: escolhe com select_in_worker; irreversível/ambíguo: pergunta ao utilizador e espera).\n` +
      `   - ainda faltam passos para o objectivo → continua (reutiliza este worker com send_to_worker, ou abre outro só se precisares).\n` +
      `   - objectivo concluído → responde ao utilizador no chat com um resumo curto (2-4 linhas) do que foi feito.\n` +
      `Não repitas trabalho já feito nem abras workers desnecessários. Se não há nada a fazer, diz só o resultado ao utilizador.`;

    const ui = loadUiSettings();
    await runMaster(prompt, {
      provider: ui.masterProvider ?? 'claude',
      model: ui.masterModel,
      onStep: (step) => {
        if (step.type === 'message') broadcast({ type: 'master_message', text: step.text });
        else if (step.type === 'step') broadcast({ type: 'orchestration_step', tool: step.tool, input: step.input });
        else if (step.type === 'done') {
          // Give feedback ONCE (Erros.md #14). An auto follow-up that CONTINUED the chain (dispatched
          // the next step) is intermediate → stay silent in the chat; the bottom activity indicator
          // already shows live progress. Only the FINAL turn (continued===false: the Master replied
          // with the result, no more work) is broadcast + persisted to the chat.
          if (!step.continued) {
            broadcast({ type: 'worker_summary', summary: step.summary, isError: step.isError, costUsd: step.costUsd, auto: true, continued: false });
            appendMasterChat({ id: randomUUID(), role: 'summary', text: step.summary, isError: step.isError, costUsd: step.costUsd, ts: Date.now() });
          }
        }
      },
      onProjectsChanged: () => broadcast({ type: 'projects_changed' }),
    });
  } catch (e) {
    console.error('[master-watch] follow-up error:', e);
  } finally {
    draining = false;
    if (queue.length) void drain(); // process the next finished worker, if any
  }
}

// Subscribe once to the SessionManager 'done' event. Idempotent (module-level `hooked`).
export function initMasterWorkerWatch(): void {
  if (hooked) return;
  hooked = true;
  sessionManager.on('done', ({ sessionId }: { sessionId: string }) => {
    if (!isMasterWorker(sessionId)) return; // ignore the user's own terminals
    enqueue(sessionId);
  });
  console.log('[master-watch] worker-done follow-up loop armed');
}

// Tasks engine — v1 AUTO-PULL. The always-on backend pulls tasks from the 'a-executar' column and
// executes them through the Master loop, up to CAP at a time. Mirrors automations/scheduler.ts: a
// single in-process setInterval tick, an in-memory `running` Set as the anti-double-fire guard, and
// UI refresh via the store's injectable broadcaster (notifyTasksChanged) — NOT a direct ws import.
//
// Per task: moveTask→'em-execucao' → runMaster(objective) → record result → runMaster(tester step)
// → record testerResult → moveTask→'concluida' with lastStatus ok|error. Each transition broadcasts.
import { runMaster } from '../master/orchestrator';
import { loadUiSettings, type MasterProvider } from '../project-store';
import {
  loadTasks, getTask, upsertTask, moveTask, notifyTasksChanged, setTasksRunner, type Task,
} from './store';

const TICK_MS = 5_000;
const CAP = 2;                                   // max tasks executing concurrently
const running = new Set<string>();               // guard: never fire the same task twice
let timer: ReturnType<typeof setInterval> | null = null;

// Re-read the latest task, merge a patch, persist (atomic full-file rewrite via upsertTask). Re-reading
// first means a concurrent edit (title/skills) during a long run isn't clobbered. No-op if task gone.
function patchTask(id: string, patch: Partial<Task>): void {
  const latest = getTask(id);
  if (!latest) return;
  upsertTask({ ...latest, ...patch });
}

// Build the objective handed to the Master brain: the task description (fallback to title), plus the
// same action directives the automations runner uses (skills to Read first + confirm-before-irreversible).
function buildObjective(task: Task): string {
  const base = (task.description ?? '').trim() || task.title;
  const directives: string[] = [];
  if (task.skills?.length) {
    directives.push(`Usa estas skills/agentes do JOCA (faz Read da skill ANTES de agir): ${task.skills.join(', ')}.`);
  }
  if (task.requireConfirm) {
    directives.push('ANTES de qualquer acção IRREVERSÍVEL (enviar email, apagar, deploy, push, gastar dinheiro): NÃO a executes. Prepara tudo, entrega o rascunho/plano e PEDE confirmação explícita ao Renato; só age depois do OK dele.');
  }
  if (task.attachments?.length) {
    directives.push(`Ficheiros anexados à tarefa (usa-os como contexto; lê-os se precisares): ${task.attachments.join(', ')}.`);
  }
  return directives.length ? `${base}\n\n[Instruções da tarefa]\n${directives.join('\n')}` : base;
}

// Resolve which brain drives this task: per-task override → global UI default → 'claude'/undefined.
function resolveBrain(task: Task): { provider?: MasterProvider; model?: string } {
  const ui = loadUiSettings();
  return {
    provider: task.provider ?? ui.masterProvider ?? 'claude',
    model: task.model ?? ui.masterModel,
  };
}

// Run one Master pass and return its final summary. Never throws — folds errors into { ok:false }.
async function runMasterStep(objective: string, task: Task): Promise<{ ok: boolean; summary: string }> {
  const { provider, model } = resolveBrain(task);
  try {
    const done = await runMaster(objective, {
      provider,
      model,
      // onStep is required; live step text isn't surfaced per-task yet (notifyTasksChanged drives the UI).
      onStep: () => { /* no-op: task progress is column-state, broadcast via notifyTasksChanged */ },
    });
    const summary = done.type === 'done' ? done.summary : '';
    return { ok: !(done.type === 'done' && done.isError), summary };
  } catch (e) {
    return { ok: false, summary: e instanceof Error ? e.message : String(e) };
  }
}

// Execute a single task end-to-end: implement → tester pass → conclude. Self-contained error handling;
// always releases the `running` slot. Long-running (each runMaster can take minutes) — callers must NOT
// block on it (tick uses `void fire(...)`, runTaskNow kicks it off and resolves).
async function fire(id: string): Promise<void> {
  const task = getTask(id);
  if (!task || running.has(id)) return;
  running.add(id);

  // → em-execucao (running)
  moveTask(id, 'em-execucao');
  patchTask(id, { lastStatus: 'running' });
  notifyTasksChanged();

  // 1) Implementation pass.
  const main = await runMasterStep(buildObjective(task), task);
  patchTask(id, { result: main.summary });
  notifyTasksChanged();

  // 2) Tester/review pass — only when the implementation succeeded (no point testing a failed run).
  if (main.ok) {
    const testerObjective =
      `Revê e testa o que foi feito nesta tarefa: ${task.title}. ` +
      'Usa os testers/skills apropriados (tester-code/tester-ui-ux) e reporta problemas.';
    const tester = await runMasterStep(testerObjective, task);
    patchTask(id, { testerResult: tester.summary });
    notifyTasksChanged();
  }

  // 3) Conclude.
  moveTask(id, 'concluida');
  patchTask(id, { lastStatus: main.ok ? 'ok' : 'error', sessionId: undefined });
  running.delete(id);
  notifyTasksChanged();
}

// Drain the 'a-executar' column (ordered) while there's a free slot, skipping anything already running.
function tick(): void {
  if (running.size >= CAP) return;
  const queue = loadTasks()
    .filter((t) => t.status === 'a-executar' && !running.has(t.id))
    .sort((a, b) => a.order - b.order);
  for (const t of queue) {
    if (running.size >= CAP) break;
    void fire(t.id);
  }
}

export function startTasksEngine(): void {
  if (timer) return;
  timer = setInterval(() => { try { tick(); } catch (e) { console.error('[tasks] tick error:', e); } }, TICK_MS);
  console.log(`[tasks] engine on (tick ${TICK_MS / 1000}s, cap ${CAP})`);
}

// Manual "run now" — fire one task immediately, bypassing the column/CAP throttle (but still respecting
// the anti-double-fire guard). Resolves as soon as execution is kicked off; fire runs to completion in
// the background (it can take minutes), broadcasting transitions as it goes.
export async function runTaskNow(id: string): Promise<void> {
  const task = getTask(id);
  if (!task || running.has(id)) return;
  if (task.status === 'concluida' || task.status === 'arquivada') return;
  void fire(id);
}

// Wire the store's injectable runner so the Master's "run task" tool / the HTTP route can trigger
// execution without importing this module's internals (matches automations/store setAutomationRunner).
setTasksRunner(runTaskNow);

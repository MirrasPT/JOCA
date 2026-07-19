// Tasks engine — v2 WORKER-SEQUENTIAL. The always-on backend pulls tasks from the 'a-executar'
// column and executes them in REAL Claude Code workers (PTYs, visible in the UI like any session).
//
// Invariants:
//   • ONE task worker per project (keyed by projectId; tasks without project share one generic
//     worker). Tasks of the same project NEVER run in parallel — they are injected SEQUENTIALLY
//     into that single worker, so two runs can't step on each other's files.
//   • The first task of a project spawns the worker with resumePath = the project folder: the
//     worker boots, runs `/resume "<pasta>"` to load the project context, and THEN receives the
//     task brief. Subsequent tasks reuse the same worker (submitMessage when it is idle).
//   • The worker STAYS OPEN after each task (and after the queue drains) so the user can inspect
//     or continue the work in the terminal.
//   • A silent SDK judge (direct LLM call, no tools — it cannot execute anything) reads the
//     terminal output when the worker settles and classifies the run: ok / error / question.
//     'question' = the worker is blocked waiting for the user (questionnaire, confirmation menu):
//     the engine notifies the user (task_question broadcast → toast + OS notification), leaves the
//     task 'em-execucao' and waits for the user to answer in the terminal before continuing.
//
// Column flow per task: 'a-executar' → 'em-execucao' (dispatch) → 'concluida' (ok|error). Moving to
// 'arquivada' is a manual, user-only action.
import { sessionManager, MAX_SESSIONS } from '../session-manager';
import { claudeProvider } from '../providers/provider';
import { loadProjects } from '../project-store';
import { broadcast } from '../ws/broadcast';
import {
  loadTasks, getTask, upsertTask, moveTask, notifyTasksChanged, setTasksRunner, type Task,
} from './store';

const TICK_MS = 5_000;
const TASK_TIMEOUT_MS = 60 * 60_000;        // hard cap per dispatch (1h); the judge sees whatever is there
const ANSWER_TIMEOUT_MS = 24 * 60 * 60_000; // how long we wait for the user to answer a question (24h)
const NO_PROJECT_KEY = '';                  // queue key for tasks without a project

// One task worker per project. `busy` = a task is currently dispatched into it (the sequential lock).
interface ProjectWorker { sessionId: string; busy: boolean }
const workers = new Map<string, ProjectWorker>();
let timer: ReturnType<typeof setInterval> | null = null;

// Re-read the latest task, merge a patch, persist (atomic full-file rewrite via upsertTask). Re-reading
// first means a concurrent edit (title/skills) during a long run isn't clobbered. No-op if task gone.
function patchTask(id: string, patch: Partial<Task>): void {
  const latest = getTask(id);
  if (!latest) return;
  upsertTask({ ...latest, ...patch });
}

// Build the brief handed to the worker: the task description (fallback to title) plus directives.
function buildBrief(task: Task): string {
  const base = (task.description ?? '').trim() || task.title;
  const directives: string[] = [];
  directives.push('Isto é uma TAREFA gerida pelo JOCA_OS neste worker dedicado. Executa-a de forma autónoma e, no fim, termina com um resumo claro do que foi feito e do resultado.');
  if (task.skills?.length) {
    directives.push(`Usa estas skills/agentes do JOCA (faz Read da skill ANTES de agir): ${task.skills.join(', ')}.`);
  }
  if (task.requireConfirm) {
    directives.push('ANTES de qualquer acção IRREVERSÍVEL (enviar email, apagar, deploy, push, gastar dinheiro): NÃO a executes. Prepara tudo, entrega o rascunho/plano e PEDE confirmação explícita ao utilizador; só age depois do OK dele.');
  }
  if (task.attachments?.length) {
    directives.push(`Ficheiros anexados à tarefa (usa-os como contexto; lê-os se precisares): ${task.attachments.join(', ')}.`);
  }
  return `[Tarefa] ${task.title}\n\n${base}\n\n[Instruções da tarefa]\n${directives.join('\n')}`;
}

// ── SDK judge — silent supervision layer (no chat, no tools) ────────────────
interface Verdict { state: 'ok' | 'error' | 'question'; summary: string }

// Classify the worker's terminal output once it settles. Direct LLM call with tools disabled — it
// can only READ the transcript and answer JSON; it cannot execute anything. Falls back to 'ok' with
// the raw tail if the SDK call or the JSON parse fails (never blocks the queue on judge failure).
async function judge(task: Task, tail: string): Promise<Verdict> {
  const systemPrompt = [
    'És um supervisor SILENCIOSO de tarefas num terminal Claude Code. Recebes o output final do terminal após o agente parar.',
    'Classifica o estado e responde APENAS com JSON válido, sem markdown, no formato:',
    '{"state":"ok"|"error"|"question","summary":"resumo curto em pt-pt (máx 2 frases)"}',
    'Critérios: "question" = o agente está PARADO à espera de resposta do utilizador (pergunta, menu de opções, pedido de confirmação por responder). "error" = a tarefa falhou ou ficou incompleta com erros. "ok" = a tarefa foi concluída.',
    'Em caso de dúvida entre ok e error, escolhe pelo que o resumo final do agente disser.',
  ].join(' ');
  const prompt = `Tarefa em execução: "${task.title}"\n\nOutput do terminal (final):\n"""\n${tail}\n"""`;
  try {
    let acc = '', result = '';
    for await (const ev of claudeProvider.run(prompt, { systemPrompt, model: 'haiku', noTools: true })) {
      if (ev.type === 'text' && ev.text) acc += ev.text;
      else if (ev.type === 'result') result = ev.text;
    }
    const raw = (result || acc).trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { state?: string; summary?: string };
      if (parsed.state === 'ok' || parsed.state === 'error' || parsed.state === 'question') {
        return { state: parsed.state, summary: (parsed.summary ?? '').slice(0, 500) };
      }
    }
  } catch (e) {
    console.error('[tasks] judge error (fallback ok):', e instanceof Error ? e.message : e);
  }
  return { state: 'ok', summary: tail.slice(-300).trim() };
}

// Wait for the user to answer a blocked worker: resolves when the worker completes its NEXT real
// work burst (the user's answer makes it work, then settle → status idle + isDone). 'closed' if the
// PTY exits, 'timeout' after ANSWER_TIMEOUT_MS.
function waitForUserAnswer(sessionId: string): Promise<'done' | 'closed' | 'timeout'> {
  return new Promise((resolve) => {
    if (!sessionManager.get(sessionId)) return resolve('closed');
    const cleanup = () => {
      clearTimeout(t);
      sessionManager.off('status', onStatus);
      sessionManager.off('closed', onClosed);
    };
    const onStatus = ({ sessionId: sid, status, isDone }: { sessionId: string; status: string; isDone?: boolean }) => {
      if (sid === sessionId && status === 'idle' && isDone) { cleanup(); resolve('done'); }
    };
    const onClosed = ({ sessionId: sid }: { sessionId: string }) => {
      if (sid === sessionId) { cleanup(); resolve('closed'); }
    };
    const t = setTimeout(() => { cleanup(); resolve('timeout'); }, ANSWER_TIMEOUT_MS);
    sessionManager.on('status', onStatus);
    sessionManager.on('closed', onClosed);
  });
}

// Execute ONE task in the project's worker, end-to-end. Assumes the caller holds the `busy` lock
// for this project key; always releases it. Long-running — callers must NOT block on it.
async function fire(key: string, id: string): Promise<void> {
  const task = getTask(id);
  const w = workers.get(key);
  if (!task || !w) { if (w) w.busy = false; return; }

  // → em-execucao (running)
  moveTask(id, 'em-execucao');
  patchTask(id, { lastStatus: 'running', sessionId: w.sessionId || undefined });
  notifyTasksChanged();

  let verdict: Verdict;
  try {
    let sessionId = w.sessionId;
    if (!sessionId) {
      // First task of this project → spawn ITS single task worker. resumePath makes the worker run
      // `/resume "<pasta do projecto>"` on boot (loads project context) and only then receive the
      // task brief — the "/resume + pasta + tarefa" startup.
      const proj = task.projectId ? loadProjects().find((p) => p.id === task.projectId) : undefined;
      const session = sessionManager.spawn({
        resumePath: proj?.path,
        projectId: task.projectId,
        sessionName: (proj ? `Tarefas: ${proj.name}` : 'Tarefas').slice(0, 80),
        origin: 'auto',
        initialInput: buildBrief(task),
      });
      sessionId = session.id;
      w.sessionId = sessionId;
      patchTask(id, { sessionId });
    } else {
      // Reuse the project's worker: inject the next task as a new message.
      if (!sessionManager.submitMessage(sessionId, buildBrief(task))) {
        throw new Error('o worker de tarefas deste projecto já não existe');
      }
    }

    // Await completion; re-judge after every user answer while the worker is blocked on questions.
    let outcome = await sessionManager.waitForDone(sessionId, TASK_TIMEOUT_MS);
    for (;;) {
      if (outcome === 'closed') { verdict = { state: 'error', summary: 'O worker foi fechado antes de a tarefa terminar.' }; break; }
      if (outcome === 'timeout') { verdict = { state: 'error', summary: `Sem resposta do worker dentro do limite — vê o terminal.` }; break; }
      const tail = (sessionManager.readBuffer(sessionId, { strip: true }) ?? '').slice(-6000);
      verdict = await judge(task, tail);
      if (verdict.state !== 'question') break;
      // Blocked on the user: notify, keep the task 'em-execucao', wait for the answer in the terminal.
      broadcast({ type: 'task_question', taskId: task.id, sessionId, title: task.title, summary: verdict.summary });
      patchTask(id, { result: `⏸ À espera de resposta no terminal: ${verdict.summary}` });
      notifyTasksChanged();
      outcome = await waitForUserAnswer(sessionId);
    }
  } catch (e) {
    verdict = { state: 'error', summary: e instanceof Error ? e.message : String(e) };
  }

  // Conclude. The worker stays open (never killed here) — the user can inspect/continue in the terminal.
  moveTask(id, 'concluida');
  patchTask(id, { lastStatus: verdict.state === 'ok' ? 'ok' : 'error', result: verdict.summary });
  const cur = workers.get(key);
  if (cur) {
    if (!sessionManager.get(cur.sessionId)) workers.delete(key); // user closed the worker meanwhile
    else cur.busy = false;
  }
  notifyTasksChanged();
}

// Drain the 'a-executar' column: group by project, dispatch AT MOST one task per project worker
// (sequential within a project; different projects run in parallel, each in its own worker).
function tick(): void {
  const queue = loadTasks()
    .filter((t) => t.status === 'a-executar')
    .sort((a, b) => a.order - b.order);
  if (queue.length === 0) return;

  const dispatched = new Set<string>();
  for (const t of queue) {
    const key = t.projectId ?? NO_PROJECT_KEY;
    if (dispatched.has(key)) continue;                 // one dispatch per project per tick
    let w = workers.get(key);
    if (w && !sessionManager.get(w.sessionId)) { workers.delete(key); w = undefined; } // worker was closed
    if (w?.busy) continue;                             // project worker occupied → wait
    if (!w && sessionManager.size >= MAX_SESSIONS) continue; // session cap → retry next tick
    if (!w) { w = { sessionId: '', busy: true }; workers.set(key, w); }
    else w.busy = true;
    dispatched.add(key);
    void fire(key, t.id);
  }
}

export function startTasksEngine(): void {
  if (timer) return;
  timer = setInterval(() => { try { tick(); } catch (e) { console.error('[tasks] tick error:', e); } }, TICK_MS);
  console.log(`[tasks] engine on (tick ${TICK_MS / 1000}s, 1 worker sequencial por projecto)`);
}

// Manual "run now" — queue one task immediately at the FRONT of its project's queue. The sequential
// invariant still holds (it runs as soon as the project's worker is free); anti-double-fire is the
// column state itself ('em-execucao' tasks are never re-dispatched).
export async function runTaskNow(id: string): Promise<void> {
  const task = getTask(id);
  if (!task) return;
  if (task.status === 'em-execucao' || task.status === 'arquivada') return;
  moveTask(id, 'a-executar', 0);
  notifyTasksChanged();
  tick(); // dispatch immediately if the project's worker is free
}

// Wire the store's injectable runner so the HTTP route can trigger execution without importing this
// module's internals (matches automations/store setAutomationRunner pattern).
setTasksRunner(runTaskNow);

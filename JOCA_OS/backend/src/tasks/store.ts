// Tasks/Kanban store — v2. A Task is a unit of work executed in a real Claude Code worker: an
// objective + optional project, that flows across columns (a-definir → a-executar → em-execucao →
// concluida → arquivada) as the engine works. Source of truth = DATA_DIR/tasks.json (atomic writes
// via project-store.writeJsonFile, so a kill mid-write can't corrupt it). Mirrors automations/store.ts:
// same atomic-write pattern, injectable broadcaster (WS refresh) and injectable runner (engine wires
// the real executor). One schema, many editors.
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeJsonFile } from '../project-store';

// ── Schema ──────────────────────────────────────────────────────────────────
export type TaskStatus = 'a-definir' | 'a-executar' | 'em-execucao' | 'concluida' | 'arquivada';

// Columns in board order. Reused by the engine/UI to validate moves and to compute end-of-column order.
export const TASK_STATUSES: TaskStatus[] = ['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada'];

// A note on a task — the task's chat thread. Written by the user (UI), by the worker itself
// (`joca task comment`, via the agent bridge), by the judge when a run settles, and by the system
// for structural events (merge, retry). Kept inline on the task: the volume is small and it keeps
// a task self-contained (one atomic write, no join).
export interface TaskComment {
  id: string;
  author: 'user' | 'worker' | 'judge' | 'system';
  authorName?: string;   // session name / worker label, when known
  text: string;
  ts: number;
}

export const MAX_COMMENTS_PER_TASK = 200;

export interface Task {
  id: string;
  title: string;
  description?: string;        // objectivo dado ao worker quando executa
  status: TaskStatus;
  projectId?: string;          // liga a um projecto (o worker faz /resume da pasta)
  order: number;               // ordem dentro da coluna
  skills?: string[];           // skills/agentes do JOCA_Brain a usar
  requireConfirm?: boolean;    // PÁRA antes de acções irreversíveis e pede OK
  attachments?: string[];      // caminhos de ficheiros anexados (contexto para o worker)
  cli?: string;                // CLI do worker: 'claude' (default) | 'codex' | 'agy' | 'opencode'
  model?: string;              // modelo passado ao CLI do worker (flag de modelo do perfil)
  sessionId?: string;          // worker que executa/executou a tarefa
  comments?: TaskComment[];    // thread de notas (utilizador, worker, juiz, sistema)
  result?: string;             // veredicto/resumo do juiz sobre a execução
  testerResult?: string;       // (reservado) output de um passo de verificação
  lastStatus?: 'ok' | 'error' | 'running' | null;
  createdAt: number;
  updatedAt: number;
}

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Decoupled change broadcaster: server.ts injects a fn that broadcasts `tasks_changed` over WS.
// No-op until set.
let tasksBroadcaster: (() => void) | null = null;
export function setTasksBroadcaster(fn: () => void): void { tasksBroadcaster = fn; }
export function notifyTasksChanged(): void { try { tasksBroadcaster?.(); } catch { /* ignore */ } }

// Injectable runner so a "run task" action can fire execution immediately (needs the engine's deps,
// which live in server.ts / the tasks engine). No-op until wired.
let tasksRunner: ((id: string) => Promise<void>) | null = null;
export function setTasksRunner(fn: (id: string) => Promise<void>): void { tasksRunner = fn; }
export async function triggerTaskRun(id: string): Promise<void> {
  if (!tasksRunner) return; // engine not wired yet — no-op
  await tasksRunner(id);
}

// ── Persistence ───────────────────────────────────────────────────────────────
export function loadTasks(): Task[] {
  return readJsonFile<Task[]>(TASKS_FILE, []);
}

export function saveTasks(list: Task[]): void {
  writeJsonFile(TASKS_FILE, list);
}

export function getTask(id: string): Task | undefined {
  return loadTasks().find((t) => t.id === id);
}

// Build a fresh task from a partial spec (used by POST /tasks). New tasks land at the end of their
// column (default 'a-definir').
export function makeTask(partial: {
  title: string;
  description?: string;
  status?: TaskStatus;
  projectId?: string;
  skills?: string[];
  requireConfirm?: boolean;
  attachments?: string[];
  cli?: string;
  model?: string;
}): Task {
  const status: TaskStatus = TASK_STATUSES.includes(partial.status as TaskStatus) ? (partial.status as TaskStatus) : 'a-definir';
  const list = loadTasks();
  const order = list.filter((t) => t.status === status).length;
  const now = Date.now();
  return {
    id: randomUUID(),
    title: partial.title.trim().slice(0, 200) || 'Tarefa',
    description: partial.description,
    status,
    projectId: partial.projectId,
    order,
    skills: Array.isArray(partial.skills)
      ? partial.skills.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 20)
      : undefined,
    requireConfirm: partial.requireConfirm ?? undefined,
    attachments: Array.isArray(partial.attachments)
      ? partial.attachments.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 50)
      : undefined,
    cli: typeof partial.cli === 'string' && partial.cli.trim() ? partial.cli.trim() : undefined,
    model: typeof partial.model === 'string' && partial.model.trim() ? partial.model.trim().slice(0, 120) : undefined,
    sessionId: undefined,
    result: undefined,
    testerResult: undefined,
    lastStatus: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Upsert a single task by id (atomic full-file rewrite). Bumps updatedAt.
export function upsertTask(t: Task): void {
  const list = loadTasks();
  const i = list.findIndex((x) => x.id === t.id);
  const next: Task = { ...t, updatedAt: Date.now() };
  if (i >= 0) list[i] = next; else list.push(next);
  saveTasks(list);
}

export function deleteTask(id: string): boolean {
  const list = loadTasks();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  saveTasks(next);
  return true;
}

// Move a task to a column at a given position (default = end of the destination column). Re-packs the
// order of both the source and destination columns so positions stay contiguous (0..n-1).
export function moveTask(id: string, status: TaskStatus, order?: number): Task | null {
  if (!TASK_STATUSES.includes(status)) return null;
  const list = loadTasks();
  const task = list.find((t) => t.id === id);
  if (!task) return null;

  // Capture the source column BEFORE mutating status — re-packing it afterwards used to read the
  // already-updated status and therefore never re-packed anything, leaving holes (and, with
  // makeTask deriving order from a column count, duplicate orders).
  const fromStatus = task.status;

  // Remaining tasks in the destination column, ordered, excluding the moved one.
  const dest = list
    .filter((t) => t.status === status && t.id !== id)
    .sort((a, b) => a.order - b.order);

  const pos = order === undefined ? dest.length : Math.max(0, Math.min(order, dest.length));
  dest.splice(pos, 0, task);

  const now = Date.now();
  task.status = status;
  dest.forEach((t, idx) => { t.order = idx; t.updatedAt = now; });

  if (fromStatus !== status) {
    list
      .filter((t) => t.status === fromStatus)
      .sort((a, b) => a.order - b.order)
      .forEach((t, idx) => { t.order = idx; });
  }

  saveTasks(list);
  return task;
}

// ── Comments (task thread) ────────────────────────────────────────────────────
export function addTaskComment(
  taskId: string,
  spec: { text: string; author?: TaskComment['author']; authorName?: string },
): TaskComment | null {
  const list = loadTasks();
  const task = list.find((t) => t.id === taskId);
  if (!task) return null;
  const text = (spec.text ?? '').trim();
  if (!text) return null;
  const comment: TaskComment = {
    id: randomUUID(),
    author: spec.author ?? 'user',
    authorName: spec.authorName?.slice(0, 80),
    text: text.slice(0, 8000),
    ts: Date.now(),
  };
  task.comments = [...(task.comments ?? []), comment].slice(-MAX_COMMENTS_PER_TASK);
  task.updatedAt = Date.now();
  saveTasks(list);
  return comment;
}

export function deleteTaskComment(taskId: string, commentId: string): boolean {
  const list = loadTasks();
  const task = list.find((t) => t.id === taskId);
  if (!task?.comments) return false;
  const next = task.comments.filter((c) => c.id !== commentId);
  if (next.length === task.comments.length) return false;
  task.comments = next;
  task.updatedAt = Date.now();
  saveTasks(list);
  return true;
}

// ── Merge ─────────────────────────────────────────────────────────────────────
// Fold N tasks into one. The first id (or `keepId`) is the survivor: it keeps its column and
// position, and absorbs the others' descriptions, skills, attachments and comment threads. The
// absorbed tasks are deleted, and the survivor gets a system comment recording what was merged —
// so the history of a merge is never lost.
export function mergeTasks(ids: string[], opts: { keepId?: string; title?: string } = {}): Task | null {
  const list = loadTasks();
  const picked = ids.map((id) => list.find((t) => t.id === id)).filter((t): t is Task => Boolean(t));
  if (picked.length < 2) return null;
  // No task in the merge may be running: a worker is holding the survivor's brief, and an absorbed
  // task would be deleted from under its own worker.
  if (picked.some((t) => t.status === 'em-execucao')) return null;
  const survivor = picked.find((t) => t.id === opts.keepId) ?? picked[0];
  const absorbed = picked.filter((t) => t.id !== survivor.id);

  const sections = [survivor, ...absorbed]
    .map((t) => {
      const body = (t.description ?? '').trim();
      return body ? `### ${t.title}\n${body}` : `### ${t.title}`;
    })
    .join('\n\n');

  const uniq = (values: (string[] | undefined)[]) =>
    [...new Set(values.flatMap((v) => v ?? []))];

  const merged: Task = {
    ...survivor,
    title: (opts.title ?? survivor.title).trim().slice(0, 200) || survivor.title,
    description: sections,
    skills: uniq([survivor.skills, ...absorbed.map((t) => t.skills)]).slice(0, 20),
    attachments: uniq([survivor.attachments, ...absorbed.map((t) => t.attachments)]).slice(0, 50),
    requireConfirm: [survivor, ...absorbed].some((t) => t.requireConfirm) || undefined,
    comments: [...(survivor.comments ?? []), ...absorbed.flatMap((t) => t.comments ?? [])]
      .sort((a, b) => a.ts - b.ts)
      .slice(-MAX_COMMENTS_PER_TASK),
    updatedAt: Date.now(),
  };
  if (!merged.skills?.length) merged.skills = undefined;
  if (!merged.attachments?.length) merged.attachments = undefined;

  const absorbedIds = new Set(absorbed.map((t) => t.id));
  const next = list.filter((t) => !absorbedIds.has(t.id)).map((t) => (t.id === merged.id ? merged : t));
  saveTasks(next);
  addTaskComment(merged.id, {
    author: 'system',
    text: `Fundida com: ${absorbed.map((t) => `"${t.title}"`).join(', ')}.`,
  });
  return getTask(merged.id) ?? merged;
}

// ── Column advance ────────────────────────────────────────────────────────────
// Move a task one column to the right ('arquivada' is the end of the line). Returns null when the
// task is missing or already at the end.
export function advanceTask(id: string): Task | null {
  const task = getTask(id);
  if (!task) return null;
  const i = TASK_STATUSES.indexOf(task.status);
  if (i < 0 || i >= TASK_STATUSES.length - 1) return null;
  return moveTask(id, TASK_STATUSES[i + 1]);
}

// Move EVERY task of a column one step to the right, preserving their relative order. Skips
// 'em-execucao' (a running worker owns those). Returns how many moved.
export function advanceColumn(status: TaskStatus): number {
  const i = TASK_STATUSES.indexOf(status);
  if (i < 0 || i >= TASK_STATUSES.length - 1 || status === 'em-execucao') return 0;
  const ordered = loadTasks().filter((t) => t.status === status).sort((a, b) => a.order - b.order);
  for (const t of ordered) moveTask(t.id, TASK_STATUSES[i + 1]);
  return ordered.length;
}

// Apply an explicit ordering within a single column (frontend drag-reorder). ids = the desired order;
// any task of that status not listed keeps trailing positions.
export function reorderTasks(status: TaskStatus, ids: string[]): void {
  if (!TASK_STATUSES.includes(status)) return;
  const list = loadTasks();
  const now = Date.now();
  const inColumn = list.filter((t) => t.status === status);
  const rank = new Map<string, number>();
  ids.forEach((id, idx) => rank.set(id, idx));
  inColumn
    .sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : ids.length + a.order;
      const rb = rank.has(b.id) ? rank.get(b.id)! : ids.length + b.order;
      return ra - rb;
    })
    .forEach((t, idx) => { t.order = idx; t.updatedAt = now; });
  saveTasks(list);
}

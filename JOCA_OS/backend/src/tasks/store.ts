// Tasks/Kanban store — v1. A Task is a unit of work the Master can execute: an objective + optional
// project (cwd), provider/model/skills, that flows across columns (a-definir → a-executar →
// em-execucao → concluida → arquivada). Source of truth = DATA_DIR/tasks.json (atomic writes via
// project-store.writeJsonFile, so a kill mid-write can't corrupt it). Mirrors automations/store.ts:
// same atomic-write pattern, injectable broadcaster (WS refresh) and injectable runner (engine wires
// the real executor). One schema, many editors.
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeJsonFile, type MasterProvider } from '../project-store';

// ── Schema ──────────────────────────────────────────────────────────────────
export type TaskStatus = 'a-definir' | 'a-executar' | 'em-execucao' | 'concluida' | 'arquivada';

// Columns in board order. Reused by the engine/UI to validate moves and to compute end-of-column order.
export const TASK_STATUSES: TaskStatus[] = ['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada'];

export interface Task {
  id: string;
  title: string;
  description?: string;        // objectivo dado ao Master quando executa
  status: TaskStatus;
  projectId?: string;          // liga a um projecto (define cwd do worker)
  order: number;               // ordem dentro da coluna
  provider?: MasterProvider;   // override do provider global (Claude/Codex/Ollama)
  model?: string;              // e.g. 'sonnet'|'opus'|'haiku' (Claude); undefined = default do provider
  skills?: string[];           // skills/agentes do JOCA_Brain a usar
  requireConfirm?: boolean;    // PÁRA antes de acções irreversíveis e pede OK
  sessionId?: string;          // worker spawned (em-execucao)
  result?: string;             // resumo final do worker
  testerResult?: string;       // output do passo de tester
  lastStatus?: 'ok' | 'error' | 'running' | null;
  createdAt: number;
  updatedAt: number;
}

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Decoupled change broadcaster: server.ts injects a fn that broadcasts `tasks_changed` over WS.
// Lets the Master's task tools / the runner refresh the UI without threading a callback through the
// orchestrator/provider chain. No-op until set.
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

// Build a fresh task from a partial spec (used by POST /tasks + the future Master tool). New tasks land
// at the end of their column (default 'a-definir').
export function makeTask(partial: {
  title: string;
  description?: string;
  status?: TaskStatus;
  projectId?: string;
  provider?: MasterProvider;
  model?: string;
  skills?: string[];
  requireConfirm?: boolean;
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
    provider: partial.provider,
    model: partial.model,
    skills: Array.isArray(partial.skills)
      ? partial.skills.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 20)
      : undefined,
    requireConfirm: partial.requireConfirm ?? undefined,
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

  // Remaining tasks in the destination column, ordered, excluding the moved one.
  const dest = list
    .filter((t) => t.status === status && t.id !== id)
    .sort((a, b) => a.order - b.order);

  const pos = order === undefined ? dest.length : Math.max(0, Math.min(order, dest.length));
  dest.splice(pos, 0, task);

  const now = Date.now();
  task.status = status;
  dest.forEach((t, idx) => { t.order = idx; t.updatedAt = now; });

  // Re-pack the source column (the one the task left), if different.
  const srcOrdered = list.filter((t) => t.status === task.status && !dest.includes(t)).sort((a, b) => a.order - b.order);
  // Note: srcOrdered above only matters when status changed; harmless when it didn't.
  srcOrdered.forEach((t, idx) => { t.order = idx; });

  saveTasks(list);
  return task;
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

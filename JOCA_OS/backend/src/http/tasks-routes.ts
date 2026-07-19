import express, { Router } from 'express';
import {
  loadTasks, getTask, makeTask, upsertTask, deleteTask, moveTask, reorderTasks,
  setTasksBroadcaster, TASK_STATUSES, type Task, type TaskStatus,
} from '../tasks/store';
import { runTaskNow } from '../tasks/engine';
import { broadcast } from '../ws/broadcast';

// ── Tasks / Kanban (v1) ────────────────────────────────────────────────────────
// CRUD + board moves over the tasks store. The worker-sequential engine (started in server.ts via
// startTasksEngine()) drains the 'a-executar' column; these routes let the UI define/edit/reorder tasks
// and force an immediate run. Importing ../tasks/engine here also registers its store runner
// (setTasksRunner) as a side-effect.
// Every mutation broadcasts `tasks_changed` so connected clients refresh.

// Refresh the UI live, decoupled from this router.
setTasksBroadcaster(() => broadcast({ type: 'tasks_changed' }));

const sanitizeSkills = (v: unknown) =>
  Array.isArray(v) ? (v.filter((s) => typeof s === 'string' && s.trim()) as string[]).map((s) => s.trim()).slice(0, 20) : undefined;
const sanitizeAttachments = (v: unknown) =>
  Array.isArray(v) ? (v.filter((s) => typeof s === 'string' && s.trim()) as string[]).map((s) => s.trim()).slice(0, 50) : undefined;
const isStatus = (v: unknown): v is TaskStatus => TASK_STATUSES.includes(v as TaskStatus);

export function tasksRouter(): Router {
  const r = Router();

  r.get('/tasks', (_req, res) => res.json(loadTasks()));

  r.post('/tasks', express.json({ limit: '1mb' }), (req, res) => {
    const b = (req.body ?? {}) as Partial<Task>;
    if (typeof b.title !== 'string' || !b.title.trim()) {
      return res.status(400).json({ error: 'title obrigatorio' });
    }
    const t = makeTask({
      title: b.title,
      description: typeof b.description === 'string' ? b.description : undefined,
      status: isStatus(b.status) ? b.status : undefined,
      projectId: typeof b.projectId === 'string' ? b.projectId : undefined,
      skills: sanitizeSkills(b.skills),
      requireConfirm: b.requireConfirm === true || undefined,
      attachments: sanitizeAttachments(b.attachments),
    });
    upsertTask(t);
    broadcast({ type: 'tasks_changed' });
    res.json(t);
  });

  r.patch('/tasks/:id', express.json({ limit: '1mb' }), (req, res) => {
    const cur = getTask(req.params.id);
    if (!cur) return res.status(404).json({ error: 'not found' });
    const b = (req.body ?? {}) as Partial<Task>;
    const updated: Task = { ...cur };
    if (typeof b.title === 'string') updated.title = b.title.trim().slice(0, 200) || cur.title;
    if ('description' in b) updated.description = typeof b.description === 'string' ? b.description : undefined;
    if ('projectId' in b) updated.projectId = typeof b.projectId === 'string' ? b.projectId : undefined;
    if ('skills' in b) updated.skills = sanitizeSkills(b.skills);
    if ('requireConfirm' in b) updated.requireConfirm = b.requireConfirm === true || undefined;
    if ('attachments' in b) updated.attachments = sanitizeAttachments(b.attachments);
    upsertTask(updated);
    broadcast({ type: 'tasks_changed' });
    res.json(updated);
  });

  r.delete('/tasks/:id', (req, res) => {
    const ok = deleteTask(req.params.id);
    if (ok) broadcast({ type: 'tasks_changed' });
    res.json({ ok });
  });

  // Move a task to a column (optionally at a given position). status required + valid.
  r.post('/tasks/:id/move', express.json(), (req, res) => {
    const b = (req.body ?? {}) as { status?: unknown; order?: unknown };
    if (!isStatus(b.status)) return res.status(400).json({ error: 'status invalido' });
    const order = typeof b.order === 'number' ? b.order : undefined;
    const task = moveTask(req.params.id, b.status, order);
    if (!task) return res.status(404).json({ error: 'not found' });
    broadcast({ type: 'tasks_changed' });
    res.json(task);
  });

  // Apply an explicit ordering within a single column (drag-reorder).
  r.put('/tasks/reorder', express.json(), (req, res) => {
    const b = (req.body ?? {}) as { status?: unknown; ids?: unknown };
    if (!isStatus(b.status)) return res.status(400).json({ error: 'status invalido' });
    if (!Array.isArray(b.ids) || b.ids.some((x) => typeof x !== 'string')) {
      return res.status(400).json({ error: 'ids[] (strings) obrigatorio' });
    }
    reorderTasks(b.status, b.ids as string[]);
    broadcast({ type: 'tasks_changed' });
    res.json({ ok: true });
  });

  // Force an immediate run of one task (bypasses the column/CAP throttle). Fire-and-forget: the engine
  // broadcasts transitions as it executes; we ack right away.
  r.post('/tasks/:id/run', (req, res) => {
    if (!getTask(req.params.id)) return res.status(404).json({ error: 'not found' });
    runTaskNow(req.params.id).catch((e) => console.error('[tasks] run error:', e));
    res.json({ ok: true, started: true });
  });

  return r;
}

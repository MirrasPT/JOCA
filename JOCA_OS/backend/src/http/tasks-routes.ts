import express, { Router } from 'express';
import {
  loadTasks, getTask, makeTask, upsertTask, deleteTask, moveTask, reorderTasks,
  addTaskComment, deleteTaskComment, mergeTasks, advanceTask, advanceColumn,
  setTasksBroadcaster, TASK_STATUSES, type Task, type TaskStatus, type TaskComment,
} from '../tasks/store';
import { runTaskNow, dispararFila } from '../tasks/engine';
import { sessionManager } from '../session-manager';
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

// Uma mudança no quadro: refresca quem está a ver E, se a tarefa ficou em "a-executar", põe a fila
// desse projecto a andar. É o ÚNICO disparo automático do JOCA — nada nasce por abrires a app ou um
// projecto, nasce por pores trabalho na fila.
//
// Só aqui, na camada HTTP: o motor escreve directamente no store quando move uma tarefa que ele
// próprio despachou, portanto não se auto-dispara em ciclo.
function mudou(_descricao: string, task?: Task | null): void {
  broadcast({ type: 'tasks_changed' });
  if (task?.status === 'a-executar') dispararFila(task.projectId);
}

const resumo = (t: Task) => `"${t.title.slice(0, 120)}"`;

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
      cli: typeof b.cli === 'string' ? b.cli : undefined,
      model: typeof b.model === 'string' ? b.model : undefined,
    });
    upsertTask(t);
    mudou(`Tarefa NOVA na coluna "${t.status}": ${resumo(t)}.`, t);
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
    if ('cli' in b) updated.cli = typeof b.cli === 'string' && b.cli.trim() ? b.cli.trim() : undefined;
    if ('model' in b) updated.model = typeof b.model === 'string' && b.model.trim() ? b.model.trim().slice(0, 120) : undefined;
    upsertTask(updated);
    mudou(`Tarefa EDITADA: ${resumo(updated)}.`, updated);
    res.json(updated);
  });

  r.delete('/tasks/:id', (req, res) => {
    // Lida ANTES de apagar: depois já não há de onde tirar o projecto a avisar.
    const antes = getTask(req.params.id);
    const ok = deleteTask(req.params.id);
    if (ok) mudou(`Tarefa APAGADA: ${antes ? resumo(antes) : req.params.id}.`, antes);
    res.json({ ok });
  });

  // Move a task to a column (optionally at a given position). status required + valid.
  r.post('/tasks/:id/move', express.json(), (req, res) => {
    const b = (req.body ?? {}) as { status?: unknown; order?: unknown };
    if (!isStatus(b.status)) return res.status(400).json({ error: 'status invalido' });
    // Arquivar uma tarefa A CORRER não a parava: o terminal seguia, e o agente fechava-a com
    // `joca done` — tirando-a do arquivo sozinha, minutos depois. Recusa-se, com o motivo.
    const actual = getTask(req.params.id);
    if (actual?.status === 'em-execucao' && b.status === 'arquivada') {
      return res.status(409).json({
        error: 'a tarefa está a correr — pára o terminal dela antes de arquivar',
      });
    }
    const order = typeof b.order === 'number' ? b.order : undefined;
    const task = moveTask(req.params.id, b.status, order);
    if (!task) return res.status(404).json({ error: 'not found' });
    mudou(`Tarefa MOVIDA para "${b.status}": ${resumo(task)}.`, task);
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

  // Correr já uma tarefa. O motor emite as transições por WS enquanto executa; aqui devolve-se só
  // se ARRANCOU — e, se não, porquê. Antes respondia `started:true` mesmo quando o dispatch era
  // recusado (worker ocupado, tarefa arquivada), e a UI não tinha como saber.
  r.post('/tasks/:id/run', async (req, res) => {
    if (!getTask(req.params.id)) return res.status(404).json({ error: 'not found' });
    try {
      const r0 = await runTaskNow(req.params.id);
      res.status(r0.ok ? 200 : 409).json({ ok: r0.ok, started: r0.ok, reason: r0.reason });
    } catch (e) {
      console.error('[tasks] run error:', e);
      res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Re-run a task that finished with an error: clears the previous verdict and re-queues it.
  r.post('/tasks/:id/retry', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    if (task.status === 'em-execucao') return res.status(409).json({ error: 'já está em execução' });
    addTaskComment(task.id, { author: 'system', text: `Re-execução pedida (estado anterior: ${task.lastStatus ?? 'sem estado'}).` });
    upsertTask({ ...getTask(task.id)!, lastStatus: null, result: undefined });
    moveTask(task.id, 'a-executar', 0);
    runTaskNow(task.id).catch((e) => console.error('[tasks] retry error:', e));
    broadcast({ type: 'tasks_changed' });
    res.json({ ok: true, started: true });
  });

  // ── Comments (task thread) ─────────────────────────────────────────────────
  // author defaults to 'user' (the UI). Agents inside a terminal post as 'worker' through the
  // joca CLI, passing their session id so the thread shows WHICH terminal spoke.
  r.post('/tasks/:id/comments', express.json({ limit: '1mb' }), (req, res) => {
    const b = (req.body ?? {}) as { text?: unknown; author?: unknown; sessionId?: unknown };
    if (typeof b.text !== 'string' || !b.text.trim()) return res.status(400).json({ error: 'text obrigatorio' });
    const author: TaskComment['author'] =
      b.author === 'worker' || b.author === 'judge' || b.author === 'system' ? b.author : 'user';
    const authorName = typeof b.sessionId === 'string'
      ? sessionManager.get(b.sessionId)?.name
      : undefined;
    const comment = addTaskComment(req.params.id, { text: b.text, author, authorName });
    if (!comment) return res.status(404).json({ error: 'not found' });
    mudou(
      `Comentário NOVO (${authorName ?? author}) em ${resumo(getTask(req.params.id)!)}: ${b.text.slice(0, 300)}`,
      getTask(req.params.id),
    );
    res.json(comment);
  });

  r.delete('/tasks/:id/comments/:commentId', (req, res) => {
    const ok = deleteTaskComment(req.params.id, req.params.commentId);
    if (ok) broadcast({ type: 'tasks_changed' });
    res.json({ ok });
  });

  // ── Merge ──────────────────────────────────────────────────────────────────
  r.post('/tasks/merge', express.json(), (req, res) => {
    const b = (req.body ?? {}) as { ids?: unknown; keepId?: unknown; title?: unknown };
    if (!Array.isArray(b.ids) || b.ids.length < 2 || b.ids.some((x) => typeof x !== 'string')) {
      return res.status(400).json({ error: 'ids[] com pelo menos 2 tarefas' });
    }
    const merged = mergeTasks(b.ids as string[], {
      keepId: typeof b.keepId === 'string' ? b.keepId : undefined,
      title: typeof b.title === 'string' ? b.title : undefined,
    });
    if (!merged) return res.status(409).json({ error: 'não foi possível fundir (tarefas inexistentes ou uma delas está em execução)' });
    mudou(`${b.ids.length} tarefas FUNDIDAS numa só: ${resumo(merged)}.`, merged);
    res.json(merged);
  });

  // ── Advance (next column) ──────────────────────────────────────────────────
  r.post('/tasks/:id/advance', (req, res) => {
    const task = advanceTask(req.params.id);
    if (!task) return res.status(409).json({ error: 'tarefa inexistente ou já na última coluna' });
    mudou(`Tarefa AVANÇADA para "${task.status}": ${resumo(task)}.`, task);
    res.json(task);
  });

  // Move an entire column one step to the right (skips 'em-execucao').
  r.post('/tasks/advance-column', express.json(), (req, res) => {
    const b = (req.body ?? {}) as { status?: unknown };
    if (!isStatus(b.status)) return res.status(400).json({ error: 'status invalido' });
    const moved = advanceColumn(b.status);
    if (moved > 0) {
      broadcast({ type: 'tasks_changed' });
      // A coluna inteira avançou — algumas podem ter caído em 'a-executar'. Uma chamada por
      // projecto afectado; o `dispararFila` é idempotente e respeita o lock.
      for (const pid of new Set(loadTasks().filter((t) => t.status === 'a-executar').map((t) => t.projectId))) {
        dispararFila(pid);
      }
    }
    res.json({ ok: true, moved });
  });

  return r;
}

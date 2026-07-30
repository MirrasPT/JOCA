// Project manager chat routes.
//
// POST answers 202 immediately: the manager's reply arrives over the WebSocket as `manager_message`,
// possibly followed by more messages minutes later as workers finish. Holding the HTTP request open
// would recreate exactly the blocking behaviour this feature exists to remove.
import express, { Router } from 'express';
import { loadProjects } from '../project-store';
import { loadChat, clearChat, getState, appendMessage } from '../manager/store';
import { handleUserMessage, isManagerBusy } from '../manager/wake';
import { listWorkers } from '../manager/worker-pool';
import { sessionManager } from '../session-manager';

export function managerRouter(): Router {
  const r = Router();

  const projectExists = (id: string) => loadProjects().some((p) => p.id === id);

  r.get('/projects/:id/chat', (req, res) => {
    if (!projectExists(req.params.id)) return res.status(404).json({ error: 'projecto não encontrado' });
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 200, 1000));
    const state = getState(req.params.id);
    res.json({
      messages: loadChat(req.params.id, limit),
      busy: isManagerBusy(req.params.id) || Boolean(state.busy),
      totalCostUsd: state.totalCostUsd ?? 0,
      workers: listWorkers(req.params.id).map((w) => ({
        ...w,
        status: sessionManager.get(w.sessionId)?.status ?? 'closed',
      })),
    });
  });

  r.post('/projects/:id/chat', express.json({ limit: '1mb' }), (req, res) => {
    const id = req.params.id;
    if (!projectExists(id)) return res.status(404).json({ error: 'projecto não encontrado' });
    const text = typeof (req.body ?? {}).text === 'string' ? (req.body as { text: string }).text.trim() : '';
    if (!text) return res.status(400).json({ error: 'text obrigatorio' });

    // Persist + broadcast the user's own message first, so it appears in the chat instantly.
    const message = appendMessage(id, { role: 'user', text });
    handleUserMessage(id, text).catch((e) => console.error('[manager] erro no turno:', e));
    res.status(202).json({ ok: true, message });
  });

  r.delete('/projects/:id/chat', (req, res) => {
    if (!projectExists(req.params.id)) return res.status(404).json({ error: 'projecto não encontrado' });
    clearChat(req.params.id);
    res.json({ ok: true });
  });

  return r;
}

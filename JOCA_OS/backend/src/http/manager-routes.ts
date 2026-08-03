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
import { GLOBAL_MANAGER_ID } from '../manager/manager';

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
    const body = req.body as { text?: unknown; attachments?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : [];
    if (!text && attachments.length === 0) return res.status(400).json({ error: 'text obrigatorio' });

    // Persist + broadcast the user's own message first, so it appears in the chat instantly. The
    // SDK turn gets a note listing the attached paths appended — plain text today, no native
    // multimodal injection at this layer (o gestor decide se quer chamar ver_imagem sobre eles).
    const message = appendMessage(id, { role: 'user', text, attachments: attachments.length ? attachments : undefined });
    const prompt = attachments.length
      ? `${text || '(sem texto, só anexos)'}\n\n[Anexos: ${attachments.join(', ')}]`
      : text;
    handleUserMessage(id, prompt).catch((e) => console.error('[manager] erro no turno:', e));
    res.status(202).json({ ok: true, message });
  });

  r.delete('/projects/:id/chat', (req, res) => {
    if (!projectExists(req.params.id)) return res.status(404).json({ error: 'projecto não encontrado' });
    clearChat(req.params.id);
    res.json({ ok: true });
  });

  // ── Joca global — mesmo formato de resposta, sem `:id` (chave = GLOBAL_MANAGER_ID). Sem
  // "workers": o painel de workers do canal Chat por-projecto não faz sentido aqui (são de
  // projectos diferentes) — a lista fica ao alcance do próprio chat via a ferramenta `ver_workers`.
  r.get('/manager/global/chat', (_req, res) => {
    const limit = Math.max(1, Math.min(Number(_req.query.limit) || 200, 1000));
    const state = getState(GLOBAL_MANAGER_ID);
    res.json({
      messages: loadChat(GLOBAL_MANAGER_ID, limit),
      busy: isManagerBusy(GLOBAL_MANAGER_ID) || Boolean(state.busy),
      totalCostUsd: state.totalCostUsd ?? 0,
      workers: [],
    });
  });

  r.post('/manager/global/chat', express.json({ limit: '1mb' }), (req, res) => {
    const body = req.body as { text?: unknown; attachments?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : [];
    if (!text && attachments.length === 0) return res.status(400).json({ error: 'text obrigatorio' });
    const message = appendMessage(GLOBAL_MANAGER_ID, { role: 'user', text, attachments: attachments.length ? attachments : undefined });
    const prompt = attachments.length
      ? `${text || '(sem texto, só anexos)'}\n\n[Anexos: ${attachments.join(', ')}]`
      : text;
    handleUserMessage(GLOBAL_MANAGER_ID, prompt).catch((e) => console.error('[manager] erro no turno global:', e));
    res.status(202).json({ ok: true, message });
  });

  r.delete('/manager/global/chat', (_req, res) => {
    clearChat(GLOBAL_MANAGER_ID);
    res.json({ ok: true });
  });

  return r;
}

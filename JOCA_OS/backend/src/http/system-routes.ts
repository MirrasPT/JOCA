// System routes — the new persistent-inbox / run-history / heartbeat / multi-CLI surface.
//   /notifications  → persistent inbox (survives closed tabs; unread state)
//   /runs           → append-only execution history with SDK cost (runs.jsonl)
//   /heartbeat      → proactivity loop config + manual beat
//   /cli-profiles   → the CLIs a session/task/automation can run on, with availability
import express, { Router } from 'express';
import {
  loadNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, unreadCount,
} from '../notifications/store';
import { listRuns, runStats, type RunKind } from '../runs/store';
import {
  loadHeartbeatConfig, saveHeartbeatConfig, runHeartbeat, DEFAULT_HEARTBEAT, type HeartbeatConfig,
} from '../heartbeat';
import { loadCliProfiles, CLI_IDS, type CliId } from '../cli-profiles';
import { binExists } from '../providers/provider';

export function systemRouter(): Router {
  const r = Router();

  // ── Notifications inbox ────────────────────────────────────────────────────
  r.get('/notifications', (req, res) => {
    const onlyUnread = req.query.unread === '1';
    const list = loadNotifications();
    res.json({
      unread: unreadCount(),
      notifications: (onlyUnread ? list.filter((n) => !n.read) : list).slice(-200).reverse(),
    });
  });

  r.patch('/notifications/:id', express.json(), (req, res) => {
    const read = (req.body ?? {}).read !== false;
    const n = markNotificationRead(req.params.id, read);
    if (!n) return res.status(404).json({ error: 'not found' });
    res.json(n);
  });

  r.post('/notifications/read-all', (_req, res) => {
    res.json({ marked: markAllNotificationsRead() });
  });

  r.delete('/notifications/:id', (req, res) => {
    res.json({ ok: deleteNotification(req.params.id) });
  });

  // ── Run history + cost ─────────────────────────────────────────────────────
  r.get('/runs', (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const kind = ['automation', 'task', 'heartbeat'].includes(String(req.query.kind))
      ? (String(req.query.kind) as RunKind) : undefined;
    const refId = typeof req.query.refId === 'string' ? req.query.refId : undefined;
    res.json(listRuns({ limit, kind, refId }));
  });

  r.get('/runs/stats', (req, res) => {
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
    res.json(runStats(days));
  });

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  r.get('/heartbeat', (_req, res) => res.json(loadHeartbeatConfig()));

  r.patch('/heartbeat', express.json({ limit: '256kb' }), (req, res) => {
    const cur = loadHeartbeatConfig();
    const b = (req.body ?? {}) as Partial<HeartbeatConfig>;
    const next: HeartbeatConfig = { ...cur };
    if (typeof b.enabled === 'boolean') next.enabled = b.enabled;
    if (typeof b.everyMinutes === 'number') next.everyMinutes = Math.max(5, Math.min(24 * 60, Math.floor(b.everyMinutes)));
    if ('activeHours' in b) {
      const ah = b.activeHours;
      next.activeHours = ah && typeof ah.start === 'string' && typeof ah.end === 'string'
        ? { start: ah.start.slice(0, 5), end: ah.end.slice(0, 5) }
        : null;
    }
    if (typeof b.model === 'string') next.model = b.model.trim().slice(0, 80) || DEFAULT_HEARTBEAT.model;
    if (typeof b.scratch === 'string') next.scratch = b.scratch;
    saveHeartbeatConfig(next);
    res.json(loadHeartbeatConfig());
  });

  // Manual beat ("testar agora") — forces the LLM call even with an empty scratch/quiet state.
  r.post('/heartbeat/run', (_req, res) => {
    runHeartbeat({ force: true })
      .then((out) => res.json(out))
      .catch((e) => res.status(500).json({ error: e instanceof Error ? e.message : String(e) }));
  });

  // ── Multi-CLI profiles ─────────────────────────────────────────────────────
  r.get('/cli-profiles', async (_req, res) => {
    const profiles = loadCliProfiles();
    const availability = await Promise.all(CLI_IDS.map((id) => binExists(profiles[id].bin)));
    res.json(CLI_IDS.map((id: CliId, i) => ({
      id, label: profiles[id].label, bin: profiles[id].bin, available: availability[i],
      startupSequence: profiles[id].startupSequence,
    })));
  });

  return r;
}

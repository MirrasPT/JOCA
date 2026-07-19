import express, { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  loadAutomations, getAutomation, upsertAutomation, deleteAutomation, makeAutomation,
  computeNextRun, setAutomationsBroadcaster, type Automation, type AutomationNode,
} from '../automations/store';
import { runAutomationNow, type SchedulerDeps } from '../automations/scheduler';
import { broadcast } from '../ws/broadcast';

// ── Automations (v1) ─────────────────────────────────────────────────────────
// One scheduler runs in the always-on backend (started in server.ts via startScheduler(automationDeps)).
// The `message` node delivers as a UI notification (WS broadcast → toast + OS notification).
export const automationDeps: SchedulerDeps = {
  deliver: (text, automationName) => {
    broadcast({ type: 'automation_message', id: randomUUID(), text: `🤖 ${automationName}\n\n${text}`, ts: Date.now() });
  },
  onChanged: () => broadcast({ type: 'automations_changed' }),
};

// Store-level change broadcaster so any writer refreshes the UI live.
setAutomationsBroadcaster(() => broadcast({ type: 'automations_changed' }));

export function automationsRouter(): Router {
  const r = Router();

  r.get('/automations', (_req, res) => res.json(loadAutomations()));

  r.post('/automations', express.json({ limit: '1mb' }), (req, res) => {
    const b = (req.body ?? {}) as Partial<Automation>;
    if (!b.name || !Array.isArray(b.nodes) || b.nodes.length === 0) {
      return res.status(400).json({ error: 'name e nodes[] (>=1) obrigatorios' });
    }
    const model = typeof b.model === 'string' && b.model.trim() ? b.model.trim().slice(0, 80) : undefined;
    const skills = Array.isArray(b.skills) ? (b.skills as unknown[]).filter((s) => typeof s === 'string') as string[] : undefined;
    const requireConfirm = b.requireConfirm === true || undefined;
    const a = makeAutomation({ name: b.name, nodes: b.nodes as AutomationNode[], trigger: b.trigger, enabled: b.enabled, model, skills, requireConfirm });
    upsertAutomation(a);
    broadcast({ type: 'automations_changed' });
    res.json(a);
  });

  r.patch('/automations/:id', express.json({ limit: '1mb' }), (req, res) => {
    const cur = getAutomation(req.params.id);
    if (!cur) return res.status(404).json({ error: 'not found' });
    const b = (req.body ?? {}) as Partial<Automation>;
    const updated: Automation = { ...cur };
    if (typeof b.name === 'string') updated.name = b.name.trim().slice(0, 120) || cur.name;
    if (typeof b.enabled === 'boolean') updated.enabled = b.enabled;
    if ('model' in b) updated.model = typeof b.model === 'string' && b.model.trim() ? b.model.trim().slice(0, 80) : undefined;
    if ('skills' in b) updated.skills = Array.isArray(b.skills) ? (b.skills as unknown[]).filter((s) => typeof s === 'string') as string[] : undefined;
    if ('requireConfirm' in b) updated.requireConfirm = b.requireConfirm === true || undefined;
    if (b.trigger) updated.trigger = b.trigger;
    if (Array.isArray(b.nodes)) updated.nodes = (b.nodes as AutomationNode[]).map((n) => ({ ...n, id: n.id || randomUUID() }));
    updated.nextRunAt = updated.enabled && updated.trigger.type === 'schedule' ? computeNextRun(updated.trigger.schedule) : null;
    upsertAutomation(updated);
    broadcast({ type: 'automations_changed' });
    res.json(updated);
  });

  r.delete('/automations/:id', (req, res) => {
    const ok = deleteAutomation(req.params.id);
    if (ok) broadcast({ type: 'automations_changed' });
    res.json({ ok });
  });

  r.post('/automations/:id/run', express.json(), (req, res) => {
    const input = typeof (req.body ?? {}).input === 'string' ? (req.body as { input: string }).input : '';
    runAutomationNow(req.params.id, automationDeps, input).then((result) => {
      if (!result) return res.status(404).json({ error: 'not found' });
      res.json(result);
    }).catch((e) => res.status(500).json({ error: e instanceof Error ? e.message : String(e) }));
  });

  return r;
}

import express, { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  loadAutomations, getAutomation, upsertAutomation, deleteAutomation, makeAutomation,
  computeNextRun, setAutomationsBroadcaster, type Automation, type AutomationNode,
} from '../automations/store';
import { runAutomationNow, type SchedulerDeps } from '../automations/scheduler';
import { broadcast } from '../ws/broadcast';
import { pushNotification } from '../notifications/store';

// ── Automations (v1) ─────────────────────────────────────────────────────────
// One scheduler runs in the always-on backend (started in server.ts via startScheduler(automationDeps)).
// The `message` node persists to the notifications inbox FIRST (survives a closed tab) and the
// legacy `automation_message` broadcast keeps live toasts working.
export const automationDeps: SchedulerDeps = {
  deliver: (text, automationName) => {
    pushNotification({ kind: 'automation', title: `🤖 ${automationName}`, text });
    broadcast({ type: 'automation_message', id: randomUUID(), text: `🤖 ${automationName}\n\n${text}`, ts: Date.now() });
  },
  onChanged: () => broadcast({ type: 'automations_changed' }),
};

// Store-level change broadcaster so any writer refreshes the UI live.
setAutomationsBroadcaster(() => broadcast({ type: 'automations_changed' }));

const TIPOS_DE_NO = new Set(['worker', 'llm', 'shell', 'http', 'message']);

/** Devolve a mensagem de erro, ou `null` se a automação é aceitável. */
function validaAutomacao(b: Partial<Automation>): string | null {
  if (b.trigger) {
    const t = b.trigger as { type?: unknown; schedule?: unknown };
    if (t.type !== 'schedule' && t.type !== 'manual') return 'trigger.type tem de ser "schedule" ou "manual"';
    // Um `schedule` SEM schedule nunca dispara, e punha o scheduler a reescrever o ficheiro de 30
    // em 30 segundos, para sempre, a tentar calcular a próxima execução.
    if (t.type === 'schedule' && !t.schedule) return 'trigger.type "schedule" exige um trigger.schedule';
  }
  for (const n of (b.nodes ?? []) as { type?: unknown }[]) {
    if (!TIPOS_DE_NO.has(String(n.type))) {
      return `tipo de nó desconhecido: "${String(n.type)}" (usa ${[...TIPOS_DE_NO].join(', ')})`;
    }
  }
  return null;
}

export function automationsRouter(): Router {
  const r = Router();

  r.get('/automations', (_req, res) => res.json(loadAutomations()));

  r.post('/automations', express.json({ limit: '1mb' }), (req, res) => {
    const b = (req.body ?? {}) as Partial<Automation>;
    if (!b.name || !Array.isArray(b.nodes) || b.nodes.length === 0) {
      return res.status(400).json({ error: 'name e nodes[] (>=1) obrigatorios' });
    }
    // Validar à ENTRADA e não só a correr: um nó com tipo inventado era aceite, persistido, e só
    // falhava quando alguém a mandava correr — possivelmente dias depois.
    const erro = validaAutomacao(b);
    if (erro) return res.status(400).json({ error: erro });
    const model = typeof b.model === 'string' && b.model.trim() ? b.model.trim().slice(0, 80) : undefined;
    const cli = typeof b.cli === 'string' && b.cli.trim() ? b.cli.trim() : undefined;
    const skills = Array.isArray(b.skills) ? (b.skills as unknown[]).filter((s) => typeof s === 'string') as string[] : undefined;
    const requireConfirm = b.requireConfirm === true || undefined;
    const retries = typeof b.retries === 'number' ? b.retries : undefined;
    const catchUp = b.catchUp === true || undefined;
    const a = makeAutomation({ name: b.name, nodes: b.nodes as AutomationNode[], trigger: b.trigger, enabled: b.enabled, model, cli, skills, requireConfirm, retries, catchUp });
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
    if ('cli' in b) updated.cli = typeof b.cli === 'string' && b.cli.trim() ? b.cli.trim() : undefined;
    if ('skills' in b) updated.skills = Array.isArray(b.skills) ? (b.skills as unknown[]).filter((s) => typeof s === 'string') as string[] : undefined;
    if ('requireConfirm' in b) updated.requireConfirm = b.requireConfirm === true || undefined;
    if ('retries' in b) updated.retries = typeof b.retries === 'number' ? Math.max(0, Math.min(5, Math.floor(b.retries))) : undefined;
    if ('catchUp' in b) updated.catchUp = b.catchUp === true || undefined;
    // Guardado ANTES de aplicar o patch: só se o gatilho mudar é que a próxima execução se
    // recalcula. Um PATCH ao nome reagendava tudo, e uma execução já vencida perdia-se.
    const triggerAntes = JSON.stringify(cur.trigger);
    const enabledAntes = cur.enabled;
    if (b.trigger) updated.trigger = b.trigger;
    if (Array.isArray(b.nodes)) updated.nodes = (b.nodes as AutomationNode[]).map((n) => ({ ...n, id: n.id || randomUUID() }));
    const gatilhoMudou = JSON.stringify(updated.trigger) !== triggerAntes || updated.enabled !== enabledAntes;
    if (gatilhoMudou) {
      updated.nextRunAt = updated.enabled && updated.trigger.type === 'schedule'
        ? computeNextRun(updated.trigger.schedule) : null;
    }
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

// Automations store — v1. An automation is a linear pipeline of nodes with a trigger (schedule or
// manual). Source of truth = DATA_DIR/automacoes.json (atomic writes via project-store.writeJsonFile,
// so a kill mid-write can't corrupt it). This is the SAME format the Master will write via a tool and
// the visual editor will edit later — one schema, many editors (n8n model).
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeJsonFile, type MasterProvider } from '../project-store';

// ── Schema ──────────────────────────────────────────────────────────────────
export type NodeType = 'master' | 'llm' | 'shell' | 'http' | 'message';

export interface AutomationNode {
  id: string;
  type: NodeType;
  // master: agentic step — runs the Master loop (spawns/uses workers) with this objective.
  objective?: string;
  // llm: cheap text step — prompt the brain directly (no terminal). May reference {{input}}.
  prompt?: string;
  // shell: run a local command, capture stdout. Local-first; the user's own machine.
  command?: string;
  cwd?: string;
  // http: GET a URL, capture the body (truncated).
  url?: string;
  // message: OUTPUT — deliver text to the Master chat (and, later, WhatsApp). May reference {{input}}.
  text?: string;
  title?: string;
}

export type ScheduleKind = 'daily' | 'weekly' | 'interval';
export interface Schedule {
  kind: ScheduleKind;
  time?: string;          // "HH:MM" local — daily/weekly
  weekday?: number;       // 0=Sun … 6=Sat — weekly
  everyMinutes?: number;  // interval
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  // Which agent/brain runs the agentic (master) step. Override of the global ui-settings provider —
  // lets each automation pick Claude / Codex / Ollama (cheaper local). undefined = use global default.
  provider?: MasterProvider;
  model?: string;                 // e.g. 'sonnet'|'opus'|'haiku' (Claude); undefined = provider default
  // Acção/automação extras (uma Acção = automação de trigger manual + input em runtime):
  skills?: string[];              // skills/agentes do JOCA_Brain a usar (injectados como directiva ao agente)
  requireConfirm?: boolean;       // PÁRA antes de acções irreversíveis (envio/apagar/deploy) e pede OK
  trigger: { type: 'schedule' | 'manual'; schedule?: Schedule };
  nodes: AutomationNode[];
  nextRunAt?: number | null;
  lastRunAt?: number | null;
  lastStatus?: 'ok' | 'error' | 'running' | null;
  lastResult?: string;
  createdAt: number;
}

const AUTOMATIONS_FILE = path.join(DATA_DIR, 'automacoes.json');

// Decoupled change broadcaster: server.ts injects a fn that broadcasts `automations_changed` over WS.
// Lets the Master's create_automation tool refresh the UI without threading a callback through the
// orchestrator/provider chain. No-op until set.
let automationsBroadcaster: (() => void) | null = null;
export function setAutomationsBroadcaster(fn: () => void): void { automationsBroadcaster = fn; }
export function notifyAutomationsChanged(): void { try { automationsBroadcaster?.(); } catch { /* ignore */ } }

// Injectable runner so the Master's run_automation tool can fire an action (needs the scheduler's
// deps, which live in server.ts). Resolves a name OR id. No-op until server.ts wires it.
export interface AutomationRunOutcome { ok: boolean; finalOutput: string }
let automationRunner: ((id: string, input?: string) => Promise<AutomationRunOutcome | null>) | null = null;
export function setAutomationRunner(fn: (id: string, input?: string) => Promise<AutomationRunOutcome | null>): void { automationRunner = fn; }
export async function runAutomationByRef(ref: string, input?: string): Promise<AutomationRunOutcome | null> {
  if (!automationRunner) return null;
  const list = loadAutomations();
  const match = list.find((a) => a.id === ref) ?? list.find((a) => a.name.toLowerCase() === ref.toLowerCase());
  if (!match) return { ok: false, finalOutput: `automação "${ref}" não existe` };
  return automationRunner(match.id, input);
}

export function loadAutomations(): Automation[] {
  return readJsonFile<Automation[]>(AUTOMATIONS_FILE, []);
}

export function saveAutomations(list: Automation[]): void {
  writeJsonFile(AUTOMATIONS_FILE, list);
}

export function getAutomation(id: string): Automation | undefined {
  return loadAutomations().find((a) => a.id === id);
}

// Upsert a single automation by id (atomic full-file rewrite). Returns the saved record.
export function upsertAutomation(a: Automation): Automation {
  const list = loadAutomations();
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = a; else list.push(a);
  saveAutomations(list);
  return a;
}

export function deleteAutomation(id: string): boolean {
  const list = loadAutomations();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  saveAutomations(next);
  return true;
}

// ── Schedule math ─────────────────────────────────────────────────────────────
// Compute the next fire time (epoch ms) for a schedule, strictly AFTER `from`. Local time.
export function computeNextRun(schedule: Schedule | undefined, from: number = Date.now()): number | null {
  if (!schedule) return null;
  if (schedule.kind === 'interval') {
    const m = Math.max(1, Math.floor(schedule.everyMinutes ?? 60));
    return from + m * 60_000;
  }
  const [hh, mm] = (schedule.time ?? '09:00').split(':').map((n) => parseInt(n, 10));
  const base = new Date(from);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm, 0, 0);
  if (schedule.kind === 'daily') {
    if (next.getTime() <= from) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  // weekly
  const target = ((schedule.weekday ?? 1) % 7 + 7) % 7;
  let delta = (target - next.getDay() + 7) % 7;
  if (delta === 0 && next.getTime() <= from) delta = 7;
  next.setDate(next.getDate() + delta);
  return next.getTime();
}

// Build a fresh automation from a partial spec (used by POST /automations + the future Master tool).
export function makeAutomation(spec: Partial<Automation> & { name: string; nodes: AutomationNode[] }): Automation {
  const trigger = spec.trigger ?? { type: 'manual' as const };
  const a: Automation = {
    id: spec.id ?? randomUUID(),
    name: spec.name.trim().slice(0, 120) || 'Automação',
    enabled: spec.enabled ?? true,
    provider: spec.provider,
    model: spec.model,
    skills: Array.isArray(spec.skills) ? spec.skills.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 20) : undefined,
    requireConfirm: spec.requireConfirm ?? undefined,
    trigger,
    nodes: spec.nodes.map((n) => ({ ...n, id: n.id || randomUUID() })),
    nextRunAt: null,
    lastRunAt: spec.lastRunAt ?? null,
    lastStatus: spec.lastStatus ?? null,
    lastResult: spec.lastResult,
    createdAt: spec.createdAt ?? Date.now(),
  };
  if (a.enabled && a.trigger.type === 'schedule') a.nextRunAt = computeNextRun(a.trigger.schedule);
  return a;
}

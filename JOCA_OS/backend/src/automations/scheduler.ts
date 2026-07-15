// Automation scheduler — v1. A single in-process tick (the backend is the always-on host; on the
// VPS it runs 24h, locally it fires while the backend is up). No cron lib yet — daily/weekly/interval
// cover the stated use cases (morning summary, Saturday digest). "cron avançado" comes with the editor.
import { loadAutomations, getAutomation, upsertAutomation, computeNextRun, type Automation } from './store';
import { runAutomation, type RunnerDeps, type RunResult } from './runner';

const TICK_MS = 30_000;
const running = new Set<string>();           // guard: never run the same automation concurrently
let timer: ReturnType<typeof setInterval> | null = null;

export interface SchedulerDeps extends RunnerDeps {
  onChanged?: () => void;                     // broadcast automations_changed so the UI refreshes
}

// Persist only the run-result fields of an automation, re-reading first so a concurrent edit to other
// fields (name/nodes) during a long run isn't clobbered.
function recordResult(id: string, patch: Partial<Automation>): void {
  const latest = getAutomation(id);
  if (!latest) return;
  upsertAutomation({ ...latest, ...patch });
}

async function fire(a: Automation, deps: SchedulerDeps, input = ''): Promise<RunResult> {
  running.add(a.id);
  recordResult(a.id, { lastStatus: 'running' });
  deps.onChanged?.();
  let result: RunResult;
  try {
    result = await runAutomation(a, deps, input);
  } catch (e) {
    result = { ok: false, finalOutput: e instanceof Error ? e.message : String(e), log: [] };
  }
  const now = Date.now();
  const next = a.trigger.type === 'schedule' && a.enabled ? computeNextRun(a.trigger.schedule, now) : null;
  recordResult(a.id, {
    lastRunAt: now,
    lastStatus: result.ok ? 'ok' : 'error',
    lastResult: (result.finalOutput || '').slice(0, 2000),
    nextRunAt: next,
  });
  running.delete(a.id);
  deps.onChanged?.();
  return result;
}

function tick(deps: SchedulerDeps): void {
  const now = Date.now();
  for (const a of loadAutomations()) {
    if (!a.enabled || a.trigger.type !== 'schedule') continue;
    if (running.has(a.id)) continue;
    // Backfill a missing nextRunAt (e.g. just enabled) without firing immediately.
    if (a.nextRunAt == null) { recordResult(a.id, { nextRunAt: computeNextRun(a.trigger.schedule, now) }); continue; }
    if (a.nextRunAt <= now) void fire(a, deps);
  }
}

export function startScheduler(deps: SchedulerDeps): void {
  if (timer) return;
  // On boot, ensure every enabled scheduled automation has a future nextRunAt (don't fire stale ones).
  for (const a of loadAutomations()) {
    if (a.enabled && a.trigger.type === 'schedule' && (a.nextRunAt == null || a.nextRunAt <= Date.now())) {
      recordResult(a.id, { nextRunAt: computeNextRun(a.trigger.schedule) });
    }
  }
  timer = setInterval(() => { try { tick(deps); } catch (e) { console.error('[automations] tick error:', e); } }, TICK_MS);
  console.log(`[automations] scheduler on (tick ${TICK_MS / 1000}s)`);
}

// Manual "run now" — fires regardless of enabled/trigger. `input` seeds {{input}} for actions.
export async function runAutomationNow(id: string, deps: SchedulerDeps, input = ''): Promise<RunResult | null> {
  const a = getAutomation(id);
  if (!a) return null;
  if (running.has(id)) return { ok: false, finalOutput: 'já está a correr', log: [] };
  return fire(a, deps, input);
}

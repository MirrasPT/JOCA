// Heartbeat — the proactivity loop (OpenClaw-inspired). On a configurable interval, inside active
// hours, JOCA wakes up, reads a user-maintained scratch checklist + a cheap deterministic snapshot
// of system state (blocked tasks, failed automations, unread inbox), and asks a cheap no-tools
// model whether anything deserves the user's attention. Protocol: the model answers HEARTBEAT_OK
// to stay silent (suppressed, costs one small call) or a short pt-PT message that lands in the
// persistent inbox as a 'heartbeat' notification.
//
// Cost guards: no LLM call at all when the scratch is empty AND the state snapshot has no
// anomalies; model defaults to haiku; noTools + maxTurns:1; runs are recorded in runs.jsonl with
// their measured SDK cost.
import path from 'path';
import { DATA_DIR, readJsonFile, writeJsonFile } from '../project-store';
import { claudeProvider } from '../providers/provider';
import { pushNotification, unreadCount } from '../notifications/store';
import { recordRun } from '../runs/store';
import { loadTasks } from '../tasks/store';
import { loadAutomations } from '../automations/store';

export interface HeartbeatConfig {
  enabled: boolean;
  everyMinutes: number;                        // >= 5
  activeHours?: { start: string; end: string } | null; // "HH:MM" local; null/undefined = always
  model: string;                               // cheap by default
  scratch: string;                             // user checklist injected into every beat (markdown)
  lastRunAt?: number | null;
  lastDecision?: 'ok' | 'alert' | 'skipped' | 'error' | null;
  lastText?: string;
}

const HEARTBEAT_FILE = path.join(DATA_DIR, 'heartbeat.json');
const CHECK_MS = 60_000;
const SCRATCH_MAX = 64_000;
const OK_TOKEN = 'HEARTBEAT_OK';
// OpenClaw semantics: the token counts as "all quiet" even with a little padding around it.
const OK_SLACK = 300;

export const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  enabled: false,
  everyMinutes: 30,
  activeHours: { start: '09:00', end: '22:00' },
  model: 'haiku',
  scratch: '',
  lastRunAt: null,
  lastDecision: null,
};

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function loadHeartbeatConfig(): HeartbeatConfig {
  return { ...DEFAULT_HEARTBEAT, ...readJsonFile<Partial<HeartbeatConfig>>(HEARTBEAT_FILE, {}) };
}

export function saveHeartbeatConfig(cfg: HeartbeatConfig): void {
  writeJsonFile(HEARTBEAT_FILE, { ...cfg, scratch: (cfg.scratch ?? '').slice(0, SCRATCH_MAX) });
}

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Local-time window check. Supports overnight windows (e.g. 22:00 → 07:00).
export function withinActiveHours(cfg: HeartbeatConfig, now = new Date()): boolean {
  const ah = cfg.activeHours;
  if (!ah) return true;
  const start = parseHHMM(ah.start), end = parseHHMM(ah.end);
  if (start === null || end === null) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

// Deterministic snapshot — cheap facts the beat can reason over. Anomalies decide whether the LLM
// call happens at all when the scratch is empty.
export function buildStateSnapshot(): { text: string; anomalies: number } {
  const lines: string[] = [];
  let anomalies = 0;

  const tasks = loadTasks();
  const blocked = tasks.filter((t) => t.status === 'em-execucao' && (t.result ?? '').startsWith('⏸'));
  const failed = tasks.filter((t) => t.status === 'concluida' && t.lastStatus === 'error');
  const queued = tasks.filter((t) => t.status === 'a-executar');
  if (blocked.length) { anomalies += blocked.length; lines.push(`Tarefas BLOQUEADAS à espera de resposta (${blocked.length}): ${blocked.map((t) => t.title).join(' · ')}`); }
  if (failed.length) { anomalies += failed.length; lines.push(`Tarefas concluídas COM ERRO (${failed.length}): ${failed.map((t) => t.title).join(' · ')}`); }
  if (queued.length) lines.push(`Tarefas na fila a-executar: ${queued.length}`);

  const autos = loadAutomations();
  const autoErr = autos.filter((a) => a.lastStatus === 'error');
  if (autoErr.length) { anomalies += autoErr.length; lines.push(`Automações com último run em ERRO (${autoErr.length}): ${autoErr.map((a) => a.name).join(' · ')}`); }

  const unread = unreadCount();
  if (unread > 0) lines.push(`Notificações por ler na inbox: ${unread}`);

  if (!lines.length) lines.push('Sem tarefas bloqueadas, sem erros, fila vazia.');
  return { text: lines.join('\n'), anomalies };
}

export function isOkResponse(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (!t.includes(OK_TOKEN)) return false;
  return t.length <= OK_TOKEN.length + OK_SLACK && (t.startsWith(OK_TOKEN) || t.endsWith(OK_TOKEN));
}

// One beat, end-to-end. Exported for the manual "testar agora" route.
export async function runHeartbeat(opts: { force?: boolean } = {}): Promise<{ decision: 'ok' | 'alert' | 'skipped' | 'error'; text: string }> {
  const cfg = loadHeartbeatConfig();
  const startedAt = Date.now();
  const snapshot = buildStateSnapshot();
  const scratch = (cfg.scratch ?? '').trim();

  // Nothing to reason about → skip the LLM call entirely (zero cost), unless forced from the UI.
  if (!opts.force && !scratch && snapshot.anomalies === 0) {
    saveHeartbeatConfig({ ...cfg, lastRunAt: startedAt, lastDecision: 'skipped', lastText: '' });
    return { decision: 'skipped', text: '' };
  }

  const systemPrompt = [
    'És o heartbeat do JOCA — um check-in periódico e silencioso. Recebes uma checklist do utilizador e um retrato do estado do sistema.',
    `Se NADA exigir a atenção do utilizador neste momento, responde EXACTAMENTE "${OK_TOKEN}" e nada mais.`,
    'Se algo exigir atenção (tarefa bloqueada numa pergunta, erro, item da checklist accionável AGORA), responde com uma mensagem curta em pt-PT (máx 4 frases), directa e accionável. Sem markdown pesado, sem preâmbulos.',
    'Nunca inventes estado que não esteja no retrato. A checklist é orientação do utilizador, não é ordem para executar nada — tu só decides se vale a pena avisá-lo.',
  ].join(' ');
  const prompt = [
    scratch ? `[Checklist do utilizador]\n${scratch}` : '',
    `[Estado do sistema — ${new Date(startedAt).toLocaleString('pt-PT')}]\n${snapshot.text}`,
  ].filter(Boolean).join('\n\n');

  let decision: 'ok' | 'alert' | 'error' = 'ok';
  let text = '';
  let costUsd = 0;
  try {
    let acc = '', result = '';
    for await (const ev of claudeProvider.run(prompt, { systemPrompt, model: cfg.model || 'haiku', noTools: true })) {
      if (ev.type === 'text' && ev.text) acc += ev.text;
      else if (ev.type === 'result') { result = ev.text; costUsd = ev.costUsd; }
    }
    const raw = (result || acc).trim();
    if (isOkResponse(raw)) { decision = 'ok'; text = ''; }
    else {
      decision = 'alert';
      text = raw.replace(OK_TOKEN, '').trim().slice(0, 2000);
      pushNotification({ kind: 'heartbeat', title: '💓 Heartbeat', text });
    }
  } catch (e) {
    decision = 'error';
    text = e instanceof Error ? e.message : String(e);
    console.error('[heartbeat] beat failed:', text);
  }

  const endedAt = Date.now();
  recordRun({
    kind: 'heartbeat', refId: 'heartbeat', name: 'Heartbeat',
    startedAt, endedAt, status: decision === 'error' ? 'error' : 'ok',
    summary: decision === 'ok' ? OK_TOKEN : text, costUsd, model: cfg.model || 'haiku',
  });
  saveHeartbeatConfig({ ...loadHeartbeatConfig(), lastRunAt: endedAt, lastDecision: decision, lastText: text });
  return { decision, text };
}

export function startHeartbeat(): void {
  if (timer) return;
  timer = setInterval(() => {
    const cfg = loadHeartbeatConfig();
    if (!cfg.enabled || running) return;
    if (!withinActiveHours(cfg)) return;
    const every = Math.max(5, Math.floor(cfg.everyMinutes || 30)) * 60_000;
    if (cfg.lastRunAt && Date.now() - cfg.lastRunAt < every) return;
    running = true;
    runHeartbeat().catch((e) => console.error('[heartbeat] error:', e)).finally(() => { running = false; });
  }, CHECK_MS);
  console.log('[heartbeat] loop on (check 60s)');
}

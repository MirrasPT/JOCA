// Run history — append-only JSONL of every automation/task execution, with duration and
// SDK cost where measurable. The automations store only keeps lastResult (truncated); this is the
// durable audit trail: DATA_DIR/runs.jsonl, one JSON object per line, append-only (no rewrite races
// with the stores). Reads tail the file; stats aggregate cost/status per kind.
//
// Cost caveat: only DIRECT SDK calls (llm nodes, the tasks judge) report costUsd — PTY
// workers run on the subscription and expose no per-run cost, so costUsd is a lower bound.
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR } from '../project-store';

export type RunKind = 'automation' | 'task';

// O ficheiro é append-only e tem histórico de execuções de subsistemas ENTRETANTO REMOVIDOS (o
// heartbeat, por exemplo). Esses registos não se apagam — são história real, e o custo que
// gastaram foi mesmo gasto —, mas também não se servem: o `kind` deles já não existe no tipo, e a
// UI acabava a imprimi-lo cru. Filtra-se na leitura.
const KINDS_VIVOS = new Set<string>(['automation', 'task']);
export type RunStatus = 'ok' | 'error' | 'timeout' | 'skipped';

export interface RunRecord {
  id: string;
  kind: RunKind;
  refId: string;          // automation id / task id
  name: string;           // automation name / task title
  projectId?: string;
  startedAt: number;
  endedAt: number;
  ms: number;
  status: RunStatus;
  summary: string;        // final output / judge verdict (truncated)
  costUsd?: number;       // SDK-measured cost (llm nodes + judge); PTY work not included
  cli?: string;
  model?: string;
  retry?: number;         // retry attempt number (automations), 0/undefined = first try
}

const RUNS_FILE = path.join(DATA_DIR, 'runs.jsonl');
const SUMMARY_MAX = 2000;

export function recordRun(spec: Omit<RunRecord, 'id' | 'ms' | 'summary'> & { summary: string }): RunRecord {
  const rec: RunRecord = {
    ...spec,
    id: randomUUID(),
    ms: Math.max(0, spec.endedAt - spec.startedAt),
    summary: (spec.summary || '').slice(0, SUMMARY_MAX),
  };
  try {
    fs.mkdirSync(path.dirname(RUNS_FILE), { recursive: true });
    fs.appendFileSync(RUNS_FILE, JSON.stringify(rec) + '\n');
  } catch (e) {
    console.error('[runs] append failed:', e instanceof Error ? e.message : e);
  }
  return rec;
}

// Tail the JSONL — newest first. Reads the whole file (bounded in practice; rotate() caps growth).
export function listRuns(opts: { limit?: number; kind?: RunKind; refId?: string } = {}): RunRecord[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 1000));
  let lines: string[];
  try { lines = fs.readFileSync(RUNS_FILE, 'utf8').split('\n'); } catch { return []; }
  const out: RunRecord[] = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const rec = JSON.parse(line) as RunRecord;
      if (!KINDS_VIVOS.has(rec.kind)) continue;      // execução de um subsistema removido
      if (opts.kind && rec.kind !== opts.kind) continue;
      if (opts.refId && rec.refId !== opts.refId) continue;
      out.push(rec);
    } catch { /* skip corrupt line */ }
  }
  return out;
}

export interface RunStats {
  total: number;
  ok: number;
  error: number;
  costUsd: number;
  byKind: Record<string, { total: number; ok: number; error: number; costUsd: number }>;
}

// Aggregate over the last `days` days (default 30).
export function runStats(days = 30): RunStats {
  const since = Date.now() - days * 24 * 60 * 60_000;
  const stats: RunStats = { total: 0, ok: 0, error: 0, costUsd: 0, byKind: {} };
  for (const rec of listRuns({ limit: 1000 })) {
    if (rec.endedAt < since) continue;
    const bucket = (stats.byKind[rec.kind] ??= { total: 0, ok: 0, error: 0, costUsd: 0 });
    stats.total++; bucket.total++;
    if (rec.status === 'ok') { stats.ok++; bucket.ok++; }
    else if (rec.status === 'error' || rec.status === 'timeout') { stats.error++; bucket.error++; }
    const cost = rec.costUsd ?? 0;
    stats.costUsd += cost; bucket.costUsd += cost;
  }
  stats.costUsd = Math.round(stats.costUsd * 10000) / 10000;
  for (const k of Object.keys(stats.byKind)) {
    stats.byKind[k].costUsd = Math.round(stats.byKind[k].costUsd * 10000) / 10000;
  }
  return stats;
}

// Keep the JSONL bounded: when it exceeds maxLines, rewrite atomically with the newest half.
// Called opportunistically from recordRun consumers (scheduler boot) — not on every append.
export function rotateRuns(maxLines = 5000): void {
  try {
    const lines = fs.readFileSync(RUNS_FILE, 'utf8').split('\n').filter((l) => l.trim());
    if (lines.length <= maxLines) return;
    const keep = lines.slice(-Math.floor(maxLines / 2));
    const tmp = RUNS_FILE + '.tmp';
    fs.writeFileSync(tmp, keep.join('\n') + '\n');
    fs.renameSync(tmp, RUNS_FILE);
  } catch { /* nothing to rotate */ }
}

// RunsHistory — collapsible "Histórico" section used at the top of AutomationsView. Compact table
// of the durable run trail (GET /runs) with kind filter chips + a 30-day totals line from
// GET /runs/stats. Refetches when the parent's refreshKey changes (automations_changed via WS).
import { useCallback, useEffect, useState } from 'react';
import type { RunKind, RunRecord, RunStats } from '../types';

const KIND_LABEL: Record<RunKind, string> = { automation: 'automação' };
const FILTERS: { id: 'all' | RunKind; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'automation', label: 'Automações' },
];

const fmtWhen = (ts: number) => new Date(ts).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Duração humana: 850ms → "0.9s", 65s → "1m 5s", 3700s → "1h 1m".
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function RunsHistory({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [filter, setFilter] = useState<'all' | RunKind>('all');

  const reload = useCallback((kind: 'all' | RunKind) => {
    const qs = kind === 'all' ? '' : `&kind=${kind}`;
    fetch(`/runs?limit=100${qs}`)
      .then((r) => r.json())
      .then((d: RunRecord[]) => setRuns(Array.isArray(d) ? d : []))
      .catch(() => setRuns([]));
    fetch('/runs/stats?days=30')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Só busca quando a secção está aberta (a tabela é lazy); refreshKey re-sincroniza após cada run.
  useEffect(() => { if (open) reload(filter); }, [open, filter, refreshKey, reload]);

  return (
    <div className="runs-history">
      <button type="button" className="runs-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`runs-toggle-chevron ${open ? 'runs-toggle-chevron--open' : ''}`} aria-hidden>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </span>
        Histórico
        {stats && <span className="runs-toggle-summary">{stats.total} runs · {stats.ok} ok · {stats.error} erro · ${stats.costUsd.toFixed(2)} em 30 dias</span>}
      </button>

      {open && (
        <div className="runs-body">
          <div className="runs-filters" role="group" aria-label="Filtrar por tipo">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`runs-chip ${filter === f.id ? 'runs-chip--active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {runs.length === 0 ? (
            <div className="runs-empty">Sem execuções registadas.</div>
          ) : (
            <div className="runs-table-wrap">
              <table className="runs-table">
                <thead>
                  <tr>
                    <th>Quando</th><th>Tipo</th><th>Nome</th><th>Estado</th><th>Duração</th><th>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="runs-td-when">{fmtWhen(r.startedAt)}</td>
                      <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td className="runs-td-name" title={r.summary}>{r.name}</td>
                      <td>
                        <span className={`runs-status runs-status--${r.status}`}>{r.status}</span>
                        {typeof r.retry === 'number' && r.retry > 0 && <span className="runs-retry">retry {r.retry}</span>}
                      </td>
                      <td>{fmtDuration(r.ms)}</td>
                      <td>{typeof r.costUsd === 'number' && r.costUsd > 0 ? `$${r.costUsd.toFixed(3)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stats && (
            <div className="runs-totals">
              {stats.total} runs · {stats.ok} ok · {stats.error} erro · ${stats.costUsd.toFixed(2)} em 30 dias
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { SessionInfo } from '../types';
import type { RateLimits } from './dashboard/RateBar';
import './StatusBar.css';

interface Props {
  /** The same object the App already gets from GET /rate-limits and passes to DashboardView. */
  rateLimits: RateLimits | null;
  /**
   * Live sessions, for the activity indicator. When the App passes them (it already has them from
   * the WebSocket), the footer makes no request at all — that is the preferred route. Without them,
   * it falls back to a slow GET (see ACTIVITY_POLL_MS).
   */
  sessions?: SessionInfo[];
}

interface Slot {
  key: string;
  /** Short label in the bar (the full name stays in the detail). */
  label: string;
  full: string;
  pct: number | null;
  resetsAt?: number | null;
  /** Out of the compact form: it only shows in the detail. */
  detailOnly?: boolean;
}

interface ProviderRow {
  id: string;
  name: string;
  /** Plan/model — context information, in the detail only. */
  meta?: string | null;
  slots: Slot[];
}

/**
 * A clock to the minute without burning 60 ticks a minute: a timeout that realigns itself to second
 * 0. It stops with the tab hidden (none of this is visible) and re-syncs on return — a laptop that
 * goes to sleep freezes the timeout and would come back with the wrong time.
 */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const d = new Date();
      setNow(d);
      if (document.hidden) return;
      const delay = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      timer = window.setTimeout(schedule, delay + 50);
    };
    schedule();

    const onWake = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      schedule();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);

  return now;
}

/**
 * Fallback cadence, only used when the App does NOT pass the data by props.
 *
 * The footer is permanent: a short interval here would be an eternal background request. 20s is
 * slow enough not to weigh and fast enough for "who is working" not to lie. It stops with the tab
 * hidden and re-syncs on return.
 */
const ACTIVITY_POLL_MS = 20_000;

function useFallbackActivity(enabled: boolean, url: string, onData: (raw: unknown) => void): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelado = false;
    let timer = 0;

    const buscar = () => {
      if (document.hidden) return;
      fetch(url)
        .then((r) => r.json())
        .then((d) => { if (!cancelado) onData(d); })
        .catch(() => { /* backend down — the footer keeps the last known state */ });
    };

    const ciclo = () => { buscar(); timer = window.setTimeout(ciclo, ACTIVITY_POLL_MS); };
    ciclo();

    const aoVoltar = () => { if (!document.hidden) buscar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
    // `onData` is stable by construction (a useState setState) — it does not go into the
    // dependencies so the loop is not rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url]);
}

/** Countdown to the reset (epoch in SECONDS), in the same compact form as the RateBar. */
function formatReset(epochSec: number | null | undefined, now: Date): string | null {
  if (epochSec == null) return null;
  const diff = epochSec - Math.floor(now.getTime() / 1000);
  if (diff <= 0) return 'now';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatPct(pct: number | null): string {
  if (pct == null) return '—';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

function level(pct: number | null): 'none' | 'low' | 'mid' | 'high' {
  if (pct == null) return 'none';
  if (pct >= 85) return 'high';
  if (pct >= 60) return 'mid';
  return 'low';
}

// A provider with no data stays in the bar, dimmed — disappearing or showing 0% would be a lie.
function buildRows(rl: RateLimits | null): ProviderRow[] {
  const claude = rl?.claude;
  const codex = rl?.codex;
  const agy = rl?.agy;

  return [
    {
      id: 'claude',
      name: 'Claude',
      meta: claude?.model ?? null,
      slots: [
        { key: '5h', label: '5h', full: '5-hour window', pct: claude?.five_hour?.used_pct ?? null, resetsAt: claude?.five_hour?.resets_at },
        { key: '7d', label: '7d', full: 'Weekly window', pct: claude?.seven_day?.used_pct ?? null, resetsAt: claude?.seven_day?.resets_at },
        {
          key: 'sonnet7d',
          label: '7d S',
          full: 'Weekly (Sonnet)',
          pct: claude?.sonnet_seven_day?.used_pct ?? null,
          resetsAt: claude?.sonnet_seven_day?.resets_at,
          detailOnly: true,
        },
      ],
    },
    {
      id: 'codex',
      name: 'Codex',
      meta: codex?.plan ?? null,
      slots: [
        { key: '5h', label: '5h', full: '5-hour window', pct: codex?.five_hour?.used_pct ?? null, resetsAt: codex?.five_hour?.resets_at },
        { key: '7d', label: '7d', full: 'Weekly window', pct: codex?.seven_day?.used_pct ?? null, resetsAt: codex?.seven_day?.resets_at },
      ],
    },
    {
      id: 'agy',
      name: 'agy',
      meta: agy?.plan ?? agy?.model ?? null,
      // agy does not report time windows — only how full the context window is.
      slots: [{ key: 'ctx', label: 'ctx', full: 'Context window', pct: agy?.context?.used_pct ?? null }],
    },
  ];
}

/**
 * Permanent footer: usage of the three CLIs (5h and weekly window) + local time.
 * Discreet by default; the full numbers appear in a popover on hover, on keyboard focus (Tab gets
 * there, it is a button) or pinned by click.
 */
export default function StatusBar({
  rateLimits, sessions,
}: Props) {
  const now = useMinuteTick();
  const [pinned, setPinned] = useState<string | null>(null);
  const rows = buildRows(rateLimits);

  // Fallback: only when the App does not yet pass the information by props.
  const [fetchedSessions, setFetchedSessions] = useState<SessionInfo[]>([]);
  useFallbackActivity(sessions === undefined, '/sessions', (raw) => {
    setFetchedSessions(Array.isArray(raw) ? (raw as SessionInfo[]) : []);
  });

  const vivas = sessions ?? fetchedSessions;

  // Agents = terminals opened programmatically ('auto'). The ones the user opened by hand are his,
  // not "work under way unsupervised" — lumping them in would make the number useless.
  const agentes = vivas.filter((s) => s.origin === 'auto');
  const agentesActivos = agentes.filter((s) => s.status === 'working').length;

  const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullDate = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const resumoActividade = [
    `${agentesActivos} of ${agentes.length} agent(s) working`,
  ].filter(Boolean).join(' · ');

  return (
    <footer className="statusbar" aria-label="Activity, CLI usage and time">
      <div className="sb-providers">
        {rows.map((row) => {
          const compact = row.slots.filter((s) => !s.detailOnly);
          const known = row.slots.filter((s) => s.pct != null);
          const isPinned = pinned === row.id;
          const summary = known.length
            ? known.map((s) => `${s.full}: ${formatPct(s.pct)}`).join(', ')
            : 'no data';

          return (
            <div key={row.id} className={`sb-provider${known.length ? '' : ' sb-provider--empty'}${isPinned ? ' is-pinned' : ''}`}>
              <button
                type="button"
                className="sb-provider-btn"
                aria-expanded={isPinned}
                aria-label={`${row.name} — ${summary}`}
                onClick={() => setPinned(isPinned ? null : row.id)}
              >
                <span className="sb-provider-name">{row.name}</span>
                {compact.map((slot) => (
                  <span key={slot.key} className="sb-slot" data-window={slot.key} data-level={level(slot.pct)}>
                    <span className="sb-slot-label" aria-hidden="true">{slot.label}</span>
                    <span className="sb-track">
                      <span className="sb-fill" style={{ width: `${Math.min(100, slot.pct ?? 0)}%` }} />
                    </span>
                    <span className="sb-pct">{formatPct(slot.pct)}</span>
                  </span>
                ))}
              </button>

              <div className="sb-pop">
                <div className="sb-pop-head">
                  <span className="sb-pop-title">{row.name}</span>
                  {row.meta && <span className="sb-pop-meta">{row.meta}</span>}
                </div>
                {known.length === 0 ? (
                  <p className="sb-pop-empty">No usage data.</p>
                ) : (
                  <ul className="sb-pop-list">
                    {known.map((slot) => {
                      const reset = formatReset(slot.resetsAt, now);
                      return (
                        <li key={slot.key} className="sb-pop-row" data-level={level(slot.pct)}>
                          <span className="sb-pop-label">{slot.full}</span>
                          <span className="sb-pop-value">{formatPct(slot.pct)}</span>
                          {reset && <span className="sb-pop-reset">resets in {reset}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sb-right">
        {/* Who is working. Deliberately mute: small numbers, grey, and the only movement is a dot
            pulsing when someone really is working — the footer is always in sight, it cannot
            compete with the content. */}
        <div
          className={`sb-activity${agentesActivos ? ' is-live' : ''}`}
          role="group"
          aria-label={`Activity: ${resumoActividade}`}
        >
          <span className="sb-act-chip" title={`${agentesActivos} of ${agentes.length} agent(s) working`}>
            <span className="sb-act-dot" data-on={agentesActivos > 0} aria-hidden />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
            <span className="sb-act-num">{agentesActivos}<span className="sb-act-of">/{agentes.length}</span></span>
          </span>


        </div>

        <time className="sb-clock" dateTime={now.toISOString()} title={fullDate}>
          {hhmm}
        </time>
      </div>
    </footer>
  );
}

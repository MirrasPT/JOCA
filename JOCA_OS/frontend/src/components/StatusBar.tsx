import { useEffect, useState } from 'react';
import type { SessionInfo } from '../types';
import type { RateLimits } from './dashboard/RateBar';
import './StatusBar.css';

interface Props {
  /** Mesmo objecto que o App já obtém de GET /rate-limits e passa ao DashboardView. */
  rateLimits: RateLimits | null;
  /**
   * Sessões vivas, para o indicador de actividade. Quando o App as passa (tem-nas já do
   * WebSocket), o rodapé não faz pedido nenhum — é a via preferida. Sem elas, cai para um GET
   * lento (ver ACTIVITY_POLL_MS).
   */
  sessions?: SessionInfo[];
}

interface Slot {
  key: string;
  /** Etiqueta curta na barra (o nome por extenso fica no detalhe). */
  label: string;
  full: string;
  pct: number | null;
  resetsAt?: number | null;
  /** Fora da forma compacta: só aparece no detalhe. */
  detailOnly?: boolean;
}

interface ProviderRow {
  id: string;
  name: string;
  /** Plano/modelo — informação de contexto, só no detalhe. */
  meta?: string | null;
  slots: Slot[];
}

/**
 * Relógio ao minuto sem gastar 60 ticks por minuto: um timeout que se realinha ao segundo 0.
 * Pára com o separador escondido (nada disto é visível) e re-sincroniza ao voltar — um portátil
 * que adormece congela o timeout e voltaria com a hora errada.
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
 * Cadência de recurso, só usada quando o App NÃO passa os dados por props.
 *
 * O rodapé é permanente: um intervalo curto aqui seria um pedido de fundo eterno. 20s é lento o
 * suficiente para não pesar e rápido o suficiente para "quem está a trabalhar" não mentir. Pára
 * com o separador escondido e re-sincroniza ao voltar.
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
        .catch(() => { /* backend em baixo — o rodapé mantém o último estado conhecido */ });
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
    // `onData` é estável por construção (setState de useState) — não entra nas dependências para
    // o ciclo não se reconstruir a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url]);
}

/** Contagem decrescente até ao reset (epoch em SEGUNDOS), na mesma forma compacta do RateBar. */
function formatReset(epochSec: number | null | undefined, now: Date): string | null {
  if (epochSec == null) return null;
  const diff = epochSec - Math.floor(now.getTime() / 1000);
  if (diff <= 0) return 'agora';
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

// Um provedor sem dados continua na barra, apagado — desaparecer ou mostrar 0% seria mentira.
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
        { key: '5h', label: '5h', full: 'Janela de 5 horas', pct: claude?.five_hour?.used_pct ?? null, resetsAt: claude?.five_hour?.resets_at },
        { key: '7d', label: '7d', full: 'Janela semanal', pct: claude?.seven_day?.used_pct ?? null, resetsAt: claude?.seven_day?.resets_at },
        {
          key: 'sonnet7d',
          label: '7d S',
          full: 'Semanal (Sonnet)',
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
        { key: '5h', label: '5h', full: 'Janela de 5 horas', pct: codex?.five_hour?.used_pct ?? null, resetsAt: codex?.five_hour?.resets_at },
        { key: '7d', label: '7d', full: 'Janela semanal', pct: codex?.seven_day?.used_pct ?? null, resetsAt: codex?.seven_day?.resets_at },
      ],
    },
    {
      id: 'agy',
      name: 'agy',
      meta: agy?.plan ?? agy?.model ?? null,
      // O agy não reporta janelas de tempo — só a ocupação da janela de contexto.
      slots: [{ key: 'ctx', label: 'ctx', full: 'Janela de contexto', pct: agy?.context?.used_pct ?? null }],
    },
  ];
}

/**
 * Rodapé permanente: consumo das três CLIs (janela de 5h e semanal) + hora local.
 * Discreto por omissão; os números completos aparecem em popover no hover, no foco de teclado
 * (Tab chega lá, é um botão) ou fixos por clique.
 */
export default function StatusBar({
  rateLimits, sessions,
}: Props) {
  const now = useMinuteTick();
  const [pinned, setPinned] = useState<string | null>(null);
  const rows = buildRows(rateLimits);

  // Recurso: só quando o App ainda não passa a informação por props.
  const [fetchedSessions, setFetchedSessions] = useState<SessionInfo[]>([]);
  useFallbackActivity(sessions === undefined, '/sessions', (raw) => {
    setFetchedSessions(Array.isArray(raw) ? (raw as SessionInfo[]) : []);
  });

  const vivas = sessions ?? fetchedSessions;

  // Agentes = terminais abertos programaticamente ('auto'). Os que o utilizador abriu à mão
  // são dele, não "trabalho a decorrer sem supervisão" — juntá-los tornaria o número inútil.
  const agentes = vivas.filter((s) => s.origin === 'auto');
  const agentesActivos = agentes.filter((s) => s.status === 'working').length;

  const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullDate = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const resumoActividade = [
    `${agentesActivos} de ${agentes.length} agente(s) a trabalhar`,
  ].filter(Boolean).join(' · ');

  return (
    <footer className="statusbar" aria-label="Actividade, consumo das CLIs e hora">
      <div className="sb-providers">
        {rows.map((row) => {
          const compact = row.slots.filter((s) => !s.detailOnly);
          const known = row.slots.filter((s) => s.pct != null);
          const isPinned = pinned === row.id;
          const summary = known.length
            ? known.map((s) => `${s.full}: ${formatPct(s.pct)}`).join(', ')
            : 'sem dados';

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
                  <p className="sb-pop-empty">Sem dados de consumo.</p>
                ) : (
                  <ul className="sb-pop-list">
                    {known.map((slot) => {
                      const reset = formatReset(slot.resetsAt, now);
                      return (
                        <li key={slot.key} className="sb-pop-row" data-level={level(slot.pct)}>
                          <span className="sb-pop-label">{slot.full}</span>
                          <span className="sb-pop-value">{formatPct(slot.pct)}</span>
                          {reset && <span className="sb-pop-reset">reinicia em {reset}</span>}
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
        {/* Quem está a trabalhar. Deliberadamente mudo: números pequenos, cinzento, e o único
            movimento é um ponto a pulsar quando há mesmo alguém a trabalhar — o rodapé está
            sempre à vista, não pode competir com o conteúdo. */}
        <div
          className={`sb-activity${agentesActivos ? ' is-live' : ''}`}
          role="group"
          aria-label={`Actividade: ${resumoActividade}`}
        >
          <span className="sb-act-chip" title={`${agentesActivos} de ${agentes.length} agente(s) a trabalhar`}>
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

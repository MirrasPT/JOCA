// Fila «à espera de ti» (issue #11) — à cabeça da vista de Agentes: só o que precisa de ti, quem
// espera há mais tempo primeiro, com a idade a andar sozinha e um «Adiar» para o que pode esperar.
// Mesma linha visual dos agentes (.pw-worker): é a mesma entidade, vista por outro lado.
import { useEffect, useState } from 'react';
import type { NotificationTarget } from '../lib/notify';
import type { Project } from '../types';
import type { WaitingItem } from '../hooks/useWaitingQueue';

// Durações do «Adiar» — as mesmas que o backend aceita (SNOOZE_MINUTES em notifications/store.ts).
const SNOOZE_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 15, label: '15 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 240, label: '4 h' },
];

// Ícones em traço, no mesmo desenho dos da barra lateral (24×24, traço 2, pontas redondas).
const svgProps = {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
};
const ClockIcon = () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const CloseIcon = () => <svg {...svgProps}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const ChevronIcon = () => <svg {...svgProps}><path d="m9 18 6-6-6-6" /></svg>;

/** «há 3 min» — grão grosso de propósito: é para saber quem espera mais, não para cronometrar. */
export function waitedFor(since: number, now: number): string {
  const min = Math.floor(Math.max(0, now - since) / 60_000);
  if (min < 1) return 'há instantes';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

interface Props {
  items: WaitingItem[];
  snoozed: number;
  projects: Project[];
  onOpen: (target: NotificationTarget | undefined) => void;
  onSnooze: (id: string, minutes: number) => void;
}

export default function WaitingQueue({ items, snoozed, projects, onOpen, onSnooze }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [snoozingId, setSnoozingId] = useState<string | null>(null);

  // A idade anda sozinha. 30 s chega para um relógio de minutos.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0 && snoozed === 0) return null;

  return (
    <section className="ag-group wq" aria-label="À espera de ti">
      <div className="ag-group-head">
        <span className="section-title">À espera de ti</span>
        <span className="ag-group-count wq-count">{items.length}</span>
        {snoozed > 0 && <span className="wq-snoozed">{snoozed} adiad{snoozed === 1 ? 'a' : 'as'}</span>}
      </div>
      {items.length === 0 ? (
        <p className="tk-drawer-empty">Nada à tua espera agora — o que adiaste volta quando o prazo acabar.</p>
      ) : (
        <ul className="pw-workers">
          {items.map(({ notification: n, session, reason, since }) => {
            const name = session?.name ?? n.title;
            const project = projects.find((p) => p.id === (session?.projectId ?? n.meta?.projectId));
            const choosing = snoozingId === n.id;
            return (
              <li key={n.id}>
                <div className="pw-worker is-waiting wq-row">
                  <div
                    role="button"
                    tabIndex={0}
                    className="pw-worker-hit"
                    onClick={() => onOpen(n.meta)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(n.meta); } }}
                    title={`Abrir — ${reason}`}
                  >
                    <span className="pw-worker-dot pw-worker-dot--waiting" aria-hidden />
                    <span className="pw-worker-area">{name}</span>
                    {project && <span className="ag-cli wq-project">{project.name}</span>}
                    <span className="pw-worker-job">{reason}</span>
                    <time className="pw-worker-time" dateTime={new Date(since).toISOString()} title={new Date(since).toLocaleString('pt-PT')}>
                      {waitedFor(since, now)}
                    </time>
                    <span className="wq-go" aria-hidden><ChevronIcon /></span>
                  </div>
                  {choosing ? (
                    <span className="pw-worker-confirm wq-snooze" role="group" aria-label={`Adiar ${name}`}>
                      <span className="pw-worker-confirm-q">Adiar</span>
                      {SNOOZE_OPTIONS.map((o) => (
                        <button key={o.minutes} type="button" onClick={() => { setSnoozingId(null); onSnooze(n.id, o.minutes); }}>
                          {o.label}
                        </button>
                      ))}
                      <button type="button" className="wq-snooze-cancel" aria-label="Cancelar" onClick={() => setSnoozingId(null)}><CloseIcon /></button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="f-btn wq-snooze-btn"
                      title="Tirar da fila por um bocado — volta sozinho"
                      aria-label={`Adiar ${name}`}
                      onClick={() => setSnoozingId(n.id)}
                    >
                      <ClockIcon />
                      Adiar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

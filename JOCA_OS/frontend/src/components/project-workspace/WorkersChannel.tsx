import { useMemo } from 'react';
import type { PooledWorker, SessionInfo } from '../../types';
import { relTime } from '../TaskDetail';

interface Props {
  projectSessions: SessionInfo[];
  workers: PooledWorker[];
  /** Clique na linha: troca o painel do chat para o terminal deste agente, inline. */
  onSelectAgent: (id: string, label: string) => void;
  /** Clique no ícone de expandir: escape hatch explícito, ecrã cheio. */
  onExpandAgent: (id: string) => void;
}

function OpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pw-worker-open-icon" aria-hidden>
      <path d="M7 7h10v10" /><path d="M7 17 17 7" />
    </svg>
  );
}

// Quem está a fazer o trabalho deste projecto: agentes da pool (têm área e trabalho actual) +
// terminais abertos à mão que não pertencem a nenhuma área. Clicar na linha troca o painel do chat
// para este agente, inline; o ícone de expandir no fim é o escape hatch explícito para ecrã cheio.
export default function WorkersChannel({ projectSessions, workers, onSelectAgent, onExpandAgent }: Props) {
  const pooledIds = useMemo(() => new Set(workers.map((w) => w.sessionId)), [workers]);
  const looseSessions = useMemo(
    () => projectSessions.filter((s) => !pooledIds.has(s.id)),
    [projectSessions, pooledIds]
  );
  const liveWorkers = useMemo(() => workers.filter((w) => w.status !== 'closed'), [workers]);

  if (liveWorkers.length + looseSessions.length === 0) {
    return <p className="tk-drawer-empty">Nenhum terminal aberto neste projecto. O gestor abre um quando precisar.</p>;
  }

  // A linha é um `role="button"` (não `<button>`) porque tem o botão de expandir como IRMÃO
  // interactivo — botão dentro de botão é inválido em HTML (o browser fecha o outro cedo) e a AT
  // trata "controlo interactivo aninhado noutro" de forma inconsistente (axe-core: serious).
  const row = (
    key: string, sessionId: string, label: string, jobText: string, timeText: string, dotClass: string,
  ) => (
    <li key={key}>
      <div
        role="button"
        tabIndex={0}
        className="pw-worker"
        onClick={() => onSelectAgent(sessionId, label)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectAgent(sessionId, label); } }}
        title="Ver este agente aqui"
      >
        <span className={`pw-worker-dot pw-worker-dot--${dotClass}`} aria-hidden />
        <span className="pw-worker-area">{label}</span>
        <span className="pw-worker-job">{jobText}</span>
        <span className="pw-worker-time">{timeText}</span>
        <button
          type="button"
          className="pw-worker-expand"
          title="Abrir em ecrã cheio"
          aria-label={`Abrir ${label} em ecrã cheio`}
          onClick={(e) => { e.stopPropagation(); onExpandAgent(sessionId); }}
        >
          <OpenIcon />
        </button>
      </div>
    </li>
  );

  return (
    <ul className="pw-workers">
      {liveWorkers.map((w) => row(
        w.sessionId, w.sessionId, w.area,
        w.currentJob || (w.busy ? 'a trabalhar…' : 'à espera de trabalho'),
        relTime(w.lastUsedAt),
        w.busy || w.status === 'working' ? 'working' : 'idle',
      ))}
      {looseSessions.map((s) => row(
        s.id, s.id, s.name,
        'terminal aberto por ti',
        s.status === 'working' ? 'a trabalhar' : 'parado',
        s.status,
      ))}
    </ul>
  );
}

import { useMemo, useState } from 'react';
import type { PooledWorker, SessionInfo } from '../../types';
import { relTime } from '../TaskDetail';
import InlineName from '../InlineName';
import '../agents-view.css';

interface Props {
  projectSessions: SessionInfo[];
  workers: PooledWorker[];
  /** Agente cujo terminal está visível na coluna de escrita — a linha fica marcada. */
  selectedId?: string | null;
  /** Clique na linha: troca o painel de escrita para o terminal deste agente, inline. */
  onSelectAgent: (id: string, label: string) => void;
  /** Clique no ícone de expandir: escape hatch explícito, ecrã cheio. */
  onExpandAgent: (id: string) => void;
  /** Fecha o terminal do agente (mata a sessão). Passa por confirmação na própria linha. */
  onCloseAgent: (id: string) => void;
  /** Renomear o agente (duplo-clique no nome). Ausente = nome não editável. */
  onRenameAgent?: (id: string, name: string) => void;
}

function OpenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="pw-worker-open-icon" aria-hidden>
      <path d="M7 7h10v10" /><path d="M7 17 17 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

// Quem está a fazer o trabalho deste projecto: agentes da pool (têm área e trabalho actual) +
// terminais abertos à mão que não pertencem a nenhuma área. Clicar na linha troca o painel de
// escrita para este agente; os ícones no fim são expandir (ecrã cheio) e fechar (mata a sessão).
// O gestor vem primeiro na lista, mas é um terminal como os outros — fecha-se e tudo.
export default function WorkersChannel({ projectSessions, workers, selectedId, onSelectAgent, onExpandAgent, onCloseAgent, onRenameAgent }: Props) {
  // Fechar mata trabalho a meio — não é reversível como trocar de vista. Confirma-se na linha,
  // como no resto da app, em vez de um modal.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const pooledIds = useMemo(() => new Set(workers.map((w) => w.sessionId)), [workers]);
  const looseSessions = useMemo(
    () => projectSessions.filter((s) => !pooledIds.has(s.id)),
    [projectSessions, pooledIds]
  );
  const liveWorkers = useMemo(
    () => workers.filter((w) => w.status !== 'closed')
      .sort((a, b) => (b.manager ? 1 : 0) - (a.manager ? 1 : 0)),
    [workers]
  );

  if (liveWorkers.length + looseSessions.length === 0) {
    return <p className="tk-drawer-empty">Nenhum terminal aberto neste projecto. Abre um no "+" aqui em cima.</p>;
  }

  // A parte clicável da linha é um `role="button"` próprio, com os botões de expandir/fechar como
  // IRMÃOS de verdade (fora dele) — controlo interactivo aninhado noutro é inválido para teclado e
  // leitores de ecrã (axe-core: serious; auditoria 2026-08-06 #9).
  const row = (
    key: string, sessionId: string, label: string, jobText: string, timeText: string, dotClass: string,
  ) => {
    const confirming = confirmId === sessionId;
    const selected = selectedId === sessionId;
    return (
      <li key={key}>
        <div className={`pw-worker${dotClass === 'working' ? ' is-working' : ''}${confirming ? ' is-confirming' : ''}${selected ? ' is-selected' : ''}`}>
          <div
            role="button"
            tabIndex={0}
            className="pw-worker-hit"
            aria-current={selected || undefined}
            onClick={() => onSelectAgent(sessionId, label)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectAgent(sessionId, label); } }}
            title="Ver este agente aqui"
          >
            <span className={`pw-worker-dot pw-worker-dot--${dotClass}`} aria-hidden />
            <InlineName
              value={label}
              onRename={onRenameAgent ? (name) => onRenameAgent(sessionId, name) : undefined}
              onActivate={() => onSelectAgent(sessionId, label)}
              className="pw-worker-area"
              inputClassName="pw-worker-name-input"
            />
            {!confirming && (
              <>
                <span className="pw-worker-job">{jobText}</span>
                <span className="pw-worker-time">{timeText}</span>
              </>
            )}
          </div>
          {confirming ? (
            <span className="pw-worker-confirm">
              <span className="pw-worker-confirm-q">Fechar?</span>
              <button
                type="button"
                className="pw-worker-confirm-yes"
                onClick={() => { setConfirmId(null); onCloseAgent(sessionId); }}
              >
                Sim
              </button>
              <button type="button" onClick={() => setConfirmId(null)}>Não</button>
            </span>
          ) : (
            <>
              <button
                type="button"
                className="pw-worker-btn"
                title="Abrir em ecrã cheio"
                aria-label={`Abrir ${label} em ecrã cheio`}
                onClick={() => onExpandAgent(sessionId)}
              >
                <OpenIcon />
              </button>
              <button
                type="button"
                className="pw-worker-btn pw-worker-btn--close"
                title="Fechar este agente"
                aria-label={`Fechar ${label}`}
                onClick={() => setConfirmId(sessionId)}
              >
                <CloseIcon />
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <ul className="pw-workers">
      {liveWorkers.map((w) => row(
        w.sessionId, w.sessionId, w.manager ? 'Gestor de Projecto' : w.area,
        w.manager
          ? (w.currentJob || 'gestor do projecto')
          : (w.currentJob || (w.busy ? 'a trabalhar…' : 'à espera de trabalho')),
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

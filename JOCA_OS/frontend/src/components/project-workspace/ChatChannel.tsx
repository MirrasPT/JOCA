import { useState } from 'react';
import type { PooledWorker, SessionInfo, TerminalRef } from '../../types';
import ManagerChat from '../ManagerChat';
import TerminalPane from '../TerminalPane';
import WorkersChannel from './WorkersChannel';
import FilesChannel from './FilesChannel';

interface Props {
  projectId: string;
  projectName: string;
  refreshKey: number;
  onWorkersChange: (workers: PooledWorker[]) => void;
  projectSessions: SessionInfo[];
  workers: PooledWorker[];
  /** Escape hatch explícito (ícone de expandir) — sai do workspace, ecrã cheio, como antes. */
  onExpandSession: (id: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  path: string;
  onPreviewFile: (path: string) => void;
}

type LeftView = { kind: 'manager' } | { kind: 'agent'; sessionId: string; label: string };

// Canal por defeito do workspace: o gestor à esquerda, e à direita quem está a fazer o trabalho —
// os agentes (em cima, com o estado de cada um) e a pasta do projecto (em baixo). Clicar num agente
// TROCA o painel esquerdo para o terminal dele, inline — não navega para fora do projecto (isso só
// acontece se o utilizador pedir explicitamente "expandir"). O gestor fica sempre a um clique de
// distância via a barra de regresso.
export default function ChatChannel({
  projectId, projectName, refreshKey, onWorkersChange,
  projectSessions, workers, onExpandSession, onInput, onResize, onReady, path, onPreviewFile,
}: Props) {
  const [view, setView] = useState<LeftView>({ kind: 'manager' });

  return (
    <div className="pw-chat-layout">
      <div className="pw-chat-main">
        {view.kind === 'agent' && (
          <div className="pw-chat-agent-bar">
            <button type="button" className="pw-chat-back-btn" onClick={() => setView({ kind: 'manager' })}>
              ← Gestor de Projecto
            </button>
            <span className="pw-chat-agent-label">{view.label}</span>
            <button
              type="button"
              className="pw-chat-expand-btn"
              onClick={() => onExpandSession(view.sessionId)}
              title="Abrir este agente em ecrã cheio"
            >
              Expandir
            </button>
          </div>
        )}
        {view.kind === 'manager' ? (
          <ManagerChat
            key={projectId}
            projectId={projectId}
            projectName={projectName}
            refreshKey={refreshKey}
            onWorkersChange={onWorkersChange}
          />
        ) : (
          <div className="pw-chat-terminal-wrap">
            <TerminalPane
              key={view.sessionId}
              sessionId={view.sessionId}
              isActive
              onInput={onInput}
              onResize={onResize}
              onReady={onReady}
            />
          </div>
        )}
      </div>
      <div className="pw-chat-side">
        <div className="project-dashboard-block pw-chat-side-block pw-chat-side-block--workers">
          <div className="section-title">Agentes</div>
          <WorkersChannel
            projectSessions={projectSessions}
            workers={workers}
            onSelectAgent={(id, label) => setView({ kind: 'agent', sessionId: id, label })}
            onExpandAgent={onExpandSession}
          />
        </div>
        <div className="project-dashboard-block pw-chat-side-block pw-chat-side-block--folder">
          <div className="section-title">Pasta do projecto</div>
          <FilesChannel path={path} onPreviewFile={onPreviewFile} />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
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
  /** Fecha a sessão de um agente (mata o terminal). */
  onCloseSession: (id: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  path: string;
  onPreviewFile: (path: string) => void;
  /** Abrir um agente novo neste projecto (o "+" da secção Agentes). */
  onNewAgent: () => void;
}

type LeftView = { kind: 'manager' } | { kind: 'agent'; sessionId: string; label: string };

// Canal por defeito do workspace: o gestor à esquerda, e à direita quem está a fazer o trabalho —
// os agentes (em cima, com o estado de cada um) e a pasta do projecto (em baixo). Clicar num agente
// TROCA o painel esquerdo para o terminal dele, inline — não navega para fora do projecto (isso só
// acontece se o utilizador pedir explicitamente "expandir"). O gestor fica sempre a um clique de
// distância via a barra de regresso.
export default function ChatChannel({
  projectId, projectName, refreshKey, onWorkersChange,
  projectSessions, workers, onExpandSession, onCloseSession, onInput, onResize, onReady,
  path, onPreviewFile, onNewAgent,
}: Props) {
  const [view, setView] = useState<LeftView>({ kind: 'manager' });

  // Trocar de projecto volta sempre ao gestor DESSE projecto. Sem isto o estado `view` sobrevivia à
  // troca (o componente não remonta) e ficava-se a olhar para o terminal de um agente do projecto
  // anterior — com o resto da página já mudada, e sem sinal de que o chat não era o do projecto
  // aberto. O agente não fecha: continua na lista, a um clique.
  useEffect(() => { setView({ kind: 'manager' }); }, [projectId]);

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
          {/* O "+" vive aqui, onde os agentes estão — substitui o botão "Nova sessão" que estava no
              canto do cabeçalho do projecto, longe daquilo sobre que agia. */}
          <div className="pw-side-head">
            <span className="section-title">Agentes</span>
            <button
              type="button"
              className="pw-add-agent"
              onClick={onNewAgent}
              title="Abrir um agente novo neste projecto"
              aria-label="Abrir um agente novo neste projecto"
            >+</button>
          </div>
          <WorkersChannel
            projectSessions={projectSessions}
            workers={workers}
            onSelectAgent={(id, label) => setView({ kind: 'agent', sessionId: id, label })}
            onExpandAgent={onExpandSession}
            onCloseAgent={(id) => {
              // Se o painel esquerdo estava a mostrar este agente, o terminal deixa de existir —
              // voltar ao gestor em vez de ficar num xterm morto.
              if (view.kind === 'agent' && view.sessionId === id) setView({ kind: 'manager' });
              onCloseSession(id);
            }}
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

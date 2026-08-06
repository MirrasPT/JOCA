// ProjectWorkspace — a vista de um projecto (mainView === 'project').
//
// Estilo Discord: um projecto é um "servidor", os canais abaixo são as vistas que se trocam sem
// sair dele — Workspace (gestor + agentes + pasta, lado a lado — ver ChatChannel) e Tarefas. Git,
// descrição, toolkit e arquivar/remover deixaram de ser canais: vivem no modal de Settings
// (CreateProjectModal em modo edição, aberto pela engrenagem do cabeçalho) — só 2 canais visíveis,
// o resto é configuração, não navegação do dia-a-dia.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PooledWorker, Project, SessionInfo, TerminalRef } from '../../types';
import { shortPath } from '../../lib/paths';
import type { Task } from '../TaskDetail';
import { ActivityIcon, SettingsIcon, TasksIcon } from '../dashboard/icons';
import { TasksView } from '../TasksView';
import ChannelTabs, { CHANNEL_IDS, type ProjectChannel } from './ChannelTabs';
import ChatChannel from './ChatChannel';
import './project-workspace.css';

interface Props {
  project: Project | null;
  projects: Project[];
  sessions: SessionInfo[];
  /** Incrementa a cada `manager_message`/`manager_busy` no WebSocket. */
  managerRefresh: number;
  tasksRefresh: number;
  onEditProject: (project: Project) => void;
  /** Renomear um agente do projecto. */
  onRenameSession?: (id: string, name: string) => void;
  /** Escape hatch explícito (ícone de expandir num agente) — ecrã cheio, como antes. */
  onSwitchSession: (id: string) => void;
  /** Fecha a sessão de um agente (mesmo handler da barra lateral). */
  onCloseSession: (id: string) => void;
  /** Abre um agente novo SEM sair do projecto (o "+" da secção Agentes). */
  onAddAgent: (project: Project, cli?: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
}

export default function ProjectWorkspace({
  project, projects, sessions, managerRefresh, tasksRefresh,
  onEditProject, onRenameSession, onSwitchSession,
  onRenameProject, onCloseSession, onAddAgent, onInput, onResize, onReady,
}: Props) {
  const [workers, setWorkers] = useState<PooledWorker[]>([]);
  const [activeChannel, setActiveChannel] = useState<ProjectChannel>('chat');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [activeTaskCount, setActiveTaskCount] = useState(0);

  // A pool só é conhecida pelo GET do chat — o ManagerChat entrega-a a quem a mostra (aqui).
  const handleWorkers = useCallback((list: PooledWorker[]) => setWorkers(list), []);

  // Fechar um agente: tira-o da lista já, sem esperar pelo refetch do chat que confirma. O WS
  // 'session_closed' faz o refetch logo a seguir — isto é só para o clique ter resposta imediata.
  const handleCloseAgent = useCallback((sessionId: string) => {
    setWorkers((prev) => prev.filter((w) => w.sessionId !== sessionId));
    onCloseSession(sessionId);
  }, [onCloseSession]);

  // Chip de tarefas no cabeçalho — glance sem abrir a aba Tarefas. Recarrega quando alguma tarefa
  // muda de estado noutro sítio (mesmo `tasksRefresh` que já alimenta o TasksView).
  useEffect(() => {
    if (!project) return;
    fetch('/tasks').then((r) => r.json()).then((all: Task[]) => {
      const mine = Array.isArray(all) ? all.filter((t) => t.projectId === project.id) : [];
      const doneStatuses = new Set(['arquivada', 'concluida']);
      setActiveTaskCount(mine.filter((t) => !doneStatuses.has(t.status)).length);
    }).catch(() => setActiveTaskCount(0));
  }, [project, tasksRefresh]);

  const projectSessions = useMemo(
    () => (project ? sessions.filter((s) => s.projectId === project.id) : []),
    [project, sessions]
  );
  const pooledIds = useMemo(() => new Set(workers.map((w) => w.sessionId)), [workers]);
  const looseSessions = useMemo(
    () => projectSessions.filter((s) => !pooledIds.has(s.id)),
    [projectSessions, pooledIds]
  );
  const liveWorkers = useMemo(() => workers.filter((w) => w.status !== 'closed'), [workers]);
  const workerCount = liveWorkers.length + looseSessions.length;

  const commitName = useCallback(() => {
    if (!project) return;
    const t = nameDraft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditingName(false);
  }, [project, nameDraft, onRenameProject]);

  if (!project) {
    return (
      <div className="dashboard-view project-workspace">
        <div className="vp-header">
          <div>
            <h1 className="vp-title">Projecto_</h1>
            <p className="vp-desc">Escolhe um projecto na barra lateral para falar com o gestor dele.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-view project-workspace">
      <div className="vp-header">
        <div className="pw-head-main">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="pw-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
                e.stopPropagation();
              }}
              aria-label="Nome do projecto"
            />
          ) : (
            <h1
              className="vp-title"
              onDoubleClick={() => {
                setNameDraft(project.name);
                setEditingName(true);
                setTimeout(() => nameInputRef.current?.focus(), 50);
              }}
              title={`${project.name} — duplo clique para renomear`}
              style={{ cursor: 'pointer' }}
            >
              {project.name}_
            </h1>
          )}
          <p className="vp-desc">
            {shortPath(project.path)}
            {project.hasCode ? ' · já tem código' : ' · projecto do zero'}
          </p>
        </div>
        <div className="pw-head-stats">
          <span className="pw-head-stat"><ActivityIcon /> {workerCount} agente{workerCount === 1 ? '' : 's'}</span>
          <span className="pw-head-stat"><TasksIcon /> {activeTaskCount} tarefa{activeTaskCount === 1 ? '' : 's'}</span>
        </div>
        <div className="header-actions">
          <button className="f-btn f-btn--secondary pw-settings-btn" type="button" onClick={() => onEditProject(project)} aria-label="Configurações do projecto" data-tooltip="Settings" data-tooltip-position="bottom">
            <SettingsIcon />
          </button>
        </div>
      </div>

      <ChannelTabs active={activeChannel} onChange={setActiveChannel} workerCount={workerCount} />

      {/* Painel de cada canal: só o activo monta conteúdo real (evita fetches/websockets
          redundantes do outro); o inactivo fica como stub `hidden` no DOM só para o
          `aria-controls` da tab apontar sempre a um elemento real (axe-core: aria-valid-
          attr-value). */}
      {CHANNEL_IDS.map((id) => id === activeChannel ? (
        <div key={id} className="pw-channel-body" id={`pw-channel-${id}`} role="tabpanel" aria-labelledby={`pw-tab-${id}`}>
          {id === 'chat' && (
            <ChatChannel
              projectId={project.id}
              refreshKey={managerRefresh}
              onWorkersChange={handleWorkers}
              projectSessions={projectSessions}
              workers={workers}
              onExpandSession={onSwitchSession}
              onCloseSession={handleCloseAgent}
              onNewAgent={(cli) => onAddAgent(project, cli)}
              onRenameAgent={onRenameSession}
              onInput={onInput}
              onResize={onResize}
              onReady={onReady}
            />
          )}
          {id === 'tasks' && (
            <TasksView refreshKey={tasksRefresh} projects={projects} projectId={project.id} />
          )}
        </div>
      ) : (
        <div key={id} id={`pw-channel-${id}`} role="tabpanel" aria-labelledby={`pw-tab-${id}`} hidden />
      ))}
    </div>
  );
}

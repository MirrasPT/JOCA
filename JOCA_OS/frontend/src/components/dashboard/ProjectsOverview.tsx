import type { CSSProperties } from 'react';
import type { JocaLogicInfo, Project, SessionInfo } from '../../types';
import { shortPath } from '../../lib/paths';
import { projectColor } from '../../lib/projectColor';
import { FolderIcon, TerminalIcon, ActivityIcon, ShuffleIcon, BrainIcon } from './icons';
import InlineName from '../InlineName';
import type { RateLimits } from './RateBar';

interface Props {
  projects: Project[];
  sessions: SessionInfo[];
  jocaLogicInfo: JocaLogicInfo | null;
  /** Mantido na interface por compat com o caller; o consumo de limites vive no rodapé (StatusBar). */
  rateLimits: RateLimits | null;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onShowProject: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onRenameProject?: (id: string, name: string) => void;
  onRenameSession?: (id: string, name: string) => void;
}

// O panorama global: contadores, estado do Brain e a grelha de projectos + agentes rápidos.
// Os limites das CLIs saíram daqui de propósito — o rodapé (StatusBar) mostra-os SEMPRE, e o
// bloco duplicado na dashboard era a mesma informação com outra pintura a envelhecer à parte.
export default function ProjectsOverview({
  projects, sessions, jocaLogicInfo,
  onCreateProject, onEditProject, onShowProject, onOpenProject, onSwitchSession, onNewSession,
  onRenameProject, onRenameSession,
}: Props) {
  const workingSessions = sessions.filter((s) => s.status === 'working');
  const looseSessions = sessions.filter((s) => !s.projectId);
  const visibleProjects = projects.filter((p) => !p.archived);

  return (
    <div className="dashboard-view">
      <div className="vp-header">
        <div>
          <h1 className="vp-title">Projectos_</h1>
          <p className="vp-desc">Panorama dos projectos, agentes activos e do motor local.</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="f-btn" type="button" onClick={onCreateProject}>
            <FolderIcon /> Novo projecto
          </button>
        </div>
      </div>

      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--folder"><FolderIcon /></div>
          <div>
            <div className="db-stat-value">{visibleProjects.length}</div>
            <div className="db-stat-label">Projectos activos</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--terminal"><TerminalIcon /></div>
          <div>
            <div className="db-stat-value">{sessions.length}</div>
            <div className="db-stat-label">Agentes abertos</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--activity"><ActivityIcon /></div>
          <div>
            <div className="db-stat-value">{workingSessions.length}</div>
            <div className="db-stat-label">A trabalhar agora</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--loose"><ShuffleIcon /></div>
          <div>
            <div className="db-stat-value">{looseSessions.length}</div>
            <div className="db-stat-label">Agentes rápidos</div>
          </div>
        </div>
      </div>

      {jocaLogicInfo && (
        <div className="db-logic-status">
          <div className="db-logic-status-header">
            <BrainIcon />
            <span className="db-logic-status-title">JOCA_Brain</span>
            <span className={`status-pill status-pill--${jocaLogicInfo.connected ? 'connected' : 'offline'}`}>
              {jocaLogicInfo.connected ? 'ligado' : 'offline'}
            </span>
          </div>
          {jocaLogicInfo.connected && (
            <div className="db-logic-status-counts">
              <span>{jocaLogicInfo.skillCount} skills</span>
              <span>{jocaLogicInfo.agentCount} agentes</span>
              <span>{jocaLogicInfo.commandCount} comandos</span>
              {jocaLogicInfo.hasGraph && <span>graph</span>}
              {jocaLogicInfo.hasSoul && <span>soul</span>}
            </div>
          )}
        </div>
      )}

      <div className="section-title">Projectos</div>
      <div className="db-projects-grid">
        {visibleProjects.length === 0 && looseSessions.length === 0 && (
          <div className="dashboard-empty-card">
            <div className="empty-icon"><TerminalIcon /></div>
            <p>Ainda não há projectos. Cria um para o gestor ter onde trabalhar, ou abre um agente rápido para uma tarefa avulsa.</p>
            <button className="btn-new-large" type="button" onClick={onCreateProject}>+ Criar projecto</button>
          </div>
        )}

        {visibleProjects.map((project) => {
          const projectSessions = sessions.filter((s) => s.projectId === project.id);
          const working = projectSessions.filter((s) => s.status === 'working').length;
          return (
            <div
              key={project.id}
              className="db-project-card"
              style={{ '--project-color': projectColor(project) } as CSSProperties}
            >
              <div className="db-project-card-header">
                <div style={{ minWidth: 0 }}>
                  <div className="db-project-card-title">
                    <span className="db-project-color-dot" aria-hidden />
                    <InlineName
                      value={project.name}
                      onRename={onRenameProject ? (name) => onRenameProject(project.id, name) : undefined}
                      className="db-project-card-title-text"
                      inputStyle={{ fontSize: '13px', fontWeight: 700, height: '22px' }}
                    />
                    {working > 0 && <span className="db-project-working-chip">{working} a trabalhar</span>}
                  </div>
                  <div className="db-project-card-path">{shortPath(project.path)}</div>
                </div>
                <div className="db-project-card-actions">
                  <button className="db-project-card-btn db-project-card-btn--ghost" type="button" onClick={() => onEditProject(project)}>
                    Editar
                  </button>
                  <button className="db-project-card-btn" type="button" onClick={() => onShowProject(project.id)}>
                    Abrir
                  </button>
                </div>
              </div>
              {projectSessions.length === 0 && (
                <div className="db-project-body">
                  {project.description ? (
                    <p className="db-project-description" title={project.description}>{project.description}</p>
                  ) : (
                    <button
                      type="button"
                      className="db-project-description db-project-description--empty"
                      onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                    >
                      + Descreve o projecto para o gestor saber o que é
                    </button>
                  )}
                </div>
              )}
              <div className="db-project-sessions-list">
                {projectSessions.length === 0 ? (
                  <button className="db-project-session-item db-project-session-empty" type="button" onClick={() => onOpenProject(project)}>
                    Abrir sessão no projecto
                  </button>
                ) : (
                  projectSessions.map((session) => (
                    <div
                      key={session.id}
                      className="db-project-session-item db-project-session-item--row"
                      role="button"
                      tabIndex={0}
                      onClick={() => onSwitchSession(session.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitchSession(session.id); } }}
                    >
                      <InlineName
                        value={session.name}
                        onRename={onRenameSession ? (name) => onRenameSession(session.id, name) : undefined}
                        onActivate={() => onSwitchSession(session.id)}
                        className="db-project-session-name"
                        inputStyle={{ fontSize: '11px', height: '18px', flex: 1, marginRight: '8px' }}
                      />
                      <span className={`db-project-session-status db-project-session-status--${session.status}`}>
                        {session.status === 'working' ? 'a trabalhar' : 'parado'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {looseSessions.map((session) => (
          <div key={session.id} className="db-project-card db-project-card--loose">
            <div className="db-project-card-header">
              <div style={{ minWidth: 0 }}>
                <div className="db-project-card-title">
                  <InlineName
                    value={session.name}
                    onRename={onRenameSession ? (name) => onRenameSession(session.id, name) : undefined}
                    className="db-project-card-title-text"
                    inputStyle={{ fontSize: '13px', fontWeight: 700, height: '22px' }}
                  />
                </div>
                <div className="db-project-card-path">{shortPath(session.cwd)} · agente rápido{session.cli && session.cli !== 'claude' ? ` (${session.cli})` : ''}</div>
              </div>
              <div className="db-project-card-actions">
                <span className={`db-project-session-status db-project-session-status--${session.status}`}>
                  {session.status === 'working' ? 'a trabalhar' : 'parado'}
                </span>
                <button className="db-project-card-btn" type="button" onClick={() => onSwitchSession(session.id)}>Abrir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

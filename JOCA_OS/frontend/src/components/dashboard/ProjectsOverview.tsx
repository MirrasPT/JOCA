import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { JocaLogicInfo, Project, SessionInfo } from '../../types';
import { shortPath } from '../../lib/paths';
import { projectColor } from '../../lib/projectColor';
import { FolderIcon, TerminalIcon, ActivityIcon, ShuffleIcon, BrainIcon } from './icons';
import InlineName from '../InlineName';
import { SaveAllButton, SaveAllConfirm, mensagemSaveAll, planoSaveAll } from './SaveAll';
import type { RateLimits } from './RateBar';

/** How long the Save all result stays on screen before clearing itself. */
const RESULTADO_MS = 8000;

interface Props {
  projects: Project[];
  sessions: SessionInfo[];
  jocaLogicInfo: JocaLogicInfo | null;
  /** Kept in the interface for caller compat; limit usage lives in the footer (StatusBar). */
  rateLimits: RateLimits | null;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onShowProject: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  /** Sends `/save` (with Enter) to the given conversations. Which ones is chosen by `planoSaveAll`. */
  onSaveAll: (sessionIds: string[]) => void;
  onRenameProject?: (id: string, name: string) => void;
  onRenameSession?: (id: string, name: string) => void;
}

// The global overview: counters, Brain state and the grid of projects + quick agents.
// The CLI limits left here deliberately — the footer (StatusBar) shows them ALWAYS, and the
// duplicated block on the dashboard was the same information in another paint, aging separately.
export default function ProjectsOverview({
  projects, sessions, jocaLogicInfo,
  onCreateProject, onEditProject, onShowProject, onOpenProject, onSwitchSession, onSaveAll,
  onRenameProject, onRenameSession,
}: Props) {
  const workingSessions = sessions.filter((s) => s.status === 'working');
  const looseSessions = sessions.filter((s) => !s.projectId);
  const visibleProjects = projects.filter((p) => !p.archived);

  // Save all: the plan is counted from the live list, and the dialog is the only path to sending.
  const plano = useMemo(() => planoSaveAll(sessions), [sessions]);
  const [confirmarSaveAll, setConfirmarSaveAll] = useState(false);
  const [resultadoSaveAll, setResultadoSaveAll] = useState('');

  // The result is a warning, not a permanent state: without this it kept saying "sent to 4
  // conversations" hours later, describing something that is no longer true.
  useEffect(() => {
    if (!resultadoSaveAll) return;
    const t = setTimeout(() => setResultadoSaveAll(''), RESULTADO_MS);
    return () => clearTimeout(t);
  }, [resultadoSaveAll]);

  return (
    <div className="dashboard-view">
      <div className="vp-header">
        <div>
          <h1 className="vp-title">Projects_</h1>
          <p className="vp-desc">Overview of the projects, active agents and the local engine.</p>
        </div>
        <div className="dashboard-header-side">
          <div className="dashboard-header-actions">
            <SaveAllButton plano={plano} onClick={() => setConfirmarSaveAll(true)} />
            <button className="f-btn" type="button" onClick={onCreateProject}>
              <FolderIcon /> New project
            </button>
          </div>
          {/* It always lives in the DOM (even empty) because a live region is only announced if it
              is already there when the text changes — and the reserved space avoids a header jump. */}
          <p className="db-saveall-result" role="status">{resultadoSaveAll}</p>
        </div>
      </div>

      {confirmarSaveAll && (
        <SaveAllConfirm
          plano={plano}
          onCancel={() => setConfirmarSaveAll(false)}
          onConfirm={() => {
            setConfirmarSaveAll(false);
            onSaveAll(plano.ids);
            setResultadoSaveAll(mensagemSaveAll(plano));
          }}
        />
      )}

      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--folder"><FolderIcon /></div>
          <div>
            <div className="db-stat-value">{visibleProjects.length}</div>
            <div className="db-stat-label">Active projects</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--terminal"><TerminalIcon /></div>
          <div>
            <div className="db-stat-value">{sessions.length}</div>
            <div className="db-stat-label">Open agents</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--activity"><ActivityIcon /></div>
          <div>
            <div className="db-stat-value">{workingSessions.length}</div>
            <div className="db-stat-label">Working now</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--loose"><ShuffleIcon /></div>
          <div>
            <div className="db-stat-value">{looseSessions.length}</div>
            <div className="db-stat-label">Quick agents</div>
          </div>
        </div>
      </div>

      {jocaLogicInfo && (
        <div className="db-logic-status">
          <div className="db-logic-status-header">
            <BrainIcon />
            <span className="db-logic-status-title">JOCA_Brain</span>
            <span className={`status-pill status-pill--${jocaLogicInfo.connected ? 'connected' : 'offline'}`}>
              {jocaLogicInfo.connected ? 'connected' : 'offline'}
            </span>
          </div>
          {jocaLogicInfo.connected && (
            <div className="db-logic-status-counts">
              <span>{jocaLogicInfo.skillCount} skills</span>
              <span>{jocaLogicInfo.agentCount} agents</span>
              <span>{jocaLogicInfo.commandCount} commands</span>
              {jocaLogicInfo.hasGraph && <span>graph</span>}
              {jocaLogicInfo.hasSoul && <span>soul</span>}
            </div>
          )}
        </div>
      )}

      <div className="section-title">Projects</div>
      <div className="db-projects-grid">
        {visibleProjects.length === 0 && looseSessions.length === 0 && (
          <div className="dashboard-empty-card">
            <div className="empty-icon"><TerminalIcon /></div>
            <p>No projects yet. Create one so you have somewhere to work, or open a quick agent for a one-off thing.</p>
            <button className="btn-new-large" type="button" onClick={onCreateProject}>+ Create project</button>
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
                    {working > 0 && <span className="db-project-working-chip">{working} working</span>}
                  </div>
                  <div className="db-project-card-path">{shortPath(project.path)}</div>
                </div>
                <div className="db-project-card-actions">
                  <button className="db-project-card-btn db-project-card-btn--ghost" type="button" onClick={() => onEditProject(project)}>
                    Edit
                  </button>
                  <button className="db-project-card-btn" type="button" onClick={() => onShowProject(project.id)}>
                    Open
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
                      + Describe the project so the terminals know what it is
                    </button>
                  )}
                </div>
              )}
              <div className="db-project-sessions-list">
                {projectSessions.length === 0 ? (
                  <button className="db-project-session-item db-project-session-empty" type="button" onClick={() => onOpenProject(project)}>
                    Open a session in the project
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
                        {session.status === 'working' ? 'working' : 'idle'}
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
                <div className="db-project-card-path">{shortPath(session.cwd)} · quick agent{session.cli && session.cli !== 'claude' ? ` (${session.cli})` : ''}</div>
              </div>
              <div className="db-project-card-actions">
                <span className={`db-project-session-status db-project-session-status--${session.status}`}>
                  {session.status === 'working' ? 'working' : 'idle'}
                </span>
                <button className="db-project-card-btn" type="button" onClick={() => onSwitchSession(session.id)}>Open</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

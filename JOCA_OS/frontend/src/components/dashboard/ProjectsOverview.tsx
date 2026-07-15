import { useState, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { JocaLogicInfo, Project, SessionInfo } from '../../types';
import { shortPath } from '../../lib/paths';
import { FolderIcon, TerminalIcon, BrainIcon } from './icons';
import { RateBar, type RateLimits } from './RateBar';

interface Props {
  projects: Project[];
  sessions: SessionInfo[];
  jocaLogicInfo: JocaLogicInfo | null;
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

// The global dashboard (mainView === 'dashboard'): stats grid, JOCA_Brain status, rate limits,
// and the project workspaces grid (+ loose sessions). Owns its own inline-rename editing state.
export default function ProjectsOverview({
  projects, sessions, jocaLogicInfo, rateLimits,
  onCreateProject, onEditProject, onShowProject, onOpenProject, onSwitchSession, onNewSession,
  onRenameProject, onRenameSession,
}: Props) {
  const activateOnKeyboard = (event: KeyboardEvent<HTMLElement>, action: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const editProjectInputRef = useRef<HTMLInputElement>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const editSessionInputRef = useRef<HTMLInputElement>(null);

  const workingSessions = sessions.filter((s) => s.status === 'working');
  const ungroupedSessions = sessions.filter((s) => !s.projectId);
  const visibleProjects = projects.filter((p) => !p.archived);

  return (
    <div className="dashboard-view">
      <div className="vp-header">
        <div>
          <h1 className="vp-title">Projects Dashboard_</h1>
          <p className="vp-desc">Overview of projects, active sessions and local workspace context.</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="f-btn" type="button" onClick={onCreateProject}>
            <FolderIcon /> Create Project
          </button>
        </div>
      </div>

      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--folder"><FolderIcon /></div>
          <div>
            <div className="db-stat-value">{visibleProjects.length}</div>
            <div className="db-stat-label">Active Projects</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--terminal"><TerminalIcon /></div>
          <div>
            <div className="db-stat-value">{sessions.length}</div>
            <div className="db-stat-label">Total Sessions</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--terminal"><TerminalIcon /></div>
          <div>
            <div className="db-stat-value">{workingSessions.length}</div>
            <div className="db-stat-label">Working Now</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon db-stat-icon--folder"><FolderIcon /></div>
          <div>
            <div className="db-stat-value">{ungroupedSessions.length}</div>
            <div className="db-stat-label">Loose Sessions</div>
          </div>
        </div>
      </div>

      {jocaLogicInfo && (
        <div className="db-logic-status">
          <div className="db-logic-status-header">
            <BrainIcon />
            <span className="db-logic-status-title">JOCA_Brain Engine</span>
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

      {rateLimits && (rateLimits.claude || rateLimits.codex || rateLimits.agy) && (
        <div className="db-rate-limits">
          {rateLimits.claude && (
            <div className="db-rate-limits-section">
              <div className="db-rate-limits-header">
                <span className="db-rate-limits-model">Claude</span>
              </div>
              <div className="db-rate-limits-bars">
                <RateBar label="5 hours" win={rateLimits.claude.five_hour} fillClass="db-rate-bar-fill--5h" />
                <RateBar label="7 days" win={rateLimits.claude.seven_day} fillClass="db-rate-bar-fill--7d" />
                <RateBar label="Sonnet 7d" win={rateLimits.claude.sonnet_seven_day} fillClass="db-rate-bar-fill--sonnet" />
              </div>
            </div>
          )}
          {rateLimits.codex && (
            <div className="db-rate-limits-section">
              <div className="db-rate-limits-header">
                <span className="db-rate-limits-model">Codex</span>
                {rateLimits.codex.plan && <span className="db-rate-limits-plan">{rateLimits.codex.plan}</span>}
              </div>
              <div className="db-rate-limits-bars">
                <RateBar label="5 hours" win={rateLimits.codex.five_hour} fillClass="db-rate-bar-fill--codex-5h" />
                <RateBar label="7 days" win={rateLimits.codex.seven_day} fillClass="db-rate-bar-fill--codex-7d" />
              </div>
            </div>
          )}
          {rateLimits.agy && (
            <div className="db-rate-limits-section">
              <div className="db-rate-limits-header">
                <span className="db-rate-limits-model">Gemini</span>
                {rateLimits.agy.plan && <span className="db-rate-limits-plan">{rateLimits.agy.plan}</span>}
              </div>
              <div className="db-rate-limits-bars">
                {rateLimits.agy.context?.used_pct != null && (
                  <div className="db-rate-bar">
                    <span className="db-rate-bar-label">Context</span>
                    <div className="db-rate-bar-track">
                      <div className="db-rate-bar-fill db-rate-bar-fill--agy" style={{ width: `${Math.min(100, rateLimits.agy.context.used_pct)}%` }} />
                    </div>
                    <span className="db-rate-bar-pct">{rateLimits.agy.context.used_pct < 1 ? '<1' : Math.round(rateLimits.agy.context.used_pct)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="section-title">Project Workspaces</div>
      <div className="db-projects-grid">
        {projects.length === 0 && sessions.length === 0 && (
          <div className="dashboard-empty-card">
            <div className="empty-icon"><TerminalIcon /></div>
            <p>No projects or active sessions. Create a project to start organizing.</p>
            <button className="btn-new-large" type="button" onClick={onNewSession}>+ New Session</button>
          </div>
        )}

        {visibleProjects.map((project) => {
          const projectSessions = sessions.filter((s) => s.projectId === project.id);
          const colorTheme = project.color || '#ff4500';
          return (
            <div
              key={project.id}
              className="db-project-card"
              style={{ '--project-color': colorTheme } as CSSProperties}
            >
              <div className="db-project-card-header">
                <div>
                  {editingProjectId === project.id ? (
                    <input
                      ref={editProjectInputRef}
                      className="card-name-input"
                      style={{ fontSize: '13px', fontWeight: 700, height: '22px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px' }}
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onBlur={() => {
                        const t = editingProjectName.trim();
                        if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
                        setEditingProjectId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const t = editingProjectName.trim();
                          if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
                          setEditingProjectId(null);
                        }
                        if (e.key === 'Escape') setEditingProjectId(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      className="db-project-card-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingProjectId(project.id);
                        setEditingProjectName(project.name);
                        setTimeout(() => editProjectInputRef.current?.focus(), 50);
                      }}
                      title={`${project.name} — double-click to rename`}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="db-project-color-dot" aria-hidden />
                      {project.name}
                    </div>
                  )}
                  <div className="db-project-card-path">{shortPath(project.path)}</div>
                </div>
                <div className="db-project-card-actions">
                  <button className="db-project-card-btn db-project-card-btn--ghost" type="button" onClick={() => onEditProject(project)}>
                    Edit
                  </button>
                  <button className="db-project-card-btn" type="button" onClick={() => onShowProject(project.id)}>
                    Dashboard
                  </button>
                </div>
              </div>
              <div className="db-project-sessions-list">
                {projectSessions.length === 0 ? (
                  <button className="db-project-session-item db-project-session-empty" type="button" onClick={() => onOpenProject(project)}>
                    Start project session
                  </button>
                ) : (
                  projectSessions.map((session) => (
                    <div
                      key={session.id}
                      className="db-project-session-item"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
                      onClick={() => editingSessionId !== session.id && onSwitchSession(session.id)}
                    >
                      {editingSessionId === session.id ? (
                        <input
                          ref={editSessionInputRef}
                          className="card-name-input"
                          style={{ fontSize: '11px', height: '18px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px', flex: 1, marginRight: '8px' }}
                          value={editingSessionName}
                          onChange={(e) => setEditingSessionName(e.target.value)}
                          onBlur={() => {
                            const t = editingSessionName.trim();
                            if (t && t !== session.name && onRenameSession) onRenameSession(session.id, t);
                            setEditingSessionId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const t = editingSessionName.trim();
                              if (t && t !== session.name && onRenameSession) onRenameSession(session.id, t);
                              setEditingSessionId(null);
                            }
                            if (e.key === 'Escape') setEditingSessionId(null);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="db-project-session-name"
                          style={{ flex: 1 }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(session.id);
                            setEditingSessionName(session.name);
                            setTimeout(() => editSessionInputRef.current?.focus(), 50);
                          }}
                          title={`${session.name} — double-click to rename`}
                        >
                          {session.name}
                        </span>
                      )}
                      <span className={`db-project-session-status db-project-session-status--${session.status}`}>
                        {session.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {sessions.filter((s) => !s.projectId).map((session) => (
          <div key={session.id} className="db-project-card db-project-card--loose">
            <div className="db-project-card-header">
              <div>
                {editingSessionId === session.id ? (
                  <input
                    ref={editSessionInputRef}
                    className="card-name-input"
                    style={{ fontSize: '13px', fontWeight: 700, height: '22px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px' }}
                    value={editingSessionName}
                    onChange={(e) => setEditingSessionName(e.target.value)}
                    onBlur={() => {
                      const t = editingSessionName.trim();
                      if (t && t !== session.name && onRenameSession) onRenameSession(session.id, t);
                      setEditingSessionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const t = editingSessionName.trim();
                        if (t && t !== session.name && onRenameSession) onRenameSession(session.id, t);
                        setEditingSessionId(null);
                      }
                      if (e.key === 'Escape') setEditingSessionId(null);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="db-project-card-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(session.id);
                      setEditingSessionName(session.name);
                      setTimeout(() => editSessionInputRef.current?.focus(), 50);
                    }}
                    title={`${session.name} — double-click to rename`}
                    style={{ cursor: 'pointer' }}
                  >
                    {session.name}
                  </div>
                )}
                <div className="db-project-card-path">{shortPath(session.cwd)}</div>
              </div>
              <button className="db-project-card-btn" type="button" onClick={() => onSwitchSession(session.id)}>Open</button>
            </div>
            <div className="db-project-sessions-list">
              <div
                className="db-project-session-item"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onClick={() => editingSessionId !== session.id && onSwitchSession(session.id)}
                onKeyDown={(event) => {
                  if (editingSessionId === session.id) return;
                  activateOnKeyboard(event, () => onSwitchSession(session.id));
                }}
              >
                {editingSessionId === session.id ? (
                  <input
                    ref={editSessionInputRef}
                    className="card-name-input"
                    style={{ fontSize: '11px', height: '18px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px', flex: 1, marginRight: '8px' }}
                    value={editingSessionName}
                    onChange={(e) => setEditingSessionName(e.target.value)}
                    onBlur={() => {
                      const t = editingSessionName.trim();
                      if (t && t !== session.name && onRenameSession) onRenameSession(session.id, t);
                      setEditingSessionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const t = editingSessionName.trim();
                        if (t && t !== session.name && onRenameSession) onRenameSession(session.id, t);
                        setEditingSessionId(null);
                      }
                      if (e.key === 'Escape') setEditingSessionId(null);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="db-project-session-name"
                    style={{ flex: 1 }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(session.id);
                      setEditingSessionName(session.name);
                      setTimeout(() => editSessionInputRef.current?.focus(), 50);
                    }}
                    title={`${session.name} — double-click to rename`}
                  >
                    Loose terminal session
                  </span>
                )}
                <span className={`db-project-session-status db-project-session-status--${session.status}`}>
                  {session.status}
                </span>
              </div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}

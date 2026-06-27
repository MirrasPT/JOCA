import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { JocaLogicInfo, Project, SessionInfo, ProjectMemory } from '../types';
import { shortPath } from '../lib/paths';
import FileBrowser from './FileBrowser';
import './DashboardView.css';

interface Props {
  mainView: 'dashboard' | 'project';
  projects: Project[];
  sessions: SessionInfo[];
  activeProjectId: string | null;
  projectMemory: Record<string, ProjectMemory>;
  jocaLogicInfo: JocaLogicInfo | null;
  onUpdateProjectMemory: (projectId: string, patch: Partial<ProjectMemory>) => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onShowProject: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  setRightPanel: (panel: 'files' | 'toolkit' | 'settings' | null) => void;
  onPreviewFile: (path: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onUpdateProject?: (id: string, patch: Partial<Project>) => Promise<void>;
  onRenameSession?: (id: string, name: string) => void;
  onCreateProjectSkill?: (project: Project, skillName: string) => void;
  rateLimits: RateLimits | null;
}

// ── Lucide SVG Icons ───────────────────────────────────────────────

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}


function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-svg-icon">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

// ── Rate limits ────────────────────────────────────────────────────
interface RateWindow {
  used_pct: number | null;
  resets_at?: number | null; // epoch SECONDS
}

// Fonte única de verdade: App.tsx faz o poll de /rate-limits e passa por prop.
export interface RateLimits {
  claude?: {
    model?: string;
    five_hour?: RateWindow;
    seven_day?: RateWindow;
    sonnet_seven_day?: RateWindow;
  };
  codex?: {
    plan?: string | null;
    updated_at?: number | null;
    five_hour?: RateWindow;
    seven_day?: RateWindow;
  };
  agy?: {
    model: string;
    plan: string | null;
    context: { used_pct: number | null; input_tokens: number; output_tokens: number };
  };
}

// Compact countdown to a reset timestamp (epoch seconds): "2h05m", "3d4h", "now".
function formatReset(epochSec?: number | null): string | null {
  if (epochSec == null) return null;
  const diff = epochSec - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'now';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function RateBar({ label, win, fillClass }: { label: string; win?: RateWindow; fillClass: string }) {
  if (!win || win.used_pct == null) return null;
  const reset = formatReset(win.resets_at);
  return (
    <div className="db-rate-bar">
      <span className="db-rate-bar-label">{label}</span>
      <div className="db-rate-bar-track">
        <div className={`db-rate-bar-fill ${fillClass}`} style={{ width: `${Math.min(100, win.used_pct)}%` }} />
      </div>
      <span className="db-rate-bar-pct">{win.used_pct < 1 ? '<1' : Math.round(win.used_pct)}%</span>
      {reset && <span className="db-rate-bar-reset" title="Próximo reset">↺ {reset}</span>}
    </div>
  );
}

export default function DashboardView({
  mainView, projects, sessions, activeProjectId, projectMemory, jocaLogicInfo,
  onUpdateProjectMemory, onCreateProject, onEditProject, onShowProject, onOpenProject,
  onSwitchSession, onNewSession, setRightPanel, onPreviewFile,
  onRenameProject, onUpdateProject, onRenameSession, onCreateProjectSkill, rateLimits
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
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [activeProjectId, projects]
  );

  const activeProjectSessions = useMemo(
    () => activeProject ? sessions.filter((s) => s.projectId === activeProject.id) : [],
    [activeProject, sessions]
  );

  const workingSessions = sessions.filter((s) => s.status === 'working');
  const ungroupedSessions = sessions.filter((s) => !s.projectId);

  const [gitInfo, setGitInfo] = useState<{
    isRepository: boolean;
    remoteUrl?: string;
    branch?: string;
    statusSummary?: string;
    lastCommit?: string;
  } | null>(null);
  const [projectToolkit, setProjectToolkit] = useState<{
    skills: { name: string; category: string; insert: string; path: string; description?: string }[];
    agents: { name: string; category: string; insert: string; path: string; description?: string }[];
    commands: { name: string; category: string; insert: string; path: string; description?: string }[];
  } | null>(null);
  const [githubRepoDraft, setGithubRepoDraft] = useState('');
  const [editingGithub, setEditingGithub] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState<'skills' | 'agents'>('skills');
  const [creationError, setCreationError] = useState('');

  const loadProjectGitAndToolkit = useCallback(async (projectId: string) => {
    fetch(`/projects/${projectId}/git`)
      .then((r) => r.json())
      .then(setGitInfo)
      .catch(() => setGitInfo(null));

    fetch(`/projects/${projectId}/toolkit`)
      .then((r) => r.json())
      .then(setProjectToolkit)
      .catch(() => setProjectToolkit(null));
  }, []);

  useEffect(() => {
    if (activeProject && mainView === 'project') {
      loadProjectGitAndToolkit(activeProject.id);
      setGithubRepoDraft(activeProject.githubRepo || '');
      setEditingGithub(false);
      setNewToolName('');
      setCreationError('');
    }
  }, [activeProject, mainView, loadProjectGitAndToolkit]);

  const parseGithubRepo = (url?: string): string => {
    if (!url) return '';
    let clean = url.trim().replace(/\.git$/, '');
    const match = clean.match(/(?:github\.com[:/])([^/]+\/[^/]+)$/);
    return match ? match[1] : '';
  };

  if (mainView === 'project') {
    return (
      <div className="dashboard-view">
        <div className="vp-header">
          <div>
            {activeProject && editingProjectId === activeProject.id ? (
              <input
                ref={editProjectInputRef}
                className="card-name-input"
                style={{ fontSize: '24px', fontWeight: 800, height: '36px', padding: '0 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '6px', fontFamily: 'inherit' }}
                value={editingProjectName}
                onChange={(e) => setEditingProjectName(e.target.value)}
                onBlur={() => {
                  const t = editingProjectName.trim();
                  if (t && t !== activeProject.name && onRenameProject) onRenameProject(activeProject.id, t);
                  setEditingProjectId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const t = editingProjectName.trim();
                    if (t && t !== activeProject.name && onRenameProject) onRenameProject(activeProject.id, t);
                    setEditingProjectId(null);
                  }
                  if (e.key === 'Escape') setEditingProjectId(null);
                  e.stopPropagation();
                }}
              />
            ) : (
              <h1
                className="vp-title"
                onDoubleClick={(e) => {
                  if (activeProject) {
                    e.stopPropagation();
                    setEditingProjectId(activeProject.id);
                    setEditingProjectName(activeProject.name);
                    setTimeout(() => editProjectInputRef.current?.focus(), 50);
                  }
                }}
                title={activeProject ? `${activeProject.name} — double-click to rename` : ''}
                style={{ cursor: activeProject ? 'pointer' : 'default' }}
              >
                {activeProject?.name ?? 'Project'}_
              </h1>
            )}
            <p className="vp-desc">{activeProject ? shortPath(activeProject.path) : 'Project dashboard'} · sessões e ficheiros deste workspace.</p>
          </div>
          <div className="header-actions">
            {activeProject && (
              <button className="f-btn f-btn--secondary" type="button" onClick={() => onEditProject(activeProject)}>
                <EditIcon /> Edit Project
              </button>
            )}
            {activeProject && (
              <button className="f-btn" type="button" onClick={() => onOpenProject(activeProject)}>
                <PlusIcon /> {activeProject.initialized ? 'New Session' : 'Init Project'}
              </button>
            )}
          </div>
        </div>

        <div className="db-stats-grid">
          <div className="db-stat-card">
            <div className="db-stat-icon"><TerminalIcon /></div>
            <div>
              <div className="db-stat-value">{activeProjectSessions.length}</div>
              <div className="db-stat-label">Sessions</div>
            </div>
          </div>
          <div className="db-stat-card">
            <div className="db-stat-icon"><TerminalIcon /></div>
            <div>
              <div className="db-stat-value">{activeProjectSessions.filter((s) => s.status === 'working').length}</div>
              <div className="db-stat-label">Working</div>
            </div>
          </div>
          <div className="db-stat-card">
            <div className="db-stat-icon"><FolderIcon /></div>
            <div>
              <div className="db-stat-value">Memory</div>
              <div className="db-stat-label">Active</div>
            </div>
          </div>
        </div>

        <div className="project-dashboard-layout">
          <div className="project-dashboard-main">
            <div className="project-dashboard-block">
              <div className="section-title">Project Sessions</div>
              <div className="db-project-sessions-list">
                {activeProjectSessions.length === 0 ? (
                  <button className="db-project-session-item db-project-session-empty" type="button" onClick={() => activeProject && onOpenProject(activeProject)}>
                    Start first session
                  </button>
                ) : (
                  activeProjectSessions.map((session) => (
                    <div
                      key={session.id}
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
                          {session.name}
                        </span>
                      )}
                      <span className={`db-project-session-status db-project-session-status--${session.status}`}>{session.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Project Exclusive Toolkit */}
            <div className="project-dashboard-block">
              <div className="section-title">Project Exclusive Toolkit</div>
              <div className="project-toolkit-section">
                <div className="project-toolkit-cols">
                  {/* Skills Column */}
                  <div className="project-toolkit-col">
                    <div className="project-toolkit-col-header">
                      <span>Skills Exclusivas</span>
                      <span className="count-badge">{projectToolkit?.skills.length || 0}</span>
                    </div>
                    <div className="project-toolkit-list">
                      {projectToolkit?.skills.map((skill) => (
                        <div key={skill.path} className="project-toolkit-item">
                          <span className="toolkit-item-icon" style={{ color: 'var(--project-color, var(--accent))' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4 4 4M4 14l4-4 4 4" /></svg>
                          </span>
                          <div className="toolkit-item-details">
                            <div className="toolkit-item-name">{skill.name}</div>
                            {skill.description && <div className="toolkit-item-desc">{skill.description}</div>}
                          </div>
                        </div>
                      ))}
                      {(projectToolkit?.skills.length || 0) === 0 && (
                        <div className="memory-empty-text">Nenhuma skill exclusiva.</div>
                      )}
                    </div>
                  </div>

                  {/* Agents Column */}
                  <div className="project-toolkit-col">
                    <div className="project-toolkit-col-header">
                      <span>Agentes Exclusivos</span>
                      <span className="count-badge">{projectToolkit?.agents.length || 0}</span>
                    </div>
                    <div className="project-toolkit-list">
                      {projectToolkit?.agents.map((agent) => (
                        <div key={agent.path} className="project-toolkit-item">
                          <span className="toolkit-item-icon" style={{ color: 'var(--project-color, var(--accent))' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 14a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8z" /></svg>
                          </span>
                          <div className="toolkit-item-details">
                            <div className="toolkit-item-name">{agent.name}</div>
                            {agent.description && <div className="toolkit-item-desc">{agent.description}</div>}
                          </div>
                        </div>
                      ))}
                      {(projectToolkit?.agents.length || 0) === 0 && (
                        <div className="memory-empty-text">Nenhum agente exclusivo.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add Tool Form */}
                <div className="add-toolkit-form">
                  <div className="add-toolkit-title">Criar Nova Ferramenta Exclusiva</div>
                  <div className="memory-input-row">
                    <select
                      value={newToolType}
                      onChange={(e) => setNewToolType(e.target.value as 'skills' | 'agents')}
                      className="project-toolkit-select"
                    >
                      <option value="skills">Skill</option>
                      <option value="agents">Agente</option>
                    </select>
                    <input
                      type="text"
                      value={newToolName}
                      onChange={(e) => setNewToolName(e.target.value)}
                      placeholder={newToolType === 'skills' ? 'ex: php-refactor' : 'ex: reviewer-git'}
                      className="project-toolkit-input"
                    />
                    <button
                      className="f-btn f-btn--sm"
                      type="button"
                      onClick={async () => {
                        const name = newToolName.trim();
                        if (!name) return;
                        setCreationError('');
                        if (newToolType === 'skills') {
                          if (onCreateProjectSkill && activeProject) {
                            onCreateProjectSkill(activeProject, name);
                            setNewToolName('');
                          } else {
                            setCreationError('Erro: callback para criar skill não fornecido.');
                          }
                          return;
                        }
                        try {
                          const res = await fetch(`/projects/${activeProject!.id}/toolkit`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: newToolType, name }),
                          });
                          if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.error || 'Erro desconhecido');
                          }
                          const data = await res.json();
                          setProjectToolkit(data.items);
                          setNewToolName('');
                        } catch (e) {
                          setCreationError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Criar
                    </button>
                  </div>
                  {creationError && <div className="toolkit-creation-error">{creationError}</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="project-dashboard-sidebar">
            {/* GitHub Connection */}
            <div className="project-dashboard-block">
              <div className="section-title">GitHub Connection</div>
              <div className="github-connection-section">
                {editingGithub ? (
                  <div className="github-edit-row">
                    <input
                      type="text"
                      className="github-input"
                      value={githubRepoDraft}
                      onChange={(e) => setGithubRepoDraft(e.target.value)}
                      placeholder="username/repo"
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="f-btn f-btn--sm"
                        type="button"
                        onClick={async () => {
                          if (activeProject && onUpdateProject) {
                            await onUpdateProject(activeProject.id, { githubRepo: githubRepoDraft.trim() || undefined });
                            setEditingGithub(false);
                          }
                        }}
                      >
                        Save
                      </button>
                      <button className="f-btn f-btn--sm f-btn--secondary" type="button" onClick={() => setEditingGithub(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {activeProject?.githubRepo ? (
                      <div className="github-repo-link-wrap">
                        <a
                          href={`https://github.com/${activeProject.githubRepo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="github-link"
                        >
                          <GithubIcon />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeProject.githubRepo}
                          </span>
                        </a>
                        <button className="db-project-card-btn db-project-card-btn--ghost" style={{ padding: '2px 8px', height: '22px', fontSize: '11px', marginTop: '6px' }} onClick={() => setEditingGithub(true)}>Edit Link</button>
                      </div>
                    ) : (
                      <div className="github-no-link">
                        <p className="memory-empty-text">Sem repositório GitHub associado.</p>
                        {gitInfo?.isRepository && gitInfo.remoteUrl && parseGithubRepo(gitInfo.remoteUrl) && (
                          <button
                            className="db-project-card-btn"
                            style={{ margin: '8px 0', fontSize: '11px', padding: '6px 10px', width: '100%' }}
                            onClick={async () => {
                              const autoRepo = parseGithubRepo(gitInfo.remoteUrl);
                              if (autoRepo && activeProject && onUpdateProject) {
                                await onUpdateProject(activeProject.id, { githubRepo: autoRepo });
                              }
                            }}
                          >
                            Connect: {parseGithubRepo(gitInfo.remoteUrl)}
                          </button>
                        )}
                        <button className="db-project-card-btn db-project-card-btn--ghost" style={{ fontSize: '11px', padding: '4px 8px', width: '100%', marginTop: '4px' }} onClick={() => setEditingGithub(true)}>Add GitHub Link</button>
                      </div>
                    )}
                  </div>
                )}

                {gitInfo?.isRepository && (
                  <div className="git-local-info">
                    <div className="git-local-title">Local Git Status</div>
                    <dl className="settings-cli-meta" style={{ margin: 0, fontSize: '11px' }}>
                      <dt style={{ color: 'var(--text-muted)' }}>Branch</dt>
                      <dd style={{ color: 'var(--text-bright)' }}>{gitInfo.branch || '...'}</dd>
                      <dt style={{ color: 'var(--text-muted)' }}>Commit</dt>
                      <dd style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={gitInfo.lastCommit}>{gitInfo.lastCommit || '...'}</dd>
                      <dt style={{ color: 'var(--text-muted)' }}>Status</dt>
                      <dd style={{ color: gitInfo.statusSummary ? 'var(--yellow)' : 'var(--green)' }}>
                        {gitInfo.statusSummary ? `${gitInfo.statusSummary.split('\n').length} files modified` : 'Clean'}
                      </dd>
                    </dl>
                  </div>
                )}
              </div>
            </div>

            {/* Project Folder */}
            <div className="project-dashboard-block">
              <div className="section-title">Project Folder</div>
              {activeProject ? (
                <div className="project-folder-browser">
                  <FileBrowser
                    embedded
                    initialPath={activeProject.path}
                    onPreview={onPreviewFile}
                    onPastePath={() => {}}
                    selectedPath={null}
                  />
                </div>
              ) : (
                <p className="memory-empty-text">Sem pasta associada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

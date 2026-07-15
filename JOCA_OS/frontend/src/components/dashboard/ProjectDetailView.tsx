import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { Project, SessionInfo } from '../../types';
import { shortPath } from '../../lib/paths';
import FileBrowser from '../FileBrowser';
import { EditIcon, PlusIcon, TerminalIcon, FolderIcon, GithubIcon } from './icons';

interface Props {
  project: Project | null;
  sessions: SessionInfo[];
  onEditProject: (project: Project) => void;
  onOpenProject: (project: Project) => void;
  onSwitchSession: (id: string) => void;
  onPreviewFile: (path: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onUpdateProject?: (id: string, patch: Partial<Project>) => Promise<void>;
  onRenameSession?: (id: string, name: string) => void;
  onCreateProjectSkill?: (project: Project, skillName: string) => void;
}

// The per-project dashboard (mainView === 'project'): header + stats + sessions + exclusive toolkit
// + GitHub connection + folder browser. All git/toolkit/github state is owned here since it is
// exclusive to this view.
export default function ProjectDetailView({
  project, sessions, onEditProject, onOpenProject, onSwitchSession, onPreviewFile,
  onRenameProject, onUpdateProject, onRenameSession, onCreateProjectSkill,
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

  const activeProjectSessions = useMemo(
    () => project ? sessions.filter((s) => s.projectId === project.id) : [],
    [project, sessions]
  );

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
    if (project) {
      loadProjectGitAndToolkit(project.id);
      setGithubRepoDraft(project.githubRepo || '');
      setEditingGithub(false);
      setNewToolName('');
      setCreationError('');
    }
  }, [project, loadProjectGitAndToolkit]);

  const parseGithubRepo = (url?: string): string => {
    if (!url) return '';
    const clean = url.trim().replace(/\.git$/, '');
    const match = clean.match(/(?:github\.com[:/])([^/]+\/[^/]+)$/);
    return match ? match[1] : '';
  };

  return (
    <div className="dashboard-view">
      <div className="vp-header">
        <div>
          {project && editingProjectId === project.id ? (
            <input
              ref={editProjectInputRef}
              className="card-name-input"
              style={{ fontSize: '24px', fontWeight: 800, height: '36px', padding: '0 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '6px', fontFamily: 'inherit' }}
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
            />
          ) : (
            <h1
              className="vp-title"
              onDoubleClick={(e) => {
                if (project) {
                  e.stopPropagation();
                  setEditingProjectId(project.id);
                  setEditingProjectName(project.name);
                  setTimeout(() => editProjectInputRef.current?.focus(), 50);
                }
              }}
              title={project ? `${project.name} — double-click to rename` : ''}
              style={{ cursor: project ? 'pointer' : 'default' }}
            >
              {project?.name ?? 'Project'}_
            </h1>
          )}
          <p className="vp-desc">{project ? shortPath(project.path) : 'Project dashboard'} · sessões e ficheiros deste workspace.</p>
        </div>
        <div className="header-actions">
          {project && (
            <button className="f-btn f-btn--secondary" type="button" onClick={() => onEditProject(project)}>
              <EditIcon /> Edit Project
            </button>
          )}
          {project && (
            <button className="f-btn" type="button" onClick={() => onOpenProject(project)}>
              <PlusIcon /> {project.initialized ? 'New Session' : 'Init Project'}
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
                <button className="db-project-session-item db-project-session-empty" type="button" onClick={() => project && onOpenProject(project)}>
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
                        if (onCreateProjectSkill && project) {
                          onCreateProjectSkill(project, name);
                          setNewToolName('');
                        } else {
                          setCreationError('Erro: callback para criar skill não fornecido.');
                        }
                        return;
                      }
                      try {
                        const res = await fetch(`/projects/${project!.id}/toolkit`, {
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
                        if (project && onUpdateProject) {
                          await onUpdateProject(project.id, { githubRepo: githubRepoDraft.trim() || undefined });
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
                  {project?.githubRepo ? (
                    <div className="github-repo-link-wrap">
                      <a
                        href={`https://github.com/${project.githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="github-link"
                      >
                        <GithubIcon />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.githubRepo}
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
                            if (autoRepo && project && onUpdateProject) {
                              await onUpdateProject(project.id, { githubRepo: autoRepo });
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
            {project ? (
              <div className="project-folder-browser">
                <FileBrowser
                  embedded
                  initialPath={project.path}
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

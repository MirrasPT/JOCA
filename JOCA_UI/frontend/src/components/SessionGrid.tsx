import { useState } from 'react';
import SessionCard from './SessionCard';
import type { SessionInfo, Project } from '../App';

interface Props {
  sessions: SessionInfo[];
  projects: Project[];
  activeId: string | null;
  outputPreviews: Map<string, string>;
  view: 'sessions' | 'projects';
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNew: () => void;
  onOpenProject: (p: Project) => void;
  onProjectsChange: () => void;
}

function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

function ProjectsView({ projects, sessions, onOpenProject, onProjectsChange }: {
  projects: Project[];
  sessions: SessionInfo[];
  onOpenProject: (p: Project) => void;
  onProjectsChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const addProject = async (p: string) => {
    const trimmed = p.trim().replace(/^"|"$/g, '');
    if (!trimmed) return;
    await fetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trimmed }),
    });
    onProjectsChange();
    setAdding(false);
    setDraft('');
  };

  const removeProject = async (id: string) => {
    await fetch(`/projects/${id}`, { method: 'DELETE' });
    onProjectsChange();
  };

  return (
    <>
      <div className="session-grid-header">
        <span className="grid-title">Projects</span>
        <div className="grid-header-actions">
          <button className="btn-add-project" onClick={() => setAdding((a) => !a)}>
            {adding ? '× Cancel' : '+ Add Project'}
          </button>
        </div>
      </div>

      {adding && (
        <div className="project-add-input-row">
          <input
            autoFocus
            className="project-add-input"
            placeholder="/path/to/project"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addProject(draft);
              if (e.key === 'Escape') { setAdding(false); setDraft(''); }
            }}
          />
        </div>
      )}

      <div
        className="projects-grid"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const text = e.dataTransfer.getData('text/plain');
          if (text) addProject(text);
        }}
      >
        {dragOver && <div className="project-drop-hint">Drop folder to add project</div>}
        {projects.length === 0 && !dragOver && (
          <div className="empty-state">
            <div className="empty-icon">◈</div>
            <p>No projects yet</p>
            <button className="btn-new-large" onClick={() => setAdding(true)}>+ Add Project</button>
          </div>
        )}
        {projects.map((p) => {
          const sessionCount = sessions.filter((s) => s.projectId === p.id).length;
          const isNew = !p.initialized;
          return (
            <div key={p.id} className="project-card" onClick={() => onOpenProject(p)}>
              <div className="project-card-header">
                <span className={`project-card-dot ${isNew ? 'project-dot-new' : 'project-dot-ok'}`} />
                <span className="project-card-name">{p.name}</span>
              </div>
              <div className="project-card-path">{shortPath(p.path)}</div>
              {sessionCount > 0 && (
                <div className="project-card-sessions">{sessionCount} session{sessionCount > 1 ? 's' : ''} open</div>
              )}
              <div className="project-card-actions">
                <button className="btn-project-open" onClick={(e) => { e.stopPropagation(); onOpenProject(p); }}>
                  {isNew ? '✦ Init' : '▶ Open'}
                </button>
                <button className="btn-project-remove" onClick={(e) => { e.stopPropagation(); removeProject(p.id); }} aria-label="Remove project">×</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function SessionGrid({
  sessions, projects, activeId, outputPreviews, view,
  onSelect, onClose, onRename, onNew, onOpenProject, onProjectsChange,
}: Props) {
  return (
    <div className="session-grid-area">
      {view === 'sessions' ? (
        <>
          <div className="session-grid-header">
            <span className="grid-title">Sessions</span>
            <div className="grid-header-actions">
              <button className="btn-new-session" onClick={onNew}>+ New</button>
            </div>
          </div>
          <div className="session-grid">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⊟</div>
                <p>No active sessions</p>
                <button className="btn-new-large" onClick={onNew}>+ New Session</button>
              </div>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeId}
                  projectName={projects.find((p) => p.id === s.projectId)?.name}
                  outputPreview={outputPreviews.get(s.id) ?? ''}
                  onSelect={() => onSelect(s.id)}
                  onClose={() => onClose(s.id)}
                  onRename={(name) => onRename(s.id, name)}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <ProjectsView
          projects={projects}
          sessions={sessions}
          onOpenProject={onOpenProject}
          onProjectsChange={onProjectsChange}
        />
      )}
    </div>
  );
}

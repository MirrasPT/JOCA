import { useState } from 'react';
import SessionCard from './SessionCard';
import type { SessionInfo, Project } from '../types';
import { shortPath } from '../lib/paths';

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

// ── Lucide SVG Icons ───────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }} aria-hidden>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }} aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }} aria-hidden>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }} aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
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
            {adding ? (
              <>
                <XIcon /> Cancel
              </>
            ) : (
              <>
                <PlusIcon /> Add Project
              </>
            )}
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
            <div className="empty-icon"><FolderPlusIcon /></div>
            <p>No projects yet</p>
            <button className="btn-new-large" onClick={() => setAdding(true)}>
              <PlusIcon /> Add Project
            </button>
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
                  {isNew ? (
                    <>
                      <SparklesIcon /> Init
                    </>
                  ) : (
                    <>
                      <PlayIcon /> Open
                    </>
                  )}
                </button>
                <button className="btn-project-remove" onClick={(e) => { e.stopPropagation(); removeProject(p.id); }} aria-label="Remove project">
                  <XIcon />
                </button>
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
              <button className="btn-new-session" onClick={onNew}>
                <PlusIcon /> New
              </button>
            </div>
          </div>
          <div className="session-grid">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><InboxIcon /></div>
                <p>No active sessions</p>
                <button className="btn-new-large" onClick={onNew}>
                  <PlusIcon /> New Session
                </button>
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

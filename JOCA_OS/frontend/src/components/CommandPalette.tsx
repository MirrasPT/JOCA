import type { JocaItems, Project, SessionInfo } from '../types';

interface CommandPaletteProps {
  sessions: SessionInfo[];
  projects: Project[];
  jocaItems: JocaItems | null;
  onClose: () => void;
  onShowDashboard: () => void;
  onOpenFiles: () => void;
  onOpenToolkit: () => void;
  onOpenSettings: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onShowProject: (id: string) => void;
  onCreateProject: () => void;
  onInsert: (text: string) => void;
}

// ⌘K command palette: jump to workspace panels, sessions, projects, and insert toolkit items.
// Pure presentational — all behaviour comes in via props (the parent owns open/close + the actions).
export default function CommandPalette({
  sessions, projects, jocaItems, onClose,
  onShowDashboard, onOpenFiles, onOpenToolkit, onOpenSettings,
  onSelectSession, onNewSession, onShowProject, onCreateProject, onInsert,
}: CommandPaletteProps) {
  return (
    <div className="create-skill-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="command-palette-modal" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        <div className="create-skill-header">
          <span className="create-skill-title" id="command-palette-title">Commands, Skills, Agents</span>
          <button className="create-skill-close" onClick={onClose} aria-label="Close command palette">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="command-palette-grid">
          <div>
            <h3>Workspace</h3>
            <button onClick={onShowDashboard}>Dashboard</button>
            <button onClick={onOpenFiles}>Open Files</button>
            <button onClick={onOpenToolkit}>Open Toolkit</button>
            <button onClick={onOpenSettings}>Open Settings</button>
          </div>
          <div>
            <h3>Sessions</h3>
            {sessions.map((session) => <button key={session.id} onClick={() => onSelectSession(session.id)}>{session.name}</button>)}
            {sessions.length === 0 && <button onClick={onNewSession}>New Session</button>}
          </div>
          <div>
            <h3>Projects</h3>
            {projects.map((project) => <button key={project.id} onClick={() => onShowProject(project.id)}>{project.name}</button>)}
            {projects.length === 0 && <button onClick={onCreateProject}>Create Project</button>}
          </div>
          <div>
            <h3>Commands</h3>
            {(jocaItems?.commands ?? []).map((item) => <button key={item.name} onClick={() => onInsert(item.insert)}>{item.name}</button>)}
          </div>
          <div>
            <h3>Skills</h3>
            {(jocaItems?.skills ?? []).map((item) => <button key={`${item.category}-${item.name}`} onClick={() => onInsert(item.insert)}>{item.name}</button>)}
          </div>
          <div>
            <h3>Agents</h3>
            {(jocaItems?.agents ?? []).map((item) => <button key={item.name} onClick={() => onInsert(item.insert)}>{item.name}</button>)}
          </div>
        </div>
        {!jocaItems && <p className="create-skill-hint">A carregar registry JOCA...</p>}
      </div>
    </div>
  );
}

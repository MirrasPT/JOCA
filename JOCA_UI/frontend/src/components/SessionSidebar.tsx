import { useState, useRef, useEffect, useCallback } from 'react';
import StatusDot from './StatusDot';
import type { SessionInfo, Project } from '../App';

interface JocaItem {
  name: string;
  insert: string;
  category?: string;
}

interface JocaItems {
  commands: JocaItem[];
  agents: JocaItem[];
  skills: JocaItem[];
}

interface Props {
  sessions: SessionInfo[];
  projects: Project[];
  activeId: string | null;
  unreadIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNew: () => void;
  onOpenProject: (p: Project) => void;
  onProjectsChange: () => void;
  onInput: (sessionId: string, data: string) => void;
}

// ── Session item ───────────────────────────────────────────────────

function SessionItem({
  session, isActive, indented, isUnread,
  onSelect, onClose, onRename,
}: {
  session: SessionInfo;
  isActive: boolean;
  indented?: boolean;
  isUnread?: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevStatus = useRef(session.status);
  const [doneFlash, setDoneFlash] = useState(false);

  useEffect(() => {
    if (prevStatus.current === 'working' && session.status === 'idle') {
      setDoneFlash(true);
      const t = setTimeout(() => setDoneFlash(false), 700);
      return () => clearTimeout(t);
    }
    prevStatus.current = session.status;
  }, [session.status]);

  useEffect(() => {
    if (editing) {
      setDraft(session.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, session.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== session.name) onRename(t);
    setEditing(false);
  };

  return (
    <div
      className={[
        'session-item',
        isActive ? 'session-item--active' : '',
        `session-item--${session.status}`,
        indented ? 'session-item--indented' : '',
        isUnread ? 'session-item--unread' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => !editing && !confirming && onSelect()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirming(false); }}
      aria-selected={isActive}
    >
      <StatusDot status={doneFlash ? 'done' : session.status} size="sm" />
      {editing ? (
        <input
          ref={inputRef}
          className="session-item-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(session.name); setEditing(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span
            className="session-item-name"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={`${session.name} — double-click to rename`}
          >
            {session.name}
          </span>
          {isUnread && !hovered && <span className="session-item-unread-dot" title="New response — send a message to clear" />}
        </>
      )}
      {hovered && !editing && !confirming && (
        <button
          className="session-item-close"
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
          aria-label="Close session"
        >×</button>
      )}
      {confirming && (
        <div className="session-item-confirm" onClick={(e) => e.stopPropagation()}>
          <span className="session-item-confirm-label">Close?</span>
          <button className="confirm-yes" onClick={(e) => { e.stopPropagation(); onClose(); }}>✓</button>
          <button className="confirm-no" onClick={(e) => { e.stopPropagation(); setConfirming(false); }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Project group ──────────────────────────────────────────────────

function ProjectGroup({
  project, sessions, activeId, unreadIds, onSelect, onClose, onRename, onOpen, onRemove,
}: {
  project: Project;
  sessions: SessionInfo[];
  activeId: string | null;
  unreadIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const workingCount = sessions.filter(s => s.status === 'working').length;

  return (
    <div className="project-group">
      <div className="project-group-header" onClick={() => { if (!confirmRemove) setCollapsed(c => !c); }}>
        <span className="project-group-arrow">{collapsed ? '▸' : '▾'}</span>
        <span className="project-group-name" title={project.path}>{project.name}</span>
        {workingCount > 0 && <span className="project-group-badge">{workingCount}</span>}
        {confirmRemove ? (
          <div className="project-confirm" onClick={(e) => e.stopPropagation()}>
            <span className="session-item-confirm-label">Remove?</span>
            <button className="confirm-yes" onClick={(e) => { e.stopPropagation(); onRemove(); }}>✓</button>
            <button className="confirm-no" onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}>✕</button>
          </div>
        ) : (
          <div className="project-group-actions">
            <button className="project-group-action" onClick={(e) => { e.stopPropagation(); onOpen(); }} title="New session in project">+</button>
            <button className="project-group-action project-group-action--remove" onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }} title="Remove project">×</button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="project-group-sessions">
          {sessions.length === 0 ? (
            <div className="project-no-sessions">
              <button className="btn-project-open-sm" onClick={onOpen}>
                {project.initialized ? '▶ Open' : '✦ Init'}
              </button>
            </div>
          ) : (
            sessions.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeId}
                isUnread={unreadIds.has(s.id)}
                indented
                onSelect={() => onSelect(s.id)}
                onClose={() => onClose(s.id)}
                onRename={(name) => onRename(s.id, name)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── JOCA panel ─────────────────────────────────────────────────────

function JocaPanel({ activeId, onInput }: { activeId: string | null; onInput: (id: string, data: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<JocaItems | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ commands: true, skills: false, agents: false });

  const load = useCallback(() => {
    fetch('/joca-items')
      .then(r => r.json())
      .then(setItems)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open && !items) load();
  }, [open, items, load]);

  const insert = (text: string) => {
    if (!activeId) return;
    onInput(activeId, text);
  };

  const toggle = (key: string) =>
    setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const groupedSkills = items?.skills.reduce<Record<string, JocaItem[]>>((acc, s) => {
    const cat = s.category || 'general';
    (acc[cat] = acc[cat] || []).push(s);
    return acc;
  }, {}) ?? {};

  return (
    <div className="joca-panel">
      <div className="joca-panel-header" onClick={() => setOpen(o => !o)}>
        <span className="joca-panel-arrow">{open ? '▾' : '▸'}</span>
        <span className="joca-panel-title">JOCA Tools</span>
        <button
          className="joca-panel-refresh"
          onClick={(e) => { e.stopPropagation(); load(); }}
          title="Refresh"
        >↺</button>
      </div>

      {open && (
        <div className="joca-panel-body">
          {!activeId && (
            <div className="joca-no-session">No active session — start one to insert commands</div>
          )}
          {/* Commands */}
          <div className="joca-section">
            <div className="joca-section-header" onClick={() => toggle('commands')}>
              <span className="joca-section-arrow">{openSections.commands ? '▾' : '▸'}</span>
              <span>Commands</span>
              {items && <span className="joca-section-count">{items.commands.length}</span>}
            </div>
            {openSections.commands && (
              <div className="joca-items-list">
                {items?.commands.map(c => (
                  <button
                    key={c.name}
                    className={`joca-item joca-item--command${!activeId ? ' joca-item--disabled' : ''}`}
                    onClick={() => insert(c.insert)}
                    title={activeId ? `Insert "${c.insert}" into terminal` : 'No active session'}
                  >
                    <span className="joca-item-icon">⌘</span>
                    <span className="joca-item-name">{c.name}</span>
                  </button>
                ))}
                {items?.commands.length === 0 && <span className="joca-empty">No commands found</span>}
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="joca-section">
            <div className="joca-section-header" onClick={() => toggle('skills')}>
              <span className="joca-section-arrow">{openSections.skills ? '▾' : '▸'}</span>
              <span>Skills</span>
              {items && <span className="joca-section-count">{items.skills.length}</span>}
            </div>
            {openSections.skills && (
              <div className="joca-items-list">
                {Object.entries(groupedSkills).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catSkills]) => (
                  <div key={cat} className="joca-skill-category">
                    <span className="joca-skill-cat-label">{cat}</span>
                    {catSkills.map(s => (
                      <button
                        key={s.name}
                        className={`joca-item joca-item--skill${!activeId ? ' joca-item--disabled' : ''}`}
                        onClick={() => insert(s.insert)}
                        title={activeId ? `Insert "${s.insert}" into terminal` : 'No active session'}
                      >
                        <span className="joca-item-icon">◆</span>
                        <span className="joca-item-name">{s.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {items?.skills.length === 0 && <span className="joca-empty">No skills found</span>}
              </div>
            )}
          </div>

          {/* Agents */}
          <div className="joca-section">
            <div className="joca-section-header" onClick={() => toggle('agents')}>
              <span className="joca-section-arrow">{openSections.agents ? '▾' : '▸'}</span>
              <span>Agents</span>
              {items && <span className="joca-section-count">{items.agents.length}</span>}
            </div>
            {openSections.agents && (
              <div className="joca-items-list">
                {items?.agents.map(a => (
                  <button
                    key={a.name}
                    className={`joca-item joca-item--agent${!activeId ? ' joca-item--disabled' : ''}`}
                    onClick={() => insert(a.insert)}
                    title={activeId ? `Insert "${a.insert}" into terminal` : 'No active session'}
                  >
                    <span className="joca-item-icon">◈</span>
                    <span className="joca-item-name">{a.name}</span>
                  </button>
                ))}
                {items?.agents.length === 0 && <span className="joca-empty">No agents found</span>}
              </div>
            )}
          </div>

          {!items && <div className="joca-loading">Loading…</div>}
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ───────────────────────────────────────────────────

export default function SessionSidebar({
  sessions, projects, activeId, unreadIds,
  onSelect, onClose, onRename, onNew, onOpenProject, onProjectsChange, onInput,
}: Props) {
  const [addingProject, setAddingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState('');

  const ungrouped = sessions.filter(s => !s.projectId);

  const addProject = async (p: string) => {
    const trimmed = p.trim().replace(/^"|"$/g, '');
    if (!trimmed) return;
    const res = await fetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trimmed }),
    });
    if (!res.ok) {
      const { error } = await res.json() as { error: string };
      alert(error);
      return;
    }
    onProjectsChange();
    setAddingProject(false);
    setProjectDraft('');
  };

  const removeProject = async (id: string) => {
    sessions.filter(s => s.projectId === id).forEach(s => onClose(s.id));
    await fetch(`/projects/${id}`, { method: 'DELETE' });
    onProjectsChange();
  };

  return (
    <aside className="session-sidebar" aria-label="Sessions">
      <div className="session-sidebar-header">
        <span className="sidebar-title">Sessions</span>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-btn-add-project"
            onClick={() => setAddingProject(a => !a)}
            title="Add project"
            aria-label="Add project"
          >◈</button>
          <button
            className="sidebar-btn-new"
            onClick={onNew}
            title="New session"
            aria-label="New session"
          >+</button>
        </div>
      </div>

      {addingProject && (
        <div className="sidebar-add-project-row">
          <input
            autoFocus
            className="sidebar-add-project-input"
            placeholder="/path/to/project"
            value={projectDraft}
            onChange={(e) => setProjectDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addProject(projectDraft);
              if (e.key === 'Escape') { setAddingProject(false); setProjectDraft(''); }
            }}
          />
        </div>
      )}

      <div className="session-sidebar-list">
        {ungrouped.map(s => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={s.id === activeId}
            isUnread={unreadIds.has(s.id)}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)}
            onRename={(name) => onRename(s.id, name)}
          />
        ))}

        {ungrouped.length > 0 && projects.length > 0 && <div className="sidebar-divider" />}

        {projects.map(p => (
          <ProjectGroup
            key={p.id}
            project={p}
            sessions={sessions.filter(s => s.projectId === p.id)}
            activeId={activeId}
            unreadIds={unreadIds}
            onSelect={onSelect}
            onClose={onClose}
            onRename={onRename}
            onOpen={() => onOpenProject(p)}
            onRemove={() => removeProject(p.id)}
          />
        ))}

        {sessions.length === 0 && projects.length === 0 && (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">⊟</div>
            <p>No sessions</p>
            <button className="sidebar-btn-new-large" onClick={onNew}>+ New Session</button>
          </div>
        )}
      </div>

      <JocaPanel activeId={activeId} onInput={onInput} />
    </aside>
  );
}

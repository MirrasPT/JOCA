import { useState, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { SessionInfo, Project } from '../types';



interface Props {
  sessions: SessionInfo[];
  projects: Project[];
  activeId: string | null;
  unreadIds: Set<string>;
  mainView: 'dashboard' | 'project' | 'session' | 'master' | 'automations' | 'tasks';
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onShowDashboard: () => void;
  onShowMaster: () => void;
  onShowAutomations: () => void;
  onShowTasks: () => void;
  onShowProject: (projectId: string) => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNew: () => void;
  onOpenProject: (p: Project) => void;
  onProjectsChange: () => void;
  onCreateProject: () => void;
  onInput: (sessionId: string, data: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onReorderProjects?: (orderedIds: string[]) => void;
}

type LucideName =
  | 'layout-dashboard' | 'plus' | 'folder-plus' | 'message-square'
  | 'terminal' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down'
  | 'sparkles' | 'zap' | 'chevrons-left' | 'search' | 'x'
  | 'check' | 'refresh' | 'command' | 'chevrons-right' | 'chevron-left' | 'info'
  | 'grip' | 'archive' | 'archive-restore' | 'cpu' | 'list-checks';

function LucideIcon({ name }: { name: LucideName }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'layout-dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'folder-plus') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M12 10v6M9 13h6" /></svg>;
  if (name === 'message-square') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>;
  if (name === 'terminal') return <svg {...common}><path d="m5 7 5 5-5 5" /><path d="M12 19h7" /></svg>;
  if (name === 'folder') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>;
  if (name === 'folder-open') return <svg {...common}><path d="M6 17.5A2.5 2.5 0 0 1 3.5 15V6.5A2.5 2.5 0 0 1 6 4h3.5l2 2H18a2 2 0 0 1 2 2v1" /><path d="M4 17.5 6.2 10h15.3l-2.2 7.5A2 2 0 0 1 17.4 19H5.9A2 2 0 0 1 4 17.5Z" /></svg>;
  if (name === 'chevron-down') return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === 'sparkles') return <svg {...common}><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8Z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></svg>;
  if (name === 'zap') return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7Z" /></svg>;
  if (name === 'chevrons-left') return <svg {...common}><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>;
  if (name === 'chevrons-right') return <svg {...common}><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></svg>;
  if (name === 'chevron-left') return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === 'chevron-right') return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (name === 'x') return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'check') return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>;
  if (name === 'command') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></svg>;
  if (name === 'info') return <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
  if (name === 'grip') return <svg {...common}><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg>;
  if (name === 'archive') return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></svg>;
  if (name === 'archive-restore') return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h4" /><path d="M19 8v3" /><path d="m15 18 4-4 4 4" /><path d="M19 22v-8" /></svg>;
  if (name === 'cpu') return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /></svg>;
  if (name === 'list-checks') return <svg {...common}><path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8" /></svg>;
  return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
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
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevStatus = useRef(session.status);
  const [doneFlash, setDoneFlash] = useState(false);
  const iconName: LucideName = session.name.toLowerCase().includes('debug') || session.name.toLowerCase().includes('schema')
    ? 'terminal'
    : 'message-square';

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
      ].filter(Boolean).join(' ')}
      onMouseLeave={() => setConfirming(false)}
    >
      <span className="session-item-icon"><LucideIcon name={iconName} /></span>
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
        <button
          type="button"
          className="session-item-select"
          // Select on press: the active xterm swallows the first click via its
          // document-level focus/selection handlers, so onClick was intermittently
          // lost (needed 2+ clicks). pointerdown fires before that. detail===0
          // keeps keyboard (Enter/Space) working without double-firing.
          onPointerDown={(e) => { if (e.button === 0 && !confirming) onSelect(); }}
          onClick={(e) => { if (e.detail === 0 && !confirming) onSelect(); }}
          onKeyDown={(e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && !confirming) { e.preventDefault(); setConfirming(true); }
          }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          aria-current={isActive ? 'page' : undefined}
          title={`${session.name} — double-click to rename`}
        >
          <span className="session-item-name">{session.name}</span>
        </button>
      )}
      {!editing && !confirming && (
        <button
          className="session-item-close"
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
          aria-label="Close session"
        >
          <LucideIcon name="x" />
        </button>
      )}
      {confirming && (
        <div className="session-item-confirm" onClick={(e) => e.stopPropagation()}>
          <span className="session-item-confirm-label">Close?</span>
          <button className="confirm-yes" type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}><LucideIcon name="check" /></button>
          <button className="confirm-no" type="button" onClick={(e) => { e.stopPropagation(); setConfirming(false); }}><LucideIcon name="x" /></button>
        </div>
      )}
    </div>
  );
}

// ── Project group ──────────────────────────────────────────────────

function ProjectGroup({
  project, sessions, activeId, unreadIds, onSelect, onClose, onRename, onOpen, onDashboard, onRemove, onRenameProject,
  onArchive, isDragOver, dragEnabled, onDragStart, onDragEnter, onDragEnd, onDrop, onMoveUp, onMoveDown,
}: {
  project: Project;
  sessions: SessionInfo[];
  activeId: string | null;
  unreadIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onOpen: () => void;
  onDashboard: () => void;
  onRemove: () => void;
  onRenameProject?: (id: string, name: string) => void;
  onArchive?: () => void;
  isDragOver?: boolean;
  dragEnabled?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const workingCount = sessions.filter(s => s.status === 'working').length;

  useEffect(() => {
    if (editing) {
      setDraft(project.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, project.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditing(false);
  };

  return (
    <div
      className={[
        'project-group',
        isDragOver ? 'project-group--dragover' : '',
        dragging ? 'project-group--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--project-color': project.color || '#ff4500' } as CSSProperties}
      onDragOver={dragEnabled ? (e) => { e.preventDefault(); onDragEnter?.(); } : undefined}
      onDrop={dragEnabled ? (e) => { e.preventDefault(); onDrop?.(); } : undefined}
    >
      <div className="project-group-header">
        {dragEnabled && (
          <span
            className="project-group-grip"
            draggable
            role="button"
            tabIndex={0}
            onDragStart={(e) => { e.stopPropagation(); setDragging(true); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
            onDragEnd={(e) => { e.stopPropagation(); setDragging(false); onDragEnd?.(); }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onMoveUp?.(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onMoveDown?.(); }
            }}
            title="Arrastar ou usar ↑/↓ para reordenar"
            aria-label={`Reordenar ${project.name} — setas para cima/baixo`}
          >
            <LucideIcon name="grip" />
          </span>
        )}
        <button
          className="project-group-arrow-btn"
          type="button"
          onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
          aria-label={collapsed ? 'Expand project' : 'Collapse project'}
        >
          <LucideIcon name={collapsed ? 'chevron-right' : 'chevron-down'} />
        </button>
        {editing ? (
          <>
            <span className="project-group-icon"><LucideIcon name={collapsed ? 'folder' : 'folder-open'} /></span>
            <span
              className="project-group-color"
              style={{ '--project-color': project.color || '#ff4500' } as CSSProperties}
              aria-hidden
            />
            <input
              ref={inputRef}
              className="session-item-name-input"
              style={{ fontSize: '11px', height: '20px', padding: '0 4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-bright)', borderRadius: '4px', width: '120px' }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(project.name); setEditing(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <button
            type="button"
            className="project-group-label"
            onClick={() => { if (!confirmRemove) onDashboard(); }}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={`${project.name} — abrir dashboard (duplo-clique renomeia)`}
          >
            <span className="project-group-icon"><LucideIcon name={collapsed ? 'folder' : 'folder-open'} /></span>
            <span
              className="project-group-color"
              style={{ '--project-color': project.color || '#ff4500' } as CSSProperties}
              aria-hidden
            />
            <span className="project-group-name">{project.name}</span>
          </button>
        )}
        {workingCount > 0 && <span className="project-group-badge">{workingCount}</span>}
        {confirmRemove ? (
          <div className="project-confirm" onClick={(e) => e.stopPropagation()}>
            <span className="session-item-confirm-label">Remove?</span>
            <button className="confirm-yes" type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}><LucideIcon name="check" /></button>
            <button className="confirm-no" type="button" onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}><LucideIcon name="x" /></button>
          </div>
        ) : (
          <div className="project-group-actions">
            <button className="project-group-action" type="button" aria-label={`Nova sessão em ${project.name}`} onClick={(e) => { e.stopPropagation(); onOpen(); }} data-tooltip="Nova sessão no projeto" data-tooltip-position="bottom"><LucideIcon name="plus" /></button>
            {onArchive && <button className="project-group-action" type="button" aria-label={`Arquivar projeto ${project.name}`} onClick={(e) => { e.stopPropagation(); onArchive(); }} data-tooltip="Arquivar projeto" data-tooltip-position="bottom"><LucideIcon name="archive" /></button>}
            <button className="project-group-action project-group-action--remove" type="button" aria-label={`Remover projeto ${project.name}`} onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }} data-tooltip="Remover projeto" data-tooltip-position="bottom"><LucideIcon name="x" /></button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="project-group-sessions">
          {sessions.length === 0 ? (
            <div className="project-no-sessions">
              <button className="btn-project-open-sm" type="button" onClick={onOpen}>
                {project.initialized ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Open
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                    </svg>
                    Init
                  </span>
                )}
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



// ── Main sidebar ───────────────────────────────────────────────────

export default function SessionSidebar({
  sessions, projects, activeId, unreadIds, mainView, collapsed, onToggleCollapsed, onShowDashboard, onShowMaster, onShowAutomations, onShowTasks, onShowProject,
  onSelect, onClose, onRename, onNew, onOpenProject, onProjectsChange, onCreateProject, onInput, onRenameProject,
  onArchiveProject, onReorderProjects,
}: Props) {
  const [confirmCloseIdle, setConfirmCloseIdle] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const idleSessions = sessions.filter(s => s.status === 'idle');

  const filteredUngrouped = sessions.filter(s => !s.projectId);
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const filteredProjects = activeProjects.map(project => ({
    project,
    sessions: sessions.filter(s => s.projectId === project.id),
  }));

  const dragEnabled = !!onReorderProjects && activeProjects.length > 1;

  const commitReorder = (targetId: string) => {
    if (!dragId || dragId === targetId || !onReorderProjects) { setDragId(null); setOverId(null); return; }
    const ids = activeProjects.map(p => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderProjects(ids);
    setDragId(null);
    setOverId(null);
  };

  // Keyboard reorder (↑/↓ on the grip): swap with the adjacent project.
  const moveProject = (id: string, dir: 'up' | 'down') => {
    if (!onReorderProjects) return;
    const ids = activeProjects.map(p => p.id);
    const i = ids.indexOf(id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReorderProjects(ids);
  };

  const closeIdleSessions = () => {
    idleSessions.forEach(s => onClose(s.id));
    setConfirmCloseIdle(false);
  };

  const removeProject = async (id: string) => {
    sessions.filter(s => s.projectId === id).forEach(s => onClose(s.id));
    await fetch(`/projects/${id}`, { method: 'DELETE' });
    onProjectsChange();
  };

  return (
    <aside className={`session-sidebar ${collapsed ? 'session-sidebar--collapsed' : ''}`} aria-label="Sessions">
      <div className="sidebar-main-bento">
        <div className="sb-header">
          <div className="sb-brand">
            <div className="sb-logo-rings" aria-hidden />
            <span className="sb-logo-text">JOCA <span style={{opacity:0.45,fontWeight:500,fontSize:'0.75em',letterSpacing:'0.05em'}}>0.4.0</span></span>
          </div>
          <button
            className="sidebar-collapse-btn"
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
            data-tooltip={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            data-tooltip-position="bottom"
          >
            <span className="sidebar-collapse-glyph">
              <LucideIcon name={collapsed ? 'chevrons-right' : 'chevrons-left'} />
            </span>
          </button>
        </div>

        <div className="nav-menu">
          <button
            className={`nav-btn ${mainView === 'dashboard' ? 'active' : ''}`}
            type="button"
            onClick={onShowDashboard}
          >
            <span className="nav-icon"><LucideIcon name="layout-dashboard" /></span>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'master' ? 'active' : ''}`}
            type="button"
            onClick={onShowMaster}
          >
            <span className="nav-icon"><LucideIcon name="cpu" /></span>
            <span>Master</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'automations' ? 'active' : ''}`}
            type="button"
            onClick={onShowAutomations}
          >
            <span className="nav-icon"><LucideIcon name="zap" /></span>
            <span>Automações</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'tasks' ? 'active' : ''}`}
            type="button"
            onClick={onShowTasks}
          >
            <span className="nav-icon"><LucideIcon name="list-checks" /></span>
            <span>Tarefas</span>
          </button>
        </div>

        <div className="session-sidebar-header">
          <span className="sidebar-title">Sessions</span>
          <div className="sidebar-header-actions">
            <button
              className="sidebar-btn-add-project"
              type="button"
              onClick={onCreateProject}
              data-tooltip="Adicionar projeto"
              data-tooltip-position="bottom"
              aria-label="Add project"
            ><LucideIcon name="folder-plus" /></button>
            <button
              className="sidebar-btn-new"
              type="button"
              onClick={onNew}
              data-tooltip="Nova sessão"
              data-tooltip-position="bottom"
              aria-label="New session"
            ><LucideIcon name="plus" /></button>
          </div>
        </div>

        <div className="session-sidebar-list">
          {filteredUngrouped.map(s => (
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

          {filteredUngrouped.length > 0 && filteredProjects.length > 0 && <div className="sidebar-divider" />}

          {filteredProjects.map(({ project, sessions: projectSessions }) => (
            <ProjectGroup
              key={project.id}
              project={project}
              sessions={projectSessions}
              activeId={activeId}
              unreadIds={unreadIds}
              onSelect={onSelect}
              onClose={onClose}
              onRename={onRename}
              onOpen={() => onOpenProject(project)}
              onDashboard={() => onShowProject(project.id)}
              onRemove={() => removeProject(project.id)}
              onRenameProject={onRenameProject}
              onArchive={onArchiveProject ? () => onArchiveProject(project.id, true) : undefined}
              dragEnabled={dragEnabled}
              isDragOver={overId === project.id && dragId !== project.id}
              onDragStart={() => setDragId(project.id)}
              onDragEnter={() => setOverId(project.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDrop={() => commitReorder(project.id)}
              onMoveUp={() => moveProject(project.id, 'up')}
              onMoveDown={() => moveProject(project.id, 'down')}
            />
          ))}

          {archivedProjects.length > 0 && (
            <div className="sidebar-archived">
              <button
                className="sidebar-archived-toggle"
                type="button"
                onClick={() => setShowArchived(v => !v)}
                aria-expanded={showArchived}
              >
                <span className="sidebar-archived-icon"><LucideIcon name="archive" /></span>
                <span className="sidebar-archived-label">Arquivados</span>
                <span className="sidebar-archived-count">{archivedProjects.length}</span>
                <span className="sidebar-archived-chevron"><LucideIcon name={showArchived ? 'chevron-down' : 'chevron-right'} /></span>
              </button>
              {showArchived && (
                <div className="sidebar-archived-list">
                  {archivedProjects.map(project => (
                    <div key={project.id} className="archived-item" style={{ '--project-color': project.color || '#ff4500' } as CSSProperties}>
                      <span className="archived-item-color" aria-hidden />
                      <button
                        className="archived-item-name"
                        type="button"
                        onClick={() => onShowProject(project.id)}
                        title={`Abrir dashboard de ${project.name}`}
                      >
                        {project.name}
                      </button>
                      {onArchiveProject && (
                        <button
                          className="archived-item-restore"
                          type="button"
                          onClick={() => onArchiveProject(project.id, false)}
                          data-tooltip="Restaurar para a barra"
                          data-tooltip-position="bottom"
                          aria-label={`Restaurar projeto ${project.name}`}
                        >
                          <LucideIcon name="archive-restore" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sessions.length === 0 && projects.length === 0 && (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon"><LucideIcon name="info" /></div>
              <p>No sessions</p>
              <button className="sidebar-btn-new-large" onClick={onNew}>+ New Session</button>
            </div>
          )}
        </div>

        <div className="session-bulk-actions">
          {confirmCloseIdle ? (
            <div className="bulk-confirm-row">
              <span>Fechar {idleSessions.length} inativas?</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="confirm-yes" onClick={closeIdleSessions}>Sim</button>
                <button type="button" className="confirm-no" onClick={() => setConfirmCloseIdle(false)}>Não</button>
              </div>
            </div>
          ) : (
            <button
              className="bulk-select-btn"
              type="button"
              disabled={idleSessions.length === 0}
              onClick={() => setConfirmCloseIdle(true)}
              data-tooltip="Fechar todas as sessões inativas"
              data-tooltip-position="bottom"
            >
              <LucideIcon name="x" /> Fechar inativas ({idleSessions.length})
            </button>
          )}
        </div>
      </div>

    </aside>
  );
}

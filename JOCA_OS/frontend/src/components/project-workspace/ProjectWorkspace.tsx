// ProjectWorkspace — a project's view (mainView === 'project').
//
// The terminal is the stage. On top sits a thin bar with the project's identity and, right below,
// one tab per open terminal; all the rest of the height is terminal.
//
// The terminal itself is the `TerminalView`, the SAME component as the full-screen view: same
// command bar (git, paste path, skills, attachments), same drag&drop, same `/` autocomplete. There
// used to be a reduced, parallel composer here — two composers with different capabilities for the
// same terminal.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JocaItems, Project, ProjectMemory, SessionInfo, TerminalRef } from '../../types';
import { shortPath } from '../../lib/paths';
import { SettingsIcon } from '../dashboard/icons';
import TerminalView from '../TerminalView';
import TerminalTabs, { buildTabs } from './TerminalTabs';
import './project-workspace.css';

function TerminalGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </svg>
  );
}

/** Everything the `TerminalView` needs that lives in the App — forwarded exactly as it is. */
export interface TerminalBridge {
  activeId: string | null;
  activatedIds: Set<string>;
  terminalDraft: string;
  setTerminalDraft: (draft: string) => void;
  terminalHistory: string[];
  historyIndex: number | null;
  setHistoryIndex: (idx: number | null) => void;
  projectMemory: Record<string, ProjectMemory>;
  onSaveSession: () => void;
  onCompactSession: () => void;
  onInterruptSession: () => void;
  onRestartSession: (id: string) => void;
  submitTerminalDraft: (overrideText?: string) => void;
  onOpenCommandPalette: () => void;
  termRefs: React.MutableRefObject<Map<string, TerminalRef>>;
  jocaItems: JocaItems | null;
  onLoadJocaItems: () => void;
}

interface Props {
  project: Project | null;
  projects: Project[];
  sessions: SessionInfo[];
  onEditProject: (project: Project) => void;
  /** Choose a tab's terminal — changes the active one WITHOUT leaving the project view. */
  onSelectTerminal: (id: string) => void;
  /** Rename a terminal's session (double click on the tab). */
  onRenameSession?: (id: string, name: string) => void;
  /** Closes a terminal's session (same handler as the sidebar). */
  onCloseSession: (id: string) => void;
  /** Opens a new terminal in this project (the tabs' "+"). */
  onAddAgent: (project: Project, cli?: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onReady: (sessionId: string, ref: TerminalRef) => void;
  terminal: TerminalBridge;
}

export default function ProjectWorkspace({
  project, projects, sessions,
  onEditProject, onSelectTerminal, onRenameSession, onCloseSession, onAddAgent,
  onRenameProject, onInput, onResize, onReady, terminal,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const projectSessions = useMemo(
    () => (project ? sessions.filter((s) => s.projectId === project.id) : []),
    [project, sessions]
  );
  const tabs = useMemo(() => buildTabs(projectSessions), [projectSessions]);

  // The active tab is the App's active terminal, as long as it belongs to this project; else the first.
  // Without this, entering the project from another terminal showed the wrong terminal.
  const activeTabId = tabs.some((t) => t.id === terminal.activeId)
    ? terminal.activeId
    : (tabs[0]?.id ?? null);

  useEffect(() => {
    if (activeTabId && activeTabId !== terminal.activeId) onSelectTerminal(activeTabId);
  }, [activeTabId, terminal.activeId, onSelectTerminal]);

  const handleCloseTerminal = useCallback((sessionId: string) => {
    onCloseSession(sessionId);
  }, [onCloseSession]);

  const commitName = useCallback(() => {
    if (!project) return;
    const t = nameDraft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditingName(false);
  }, [project, nameDraft, onRenameProject]);

  if (!project) {
    return (
      <div className="project-workspace project-workspace--empty">
        <p className="tk-drawer-empty">Choose a project in the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="project-workspace">
      {/* Thin bar: what used to be a 90px header with a big title, path and chips. The information
          is the same; the space it took is now terminal. */}
      <div className="pw-bar">
        <span className="pw-bar-dot" style={{ background: project.color }} aria-hidden />
        {editingName ? (
          <input
            ref={nameInputRef}
            className="pw-bar-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
              e.stopPropagation();
            }}
            aria-label="Project name"
          />
        ) : (
          <button
            type="button"
            className="pw-bar-name"
            onDoubleClick={() => {
              setNameDraft(project.name);
              setEditingName(true);
              setTimeout(() => nameInputRef.current?.focus(), 50);
            }}
            title={`${project.name} — double click to rename`}
          >
            {project.name}
          </button>
        )}
        <span className="pw-bar-path" title={project.path}>{shortPath(project.path)}</span>
        <span className="pw-bar-spacer" />
        <span className="pw-bar-stat">{tabs.length} terminal{tabs.length === 1 ? '' : 's'}</span>
        <button
          className="pw-bar-settings"
          type="button"
          onClick={() => onEditProject(project)}
          aria-label="Project settings"
          title="Project settings"
        >
          <SettingsIcon />
        </button>
      </div>

      <TerminalTabs
        tabs={tabs}
        activeId={activeTabId}
        onSelect={onSelectTerminal}
        onClose={handleCloseTerminal}
        onRename={onRenameSession}
        onNew={(cli) => onAddAgent(project, cli)}
      />

      <div className="pw-stage">
        <div className="pw-terminal-slot">
          {tabs.length === 0 ? (
            // Empty stage: the message centers in the space that is left instead of sitting in the
            // corner, and brings the action with it — sending you hunting for the "+" was work for the reader.
            <div className="pw-stage-empty">
              <TerminalGlyph />
              <p className="pw-stage-empty-title">No open terminals</p>
              <p className="pw-stage-empty-hint">Open a terminal to work in this project.</p>
              <button type="button" className="pw-stage-empty-btn" onClick={() => onAddAgent(project)}>
                Open terminal
              </button>
            </div>
          ) : (
            <TerminalView
              sessions={projectSessions}
              projects={projects}
              activeId={activeTabId}
              activatedIds={terminal.activatedIds}
              terminalDraft={terminal.terminalDraft}
              setTerminalDraft={terminal.setTerminalDraft}
              terminalHistory={terminal.terminalHistory}
              historyIndex={terminal.historyIndex}
              setHistoryIndex={terminal.setHistoryIndex}
              selectedPath={null}
              onClearSelectedPath={() => {}}
              projectMemory={terminal.projectMemory}
              onSaveSession={terminal.onSaveSession}
              onCompactSession={terminal.onCompactSession}
              onInterruptSession={terminal.onInterruptSession}
              onRestartSession={terminal.onRestartSession}
              onInput={onInput}
              onResize={onResize}
              onReady={onReady}
              submitTerminalDraft={terminal.submitTerminalDraft}
              onOpenCommandPalette={terminal.onOpenCommandPalette}
              termRefs={terminal.termRefs}
              onNewSession={() => onAddAgent(project)}
              onNewSessionWithCli={(cli) => onAddAgent(project, cli)}
              jocaItems={terminal.jocaItems}
              onLoadJocaItems={terminal.onLoadJocaItems}
            />
          )}
        </div>
      </div>
    </div>
  );
}

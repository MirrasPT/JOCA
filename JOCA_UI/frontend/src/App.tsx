import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import NavRail from './components/NavRail';
import FilesView from './components/FilesView';
import SessionSidebar from './components/SessionSidebar';
import FilePreview from './components/FilePreview';
import TerminalPane from './components/TerminalPane';
import ToastNotification, { type ToastItem } from './components/ToastNotification';
import WorkflowPanel, { type WorkflowState, emptyWorkflow, parseWorkflowLine } from './components/WorkflowPanel';

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  status: 'working' | 'idle';
}

export interface Project {
  id: string;
  name: string;
  path: string;
  initialized?: boolean;
}

export interface TerminalRef {
  write: (data: string) => void;
  reset: () => void;
}

type ServerMessage =
  | { type: 'sessions_list'; sessions: SessionInfo[] }
  | { type: 'session_created'; session: SessionInfo }
  | { type: 'session_closed'; sessionId: string }
  | { type: 'session_renamed'; sessionId: string; name: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'buffer'; sessionId: string; data: string }
  | { type: 'session_status'; sessionId: string; status: 'working' | 'idle'; isDone?: boolean };

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [createSkillDraft, setCreateSkillDraft] = useState('');

  // Workflow state — per-session parsed from terminal output
  const [workflowStates, setWorkflowStates] = useState<Map<string, WorkflowState>>(new Map());
  const workflowRef = useRef<Map<string, WorkflowState>>(new Map());
  const outputBuffers = useRef<Map<string, string>>(new Map());

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const termRefs = useRef<Map<string, TerminalRef>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const sessionsRef = useRef<SessionInfo[]>([]);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const processOutput = useCallback((sessionId: string, data: string) => {
    const buf = (outputBuffers.current.get(sessionId) ?? '') + data;
    const newlineIdx = buf.lastIndexOf('\n');
    if (newlineIdx === -1) { outputBuffers.current.set(sessionId, buf); return; }
    const toProcess = buf.slice(0, newlineIdx);
    outputBuffers.current.set(sessionId, buf.slice(newlineIdx + 1));
    const lines = toProcess.split('\n');
    let current = workflowRef.current.get(sessionId) ?? emptyWorkflow;
    let changed = false;
    for (const line of lines) {
      const update = parseWorkflowLine(line, current);
      if (update) { current = update; changed = true; }
    }
    if (changed) {
      workflowRef.current.set(sessionId, current);
      setWorkflowStates(new Map(workflowRef.current));
    }
  }, []);

  const reloadProjects = useCallback(() => {
    fetch('/projects').then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  useEffect(() => { reloadProjects(); }, [reloadProjects]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const activateSession = useCallback((id: string) => {
    setActivatedIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set([...prev, id]);
    });
  }, []);

  const addToast = useCallback((session: SessionInfo) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, sessionName: session.name, sessionId: session.id, timestamp: Date.now() }]);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('JOCA — Done', { body: session.name });
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;

      switch (msg.type) {
        case 'sessions_list':
          setSessions(msg.sessions);
          msg.sessions.forEach((s) => activateSession(s.id));
          if (msg.sessions.length > 0) {
            setActiveId((prev) => prev ?? msg.sessions[0].id);
          }
          break;

        case 'session_created':
          setSessions((prev) => {
            if (prev.some((s) => s.id === msg.session.id)) return prev;
            return [...prev, msg.session];
          });
          setActiveId(msg.session.id);
          activateSession(msg.session.id);
          break;

        case 'session_closed':
          setSessions((prev) => {
            const next = prev.filter((s) => s.id !== msg.sessionId);
            setActiveId((cur) => {
              if (cur !== msg.sessionId) return cur;
              return next.length > 0 ? next[next.length - 1].id : null;
            });
            return next;
          });
          termRefs.current.delete(msg.sessionId);
          outputBuffers.current.delete(msg.sessionId);
          workflowRef.current.delete(msg.sessionId);
          setWorkflowStates(new Map(workflowRef.current));
          break;

        case 'session_renamed':
          setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, name: msg.name } : s
          ));
          break;

        case 'output':
          termRefs.current.get(msg.sessionId)?.write(msg.data);
          processOutput(msg.sessionId, msg.data);
          break;

        case 'buffer':
          termRefs.current.get(msg.sessionId)?.reset();
          termRefs.current.get(msg.sessionId)?.write(msg.data);
          // re-parse full buffer to restore workflow state
          outputBuffers.current.set(msg.sessionId, '');
          workflowRef.current.delete(msg.sessionId);
          processOutput(msg.sessionId, msg.data);
          break;

        case 'session_status':
          setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, status: msg.status } : s
          ));
          if (msg.isDone) {
            const session = sessionsRef.current.find((s) => s.id === msg.sessionId);
            if (session && session.id !== activeIdRef.current) {
              addToast(session);
              setUnreadIds((prev) => new Set([...prev, msg.sessionId]));
            }
          }
          break;
      }
    };

    ws.onclose = () => {
      if (!unmountedRef.current) {
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => ws.close();
  }, [activateSession, addToast, processOutput]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const handleNewSession = useCallback(() => {
    send({ type: 'create_session' });
  }, [send]);

  const handleCloseSession = useCallback((id: string) => {
    send({ type: 'close_session', sessionId: id });
  }, [send]);

  const handleInput = useCallback((sessionId: string, data: string) => {
    send({ type: 'input', sessionId, data });
    setUnreadIds((prev) => { if (!prev.has(sessionId)) return prev; const n = new Set(prev); n.delete(sessionId); return n; });
  }, [send]);

  const handleResize = useCallback((sessionId: string, cols: number, rows: number) => {
    send({ type: 'resize', sessionId, cols, rows });
  }, [send]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
    activateSession(id);
    if (termRefs.current.has(id)) {
      send({ type: 'get_buffer', sessionId: id });
    }
  }, [send, activateSession]);

  const handleRenameSession = useCallback((id: string, name: string) => {
    send({ type: 'rename_session', sessionId: id, name });
  }, [send]);

  const handleOpenProject = useCallback((project: Project) => {
    send({ type: 'create_session', resumePath: project.path, sessionName: project.name, projectId: project.id });
  }, [send]);

  const handleTermReady = useCallback((sessionId: string, ref: TerminalRef) => {
    termRefs.current.set(sessionId, ref);
    send({ type: 'get_buffer', sessionId });
  }, [send]);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSave = useCallback(() => {
    if (activeId) handleInput(activeId, '/save\r');
  }, [activeId, handleInput]);

  const handleCompact = useCallback(() => {
    if (activeId) handleInput(activeId, '/compact\r');
  }, [activeId, handleInput]);

  const handleSubmitCreateSkill = useCallback(() => {
    const desc = createSkillDraft.trim();
    if (!desc || !activeId) return;
    handleInput(activeId, `/create-skill ${desc}\r`);
    setCreateSkillDraft('');
    setShowCreateSkill(false);
  }, [activeId, createSkillDraft, handleInput]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const workingCount = useMemo(() => sessions.filter(s => s.status === 'working').length, [sessions]);
  const idleCount = sessions.length - workingCount;

  return (
    <div className="app">
      <NavRail
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles((f) => !f)}
      />

      {/* Files panel */}
      <div className={`files-slot ${showFiles ? 'files-slot--open' : ''}`}>
        <FilesView
          onPastePath={(p) => activeId && handleInput(activeId, p)}
          onPreview={setPreviewPath}
          initialPath={activeSession?.cwd}
          onClose={() => setShowFiles(false)}
        />
      </div>

      {/* Main area: dashboard + terminal */}
      <div className="main-area">
        {/* Dashboard stats bar */}
        <div className="dashboard-bar">
          {sessions.length === 0 ? (
            <span className="dashboard-empty-hint">No active sessions — press + to start one</span>
          ) : (
            <span className="dashboard-stats">
              <span className="stat-total">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
              <span className="stat-sep">·</span>
              <span className="stat-working">{workingCount} working</span>
              <span className="stat-sep">·</span>
              <span className="stat-idle">{idleCount} idle</span>
            </span>
          )}
          <WorkflowPanel state={activeId ? (workflowStates.get(activeId) ?? null) : null} />
        </div>

        {/* Terminal — accepts file drops from FileBrowser */}
        <div
          className="terminal-area"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const p = e.dataTransfer.getData('text/plain');
            if (p && activeId) handleInput(activeId, p);
          }}
        >
          <div className="terminal-panel">
            <div className="terminal-titlebar">
              <div className="titlebar-info">
                <span className="titlebar-name">{activeSession?.name ?? ''}</span>
                {activeSession && (
                  <span className="titlebar-cwd">{shortPath(activeSession.cwd)}</span>
                )}
              </div>
              {activeSession && (
                <div className="titlebar-actions">
                  <button className="titlebar-btn titlebar-btn--save" onClick={handleSave} title="Save session (/save)">
                    ↓ Save
                  </button>
                  <button className="titlebar-btn titlebar-btn--compact" onClick={handleCompact} title="Compact context (/compact)">
                    ⊟ Compact
                  </button>
                  <button className="titlebar-btn titlebar-btn--create" onClick={() => setShowCreateSkill(true)} title="Create skill or agent">
                    ✦ Create
                  </button>
                </div>
              )}
              <span className="titlebar-badge">--dangerously-skip-permissions</span>
            </div>

            {sessions.length === 0 ? (
              <div className="terminal-empty-state">
                <div className="terminal-empty-icon">⊟</div>
                <p>No active sessions</p>
                <button className="btn-new-large" onClick={handleNewSession}>+ New Session</button>
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="terminal-wrapper"
                  style={{ display: s.id === activeId ? 'flex' : 'none' }}
                >
                  {activatedIds.has(s.id) && (
                    <TerminalPane
                      sessionId={s.id}
                      isActive={s.id === activeId}
                      onInput={handleInput}
                      onResize={handleResize}
                      onReady={handleTermReady}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sessions sidebar (right, fixed) */}
      <SessionSidebar
        sessions={sessions}
        projects={projects}
        activeId={activeId}
        unreadIds={unreadIds}
        onSelect={handleSwitchSession}
        onClose={handleCloseSession}
        onRename={handleRenameSession}
        onNew={handleNewSession}
        onOpenProject={handleOpenProject}
        onProjectsChange={reloadProjects}
        onInput={handleInput}
      />

      {previewPath && (
        <FilePreview filePath={previewPath} onClose={() => setPreviewPath(null)} />
      )}

      {showCreateSkill && (
        <div className="create-skill-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateSkill(false); }}>
          <div className="create-skill-modal">
            <div className="create-skill-header">
              <span className="create-skill-title">✦ Create Skill or Agent</span>
              <button className="create-skill-close" onClick={() => setShowCreateSkill(false)}>×</button>
            </div>
            <p className="create-skill-hint">Describe what you want to create — name, purpose, triggers.</p>
            <div className="create-skill-input-row">
              <input
                autoFocus
                className="create-skill-input"
                placeholder="e.g. a skill that converts Figma tokens to CSS variables"
                value={createSkillDraft}
                onChange={(e) => setCreateSkillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitCreateSkill();
                  if (e.key === 'Escape') setShowCreateSkill(false);
                }}
              />
              <button
                className="create-skill-submit"
                onClick={handleSubmitCreateSkill}
                disabled={!createSkillDraft.trim() || !activeId}
              >→</button>
            </div>
            {!activeId && <p className="create-skill-warn">No active session — start one first.</p>}
          </div>
        </div>
      )}

      <ToastNotification
        toasts={toasts}
        onDismiss={handleDismissToast}
        onSelect={handleSwitchSession}
      />
    </div>
  );
}

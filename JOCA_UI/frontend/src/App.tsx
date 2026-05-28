import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';

import SessionSidebar from './components/SessionSidebar';
import CreateProjectModal from './components/CreateProjectModal';
import FilePreview from './components/FilePreview';
import ToastNotification, { type ToastItem } from './components/ToastNotification';
import { type WorkflowState, emptyWorkflow, parseWorkflowLine } from './components/WorkflowPanel';
import RightWorkspace from './components/RightWorkspace';
import DashboardView from './components/DashboardView';
import TerminalView from './components/TerminalView';
import type { JocaItems, JocaLogicInfo, MainView, Project, ProjectMemory, RightPanel, RuntimeInfo, SessionInfo, TerminalRef, ToolkitFilter, ToolkitRegistryItem, ToolkitType } from './types';

type ServerMessage =
  | { type: 'sessions_list'; sessions: SessionInfo[] }
  | { type: 'session_created'; session: SessionInfo }
  | { type: 'session_closed'; sessionId: string }
  | { type: 'session_renamed'; sessionId: string; name: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'buffer'; sessionId: string; data: string }
  | { type: 'session_status'; sessionId: string; status: 'working' | 'idle'; isDone?: boolean };

interface ServiceConnection {
  id: string;
  name: string;
  status: 'connected' | 'mock' | 'offline';
  scope: string;
}

const SERVICE_CONNECTIONS: ServiceConnection[] = [
  { id: 'filesystem', name: 'Local Files', status: 'connected', scope: 'Leitura real, preview e drag para terminal' },
  { id: 'terminal', name: 'Terminal Sessions', status: 'connected', scope: 'PTY real por sessão' },
];

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activityEvents, setActivityEvents] = useState<{ id: string; title: string; detail: string; timestamp: number }[]>([]);
  const [rightPanel, setRightPanel] = useState<RightPanel>('files');
  const [mainView, setMainView] = useState<MainView>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [jocaItems, setJocaItems] = useState<JocaItems | null>(null);
  const [projectMemory, setProjectMemory] = useState<Record<string, ProjectMemory>>({});

  const [jocaLogicInfo, setJocaLogicInfo] = useState<JocaLogicInfo | null>(null);

  const [terminalDraft, setTerminalDraft] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);

  // New UX States
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pinOutput, setPinOutput] = useState(false);
  const pinOutputRef = useRef(false);
  
  const handleTogglePinOutput = useCallback(() => {
    setPinOutput((prev) => {
      const next = !prev;
      pinOutputRef.current = next;
      return next;
    });
  }, []);

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

  const reloadRuntime = useCallback(() => {
    fetch('/runtime').then((r) => r.json()).then(setRuntimeInfo).catch(() => {});
  }, []);

  const reloadProjectMemory = useCallback(() => {
    fetch('/project-memory').then((r) => r.json()).then(setProjectMemory).catch(() => {});
  }, []);

  const reloadJocaLogic = useCallback(() => {
    fetch('/joca-logic').then((r) => r.json()).then(setJocaLogicInfo).catch(() => {});
  }, []);


  const handleProjectSaved = useCallback((savedProject: Project) => {
    setProjects((current) => {
      const exists = current.some((project) => project.id === savedProject.id);
      if (!exists) return [...current, savedProject];
      return current.map((project) => (
        project.id === savedProject.id
          ? { ...project, ...savedProject }
          : project
      ));
    });
    setActivityEvents((prev) => [
      { id: crypto.randomUUID(), title: 'Project saved', detail: savedProject.name, timestamp: Date.now() },
      ...prev,
    ].slice(0, 80));
    reloadProjects();
    reloadProjectMemory();
  }, [reloadProjectMemory, reloadProjects]);

  const updateProjectMemory = useCallback((projectId: string | undefined | null, patch: Partial<ProjectMemory>) => {
    if (!projectId) return;
    setProjectMemory((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? {
          projectId,
          recentSessions: [],
          favoriteSkills: [],
          favoriteAgents: [],
          quickCommands: ['save', 'compact', 'clear'],
          openFiles: [],
          rightPanel: 'files',
          updatedAt: new Date().toISOString(),
        }),
        ...patch,
        projectId,
        updatedAt: new Date().toISOString(),
      },
    }));
    fetch(`/project-memory/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    reloadProjects();
    reloadRuntime();
    reloadProjectMemory();
    reloadJocaLogic();
    const timer = window.setInterval(reloadRuntime, 10_000);
    return () => window.clearInterval(timer);
  }, [reloadProjectMemory, reloadProjects, reloadRuntime, reloadJocaLogic]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
    setActivityEvents((prev) => [
      { id: crypto.randomUUID(), title: 'Session finished', detail: session.name, timestamp: Date.now() },
      ...prev,
    ].slice(0, 80));
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
          setActivityEvents((prev) => [
            { id: crypto.randomUUID(), title: 'Session created', detail: msg.session.name, timestamp: Date.now() },
            ...prev,
          ].slice(0, 80));
          setActiveId(msg.session.id);
          setMainView('session');
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
          setActivityEvents((prev) => [
            { id: crypto.randomUUID(), title: 'Session closed', detail: msg.sessionId, timestamp: Date.now() },
            ...prev,
          ].slice(0, 80));
          break;

        case 'session_renamed':
          setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, name: msg.name } : s
          ));
          break;

        case 'output':
          termRefs.current.get(msg.sessionId)?.write(msg.data);
          processOutput(msg.sessionId, msg.data);
          if (pinOutputRef.current && msg.sessionId === activeIdRef.current) {
            termRefs.current.get(msg.sessionId)?.scrollToBottom?.();
          }
          break;

        case 'buffer': {
          const ref = termRefs.current.get(msg.sessionId);
          ref?.reset();
          ref?.write(msg.data);
          requestAnimationFrame(() => ref?.fit?.());
          outputBuffers.current.set(msg.sessionId, '');
          workflowRef.current.delete(msg.sessionId);
          processOutput(msg.sessionId, msg.data);
          break;
        }

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

  const handleCreateProjectPrompt = useCallback(() => {
    setEditingProject(null);
    setCreateProjectOpen(true);
  }, []);

  const handleEditProject = useCallback((project: Project) => {
    setEditingProject(project);
    setCreateProjectOpen(true);
  }, []);

  const handleCloseSession = useCallback((id: string) => {
    send({ type: 'close_session', sessionId: id });
  }, [send]);

  const handleInterruptSession = useCallback(() => {
    if (activeId) send({ type: 'interrupt_session', sessionId: activeId });
  }, [activeId, send]);

  const handleRestartSession = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const { cwd, name, projectId } = session;
    send({ type: 'close_session', sessionId: id });
    send({ type: 'create_session', cwd, sessionName: name, projectId });
  }, [sessions, send]);

  const handleInput = useCallback((sessionId: string, data: string) => {
    send({ type: 'input', sessionId, data });
    setUnreadIds((prev) => { if (!prev.has(sessionId)) return prev; const n = new Set(prev); n.delete(sessionId); return n; });
  }, [send]);

  const handleRunCommand = useCallback((command: string) => {
    const line = command.endsWith('\r') ? command : `${command}\r`;
    setMainView('session');
    if (activeId) {
      handleInput(activeId, line);
      return;
    }
    send({ type: 'create_session', sessionName: 'CLI Setup', initialInput: line });
  }, [activeId, handleInput, send]);

  const handleResize = useCallback((sessionId: string, cols: number, rows: number) => {
    send({ type: 'resize', sessionId, cols, rows });
  }, [send]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
    setMainView('session');
    activateSession(id);
    if (termRefs.current.has(id)) {
      send({ type: 'get_buffer', sessionId: id });
    }
  }, [send, activateSession]);

  const handleRenameSession = useCallback((id: string, name: string) => {
    send({ type: 'rename_session', sessionId: id, name });
  }, [send]);

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    try {
      const res = await fetch(`/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const savedProject = await res.json();
        handleProjectSaved(savedProject);
      }
    } catch (e) {
      console.error(e);
    }
  }, [handleProjectSaved]);

  const handleUpdateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    try {
      const res = await fetch(`/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const savedProject = await res.json();
        handleProjectSaved(savedProject);
      }
    } catch (e) {
      console.error(e);
    }
  }, [handleProjectSaved]);

  const handleOpenProject = useCallback((project: Project) => {
    setMainView('session');
    send({ type: 'create_session', resumePath: project.path, sessionName: project.name, projectId: project.id });
  }, [send]);

  const handleCreateProjectSkill = useCallback((project: Project, skillName: string) => {
    setMainView('session');
    const instruction = `Vamos criar uma skill. Para tal, usa o /create-skill para criar a skill "${skillName}" apenas para o projeto no path "${project.path}". Antes de iniciar, faz-me o questionário perguntando o que é e para que serve esta skill, e só depois de eu responder é que deves avançar com o ciclo de criação da skill.`;
    send({
      type: 'create_session',
      cwd: project.path,
      resumePath: project.path,
      sessionName: `Criar Skill: ${skillName}`,
      projectId: project.id,
      initialInput: instruction,
    });
  }, [send]);


  const handleShowProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setMainView('project');
  }, []);

  const loadCommandPalette = useCallback(() => {
    if (jocaItems) return;
    fetch('/joca-items').then((r) => r.json()).then(setJocaItems).catch(() => setJocaItems({ commands: [], skills: [], agents: [] }));
  }, [jocaItems]);

  const insertCommandDraft = useCallback((text: string) => {
    setTerminalDraft((draft) => draft ? `${draft} ${text}` : text);
    setCommandPaletteOpen(false);
  }, []);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape closes the command palette. stopImmediatePropagation prevents any other modal
      // (e.g. FilePreview) from also responding to the same keypress.
      if (event.key === 'Escape' && commandPaletteOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCommandPaletteOpen(false);
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        loadCommandPalette();
      }
      if (key === 'b') {
        event.preventDefault();
        setSidebarCollapsed((value) => !value);
      }
      if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        setRightPanel((panel) => panel === 'files' ? null : 'files');
      }
      if (key === '.') {
        event.preventDefault();
        handleInterruptSession();
      }
    };
    // Capture phase: this listener fires BEFORE any bubble-phase listener (e.g. FilePreview's).
    // Combined with stopImmediatePropagation above, ensures palette Escape never leaks to other modals.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handleInterruptSession, loadCommandPalette, commandPaletteOpen]);

  // CommandPalette focus management: trap Tab inside, restore focus to opener on close.
  const paletteTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (commandPaletteOpen) {
      paletteTriggerRef.current = document.activeElement as HTMLElement;
      // Focus the first interactive element in the modal after the next paint.
      requestAnimationFrame(() => {
        const modal = document.querySelector('.command-palette-modal');
        if (!modal) return;
        const first = modal.querySelector<HTMLElement>('button, [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        first?.focus();
      });
      const trap = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const modal = document.querySelector('.command-palette-modal');
        if (!modal) return;
        const focusables = Array.from(modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((el) => el.getClientRects().length > 0);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement;
        if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      };
      window.addEventListener('keydown', trap);
      return () => window.removeEventListener('keydown', trap);
    } else if (paletteTriggerRef.current) {
      paletteTriggerRef.current.focus();
      paletteTriggerRef.current = null;
    }
  }, [commandPaletteOpen]);

  const submitTerminalDraft = useCallback((overrideText?: string) => {
    if (!activeId) return;
    const text = (overrideText ?? terminalDraft).trim();
    if (!text) return;
    handleInput(activeId, `${text}\r`);
    setTerminalHistory((prev) => [...prev.filter((item) => item !== text), text].slice(-40));
    setHistoryIndex(null);
    setTerminalDraft('');
  }, [activeId, handleInput, terminalDraft]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );
  const contextProjectId = activeSession?.projectId ?? activeProjectId;
  
  const rightSlotExpanded = rightPanel !== null;
  const expandedRightSlotSize = Math.round(Math.max(408, Math.min(viewportWidth * 0.32, 424)));
  const rightSlotSize = rightSlotExpanded ? `${expandedRightSlotSize}px` : '54px';

  useEffect(() => {
    if (contextProjectId) updateProjectMemory(contextProjectId, { rightPanel });
  }, [contextProjectId, rightPanel, updateProjectMemory]);

  return (
    <div className="app">
      <SessionSidebar
        sessions={sessions}
        projects={projects}
        activeId={activeId}
        unreadIds={unreadIds}
        mainView={mainView}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onShowDashboard={() => setMainView('dashboard')}
        onShowProject={handleShowProject}
        onSelect={handleSwitchSession}
        onClose={handleCloseSession}
        onRename={handleRenameSession}
        onNew={handleNewSession}
        onOpenProject={handleOpenProject}
        onProjectsChange={reloadProjects}
        onCreateProject={handleCreateProjectPrompt}
        onInput={handleInput}
        onRenameProject={handleRenameProject}
      />

      <div className="main-area">
        {mainView === 'dashboard' || mainView === 'project' ? (
          <DashboardView
            mainView={mainView}
            projects={projects}
            sessions={sessions}
            activeProjectId={contextProjectId}
            projectMemory={projectMemory}
            jocaLogicInfo={jocaLogicInfo}
            onUpdateProjectMemory={updateProjectMemory}
            onCreateProject={handleCreateProjectPrompt}
            onEditProject={handleEditProject}
            onShowProject={handleShowProject}
            onOpenProject={handleOpenProject}
            onSwitchSession={handleSwitchSession}
            onNewSession={handleNewSession}
            setRightPanel={setRightPanel}
            onPreviewFile={(path) => {
              setPreviewPath(path);
              setSelectedPath(path);
            }}
            onRenameProject={handleRenameProject}
            onUpdateProject={handleUpdateProject}
            onRenameSession={handleRenameSession}
            onCreateProjectSkill={handleCreateProjectSkill}
          />
        ) : (
          <TerminalView
            sessions={sessions}
            activeId={activeId}
            activatedIds={activatedIds}
            terminalDraft={terminalDraft}
            setTerminalDraft={setTerminalDraft}
            terminalHistory={terminalHistory}
            historyIndex={historyIndex}
            setHistoryIndex={setHistoryIndex}
            selectedPath={selectedPath}
            onClearSelectedPath={() => setSelectedPath(null)}
            projectMemory={projectMemory}
            onSaveSession={handleSave}
            onCompactSession={handleCompact}
            onInterruptSession={handleInterruptSession}
            onRestartSession={handleRestartSession}
            onInput={handleInput}
            onResize={handleResize}
            onReady={handleTermReady}
            submitTerminalDraft={submitTerminalDraft}
            onOpenCommandPalette={() => {
              setCommandPaletteOpen(true);
              loadCommandPalette();
            }}
            termRefs={termRefs}
            onNewSession={handleNewSession}
            jocaItems={jocaItems}
            onLoadJocaItems={loadCommandPalette}
          />
        )}
      </div>

      <RightWorkspace
        panel={rightPanel}
        width={rightSlotSize}
        activeSession={activeSession}
        runtimeInfo={runtimeInfo}
        jocaLogicInfo={jocaLogicInfo}
        sessions={sessions}
        projects={projects}
        services={SERVICE_CONNECTIONS}
        events={activityEvents}
        jocaItems={jocaItems}
        onSetPanel={setRightPanel}
        onPastePath={(p) => activeId && handleInput(activeId, p)}
        onPreview={(path) => {
          setPreviewPath(path);
          setSelectedPath(path);
          const current = contextProjectId ? projectMemory[contextProjectId] : null;
          if (contextProjectId) {
            updateProjectMemory(contextProjectId, {
              openFiles: [path, ...(current?.openFiles ?? []).filter((item) => item !== path)].slice(0, 20),
            });
          }
        }}
        onLoadToolkit={loadCommandPalette}
        onToolkitItemsChange={setJocaItems}
        onInsertToolkit={insertCommandDraft}
        onRunCommand={handleRunCommand}
        onReloadRuntime={reloadRuntime}
        selectedPath={selectedPath}
      />

      {previewPath && (
        <FilePreview filePath={previewPath} onClose={() => setPreviewPath(null)} />
      )}

      {commandPaletteOpen && (
        <div className="create-skill-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCommandPaletteOpen(false); }}>
          <div className="command-palette-modal" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
            <div className="create-skill-header">
              <span className="create-skill-title" id="command-palette-title">Commands, Skills, Agents</span>
              <button className="create-skill-close" onClick={() => setCommandPaletteOpen(false)} aria-label="Close command palette">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="command-palette-grid">
              <div>
                <h3>Workspace</h3>
                <button onClick={() => { setMainView('dashboard'); setCommandPaletteOpen(false); }}>Dashboard</button>
                <button onClick={() => { setRightPanel('files'); setCommandPaletteOpen(false); }}>Open Files</button>
                <button onClick={() => { setRightPanel('toolkit'); loadCommandPalette(); setCommandPaletteOpen(false); }}>Open Toolkit</button>
                <button onClick={() => { setRightPanel('settings'); setCommandPaletteOpen(false); }}>Open Settings</button>
              </div>
              <div>
                <h3>Sessions</h3>
                {sessions.map((session) => <button key={session.id} onClick={() => { handleSwitchSession(session.id); setCommandPaletteOpen(false); }}>{session.name}</button>)}
                {sessions.length === 0 && <button onClick={() => { handleNewSession(); setCommandPaletteOpen(false); }}>New Session</button>}
              </div>
              <div>
                <h3>Projects</h3>
                {projects.map((project) => <button key={project.id} onClick={() => { handleShowProject(project.id); setCommandPaletteOpen(false); }}>{project.name}</button>)}
                {projects.length === 0 && <button onClick={() => { handleCreateProjectPrompt(); setCommandPaletteOpen(false); }}>Create Project</button>}
              </div>
              <div>
                <h3>Commands</h3>
                {(jocaItems?.commands ?? []).map((item) => <button key={item.name} onClick={() => insertCommandDraft(item.insert)}>{item.name}</button>)}
              </div>
              <div>
                <h3>Skills</h3>
                {(jocaItems?.skills ?? []).map((item) => <button key={`${item.category}-${item.name}`} onClick={() => insertCommandDraft(item.insert)}>{item.name}</button>)}
              </div>
              <div>
                <h3>Agents</h3>
                {(jocaItems?.agents ?? []).map((item) => <button key={item.name} onClick={() => insertCommandDraft(item.insert)}>{item.name}</button>)}
              </div>
            </div>
            {!jocaItems && <p className="create-skill-hint">A carregar registry JOCA...</p>}
          </div>
        </div>
      )}

      <ToastNotification
        toasts={toasts}
        onDismiss={handleDismissToast}
        onSelect={handleSwitchSession}
      />

      <CreateProjectModal
        open={createProjectOpen}
        project={editingProject}
        onClose={() => {
          setCreateProjectOpen(false);
          setEditingProject(null);
        }}
        onSaved={handleProjectSaved}
      />
    </div>
  );
}

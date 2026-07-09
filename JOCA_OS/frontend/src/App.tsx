import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import SessionSidebar from './components/SessionSidebar';
import CreateProjectModal from './components/CreateProjectModal';
import FilePreview from './components/FilePreview';
import ToastNotification, { type ToastItem } from './components/ToastNotification';
import { type WorkflowState, emptyWorkflow, parseWorkflowLine } from './components/WorkflowPanel';
import RightWorkspace from './components/RightWorkspace';
import DashboardView, { type RateLimits } from './components/DashboardView';
import TerminalView from './components/TerminalView';
import MasterChatView from './components/MasterChatView';
import { AutomationsView } from './components/AutomationsView';
import { TasksView } from './components/TasksView';
import CommandPalette from './components/CommandPalette';
import { useSessionSocket } from './hooks/useSessionSocket';
import { ensureNotificationPermission, notify } from './lib/notify';
import type { JocaItems, JocaLogicInfo, MainView, MasterEntry, Project, ProjectMemory, RightPanel, RuntimeInfo, SessionInfo, TerminalRef, ToolkitFilter, ToolkitRegistryItem, ToolkitType } from './types';

// Igualdade por valor de WorkflowState — evita um setState (e re-render global) quando o
// output parseado produz um estado idêntico ao anterior (ex.: mesmo marcador repetido).
function workflowEquals(a: WorkflowState, b: WorkflowState): boolean {
  return a.activeSkill === b.activeSkill
    && a.activeType === b.activeType
    && a.nextStep === b.nextStep
    && a.history.length === b.history.length
    && a.history.every((h, i) => h === b.history[i]);
}

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

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activityEvents, setActivityEvents] = useState<{ id: string; title: string; detail: string; timestamp: number }[]>([]);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [mainView, setMainView] = useState<MainView>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [automationsRefresh, setAutomationsRefresh] = useState(0);
  const [tasksRefresh, setTasksRefresh] = useState(0);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [jocaItems, setJocaItems] = useState<JocaItems | null>(null);
  const [projectMemory, setProjectMemory] = useState<Record<string, ProjectMemory>>({});

  const [jocaLogicInfo, setJocaLogicInfo] = useState<JocaLogicInfo | null>(null);

  const [masterLog, setMasterLog] = useState<MasterEntry[]>([]);
  // Count of in-flight Master runs. A counter (not a boolean) so the user can fire a new
  // instruction while a previous one is still orchestrating — each run resolves independently.
  const [masterPending, setMasterPending] = useState(0);
  // Latest live activity text (what the Master is doing right now) — shown in the bottom indicator.
  const [masterActivity, setMasterActivity] = useState<string | null>(null);
  // Claude/Codex/Gemini usage limits, from GET /rate-limits. Fonte única — passada ao DashboardView por prop.
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);

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
  const termRefs = useRef<Map<string, TerminalRef>>(new Map());
  const sessionsRef = useRef<SessionInfo[]>([]);
  const activeIdRef = useRef<string | null>(null);

  const projectMemoryRef = useRef(projectMemory);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { projectMemoryRef.current = projectMemory; }, [projectMemory]);

  const processOutput = useCallback((sessionId: string, data: string) => {
    const buf = (outputBuffers.current.get(sessionId) ?? '') + data;
    const newlineIdx = buf.lastIndexOf('\n');
    if (newlineIdx === -1) { outputBuffers.current.set(sessionId, buf); return; }
    const toProcess = buf.slice(0, newlineIdx);
    outputBuffers.current.set(sessionId, buf.slice(newlineIdx + 1));
    const lines = toProcess.split('\n');
    const prev = workflowRef.current.get(sessionId) ?? emptyWorkflow;
    let current = prev;
    for (const line of lines) {
      const update = parseWorkflowLine(line, current);
      if (update) current = update;
    }
    // Só re-renderiza se o estado mudou de facto (não por output que produz o mesmo estado).
    if (current !== prev && !workflowEquals(current, prev)) {
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

  // Load the persisted Master chat so the conversation survives reloads/backend restarts.
  const reloadMasterChat = useCallback(() => {
    fetch('/master-chat').then((r) => r.json()).then((items: Array<{ id: string; role: 'user' | 'summary' | 'error'; text: string; isError?: boolean; costUsd?: number }>) => {
      setMasterLog(items.map((e) =>
        e.role === 'summary' ? { id: e.id, role: 'summary', text: e.text, isError: !!e.isError, costUsd: e.costUsd ?? 0 }
        : e.role === 'error' ? { id: e.id, role: 'error', text: e.text }
        : { id: e.id, role: 'user', text: e.text }
      ));
    }).catch(() => {});
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
          rightPanel: null,
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

  const reloadRateLimits = useCallback(() => {
    fetch('/rate-limits').then((r) => (r.ok ? r.json() : null)).then(setRateLimits).catch(() => {});
  }, []);

  // Master brain label for the header pill (provider/model from Settings).
  const [masterBrainLabel, setMasterBrainLabel] = useState('Sonnet');
  const reloadMasterBrain = useCallback(() => {
    fetch('/ui-settings').then((r) => r.json()).then((s: { masterProvider?: string; masterModel?: string }) => {
      const prov = s.masterProvider ?? 'claude';
      const model = (s.masterModel ?? '').trim();
      const provLabel: Record<string, string> = { claude: 'Claude', codex: 'Codex', antigravity: 'Gemini', ollama: 'Ollama' };
      setMasterBrainLabel(model || (prov === 'claude' ? 'Sonnet' : (provLabel[prov] ?? prov)));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    ensureNotificationPermission(); // ask once for OS desktop-notification permission
    reloadProjects();
    reloadRuntime();
    reloadProjectMemory();
    reloadJocaLogic();
    reloadMasterChat();
    reloadRateLimits();
    reloadMasterBrain();
    const timer = window.setInterval(() => { reloadRuntime(); reloadRateLimits(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [reloadProjectMemory, reloadProjects, reloadRuntime, reloadJocaLogic, reloadMasterChat, reloadRateLimits, reloadMasterBrain]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
    // Sound + OS notification (Windows/macOS), so the user is alerted even off-window.
    notify('JOCA — Terminado', session.name);
  }, []);

  // WebSocket lifecycle (connect / reconnect / message routing) lives in the hook; it returns a
  // stable `send`. All parent state it touches is passed in and read through a ref, so the socket
  // is created once on mount.
  const { send } = useSessionSocket({
    setSessions, setActiveId, setActivityEvents, setMainView, setWorkflowStates,
    setMasterLog, setMasterPending, setMasterActivity, setUnreadIds, setAutomationsRefresh, setTasksRefresh,
    termRefs, outputBuffers, workflowRef, sessionsRef, activeIdRef, pinOutputRef,
    activateSession, addToast, processOutput, reloadProjects, reloadProjectMemory,
  });

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

  const handleArchiveProject = useCallback((id: string, archived: boolean) => {
    let snapshot: Project[] = [];
    setProjects((current) => {
      snapshot = current;
      return current.map((p) => (p.id === id ? { ...p, archived } : p));
    });
    fetch(`/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((saved) => handleProjectSaved(saved))
      .catch(() => setProjects(snapshot)); // rollback on failure
  }, [handleProjectSaved]);

  const handleReorderProjects = useCallback((orderedIds: string[]) => {
    let snapshot: Project[] = [];
    setProjects((current) => {
      snapshot = current;
      const byId = new Map(current.map((p) => [p.id, p] as const));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((p): p is Project => !!p);
      const rest = current.filter((p) => !orderedIds.includes(p.id));
      return [...reordered, ...rest];
    });
    fetch('/projects/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orderedIds }),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); reloadProjects(); })
      .catch(() => setProjects(snapshot)); // rollback on failure
  }, [reloadProjects]);

  const handleOpenProject = useCallback((project: Project) => {
    setMainView('session');
    // NÃO passar cwd: o Claude Code corre SEMPRE em JOCA_Brain (JOCA_LOGIC_ROOT). O contexto do projecto
    // vem do /resume "path" (resumePath), não do cwd do shell. Ver memory/projects/joca.md.
    send({ type: 'create_session', resumePath: project.path, sessionName: project.name, projectId: project.id });
  }, [send]);

  const handleCreateProjectSkill = useCallback((project: Project, skillName: string) => {
    setMainView('session');
    const instruction = `Vamos criar uma skill. Para tal, usa o /create-skill para criar a skill "${skillName}" apenas para o projeto no path "${project.path}". Antes de iniciar, faz-me o questionário perguntando o que é e para que serve esta skill, e só depois de eu responder é que deves avançar com o ciclo de criação da skill.`;
    send({
      // Sem cwd: Claude Code corre SEMPRE em JOCA_Brain; contexto vem do resumePath/instrução (path no texto).
      type: 'create_session',
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

  // Remember where the user was so the Master's full-screen "back" button returns there.
  const prevViewRef = useRef<MainView>('dashboard');
  const handleShowMaster = useCallback(() => {
    reloadMasterBrain(); // refresh the header pill in case the provider/model changed in Settings
    setMainView((prev) => {
      if (prev !== 'master') prevViewRef.current = prev;
      return 'master';
    });
  }, [reloadMasterBrain]);

  const handleSendMaster = useCallback((text: string) => {
    setMasterLog((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text }]);
    setMasterPending((n) => n + 1);
    setMasterActivity('A pensar…');
    send({ type: 'master_message', text });
  }, [send]);

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
  // In an explicit project dashboard, the clicked project wins. Otherwise (session/global
  // dashboard) fall back to the active session's project for right-panel memory context.
  const contextProjectId = mainView === 'project'
    ? activeProjectId
    : (activeSession?.projectId ?? activeProjectId);

  const rightSlotExpanded = rightPanel !== null;
  const expandedRightSlotSize = Math.round(Math.max(408, Math.min(viewportWidth * 0.32, 424)));
  const rightSlotSize = rightSlotExpanded ? `${expandedRightSlotSize}px` : '54px';

  useEffect(() => {
    if (contextProjectId) updateProjectMemory(contextProjectId, { rightPanel });
  }, [contextProjectId, rightPanel, updateProjectMemory]);

  // Master runs full-screen: just the chat + a back button, no sidebar / right workspace.
  if (mainView === 'master') {
    const workersWorking = sessions.filter((s) => s.status === 'working').length;
    const cl = rateLimits?.claude;
    const masterStats = {
      workersWorking,
      workersIdle: sessions.length - workersWorking,
      sessionsTotal: sessions.length,
      projects: projects.length,
      limits: cl
        ? {
            fiveHour: cl.five_hour ? { pct: cl.five_hour.used_pct ?? null, resetAt: cl.five_hour.resets_at ?? null } : null,
            sevenDay: cl.seven_day ? { pct: cl.seven_day.used_pct ?? null, resetAt: cl.seven_day.resets_at ?? null } : null,
            sonnet: cl.sonnet_seven_day ? { pct: cl.sonnet_seven_day.used_pct ?? null, resetAt: cl.sonnet_seven_day.resets_at ?? null } : null,
          }
        : null,
    };
    return (
      <div className="master-fullscreen">
        <MasterChatView
          entries={masterLog}
          pending={masterPending}
          activity={masterActivity}
          brainLabel={masterBrainLabel}
          onSend={handleSendMaster}
          onBack={() => setMainView(prevViewRef.current)}
          stats={masterStats}
          tasksRefreshKey={tasksRefresh}
        />
      </div>
    );
  }

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
        onShowMaster={handleShowMaster}
        onShowAutomations={() => setMainView('automations')}
        onShowTasks={() => setMainView('tasks')}
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
        onArchiveProject={handleArchiveProject}
        onReorderProjects={handleReorderProjects}
      />

      <div className="main-area">
        {mainView === 'automations' ? (
          <AutomationsView refreshKey={automationsRefresh} />
        ) : mainView === 'tasks' ? (
          <TasksView refreshKey={tasksRefresh} projects={projects} />
        ) : mainView === 'dashboard' || mainView === 'project' ? (
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
            rateLimits={rateLimits}
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
          if (contextProjectId) {
            // Read the freshest openFiles from the ref (not the render closure) so rapid
            // consecutive previews accumulate instead of dropping entries.
            const current = projectMemoryRef.current[contextProjectId];
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
        <CommandPalette
          sessions={sessions}
          projects={projects}
          jocaItems={jocaItems}
          onClose={() => setCommandPaletteOpen(false)}
          onShowDashboard={() => { setMainView('dashboard'); setCommandPaletteOpen(false); }}
          onOpenFiles={() => { setRightPanel('files'); setCommandPaletteOpen(false); }}
          onOpenToolkit={() => { setRightPanel('toolkit'); loadCommandPalette(); setCommandPaletteOpen(false); }}
          onOpenSettings={() => { setRightPanel('settings'); setCommandPaletteOpen(false); }}
          onSelectSession={(id) => { handleSwitchSession(id); setCommandPaletteOpen(false); }}
          onNewSession={() => { handleNewSession(); setCommandPaletteOpen(false); }}
          onShowProject={(id) => { handleShowProject(id); setCommandPaletteOpen(false); }}
          onCreateProject={() => { handleCreateProjectPrompt(); setCommandPaletteOpen(false); }}
          onInsert={insertCommandDraft}
        />
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

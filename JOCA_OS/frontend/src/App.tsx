import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import SessionSidebar from './components/SessionSidebar';
import CreateProjectModal from './components/CreateProjectModal';
import ToastNotification, { type ToastItem } from './components/ToastNotification';
import { type WorkflowState, emptyWorkflow, parseWorkflowLine } from './components/WorkflowPanel';
import SettingsPanel from './components/SettingsPanel';
import DashboardView, { type RateLimits } from './components/DashboardView';
import { COMANDO_SAVE } from './components/dashboard/SaveAll';
import ProjectWorkspace from './components/project-workspace/ProjectWorkspace';
import TerminalView from './components/TerminalView';
import CommandPalette from './components/CommandPalette';
import AgentsView from './components/AgentsView';
import RecoveredSessionsNotice from './components/RecoveredSessionsNotice';
import { useSessionSocket } from './hooks/useSessionSocket';
import { useRecoveredSessions } from './hooks/useRecoveredSessions';
import { useAutoTheme } from './hooks/useAutoTheme';
import { ensureNotificationPermission, notify, setNotificationTargetHandler, type NotificationTarget } from './lib/notify';
import StatusBar from './components/StatusBar';
import type { AppNotification, JocaItems, JocaLogicInfo, MainView, Project, ProjectGroup, ProjectIcon, ProjectMemory, RuntimeInfo, SessionInfo, TerminalRef } from './types';
import './components/sidebar-icons.css';

// Value equality for WorkflowState — avoids a setState (and a global re-render) when the parsed
// output produces a state identical to the previous one (e.g. the same marker repeated).
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

// Hard cap for the per-session line-assembly buffer. Output that never emits '\n' (spinners and
// progress bars that only rewrite the line with '\r') would otherwise grow forever and leak memory
// for as long as the session lives. When the cap is hit we drop the PREFIX and keep the tail — the
// tail is what completes the next line.
const OUTPUT_BUFFER_MAX = 64 * 1024;

const SERVICE_CONNECTIONS: ServiceConnection[] = [
  { id: 'filesystem', name: 'Local files', status: 'connected', scope: 'Real reading, preview and drag to the terminal' },
  { id: 'terminal', name: 'Terminals', status: 'connected', scope: 'One real PTY per session' },
];

// Selector for "what is reachable by Tab" — used by the focus trap of the Settings modal.
const FOCUSAVEIS = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [, setActivityEvents] = useState<{ id: string; title: string; detail: string; timestamp: number }[]>([]);
  // Settings moved from the right rail (removed) to a modal, opened by the icon at the bottom
  // of the left sidebar.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsOpenerRef = useRef<HTMLElement | null>(null);

  /**
   * A dialog with `aria-modal` whose focus stays on the trigger is worse than none: whoever
   * navigates by keyboard walks the whole app BEHIND it and never gets in. Three things missing,
   * and the standard requires all three: enter on open, trap Tab, return focus on close.
   */
  useEffect(() => {
    if (!settingsOpen) return;
    settingsOpenerRef.current = document.activeElement as HTMLElement;
    const modal = settingsRef.current;
    requestAnimationFrame(() => {
      const alvo = modal?.querySelector<HTMLElement>(FOCUSAVEIS);
      (alvo ?? modal)?.focus();
    });
    const prendeTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modal) return;
      const focaveis = [...modal.querySelectorAll<HTMLElement>(FOCUSAVEIS)].filter((el) => el.offsetParent !== null);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primeiro || activo === modal)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', prendeTab, true);
    return () => {
      document.removeEventListener('keydown', prendeTab, true);
      // Return focus to whoever opened it: without this, closing leaves focus on <body> and the
      // user restarts navigation from the top of the app.
      settingsOpenerRef.current?.focus?.();
    };
  }, [settingsOpen]);
  const [mainView, setMainView] = useState<MainView>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [jocaItems, setJocaItems] = useState<JocaItems | null>(null);
  const [projectMemory, setProjectMemory] = useState<Record<string, ProjectMemory>>({});

  const [jocaLogicInfo, setJocaLogicInfo] = useState<JocaLogicInfo | null>(null);

  // Claude/Codex/Gemini usage limits, from GET /rate-limits. Single source — passed to DashboardView by prop.
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);

  /**
   * What is written in the message box belongs TO EACH TERMINAL, not to the app.
   *
   * It used to be a single, shared string: writing here and jumping to another project took the
   * text along — and, worse, a distracted Enter sent it to the wrong CLI. Stored by `sessionId`,
   * each conversation keeps its own draft and finds it again on return. Cleared when the session
   * closes (`handleCloseSession`), otherwise the map grows forever with ids that no longer exist.
   */
  const [terminalDrafts, setTerminalDrafts] = useState<Record<string, string>>({});
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [, setUnreadIds] = useState<Set<string>>(new Set());
  const [, setViewportWidth] = useState(() => window.innerWidth);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);

  /**
   * The browser tab says WHICH installation this is. With two running at the same time (one for
   * work and one for development) the tabs were indistinguishable — and the title was hardcoded
   * as "JOCA - DEV" in `index.html`, so it lied in a production build.
   * Without `JOCA_ENV` in the backend it is just "JOCA".
   */
  useEffect(() => {
    document.title = runtimeInfo?.env ? `JOCA · ${runtimeInfo.env}` : 'JOCA';
  }, [runtimeInfo?.env]);

  // New UX States
  // pinOutput UI removed; the ref stays because useSessionSocket consumes it.
  const pinOutputRef = useRef(false);

  // Workflow state — per-session parsed from terminal output
  const [, setWorkflowStates] = useState<Map<string, WorkflowState>>(new Map());
  const workflowRef = useRef<Map<string, WorkflowState>>(new Map());
  const outputBuffers = useRef<Map<string, string>>(new Map());

  // Refs
  const termRefs = useRef<Map<string, TerminalRef>>(new Map());
  const sessionsRef = useRef<SessionInfo[]>([]);
  const activeIdRef = useRef<string | null>(null);

  const projectMemoryRef = useRef(projectMemory);
  // Project list read by the notification resolver. By ref and not by the render closure so the
  // handler stays stable — it is registered once in the `lib/notify` module.
  const projectsRef = useRef(projects);

  // `false` = the next session created does not steal the screen. It lives here because what
  // consumes it is the WebSocket message router, and what lowers it is the "+" of the agent list.
  const focusNewSessionRef = useRef(true);
  // Mirror of the active project for the handlers that run outside the render (the Remote
  // Control button opens the terminal in the project you are in).
  const activeProjectIdRef = useRef<string | null>(null);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { projectMemoryRef.current = projectMemory; }, [projectMemory]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const processOutput = useCallback((sessionId: string, data: string) => {
    const buf = (outputBuffers.current.get(sessionId) ?? '') + data;
    const newlineIdx = buf.lastIndexOf('\n');
    if (newlineIdx === -1) {
      // No newline yet: keep only the tail so a '\r'-only stream can't grow the buffer unbounded.
      outputBuffers.current.set(sessionId, buf.length > OUTPUT_BUFFER_MAX ? buf.slice(-OUTPUT_BUFFER_MAX) : buf);
      return;
    }
    const toProcess = buf.slice(0, newlineIdx);
    const rest = buf.slice(newlineIdx + 1);
    outputBuffers.current.set(sessionId, rest.length > OUTPUT_BUFFER_MAX ? rest.slice(-OUTPUT_BUFFER_MAX) : rest);
    const lines = toProcess.split('\n');
    const prev = workflowRef.current.get(sessionId) ?? emptyWorkflow;
    let current = prev;
    for (const line of lines) {
      const update = parseWorkflowLine(line, current);
      if (update) current = update;
    }
    // Only re-renders if the state actually changed (not for output that produces the same state).
    if (current !== prev && !workflowEquals(current, prev)) {
      workflowRef.current.set(sessionId, current);
      setWorkflowStates(new Map(workflowRef.current));
    }
  }, []);

  const reloadProjects = useCallback(() => {
    fetch('/projects').then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  const reloadProjectGroups = useCallback(() => {
    fetch('/project-groups').then((r) => r.json()).then(setProjectGroups).catch(() => {});
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

  const reloadRateLimits = useCallback(() => {
    fetch('/rate-limits').then((r) => (r.ok ? r.json() : null)).then(setRateLimits).catch(() => {});
  }, []);

  useEffect(() => {
    ensureNotificationPermission(); // ask once for OS desktop-notification permission
    reloadProjects();
    reloadProjectGroups();
    reloadRuntime();
    reloadProjectMemory();
    reloadJocaLogic();
    reloadRateLimits();

    // Poll /runtime + /rate-limits only while the tab is VISIBLE. In a background tab (or a PWA
    // sent to the background on mobile) the timer would keep burning battery and data on results
    // nobody can see. On becoming visible again we refetch immediately so the UI is never stale.
    let timer: number | null = null;
    const poll = () => { reloadRuntime(); reloadRateLimits(); };
    const startPolling = () => {
      if (timer !== null) return;
      timer = window.setInterval(poll, 10_000);
    };
    const stopPolling = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) { stopPolling(); return; }
      poll();
      startPolling();
    };
    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reloadProjectMemory, reloadProjects, reloadProjectGroups, reloadRuntime, reloadJocaLogic, reloadRateLimits]);

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
    // With the target: clicking the OS notification brings the window to the front AND opens this terminal.
    notify('JOCA — Finished', session.name, { sessionId: session.id });
  }, []);

  // Toast from a persistent notification marked `priority:'action'` — someone is blocked waiting
  // for an answer. Until now only finished sessions produced a toast, and a decision request only
  // showed up if the inbox was open.
  const addNotificationToast = useCallback((n: AppNotification) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === n.id)) return prev; // the same event is not worth two toasts
      return [...prev, {
        id: n.id,
        title: n.title,
        sessionName: n.text.replace(/\s+/g, ' ').trim().slice(0, 120),
        // There may be no session: the real target goes in `target`.
        sessionId: n.meta?.sessionId ?? '',
        timestamp: n.ts,
        priority: 'action',
        target: n.meta,
      }];
    });
  }, []);

  // Conversations that died in a backend restart. The `sessions_list` that arrives next prunes
  // them (and rightly so — it is the server's authoritative snapshot); this is what is left of
  // them so we can explain what happened and read what they had written.
  const recovered = useRecoveredSessions();

  // WebSocket lifecycle (connect / reconnect / message routing) lives in the hook; it returns a
  // stable `send`. All parent state it touches is passed in and read through a ref, so the socket
  // is created once on mount.
  const { send } = useSessionSocket({
    setSessions, setActiveId, setActivityEvents, setMainView, setWorkflowStates,
    setUnreadIds, setActivatedIds,
    termRefs, outputBuffers, workflowRef, sessionsRef, activeIdRef, pinOutputRef, focusNewSessionRef,
    activateSession, addToast, addNotificationToast, processOutput, reloadProjects, reloadProjectMemory,
    onServerBoot: recovered.noteBootId,
  });

  // Light/dark/dynamic: in dynamic mode it switches by itself at the set time, with the app open.
  useAutoTheme();

  const handleNewSession = useCallback(() => {
    send({ type: 'create_session' });
  }, [send]);

  // New session on an alternative CLI (codex/agy/opencode) — used by the TerminalView dropdown.
  const handleNewSessionWithCli = useCallback((cli: string) => {
    if (!cli || cli === 'claude') send({ type: 'create_session' });
    else send({ type: 'create_session', cli });
    setMainView('session');
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
    // The draft dies with the conversation — without this the map piles up closed ids until the refresh.
    setTerminalDrafts((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _fechado, ...resto } = prev;
      return resto;
    });
  }, [send]);

  const handleInterruptSession = useCallback(() => {
    if (activeId) send({ type: 'interrupt_session', sessionId: activeId });
  }, [activeId, send]);

  const handleRestartSession = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const { name, projectId } = session;
    // Restarting repeats the canonical startup: it is born in JOCA_Brain, tied to the same
    // project. The project context is NOT reloaded by itself — the resume is manual, via the bar button.
    send({ type: 'close_session', sessionId: id });
    send({ type: 'create_session', sessionName: name, projectId });
  }, [sessions, send]);

  const handleInput = useCallback((sessionId: string, data: string) => {
    send({ type: 'input', sessionId, data });
    setUnreadIds((prev) => { if (!prev.has(sessionId)) return prev; const n = new Set(prev); n.delete(sessionId); return n; });
  }, [send]);

  // Dashboard "Save all". What decides WHICH conversations get it is `planoSaveAll` (dashboard/SaveAll);
  // here the command is only written into each one, by the same route the owner's own typing enters by.
  const handleSaveAllSessions = useCallback((sessionIds: string[]) => {
    sessionIds.forEach((id) => handleInput(id, COMANDO_SAVE));
  }, [handleInput]);

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

  // Choosing a terminal INSIDE the project view: changes the active one and mounts it, but does
  // not switch view — `handleSwitchSession` below would leave the project for the session's full screen.
  const handleSelectProjectTerminal = useCallback((id: string) => {
    setActiveId(id);
    activateSession(id);
    if (termRefs.current.has(id)) send({ type: 'get_buffer', sessionId: id });
  }, [send, activateSession]);

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

  // Mirrors the removeProject that used to live only in SessionSidebar: it first closes the
  // project's sessions (avoids orphan PTYs), only then deletes. If the removed project is the one
  // open in the workspace, it goes back to the global dashboard instead of leaving ProjectWorkspace stuck.
  const handleRemoveProject = useCallback((id: string) => {
    sessions.filter((s) => s.projectId === id).forEach((s) => handleCloseSession(s.id));
    fetch(`/projects/${id}`, { method: 'DELETE' })
      .then(() => {
        reloadProjects();
        setActiveProjectId((current) => {
          if (current !== id) return current;
          setMainView('dashboard');
          return null;
        });
      })
      .catch(() => {});
  }, [sessions, handleCloseSession, reloadProjects]);

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

  // Dropping one project's dot onto another's: if either of the two already has a group, the
  // other joins that group; otherwise a new group is created with both. Purely visual (see
  // project-groups-store.ts in the backend).
  const handleGroupProjects = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const dragged = projects.find((p) => p.id === draggedId);
    const target = projects.find((p) => p.id === targetId);
    if (!dragged || !target) return;
    const existingGroupId = target.groupId || dragged.groupId;
    const joiningId = target.groupId ? draggedId : targetId;
    const request = existingGroupId
      ? fetch(`/project-groups/${existingGroupId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: joiningId }),
      })
      : fetch('/project-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: [draggedId, targetId] }),
      });
    request
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .then(() => { reloadProjects(); reloadProjectGroups(); })
      .catch(() => {});
  }, [projects, reloadProjects, reloadProjectGroups]);

  const handleUngroupProject = useCallback((id: string) => {
    fetch(`/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: null }),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .then(() => { reloadProjects(); reloadProjectGroups(); })
      .catch(() => {});
  }, [reloadProjects, reloadProjectGroups]);

  // `icon: null` is what CLEARS the icon in the backend — `Partial<ProjectGroup>` alone would
  // only allow `undefined`, which JSON.stringify omits and would leave the icon intact.
  const handleUpdateProjectGroup = useCallback((id: string, patch: Partial<Omit<ProjectGroup, 'icon'>> & { icon?: ProjectIcon | null }) => {
    fetch(`/project-groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .then(() => reloadProjectGroups())
      .catch(() => {});
  }, [reloadProjectGroups]);

  const handleOpenProject = useCallback((project: Project) => {
    setMainView('session');
    send({ type: 'create_session', sessionName: project.name, projectId: project.id });
  }, [send]);

  const handleCreateProjectSkill = useCallback((project: Project, skillName: string) => {
    setMainView('session');
    const instruction = `We are going to create a skill. To do so, use /create-skill to create the skill "${skillName}" only for the project at the path "${project.path}". Before starting, run the questionnaire asking me what this skill is and what it is for, and only after I answer should you go ahead with the skill creation cycle.`;
    send({
      type: 'create_session',
      sessionName: `Create Skill: ${skillName}`,
      projectId: project.id,
      initialInput: instruction,
    });
  }, [send]);


  const handleShowProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setMainView('project');
  }, []);

  /**
   * Opening a session from the overview: if it belongs to a project, its place is THAT project's
   * workspace, with the respective tab already selected — not the full screen, which rips the
   * terminal out of the context it lives in (the other tabs, the project).
   *
   * Loose sessions (without a project) have no workspace to fit in: those keep opening in full.
   */
  const handleOpenSessionInContext = useCallback((sessionId: string) => {
    const alvo = sessionsRef.current.find((x) => x.id === sessionId);
    const temProjecto = alvo?.projectId && projectsRef.current.some((p) => p.id === alvo.projectId);
    if (!temProjecto) { handleSwitchSession(sessionId); return; }
    setActiveProjectId(alvo!.projectId!);
    setMainView('project');
    setActiveId(sessionId);
    activateSession(sessionId);
    if (termRefs.current.has(sessionId)) send({ type: 'get_buffer', sessionId });
  }, [handleSwitchSession, activateSession, send]);

  // New agent from the "+" of the Agents section: it is born in the project and does NOT throw the
  // user into full screen (the ref is consumed once by the WebSocket router and returns to `true` by itself).
  const handleAddProjectAgent = useCallback((project: Project, cli?: string) => {
    focusNewSessionRef.current = false;
    // WITHOUT `cwd`: the terminal is born in JOCA_Brain (backend default) and receives the project
    // context through the profile's resume command (`/resume "<folder>"` in claude, `resume` in the others).
    send({
      type: 'create_session', projectId: project.id,
      ...(cli && cli !== 'claude' ? { cli } : {}),
    });
  }, [send]);

  // New agent without a project, from the global Agents view.
  const handleNewLooseAgent = useCallback((cli: string) => {
    focusNewSessionRef.current = false;
    if (!cli || cli === 'claude') send({ type: 'create_session' });
    else send({ type: 'create_session', cli });
  }, [send]);

  /**
   * The SINGLE navigation contract for notifications, shared by the channels that remain (toast
   * and OS notification — the rail panel was removed). What knows how to navigate is the App; the
   * channels only carry the `meta`.
   *
   * Precedence: session → project (from the most specific to the broadest).
   * A dead reference (closed session, deleted project) neither blows up nor throws you somewhere at
   * random: it falls to the next level and, if there is none, you stay where you are.
   */
  const handleOpenNotificationTarget = useCallback((target: NotificationTarget | undefined) => {
    if (!target) return;
    if (target.sessionId && sessionsRef.current.some((s) => s.id === target.sessionId)) {
      handleSwitchSession(target.sessionId);
      return;
    }
    if (target.projectId && projectsRef.current.some((p) => p.id === target.projectId)) {
      handleShowProject(target.projectId);
    }
  }, [handleShowProject, handleSwitchSession]);

  // The WebSocket message router (which is not a component) fires OS notifications; the target
  // handler lives in a module so it can be reached from there.
  useEffect(() => {
    setNotificationTargetHandler(handleOpenNotificationTarget);
    return () => setNotificationTargetHandler(null);
  }, [handleOpenNotificationTarget]);

  const loadCommandPalette = useCallback(() => {
    if (jocaItems) return;
    fetch('/joca-items').then((r) => r.json()).then(setJocaItems).catch(() => setJocaItems({ commands: [], skills: [], agents: [] }));
  }, [jocaItems]);

  // Draft of the open conversation. With no active session there is no box to write in, hence an empty string.
  const terminalDraft = activeId ? terminalDrafts[activeId] ?? '' : '';
  const setTerminalDraft = useCallback((draft: string) => {
    if (!activeId) return;
    setTerminalDrafts((prev) => ({ ...prev, [activeId]: draft }));
  }, [activeId]);

  const insertCommandDraft = useCallback((text: string) => {
    if (!activeId) return;
    setTerminalDrafts((prev) => {
      const actual = prev[activeId] ?? '';
      return { ...prev, [activeId]: actual ? `${actual} ${text}` : text };
    });
    setCommandPaletteOpen(false);
  }, [activeId]);

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
      // Escape closes Settings. After the palette deliberately: with both open, the palette is
      // the one on top and closes first.
      if (event.key === 'Escape' && settingsOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSettingsOpen(false);
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
      if (key === '.') {
        event.preventDefault();
        handleInterruptSession();
      }
    };
    // Capture phase: this listener fires BEFORE any bubble-phase listener (e.g. FilePreview's).
    // Combined with stopImmediatePropagation above, ensures palette Escape never leaks to other modals.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handleInterruptSession, loadCommandPalette, commandPaletteOpen, settingsOpen]);

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
  // dashboard) fall back to the active session's project.
  const contextProjectId = mainView === 'project'
    ? activeProjectId
    : (activeSession?.projectId ?? activeProjectId);

  return (
    // The footer is permanent in every view, so `.app` (which is still the sidebar/content/panel
    // row) is wrapped in a column and the StatusBar comes in as the last child.
    <div className="app-shell">
    <div className="app">
      <SessionSidebar
        envLabel={runtimeInfo?.env}
        sessions={sessions}
        projects={projects}
        projectGroups={projectGroups}
        mainView={mainView}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onShowDashboard={() => setMainView('dashboard')}
        onShowAgents={() => setMainView('agents')}
        onShowProject={handleShowProject}
        onOpenSession={handleOpenSessionInContext}
        onRenameSession={handleRenameSession}
        onClose={handleCloseSession}
        onNew={handleNewSession}
        onCreateProject={handleCreateProjectPrompt}
        onOpenSettings={() => setSettingsOpen(true)}
        onInput={handleInput}
        onRenameProject={handleRenameProject}
        onArchiveProject={handleArchiveProject}
        onReorderProjects={handleReorderProjects}
        onGroupProjects={handleGroupProjects}
        onUngroupProject={handleUngroupProject}
        onRemoveProject={handleRemoveProject}
        onRenameGroup={(id, name) => handleUpdateProjectGroup(id, { name })}
        onSetGroupIcon={(id, icon) => handleUpdateProjectGroup(id, { icon })}
        onToggleGroupCollapsed={(id, collapsed) => handleUpdateProjectGroup(id, { collapsed })}
      />

      <div className="main-area">
        {mainView === 'agents' ? (
          // All the agents of all the projects in a single place.
          <AgentsView
            sessions={sessions}
            projects={projects}
            onOpenSession={handleOpenSessionInContext}
            onCloseSession={handleCloseSession}
            onNewSession={handleNewLooseAgent}
            onOpenProject={(project) => handleShowProject(project.id)}
            onRenameSession={handleRenameSession}
          />
        ) : mainView === 'project' ? (
          // A project's view: terminals. DashboardView handles the global overview.
          <ProjectWorkspace
            project={projects.find((p) => p.id === contextProjectId) ?? null}
            projects={projects}
            sessions={sessions}
            onEditProject={handleEditProject}
            onSelectTerminal={handleSelectProjectTerminal}
            onRenameSession={handleRenameSession}
            onCloseSession={handleCloseSession}
            onAddAgent={handleAddProjectAgent}
            onRenameProject={handleRenameProject}
            onInput={handleInput}
            onResize={handleResize}
            onReady={handleTermReady}
            terminal={{
              activeId,
              activatedIds,
              terminalDraft,
              setTerminalDraft,
              terminalHistory,
              historyIndex,
              setHistoryIndex,
              projectMemory,
              onSaveSession: handleSave,
              onCompactSession: handleCompact,
              onInterruptSession: handleInterruptSession,
              onRestartSession: handleRestartSession,
              submitTerminalDraft,
              onOpenCommandPalette: () => { setCommandPaletteOpen(true); loadCommandPalette(); },
              termRefs,
              jocaItems,
              onLoadJocaItems: loadCommandPalette,
            }}
          />
        ) : mainView === 'dashboard' ? (
          <DashboardView
            projects={projects}
            sessions={sessions}
            jocaLogicInfo={jocaLogicInfo}
            rateLimits={rateLimits}
            onCreateProject={handleCreateProjectPrompt}
            onEditProject={handleEditProject}
            onShowProject={handleShowProject}
            onOpenProject={handleOpenProject}
            onSwitchSession={handleOpenSessionInContext}
            onNewSession={handleNewSession}
            onSaveAll={handleSaveAllSessions}
            onRenameProject={handleRenameProject}
            onRenameSession={handleRenameSession}
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
            selectedPath={null}
            onClearSelectedPath={() => {}}
            projects={projects}
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
            onNewSessionWithCli={handleNewSessionWithCli}
            jocaItems={jocaItems}
            onLoadJocaItems={loadCommandPalette}
          />
        )}
      </div>

      {commandPaletteOpen && (
        <CommandPalette
          sessions={sessions}
          projects={projects}
          jocaItems={jocaItems}
          onClose={() => setCommandPaletteOpen(false)}
          onShowDashboard={() => { setMainView('dashboard'); setCommandPaletteOpen(false); }}
          onOpenSettings={() => { setSettingsOpen(true); setCommandPaletteOpen(false); }}
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
        onOpenTarget={handleOpenNotificationTarget}
      />

      {/* Does not appear when there is nothing to recover: the component itself returns `null`
          with an empty snapshot (clean shutdown) or one already dismissed. */}
      <RecoveredSessionsNotice
        snapshot={recovered.snapshot}
        onDismiss={recovered.dismiss}
        onLoadTail={recovered.loadTail}
      />

      {settingsOpen && (
        // Settings live in a modal since the right rail went away: the panel is the same
        // component as always (with its header and its close), only where it is drawn changes.
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings" ref={settingsRef} tabIndex={-1}>
            <SettingsPanel
              runtimeInfo={runtimeInfo}
              jocaLogicInfo={jocaLogicInfo}
              sessions={sessions}
              projects={projects}
              services={SERVICE_CONNECTIONS}
              onReloadRuntime={reloadRuntime}
              onRunCommand={handleRunCommand}
              onClose={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      )}

      <CreateProjectModal
        open={createProjectOpen}
        project={editingProject}
        onClose={() => {
          setCreateProjectOpen(false);
          setEditingProject(null);
        }}
        onSaved={handleProjectSaved}
        onUpdateProject={handleUpdateProject}
        onCreateProjectSkill={handleCreateProjectSkill}
        onArchiveProject={handleArchiveProject}
        onRemoveProject={handleRemoveProject}
      />
    </div>

      {/* With `sessions` by props the footer makes no request — we already have them from the WebSocket. */}
      <StatusBar
        rateLimits={rateLimits}
        sessions={sessions}
      />
    </div>
  );
}

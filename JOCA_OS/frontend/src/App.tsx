import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import SessionSidebar from './components/SessionSidebar';
import CreateProjectModal from './components/CreateProjectModal';
import FilePreview from './components/FilePreview';
import ToastNotification, { type ToastItem } from './components/ToastNotification';
import { type WorkflowState, emptyWorkflow, parseWorkflowLine } from './components/WorkflowPanel';
import RightWorkspace from './components/RightWorkspace';
import DashboardView, { type RateLimits } from './components/DashboardView';
import ProjectWorkspace from './components/project-workspace/ProjectWorkspace';
import GlobalManagerView from './components/GlobalManagerView';
import TerminalView from './components/TerminalView';
import { AutomationsView } from './components/AutomationsView';
import { TasksView } from './components/TasksView';
import CommandPalette from './components/CommandPalette';
import AgentsView from './components/AgentsView';
import { useSessionSocket } from './hooks/useSessionSocket';
import { useAutoTheme } from './hooks/useAutoTheme';
import { ensureNotificationPermission, notify, setNotificationTargetHandler, type NotificationTarget } from './lib/notify';
import StatusBar from './components/StatusBar';
import type { AppNotification, JocaItems, JocaLogicInfo, MainView, Project, ProjectGroup, ProjectIcon, ProjectMemory, RightPanel, RuntimeInfo, SessionInfo, TerminalRef, ToolkitFilter, ToolkitRegistryItem, ToolkitType } from './types';
import './components/sidebar-icons.css';

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

// Hard cap for the per-session line-assembly buffer. Output that never emits '\n' (spinners and
// progress bars that only rewrite the line with '\r') would otherwise grow forever and leak memory
// for as long as the session lives. When the cap is hit we drop the PREFIX and keep the tail — the
// tail is what completes the next line.
const OUTPUT_BUFFER_MAX = 64 * 1024;

const SERVICE_CONNECTIONS: ServiceConnection[] = [
  { id: 'filesystem', name: 'Local Files', status: 'connected', scope: 'Leitura real, preview e drag para terminal' },
  { id: 'terminal', name: 'Terminal Sessions', status: 'connected', scope: 'PTY real por sessão' },
];

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
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
  const [notificationsRefresh, setNotificationsRefresh] = useState(0);
  // A contagem por ler vive AQUI e não dentro do painel: o badge do separador do rail (e o do
  // rodapé) têm de existir com o painel fechado, e nesse caso o componente está desmontado.
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Sobe a cada evento do gestor no WebSocket — o ManagerChat aberto refaz o GET do chat.
  const [managerRefresh, setManagerRefresh] = useState(0);
  // Chaves de gestor a meio de um turno (`__global__` = o Joca), alimentadas pelo WS `manager_busy`.
  // É a única fonte global deste estado — não há endpoint que o devolva de uma vez.
  const [busyManagerIds, setBusyManagerIds] = useState<string[]>([]);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [jocaItems, setJocaItems] = useState<JocaItems | null>(null);
  const [projectMemory, setProjectMemory] = useState<Record<string, ProjectMemory>>({});

  const [jocaLogicInfo, setJocaLogicInfo] = useState<JocaLogicInfo | null>(null);

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
  // Lista de projectos lida pelo resolvedor de notificações. Por ref e não pela closure do render
  // para o handler ficar estável — ele é registado uma vez no módulo `lib/notify`.
  const projectsRef = useRef(projects);

  // `false` = a próxima sessão criada não rouba o ecrã. Vive aqui porque quem o consome é o router
  // de mensagens do WebSocket, e quem o baixa é o "+" da lista de agentes.
  const focusNewSessionRef = useRef(true);

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
    // Só re-renderiza se o estado mudou de facto (não por output que produz o mesmo estado).
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
    // Com o destino: clicar na notificação do SO traz a janela para a frente E abre este terminal.
    notify('JOCA — Terminado', session.name, { sessionId: session.id });
  }, []);

  // Toast a partir de uma notificação persistente marcada `priority:'action'` — alguém está
  // bloqueado à espera de resposta. Até aqui só sessões terminadas geravam toast, e um pedido de
  // decisão só aparecia se a inbox estivesse aberta.
  const addNotificationToast = useCallback((n: AppNotification) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === n.id)) return prev; // o mesmo evento não vale dois toasts
      return [...prev, {
        id: n.id,
        title: n.title,
        sessionName: n.text.replace(/\s+/g, ' ').trim().slice(0, 120),
        // Pode não haver sessão (ex.: gestor preso): o destino real vai em `target`.
        sessionId: n.meta?.sessionId ?? '',
        timestamp: n.ts,
        priority: 'action',
        target: n.meta,
      }];
    });
  }, []);

  // WebSocket lifecycle (connect / reconnect / message routing) lives in the hook; it returns a
  // stable `send`. All parent state it touches is passed in and read through a ref, so the socket
  // is created once on mount.
  const { send } = useSessionSocket({
    setSessions, setActiveId, setActivityEvents, setMainView, setWorkflowStates,
    setUnreadIds, setActivatedIds, setAutomationsRefresh, setTasksRefresh, setNotificationsRefresh,
    setManagerRefresh, setBusyManagerIds,
    termRefs, outputBuffers, workflowRef, sessionsRef, activeIdRef, pinOutputRef, focusNewSessionRef,
    activateSession, addToast, addNotificationToast, processOutput, reloadProjects, reloadProjectMemory,
  });

  // Claro/escuro/dinâmico: no modo dinâmico troca sozinho à hora marcada, com a app aberta.
  useAutoTheme();

  // A contagem por ler tem de ser buscada AQUI, não pelo painel. Com o painel fechado o
  // `NotificationsInbox` está desmontado, portanto ninguém fazia este GET: o badge só aparecia
  // depois de se abrir o painel uma vez — exactamente quando já não era preciso. Verificado a
  // correr: 3 por ler e nenhum badge até ao primeiro clique.
  useEffect(() => {
    fetch('/notifications')
      .then((r) => r.json())
      .then((d) => setUnreadNotifications(typeof d?.unread === 'number' ? d.unread : 0))
      .catch(() => {});
  }, [notificationsRefresh]);

  const handleNewSession = useCallback(() => {
    send({ type: 'create_session' });
  }, [send]);

  // Nova sessão num CLI alternativo (codex/agy/opencode) — usado pelo dropdown do TerminalView.
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

  // Espelha o removeProject que vivia só na SessionSidebar: fecha primeiro as sessões do
  // projecto (evita PTYs órfãos), só depois apaga. Se o projecto removido é o que estava aberto
  // no workspace, volta ao dashboard global em vez de deixar o ProjectWorkspace num estado preso.
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

  // Largar a bolinha de um projecto sobre a de outro: se um dos dois já tem grupo, o outro
  // junta-se a esse grupo; senão cria-se um grupo novo com os dois. Puramente visual (ver
  // project-groups-store.ts no backend).
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

  // `icon: null` é o que LIMPA o ícone no backend — `Partial<ProjectGroup>` sozinho só permitiria
  // `undefined`, que o JSON.stringify omite e deixaria o ícone intacto.
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

  // Agente novo a partir do "+" da secção Agentes: nasce no projecto e NÃO atira o utilizador para
  // ecrã cheio (o ref é consumido uma vez pelo router do WebSocket e volta a `true` sozinho).
  const handleAddProjectAgent = useCallback((project: Project) => {
    focusNewSessionRef.current = false;
    send({ type: 'create_session', cwd: project.path, projectId: project.id });
  }, [send]);

  // Agente novo sem projecto, da vista global de Agentes.
  const handleNewLooseAgent = useCallback((cli: string) => {
    focusNewSessionRef.current = false;
    if (!cli || cli === 'claude') send({ type: 'create_session' });
    else send({ type: 'create_session', cli });
  }, [send]);

  /**
   * Contrato ÚNICO de navegação das notificações, partilhado pelos três canais (inbox do rail,
   * toast e notificação do SO). Quem sabe navegar é o App — os canais só transportam o `meta`.
   *
   * Precedência: sessão → tarefa → automação → projecto (do mais específico para o mais lato).
   * Uma referência morta (sessão fechada, projecto apagado) não rebenta nem atira para um sítio ao
   * calhar: cai para o nível seguinte e, não havendo nenhum, fica-se onde se está.
   */
  const handleOpenNotificationTarget = useCallback((target: NotificationTarget | undefined) => {
    if (!target) return;
    if (target.sessionId && sessionsRef.current.some((s) => s.id === target.sessionId)) {
      handleSwitchSession(target.sessionId);
      return;
    }
    // TODO: a TasksView ainda não abre uma tarefa por id — leva-se ao quadro, não ao detalhe.
    if (target.taskId) { setMainView('tasks'); return; }
    if (target.automationId) { setMainView('automations'); return; }
    if (target.projectId && projectsRef.current.some((p) => p.id === target.projectId)) {
      handleShowProject(target.projectId);
    }
  }, [handleShowProject, handleSwitchSession]);

  // O router de mensagens do WebSocket (que não é um componente) dispara notificações do SO; o
  // handler de destino vive num módulo para lhe ser alcançável.
  useEffect(() => {
    setNotificationTargetHandler(handleOpenNotificationTarget);
    return () => setNotificationTargetHandler(null);
  }, [handleOpenNotificationTarget]);

  // O inbox faz `useEffect(..., [unread, onUnreadChange])` — uma lambda nova a cada render
  // fá-lo-ia correr a cada render.
  const handleUnreadNotificationsChange = useCallback((n: number) => setUnreadNotifications(n), []);

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

  return (
    // O rodapé é permanente em todas as vistas, por isso envolve-se o `.app` (que continua a ser a
    // linha sidebar/conteúdo/painel) numa coluna e a StatusBar entra como último filho.
    <div className="app-shell">
    <div className="app">
      <SessionSidebar
        sessions={sessions}
        projects={projects}
        projectGroups={projectGroups}
        mainView={mainView}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onShowDashboard={() => setMainView('dashboard')}
        onShowAutomations={() => setMainView('automations')}
        onShowTasks={() => setMainView('tasks')}
        onShowJoca={() => setMainView('joca')}
        onShowAgents={() => setMainView('agents')}
        onShowProject={handleShowProject}
        onClose={handleCloseSession}
        onNew={handleNewSession}
        onOpenProject={handleOpenProject}
        onCreateProject={handleCreateProjectPrompt}
        onInput={handleInput}
        onRenameProject={handleRenameProject}
        onArchiveProject={handleArchiveProject}
        onReorderProjects={handleReorderProjects}
        onGroupProjects={handleGroupProjects}
        onUngroupProject={handleUngroupProject}
        onRenameGroup={(id, name) => handleUpdateProjectGroup(id, { name })}
        onSetGroupIcon={(id, icon) => handleUpdateProjectGroup(id, { icon })}
        onToggleGroupCollapsed={(id, collapsed) => handleUpdateProjectGroup(id, { collapsed })}
      />

      <div className="main-area">
        {mainView === 'joca' ? (
          <GlobalManagerView managerRefresh={managerRefresh} />
        ) : mainView === 'automations' ? (
          <AutomationsView refreshKey={automationsRefresh} />
        ) : mainView === 'tasks' ? (
          <TasksView refreshKey={tasksRefresh} projects={projects} />
        ) : mainView === 'agents' ? (
          // Todos os agentes de todos os projectos num sítio só. `managerRefresh` é a chave certa:
          // sobe a cada evento de sessão/gestor, que é exactamente quando a pool muda.
          <AgentsView
            sessions={sessions}
            projects={projects}
            onOpenSession={handleSwitchSession}
            onCloseSession={handleCloseSession}
            onNewSession={handleNewLooseAgent}
            onOpenProject={(project) => handleShowProject(project.id)}
            refreshKey={managerRefresh}
          />
        ) : mainView === 'project' ? (
          // A vista de projecto é agora o workspace do gestor (chat > tarefas > terminais); o
          // DashboardView continua a tratar só do panorama global de projectos.
          <ProjectWorkspace
            project={projects.find((p) => p.id === contextProjectId) ?? null}
            projects={projects}
            sessions={sessions}
            managerRefresh={managerRefresh}
            tasksRefresh={tasksRefresh}
            onEditProject={handleEditProject}
            onOpenProject={handleOpenProject}
            onSwitchSession={handleSwitchSession}
            onCloseSession={handleCloseSession}
            onAddAgent={handleAddProjectAgent}
            onPreviewFile={(path) => {
              setPreviewPath(path);
              setSelectedPath(path);
            }}
            onRenameProject={handleRenameProject}
            onInput={handleInput}
            onResize={handleResize}
            onReady={handleTermReady}
          />
        ) : mainView === 'dashboard' ? (
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
            onNewSessionWithCli={handleNewSessionWithCli}
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
        onPastePath={(p) => {
          // "Colar caminho" tem dois destinos possíveis. Com um chat de gestor à frente, o caminho
          // é um ANEXO (o ManagerChat escuta `joca:attach-path`); nas outras vistas é texto para o
          // terminal activo. Sem esta distinção, o caminho caía sempre num terminal que pode nem
          // estar visível.
          if (mainView === 'project' || mainView === 'joca') {
            window.dispatchEvent(new CustomEvent('joca:attach-path', { detail: p }));
            return;
          }
          if (activeId) handleInput(activeId, p);
        }}
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
        notificationsRefresh={notificationsRefresh}
        unreadNotifications={unreadNotifications}
        onUnreadNotificationsChange={handleUnreadNotificationsChange}
        onOpenNotificationTarget={handleOpenNotificationTarget}
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
        onOpenTarget={handleOpenNotificationTarget}
      />

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

      {/* Com `sessions` e `unreadNotifications` por props o rodapé não faz pedido nenhum — já
          temos os dois do WebSocket e do painel de notificações. */}
      <StatusBar
        rateLimits={rateLimits}
        sessions={sessions}
        busyManagerIds={busyManagerIds}
        unreadNotifications={unreadNotifications}
        onOpenInbox={() => setRightPanel('inbox')}
      />
    </div>
  );
}

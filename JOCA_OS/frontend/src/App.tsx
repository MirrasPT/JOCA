import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import SessionSidebar from './components/SessionSidebar';
import CreateProjectModal from './components/CreateProjectModal';
import ToastNotification, { type ToastItem } from './components/ToastNotification';
import { type WorkflowState, emptyWorkflow, parseWorkflowLine } from './components/WorkflowPanel';
import SettingsPanel from './components/SettingsPanel';
import DashboardView, { type RateLimits } from './components/DashboardView';
import ProjectWorkspace from './components/project-workspace/ProjectWorkspace';
import TerminalView from './components/TerminalView';
import CommandPalette from './components/CommandPalette';
import AgentsView from './components/AgentsView';
import { useSessionSocket } from './hooks/useSessionSocket';
import { useAutoTheme } from './hooks/useAutoTheme';
import { ensureNotificationPermission, notify, setNotificationTargetHandler, type NotificationTarget } from './lib/notify';
import StatusBar from './components/StatusBar';
import type { AppNotification, JocaItems, JocaLogicInfo, MainView, Project, ProjectGroup, ProjectIcon, ProjectMemory, RuntimeInfo, SessionInfo, TerminalRef } from './types';
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
  { id: 'filesystem', name: 'Ficheiros locais', status: 'connected', scope: 'Leitura real, pré-visualização e arrastar para o terminal' },
  { id: 'terminal', name: 'Terminais', status: 'connected', scope: 'Um PTY real por sessão' },
];

// Selector de "o que é alcançável por Tab" — usado pelo foco preso do modal de Definições.
const FOCUSAVEIS = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [, setActivityEvents] = useState<{ id: string; title: string; detail: string; timestamp: number }[]>([]);
  // As definições passaram do rail direito (removido) para um modal, aberto pelo ícone no fundo
  // da sidebar esquerda.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsOpenerRef = useRef<HTMLElement | null>(null);

  /**
   * Um diálogo com `aria-modal` cujo foco fica no gatilho é pior do que nenhum: quem navega por
   * teclado percorre a app inteira POR TRÁS dele e nunca lá entra. Três coisas em falta, e as três
   * são exigidas pelo padrão: entrar ao abrir, prender o Tab, devolver o foco ao fechar.
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
      // Devolver o foco a quem abriu: sem isto, fechar deixa o foco no <body> e o utilizador
      // recomeça a navegação do topo da app.
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

  // Claude/Codex/Gemini usage limits, from GET /rate-limits. Fonte única — passada ao DashboardView por prop.
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);

  /**
   * O que está escrito na caixa de mensagem é DE CADA TERMINAL, não da app.
   *
   * Era uma string só, partilhada: escrever aqui e saltar para outro projecto levava o texto
   * atrás — e, pior, um Enter distraído mandava-o ao CLI errado. Guardado por `sessionId`, cada
   * conversa guarda o seu rascunho e reencontra-o ao voltar. Limpo quando a sessão fecha
   * (`handleCloseSession`), senão o mapa cresce para sempre com ids que já não existem.
   */
  const [terminalDrafts, setTerminalDrafts] = useState<Record<string, string>>({});
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [, setUnreadIds] = useState<Set<string>>(new Set());
  const [, setViewportWidth] = useState(() => window.innerWidth);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);

  /**
   * O separador do browser diz QUAL instalação é. Com duas a correr ao mesmo tempo (uma de
   * trabalho e uma de desenvolvimento) os separadores eram indistinguíveis — e o título estava
   * cravado como "JOCA - DEV" no `index.html`, portanto mentia num build de produção.
   * Sem `JOCA_ENV` no backend fica só "JOCA".
   */
  useEffect(() => {
    document.title = runtimeInfo?.env ? `JOCA · ${runtimeInfo.env}` : 'JOCA';
  }, [runtimeInfo?.env]);

  // New UX States
  // pinOutput UI removida; o ref mantém-se porque o useSessionSocket o consome.
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
  // Lista de projectos lida pelo resolvedor de notificações. Por ref e não pela closure do render
  // para o handler ficar estável — ele é registado uma vez no módulo `lib/notify`.
  const projectsRef = useRef(projects);

  // `false` = a próxima sessão criada não rouba o ecrã. Vive aqui porque quem o consome é o router
  // de mensagens do WebSocket, e quem o baixa é o "+" da lista de agentes.
  const focusNewSessionRef = useRef(true);
  // Espelho do projecto activo para os handlers que correm fora do render (o botão de Remote
  // Control abre o terminal no projecto em que estás).
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
        // Pode não haver sessão: o destino real vai em `target`.
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
    setUnreadIds, setActivatedIds,
    termRefs, outputBuffers, workflowRef, sessionsRef, activeIdRef, pinOutputRef, focusNewSessionRef,
    activateSession, addToast, addNotificationToast, processOutput, reloadProjects, reloadProjectMemory,
  });

  // Claro/escuro/dinâmico: no modo dinâmico troca sozinho à hora marcada, com a app aberta.
  useAutoTheme();

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
    // O rascunho morre com a conversa — sem isto o mapa acumula ids fechados até ao refresh.
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
    // Reiniciar repete o arranque canónico: nasce no JOCA_Brain, ligado ao mesmo projecto. O
    // contexto do projecto NÃO é recarregado sozinho — o resume é manual, pelo botão da barra.
    send({ type: 'close_session', sessionId: id });
    send({ type: 'create_session', sessionName: name, projectId });
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

  // Escolher um terminal DENTRO da vista de projecto: muda o activo e monta-o, mas não troca de
  // vista — o `handleSwitchSession` abaixo faria sair do projecto para o ecrã cheio da sessão.
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
    send({ type: 'create_session', sessionName: project.name, projectId: project.id });
  }, [send]);

  const handleCreateProjectSkill = useCallback((project: Project, skillName: string) => {
    setMainView('session');
    const instruction = `Vamos criar uma skill. Para tal, usa o /create-skill para criar a skill "${skillName}" apenas para o projeto no path "${project.path}". Antes de iniciar, faz-me o questionário perguntando o que é e para que serve esta skill, e só depois de eu responder é que deves avançar com o ciclo de criação da skill.`;
    send({
      type: 'create_session',
      sessionName: `Criar Skill: ${skillName}`,
      projectId: project.id,
      initialInput: instruction,
    });
  }, [send]);


  const handleShowProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setMainView('project');
  }, []);

  /**
   * Abrir uma sessão a partir do panorama: se ela pertence a um projecto, o sítio dela é o
   * workspace DESSE projecto, com a tab respectiva já escolhida — não o ecrã cheio, que arranca o
   * terminal do contexto onde vive (as outras tabs, o projecto).
   *
   * Sessões soltas (sem projecto) não têm workspace onde caber: essas continuam a abrir inteiras.
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

  // Agente novo a partir do "+" da secção Agentes: nasce no projecto e NÃO atira o utilizador para
  // ecrã cheio (o ref é consumido uma vez pelo router do WebSocket e volta a `true` sozinho).
  const handleAddProjectAgent = useCallback((project: Project, cli?: string) => {
    focusNewSessionRef.current = false;
    // SEM `cwd`: o terminal nasce no JOCA_Brain (default do backend) e recebe o contexto do
    // projecto pelo comando de resume do perfil (`/resume "<pasta>"` no claude, `resume` nos outros).
    send({
      type: 'create_session', projectId: project.id,
      ...(cli && cli !== 'claude' ? { cli } : {}),
    });
  }, [send]);

  // Agente novo sem projecto, da vista global de Agentes.
  const handleNewLooseAgent = useCallback((cli: string) => {
    focusNewSessionRef.current = false;
    if (!cli || cli === 'claude') send({ type: 'create_session' });
    else send({ type: 'create_session', cli });
  }, [send]);

  /**
   * Contrato ÚNICO de navegação das notificações, partilhado pelos canais que sobraram (toast e
   * notificação do SO — o painel do rail foi removido). Quem sabe navegar é o App; os canais só
   * transportam o `meta`.
   *
   * Precedência: sessão → projecto (do mais específico para o mais lato).
   * Uma referência morta (sessão fechada, projecto apagado) não rebenta nem atira para um sítio ao
   * calhar: cai para o nível seguinte e, não havendo nenhum, fica-se onde se está.
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

  // O router de mensagens do WebSocket (que não é um componente) dispara notificações do SO; o
  // handler de destino vive num módulo para lhe ser alcançável.
  useEffect(() => {
    setNotificationTargetHandler(handleOpenNotificationTarget);
    return () => setNotificationTargetHandler(null);
  }, [handleOpenNotificationTarget]);

  const loadCommandPalette = useCallback(() => {
    if (jocaItems) return;
    fetch('/joca-items').then((r) => r.json()).then(setJocaItems).catch(() => setJocaItems({ commands: [], skills: [], agents: [] }));
  }, [jocaItems]);

  // Rascunho da conversa aberta. Sem sessão activa não há caixa onde escrever, logo string vazia.
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
      // Escape fecha as Definições. A seguir à palete de propósito: com as duas abertas, a palete
      // é a de cima e fecha primeiro.
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
    // O rodapé é permanente em todas as vistas, por isso envolve-se o `.app` (que continua a ser a
    // linha sidebar/conteúdo/painel) numa coluna e a StatusBar entra como último filho.
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
          // Todos os agentes de todos os projectos num sítio só.
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
          // Vista de um projecto: terminais. O DashboardView trata do panorama global.
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

      {settingsOpen && (
        // As definições vivem num modal desde que o rail direito saiu: o painel é o mesmo
        // componente de sempre (com o seu cabeçalho e o seu fechar), só muda onde é desenhado.
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Definições" ref={settingsRef} tabIndex={-1}>
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

      {/* Com `sessions` por props o rodapé não faz pedido nenhum — já as temos do WebSocket. */}
      <StatusBar
        rateLimits={rateLimits}
        sessions={sessions}
      />
    </div>
  );
}

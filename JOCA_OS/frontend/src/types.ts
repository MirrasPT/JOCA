export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin?: 'user' | 'auto';   // who spawned it: 'user' (UI) or 'auto' (automations/tasks worker)
  status: 'working' | 'idle';
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
}


export interface Project {
  id: string;
  name: string;
  path: string;
  color?: string;
  initialized?: boolean;
  githubRepo?: string;
  archived?: boolean;
  order?: number;
  /** Agrupamento visual na sidebar (categorias estilo Discord) — sem efeito no projecto em si. */
  groupId?: string;
  /** O que o projecto é, por palavras do utilizador — é isto que o gestor sabe sobre ele. */
  description?: string;
  /** `true` = já existe código na pasta; `false`/undefined = projecto a começar do zero. */
  hasCode?: boolean;
}

/** Um grupo/pasta de projectos na sidebar (espelha backend/src/project-groups-store.ts). */
export interface ProjectGroup {
  id: string;
  name: string;
  color?: string;
  order?: number;
  collapsed?: boolean;
}

// ── v4: gestor de projecto (chat + pool de workers) ───────────────────────────

export type ManagerRole = 'user' | 'manager' | 'system';

/** Uma mensagem da conversa com o gestor do projecto (espelha backend/src/manager/store.ts). */
export interface ManagerMessage {
  id: string;
  role: ManagerRole;
  text: string;
  ts: number;
  author?: string;
  costUsd?: number;
  /** Paths absolutos anexados a esta mensagem (imagem, vídeo, ficheiro). */
  attachments?: string[];
  /** Traço curto do que o gestor fez neste turno ("abriu worker de design", "criou a tarefa X"). */
  actions?: string[];
}

/** Um terminal real reutilizado pelo gestor para uma área do projecto (design, backend, …). */
export interface PooledWorker {
  sessionId: string;
  projectId: string;
  area: string;
  busy: boolean;
  lastUsedAt: number;
  currentJob?: string;
  status: 'working' | 'idle' | 'closed';
}

export interface ProjectMemory {
  projectId: string;
  color?: string;
  path?: string;
  recentSessions: string[];
  favoriteSkills: string[];
  favoriteAgents: string[];
  quickCommands: string[];
  openFiles: string[];
  rightPanel: 'files' | 'toolkit' | 'settings' | null;
  updatedAt: string;
}

export interface RuntimeInfo {
  home: string;
  shell: string;
  claudeBin: string;
  cwd: string;
  uptimeMs: number;
  port: number;
  sessionCount: number;
  projectCount: number;
}

export interface CliToolStatus {
  id: 'claude' | 'codex' | 'agy' | 'opencode';
  name: string;
  provider: string;
  binary: string;
  installed: boolean;
  path?: string;
  version?: string;
  authStatus: 'logged-in' | 'not-logged-in' | 'unknown';
  authDetail?: string;
  installCommand: string;
  loginCommand: string;
  updateCommand?: string;
}

export interface TerminalRef {
  write: (data: string) => void;
  reset: () => void;
  clear?: () => void;
  scrollToBottom?: () => void;
  fit?: () => void;
}

export interface ToolkitRegistryItem {
  name: string;
  insert: string;
  category?: string;
  path: string;
  description?: string;
}

export interface JocaItems {
  commands: ToolkitRegistryItem[];
  skills: ToolkitRegistryItem[];
  agents: ToolkitRegistryItem[];
}

export interface JocaLogicInfo {
  connected: boolean;
  path: string;
  skillCount: number;
  agentCount: number;
  commandCount: number;
  hasMemoryIndex: boolean;
  hasGraph: boolean;
  hasSoul: boolean;
}

// ── v3: inbox / runs / heartbeat / multi-CLI (mirrors backend stores) ─────────

export type NotificationKind = 'automation' | 'task_question' | 'session_done' | 'heartbeat' | 'system' | 'manager';

// 'action' = nada avança sem tu decidires; 'info' = aconteceu, não precisa de ti.
export type NotificationPriority = 'action' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  ts: number;
  read: boolean;
  priority?: NotificationPriority;
  count?: number;      // >1 → repetições do mesmo evento, agrupadas
  meta?: {
    sessionId?: string; taskId?: string; automationId?: string;
    projectId?: string; area?: string; groupKey?: string;
  };
}

export type RunKind = 'automation' | 'task' | 'heartbeat';
export type RunStatus = 'ok' | 'error' | 'timeout' | 'skipped';

export interface RunRecord {
  id: string;
  kind: RunKind;
  refId: string;
  name: string;
  projectId?: string;
  startedAt: number;
  endedAt: number;
  ms: number;
  status: RunStatus;
  summary: string;
  costUsd?: number;
  cli?: string;
  model?: string;
  retry?: number;
}

export interface RunStats {
  total: number;
  ok: number;
  error: number;
  costUsd: number;
  byKind: Partial<Record<RunKind, { total: number; ok: number; error: number; costUsd: number }>>;
}

export interface HeartbeatConfig {
  enabled: boolean;
  everyMinutes: number;                                 // >= 5
  activeHours?: { start: string; end: string } | null;  // "HH:MM" local; null = sempre activo
  model: string;
  scratch: string;
  lastRunAt?: number | null;
  lastDecision?: 'ok' | 'alert' | 'skipped' | 'error' | null;
  lastText?: string;
}

export interface CliProfileInfo {
  id: 'claude' | 'codex' | 'agy' | 'opencode';
  label: string;
  bin: string;
  available: boolean;
  startupSequence: boolean;
}

export type ToolkitType = 'commands' | 'skills' | 'agents';
export type ToolkitFilter = 'all' | ToolkitType;
export type MainView = 'dashboard' | 'project' | 'session' | 'automations' | 'tasks' | 'joca';
export type RightPanel = 'files' | 'toolkit' | 'settings' | null;

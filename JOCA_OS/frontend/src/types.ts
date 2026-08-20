export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin?: 'user' | 'auto';   // quem a criou: 'user' (UI) ou 'auto' (spawn programático, ex.: `joca open`)
  status: 'working' | 'idle';
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
}


/**
 * Ícone de um projecto ou grupo (espelha backend/src/project-store.ts).
 * `image` → `value` é o nome do ficheiro devolvido por `POST /icons`; renderiza-se em
 * `/icons/{value}`. `emoji` → `value` é o próprio emoji.
 * Sem ícone (undefined) a UI mostra as 2 primeiras letras do nome — ver `iconInitials`.
 */
export interface ProjectIcon {
  type: 'image' | 'emoji';
  value: string;
}

/** URL para desenhar um ícone de imagem. Só para `type === 'image'`. */
export function projectIconUrl(icon: ProjectIcon): string {
  return `/icons/${encodeURIComponent(icon.value)}`;
}

/** Fallback textual quando não há ícone: 2 primeiras letras do nome, em maiúsculas. */
export function iconInitials(name: string): string {
  return [...(name.trim() || '?')].slice(0, 2).join('').toUpperCase();
}

export interface Project {
  id: string;
  name: string;
  path: string;
  color?: string;
  icon?: ProjectIcon;
  initialized?: boolean;
  githubRepo?: string;
  archived?: boolean;
  order?: number;
  /** Agrupamento visual na sidebar (categorias estilo Discord) — sem efeito no projecto em si. */
  groupId?: string;
  /** O que o projecto é, por palavras do utilizador. */
  description?: string;
  /** `true` = já existe código na pasta; `false`/undefined = projecto a começar do zero. */
  hasCode?: boolean;
}

/** Um grupo/pasta de projectos na sidebar (espelha backend/src/project-groups-store.ts). */
export interface ProjectGroup {
  id: string;
  name: string;
  color?: string;
  icon?: ProjectIcon;
  order?: number;
  collapsed?: boolean;
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
  updatedAt: string;
}

export interface RuntimeInfo {
  home: string;
  shell: string;
  claudeBin: string;
  cwd: string;
  uptimeMs: number;
  port: number;
  /** Rótulo da instância (`JOCA_ENV`), ex. 'PRD' | 'DEV'. `null` = mostrar a versão. */
  env: string | null;
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

// ── v3: inbox / runs / multi-CLI (mirrors backend stores) ────────────────────

export type NotificationKind = 'session_done' | 'system';

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
    sessionId?: string;
    projectId?: string; area?: string; groupKey?: string;
  };
}


export interface CliProfileInfo {
  id: 'claude' | 'codex' | 'agy' | 'opencode';
  label: string;
  bin: string;
  available: boolean;
  startupSequence: boolean;
  /** Forma do comando de resume deste CLI: `/resume` no claude, `resume` nos outros. */
  resumeCmd?: string;
}

export type ToolkitType = 'commands' | 'skills' | 'agents';
export type ToolkitFilter = 'all' | ToolkitType;
/** `agents` = vista global de agentes (todos os projectos num sítio só). */
export type MainView = 'dashboard' | 'project' | 'session' | 'agents';

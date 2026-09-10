export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin?: 'user' | 'auto';   // who created it: 'user' (UI) or 'auto' (programmatic spawn, e.g. `joca open`)
  status: 'working' | 'idle';
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
}

/**
 * A conversation that DIED when the backend restarted. PTYs do not survive a server restart;
 * this is the snapshot left of it — enough to reopen it the same way and to read what it had
 * written (`GET /sessions/recovered/:id/tail`).
 */
export interface RecoveredSession {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  cli?: string;
  origin?: 'user' | 'auto';
  status?: 'working' | 'idle';
  /**
   * Terminal geometry when it died. It is what the saved output is repainted with: a TUI
   * (`claude`) draws by position, and reproducing it at another size breaks the drawing.
   * Absent = snapshot from a backend older than these fields; see `GEOMETRIA_FALLBACK`.
   */
  cols?: number;
  rows?: number;
  /** Size of the saved output. 0 (or absent) = there is nothing to read. */
  tailBytes?: number;
}

/**
 * The snapshot of the previous startup. `bootId` identifies THIS backend startup — it is the same
 * value that comes in the `sessions_list`, and it is its change that gives away a restart with the
 * app open. With no previous snapshot, `sessions` comes back empty.
 */
export interface RecoveredSnapshot {
  bootId: string;
  previousBootId?: string;
  /** When the snapshot was saved (epoch ms). */
  savedAt?: number;
  sessions: RecoveredSession[];
}


/**
 * Icon of a project or group (mirrors backend/src/project-store.ts).
 * `image` → `value` is the filename returned by `POST /icons`; it is rendered at
 * `/icons/{value}`. `emoji` → `value` is the emoji itself.
 * With no icon (undefined) the UI shows the first 2 letters of the name — see `iconInitials`.
 */
export interface ProjectIcon {
  type: 'image' | 'emoji';
  value: string;
}

/** URL to draw an image icon. Only for `type === 'image'`. */
export function projectIconUrl(icon: ProjectIcon): string {
  return `/icons/${encodeURIComponent(icon.value)}`;
}

/** Text fallback when there is no icon: the first 2 letters of the name, in uppercase. */
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
  /** Visual grouping in the sidebar (Discord-style categories) — no effect on the project itself. */
  groupId?: string;
  /** What the project is, in the user's own words. */
  description?: string;
  /** `true` = there is already code in the folder; `false`/undefined = a project starting from scratch. */
  hasCode?: boolean;
}

/** A group/folder of projects in the sidebar (mirrors backend/src/project-groups-store.ts). */
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
  /** Instance label (`JOCA_ENV`), e.g. 'PRD' | 'DEV'. `null` = show the version. */
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

// 'action' = nothing moves forward without you deciding; 'info' = it happened, it does not need you.
export type NotificationPriority = 'action' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  ts: number;
  read: boolean;
  priority?: NotificationPriority;
  count?: number;      // >1 → repeats of the same event, grouped
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
  /** Shape of this CLI's resume command: `/resume` in claude, `resume` in the others. */
  resumeCmd?: string;
}

export type ToolkitType = 'commands' | 'skills' | 'agents';
export type ToolkitFilter = 'all' | ToolkitType;
/** `agents` = global agents view (all projects in a single place). */
export type MainView = 'dashboard' | 'project' | 'session' | 'agents';

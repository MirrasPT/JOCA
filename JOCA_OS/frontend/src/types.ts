export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin?: 'user' | 'auto';   // who spawned it: 'user' (UI) or 'auto' (automations/tasks worker)
  status: 'working' | 'idle';
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
  id: 'claude' | 'codex' | 'agy';
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

export type ToolkitType = 'commands' | 'skills' | 'agents';
export type ToolkitFilter = 'all' | ToolkitType;
export type MainView = 'dashboard' | 'project' | 'session' | 'automations' | 'tasks';
export type RightPanel = 'files' | 'toolkit' | 'settings' | null;

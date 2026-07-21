// Persistence layer for projects, per-project memory, and UI settings — all JSON files under
// ../../data. Self-contained: paths derive from __dirname. Exports the generic readJsonFile/
// writeJsonFile helpers (reused by the knowledge-graph route) plus typed load/save functions.
import path from 'path';
import fs from 'fs';

export interface Project {
  id: string;
  name: string;
  path: string;
  color?: string;
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

export type LlmProvider = 'claude' | 'ollama';

export interface UiSettings {
  skipPermissions: boolean;
  optimizeProvider?: LlmProvider;  // SDK used by "Optimizar" (text rewrite); default claude
  optimizeModel?: string;          // model used by the "Optimizar" feature (text rewrite); default sonnet
  theme?: 'dark' | 'light';        // UI theme; default dark (undefined = dark)
}

export const DATA_DIR = path.join(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const PROJECT_MEMORY_FILE = path.join(DATA_DIR, 'project-memory.json');
const UI_SETTINGS_FILE = path.join(DATA_DIR, 'ui-settings.json');

const DEFAULT_UI_SETTINGS: UiSettings = { skipPermissions: false };

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T; } catch { return fallback; }
}

// Atomic write: write to a temp file then rename over the target. rename is atomic on the same
// volume, so a process kill (stop.bat / terminate) mid-write can never leave a half-written or
// "frozen" file that the next boot fails to parse. Generic over any string payload (JSON, md, jsonl).
export function writeFileAtomic(filePath: string, data: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

export function writeJsonFile<T>(filePath: string, data: T) {
  writeFileAtomic(filePath, JSON.stringify(data, null, 2));
}

export function loadUiSettings(): UiSettings {
  return { ...DEFAULT_UI_SETTINGS, ...readJsonFile<Partial<UiSettings>>(UI_SETTINGS_FILE, {}) };
}

export function saveUiSettings(settings: UiSettings) {
  writeJsonFile(UI_SETTINGS_FILE, settings);
}

export function loadProjects(): Project[] {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); }
  catch (e) {
    // Only a corrupt/locked existing file is a real problem — a missing file (first run) is normal.
    if (fs.existsSync(PROJECTS_FILE)) console.error('[project-store] could not read projects.json:', e);
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  writeJsonFile(PROJECTS_FILE, projects);
}

export function loadProjectMemory(): Record<string, ProjectMemory> {
  return readJsonFile<Record<string, ProjectMemory>>(PROJECT_MEMORY_FILE, {});
}

export function saveProjectMemory(memory: Record<string, ProjectMemory>) {
  writeJsonFile(PROJECT_MEMORY_FILE, memory);
}

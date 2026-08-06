// Persistence layer for projects, per-project memory, and UI settings — all JSON files under
// ../../data. Self-contained: paths derive from __dirname. Exports the generic readJsonFile/
// writeJsonFile helpers (reused by the knowledge-graph route) plus typed load/save functions.
import path from 'path';
import fs from 'fs';

// Ícone opcional de um projecto ou de um grupo. Duas formas só, porque são as duas que a UI sabe
// desenhar; sem ícone a UI cai nas 2 primeiras letras do nome (não há default a persistir).
//   'image' → `value` é o NOME do ficheiro em data/icons, sempre gerado pelo servidor (um UUID +
//             extensão). Nunca o nome que o cliente enviou — seria path traversal directo.
//   'emoji' → `value` é o próprio emoji (um único grapheme cluster).
export interface ProjectIcon {
  type: 'image' | 'emoji';
  value: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  color?: string;
  icon?: ProjectIcon;
  githubRepo?: string;
  archived?: boolean;
  order?: number;
  // Visual-only bundling in the sidebar (see project-groups-store.ts) — has no effect on the
  // project itself. undefined = not in any group.
  groupId?: string;
  // O que o projecto é, por palavras do dono. Entra no brief das tarefas deste projecto.
  // the closest thing it has to "what is this project and what are we trying to do".
  description?: string;
  // ⚠ Escrito pela UI mas hoje não lido por lógica nenhuma — ficou sem consumidor quando o
  // gestor de projecto foi removido.
  // is something to read.
  hasCode?: boolean;
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

export type LlmProvider = 'claude' | 'ollama';

export interface UiSettings {
  skipPermissions: boolean;
  optimizeProvider?: LlmProvider;  // SDK used by "Optimizar" (text rewrite); default claude
  optimizeModel?: string;          // model used by the "Optimizar" feature (text rewrite); default sonnet
  theme?: 'dark' | 'light';        // tema JÁ resolvido (legado + leitura rápida); default dark
  themeMode?: 'dark' | 'light' | 'auto';  // escolha do utilizador; 'auto' = troca pela hora
  themeDayStart?: string;          // "HH:MM" a que passa a claro (só conta em 'auto')
  themeNightStart?: string;        // "HH:MM" a que passa a escuro (só conta em 'auto')
  defaultCli?: string;             // CLI used by new terminals: claude (default) | codex | agy | opencode
  // Tema de marca ("Custom Temas"): só nome + logo + cores no cliente. O backend guarda-o para a
  // escolha seguir o utilizador para outra máquina — nada no servidor muda de comportamento.
  brandTheme?: string;
}

// Sobreponível por `JOCA_DATA_DIR`. Existe por causa dos testes: `notifications.test.ts` faz
// `fs.rmSync` sobre ficheiros DESTA pasta — apontado aos dados reais,
// correr `npm test` apagava as notificações reais do utilizador. Com o override, o
// vitest escreve numa pasta temporária e os testes deixam de poder tocar em dados a sério.
export const DATA_DIR = process.env.JOCA_DATA_DIR || path.join(__dirname, '../../data');
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

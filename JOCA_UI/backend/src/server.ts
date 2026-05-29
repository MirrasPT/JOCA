import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync, execFileSync, spawn } from 'child_process';

interface Session {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  pty: pty.IPty;
  buffer: string;
  status: 'working' | 'idle';
  lastOutputTime: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  workingSince: number | null;
  notifyOnIdle: boolean;
}


interface ClientMessage {
  type: 'create_session' | 'close_session' | 'input' | 'resize' | 'get_buffer' | 'rename_session' | 'interrupt_session';
  sessionId?: string;
  cwd?: string;
  resumePath?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
  data?: string;
  name?: string;
  cols?: number;
  rows?: number;
}

interface Project {
  id: string;
  name: string;
  path: string;
  color?: string;
  githubRepo?: string;
}

interface ProjectMemory {
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

interface ToolkitItem {
  name: string;
  insert: string;
  category?: string;
  path: string;
  description?: string;
}

interface CliToolStatus {
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

const DATA_DIR = path.join(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const PROJECT_MEMORY_FILE = path.join(DATA_DIR, 'project-memory.json');
const UI_SETTINGS_FILE = path.join(DATA_DIR, 'ui-settings.json');

interface UiSettings {
  skipPermissions: boolean;
}

const DEFAULT_UI_SETTINGS: UiSettings = { skipPermissions: false };

function loadUiSettings(): UiSettings {
  return { ...DEFAULT_UI_SETTINGS, ...readJsonFile<Partial<UiSettings>>(UI_SETTINGS_FILE, {}) };
}

function saveUiSettings(settings: UiSettings) {
  writeJsonFile(UI_SETTINGS_FILE, settings);
}

function loadProjects(): Project[] {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); } catch { return []; }
}

function saveProjects(projects: Project[]) {
  fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true });
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T; } catch { return fallback; }
}

function writeJsonFile<T>(filePath: string, data: T) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadProjectMemory(): Record<string, ProjectMemory> {
  return readJsonFile<Record<string, ProjectMemory>>(PROJECT_MEMORY_FILE, {});
}

function saveProjectMemory(memory: Record<string, ProjectMemory>) {
  writeJsonFile(PROJECT_MEMORY_FILE, memory);
}


const sessions = new Map<string, Session>();
const clients = new Set<WebSocket>();
let sessionCounter = 0;
const HOME = os.homedir();

const IS_WINDOWS = process.platform === 'win32';
const SHELL = IS_WINDOWS
  ? 'powershell.exe'
  : (process.env.SHELL || '/bin/zsh');
const BUFFER_MAX = 5_000_000;
const IDLE_DEBOUNCE_MS = 1500;
const DONE_MIN_WORK_MS = 2000;
const MAX_SESSIONS = 30;
// Path allowlist for any value written into a PTY shell line. Unicode letters/numbers + safe punctuation.
const PATH_SAFE = /^[\p{L}\p{N}._/\- @()&,+:']+$/u;

function findJocaLogicRoot(): string {
  if (process.env.JOCA_LOGIC_PATH) {
    const envPath = path.resolve(process.env.JOCA_LOGIC_PATH);
    if (fs.existsSync(path.join(envPath, '.claude'))) return envPath;
  }

  const uiRoot = path.resolve(__dirname, '../..');
  const parentDir = path.dirname(uiRoot);
  const siblingLogic = path.join(parentDir, 'JOCA_Logic');
  if (fs.existsSync(path.join(siblingLogic, '.claude'))) return siblingLogic;

  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && fs.existsSync(path.join(dir, '.claude'))) return dir;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return parentDir;
}

const JOCA_LOGIC_ROOT = findJocaLogicRoot();
const CLAUDE_DIR = path.join(JOCA_LOGIC_ROOT, '.claude');
const MEMORY_INDEX_FILE = path.join(JOCA_LOGIC_ROOT, 'memory', 'INDEX.md');

function isInsideHome(targetPath: string) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(HOME, resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isInside(root: string, targetPath: string) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(path.resolve(root), resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// Resolve symlinks to their real physical path before any boundary check.
// Falls back to the lexical path if realpath fails (file doesn't exist yet, etc).
function realPathSafe(p: string): string {
  try { return fs.realpathSync.native(p); } catch { return p; }
}

// Sensitive subdirs of $HOME that must NEVER be served via the file APIs, regardless of any
// other guard. Path is HOME-relative (no leading slash).
const SENSITIVE_HOME_SUBDIRS = [
  '.ssh', '.gnupg', '.aws', '.kube', '.docker', '.npmrc', '.netrc', '.pgpass',
  '.config/gcloud', '.config/gh', '.config/op', '.config/rclone',
  '.bash_history', '.zsh_history', '.python_history', '.psql_history', '.mysql_history',
  '.subversion/auth', '.cargo/credentials.toml', '.cargo/credentials',
  'Library/Keychains',
  // Shell/tool config: writes here = persistence vector on next terminal/process launch.
  '.zshrc', '.bashrc', '.bash_profile', '.profile', '.zprofile', '.zshenv', '.bash_logout',
  '.gitconfig', '.git-credentials', '.env', '.envrc',
];
function isSensitivePath(absPath: string): boolean {
  const rel = path.relative(HOME, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return SENSITIVE_HOME_SUBDIRS.some((d) => rel === d || rel.startsWith(d + path.sep));
}

class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Read-only variant: allows HOME itself for directory listing.
// Use for GET operations only — never for mutations.
function safePathForRead(targetPath: string): string {
  if (!targetPath) throw new HttpError('Missing path', 400);
  const real = realPathSafe(path.resolve(targetPath));
  if (!isInsideHome(real)) throw new HttpError('Forbidden', 403);
  if (isSensitivePath(real)) throw new HttpError('Forbidden', 403);
  return real;
}

// Mutation variant: additionally blocks HOME itself to prevent accidental deletion/overwrite.
// Use for file-op and any write path.
function safePath(targetPath: string): string {
  const real = safePathForRead(targetPath);
  // HOME itself must never be a mutation target — would delete/overwrite the entire user account.
  if (path.resolve(real) === path.resolve(HOME)) throw new HttpError('Forbidden', 403);
  return real;
}

function assertHomePath(targetPath: string) {
  return safePath(targetPath);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // direct calls (curl, server-side) have no Origin header
  // Only loopback origins on http (any port — vite dev + prod served origin both qualify).
  // External attackers cannot forge a loopback origin from a remote browser tab.
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

function requireSafeOrigin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (!isAllowedOrigin(req.headers.origin as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }
  next();
}

function assertClaudePath(targetPath: string) {
  const lexical = path.resolve(targetPath);
  // Resolve any symlinks before checking containment — prevents symlink-escape
  // (planted symlink inside .claude pointing to /etc).
  const real = realPathSafe(lexical);
  if (!isInside(CLAUDE_DIR, real)) throw new HttpError('Forbidden', 403);
  return lexical;
}

function safeDesktopFilename(name: string, fallbackExt: string) {
  const fallback = `joca-drop-${randomUUID().slice(0, 8)}.${fallbackExt}`;
  const cleaned = path.basename(name || fallback).replace(/[^\w .@()-]/g, '-').trim();
  return cleaned || fallback;
}

function parseFrontmatter(content: string) {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end === -1) return {};
  const yaml = content.slice(3, end).trim();
  const data: Record<string, string> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) data[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return data;
}

function validateToolkitContent(type: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return 'Content cannot be empty';
  if (type === 'skills') {
    const frontmatter = parseFrontmatter(trimmed);
    if (!frontmatter.name) return 'Skill frontmatter needs name';
    if (!frontmatter.description) return 'Skill frontmatter needs description';
  }
  if (type === 'agents') {
    const frontmatter = parseFrontmatter(trimmed);
    if (trimmed.startsWith('---') && !frontmatter.name) return 'Agent frontmatter needs name';
  }
  return null;
}

function sanitizeToolkitName(name: string) {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[.\-]+|[.\-]+$/g, '');
  if (!safe) throw new Error('Invalid name');
  return safe;
}

function sanitizeToolkitCategory(category?: string) {
  return (category || 'created-skills')
    .split(/[/\\]/)
    .filter(Boolean)
    .map((segment) => sanitizeToolkitName(segment))
    .join(path.sep);
}


function collectToolkitItems(claudeDir: string = CLAUDE_DIR) {
  const commands: ToolkitItem[] = [];
  const agents: ToolkitItem[] = [];
  const skills: ToolkitItem[] = [];

  const commandsDir = path.join(claudeDir, 'commands');
  try {
    if (fs.existsSync(commandsDir)) {
      fs.readdirSync(commandsDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .sort()
        .forEach(f => {
          const itemPath = path.join(commandsDir, f);
          const name = f.replace(/\.md$/, '');
          const content = fs.readFileSync(itemPath, 'utf8');
          const meta = parseFrontmatter(content);
          commands.push({ name, insert: `/${name}`, path: itemPath, category: 'commands', description: meta.description });
        });
    }
  } catch {}

  const agentsDir = path.join(claudeDir, 'agents');
  try {
    if (fs.existsSync(agentsDir)) {
      fs.readdirSync(agentsDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .sort()
        .forEach(f => {
          const itemPath = path.join(agentsDir, f);
          const name = f.replace(/\.md$/, '');
          const content = fs.readFileSync(itemPath, 'utf8');
          const meta = parseFrontmatter(content);
          agents.push({ name, insert: name, path: itemPath, category: 'agents', description: meta.description });
        });
    }
  } catch {}

  function walkSkills(dir: string, category = '') {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() && entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
          const filePath = path.join(dir, entry.name);
          const content = fs.readFileSync(filePath, 'utf8');
          const meta = parseFrontmatter(content);
          const baseName = entry.name.replace(/\.md$/, '');
          skills.push({
            name: meta.name || baseName,
            category: category || 'general',
            insert: meta.name || baseName,
            path: filePath,
            description: meta.description,
          });
          continue;
        }
        if (!entry.isDirectory()) continue;
        const subDir = path.join(dir, entry.name);
        const skillPath = path.join(subDir, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          const content = fs.readFileSync(skillPath, 'utf8');
          const meta = parseFrontmatter(content);
          skills.push({
            name: meta.name || entry.name,
            category: category || 'general',
            insert: meta.name || entry.name,
            path: skillPath,
            description: meta.description,
          });
        } else {
          walkSkills(subDir, category ? `${category}/${entry.name}` : entry.name);
        }
      }
    } catch {}
  }
  walkSkills(path.join(claudeDir, 'skills'));

  return { commands, agents, skills };
}

function runShell(command: string) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
      shell: SHELL,
    }).trim();
  } catch (error) {
    const err = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    return (stdout || stderr).trim();
  }
}

function commandPath(binary: string) {
  const cmd = IS_WINDOWS ? `where.exe ${binary}` : `command -v ${binary}`;
  const result = runShell(cmd);
  return (result && !result.toLowerCase().includes('not found') && !result.toLowerCase().includes('could not find'))
    ? result.split(/\r?\n/)[0]
    : undefined;
}

function getCliTools(): CliToolStatus[] {
  const definitions: Omit<CliToolStatus, 'installed' | 'path' | 'version' | 'authStatus' | 'authDetail'>[] = [
    {
      id: 'claude',
      name: 'Claude Code',
      provider: 'Anthropic',
      binary: 'claude',
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      loginCommand: 'claude auth login',
      updateCommand: 'claude update',
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      provider: 'OpenAI',
      binary: 'codex',
      installCommand: 'npm install -g @openai/codex',
      loginCommand: 'codex login',
      updateCommand: 'codex update',
    },
    {
      id: 'agy',
      name: 'Antigravity CLI',
      provider: 'Google',
      binary: 'agy',
      installCommand: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      loginCommand: 'agy',
      updateCommand: 'agy update',
    },
  ];

  return definitions.map((tool) => {
    const foundPath = commandPath(tool.binary);
    const installed = Boolean(foundPath);
    const version = installed ? runShell(`${tool.binary} --version`).split(/\r?\n/)[0] : undefined;
    let authStatus: CliToolStatus['authStatus'] = installed ? 'unknown' : 'not-logged-in';
    let authDetail = installed ? 'Installed. Authentication status not checked.' : 'CLI not installed.';

    if (installed && tool.id === 'claude') {
      const output = runShell('claude auth status');
      try {
        const parsed = JSON.parse(output);
        authStatus = parsed.loggedIn ? 'logged-in' : 'not-logged-in';
        authDetail = parsed.email || parsed.authMethod || output;
      } catch {
        authStatus = output.toLowerCase().includes('logged') ? 'logged-in' : 'unknown';
        authDetail = output || authDetail;
      }
    }

    if (installed && tool.id === 'codex') {
      const output = runShell('codex login status');
      authStatus = output.toLowerCase().includes('logged in') ? 'logged-in' : 'not-logged-in';
      authDetail = output || authDetail;
    }

    if (installed && tool.id === 'agy') {
      const settingsPath = path.join(HOME, '.gemini', 'antigravity-cli', 'settings.json');
      const hasSettings = fs.existsSync(settingsPath);
      authStatus = 'unknown';
      authDetail = hasSettings
        ? `Settings found at ${settingsPath}. Run agy to verify browser sign-in if needed.`
        : 'Run agy. If no saved session exists, it opens Google Sign-In.';
    }

    return { ...tool, installed, path: foundPath, version, authStatus, authDetail };
  });
}

function refreshMemoryIndexSnapshot() {
  if (!fs.existsSync(MEMORY_INDEX_FILE)) return;
  const items = collectToolkitItems();
  const block = [
    '<!-- JOCA_UI_TOOLKIT_START -->',
    '## JOCA UI Toolkit Snapshot',
    `- Commands: ${items.commands.length}`,
    `- Skills: ${items.skills.length}`,
    `- Agents: ${items.agents.length}`,
    `- Updated: ${new Date().toISOString()}`,
    '<!-- JOCA_UI_TOOLKIT_END -->',
  ].join('\n');
  const current = fs.readFileSync(MEMORY_INDEX_FILE, 'utf8');
  const next = current.includes('<!-- JOCA_UI_TOOLKIT_START -->')
    ? current.replace(/<!-- JOCA_UI_TOOLKIT_START -->[\s\S]*?<!-- JOCA_UI_TOOLKIT_END -->/, block)
    : `${current.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(MEMORY_INDEX_FILE, next);
}

function ensureNodePtyHelpersExecutable() {
  const prebuildsDir = path.resolve(__dirname, '../node_modules/node-pty/prebuilds');
  try {
    if (!fs.existsSync(prebuildsDir)) return;
    for (const platformDir of fs.readdirSync(prebuildsDir)) {
      const helperPath = path.join(prebuildsDir, platformDir, 'spawn-helper');
      if (fs.existsSync(helperPath) && !IS_WINDOWS) fs.chmodSync(helperPath, 0o755);
    }
  } catch (e) {
    console.warn('Could not chmod node-pty spawn-helper:', e);
  }
}

ensureNodePtyHelpersExecutable();

function findClaude(): string {
  const cmd = IS_WINDOWS ? 'where.exe claude' : 'which claude';
  try { return execSync(cmd, { encoding: 'utf8' }).trim().split(/\r?\n/)[0]; }
  catch { return 'claude'; }
}

const CLAUDE_BIN = findClaude();
const STARTED_AT = Date.now();

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function sessionInfo(s: Session) {
  return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, status: s.status };
}

function createSession(
  cwd: string = JOCA_LOGIC_ROOT,
  resumePath?: string,
  sessionName?: string,
  projectId?: string,
  initialInput?: string
): Session {
  sessionCounter++;
  const id = randomUUID();
  const name = sessionName ?? `Session ${sessionCounter}`;

  const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
  const ptyProcess = pty.spawn(SHELL, shellArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: { ...process.env } as Record<string, string>,
  });

  const session: Session = {
    id, name, cwd, projectId,
    pty: ptyProcess,
    buffer: '',
    status: 'idle',
    lastOutputTime: Date.now(),
    idleTimer: null,
    workingSince: null,
    notifyOnIdle: false,
  };
  sessions.set(id, session);

  if (projectId) {
    const memory = loadProjectMemory();
    const current = memory[projectId] ?? {
      projectId,
      recentSessions: [],
      favoriteSkills: [],
      favoriteAgents: [],
      quickCommands: ['save', 'compact', 'clear'],
      openFiles: [],
      rightPanel: 'files',
      updatedAt: new Date().toISOString(),
    };
    memory[projectId] = {
      ...current,
      recentSessions: [id, ...current.recentSessions.filter((item) => item !== id)].slice(0, 12),
      updatedAt: new Date().toISOString(),
    };
    saveProjectMemory(memory);
  }

  const claudeArgs = loadUiSettings().skipPermissions ? ' --dangerously-skip-permissions' : '';
  setTimeout(() => ptyProcess.write(`${CLAUDE_BIN}${claudeArgs}\r`), 100);

  if (resumePath) {
    let resolved: string | null = null;
    try { resolved = safePath(resumePath); } catch {}
    const safe = resolved && PATH_SAFE.test(resolved) && fs.existsSync(resolved);
    if (safe && resolved) {
      const hasClaudeMd = fs.existsSync(path.join(resolved, 'CLAUDE.md'));
      const cmd = hasClaudeMd ? `/resume "${resolved}"` : `/init-project "${resolved}"`;
      setTimeout(() => {
        ptyProcess.write(cmd);
        setTimeout(() => ptyProcess.write('\r'), 80);
      }, 1200);
    }
  }

  if (initialInput) {
    setTimeout(() => {
      ptyProcess.write(initialInput.endsWith('\r') ? initialInput : `${initialInput}\r`);
    }, resumePath ? 2200 : 1200);
  }

  ptyProcess.onData((data: string) => {
    session.buffer += data;
    if (session.buffer.length > BUFFER_MAX) {
      let cutAt = session.buffer.length - BUFFER_MAX;
      const nlPos = session.buffer.indexOf('\n', cutAt);
      if (nlPos !== -1 && nlPos < cutAt + 500) cutAt = nlPos + 1;
      session.buffer = '\x1b[0m' + session.buffer.slice(cutAt);
    }
    broadcast({ type: 'output', sessionId: id, data });

    // Status: transition to working
    const wasIdle = session.status === 'idle';
    session.status = 'working';
    session.lastOutputTime = Date.now();
    if (session.workingSince === null) session.workingSince = Date.now();

    if (wasIdle) {
      broadcast({ type: 'session_status', sessionId: id, status: 'working' });
    }

    // Debounce idle detection
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      const wasWorking = session.status === 'working';
      const workedFor = session.workingSince ? Date.now() - session.workingSince : 0;
      const isDone = session.notifyOnIdle && wasWorking && workedFor > DONE_MIN_WORK_MS;

      session.status = 'idle';
      session.workingSince = null;
      session.notifyOnIdle = false;
      session.idleTimer = null;

      broadcast({ type: 'session_status', sessionId: id, status: 'idle', isDone });
    }, IDLE_DEBOUNCE_MS);
  });

  ptyProcess.onExit(() => {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    sessions.delete(id);
    broadcast({ type: 'session_closed', sessionId: id });
  });

  return session;
}

const app = express();
app.use(requireSafeOrigin);
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info: { origin?: string }) => isAllowedOrigin(info.origin),
});

// Projects CRUD
app.get('/projects', (_req, res) => {
  const projects = loadProjects().map((p) => ({
    ...p,
    initialized: fs.existsSync(path.join(p.path, 'CLAUDE.md')),
  }));
  res.json(projects);
});

app.post('/projects', express.json(), (req, res) => {
  const { name, path: p, color } = req.body as { name?: string; path: string; color?: string };
  if (!p) return res.status(400).json({ error: 'Missing path' });
  let resolvedP: string;
  try { resolvedP = safePath(p); }
  catch { return res.status(400).json({ error: 'Path must be inside home directory (and not a sensitive subdir)' }); }
  if (!fs.existsSync(resolvedP)) return res.status(400).json({ error: 'Path does not exist' });
  const projects = loadProjects();
  if (projects.find((pr) => pr.path === resolvedP)) return res.status(409).json({ error: 'Already exists' });
  const cleanName = (name?.trim() || path.basename(resolvedP) || resolvedP).slice(0, 120);
  const cleanColor = color?.trim().slice(0, 50) || undefined;
  const project: Project = {
    id: randomUUID(),
    name: cleanName,
    path: resolvedP,
    color: cleanColor,
  };
  projects.push(project);
  saveProjects(projects);
  const memory = loadProjectMemory();
  memory[project.id] = {
    projectId: project.id,
    color: project.color,
    path: project.path,
    recentSessions: [],
    favoriteSkills: [],
    favoriteAgents: [],
    quickCommands: ['save', 'compact', 'clear'],
    openFiles: [],
    rightPanel: 'files',
    updatedAt: new Date().toISOString(),
  };
  saveProjectMemory(memory);
  res.json(project);
});

app.patch('/projects/:id', express.json(), (req, res) => {
  const projects = loadProjects();
  const p = projects.find((pr) => pr.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body.name === 'string') {
    const trimmed = req.body.name.trim().slice(0, 120);
    if (trimmed.length === 0) return res.status(400).json({ error: 'Name cannot be empty' });
    p.name = trimmed;
  }
  if (typeof req.body.path === 'string') {
    const nextPathRaw = req.body.path.trim();
    if (!nextPathRaw) return res.status(400).json({ error: 'Missing path' });
    let resolvedNext: string;
    try { resolvedNext = safePath(nextPathRaw); }
    catch { return res.status(400).json({ error: 'Path must be inside home directory (and not a sensitive subdir)' }); }
    if (!fs.existsSync(resolvedNext)) return res.status(400).json({ error: 'Path does not exist' });
    if (projects.find((pr) => pr.id !== p.id && pr.path === resolvedNext)) return res.status(409).json({ error: 'Already exists' });
    p.path = resolvedNext;
  }
  if (typeof req.body.color === 'string') p.color = (req.body.color.trim().slice(0, 50)) || undefined;
  if (req.body.githubRepo !== undefined) {
    const repo = req.body.githubRepo ? String(req.body.githubRepo).trim().slice(0, 500) : '';
    p.githubRepo = repo || undefined;
  }
  saveProjects(projects);
  const memory = loadProjectMemory();
  const current = memory[p.id];
  if (current) {
    memory[p.id] = { ...current, color: p.color, path: p.path, updatedAt: new Date().toISOString() };
    saveProjectMemory(memory);
  }
  res.json(p);
});

app.delete('/projects/:id', (req, res) => {
  saveProjects(loadProjects().filter((p) => p.id !== req.params.id));
  const memory = loadProjectMemory();
  delete memory[req.params.id];
  saveProjectMemory(memory);
  res.json({ ok: true });
});

app.get('/projects/:id/git', (req, res) => {
  const projects = loadProjects();
  const p = projects.find((pr) => pr.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });

  try {
    const isGit = fs.existsSync(path.join(p.path, '.git'));
    if (!isGit) {
      return res.json({ isRepository: false });
    }

    let remoteUrl = '';
    try {
      remoteUrl = execSync('git remote get-url origin', { cwd: p.path, encoding: 'utf8' }).trim();
    } catch {}

    let branch = '';
    try {
      branch = execSync('git branch --show-current', { cwd: p.path, encoding: 'utf8' }).trim();
    } catch {}

    let statusSummary = '';
    try {
      statusSummary = execSync('git status --short', { cwd: p.path, encoding: 'utf8' }).trim();
    } catch {}

    let lastCommit = '';
    try {
      lastCommit = execSync('git log -n 1 --format="%h - %s (%an)"', { cwd: p.path, encoding: 'utf8' }).trim();
    } catch {}

    res.json({
      isRepository: true,
      remoteUrl,
      branch,
      statusSummary,
      lastCommit,
    });
  } catch (e) {
    res.json({ isRepository: false, error: String(e) });
  }
});

app.get('/projects/:id/toolkit', (req, res) => {
  const projects = loadProjects();
  const p = projects.find((pr) => pr.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });

  const projectClaudeDir = path.join(p.path, '.claude');
  res.json(collectToolkitItems(projectClaudeDir));
});

app.post('/projects/:id/toolkit', express.json(), (req, res) => {
  const projects = loadProjects();
  const p = projects.find((pr) => pr.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });

  const { type, name, category } = req.body as { type: 'skills' | 'agents'; name: string; category?: string };
  if (!['skills', 'agents'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  // Use the shared sanitizer (same one as global /toolkit-item) — no drift.
  let safeName: string;
  try { safeName = sanitizeToolkitName(name); }
  catch { return res.status(400).json({ error: 'Invalid name' }); }

  const projectClaudeDir = path.join(p.path, '.claude');

  const safeCategory = sanitizeToolkitCategory(category);
  const itemPath = type === 'skills'
    ? path.join(projectClaudeDir, 'skills', safeCategory, safeName, 'SKILL.md')
    : path.join(projectClaudeDir, 'agents', `${safeName}.md`);

  // Path-aware containment check (startsWith is fooled by sibling dirs with prefix).
  if (!isInside(projectClaudeDir, itemPath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (fs.existsSync(itemPath)) {
    return res.status(409).json({ error: 'Item already exists' });
  }

  fs.mkdirSync(path.dirname(itemPath), { recursive: true });

  // Escape any user-supplied scalar that lands in YAML frontmatter (newlines/colons/quotes
  // would otherwise inject arbitrary keys or break the document).
  const yamlString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ').slice(0, 200)}"`;
  const safeNameDisplay = safeName.slice(0, 80);
  const safeProjectName = p.name.slice(0, 80);
  const boilerplateContent = type === 'skills'
    ? `---
name: ${yamlString(safeNameDisplay)}
description: ${yamlString(`Exclusiva para o projeto ${safeProjectName}`)}
triggers:
  - ${yamlString(safeName)}
---

# ${safeNameDisplay}

Instruções para a skill ${safeNameDisplay} no projeto ${safeProjectName}.
`
    : `---
name: ${yamlString(safeNameDisplay)}
description: ${yamlString(`Agente exclusivo para o projeto ${safeProjectName}`)}
---

# ${safeNameDisplay}

Instruções para o agente ${safeNameDisplay} no projeto ${safeProjectName}.
`;

  fs.writeFileSync(itemPath, boilerplateContent, 'utf8');
  res.json({ ok: true, path: itemPath, items: collectToolkitItems(projectClaudeDir) });
});

app.get('/runtime', (_req, res) => {
  const projects = loadProjects();
  res.json({
    home: HOME,
    shell: SHELL,
    claudeBin: CLAUDE_BIN,
    cwd: process.cwd(),
    uptimeMs: Date.now() - STARTED_AT,
    port: Number(process.env.PORT || 3001),
    sessionCount: sessions.size,
    projectCount: projects.length,
    sessions: [...sessions.values()].map(sessionInfo),
  });
});

const MAX_RATE_LIMITS_FILE_SIZE = 100_000;
function readBoundedJson(file: string): unknown {
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > MAX_RATE_LIMITS_FILE_SIZE) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

app.get('/rate-limits', (_req, res) => {
  const result: Record<string, unknown> = {};

  try {
    const claudeFile = path.join(os.tmpdir(), 'joca-ui', 'rate-limits.json');
    const claude = readBoundedJson(claudeFile) as Record<string, unknown> | null;
    if (claude) {
      const oauthFile = path.join(os.tmpdir(), 'joca-ui', 'oauth-usage.json');
      const oauth = readBoundedJson(oauthFile) as Record<string, { utilization?: number; resets_at?: string }> | null;
      if (oauth) {
        if (oauth.five_hour?.utilization != null) claude.five_hour = { used_pct: oauth.five_hour.utilization, resets_at: oauth.five_hour.resets_at };
        if (oauth.seven_day?.utilization != null) claude.seven_day = { used_pct: oauth.seven_day.utilization, resets_at: oauth.seven_day.resets_at };
        if (oauth.seven_day_sonnet?.utilization != null) claude.sonnet_seven_day = { used_pct: oauth.seven_day_sonnet.utilization, resets_at: oauth.seven_day_sonnet.resets_at };
      }
      result.claude = claude;
    }
  } catch {}

  try {
    const codexDb = path.join(os.homedir(), '.codex', 'logs_2.sqlite');
    if (fs.existsSync(codexDb)) {
      const out = execFileSync(
        'sqlite3',
        [codexDb, "SELECT feedback_log_body FROM logs WHERE feedback_log_body LIKE '%codex.rate_limits%' ORDER BY ts DESC LIMIT 1;"],
        { timeout: 3000, encoding: 'utf8' }
      );
      // sqlite3 returns one row of JSON text; parse whole row, then validate
      try {
        const d = JSON.parse(out.trim());
        if (d?.type === 'codex.rate_limits') {
          const rl = d.rate_limits || {};
          result.codex = {
            plan: d.plan_type || null,
            five_hour: { used_pct: rl.primary?.used_percent ?? null },
            seven_day: { used_pct: rl.secondary?.used_percent ?? null },
          };
        }
      } catch {
        // fallback: row contains nested objects — extract by structural scan
        const idx = out.indexOf('"type":"codex.rate_limits"');
        const start = idx !== -1 ? out.lastIndexOf('{', idx) : -1;
        if (start >= 0) {
          let depth = 0;
          for (let i = start; i < out.length; i++) {
            if (out[i] === '{') depth++;
            else if (out[i] === '}') { depth--; if (depth === 0) {
              try {
                const d = JSON.parse(out.slice(start, i + 1));
                const rl = d.rate_limits || {};
                result.codex = {
                  plan: d.plan_type || null,
                  five_hour: { used_pct: rl.primary?.used_percent ?? null },
                  seven_day: { used_pct: rl.secondary?.used_percent ?? null },
                };
              } catch {}
              break;
            } }
          }
        }
      }
    }
  } catch {}

  try {
    const agyFile = path.join(os.tmpdir(), 'joca-ui', 'agy-rate-limits.json');
    const agy = readBoundedJson(agyFile);
    if (agy) result.agy = agy;
  } catch {}

  res.json(Object.keys(result).length > 0 ? result : null);
});

app.get('/cli-tools', (_req, res) => {
  res.json(getCliTools());
});

app.get('/ui-settings', (_req, res) => {
  res.json(loadUiSettings());
});

app.patch('/ui-settings', express.json(), (req, res) => {
  const current = loadUiSettings();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updated = { ...current };
  if ('skipPermissions' in body) updated.skipPermissions = body.skipPermissions === true;
  saveUiSettings(updated);
  res.json(updated);
});

app.get('/project-memory', (_req, res) => {
  res.json(loadProjectMemory());
});

app.patch('/project-memory/:id', express.json(), (req, res) => {
  const projectId = req.params.id;
  const projects = loadProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const memory = loadProjectMemory();
  const current = memory[projectId] ?? {
    projectId,
    color: project.color,
    path: project.path,
    recentSessions: [],
    favoriteSkills: [],
    favoriteAgents: [],
    quickCommands: ['save', 'compact', 'clear'],
    openFiles: [],
    rightPanel: 'files',
    updatedAt: new Date().toISOString(),
  };
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rightPanelValue = body.rightPanel;
  const validRightPanel = rightPanelValue === 'files' || rightPanelValue === 'toolkit' || rightPanelValue === 'settings' || rightPanelValue === null;
  // `path` is authoritative on the project record itself, not client-writable via project-memory.
  memory[projectId] = {
    ...current,
    projectId,
    color: typeof body.color === 'string' ? body.color : current.color,
    path: project.path,
    recentSessions: Array.isArray(body.recentSessions) ? (body.recentSessions as string[]).filter((x) => typeof x === 'string').slice(0, 20) : current.recentSessions,
    favoriteSkills: Array.isArray(body.favoriteSkills) ? (body.favoriteSkills as string[]).filter((x) => typeof x === 'string').slice(0, 30) : current.favoriteSkills,
    favoriteAgents: Array.isArray(body.favoriteAgents) ? (body.favoriteAgents as string[]).filter((x) => typeof x === 'string').slice(0, 30) : current.favoriteAgents,
    quickCommands: Array.isArray(body.quickCommands) ? (body.quickCommands as string[]).filter((x) => typeof x === 'string').slice(0, 12) : current.quickCommands,
    openFiles: Array.isArray(body.openFiles) ? (body.openFiles as string[]).filter((x) => typeof x === 'string').slice(0, 20) : current.openFiles,
    rightPanel: validRightPanel ? rightPanelValue as ProjectMemory['rightPanel'] : current.rightPanel,
    updatedAt: new Date().toISOString(),
  };
  saveProjectMemory(memory);
  res.json(memory[projectId]);
});


app.get('/joca-logic', (_req, res) => {
  const connected = fs.existsSync(path.join(JOCA_LOGIC_ROOT, '.claude'));
  const items = connected ? collectToolkitItems() : { commands: [], agents: [], skills: [] };
  const hasMemoryIndex = fs.existsSync(MEMORY_INDEX_FILE);
  const hasGraph = fs.existsSync(path.join(JOCA_LOGIC_ROOT, 'graphify-out', 'graph.json'));
  const hasSoul = fs.existsSync(path.join(JOCA_LOGIC_ROOT, 'memory', 'soul.md'));
  res.json({
    connected,
    path: JOCA_LOGIC_ROOT,
    skillCount: items.skills.length,
    agentCount: items.agents.length,
    commandCount: items.commands.length,
    hasMemoryIndex,
    hasGraph,
    hasSoul,
  });
});

app.get('/knowledge-graph', (_req, res) => {
  const reportPath = path.join(JOCA_LOGIC_ROOT, 'graphify-out', 'GRAPH_REPORT.md');
  const graphPath = path.join(JOCA_LOGIC_ROOT, 'graphify-out', 'graph.json');
  const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
  const graph = fs.existsSync(graphPath) ? readJsonFile<Record<string, unknown>>(graphPath, {}) : null;
  res.json({
    available: Boolean(report || graph),
    reportPath: fs.existsSync(reportPath) ? reportPath : null,
    graphPath: fs.existsSync(graphPath) ? graphPath : null,
    report: report.slice(0, 12_000),
    graph,
  });
});


app.get('/file-content', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'Missing path' });
  let resolved: string;
  try { resolved = safePath(filePath); }
  catch { return res.status(403).json({ error: 'Forbidden' }); }
  try {
    const ext = path.extname(resolved).toLowerCase().slice(1);
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
      pdf: 'application/pdf', html: 'text/html', htm: 'text/html',
    };
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
    if (fs.statSync(resolved).isDirectory()) return res.status(400).json({ error: 'Cannot read directory' });
    res.setHeader('Content-Type', mimeMap[ext] || 'text/plain; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Active-content protection:
    //   SVG: <img> ignores CSP (just rasterizes); direct nav is blocked by CSP sandbox.
    //   HTML: only sandbox CSP on top-level direct navigation (Sec-Fetch-Dest=document).
    //         When loaded by the FilePreview iframe (dest=iframe), browsers compose iframe.sandbox
    //         AND response CSP sandbox using the MORE restrictive — applying CSP sandbox there would
    //         strip `allow-scripts` and break the intended interactive preview.
    if (ext === 'svg') {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self' data:");
    } else if (ext === 'html' || ext === 'htm') {
      // Only `Sec-Fetch-Dest: empty` (XHR/fetch) is a safe render context. document/iframe/frame/
      // embed/object/worker are ALL active-render — cross-site iframe of /file-content would otherwise
      // load with same-origin to our backend API.
      const dest = req.headers['sec-fetch-dest'];
      if (dest !== 'empty') {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(resolved).replace(/"/g, '')}"`);
      }
    }
    res.sendFile(resolved);
  } catch { res.status(400).json({ error: 'Read failed' }); }
});

// /open: macOS `open` dispatches by file metadata — extension AND executable mode bit AND shebang.
// Use an ALLOWLIST of known-safe document/media types. Extensionless files, scripts, and apps are
// rejected even if their extension is missing.
const OPEN_ALLOWED_EXTS = new Set([
  'png','jpg','jpeg','gif','webp','bmp','svg','ico','pdf',
  'mp4','mov','webm','m4v','mkv','avi',
  'mp3','wav','m4a','ogg','flac','aac',
  'md','txt','json','csv','tsv','log','yaml','yml','toml','xml',
  'html','htm',
]);

app.post('/open', express.json(), (req, res) => {
  const { path: filePath } = req.body as { path: string };
  if (!filePath) return res.status(400).json({ error: 'Missing path' });
  let resolved: string;
  try { resolved = safePath(filePath); }
  catch { return res.status(403).json({ error: 'Forbidden' }); }
  if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Path does not exist' });
  const stat = fs.statSync(resolved);
  // Only regular files and directories are openable. FIFOs/sockets/device files cause `open` to
  // block indefinitely or trigger unintended kernel behavior.
  if (stat.isDirectory()) {
    // Finder window — safe.
  } else if (stat.isFile()) {
    const ext = path.extname(resolved).toLowerCase().slice(1);
    if (!OPEN_ALLOWED_EXTS.has(ext)) {
      return res.status(400).json({ error: 'File type not allowed for /open (only documents/media)' });
    }
    // Defense in depth: refuse any file with executable mode bits set, regardless of extension.
    if (stat.mode & 0o111) {
      return res.status(400).json({ error: 'Executable files cannot be opened' });
    }
  } else {
    return res.status(400).json({ error: 'Only regular files and directories can be opened' });
  }
  try {
    const openCmd = IS_WINDOWS ? 'explorer' : 'open';
    spawn(openCmd, [resolved], { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Open failed' }); }
});

app.get('/files', (req, res) => {
  const dirPath = (req.query.path as string) || HOME;
  // Accept both `hidden=true` (legacy) and `showHidden=true` (frontend convention).
  const showHidden = req.query.hidden === 'true' || req.query.showHidden === 'true';
  let resolved: string;
  try { resolved = safePathForRead(dirPath); }
  catch { return res.status(403).json({ error: 'Forbidden' }); }
  try {
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
    if (!fs.statSync(resolved).isDirectory()) return res.status(400).json({ error: 'Not a directory' });
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const result = entries
      .filter((e) => showHidden || !e.name.startsWith('.'))
      // Hide sensitive subdirs even when showHidden=true (e.g. .ssh, .aws).
      .filter((e) => !isSensitivePath(path.join(resolved, e.name)))
      .map((e) => ({ name: e.name, path: path.join(resolved, e.name), isDir: e.isDirectory() }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    // When at HOME, expose parent === path so the frontend hides the ".." entry
    // (navigating above HOME is not allowed).
    const parent = path.resolve(resolved) === path.resolve(HOME) ? resolved : path.dirname(resolved);
    res.json({ path: resolved, parent, entries: result });
  } catch { res.status(400).json({ error: 'Read failed' }); }
});

app.post('/file-op', express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { action, path: sourcePath, targetPath, name, content } = req.body as {
      action: 'create_file' | 'create_folder' | 'rename' | 'delete' | 'move' | 'duplicate' | 'write_file';
      path?: string;
      targetPath?: string;
      name?: string;
      content?: string;
    };
    if (!action) return res.status(400).json({ error: 'Missing action' });

    if (action === 'create_file' || action === 'create_folder') {
      const parent = assertHomePath(sourcePath || HOME);
      const safeName = path.basename(String(name || '').trim());
      if (!safeName) return res.status(400).json({ error: 'Missing name' });
      const nextPath = assertHomePath(path.join(parent, safeName));
      if (!isInside(parent, nextPath)) return res.status(403).json({ error: 'Forbidden' });
      // lstat (no symlink follow) — if path exists as a symlink, reject. Prevents post-validation
      // symlink TOCTOU where attacker plants a symlink pointing outside HOME.
      try {
        const lst = fs.lstatSync(nextPath);
        if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
        return res.status(409).json({ error: 'Already exists' });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      if (action === 'create_folder') {
        fs.mkdirSync(nextPath); // no recursive — refuses if exists (incl. symlink)
      } else {
        // O_CREAT | O_EXCL: refuses pre-existing path AND symlinks (even dangling).
        const fd = fs.openSync(nextPath, 'wx');
        try { fs.writeFileSync(fd, content ?? ''); } finally { fs.closeSync(fd); }
      }
      return res.json({ ok: true, path: nextPath });
    }

    const resolvedSource = assertHomePath(sourcePath || '');
    if (!fs.existsSync(resolvedSource)) return res.status(404).json({ error: 'Path does not exist' });

    if (action === 'write_file') {
      // lstat — refuse symlink target (otherwise we'd write to whatever it points to).
      const lst = fs.lstatSync(resolvedSource);
      if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
      if (lst.isDirectory()) return res.status(400).json({ error: 'Cannot write a directory' });
      // Refuse multi-hardlink files — they can alias sensitive files outside HOME.
      // lstat cannot distinguish a hardlink from a regular file; nlink>1 is the only signal.
      if (lst.nlink > 1) return res.status(403).json({ error: 'Multi-hardlink targets not allowed' });
      fs.writeFileSync(resolvedSource, content ?? '');
      return res.json({ ok: true, path: resolvedSource });
    }

    if (action === 'delete') {
      fs.rmSync(resolvedSource, { recursive: true, force: true });
      return res.json({ ok: true, parent: path.dirname(resolvedSource) });
    }

    if (action === 'rename') {
      const safeName = path.basename(String(name || '').trim());
      if (!safeName) return res.status(400).json({ error: 'Missing name' });
      const nextPath = assertHomePath(path.join(path.dirname(resolvedSource), safeName));
      // Refuse if target already exists as a symlink (renameSync would replace it).
      try {
        const lst = fs.lstatSync(nextPath);
        if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
        return res.status(409).json({ error: 'Already exists' });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      fs.renameSync(resolvedSource, nextPath);
      return res.json({ ok: true, path: nextPath });
    }

    if (action === 'move') {
      const destinationDir = assertHomePath(targetPath || '');
      const nextPath = assertHomePath(path.join(destinationDir, path.basename(resolvedSource)));
      try {
        const lst = fs.lstatSync(nextPath);
        if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
        return res.status(409).json({ error: 'Already exists' });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      fs.renameSync(resolvedSource, nextPath);
      return res.json({ ok: true, path: nextPath });
    }

    if (action === 'duplicate') {
      const parsed = path.parse(resolvedSource);
      let nextPath = path.join(parsed.dir, `${parsed.name} copy${parsed.ext}`);
      let index = 2;
      // Use lstat (not existsSync) so symlinks are detected as "exists" and we skip past them.
      while (true) {
        try {
          const lst = fs.lstatSync(nextPath);
          if (lst.isSymbolicLink()) {
            // Skip past planted symlinks — never write through them.
            nextPath = path.join(parsed.dir, `${parsed.name} copy ${index}${parsed.ext}`);
            index++;
            continue;
          }
          // Regular file/dir at nextPath — try next name.
          nextPath = path.join(parsed.dir, `${parsed.name} copy ${index}${parsed.ext}`);
          index++;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') break;
          throw e;
        }
      }
      const stat = fs.statSync(resolvedSource);
      if (stat.isDirectory()) fs.cpSync(resolvedSource, nextPath, { recursive: true });
      else fs.copyFileSync(resolvedSource, nextPath);
      return res.json({ ok: true, path: nextPath });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    // Map OS errors to semantically correct HTTP codes.
    const code = (e as NodeJS.ErrnoException).code;
    const isPermission = code === 'EACCES' || code === 'EPERM';
    const status = e instanceof HttpError ? e.status : isPermission ? 403 : 400;
    const message = e instanceof Error ? e.message : String(e);
    res.status(status).json({ error: message });
  }
});

app.get('/file-diff', (req, res) => {
  try {
    const raw = String(req.query.path || '').trim();
    if (!raw) return res.status(400).json({ error: 'Missing path' });
    const filePath = assertHomePath(raw);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Path does not exist' });
    const cwd = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    let root = '';
    try { root = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim(); } catch {}
    if (!root) return res.json({ diff: '', message: 'No git repository found for this path' });
    // Git can resolve to a worktree/submodule outside HOME — re-validate the resolved root.
    if (!isInsideHome(realPathSafe(root))) return res.json({ diff: '', message: 'Git root outside home' });
    const relative = path.relative(root, filePath);
    const diff = execFileSync('git', ['diff', '--', relative], { cwd: root, encoding: 'utf8', maxBuffer: 5_000_000 });
    res.json({ diff, root, relative });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/joca-items', (_req, res) => {
  res.json(collectToolkitItems());
});

app.get('/toolkit-item', (req, res) => {
  try {
    const itemPath = assertClaudePath(String(req.query.path || ''));
    if (!fs.existsSync(itemPath)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(itemPath, 'utf8');
    res.json({ path: itemPath, content, frontmatter: parseFrontmatter(content) });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/toolkit-item', express.json({ limit: '2mb' }), (req, res) => {
  try {
    const { type, name, category, content } = req.body as { type: 'commands' | 'skills' | 'agents'; name: string; category?: string; content: string };
    if (!['commands', 'skills', 'agents'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const safeName = sanitizeToolkitName(name);
    const validation = validateToolkitContent(type, content);
    if (validation) return res.status(400).json({ error: validation });
    const itemPath = type === 'skills'
      ? path.join(CLAUDE_DIR, 'skills', sanitizeToolkitCategory(category), safeName, 'SKILL.md')
      : path.join(CLAUDE_DIR, type, `${safeName}.md`);
    assertClaudePath(itemPath);
    if (fs.existsSync(itemPath)) return res.status(409).json({ error: 'Already exists' });
    fs.mkdirSync(path.dirname(itemPath), { recursive: true });
    fs.writeFileSync(itemPath, content);
    refreshMemoryIndexSnapshot();
    res.json({ ok: true, path: itemPath, items: collectToolkitItems() });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.patch('/toolkit-item', express.json({ limit: '2mb' }), (req, res) => {
  try {
    const { path: itemPathRaw, type, content } = req.body as { path: string; type: 'commands' | 'skills' | 'agents'; content: string };
    const itemPath = assertClaudePath(itemPathRaw);
    if (!fs.existsSync(itemPath)) return res.status(404).json({ error: 'Not found' });
    const validation = validateToolkitContent(type, content);
    if (validation) return res.status(400).json({ error: validation });
    fs.writeFileSync(itemPath, content);
    refreshMemoryIndexSnapshot();
    res.json({ ok: true, path: itemPath, items: collectToolkitItems() });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.delete('/toolkit-item', express.json(), (req, res) => {
  try {
    const { path: itemPathRaw, type } = req.body as { path?: string; type?: string };
    if (!itemPathRaw) return res.status(400).json({ error: 'Missing path' });
    if (type !== 'commands' && type !== 'agents' && type !== 'skills') {
      return res.status(400).json({ error: 'Invalid type' });
    }
    const itemPath = assertClaudePath(itemPathRaw);
    if (!fs.existsSync(itemPath)) return res.status(404).json({ error: 'Not found' });

    // Determine deletion target:
    //   - commands/agents: flat .md files → delete file
    //   - skills: may be flat .md OR a subdir-packaged SKILL.md
    //     For subdir-packaged: delete the PARENT dir, BUT only if PARENT is a DIRECT child
    //     of .claude/skills/ (i.e. .claude/skills/<name>/SKILL.md → delete .claude/skills/<name>).
    //     A nested case (.claude/skills/category/<name>/SKILL.md) would otherwise delete the
    //     entire category — refuse.
    let deleteTarget = itemPath;
    if (type === 'skills' && path.basename(itemPath).toLowerCase() === 'skill.md') {
      const parent = path.dirname(itemPath);
      const skillsRoot = path.join(CLAUDE_DIR, 'skills');
      const parentReal = realPathSafe(parent);
      const skillsReal = realPathSafe(skillsRoot);
      const grandparent = path.dirname(parentReal);
      // Parent must be a DIRECT child of skills/ (depth=1). Reject root or any deeper nesting.
      if (parentReal === skillsReal || grandparent !== skillsReal) {
        return res.status(400).json({ error: 'Refusing to delete: target would escape skill scope' });
      }
      deleteTarget = parent;
    }
    fs.rmSync(deleteTarget, { recursive: true, force: true });
    refreshMemoryIndexSnapshot();
    res.json({ ok: true, items: collectToolkitItems() });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Note: 'svg' intentionally excluded — SVG can contain executable scripts (XSS risk via /file-content).
const UPLOAD_ALLOWED_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','ico','pdf','txt','md','json','csv']);

app.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  // Strip CR/LF from headers — Express may receive multiple values when a client splits with \r\n.
  // We take only the first valid token and reject any non-alphanumeric/dash content.
  const rawExt = (req.headers['x-file-ext'] as string) || 'png';
  if (/[\r\n]/.test(rawExt)) return res.status(400).json({ error: 'Invalid extension header' });
  const ext = rawExt.replace(/[^\w-]/g, '').toLowerCase();
  if (!UPLOAD_ALLOWED_EXTS.has(ext)) return res.status(400).json({ error: `Extension .${ext} not allowed` });
  const originalName = (req.headers['x-file-name'] as string) || '';
  // Reject null bytes, CR, LF in filename — Node path.join truncates at \x00, bypassing ext check.
  if (/[\x00\r\n]/.test(originalName)) return res.status(400).json({ error: 'Invalid filename' });
  const destDir = path.join(os.homedir(), 'Desktop');
  const filename = safeDesktopFilename(originalName, ext || 'bin');
  const filepath = path.join(destDir, filename);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(filepath, req.body as Buffer);
  res.json({ path: filepath });
});

// JSON error handler — must precede static + catch-all to intercept errors from API routes
// before the SPA fallback swallows them. 5xx responses use a generic message to avoid leaking
// internal paths or stack info to the client (full err logged server-side).
app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  const message = status >= 500 ? 'Internal error' : (err.message || 'Error');
  res.status(status).json({ error: message });
});

app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

wss.on('connection', (ws) => {
  clients.add(ws);

  send(ws, {
    type: 'sessions_list',
    sessions: [...sessions.values()].map(sessionInfo),
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage;

      switch (msg.type) {
        case 'create_session': {
          if (sessions.size >= MAX_SESSIONS) {
            send(ws, { type: 'error', error: `Max ${MAX_SESSIONS} concurrent sessions reached` });
            break;
          }
          let safeCwd: string | undefined = undefined;
          if (typeof msg.cwd === 'string' && msg.cwd.trim()) {
            try {
              const raw = msg.cwd.trim();
              // Reject ~user/... (other users' homes) — only ~/path is supported.
              if (raw.startsWith('~') && raw.length > 1 && raw[1] !== '/') {
                send(ws, { type: 'error', error: 'Only ~/path tilde expansion is supported' });
                break;
              }
              const expanded = raw.startsWith('~') ? path.join(HOME, raw.slice(1)) : raw;
              // safePath resolves symlinks AND blocks sensitive dirs, matching all other file APIs.
              const resolved = safePath(expanded);
              if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                safeCwd = resolved;
              } else {
                send(ws, { type: 'error', error: 'Invalid cwd — must be an existing directory inside your home' });
                break;
              }
            } catch {
              send(ws, { type: 'error', error: 'Invalid cwd' });
              break;
            }
          }
          const session = createSession(safeCwd, msg.resumePath, msg.sessionName, msg.projectId, msg.initialInput);
          broadcast({ type: 'session_created', session: sessionInfo(session) });
          break;
        }

        case 'close_session': {
          const session = sessions.get(msg.sessionId!);
          if (session) {
            if (session.idleTimer) clearTimeout(session.idleTimer);
            try { session.pty.kill(); } catch {}
            sessions.delete(msg.sessionId!);
            broadcast({ type: 'session_closed', sessionId: msg.sessionId });
          }
          break;
        }

        case 'input': {
          const session = sessions.get(msg.sessionId!);
          if (session && msg.data !== undefined) {
            if (msg.data.trim().length > 0) session.notifyOnIdle = true;
            if (msg.data.length > 1 && msg.data.endsWith('\r')) {
              session.pty.write(msg.data.slice(0, -1));
              setTimeout(() => session.pty.write('\r'), 80);
            } else {
              session.pty.write(msg.data);
            }
          }
          break;
        }

        case 'interrupt_session': {
          const session = sessions.get(msg.sessionId!);
          if (session) session.pty.write('\x03');
          break;
        }

        case 'resize': {
          const session = sessions.get(msg.sessionId!);
          if (session && msg.cols && msg.rows) {
            const cols = Math.max(10, Math.min(Math.floor(msg.cols), 500));
            const rows = Math.max(5, Math.min(Math.floor(msg.rows), 200));
            try { session.pty.resize(cols, rows); } catch {}
          }
          break;
        }

        case 'get_buffer': {
          const session = sessions.get(msg.sessionId!);
          if (session) send(ws, { type: 'buffer', sessionId: msg.sessionId, data: session.buffer });
          break;
        }

        case 'rename_session': {
          const session = sessions.get(msg.sessionId!);
          if (session && typeof msg.name === 'string') {
            const cleaned = msg.name.replace(/[\x00-\x1f]/g, '').slice(0, 80).trim();
            if (cleaned.length === 0) break;
            session.name = cleaned;
            broadcast({ type: 'session_renamed', sessionId: msg.sessionId, name: cleaned });
          }
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => clients.delete(ws));
});

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, '127.0.0.1', () => {
  const logicConnected = fs.existsSync(path.join(JOCA_LOGIC_ROOT, '.claude'));
  console.log(`JOCA_UI → http://localhost:${PORT}`);
  console.log(`JOCA_Logic → ${JOCA_LOGIC_ROOT} (${logicConnected ? 'connected' : 'not found'})`);
  if (logicConnected) {
    const items = collectToolkitItems();
    console.log(`  Skills: ${items.skills.length} · Agents: ${items.agents.length} · Commands: ${items.commands.length}`);
  }
});

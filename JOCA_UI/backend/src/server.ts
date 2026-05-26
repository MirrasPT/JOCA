import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync, spawn } from 'child_process';

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
  ? (process.env.COMSPEC || 'powershell.exe')
  : (process.env.SHELL || '/bin/zsh');
const BUFFER_MAX = 50_000;
const IDLE_DEBOUNCE_MS = 1500;
const DONE_MIN_WORK_MS = 2000;

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

function assertHomePath(targetPath: string) {
  const resolved = path.resolve(targetPath);
  if (!isInsideHome(resolved)) throw new Error('Forbidden');
  return resolved;
}

function assertClaudePath(targetPath: string) {
  const resolved = path.resolve(targetPath);
  if (!isInside(CLAUDE_DIR, resolved)) throw new Error('Forbidden');
  return resolved;
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
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe) throw new Error('Invalid name');
  return safe;
}

function sanitizeToolkitCategory(category?: string) {
  return (category || 'created-skills')
    .split('/')
    .map((segment) => sanitizeToolkitName(segment))
    .join('/');
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
  const cmd = IS_WINDOWS ? `where ${binary}` : `command -v ${binary}`;
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
      const output = runShell('codex login status 2>&1');
      authStatus = output.toLowerCase().includes('logged in') ? 'logged-in' : 'not-logged-in';
      authDetail = output || authDetail;
    }

    if (installed && tool.id === 'agy') {
      const settingsPath = path.join(HOME, '.gemini', 'antigravity-cli', 'settings.json');
      const hasSettings = fs.existsSync(settingsPath);
      authStatus = hasSettings ? 'unknown' : 'unknown';
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
      if (fs.existsSync(helperPath)) fs.chmodSync(helperPath, 0o755);
    }
  } catch (e) {
    console.warn('Could not chmod node-pty spawn-helper:', e);
  }
}

ensureNodePtyHelpersExecutable();

function findClaude(): string {
  const cmd = IS_WINDOWS ? 'where claude' : 'which claude';
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

  setTimeout(() => ptyProcess.write(`${CLAUDE_BIN} --dangerously-skip-permissions\r`), 100);

  if (resumePath) {
    const hasClaudeMd = fs.existsSync(path.join(resumePath, 'CLAUDE.md'));
    const cmd = hasClaudeMd ? `/resume "${resumePath}"` : `/init-project "${resumePath}"`;
    setTimeout(() => {
      ptyProcess.write(cmd);
      setTimeout(() => ptyProcess.write('\r'), 80);
    }, 1200);
  }

  if (initialInput) {
    setTimeout(() => {
      ptyProcess.write(initialInput.endsWith('\r') ? initialInput : `${initialInput}\r`);
    }, resumePath ? 2200 : 1200);
  }

  ptyProcess.onData((data: string) => {
    session.buffer += data;
    if (session.buffer.length > BUFFER_MAX) {
      session.buffer = session.buffer.slice(session.buffer.length - BUFFER_MAX);
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
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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
  if (!fs.existsSync(p)) return res.status(400).json({ error: 'Path does not exist' });
  const projects = loadProjects();
  if (projects.find((pr) => pr.path === p)) return res.status(409).json({ error: 'Already exists' });
  const project: Project = {
    id: randomUUID(),
    name: name?.trim() || p.split('/').pop() || p,
    path: p,
    color: color?.trim() || undefined,
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
  if (req.body.name) p.name = String(req.body.name).trim();
  if (typeof req.body.path === 'string') {
    const nextPath = req.body.path.trim();
    if (!nextPath) return res.status(400).json({ error: 'Missing path' });
    if (!fs.existsSync(nextPath)) return res.status(400).json({ error: 'Path does not exist' });
    if (projects.find((pr) => pr.id !== p.id && pr.path === nextPath)) return res.status(409).json({ error: 'Already exists' });
    p.path = nextPath;
  }
  if (typeof req.body.color === 'string') p.color = req.body.color || undefined;
  if (req.body.githubRepo !== undefined) {
    p.githubRepo = req.body.githubRepo ? String(req.body.githubRepo).trim() : undefined;
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

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  if (!safeName) return res.status(400).json({ error: 'Invalid name' });

  const projectClaudeDir = path.join(p.path, '.claude');

  const itemPath = type === 'skills'
    ? path.join(projectClaudeDir, 'skills', category || 'created-skills', safeName, 'SKILL.md')
    : path.join(projectClaudeDir, 'agents', `${safeName}.md`);

  if (fs.existsSync(itemPath)) {
    return res.status(409).json({ error: 'Item already exists' });
  }

  fs.mkdirSync(path.dirname(itemPath), { recursive: true });

  const boilerplateContent = type === 'skills'
    ? `---
name: ${name}
description: Exclusiva para o projeto ${p.name}
triggers:
  - "${safeName}"
---

# ${name}

Instruções para a skill ${name} no projeto ${p.name}.
`
    : `---
name: ${name}
description: Agente exclusivo para o projeto ${p.name}
---

# ${name}

Instruções para o agente ${name} no projeto ${p.name}.
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

app.get('/cli-tools', (_req, res) => {
  res.json(getCliTools());
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
  memory[projectId] = {
    ...current,
    ...req.body,
    projectId,
    color: typeof req.body.color === 'string' ? req.body.color : current.color,
    path: typeof req.body.path === 'string' ? req.body.path : current.path,
    recentSessions: Array.isArray(req.body.recentSessions) ? req.body.recentSessions.slice(0, 20) : current.recentSessions,
    favoriteSkills: Array.isArray(req.body.favoriteSkills) ? req.body.favoriteSkills.slice(0, 30) : current.favoriteSkills,
    favoriteAgents: Array.isArray(req.body.favoriteAgents) ? req.body.favoriteAgents.slice(0, 30) : current.favoriteAgents,
    quickCommands: Array.isArray(req.body.quickCommands) ? req.body.quickCommands.slice(0, 12) : current.quickCommands,
    openFiles: Array.isArray(req.body.openFiles) ? req.body.openFiles.slice(0, 20) : current.openFiles,
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
  if (!filePath) return res.status(400).send('Missing path');
  try {
    const resolved = path.resolve(filePath);
    if (!isInsideHome(resolved)) return res.status(403).send('Forbidden');
    const ext = path.extname(resolved).toLowerCase().slice(1);
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
      pdf: 'application/pdf', html: 'text/html', htm: 'text/html',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'text/plain; charset=utf-8');
    res.sendFile(resolved);
  } catch (e) { res.status(400).send(String(e)); }
});

app.post('/open', express.json(), (req, res) => {
  const { path: filePath } = req.body as { path: string };
  if (!filePath) return res.status(400).json({ error: 'Missing path' });
  try {
    const resolved = path.resolve(filePath);
    if (!isInsideHome(resolved)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Path does not exist' });
    const openCmd = IS_WINDOWS ? 'explorer' : 'open';
    spawn(openCmd, [resolved], { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/files', (req, res) => {
  const dirPath = (req.query.path as string) || HOME;
  const showHidden = req.query.hidden === 'true';
  try {
    const resolved = path.resolve(dirPath);
    if (!isInsideHome(resolved)) return res.status(403).json({ error: 'Forbidden' });
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const result = entries
      .filter((e) => showHidden || !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, path: path.join(resolved, e.name), isDir: e.isDirectory() }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ path: resolved, parent: path.dirname(resolved), entries: result });
  } catch (e) { res.status(400).json({ error: String(e) }); }
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
      if (fs.existsSync(nextPath)) return res.status(409).json({ error: 'Already exists' });
      if (action === 'create_folder') fs.mkdirSync(nextPath, { recursive: true });
      else fs.writeFileSync(nextPath, content ?? '');
      return res.json({ ok: true, path: nextPath });
    }

    const resolvedSource = assertHomePath(sourcePath || '');
    if (!fs.existsSync(resolvedSource)) return res.status(404).json({ error: 'Path does not exist' });

    if (action === 'write_file') {
      if (fs.statSync(resolvedSource).isDirectory()) return res.status(400).json({ error: 'Cannot write a directory' });
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
      fs.renameSync(resolvedSource, nextPath);
      return res.json({ ok: true, path: nextPath });
    }

    if (action === 'move') {
      const destinationDir = assertHomePath(targetPath || '');
      const nextPath = assertHomePath(path.join(destinationDir, path.basename(resolvedSource)));
      fs.renameSync(resolvedSource, nextPath);
      return res.json({ ok: true, path: nextPath });
    }

    if (action === 'duplicate') {
      const parsed = path.parse(resolvedSource);
      let nextPath = path.join(parsed.dir, `${parsed.name} copy${parsed.ext}`);
      let index = 2;
      while (fs.existsSync(nextPath)) {
        nextPath = path.join(parsed.dir, `${parsed.name} copy ${index}${parsed.ext}`);
        index++;
      }
      const stat = fs.statSync(resolvedSource);
      if (stat.isDirectory()) fs.cpSync(resolvedSource, nextPath, { recursive: true });
      else fs.copyFileSync(resolvedSource, nextPath);
      return res.json({ ok: true, path: nextPath });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(400).json({ error: String(e instanceof Error ? e.message : e) });
  }
});

app.get('/file-diff', (req, res) => {
  try {
    const filePath = assertHomePath(String(req.query.path || ''));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Path does not exist' });
    const cwd = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    let root = '';
    try { root = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim(); } catch {}
    if (!root) return res.json({ diff: '', message: 'No git repository found for this path' });
    const relative = path.relative(root, filePath);
    const diff = execSync(`git diff -- "${relative.replace(/"/g, '\\"')}"`, { cwd: root, encoding: 'utf8', maxBuffer: 5_000_000 });
    res.json({ diff, root, relative });
  } catch (e) {
    res.status(400).json({ error: String(e instanceof Error ? e.message : e) });
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
    res.status(400).json({ error: String(e instanceof Error ? e.message : e) });
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
    res.status(400).json({ error: String(e instanceof Error ? e.message : e) });
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
    res.status(400).json({ error: String(e instanceof Error ? e.message : e) });
  }
});

app.delete('/toolkit-item', express.json(), (req, res) => {
  try {
    const { path: itemPathRaw } = req.body as { path: string };
    const itemPath = assertClaudePath(itemPathRaw);
    if (!fs.existsSync(itemPath)) return res.status(404).json({ error: 'Not found' });
    fs.rmSync(path.dirname(itemPath).endsWith(path.sep + 'commands') || path.dirname(itemPath).endsWith(path.sep + 'agents')
      ? itemPath
      : path.dirname(itemPath), { recursive: true, force: true });
    refreshMemoryIndexSnapshot();
    res.json({ ok: true, items: collectToolkitItems() });
  } catch (e) {
    res.status(400).json({ error: String(e instanceof Error ? e.message : e) });
  }
});

app.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  const ext = (req.headers['x-file-ext'] as string) || 'png';
  const originalName = (req.headers['x-file-name'] as string) || '';
  const destDir = path.join(os.homedir(), 'Desktop');
  const filename = safeDesktopFilename(originalName, ext.replace(/[^\w-]/g, '') || 'bin');
  const filepath = path.join(destDir, filename);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(filepath, req.body as Buffer);
  res.json({ path: filepath });
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
          const session = createSession(msg.cwd, msg.resumePath, msg.sessionName, msg.projectId, msg.initialInput);
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
            session.pty.write(msg.data);
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
            try { session.pty.resize(msg.cols, msg.rows); } catch {}
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
          if (session && msg.name) {
            session.name = msg.name;
            broadcast({ type: 'session_renamed', sessionId: msg.sessionId, name: msg.name });
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

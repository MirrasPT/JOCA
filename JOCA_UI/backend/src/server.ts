import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

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
}

interface ClientMessage {
  type: 'create_session' | 'close_session' | 'input' | 'resize' | 'get_buffer' | 'rename_session';
  sessionId?: string;
  cwd?: string;
  resumePath?: string;
  sessionName?: string;
  projectId?: string;
  data?: string;
  name?: string;
  cols?: number;
  rows?: number;
}

interface Project {
  id: string;
  name: string;
  path: string;
}

const PROJECTS_FILE = path.join(__dirname, '../../data/projects.json');

function loadProjects(): Project[] {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); } catch { return []; }
}

function saveProjects(projects: Project[]) {
  fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true });
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

const sessions = new Map<string, Session>();
const clients = new Set<WebSocket>();
let sessionCounter = 0;
const HOME = os.homedir();

const SHELL = process.env.SHELL || '/bin/zsh';
const BUFFER_MAX = 50_000;
const IDLE_DEBOUNCE_MS = 1500;
const DONE_MIN_WORK_MS = 2000;

function findClaude(): string {
  try { return execSync('which claude', { encoding: 'utf8' }).trim(); }
  catch { return 'claude'; }
}

const CLAUDE_BIN = findClaude();

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
  cwd: string = path.resolve(__dirname, '../../../'),
  resumePath?: string,
  sessionName?: string,
  projectId?: string
): Session {
  sessionCounter++;
  const id = randomUUID();
  const name = sessionName ?? `Session ${sessionCounter}`;

  const ptyProcess = pty.spawn(SHELL, [], {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
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
  };
  sessions.set(id, session);

  setTimeout(() => ptyProcess.write(`${CLAUDE_BIN} --dangerously-skip-permissions\r`), 100);

  if (resumePath) {
    const hasClaudeMd = fs.existsSync(path.join(resumePath, 'CLAUDE.md'));
    const cmd = hasClaudeMd ? `/resume "${resumePath}"` : `/init-project "${resumePath}"`;
    setTimeout(() => {
      ptyProcess.write(cmd);
      setTimeout(() => ptyProcess.write('\r'), 200);
    }, 5000);
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
      const isDone = wasWorking && workedFor > DONE_MIN_WORK_MS;

      session.status = 'idle';
      session.workingSince = null;
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
  const { name, path: p } = req.body as { name?: string; path: string };
  if (!p) return res.status(400).json({ error: 'Missing path' });
  if (!fs.existsSync(p)) return res.status(400).json({ error: 'Path does not exist' });
  const projects = loadProjects();
  if (projects.find((pr) => pr.path === p)) return res.status(409).json({ error: 'Already exists' });
  const project: Project = { id: randomUUID(), name: name || p.split('/').pop() || p, path: p };
  projects.push(project);
  saveProjects(projects);
  res.json(project);
});

app.patch('/projects/:id', express.json(), (req, res) => {
  const projects = loadProjects();
  const p = projects.find((pr) => pr.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body.name) p.name = req.body.name;
  saveProjects(projects);
  res.json(p);
});

app.delete('/projects/:id', (req, res) => {
  saveProjects(loadProjects().filter((p) => p.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/file-content', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).send('Missing path');
  try {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(HOME)) return res.status(403).send('Forbidden');
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
    const { spawn } = require('child_process');
    spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/files', (req, res) => {
  const dirPath = (req.query.path as string) || HOME;
  const showHidden = req.query.hidden === 'true';
  try {
    const resolved = path.resolve(dirPath);
    if (!resolved.startsWith(HOME)) return res.status(403).json({ error: 'Forbidden' });
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

app.get('/joca-items', (_req, res) => {
  // JOCA toolkit lives in <repo-root>/.claude, 3 levels up from backend/src/
  const claudeDir = path.resolve(__dirname, '../../../.claude');

  const commands: { name: string; insert: string }[] = [];
  const agents: { name: string; insert: string }[] = [];
  const skills: { name: string; category: string; insert: string }[] = [];

  const commandsDir = path.join(claudeDir, 'commands');
  try {
    if (fs.existsSync(commandsDir)) {
      fs.readdirSync(commandsDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .sort()
        .forEach(f => {
          const name = f.replace(/\.md$/, '');
          commands.push({ name, insert: `/${name}` });
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
          const name = f.replace(/\.md$/, '');
          agents.push({ name, insert: name });
        });
    }
  } catch {}

  function walkSkills(dir: string, category: string = '') {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const subDir = path.join(dir, entry.name);
        if (fs.existsSync(path.join(subDir, 'SKILL.md'))) {
          skills.push({ name: entry.name, category: category || 'general', insert: entry.name });
        } else {
          walkSkills(subDir, entry.name);
        }
      }
    } catch {}
  }
  walkSkills(path.join(claudeDir, 'skills'));

  res.json({ commands, agents, skills });
});

app.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  const ext = (req.headers['x-file-ext'] as string) || 'png';
  const originalName = (req.headers['x-file-name'] as string) || '';
  const destDir = path.join(os.homedir(), 'Desktop');
  const filename = originalName || `joca-drop-${randomUUID().slice(0, 8)}.${ext}`;
  const filepath = path.join(destDir, filename);
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
          const session = createSession(msg.cwd, msg.resumePath, msg.sessionName, msg.projectId);
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
          if (session && msg.data !== undefined) session.pty.write(msg.data);
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
  console.log(`JOCA_UI → http://localhost:${PORT}`);
});

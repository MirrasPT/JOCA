import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync, execFileSync, spawn } from 'child_process';
import {
  PATH_SAFE, ALLOWED_ROOTS, HttpError,
  isInside, realPathSafe, isInsideAllowedRoot, isAllowedRoot, isSensitivePath,
  safePath, safePathForRead, assertHomePath, isAllowedOrigin, requireSafeOrigin,
} from './security-fs';
import { getCliTools } from './cli-capabilities';
import { getRateLimits } from './rate-limits';
import {
  JOCA_LOGIC_ROOT, CLAUDE_DIR, MEMORY_INDEX_FILE,
  parseFrontmatter, collectToolkitItems, refreshMemoryIndexSnapshot,
} from './toolkit-registry';
import {
  Project, ProjectMemory,
  readJsonFile, loadProjects, saveProjects, loadProjectMemory, saveProjectMemory,
  loadUiSettings, saveUiSettings,
  loadMasterChat, appendMasterChat, clearMasterChat,
} from './project-store';
import { sessionManager, MAX_SESSIONS } from './session-manager';
import type { Session } from './session-manager';
import { runMaster } from './master/orchestrator';
import { getProviderAvailability, claudeProvider } from './master/provider';
import { ollamaProvider } from './master/ollama-provider';
import { buildMasterToolDefs, createMasterToolsServer } from './master/master-tools';
import { MASTER_BRIDGE_SECRET } from './master/bridge-config';
import { clearMasterMemory } from './master/master-memory';
import {
  loadAutomations, getAutomation, upsertAutomation, deleteAutomation, makeAutomation,
  computeNextRun, setAutomationsBroadcaster, setAutomationRunner, type Automation, type AutomationNode,
} from './automations/store';
import { startScheduler, runAutomationNow, type SchedulerDeps } from './automations/scheduler';

interface ClientMessage {
  type: 'create_session' | 'close_session' | 'input' | 'resize' | 'get_buffer' | 'rename_session' | 'interrupt_session' | 'master_message';
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
  text?: string;   // master_message: the user's NL instruction to the Master
  model?: string;  // master_message: optional brain model override
}

const clients = new Set<WebSocket>();
const HOME = os.homedir();

const IS_WINDOWS = process.platform === 'win32';

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

// Forward SessionManager lifecycle events to the WS broadcast — identical message shapes to v1.
// ('done' is consumed by the future Master; it is NOT broadcast, so the UI is unchanged.)
// 'spawn' is the single broadcast source for session_created — covers both UI-created sessions
// and workers the Master spawns programmatically (MCP spawn_worker), so workers show in the UI.
sessionManager.on('spawn', ({ session }: { session: Session }) => {
  broadcast({ type: 'session_created', session: sessionManager.info(session) });
});
sessionManager.on('output', ({ sessionId, data }: { sessionId: string; data: string }) => {
  broadcast({ type: 'output', sessionId, data });
});
sessionManager.on('status', ({ sessionId, status, isDone }: { sessionId: string; status: 'working' | 'idle'; isDone?: boolean }) => {
  broadcast(status === 'idle'
    ? { type: 'session_status', sessionId, status, isDone }
    : { type: 'session_status', sessionId, status });
});
sessionManager.on('closed', ({ sessionId }: { sessionId: string }) => {
  broadcast({ type: 'session_closed', sessionId });
});

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
  const projects = loadProjects()
    .map((p) => ({
      ...p,
      initialized: fs.existsSync(path.join(p.path, 'CLAUDE.md')),
    }))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  res.json(projects);
});

// Reorder projects: body { ids: string[] } in the desired order. Projects not listed
// (e.g. archived) keep a stable position after the listed ones.
app.put('/projects/order', express.json(), (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === 'string') : null;
  if (!ids) return res.status(400).json({ error: 'Missing ids array' });
  const projects = loadProjects();
  const orderMap = new Map(ids.map((id, i) => [id, i] as const));
  projects.forEach((p, idx) => {
    p.order = orderMap.has(p.id) ? orderMap.get(p.id)! : ids.length + idx;
  });
  saveProjects(projects);
  res.json({ ok: true });
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
  if (typeof req.body.archived === 'boolean') p.archived = req.body.archived;
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
    shell: sessionManager.shell,
    claudeBin: sessionManager.claudeBin,
    cwd: process.cwd(),
    uptimeMs: Date.now() - STARTED_AT,
    port: Number(process.env.PORT || 7491),
    sessionCount: sessionManager.size,
    projectCount: projects.length,
    sessions: sessionManager.listInfo(),
  });
});

app.get('/rate-limits', async (_req, res) => {
  res.json(await getRateLimits());
});

app.get('/cli-tools', (_req, res) => {
  res.json(getCliTools());
});

app.get('/ui-settings', (_req, res) => {
  res.json(loadUiSettings());
});

// Persisted Master chat — survives reloads/restarts. The frontend loads this on mount.
app.get('/master-chat', (_req, res) => {
  res.json(loadMasterChat());
});

app.delete('/master-chat', (_req, res) => {
  clearMasterChat();
  clearMasterMemory();
  broadcast({ type: 'master_chat_cleared' });
  res.json({ ok: true });
});

const MASTER_PROVIDERS = ['claude', 'codex', 'antigravity', 'ollama'] as const;
app.patch('/ui-settings', express.json(), (req, res) => {
  const current = loadUiSettings();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updated = { ...current };
  if ('skipPermissions' in body) updated.skipPermissions = body.skipPermissions === true;
  if ('masterProvider' in body && MASTER_PROVIDERS.includes(body.masterProvider as typeof MASTER_PROVIDERS[number])) {
    updated.masterProvider = body.masterProvider as typeof MASTER_PROVIDERS[number];
  }
  if ('masterModel' in body) {
    const m = typeof body.masterModel === 'string' ? body.masterModel.trim().slice(0, 80) : '';
    updated.masterModel = m || undefined;
  }
  if ('optimizeProvider' in body && MASTER_PROVIDERS.includes(body.optimizeProvider as typeof MASTER_PROVIDERS[number])) {
    updated.optimizeProvider = body.optimizeProvider as typeof MASTER_PROVIDERS[number];
  }
  if ('optimizeModel' in body) {
    const m = typeof body.optimizeModel === 'string' ? body.optimizeModel.trim().slice(0, 80) : '';
    updated.optimizeModel = m || undefined;
  }
  saveUiSettings(updated);
  res.json(updated);
});

// Which Master providers are available on this machine (CLI logged in / endpoint up).
app.get('/master-providers', async (_req, res) => {
  res.json(await getProviderAvailability());
});

// ── Master control plane — used by the Codex MCP bridge subprocess (codex-master-bridge.mjs) ─────
// One shared tool registry over the SAME module-singleton worker map the Claude path uses, so a
// worker spawned via Codex is visible to Claude's list_workers and vice-versa. Authed by the shared
// secret (the bridge reads it from DATA_DIR/master-bridge.secret); requireSafeOrigin already lets the
// no-Origin local subprocess through and blocks cross-origin browser CSRF.
const masterCtlOpts = { onProjectsChanged: () => broadcast({ type: 'projects_changed' }) };
const masterCtlWorkers = createMasterToolsServer(sessionManager, masterCtlOpts).workers;
const masterCtlDefs = buildMasterToolDefs({ sm: sessionManager, opts: masterCtlOpts, workers: masterCtlWorkers });
const masterCtlMap = new Map(masterCtlDefs.map((d) => [d.name, d]));
const masterCtlAuthed = (req: express.Request) => req.get('x-joca-master') === MASTER_BRIDGE_SECRET;

app.get('/master/tools-schema', (req, res) => {
  if (!masterCtlAuthed(req)) return res.status(403).json({ error: 'forbidden' });
  res.json(masterCtlDefs.map((d) => ({ name: d.name, description: d.description, jsonSchema: d.jsonSchema })));
});

app.post('/master/tool', express.json({ limit: '2mb' }), async (req, res) => {
  if (!masterCtlAuthed(req)) return res.status(403).json({ error: 'forbidden' });
  const { name, args } = (req.body ?? {}) as { name?: string; args?: unknown };
  const def = name ? masterCtlMap.get(name) : undefined;
  if (!def) return res.status(404).json({ error: `unknown tool ${name}` });
  try { res.json({ text: await def.handler(args ?? {}) }); }
  catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

// ── Automations (v1) ─────────────────────────────────────────────────────────
// One scheduler runs in this always-on backend. The `message` node delivers into the Master chat
// (appendMasterChat + broadcast) — same channel the Master uses; WhatsApp is a future deliver target.
const automationDeps: SchedulerDeps = {
  deliver: (text, automationName) => {
    const entry = { id: randomUUID(), role: 'summary' as const, text: `🤖 ${automationName}\n\n${text}`, ts: Date.now() };
    appendMasterChat(entry);
    broadcast({ type: 'automation_message', id: entry.id, text: entry.text, ts: entry.ts });
  },
  onActivity: (text) => broadcast({ type: 'automation_activity', text }),
  onChanged: () => broadcast({ type: 'automations_changed' }),
};
// Let the Master's create_automation tool refresh the UI live (decoupled from the orchestrator chain).
setAutomationsBroadcaster(() => broadcast({ type: 'automations_changed' }));
// Let the Master's run_automation tool fire an action (needs the scheduler deps that live here).
setAutomationRunner(async (id, input) => {
  const r = await runAutomationNow(id, automationDeps, input);
  return r ? { ok: r.ok, finalOutput: r.finalOutput } : null;
});

app.get('/automations', (_req, res) => res.json(loadAutomations()));

app.post('/automations', express.json({ limit: '1mb' }), (req, res) => {
  const b = (req.body ?? {}) as Partial<Automation>;
  if (!b.name || !Array.isArray(b.nodes) || b.nodes.length === 0) {
    return res.status(400).json({ error: 'name e nodes[] (>=1) obrigatorios' });
  }
  const provider = MASTER_PROVIDERS.includes(b.provider as typeof MASTER_PROVIDERS[number]) ? b.provider : undefined;
  const model = typeof b.model === 'string' && b.model.trim() ? b.model.trim().slice(0, 80) : undefined;
  const skills = Array.isArray(b.skills) ? (b.skills as unknown[]).filter((s) => typeof s === 'string') as string[] : undefined;
  const requireConfirm = b.requireConfirm === true || undefined;
  const a = makeAutomation({ name: b.name, nodes: b.nodes as AutomationNode[], trigger: b.trigger, enabled: b.enabled, provider, model, skills, requireConfirm });
  upsertAutomation(a);
  broadcast({ type: 'automations_changed' });
  res.json(a);
});

app.patch('/automations/:id', express.json({ limit: '1mb' }), (req, res) => {
  const cur = getAutomation(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  const b = (req.body ?? {}) as Partial<Automation>;
  const updated: Automation = { ...cur };
  if (typeof b.name === 'string') updated.name = b.name.trim().slice(0, 120) || cur.name;
  if (typeof b.enabled === 'boolean') updated.enabled = b.enabled;
  if ('provider' in b) updated.provider = MASTER_PROVIDERS.includes(b.provider as typeof MASTER_PROVIDERS[number]) ? b.provider : undefined;
  if ('model' in b) updated.model = typeof b.model === 'string' && b.model.trim() ? b.model.trim().slice(0, 80) : undefined;
  if ('skills' in b) updated.skills = Array.isArray(b.skills) ? (b.skills as unknown[]).filter((s) => typeof s === 'string') as string[] : undefined;
  if ('requireConfirm' in b) updated.requireConfirm = b.requireConfirm === true || undefined;
  if (b.trigger) updated.trigger = b.trigger;
  if (Array.isArray(b.nodes)) updated.nodes = (b.nodes as AutomationNode[]).map((n) => ({ ...n, id: n.id || randomUUID() }));
  updated.nextRunAt = updated.enabled && updated.trigger.type === 'schedule' ? computeNextRun(updated.trigger.schedule) : null;
  upsertAutomation(updated);
  broadcast({ type: 'automations_changed' });
  res.json(updated);
});

app.delete('/automations/:id', (req, res) => {
  const ok = deleteAutomation(req.params.id);
  if (ok) broadcast({ type: 'automations_changed' });
  res.json({ ok });
});

// Optimise an automation/action objective via the brain (direct LLM call, no workers). Returns the
// rewritten text only — the UI's "Optimizar" button replaces the field with it.
app.post('/optimize-objective', express.json(), async (req, res) => {
  const text = typeof (req.body ?? {}).text === 'string' ? (req.body as { text: string }).text.trim() : '';
  if (!text) return res.status(400).json({ error: 'text vazio' });
  const systemPrompt = [
    'És um REESCRITOR de instruções. Recebes a instrução que um utilizador escreveu para um agente de IA executar mais tarde, e devolves uma versão melhor dessa INSTRUÇÃO.',
    'NUNCA cumpras, executes ou respondas à instrução — só a reescreves. Não tens ferramentas; não há nada para executar.',
    'A versão optimizada deve ser clara, objectiva e accionável: explicita o resultado esperado e remove ambiguidade. Mantém pt-pt e o tom.',
    'PRESERVA exactamente quaisquer placeholders {{input}}.',
    'Responde APENAS com o texto da instrução reescrita, sem aspas, sem preâmbulo, sem comentários.',
  ].join(' ');
  const prompt = `Reescreve melhor esta instrução (NÃO a cumpras, só melhora o texto):\n"""\n${text}\n"""`;
  const ui = loadUiSettings();
  try {
    let optimized: string;
    if (ui.optimizeProvider === 'ollama') {
      // Local, zero-cost, pure text (no tools — can't execute).
      optimized = (await ollamaProvider.completeText(prompt, systemPrompt, ui.optimizeModel)).trim();
    } else {
      // Default: Claude Agent SDK with tools DISABLED → pure text rewrite. (codex/antigravity are not
      // offered for optimize — they are agent CLIs without a clean tool-free text path.)
      const events = claudeProvider.run(prompt, { systemPrompt, model: ui.optimizeModel ?? 'sonnet', noTools: true });
      let acc = '', result = '';
      for await (const ev of events) {
        if (ev.type === 'text' && ev.text) acc += ev.text;
        else if (ev.type === 'result') result = ev.text;
      }
      optimized = (result || acc).trim();
    }
    res.json({ text: optimized || text });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/automations/:id/run', express.json(), (req, res) => {
  const input = typeof (req.body ?? {}).input === 'string' ? (req.body as { input: string }).input : '';
  runAutomationNow(req.params.id, automationDeps, input).then((result) => {
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  }).catch((e) => res.status(500).json({ error: e instanceof Error ? e.message : String(e) }));
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
    // Expose parent === path (frontend hides the ".." entry) when at a filesystem root
    // or when going up would leave every allowed root. Otherwise navigation up is allowed.
    const up = path.dirname(resolved);
    const parent = (up === resolved || !isInsideAllowedRoot(up)) ? resolved : up;
    res.json({ path: resolved, parent, entries: result });
  } catch { res.status(400).json({ error: 'Read failed' }); }
});

// Roots the file browser may jump straight to: HOME plus every allowed drive/extra root.
// Lets the UI offer a drive selector (C:\, D:\, ...) instead of forcing ".." navigation.
app.get('/roots', (_req, res) => {
  const roots = ALLOWED_ROOTS.map((r) => ({
    path: r,
    label: r === path.resolve(HOME) ? '~' : r,
    isHome: r === path.resolve(HOME),
  }));
  res.json({ home: path.resolve(HOME), roots });
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
    // Git can resolve to a worktree/submodule outside the allowed roots — re-validate.
    if (!isInsideAllowedRoot(realPathSafe(root))) return res.json({ diff: '', message: 'Git root outside allowed roots' });
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

// Allowlist of droppable extensions. 'svg'/'html'/'htm' are intentionally EXCLUDED — they can
// carry executable scripts and would be XSS vectors when rendered via /file-content. Executables
// (exe/bat/cmd/ps1/sh/…) are also excluded — no reason to land them via a drop.
const UPLOAD_ALLOWED_EXTS = new Set([
  // images
  'png','jpg','jpeg','gif','webp','bmp','ico','heic','heif','tiff','tif','avif',
  // documents
  'pdf','txt','md','rtf','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp',
  // data / text
  'json','csv','tsv','xml','yaml','yml','log','ini','toml',
  // archives
  'zip','rar','7z','tar','gz',
  // audio
  'mp3','wav','ogg','flac','m4a','aac',
  // video
  'mp4','mov','webm','mkv','avi','m4v',
  // design / raster
  'psd','ai','eps','sketch','fig',
  // common code/text attachments
  'ts','tsx','js','jsx','py','rb','go','rs','java','c','h','cpp','cs','php','sql','sh','css','scss',
]);

// All drops land in a dedicated folder (not the Desktop) so the worker gets a real, stable path
// without cluttering common dirs. Folders preserve their relative structure under here.
const DROP_DIR = path.join(os.homedir(), 'JOCA_Drops');

// Validate a client-supplied relative path (folder drop). Rejects traversal/absolute/control chars;
// sanitizes each segment the same way single filenames are sanitized. Returns the segment list.
function safeRelSegments(rel: string): string[] | null {
  if (/[\x00\r\n]/.test(rel)) return null;
  const segs = rel.split(/[\\/]+/).filter(Boolean);
  const out: string[] = [];
  for (const s of segs) {
    if (s === '.' || s === '..') return null;
    const clean = path.basename(s).replace(/[^\w .@()-]/g, '-').trim();
    if (!clean) return null;
    out.push(clean);
  }
  return out.length ? out : null;
}

app.post('/upload', express.raw({ type: '*/*', limit: '200mb' }), (req, res) => {
  // Strip CR/LF from headers — Express may receive multiple values when a client splits with \r\n.
  // We take only the first valid token and reject any non-alphanumeric/dash content.
  const rawExt = (req.headers['x-file-ext'] as string) || 'png';
  if (/[\r\n]/.test(rawExt)) return res.status(400).json({ error: 'Invalid extension header' });
  const ext = rawExt.replace(/[^\w-]/g, '').toLowerCase();
  if (!UPLOAD_ALLOWED_EXTS.has(ext)) return res.status(400).json({ error: `Extension .${ext} not allowed` });
  const originalName = (req.headers['x-file-name'] as string) || '';
  // Reject null bytes, CR, LF in filename — Node path.join truncates at \x00, bypassing ext check.
  if (/[\x00\r\n]/.test(originalName)) return res.status(400).json({ error: 'Invalid filename' });

  // Folder drop: x-rel-path carries the file's path relative to the dropped folder
  // (e.g. "Assets/sub/a.png"). We rebuild that tree under DROP_DIR and report the folder root.
  const rawRel = (req.headers['x-rel-path'] as string) || '';
  let filepath: string;
  let root: string | undefined;
  if (rawRel) {
    const segs = safeRelSegments(rawRel);
    if (!segs) return res.status(400).json({ error: 'Invalid relative path' });
    filepath = path.join(DROP_DIR, ...segs);
    root = path.join(DROP_DIR, segs[0]);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  } else {
    const filename = safeDesktopFilename(originalName, ext || 'bin');
    filepath = path.join(DROP_DIR, filename);
    fs.mkdirSync(DROP_DIR, { recursive: true });
  }
  fs.writeFileSync(filepath, req.body as Buffer);
  res.json({ path: filepath, ...(root ? { root } : {}) });
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
    sessions: sessionManager.listInfo(),
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage;

      switch (msg.type) {
        case 'create_session': {
          if (sessionManager.size >= MAX_SESSIONS) {
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
          sessionManager.spawn({
            cwd: safeCwd,
            resumePath: msg.resumePath,
            sessionName: msg.sessionName,
            projectId: msg.projectId,
            initialInput: msg.initialInput,
          });
          // Broadcast is emitted by the SessionManager 'spawn' event subscriber above.
          break;
        }

        case 'close_session': {
          sessionManager.kill(msg.sessionId!);
          break;
        }

        case 'input': {
          if (msg.data !== undefined) sessionManager.input(msg.sessionId!, msg.data);
          break;
        }

        case 'interrupt_session': {
          sessionManager.interrupt(msg.sessionId!);
          break;
        }

        case 'resize': {
          if (msg.cols && msg.rows) sessionManager.resize(msg.sessionId!, msg.cols, msg.rows);
          break;
        }

        case 'get_buffer': {
          const buffer = sessionManager.getBuffer(msg.sessionId!);
          if (buffer !== undefined) send(ws, { type: 'buffer', sessionId: msg.sessionId, data: buffer });
          break;
        }

        case 'rename_session': {
          if (typeof msg.name === 'string') {
            const cleaned = sessionManager.rename(msg.sessionId!, msg.name);
            if (cleaned !== null) broadcast({ type: 'session_renamed', sessionId: msg.sessionId, name: cleaned });
          }
          break;
        }

        case 'master_message': {
          // Fase 1a: NL instruction → Master brain orchestrates visible workers. Streams steps
          // back to THIS client only (orchestration state is per-conversation, not broadcast).
          const text = (msg.text ?? '').trim();
          if (!text) { send(ws, { type: 'error', error: 'master_message needs text' }); break; }
          // Persist the user turn so the chat survives reloads/restarts (see GET /master-chat).
          appendMasterChat({ id: randomUUID(), role: 'user', text, ts: Date.now() });
          // Fire-and-forget; steps stream via onStep. Errors surface as a master_error message.
          // Provider + model come from Settings (overridable per-message via msg.model).
          const uiSettings = loadUiSettings();
          void runMaster(text, {
            provider: uiSettings.masterProvider ?? 'claude',
            model: msg.model ?? uiSettings.masterModel,
            onStep: (step) => {
              if (step.type === 'message') send(ws, { type: 'master_message', text: step.text });
              else if (step.type === 'step') send(ws, { type: 'orchestration_step', tool: step.tool, input: step.input });
              else if (step.type === 'done') {
                send(ws, { type: 'worker_summary', summary: step.summary, isError: step.isError, costUsd: step.costUsd });
                appendMasterChat({ id: randomUUID(), role: 'summary', text: step.summary, isError: step.isError, costUsd: step.costUsd, ts: Date.now() });
              }
            },
            // Master created/registered a project → tell all clients to refresh their project list.
            onProjectsChanged: () => broadcast({ type: 'projects_changed' }),
          }).catch((e) => {
            console.error('Master error:', e);
            const errText = e instanceof Error ? e.message : String(e);
            send(ws, { type: 'master_error', error: errText });
            appendMasterChat({ id: randomUUID(), role: 'error', text: errText, ts: Date.now() });
          });
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => clients.delete(ws));
});

const PORT = Number(process.env.PORT || 7491);
server.listen(PORT, '127.0.0.1', () => {
  const logicConnected = fs.existsSync(path.join(JOCA_LOGIC_ROOT, '.claude'));
  console.log(`JOCA_OS → http://localhost:${PORT}`);
  console.log(`JOCA_Brain → ${JOCA_LOGIC_ROOT} (${logicConnected ? 'connected' : 'not found'})`);
  if (logicConnected) {
    const items = collectToolkitItems();
    console.log(`  Skills: ${items.skills.length} · Agents: ${items.agents.length} · Commands: ${items.commands.length}`);
  }
  startScheduler(automationDeps);
});

import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { HttpError, realPathSafe } from '../security-fs';
import { getCliTools } from '../cli-capabilities';
import { getRateLimits } from '../rate-limits';
import {
  JOCA_LOGIC_ROOT, CLAUDE_DIR, MEMORY_INDEX_FILE,
  parseFrontmatter, collectToolkitItems, refreshMemoryIndexSnapshot,
} from '../toolkit-registry';
import {
  ProjectMemory,
  readJsonFile, loadProjects, loadProjectMemory, saveProjectMemory,
  loadUiSettings, saveUiSettings,
} from '../project-store';
import { sessionManager } from '../session-manager';
import {
  HOME, STARTED_AT, LLM_PROVIDERS,
  assertClaudePath, validateToolkitContent, sanitizeToolkitName, sanitizeToolkitCategory,
} from './helpers';

// Runtime/info + UI settings + project-memory + global toolkit (.claude) item CRUD + knowledge graph.
export function toolkitRouter(): Router {
  const r = Router();

  r.get('/runtime', (_req, res) => {
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

  r.get('/rate-limits', async (_req, res) => {
    res.json(await getRateLimits());
  });

  r.get('/cli-tools', (_req, res) => {
    res.json(getCliTools());
  });

  r.get('/ui-settings', (_req, res) => {
    res.json(loadUiSettings());
  });

  r.patch('/ui-settings', express.json(), (req, res) => {
    const current = loadUiSettings();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updated = { ...current };
    if ('skipPermissions' in body) updated.skipPermissions = body.skipPermissions === true;
    if ('optimizeProvider' in body && LLM_PROVIDERS.includes(body.optimizeProvider as typeof LLM_PROVIDERS[number])) {
      updated.optimizeProvider = body.optimizeProvider as typeof LLM_PROVIDERS[number];
    }
    if ('optimizeModel' in body) {
      const m = typeof body.optimizeModel === 'string' ? body.optimizeModel.trim().slice(0, 80) : '';
      updated.optimizeModel = m || undefined;
    }
    saveUiSettings(updated);
    res.json(updated);
  });

  r.get('/project-memory', (_req, res) => {
    res.json(loadProjectMemory());
  });

  r.patch('/project-memory/:id', express.json(), (req, res) => {
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

  r.get('/joca-logic', (_req, res) => {
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

  r.get('/knowledge-graph', (_req, res) => {
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

  r.get('/joca-items', (_req, res) => {
    res.json(collectToolkitItems());
  });

  r.get('/toolkit-item', (req, res) => {
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

  r.post('/toolkit-item', express.json({ limit: '2mb' }), (req, res) => {
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

  r.patch('/toolkit-item', express.json({ limit: '2mb' }), (req, res) => {
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

  r.delete('/toolkit-item', express.json(), (req, res) => {
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

  return r;
}

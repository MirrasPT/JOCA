import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { HttpError, realPathSafe } from '../security-fs';
import { getCliTools } from '../cli-capabilities';
import { CLI_IDS, type CliId } from '../cli-profiles';
import { getRateLimits } from '../rate-limits';
import {
  BRAIN, BRAIN_LOCALIZADO, CLAUDE_DIR, MEMORY_INDEX_FILE,
  parseFrontmatter, collectToolkitItems, refreshMemoryIndexSnapshot,
} from '../toolkit-registry';
import { DESCRICAO_DA_VIA } from '../brain-locator';

// Sem Brain não há toolkit global para ler nem onde gravar: as rotas de itens recusam com isto, em
// vez de criarem uma pasta `.claude` num sítio qualquer.
const SEM_BRAIN_ERRO = 'Sem JOCA Brain — define JOCA_BRAIN para gerir o toolkit global';
import {
  loadProjects, loadProjectMemory, saveProjectMemory,
  loadUiSettings, saveUiSettings,
} from '../project-store';
import { sessionManager } from '../session-manager';
import {
  HOME, STARTED_AT,
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
      // Rótulo da instância, mostrado na barra ao lado do wordmark. Serve para distinguir duas
      // instalações a correr ao mesmo tempo (uma de trabalho e uma de desenvolvimento), que de
      // outra forma são idênticas no ecrã. Sem `JOCA_ENV` fica `null` e a barra mostra a versão.
      env: (process.env.JOCA_ENV || '').trim().slice(0, 8).toUpperCase() || null,
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
    if ('theme' in body) {
      updated.theme = body.theme === 'light' ? 'light' : 'dark';
    }
    if ('themeMode' in body) {
      updated.themeMode = body.themeMode === 'light' || body.themeMode === 'auto' ? body.themeMode : 'dark';
    }
    // Horários do modo dinâmico. Só se guarda "HH:MM" válido — uma hora inválida vinda do cliente
    // deixaria o tema preso no escuro sem o utilizador perceber porquê.
    for (const key of ['themeDayStart', 'themeNightStart'] as const) {
      if (!(key in body)) continue;
      const v = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
      const m = /^(\d{1,2}):(\d{2})$/.exec(v);
      if (m && Number(m[1]) <= 23 && Number(m[2]) <= 59) {
        updated[key] = `${m[1].padStart(2, '0')}:${m[2]}`;
      }
    }
    // Tema de marca. Guardado como texto simples (o catálogo vive no cliente), mas sanitizado —
    // este valor acaba num atributo do `<html>`.
    if ('brandTheme' in body) {
      const v = typeof body.brandTheme === 'string' ? body.brandTheme.trim().slice(0, 40) : '';
      updated.brandTheme = /^[a-z0-9-]+$/.test(v) ? v : undefined;
    }
    // CLI used by new terminals when none is specified (Settings → CLI por defeito).
    if ('defaultCli' in body) {
      updated.defaultCli = CLI_IDS.includes(body.defaultCli as CliId) ? (body.defaultCli as CliId) : undefined;
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
      quickCommands: ['start', 'save', 'compact', 'plan'],
      openFiles: [],
      updatedAt: new Date().toISOString(),
    };
    const body = (req.body ?? {}) as Record<string, unknown>;
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
      updatedAt: new Date().toISOString(),
    };
    saveProjectMemory(memory);
    res.json(memory[projectId]);
  });

  r.get('/joca-logic', (_req, res) => {
    const items = collectToolkitItems();   // vazio sem Brain
    res.json({
      connected: BRAIN !== null,
      // Sem Brain fica '' (o contrato é string) e a UI mostra «Sem JOCA Brain».
      path: BRAIN?.root ?? '',
      via: BRAIN?.via ?? null,
      viaDescricao: BRAIN ? DESCRICAO_DA_VIA[BRAIN.via] : null,
      avisos: BRAIN_LOCALIZADO.avisos,
      skillCount: items.skills.length,
      agentCount: items.agents.length,
      commandCount: items.commands.length,
      hasMemoryIndex: BRAIN !== null && fs.existsSync(MEMORY_INDEX_FILE),
      hasSoul: BRAIN !== null && fs.existsSync(path.join(BRAIN.root, 'memory', 'soul.md')),
    });
  });

  r.get('/joca-items', (_req, res) => {
    res.json(collectToolkitItems());
  });

  r.get('/toolkit-item', (req, res) => {
    if (!BRAIN) return res.status(409).json({ error: SEM_BRAIN_ERRO });
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
    if (!BRAIN) return res.status(409).json({ error: SEM_BRAIN_ERRO });
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
    if (!BRAIN) return res.status(409).json({ error: SEM_BRAIN_ERRO });
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
    if (!BRAIN) return res.status(409).json({ error: SEM_BRAIN_ERRO });
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

import express, { Router } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { safePath, isInside } from '../security-fs';
import { collectToolkitItems } from '../toolkit-registry';
import {
  Project,
  loadProjects, saveProjects, loadProjectMemory, saveProjectMemory,
} from '../project-store';
import { sanitizeToolkitName, sanitizeToolkitCategory } from './helpers';
import { loadProjectGroups, pruneEmptyGroups } from '../project-groups-store';
import { iconsRouter, parseIconInput, collectIconIfUnused } from './icons-routes';

// Projects CRUD + per-project git status + per-project toolkit scaffolding.
export function projectsRouter(): Router {
  const r = Router();

  // Os ícones (projecto E grupo) vivem num router próprio mas entram por aqui — assim herdam o
  // mesmo requireAuth do server.ts sem precisar de mais um app.use().
  r.use(iconsRouter());

  r.get('/projects', (_req, res) => {
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
  r.put('/projects/order', express.json(), (req, res) => {
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

  r.post('/projects', express.json(), (req, res) => {
    const { name, path: p, color, description, hasCode } = req.body as {
      name?: string; path: string; color?: string; description?: string; hasCode?: boolean;
    };
    if (!p) return res.status(400).json({ error: 'Missing path' });
    const parsedIcon = req.body.icon === undefined ? { ok: true as const, icon: undefined } : parseIconInput(req.body.icon);
    if (!parsedIcon.ok) return res.status(400).json({ error: parsedIcon.error });
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
      icon: parsedIcon.icon,
      // Contexto permanente do projecto: entra no brief das tarefas que lá correm.
      description: typeof description === 'string' && description.trim()
        ? description.trim().slice(0, 2000) : undefined,
      hasCode: typeof hasCode === 'boolean' ? hasCode : undefined,
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
      updatedAt: new Date().toISOString(),
    };
    saveProjectMemory(memory);
    // Um projecto novo nasce VAZIO — sem terminais.
    res.json(project);
  });

  r.patch('/projects/:id', express.json(), (req, res) => {
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
    // icon: objecto {type,value} define; null/'' limpa. O ficheiro antigo é recolhido no fim, já
    // depois do saveProjects — antes disso ele ainda conta como referência a si próprio.
    const previousIcon = p.icon;
    let iconChanged = false;
    if (req.body.icon !== undefined) {
      const parsed = parseIconInput(req.body.icon);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      p.icon = parsed.icon;
      iconChanged = true;
    }
    if (typeof req.body.archived === 'boolean') p.archived = req.body.archived;
    if (req.body.description !== undefined) {
      const d = String(req.body.description).trim().slice(0, 2000);
      p.description = d || undefined;
    }
    if (typeof req.body.hasCode === 'boolean') p.hasCode = req.body.hasCode;
    if (req.body.githubRepo !== undefined) {
      const repo = req.body.githubRepo ? String(req.body.githubRepo).trim().slice(0, 500) : '';
      p.githubRepo = repo || undefined;
    }
    // groupId: string joins/moves into that group; null/'' leaves it (drag-to-group UI —
    // see project-groups-routes.ts for how a group itself is created/joined).
    let groupChanged = false;
    if (req.body.groupId !== undefined) {
      const next = req.body.groupId ? String(req.body.groupId).trim() : '';
      if (next && !loadProjectGroups().some((g) => g.id === next)) {
        return res.status(404).json({ error: 'Group not found' });
      }
      // Muda de grupo directamente (não só "sai para nenhum") também deixa o grupo antigo por
      // podar — sem isto ficava um "grupo de 1" fantasma quando se arrastava um projecto já
      // agrupado directamente para outro grupo.
      if (p.groupId && p.groupId !== (next || undefined)) groupChanged = true;
      p.groupId = next || undefined;
    }
    saveProjects(projects);
    if (iconChanged) collectIconIfUnused(previousIcon, p.icon);
    if (groupChanged) pruneEmptyGroups();
    const memory = loadProjectMemory();
    const current = memory[p.id];
    if (current) {
      memory[p.id] = { ...current, color: p.color, path: p.path, updatedAt: new Date().toISOString() };
      saveProjectMemory(memory);
    }
    res.json(p);
  });

  r.delete('/projects/:id', (req, res) => {
    const all = loadProjects();
    const removedIcon = all.find((p) => p.id === req.params.id)?.icon;
    saveProjects(all.filter((p) => p.id !== req.params.id));
    collectIconIfUnused(removedIcon, undefined);
    const memory = loadProjectMemory();
    delete memory[req.params.id];
    saveProjectMemory(memory);
    pruneEmptyGroups();
    res.json({ ok: true });
  });

  r.get('/projects/:id/git', (req, res) => {
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

  r.get('/projects/:id/toolkit', (req, res) => {
    const projects = loadProjects();
    const p = projects.find((pr) => pr.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const projectClaudeDir = path.join(p.path, '.claude');
    res.json(collectToolkitItems(projectClaudeDir));
  });

  r.post('/projects/:id/toolkit', express.json(), (req, res) => {
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

  return r;
}

import express, { Router } from 'express';
import { randomUUID } from 'crypto';
import { loadProjects, saveProjects } from '../project-store';
import { loadProjectGroups, saveProjectGroups, pruneEmptyGroups } from '../project-groups-store';
import { parseIconInput, collectIconIfUnused } from './icons-routes';

// Visual grouping of projects in the sidebar ("Discord categories"). Two entry points:
//   POST /project-groups        — first merge (drag project A's dot onto project B's dot), neither
//                                  already grouped.
//   POST /project-groups/:id/add — join an existing group (target dot already belongs to one).
// Leaving a group happens via the generic PATCH /projects/:id (groupId: null) in projects-routes.ts,
// which also calls pruneEmptyGroups() — kept there since it is a Project mutation, not a Group one.
export function projectGroupsRouter(): Router {
  const r = Router();

  r.get('/project-groups', (_req, res) => {
    res.json(loadProjectGroups());
  });

  r.post('/project-groups', express.json(), (req, res) => {
    const { name, projectIds } = req.body as { name?: string; projectIds?: unknown };
    const ids = Array.isArray(projectIds) ? projectIds.filter((x): x is string => typeof x === 'string') : [];
    // Dedupe ANTES de validar a contagem — ["A","A"] tinha length 2 mas só 1 projecto real.
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length < 2) return res.status(400).json({ error: 'projectIds precisa de pelo menos 2 ids diferentes' });
    const projects = loadProjects();
    const targets = uniqueIds.map((id) => projects.find((p) => p.id === id));
    if (targets.some((p) => !p)) return res.status(404).json({ error: 'Um ou mais projectos não existem' });

    const parsedIcon = req.body.icon === undefined ? { ok: true as const, icon: undefined } : parseIconInput(req.body.icon);
    if (!parsedIcon.ok) return res.status(400).json({ error: parsedIcon.error });

    const groups = loadProjectGroups();
    const group = {
      id: randomUUID(),
      name: (name?.trim().slice(0, 80)) || 'Grupo',
      color: targets[0]?.color,
      icon: parsedIcon.icon,
      order: groups.length,
    };
    groups.push(group);
    saveProjectGroups(groups);

    targets.forEach((p) => { if (p) p.groupId = group.id; });
    saveProjects(projects);

    res.json(group);
  });

  r.post('/project-groups/:id/add', express.json(), (req, res) => {
    const { projectId } = req.body as { projectId?: string };
    if (typeof projectId !== 'string' || !projectId) return res.status(400).json({ error: 'Missing projectId' });
    const groups = loadProjectGroups();
    const group = groups.find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const prevGroupId = project.groupId;
    project.groupId = group.id;
    saveProjects(projects);
    // Saltar directamente de um grupo para outro (arrastar um projecto já agrupado para uma bolinha
    // doutro grupo) deixava o grupo antigo com 1 membro fantasma — nunca passava pelo caminho de
    // "sair" que despoleta o prune (PATCH /projects/:id com groupId:null).
    if (prevGroupId && prevGroupId !== group.id) pruneEmptyGroups();
    res.json(group);
  });

  r.patch('/project-groups/:id', express.json(), (req, res) => {
    const groups = loadProjectGroups();
    const group = groups.find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (typeof req.body.name === 'string') {
      const trimmed = req.body.name.trim().slice(0, 80);
      if (trimmed) group.name = trimmed;
    }
    if (typeof req.body.color === 'string') group.color = req.body.color.trim().slice(0, 50) || undefined;
    // Mesma semântica do PATCH de projecto: objecto define, null/'' limpa.
    const previousIcon = group.icon;
    let iconChanged = false;
    if (req.body.icon !== undefined) {
      const parsed = parseIconInput(req.body.icon);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      group.icon = parsed.icon;
      iconChanged = true;
    }
    if (typeof req.body.collapsed === 'boolean') group.collapsed = req.body.collapsed;
    if (typeof req.body.order === 'number') group.order = req.body.order;
    saveProjectGroups(groups);
    if (iconChanged) collectIconIfUnused(previousIcon, group.icon);
    res.json(group);
  });

  // Dissolve explicitly (rare — normally groups auto-dissolve once <2 members remain via
  // pruneEmptyGroups). Members just lose their groupId, nothing else changes.
  r.delete('/project-groups/:id', (req, res) => {
    const all = loadProjectGroups();
    const removedIcon = all.find((g) => g.id === req.params.id)?.icon;
    const groups = all.filter((g) => g.id !== req.params.id);
    saveProjectGroups(groups);
    collectIconIfUnused(removedIcon, undefined);
    const projects = loadProjects();
    let changed = false;
    projects.forEach((p) => { if (p.groupId === req.params.id) { p.groupId = undefined; changed = true; } });
    if (changed) saveProjects(projects);
    pruneEmptyGroups();
    res.json({ ok: true });
  });

  return r;
}

// Visual grouping of projects in the sidebar ("Discord categories") — a group has no effect on the
// projects themselves beyond the `groupId` pointer stored on each Project (see project-store.ts).
import path from 'path';
import { DATA_DIR, readJsonFile, writeJsonFile, loadProjects, saveProjects } from './project-store';

export interface ProjectGroup {
  id: string;
  name: string;
  color?: string;
  order?: number;
  collapsed?: boolean;
}

const GROUPS_FILE = path.join(DATA_DIR, 'project-groups.json');

export function loadProjectGroups(): ProjectGroup[] {
  return readJsonFile<ProjectGroup[]>(GROUPS_FILE, []);
}

export function saveProjectGroups(groups: ProjectGroup[]) {
  writeJsonFile(GROUPS_FILE, groups);
}

// A group of 0-1 members is meaningless (the whole point is bundling ≥2 projects) — called after
// any operation that can shrink a group (leaving it, deleting a member project).
export function pruneEmptyGroups(): void {
  const projects = loadProjects();
  const groups = loadProjectGroups();
  let projectsChanged = false;
  const kept = groups.filter((g) => {
    const members = projects.filter((p) => p.groupId === g.id);
    if (members.length < 2) {
      members.forEach((p) => { p.groupId = undefined; projectsChanged = true; });
      return false;
    }
    return true;
  });
  if (projectsChanged) saveProjects(projects);
  if (kept.length !== groups.length) saveProjectGroups(kept);
}

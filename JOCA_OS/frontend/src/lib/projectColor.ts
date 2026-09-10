import type { Project } from '../types';

// Palette shared by CreateProjectModal (picker) and by the deterministic fallback below.
export const PROJECT_COLORS = [
  '#ff4500', '#ff7a1a', '#f2c94c', '#58d879',
  '#25c2a0', '#6da8ff', '#3a7cff', '#a98cff',
  '#d779ff', '#ff6b9a', '#ef4444', '#94a3b8',
  '#f97316', '#84cc16', '#14b8a6', '#0ea5e9',
  '#8b5cf6', '#ec4899',
];

// Projects with no chosen color all fell into the same default orange — in the collapsed sidebar
// (only the color tells them apart, the name is hidden) they were indistinguishable. A deterministic
// hash of the id instead of a single fallback: same project = always the same color, different
// projects = different colors in most cases.
export function projectColor(project: Pick<Project, 'id' | 'color'>): string {
  if (project.color) return project.color;
  let hash = 0;
  for (let i = 0; i < project.id.length; i++) {
    hash = (hash * 31 + project.id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PROJECT_COLORS.length;
  return PROJECT_COLORS[index];
}

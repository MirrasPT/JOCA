import type { Project } from '../types';

// Paleta partilhada por CreateProjectModal (picker) e pelo fallback determinístico abaixo.
export const PROJECT_COLORS = [
  '#ff4500', '#ff7a1a', '#f2c94c', '#58d879',
  '#25c2a0', '#6da8ff', '#3a7cff', '#a98cff',
  '#d779ff', '#ff6b9a', '#ef4444', '#94a3b8',
  '#f97316', '#84cc16', '#14b8a6', '#0ea5e9',
  '#8b5cf6', '#ec4899',
];

// Projectos sem cor escolhida caíam todos no mesmo laranja por defeito — na sidebar colapsada
// (só a cor distingue, o nome está escondido) ficavam indistinguíveis. Hash determinístico do id
// em vez de fallback único: mesmo projecto = sempre a mesma cor, projectos diferentes = cores
// diferentes na maioria dos casos.
export function projectColor(project: Pick<Project, 'id' | 'color'>): string {
  if (project.color) return project.color;
  let hash = 0;
  for (let i = 0; i < project.id.length; i++) {
    hash = (hash * 31 + project.id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PROJECT_COLORS.length;
  return PROJECT_COLORS[index];
}

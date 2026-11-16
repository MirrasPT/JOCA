// JOCA Brain toolkit registry: locates the JOCA Brain (brain-locator.ts — may be none), collects
// commands/agents/skills from it, and maintains the toolkit-snapshot block in memory/INDEX.md when
// that file exists. Owns the BRAIN / JOCA_LOGIC_ROOT / CLAUDE_DIR / MEMORY_INDEX_FILE constants that
// the rest of the server imports.
//
// NOTE: the JOCA_UI_TOOLKIT_START/END sentinel is kept literal — external tooling parses it.
import path from 'path';
import fs from 'fs';
import os from 'os';
import { localizarBrain, DESCRICAO_DA_VIA, type BrainEncontrado } from './brain-locator';

export interface ToolkitItem {
  name: string;
  insert: string;
  category?: string;
  path: string;
  description?: string;
}

export const BRAIN_LOCALIZADO = localizarBrain({
  env: process.env,
  homedir: os.homedir(),
  jocaOsDir: path.resolve(__dirname, '../..'),
});
/** O Brain encontrado, ou null — o JOCA OS funciona sem ele. */
export const BRAIN: BrainEncontrado | null = BRAIN_LOCALIZADO.brain;

// Sem Brain, as constantes de caminho apontam para um marcador que não existe em disco: quem ainda
// faz `fs.existsSync(path.join(JOCA_LOGIC_ROOT, '.claude'))` lê «não encontrado» e o log diz porquê.
// Nada deve escrever aqui — as rotas do toolkit recusam antes (ver toolkit-routes.ts).
export const SEM_BRAIN = '(sem JOCA Brain)';
export const JOCA_LOGIC_ROOT = BRAIN?.root ?? SEM_BRAIN;
export const CLAUDE_DIR = path.join(JOCA_LOGIC_ROOT, '.claude');
export const MEMORY_INDEX_FILE = path.join(JOCA_LOGIC_ROOT, 'memory', 'INDEX.md');

// Uma linha no arranque com o caminho e a via (ou o aviso de que não há Brain). Fica aqui e não no
// server.ts para a descoberta e a explicação dela viverem juntas. Nos testes não se imprime.
if (!process.env.VITEST) {
  for (const aviso of BRAIN_LOCALIZADO.avisos) console.warn(`⚠ ${aviso}`);
  console.log(BRAIN
    ? `JOCA Brain → ${BRAIN.root} (via ${DESCRICAO_DA_VIA[BRAIN.via]})`
    : 'Sem JOCA Brain — o JOCA OS funciona na mesma (define JOCA_BRAIN para o ligar)');
}

/**
 * Pastas de skills de um Brain, por ordem de preferência. O antigo tem `.claude/skills/*.md`; o v2
 * tem `.agents/skills/<x>/SKILL.md` com atalhos em `.claude/skills/<x>`, e as globais em
 * `.agents/globais/<x>/SKILL.md`. `skills/<x>/SKILL.md` na raiz também conta. As repetidas
 * (mesmo ficheiro por atalho, ou mesmo nome) entram uma vez só.
 */
export function pastasDeSkillsDoBrain(root: string): string[] {
  return [
    path.join(root, '.claude', 'skills'),
    path.join(root, '.agents', 'skills'),
    path.join(root, '.agents', 'globais'),
    path.join(root, 'skills'),
  ];
}

export function parseFrontmatter(content: string) {
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

const VAZIO = () => ({ commands: [] as ToolkitItem[], agents: [] as ToolkitItem[], skills: [] as ToolkitItem[] });

function statSeguro(p: string): fs.Stats | null {
  try { return fs.statSync(p); } catch { return null; }   // segue atalhos; atalho partido → null
}

function realSeguro(p: string): string {
  try { return fs.realpathSync(p); } catch { return path.resolve(p); }
}

/**
 * Recolhe o toolkit de uma pasta `.claude` (commands, agents) e das pastas de skills dadas.
 * Os atalhos (symlinks) contam — é assim que o Brain v2 expõe as skills em `.claude/skills/`.
 * Uma skill repete-se se o ficheiro real for o mesmo, ou se uma pasta seguinte trouxer um nome que
 * uma anterior já trouxe; entra a primeira.
 */
export function recolherToolkit(claudeDir: string, pastasDeSkills: string[]) {
  const { commands, agents, skills } = VAZIO();

  function lerPlanos(dir: string, destino: ToolkitItem[], category: 'commands' | 'agents') {
    try {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .sort()
        .forEach(f => {
          const itemPath = path.join(dir, f);
          if (!statSeguro(itemPath)?.isFile()) return;
          const name = f.replace(/\.md$/, '');
          const meta = parseFrontmatter(fs.readFileSync(itemPath, 'utf8'));
          destino.push({ name, insert: category === 'commands' ? `/${name}` : name, path: itemPath, category, description: meta.description });
        });
    } catch {}
  }
  lerPlanos(path.join(claudeDir, 'commands'), commands, 'commands');
  lerPlanos(path.join(claudeDir, 'agents'), agents, 'agents');

  const ficheirosVistos = new Set<string>();
  const nomesDePastasAnteriores = new Set<string>();

  function juntar(filePath: string, fallbackName: string, category: string, nomesDestaPasta: Set<string>) {
    const real = realSeguro(filePath);
    if (ficheirosVistos.has(real)) return;
    const meta = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
    const name = meta.name || fallbackName;
    if (nomesDePastasAnteriores.has(name)) return;
    ficheirosVistos.add(real);
    nomesDestaPasta.add(name);
    skills.push({ name, category: category || 'general', insert: name, path: filePath, description: meta.description });
  }

  // Profundidade limitada: um atalho que aponte para cima não faz o passeio andar em círculo.
  function walkSkills(dir: string, category: string, nomes: Set<string>, depth: number) {
    if (depth > 6) return;
    let entries: string[];
    try { entries = fs.readdirSync(dir).sort(); } catch { return; }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = path.join(dir, entry);
      const st = statSeguro(full);
      if (!st) continue;
      try {
        if (st.isFile()) {
          if (entry.endsWith('.md') && !entry.startsWith('_')) juntar(full, entry.replace(/\.md$/, ''), category, nomes);
          continue;
        }
        if (!st.isDirectory()) continue;
        const skillPath = path.join(full, 'SKILL.md');
        if (statSeguro(skillPath)?.isFile()) juntar(skillPath, entry, category, nomes);
        else walkSkills(full, category ? `${category}/${entry}` : entry, nomes, depth + 1);
      } catch {}
    }
  }
  for (const pasta of pastasDeSkills) {
    const nomes = new Set<string>();
    walkSkills(pasta, '', nomes, 0);
    for (const n of nomes) nomesDePastasAnteriores.add(n);
  }

  return { commands, agents, skills };
}

/**
 * Sem argumento: o toolkit do Brain (vazio se não houver Brain). Com uma pasta `.claude` (a de um
 * projecto): só essa pasta, como sempre foi.
 */
export function collectToolkitItems(claudeDir?: string) {
  if (claudeDir !== undefined) return recolherToolkit(claudeDir, [path.join(claudeDir, 'skills')]);
  if (!BRAIN) return VAZIO();
  return recolherToolkit(path.join(BRAIN.root, '.claude'), pastasDeSkillsDoBrain(BRAIN.root));
}

export function refreshMemoryIndexSnapshot() {
  // Só mantém o bloco num índice que já existe — o Brain v2 pode não o ter, e sem Brain não se
  // escreve nada em lado nenhum.
  if (!BRAIN || !fs.existsSync(MEMORY_INDEX_FILE)) return;
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

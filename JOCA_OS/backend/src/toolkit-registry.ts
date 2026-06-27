// JOCA_Brain toolkit registry: locates the JOCA_Brain root, collects commands/agents/skills from
// its .claude dir, and maintains the toolkit-snapshot block in memory/INDEX.md. Self-contained —
// resolves the logic root from env/__dirname, so it owns the JOCA_LOGIC_ROOT / CLAUDE_DIR /
// MEMORY_INDEX_FILE constants that the rest of the server imports.
//
// NOTE: the JOCA_UI_TOOLKIT_START/END sentinel is kept literal — external tooling parses it.
import path from 'path';
import fs from 'fs';

export interface ToolkitItem {
  name: string;
  insert: string;
  category?: string;
  path: string;
  description?: string;
}

function findJocaLogicRoot(): string {
  if (process.env.JOCA_LOGIC_PATH) {
    const envPath = path.resolve(process.env.JOCA_LOGIC_PATH);
    if (fs.existsSync(path.join(envPath, '.claude'))) return envPath;
  }

  const uiRoot = path.resolve(__dirname, '../..');
  const parentDir = path.dirname(uiRoot);
  const siblingLogic = path.join(parentDir, 'JOCA_Brain');
  if (fs.existsSync(path.join(siblingLogic, '.claude'))) return siblingLogic;

  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && fs.existsSync(path.join(dir, '.claude'))) return dir;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return parentDir;
}

export const JOCA_LOGIC_ROOT = findJocaLogicRoot();
export const CLAUDE_DIR = path.join(JOCA_LOGIC_ROOT, '.claude');
export const MEMORY_INDEX_FILE = path.join(JOCA_LOGIC_ROOT, 'memory', 'INDEX.md');

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

export function collectToolkitItems(claudeDir: string = CLAUDE_DIR) {
  const commands: ToolkitItem[] = [];
  const agents: ToolkitItem[] = [];
  const skills: ToolkitItem[] = [];

  const commandsDir = path.join(claudeDir, 'commands');
  try {
    if (fs.existsSync(commandsDir)) {
      fs.readdirSync(commandsDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .sort()
        .forEach(f => {
          const itemPath = path.join(commandsDir, f);
          const name = f.replace(/\.md$/, '');
          const content = fs.readFileSync(itemPath, 'utf8');
          const meta = parseFrontmatter(content);
          commands.push({ name, insert: `/${name}`, path: itemPath, category: 'commands', description: meta.description });
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
          const itemPath = path.join(agentsDir, f);
          const name = f.replace(/\.md$/, '');
          const content = fs.readFileSync(itemPath, 'utf8');
          const meta = parseFrontmatter(content);
          agents.push({ name, insert: name, path: itemPath, category: 'agents', description: meta.description });
        });
    }
  } catch {}

  function walkSkills(dir: string, category = '') {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() && entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
          const filePath = path.join(dir, entry.name);
          const content = fs.readFileSync(filePath, 'utf8');
          const meta = parseFrontmatter(content);
          const baseName = entry.name.replace(/\.md$/, '');
          skills.push({
            name: meta.name || baseName,
            category: category || 'general',
            insert: meta.name || baseName,
            path: filePath,
            description: meta.description,
          });
          continue;
        }
        if (!entry.isDirectory()) continue;
        const subDir = path.join(dir, entry.name);
        const skillPath = path.join(subDir, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          const content = fs.readFileSync(skillPath, 'utf8');
          const meta = parseFrontmatter(content);
          skills.push({
            name: meta.name || entry.name,
            category: category || 'general',
            insert: meta.name || entry.name,
            path: skillPath,
            description: meta.description,
          });
        } else {
          walkSkills(subDir, category ? `${category}/${entry.name}` : entry.name);
        }
      }
    } catch {}
  }
  walkSkills(path.join(claudeDir, 'skills'));

  return { commands, agents, skills };
}

export function refreshMemoryIndexSnapshot() {
  if (!fs.existsSync(MEMORY_INDEX_FILE)) return;
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

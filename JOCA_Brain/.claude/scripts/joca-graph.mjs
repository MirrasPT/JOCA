#!/usr/bin/env node
/**
 * joca-graph — extractor JOCA-aware do grafo de CONHECIMENTO (não só código).
 *
 * O graphify mapeia código/docs por imports e links markdown. Mas o conhecimento
 * do JOCA conecta-se por `chain:` no frontmatter, `triggers:` e tipo — que o
 * graphify não vê. Este extractor lê esse conhecimento e emite um graph.json
 * compatível com graphify (schema node-link: nodes[{id,label,file_type,...}] +
 * links[{source,target,context,...}]) para o graphify renderizar (graph.html + report).
 *
 * Mapeia: skills · agentes · comandos · rules · projectos — agrupados por tipo (hubs)
 * e ligados pelas chains reais (skill→skill/agente) + projecto→pasta.
 *
 * Uso:
 *   node .claude/scripts/joca-graph.mjs [--out <dir>]
 *   (default out: <JOCA_Brain>/graphify-out/joca-knowledge)
 *   depois: graphify cluster-only <out>/..  (ver /map-joca)
 */
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAIN = join(__dirname, '..', '..');
const CLAUDE = join(BRAIN, '.claude');

const argOut = (() => { const i = process.argv.indexOf('--out'); return i >= 0 ? process.argv[i + 1] : null; })();
const OUT_DIR = argOut || join(BRAIN, 'graphify-out', 'joca-knowledge');

// ---------- frontmatter parse (YAML-lite: só o que precisamos) ----------
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}
function splitList(s) {
  if (!s) return [];
  return s.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// ---------- scan a directory of .md → entries ----------
function scanDir(dir, kind) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    const fm = parseFrontmatter(text);
    const name = fm.name || basename(f, '.md');
    out.push({
      kind,
      name,
      file: `${kind}/${f}`,
      description: (fm.description || '').slice(0, 140),
      chain: splitList(fm.chain),
      triggers: splitList(fm.triggers).slice(0, 6),
    });
  }
  return out;
}

// ---------- collect ----------
const skills = scanDir(join(CLAUDE, 'skills'), 'skill');
const agents = scanDir(join(CLAUDE, 'agents'), 'agent');
const commands = scanDir(join(CLAUDE, 'commands'), 'command');
const rules = scanDir(join(CLAUDE, 'rules'), 'rule');
// projectos: memory/projects/*.md
const projects = scanDir(join(BRAIN, 'memory', 'projects'), 'project');

const all = [...skills, ...agents, ...commands, ...rules, ...projects];

// índice nome→nodeId (skills+agentes são os alvos válidos de chain)
const nameIndex = new Map();
for (const e of all) nameIndex.set(slug(e.name), `${e.kind}:${slug(e.name)}`);

// ---------- build graph ----------
const nodes = new Map();
const links = [];
function addNode(id, label, fileType, extra = {}) {
  if (!nodes.has(id)) nodes.set(id, { id, label, file_type: fileType, source_file: extra.file || label, source_location: 'L1', norm_label: id, ...extra });
}
function addEdge(source, target, context, type = 'chains-to') {
  links.push({ source, target, context, weight: 1.0, confidence: 1.0, edge_type: type, source_file: source, source_location: 'L1', relation: type });
}

// hubs por tipo (concept nodes → clusters limpos)
const HUBS = {
  skill: 'Skills', agent: 'Agentes', command: 'Comandos', rule: 'Rules', project: 'Projectos',
};
for (const [kind, label] of Object.entries(HUBS)) addNode(`hub:${kind}`, label, 'concept');

for (const e of all) {
  const id = `${e.kind}:${slug(e.name)}`;
  addNode(id, e.name, e.kind, { file: e.file, summary: e.description });
  addEdge(`hub:${e.kind}`, id, 'contains', 'contains');
}

// chain edges (a conexão REAL: skill/agente → próximo skill/agente)
let chainEdges = 0, unresolved = 0;
for (const e of [...skills, ...agents, ...commands]) {
  const src = `${e.kind}:${slug(e.name)}`;
  for (const target of e.chain) {
    const tid = nameIndex.get(slug(target));
    if (tid) { addEdge(src, tid, `chain: ${target}`, 'chains-to'); chainEdges++; }
    else {
      // alvo não-resolvido (skill referida mas não presente como ficheiro) → nó stub
      const stub = `skill:${slug(target)}`;
      addNode(stub, target, 'skill', { stub: true });
      addEdge(src, stub, `chain: ${target}`, 'chains-to'); unresolved++;
    }
  }
}

// ---------- write graphify-compatible graph.json ----------
const graph = {
  directed: true, multigraph: false, graph: { name: 'joca-knowledge' },
  nodes: [...nodes.values()],
  links,
  hyperedges: [],
};
const outGraphDir = join(OUT_DIR, 'graphify-out');
if (!existsSync(outGraphDir)) mkdirSync(outGraphDir, { recursive: true });
writeFileSync(join(outGraphDir, 'graph.json'), JSON.stringify(graph), 'utf8');

console.log(`[joca-graph] ${nodes.size} nós · ${links.length} edges (${chainEdges} chains resolvidas, ${unresolved} stubs)`);
console.log(`  skills:${skills.length} agentes:${agents.length} comandos:${commands.length} rules:${rules.length} projectos:${projects.length}`);
console.log(`  graph.json → ${join(outGraphDir, 'graph.json')}`);
console.log(`  render: graphify cluster-only "${OUT_DIR}"`);

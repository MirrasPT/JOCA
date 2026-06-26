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
import { execSync } from 'child_process';

const BUILD_PROJECTS = process.argv.includes('--build-projects');

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
      // projectos: caminho real do disco (frontmatter directorio/path/repo)
      path: (fm.directorio || fm.path || fm.repo || '').replace(/^["']|["']$/g, ''),
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

// ---------- projectos → ligar ao grafo próprio de cada projecto (drill-down) ----------
// Cada projecto com caminho real no disco: detecta/gera o seu graphify-out/graph.json
// e adiciona um nó `graph:<projecto>` (clicável via source_file = graph.html) ligado ao projecto.
let projLinked = 0, projBuilt = 0, projMissing = 0;
const projTable = [];
for (const p of projects) {
  if (!p.path) { projMissing++; continue; }
  const dir = p.path.replace(/\//g, '\\'); // normaliza p/ Windows (existsSync aceita ambos)
  const pid = `project:${slug(p.name)}`;
  const node = nodes.get(pid);
  if (node) node.project_path = p.path;
  if (!existsSync(dir)) { projTable.push([p.name, p.path, 'pasta ausente nesta máquina']); projMissing++; continue; }

  const graphJson = join(dir, 'graphify-out', 'graph.json');
  const graphHtml = join(dir, 'graphify-out', 'graph.html');

  if (BUILD_PROJECTS && !existsSync(graphJson)) {
    // gerar o grafo do projecto (best-effort, sem LLM — só código)
    try {
      execSync(`python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path(r'''${dir}'''))"`,
        { stdio: ['ignore', 'ignore', 'ignore'], timeout: 180000 });
      projBuilt++;
    } catch (_) { /* projecto sem código / graphify falhou — segue */ }
  }

  if (existsSync(graphJson)) {
    const gid = `graph:${slug(p.name)}`;
    addNode(gid, `grafo: ${p.name}`, 'graph', {
      file: existsSync(graphHtml) ? graphHtml : graphJson,
      source_file: existsSync(graphHtml) ? graphHtml : graphJson,
      graph_html: existsSync(graphHtml) ? graphHtml : null,
      graph_json: graphJson,
    });
    addEdge(pid, gid, 'has-graph', 'has-graph');
    projLinked++;
    projTable.push([p.name, p.path, existsSync(graphHtml) ? 'grafo ✓ (graph.html)' : 'grafo ✓ (graph.json)']);
  } else {
    projTable.push([p.name, p.path, BUILD_PROJECTS ? 'sem código / build falhou' : 'sem grafo (corre --build-projects)']);
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
console.log(`  projectos ligados a grafo próprio: ${projLinked}${BUILD_PROJECTS ? ` (gerados agora: ${projBuilt})` : ''} · sem path/ausentes: ${projMissing}`);
if (projTable.length) {
  console.log('\n  Projecto → grafo próprio:');
  for (const [n, path, status] of projTable) console.log(`    - ${n}: ${status}  [${path}]`);
  if (!BUILD_PROJECTS && projLinked < projects.length) console.log('  (correr `node .claude/scripts/joca-graph.mjs --build-projects` para gerar os grafos em falta)');
}
console.log(`\n  graph.json → ${join(outGraphDir, 'graph.json')}`);
console.log(`  render: graphify cluster-only "${OUT_DIR}"`);

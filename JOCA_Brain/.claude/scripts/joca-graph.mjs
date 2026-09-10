#!/usr/bin/env node
/**
 * joca-graph — JOCA-aware extractor of the KNOWLEDGE graph (not just code).
 *
 * graphify maps code/docs by imports and markdown links. But JOCA's knowledge
 * is connected by `chain:` in the frontmatter, by `triggers:` and by type — which
 * graphify does not see. This extractor reads that knowledge and emits a graph.json
 * compatible with graphify (node-link schema: nodes[{id,label,file_type,...}] +
 * links[{source,target,context,...}]) for graphify to render (graph.html + report).
 *
 * Maps: skills · agents · commands · rules · projects — grouped by type (hubs)
 * and linked by the real chains (skill→skill/agent) + project→folder.
 *
 * Usage:
 *   node .claude/scripts/joca-graph.mjs [--out <dir>]
 *   (default out: <JOCA_Brain>/graphify-out/joca-knowledge)
 *   then: graphify cluster-only <out>/..  (see /map-joca)
 */
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const BUILD_PROJECTS = process.argv.includes('--build-projects');
const MERGE = process.argv.includes('--merge'); // merges each project's graph.json (giant graph with everything)

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAIN = join(__dirname, '..', '..');
const CLAUDE = join(BRAIN, '.claude');

const argOut = (() => { const i = process.argv.indexOf('--out'); return i >= 0 ? process.argv[i + 1] : null; })();
// --merge writes to a SEPARATE dir (giant graph) so it does not overwrite the clean navigable map.
const OUT_DIR = argOut || join(BRAIN, 'graphify-out', MERGE ? 'joca-knowledge-merged' : 'joca-knowledge');

// ---------- frontmatter parse (YAML-lite: only what we need) ----------
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
      // projects: real path on disk (frontmatter directorio/path/repo)
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
// projects: memory/projects/*.md
const projects = scanDir(join(BRAIN, 'memory', 'projects'), 'project');

const all = [...skills, ...agents, ...commands, ...rules, ...projects];

// name→nodeId index (skills+agents are the valid chain targets)
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

// hubs by type (concept nodes → clean clusters)
const HUBS = {
  skill: 'Skills', agent: 'Agents', command: 'Commands', rule: 'Rules', project: 'Projects',
};
for (const [kind, label] of Object.entries(HUBS)) addNode(`hub:${kind}`, label, 'concept');

for (const e of all) {
  const id = `${e.kind}:${slug(e.name)}`;
  addNode(id, e.name, e.kind, { file: e.file, summary: e.description });
  addEdge(`hub:${e.kind}`, id, 'contains', 'contains');
}

// chain edges (the REAL connection: skill/agent → next skill/agent)
let chainEdges = 0, unresolved = 0;
for (const e of [...skills, ...agents, ...commands]) {
  const src = `${e.kind}:${slug(e.name)}`;
  for (const target of e.chain) {
    const tid = nameIndex.get(slug(target));
    if (tid) { addEdge(src, tid, `chain: ${target}`, 'chains-to'); chainEdges++; }
    else {
      // unresolved target (skill referenced but not present as a file) → stub node
      const stub = `skill:${slug(target)}`;
      addNode(stub, target, 'skill', { stub: true });
      addEdge(src, stub, `chain: ${target}`, 'chains-to'); unresolved++;
    }
  }
}

// ---------- projects → link to each project's own graph (drill-down) ----------
// Every project with a real path on disk: detects/generates its graphify-out/graph.json
// and adds a `graph:<project>` node (clickable via source_file = graph.html) linked to the project.
let projLinked = 0, projBuilt = 0, projMissing = 0, mergedNodes = 0;
const projTable = [];
for (const p of projects) {
  if (!p.path) { projMissing++; continue; }
  const dir = p.path.replace(/\//g, '\\'); // normalizes for Windows (existsSync accepts both)
  const pid = `project:${slug(p.name)}`;
  const node = nodes.get(pid);
  if (node) node.project_path = p.path;
  if (!existsSync(dir)) { projTable.push([p.name, p.path, 'folder missing on this machine']); projMissing++; continue; }

  const graphJson = join(dir, 'graphify-out', 'graph.json');
  const graphHtml = join(dir, 'graphify-out', 'graph.html');

  if (BUILD_PROJECTS && !existsSync(graphJson)) {
    // generate the project's graph (best-effort, no LLM — code only)
    try {
      execSync(`python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path(r'''${dir}'''))"`,
        { stdio: ['ignore', 'ignore', 'ignore'], timeout: 180000 });
      projBuilt++;
    } catch (_) { /* project with no code / graphify failed — carry on */ }
  }

  if (existsSync(graphJson)) {
    const gid = `graph:${slug(p.name)}`;
    addNode(gid, `graph: ${p.name}`, 'graph', {
      file: existsSync(graphHtml) ? graphHtml : graphJson,
      source_file: existsSync(graphHtml) ? graphHtml : graphJson,
      graph_html: existsSync(graphHtml) ? graphHtml : null,
      graph_json: graphJson,
    });
    addEdge(pid, gid, 'has-graph', 'has-graph');
    projLinked++;

    // --merge: MERGE the project's subgraph into this graph (namespaced + bridge)
    if (MERGE) {
      try {
        const sub = JSON.parse(readFileSync(graphJson, 'utf8'));
        const ps = slug(p.name);
        // filter out library noise (node_modules/vendor/dist/.venv…) — only the project's REAL code
        const NOISE = /(^|[\\/])(node_modules|vendor|dist|build|out|\.venv|venv|site-packages|\.git|__pycache__|\.cache|coverage|bootstrap[\\/]cache|storage|public[\\/]build|public[\\/]storage)([\\/]|$)/i;
        const keep = (n) => !NOISE.test(String(n.source_file || n.label || ''));
        const allSub = sub.nodes || [];
        const subNodes = allSub.filter(keep);
        const kept = new Set(subNodes.map((n) => n.id ?? n.label));
        const subLinks = (sub.links || sub.edges || []).filter((e) => kept.has(e.source) && kept.has(e.target));
        const droppedNoise = allSub.length - subNodes.length;
        const ns = (x) => `${ps}::${x}`;
        // degree, to find the project's "god node" (bridge target)
        const degree = new Map();
        for (const e of subLinks) { const s = e.source, t = e.target; degree.set(s, (degree.get(s) || 0) + 1); degree.set(t, (degree.get(t) || 0) + 1); }
        let godId = null, godDeg = -1;
        for (const n of subNodes) { const d = degree.get(n.id ?? n.label) || 0; if (d > godDeg) { godDeg = d; godId = n.id ?? n.label; } }
        for (const n of subNodes) {
          const oid = n.id ?? n.label;
          addNode(ns(oid), n.label || String(oid), n.file_type || 'code', { project: ps, source_file: n.source_file || '', source_location: n.source_location || 'L1' });
        }
        for (const e of subLinks) {
          if (e.source == null || e.target == null) continue;
          addEdge(ns(e.source), ns(e.target), e.context || e.relation || 'ref', e.edge_type || e.relation || 'ref');
        }
        // bridge: JOCA project node → god node of the project's code
        if (godId != null) addEdge(pid, ns(godId), 'project-code', 'project-code');
        mergedNodes += subNodes.length;
        projTable[projTable.length] = [p.name, p.path, `MERGED ✓ (${subNodes.length} code nodes${droppedNoise ? `, ${droppedNoise} lib ones filtered out` : ''})`];
        continue;
      } catch (err) { projTable.push([p.name, p.path, `merge failed: ${String(err.message).slice(0, 40)}`]); continue; }
    }
    projTable.push([p.name, p.path, existsSync(graphHtml) ? 'graph ✓ (graph.html)' : 'graph ✓ (graph.json)']);
  } else {
    projTable.push([p.name, p.path, BUILD_PROJECTS ? 'no code / build failed' : 'no graph (run --build-projects)']);
  }
}

// ---------- write graphify-compatible graph.json ----------
const graph = {
  directed: false, multigraph: false, graph: { name: 'joca-knowledge' },
  nodes: [...nodes.values()],
  links,
  hyperedges: [],
};
const outGraphDir = join(OUT_DIR, 'graphify-out');
if (!existsSync(outGraphDir)) mkdirSync(outGraphDir, { recursive: true });
writeFileSync(join(outGraphDir, 'graph.json'), JSON.stringify(graph), 'utf8');

console.log(`[joca-graph] ${nodes.size} nodes · ${links.length} edges (${chainEdges} chains resolved, ${unresolved} stubs)`);
console.log(`  skills:${skills.length} agents:${agents.length} commands:${commands.length} rules:${rules.length} projects:${projects.length}`);
console.log(`  projects linked to their own graph: ${projLinked}${BUILD_PROJECTS ? ` (generated now: ${projBuilt})` : ''} · no path/missing: ${projMissing}`);
if (MERGE) console.log(`  MERGE: +${mergedNodes} code nodes from merged projects → giant graph`);
if (projTable.length) {
  console.log('\n  Project → own graph:');
  for (const [n, path, status] of projTable) console.log(`    - ${n}: ${status}  [${path}]`);
  if (!BUILD_PROJECTS && projLinked < projects.length) console.log('  (run `node .claude/scripts/joca-graph.mjs --build-projects` to generate the missing graphs)');
}
console.log(`\n  graph.json → ${join(outGraphDir, 'graph.json')}`);
console.log(`  render: graphify cluster-only "${OUT_DIR}"`);

#!/usr/bin/env node
/**
 * joca-brain — memória institucional event-sourced do JOCA (decisões + aprendizagens).
 *
 * Adaptado de gstack lib/gstack-decision.ts (conceitos, não código): log JSONL
 * append-only, "active" COMPUTADO (um `decide` não referido por `supersede`/`redact`),
 * scope repo/branch, secret-scan na escrita (HIGH → rejeita), datamark anti-injecção
 * no resurface, snapshot bounded p/ recall O(active). Local-first markdown/JSONL —
 * NÃO importa Postgres (o Brain do JOCA mantém-se em ficheiros).
 *
 * Store (fonte única, resolvido por __dirname → nunca recomputar com ../../):
 *   <JOCA_Brain>/memory/decisions/<slug>.jsonl     (+ .active.json snapshot)
 *   <JOCA_Brain>/memory/learnings/<slug>.jsonl
 *
 * Uso:
 *   joca-brain decide  --text "..." [--rationale "..."] [--scope repo|branch] [--branch X] [--source user|skill|agent] [--confidence 1-10]
 *   joca-brain supersede <id>
 *   joca-brain redact <id>
 *   joca-brain learn   --text "..." [--tags a,b,c] [--file path]
 *   joca-brain active  [--slug X] [--json]
 *   joca-brain recall  [--slug X] [--limit 5]      # active decisions + learnings recentes (p/ hook)
 *   joca-brain search  <query> [--limit 5] [--slug X]
 */
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync,
} from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAIN = join(__dirname, '..', '..'); // .claude/scripts -> JOCA_Brain
const MEM = join(BRAIN, 'memory');

// ---------- args ----------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[k] = true; }
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

// ---------- slug ----------
function currentSlug(explicit) {
  if (explicit && explicit !== true) return sanitizeSlug(explicit);
  try {
    const top = execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (top) return sanitizeSlug(basename(top));
  } catch (_) { /* não-git */ }
  return sanitizeSlug(basename(process.cwd()));
}
function sanitizeSlug(s) { return String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'unknown'; }
function currentBranch() {
  try { return execSync('git branch --show-current', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined; }
  catch (_) { return undefined; }
}

// ---------- secret scan (HIGH-tier; rejeita escrita) ----------
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
  [/gh[posru]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/(api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/i, 'credential-shaped value'],
];
function scanSecrets(text) {
  const hits = [];
  for (const [re, label] of SECRET_PATTERNS) if (re.test(text)) hits.push(label);
  return hits;
}

// ---------- datamark (neutraliza injecção no resurface) ----------
// Filtro por code-point (sem regex de control-chars no source) + substituições simples.
function datamark(text) {
  const ZWSP = '​';
  let cleaned = '';
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    cleaned += (c < 0x20 || c === 0x7f || c === 0x85 || c === 0x2028 || c === 0x2029) ? ' ' : ch;
  }
  return cleaned
    .split('```').join("'''")
    .replace(/-{3,}/g, '—')
    .split('<|').join('<' + ZWSP + '|')
    .split('|>').join('|' + ZWSP + '>')
    .replace(/<(\/?)(system|user|assistant|tool)>/gi, '<' + ZWSP + '$1$2>')
    .replace(/\b(human|assistant|system|user)(\s*):/gi, '$1' + ZWSP + '$2:');
}

// ---------- jsonl store ----------
function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }
function decisionsLog(slug) { return join(MEM, 'decisions', `${slug}.jsonl`); }
function decisionsSnap(slug) { return join(MEM, 'decisions', `${slug}.active.json`); }
function learningsLog(slug) { return join(MEM, 'learnings', `${slug}.jsonl`); }

function appendJsonl(file, obj) {
  ensureDir(dirname(file));
  appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8'); // O_APPEND single-line = atómico
}
function readJsonl(file) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch (_) { /* tolera linha parcial/malformada */ }
  }
  return out;
}
function writeAtomic(file, data) {
  ensureDir(dirname(file));
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, file);
}

// ---------- compute active ----------
function computeActive(events) {
  const retired = new Set();
  for (const e of events) if ((e.kind === 'supersede' || e.kind === 'redact') && e.supersedes) retired.add(e.supersedes);
  return events
    .filter((e) => e.kind === 'decide' && !retired.has(e.id))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function refreshSnapshot(slug) {
  const active = computeActive(readJsonl(decisionsLog(slug)));
  writeAtomic(decisionsSnap(slug), JSON.stringify(active));
  return active;
}
function filterByScope(active, branch) {
  return active.filter((d) => d.scope === 'repo' || (d.scope === 'branch' && branch && d.branch === branch));
}

// ---------- commands ----------
function cmdDecide(a) {
  const slug = currentSlug(a.slug);
  const text = typeof a.text === 'string' ? a.text.trim() : '';
  if (!text) fail('decide: --text obrigatório');
  const freeText = [text, a.rationale, a.branch].filter((s) => typeof s === 'string').join('\n');
  const secrets = scanSecrets(freeText);
  if (secrets.length) fail(`decide REJEITADO: contém segredo (${secrets.join(', ')}). Roda + remove — não logar segredos.`);
  const scope = a.scope === 'branch' ? 'branch' : 'repo';
  const ev = {
    id: randomUUID(), kind: 'decide', decision: text,
    rationale: typeof a.rationale === 'string' ? a.rationale : undefined,
    scope, branch: scope === 'branch' ? (a.branch && a.branch !== true ? a.branch : currentBranch()) : undefined,
    date: new Date().toISOString(),
    source: ['user', 'skill', 'agent'].includes(a.source) ? a.source : 'agent',
    confidence: a.confidence ? Math.max(1, Math.min(10, parseInt(a.confidence, 10) || 0)) || undefined : undefined,
  };
  appendJsonl(decisionsLog(slug), ev);
  refreshSnapshot(slug);
  console.log(`[brain] decisão registada (${slug}) id=${ev.id}`);
}
function cmdRef(kind, a) {
  const slug = currentSlug(a.slug);
  const target = a._[0];
  if (!target) fail(`${kind}: <id> obrigatório`);
  appendJsonl(decisionsLog(slug), { id: randomUUID(), kind, supersedes: target, date: new Date().toISOString(), source: 'agent' });
  refreshSnapshot(slug);
  console.log(`[brain] ${kind} de ${target} (${slug})`);
}
function cmdLearn(a) {
  const slug = currentSlug(a.slug);
  const text = typeof a.text === 'string' ? a.text.trim() : '';
  if (!text) fail('learn: --text obrigatório');
  const secrets = scanSecrets(text);
  if (secrets.length) fail(`learn REJEITADO: contém segredo (${secrets.join(', ')}).`);
  const ev = {
    id: randomUUID(), text,
    tags: typeof a.tags === 'string' ? a.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    file: typeof a.file === 'string' ? a.file : undefined,
    branch: currentBranch(), date: new Date().toISOString(),
  };
  appendJsonl(learningsLog(slug), ev);
  console.log(`[brain] aprendizagem registada (${slug}) id=${ev.id}`);
}
function cmdActive(a) {
  const slug = currentSlug(a.slug);
  const active = filterByScope(computeActive(readJsonl(decisionsLog(slug))), currentBranch());
  if (a.json) { console.log(JSON.stringify(active, null, 2)); return; }
  if (!active.length) { console.log(`(sem decisões activas para ${slug})`); return; }
  console.log(`# Decisões activas — ${slug}`);
  for (const d of active) console.log(`- [${d.date.slice(0, 10)}] ${datamark(d.decision)}${d.rationale ? ` — ${datamark(d.rationale)}` : ''}`);
}
function cmdRecall(a) {
  const slug = currentSlug(a.slug);
  const limit = parseInt(a.limit, 10) || 5;
  const active = filterByScope(computeActive(readJsonl(decisionsLog(slug))), currentBranch()).slice(-limit);
  const learns = readJsonl(learningsLog(slug)).slice(-limit);
  const lines = [];
  if (active.length) {
    lines.push(`## Brain — decisões activas (${slug})`);
    for (const d of active) lines.push(`- ${datamark(d.decision)}`);
  }
  if (learns.length) {
    lines.push(`## Brain — aprendizagens recentes (${slug})`);
    for (const l of learns) lines.push(`- ${datamark(l.text)}${l.tags && l.tags.length ? ` [${l.tags.join(',')}]` : ''}`);
  }
  console.log(lines.join('\n'));
}
function cmdSearch(a) {
  const slug = currentSlug(a.slug);
  const q = (a._[0] || '').toLowerCase();
  if (!q) fail('search: <query> obrigatório');
  const limit = parseInt(a.limit, 10) || 5;
  const hits = [];
  for (const d of computeActive(readJsonl(decisionsLog(slug)))) {
    const hay = `${d.decision} ${d.rationale || ''}`.toLowerCase();
    if (hay.includes(q)) hits.push(`[decisão] ${datamark(d.decision)}`);
  }
  for (const l of readJsonl(learningsLog(slug))) {
    const hay = `${l.text} ${(l.tags || []).join(' ')}`.toLowerCase();
    if (hay.includes(q)) hits.push(`[aprendizagem] ${datamark(l.text)}`);
  }
  console.log(hits.slice(0, limit).join('\n') || `(nada para "${q}" em ${slug})`);
}

function fail(msg) { console.error(msg); process.exit(1); }

// ---------- main ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const a = parseArgs(argv.slice(1));
switch (cmd) {
  case 'decide': cmdDecide(a); break;
  case 'supersede': cmdRef('supersede', a); break;
  case 'redact': cmdRef('redact', a); break;
  case 'learn': cmdLearn(a); break;
  case 'active': cmdActive(a); break;
  case 'recall': cmdRecall(a); break;
  case 'search': cmdSearch(a); break;
  default:
    console.log('joca-brain — uso: decide|supersede|redact|learn|active|recall|search (ver cabeçalho do ficheiro)');
    process.exit(cmd ? 1 : 0);
}

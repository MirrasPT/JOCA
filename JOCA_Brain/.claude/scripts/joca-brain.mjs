#!/usr/bin/env node
/**
 * joca-brain — JOCA's event-sourced institutional memory (decisions + learnings).
 *
 * Adapted from gstack lib/gstack-decision.ts (concepts, not code): append-only
 * JSONL log, COMPUTED "active" (a `decide` not referenced by `supersede`/`redact`),
 * repo/branch scope, secret-scan on write (HIGH → rejects), anti-injection datamark
 * on resurface, bounded snapshot for O(active) recall. Local-first markdown/JSONL —
 * does NOT import Postgres (JOCA's Brain stays in files).
 *
 * Store (single source, resolved via __dirname → never recompute with ../../):
 *   <JOCA_Brain>/memory/decisions/<slug>.jsonl     (+ .active.json snapshot)
 *   <JOCA_Brain>/memory/learnings/<slug>.jsonl
 *
 * Usage (the text can go positional or in --text; `<cmd> --help` prints the signature):
 *   joca-brain decide  "..." | --text "..." [--rationale "..."] [--scope repo|branch] [--branch X] [--source user|skill|agent] [--confidence 1-10]
 *   joca-brain supersede <id>
 *   joca-brain redact <id>
 *   joca-brain learn   "..." | --text "..." [--tags a,b,c] [--file path]
 *   joca-brain active  [--slug X] [--json]
 *   joca-brain recall  [--slug X] [--limit 5]      # active decisions + recent learnings (for the hook)
 *   joca-brain search  <query> [--limit 5] [--slug X]
 *   joca-brain reindex                              # forces a rebuild of the FTS5 index
 *
 * Search: tries FTS5 (node:sqlite via joca-memory-index.mjs; lazy rebuild by mtime,
 * includes checkpoints, bm25 ranking) and falls back to substring if node:sqlite is
 * unavailable (node <22.5), FTS5 is missing, or on error. JOCA_BRAIN_NO_FTS=1 forces the fallback.
 * Writes (decide/learn/supersede/redact) do NOT index — indexing is lazy, on search.
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
  } catch (_) { /* non-git */ }
  return sanitizeSlug(basename(process.cwd()));
}
function sanitizeSlug(s) { return String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'unknown'; }
function currentBranch() {
  try { return execSync('git branch --show-current', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined; }
  catch (_) { return undefined; }
}

// ---------- secret scan (HIGH-tier; rejects the write) ----------
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

// ---------- datamark (neutralizes injection on resurface) ----------
// Code-point filter (no control-char regex in the source) + simple substitutions.
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
  appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8'); // O_APPEND single-line = atomic
}
function readJsonl(file) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch (_) { /* tolerates a partial/malformed line */ }
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
// text accepted positionally (`learn "x"`) OR in --text — the positional was /learn's #1 error
function textOf(a) {
  if (typeof a.text === 'string') return a.text.trim();
  if (typeof a._[0] === 'string') return a._[0].trim();
  return '';
}
function cmdDecide(a) {
  const slug = currentSlug(a.slug);
  const text = textOf(a);
  if (!text) fail(`decide: text is required\n  ${USAGE.decide}`);
  const freeText = [text, a.rationale, a.branch].filter((s) => typeof s === 'string').join('\n');
  const secrets = scanSecrets(freeText);
  if (secrets.length) fail(`decide REJECTED: contains a secret (${secrets.join(', ')}). Rotate + remove — never log secrets.`);
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
  console.log(`[brain] decision recorded (${slug}) id=${ev.id}`);
}
function cmdRef(kind, a) {
  const slug = currentSlug(a.slug);
  const target = a._[0];
  if (!target) fail(`${kind}: <id> is required`);
  appendJsonl(decisionsLog(slug), { id: randomUUID(), kind, supersedes: target, date: new Date().toISOString(), source: 'agent' });
  refreshSnapshot(slug);
  console.log(`[brain] ${kind} of ${target} (${slug})`);
}
function cmdLearn(a) {
  const slug = currentSlug(a.slug);
  const text = textOf(a);
  if (!text) fail(`learn: text is required\n  ${USAGE.learn}`);
  const secrets = scanSecrets(text);
  if (secrets.length) fail(`learn REJECTED: contains a secret (${secrets.join(', ')}).`);
  const ev = {
    id: randomUUID(), text,
    tags: typeof a.tags === 'string' ? a.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    file: typeof a.file === 'string' ? a.file : undefined,
    branch: currentBranch(), date: new Date().toISOString(),
  };
  appendJsonl(learningsLog(slug), ev);
  console.log(`[brain] learning recorded (${slug}) id=${ev.id}`);
}
function cmdActive(a) {
  const slug = currentSlug(a.slug);
  const active = filterByScope(computeActive(readJsonl(decisionsLog(slug))), currentBranch());
  if (a.json) { console.log(JSON.stringify(active, null, 2)); return; }
  if (!active.length) { console.log(`(no active decisions for ${slug})`); return; }
  console.log(`# Active decisions — ${slug}`);
  for (const d of active) console.log(`- [${d.date.slice(0, 10)}] ${datamark(d.decision)}${d.rationale ? ` — ${datamark(d.rationale)}` : ''}`);
}
function cmdRecall(a) {
  const slug = currentSlug(a.slug);
  const limit = parseInt(a.limit, 10) || 5;
  const active = filterByScope(computeActive(readJsonl(decisionsLog(slug))), currentBranch()).slice(-limit);
  const learns = readJsonl(learningsLog(slug)).slice(-limit);
  const lines = [];
  if (active.length) {
    lines.push(`## Brain — active decisions (${slug})`);
    for (const d of active) lines.push(`- ${datamark(d.decision)}`);
  }
  if (learns.length) {
    lines.push(`## Brain — recent learnings (${slug})`);
    for (const l of learns) lines.push(`- ${datamark(l.text)}${l.tags && l.tags.length ? ` [${l.tags.join(',')}]` : ''}`);
  }
  console.log(lines.join('\n'));
}
async function cmdSearch(a) {
  const slug = currentSlug(a.slug);
  const qRaw = a._[0] || '';
  if (!qRaw) fail('search: <query> is required');
  const limit = parseInt(a.limit, 10) || 5;

  // 1) FTS5 (bm25 + snippets + checkpoints) — lazy rebuild if the db is missing/stale.
  try {
    const idx = await import('./joca-memory-index.mjs');
    if (idx.ftsAvailable()) {
      if (idx.isStale(MEM)) idx.rebuildIndex(MEM);
      const rows = idx.searchIndex(MEM, qRaw, { limit, slug });
      const lines = rows.map((r) => {
        if (r.kind === 'decision') return `[decision] ${datamark(r.title)}`;
        if (r.kind === 'learning') return `[learning] ${datamark(r.title)}`;
        return `[checkpoint ${basename(r.source_path)}] ${datamark(r.title)} — ${datamark(r.snippet)}`;
      });
      console.log(lines.join('\n') || `(nothing for "${qRaw}" in ${slug})`);
      return;
    }
  } catch (_) { /* node:sqlite unavailable or broken index → substring */ }

  // 2) substring fallback (original behavior, no checkpoints)
  const q = qRaw.toLowerCase();
  const hits = [];
  for (const d of computeActive(readJsonl(decisionsLog(slug)))) {
    const hay = `${d.decision} ${d.rationale || ''}`.toLowerCase();
    if (hay.includes(q)) hits.push(`[decision] ${datamark(d.decision)}`);
  }
  for (const l of readJsonl(learningsLog(slug))) {
    const hay = `${l.text} ${(l.tags || []).join(' ')}`.toLowerCase();
    if (hay.includes(q)) hits.push(`[learning] ${datamark(l.text)}`);
  }
  console.log(hits.slice(0, limit).join('\n') || `(nothing for "${q}" in ${slug})`);
}
async function cmdReindex() {
  let idx;
  try { idx = await import('./joca-memory-index.mjs'); }
  catch (e) { fail(`reindex: joca-memory-index unavailable (${e.message})`); }
  if (!idx.ftsAvailable()) fail('reindex: node:sqlite/FTS5 unavailable (needs node >= 22.5; JOCA_BRAIN_NO_FTS turns it off)');
  try {
    const c = idx.rebuildIndex(MEM);
    console.log(`[brain] FTS5 index rebuilt: ${c.decisions} decisions, ${c.learnings} learnings, ${c.checkpoints} checkpoints → memory/.index/memory.db`);
  } catch (e) { fail(`reindex failed: ${e.message}`); }
}

function fail(msg) { console.error(msg); process.exit(1); }

// ---------- usage (--help per command; you used to have to open the .mjs to see the flags) ----------
const USAGE = {
  decide: 'joca-brain decide "text" [--rationale "..."] [--scope repo|branch] [--branch X] [--source user|skill|agent] [--confidence 1-10] [--slug X]',
  supersede: 'joca-brain supersede <id> [--slug X]',
  redact: 'joca-brain redact <id> [--slug X]',
  learn: 'joca-brain learn "text" [--tags a,b,c] [--file path] [--slug X]',
  active: 'joca-brain active [--slug X] [--json]',
  recall: 'joca-brain recall [--slug X] [--limit 5]',
  search: 'joca-brain search <query> [--limit 5] [--slug X]',
  reindex: 'joca-brain reindex',
};

// ---------- main ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const a = parseArgs(argv.slice(1));
if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
  console.log(Object.values(USAGE).join('\n'));
  process.exit(0);
}
// `-h` and `help` do not start with `--`, so parseArgs puts them in the positional `_` — and the
// text of the write commands READS `_[0]`. Without this check, `learn -h` recorded a "-h" learning.
const pedeAjuda = a.help || a.h || a._.includes('-h') || a._.includes('help');
if (pedeAjuda && USAGE[cmd]) { console.log(USAGE[cmd]); process.exit(0); }
switch (cmd) {
  case 'decide': cmdDecide(a); break;
  case 'supersede': cmdRef('supersede', a); break;
  case 'redact': cmdRef('redact', a); break;
  case 'learn': cmdLearn(a); break;
  case 'active': cmdActive(a); break;
  case 'recall': cmdRecall(a); break;
  case 'search': await cmdSearch(a); break;
  case 'reindex': await cmdReindex(); break;
  default:
    console.log('joca-brain — usage: decide|supersede|redact|learn|active|recall|search|reindex (see the file header)');
    process.exit(cmd ? 1 : 0);
}

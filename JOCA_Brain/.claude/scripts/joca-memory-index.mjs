#!/usr/bin/env node
/**
 * joca-memory-index — índice full-text FTS5 da memória do Brain (node:sqlite, zero deps).
 *
 * Indexa decisões ACTIVAS + aprendizagens (JSONL) + checkpoints (markdown) numa base
 * SQLite em <memory>/.index/memory.db (gitignored). Consumido por joca-brain.mjs
 * (`search`/`reindex`): rebuild lazy no search via mtime — NUNCA no write.
 *
 * Fail-silent by design: node <22.5 não tem node:sqlite, e nem todo o binário traz FTS5 —
 * `ftsAvailable()` devolve false e o caller cai para a busca substring original.
 * Override manual: JOCA_BRAIN_NO_FTS=1 desliga o FTS (útil p/ testar o fallback).
 *
 * API:
 *   ftsAvailable()                        → bool
 *   isStale(memoryRoot)                   → bool (db inexistente ou fonte mais recente)
 *   rebuildIndex(memoryRoot)              → { decisions, learnings, checkpoints }
 *   searchIndex(memoryRoot, query, {limit, slug}) → [{kind, slug, id, ts, title, snippet, source_path, rank}]
 */
import { join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs';

// ---------- import protegido (node:sqlite só existe em node >= 22.5) ----------
let DatabaseSync = null;
try {
  // Silencia SÓ o ExperimentalWarning do SQLite (stderr limpo p/ hooks); o resto passa.
  const prev = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w && w.name === 'ExperimentalWarning' && /sqlite/i.test(String(w.message))) return;
    for (const l of prev) l.call(process, w);
  });
  ({ DatabaseSync } = await import('node:sqlite'));
} catch (_) { DatabaseSync = null; /* node antigo — indisponível */ }

// ---------- disponibilidade (probe FTS5 cached) ----------
let ftsProbe = null;
export function ftsAvailable() {
  if (process.env.JOCA_BRAIN_NO_FTS) return false;
  if (!DatabaseSync) return false;
  if (ftsProbe === null) {
    try {
      const db = new DatabaseSync(':memory:');
      db.exec('CREATE VIRTUAL TABLE _probe USING fts5(x)');
      db.close();
      ftsProbe = true;
    } catch (_) { ftsProbe = false; /* binário sem FTS5 */ }
  }
  return ftsProbe;
}

// ---------- paths + db ----------
function dbPath(memoryRoot) { return join(memoryRoot, '.index', 'memory.db'); }
function openDb(memoryRoot) {
  const dir = join(memoryRoot, '.index');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath(memoryRoot));
  // Colunas todas pesquisáveis; body é a coluna 5 (0-based) — usada pelo snippet().
  db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS mem USING fts5(kind, slug, id, ts, title, body, source_path)');
  return db;
}

// ---------- scan de fontes ----------
function filesIn(dir, ext) {
  if (!existsSync(dir)) return [];
  try { return readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => join(dir, f)); }
  catch (_) { return []; }
}
function checkpointFiles(memoryRoot) {
  const root = join(memoryRoot, 'checkpoints');
  if (!existsSync(root)) return [];
  const out = [];
  try {
    for (const d of readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const f of filesIn(join(root, d.name), '.md')) out.push([d.name, f]); // [slug, path]
    }
  } catch (_) { /* best-effort */ }
  return out;
}
function sourceFiles(memoryRoot) {
  return [
    ...filesIn(join(memoryRoot, 'decisions'), '.jsonl'),
    ...filesIn(join(memoryRoot, 'learnings'), '.jsonl'),
    ...checkpointFiles(memoryRoot).map(([, f]) => f),
  ];
}

// ---------- staleness (mtime db vs fontes) ----------
export function isStale(memoryRoot) {
  const dbp = dbPath(memoryRoot);
  if (!existsSync(dbp)) return true;
  let dbM;
  try { dbM = statSync(dbp).mtimeMs; } catch (_) { return true; }
  for (const f of sourceFiles(memoryRoot)) {
    try { if (statSync(f).mtimeMs >= dbM) return true; } catch (_) { /* removido entretanto */ }
  }
  return false;
}

// ---------- parse de fontes ----------
function readJsonl(file) {
  const out = [];
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t)); } catch (_) { /* tolera linha parcial/malformada */ }
    }
  } catch (_) { /* ilegível → vazio */ }
  return out;
}
function parseCheckpoint(file) {
  const raw = readFileSync(file, 'utf8');
  let body = raw, ts = '';
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const m = raw.slice(3, end).match(/^ts:\s*(.+)$/m);
      if (m) ts = m[1].trim();
      body = raw.slice(end + 4);
    }
  }
  // Título = 1º heading/linha não-vazia do corpo; fallback = nome do ficheiro.
  const first = body.split('\n').map((l) => l.trim()).find((l) => l.length);
  const title = (first && first.replace(/^#+\s*/, '').slice(0, 120)) || basename(file, '.md');
  return { ts, title, body };
}

// ---------- rebuild (DELETE + INSERT numa transacção) ----------
export function rebuildIndex(memoryRoot) {
  const counts = { decisions: 0, learnings: 0, checkpoints: 0 };
  const rows = []; // [kind, slug, id, ts, title, body, source_path]

  // Decisões — só ACTIVAS (decide não referido por supersede/redact), como computeActive.
  for (const file of filesIn(join(memoryRoot, 'decisions'), '.jsonl')) {
    const slug = basename(file, '.jsonl');
    const events = readJsonl(file);
    const retired = new Set();
    for (const e of events) if ((e.kind === 'supersede' || e.kind === 'redact') && e.supersedes) retired.add(e.supersedes);
    for (const e of events) {
      if (e.kind !== 'decide' || retired.has(e.id)) continue;
      rows.push(['decision', slug, e.id || '', e.date || '', String(e.decision || ''),
        [e.decision, e.rationale].filter((s) => typeof s === 'string').join('\n'), file]);
      counts.decisions++;
    }
  }

  // Aprendizagens — todas (não há supersede em learnings).
  for (const file of filesIn(join(memoryRoot, 'learnings'), '.jsonl')) {
    const slug = basename(file, '.jsonl');
    for (const e of readJsonl(file)) {
      if (typeof e.text !== 'string') continue;
      rows.push(['learning', slug, e.id || '', e.date || '', e.text,
        [e.text, (e.tags || []).join(' '), e.file].filter(Boolean).join('\n'), file]);
      counts.learnings++;
    }
  }

  // Checkpoints — markdown por slug.
  for (const [slug, file] of checkpointFiles(memoryRoot)) {
    try {
      const { ts, title, body } = parseCheckpoint(file);
      rows.push(['checkpoint', slug, basename(file, '.md'), ts, title, body, file]);
      counts.checkpoints++;
    } catch (_) { /* checkpoint ilegível → salta */ }
  }

  const db = openDb(memoryRoot);
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM mem');
    const ins = db.prepare('INSERT INTO mem (kind, slug, id, ts, title, body, source_path) VALUES (?,?,?,?,?,?,?)');
    for (const r of rows) ins.run(...r);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* já fechado */ }
    db.close();
    throw e;
  }
  db.close();
  return counts;
}

// ---------- query FTS5 sanitizada ----------
// Cada termo vai entre aspas duplas (phrase token) — neutraliza operadores FTS5
// (AND/OR/NOT/NEAR/*/^/:) e aspas do utilizador (escapadas por duplicação).
function ftsQuery(q) {
  return String(q).split(/\s+/).filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`).join(' ');
}

// ---------- search (bm25 ranking + snippet) ----------
export function searchIndex(memoryRoot, query, { limit = 5, slug } = {}) {
  const match = ftsQuery(query);
  if (!match) return [];
  const db = openDb(memoryRoot);
  try {
    const sql = `SELECT kind, slug, id, ts, title,
        snippet(mem, 5, '«', '»', '…', 12) AS snippet,
        source_path, bm25(mem) AS rank
      FROM mem WHERE mem MATCH ?${slug ? ' AND slug = ?' : ''}
      ORDER BY rank LIMIT ?`;
    const stmt = db.prepare(sql);
    return slug ? stmt.all(match, slug, limit) : stmt.all(match, limit);
  } finally {
    db.close();
  }
}

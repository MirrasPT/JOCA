#!/usr/bin/env node
// Stop hook — lê .joca/test-queue.jsonl e devolve a recomendação ao modelo.
// Stop hooks só chegam ao modelo via {"decision":"block","reason":...} no stdout.
// Bloqueia no máximo 1× por sessão (sentinel) e nunca quando stop_hook_active=true.
const fs = require('fs');
const path = require('path');

const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '../..');
const jocaDir = path.join(repoRoot, '.joca');
const queueFile = path.join(jocaDir, 'test-queue.jsonl');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {}

// Já estamos dentro de um ciclo de Stop hook — não voltar a bloquear (evita loop).
if (input.stop_hook_active) process.exit(0);

if (!fs.existsSync(queueFile)) process.exit(0);
const content = fs.readFileSync(queueFile, 'utf8').trim();
if (!content) process.exit(0);

const lines = content.split('\n').filter(Boolean);
let backend = 0, frontend = 0, style = 0, db = 0;
const files = [];

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.file) files.push(entry.file);
    if (entry.domain === 'backend') backend++;
    else if (entry.domain === 'frontend') frontend++;
    else if (entry.domain === 'style') style++;
    else if (entry.domain === 'database') db++;
  } catch {}
}

// Captura de última sessão (rede de segurança quando não há /save).
try {
  if (!fs.existsSync(jocaDir)) fs.mkdirSync(jocaDir, { recursive: true });
  fs.writeFileSync(path.join(jocaDir, 'last-session.json'), JSON.stringify({
    date: new Date().toISOString(),
    cwd: process.cwd(),
    files: [...new Set(files)].slice(0, 50),
  }, null, 2));
} catch {}

const tests = [];
if (backend > 0) tests.push('tester-code', 'tester-api');
if (frontend > 0) tests.push('tester-ui-ux');
if (db > 0) tests.push('query-debugger');
if (backend + frontend > 3) tests.push('tester-security');

if (tests.length === 0) {
  fs.writeFileSync(queueFile, '');
  process.exit(0);
}

// Sentinel: bloquear no máximo 1× por sessão.
const sessionId = String(input.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '');
const sentinel = path.join(jocaDir, `dispatched-${sessionId}`);
if (fs.existsSync(sentinel)) {
  fs.writeFileSync(queueFile, '');
  process.exit(0);
}

const reason = `AUTO-TEST: ${lines.length} files changed (${backend} backend, ${frontend} frontend, ${db} db). ` +
  `Dispatch the recommended tester agents before finishing: ${tests.join(', ')}. ` +
  `If tests are genuinely not applicable (docs-only change), state why and finish.`;

fs.writeFileSync(sentinel, new Date().toISOString());
fs.writeFileSync(queueFile, '');
console.log(JSON.stringify({ decision: 'block', reason }));

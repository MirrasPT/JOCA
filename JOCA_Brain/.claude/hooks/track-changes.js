#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// stdin-first (padrão skill-lint.js): lê o JSON oficial do hook (tool_input.file_path);
// se vazio, cai para argv[2] ($TOOL_INPUT_FILE_PATH — pode falhar a expandir no PowerShell).
let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { /* sem stdin */ }

let filePath = '';
let toolInput = {};
try {
  const data = JSON.parse(raw || '{}');
  toolInput = data.tool_input || {};
  filePath = toolInput.file_path || toolInput.path || '';
} catch (_) { /* input não-JSON — nada a fazer */ }

if (!filePath && process.argv[2]) filePath = process.argv[2];
if (!filePath) process.exit(0);

const norm = filePath.replace(/\\/g, '/');

// --- Filtro 1: self-paths do próprio Brain ------------------------------------
// Editar um hook Node não é trabalho de frontend. Sem isto, qualquer .js/.mjs do
// toolkit contava como "frontend" e o Stop hook pedia tester-ui-ux para código sem UI.
const SELF = ['/.claude/hooks/', '/.claude/scripts/', '/.joca/', '/.claude/agents/', '/.claude/rules/'];
if (SELF.some((s) => norm.includes(s))) process.exit(0);

// --- Filtro 2: artefactos de build (não são fonte) ----------------------------
const BUILD = ['/dist/', '/build/', '/node_modules/', '/.next/', '/graphify-out/', '/vendor/', '/.git/'];
if (BUILD.some((s) => norm.includes(s))) process.exit(0);

const repoRoot = path.resolve(__dirname, '../..');
const queueDir = path.join(repoRoot, '.joca');
const queueFile = path.join(queueDir, 'test-queue.jsonl');

if (!fs.existsSync(queueDir)) fs.mkdirSync(queueDir, { recursive: true });

const ext = path.extname(filePath).slice(1).toLowerCase();
const domainMap = {
  php: 'backend',
  ts: 'frontend', tsx: 'frontend',
  js: 'frontend', jsx: 'frontend',
  vue: 'frontend', svelte: 'frontend',
  css: 'style', scss: 'style',
  sql: 'database',
  md: 'docs',
  sh: 'devops', bat: 'devops', command: 'devops',
  json: 'config', toml: 'config', yaml: 'config', yml: 'config',
};
let domain = domainMap[ext] || 'other';

// --- Filtro 3: classificar pelo CONTEÚDO do diff, não só pela extensão --------
// Um bump de constante de versão num functions.php não é uma alteração de backend.
// Só se aplica ao Edit (temos o texto novo); no Write assume-se alteração real.
function isTrivial(added) {
  const lines = added.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return true;
  return lines.every((l) =>
    /^(\/\/|#|\*|\/\*|\*\/|<!--|--)/.test(l) ||                       // comentário
    /^(define\s*\(|const\s+\w*VERSION|\w*VERSION\s*=|"version"\s*:)/i.test(l) || // versão/constante
    /^["']?\d+\.\d+/.test(l)                                          // número de versão solto
  );
}
if (typeof toolInput.new_string === 'string' && isTrivial(toolInput.new_string)) {
  domain = 'trivial';
}

const entry = JSON.stringify({
  file: filePath,
  domain,
  ts: new Date().toISOString(),
});

fs.appendFileSync(queueFile, entry + '\n');

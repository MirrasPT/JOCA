#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// stdin-first (padrão skill-lint.js): lê o JSON oficial do hook (tool_input.file_path);
// se vazio, cai para argv[2] ($TOOL_INPUT_FILE_PATH — pode falhar a expandir no PowerShell).
let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { /* sem stdin */ }

let filePath = '';
try {
  const data = JSON.parse(raw || '{}');
  filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
} catch (_) { /* input não-JSON — nada a fazer */ }

if (!filePath && process.argv[2]) filePath = process.argv[2];
if (!filePath) process.exit(0);

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
const domain = domainMap[ext] || 'other';

const entry = JSON.stringify({
  file: filePath,
  domain,
  ts: new Date().toISOString(),
});

fs.appendFileSync(queueFile, entry + '\n');

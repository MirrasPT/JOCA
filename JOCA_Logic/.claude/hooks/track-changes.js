#!/usr/bin/env node
// PostToolUse(Write|Edit) hook — regista ficheiros alterados em .joca/test-queue.jsonl
// Input: JSON no stdin (payload oficial do Claude Code), não argv.
const fs = require('fs');
const path = require('path');

let filePath = process.argv[2] || '';
if (!filePath) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    filePath = (input.tool_input && input.tool_input.file_path) || '';
  } catch {}
}
if (!filePath) process.exit(0);

const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '../..');
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

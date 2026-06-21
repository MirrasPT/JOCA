#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
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

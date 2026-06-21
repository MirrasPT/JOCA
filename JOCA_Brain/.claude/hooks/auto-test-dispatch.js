#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const queueFile = path.join(repoRoot, '.joca', 'test-queue.jsonl');

if (!fs.existsSync(queueFile)) process.exit(0);
const content = fs.readFileSync(queueFile, 'utf8').trim();
if (!content) process.exit(0);

const lines = content.split('\n').filter(Boolean);
let backend = 0, frontend = 0, style = 0, db = 0;

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.domain === 'backend') backend++;
    else if (entry.domain === 'frontend') frontend++;
    else if (entry.domain === 'style') style++;
    else if (entry.domain === 'database') db++;
  } catch {}
}

const tests = [];
if (backend > 0) tests.push('tester-code', 'tester-api');
if (frontend > 0) tests.push('tester-ui-ux');
if (db > 0) tests.push('query-debugger');
if (backend + frontend > 3) tests.push('tester-security');

if (tests.length > 0) {
  console.log(`AUTO-TEST: ${lines.length} files changed (${backend} backend, ${frontend} frontend, ${db} db). Recommended: ${tests.join(' ')}`);
}

fs.writeFileSync(queueFile, '');

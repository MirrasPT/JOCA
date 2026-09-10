#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// stdin-first (the skill-lint.js pattern): reads the official hook JSON (tool_input.file_path);
// if empty, falls back to argv[2] ($TOOL_INPUT_FILE_PATH — may fail to expand in PowerShell).
let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { /* no stdin */ }

let filePath = '';
let toolInput = {};
try {
  const data = JSON.parse(raw || '{}');
  toolInput = data.tool_input || {};
  filePath = toolInput.file_path || toolInput.path || '';
} catch (_) { /* non-JSON input — nothing to do */ }

if (!filePath && process.argv[2]) filePath = process.argv[2];
if (!filePath) process.exit(0);

const norm = filePath.replace(/\\/g, '/');

// --- Filter 1: the Brain's own self-paths -------------------------------------
// Editing a Node hook is not frontend work. Without this, any .js/.mjs in the
// toolkit counted as "frontend" and the Stop hook asked for tester-ui-ux on code with no UI.
const SELF = ['/.claude/hooks/', '/.claude/scripts/', '/.joca/', '/.claude/agents/', '/.claude/rules/'];
if (SELF.some((s) => norm.includes(s))) process.exit(0);

// --- Filter 2: build artifacts (they are not source) --------------------------
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

// --- Filter 3: classify by the CONTENT of the diff, not just by the extension -
// A version-constant bump in a functions.php is not a backend change.
// Only applies to Edit (we have the new text); on Write a real change is assumed.
function isTrivial(added) {
  const lines = added.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return true;
  return lines.every((l) =>
    /^(\/\/|#|\*|\/\*|\*\/|<!--|--)/.test(l) ||                       // comment
    /^(define\s*\(|const\s+\w*VERSION|\w*VERSION\s*=|"version"\s*:)/i.test(l) || // version/constant
    /^["']?\d+\.\d+/.test(l)                                          // bare version number
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

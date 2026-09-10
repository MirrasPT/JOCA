#!/usr/bin/env node
// PostToolUse hook — runs validate-skill.py ONLY when the edited file is a skill
// (.claude/skills/*.md). Non-blocking: prints a warning if there is a FAIL, but always exit 0.
// Reads the hook input from stdin (the official Claude Code JSON: tool_input.file_path).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { /* no stdin */ }

let filePath = '';
try {
  const data = JSON.parse(raw || '{}');
  filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
} catch (_) { /* non-JSON input — nothing to do */ }

// Fallback: argv (compat with the convention of the other hooks).
if (!filePath && process.argv[2]) filePath = process.argv[2];

const norm = String(filePath).replace(/\\/g, '/');
if (!norm || !/\.claude\/skills\/.+\.md$/.test(norm)) process.exit(0);

const repoRoot = path.resolve(__dirname, '../..');
// Probe python (Windows: `python`, not the `python3` Store stub).
let py = 'python';
const probe = spawnSync(py, ['--version'], { cwd: repoRoot });
if (probe.status !== 0) py = 'python3';

const res = spawnSync(py, ['.claude/scripts/validate-skill.py', filePath], {
  cwd: repoRoot, encoding: 'utf8',
});
if (res.status && res.stdout && /\[FAIL\]/.test(res.stdout)) {
  process.stdout.write('[skill-lint] invalid frontmatter:\n' + res.stdout.trim() + '\n');
}
process.exit(0);

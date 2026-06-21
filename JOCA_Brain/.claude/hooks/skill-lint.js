#!/usr/bin/env node
// PostToolUse hook — corre validate-skill.py SÓ quando o ficheiro editado é uma skill
// (.claude/skills/*.md). Não-bloqueante: imprime aviso se houver FAIL, mas exit 0 sempre.
// Lê o input do hook em stdin (JSON oficial do Claude Code: tool_input.file_path).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { /* sem stdin */ }

let filePath = '';
try {
  const data = JSON.parse(raw || '{}');
  filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
} catch (_) { /* input não-JSON — nada a fazer */ }

// Fallback: argv (compat com a convenção dos outros hooks).
if (!filePath && process.argv[2]) filePath = process.argv[2];

const norm = String(filePath).replace(/\\/g, '/');
if (!norm || !/\.claude\/skills\/.+\.md$/.test(norm)) process.exit(0);

const repoRoot = path.resolve(__dirname, '../..');
// Probe python (Windows: `python`, não `python3` stub da Store).
let py = 'python';
const probe = spawnSync(py, ['--version'], { cwd: repoRoot });
if (probe.status !== 0) py = 'python3';

const res = spawnSync(py, ['.claude/scripts/validate-skill.py', filePath], {
  cwd: repoRoot, encoding: 'utf8',
});
if (res.status && res.stdout && /\[FAIL\]/.test(res.stdout)) {
  process.stdout.write('[skill-lint] frontmatter inválido:\n' + res.stdout.trim() + '\n');
}
process.exit(0);

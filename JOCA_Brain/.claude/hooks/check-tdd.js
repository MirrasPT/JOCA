#!/usr/bin/env node
// PreToolUse(Edit|Write) hook — /tdd guard-rail (test-first enforcement, opt-in).
// Armed by state: only acts if `.joca/tdd.flag` exists in the cwd (written by /tdd; removed by /unfreeze).
// No state → no-op (allow). Fail-OPEN: any error → allow.
// The decision is ALWAYS "ask", never "deny" — the code→test mapping is heuristic;
// deny would produce false blocks (config, glue code, authorised hotfix).
// Inspired by TDD Guard (nizos/tdd-guard); reimplemented in the JOCA flag-file pattern.
const fs = require('fs');
const path = require('path');

const TEST_TTL_MIN = 30; // window after touching a test in which production edits pass freely

function allow() { process.exit(0); }

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (_) { return ''; }
}

try {
  const cwd = process.cwd();
  const jocaDir = path.join(cwd, '.joca');
  if (!fs.existsSync(path.join(jocaDir, 'tdd.flag'))) allow();

  const raw = readStdin();
  if (!raw) allow();
  const input = JSON.parse(raw);
  const filePath = input && input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (!filePath) allow();

  const rel = path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/g, '/');

  // Test file? → record the timestamp and allow (writing tests is always free).
  const isTest = /(^|\/)tests?\/|\.test\.|\.spec\.|_test\.|Tests?\.cs$|Test\.php$/i.test(rel);
  const lastTestFile = path.join(jocaDir, 'tdd-last-test.txt');
  if (isTest) {
    try { fs.writeFileSync(lastTestFile, String(Date.now())); } catch (_) { /* best-effort */ }
    allow();
  }

  // Only production code is watched — the rest (md/json/css/html/config/assets) passes.
  const isCode = /\.(php|ts|tsx|js|jsx|mjs|cjs|py|cs|vue|go|rb)$/i.test(rel);
  if (!isCode) allow();
  // Common config/build files are not "production" for TDD purposes.
  if (/(^|\/)(vite|next|tailwind|eslint|prettier|jest|vitest|phpunit|webpack|babel)\.config\.|(^|\/)config\//i.test(rel)) allow();

  // Test touched inside the window? → red-green in progress, allow.
  try {
    const ts = parseInt(fs.readFileSync(lastTestFile, 'utf8').trim(), 10);
    if (Number.isFinite(ts) && Date.now() - ts < TEST_TTL_MIN * 60 * 1000) allow();
  } catch (_) { /* no record → falls through to the ask */ }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `[tdd] Test-first mode active — you are about to edit production code with no new/changed test in this window (${TEST_TTL_MIN} min).\n` +
        `  File: ${rel}\n` +
        `Write a failing test first (red), or confirm to proceed anyway. /unfreeze turns the mode off.`,
    },
  }));
  process.exit(0);
} catch (_) {
  allow(); // fail-open
}

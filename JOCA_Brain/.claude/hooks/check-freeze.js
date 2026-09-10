#!/usr/bin/env node
// PreToolUse(Edit|Write) hook — /freeze guard-rail.
// Blocks edits OUTSIDE the locked directory. Armed by state: only acts if
// `.joca/freeze-dir.txt` exists in the cwd (written by /freeze; removed by /unfreeze).
// No state → no-op (allow). Fail-OPEN: any error → allow (never lock the user out over a bug).
// Adapted from gstack freeze/bin/check-freeze.sh; rewritten in Node for Windows.
const fs = require('fs');
const path = require('path');

function allow() { process.exit(0); } // no output = allow

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (_) { return ''; }
}

try {
  const cwd = process.cwd();
  const stateFile = path.join(cwd, '.joca', 'freeze-dir.txt');
  if (!fs.existsSync(stateFile)) allow();

  let frozen = fs.readFileSync(stateFile, 'utf8').trim();
  if (!frozen) allow();
  frozen = path.resolve(cwd, frozen);

  const raw = readStdin();
  if (!raw) allow();
  const input = JSON.parse(raw);
  const filePath = input && input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (!filePath) allow(); // no path → cannot decide, so allow

  const target = path.resolve(cwd, filePath);
  // trailing sep stops /src from matching /src-old
  const frozenPrefix = frozen.endsWith(path.sep) ? frozen : frozen + path.sep;
  const inScope = target === frozen || target.startsWith(frozenPrefix);

  if (inScope) allow();

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[freeze] Edit blocked — outside the locked scope.\n` +
        `  Allowed:   ${frozen}\n  Attempted: ${target}\n` +
        `Run /unfreeze to remove the lock, or /freeze to change the scope.`,
    },
  }));
  process.exit(0);
} catch (_) {
  allow(); // fail-open
}

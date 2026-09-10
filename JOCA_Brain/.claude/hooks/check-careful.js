#!/usr/bin/env node
// PreToolUse(Bash) hook — /careful guard-rail.
// Warns (permissionDecision: "ask") before destructive commands. Does NOT block —
// the user can confirm. Armed by state: only acts if `.joca/careful.flag` exists
// in the cwd (written by /careful or /guard; removed by /unfreeze or end of session).
// No state → no-op (allow). Fail-OPEN: error → allow.
// Adapted from gstack careful/bin/check-careful.sh; rewritten in Node + Windows patterns.
const fs = require('fs');
const path = require('path');

function allow() { process.exit(0); }

// Destructive patterns (Unix + Windows/PowerShell). Each one: [regex, label].
const PATTERNS = [
  [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, 'rm -rf (forced recursive delete)'],
  [/\bRemove-Item\b.*-Recurse\b.*-Force\b/i, 'Remove-Item -Recurse -Force'],
  [/\b(rmdir|rd)\s+\/s\b/i, 'rmdir /s (delete tree)'],
  [/\bdel\s+\/[a-z]*s\b/i, 'del /s (recursive delete)'],
  [/\bgit\s+push\b.*(--force\b|-f\b|--force-with-lease\b)/i, 'git push --force'],
  [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard (discards changes)'],
  [/\bgit\s+clean\s+-[a-z]*f/i, 'git clean -f (deletes untracked files)'],
  [/\bgit\s+checkout\s+--\s+\./i, 'git checkout -- . (discards the working tree)'],
  [/\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, 'SQL DROP/TRUNCATE'],
  [/\bDELETE\s+FROM\b(?!.*\bWHERE\b)/i, 'DELETE FROM without WHERE'],
  [/\btaskkill\b.*\/f\b/i, 'taskkill /F (forced process kill)'],
  [/\b(mkfs|format)\b/i, 'format / mkfs (format disk)'],
  [/>\s*\/dev\/[sh]d[a-z]/i, 'direct write to a disk device'],
  [/\bdd\s+.*of=\/dev\//i, 'dd of=/dev/... (raw write to disk)'],
  [/:\(\)\s*\{.*\|.*&.*\};:/, 'fork bomb'],
  [/\bDROP\s+/i, 'SQL DROP'],
];

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (_) { return ''; }
}

try {
  const cwd = process.cwd();
  if (!fs.existsSync(path.join(cwd, '.joca', 'careful.flag'))) allow();

  const raw = readStdin();
  if (!raw) allow();
  const input = JSON.parse(raw);
  const cmd = input && input.tool_input && input.tool_input.command;
  if (!cmd || typeof cmd !== 'string') allow();

  for (const [re, label] of PATTERNS) {
    if (re.test(cmd)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            `[careful] Destructive command detected: ${label}.\n` +
            `Confirm that you really want to run this. (/unfreeze to turn careful mode off.)`,
        },
      }));
      process.exit(0);
    }
  }
  allow();
} catch (_) {
  allow(); // fail-open
}

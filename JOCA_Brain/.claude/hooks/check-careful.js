#!/usr/bin/env node
// PreToolUse(Bash) hook — /careful guard-rail.
// Avisa (permissionDecision: "ask") antes de comandos destrutivos. NÃO bloqueia —
// o user pode confirmar. Armado por estado: só actua se existir `.joca/careful.flag`
// no cwd (escrito por /careful ou /guard; removido por /unfreeze ou fim de sessão).
// Sem estado → no-op (allow). Fail-OPEN: erro → allow.
// Adaptado de gstack careful/bin/check-careful.sh; reescrito Node + padrões Windows.
const fs = require('fs');
const path = require('path');

function allow() { process.exit(0); }

// Padrões destrutivos (Unix + Windows/PowerShell). Cada um: [regex, rótulo].
const PATTERNS = [
  [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, 'rm -rf (apagar recursivo forçado)'],
  [/\bRemove-Item\b.*-Recurse\b.*-Force\b/i, 'Remove-Item -Recurse -Force'],
  [/\b(rmdir|rd)\s+\/s\b/i, 'rmdir /s (apagar árvore)'],
  [/\bdel\s+\/[a-z]*s\b/i, 'del /s (apagar recursivo)'],
  [/\bgit\s+push\b.*(--force\b|-f\b|--force-with-lease\b)/i, 'git push --force'],
  [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard (descarta alterações)'],
  [/\bgit\s+clean\s+-[a-z]*f/i, 'git clean -f (apaga ficheiros não-tracked)'],
  [/\bgit\s+checkout\s+--\s+\./i, 'git checkout -- . (descarta working tree)'],
  [/\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, 'SQL DROP/TRUNCATE'],
  [/\bDELETE\s+FROM\b(?!.*\bWHERE\b)/i, 'DELETE FROM sem WHERE'],
  [/\btaskkill\b.*\/f\b/i, 'taskkill /F (mata processo forçado)'],
  [/\b(mkfs|format)\b/i, 'format / mkfs (formatar disco)'],
  [/>\s*\/dev\/[sh]d[a-z]/i, 'escrita directa em device de disco'],
  [/\bdd\s+.*of=\/dev\//i, 'dd of=/dev/... (escrita raw em disco)'],
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
            `[careful] Comando destrutivo detectado: ${label}.\n` +
            `Confirma que queres mesmo correr isto. (/unfreeze para desligar o modo careful.)`,
        },
      }));
      process.exit(0);
    }
  }
  allow();
} catch (_) {
  allow(); // fail-open
}

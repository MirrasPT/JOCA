#!/usr/bin/env node
// PreToolUse(Edit|Write) hook — /freeze guard-rail.
// Bloqueia edições FORA do directório trancado. Armado por estado: só actua se
// existir `.joca/freeze-dir.txt` no cwd (escrito por /freeze; removido por /unfreeze).
// Sem estado → no-op (allow). Fail-OPEN: qualquer erro → allow (nunca trancar o user fora por bug).
// Adaptado de gstack freeze/bin/check-freeze.sh; reescrito Node p/ Windows.
const fs = require('fs');
const path = require('path');

function allow() { process.exit(0); } // sem output = permitir

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
  if (!filePath) allow(); // sem caminho → não consigo decidir, permito

  const target = path.resolve(cwd, filePath);
  // trailing sep evita /src casar com /src-old
  const frozenPrefix = frozen.endsWith(path.sep) ? frozen : frozen + path.sep;
  const inScope = target === frozen || target.startsWith(frozenPrefix);

  if (inScope) allow();

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[freeze] Edição bloqueada — fora do scope trancado.\n` +
        `  Permitido: ${frozen}\n  Tentado:   ${target}\n` +
        `Corre /unfreeze para remover o lock, ou /freeze para mudar o scope.`,
    },
  }));
  process.exit(0);
} catch (_) {
  allow(); // fail-open
}

#!/usr/bin/env node
// PreToolUse(Edit|Write) hook — /tdd guard-rail (test-first enforcement, opt-in).
// Armado por estado: só actua se existir `.joca/tdd.flag` no cwd (escrito por /tdd; removido por /unfreeze).
// Sem estado → no-op (allow). Fail-OPEN: qualquer erro → allow.
// Decisão é SEMPRE "ask", nunca "deny" — o mapeamento código→teste é heurístico;
// deny geraria falsos bloqueios (config, glue code, hotfix autorizado).
// Inspirado no TDD Guard (nizos/tdd-guard); reimplementado no padrão flag-file do JOCA.
const fs = require('fs');
const path = require('path');

const TEST_TTL_MIN = 30; // janela após tocar num teste em que edições de produção passam livres

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

  // Ficheiro de teste? → regista o timestamp e permite (escrever testes é sempre livre).
  const isTest = /(^|\/)tests?\/|\.test\.|\.spec\.|_test\.|Tests?\.cs$|Test\.php$/i.test(rel);
  const lastTestFile = path.join(jocaDir, 'tdd-last-test.txt');
  if (isTest) {
    try { fs.writeFileSync(lastTestFile, String(Date.now())); } catch (_) { /* best-effort */ }
    allow();
  }

  // Só vigia código de produção — resto (md/json/css/html/config/assets) passa.
  const isCode = /\.(php|ts|tsx|js|jsx|mjs|cjs|py|cs|vue|go|rb)$/i.test(rel);
  if (!isCode) allow();
  // Ficheiros de config/build comuns não são "produção" para efeitos de TDD.
  if (/(^|\/)(vite|next|tailwind|eslint|prettier|jest|vitest|phpunit|webpack|babel)\.config\.|(^|\/)config\//i.test(rel)) allow();

  // Teste tocado dentro da janela? → red-green em curso, permite.
  try {
    const ts = parseInt(fs.readFileSync(lastTestFile, 'utf8').trim(), 10);
    if (Number.isFinite(ts) && Date.now() - ts < TEST_TTL_MIN * 60 * 1000) allow();
  } catch (_) { /* sem registo → cai para o ask */ }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `[tdd] Modo test-first activo — vais editar código de produção sem teste novo/alterado nesta janela (${TEST_TTL_MIN} min).\n` +
        `  Ficheiro: ${rel}\n` +
        `Escreve primeiro um teste falhado (red), ou confirma para prosseguir na mesma. /unfreeze desliga o modo.`,
    },
  }));
  process.exit(0);
} catch (_) {
  allow(); // fail-open
}

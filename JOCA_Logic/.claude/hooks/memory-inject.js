#!/usr/bin/env node
// SessionStart hook — injecta o snapshot de memória curta no arranque.
// Equivalente ao "frozen snapshot" do padrão Hermes: memory/curta.md
// (gerado pelo /save, nunca acumula, alvo ≤1300 tokens) + avisos operacionais.
const fs = require('fs');
const path = require('path');

const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '../..');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {}

const parts = [];

// Em compactação só re-injectar as âncoras críticas, não o snapshot todo.
const isCompact = input.source === 'compact';

const curtaFile = path.join(repoRoot, 'memory', 'curta.md');
if (fs.existsSync(curtaFile)) {
  const curta = fs.readFileSync(curtaFile, 'utf8').trim();
  if (curta) {
    if (isCompact) {
      // Preservar só o bloco de retoma (primeiras ~15 linhas).
      parts.push('MEMÓRIA CURTA (retoma pós-compactação):\n' + curta.split('\n').slice(0, 15).join('\n'));
    } else {
      parts.push('MEMÓRIA CURTA (última sessão — snapshot de continuação):\n' + curta.slice(0, 6000));
    }
  }
}

if (!isCompact) {
  // Sessão anterior sem /save?
  const lastSession = path.join(repoRoot, '.joca', 'last-session.json');
  if (fs.existsSync(lastSession)) {
    try {
      const ls = JSON.parse(fs.readFileSync(lastSession, 'utf8'));
      const curtaTime = fs.existsSync(curtaFile) ? fs.statSync(curtaFile).mtimeMs : 0;
      if (new Date(ls.date).getTime() > curtaTime + 60000) {
        parts.push(`AVISO: última sessão (${ls.date}) terminou sem /save. Ficheiros tocados: ${(ls.files || []).slice(0, 10).join(', ')}`);
      }
    } catch {}
  }

  // Feedback pendente
  const feedbackDir = path.join(repoRoot, 'memory', 'feedback');
  if (fs.existsSync(feedbackDir)) {
    const pending = fs.readdirSync(feedbackDir).filter((f) => f.endsWith('.md'));
    if (pending.length > 0) {
      parts.push(`Feedback JOCA pendente: ${pending.length} ficheiros → considerar /upgrade-joca`);
    }
  }

  parts.push('Perguntas sobre o passado: memória curta acima → `python3 .claude/scripts/memory-search.py <termos>` (resumos + diário).');
}

if (parts.length === 0) process.exit(0);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: parts.join('\n\n'),
  },
}));

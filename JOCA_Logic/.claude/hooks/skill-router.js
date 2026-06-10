#!/usr/bin/env node
// UserPromptSubmit hook — skill router.
// Compara o prompt do utilizador com os triggers do SKILL_INDEX.json e injecta
// additionalContext a apontar as skills relevantes. Converte o trigger map de
// exortação em enforcement mecânico (auditoria 3.3 [ALTA]).
const fs = require('fs');
const path = require('path');

const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '../..');
const indexFile = path.join(repoRoot, 'memory', 'SKILL_INDEX.json');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {}

const prompt = String(input.prompt || '').toLowerCase();
if (!prompt || prompt.length < 8 || !fs.existsSync(indexFile)) process.exit(0);
// Slash commands têm o seu próprio routing — não interferir.
if (prompt.startsWith('/')) process.exit(0);

let index = [];
try {
  index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
} catch {
  process.exit(0);
}

const matches = [];
for (const entry of index) {
  if (!Array.isArray(entry.triggers)) continue;
  let score = 0;
  for (const trigger of entry.triggers) {
    const t = String(trigger).toLowerCase().trim();
    if (t.length >= 3 && prompt.includes(t)) score++;
  }
  if (score > 0) matches.push({ entry, score });
}

if (matches.length === 0) process.exit(0);

matches.sort((a, b) => b.score - a.score);
const top = matches.slice(0, 3).map(({ entry }) => {
  const kind = entry.type === 'agent' ? 'agent' : 'skill';
  const ref = entry.type === 'agent'
    ? `Agent(subagent_type="${entry.name}")`
    : `Read("${String(entry.path).replace(/\\/g, '/')}")`;
  return `- [${kind}] ${entry.name} → ${ref}`;
});

const context =
  'JOCA skill router — triggers matched for this prompt:\n' +
  top.join('\n') +
  '\nActivation Rule: relevance >= 60% → Read() the skill BEFORE writing any code. Notify with [skill: <name>]. Ignore if clearly irrelevant.';

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: context,
  },
}));

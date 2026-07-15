#!/usr/bin/env node
// SessionStart hook — injecta o decision tree de auto-orquestração + contagem do inventário
// como contexto inicial, para a auto-selecção de via não depender só da memória do modelo.
// Fail-silent: nunca bloqueia o arranque (exit 0 sempre).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const repoRoot = path.resolve(__dirname, '../..');
  let skillCount = 0, agentCount = 0;
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(repoRoot, 'memory', 'SKILL_INDEX.json'), 'utf8'));
    const entries = Array.isArray(idx) ? idx : (idx.skills || idx.entries || Object.values(idx).flat());
    for (const e of (entries || [])) {
      const p = (e && (e.path || e.file)) || '';
      if (/agents[\\/]/.test(p)) agentCount++; else skillCount++;
    }
  } catch (_) { /* index ausente — segue sem contagem */ }

  const ctx = [
    '## Task Intake (auto-orquestração — rules/task-intake.md)',
    'Antes de agir, classifica a tarefa em 1 das 4 vias, SEM o user pedir:',
    '- A directa: 0 ficheiros / pergunta pura → responde inline.',
    '- B 1 skill: 1 domínio, ≤2 ficheiros, reversível, match ≥60% → Read .claude/skills/<x>.md, executa.',
    '- C 1 agente: domínio especialista, trabalho isolável (review/debug/research/deploy) → Agent() com brief.',
    '- D workflow: ≥2 domínios em paralelo OU ≥3 ficheiros OU feature completa OU cross-stack → /goal → master-orchestrator em loop.',
    'Irreversível (auth/payments/migrations/deletes/deploy/push) → 1 linha de confirmação primeiro.',
    'Agentes usam skills: o brief de cada agente carrega Step 0 Read das skills relevantes.',
    (skillCount || agentCount) ? `Inventário: ~${skillCount} skills · ~${agentCount} agentes (mapa em memory/SKILL_INDEX.json).` : 'Inventário em memory/SKILL_INDEX.json.',
  ].join('\n');

  // Brain recall — decisões activas + aprendizagens recentes do projecto actual (slug = git do cwd).
  // Spawn do joca-brain (resolve o slug a partir do cwd); fail-silent, nunca bloqueia.
  let recall = '';
  try {
    const script = path.join(repoRoot, '.claude', 'scripts', 'joca-brain.mjs');
    if (fs.existsSync(script)) {
      recall = execSync(`node "${script}" recall --limit 4`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().trim();
    }
  } catch (_) { /* sem brain/recall — segue */ }

  const finalCtx = recall ? `${ctx}\n\n${recall}` : ctx;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: finalCtx },
  }));
} catch (_) { /* nunca bloquear */ }
process.exit(0);

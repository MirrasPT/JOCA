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

  // Skill loop — nudge quando há feedback acumulado por processar (fecha o ciclo /feedback-joca →
  // /upgrade-joca sem depender de o user se lembrar). Threshold 3 evita spam com 1-2 ficheiros.
  let feedbackNudge = '';
  try {
    const fbDir = path.join(repoRoot, 'memory', 'feedback');
    const pending = fs.readdirSync(fbDir).filter((f) => f.endsWith('.md') && !f.startsWith('processed-')).length;
    if (pending >= 3) {
      feedbackNudge = `## Skill Loop\n${pending} ficheiros de feedback acumulados em memory/feedback/ por processar — quando houver folga, sugere ao user correr /upgrade-joca (ou corre /upgrade-joca --auto se ele já o pediu como rotina).`;
    }
  } catch (_) { /* sem pasta feedback — segue */ }

  // Co-actividade — memória de projecto escrita nos últimos 45 min = outra sessão/worker esteve
  // (ou está) no mesmo projecto. Já custou: duas sessões em paralelo no mesmo projecto, uma a
  // reverter edições da outra, descoberto só pelo mtime da memória.
  let coAct = '';
  try {
    const projDir = path.join(repoRoot, 'memory', 'projects');
    const limite = Date.now() - 45 * 60 * 1000;
    const recentes = fs.readdirSync(projDir)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => { try { return fs.statSync(path.join(projDir, f)).mtimeMs > limite; } catch (_) { return false; } })
      .slice(0, 5);
    if (recentes.length) {
      coAct = `## ⚠ Co-actividade\nMemória escrita nos últimos 45 min: ${recentes.join(', ')} — outra sessão/worker pode estar activa nesse(s) projecto(s). Verifica antes de reverter edições que não fizeste, e evita reescrever ficheiros que ela esteja a tocar.`;
    }
  } catch (_) { /* sem memory/projects — segue */ }

  const finalCtx = [ctx, recall, coAct, feedbackNudge].filter(Boolean).join('\n\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: finalCtx },
  }));
} catch (_) { /* nunca bloquear */ }
process.exit(0);

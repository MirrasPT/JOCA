#!/usr/bin/env node
// SessionStart hook — injecta contexto de arranque: id da sessão, ponteiro para a rule de
// task-intake (sem a duplicar), inventário, recall do Brain, co-actividade e feedback por processar.
// ⚠ Os thresholds das 4 vias NÃO se copiam para aqui: vivem só em rules/task-intake.md (carregada em
// todas as sessões). Uma cópia no hook ficou com «B: ≤2 ficheiros» depois de a rule passar a «≥2=D»
// e contradizia-a em cada arranque (feedback 2026-09-14).
// Fail-silent: nunca bloqueia o arranque (exit 0 sempre).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const repoRoot = path.resolve(__dirname, '../..');

  // Id da sessão (campo session_id do JSON do stdin) — anuncia o contrato de continuidade desta
  // sessão. Um contrato por sessão: o de outra sessão nunca bloqueia esta. Sem id → sem linha.
  let sessaoLinha = '';
  try {
    if (!process.stdin.isTTY) {
      const payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
      const id = payload && typeof payload.session_id === 'string' ? payload.session_id.trim() : '';
      if (/^[A-Za-z0-9_-]{1,128}$/.test(id)) sessaoLinha = `[sessao] id=${id} · contrato de continuidade: .joca/loop/${id}.json (estados: pendente · em_curso + agente · feito · verificado)`;
    }
  } catch (_) { /* stdin vazio ou inválido — segue sem id */ }
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
    '## Arranque',
    'Via da tarefa (A/B/C/D), thresholds e gate de plano: rules/task-intake.md — fonte única, já carregada; não há cópia aqui.',
    `CLI externo (gen-ai, agy, mmctl, gws…) → Read da linha dele em ${path.join(repoRoot, 'memory', 'tools', 'clis.md')} e da receita que ela aponta, ANTES do 1.º comando.`,
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

  // Skill loop — nudge quando há feedback novo (fecha o ciclo /save → /upgrade-joca sem depender de o
  // user se lembrar). Critério = o do /upgrade-joca Phase 1.6(e), um só denominador: universo
  // `memory/feedback/session-*.md` (topo, sem archive/) sem `processed: true` no frontmatter; «novos»
  // = os que ainda não têm `upgrade_run:`. O critério antigo (todo `*.md` sem prefixo `processed-`)
  // contava logs e backlogs e dava um número que o /upgrade-joca nunca reproduzia (feedback 2026-09-02).
  // Threshold 3 evita spam com 1-2 ficheiros.
  let feedbackNudge = '';
  try {
    const fbDir = path.join(repoRoot, 'memory', 'feedback');
    let total = 0, novos = 0;
    for (const f of fs.readdirSync(fbDir)) {
      if (!/^session-.*\.md$/.test(f)) continue;
      let txt = '';
      try { txt = fs.readFileSync(path.join(fbDir, f), 'utf8'); } catch (_) { continue; }
      if (/^processed:\s*true\b/m.test(txt)) continue;
      total++;
      if (!/^upgrade_run:/m.test(txt)) novos++;
    }
    if (novos >= 3) {
      feedbackNudge = `## Skill Loop\n${novos} de ${total} ficheiros de feedback por processar (memory/feedback/session-*.md) são novos desde a última /upgrade-joca (sem \`upgrade_run:\`) — quando houver folga, sugere ao user correr /upgrade-joca (ou corre /upgrade-joca --auto se ele já o pediu como rotina).`;
    }
  } catch (_) { /* sem pasta feedback — segue */ }

  // Co-actividade — memória de projecto escrita nos últimos 45 min = outra sessão/worker esteve
  // (ou está) no mesmo projecto. Já custou: duas sessões em paralelo no mesmo projecto, uma a
  // reverter edições da outra, descoberto só pelo mtime da memória.
  let coAct = '';
  try {
    const projDir = path.join(repoRoot, 'memory', 'projects');
    const limite = Date.now() - 45 * 60 * 1000;
    // pasta `<slug>/<ficheiro>.md` → reporta `<slug>/<ficheiro>`: duas sessões em áreas diferentes do
    // mesmo projecto não colidem; só o index é partilhado
    const candidatos = [];
    for (const e of fs.readdirSync(projDir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'archive') {
        try { for (const f of fs.readdirSync(path.join(projDir, e.name))) if (f.endsWith('.md')) candidatos.push(`${e.name}/${f}`); } catch (_) { /* segue */ }
      }
    }
    const recentes = candidatos
      .filter((f) => { try { return fs.statSync(path.join(projDir, f)).mtimeMs > limite; } catch (_) { return false; } })
      .slice(0, 5);
    if (recentes.length) {
      coAct = `## ⚠ Co-actividade\nMemória escrita nos últimos 45 min: ${recentes.join(', ')} — outra sessão/worker pode estar activa nesse(s) projecto(s). Verifica antes de reverter edições que não fizeste, e evita reescrever ficheiros que ela esteja a tocar.`;
    }
  } catch (_) { /* sem memory/projects — segue */ }

  const finalCtx = [sessaoLinha, ctx, recall, coAct, feedbackNudge].filter(Boolean).join('\n\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: finalCtx },
  }));
} catch (_) { /* nunca bloquear */ }
process.exit(0);

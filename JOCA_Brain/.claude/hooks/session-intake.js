#!/usr/bin/env node
// SessionStart hook — injects the auto-orchestration decision tree + the inventory count
// as initial context, so route auto-selection does not depend on the model's memory alone.
// Fail-silent: never blocks startup (always exit 0).
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
  } catch (_) { /* index missing — carry on without the count */ }

  const ctx = [
    '## Task Intake (auto-orchestration — rules/task-intake.md)',
    'Before acting, classify the task into 1 of the 4 routes, WITHOUT the user asking:',
    '- A direct: 0 files / pure question → answer inline.',
    '- B 1 skill: 1 domain, ≤2 files, reversible, match ≥60% → Read .claude/skills/<x>.md, execute.',
    '- C 1 agent: specialist domain, isolable work (review/debug/research/deploy) → Agent() with a brief.',
    '- D workflow: ≥2 independent parts OR ≥2 parallelizable files OR a complete feature OR cross-stack → /goal → master-orchestrator in a loop. System default: when in doubt, delegate.',
    'Plan: route D, irreversible action, ≥3 files or a new feature → visible plan before the 1st Write/Agent (rules/task-intake.md).',
    'Irreversible (auth/payments/migrations/deletes/deploy/push) → 1 line of confirmation first.',
    'Agents use skills: the brief of each agent carries Step 0 Read of the relevant skills.',
    (skillCount || agentCount) ? `Inventory: ~${skillCount} skills · ~${agentCount} agents (map in memory/SKILL_INDEX.json).` : 'Inventory in memory/SKILL_INDEX.json.',
  ].join('\n');

  // Brain recall — active decisions + recent learnings of the current project (slug = git of the cwd).
  // Spawns joca-brain (which resolves the slug from the cwd); fail-silent, never blocks.
  let recall = '';
  try {
    const script = path.join(repoRoot, '.claude', 'scripts', 'joca-brain.mjs');
    if (fs.existsSync(script)) {
      recall = execSync(`node "${script}" recall --limit 4`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().trim();
    }
  } catch (_) { /* no brain/recall — carry on */ }

  // Skill loop — a nudge when there is accumulated feedback still to process (closes the /feedback-joca →
  // /upgrade-joca cycle without depending on the user remembering). Threshold 3 avoids spam with 1-2 files.
  let feedbackNudge = '';
  try {
    const fbDir = path.join(repoRoot, 'memory', 'feedback');
    const pending = fs.readdirSync(fbDir).filter((f) => f.endsWith('.md') && !f.startsWith('processed-')).length;
    if (pending >= 3) {
      feedbackNudge = `## Skill Loop\n${pending} feedback files accumulated in memory/feedback/ still to process — when there is slack, suggest the user run /upgrade-joca (or run /upgrade-joca --auto if they have already asked for it as a routine).`;
    }
  } catch (_) { /* no feedback folder — carry on */ }

  // Co-activity — project memory written in the last 45 min = another session/worker has been
  // (or is) in the same project. It has already cost: two sessions in parallel in the same project, one
  // reverting the other's edits, discovered only by the mtime of the memory.
  let coAct = '';
  try {
    const projDir = path.join(repoRoot, 'memory', 'projects');
    const limite = Date.now() - 45 * 60 * 1000;
    const recentes = fs.readdirSync(projDir)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => { try { return fs.statSync(path.join(projDir, f)).mtimeMs > limite; } catch (_) { return false; } })
      .slice(0, 5);
    if (recentes.length) {
      coAct = `## ⚠ Co-activity\nMemory written in the last 45 min: ${recentes.join(', ')} — another session/worker may be active in that project (or projects). Check before reverting edits you did not make, and avoid rewriting files it may be touching.`;
    }
  } catch (_) { /* no memory/projects — carry on */ }

  const finalCtx = [ctx, recall, coAct, feedbackNudge].filter(Boolean).join('\n\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: finalCtx },
  }));
} catch (_) { /* never block */ }
process.exit(0);

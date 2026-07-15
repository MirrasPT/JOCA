#!/usr/bin/env node
// UserPromptSubmit hook — nudge de task-intake a cada prompt. Não analisa o prompt
// (a classificação é do modelo); só garante que a doutrina das 4 vias está presente
// em cada turno, contra recall loss. Fail-silent, exit 0 sempre.
try {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: '[task-intake] Classifica a tarefa antes de responder: directa / skill / agente / workflow (rules/task-intake.md). Reversível → age; irreversível → confirma 1 linha.',
    },
  }));
} catch (_) { /* nunca bloquear */ }
process.exit(0);

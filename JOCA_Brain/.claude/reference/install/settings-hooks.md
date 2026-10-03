# /install — `settings.json` do projeto: bloco de hooks (on-demand)

Lido pelo `/install` na FASE EXECUCAO, passo 7, depois de substituir `<JOCA_ROOT>`. Forma esperada dos hooks e notas de ordem.
O `JOCA_Brain/.claude/settings.json` real é a fonte: este bloco mostra a forma e pode ter menos hooks do que ele.

```json
{
  "permissions": {
    "allow": [],
    "deny": []
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/check-freeze.js\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/check-tdd.js\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/guard-claudemd.js\"" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/check-careful.js\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/guard-git-add.js\"" }
        ]
      },
      {
        "matcher": "PowerShell",
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/guard-git-add.js\"" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/session-intake.js\"" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/prompt-triage.js\"" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/track-changes.js\" \"$TOOL_INPUT_FILE_PATH\"", "async": true },
          { "type": "command", "command": "bash \"<JOCA_ROOT>/JOCA_Brain/.claude/scripts/check-skill-paths.sh\" \"$TOOL_INPUT_FILE_PATH\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/skill-lint.js\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/auto-checkpoint.js\"", "async": true }
        ]
      },
      {
        "matcher": "Read|Skill|Agent|Task|Edit|Write",
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/registo-uso.js\"" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/stop-checkpoint.js\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/auto-test-dispatch.js\"" },
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/stop-continuar.js\"" }
        ]
      }
    ]
  }
}
```

Notas:
- **Ordem no array Stop importa:** `stop-checkpoint.js` → `auto-test-dispatch.js` → `stop-continuar.js`. O checkpoint corre ANTES do dispatch (este limpa a `.joca/test-queue.jsonl`); o `stop-continuar.js` corre **por último**, porque é o único que pode bloquear o fim do turno — e bloqueia **uma vez** por turno (guarda `stop_hook_active`; ver `rules/chaining.md`).
- Runtime `node` para todos os hooks excepto `check-skill-paths.sh` (bash, vive em `.claude/scripts/`).
- Hooks flag-file (`check-freeze`, `check-careful`, `check-tdd`) são no-op sem a flag `.joca/*.flag` — armados pelas skills `freeze`/`careful`/`tdd`, desarmados por `unfreeze`.
- `guard-claudemd.js` trava linhas gordas em `CLAUDE.md`; `guard-git-add.js` trava `git add -A`/`.` com agentes vivos e `git commit` sem `--only` com índice alheio; `auto-checkpoint.js` grava checkpoints `-auto`; `registo-uso.js` conta usos de skills/agentes em `.joca/uso-skills.jsonl` (gitignored).

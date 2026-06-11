# Hooks — pipeline de testes autónomos + skill routing

Wiring real (configurado em `.claude/settings.json`). Todos os hooks recebem o
payload como **JSON no stdin** — não há variáveis `$TOOL_INPUT_*`.

| Evento | Script | Função |
|---|---|---|
| SessionStart | `memory-inject.js` | Injecta `memory/curta.md` (snapshot de continuação) + avisos (sessão sem /save, feedback pendente); em `compact` re-injecta só a retoma |
| SessionEnd | `session-memory.js` | Arquiva o transcript completo (`transcript_path`) em `memory/diario/<ts>_<sess>.jsonl` + extracto legível `.md` para pesquisa |
| UserPromptSubmit | `skill-router.js` | Grep do prompt contra os triggers do `memory/SKILL_INDEX.json`; injecta `additionalContext` a apontar a skill relevante |
| PostToolUse (Write\|Edit) | `track-changes.js` | Lê `tool_input.file_path` do stdin, classifica domínio, appenda a `.joca/test-queue.jsonl` |
| PostToolUse (Write\|Edit) | `../scripts/check-skill-paths.sh --stdin` | Guard contra paths de skill legacy; violação → exit 2 + explicação no **stderr** |
| Stop | `auto-test-dispatch.js` | Lê a queue, escreve `.joca/last-session.json`, e emite `{"decision":"block","reason":"AUTO-TEST: …"}` para o modelo despachar os testers |

## Regras de exit codes

- `exit 0` + stdout → transcript apenas (o modelo NÃO vê), excepto JSON estruturado
- `exit 2` + stderr → o modelo vê o stderr (bloqueia a acção em PreToolUse/PostToolUse)
- Stop hook → só influencia o modelo via `{"decision":"block","reason":…}` no stdout

## Salvaguardas do Stop hook

- `stop_hook_active: true` no payload → exit 0 imediato (evita loop infinito)
- Sentinel `.joca/dispatched-<session_id>` → bloqueia no máximo 1× por sessão
- Queue só é limpa quando a recomendação é efectivamente emitida

## Testar manualmente

```bash
echo '{"tool_input":{"file_path":"app/Models/User.php"}}' | node .claude/hooks/track-changes.js
cat .joca/test-queue.jsonl   # deve ter 1 linha nova
echo '{"session_id":"test"}' | node .claude/hooks/auto-test-dispatch.js   # deve emitir decision:block
echo '{"prompt":"cria um recurso Filament para User"}' | node .claude/hooks/skill-router.js
```

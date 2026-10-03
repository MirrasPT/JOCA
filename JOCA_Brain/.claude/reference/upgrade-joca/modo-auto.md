# /upgrade-joca — modo `--auto` (headless)

Lido a partir de `.claude/commands/upgrade-joca.md` §Modo `--auto`, antes de correr sem gate humano. A lista do que NUNCA aplica sozinho fica no comando.

**Pode aplicar sozinho (allowlist):**
- `IMPROVE_SKILL` — melhorar skill existente (loop improver/evaluator, threshold 8.0/10 mantém-se)
- `FIX_TRIGGER` — corrigir triggers/description de skill que não disparou quando devia
- Regenerar `SKILL_INDEX.json` + bridges + marcar/arquivar feedback processado


**Regras extra do modo auto:**
- Sem feedback pendente (≥1 ficheiro) → termina imediatamente com "nada a processar" (não inventa melhorias)
- Máximo 5 melhorias aplicadas por run (as restantes ficam para o próximo ciclo, por ordem de severidade)
- As **Phases 4b e 4c são obrigatórias também aqui** — sem gate humano, são a única coisa que separa
  "aplicado" de "alegado". Item que falhe qualquer check é revertido e reportado como
  `failed -- verification`; o modo auto **nunca** aplica sem verificar, e a verificação não alarga o
  que ele pode tocar
- O campo `estado` (Phase 1.5) aplica-se na íntegra: só `PENDENTE` entra nos 5 do run. `INCERTO` vai
  para o log como proposta, nunca é aplicado sozinho
- Com backlog grande (Phase 1.6) escreve `processed: partial` + `upgrade_run`/`upgrade_covered` e
  **não arquiva** o ficheiro
- No fim, escreve um resumo em `memory/feedback/auto-upgrade-log.md` (append): data, itens aplicados, itens em proposta, itens falhados
- Termina SEMPRE com um resumo claro (o worker do JOCA_OS captura-o e o juiz classifica) — listar: aplicado / proposto / falhado / adiado

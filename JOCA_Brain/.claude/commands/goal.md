# /goal — Auto-Orquestração a partir de Linguagem Natural

Ponto de entrada de workflow multi-agente **sem PRD**. Recebe uma tarefa em linguagem natural,
sintetiza um plano mínimo in-memory, e dispara o `master-orchestrator` com um GOAL + loop até concluir.

Variante NL-driven do `/one-shot` (que se mantém PRD-driven). Use `/goal <descrição>`.

## Quando usar

- Tarefa que cruza ≥2 domínios, toca ≥3 ficheiros, ou é uma feature completa (via D do `rules/task-intake.md`).
- Não há (nem se quer criar) `PRD.md`/`TECH_SPEC.md`/`TASKS.md`.
- O Decision Filter classificou a tarefa como **workflow**.

Para tarefas mais pequenas, NÃO usar `/goal` — resolver pela via A/B/C (resposta / 1 skill / 1 agente).

## Fluxo

### 1. Carregar contexto (lazy)
```
Ler: CLAUDE.md (constraints + trigger map)
Ler: memory/SKILL_INDEX.json (índice de skills/agentes disponíveis)
Ler: rules/task-intake.md + rules/orchestration-patterns.md (doutrina)
```

### 2. Sintetizar plano in-memory
A partir da descrição NL, derivar:
- **GOAL** em 1-2 frases.
- **Critérios de aceitação** explícitos (como sabemos que está feito).
- **Work-streams candidatos** — mapear o GOAL aos triggers das skills/agentes reais do `SKILL_INDEX.json` (qualquer domínio, não só web). Independentes = paralelizáveis.

Não inventar nomes de skills/agentes — só os que constam do índice.

### 3. Gate de segurança
Detectar acções irreversíveis no GOAL (auth/payments/migrations/deletes/deploy/push/git destrutivo).
Se houver → **1 linha de confirmação** antes de disparar. Caso contrário, prosseguir.

### 4. Disparar
Invocar `Agent(subagent_type="master-orchestrator")` com:
- o GOAL + critérios de aceitação,
- o plano in-memory (work-streams),
- o brief canónico obrigatório (8 cláusulas — ver master-orchestrator.md / soul.md).

O orchestrator corre Phase 4.5 (Goal-Satisfaction Loop): compara resultado vs critérios, re-decompõe só a lacuna, re-dispatch. Cap `loop_max_iterations` (default 4); 3x sem progresso → para e reporta.

### 5. Reportar
Resumir o que foi feito vs critérios de aceitação. Listar o que ficou por concluir (se cap atingido) e auto-disparar `tester-*` conforme o pipeline de testes.

## Restrição arquitectural

Sub-agentes **não** fazem spawn de sub-agentes. A auto-orquestração vive no **main loop / neste command**, não num agente-que-chama-agentes. O `master-orchestrator` decompõe e despacha; o spawn dos workers é seu, a partir do main loop. Ver `rules/orchestration-patterns.md`.

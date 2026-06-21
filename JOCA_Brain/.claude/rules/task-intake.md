# Task Intake — Auto-Orquestração

Decision tree corrido ANTES do Decision Filter. Classifica QUALQUER tarefa recebida em 4 vias.
Carregado em todas as sessões. Determinístico por thresholds — "decidir sozinho" não é vibes.

## As 4 vias

| Via | Quando | Acção |
|---|---|---|
| A — Directa | 0 ficheiros · pergunta/decisão/conversa | Responder inline |
| B — 1 Skill | 1 domínio · 1-2 ficheiros · reversível · skill match ≥60% | Read `.claude/skills/<x>.md` → executar inline. Notify `[skill: <x>]` |
| C — 1 Agente | 1 domínio especialista · trabalho isolável (review/debug/research/deploy) · beneficia de contexto próprio | `Agent(subagent_type="<x>")` com brief obrigatório |
| D — Workflow | ≥2 domínios em paralelo · OU ≥3 ficheiros · OU feature completa · OU cross-stack | `/goal` → master-orchestrator com GOAL + loop até concluir |

## Thresholds

- Ficheiros: 0=A · 1-2=B · 1-3 isolado=C · ≥3 ou paralelizável=D
- Domínios: 0=A · 1=B · 1 especialista=C · ≥2 concorrentes=D
- Contexto isolado ajuda → C ou D
- Skill match ≥60% → preferir B sobre A
- `orchestration_threshold` e `loop_max_iterations` calibráveis em `soul.md`

## Segurança (não negociável)

- Reversível → age sem perguntar. Irreversível (auth/payments/migrations/deletes/deploy/push/git destrutivo) → 1 linha de confirmação, mesmo em D.
- Steward, não initiator: em loop, só continuar trabalho já no GOAL. Não inventar scope.
- Anti-loop: workflow tem máx N iterações (default 4); 3x "nada a fazer" → parar e reportar.

## Modelo agentes-usam-skills

Quem despacha um agente (via C/D) carrega no brief a instrução de **Read das skills relevantes** (Step 0).
O campo `skills:` no frontmatter de um agente NÃO carrega a skill — a garantia real é o Read no corpo.

## Ancoragem

Referenciado do `CLAUDE.md` Decision Filter (passo 0 e 2). Injectado a cada prompt pelo
`UserPromptSubmit` hook. Sobrevive ao recall loss por estar também nos hooks.
Padrões de orquestração detalhados em `rules/orchestration-patterns.md`.

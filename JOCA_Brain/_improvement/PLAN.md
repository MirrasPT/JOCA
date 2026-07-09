# PLAN — Optimizacao Global do JOCA_Brain

Arquitecto-chefe: integracao dos 8 repos auditados + 3 auditorias internas, ao servico dos 5 objectivos do utilizador e da visao FUTUROS.md.
Caveman-lite. Claude-first. Windows primario. Design co-criado, resto 100% AI.

> Ficheiros companheiros:
> - `AUTONOMY_DESIGN.md` — decision tree + agentes-usam-skills (detalhado)
> - `CANONICAL_CHANGES.md` — texto exacto a aplicar (CC-1 a CC-17)

---

## Sumario

O JOCA tem volume excelente (106 skills, 28 agentes) mas a autonomia e fragil: depende de uma
REGRA textual no CLAUDE.md que o modelo tem de se lembrar. O `master-orchestrator` e single-pass,
PRD-gated e web-dev-only. As 7 fases da FUTUROS.md tem zero scaffolding no Brain.

A intervencao central nao e mais conteudo — e MECANISMO. Adoptamos o padrao provado em ponytail /
addyosmani/agent-skills / understand-anything: **hooks deterministicos** (SessionStart +
UserPromptSubmit) que injectam o decision tree a cada turn, tirando a decisao da memoria do modelo.
Em cima disso, uma **rule task-intake** (4 vias: directa/skill/agente/workflow por thresholds), um
**/goal** que dispara workflow a partir de NL (sem PRD), e um `master-orchestrator` tornado
**goal-seeking em loop** e **domain-agnostic**. O contrato agentes-usam-skills passa a ser garantido
por **Step 0 Read() no corpo** de cada agente (nao pelo frontmatter decorativo). Adoptamos
**markitdown** (157k stars, MS) como motor de ingestao do /know — a peca em falta da Fase 5.
Propomos 8 agentes novos focados em autonomia + lacunas reais.

Resultado: tarefa NL → JOCA classifica sozinho → escala a workflow com GOAL → loop ate concluir,
sem o user pedir. Serve directamente objectivos #1, #2, #3, #4 e alinha com FUTUROS Fases 1/3/5/6/7.

---

## Repos → Adopcoes

| Repo (verificado acessivel) | O que adoptamos | Onde |
|---|---|---|
| **ponytail** (45k) | Mecanismo SessionStart + UserPromptSubmit hooks como motor de autonomia. Skill yagni (decision ladder 6 degraus). | CC-6/7/8 + skill yagni |
| **addyosmani/agent-skills** (64.6k) | Meta-skill via SessionStart hook; `orchestration-patterns` (subagentes NAO spawnam subagentes → auto-orquestracao vive no main loop/command); anatomia de skill (When NOT / Red Flags / Verification); source-driven + doubt-driven. | task-intake rule + /goal + create-skill template |
| **swc** (34k) | Skill-pasta + helper deterministico (`helper NAO decide/committa`); `pr-repair` agente one-shot com gates + anti-loop; `skills-lock.json` (lockfile de skills externas por SHA-256). | agente pr-repair + SKILL_LOCK (P2) |
| **understand-anything** (65k) | Decision-gate barato antes do fan-out; agentes escrevem para disco, nao para contexto (resolve cap 3-5 workers); hook de staleness imperativo; estrutura Karpathy-wiki + parse-knowledge-base.py para o /know. | master-orchestrator + knowledge-ingest + staleness hook (P2) |
| **markitdown** (157k, MS) | Motor de ingestao /know (PDF/Office/imagem/OCR/audio/YouTube → Markdown). MCP `convert_to_markdown(uri)` + lib Python. | CC-17 + agente knowledge-ingest |
| **taste-skill** (48.2k) | Anti-slop hard-rules (em-dash ban, serif/Inter discipline, AI-purple rule, beige+brass banido, anti-center-hero); 3 dials calibraveis; "Design Read" antes de gerar. | upgrade design-review + frontend skills |
| **system_prompts_leaks** (44k) | REFERENCIA (nao copiar — proprietarios/dual-use): Cowork Dispatch (router que nao executa), loop.md (steward-nao-initiator, 3x nada→para), modelo Agent/Skill/Workflow. | padroes recodificados em master-orchestrator + task-router + /goal |
| **Anthropic-Cybersecurity-Skills** (17.4k) | `validate-skill.py` (linter de frontmatter) → ligar a hook + /create-skill; 4-6 SKILL.md de web/API/agent-MCP security como referencia; progressive disclosure formalizado. | validate-skill script + security-review |

Nada do PRODUTO swc/markitdown em si (compilador Rust / lib) entra — so o tooling-de-agentes e a lib de ingestao.

---

## Gaps (das 3 auditorias, sintetizados)

**Autonomia / orquestracao (P0)**
1. Decision Filter passo 2 so pergunta "Skill exists?" — nunca skill-vs-agente-vs-workflow.
2. Sem entrada de auto-orquestracao para NL: `/one-shot` exige PRD; `master-orchestrator` le PRD primeiro.
3. `master-orchestrator` single-pass (sem GOAL state, sem re-dispatch loop, sem cap de iteracoes).
4. `master-orchestrator` hardcoded a web-dev — nao decompoe automacoes/know/research.
5. Sem hooks SessionStart/UserPromptSubmit → routing depende do recall do modelo a meio do contexto.

**Agentes-usam-skills (P0/P1)**
6. `skills:` no frontmatter NAO carrega skill no Claude Code; ~half dos agentes nao faz Read() no corpo (master-orchestrator, self-improver incluidos). Objectivo #2 meio-partido.
7. Brief do orchestrator NAO injecta anti-fabricacao / verify-parser / file-scope (sub-agentes nao herdam soul.md).

**Cobertura FUTUROS (P1)**
8. Zero skills/agentes para Master, WhatsApp, Automacoes, Acoes, /know, Self-Learning trigger, Memoria 3-camadas.
9. Sem ingestao de conteudo (PDF/YouTube/Instagram) nem schema de KB.
10. Sem skill de email/calendario PESSOAL (as de email sao todas transaccionais/marketing).

**Especialistas em falta (P1/P2)**
11. WordPress (15 skills, 0 agente), Shopify (5, 0 agente), deploy (skills, 0 executor), a11y (audita, nao corrige), content/marketing (muitas skills, 0 agente de campanha).

**Higiene (P2)**
12. `python3` em varios agentes (stub Windows). `migrate.md` header `# /goal` errado. Skills orfas (availability, planning) fora da Trigger Map.

---

## Autonomia (resumo — detalhe em AUTONOMY_DESIGN.md)

**Decision tree (4 vias, deterministico por thresholds):**
- A Directa (0 ficheiros) · B 1 Skill (1 dom, 1-2 fich, skill≥60%) · C 1 Agente (dom especialista, isolavel) · D Workflow (≥2 dom paralelo OU ≥3 fich OU feature/cross-stack).
- Irreversivel → 1 confirmacao mesmo em D. Anti-loop: max 4 iter; 3x nada→para.

**3 camadas:**
1. Hooks (SessionStart injecta tree+digest do SKILL_INDEX; UserPromptSubmit nudge a cada turn) — deterministico.
2. Rule `task-intake.md` — o tree, ancorado no Decision Filter (passos 0 e 2) + soul.md.
3. `task-router` agente (classificador, devolve a via) + `/goal` (dispara workflow NL sem PRD) — o spawn vive no main loop (subagentes nao spawnam subagentes).

**Agentes-usam-skills:** Step 0 `Read()` no corpo de TODOS os agentes de dominio (nao o frontmatter). Brief canonico com 8 clausulas (incl. anti-fabricacao + Read skills + file-scope).

**Reutiliza:** master-orchestrator (generalizado + loop), /one-shot (fica PRD-driven), skill `loop` nativa, SKILL_INDEX.json, self-improver.

---

## Novos Agentes (8)

Priorizados por autonomia + lacunas reais. Cada um faz Step 0 Read() das suas skills.

| Agente | Prioridade | Proposito | Skills que le | FUTUROS |
|---|---|---|---|---|
| `task-router` | P0 | Classifica tarefa NL nas 4 vias (directa/skill/agente/workflow). Devolve a via — NAO spawna. | (le rules/task-intake.md) | #1 #3 / Fase 1 |
| `knowledge-ingest` | P1 | /know: URL/ficheiro → markitdown → resumo → tags → memory/knowledge/ (arvore tipo Obsidian). | knowledge-ingest, deep-research | Fase 5 |
| `automation-builder` | P1 | NL → automacao estruturada (quando+o-que+reportar) em automacoes.json; gere cron, condicionais, retries. | automations (nova) | Fase 3 |
| `personal-comms` | P1 | Ler/resumir/enviar email pessoal + calendario via CLI/MCP. Sem credencial → no-auth/TODO. | personal-comms (nova) | Fase 2/3 |
| `pr-repair` | P1 | Repara PR: le regras do repo, resolve conflitos, aplica reviews de bot, corrige CI, commit por fase, push 1x, anti-loop. | github, security (le) | (dev diario) |
| `deploy-executor` | P2 | Corre+verifica pipeline de deploy (cpanel/docker/ploi); health-check pos-deploy; PARA em gate irreversivel. | deploy-cpanel/docker/ploi | (dev diario) |
| `a11y-fixer` | P2 | Consome output de tester-ui-ux e APLICA fixes WCAG (vs so auditar). | design-review, frontend | #4 |
| `tech-debt-auditor` | P2 | Varre codebase, lista divida com upgrade-path e mede ganho (LOC/custo poupado). | laravel-refactor, karpathy-guidelines | #4 / Fase 6 |

Specs detalhados no objecto estruturado (`new_agents`).

---

## Mudancas Canonicas (texto exacto em CANONICAL_CHANGES.md)

| ID | Ficheiro | O que | P |
|---|---|---|---|
| CC-1 | CLAUDE.md | Decision Filter passo 2 → skill/agente/workflow | P0 |
| CC-2 | CLAUDE.md | Decision Filter passo 0 (task intake) | P0 |
| CC-3 | rules/task-intake.md | NOVO — decision tree | P0 |
| CC-4 | soul.md | Working Principles: auto-escala | P0 |
| CC-5 | soul.md | Calibration: orchestration_threshold + loop_max_iterations | P1 |
| CC-6 | settings.json | SessionStart + UserPromptSubmit hooks | P0 |
| CC-7 | hooks/session-intake.js | NOVO — injecta tree + digest SKILL_INDEX | P0 |
| CC-8 | hooks/prompt-triage.js | NOVO — nudge task-intake a cada prompt | P0 |
| CC-9 | master-orchestrator.md | GOAL + loop (Phase 4.5) + domain-agnostic + brief canonico | P0 |
| CC-10 | commands/goal.md | NOVO — /goal NL sem PRD | P0 |
| CC-11 | agentes varios | Step 0 Read() no corpo | P1 |
| CC-12 | agentes varios | python3 → python | P1 |
| CC-13 | CLAUDE.md | Trigger Map: novos agentes | P1 |
| CC-14 | CLAUDE.md | Pipelines + Commands: /goal, /know | P1 |
| CC-15 | migrate.md | header # /goal → # /migrate | P2 |
| CC-16 | skills | orfas/metadados + rebuild index | P2 |
| CC-17 | CLAUDE.md + MCP | markitdown-mcp registado | P1 |

> Aplicar SEQUENCIALMENTE (1 de cada vez) para evitar clobber. Verificar nomes de evento de
> hook e doc de subagentes contra o Claude Code instalado ANTES de aplicar CC-6 e CC-11.

---

## Roadmap

### P0 — Nucleo de autonomia (objectivos #1, #2, #3)
1. CC-15 (corrigir migrate header) — pre-req de /goal.
2. CC-3 task-intake.md + CC-1/CC-2 ancorar no Decision Filter + CC-4 soul.md.
3. CC-6/7/8 hooks (SessionStart + UserPromptSubmit) — verificar nomes de evento primeiro.
4. CC-9 master-orchestrator goal-seeking + domain-agnostic + brief canonico.
5. CC-10 /goal command.
6. `task-router` agente.
7. Smoke-test: tarefa NL multi-dominio → confirmar auto-escala para workflow + loop.

### P1 — Agentes-usam-skills + FUTUROS Fase 5 + especialistas
1. CC-11 Step 0 Read() em todos os agentes de dominio (verificar doc subagentes).
2. CC-12 python3 → python.
3. CC-5 calibration params.
4. CC-17 + agente `knowledge-ingest` + skill `knowledge-ingest` (markitdown).
5. Agentes `automation-builder` (+skill automations), `personal-comms` (+skill), `pr-repair`.
6. CC-13/14 Trigger Map + Pipelines + Commands.
7. `validate-skill.py` (de cybersec repo) → hook PostToolUse em .claude/skills/.

### P2 — Especialistas extra + Self-Learning + Memoria + higiene
1. Agentes `deploy-executor`, `a11y-fixer`, `tech-debt-auditor`.
2. Skill `yagni` (decision ladder ponytail) + upgrade anti-slop em design-review/frontend (taste).
3. Self-Learning trigger via Monitor (Fase 6) — verificar tools Cron*/Monitor disponiveis antes de prometer.
4. Scaffold memoria 3-camadas em memory/master/{curta.md, longa/, diario/} (Fase 7).
5. Staleness hook (understand-anything).
6. SKILL_LOCK.json + /install-skill (swc) para skills externas por hash.
7. CC-16 skills orfas + rebuild index.
8. create-skill template: When NOT / Red Flags / Verification (addyosmani).

---

## Notas de integridade

- NAO copiar prompts da Anthropic do system_prompts_leaks (proprietarios/dual-use) — so recodificar padroes em caveman-lite.
- NAO importar as 754 cybersec skills em bloco (poluiria o SKILL_INDEX e o matching) — so 4-6 selectivas + o validador.
- markitdown: validar output real contra 1 ficheiro por tipo antes de declarar pronto.
- Hooks/eventos: verificar nomes contra a doc do Claude Code instalado — nao assumir.
- Sub-agentes nao herdam soul.md nem spawnam subagentes — a auto-orquestracao vive no main loop / /goal.

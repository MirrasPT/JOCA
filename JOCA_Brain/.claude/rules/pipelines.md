# Pipelines — auto-runner de sequências nomeadas

Catálogo de pipelines que o JOCA **corre sozinho** (não só nomeia). Carregado em todas as sessões. Terso por design.

Adaptado do gstack (`autoplan` lê os SKILL.md filhos do disco e corre-os a fundo, auto-decidindo as perguntas intermédias e levantando só "taste"/irreversível no fim). É o mecanismo que torna o JOCA autónomo: **o user diz o objectivo, o JOCA conduz a sequência inteira**.

---

## O Auto-Runner (como uma pipeline corre)

Quando o task-intake classifica uma tarefa como **D (workflow)** OU a tarefa casa uma pipeline nomeada abaixo, o **main loop** (ou `/goal`/`master-orchestrator`) corre-a assim:

1. **Selecciona a pipeline** pelo objectivo (match de domínio/triggers).
2. **Para cada passo:** `Read()` a skill / despacha o agente do passo, executa **a fundo** (não superficial).
3. **Auto-decide** as escolhas intermédias **reversíveis** pelos princípios de decisão (soul.md autonomy 0.95) — não pára a perguntar.
4. **Gate:** num passo **irreversível** (deploy/push/migration/delete/payment/auth) → 1 linha de confirmação antes.
5. **Encadeia** para o passo seguinte via `chain:` (ver `rules/chaining.md`).
6. **Travão:** profundidade ≤ `loop_max_iterations` (default 4); 3x sem progresso → parar e reportar.
7. **Final gate:** decisões de "taste" / ambíguas acumuladas → levantar de uma vez no fim (como o `autoplan`), não a meio.

O runner é **steward, não initiator** (`orchestration-patterns.md`): só corre passos da pipeline declarada — não inventa scope.

---

## Princípios de auto-decisão (intermédias reversíveis)

Ao decidir sozinho uma escolha intermédia, por esta ordem:
1. **Decisão activa do Brain** (`joca-brain active`) — se já foi decidido, segue.
2. **Convenção do projecto** (CLAUDE.md do projecto, código existente, padrões à volta).
3. **Default da skill** do passo (a skill especializada manda).
4. **Menor superfície** (YAGNI — `skills/yagni.md`).
5. Sem base nenhuma + **irreversível** → gate. Sem base + reversível → escolhe e regista (`joca-brain decide --source agent`).

---

## Catálogo de pipelines

Cada pipeline = sequência de passos + gates. (⛔ = gate de confirmação irreversível.)

### Produto / planeamento
| Pipeline | Sequência |
|---|---|
| **autoplan** (NL → plano aprovado) | `plan` (interrogar+OODA) → `design-review` (plan-mode, dimensões 0-10) → revisão de eng (arquitectura/edge/test) → **final gate** (taste/scope) |
| **PRD → prod** (`/one-shot`) | `master-orchestrator` → agentes paralelos → `tester-*` (auto) → ⛔ deploy |

### Frontend
| Pipeline | Sequência |
|---|---|
| **UI nova** | `frontend` → `design-review` → (`a11y-fixer` se WCAG) → `tester-ui-ux` |
| **Frontend produção** | `design-system` → `frontend` → `react-composition`+`tailwind`+`react-patterns` → `anima` → `design-review`+`tester-ui-ux`+`tester-performance` |

### Backend
| Pipeline | Sequência |
|---|---|
| **Feature Laravel** | `plan` → `laravel-specialist` → `tester-code` → `tester-api` |
| **Admin Filament** | `laravel-specialist` → `filament`/`filament-builder` → `tester-code` |
| **API design** | `plan` → `rest-api` → `laravel-specialist` → `tester-api` |
| **Hardening backend** | `laravel-refactor` + `query-debugger` + `security-review` (paralelo) → `tech-debt-auditor` |
| **E-commerce full-stack** | `plan` → `saas-patterns` → `laravel-specialist` → `filament-builder` → `laravel-react` → `frontend`+`shadcn` → `payment-integration` ⛔ → hardening |

### Qualidade / operações
| Pipeline | Sequência |
|---|---|
| **Debug** | `log-debugger` (Iron Law: causa-raiz primeiro) → `query-debugger` (se SQL) |
| **QA loop** | `tester-*` test→fix→verify+commit atómico, repetir até verde |
| **Ship** | sync → `tester-code` → audit cobertura → ⛔ push → PR (`github`) |
| **Deploy** | `deploy-executor` (detecta alvo, corre `deploy-*`, health-check) ⛔ |
| **Reparar PR** | `pr-repair` (conflitos → bot reviews → CI → ⛔ push 1x no fim) |
| **Retro** | `/retro` → lê aprendizagens da janela → propõe acções |

### Conhecimento / automação
| Pipeline | Sequência |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → resumo → tags → `memory/knowledge/`) |
| **Automação** | `automation-builder` (NL → `automacoes.json` → cron) |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → aplicar |

---

## Ligações
- `rules/task-intake.md` — classifica a via; via D dispara o runner.
- `rules/chaining.md` — encadeamento passo-a-passo (`chain:`).
- `rules/orchestration-patterns.md` — fan-out, cap 3-5, agentes-escrevem-disco, steward.
- `.claude/agents/master-orchestrator.md` — motor de fan-out do runner.
- `.claude/commands/autoplan.md`, `/goal`, `/one-shot` — entradas que correm pipelines.

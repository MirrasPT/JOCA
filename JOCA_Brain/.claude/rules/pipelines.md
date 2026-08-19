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

## Gates: estático ≠ runtime

`tsc`/`npm run build`/`php -l` verdes provam que **compila**, não que **funciona**. Dois exemplos
reais: um `<Check>` (lucide) usado em JSX sem import passou o build do Vite e só rebentou quando o
utilizador abriu o modal; e uma app inteira foi dada como feita com `tsc`+`build` verdes quando o
`next dev` nem sequer hidratava — nada interactivo, e nenhum gate estático o apanharia.

**Gate estático (mínimo, sempre):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`**.
O eslint não é opcional em projectos JS/TS: `react/jsx-no-undef` e `no-undef` são a única coisa que
apanha identificadores de componente indefinidos, que o Vite deixa passar.

**Gate de runtime (obrigatório, não recomendado)** — nenhuma fase que toque nestas categorias fecha
sem evidência ao vivo:

| Categoria | Evidência mínima |
|---|---|
| Navegação · header · overlay · modal | `document.elementFromPoint(cx,cy)` no centro de cada link/botão, em carga limpa (`goto` fresco). Auditar `href` **não é** testar o clique — este bug chegou ao utilizador em duas sessões seguidas |
| Mobile / responsivo | sangramento horizontal medido por `getBoundingClientRect().right` vs `innerWidth` por elemento de texto. `scrollWidth - clientWidth` dá **0 falso** com `overflow-x:clip\|hidden` num ancestral — escondeu um defeito real durante 5 auditorias |
| Auth · sessão | login completo end-to-end, não só o 200 da página de login (uma BD com 0 users devolve `/admin/login → 200` na mesma) |
| Playback · media · streaming | reproduzir e observar; o ciclo de vida de streams não se prova a compilar |
| Deploy | dependências derivadas do **HTML publicado**, não da lista do que foi enviado (ver pipeline Deploy) |

**Diagnóstico é um passo com gate próprio:** um passo que afirma "X está partido" só produz output
**depois de ler o código de X**, com citação de ficheiro:linha por afirmação. Comparar nomes e
tamanhos de ficheiros não é ler. Um `WORKFLOW.md` commitado antes da leitura trouxe 2 de 3
"regressões" mal diagnosticadas (o failover existia e funcionava; o leak tinha sweeper por TTL) e
mandou o trabalho seguinte para o sítio errado.

**Resolver conflitos é código, não texto:** depois de qualquer merge/porte/`git apply --3way`,
**correr o artefacto**. Um `build-skill-index.py` saiu de um 3-way sem marcadores e sintacticamente
plausível, e rebentava à primeira execução (`match` fora de escopo, constantes perdidas porque hunks
vizinhos foram resolvidos para lados diferentes). Foram precisas 3 execuções para o pôr de pé.

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
| **Design (variantes → produção)** | `design-shotgun` (N variantes paralelas) → `design-review` (escolher) → `design-html` (mockup → HTML) → `frontend` (React, se interactivo) |
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
| **Ship** (`/ship`) | sync base → testes → review diff (`tester-code`) → version/CHANGELOG → ⛔ push → PR (`github`) |
| **Segurança CSO** (`cso`) | secrets → deps (`dependency-auditor`) → OWASP/STRIDE (`security-review`+`tester-security`) → gate de confiança |
| **Deploy** | `deploy-executor` (detecta alvo, corre `deploy-*`, health-check **derivado do HTML publicado**, purga CF se houve adições) ⛔ |
| **Reparar PR** | `pr-repair` (conflitos → bot reviews → CI → ⛔ push 1x no fim) |
| **Retro** | `/retro` → lê aprendizagens da janela → propõe acções |

### Arranque de produto
| Pipeline | Sequência |
|---|---|
| **Produto novo (0 → producao)** | `/start` (entrevista + PRD + stack + direccao de design) → `executar-projeto`: E1 fundacao ⛔ push → E2 design (via Claude Design c/ conversao, OU directo: `design-system`→`design-shotgun` se frontend→`preparar-design`/`validar-design` por ecra) → E3 ponto de situacao ⏸ → E4 `planear-ondas` → loop por onda (implementar c/ agentes de dominio → `escrever-testes` **sessao separada** → `tester-code` → gate runtime → portao) → `security-review` → ⛔ deploy |
| **Ecrã novo em projecto existente** | `preparar-design` (Artifact) → `validar-design` → `novo-issue` se houver componentes novos → implementar → `escrever-testes` |
| **Backlog → plano** | `novo-issue` (×N) → `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |

⚠ **O `escrever-testes` corre em sessão separada da que implementou** — testes escritos a seguir ao
código verificam o código, não o requisito: passam sempre e não provam nada. Se a mesma sessão fizer
as duas coisas, a rede de segurança é uma ilusão e o CI verde confirma-a.

### Conhecimento / automação
| Pipeline | Sequência |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → resumo → tags → `memory/knowledge/`) |
| **Research de mercado/recência** | `/last30days <tópico>` (sinal social pontuado por engagement, plugin externo) + `deep-research` (profundidade+citações) → fundir → `competitor-profiling`/`content-strategy`/`launch-strategy` |
| **Automação** | `automation-builder` (NL → `automacoes.json` → cron) |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → aplicar |

---

## Ligações
- `rules/task-intake.md` — classifica a via; via D dispara o runner.
- `rules/chaining.md` — encadeamento passo-a-passo (`chain:`).
- `rules/orchestration-patterns.md` — fan-out, cap 3-5, agentes-escrevem-disco, steward.
- `.claude/agents/master-orchestrator.md` — motor de fan-out do runner.
- `.claude/commands/autoplan.md`, `/goal`, `/one-shot` — entradas que correm pipelines.

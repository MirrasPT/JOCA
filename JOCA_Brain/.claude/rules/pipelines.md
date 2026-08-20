# Pipelines — auto-runner de sequências nomeadas

Catálogo de pipelines que o JOCA **corre sozinho** (não só nomeia). Carregado em todas as sessões.
Terso por design. **O user diz o objectivo, o JOCA conduz a sequência inteira.**

---

## O Auto-Runner (como uma pipeline corre)

Quando o task-intake classifica uma tarefa como **D (workflow)** OU a tarefa casa uma pipeline nomeada abaixo, o **main loop** (ou `/goal`/`master-orchestrator`) corre-a assim:

1. **Selecciona** a pipeline pelo objectivo (match de domínio/triggers).
2. **Cada passo a fundo:** `Read()` a skill / despacha o agente — nunca superficial.
3. **Auto-decide** as intermédias **reversíveis** (soul.md autonomy 0.95); irreversível (deploy/push/migration/delete/payment/auth) → **gate** de 1 linha antes.
4. **Encadeia** via `chain:` (`rules/chaining.md`). Travão: profundidade ≤ `loop_max_iterations` (4); 3x sem progresso → parar e reportar.
5. **Final gate:** decisões de "taste"/ambíguas acumulam-se e levantam-se de uma vez no fim, não a meio.

O runner é **steward, não initiator** (`orchestration-patterns.md`): só corre passos da pipeline declarada — não inventa scope.

---

## Doutrina de projecto — vale SEMPRE, com ou sem `/start`

Modo por omissão de **qualquer** projecto (novo, herdado, a meio); o `/start` instala-a, a ausência
dele não a dispensa. Unidade = **issue** · gate = **GitHub Actions** · estado = **`PROGRESSO.md`** ·
porquês = **`docs/DECISIONS.md`**.

| Momento | Acção |
|---|---|
| 1ª sessão sem `PROGRESSO.md` | levantamento do disco → criar `PROGRESSO.md` com o estado **observado** (formato: `.claude/reference/start/progresso-formato.md`). Uma pergunta só: "o que fazemos a seguir?" — a entrevista completa é o `/start` |
| Trabalho novo (ideia, bug, ecrã) | `novo-issue` **antes** de código. Sem "Ficheiros prováveis" o issue não está pronto — é o que decide o paralelismo |
| Ecrã/UI que ainda não existe | `preparar-design` → `validar-design` (porteiro) → implementar |
| ≥3 issues abertos sem plano | `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |
| ≥2 issues a implementar | loop de onda: implementar (paralelo só com ficheiros disjuntos) → `escrever-testes` **noutra sessão** → `tester-code` → PR `Closes #N` → varredura transversal → gate de runtime → portão humano |
| Decisão técnica (stack, schema, fora-da-casa) | 1 entrada em `docs/DECISIONS.md` — decisão sem registo repete-se |
| Repo sem `.github/workflows/` | criar o CI (`github`) antes de fechar a onda seguinte |
| Fecho · fim de sessão | `/ship` → PR (o issue fecha por `Closes #N`); `PROGRESSO.md` actualizado e commitado |

⚠ **Não inventar documentos** (`docs/PRD.md` só a pedido ou pelo `/start`). O **arranque** (entrevista,
página de direcções, scaffold E1, ponto E3) não se globaliza — num projecto a meio o que já existe
adopta-se, não se recria. CI verde não substitui o gate de runtime. Detalhe e porquês:
`.claude/reference/doutrina-projecto.md`.

## Gates: estático ≠ runtime

`tsc`/`npm run build`/`php -l` verdes provam que **compila**, não que **funciona**: uma app inteira
foi dada como feita com os dois verdes quando o `next dev` nem sequer hidratava.

**Quem escreve o código não assina o gate.** Verificador ≠ produtor — se o produtor foi o main loop,
a verificação delega-se. Ledger em `.joca/loop.json`, imposto pelo `stop-continuar.js`.

**Gate estático (mínimo, sempre):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`** — o
eslint não é opcional em JS/TS: é o único que apanha componente indefinido em JSX (`jsx-no-undef`).

**Gate de runtime (obrigatório)** — evidência ao vivo por categoria: navegação/overlay/modal
(`document.elementFromPoint` no centro, em carga limpa — auditar `href` não é testar o clique) ·
mobile (`getBoundingClientRect().right` vs `innerWidth`; `scrollWidth-clientWidth` dá **0 falso** com
`overflow-x:clip|hidden`) · auth (login end-to-end, não o 200 da página de login) · media (reproduzir
e observar) · deploy (dependências derivadas do **HTML publicado**). Casos e detalhe:
`.claude/reference/gates-runtime.md`.

**Não reescrever o gate por projecto:** `node .claude/scripts/gate-runtime.mjs --base <url>
[--rotas /,/precos] [--clicar "<seletor>"]` mede contraste sobre o pixel pintado,
`elementFromPoint`, sangramento com filtro de scrollers, nome acessível, erros de consola e
HTTP >=400. Sem `--clicar` mede só o **repouso** — overlays e modais exigem accionar o gatilho.

**Diagnóstico é passo com gate próprio:** afirmar "X está partido" só depois de **ler o código de X**,
com ficheiro:linha por afirmação. Comparar nomes e tamanhos de ficheiros não é ler.

**Resolver conflitos é código, não texto:** depois de merge/porte/`git apply --3way`, **correr o
artefacto** — um 3-way sem marcadores já deu ficheiro plausível que rebentava à 1ª execução.


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

⚠ **Em qualquer projecto** (ver §Doutrina): `escrever-testes` corre em sessão separada da que
implementou — testes escritos a seguir ao código verificam o código, não o requisito.

### Conhecimento
| Pipeline | Sequência |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → resumo → tags → `memory/knowledge/`) |
| **Research de mercado/recência** | `/last30days <tópico>` (sinal social pontuado por engagement, plugin externo) + `deep-research` (profundidade+citações) → fundir → `competitor-profiling`/`content-strategy`/`launch-strategy` |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → aplicar |

---

## Ligações
- `rules/task-intake.md` — classifica a via; via D dispara o runner.
- `rules/chaining.md` — encadeamento passo-a-passo (`chain:`).
- `rules/orchestration-patterns.md` — fan-out, cap 3-5, agentes-escrevem-disco, steward.
- `.claude/agents/master-orchestrator.md` — motor de fan-out do runner.
- `.claude/commands/autoplan.md`, `/goal`, `/one-shot` — entradas que correm pipelines.

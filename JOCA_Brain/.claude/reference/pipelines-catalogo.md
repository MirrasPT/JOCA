# Catálogo de pipelines

Saído de `rules/pipelines.md` (corte de tokens, 2026-09-23). O auto-runner, a doutrina de projecto, os gates e os princípios de auto-decisão continuam em `rules/pipelines.md` (auto-carregado); aqui fica só a tabela de sequências, lida quando a tarefa casa uma pipeline.

## Catálogo de pipelines

Cada pipeline = sequência de passos + gates. (⛔ = gate de confirmação irreversível · ⏸ = aprovação do dono antes de avançar.)

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
| **Admin Filament** | `laravel-specialist` → `filament`/`filament-agent` → `tester-code` |
| **API design** | `plan` → `rest-api` → `laravel-specialist` → `tester-api` |
| **Hardening backend** | `laravel-refactor` + `query-debugger` + `security-review` (paralelo) → `tech-debt-auditor` |
| **E-commerce full-stack** | `plan` → `saas-patterns` → `laravel-specialist` → `filament-agent` → `laravel-react` → `frontend`+`shadcn` → `payment-integration` ⛔ → hardening |

### Qualidade / operações
| Pipeline | Sequência |
|---|---|
| **Debug** | `log-debugger` (Iron Law: causa-raiz primeiro) → `query-debugger` (se SQL) |
| **QA loop** | `tester-*` test→fix→verify+commit atómico, repetir até verde |
| **Ship** (`/ship`) | sync base → testes → review diff (`tester-code`) → version/CHANGELOG → ⛔ push → PR (`github`) |
| **Segurança CSO** (`/seguranca`) | `.claude/commands/seguranca.md`: F0 âmbito (testes ativos/produção ⛔) → F1 recon + STRIDE + CLIs (instalação ⛔) → F2 frentes em paralelo (código `security-review` · segredos gitleaks · deps osv-scanner/`dependency-auditor` · API `tester-api`/`tester-ratelimit` · RGPD `gdpr-compliance`) → F3 revisor adversarial com reprodução → F4 relatório + issue por confirmado (repo de terceiro/público ⛔) |
| **Deploy** | `deploy-executor` (detecta alvo, corre `deploy-*`, health-check **derivado do HTML publicado**, purga CF se houve adições; âmbito = o último confirmado, ambíguo → perguntar) ⛔ |
| **Auditoria → correcção** | `analisar-plataforma` → issue por achado → correcção em fan-out (ficheiros disjuntos) → varredura transversal (não-produtor) → gate de runtime → ⛔ deploy |
| **Reparar PR** | `pr-repair` (conflitos → bot reviews → CI → ⛔ push 1x no fim) |
| **Retro** | `/retro` → lê aprendizagens da janela → propõe acções |

### Marketing
| Pipeline | Sequência |
|---|---|
| **Marketing de marca** (`/marketeer <marca>`) | F1 análise (`mkt-conectores`∥`mkt-marca`∥`mkt-mercado`∥`mkt-auditoria` → `mkt-relatorio`) → F2 `mkt-estrategia` → (`mkt-copy`∥`mkt-medicao`) → `mkt-psicologia` → `mkt-revisor-agent` ⛔ proposta → F3 `mkt-criativos` ⛔ artes → ⛔ gate de medição → F4 `mkt-*` por plataforma (tudo em pausa) ⛔ → `/marketeer-review` → ciclo novo. Detalhe: `.claude/marketeer/CONTRATO.md` |

### Arranque de produto
| Pipeline | Sequência |
|---|---|
| **Produto novo (0 → produção)** | `/start` como **router**: 0b deduz o tipo do disco → pergunta 1.0 «Tipo de trabalho» (multiSelect, valor deduzido primeiro) → Aplicação → `executar-projeto` · Website → **Website** · Identidade/branding → **Identidade/branding** · Marketing → `/marketeer` · mais de um → **Projeto multi-tipo**; Fase 6 grava `PROGRESSO.md ## Workflows` e pergunta ⏸ «Avanço para o próximo workflow: <nome>?». Ramo Aplicação: entrevista + PRD + stack + direcção de design → `executar-projeto`: E1 fundação ⛔ push → E2 design (via Claude Design c/ conversão, OU directo: `design-system`→`design-shotgun` se frontend→`preparar-design`/`validar-design` por ecrã) → E3 ponto de situação ⏸ → E4 `planear-ondas` → loop por onda (implementar c/ agentes de domínio → `escrever-testes` **sessão separada** → `tester-code` → gate runtime → portão) → `security-review` → ⛔ deploy |
| **Website** (institucional, landing, portefólio; sem login/loja/BD — com isso é Aplicação; Next.js 16) | W1 estrutura e copy: `copywriting` → `stop-slop` → `pt-pt-translator`; `seo`; `landing-page` se página única → W2 design: `brand-guidelines` + `design-system` (tokens) **só se não houver branding** (há → mede do `docs/DESIGN.md`); `design-shotgun` → `design-review` (verificador); handoff Claude Design ⏸ variante → W3 fundação: `frontend` + `tailwind` (preset Next.js 16 do `/start`); `github` (CI); `novo-issue` (1 por página) ⛔ `gh repo create` → W4 páginas: `design-html` → `frontend` (`frontend-agent` em paralelo, 1 por página); `anima` opcional; `img-gen`/`foto-produto`; `icon-design` → W5 qualidade (verificador ≠ produtor): `design-review` + `tester-ui-ux` (→ `a11y-fixer`); `seo` técnico (+ `seo-local`); `analytics-tracking` (`generate_lead` + formulário); gate de runtime → W6 ponto de situação: `site-capture` do preview ⏸ dono → W7 publicação: `deploy-executor` ⛔ deploy → `auditoria-site-live` → `PROGRESSO.md` |
| **Identidade/branding** (logótipo, marca, manual, aplicações) | B1 posicionamento: `brand-positioning`; `competitor-profiling` → B2 nome **só se faltar**: `brand-guidelines` (secção de naming) ⏸ nome → `docs/DECISIONS.md` → B3 logótipo — **gate de pergunta caso a caso**: existe em raster → `raster-para-vector` · novo → conceitos `img-gen` (exploração) + vetor `icon-design` · ou ficheiro do designer ⏸ logótipo → B4 sistema visual: direções de design em HTML local (modelo do `/start`) → `brand-guidelines` → `design-system` (tokens; família de marcas → modo multimarca; componentes só se houver site/app) ⏸ direção → B5 aplicações: `icon-design`; `graphic-design` (cartão 85×55, papel de carta, flyer); `slides` → `design-review` (verificador) ⏸ → B6 manual de normas: `graphic-design` (brandbook HTML) → `html-to-pdf` ⏸ → B7 entrega: pacote `assets/brand/` (SVG/PNG, tokens, licenças) → `PROGRESSO.md` ⛔ envio à gráfica |
| **Projeto multi-tipo** (vários tipos na 1.0) | ordem: **Identidade/branding** → **Website** e/ou Aplicação (`executar-projeto`; consomem os tokens do B4, não os recriam) → Marketing (`/marketeer`; começa com `W7 feito` se houver Website, senão com `E4 feito` da Aplicação: site e lead medidos). Passagem entre workflows = ⏸ 1 gate Sim/Não «Avanço para o próximo workflow: <nome>?»; dentro de cada um, `chain:` automático. Estado entre sessões em `PROGRESSO.md ## Workflows`; retoma no 1.º por fazer com «Começa quando» cumprido. Redes sociais vão sempre pelo `/marketeer` |
| **Ecrã novo em projecto existente** | `preparar-design` (Artifact) → `validar-design` → `novo-issue` se houver componentes novos → implementar → `escrever-testes` |
| **Produto físico novo** (peça impressa · objecto) | recon da família existente → **gate de viabilidade física MEDIDO** (estabilidade/tombo, parede mínima, formato, orientação de impressão) antes do fan-out de desenho → `blender` → gate «Fabrico» (`gates-runtime.md`) → 1.ª falha com detalhe abaixo do bico: teste da zona mais fina a 3 escalas numa chapa, antes de mexer em definições (`impressao-3d.md` §Gate de runtime) |
| **Backlog → plano** | `novo-issue` (×N) → `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |

⚠ **`escrever-testes` corre em sessão separada da que implementou** — porquê: `reference/doutrina-projecto.md`.

### Conhecimento / automação
| Pipeline | Sequência |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → resumo → tags → `memory/knowledge/`) |
| **Research de mercado/recência** | `/last30days <tópico>` (sinal social pontuado por engagement, plugin externo) + `deep-research` (profundidade+citações) → fundir → `competitor-profiling`/`content-strategy`/`launch-strategy` |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → aplicar |

# Mapa passo → skills/agentes (executar-projeto · Website · Identidade)

Referencia viva: em caso de duvida, `memory/SKILL_INDEX.json` manda (e regenerado do disco).
Skills leem-se com `Read()` antes do trabalho do dominio; agentes despacham-se com brief + Step 0.

## E1 — Fundacao
| Trabalho | Skill (inline) | Agente (fan-out) |
|---|---|---|
| Scaffold Laravel | `laravel-specialist` | `laravel-specialist-agent` |
| Scaffold Next.js | `frontend` · `tailwind` | `frontend-agent` |
| Testes | `escrever-testes` | — |
| CI / repo / labels | `github` | — |
| API (se headless) | `rest-api` | `rest-api-agent` |

## E2 — Design
| Trabalho | Skill | Agente |
|---|---|---|
| Design system (tokens e componentes) | `design-system` | `design-system-agent` |
| Identidade | `brand-guidelines` | — |
| Variantes (frontend publico) | `design-shotgun` | `design-shotgun-agent` |
| Escolher/critica | `design-review` | — |
| Mockup → codigo limpo | `design-html` | `design-html-agent` |
| Ecra a ecra | `preparar-design` → `validar-design` | — |
| Auditoria do sistema | — | `design-system-audit` |
| Copy dos ecras | `copywriting` | `copywriting-agent` |

## E4 — Desenvolvimento
| Trabalho | Skill | Agente |
|---|---|---|
| Planear | `novo-issue` · `planear-ondas` | `task-router` (classificar) |
| Backend | `laravel-specialist` · `mysql` · `caching` · `queues` | `laravel-specialist-agent` |
| Admin | `filament` | `filament-agent` |
| Frontend | `frontend` · `react-patterns` · `tailwind` | `frontend-agent` |
| Auth | `auth` | `auth-agent` |
| Pagamentos ⛔ | `portugal-payments` | `payment-integration` |
| Uploads | `file-storage` | `file-storage-agent` |
| Emails | `transactional-email` | `transactional-email-agent` |
| Testes do issue | `escrever-testes` (sessao/agente separado) | — |
| Review | — | `tester-code` · `codex-review` |
| API | — | `tester-api` |
| UI/a11y | — | `tester-ui-ux` → `a11y-fixer` |
| Performance | — | `tester-performance` |
| Seguranca (pre-producao) | `security` | `security-review` · `tester-security` |
| SEO (se site publico) | `seo` | `seo-analyst` |
| Debug | — | `log-debugger` · `query-debugger` |
| Deploy ⛔ | `deploy-cpanel` · `deploy-ploi` · `deploy-docker` | `deploy-executor` |

## W — Website (pipeline de catálogo «Website», Next.js 16)
Estado em `PROGRESSO.md ## Workflows`; o que recebe do branding → `workflows-encadeamento.md`.
| Passo | Skill | Agente |
|---|---|---|
| W1 Estrutura e copy | `copywriting` → `stop-slop` → `pt-pt-translator` · `seo` · `landing-page` (página única) | `copywriting-agent` · `seo-agent` |
| W2 Design ⏸ | `brand-guidelines` · `design-system` (só sem branding) · `design-shotgun` → `design-review` (verif.) | `design-shotgun-agent` |
| W3 Fundação ⛔ (repo) | `frontend` · `tailwind` · `github` (CI) · `novo-issue` (1/página) | `frontend-agent` |
| W4 Páginas | `design-html` → `frontend` · `anima` (opc.) · `img-gen` · `foto-produto` · `icon-design` | `design-html-agent` · `frontend-agent` (paralelo) |
| W5 Qualidade | `design-review` · `seo` · `seo-local` · `analytics-tracking` | `tester-ui-ux` → `a11y-fixer` · `seo-analyst` |
| W6 Situação ⏸ (dono) | `site-capture` | — |
| W7 Publicação ⛔ | `deploy-cpanel` · `deploy-vps` · `deploy-docker` · `auditoria-site-live` | `deploy-executor` |

## B — Identidade/branding (pipeline de catálogo «Identidade/branding»)
| Passo | Skill | Agente |
|---|---|---|
| B1 Posicionamento | `brand-positioning` · `competitor-profiling` | — |
| B2 Nome ⏸ (só se faltar) | `brand-guidelines` (secção de naming, que ela carrega) | — |
| B3 Logótipo ⏸ (caso a caso) | raster existente → `raster-para-vector` · novo → `img-gen` (conceitos) + `icon-design` (vetor, caminho B) · ou ficheiro do designer | `img-gen-openai` · `img-gen-google` |
| B4 Sistema visual ⏸ | `brand-guidelines` → `design-system` (tokens; família de marcas e componentes dentro dela) | `design-system-agent` |
| B5 Aplicações | `icon-design` · `graphic-design` (cartão, papel de carta, flyer) · `slides` → `design-review` (verif.) | `graphic-design-agent` · `slides-agent` |
| B6 Manual de normas ⏸ | `graphic-design` + `html-to-pdf` (documento longo) | — |
| B7 Entrega ⛔ (envio à gráfica) | sem skill própria: pacote `brand/` (SVG/PNG, tokens, licenças) | — |

## Orquestracao
- Fan-out: playbook `master-orchestrator` ADOPTADO pelo main loop (agentes nao fazem spawn).
- Cap 3-5 concorrentes · briefs com Step 0 (Read das skills) · resultados em disco, nao no contexto.
- Loop supervisionado por fases ja existe: `/build-plan`. Autonomo total: `/one-shot`.

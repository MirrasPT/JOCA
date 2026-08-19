# Mapa passo → skills/agentes (executar-projeto)

Referencia viva: em caso de duvida, `memory/SKILL_INDEX.json` manda (e regenerado do disco).
Skills leem-se com `Read()` antes do trabalho do dominio; agentes despacham-se com brief + Step 0.

## E1 — Fundacao
| Trabalho | Skill (inline) | Agente (fan-out) |
|---|---|---|
| Scaffold Laravel | `laravel-specialist` | `laravel-specialist-agent` |
| Scaffold Next.js | `frontend` · `tailwind` | `frontend-agent` |
| Testes | `test-master` | — |
| CI / repo / labels | `github` | — |
| API (se headless) | `rest-api` | `rest-api-agent` |

## E2 — Design
| Trabalho | Skill | Agente |
|---|---|---|
| Design system (router) | `design-system` | `design-system-agent` |
| Identidade | `brand-guidelines` | — |
| Tokens | `design-tokens` | `design-tokens-agent` |
| Componentes | `component-system` | `component-system-agent` |
| Variantes (frontend publico) | `design-shotgun` | `design-shotgun-agent` |
| Escolher/critica | `design-review` | — |
| Mockup → codigo limpo | `design-html` | `design-html-agent` |
| Ecra a ecra | `preparar-design` → `validar-design` | — |
| Auditoria do sistema | — | `design-system-audit` |
| Copy dos ecras | `copywriting` | `copywriting-agent` |

## E4 — Desenvolvimento
| Trabalho | Skill | Agente |
|---|---|---|
| Planear | `planear-ondas` · `task-breakdown` | `task-router` (classificar) |
| Backend | `laravel-specialist` · `mysql` · `caching` · `queues` | `laravel-specialist-agent` |
| Admin | `filament` | `filament-builder` |
| Frontend | `frontend` · `react-patterns` · `tailwind` | `frontend-agent` |
| Auth | `auth` | `auth-agent` |
| Pagamentos ⛔ | `portugal-payments` | `payment-integration` |
| Uploads | `file-storage` | `file-storage-agent` |
| Emails | `transactional-email` · `react-email` | — |
| Testes do issue | `escrever-testes` (sessao/agente separado) | — |
| Review | — | `tester-code` · `codex-review` |
| API | — | `tester-api` |
| UI/a11y | — | `tester-ui-ux` → `a11y-fixer` |
| Performance | — | `tester-performance` |
| Seguranca (pre-producao) | `security` | `security-review` · `tester-security` |
| SEO (se site publico) | `seo` | `seo-analyst` |
| Debug | — | `log-debugger` · `query-debugger` |
| Deploy ⛔ | `deploy-cpanel` · `deploy-ploi` · `deploy-docker` | `deploy-executor` |

## Orquestracao
- Fan-out: playbook `master-orchestrator` ADOPTADO pelo main loop (agentes nao fazem spawn).
- Cap 3-5 concorrentes · briefs com Step 0 (Read das skills) · resultados em disco, nao no contexto.
- Loop supervisionado por fases ja existe: `/build-plan`. Autonomo total: `/one-shot`.

# Step → skills/agents map (execute-project)

Living reference: when in doubt, `memory/SKILL_INDEX.json` rules (it is regenerated from disk).
Skills are read with `Read()` before the domain work; agents are dispatched with a brief + Step 0.

## E1 — Foundation
| Work | Skill (inline) | Agent (fan-out) |
|---|---|---|
| Laravel scaffold | `laravel-specialist` | `laravel-specialist-agent` |
| Next.js scaffold | `frontend` · `tailwind` | `frontend-agent` |
| Tests | `test-master` | — |
| CI / repo / labels | `github` | — |
| API (if headless) | `rest-api` | `rest-api-agent` |

## E2 — Design
| Work | Skill | Agent |
|---|---|---|
| Design system (router) | `design-system` | `design-system-agent` |
| Identity | `brand-guidelines` | — |
| Tokens | `design-tokens` | `design-tokens-agent` |
| Components | `component-system` | `component-system-agent` |
| Variants (public frontend) | `design-shotgun` | `design-shotgun-agent` |
| Choosing/critique | `design-review` | — |
| Mockup → clean code | `design-html` | `design-html-agent` |
| Screen by screen | `prepare-design` → `validate-design` | — |
| System audit | — | `design-system-audit` |
| Screen copy | `copywriting` | `copywriting-agent` |

## E4 — Development
| Work | Skill | Agent |
|---|---|---|
| Planning | `plan-waves` · `task-breakdown` | `task-router` (classify) |
| Backend | `laravel-specialist` · `mysql` · `caching` · `queues` | `laravel-specialist-agent` |
| Admin | `filament` | `filament-builder` |
| Frontend | `frontend` · `react-patterns` · `tailwind` | `frontend-agent` |
| Auth | `auth` | `auth-agent` |
| Payments ⛔ | `portugal-payments` | `payment-integration` |
| Uploads | `file-storage` | `file-storage-agent` |
| Emails | `transactional-email` · `react-email` | — |
| Issue tests | `write-tests` (separate session/agent) | — |
| Review | — | `tester-code` · `codex-review` |
| API | — | `tester-api` |
| UI/a11y | — | `tester-ui-ux` → `a11y-fixer` |
| Performance | — | `tester-performance` |
| Security (pre-production) | `security` | `security-review` · `tester-security` |
| SEO (if public site) | `seo` | `seo-analyst` |
| Debug | — | `log-debugger` · `query-debugger` |
| Deploy ⛔ | `deploy-cpanel` · `deploy-ploi` · `deploy-docker` | `deploy-executor` |

## Orchestration
- Fan-out: the `master-orchestrator` playbook is ADOPTED by the main loop (agents do not spawn).
- Cap 3-5 concurrent · briefs with Step 0 (Read of the skills) · results on disk, not in the context.
- A phased supervised loop already exists: `/build-plan`. Fully autonomous: `/one-shot`.

# Pipelines — full catalog

Moved from `.claude/rules/pipelines.md` (auto-loaded) to cut per-message tokens; the rule keeps the auto-runner, gates and auto-decision principles plus the list of names.
`Read()` this file when a task matches a named pipeline, before the first step.

## Pipeline catalog

Each pipeline = sequence of steps + gates. (⛔ = irreversible confirmation gate.)

### Product / planning
| Pipeline | Sequence |
|---|---|
| **autoplan** (NL → approved plan) | `plan` (interrogate+OODA) → `design-review` (plan-mode, dimensions 0-10) → eng review (architecture/edge/test) → **final gate** (taste/scope) |
| **PRD → prod** (`/one-shot`) | `master-orchestrator` → parallel agents → `tester-*` (auto) → ⛔ deploy |

### Frontend
| Pipeline | Sequence |
|---|---|
| **Design (variants → production)** | `design-shotgun` (N parallel variants) → `design-review` (choose) → `design-html` (mockup → HTML) → `frontend` (React, if interactive) |
| **New UI** | `frontend` → `design-review` → (`a11y-fixer` if WCAG) → `tester-ui-ux` |
| **Frontend production** | `design-system` → `frontend` → `react-composition`+`tailwind`+`react-patterns` → `anima` → `design-review`+`tester-ui-ux`+`tester-performance` |

### Backend
| Pipeline | Sequence |
|---|---|
| **Laravel feature** | `plan` → `laravel-specialist` → `tester-code` → `tester-api` |
| **Filament admin** | `laravel-specialist` → `filament`/`filament-builder` → `tester-code` |
| **API design** | `plan` → `rest-api` → `laravel-specialist` → `tester-api` |
| **Backend hardening** | `laravel-refactor` + `query-debugger` + `security-review` (parallel) → `tech-debt-auditor` |
| **Full-stack e-commerce** | `plan` → `saas-patterns` → `laravel-specialist` → `filament-builder` → `laravel-react` → `frontend`+`shadcn` → `payment-integration` ⛔ → hardening |

### Quality / operations
| Pipeline | Sequence |
|---|---|
| **Debug** | `log-debugger` (Iron Law: root cause first) → `query-debugger` (if SQL) |
| **QA loop** | `tester-*` test→fix→verify+atomic commit, repeat until green |
| **Ship** (`/ship`) | sync base → tests → review diff (`tester-code`) → version/CHANGELOG → ⛔ push → PR (`github`) |
| **CSO security** (`cso`) | secrets → deps (`dependency-auditor`) → OWASP/STRIDE (`security-review`+`tester-security`) → trust gate |
| **Deploy** | `deploy-executor` (detects the target, runs `deploy-*`, health-check **derived from the published HTML**, purges CF if there were additions) ⛔ |
| **Repair PR** | `pr-repair` (conflicts → bot reviews → CI → ⛔ push 1x at the end) |
| **Retro** | `/retro` → reads the window's learnings → proposes actions |

### Product startup
| Pipeline | Sequence |
|---|---|
| **New product (0 → production)** | `/start` (interview + PRD + stack + design direction) → `execute-project`: E1 foundation ⛔ push → E2 design (via Claude Design w/ conversion, OR direct: `design-system`→`design-shotgun` if frontend→`prepare-design`/`validate-design` per screen) → E3 status checkpoint ⏸ → E4 `plan-waves` → loop per wave (implement w/ domain agents → `write-tests` **separate session** → `tester-code` → runtime gate → gate) → `security-review` → ⛔ deploy |
| **New screen in an existing project** | `prepare-design` (Artifact) → `validate-design` → `new-issue` if there are new components → implement → `write-tests` |
| **Backlog → plan** | `new-issue` (×N) → `plan-waves` (milestones + `blocked-by` + `docs/WAVES.md`) |

⚠ **In any project** (see `rules/pipelines.md` §Project doctrine): `write-tests` runs in a session separate from the one that
implemented — tests written right after the code verify the code, not the requirement.

### Knowledge
| Pipeline | Sequence |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → summary → tags → `memory/knowledge/`) |
| **Market/recency research** | `/last30days <topic>` (social signal scored by engagement, external plugin) + `deep-research` (depth+citations) → merge → `competitor-profiling`/`content-strategy`/`launch-strategy` |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → apply |

# Pipelines — auto-runner for named sequences

Catalog of pipelines that JOCA **runs on its own** (not just names). Loaded in every session.
Terse by design. **The user says the objective, JOCA drives the whole sequence.**

---

## The Auto-Runner (how a pipeline runs)

When task-intake classifies a task as **D (workflow)** OR the task matches a named pipeline below, the **main loop** (or `/goal`/`master-orchestrator`) runs it like this:

1. **Select** the pipeline by objective (domain/trigger match).
2. **Every step in depth:** `Read()` the skill / dispatch the agent — never superficially.
3. **Auto-decide** the **reversible** intermediates (soul.md autonomy 0.95); irreversible (deploy/push/migration/delete/payment/auth) → a 1-line **gate** first.
4. **Chain** via `chain:` (`rules/chaining.md`). Brake: depth ≤ `loop_max_iterations` (4); 3x without progress → stop and report.
5. **Final gate:** "taste"/ambiguous decisions accumulate and are raised all at once at the end, not mid-flight.

**Matching a named pipeline is an order to execute, not a suggestion.** You do not ask whether to run it nor
announce the intention waiting for a "yes" — you run it, and the only gate is the **irreversible** one of step 3.
Asking "do you want me to run pipeline X?" spends the user's decision on something already decided
by this rule.

The runner is a **steward, not an initiator** (`orchestration-patterns.md`): it only runs steps of the declared pipeline — it does not invent scope.

---

## Project doctrine — it ALWAYS holds, with or without `/start`

Default mode of **any** project (new, inherited, mid-flight); `/start` installs it, its absence
does not waive it. Unit = **issue** · gate = **GitHub Actions** · state = **`PROGRESS.md`** ·
whys = **`docs/DECISIONS.md`**.

| Moment | Action |
|---|---|
| 1st session with no `PROGRESS.md` | survey of the disk → create `PROGRESS.md` with the **observed** state (format: `.claude/reference/start/progress-format.md`). One question only: "what do we do next?" — the full interview is `/start` |
| New work (idea, bug, screen) | `new-issue` **before** code. Without "Likely files" the issue is not ready — that is what decides the parallelism |
| Screen/UI that does not exist yet | `prepare-design` → `validate-design` (gatekeeper) → implement |
| ≥3 open issues with no plan | `plan-waves` (milestones + `blocked-by` + `docs/WAVES.md`) |
| ≥2 issues to implement | wave loop: implement (parallel only with disjoint files) → `write-tests` **in another session** → `tester-code` → PR `Closes #N` → cross-cutting sweep → runtime gate → human gate |
| Technical decision (stack, schema, outside-the-house) | 1 entry in `docs/DECISIONS.md` — a decision with no record repeats itself |
| Repo with no `.github/workflows/` | create the CI (`github`) before closing the next wave |
| Closing · end of session | `/ship` → PR (the issue closes through `Closes #N`); `PROGRESS.md` updated and committed |

⚠ **Do not invent documents** (`docs/PRD.md` only on request or through `/start`). The **startup** (interview,
directions page, E1 scaffold, E3 checkpoint) is not generalised — in a mid-flight project what already exists
is adopted, not recreated. Green CI does not replace the runtime gate. Detail and whys:
`.claude/reference/project-doctrine.md`.

## Gates: static ≠ runtime

Green `tsc`/`npm run build`/`php -l` prove that it **compiles**, not that it **works**: an entire app
was called done with both green when `next dev` did not even hydrate.

**Whoever writes the code does not sign off the gate.** Verifier ≠ producer — if the producer was the main loop,
the verification is delegated. Ledger in `.joca/loop.json`, enforced by `stop-continue.js`.

**Static gate (minimum, always):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`** —
eslint is not optional in JS/TS: it is the only one that catches an undefined component in JSX (`jsx-no-undef`).

**Runtime gate (mandatory)** — live evidence per category: navigation/overlay/modal
(`document.elementFromPoint` at the center, on a clean load — auditing `href` is not testing the click) ·
mobile (`getBoundingClientRect().right` vs `innerWidth`; `scrollWidth-clientWidth` gives a **false 0** with
`overflow-x:clip|hidden`) · auth (end-to-end login, not the 200 of the login page) · media (play
and watch) · deploy (dependencies derived from the **published HTML**). Cases and detail:
`.claude/reference/gates-runtime.md`.

**Do not rewrite the gate per project:** `node .claude/scripts/gate-runtime.mjs --base <url>
[--rotas /,/precos] [--clicar "<selector>"]` measures contrast over the painted pixel,
`elementFromPoint`, bleed with a scroller filter, accessible name, console errors and
HTTP >=400. Without `--clicar` it measures only the **resting state** — overlays and modals require firing the trigger.

**Diagnosis is a step with a gate of its own:** claim "X is broken" only after **reading X's code**,
with file:line per claim. Comparing file names and sizes is not reading.

**Resolving conflicts is code, not text:** after a merge/port/`git apply --3way`, **run the
artifact** — a 3-way with no markers has already produced a plausible file that blew up on the 1st run.


## Auto-decision principles (reversible intermediates)

When deciding an intermediate choice on your own, in this order:
1. **Active Brain decision** (`joca-brain active`) — if it has already been decided, follow it.
2. **Project convention** (the project's CLAUDE.md, existing code, surrounding patterns).
3. **The step's skill default** (the specialized skill rules).
4. **Smallest surface** (YAGNI — `skills/yagni.md`).
5. No basis at all + **irreversible** → gate. No basis + reversible → choose and record it (`joca-brain decide --source agent`).

---

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

⚠ **In any project** (see §Doctrine): `write-tests` runs in a session separate from the one that
implemented — tests written right after the code verify the code, not the requirement.

### Knowledge
| Pipeline | Sequence |
|---|---|
| **Knowledge ingest** (`/know`) | `knowledge-ingest` (markitdown → summary → tags → `memory/knowledge/`) |
| **Market/recency research** | `/last30days <topic>` (social signal scored by engagement, external plugin) + `deep-research` (depth+citations) → merge → `competitor-profiling`/`content-strategy`/`launch-strategy` |
| **Self-improvement** (`/upgrade-joca`) | `self-improver` → `gemini-auditor` → apply |

---

## Links
- `rules/task-intake.md` — classifies the route; route D fires the runner.
- `rules/chaining.md` — step-by-step chaining (`chain:`).
- `rules/orchestration-patterns.md` — fan-out, cap 3-5, agents-write-to-disk, steward.
- `.claude/agents/master-orchestrator.md` — the runner's fan-out engine.
- `.claude/commands/autoplan.md`, `/goal`, `/one-shot` — entry points that run pipelines.

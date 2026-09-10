---
name: execute-project
description: "The execution half of /start: builds the project from the PRD to production — foundation (scaffold, repo, CI, hooks), design by one of two routes (external Claude Design with conversion to the stack, or design directly in the stack with design-shotgun), a status checkpoint, and final development in waves with implement/test loops using JOCA's skills and agents. MUST be invoked when the user says: execute project, /execute-project, move on to execution, build the project, execute the plan from start. SHOULD also invoke when: start building, project scaffold, execution phase, develop the whole platform."
triggers: execute project, execute-project, move on to execution, build the project, execute the plan from start, start building, project scaffold, execution phase, develop the platform
chain: plan-waves, prepare-design, deploy-executor
---
# Execute project — from PRD to production

Consumes what `/start` decided (`docs/PRD.md` · `docs/DECISIONS.md` · `docs/DESIGN.md` ·
`PROGRESS.md`) and builds. Four parts, each with an exit criterion:

```
E1 Foundation ──► E2 Design (forks) ──► E3 Status checkpoint ⏸ ──► E4 Final development ──► production
```

**References:** `$REF` = `<JOCA_ROOT>/JOCA_Brain/.claude/reference/start/`.
**Prerequisite:** `docs/PRD.md` exists and the stack is decided. Without that → run `/start` first.
**Do not invent scope**: the PRD is the contract; a new idea mid-flight becomes an issue, not code.

## The rule of this skill: use JOCA, do not reinvent it

Every step names the skills/agents that execute it. Before doing any domain work,
`Read()` the corresponding skill (the 60% activation rule) or dispatch the agent with a brief + Step 0.
The live inventory is in `memory/SKILL_INDEX.json` — when in doubt, look there before doing it
"by hand". Full step→skill map: `$REF/execution-skill-map.md`.

---

# PART E1 — Foundation

Update `PROGRESS.md` at the start and at the end of every step (and the shared memory — whoever clones
sees where this stands).

| # | Step | JOCA skills / agents |
|---|---|---|
| 1 | Scaffold the stack (`$REF/stacks/<stack>.md`) + `.env` with the engine/URL of the PRD's **Local environment**; `.gitattributes` (`* text=auto eol=lf`) if there is >1 machine | `laravel-specialist` · `frontend` (Next) · Flutter/Unity delta |
| 2 | Laravel Boost ⏸ (interactive — the user runs `boost:install`) | — |
| 3 | Tests: Pest 5 / Vitest / flutter_test + smoke test | `test-master` |
| 4 | Context: `$REF/templates/` → `.ai/guidelines/`, `.claude/rules/`, hooks, `reviewer` + copy the PRD's **Local environment** table into `.ai/guidelines/00-project.md` (from here on that is the canonical copy) | — |
| 5 | Export the working skills: `$REF/export-skills.sh . <JOCA_ROOT>/JOCA_Brain` | — |
| 6 | Design docs (skeleton): `docs/DESIGN.md` from the direction set by /start | `design-system` (reads, does not execute yet) |
| 7 | Stack CI (`$REF/templates/github/workflows/ci-<stack>.yml`) + issue forms | `github` |
| 8 | Repo: `git init` → commit → `gh repo create` ⛔ (1 confirmation) → labels | `github` |
| 9 | Test PR → green CI → merge → **only now** hooks + ruleset | `github` |
| 10 | Issues for the 1st version (from the PRD's screens/flows, **with "Likely files"**) | `new-issue` |

**Orders you do not swap:** hooks only after the test PR is merged (`protect-main.sh` blocks
`main`, where the initial commit is made) · `--phpunit` on `laravel new` even if you are going to use Pest ·
⚠ the hooks only fire after the folder's trust dialog — in the 1st session the "commit only on a
branch" rule is you enforcing it, not the safety net.

**E1 exit criterion:** tests passing · green CI on a real PR · labels and issues opened ·
**dev server answering on the registered URL** (`curl -sI <URL>` + the body, not just an open port;
Laravel: migrations running against the declared local engine) · `PROGRESS.md` with E1 closed.

---

# PART E2 — Design (the workflow forks)

First, **any design questions still missing**: if `/start` left "explore during execution" or the
direction came in incomplete, close them now (`AskUserQuestion`, or the directions page
`$REF/design-directions.html` if it was never shown).

Then create the `.md` files that either route consumes:

| Document | Skill that produces it |
|---|---|
| `docs/BRAND.md` — identity, tone, logo if there is one | `brand-guidelines` |
| `docs/DESIGN.md` — tokens, composition rules, 4 states | `design-system` → `design-tokens` |
| `docs/SCREENS.md` — list of the PRD's screens with purpose and states | from the PRD |

**Existing design (/start recorded the source):** the tokens are **measured** from the real artifact —
`site-capture` + `getComputedStyle` on a live site, a Figma export, `markitdown` on a manual. Never
plausible ones. Only then does it fork.

## The question (`AskUserQuestion`)

> **Who does the design?**
> 1. **Claude Design** (claude.ai) — you take the `.md` files there, it generates HTML/CSS/JS, I convert it to the stack
> 2. **Direct design** (recommended) — I build the design system in the real stack from the start: the components
>    that come out are the ones development uses, with no conversion

### Route 1 — Claude Design (external)

1. **Generate the handoff package** (`$REF/claude-design-handoff.md` has the format): a zip/folder with
   `BRAND.md`, `DESIGN.md`, `SCREENS.md`, `PRD.md` and a ready-to-paste prompt asking for: the design system
   + every screen in `SCREENS.md`, **each screen with the 4 states**, self-contained HTML/CSS/JS, tokens in
   custom properties.
2. ⏸ **Pause.** The user creates the design in Claude Design and puts the exported files in
   `design/claude-design/`. Tell them exactly that, and resume with `AskUserQuestion`:
   *"Are the files in `design/claude-design/` yet?"* → **Yes, continue** (recommended) ·
   *Not yet* · *Changed my mind — do direct design (Route 2)*. Before you ask, check yourself
   with `ls design/claude-design/` — if they are already there, there is no question at all: move on.
3. **Validate what arrived**: inventory the folder against `SCREENS.md` (screen by screen — what is missing
   gets listed, not assumed), and run `validate-design` on every screen (tokens vs `DESIGN.md`, 4 states,
   a11y).
4. **Convert to the stack**: `design-html` (cleanup) → real components — `frontend`+`tailwind`
   (Next), `laravel-specialist`+Blade/Livewire (Laravel), Flutter theme. The original HTML stays in
   `docs/mockups/` as a reference; **the conversion is a faithful re-implementation, not copy-paste**.

### Route 2 — Direct design (in the stack)

1. **Real design system**: the `design-system` → `brand-guidelines` → `design-tokens` →
   `component-system` pipeline, materialised **in the stack** (Blade/Livewire or React components, tokens in
   `@theme`; Flutter → `ThemeData`). A `/design` page with every component together.
   Agents: `design-system-agent`, `design-tokens-agent`; audit `design-system-audit`.
2. **Public frontend (website/landing)** → **`design-shotgun`**: N variants within the direction
   chosen in /start (not from scratch — the direction is the constraint) → `design-review` to choose →
   `design-html` → `frontend`. It is JOCA's design workflow, run in full.
3. **Application screens**: for each screen in `SCREENS.md`, `prepare-design` (mockup as an Artifact,
   4 states) → `validate-design` (gatekeeper) → implement with the design system's components.
   Fan-out possible: screens with disjoint files → `design-html-agent`/`frontend-agent` in
   parallel (cap 3-5, briefs with Step 0).

**E2 exit criterion:** design system existing **in the stack** (route 1 converted, route 2 native) ·
`/design` page (web) · every screen of the 1st version with a mockup/implementation validated by
`validate-design` · `DESIGN.md` closed with no `<...>`.

---

# PART E3 — Status checkpoint ⏸ (last gate before development)

Present, **with evidence** (links/paths, not claims):

- ✅/❌ PRD complete (`docs/PRD.md` with nothing pending)
- ✅/❌ Brand + design system (`BRAND.md`, `DESIGN.md`, `/design` page, components in the stack)
- ✅/❌ Screens designed and validated (the `SCREENS.md` list vs `docs/mockups/`, one by one)
- ✅/❌ Foundation (green CI, hooks, issues opened)
- ⚠ Open risks and decisions (from `docs/DECISIONS.md`)

**Wait for explicit confirmation — in a form, never in open text.** `AskUserQuestion`:
*"Do I move on to development (E4)?"* → **Yes, move on** (recommended) · *I want to fix the design
first* · *I want to change the scope of the 1st version*. It is the last cheap moment to change your mind —
after this it is development in depth. Record the choice in `PROGRESS.md`.

---

# PART E4 — Final development (waves + loops)

> **This loop is not exclusive to the startup phase.** It is the normal way of handling >=2 issues in any
> project (`rules/pipelines.md` §Project doctrine). In a project already under way, you come in here
> directly: `plan-waves` over the issues that exist, and the loop below runs just the same.

The engine is what JOCA already has — this part **conducts**, it does not reinvent:

1. **`plan-waves`** over the open issues → milestones, `blocked-by`, `docs/WAVES.md`. Wave 1
   is the shortest and validates what is expensive to reverse (schema, auth, public URLs).
2. **Per wave, the loop** (adopt the `master-orchestrator` playbook — the main loop dispatches, agents do not
   spawn agents):

```
for each wave:
  for each issue (parallel ONLY with disjoint "Likely files", cap 3-5):
    branch <type>/<n>-<desc>
    implement    → domain agent (laravel-specialist-agent · frontend-agent ·
                   filament-builder · payment-integration ⛔ · auth · rest-api · mysql …)
    test         → write-tests (SEPARATE AGENT/SESSION — never whoever implemented)
    review       → tester-code; endpoints → tester-api; UI → tester-ui-ux
    PR "Closes #n" → green CI → merge (the issue closes itself)
  end of wave:
    cross-cutting sweep (1 agent audits the junction, not the individual scopes)
    wave RUNTIME gate (rules/pipelines.md — screenshot/real login/live flow,
                       not just a green build)
    human validation gate for the wave (whatever plan-waves defined)
  PROGRESS.md updated (wave log: what closed, what is left)
```

3. **Loop rules** (JOCA's own, not optional): a `.joca/loop.json` contract with one step per issue
   (`produtor`/`verificador`) so the wave runs without stopping · minimum static gate on every PR (`tsc`/build/
   lint/`php -l` **+ eslint on JS**) · runtime gate per category before closing a phase ·
   anti-loop brake (`loop_max_iterations`, 3x-no-progress → stop and report) · `git add` by
   explicit path with live agents · cost announced before large fan-outs (>=6 agents).
4. **Security before production**: `security-review` + `tester-security`; payments → also
   `tester-api` on the webhooks.
5. **Logs**: `PROGRESS.md` (state per wave, shared through git) + closed issues/PRs (history) +
   `docs/DECISIONS.md` (the whys). The user — or another collaborator — sees the state without
   asking you.
6. **Deploy** ⛔: `deploy-executor` with the target's skill (`deploy-cpanel` · `deploy-ploi` · Vercel ·
   `deploy-docker`), health-check derived from the published HTML, a URL matrix if there is a subfolder/
   multi-language. 1 confirmation first.

**E4 exit criterion (= the skill's):** every issue of the 1st version closed by a PR with green CI ·
runtime gates passed · security review with no Critical · deploy done (or delivered ready-to-
-deploy, if the user postpones it) · `PROGRESS.md` saying "production" with the date.

## Next step (chain)

- Live backlog → `plan-waves` runs again when the plan stops reflecting reality.
- New screens → `prepare-design` → `validate-design`.
- Publishing → `deploy-executor` ⛔.
- At the end of every session → `/save` (updates the Brain **and** `PROGRESS.md`).

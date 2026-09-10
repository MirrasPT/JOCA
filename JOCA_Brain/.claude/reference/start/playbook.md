# Project startup playbook

**Context:** own product · Laravel/Livewire · Next.js · Flutter · GitHub Issues · design done with Claude
**Version:** 2.0 — August 2026 (ported to JOCA: multi-stack, interactive forms, mockup as an Artifact)

---

## What this document is

The method for starting **any new project**, from the idea to the first development cycle rolling. Six phases, ~1 to 2 weeks for a small product.

The rule that holds the sequence up: **each phase produces the input of the next.** The flows reveal the entities; the technical skeleton makes it possible to materialize the visual system; the screens show which fields the data model really needs to have.

## How to run this with Claude Code

Do not follow the document by hand. Copy the package into the project and run:

```
/start
```

The skill reads `PROGRESS.md`, **confirms each phase by its exit criterion with a command** (a phase marked as done that does not pass the criterion is treated as not done), works out which phase you are in, walks you through it one question at a time, and **checks the exit criteria with commands before letting you move on**. If you resume two weeks from now, it knows where you stopped.

### The three layers — and what each one guarantees

It is worth understanding what each mechanism actually does, because only one of them guarantees anything:

| Layer | Mechanism | What it does |
|---|---|---|
| **Context** | `.ai/guidelines/`, `.claude/rules/`, `docs/` | *Biases.* Claude reads it and tends to follow — but it is context, not configuration. No guarantees |
| **Orchestration** | `/start` + `PROGRESS.md` | *Verifies.* Runs commands and confirms criteria before moving on |
| **Enforcement** | hooks, CI, rulesets | *Prevents.* Runs regardless of what Claude decides |

**The honest answer to "how do I guarantee everything is done properly":** `CLAUDE.md` guarantees nothing — it is a message in the context, not an enforced rule. What guarantees is the third layer. That is why the package ships hooks (`.claude/hooks/`), CI blocks merges, and the ruleset blocks pushes.

Rule for deciding where to put each thing: **if the cost of being ignored is high, it is not context — it is a hook, CI or a ruleset.**

---

## Overview

| Phase | What it produces | Duration |
|---|---|---|
| **A — Framing** | `PRODUCT.md` — the problem and the boundaries | 2–3 h |
| **B — Flows** | User journeys, list of screens and entities | 3–4 h |
| **C — Technical skeleton** | Repo running, Boost, CI, issues configured | 1 day |
| **D — Visual system** | `DESIGN.md` + tokens + base components | 1 day |
| **E — Screens** | Reviewed HTML/Tailwind mockups | 2–3 days |
| **F — Architecture** | `ARCHITECTURE.md` + migrations | 1 day |

> **Note on the order.** The technical skeleton comes **before** the design because Phase D configures tokens in Tailwind and creates Blade components — it needs the project to exist. And the migrations come **after** the screens, because it is the screens that reveal which fields are really necessary.

---

# PHASE A — Framing

## Objective
Write down what the product is, and above all what it is **not**.

## How to do it
A session with Claude producing `docs/PRODUCT.md` (template in the package). The `product-management:brainstorm` skill works well as a starting point.

## Benefit
The **"What it is NOT" section is the most valuable of the whole document**. In your own product there is no client closing the scope, and the scope grows on its own — every good idea looks small in isolation. Writing the boundaries down on day 1 gives you something to go back to when, in month 3, the fourth good idea shows up.

`PRODUCT.md` is also the document Claude reads to understand what you are building. Without it, every session starts from zero.

## Done when
You can explain the product in two sentences, and the "is not" list has at least five points.

---

# PHASE B — Flows

## Objective
Describe the main user journeys, in text, before there is a single pixel.

## How to do it
For each essential journey (typically 3 to 6):

```markdown
## Flow: <name>

**Who:** <the user>
**Wants:** <their goal>

1. Arrives at <where> coming from <where>
2. Sees <what>
3. Does <action>
4. The system <response>
5. Ends with <result>

**Went wrong:** <what can fail, and what happens then>
```

Then extract two lists, into `docs/PRODUCT.md`:
- **Screens** needed to support the flows
- **Entities** that appear in the flows

## Benefit
Writing flows in text is the cheapest thing you can do and the one that avoids the most waste. A badly thought-out flow costs 20 minutes to fix here; it costs three days once there are screens designed and tables created.

It also solves the chicken-and-egg problem between design and architecture: **the flows are the common ancestor of both.**

## Done when
There are 3–6 flows written, and out of them came a list of screens and a list of entities.

---

# PHASE C — Technical skeleton

## C1 — Create the project

The installer, if it is not installed yet:

```bash
composer global require laravel/installer
```

Then:

```bash
laravel new <project>
```

Choose the starter kit according to the frontend stack:

| Starter kit | Stack |
|---|---|
| Livewire | Livewire 4 + Flux UI |
| React | React 19 + Inertia 3 + shadcn/ui |
| Vue | Vue 3 + Inertia 3 + shadcn-vue |
| Svelte | Svelte 5 + Inertia 3 + shadcn-svelte |

They all ship authentication, **Tailwind 4**, Pint, Larastan (with `phpstan.neon`) and a baseline CI workflow.

Laravel 13 (March 2026) supports PHP 8.3–8.5.

## C2 — Laravel Boost

```bash
composer require laravel/boost --dev
php artisan boost:install
```

**It is the highest-return step in the whole playbook.** It gives Claude ten MCP tools: read the database schema, the Eloquent models, the application and browser logs, the last error, run queries, and semantic search over the Laravel documentation.

Boost also ships its own skills (Pest, Tailwind, conventions) and uses `.ai/skills/` for custom skills. After the install, run `/context` and see which skills became available — if any covers the same ground as the package's, pick one and delete the other instead of keeping both.

**Where to write your context:** see the "Context structure" section below. In short: never in `CLAUDE.md`, always in `.ai/guidelines/`.

## C3 — Tests and CI

Pest 5 requires PHP 8.4+ and PHPUnit 13, while the starter kits come with PHPUnit 12 and `"php": "^8.3"`. **The simple install fails.** The sequence that fixes it:

```bash
# 1. raise the PHP constraint in composer.json to "^8.4"

# 2. replace the starter kit's PHPUnit with Pest
composer remove phpunit/phpunit --dev
composer require pestphp/pest --dev -W
./vendor/bin/pest --init
```

Pint and Larastan **already come in the starter kit** — do not install them again.

**The CI workflow:** the starter kit already ships `.github/workflows/tests.yml`, which runs on PHP 8.3 and will break as soon as Pest 5 comes in. Replace that file with the package's `ci.yml` — **delete the starter kit's**, do not leave both.

> **Test impact analysis** (re-running only the affected tests) exists in Pest 5 but is opt-in: it requires `--tia` and a coverage driver installed. It is worth it once the suite grows; it is not needed on day 1.

## C3b — Context structure

**Yes, you have `CLAUDE.md`** — and it is read in every session. What you cannot do is write it by hand, because Boost regenerates it. The solution is Boost's own mechanism.

| File | Who writes it | Goes into git? | What for |
|---|---|---|---|
| `CLAUDE.md`, `AGENTS.md` | **Boost** (generated) | no | Where Boost gathers everything. Read yes, **edit never** |
| `.ai/guidelines/*.md` | **you, by hand** | **yes** | Your context. Boost includes it in the `CLAUDE.md` it generates |
| `.claude/rules/*.md` | **you, by hand** | **yes** | Rules that only load when reading certain files |
| `.ai/rules/` | only the `record-rule` tool | **yes** | Rules Claude records during the work |
| `docs/*.md` | you | **yes** | Long documents, read on demand |

**The missing piece:** `.md` or `.blade.php` files placed in `.ai/guidelines/` are **automatically included** in Boost's guidelines whenever `boost:install` or `boost:update` runs. Your content survives the regeneration because it is its source.

> **`.ai/rules/` vs `.claude/rules/` — which to use.** They look like they overlap; the practical split is authorship. The rules **you** write go into `.claude/rules/`, because Claude Code loads them natively. The `.ai/rules/` folder belongs to Boost and should only be written by the `record-rule` tool — a file placed there by hand **is not discovered** until the index is regenerated.

Copy from the package:

```
.ai/guidelines/00-project.md            → what it is, commands, conventions, never do
.ai/guidelines/10-workflow.md  → branch, issue, tests, PR
.claude/rules/interface.md              → loads when editing views and CSS
.claude/rules/database.md          → loads when editing migrations and models
```

**Why `.claude/rules/` with `paths:`** — `CLAUDE.md` is read whole in every session and eats context. Interface rules only matter when you touch views; database rules only when you touch migrations. With `paths:` in the frontmatter, they load only at those moments. It keeps the permanent context small, which is what makes Claude follow it better.

> ⚠️ **A limitation to know:** rules with `paths:` load when Claude **reads** a file matching the pattern — not on every operation. When creating a screen from scratch, without reading any view first, the rule may not be in context. And they are not re-injected after a `/compact`.
>
> That is why the rules that **really have to apply always** go in `.ai/guidelines/` (permanent context) or, if the cost of being ignored is high, in a hook.

> **Practical size rule:** the always-present context (guidelines + rules without `paths`) should stay under ~200 lines. Above that, adherence drops. Long detail goes into `docs/` and is referenced, not pasted.

**Check after `boost:install`:** open the generated `CLAUDE.md` and confirm the content of `.ai/guidelines/` is there. Inside Claude Code, `/context` shows which memory files were actually loaded.

## C4 — GitHub Issues

```bash
gh label create "type: feature" --color 0052CC
gh label create "type: bug"           --color D93F0B
gh label create "type: technical"       --color 5319E7
gh label create "area: design"        --color FBCA04
gh label create "priority: now"   --color B60205
gh label create "blocked"           --color 000000
```

Copy `.github/ISSUE_TEMPLATE/` from the package. Create a GitHub Project (board) linked to the repository.

Protect `main` in **Settings → Rules → Rulesets**: require a PR, 1 approval and green CI.

> Rulesets on a **private** repository require a Pro or Team plan. On private + Free they are not available, and the merge rule comes down to discipline.

## C5 — Deploy

With Ploi: create the server and site, connect the repository, enable quick deploy. A staging environment before production, if the project warrants it.

## Benefit of this phase
Done now and not at the end, this phase gives the design phases a real place to materialize decisions — tokens in `app.css`, components in `resources/views/components/`. And Boost, installed before the design, means Claude knows the project from the first conversation about interface.

## Done when
`php artisan serve` runs, `./vendor/bin/pest` passes, CI is green on a test PR, and the labels and templates exist.

---

# PHASE D — Visual system

> **The phase you do not skip.** Read the warning at the end before deciding to skip it.

## Objective
Define the visual constraints **before** designing any screen.

## How to do it

**1. Decide the few things that are really yours.** Choose deliberately — do not leave it to Claude:
- One type family and one scale
- One brand color and one neutral
- One corner radius and one density (compact vs. spacious)

That is four decisions. This is where practically the whole identity of the product lives.

**2. Write `docs/DESIGN.md`** with those decisions and the usage rules (template in the package).

**3. Declare the tokens.** Tailwind 4 is configured in CSS, not in `tailwind.config.js`. In `resources/css/app.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand-50:  #eef2ff;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;

  --font-sans: "Inter", sans-serif;
  --radius-card: 0.75rem;
}
```

**4. Create the base components** in `resources/views/components/` — button, input, card, badge, table, modal, empty state, alert. Six to ten is enough.

**5. Create a page showing all the components together**, at `/design` (local environment only). That is where you see whether the system is coherent.

## Benefit
This is the design's `CLAUDE.md`, and the argument is exactly the same.

With no system defined, every screen Claude generates is pretty in isolation and **incoherent together** — three shades of blue, four button sizes, spacings that do not talk to each other. Every screen looks fine when you review it alone; only after ten do you realize the product looks like it was made by five different people. By then, fixing it means redoing it.

With the system defined, Claude composes within constraints — which is exactly where it is strong.

## Done when
`DESIGN.md` exists, the tokens are in `app.css`, the components exist, and the `/design` page shows them together.

---

# PHASE E — Screens

## Objective
Design the screens of the first version, iterating fast.

## How to do it
For each screen, with the `/prepare-design` skill:

1. Claude generates a **static HTML+Tailwind 4 mockup**, using the defined tokens.
2. You open it in the browser and look. You iterate in conversation — "the density is wrong", "the empty state is missing".
3. Once approved, it goes in `docs/mockups/<screen>.html`, committed.
4. That file becomes **the reference** for the Blade implementation.

Always ask for the four states, not just the happy screen: **empty, loading, error, and with lots of data**.

## Benefit
The big advantage of the design being done by Claude and not in Figma: **the design artifact is already code**. There is no handoff, no translation, no "the dev implemented it differently from the design". The mockup uses the same Tailwind tokens the application uses.

The iteration cycle is different too: changing a table's density is one sentence, not thirty minutes of manual work.

## Where this fails — and it matters
**Claude produces competent, conventional design, not distinctive design.** Clean layouts, correct hierarchy, sensible spacing. It does not produce a visual identity that makes someone stop. For your own product competing on looks, that is a real limitation.

The mitigation is Phase D: **invest the differentiation in the system's four decisions** — typography, color, shape, density — and leave the composition of the screens to Claude. That is where the effort/result ratio is best.

Do not use the mockups as final components. They are a reference; the Blade implementation is done properly, with the real components.

## Done when
The first version's screens have an approved mockup, including empty and error states.

---

# PHASE F — Architecture

## Objective
Define the data model and the structure, with the screens already known.

## How to do it

**1. Data model.** The entities came out of Phase B; the Phase E screens show which fields are really needed. Write the migrations — they are the design artifact, not just code.

**2. `docs/ARCHITECTURE.md`:** modules and boundaries, packages chosen and why, external integrations, what falls outside standard Laravel.

**3. `docs/DECISIONS.md`:** the structural decisions, with the alternatives discarded. Two or three lines each.

## Benefit
Doing the data model **after** the screens avoids the classic mistake of modeling in the abstract: elegant tables that do not support what the screen needs to show, or fields created "just in case" that are never used.

`DECISIONS.md` answers the question the code never answers: *why is this like this?* Six months from now, it is the difference between trusting an old decision and redoing it because you do not understand it.

## Done when
Migrations written and running, `ARCHITECTURE.md` and `DECISIONS.md` committed.

---

# The cycle, after the startup

```
idea
  │
  ▼
/new-issue ──► issue on GitHub with acceptance criteria
  │
  ├─ needs a new screen? ──► /prepare-design ──► approved mockup, linked to the issue
  │
  ▼
git checkout -b <type>/<n>-<description>
  │
  ▼
implement with Claude (Boost gives it schema, models, logs, docs)
  │
  ▼
/write-tests <n>   ← separate session, from the criteria
  │
  ▼
git push -u origin <branch>  ──►  PR with "Closes #<n>"
  │
  ▼
CI (Pint · Larastan · Pest) ──► reviewer ──► human review ──► merge
                                                                 │
                                                                 ▼
                                                    the issue closes on its own
```

**Branch convention:** `feat/12-export-report`, `fix/34-login-error`, `chore/56-update-deps`.

**Closing the issue:** write `Closes #12` in the PR description. Native to GitHub, no integration to configure.

---

# The five rules

1. **Phase D before Phase E.** Visual system before screens, always.
2. **No issue goes into implementation without verifiable acceptance criteria.**
3. **Whoever implemented does not write the tests in the same session.** Tests written right after the code check the code, not the requirement — they always pass and prove nothing.
4. **No PR merges without green CI and one approval.**
5. **A structural decision that does not land in `DECISIONS.md` is lost.**

---

# What this costs

- **1 to 2 weeks of startup** before the first line of functionality. It looks like a lot; it is less than redoing the data model in month 2.
- **Discipline in phases A, B and D**, which are the ones that least look like work and most determine the result.
- **Tokens.** Iterative design and assisted implementation consume a fair amount.
- **An accepted limitation:** the design will be competent, not distinctive (see Phase E).

**Where it does not pay off:** throwaway prototypes and proofs of concept. The playbook pays for itself on a product that is going to be maintained.

---

# Checklist

```
PHASE A — Framing
[ ] docs/PRODUCT.md, with "what it is NOT" (5+ points)

PHASE B — Flows
[ ] 3-6 flows written
[ ] List of screens + list of entities

PHASE C — Technical skeleton
[ ] laravel new + starter kit chosen
[ ] Laravel Boost installed; checked what it generated
[ ] .ai/guidelines/ filled in and included in the generated CLAUDE.md
[ ] .claude/rules/ copied; hooks copied and executable
[ ] CLAUDE.md, .mcp.json and boost.json in .gitignore
[ ] PHP ^8.4 in composer.json; PHPUnit removed; Pest 5 installed
[ ] starter kit's tests.yml deleted; package's ci.yml in its place
[ ] CI green on a test PR
[ ] Labels, issue templates and Project created
[ ] Ruleset protecting main
[ ] Deploy configured (Ploi)

PHASE D — Visual system
[ ] Typography, color, shape and density decided
[ ] docs/DESIGN.md
[ ] Tokens in @theme in app.css
[ ] Base components + /design page

PHASE E — Screens
[ ] Mockup per screen, with the four states
[ ] Committed in docs/mockups/

PHASE F — Architecture
[ ] Migrations written and running
[ ] docs/ARCHITECTURE.md
[ ] docs/DECISIONS.md
[ ] First version's issues opened
```

---

## Package files

```
ORCHESTRATION
.claude/skills/start/  → /start — walks through and checks the 6 phases

CONTEXT (read by Claude in every session)
.ai/guidelines/00-project.md            → Boost includes this in the generated CLAUDE.md
.ai/guidelines/10-workflow.md  → same
.claude/rules/interface.md              → loads only when editing views/CSS
.claude/rules/database.md          → loads only when editing migrations/models

ENFORCEMENT (runs independently of Claude)
.claude/settings.json             → wires up the hooks
.claude/hooks/protect-main.sh    → blocks commit/push on main
.claude/hooks/warn-design.sh    → warns if views are edited without DESIGN.md
.github/workflows/ci.yml          → Phase C3 (replaces the starter kit's tests.yml)

DOCUMENTS (read on demand)
docs/PRODUCT.md               → Phase A (template)
docs/DESIGN.md                → Phase D (template)
docs/ARCHITECTURE.md          → Phase F (template)
docs/DECISIONS.md             → Phase F (template)
docs/mockups/                 → Phase E (destination of the mockups)
REVIEW.md                     → review criteria

DAILY WORK
.claude/skills/new-issue/        → create issues on GitHub
.claude/skills/prepare-design/     → mockups in Phase E
.claude/skills/write-tests/   → tests from the criteria
.claude/agents/reviewer.md         → review before the PR
.github/ISSUE_TEMPLATE/*.yml      → Phase C4
```

Plus `PROGRESS.md`, which the `/start` skill creates at the root and keeps up to date. Commit it too.

**Install:**

```bash
# copy the package into the repository root, then:
chmod +x .claude/hooks/*.sh
printf 'CLAUDE.md\nAGENTS.md\n.mcp.json\nboost.json\n' >> .gitignore
git add -A && git commit -m "chore: working method and project context"
```

When opening Claude Code in the project for the first time, **accept the folder trust dialog** — without it the hooks in `.claude/settings.json` do not run, and the enforcement layer stays inactive with no warning.

After that it is just: `/start`.

## References

- [Laravel 13 — releases](https://laravel.com/docs/13.x/releases)
- [Laravel — Starter Kits](https://laravel.com/starter-kits)
- [Laravel Boost](https://laravel.com/docs/13.x/boost)
- [Claude Code — memory and CLAUDE.md](https://code.claude.com/docs/en/memory)
- [Claude Code — hooks](https://code.claude.com/docs/en/hooks)
- [Pest — installation](https://pestphp.com/docs/installation)
- [Tailwind 4 — theme and tokens](https://tailwindcss.com/docs/theme)
- [Larastan](https://github.com/larastan/larastan)
- [GitHub — issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [GitHub — rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

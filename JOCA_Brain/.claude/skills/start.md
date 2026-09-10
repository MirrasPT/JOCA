---
name: start
description: "The start of any project. Full interview through interactive forms — product type (website, mobile app, game, SaaS, software), flows, initial PRD, stack by layers, infrastructure and design direction (with an interactive page of visual directions) — and it ends by hooking into execution. Existing projects connect to JOCA with the same questionnaire, pre-filled from the disk (PRD, README, manifests, docs/) — the user confirms instead of writing. MUST be invoked when the user says: /start, new project, start project, kick off project, create new product, begin project. SHOULD also invoke when: start from scratch, I want to build an app, I want to make a site, I have a product idea, connect project to JOCA, init project."
triggers: start, new project, start project, kick off project, create new product, begin project, start from scratch, I want to build an app, I want to make a site, I have an idea, connect project to JOCA, init project
argument-hint: "[project-name]"
chain: execute-project, prd
---
# /start — the start of any project

Interview → initial PRD → stack → infra → design direction → **hooks into execution**
(`execute-project`). This skill **executes nothing**: at the end you have the documents and the
decisions; the next skill builds.

> The **way of working** that this skill installs (issue before code · design validated before
> UI · tests in a separate session · `PROGRESS.md` + `docs/DECISIONS.md` · waves with a gate) is a
> **global rule** — it holds in every project, with or without `/start`: `rules/pipelines.md`
> §Project doctrine. What only lives here is the **kick-off**: interview, design directions,
> scaffold and status checkpoint.

**References:** `<JOCA_ROOT>/JOCA_Brain/.claude/reference/start/` — from here on `$REF`.

# RULES

1. **Everything by form.** **Any** question — closed, open, or a simple yes/no — goes in
   `AskUserQuestion`. Never write a question in the chat waiting for a written answer. 2-4 concrete
   options, a `description` on each, the **recommended one first**, `multiSelect` when the options
   are not mutually exclusive. An answer only the user knows → same thing: options derived from what
   you already know + the form's free option so he can write over it.
2. **One decision at a time.** Never dump a whole questionnaire in text.
3. **Do not ask what the disk answers — pre-fill.** Phase 0 runs before any question, and
   what it finds enters the forms **as the recommended option, first**, marked
   `(from disk: <file>)`. A project with documents gets the **same** questions as a new
   project — the difference is that he confirms instead of writing.
4. **Do not ask what you can propose.** Derive suggestions from the previous answers and present them
   as options with a recommended one — the user corrects faster than he invents.
5. **Push back when the answer is vague**, above all on "what it is NOT".
6. **Do not invent product content.** The problem, the audience and the boundaries are the user's.
   Pre-filling from a project file **is not inventing** — but cite the source in the option's
   `description`, and if there is no source the option does not exist.
7. **Always assume he wants to move forward.** End of a phase → move to the next without asking
   permission. Where the next phase is expensive or irreversible and the confirmation really is
   needed, it is a **Yes/No form with "Yes, go ahead" first** — never an open question in text.

---

# PHASE 0 — Survey (zero questions)

```bash
pwd && ls -A
git rev-parse --is-inside-work-tree 2>/dev/null && git remote -v && git log --oneline -3
test -f PROGRESS.md && cat PROGRESS.md
cat CLAUDE.md 2>/dev/null | head -30; cat README.md 2>/dev/null | head -20
ls package.json composer.json pubspec.yaml go.mod requirements.txt 2>/dev/null
gh auth status; gh --version; git config user.email
php -v 2>/dev/null | head -1; node -v 2>/dev/null; flutter --version 2>/dev/null | head -1
# local environment — do not ask what this answers
uname -s; sw_vers -productVersion 2>/dev/null; echo "${WSL_DISTRO_NAME:+WSL: $WSL_DISTRO_NAME}"
ls -d ~/Library/Application\ Support/Herd /Applications/Herd.app /c/laragon /opt/lampp /Applications/XAMPP /Applications/MAMP 2>/dev/null
command -v herd docker mysql mysqld psql valet 2>/dev/null
ls -d ~/.nvm ~/.asdf ~/.config/nvm 2>/dev/null
test -f docker-compose.yml && grep -nE "image:|mysql|pgsql|postgres" docker-compose.yml | head -5
grep -E "^(APP_URL|DB_CONNECTION|DB_HOST|DB_PORT)=" .env 2>/dev/null
# documents that answer the interview (source of the pre-fill)
ls docs/ 2>/dev/null
for f in docs/PRD.md PRD.md docs/DECISIONS.md docs/DESIGN.md docs/BRAND.md docs/SCREENS.md docs/ARCHITECTURE.md; do test -f "$f" && echo "--- $f" && head -60 "$f"; done
# Brain memory for this folder (exact, parent and children)
grep -rln "$(pwd)" <JOCA_ROOT>/JOCA_Brain/memory/projects/ 2>/dev/null
grep -rn "^directorio" <JOCA_ROOT>/JOCA_Brain/memory/projects/ 2>/dev/null | grep -F "$(basename "$(pwd)")"
```

## Phase 0b — Derive the answers (zero questions)

Before opening the first form, turn what Phase 0 read into a **table of default answers**. Each row
has: field · derived value · **file it came from**. With no file there is no value — it stays
`<no source>` and the question goes without a recommendation.

| Interview field | Where it is read |
|---|---|
| Name | `composer.json`/`package.json` `name` · `pubspec.yaml` `name` · `README.md` title |
| Problem / 1-2 sentences | 1st paragraph of `README.md` · manifest `description` · `docs/PRD.md` |
| Audience | audience/users section of `docs/PRD.md` or `README.md` |
| What it is NOT | "What it is NOT"/"Non-goals"/"Out of scope" section of `docs/PRD.md` |
| Product type | manifest: `pubspec.yaml`→mobile · `next` in the deps→website/SaaS · `laravel/framework`→SaaS/API · `ProjectSettings/`→game |
| Stack (Phase 3) | real dependencies from the manifest + `php -v`/`node -v`/`flutter --version` |
| Local environment (Phase 3.6) | Herd/Laragon/XAMPP/MAMP detected · `docker-compose.yml` · `.env` (`APP_URL`, `DB_*`) · `uname -s` |
| Infra (Phase 4) | `git remote -v` (repo already exists → it is not created) · `.env.example` · `docs/DECISIONS.md` |
| Design (Phase 5) | `docs/DESIGN.md`/`docs/BRAND.md`/`tailwind.config`/`@theme`/`ThemeData` |

Rule: **each derived value becomes the 1st option of that question's form**, with the `description`
citing the file (e.g.: `"Fleet managers — from docs/PRD.md, Audience section"`). The other options are
plausible alternatives. That way he presses one key instead of rewriting the whole project.

## The three doors

| State of the folder | Route |
|---|---|
| **Empty** (or only `.git`) | New project → Phase 1 |
| **Has `PROGRESS.md`** | **Resume** — read the phases, confirm each one by its exit criterion (table below), enter the first one still to do. Does not repeat the interview for what is already in `docs/PRD.md`. **A machine whose OS is not in the Local environment table** → run only Phase 3.6 for that machine and add the row; do not repeat anything else |
| **Has a project, no `PROGRESS.md`** | **Connect to JOCA** — interview all the same, **pre-filled** by Phase 0b. See box |

> ### Connecting an existing project — pre-filled questionnaire
> **You do not skip the questions: you skip the work of answering them.** The `composer.json`/`package.json`/
> `pubspec.yaml` gives the stack, git gives the history, the `README.md` and `docs/` give the objective, the
> audience and the boundaries. Run Phases 1-5 **in full**, but each form opens with the
> already-derived answer first and the `description` citing the file — he confirms instead
> of writing. A whole phase whose fields all came from the disk is resolved in a single
> block-confirmation form ("Do you confirm all of this?" → *Yes* · *I want to correct it* → only then the
> questions one by one).
> Nothing derived (`<no source>`) → the question runs normally, with no recommendation.
> At the end: write/update `memory/projects/<name>.md` in the Brain and create `PROGRESS.md` with the
> real observed state. If Brain memory already exists for the folder (or for the parent folder),
> **show it first** and ask — in a form — whether it is *update* · *create sub-entry* ·
> *umbrella*. Never start as if it were new.

## Exit criteria per phase (used on resume)

| Phase | Evidence — a command, not an opinion |
|---|---|
| S1 Product | `docs/PRD.md` exists; "What it is NOT" section with >= 5 points |
| S2 Flows | 3-6 flows in the PRD + list of screens + entities + capabilities marked |
| S3 Stack | Stack section of the PRD filled in, with no `<...>`, **including the Local environment table** (1 row per machine) |
| S4 Infra | GitHub repo decided (name + visibility) + deploy decided/deferred in `docs/DECISIONS.md` |
| S5 Design | direction recorded in `docs/DESIGN.md` (or "it exists in X" or "explore during execution") |
| E* Execution | see `execute-project` — phases E1-E4 have their criteria there |

A phase marked as done that **does not pass** the evidence → still to do, and say so.

---

# PHASE 1 — The product

If `$ARGUMENTS` carries a name, use it. Otherwise, ask for it in the first question.

**1.1 — Product type** (`AskUserQuestion`, the very first question — it funnels everything else):

| Option | Downstream consequences |
|---|---|
| **Website / landing** | frontend-first; design is explored in depth; stack Next.js or Livewire |
| **SaaS / web platform** | multi-user likely; backoffice; Laravel+Livewire+Filament |
| **Mobile app** | Flutter + Laravel API; app stores; offline to consider |
| **Game** | mobile → Unity 6; web → to be decided in Phase 3 |
| **Software / internal tool** | compact density; less marketing, more data |
| **API / backend only** | no screen-design phase; contracts first (`rest-api`) |

(6 options do not fit in a 4-option question — split into 2 questions or use the 4 most likely + "Other".)

**1.2 — Five questions, five forms, one at a time.** None goes in loose text: even
where the content is the user's, the form opens with derived candidates (Phase 0b, or from the previous
answer) and he picks one or writes over it in the free option.

| # | Question | How to build the form |
|---|---|---|
| 1 | **Name** + 1-2 sentences on the problem | Options: name from the manifest/README (`(from disk: <file>)`) · folder name · `$ARGUMENTS` · write another |
| 2 | **Who it is for** | Propose 3 **concrete** users deduced from the problem. "Companies" is not an option; "the operations lead in a team of 5-20 people" is. He picks or corrects |
| 3 | **How it is solved today** and why that is bad | Typical options: Excel/spreadsheet · generic tool that fits badly · by hand/on paper · direct competitor · other |
| 4 | **What it is NOT** — 5 points | `multiSelect: true` with 6-8 candidates derived from what he already said (invoicing, mobile app, multi-language, marketplace, chat, BI, offline…). **Do not move on with fewer than five** — if the first form yields fewer, open a second one with new candidates |
| 5 | **First usable version** | Propose 3 scope cuts, from the smallest to the most complete, derived from the flows already discussed; recommended = the smallest |

The goal is still for him to **describe as much as possible** — the free field of each form
is there for that, and everything gets recorded, even what does not fit the options; it goes into the PRD.

---

# PHASE 2 — Flows, capabilities and initial PRD

**2.1 — Flows.** Ask for 3 to 6 main journeys. For each one: **who** · **what they want** · **the
steps** · **what can go wrong**. You write the structured version, show it for confirmation.

**2.2 — Cross-cutting capabilities** (`AskUserQuestion` with `multiSelect: true` — it is a checklist,
not a choice). Ask only the ones plausible for the product type; assume the obvious ones by default and
say so:

| Capability | If marked, it enters the PRD and the stack |
|---|---|
| **Login / accounts** | skill `auth` during execution; decide now: email+password, social, magic link |
| **Multiple users / teams** | tenancy — `saas-patterns`; changes the data model |
| **Payments** | `payment-integration` / `portugal-payments`; ⛔ irreversible step during execution |
| **Notifications** (email/push) | `transactional-email`; push requires a mobile app |
| **Backoffice / administration** | Filament v5 almost for free with Laravel |
| **Multi-language** | i18n from day 1 — retrofitting is expensive |
| **Offline / synchronization** | mobile only; changes the app's architecture |
| **Uploads / files** | `file-storage` (S3/R2) |

**2.3 — Extract and confirm** two lists: **screens** and **entities**. Confirm both — they are the
backbone of the design and of the data model.

**2.4 — Write the initial PRD.** `Read(".claude/skills/prd.md")` and write `docs/PRD.md` with what
exists so far: problem, audience, "is not", flows, capabilities, screens, entities, first version.
Mark the sections still to fill in (stack, design) with `<pending: phase S3/S5>` — the PRD is completed
over the course of /start and closes during execution. **Real content from the interview, not a template.**

---

# PHASE 3 — Stack

**The doctrine** (see `rules/default-stack.md`): barring a real impossibility, every project uses the
house stack — **Next.js · Laravel + Livewire + Filament · MySQL (phpMyAdmin) or PostgreSQL ·
Flutter · Unity 6 for mobile games**. The questions choose **which pieces come in**, not pieces from
outside the house. Off the stack only with a reason recorded in `docs/DECISIONS.md`.

Pre-selection by type (show the right recommendation up front):

| Type | Default recommendation |
|---|---|
| Website / landing | **Next.js 16** (static/hybrid) · Laravel only if there is a members area |
| SaaS / platform | **Laravel + Livewire + Filament + MySQL** |
| Mobile app | **Flutter + Laravel API + MySQL** |
| Mobile game | **Unity 6** (+ Laravel API if it has a backend) |
| Internal software | **Laravel + Livewire + Filament** |
| API only | **Laravel API + MySQL** |

Cascading questions (`AskUserQuestion`, each answer closes options in the next — do not show
options already excluded):

1. **Web frontend** (if there is web): Livewire 4 + Flux · Next.js 16 · both (public site Next + app
   Livewire)
2. **Backend**: Laravel 13 · none (Next full-stack — only for sites with no real server logic)
3. **Database**: MySQL 8.4 (recommended — cPanel/Ploi production, managed by **phpMyAdmin**) ·
   PostgreSQL 17 (rich types/heavy JSON) · SQLite (dev/prototype only)
   > ⚠ **Dev and production on different engines is the most expensive pitfall** — SQLite ignores `VARCHAR` and
   > MySQL's strict mode; the errors only show up at deploy. If production = MySQL, CI runs MySQL.
4. **Backoffice**: Filament v5 (only with Laravel) · none
5. **Mobile app** (if applicable): Flutter · none in this version
6. **Local environment** — where this runs on the machine of whoever develops. It is not a detail: it decides the
   dev URL, the real DB engine and half the "it only happens here" bugs. Phase 0 already detected
   what can be detected — **ask only what is missing**, and show the detected one as the recommendation.

| System | Options (recommended first) |
|---|---|
| macOS | **Laravel Herd** · Docker/Sail · native (`php artisan serve` + Homebrew) · MAMP |
| Windows | **Laragon** · Herd Windows · WSL2 (+ Sail) · XAMPP · native |
| Next.js / Flutter | there is no "environment": `npm run dev` / `flutter run`. Ask only for the Node/Flutter versions and the manager (nvm · fnm · asdf · none) |

   Cascading questions (`AskUserQuestion`), only the ones Phase 0 did not answer:
   a) **Environment** from the table above.
   b) **Local DB engine** — it has to be **the same engine as production** (question 3). Herd and Laragon
      ship MySQL; Sail ships whatever is in `docker-compose.yml`. SQLite in dev with MySQL in
      production **only with a decision recorded** in `docs/DECISIONS.md`.
   c) **Where the dev server answers** — `https://<name>.test` (Herd/Laragon) · `http://localhost:8000`
      · `http://localhost:3000` · its own port. Ask as well whether there are **reserved ports** on this
      machine (another project, another service) — a port collision is a silent failure.
   d) **PHP and Node versions** and where they come from (from the environment, or installed separately with nvm/asdf).
   e) **More than one machine?** If so: one environment row **per machine**, and the scaffold (E1)
      carries `.gitattributes` with `* text=auto eol=lf` — without that the same commit produces different
      builds on Windows and macOS.

   **Record:** **Local environment** table in `docs/PRD.md` §Stack (E1 propagates it to
   `.ai/guidelines/00-project.md`) · dev↔production divergence in `docs/DECISIONS.md` · paths,
   ports and exact versions in the Brain memory (Phase 6.4) — **never in `PROGRESS.md`**.

**Games:** mobile → **Unity 6** is the house route (the `unity-*` skills come in when available in the
installation — check `memory/SKILL_INDEX.json`; without them, execution treats Unity as a manual stack
documented in `docs/DECISIONS.md`). **Web** game → a conversation: Next.js+canvas/Phaser vs Unity
WebGL, record the choice.

Record the stack in the PRD (Stack section) and the reasons in `docs/DECISIONS.md`. Technical deltas per stack:
`$REF/stacks/`.

---

# PHASE 4 — Infrastructure

Everything `AskUserQuestion`:

1. **GitHub repository** — propose the name derived from the project (kebab-case) and **check first**:
   `gh repo view <owner>/<name> 2>/dev/null` — if it already exists, ask whether that is the one to use (and then
   execution connects instead of creating) or another name. Visibility: public · private (warn: rulesets
   on private require a Pro/Team plan) · org or personal.
2. **Database** — confirm the one from Phase 3 in an infra context (where it lives: local · cPanel ·
   VPS/Ploi) and the management client: **phpMyAdmin** (house default) · TablePlus/DBeaver · CLI only.
   Record in `docs/DECISIONS.md`; it does not enter the scaffold.
3. **Deploy** — **cPanel** (skill `deploy-cpanel`) · **Ploi** (`deploy-ploi`) · Vercel (Next only) ·
   Docker/VPS (`deploy-docker`/`deploy-vps`) · decide later. **It is not configured in /start** —
   it is recorded, and execution closes it in the final phase ⛔.

---

# PHASE 5 — Design

**5.1 — Does anything already exist?** (`AskUserQuestion`):

| Option | What happens |
|---|---|
| **Yes — brand/manual/Figma/site** | Ask **what and where**. Request the artifact (file, URL, export). The tokens are **extracted and measured** from it during execution — never invented. Record the source in `docs/DESIGN.md` |
| **Yes — but only references/tastes** | Ask for the links. Principles are extracted, nothing is ever copied |
| **No — I want to choose now** | **Directions page** (5.2) |
| **No — explore during execution** | Record "free exploration"; execution runs `design-shotgun` in depth |

**5.2 — The design directions page (interactive Artifact).**

It is not a text questionnaire — it is a page that **shows** the directions:

1. Read the template `$REF/design-directions.html`.
2. **Customize it with what you already know**: replace the token `{{PROJETO}}` with the name, and adjust the
   directions to the product (a management SaaS does not show the "playful arcade" direction first; a
   game does). You may edit/swap palettes and typographic pairs inside the existing structure —
   **do not rebuild the page**.
3. Publish it with the `Artifact` tool and give the URL.
4. The user **sees and selects** on the page: overall direction, typographic pair, palette, shape,
   density, and adds reference links. At the end he presses **"Generate summary"** and the page
   produces a block of text to copy.
5. He pastes the block back into the chat. You interpret it and write `docs/DESIGN.md` with the choices
   — which execution turns into measured tokens and components.

**If the product is frontend-first (website/landing):** the choice here is a **direction**, not the
final design — record in `DESIGN.md` that execution should open up the range (`design-shotgun` with
variants inside the chosen direction).

---

# PHASE 6 — Save and hook in

1. **Complete `docs/PRD.md`** — stack and design already decided; remove the `<pending>` markers.
2. **`docs/DECISIONS.md`** — stack and reasons · DB and client · deploy · off-house if there is any.
3. **`PROGRESS.md`** at the root, in the `$REF/progress-format.md` format — **this file is the
   SHARED memory of the project**: it goes into git, anyone who clones sees the state. (The Brain memory
   is individual per user; `PROGRESS.md` is the public version — the two point at each
   other, they never duplicate content.)
4. **Brain memory** — create/update `memory/projects/<name>.md` with `directorio:`, stack,
   state "interview done, execution not started" and the pointer `**Kick-off phase:** see
   PROGRESS.md`. (It comes for free from the survey, with no questions.) Add the line
   `**Machine:** <OS> · <environment> · PHP <v> · Node <v> · local DB <engine> · dev at <URL> · reserved
   ports <list>` — **this is where the paths and the ports live**, because `PROGRESS.md`
   forbids them. Second machine = second line, not a replacement.
5. **Final summary** to the user: what was decided and what execution is going to do. **Moving forward is
   assumed** — do not ask whether he wants to continue. The only gate is a two-option
   `AskUserQuestion`, with the first one as the recommendation:
   > **Move on to execution?**
   > 1. **Yes, go ahead** (recommended) — runs `execute-project` from E1
   > 2. **No — I only wanted the plan** — everything stays in `docs/` + `PROGRESS.md`
   With no useful answer, route 1 is the one that holds.

## Next step (chain)

- Confirmed → **`execute-project`** (scaffold → design → gate → final development).
- Only wanted the plan → everything stays in `docs/` + `PROGRESS.md`; execution runs when he wants it.
- Backlog to organize first → `plan-waves` after execution opens the issues.

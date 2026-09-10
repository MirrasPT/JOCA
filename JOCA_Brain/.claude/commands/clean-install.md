# /clean-install — audit, optimize and consolidate JOCA installations

For when someone has been using JOCA for a while (possibly with several copies/versions on the
same machine) and complains about **excessive token consumption**. This command copies nothing
blindly: it audits everything that exists, compares it against the current `Joca-Open-Source` baseline,
proposes a table of optimizations, and only once approved does it consolidate the memory, archive the
old installations in an `Old` folder and promote a new, clean and optimized installation to production.

**Objective in every phase: reduce tokens without losing memory.** Never delete — archive. Never
apply without showing the table and waiting for explicit approval. It always ends with **graphify**
installed and running over ALL the projects connected to JOCA + JOCA_Brain itself — it is the final
piece that makes the memory (of code AND of knowledge) cheap to consult from then on.

Scope: the user's machine (JOCA installations + related config/MCPs/CLIs + every project that JOCA
already knows via `memory/projects/`). It touches no files outside that.

---

## Phase -1 — Where this is running (read first, always)

This command **must never run from inside an already existing, mature JOCA installation**
(`memory/soul.md` already calibrated, with no sign of having just been cloned). If it ran there, it
would be trying to archive/move the very folder Claude Code is running from — self-reference, a risk
of inconsistent state mid-flight. The correct flow (documented in the `clean-install.md` at the root of
`Joca-Open-Source` + in the public `README.md`): the user creates a new, empty folder, opens a Claude
Code terminal there, and the bootstrap clones `Joca-Open-Source` INTO it before this command
starts.

**Check at startup:**
- If the cwd's `memory/soul.md` is already calibrated (no `<YOUR_*>` placeholders) and the repo has a
  history of more than a few commits since the clone → probably a mature installation, not a bootstrap.
  STOP and instruct the user to create a new empty folder and start again from the root `clean-install.md`.
- Normal case (bootstrap): the cwd is a fresh copy of `Joca-Open-Source`, just cloned — **this
  folder is the NEW installation from now on, and it never enters the list of "old installations"
  that Phase 0/1 will discover elsewhere on the machine.** It is not moved later (see Phase 4).

## Phase 0+1 — Discovery and audit (delegated, read-only)

Dispatch `Agent(subagent_type="clean-install-audit")` with the brief:
- Objective: find ALL the JOCA installations on this machine **except the current cwd** (it is the
  new installation, see Phase -1 — it is not a finding, it is the baseline), inventory the related
  MCPs/CLIs, and compare each installation found against THIS cwd (it is already the most recent
  `Joca-Open-Source` baseline, cloned in the bootstrap — there is no need to clone another).
- Mandatory Step 0: `Read(".claude/agents/clean-install-audit.md")` already carries the complete
  doctrine (the agent reads it to itself as its first step).
- Apply nothing. Delete nothing. Only read, compare, and write the report.
- Return: the report's path (`~/joca-clean-install-report-<date>.md`) + a 3-5 line summary
  (how many installations found, the most serious finding, the estimated token saving).

While there is no report, do not advance to Phase 2.

## Phase 2 — Recommendation table + single gate

Read the agent's report. Present the user with a numbered table:

| # | Category | Item | Current state | Recommendation | Impact (tokens) | Risk |
|---|---|---|---|---|---|---|

Categories: **OPTIMIZE** (cut bloat without changing behavior — agent descriptions, bloated
CLAUDE.md/soul.md) · **UPDATE** (skill/agent/rule behind the baseline) · **DELETE**
(dead skill, banned MCP installed, duplicate installation) · **MCP→CLI** (swap an expensive MCP for an
equivalent CLI) · **REPLACE** (a different tool/platform cuts the cost) · **KEEP**
(already fine — listed for transparency, not for action).

Also ask, explicitly and separately from the table: **do the current `soul.md`/`CLAUDE.md` still
reflect who the person is?** Show the current values (autonomy_level, communication_mode, the
user's alignment) and ask via `AskUserQuestion` — keep it as it is, or recalibrate
(the same 4 questions as `/migrate` Phase 4: autonomy, communication, error handling, auto-test).

**Mandatory gate** — accept an answer in any of these forms:
- `all` — applies everything in the table.
- `1,3,5` — only the numbers given.
- `all except 4` — everything but the one given.
- `cancel` — stops here, nothing changes, the report is kept for later review.

Nothing from Phase 3 onwards runs without this answer.

## Phase 3 — Apply (only after approval)

This folder (cwd) is already a fresh clone of `Joca-Open-Source` — there is no new checkout/clone to
do here, that already happened in the bootstrap (Phase -1). All that is left is to apply on top:

1. Apply only the items approved in Phase 2, in this order of priority: dead paths/security
   first, then optimizations (bloat cuts), then updates, then MCP→CLI/replacements.
2. **Consolidate the memory of ALL the old installations found** (this installation, being
   fresh, does not yet have `memory/projects/`, `memory/tools/`, `memory/feedback/` populated):
   - `memory/projects/*.md` — by filename; on conflict (same name, different content in
     2+ old installations), the most recent `mtime` wins — append a note "older content
     replaced, see the archive in `Old/`" so the trail is not lost.
   - `memory/tools/*.md` — likewise.
   - `memory/feedback/*` — **never discarded**: aggregate everything; on a FILENAME conflict
     (not a content one), rename with the source installation's suffix instead of overwriting.
   - `memory/soul.md` — recalibrated (if so decided in Phase 2) or copied exactly as it is from the
     most recent old installation.
3. Regenerate `SKILL_INDEX.json` (`python3 .claude/scripts/build-skill-index.py`) and the mirror agents
   (`node .claude/scripts/skill-agents.mjs`) over this installation.
4. **Graphify is MANDATORY in this installation** (see `memory/tools/clis.md`) — if it is not
   installed on the machine, install it now: `uv tool install graphifyy` (entrypoint `graphify`) +
   `bash .claude/scripts/graphify-patch.sh`. Without this, Phase 6 below has nothing to run.

## Phase 4 — Archive the old installations + point production here (short confirmation)

**This installation (cwd) is NOT moved** — the user already chose this location deliberately when
creating the folder in the bootstrap (Phase -1). Only the old installations move, and only to the
archive. 1 line of confirmation before moving anything at all (soul.md: never irreversible/hard-to-undo
without explicit confirmation, even when it is "move" and not "delete").

1. Create `Old/` (default: `$HOME/Old`, or ask if something with that name already exists).
2. Move (never delete) EACH old installation found in Phase 0 to
   `Old/<original-name>-<date>` — preserve everything, including `.git/`.
3. Update `~/CLAUDE.md` (the JOCA section) to point at this installation's path (cwd) as the
   production one — it is the only "point production here" this command does; no folder is moved
   anywhere else.

## Phase 5 — Final verification

1. `node .claude/scripts/joca-doctor.mjs` on the new installation — it has to come out clean (exit 0).
2. If there is a `JOCA_OS`: `npm run setup` + start it + `curl` the health-check (the same pattern as
   `/migrate` Phase 6).

## Phase 6 — Graphify on every project (mandatory, always runs at the end)

Only after everything else is done (memory consolidated, installation promoted, `joca-doctor.mjs`
clean): walk through ALL the projects connected to JOCA (one `.md` per project in
`memory/projects/*.md`, each with a `directorio:`/`path:` field in the frontmatter) and run
graphify on each one — this is the reason for all the rest: giving JOCA/Claude Code a code
memory that is cheap to consult instead of reopening giant files.

For each project (the path from the frontmatter, read one by one):

```bash
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<project-path>'))"
"$PY" .claude/scripts/graphify-deps.py "<project-path>"
```

**Inclusion/exclusion policy (mandatory, do not change it per project):**
- **Include everything that is content**: code (html/css/js/ts/php/py/etc.), text (with the content,
  not just the filename), images (jpg/png/webp/svg/etc.), media files (video/audio).
  graphify v0.8.5+ already maps code + docs/PDF/images/video natively — do not restrict types.
- **Exclude only infra/dependencies**: `node_modules/`, `vendor/`, `.venv/`, build output
  (`dist/`, `build/`, `.next/`), lockfiles (`package-lock.json`, `*.lock`), cache, `.git/` — it is
  exactly what the repo's `.graphifyignore` files already do (root + `JOCA_Brain/`); **do not invent
  a new `.graphifyignore` per project** unless the project has obvious noise of its own.
- Never exclude something for BEING an image/media/text — only for BEING infra/dependency/build.

After each project: confirm that `<project>/graphify-out/graph.json` was created/updated
(recent `mtime`). If a project has no code (only design/content/marketing), flag it and
skip it — the same rule as `/start`.

**At the end, run it over JOCA_Brain itself too** (knowledge + code, not just one of the two):

```bash
node .claude/scripts/joca-graph.mjs                # knowledge graph (skills/agents/commands/projects)
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"   # the Brain's own code
```

Final report of this phase: how many projects had a stale/non-existent graph and were
(re)generated, how many were skipped (no code), and confirmation that `JOCA_Brain`'s own graph
is fresh.

## Phase 7 — Final report of the command

- what was archived (paths inside `Old/`);
- what was merged (consolidated memory, with a note on any conflict resolved by mtime);
- what was optimized (with a before/after token estimate — CLAUDE.md+soul.md, agent
  descriptions, MCPs swapped);
- graphify state: installed/updated, how many projects gained a new graph, JOCA_Brain
  included;
- what was left pending for the person to decide by hand (e.g.: skills flagged as "possibly
  dead" but not deleted automatically).

---

## Rules (non-negotiable)

- **Never run this command from inside an already existing, mature JOCA installation** (see Phase
  -1) — only from a new, empty folder, freshly cloned in the bootstrap. If the wrong scenario is
  detected, stop and redirect to the bootstrap, do not continue.
- **This installation (cwd) never moves** — only the old ones go to `Old/`. There is no "promote by
  moving", there is "archive the others and point `~/CLAUDE.md` here".
- Never delete an old installation — only move it to `Old/`.
- Never apply a recommendation without it having gone through the Phase 2 table and the gate.
- Never copy `memory/` blindly — always go through the Phase 3 consolidation by `mtime`.
- `browser-use` and the Playwright MCP (`@playwright/mcp`) are **DELETE**-category findings
  whenever they are found — policy in force since 2026-08-05 (see `memory/tools/clis.md`).
- `graphify` is **mandatory** — install it if missing (Phase 3), never skip Phase 6.
- Phase 6 never runs before Phase 4/5 — it only makes sense to generate graphs over the already
  verified installation, not over the old one that goes to `Old/`.

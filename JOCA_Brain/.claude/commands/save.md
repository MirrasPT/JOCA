# /save — Save the session + project feedback

Runs at the end of every session. Saves state, updates the memory, captures feedback about the project and about JOCA. Zero questions to the user — everything inferred from the session.

---

## STEP 1 — Identify the project

Detect the current directory. Resolve `memory/projects/<name>.md`.
If it does not exist, create a minimal entry with frontmatter.

**Startup-context budget — measure BEFORE writing.** Everything auto-loaded is paid for in
every session. Snapshot the bytes now; STEP 8 compares:

```bash
wc -c ~/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/.claude/rules/*.md \
  <project-root>/CLAUDE.md 2>/dev/null | tail -1 > /tmp/joca-save-bytes-<slug>.txt
```

---

## STEP 2 — Save the session state

Update `memory/projects/<name>.md`:

| Section | Action |
|--------|-------|
| **Current state** | Replace with a brief description of the present state |
| **Decisions taken** | Append with the date `YYYY-MM-DD` |
| **Pending** | Replace with the current list |
| **Last session** | Date + 1-line summary |

**⚠ Concurrent sessions — `Edit`, never `Write`.** If there are other active Claude sessions
(`ListAgents`), the project's memory has more than one author. **Re-read the file immediately
before writing** and always use a surgical `Edit`. A `Write` would have wiped the other session's
work — it only came to light because `Edit` warned "the file had been modified on disk". Entries from the same
day are numbered with the suffix `(a)`/`(b)`/`(c)` so they do not collide.

**Git sub-repos (a repo nested in a sub-directory):** some projects have their OWN git repo in a subdir (e.g. `<JOCA_ROOT>` = the `JOCA` repo, but `JOCA_OS/` is a separate local-only repo). Detect sub-repos (`git -C <subdir> rev-parse --is-inside-work-tree`) and report pending commits PER repo in STEP 8 — otherwise work in a nested repo stays uncommitted and invisible in the parent repo's `git status`. (Source: JOCA 2026-06-25.)

---

## STEP 2a-bis — PROGRESS.md (state shared through git)

If the project root has `PROGRESS.md` (format in
`.claude/reference/start/progress-format.md`):
1. Update **Current state** (1-3 lines) and the **Phases** table if any changed — always with the
   Evidence column (path/command), never just the ✅.
2. Add 1 line to the **Diary**: `- <date> · <machine/user> · <what happened>`.
3. **Commit it together with the rest of the work** — it is the SHARED memory: what is not committed does
   not exist for the other collaborators. (The Brain's memory stays individual; the two point at each
   other, they do not duplicate.)
4. **If it does NOT exist** and the project has already taken work from more than one session: create it with
   the observed state (git + docs + issues), without an interview. It is the shared state; its absence is the
   reason the next collaborator asks what is already written.

## STEP 2b — Concept check (projects with mutable rules)

If the project has a `CLAUDE.md` with a `### Concept` section (common in games, rules engines, apps with a mutable domain):
1. Read the `### Concept` section of the project's `CLAUDE.md`
2. Compare it with the current `memory/projects/<name>.md`
3. If there is divergence (e.g. the field changed from 9×10 to 7×9, new cards added, rules altered) → propose a surgical update (1 line of diff, do not rewrite the whole section)
4. If there is no divergence or no `### Concept` exists: skip silently

---

## STEP 2c — Structured checkpoint (restorable)

Write a machine-readable snapshot of the session (adapted from gstack context-save) — restored by `/resume`. It complements the prose of STEP 2, it does not replace it.

```bash
printf '## Decisions this session\n- <...>\n## Remaining work\n- <...>\n## Next action\n- <...>' | node .claude/scripts/joca-checkpoint.mjs save --slug <project> --title "<short-slug>" --status wip
```
⚠ **`--slug <project>`** with the name from STEP 1, not the default. Without it the slug comes from the cwd's
repo and concurrent sessions mix checkpoints in the same folder — `/resume`'s `latest` starts returning
another project's.
- Body = decisions this session + remaining work + next action (1 line each).
- `--status done` if the task ended up finished; otherwise `wip`.
- The helper writes `memory/checkpoints/<slug>/<ts>.md` (frontmatter branch/ts/status), prunes to the last 12, atomic rename.

**Atomic decisions/learnings** from this session (non-obvious, reusable) → record them in the Brain log (reversible, without asking) — `joca-brain decide/learn` syntax: see `/learn` (single source).

---

## STEP 2d — State that lives outside git

Saving the memory is worth nothing if the project's **content** is left behind. Before closing:

**a) Stale bridge artifact.** If the project's `CLAUDE.md` declares an exportable state artifact
(pattern `snapshot/`, `*.sql`, `dump/`, `backup/`), compare the artifact's `mtime` with that of the
live state (Docker volume, local DB, `wp-content/uploads`). Older artifact → **re-export**
(reversible, without asking) or report it as a **critical** pending item in STEP 8.
> Real case: a session did content work in a DB inside a Docker volume and never
> re-exported the snapshot. 12 days later the other machine opened a silently old site — July assets
> in the folder, a June DB in the volume — and it cost a complete staging→local migration.

**b) Cloud sync is not project synchronization.** A folder in MEGA/Drive does **not** carry dotfiles
(`.git`, `.env`, `.gitignore`) or runtime state (volumes, DBs). "It's in MEGA, it must be up to
date" is false by default. Record in the project's memory **what the bridge artifact between
machines is**.

**c) The Brain's memory may not travel through git — CONFIRM, do not assume.** What is ignored and where
`origin` points **varies per installation** (public vs private clone, `.gitignore` edited by
hand). Do not take either of those as fact: measure, in 2 commands, before deciding.

```bash
git remote -v                                    # is the origin here public or private?
for p in memory/projects/x.md memory/feedback/x.md memory/decisions/x.md \
         memory/learnings/x.md memory/knowledge/x.md memory/checkpoints/x.md; do
  printf '%-32s ' "$p"; git check-ignore -v "$p" || echo 'NOT IGNORED'
done
```
⚠ Test a **file inside** the folder, not the folder: a `memory/projects/*` pattern ignores the
content and `git check-ignore memory/projects` returns **nothing** — it looks as if it is not ignored, but it is.
⚠ There are **negation exceptions** (`!memory/projects/JOCA.md`): "the folder is ignored" does not imply that
every file inside it is.

Reading the result:
| Measurement | Consequence |
|---|---|
| Ignored | Committing `memory/` takes nothing anywhere → crossing via **`/sync-brain`** (bridge folder) |
| Not ignored + **private** `origin` | The memory travels through git → commit+push is enough; say so in STEP 8 |
| Not ignored + **public** `origin` | ⚠ **Critical pending item**: memory of private projects on its way to a public repo — stop and report before any `git add` |

If the session produced decisions/checkpoints the other machine needs, say so in STEP 8 with the route
the measurement indicated (`/sync-brain` or push).

> It was a hardcoded fact that created this defect: the previous version of this step claimed "they are all in the
> `.gitignore`" and "the `origin` here is the public one". In a production installation both were false.

**d) A warning in the documentation is not a fix.** If you are writing "⚠ do not run X", also record it
as a **pending fix** — a `⚠ do not run npm test` survived for weeks hiding a data-loss
defect (the tests did `fs.rmSync` on the real `DATA_DIR` and deleted notifications
and chat).

---

## STEP 3 — Project feedback (inline, auto-extract)

Analyze the conversation and extract learnings with an impact on future sessions:

### A. Terminology clarified
Expressions that caused ambiguity, with the correct definition.

### B. Rules and preferences discovered
Constraints or behaviors that turned out to be important.

### C. Tool limitations
Documentable limitations of models, MCPs, or APIs that affected the result.

### D. Templates or formats validated
Structures tested and approved during the session.

### E. Workflow corrections
Steps of the project's process that were corrected or improved.

**Destinations:**
- Glossaries, rules, templates, limitations → the project's `CLAUDE.md` gets **at most 1 line per `/save`, and only if the rule must hold in EVERY session of the project** (the rule in 1 sentence + pointer `→ memory/projects/<name>.md`). First `grep -n -i "<topic>" CLAUDE.md` — a line on the topic already exists → **replace or merge it, never append another**. When in doubt, it goes to the project memory: `CLAUDE.md` is context paid on every message, the memory only when it is read
- New structural context → append to `memory/projects/<name>.md`

**Rule:** only write what the session brought that is new. Surgical edits — do not rewrite whole files. If there is nothing relevant, skip this step silently.

**Validity rule — recipes and live state.** When recording a command recipe (deploy, rsync,
FTP, a CLI invocation), save **the conditions under which it was validated**: number of cases, file
size/type, tool version, date. A single sample is marked `validated 1×`. An FTP recipe
generalized from one large file was followed as fact and broke a site. The same holds
for claims about live state (counts, IDs, credentials): date them and mark them perishable — `/resume`
(2c) lists them for revalidation.

---

## STEP 4 — JOCA feedback (auto-extract, feeds /upgrade-joca)

Check whether the session revealed gaps in the JOCA toolkit:

| Category | Examples |
|-----------|----------|
| `workflow-gap` | Missing step in a process that caused rework |
| `doc-gap` | Skill/command documented differently from what it actually does |
| `missing-skill` | Skill or command that should exist and does not |
| `skill-improvement` | Existing skill that needs improvements |
| `tool-reliability` | MCP or tool that failed, timed out, was blocked |
| `discovery-gap` | Info that should have been asked upfront but was not |
| `command-improvement` | Existing command that needs adjusting |

If you find items, write `memory/feedback/session-<YYYY-MM-DD>-<HH-MM>.md` with frontmatter:

```yaml
---
type: feedback-joca
source: auto-extracted-by-save
session_date: <YYYY-MM-DD>
project: <name>
---
```

Each entry with: `**Category:** ... | **Severity:** critical/high/medium/low | **Description:** ... | **Affected component:** ... | **Suggested fix:** ...`

If there is nothing relevant, do not create a file. Never ask the user.

---

## STEP 5 — Knowledge graphs (optional, non-blocking)

```bash
# Interpreter: Windows uses `python` (`python3` is the empty Store stub); macOS/Linux use `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
# Try a rebuild — if graphify is not available, skip silently
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<project-path>'))" 2>/dev/null || true
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || true
```

Note: always use the Python API directly. The `graphify` CLI has known bugs.
Note: the scan excludes `vendor/`, `node_modules/`, `storage/`, `out/`, `public/` by default (to avoid tens of thousands of noise nodes).

---

## STEP 6 — Reindex the toolkit (if JOCA was changed)

Only runs if files in `.claude/skills/`, `.claude/agents/` or `.claude/commands/` were modified in this session.

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null || true
```

If skills/agents/commands were **added, renamed or removed**, the derived inventory ends up lying. Realign **now**, not in another command:

```bash
python .claude/scripts/build-skill-index.py    # macOS/Linux: python3 — regenerates memory/SKILL_INDEX.json
node   .claude/scripts/joca-doctor.mjs         # catches dead paths/indexes (exit 1 if there is a ✗)
```

Then a surgical edit in `memory/INDEX.md` (the counts + the new component's line) and, if it is a new command, in the `## Commands` table of `JOCA_Brain/CLAUDE.md` (one row, no prose — that is where the command table lives) and in the `/help-joca` list. Nothing in `/save` writes to `.claude/rules/` (auto-loaded): new doctrine goes to `.claude/reference/`. **A component that no index surfaces is an invisible component** — relevance matching never reaches it.

> Historical note: this used to be the old `/sync-questionnaires`, which audited form questionnaires. The questionnaires no longer exist (the survey became a conversation — see `/start`), so what is left is reindexing, and the right place is here.

---

## STEP 7 — Update ~/CLAUDE.md (if applicable)

`~/CLAUDE.md` holds **only the project name** — never folders, stack, status or dates.

| Level | File | What you write |
|---|---|---|
| 1 | `~/CLAUDE.md` | **name only**, and only when the project is **new** or no longer exists |
| 2 | `memory/INDEX.md` §Projects | 1-line summary + folder paths |
| 3 | `memory/projects/<slug>.md` | **everything else** — the default destination |

New directory, stack change or new status → levels 2/3, never level 1.

---

## STEP 8 — Report

**Startup-context budget — compare with the STEP 1 snapshot:**

```bash
before=$(awk '{print $1}' /tmp/joca-save-bytes-<slug>.txt)
after=$(wc -c ~/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/.claude/rules/*.md \
  <project-root>/CLAUDE.md 2>/dev/null | tail -1 | awk '{print $1}')
echo "startup: $before → $after ($((after-before)) bytes)"
```
Grew by more than **250 bytes** → do not close: move the excess to `memory/projects/<slug>.md` (or `reference/`) and measure again.
The number always goes into the report — that is what makes the bloat visible session after session.

```
SAVE — <project-name>
═══════════════════════

State:
  ✓ memory/projects/<name>.md updated
  ✓ Decisions: N recorded | Pending: N items

Project feedback:
  ✓ CLAUDE.md — 0 or 1 line (rule + pointer; the detail went to memory/projects/)
  ✓ Startup: <before> → <after> bytes (<delta>; ceiling +250)
  ✓ memory/projects/<name>.md — new context added
  — No new learnings this session

JOCA feedback:
  ✓ memory/feedback/session-<date>.md — N items (X critical, Y high)
    → Consider /upgrade-joca
  — No gaps detected

Extras:
  [✓ Graphs updated]
  [✓ Bridges recompiled]
  [✓ SKILL_INDEX + INDEX.md realigned | joca-doctor clean]
  [✓ ~/CLAUDE.md — new project name added]

Session saved.
```

---

## Notes

- ZERO questions. Everything inferred from the session.
- Project feedback (STEP 3) and JOCA feedback (STEP 4) are auto-extracted here — the old `/feedback-projeto` and `/feedback-joca` commands were removed (merged into this `/save`).
- If there is nothing to save in a step, skip silently — do not report "nothing found" for every empty section.

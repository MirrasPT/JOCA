# /resume — Load the session context

Runs at the start of every work session on a project.

## Steps

### 1. Identify the current project
Determine the **target path**: the 1st argument if given (e.g. `/resume <YOUR_PROJECTS_DIR>\MyProject`), otherwise the CWD.

**Resolve FIRST by path (`directorio:` in the frontmatter), and only fall back to matching by name if the path does not match.** A parent folder and a subdir can have separate entries (umbrella vs sub-project); matching by name first loads the wrong one.

**Priority 1 — by PATH** (`directorio:` == target path):
```bash
# EXACT path match — covers BOTH forms of the field (1 path OR list of paths)
grep -rIl -e "^directorio: *<target-path>$" \
          -e "^directorio: *\[.*<target-path>[],]" memory/projects/*.md
```
⚠ A `grep` with only the 1st form **does not match** entries with `directorio: [a, b]` and sends the resolution
to the name fallback for no reason — the field has been a list ever since there are projects on 2 machines.
1. **Exact match** (`directorio:` == target path) → that is the entry. Load it.
2. **Multiple exact matches** (e.g. `<name>.md` + `<name>-geral.md` both with the same `directorio`) → load the **umbrella** first (the one with `-geral` in the name, or the one with the broadest description) and list the siblings.
3. **Target path is the PARENT folder of entries** (no exact match, but there are entries whose `directorio` starts with `<target-path>`) → list them all and present the umbrella if there is one, not a single sub-entry.
4. **Target path is a SUBDIR of an entry** → load that parent entry.

**`directorio:` accepts a LIST.** A project can legitimately live in more than one path — this
user alternates between 2 machines (macOS + Windows) and several projects exist on both. The
frontmatter supports both forms:

```yaml
directorio: /Users/<user>/Projectos/my-project                   # 1 path
directorio: [/Users/<user>/Projectos/my-project, C:\Users\<user>\Projetos\my-project]
```

Priority 1 matches against **any** element of the list. Only if none matches do you drop to the
name fallback — and that is where the warning makes sense.

**Priority 2 — by NAME** (fallback, only if Priority 1 returned nothing — e.g. the `directorio:` in the memory is stale/moved, or the folder does not line up with any `directorio`): match the **basename of the target path** (normalized: lowercase, `_`/spaces→`-`) against the `name:`/file of the entries in `memory/projects/`. If it matches, load that entry **and warn** that it resolved by name because the `directorio:` did not match.
⚠ **The correction advice depends on the case:** if the target path is a legitimate *second machine* →
**add** the path to the `directorio:` list, never replace it (replacing breaks resolution on the
other machine). Only suggest replacing when the old path no longer exists.

> Example (by path): `/resume <YOUR_PROJECTS_DIR>\MyProject` → umbrella `my-project-geral.md` (`directorio` == parent folder). `/resume <YOUR_PROJECTS_DIR>\MyProject\2026_New_Platform` → `my-project.md` (`directorio` == the platform's subdir). Never the other way round.

**No relation by path or by name** → suggest running `/start` first.

### 1b. Optional arg: `<git-remote-url>`

If the command is invoked with a 2nd argument (a GitHub/GitLab remote URL):
1. Check whether the local repo has that remote: `git remote -v`
2. If it does not: `git remote add origin <url>` → `git fetch origin` → compare the working tree vs `origin/<default-branch>`
3. Report divergence **non-destructively** (never `reset --hard` without explicit confirmation)
4. If it has one but points to a different URL: report the conflict, do not change it automatically

### 2. Read the project context
Read the **entry resolved in step 1** — current state, decisions taken, pending items. If it is an umbrella, follow the `[[links]]` to the sub-entries relevant to what the user is about to do (do not dump them all at once).

#### 2a. Restore checkpoint + Brain (machine-readable)

Before the prose, load the structured state (adapted from gstack context-restore):
```bash
node .claude/scripts/joca-checkpoint.mjs latest --slug <project>   # snapshot: decisions/remaining/next action
node .claude/scripts/joca-brain.mjs active                          # active decisions (event-sourced)
```
⚠ **`--slug <project>` is mandatory, with the name resolved in step 1.** Without it the script derives the
slug from the **cwd's repo**, and two concurrent sessions write into the same folder: `latest` has already
returned another project's checkpoint (I saved the rate-it-plus one at 20:54, another session wrote at
21:29, and my "next action" became invisible to `/resume`). The file is not lost — it just stops being
found by the path `/resume` uses.
- The checkpoint gives the exact **next action** from the previous session (cross-branch restore).
- The Brain's active decisions are the atomic source of truth (over the prose, in case of conflict).
- Note: the `session-intake` hook already injects the recall (decisions+learnings) at startup; this step is the explicit restore + next-action inside `/resume`.

#### 2b. Detect memory vs git drift

After reading the project's memory, compare it with the real git state:
```bash
git log --oneline -5       # last 5 real commits (current branch)
git branch -a | head -20   # ALL branches (local + remote)
git log --oneline --all | head -10  # history of ALL branches
```
- **Before declaring work "lost/never committed": running `git log --all` + `git branch -a` is a mandatory Step 0.** `backup/*` and `stash/*` branches, or any branch other than the current one, hide real work after a remote switch. If you detect `backup/*` → `⚠ A backup branch exists — check before rebuilding work`. (Real case: a complete backoffice was on `backup/local-pre-dev` and was declared lost.)
- Extract the date from the memory's **"Last session"** section
- If the most recent commit is **>14 days after** the memory's date: alert with `⚠ MEMORY STALE — the latest commit is X days newer than the memory`
- If there are commits whose messages contradict the "Current state" (e.g. the memory says "backend pending" but there are "feat: complete backend" commits): alert and re-infer the state from git

Never trust the memory blindly if git diverges. Read key files (e.g. the project's `CLAUDE.md`, `package.json`) to confirm the real stack/state.

**Mandatory branch — folder full but WITHOUT `.git`.** The three commands above assume the repo exists;
without `.git` they return `fatal: not a git repository` and the step **collapses silently**. Test first:
```bash
git rev-parse --is-inside-work-tree 2>/dev/null || echo "NO GIT"
```
If it prints `NO GIT` **and** the folder has files (≠ case 2d, an empty folder):
1. Do **not** declare work lost or re-clone over it — the code is there, what is missing is the safety
   net (no `git diff`, no `git checkout --`, no history).
2. Look up the remote repo in the memory and compare the local `mtime`s with the date of the last push: if
   they line up, the content is the pushed content and only the `.git` folder is missing.
3. Report it as a **blocking** pending item: *"restore the `.git` before editing code"* — recipe:
   clone somewhere else, bring over just the `.git` folder, confirm `git status` is clean.
> Real case: a folder rename left the `.git` behind. The folder looked healthy and a whole session was
> spent editing in it with no history at all.

#### 2b-bis. PROGRESS.md — the shared state

If the project folder has `PROGRESS.md` (any project — `/start` creates it from scratch, `/save`
creates it in mid-flight projects): read it **before** the
Brain's memory and show the current phase in the summary. It is the shared version of the state — it may
have been updated by another collaborator or another machine since your last session, and in that case it
**beats the Brain** where the project's phases/state are concerned (the Brain holds your personal context, not
the canonical state). Divergence between the two → flag it as drift, same as 2b.

#### 2c. Perishable claims — the memory is a lead, not a fact

The drift in 2b compares memory ↔ **git**. It does not cover memory ↔ **live state** (DB, infra, accounts), which
rots silently and is where the real risk lives:

- The memory said "prod has 2 users (id2 Mirras, id14 Joana)". Reality: **4 users, with different
  IDs**, one of them a real person registered after go-live. Copying staging→prod data by
  `user_id` from that note would have written over a real user.
- The memory and two docs had for months announced a Bigorna admin that **did not exist**: the DB had 0
  users/0 roles. The `curl /admin/login → 200` reinforced the illusion — the door was there, the key was missing.
- An FTP recipe documented as *the* solution had been validated **once, with one file**.
  It failed on the 2 biggest ones and broke the site.

Mark as **perishable** any claim about live state (counts, IDs, credentials, infra,
command recipes) — dated and with the conditions under which it was validated ("validated 1×, a
600 MB file"). In `/resume`, list them as *to be revalidated*, not as fact.

**Hard rule: before any write to production derived from the memory, revalidate against the source.**

**"It's deployed" is perishable — measure live ↔ repo parity.** A health-check only proves the
address responds; a live a month behind answers 200 all the same. If the memory declares a **live
URL** *and* a **repo**, run the cheap check:
```bash
git log -1 --format=%H                                  # local sha
curl -sI <url-of-the-js-or-css-bundle> | grep -i content-length   # size served
ls -l <matching-file-in-the-local-build>                       # local size
curl -s <bundle-url> | grep -c "<symbol-from-the-last-commit>"  # did the commit make it live?
```
Size divergence, or the symbol absent → `⚠ LIVE BEHIND <sha>` in the summary, as a pending item.
> Real case: the live served everything and two features were missing. One of them was *hiding drafts* — the
> visible effect ("everything shows up") is indistinguishable from it not being deployed. Only comparing the
> static file on both sides revealed it.

#### 2d. Empty local folder — the project lives on another machine (or in another cloud)

**Before concluding "it is not here": if the target path is under a cloud mount** (`MEGA`,
`Dropbox`, `OneDrive`, `Google Drive`, `~/Library/CloudStorage/…`), a folder that is empty or has 1-2
files is as often a **migration mid-flight** as a new machine. Measure and look for the twin
before cloning anything:
```bash
ls -A <target-path> | head          # empty? a 1-file stub?
ls -d ~/<other-cloud-root>/*/<basename-of-target-path> 2>/dev/null   # the same name in another cloud
```
⚠ Search in a **targeted** way (`ls` on known paths, `-maxdepth`), never `find`/`grep -r` from `~`
or from the root of the mount: the home **contains** the mounts and the mount materializes every folder as it is walked
— it blows the timeout and goes to background with no result.
Twin found with content → that is the project: **fix the `directorio:` in the memory**
(add the new path to the list, do not replace blindly) and report the migration in the summary.
> Real case: the cloud path in the memory showed up as a 1-file stub and the code was in another
> cloud. Without this check, you work on top of an incomplete folder.

If the target path exists but is **empty** (a folder with files and no `.git` → see the 2b branch, not
this one), and the memory has the project with a remote repo:
it is not a new project, it is this machine that does not have it yet. Flow (repeatable — 2 alternating machines):

1. `gh repo clone <owner>/<repo> <path>` — for **private** repos use `gh`; `git clone https`
   hangs waiting for credentials.
2. List what is **gitignored and therefore did not come**: `.env`, database, `uploads/`, `storage/`.
   Fetch them from the real origin (VPS/cPanel/backup) — the project's memory says where.
3. Install dependencies (`npm install` / `composer install`).
4. **Check DB ↔ disk coherence**: records pointing to files that do not exist locally.
5. Only then start it up. Ports: respect the project's hard rules.

If the project involves image generation: check whether `Branding.md` or the memory entry defines `default_model`. If so, include it in the final summary to avoid using the wrong model.

### 3. Check the knowledge graphs

⚠ **Note:** `graphify update .` and `graphify . --update` do not work (CLI bug). Always use the Python API:
```bash
python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path>'))"
```

⚠ **Interpreter (Windows):** use `python`, **not** `python3` — in this environment `python3` is the empty Microsoft Store stub (`ModuleNotFoundError: No module named 'graphify'`) and the step fails silently. macOS/Linux use `python3`. Detect which one has graphify:
```bash
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
```

⚠ **Exclusions:** in PHP/JS projects, the recursive scan picks up `vendor/`, `node_modules/`, `storage/`, `bootstrap/cache/`, `out/`, `public/` → tens of thousands of noise nodes (>5000 = HTML skipped). Make sure these patterns stay excluded before rebuilding (`graphify-deps.py` already ignores them by default).

**Project graph:**
- If `graphify-out/graph.json` does not exist:
  - Project with code (Python/JS/PHP): run the Python API above
  - HTML/design/docs project: run `python JOCA/.claude/scripts/graphify-deps.py <path>` + `graphify cluster-only <path>`
- If it exists but is old (>7 days): run the Python API to update it
- If it exists: read `graphify-out/GRAPH_REPORT.md`

**JOCA graph:**
- If `<JOCA path>/graphify-out/GRAPH_REPORT.md` exists: read it for context on the available agents and skills
- If it does not exist: run the Python API with JOCA's path

### 3b. If the current project IS the JOCA toolkit

When the working folder is the JOCA repo itself (it contains `JOCA_Brain/CLAUDE.md`), surface the available maintenance workflows in the summary:
- `/upgrade-joca` — processes the feedback accumulated in `memory/feedback/`
- Windows note: the JOCA_OS is developed on macOS; on Windows the `joca-os-windows` skill adapts/tests/fixes the UI.

### 3c. For projects with existing code — propose an iteration flow

If the project already has code (detectable by the existence of `package.json`, `composer.json`, `src/`, `app/`):
- Do **not** just present the context passively
- Propose the iteration flow that fits the state:

| Detected state | Suggested flow |
|-----------------|---------------|
| Has bug/fix pending items | → `[/debug]` or a direct fix |
| Has feature pending items | → `[/plan]` → implement |
| State: "complete" but not deployed | → `[/deploy-executor]` or a deploy checklist |
| No clear pending items | → "What do you want to do? (review, feature, fix, deploy)" |

State the flow in 1 line in the summary, not as a question — the user redirects if they want something else.

**Projects with `composer.json` (Laravel/PHP) on Windows:** check `php -v 2>&1` at startup. If it fails (PHP is not on the PATH), alert with the path of the local PHP binary — `<YOUR_PHP_PATH>` — and suggest adding it to the PATH or using `& <YOUR_PHP_PATH> artisan ...`. Without this, any artisan/composer operation fails silently and you end up using Python/sqlite directly for the DB.

### 4. Present the summary to the user

```
Project: <name>
Stack: <stack>

State: <current state>

Last session:
- <what was done>

Pending:
- <item 1>
- <item 2>

Project graph: ✓ updated on <date>
JOCA graph:    ✓ available
```

Ready to work.

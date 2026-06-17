# /update-joca -- Sync local JOCA with upstream

Pull updates from the official repository and apply them safely.

**Repo:** `https://github.com/MirrasPT/JOCA.git`
**Direction:** GitHub -> local only. Never push, never commit, never alter remote.

---

## Phase 1 -- Locate JOCA and detect platform

### 1. Detect OS

Determine the platform to use the correct shell syntax throughout.

- **Windows:** `$env:OS` contains `Windows_NT`, or `node -e "console.log(process.platform)"` returns `win32`
- **macOS/Linux:** `uname` returns `Darwin` or `Linux`

All subsequent commands use `git` (cross-platform). Avoid bash-only constructs (`find`, `sed`, `date +%F`, `grep -rl`). Use `node -e` or `python3 -c` one-liners for any string/file processing.

### 2. Locate JOCA directory

Check these locations in order:
1. Current working directory (if it contains `JOCA_Logic/CLAUDE.md`)
2. Parent of current directory
3. `CLAUDE.md` `@memory` references or known project paths

```
git rev-parse --show-toplevel
```

If JOCA root not found: ask the user for the path and stop.

Store the resolved absolute path as `JOCA_DIR` for all subsequent operations.

### 3. Verify git repository with remote

```
cd <JOCA_DIR>
git remote get-url origin
```

**If no remote or not a git repo:**

```
git init
git remote add origin https://github.com/MirrasPT/JOCA.git
```

Inform the user and continue.

**If remote URL differs from `https://github.com/MirrasPT/JOCA.git`:** warn the user, ask confirmation before proceeding.

---

## Phase 2 -- Fetch and compare

### 4. Fetch upstream

```
cd <JOCA_DIR>
git fetch origin
```

If fetch fails (no network, auth error): report the error and stop.

### 5. Check for updates

```
git log HEAD..origin/master --oneline
```

If output is empty:

```
JOCA up to date -- no updates available.
Local version: <short hash> -- <latest commit message>
```

Stop here.

### 6. Identify changed files

```
git diff --name-status HEAD..origin/master
```

Categorize every changed file:

| Category | Paths | Action |
|----------|-------|--------|
| **Core (safe)** | `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/rules/`, `.claude/scripts/`, `CLAUDE.md`, `README.md`, `AGENTS.md`, `GEMINI.md`, `install.md`, `CREDITOS.md` | Update |
| **UI** | `JOCA_UI/backend/`, `JOCA_UI/frontend/`, `JOCA_UI/start.sh`, `JOCA_UI/start.bat` | Update + trigger post-update rebuild |
| **Protected (NEVER touch)** | `memory/projects/`, `memory/feedback/` | Skip entirely |
| **Protected (NEVER touch)** | `memory/soul.md` | Skip -- user calibration |
| **Protected (NEVER touch)** | `JOCA_UI/data/projects.json`, `JOCA_UI/data/project-memory.json`, `JOCA_UI/data/session-snapshots.json`, `JOCA_UI/data/ui-settings.json` | Skip -- user data |
| **Merge-only** | `.claude/settings.json` | Merge new keys, preserve user hooks/permissions |
| **Mixed** | `memory/tools/`, `memory/INDEX.md` | Check conflict before applying |
| **Local-origin** | Files with `origin: local` in frontmatter | **NEVER touch** |

### 6b. Identify local-origin files

Scan for files with `origin: local` in their frontmatter (use cross-platform approach):

```
node -e "
const fs = require('fs'); const path = require('path');
const dirs = ['.claude/skills', '.claude/agents', '.claude/commands'];
const found = [];
for (const dir of dirs) {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full, {recursive:true})) {
    const fp = path.join(full, f);
    if (!fs.statSync(fp).isFile()) continue;
    const head = fs.readFileSync(fp, 'utf8').slice(0, 500);
    if (/^origin:\s*local/m.test(head)) found.push(path.relative(process.cwd(), fp));
  }
}
found.forEach(f => console.log(f));
"
```

These files were created locally via `/create-skill` or manually. If the upstream introduces a file with the same name:
1. Report the conflict to the user
2. Keep the local version
3. Suggest renaming if the user wants both

### 7. Check for local modifications that overlap with upstream

```
git status --short
```

Cross-reference locally modified files with the upstream changed files.
If overlap exists: flag as potential conflicts.

---

## Phase 3 -- Present summary

```
UPDATE AVAILABLE -- JOCA
------------------------

N new commits:
  abc1234 <message>
  def5678 <message>

Core files to update (safe):
  M  .claude/skills/feedback-joca.md
  A  .claude/commands/novo-comando.md
  M  CLAUDE.md

UI files to update (will trigger rebuild):
  M  JOCA_UI/backend/src/server.ts

Protected files (will NOT be touched):
  memory/projects/*.md
  memory/feedback/*.md
  memory/soul.md
  JOCA_UI/data/projects.json
  JOCA_UI/data/project-memory.json
  JOCA_UI/data/session-snapshots.json
  JOCA_UI/data/ui-settings.json

Local-origin files protected:
  .claude/skills/created-skills/minha-skill/SKILL.md
  .claude/agents/meu-agente.md

Merge-only (new keys added, your config preserved):
  .claude/settings.json

Potential conflicts (modified locally + changed upstream):
  ! .claude/commands/resume.md  -- you have local changes

------------------------
Apply update? [Y/n]
```

If potential conflicts exist, warn before confirming:
> "You have local changes in X files that also changed upstream. They will be stashed before pulling and restored after."

---

## Phase 4 -- Apply update (after confirmation)

### Protection rules (enforced before ANY git operation)

These files and directories are NEVER overwritten, deleted, or reset:

| Path | Reason |
|------|--------|
| `memory/projects/` | User project data |
| `memory/feedback/` | User feedback sessions |
| `memory/soul.md` | User personality calibration |
| `JOCA_UI/data/projects.json` | UI project registry |
| `JOCA_UI/data/project-memory.json` | UI project memory |
| `JOCA_UI/data/session-snapshots.json` | UI session history |
| `JOCA_UI/data/ui-settings.json` | UI user preferences |
| Files with `origin: local` frontmatter | User-created skills/agents/commands |

**NEVER use:** `git reset --hard`, `git checkout .`, `git clean -f`, or any destructive git command.

### Option A -- No local modifications

```
cd <JOCA_DIR>
git pull --ff-only origin master
```

If `--ff-only` fails: proceed to Option B.

### Option B -- With local modifications (stash workflow)

```
cd <JOCA_DIR>
git stash push -m "update-joca backup"
git pull origin master
git stash pop
```

**If `stash pop` fails (conflicts):**

1. List conflicted files:
   ```
   git diff --name-only --diff-filter=U
   ```
2. Report each conflicted file to the user
3. Instruct:
   > "These files have merge conflicts. Open each file, resolve the `<<<<<<<` / `=======` / `>>>>>>>` markers, then run `git stash drop` when done."
4. Do NOT attempt automatic resolution
5. Do NOT run `git reset`, `git checkout`, or `git clean`

### Settings.json merge (special handling)

If `.claude/settings.json` changed upstream:

1. Read the upstream version and the local version
2. Deep-merge: keep all local `hooks` and `permissions` entries
3. Add any new upstream keys that don't exist locally
4. If a hook command path changed from `.sh` to `.js` upstream: update the local path too
5. Write the merged result
6. Report what was added/changed

---

## Phase 5 -- Post-update actions

After a successful pull, run these steps based on what changed.

### 5a. JOCA_UI rebuild (if UI files changed)

Check if any `JOCA_UI/` files were in the diff:

```
git diff --name-only HEAD~N HEAD -- JOCA_UI/
```

If backend files changed:
```
cd <JOCA_DIR>/JOCA_UI/backend
npm install
npm run build
```

If frontend files changed:
```
cd <JOCA_DIR>/JOCA_UI/frontend
npm install
```

Report rebuild results. If `npm install` or `npm run build` fails: report the error but do not block the rest of the update.

**Windows only:** the JOCA_UI is developed and validated on macOS. If the platform detected in Phase 1 is Windows AND any `JOCA_UI/` files changed, read and activate `.claude/skills/joca-ui-windows.md` after the rebuild — it re-verifies and fixes the Windows-sensitive layers (node-pty native build, PowerShell PTY, paths, statusline/Keychain, start.bat/stop.bat) in one pass. Notify: `[skill: joca-ui-windows]`.

### 5b. Statusline script (if changed)

If `.claude/scripts/statusline-command.js` was in the diff:

```
node -e "
const fs = require('fs'); const path = require('path');
const src = path.join(process.cwd(), '.claude/scripts/statusline-command.js');
const home = process.env.HOME || process.env.USERPROFILE;
const dest = path.join(home, '.claude', 'statusline-command.js');
fs.mkdirSync(path.dirname(dest), {recursive: true});
fs.copyFileSync(src, dest);
console.log('Copied to ' + dest);
"
```

### 5c. Hooks verification (if hook files changed)

If any `.claude/hooks/*.js` files were in the diff:

1. Read `.claude/settings.json`
2. Verify all hook `command` values point to `.js` files, not `.sh`
3. If any hook still references a `.sh` file that now has a `.js` counterpart: update the path
4. Report changes made

### 5d. Regenerate SKILL_INDEX (always)

```
python3 .claude/scripts/build-skill-index.py
```

If `python3` is not available, try `python`. If neither works: report and skip.

### 5e. New/updated skills notification (if skills changed)

If any `.claude/skills/` files were added or modified in the diff:

List them and notify the user:

```
New skills available:
  + .claude/skills/new-skill.md

Updated skills:
  ~ .claude/skills/existing-skill.md
```

---

## Phase 6 -- Final summary

```
JOCA UPDATED
------------------------

Commits applied: N
  abc1234 <message>
  def5678 <message>

Files updated: X
  M  .claude/skills/...
  A  .claude/commands/...

Files protected (not touched): Y
  memory/projects/ (user data)
  memory/soul.md (calibration)
  JOCA_UI/data/ (all user data files)
  origin:local files (Z files)

Post-update actions:
  [done] Backend rebuilt (npm install + npm run build)
  [done] Frontend deps installed
  [done] statusline-command.js copied to ~/.claude/
  [done] Hooks verified (.js paths confirmed)
  [done] SKILL_INDEX.json regenerated
  [info] 2 new skills, 1 updated skill

Local version: <hash> -- <latest commit message>

Next:
  Review changes: git diff HEAD~N HEAD
  If JOCA_UI was rebuilt: restart the UI (start.bat / start.sh)
```

---

## Rules

- One direction only: GitHub -> local. Never `git push`, never `git commit`
- NEVER overwrite `memory/projects/`, `memory/feedback/`, or `memory/soul.md`
- NEVER overwrite any file in `JOCA_UI/data/` (projects.json, project-memory.json, session-snapshots.json, ui-settings.json)
- NEVER overwrite files with `origin: local` in frontmatter
- NEVER use destructive git commands: `git reset --hard`, `git checkout .`, `git clean -f`
- `.claude/settings.json` is merge-only: preserve user hooks and permissions, add new upstream keys
- If pull creates conflicts: stop, report, instruct manual resolution
- Always inform the user before any git operation that modifies local files
- All commands must work on both Windows (PowerShell) and macOS/Linux (bash) -- use `git` and `node -e` for cross-platform operations

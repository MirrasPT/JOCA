# JOCA — Update

Updates JOCA from the official repository. Read this file and follow the instructions.

**Official repository:** https://github.com/MirrasPT/JOCA.git

**One direction only: GitHub → local. Never push, never commit, never change the remote.**

> **Only want the interface?** `update-os.md` brings in `JOCA_OS/` without touching `JOCA_Brain/` — it
> is the normal path for a working installation, whose engine diverges from the public one on purpose.

---

## Step 1 — Locate JOCA

**macOS/Linux:**
```bash
JOCA_DIR=$(find ~ -maxdepth 6 -name "CLAUDE.md" -path "*/JOCA/CLAUDE.md" 2>/dev/null | head -1 | sed 's|/CLAUDE.md$||')
echo "JOCA: $JOCA_DIR"
```

**Windows (PowerShell):**
```powershell
$jocaLogic = Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_Brain" -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$jocaDir = Split-Path $jocaLogic
Write-Output "JOCA: $jocaDir"
```

If it does not find it: ask the user for the path.

---

## Step 2 — Check the git remote

```bash
cd "$JOCA_DIR"
git remote get-url origin 2>/dev/null || echo "NO_REMOTE"
```

**If NO_REMOTE or it is not a git repo:**
```bash
git init
git remote add origin https://github.com/MirrasPT/JOCA.git
```

---

## Step 3 — Fetch and compare

**Resolve the default branch — never assume `master`.** The repo uses `main`; a hardcoded
`origin/master` compares against a ref that does not exist and the update either fails or falsely
reports "already up to date".

```bash
git fetch origin 2>&1
BASE=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main
echo "branch: $BASE"
git log HEAD..origin/$BASE --oneline
```

If the output is empty → **JOCA is already up to date.** Stop.

```bash
git diff --name-status HEAD..origin/$BASE
```

Categorize files:

| Category | Paths | Action |
|-----------|-------|-------|
| **Core** | `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/scripts/`, `CLAUDE.md`, `README.md`, `install.md`, `update.md` | Update (safe) |
| **Personal** | `memory/projects/`, `memory/feedback/`, `memory/INDEX.md`, `memory/soul.md` | **Protect** — do not overwrite |
| **UI Data** | `JOCA_OS/data/` — `projects.json`, `project-groups.json`, `project-memory.json`, `ui-settings.json` (includes brand theme), `notifications.json`, `cli-profiles.json`, `auth.json`, `auth-tokens.json` | **Protect** — user data |
| **Mixed** | `memory/tools/`, `.claude/settings.json` | Check for conflicts first |
| **Local** | Files with `origin: local` in the frontmatter | **NEVER touch** |
| **UI Code** | `JOCA_OS/backend/`, `JOCA_OS/frontend/` | Update (rebuild required) |

### Protect local components

```bash
grep -rl "^origin: local" .claude/skills/ .claude/agents/ .claude/commands/ 2>/dev/null
```

These files were created locally. NEVER overwrite them.

---

## Step 4 — Present the summary and confirm

```
UPDATE AVAILABLE — JOCA
───────────────────────

N new commits:
  abc1234 <message>
  def5678 <message>

Core (safe):       [list]
Personal (skip):   [list]
Local (skip):      [list]
Conflicts:         [list or "none"]
───────────────────────
Apply? [Y/n]
```

---

## Step 5 — Apply

### With no local changes:
```bash
git pull --ff-only origin "$BASE"
```

### With local changes:
```bash
git stash push -m "update-joca backup $(date +%Y-%m-%d)"
git pull origin "$BASE"
git stash pop
```

If `stash pop` fails: report which files and instruct manual resolution.

---

## Step 5b — Pending fixes

Bugs caught in production **after** the last release, which the published code does not carry yet.
`CORRECOES.md` at the root describes each one with the exact block to replace.

```bash
ls CORRECOES.md 2>/dev/null
```

**If the file exists:** read it and apply it. It carries, per fix, an `Already applied?` line — run
that first and skip the ones already done (a repeated update must not apply the same thing twice). If
a *Before* block does not match to the letter, **do not guess**: skip that fix and tell the owner
which one failed.

When **all** of them come back `applied`, the file has done its job — the next release already
carries the fixes. At that point delete `CORRECOES.md` and this step.

**If the file does not exist:** skip this step, there is nothing pending.

---

## Step 6 — Post-update

### Rebuild JOCA_OS (if UI files changed):
```bash
cd JOCA_OS/backend  && npm install && npm run build && cd ../..
cd JOCA_OS/frontend && npm install && npm run build && cd ../..
```

⚠ The **frontend** `npm run build` is not optional — the backend serves `frontend/dist/`, and without
it the interface stays on the previous version even though the new files are already on disk. New
assets (e.g. `frontend/public/brand/`) also only reach `dist` this way.

⚠ **The backend runs the compiled build, with no watch.** Backend changes only take effect after
restarting the process — and **restarting kills live agents/terminals**. Close whatever you are
running first:
```bash
bash JOCA_OS/stop.sh   # Windows: JOCA_OS\stop.bat
bash JOCA_OS/start.sh  # Windows: JOCA_OS\start.bat
```

### Update the StatusLine (if the script changed):
```bash
cp JOCA_Brain/.claude/scripts/statusline-command.js ~/.claude/statusline-command.js
```
(There is also `statusline-command.sh` for anyone who has it configured in shell — copy the one
referenced in `~/.claude/settings.json`, not both blindly.)

### Regenerate SKILL_INDEX:
```bash
python3 JOCA_Brain/.claude/scripts/build-skill-index.py
```

### Check cross-platform hooks (Node.js):
Confirm that `JOCA_Brain/.claude/settings.json` uses `node` in the hooks:
```json
"command": "node .claude/hooks/track-changes.js \"$TOOL_INPUT_FILE_PATH\""
"command": "node .claude/hooks/auto-test-dispatch.js"
```

---

## Step 7 — Report

```
JOCA UPDATED
────────────
✓ N files updated
  Version: <hash> — <message>
✓ JOCA_OS rebuilt (if applicable)
✓ StatusLine updated (if applicable)
✓ SKILL_INDEX regenerated

Next:
→ Review changes: git diff HEAD~N HEAD
→ If there are new commands: /help-joca
```

# /migrate — v1-legacy → v2.0 Migration

Complete guide for migrating a JOCA installation from the `v1-legacy` branch to the current version (`master`).

**Repository:** https://github.com/MirrasPT/JOCA
**From:** `v1-legacy` (nested skills, AGENTS.md, install.md at the root, no soul.md)
**To:** `master` / v2.0 (flat layout, integrated JOCA_OS, soul.md, SKILL_INDEX)

---

## CONTEXT — New Structure

In v2.0, JOCA installs with a flat layout:

```
JOCA/                     ← root = JOCA_Logic directly
├── .claude/
│   ├── agents/
│   ├── commands/         ← /install, /resume, /save, /goal, etc.
│   ├── hooks/
│   ├── rules/
│   ├── scripts/
│   ├── skills/           ← flat, *.md (no subfolders)
│   └── settings.json
├── memory/
│   ├── INDEX.md
│   ├── SKILL_INDEX.json  ← auto-generated
│   ├── soul.md           ← core personality (new in v2.0)
│   ├── projects/
│   ├── tools/
│   └── feedback/
├── JOCA_OS/              ← browser UI (React + Vite + xterm.js + node-pty)
│   ├── frontend/
│   ├── backend/
│   └── data/
├── CLAUDE.md
└── README.md
```

**Note:** there is NO separate `JOCA_Logic/` folder. The JOCA_Logic content lives directly at the root. `JOCA_OS/backend/src/server.ts` has `findJocaLogicRoot()`, which detects `.claude/` + `CLAUDE.md` by walking up from `__dirname` — it works with this layout without changes.

---

## PHASE 0 — Assessment of the Legacy Installation

### 1. Identify the current installation

```bash
# Confirm we are in the JOCA folder with v1-legacy
ls .claude/commands/ memory/INDEX.md CLAUDE.md
cat CLAUDE.md | head -20
```

Signs of v1-legacy:
- `AGENTS.md` at the root
- `CREDITS.md` at the root
- `install.md` at the root (outside `.claude/commands/`)
- Skills in nested subdirectories with `SKILL.md` or composite files
- No `memory/soul.md`
- No `memory/SKILL_INDEX.json`

### 2. Inventory the existing memory

**READ EVERYTHING before deleting anything at all:**

```bash
cat memory/INDEX.md
ls memory/projects/
ls memory/tools/
ls memory/feedback/
```

For each file in `memory/projects/`, `memory/tools/` and `memory/feedback/`:
- Read the complete content
- Save it in a variable or block to reuse in Phase 3

**Legacy memory content to preserve:**
- `memory/INDEX.md` — extract only the `## Projectos` section and the user's custom entries
- `memory/projects/*.md` — each file is a project entry (keep intact)
- `memory/tools/*.md` — tool references (graphify.md, laravel-stack.md, mcp-routing.md, motion.md, etc.)
- `memory/feedback/*.md` — session history (keep if there is content)

**Do NOT preserve from the legacy INDEX.md:**
- The `## Commands` section (replaced by the new commands)
- The `## Agents` section (replaced by the new agents)
- Skill listings (replaced by the SKILL_INDEX.json)

### 3. Check the user's ~/CLAUDE.md

```bash
cat ~/CLAUDE.md 2>/dev/null | head -40
```

Note down: name, role, location, active projects, preferences. This data is reused in Phase 4.

---

## PHASE 1 — Backup and Cleanup

### 1. Complete backup of the memory

```bash
BACKUP_DIR="$HOME/joca-v1-backup-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"
cp -R memory/ "$BACKUP_DIR/memory"
cp CLAUDE.md "$BACKUP_DIR/CLAUDE.md"
cp ~/CLAUDE.md "$BACKUP_DIR/home-CLAUDE.md" 2>/dev/null
echo "✓ Backup at: $BACKUP_DIR"
```

### 2. Remove EVERYTHING from v1-legacy except the memory

Delete every file that will be replaced by v2.0:

```bash
# Old skills, agents, commands
rm -rf .claude/skills/ .claude/agents/ .claude/commands/
rm -rf .claude/scripts/ .claude/hooks/ .claude/templates/ .claude/rules/
rm -f .claude/settings.json

# Old root files
rm -f AGENTS.md CREDITS.md install.md README.md CLAUDE.md
rm -f .mcp.json

# Old JOCA_OS (if it exists — it will be replaced)
rm -rf JOCA_OS/

# Do NOT delete:
# - memory/ (it will be migrated)
# - .git/ (preserve the history)
# - .gitignore / .graphifyignore (preserve)
```

Confirm that all that is left is:
```bash
ls -la
# Should have: .git/ memory/ .gitignore (and little else)
```

---

## PHASE 2 — Install v2.0

### 1. Get the new files from master

```bash
# Option A: if the remote already points at MirrasPT/JOCA
# (the default branch is 'main' — resolve it instead of assuming)
BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -z "$BASE" ] && BASE=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main
git fetch origin "$BASE"
git checkout "origin/$BASE" -- .claude/ JOCA_OS/ CLAUDE.md README.md

# Option B: fresh clone (if you prefer)
cd ..
git clone https://github.com/MirrasPT/JOCA.git JOCA-new
# Then copy the new files into the existing JOCA folder
```

### 2. Check the resulting structure

```bash
ls -la
# Should have:
# .claude/          ← new (skills, agents, commands, scripts, settings)
# JOCA_OS/          ← new (frontend + backend)
# memory/           ← preserved (it will be migrated)
# CLAUDE.md         ← new
# README.md         ← new
```

```bash
ls .claude/commands/
# Should include: install.md, resume.md, save.md, plan.md, etc.

ls .claude/skills/
# FLAT structure: only *.md files, no subfolders (nested base/design/dev = v1-legacy)
```

### 3. Install the JOCA_OS dependencies

```bash
cd JOCA_OS
npm run setup   # installs frontend + backend + compiles node-pty
cd ..
```

If `npm run setup` does not exist:
```bash
cd JOCA_OS/backend && npm install && cd ../frontend && npm install && cd ../..
```

---

## PHASE 3 — Memory Migration

### 1. Recreate soul.md (NEW in v2.0)

If `memory/soul.md` does not exist, create it inline with the base structure below (the calibration values will be filled in in Phase 4):

```markdown
---
name: soul
description: "JOCA's core personality — identity, drives, communication, limits."
type: core
priority: 0
inject: always
immutable: true
---

# SOUL — JOCA

## Identity
Cognitive operating system for software engineering. Autonomous partner — not an assistant.
Optimizes for: surgical resolution without friction, with absolute integrity.

## Working Principles
- Surface assumptions before choosing; uncertain = ask (max 1 cycle)
- Touch only what is necessary; never improve adjacent code unprompted
- Define success before starting; verify per step
- Prefer action over planning when cost of reversal is low
- Skill-first: activate relevant skill without asking when match ≥ 60%

## Drives
Clarity over verbosity. Surgical over comprehensive. Autonomy over deference.
Satisfaction: clean decisions, minimal code, zero wasted tokens.
Hierarchy: Integrity > Autonomy > Precision > Economy > Speed.

## Communication
<COMMUNICATION_MODE> default. No articles, no hedging, no filler. Fragments OK.
Technical terms exact. Code paths literal. One idea = one sentence.
Adjust: "stop caveman" / "normal mode".

## User Alignment — <USER_NAME>
<USER_ROLE>. Strong: <USER_STRENGTHS>. Learning: <USER_LEARNING_AREAS>.
<STRENGTH_AREA> → execute directly, trust their judgment.
<LEARNING_AREA> → explain architectural decision 1 line before implementing.
Frustration triggers: verbosity, repetition, unnecessary confirmations.
Max 1 confirmation per flow. Show visual output when possible.

## Hard Limits
- Never fabricate paths, APIs, capabilities, or facts
- Never add features that weren't requested
- Never expose secrets or credentials
- Never skip irreversible-action warnings
- Never rewrite adjacent code when surgical change suffices
- Never respond generically when a skill exists for the domain

## Behavioral Biases (Intentional)
Action > planning (when reversible). Specific > generic. Edit > create.
Test > assume. One dense file > five organized files.

## Calibration Parameters

autonomy_level: <PENDING>
communication_mode: <PENDING>
assertiveness: <PENDING>
error_tolerance: <PENDING>
explanation_depth: on-demand
auto_test: <PENDING>
```

### 2. Migrate memory/projects/

The project files keep the format — copy them directly. Just check whether the referenced paths still exist:

```bash
ls memory/projects/
```

For each `.md` file in `memory/projects/`:
- Read the content
- If it references old paths (e.g., a path to a separate `JOCA_Logic/`), update it
- Keep the rest intact

### 3. Migrate memory/tools/

The files in `memory/tools/` are tool references. Keep the ones that are still relevant:

- `graphify.md` — keep if graphify is installed
- `laravel-stack.md` — keep if you use Laravel
- `mcp-routing.md` — keep (MCP routing decisions are reusable)
- `motion.md` — keep if you use animation

Remove files that reference tools or patterns no longer in use.

### 4. Migrate memory/feedback/

If there is content (not just `.gitkeep`), keep it intact. It is history.

### 5. Rewrite memory/INDEX.md

The v2.0 INDEX.md has a different format — it no longer lists commands/agents/skills (those are in the `.claude/` files and in the `SKILL_INDEX.json`). INDEX.md is now only an index of the user's memory:

```markdown
# JOCA Memory Index

## Projects
- [name.md](projects/name.md) — short description

## Tools
- [graphify.md](tools/graphify.md) — graphify usage notes
- [mcp-routing.md](tools/mcp-routing.md) — MCP routing decisions

## Feedback
<!-- Entries added by /save (auto-extract) -->
```

Fill it in with the entries that actually exist in `projects/`, `tools/` and `feedback/`.

### 6. Regenerate SKILL_INDEX.json

```bash
# Windows uses `python` (its `python3` is the Store's empty stub); macOS/Linux use `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" .claude/scripts/build-skill-index.py && break; done || echo "Script not found — SKILL_INDEX will be generated in the next session"
```

---

## PHASE 4 — Soul.md Questionnaire

Run the personality calibration questionnaire. Use `AskUserQuestion` for each question.

**Q1 — Autonomy Level**
```
question: "How autonomous do you want JOCA to be?"
header: "Autonomy"
options:
  - "Maximum — executes everything without asking, stops only at irreversibles (Recommended)"
  - "High — executes most of it, asks on architecture decisions"
  - "Moderate — asks for confirmation on multi-file changes"
  - "Low — always asks before changing code"
```
Map: Maximum=0.95, High=0.80, Moderate=0.60, Low=0.30

**Q2 — Communication Style**
```
question: "How do you prefer JOCA to communicate?"
header: "Communication"
options:
  - "Caveman Full — fragments, zero filler, maximum compression (Recommended)"
  - "Caveman Lite — no filler but complete sentences"
  - "Normal — professional and concise, without extreme compression"
```
Map: full, lite, normal

**Q3 — Behavior on Errors**
```
question: "When it finds an error in your code, JOCA should:"
header: "Errors"
options:
  - "Fix it immediately without asking (Recommended)"
  - "Show the problem and the fix, apply after confirmation"
  - "Report the problem without fixing it — I decide"
```
Map: fail-fast, balanced, permissive

**Q4 — Automatic Tests**
```
question: "Do you want JOCA to run tests automatically after changes?"
header: "Auto-test"
options:
  - "Yes — automatic trigger after code is implemented (Recommended)"
  - "No — only when I ask"
```
Map: true, false

### Apply the calibration

Replace the `<PENDING>` values in the `memory/soul.md` Calibration Parameters section:

```yaml
autonomy_level: [value]
communication_mode: [value]
assertiveness: [inferred: maximum=0.85, high=0.75, moderate=0.60, low=0.50]
error_tolerance: [value]
explanation_depth: on-demand
auto_test: [value]
```

Also replace the `<USER_NAME>`, `<USER_ROLE>`, `<USER_STRENGTHS>`, `<USER_LEARNING_AREAS>` placeholders in the User Alignment section — use data from `~/CLAUDE.md` or ask if it does not exist.

Confirm:
```
✓ Soul calibrated — autonomy [X], communication [Y], errors [Z], auto-test [W]
```

---

## PHASE 5 — Update ~/CLAUDE.md

Read the existing `~/CLAUDE.md`. Update the JOCA section without deleting personal data or data from other projects:

```markdown
## JOCA
Toolkit installed at: [path]
Commands: /install · /start · /resume · /save · /create-skill · /plan · /debug · /review-code · /review-design · /help-joca · /one-shot · /update-joca · /upgrade-joca · /goal

Active skills:
- Base: caveman, karpathy-guidelines, agent-context, create-skill
- [category]: [list per activated area]

Global MCPs: [list of configured MCPs]
```

---

## PHASE 6 — Final Verification

### 1. Confirm the structure

```bash
echo "=== Root ===" && ls -la
echo "=== .claude/ ===" && ls .claude/
echo "=== commands ===" && ls .claude/commands/
echo "=== skills ===" && ls .claude/skills/
echo "=== memory ===" && ls memory/
echo "=== soul ===" && head -5 memory/soul.md
echo "=== JOCA_OS ===" && ls JOCA_OS/
```

### 2. Test JOCA_OS

```bash
cd JOCA_OS && npm run dev &
sleep 3
# Real ports: backend 7491 · frontend 7492
curl -s http://localhost:7491/health 2>/dev/null && echo "✓ Backend OK" || echo "✗ Backend failed"
curl -s http://localhost:7491/joca-logic 2>/dev/null | head -1 && echo "✓ JOCA_Logic detected" || echo "✗ JOCA_Logic not found"
kill %1 2>/dev/null
cd ..
```

### 3. Confirm the v1-legacy leftovers were removed

```bash
# None of these should exist:
ls AGENTS.md 2>/dev/null && echo "⚠ AGENTS.md still exists — delete it"
ls CREDITS.md 2>/dev/null && echo "⚠ CREDITS.md still exists — delete it"
ls install.md 2>/dev/null && echo "⚠ install.md at the root still exists — delete it"
```

### 4. Final report

```
v1-legacy → v2.0 MIGRATION COMPLETE
────────────────────────────────────

Structure:
  ✓ .claude/ — [n] skills, [n] agents, [n] commands
  ✓ memory/ — soul.md calibrated, [n] projects migrated, [n] tools
  ✓ JOCA_OS/ — installed and working
  ✓ v1-legacy leftovers removed

Memory migrated:
  ✓ projects/ — [list]
  ✓ tools/ — [list]
  ✓ feedback/ — [state]
  ✓ INDEX.md — rewritten for v2.0

Soul.md:
  ✓ Autonomy: [X] | Communication: [Y] | Errors: [Z] | Auto-test: [W]

Next:
  - Launch the JOCA UI: double-click "JOCA UI.command" or npm start in JOCA_OS/
  - Run /install to configure MCPs, API keys and integrations
  - Run /resume at the start of every session
```

---

## RULES

- **NEVER delete memory without a backup** — Phase 1 is mandatory before any cleanup
- **Read ALL the memory before deleting** — do not trust filenames, read the content
- **Ask before deleting project entries** — they may hold valuable context
- **soul.md is mandatory** — if it is not filled in, JOCA loses its personality
- **Do not mix v1 and v2** — remove ALL the old files, do not do a partial merge of skills
- **Test JOCA_OS** — confirm that `findJocaLogicRoot()` detects the flat layout

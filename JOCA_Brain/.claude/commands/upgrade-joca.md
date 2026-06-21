# /upgrade-joca — Self-Improvement Loop

Reads unprocessed feedback, researches best practices, plans improvements, executes via skill-improver/skill-evaluator loop, validates, and reports. Full autonomous upgrade pipeline for JOCA internals.

Scope: **JOCA interno apenas** -- skills, agentes, comandos, hooks, memory tools.
Never touches project files, external repos, or user data.

## When to run

- After accumulating `/feedback-joca` or `/save` sessions that generated feedback
- When the user says "upgrade joca", "apply feedback", "self-improve", "improve toolkit"
- As periodic maintenance

---

## Phase 1 -- Collect Feedback

### 1.1 Locate JOCA

```bash
# Windows
$JOCA_DIR = (Get-ChildItem -Path "$env:USERPROFILE" -Recurse -Depth 6 -Filter "CLAUDE.md" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'JOCA[/\\]CLAUDE\.md' } | Select-Object -First 1).DirectoryName
# macOS/Linux
JOCA_DIR=$(find ~ -maxdepth 6 -name "CLAUDE.md" -path "*/JOCA/CLAUDE.md" 2>/dev/null | head -1 | sed 's|/CLAUDE.md$||')
```

All paths below are relative to `$JOCA_DIR`.

### 1.2 Read all unprocessed feedback files

Scan `memory/feedback/` for all `.md` files. For each file:
1. Parse YAML frontmatter
2. Skip if frontmatter contains `processed: true`
3. Skip if file is inside `memory/feedback/archive/`

Accepted filename patterns:
- `session-*.md` -- manual `/feedback-joca` sessions
- `auto-*.md` -- auto-extracted by `/save`
- `joca-patterns.md` -- accumulated trigger/skill patterns

### 1.3 Aggregate and deduplicate

Collect every issue from every unprocessed file into a single list.
Deduplicate: if two issues target the same file + same section + same fix, merge them (keep the more specific description, note both sources).

### 1.4 Classify each issue

Assign exactly one type per issue:

| Type | Criteria |
|------|----------|
| `NEW_SKILL` | Skill that should exist but does not |
| `IMPROVE_SKILL` | Existing skill needs better instructions, triggers, or coverage |
| `FIX_TRIGGER` | Skill exists but triggers incorrectly (false positive or false negative) |
| `IMPROVE_COMMAND` | Existing command is incomplete, unclear, or missing steps |
| `FIX_WORKFLOW` | Multi-step workflow has a gap, wrong order, or missing error handling |
| `NEW_AGENT` | Agent that should exist but does not |
| `IMPROVE_AGENT` | Existing agent needs better instructions or tools |

If no unprocessed feedback files exist, inform the user:

```
No unprocessed feedback found in memory/feedback/.
Run /feedback-joca to capture session issues first, or /save to auto-extract patterns.
```

Stop here.

---

## Phase 2 -- Research (deep-research agent)

For each classified issue, decide whether research is needed:

| Issue Type | Research Action |
|------------|----------------|
| `NEW_SKILL` | MUST research: industry best practices, similar tools on GitHub, relevant standards (RFC, OWASP, W3C, etc.) |
| `IMPROVE_SKILL` | MUST research: current best practices for that domain, compare with 2-3 similar open-source skill/prompt implementations |
| `IMPROVE_COMMAND` | SHOULD research: how other CLI tools (gh, npm, cargo, brew) handle the same workflow pattern |
| `NEW_AGENT` | SHOULD research: agent orchestration patterns, similar multi-agent setups |
| `FIX_TRIGGER` | No research needed -- fix is mechanical (update description field) |
| `FIX_WORKFLOW` | No research needed unless the workflow is complex (3+ steps) |
| `IMPROVE_AGENT` | SHOULD research if agent covers a technical domain |

### 2.1 Spawn deep-research agent

For each item that needs research, invoke:

```
Agent(subagent_type="deep-research")
```

**Brief to deep-research (mandatory fields):**
1. **Objective:** "Research best practices for [domain/topic]. Find actionable patterns for a Claude Code skill/command that [what it does]."
2. **Relevant files:** Path to the existing skill/command/agent being improved (or "new -- does not exist yet")
3. **Constraints:** "Output a concise summary (max 500 words) with: (a) 3-5 actionable patterns, (b) 2-3 reference implementations or tools, (c) relevant standards/RFCs. No full report -- just actionable findings."
4. **What NOT to do:** "Do not generate HTML/PDF output. Do not create a research directory. Return findings inline."

Use `mode: quick` for SHOULD-research items, `mode: standard` for MUST-research items.

### 2.2 Compile research into actionable improvements

For each researched item, extract:
- Concrete patterns to incorporate
- Specific standards to reference (with section numbers)
- Anti-patterns to warn against
- Example implementations to adapt

Attach these as context for Phase 4.

---

## Phase 3 -- Plan Improvements

### 3.1 Build the improvement plan

Present a numbered list. Every item MUST include all fields:

```
JOCA UPGRADE PLAN
-----------------

 #  Type          Component    Description                                     Impact   Effort
--- ------------- ------------ ----------------------------------------------- -------- --------
 1  NEW_SKILL     skill        next-auth — Next.js authentication patterns     HIGH     SMALL
                               Research: OAuth 2.1 PKCE, NextAuth.js v5 API
 2  IMPROVE_SKILL skill        frontend-dev — add Tailwind v4 utilities        MEDIUM   SMALL
                               Research: Tailwind v4 migration guide patterns
 3  FIX_TRIGGER   skill        laravel-specialist — false positive on "artisan" HIGH     TRIVIAL
                               in non-Laravel contexts
 4  IMPROVE_CMD   command      save — missing error handling when graph fails   MEDIUM   SMALL
 5  FIX_WORKFLOW  workflow     create-skill pipeline — evaluator timeout        LOW      MEDIUM
                               not handled
 6  NEW_AGENT     agent        perf-monitor — continuous performance tracking   LOW      LARGE
 7  IMPROVE_AGENT agent        deep-research — add firecrawl_extract fallback  MEDIUM   TRIVIAL

-----------------
7 improvements planned (2 HIGH, 3 MEDIUM, 2 LOW)

Sources:
  #1: session-unitv-2026-05-20.md > Issue 3
  #2: auto-2026-05-22.md > Issue 1, joca-patterns.md > "Tailwind v4"
  ...
```

### 3.2 User confirmation

Ask the user which items to apply:

```
Apply which improvements?
  - "all" to apply everything
  - "1,2,3" to select specific items
  - "all except 6" to exclude specific items
  - "high only" to apply only HIGH impact items
  - "cancel" to abort
```

Wait for explicit confirmation. Never proceed without it.

---

## Phase 4 -- Execute

Process approved items in priority order:
1. `FIX_TRIGGER` (highest urgency -- prevents misfires)
2. `FIX_WORKFLOW` (prevents broken pipelines)
3. `IMPROVE_SKILL` / `IMPROVE_AGENT` / `IMPROVE_COMMAND`
4. `NEW_SKILL` / `NEW_AGENT`

### 4.1 Trigger fixes (FIX_TRIGGER)

For each trigger fix:
1. Read the target skill file
2. Rewrite the `description` field in frontmatter using RFC 2119 keywords:
   - MUST trigger on: [specific phrases that should activate the skill]
   - MUST NOT trigger on: [specific phrases that should NOT activate it]
   - SHOULD also trigger on: [secondary phrases]
3. Verify `description` + `when_to_use` combined stays under 1,536 characters
4. Edit the file directly

### 4.2 Workflow fixes (FIX_WORKFLOW)

For each workflow fix:
1. Read the target command/workflow file
2. Identify the gap (missing step, wrong order, missing error handling)
3. Apply the fix directly with inline validation
4. Add error handling where missing (what to do when X fails)

### 4.3 Skill improvements and new skills (skill-improver + skill-evaluator loop)

For each `IMPROVE_SKILL` or `NEW_SKILL` item:

**Step A -- Draft/Revise (skill-improver agent)**

```
Agent(subagent_type="skill-improver")
```

Brief:
```
ORIGINAL REQUEST: [description of what the skill should do, from the feedback issue]
ITERATION: 1 of 3
PREVIOUS EVALUATOR FEEDBACK: [none for iteration 1, or evaluator's feedback array for iterations 2-3]
CURRENT SKILL CONTENT: [full content of existing skill, or "NEW -- create from scratch"]
RESEARCH CONTEXT: [actionable findings from Phase 2, if available]
```

**Step B -- Evaluate (skill-evaluator agent)**

```
Agent(subagent_type="skill-evaluator")
```

Brief:
```
ORIGINAL REQUEST: [same as above]
ITERATION: [N] of 3
SKILL TO EVALUATE:
[the full skill content returned by skill-improver]
```

**Step C -- Decision**

Parse the evaluator's JSON response:
- If `verdict` is `"PASS"` (score >= 8.0): accept the skill, proceed to write
- If `verdict` is `"FAIL"` and iteration < 3: go back to Step A with `feedback` array as `PREVIOUS EVALUATOR FEEDBACK`
- If `verdict` is `"FAIL"` and iteration == 3: report the skill as failed, include the best-scoring version in the report, suggest manual review

**Step D -- Write**

For accepted skills:
1. Write/overwrite the skill file at `.claude/skills/<name>.md`
2. Ensure frontmatter includes `origin: local`
3. Confirm: `[skill: <name>] score <X>/10 -- applied (iteration N)`

For failed skills (3 iterations, never passed):
1. Do NOT write the file
2. Report: `[skill: <name>] best score <X>/10 -- FAILED after 3 iterations. Manual review needed.`

### 4.4 Agent improvements and new agents

For each `IMPROVE_AGENT` or `NEW_AGENT`:
1. Read 2-3 existing agents (for pattern consistency)
2. Apply improvements directly (agents are not scored via skill-evaluator -- they use a different format)
3. Add `origin: local` to frontmatter of new agents
4. Validate: check that `tools:` field lists only tools that exist, `model:` is valid (opus/sonnet/haiku)

### 4.5 Command improvements (IMPROVE_COMMAND)

For each command improvement:
1. Read the target command file
2. Apply the fix (missing steps, error handling, clarity)
3. Validate: ensure the command has clear phases, user confirmation points where needed, and a summary output format
4. No origin marking needed for commands (they are part of the core workflow)

---

## Phase 5 -- Validate

### 5.1 Codex review (if available)

```bash
# Check if codex CLI is available
which codex 2>/dev/null && echo "AVAILABLE" || echo "NOT_AVAILABLE"
```

If available, for each modified file:
```bash
codex review <path-to-file>
```

If codex finds issues: report them but do not auto-fix. Include in the Phase 6 report.
If codex is not available: skip this step silently.

### 5.2 TypeScript check (if applicable)

If any `.ts` or `.tsx` files were modified:
```bash
npx tsc --noEmit 2>&1
```

Report errors if any.

### 5.3 Regenerate SKILL_INDEX.json

```bash
python3 .claude/scripts/build-skill-index.py
```

If the script does not exist or fails: manually rebuild the index by scanning `.claude/skills/` and `.claude/agents/` for frontmatter (`name`, `description`, `path`) and writing to `memory/SKILL_INDEX.json`.

### 5.4 Recompile bridges

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null
```

If the script fails or does not exist: skip and note in report.

### 5.5 Update INDEX.md

For each new skill or agent created, add an entry to `memory/INDEX.md` in the appropriate section.

### 5.6 Sync questionnaires (if skills/agents added or removed)

If this upgrade created, renamed, or removed any skill or agent, run `/sync-questionnaires` (or apply its Phase 4 logic) so the questionnaires and counters stay aligned with the real inventory: `.claude/commands/install.md` (FASE 2 map, counts), `.claude/commands/init-project.md`, root `install.md`, `README.md`, `CLAUDE.md` (Trigger Map / Pipelines), `memory/INDEX.md`. A new skill that no questionnaire surfaces is effectively invisible.

---

## Phase 6 -- Report

### 6.1 Summary

```
JOCA UPGRADE COMPLETE
---------------------

Applied: N
  [1] NEW_SKILL    next-auth               score 8.5/10 (iter 2)
  [3] FIX_TRIGGER  laravel-specialist       applied
  [4] IMPROVE_CMD  save                     applied

Skipped: M (user choice)
  [6] NEW_AGENT    perf-monitor             skipped by user

Failed: K
  [5] FIX_WORKFLOW create-skill pipeline    failed -- codex review found regression

---------------------
Files modified:
  .claude/skills/next-auth.md         (NEW)
  .claude/skills/laravel-specialist.md (trigger fix)
  .claude/commands/save.md             (improved)

Validation:
  SKILL_INDEX.json regenerated
  Bridges recompiled
  [Codex review: 0 issues / not available]

---------------------
```

### 6.2 Mark feedback as processed

For each feedback file that was fully processed (all its issues either applied or explicitly skipped by user):

1. Add `processed: true` and `processed_date: <YYYY-MM-DD>` to the YAML frontmatter
2. For each issue within the file, append resolution status:
   ```
   **Resolved:** <YYYY-MM-DD> -- <file modified> | skipped by user | failed (reason)
   ```

### 6.3 Archive processed feedback

```bash
mkdir -p memory/feedback/archive
```

Move fully processed files to `memory/feedback/archive/`:
```bash
mv memory/feedback/session-<name>-<date>.md memory/feedback/archive/
mv memory/feedback/auto-<date>.md memory/feedback/archive/
```

For `joca-patterns.md`: do NOT move -- only mark individual entries as processed within the file.

### 6.4 Suggest next steps

```
Next steps:
  - Run /update-joca if upstream changes are available
  - Run /sync-questionnaires if skills/agents changed (realign questionnaires + counters)
  - Run /feedback-joca in your next session to capture new patterns
  - Review failed items manually: <list of failed items>
```

> **Windows:** if this upgrade ran on Windows and any change touches the JOCA_UI layer, defer UI verification to the `joca-ui-windows` skill — the JOCA_UI is developed/validated on macOS and that skill re-tests and fixes the Windows-sensitive parts in one pass.

---

## Rules

- Never implement without user confirmation (Phase 3.2 gate)
- Never delete feedback files -- mark as processed and archive
- Never touch files outside JOCA (project files, user data, external repos)
- If a file path does not exist: create it with correct structure
- If two feedback issues contradict each other for the same file: present both, ask user which to apply
- Mark all new files with `origin: local` in frontmatter
- Skills MUST pass 8.0/10 threshold via skill-evaluator or be reported as failed
- Max 3 iterations per skill in the improver/evaluator loop
- Preserve existing patterns: read 2-3 similar files before creating new ones
- Archive processed feedback, never delete it
- If no feedback exists: inform user and stop (do not invent improvements)

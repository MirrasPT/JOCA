# /upgrade-joca — Self-Improvement Loop

Reads unprocessed feedback, researches best practices, plans improvements, executes via skill-improver/skill-evaluator loop, validates, and reports. Full autonomous upgrade pipeline for JOCA internals.

Scope: **JOCA internals only** -- skills, agents, commands, hooks, memory tools.
Never touches project files, external repos, or user data.

## When to run

- After accumulating `/save` sessions that generated feedback
- When the user says "upgrade joca", "apply feedback", "self-improve", "improve toolkit"
- As periodic maintenance

---

## Phase 1 -- Collect Feedback

### 1.0 System baseline (before touching anything)

The Phase 4c system block is compared against this baseline. Without a baseline, a new ⚠ introduced
by the run is indistinguishable from a ⚠ that was already there — and goes unnoticed (that is how a
stale `SKILL_INDEX.json` survived a whole run of 62 findings).

```bash
mkdir -p .joca/upgrade
node .claude/scripts/joca-doctor.mjs > .joca/upgrade/doctor-baseline.txt 2>&1; echo "exit=$?"
tail -2 .joca/upgrade/doctor-baseline.txt          # the "Summary: N ✓ · N ⚠ · N ✗" line
git rev-parse HEAD > .joca/upgrade/head-baseline.txt
ls memory/feedback/*.md | wc -l                    # number of files at intake
```

If `memory/feedback/auto-upgrade-log.md` already exists, save the date of the last `## <date>` heading —
it is the mark from which **intake vs output** is counted in Phase 6.

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
- `session-*.md` -- feedback sessions auto-extracted by `/save`
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
Run /save to auto-extract feedback patterns from a session first.
```

Stop here.

### 1.5 The `state` field -- mandatory, with evidence read from disk

No issue passes to Phase 2 without `state`. It is the step that makes the command **idempotent across
machines** and the one that saves the most: in a real run, 163 of 285 issues were already done; in another, 54
of 131. Without it the command rewrites what already exists.

| `state` | Criterion | Evidence required |
|---|---|---|
| `ALREADY_RESOLVED` | the described fix **is on disk** | command + output: `grep -n "<new text>" <target>` with a hit |
| `PENDING` | the target exists and does not have the fix | `grep` with no hit **on the target's full path** |
| `UNCERTAIN` | ambiguous target, or the fix is not verifiable by text | say why, in 1 line |

Hard rules:
- **`**Resolved:** <date>` in the feedback file is a lead, not a filter.** With 2 alternating machines,
  a fix marked as applied on one machine may never have crossed over to the other. Confirm on
  disk before skipping.
- **Non-existent target = a finding.** If the `ls` of the affected component fails, the issue is `UNCERTAIN`
  with the note "target does not exist" — you never create the file out of nothing to "fulfill" the issue. In a
  real run the feedback cited `skills/webapp-testing.md`, which did not exist.
- A claim of non-existence requires the **full path** in the command, not the basename.
- Only the `PENDING` ones go on to Phase 2. The `UNCERTAIN` ones go to the Phase 3 gate, listed separately.

### 1.6 Backlog mode (above ~30 issues)

Above ~30 issues, Phase 1.3 ("aggregate and deduplicate into one list") and Phase 3 (a table to
confirm) stop being practicable — 330 issues in 101 files has already happened. In that case:

**(a) Triage by fan-out of READ-ONLY agents.** One agent per **family of targets** (commands ·
rules · skills · agents · scripts · memory), 3-5 in parallel in the same turn. Each returns, per
issue: `state` + evidence + severity + target. Mandatory brief, on top of the usual 4 fields:

```
YOU EDIT NOTHING. Writing tools forbidden — only Read/Grep/Glob/read-only-Bash.
A triager who "takes the chance to fix things" destroys the idempotence the triage exists to guarantee,
and the result stops being auditable (there is no telling what was the initial state and what was your action).
Write the result to .joca/upgrade/triage-<family>.md and return only the summary + the path.
```

**(b) Aggregate by defect, not by issue.** Present **clusters** (same defect, same target) in
Phase 3, not 330 lines. Disjoint files per cluster — two agents in the same file step on each other.

**(c) Slice by severity.** One run = one band (`critical`+`high`, then `medium`+`low`).
In the frontmatter of each file covered only in part:

```yaml
processed: partial
upgrade_run: 2026-08-17
upgrade_covered: [critical, high]
```

Archive (Phase 6.3) only when **all** the bands are covered.

**(d) Expiry.** `medium`/`low` older than ~8 weeks in a toolkit that has changed in the meantime no longer
describe the same gap. Propose archiving by age at the Phase 3 gate, with the list in plain sight — archiving
by age is more honest than keeping a queue that never empties.

**(e) Intake vs output.** Always report: new files since the last run (baseline 1.0) vs
those processed in this one. If the intake wins consistently, backlog mode is masking the
problem, not solving it — say so in the Phase 6 report.

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
  #1: session-my-project-2026-05-20.md > Issue 3
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

## Phase 4b -- Verify by EFFECT (mandatory)

You never go from Phase 4 to Phase 5 on the report of whoever wrote it. In a run with adversarial
verification from the outside, 4 defects were caught that would have gone in silently: one agent deleted 20
whole lines of a command and did not report it; another wrote a factually false warning claiming
to have "verified it by running the script". **The report describes the intent; only the disk shows the effect.**

For **each file touched**:

```bash
grep -n "<exact phrase that was added>" <file>              # does the new text really exist?
git diff --stat -- <file>                                   # how much went in vs how much went out
git diff -- <file> | grep '^-' | grep -v '^---'             # what was DELETED (should be only what was expected)
```

And, depending on the type:

| What the change introduced | Verification |
|---|---|
| a file path | `ls <full path>` |
| a CLI flag | `<cli> --help` and confirm the flag in the output |
| `.js` / `.mjs` | `node --check <file>` |
| `.py` | `python3 -m py_compile <file>` |
| `.sh` | `bash -n <file>` |
| skill triggers | see 4b.1 |

**4b.1 New triggers go to the START of the list.** `build-skill-index.py` keeps at most **15
triggers per component** (`return unique[:15]`, line 130) and does not warn when it cuts. Appending to the
end of the frontmatter list — what any editor does by default — produces a change that exists
in the file and **does nothing**: skills load lazily through the index and the new term is never
found. After reindexing (4c):

```bash
grep -c "<new trigger>" memory/SKILL_INDEX.json   # 0 = inert, it fell outside the cut
```

**In backlog mode:** one verifier per batch, dispatched **after** the writing batch and **without** having
taken part in it. Whoever wrote the code does not sign the gate.

A defect found here = repaired in this run, not an item for the next cycle.

## Phase 4c -- System block (once, against the baseline)

Per-file verification does not see the **system's derived state**. The 12 defects of one run
were nearly all the same family: it was written into the `.md` and did not propagate — a new skill outside
`SKILL_INDEX.json`, new triggers inert, `.agents/`/`.codex/` mirrors diverging, `README.md`
counts wrong. Run the three commands **after all the files are written**:

```bash
python3 .claude/scripts/build-skill-index.py     # Windows: python — regenerates memory/SKILL_INDEX.json
bash    .claude/scripts/compile-bridges.sh       # regenerates AGENTS.md / GEMINI.md / .agents / .codex
node    .claude/scripts/joca-doctor.mjs > .joca/upgrade/doctor-after.txt 2>&1; echo "exit=$?"
```

**Compare with the 1.0 baseline — running the commands without comparing is not a gate:**

```bash
diff .joca/upgrade/doctor-baseline.txt .joca/upgrade/doctor-after.txt
tail -2 .joca/upgrade/doctor-after.txt          # "Summary: N ✓ · N ⚠ · N ✗"
```

| Reading of the diff | Action |
|---|---|
| ⚠ or ✗ **new** compared with the baseline | a defect **of this run** — repair it before Phase 5, never report it as pre-existing |
| ⚠/✗ that was already in the baseline | list it as pre-existing in Phase 6, do not fix it by drag-along |
| ⚠/✗ that disappeared | a win — credit it to the item that resolved it |

`joca-doctor.mjs` exits with `1` if there is a ✗. It accepts `--fix` for what is auto-fixable (counts),
but `--fix` is run **after** reading the diff, otherwise it erases the evidence that the run introduced the ⚠.

Also confirm that the mirrors did not diverge silently:

```bash
git status --short .agents .codex AGENTS.md GEMINI.md
```

A file changed here and not committed together with the source = guaranteed divergence in the next cycle.

---

## Phase 5 -- Validate

> Steps 5.3, 5.4 and 5.6 already ran in Phase 4c, **with a comparison against the baseline**. Here they
> are only repeated if Phase 5 changed some other file (e.g. 5.5 INDEX.md); and in that case you
> compare again, you do not run for the sake of running.

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
# Windows uses `python` (`python3` is the empty Store stub); macOS/Linux use `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" .claude/scripts/build-skill-index.py && break; done
```

If the script does not exist or fails: manually rebuild the index by scanning `.claude/skills/` and `.claude/agents/` for frontmatter (`name`, `description`, `path`) and writing to `memory/SKILL_INDEX.json`.

### 5.4 Recompile bridges

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null
```

If the script fails or does not exist: skip and note in report.

### 5.5 Update INDEX.md

For each new skill or agent created, add an entry to `memory/INDEX.md` in the appropriate section.

### 5.6 Realign the derived inventory (if skills/agents/commands were added or removed)

A component that no index surfaces is effectively invisible — relevance matching never reaches it. So when this upgrade creates, renames or removes anything, realign the three derived surfaces in the same run:

```
python .claude/scripts/build-skill-index.py    # macOS/Linux: python3 — regenerates memory/SKILL_INDEX.json
bash   .claude/scripts/compile-bridges.sh      # regenerates AGENTS.md / GEMINI.md / .agents / .codex
node   .claude/scripts/joca-doctor.mjs         # gate: exit 1 on dead paths/indexes
```

Then edit by hand, surgically: the counts and the component's line in `memory/INDEX.md`, the Trigger Map / `## Commands` table in `JOCA_Brain/CLAUDE.md`, and `README.md`.

> There used to be a `/sync-questionnaires` command here, whose job was keeping form-style questionnaires in `/install` and project onboarding aligned with the inventory. Those questionnaires are gone — onboarding is a conversation now (see `/start`), so nothing has to be kept in sync with a hardcoded list. Only the derived indexes above remain.

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
  joca-doctor: baseline 20 ✓ · 1 ⚠ · 1 ✗  →  after 21 ✓ · 1 ⚠ · 0 ✗
    new in this run: 0            (any new ⚠/✗ is a defect of this run)
    pre-existing:    1 ⚠ (soul.md not filled in)
  [Codex review: 0 issues / not available]

Intake vs output (since <date of the last run>):
  new feedback files: N     processed in this run: M
  → balance: +/-K        (if the intake wins consistently, say it out loud)
  band covered: [critical, high]    deferred: X medium/low issues

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
  - Realign the derived inventory if skills/agents/commands changed (step 5.6)
  - Run /save in your next session to auto-capture new feedback patterns
  - Review failed items manually: <list of failed items>
```

> **Windows:** if this upgrade ran on Windows and any change touches the JOCA_OS layer, defer UI verification to the `joca-os-windows` skill — the JOCA_OS is developed/validated on macOS and that skill re-tests and fixes the Windows-sensitive parts in one pass.

---

## Rules

- Never implement without user confirmation (Phase 3.2 gate)
- No issue passes without `state` + evidence read from disk (Phase 1.5) — the `**Resolved:**` mark is a lead, not a filter
- Above ~30 issues, triage by fan-out of **read-only** agents (Phase 1.6a); a triager that edits destroys the idempotence
- Phase 4b and 4c are mandatory: verify by **effect**, and compare `joca-doctor` with the 1.0 baseline — running the commands without comparing is not a gate
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

---

## `--auto` mode (headless — Hermes-style skill loop)

`/upgrade-joca --auto` runs the cycle WITHOUT interaction — meant for sessions where the user explicitly asked for an autonomous routine. The human gate of Phase 3.2 is replaced by a conservative perimeter:

**It can apply on its own (allowlist):**
- `IMPROVE_SKILL` — improve an existing skill (improver/evaluator loop, the 8.0/10 threshold still holds)
- `FIX_TRIGGER` — fix the triggers/description of a skill that did not fire when it should have
- Regenerate `SKILL_INDEX.json` + bridges + mark/archive processed feedback

**It NEVER applies on its own (stays as a proposal):**
- `NEW_SKILL` / `NEW_AGENT` — writes the draft to `memory/feedback/proposals/<name>.md` with the rationale and stops
- `FIX_AGENT` on orchestration agents (master-orchestrator, task-router, self-improver)
- `CONFIG_CHANGE` (CLAUDE.md, soul.md, rules/, settings.json, hooks)
- Anything outside `.claude/skills/` + the indexes

**Extra rules of auto mode:**
- No pending feedback (≥1 file) → terminates immediately with "nothing to process" (does not invent improvements)
- Maximum of 5 improvements applied per run (the rest are left for the next cycle, in order of severity)
- At the end, write a summary to `memory/feedback/auto-upgrade-log.md` (append): date, items applied, items proposed, items failed
- ALWAYS end with a clear summary (the JOCA_OS worker captures it and the judge classifies it) — list: applied / proposed / failed / deferred

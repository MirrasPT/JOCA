---
name: create-skill
description: Create a new SKILL.md from scratch or upgrade an existing one through an iterative AI self-improvement pipeline. Researches the topic, drafts a skill, then runs up to 3 improvement + evaluation cycles to produce the final optimized skill. Use when you want to create a new skill, or say "--upgrade skill-name" to improve an existing one.
argument-hint: "[description of skill] or --upgrade [skill-name]"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Glob Grep WebSearch WebFetch
---

# Create Skill — Self-Improving Pipeline

Creates or upgrades a `SKILL.md` through automated research → draft → improve → evaluate cycles.
Read `templates/skill-template.md` for the canonical SKILL.md format before doing anything.

---

## Step 0: Parse Request

**Input:** `$ARGUMENTS`

- If starts with `--upgrade ` → **MODE = upgrade**, extract `SKILL_NAME` (everything after `--upgrade `)
- Otherwise → **MODE = new**, full input is `REQUEST`

---

## Step 1: Context Gathering

### Mode: new
1. **Scan existing JOCA skills** — list all skills recursively to detect overlap or complementary skills:
   ```bash
   find .claude/skills/ -name "SKILL.md" | sort
   ```
   Read `memory/INDEX.md` for quick descriptions of all 80+ skills.
2. **Web research** — run 2-3 targeted searches:
   - `"[REQUEST] best practices site:github.com"`
   - `"Claude Code skill [REQUEST]"`
   - `"[REQUEST] examples implementation"`
3. Summarise findings in 3-5 actionable bullet points. Identify: what does a great skill for this topic need to know?

### Mode: upgrade
1. **Find skill path** — skills are in categorized directories, not depth-1:
   ```bash
   find .claude/skills/ -name "SKILL.md" | xargs grep -l "^name: [SKILL_NAME]$" 2>/dev/null
   # OR search by directory name:
   find .claude/skills/ -type d -name "[SKILL_NAME]"
   ```
2. Read the found `SKILL.md` — this is `current_version`
3. Read `skill-creation-log.md` in the same directory if it exists (history)
4. Note current weaknesses to address

---

## Step 2: Create Initial Draft (v1)

Write a complete `SKILL.md` following `templates/skill-template.md`.

**Quality gates for v1:**
- `description` field: front-load the primary use case. Include 3-5 trigger phrases. Max 1,536 chars total for description + when_to_use combined.
- Instructions: specific and actionable — not "handle errors" but "if X fails, do Y"
- Include `when_to_use` for additional trigger patterns
- Set `allowed-tools` if the skill needs specific tools
- Keep SKILL.md under 500 lines; reference supporting files for heavy content
- No vague instructions. Every sentence should change Claude's behaviour in a concrete way.

Store this as `current_version` (text in memory).
Set `best_version` = v1, `best_score` = 0, `all_versions` = [v1].

---

## Step 3: Improvement Loop (max 3 iterations)

For iteration N from 1 to 3:

### 3a — Improve

Spawn the `skill-improver` agent with exactly this prompt:

```
ORIGINAL REQUEST: [REQUEST or "upgrade of [SKILL_NAME]"]
ITERATION: [N] of 3
PREVIOUS EVALUATOR FEEDBACK: [paste full feedback JSON from last eval, or "none — this is the first improvement pass"]

CURRENT SKILL CONTENT:
[paste current_version verbatim]

Improve this skill. Return ONLY the complete improved SKILL.md content. No preamble, no explanation, no markdown code fences around it — just the raw SKILL.md starting with the --- frontmatter.
```

Set `current_version` = agent's response (the full improved SKILL.md text).
Append to `all_versions`.

### 3b — Evaluate

Spawn the `skill-evaluator` agent with exactly this prompt:

```
ORIGINAL REQUEST: [REQUEST or "upgrade of [SKILL_NAME]"]
ITERATION: [N] of 3

SKILL TO EVALUATE:
[paste current_version verbatim]

Evaluate this skill. Return ONLY valid JSON — no preamble, no explanation, no markdown code fences.
```

Parse the JSON response. Extract:
- `score` (float, 0-10)
- `verdict` ("PASS" or "FAIL")
- `feedback` (array of specific improvement suggestions)
- `strengths` (array)
- `weaknesses` (array)

If `score` > `best_score`:
  - `best_version` = `current_version`
  - `best_score` = score
  - `best_iteration` = N

### 3c — Decision

- If `verdict` == "PASS" (score ≥ 8.0): **break loop** — quality threshold reached
- If N == 3: **break loop** — max iterations reached
- Otherwise: set `last_feedback` = parsed feedback, continue to iteration N+1

---

## Step 4: Finalise

### 4a — Extract metadata
Parse `best_version` frontmatter to get `name` field.
If no `name`, derive from REQUEST: lowercase, hyphens, max 32 chars.

### 4b — Save skill

Todas as skills criadas pelo pipeline vão sempre para `created-skills/`:

```bash
mkdir -p .claude/skills/created-skills/[name]/
```
Write `best_version` to `.claude/skills/created-skills/[name]/SKILL.md`.

### 4c — Write creation log
Write `.claude/skills/created-skills/[name]/skill-creation-log.md`:
```markdown
# Skill Creation Log — [name]

**Created:** [date]
**Request:** [REQUEST]
**Mode:** [new/upgrade]
**Final score:** [best_score]/10
**Iterations run:** [N]
**Best at iteration:** [best_iteration]

## Version scores
[list each iteration score]

## Final evaluator feedback
[paste best version's eval JSON]
```

### 4d — Register in JOCA
1. Add entry to `memory/INDEX.md` under `### Created Skills` section (create section if it doesn't exist)
2. Do NOT add to `CLAUDE.md` — `created-skills/` is auto-discovered

### 4e — Report to user
```
✓ Skill ready: /[name]
  Path:   .claude/skills/created-skills/[name]/SKILL.md
  Score:  [best_score]/10
  Iterations: [N] (stopped: [PASS threshold reached / max iterations])

Trigger phrases (from description):
  [extract 3-5 key phrases from the description field]

How to use:
  /[name] [argument-hint if present]
  or let Claude invoke it automatically when relevant
```

---

## Notes

- If both agents fail or return unparseable output, skip that iteration and continue
- If web search returns nothing useful, proceed with general knowledge
- For upgrades, preserve the existing skill's name and directory (do not move between categories)
- All new skills always go to `created-skills/` — never to category directories (design/, dev/, etc.)
- The pipeline is fully autonomous — only report back at the end

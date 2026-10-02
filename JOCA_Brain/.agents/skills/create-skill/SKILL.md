---
name: create-skill
description: "Create a new SKILL.md from scratch or upgrade an existing one through an iterative AI self-improvement pipeline. MUST be invoked when the user says: --upgrade skill-name."
argument-hint: "[description of skill] or --upgrade [skill-name]"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Glob Grep WebSearch WebFetch
---

# Create Skill — Self-Improving Pipeline

Creates or upgrades a `SKILL.md` via automated research, draft, improve, evaluate cycles.
Read `templates/skill-template.md` for canonical format before starting.

## Step 0: Parse Request

**Input:** `$ARGUMENTS`

- Starts with `--upgrade ` → **MODE = upgrade**, extract `SKILL_NAME`
- Otherwise → **MODE = new**, full input is `REQUEST`

## Step 1: Context Gathering

### Mode: new
0. **Prior-art — MANDATORY before drafting anything** (order fixed; stop at the first hit):
   1. **Official upstream** — does the vendor of the tool/model/API publish its own skill? Search the
      vendor's GitHub org for a `skills/` folder or `SKILL.md` (`gh search code "<topic>" --owner <vendor> --filename SKILL.md`),
      plus `anthropics/skills` (public Agent Skills repo).
   2. **Community** — `"[REQUEST] SKILL.md"` / `"[REQUEST] claude code skill"` on GitHub.
   3. **Local index** — `grep -i "<domain>" memory/SKILL_INDEX.json` (step 1 below).
   Official hit → **adopt, don't rewrite**: copy the originals literally to `.claude/reference/<name>-oficial/`,
   write a thin wrapper skill with `origem: <owner>/<repo> (oficial)` in frontmatter (model:
   `h3-prompt-writing.md`), and skip Steps 2-3. Community hit → use as v1 input, cite the source.
   No hit → say so in the summary with the searches run, then continue.
   > Real case (2026-09-04): almost an hour spent preparing MiniMax-H3 skills from scratch before
   > finding that MiniMax publishes 9 official Claude Code skills — the user had to ask.
1. **Scan existing skills** — detect overlap:
   ```bash
   find .claude/skills/ -name "SKILL.md" | sort
   ```
   Read `memory/INDEX.md` for descriptions of all 80+ skills.
2. **Web research** — 2-3 targeted searches:
   - `"[REQUEST] best practices site:github.com"`
   - `"Claude Code skill [REQUEST]"`
   - `"[REQUEST] examples implementation"`
3. Summarise findings in 3-5 actionable bullets.

### Mode: upgrade
1. **Find skill path**:
   ```bash
   find .claude/skills/ -name "SKILL.md" | xargs grep -l "^name: [SKILL_NAME]$" 2>/dev/null
   # OR by directory name:
   find .claude/skills/ -type d -name "[SKILL_NAME]"
   ```
2. Read found `SKILL.md` — this is `current_version`
3. Read `skill-creation-log.md` in same directory if it exists
4. Note weaknesses to address

## Step 2: Create Initial Draft (v1)

Write complete `SKILL.md` following `templates/skill-template.md`.

**Quality gates:**
- `description`: front-load primary use case. 3-5 trigger phrases. Max 1,536 chars for description + when_to_use combined.
- Instructions: specific — not "handle errors" but "if X fails, do Y"
- Include `when_to_use` for additional trigger patterns
- Set `allowed-tools` if needed
- Under 500 lines; reference supporting files for heavy content
- Every sentence must change Claude's behaviour concretely.

Store as `current_version`. Set `best_version` = v1, `best_score` = 0, `all_versions` = [v1].

## Step 3: Improvement Loop (max 3 iterations)

For iteration N from 1 to 3:

### 3a — Improve

Spawn `skill-improver` agent with this prompt:

```
ORIGINAL REQUEST: [REQUEST or "upgrade of [SKILL_NAME]"]
ITERATION: [N] of 3
PREVIOUS EVALUATOR FEEDBACK: [paste full feedback JSON from last eval, or "none — this is the first improvement pass"]

CURRENT SKILL CONTENT:
[paste current_version verbatim]

Improve this skill. Return ONLY the complete improved SKILL.md content. No preamble, no explanation, no markdown code fences around it — just the raw SKILL.md starting with the --- frontmatter.
```

Set `current_version` = agent's response. Append to `all_versions`.

### 3b — Evaluate

Spawn `skill-evaluator` agent with this prompt:

```
ORIGINAL REQUEST: [REQUEST or "upgrade of [SKILL_NAME]"]
ITERATION: [N] of 3

SKILL TO EVALUATE:
[paste current_version verbatim]

Evaluate this skill. Return ONLY valid JSON — no preamble, no explanation, no markdown code fences.
```

Parse JSON response. Extract:
- `score` (float, 0-10)
- `verdict` ("PASS" or "FAIL")
- `feedback` (array of improvement suggestions)
- `strengths` (array)
- `weaknesses` (array)

If `score` > `best_score`: update `best_version`, `best_score`, `best_iteration`.

### 3c — Decision

- `verdict` == "PASS" (score >= 8.0): **break** — threshold reached
- N == 3: **break** — max iterations
- Otherwise: set `last_feedback` = parsed feedback, continue to N+1

## Step 4: Finalise

### 4a — Extract metadata
Parse `best_version` frontmatter for `name`. If missing, derive from REQUEST: lowercase, hyphens, max 32 chars.

### 4b — Save skill
All pipeline-created skills go to `created-skills/`:
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

### 4c.5 — Validate frontmatter (gate)
Antes de registar, correr o linter no ficheiro escrito:
```bash
python .claude/scripts/validate-skill.py .claude/skills/created-skills/[name]/SKILL.md
```
(Windows: `python`, não `python3` — stub da Store.) Se devolver `[FAIL]` (frontmatter em falta, `name` não-kebab-case, `description` vazia) → corrigir e re-correr até `OK`/`WARN`. Não registar uma skill que falha o linter — a auto-selecção por triggers depende de frontmatter válido.

### 4c.6 — Behaviour eval (gate)
The `skill-evaluator` scores the **text**. This checks what the skill **does**.
1. Write `.claude/skills/created-skills/[name]/evals.json` with a **balanced** set: ≥3 **should fire** (typical requests, one of them phrased without the trigger words) and ≥3 **should not fire** (neighbour requests with their owner skill named, plus one keyword-adjacency trap). Each case: `id`, `prompt`, `expected` (`fire` / `no-fire:<owner>`), `assertions` with a script-checkable `check`.
2. **Routing half (no tokens):** each prompt against the skill's `description` + `triggers` — should-fire must match, should-not must not steal from its owner. A negative that fires → sharpen the description, not the case.
3. **Behaviour half (costs tokens, on request):** run the should-fire prompts with the skill loaded and grade the assertions.
4. **The eval grades the skill, it does not change it.** Failing case → fix the case if it was wrong, or log the defect in `skill-creation-log.md`. Never loosen an assertion so the number passes.
5. Option when the skill is packaged as a plugin or skills-dir: `claude plugin eval <path>` runs `evals/**/case.yaml` with a no-plugin baseline arm (exists in Claude Code 2.1.284, `claude plugin eval --help`, verificado 2026-09-28). JOCA skills loaded by `Read()` are not a plugin — it does not see them as they are.

Adapted from elvisun/newsjack `eval/newsworthiness-check` (MIT).

### 4d — Register in JOCA
1. Add entry to `memory/INDEX.md` under `### Created Skills` (create if missing)
2. Do NOT add to `CLAUDE.md` — `created-skills/` is auto-discovered

### 4e — Report to user
```
✓ Skill ready: /[name]
  Path:   .claude/skills/created-skills/[name]/SKILL.md
  Score:  [best_score]/10
  Iterations: [N] (stopped: [PASS threshold reached / max iterations])

Trigger phrases (from description):
  [extract 3-5 key phrases from description]

How to use:
  /[name] [argument-hint if present]
  or let Claude invoke it automatically when relevant
```

## Notes

- If both agents fail or return unparseable output, skip that iteration
- If web search returns nothing useful, proceed with general knowledge
- For upgrades, preserve existing skill's name and directory
- All new skills go to `created-skills/` — never to category directories
- Pipeline is fully autonomous — report only at the end
- **Chaining (obrigatório):** toda a skill/agente novo nasce com (a) frontmatter `chain:` (próximos skills/agentes prováveis, se houver) e (b) secção `## Próximo passo (chain)` no corpo a dizer quando disparar cada um + o gate (irreversível → confirmar). Agentes novos incluem **Step 0: Read das skills relevantes** no corpo. Ver `rules/chaining.md`.

## Maintenance — version claims and wrong phrases

A skill that states a version, limit or browser support without a date reads as current forever.
- **Claims ledger:** every version-dependent claim goes in `created-skills/[name]/VERSIONS.md` as `claim · primary source · verified YYYY-MM-DD`. Unconfirmed row → `VERIFY-NEEDED` (the only to-do list; no second tracker). Re-checking with no change still moves the date.
- **Denylist:** a phrase that once came out wrong (API that does not exist, support claimed where there is none) goes in `created-skills/[name]/DENYLIST.tsv` as `pattern<TAB>why<TAB>narrow exemption` (the exemption covers only the sentence that teaches "never write X"). Before saving an upgrade, `grep -F` each pattern over the skill — a hit blocks the save.
- **Upgrade mode** reads both files in Step 1 and re-verifies rows older than the subject's release cadence.

Adapted from AThevon/genjutsu `VERSIONS.md` + `AThevon/genjutsu:scripts/check-denylist.sh` (MIT; third-party repo, not in this tree).

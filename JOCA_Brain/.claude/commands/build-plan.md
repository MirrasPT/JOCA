---
origin: local
---

# /build-plan — Supervised Phased Build

Bridge between `/plan` (planning) and `/one-shot` (autonomous execution). Persists the plan as an artifact in `docs/`, decomposes it into tasks per phase, and runs an implementation loop with a test gate + a human checkpoint between phases.

**When to use:**
- A project with enough risk not to trust a fully autonomous execution
- You want human review between phases before proceeding
- Output from `/plan` or a PRD exists and has to be turned into a controlled implementation

**Difference from /one-shot:** `/one-shot` executes to the end without interruptions. `/build-plan` stops at every phase gate — a human validates before advancing.
**Difference from /plan:** `/plan` produces the document and stops. `/build-plan` consumes that document and executes.

---

## PREREQUISITES

The project MUST have at least one of these:
- Output from `/plan` (active conversation with an approved plan)
- `PRD.md` or `TECH_SPEC.md` with phases or features defined
- `docs/plan.md` from a previous session

If none exists: run `/plan` first. Do not invent scope.

---

## PHASE 0 — Load and Validate Context

```
Read: CLAUDE.md (project constraints)
Read: memory/SKILL_INDEX.json (available skills)
Read: PRD.md / TECH_SPEC.md / output from /plan (whichever exists)
```

Check:
- [ ] Stack defined
- [ ] Phases or features with clear acceptance criteria
- [ ] No blocking decision left open with no owner

If something critical is missing → report exactly what is missing and stop. Do not proceed.

---

## PHASE 1 — Persist the Plan

Write `docs/plan.md` with:

```markdown
# Plan — <project-name>
_Generated: <YYYY-MM-DD>_

## Scope
<objective in 2-3 lines>

## Stack
<detected stack>

## Phases
| # | Name | Description | Dependencies | Parallelizable |
|---|------|-----------|--------------|----------------|
| 1 | ... | ... | — | no |
| 2 | ... | ... | Phase 1 | yes |

## Architecture Decisions
<key decisions with a 1-line rationale each>

## Out of Scope
<what was explicitly excluded>

## Open Questions
<unanswered questions — BLOCKS implementation if critical>
```

If `docs/plan.md` already exists with relevant content → read it, confirm with the user whether to overwrite or merge.

**Confirm with the user:** "Plan persisted in docs/plan.md. Proceed to task decomposition?"

---

## PHASE 2 — Decompose into Tasks

Write `docs/tasks.md` with tasks grouped by phase:

```markdown
# Tasks — <project-name>
_Generated: <YYYY-MM-DD> | Status: in-progress_

## Phase 1 — <name>
Status: pending

- [ ] [1.1] <task> — `path/file.ext` — depends: — [P]
- [ ] [1.2] <task> — `path/file.ext` — depends: 1.1
- [ ] [1.3] <task> — `path/file.ext` — depends: 1.1 — [P]

**Gate:** <concrete test criterion to close this phase>

## Phase 2 — <name>
Status: blocked (awaiting Phase 1)
...
```

Conventions:
- `[P]` — parallelizable task (no shared-write dependencies)
- Each task with the exact file(s) it affects
- Explicit dependencies between tasks (not whole phases where avoidable)
- Phase gate = executable criterion (e.g.: "tests X pass", "endpoint Y answers 200")

**Confirm with the user:** "Tasks decomposed in docs/tasks.md — N phases, N tasks. Start Phase 1?"

---

## PHASE 3..N — Per-Phase Implementation Loop

For each phase (sequential by dependencies, parallel where `[P]` allows):

### 3a. Phase Briefing

Before executing, show:
```
━━━ PHASE <N> — <name> ━━━
Tasks: N items
Gate: <criterion>
Files: <list>
Depends on: <previous phases>
Advance? [Enter to continue / 's' to skip / 'q' to stop]
```

### 3b. Implementation

Activate the relevant skill before writing code:
- Check the trigger map in CLAUDE.md
- Read the skill (`[skill: <name>]`) if match ≥ 60%
- Execute the phase's tasks — touch only what is necessary

Update the status in `docs/tasks.md` as it completes:
- `[ ]` → `[x]` per completed task
- Phase status: `pending` → `in-progress` → `awaiting-gate`

### 3c. Test Gate

After the phase's implementation, run the gate:

```bash
# Run the tests relevant to the phase
# (stack-specific commands — do not invent them; read the project's CLAUDE.md)
```

If the tests pass → mark the phase as `done` in `docs/tasks.md`.

If the tests fail:
1. Report exactly which ones failed and why
2. Try a surgical fix (1 attempt)
3. If it still fails → stop and present to the user. Do not advance to the next phase.

### 3d. Human Checkpoint

```
━━━ CHECKPOINT — PHASE <N> DONE ━━━
Gate: ✓ passed / ✗ failed
Files modified: <list>
Tests: N passed, N failed

Summary of what was done:
  • <item 1>
  • <item 2>

Advance to Phase <N+1>? [Enter / 'q' to stop]
```

If the user stops → save the state in `docs/tasks.md` (status `paused`). The next run resumes from here.

---

## RESUME AN INTERRUPTED SESSION

If `docs/tasks.md` exists with status `paused` or `in-progress`:

```
Previous session detected:
  Phases complete: N/N
  Last phase: <name> — <status>
  Resume? [Enter] / Start from scratch? ['r']
```

Resume = continue from the first phase with status != `done`.

---

## OPTIONAL ARGUMENTS

- `/build-plan --phase 2` — start directly at Phase 2 (previous phases marked as complete)
- `/build-plan --auto` — replace human checkpoints with auto-proceed if the gate passes (equivalent to `/one-shot` in phases)
- `/build-plan --dry-run` — generate `docs/plan.md` + `docs/tasks.md` without executing any implementation
- `/build-plan --no-tests` — skip the test gate (faster, less safe)

---

## FINAL REPORT

```
BUILD-PLAN — <project-name>
══════════════════════════════

Phases: N/N done

  ✓ Phase 1 — <name> (N tasks | gate passed)
  ✓ Phase 2 — <name> (N tasks | gate passed)
  ✗ Phase 3 — <name> (paused — gate failed)

Artifacts:
  docs/plan.md       ✓ persisted
  docs/tasks.md      ✓ updated (N/N tasks done)

Files modified: N
Tests: N passed, N failed

Next steps:
  → Resolve the Phase 3 gate, resume with /build-plan
  → /review-code once every phase is done
  → /one-shot --scope "phase N" for simple phases with no need for supervision
```

---

## NOTES

- Never advance a phase with a failed gate (except `--no-tests`).
- `docs/plan.md` and `docs/tasks.md` are the summary state — do not re-derive them if they exist.
- Skills activated per phase via the trigger map — not globally at the start.
- If the stack has no tests defined, ask the user for the gate criterion before starting Phase 1.
- Surgical edits — do not rewrite adjacent files not listed in the phase's tasks.

---

## `Workflow` authorization (harness tool)

**Running `/build-plan` is the user's explicit opt-in to the `Workflow` tool.** Do not ask whether you
may orchestrate — if the work splits into phases with fan-out, author the script and **call `Workflow`**.
When the script is unnecessary, `Agent()` in parallel in the same turn serves just as well.

Brakes that do **not** fall away with this authorization:
- **Cheap recon BEFORE authoring** the script (`rules/pipelines.md`) — `grep`/`ls` on the domain, inline.
- **1-line gate** on anything irreversible (deploy · push · migration · delete · payment · auth).
- **Verifier ≠ producer** — whoever writes does not sign off the gate (`.joca/loop.json`).
- **Size** comes from `/config` ("Dynamic workflow size"), not from this command.
- **Cost announced**: ≥6 agents or a loop of rounds → order of magnitude of tokens before launching.

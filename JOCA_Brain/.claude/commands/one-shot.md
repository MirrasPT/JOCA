# /one-shot — Autonomous End-to-End Development

Single entry point for autonomous production. Reads the planning documentation, the **main loop adopts the `master-orchestrator` playbook** and executes to completion without interruptions.

## Prerequisites

The project MUST have at least one of these files:
- `PRD.md` — product requirements
- `TECH_SPEC.md` — technical specification
- `TASKS.md` — task breakdown

If none exists: suggest `/start` or `/plan` first. Do not proceed without documentation.

## Flow

### 1. Load Context (Lazy)

```
Read: CLAUDE.md (project constraints)
Read: memory/SKILL_INDEX.json (index of available skills)
Read: PRD.md → scope and requirements
Read: TECH_SPEC.md → stack decisions (if it exists)
Read: TASKS.md → decomposed tasks (if it exists)
```

### 2. Validate Readiness

Check:
- [ ] Stack defined (Laravel? React? Flutter?)
- [ ] At least 1 feature described with acceptance criteria
- [ ] No blocking decision left open (Open Questions in the PRD with no owner)

If something critical is missing → report and stop. Do not invent requirements.

### 3. Orchestrate (the main loop adopts the playbook)

The **main loop reads `.claude/agents/master-orchestrator.md` and acts as the orchestrator ITSELF** — you do **not** do `Agent(subagent_type="master-orchestrator")` (a subagent does not dispatch workers; the 1-level rule in `rules/orchestration-patterns.md`). Following the playbook, the main loop decomposes the PRD/TASKS into work-streams and fires the *workers* via `Agent()`, each one with the mandatory canonical brief (8 clauses), under:

- **Objective:** implement the features of the PRD/TASKS autonomously.
- **Documentation:** PRD (3-line summary), detected stack, constraints from `CLAUDE.md`, files `PRD.md`/`TECH_SPEC.md`/`TASKS.md`.
- **Rules:** zero confirmations (except an irreversible action → gate); auto-trigger of the testers after each stream; structured final report.

### 4. Post-Execution

After the orchestrator completes:
1. **A worker that returned `null` is not a worker that failed.** Before reporting a stream as lost,
   check on disk (`git status`, `ls` of the stream's files). Real case: in a workflow of 8
   agents, `feat:contactos` wrote ContactModal (249 lines) + 4 endpoints + AdminInbox (418
   lines), all compiling, and only the final `StructuredOutput` call failed ("retry cap (5)
   exceeded") — the report said `contact: null` and gave the impression of lost work. Always
   distinguish **"the output shape failed"** from **"the agent died"**, and flag it that way in the report
   ("work on disk OK, structured return failed — check").
2. Present the report to the user
3. List files created/modified
4. **Review by reading ≠ verification.** If the pipeline ended in a deploy, run a post-deploy phase
   of end-to-end smoke testing (real HTTP + DB state), separate from the code review. Real case:
   adversarial review up to 9/10, 0 blockers — and missing assets and a column without the
   `ALTER` privilege reached production, both invisible to reading and trivial for a smoke test.
5. Suggest next steps (deploy? PR? manual review?)

## Optional Arguments

- `/one-shot --scope "feature X"` — limits it to a specific feature of the PRD
- `/one-shot --dry-run` — plans but does not execute (shows work streams without dispatch)
- `/one-shot --no-tests` — skip validation agents (faster, less safe)

## Usage Example

```
/one-shot
```

Result: Reads the PRD, decomposes it into streams (DB → API → Frontend), dispatches agents in parallel, runs tests, reports.

## When NOT to Use

- Project with no documentation (use `/plan` or `/start` first)
- Simple bug fix (use `/debug`)
- 1-file task (do it directly)
- Refactor with no spec (use `/plan` to define the scope first)


---

## `Workflow` authorization (harness tool)

**Running `/one-shot` is the user's explicit opt-in to the `Workflow` tool.** Do not ask whether you
may orchestrate — if the work splits into phases with fan-out, author the script and **call `Workflow`**.
When the script is unnecessary, `Agent()` in parallel in the same turn serves just as well.

Brakes that do **not** fall away with this authorization:
- **Cheap recon BEFORE authoring** the script (`rules/pipelines.md`) — `grep`/`ls` on the domain, inline.
- **1-line gate** on anything irreversible (deploy · push · migration · delete · payment · auth).
- **Verifier ≠ producer** — whoever writes does not sign off the gate (`.joca/loop.json`).
- **Size** comes from `/config` ("Dynamic workflow size"), not from this command.
- **Cost announced**: ≥6 agents or a loop of rounds → order of magnitude of tokens before launching.

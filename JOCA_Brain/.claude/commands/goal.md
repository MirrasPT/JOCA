# /goal — Auto-Orchestration from Natural Language

Entry point for a multi-agent workflow **without a PRD**. Takes a task in natural language,
synthesizes a minimal in-memory plan, and fires the `master-orchestrator` with a GOAL + a loop until done.

NL-driven variant of `/one-shot` (which stays PRD-driven). Use `/goal <description>`.

## When to use

- A task that crosses ≥2 domains, touches ≥3 files, or is a complete feature (route D of `rules/task-intake.md`).
- There is no (and no intention to create a) `PRD.md`/`TECH_SPEC.md`/`TASKS.md`.
- The Decision Filter classified the task as **workflow**.

For smaller tasks, do NOT use `/goal` — solve it via route A/B/C (answer / 1 skill / 1 agent).

## Flow

### 1. Load context (lazy)
```
Read: CLAUDE.md (constraints + trigger map)
Read: memory/SKILL_INDEX.json (index of available skills/agents)
Read: rules/task-intake.md + rules/orchestration-patterns.md (doctrine)
```

### 2. Synthesize the in-memory plan
From the NL description, derive:
- **GOAL** in 1-2 sentences.
- Explicit **acceptance criteria** (how we know it is done).
- **Candidate work-streams** — map the GOAL to the triggers of the real skills/agents in `SKILL_INDEX.json` (any domain, not just web). Independent = parallelizable.

Do not invent skill/agent names — only the ones listed in the index.

**The plan is visible, not in-memory.** Before step 4, print it in 5-15 lines: GOAL · acceptance
criteria · one block per work-stream with *the files that belong to it* and *the success criterion*. It is
not a gate (approval is not awaited on reversible work) — it is what makes it verifiable that two agents
do not write in the same file, and what the user corrects in 1 line before spending ~15x tokens.

### 3. Safety gate
Detect irreversible actions in the GOAL (auth/payments/migrations/deletes/deploy/push/destructive git).
If there are any → **1 line of confirmation** before firing. Otherwise, proceed.

### 4. Execute (the main loop IS the orchestrator)
The **main loop adopts the `.claude/agents/master-orchestrator.md` playbook** and conducts the orchestration ITSELF — you do **not** do `Agent(subagent_type="master-orchestrator")` (a subagent could not dispatch workers; the 1-level rule in `rules/orchestration-patterns.md`). Following the playbook, the main loop fires the *workers* via `Agent()` with:
- the GOAL + acceptance criteria,
- the in-memory plan (work-streams),
- the mandatory canonical brief (8 clauses — see master-orchestrator.md / soul.md).

Runs Phase 4.5 (Goal-Satisfaction Loop): compares the result vs the criteria, re-decomposes only the gap, re-dispatches. Cap `loop_max_iterations` (default 4); 3x with no progress → stops and reports.

### 5. Report
⚠ Before giving a stream up as failed: a worker that returns `null` may have done all the work and
only failed the `StructuredOutput` (this has already happened — see `/one-shot` STEP 4). Check on disk
(`git status`/`ls`) and report "work on disk OK, structured return failed", never a bare `null`.

Summarize what was done vs the acceptance criteria. List what was left unfinished (if the cap was reached) and auto-fire `tester-*` per the testing pipeline.

## Architectural constraint

Sub-agents do **not** spawn sub-agents. Auto-orchestration lives in the **main loop / in this command**, not in an agent-that-calls-agents. `master-orchestrator.md` is the **playbook** the main loop follows; **the spawning of the workers is done by the main loop** (not by a spawned `master-orchestrator`). See `rules/orchestration-patterns.md`.


---

## `Workflow` authorization (harness tool)

**Running `/goal` is the user's explicit opt-in to the `Workflow` tool.** Do not ask whether you
may orchestrate — if the work splits into phases with fan-out, author the script and **call `Workflow`**.
When the script is unnecessary, `Agent()` in parallel in the same turn serves just as well.

Brakes that do **not** fall away with this authorization:
- **Cheap recon BEFORE authoring** the script (`rules/pipelines.md`) — `grep`/`ls` on the domain, inline.
- **1-line gate** on anything irreversible (deploy · push · migration · delete · payment · auth).
- **Verifier ≠ producer** — whoever writes does not sign off the gate (`.joca/loop.json`).
- **Size** comes from `/config` ("Dynamic workflow size"), not from this command.
- **Cost announced**: ≥6 agents or a loop of rounds → order of magnitude of tokens before launching.

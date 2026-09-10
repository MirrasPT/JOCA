# /start — project startup (new or existing)

Single entry point for any project: form-based interview → initial PRD → house stack →
infra → design direction → hooks into execution.

`Read(".claude/skills/start.md")` — **the full doctrine lives there**. This command does not duplicate it:
read the skill and follow it to the letter (form rules, Phase 0 reading the disk, phases, artifacts).

`/start [project-name]` — with no argument, the name comes from the current folder and is confirmed in the form.

## Flow

1. `Read(".claude/skills/start.md")` and follow the phases there, from start to finish.
2. Stack: `rules/default-stack.md` (the house stack). Leaving it requires a reason in `docs/DECISIONS.md`.
3. The **way of working** the skill installs (issue before code · design validated before UI ·
   tests in a separate session · `PROGRESS.md` + `docs/DECISIONS.md` · waves with a gate) is a
   **global rule**, not a consequence of this command — `rules/pipelines.md` §Project doctrine.
4. A project that already exists on disk is connected with the **same** questionnaire, pre-filled from
   the files found: the user confirms instead of writing.

## Rules

- Nothing is irreversible until the scaffold. Writing over an existing file → versioned sibling
  name, never overwrite (soul.md / `rules/task-intake.md`).
- Do not invent product content: the problem, the audience and the boundaries belong to the user.

## Next step (chain)

- Documents and decisions closed → `execute-project` skill (foundation → design → gate → waves).
  Notify `[chain → execute-project]`. See `rules/chaining.md`.


---

## `Workflow` authorization (harness tool)

**Running `/start` is the user's explicit opt-in for the `Workflow` tool.** Do not ask whether you
may orchestrate — if the work splits into phases with fan-out, author the script and **call `Workflow`**.
When the script is unnecessary, `Agent()` in parallel in the same turn does the job just as well.

Brakes that do **not** fall away with this authorization:
- **Cheap recon BEFORE authoring** the script (`rules/pipelines.md`) — `grep`/`ls` over the domain, inline.
- **1-line gate** on anything irreversible (deploy · push · migration · delete · payment · auth).
- **Verifier ≠ producer** — whoever writes does not sign the gate (`.joca/loop.json`).
- **Size** comes from `/config` ("Dynamic workflow size"), not from this command.
- **Cost announced**: ≥6 agents or a loop of rounds → order of magnitude of tokens before launching.

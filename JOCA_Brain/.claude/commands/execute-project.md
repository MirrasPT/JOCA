# /execute-project — from PRD to production

Second half of the startup: takes what `/start` decided and **builds**, from scaffold to production.

`Read(".claude/skills/execute-project.md")` — **the complete doctrine lives there**. This command does
not duplicate it: read the skill and follow it to the letter (the four parts, each with its own exit criterion).

`/execute-project` — no arguments; the state comes from the documents on disk.

## Flow

```
E1 Foundation ──► E2 Design (forks) ──► E3 status checkpoint ⏸ ──► E4 Waves ──► production
```

1. **Prerequisite:** `docs/PRD.md` exists and the stack is decided. Does not exist → run `/start` first.
2. `Read(".claude/skills/execute-project.md")` and follow the parts from end to end.
3. Each step names the skill/agent that executes it — `Read()` the skill (the 60% rule) or dispatch the
   agent with brief + Step 0. Step→skill map: `.claude/reference/start/execution-skill-map.md`.
4. Shared state in `PROGRESS.md`; decisions in `docs/DECISIONS.md`.

## Rules

- **Do not invent scope:** the PRD is the contract. A new idea mid-flight becomes an issue, not code.
- E3 is a **user gate** (⏸) — you do not cross it on your own.
- Irreversible (push, deploy, migration) → 1 line of confirmation (`rules/task-intake.md`).
- Writing over an existing file → versioned sibling name, never overwrite.

## Next step (chain)

- `plan-waves` (E4) → `prepare-design`/`validate-design` per screen → `deploy-executor` at the end.
  See the skill's `chain:` and `rules/chaining.md`.


---

## `Workflow` authorization (harness tool)

**Running `/execute-project` is the user's explicit opt-in to the `Workflow` tool.** Do not ask whether you
may orchestrate — if the work splits into phases with fan-out, author the script and **call `Workflow`**.
When the script is unnecessary, `Agent()` in parallel in the same turn serves just as well.

Brakes that do **not** fall away with this authorization:
- **Cheap recon BEFORE authoring** the script (`rules/pipelines.md`) — `grep`/`ls` on the domain, inline.
- **1-line gate** on anything irreversible (deploy · push · migration · delete · payment · auth).
- **Verifier ≠ producer** — whoever writes does not sign off the gate (`.joca/loop.json`).
- **Size** comes from `/config` ("Dynamic workflow size"), not from this command.
- **Cost announced**: ≥6 agents or a loop of rounds → order of magnitude of tokens before launching.

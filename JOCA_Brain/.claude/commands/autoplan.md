# /autoplan — Full plan, self-reviewed (NL → approved plan)

Adapted from gstack's `autoplan`. Takes an objective in natural language and produces a **plan that is already reviewed** by running the `autoplan` pipeline (`.claude/reference/pipelines-catalog.md`) **in depth and on its own** — auto-deciding the reversible choices and raising only "taste"/ambiguity at the **final gate**.

Difference from `/plan`: `/plan` produces ONE plan; `/autoplan` runs the chain of reviews (product → design → engineering) automatically, like a team, without stopping at every step.

---

## When to use
- "plan this properly", "full plan", "autoplan", "I want a reviewed plan", big feature before building.
- For small/1-file tasks → `/plan` is enough (autoplan is overkill).

## Pipeline (auto-runner, in depth)

1. **Interrogate + orient** — `Read(".claude/skills/plan.md")`. 7 phases: OODA orient, surfacing assumptions, ambiguity, pre-mortem. Produces the base plan.
2. **Product review** (CEO-style) — challenges the problem: are we solving the right one? scope to expand/reduce? Decides the scope.
3. **Design review** — `Read(".claude/skills/design-review.md")` in **plan-mode**: scores the UX/UI dimensions 0-10 and says what would be missing to reach 10. (Only if the task has UI surface.)
4. **Engineering review** — architecture, data flow, edge cases, test coverage, performance. Locks the execution plan.
5. **Final gate** — raise in one go the accumulated **taste** / ambiguous / irreversible decisions (not mid-flight). The user approves/adjusts.

## Auto-decision (steps 2-4, reversible)
Per `rules/pipelines.md`: active Brain decision (`joca-brain active`) → project convention → skill default → smallest surface (YAGNI). Do not stop to ask on reversible choices — only accumulate the taste ones for the final gate.

## Output
- Final approved plan (inline or file, depending on the project).
- Non-obvious architecture decisions → record in the Brain: `node .claude/scripts/joca-brain.mjs decide --text "..." --source user`.

## Next step (chain)
- Approved plan → implement: `frontend` / `laravel-specialist` / the domain (chains to `tester-*`). Cross-stack → `/goal` runs the build pipeline.


---

## `Workflow` authorization (harness tool)

**Running `/autoplan` is the user's explicit opt-in to the `Workflow` tool.** Do not ask whether you
may orchestrate — if the work splits into phases with fan-out, author the script and **call `Workflow`**.
When the script is unnecessary, `Agent()` in parallel in the same turn serves just as well.

Brakes that do **not** fall away with this authorization:
- **Cheap recon BEFORE authoring** the script (`rules/pipelines.md`) — `grep`/`ls` on the domain, inline.
- **1-line gate** on anything irreversible (deploy · push · migration · delete · payment · auth).
- **Verifier ≠ producer** — whoever writes does not sign off the gate (`.joca/loop.json`).
- **Size** comes from `/config` ("Dynamic workflow size"), not from this command.
- **Cost announced**: ≥6 agents or a loop of rounds → order of magnitude of tokens before launching.

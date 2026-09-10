---
description: Reframes any request into a workflow measured against a real reference — fan-out + severe critic + blind comparison, looping until you hit the brake
argument-hint: "[what you want] [optional: at the level of REFERENCE] [optional: in STACK]"
---
# /gauntlet-loop — build against a real reference, in a loop

Invokes the **gauntlet-loop** skill. Domain-agnostic. **Pure prompt** — no harness, no state machine,
no helper scripts.

`Read(".claude/skills/gauntlet-loop.md")` and then:

1. **Infer the domain** of the request and fill the slots (`THING` / `REFERENCE` / `LOOK` / `TIER` /
   `AREA_1` / `AREA_2` / `CHECK` / `STACK`) from the args, the cwd and the project's `CLAUDE.md`.
   **One question at most**, and only if `THING` or `REFERENCE` are not inferable.
2. **Fix the `CHECK`** using the skill's profile table — how the critic compares blind in this domain
   (screenshot · contracts side by side · diff + metrics · measured number · reading out loud). With no
   falsifiable comparison, say so and propose the normal route instead of faking it.
3. **Fill in** the three paragraphs (`LOOP_VERB` = `/loop`, `CLOSING_TAIL` = ` and ultracode`) and save as
   an internal brief — do not dump it and wait.
4. **Run**: sequential foundation of what is shared → fan-out of `Agent()` **in the same turn** (cap 3-5,
   grouped by disjoint file/area) → **separate and severe critic** in its own agent → **blind** comparison
   against the real reference → fix → repeat.
5. Continue until **the human** hits the brake. Never ask "shall I continue?".
6. **Do not invent** capture tools, contracts, scoreboards, round ledgers or stopping rules.
   Do not fake the comparison: if the reference cannot be observed, use the verifiable substitute.
7. **Irreversible** steps (deploy/push/migration/delete/payment/auth) still take 1 line of
   confirmation — the loop does not publish on its own.

"compose only" → return only the filled-in prompt, without executing.

⚠ The loop does not end on its own, by design. **You are the brake.**

Task: $ARGUMENTS

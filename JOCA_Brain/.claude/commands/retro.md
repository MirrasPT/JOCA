# /retro — Retrospective (learnings from the window → actions)

Adapted from gstack's `retro`. Reads the project's recent learnings/decisions (Brain log), summarizes wins/problems/patterns and **proposes concrete actions**.

---

## When to use
- "retro", "retrospective", "what went well/badly", weekly review, end of a milestone.

## Steps

1. **Load the window** — the project's learnings + decisions:
```bash
node .claude/scripts/joca-brain.mjs recall --limit 20
node .claude/scripts/joca-brain.mjs active
```
   Optional: `git log --since="7 days ago" --oneline` for the window's real work.

2. **Synthesize** (3 blocks, terse):
   - **Wins** — what went well, patterns to repeat.
   - **Problems** — recurring bugs, friction, rework.
   - **Patterns** — what repeats (≥2x) and should become a rule or a skill.

3. **Propose actions** — each problem/pattern → 1 concrete action:
   - Reusable lesson → `node .claude/scripts/joca-brain.mjs learn --text "..." --tags retro`.
   - Pattern that deserves a skill/rule → suggest `/create-skill` or a note in `rules/`.
   - Recurring bug → suggest a fix or a guard-rail (`/guard`).
   - Improvement to JOCA itself → feed `/upgrade-joca` (writes to `memory/feedback/`).

4. **Record the retro** — optional: checkpoint `--status done`:
```bash
printf '## Retro <date>\n<synthesis>' | node .claude/scripts/joca-checkpoint.mjs save --title retro --status done
```

## Rules
- Terse. Do not invent wins/problems — derive them from the real log (Brain + git). Empty window → say so, do not fabricate.
- Actionable actions, not generic ones ("add index X on Y", not "improve performance").

## Next step (chain)
- Actions that improve JOCA → `/upgrade-joca`. New pattern → `/create-skill`.

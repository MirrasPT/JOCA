# /plan — Planning and Architecture

Enter Plan Mode.

`Read(".claude/skills/plan.md")` — planning methodology (interrogate + OODA), the same one `/autoplan` uses.

Analyze the context:
- Relevant project files
- Detected stack
- Objective stated by the user

Produce a plan with:
- Proposed approach and alternatives considered
- Tradeoffs of each option
- Concrete, verifiable steps
- Files that will be touched

Do not leave Plan Mode without explicit approval from the user.

## Next step (chain)
- Plan approved → domain skill/agent to implement it (via the Trigger Map in `CLAUDE.md`). Notify `[chain → <x>]`. See `rules/chaining.md`.

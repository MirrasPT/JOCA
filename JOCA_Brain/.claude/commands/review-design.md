# /review-design — Design Review (router)

Dispatches the right reviewer by **target type** and **need**. Does not always invoke the same agent.

## 1. Determine the target

- PLAN / PRD / `.md` spec (UI not built yet) → **plan-mode**
- Staging/local URL, or `.tsx`/`.html` file(s)/component → **live/code**
- Nothing specified → ask

## 2. Dispatch

### Plan-mode (shift-left, before the code)
`Read(".claude/skills/design-review.md")` → mode §2:
- classify marketing vs app
- state matrix (Loading/Empty/Error/Success/Partial)
- storyboard of the user journey + table of decisions still to resolve
- writes fixes back into the plan

### Live / code
Combine according to the need (they are not mutually exclusive):

| Need | Invoke |
|-------------|---------|
| Taste · AI-slop · composition · rubric + lint file:line | `design-review` (skill §1) — `Read(".claude/skills/design-review.md")` |
| UX flows · deep WCAG · ARIA · screen-reader · keyboard | `tester-ui-ux` (agent) |
| Token / component drift vs the design system | `design-system-audit` (agent) |
| Performance (Lighthouse / load) | `tester-performance` (agent) |

Default for "is it any good?" / "review the design" → `design-review` skill. Add `tester-ui-ux` when there are real flows/forms/a11y at stake.

## 3. Report

`design-review`: 3-pillar table + reject AI-slop + litmus + findings (Blocking/Major/Minor) + score + verdict + quick wins.
Agents: unified Critical / High / Medium sections.

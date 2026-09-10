# Review criteria

What to look for when reviewing code in this project.

Read by the `reviewer` sub-agent (`.claude/agents/reviewer.md`), which loads it
explicitly. If one day you have Claude Code Review — research preview, only on
Team or Enterprise subscriptions — this file is read by it too. The local
`/code-review` command does **not** read it.

Keep it short: every line is read on every review.

## Priorities, in this order

1. **Requirement compliance** — does the code do what the issue asks, and nothing
   that was declared out of scope?
2. **Correctness** — edge cases: empty, null, zero, negative, very large,
   concurrent. Error conditions with no handling.
3. **Security** — unvalidated input, secrets in the code, injection,
   missing authorization on sensitive operations.
4. **Conventions** — the ones written in `.ai/guidelines/`,
   `.claude/rules/` and in the `docs/` documents. `CLAUDE.md` is also there
   to read (it is where Boost gathers everything) — what you do not do is **edit it**,
   because it is regenerated.
5. **Interface** — when the diff touches views: does it comply with `docs/DESIGN.md`?
   Does it use the existing components? Does it have an empty state and an error state?
6. **Test quality** — do they derive from the issue's acceptance criteria, or do
   they only confirm what the code already does? A test that would pass with any
   implementation is not a test.

## Laravel-specific

- **N+1 queries** — relations loaded in loops without `with()`
- **Mass assignment** — `$fillable`/`$guarded` consistent with what the request accepts
- **Authorization** — policies or gates on the actions that touch another user's data
- **Validation** — form requests, not manual validation scattered through the controller
- **Migrations** — reversible; never change a migration already applied in production
- **Heavy work in a request** that should be a queued job

## Do not comment on

- Formatting and style — that is Pint's job
- Personal preferences with no technical justification
- Rewrites of code that is correct

## Format

For each problem: file and line, what is wrong, the concrete
consequence, and a suggestion.

Classify as **blocks** · **should fix** · **note**.

If there is nothing that blocks, say so clearly. A review that always finds
something stops being taken seriously.

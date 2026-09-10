# /debug — Error Triage

Gather context:
- Exact error (message, stack trace)
- Project stack (detect from files or ask)
- Latest changes before the error

Formulate hypotheses ordered by probability (max 3).

Routing (canonical Debug pipeline — `rules/pipelines.md`):
1. **Triage** — classify the error (stack, type, surface).
2. **Stack skill** — `Read()` the skill via the Trigger Map in `CLAUDE.md` (e.g.: Laravel/PHP → `laravel-specialist` · frontend/React → `frontend` · WordPress → `wordpress-router` · SQL → `mysql` · deploy/infra → `deploy-*`).
3. **Logs / stack trace present** → dispatch the `log-debugger` agent (Iron Law: root cause first).
4. **The cause is SQL** (slow query, N+1, EXPLAIN) → chain to `query-debugger`. Notify `[chain → query-debugger]`.

Propose concrete, verifiable diagnostic steps before any fix.

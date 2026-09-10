# Skill/Agent Chaining — automatic chaining

How a skill/agent hands the work to the **next one** without the user asking. Loaded in every session. Terse by design.

Principle: **the user says one thing, JOCA drives the whole sequence** — it classifies the route
(task-intake), runs the step, chains to the next one, stops only at an irreversible one.

## The `chain:` convention

Two complementary forms: frontmatter `chain: design-review, tester-ui-ux` (the list of likely next
steps, machine-readable) + a `## Next step (chain)` section in the body (the condition and the gate).
It is a **suggestion map**, not blind execution — the one who executes is the **main loop** (or command/orchestrator).

---

## Chaining Rule (main loop)

When a step finishes (skill executed / agent returned):
1. Read the `chain:`/`## Next step` of the step that just finished.
2. For each next candidate, evaluate the **condition** (e.g. "if there was frontend code → tester-ui-ux"; "if there are WCAG violations → a11y-fixer").
3. **Reversible** (the overwhelming majority: review, test, lint, design-review, recall) → **fire without asking**. Notify `[chain → <next>]`.
4. **Irreversible** (deploy/push/migration/delete/payment/auth) → 1 line of confirmation first.
5. **Anti-loop brake:** the same pair (step→next) does not fire 2x in the same task without new progress; max depth = `loop_max_iterations` (soul.md, default 4). 3x without progress → stop and report.

Chaining does **not** invent new scope (steward, not initiator — see `orchestration-patterns.md`): it only follows declared chains or named pipelines (`rules/pipelines.md`).

---

## Continuity — one nudge per turn, not a loop

Mechanism: `.joca/loop.json` (steps + `produtor` + `verificador` + `estado`), read by the `Stop` hook
`stop-continue.js`, which blocks the end of the turn when there is a `pendente` step or a `feito` one still to verify.

⚠ **It blocks ONCE per turn**, not in a cycle: the `stop_hook_active` guard (mandatory in the Claude Code
hook contract) silences the hook on the next block — raising the limit is `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.
So the `iteracao > max_iteracoes` and `sem_progresso >= 3` brakes are a safety net, not the
normal stopping mechanism: **carrying the contract through to `verificado` is the model's job, not the hook's**.

| Situation | Action |
|---|---|
| Route C/D or pipeline | write the contract before starting; update it at each step |
| Step closed | `estado: feito` + `produtor` filled in — never `verificado` by itself |
| Irreversible gate or question to the user | `"aguarda_utilizador": true` → the turn ends; the hook does not insist |
| Real blocker | delete the contract or `touch .joca/loop-off.flag`, and report |

Brakes unchanged: `loop_max_iterations` · 3x-without-progress · 6 h expiry · `stop_hook_active`.
Continuing ≠ inventing: the contract holds the steps that existed when it was written (steward).

## Verification: whoever produces does not sign off

The verifier is **always another agent** than the producer — including when the producer was the main
loop. It holds for code, design, data and content, not just tests. `stop-continue.js` refuses steps
with `verificador === produtor`.

## Subagents are skill-aware (guaranteed)

An agent dispatched via `Agent()` **does not inherit** `soul.md` or the skills — only the brief. So:
- **Mandatory Step 0 in the brief**: `Read()` the relevant skills BEFORE acting (the frontmatter `skills:` field does NOT load the skill).
- Whoever dispatches includes in the brief the skills to read + the agent's `chain:`.
- The agent returns the suggested next step in its report; the **caller** decides and fires. Agents do not spawn agents (`orchestration-patterns.md`).

---

## Canonical examples (chains already hardwired)

| Step | Chains to | Condition |
|---|---|---|
| `frontend` | `design-review` → `tester-ui-ux` | always after new UI |
| `design-review` | `a11y-fixer` | if there are WCAG violations |
| `laravel-specialist` | `tester-code` → `tester-api` | after a feature; api if there were endpoints |
| `rest-api` (`api-design`) | `tester-api` | after designing endpoints |
| `plan` | domain skill/agent | implement the plan |
| `new-issue` | `prepare-design` · `plan-waves` | new screen · ≥3 issues without a plan |
| `prepare-design` | `validate-design` | always — the mockup does not go to code without a gatekeeper |
| implementing an issue | `write-tests` (**new session**) → `tester-code` | always; never in the session that implemented it |
| `log-debugger` | `query-debugger` | if the cause is SQL |
| `security` (skill) | `security-review` (agent) | deep review |
| `freeze`/`careful`/`guard` | `unfreeze` | switch off at the end |
| `/learn` | `/retro` | retrospective of the window |

Named multi-step (cross-stack) pipelines live in `rules/pipelines.md` and run through the auto-runner.

---

## Anti-patterns

| Wrong | Right |
|---|---|
| Finishing the skill and waiting for the user to ask for the obvious next step | Chain automatically (reversible) + notify `[chain → x]` |
| Chaining an irreversible step without confirming | 1 line of confirmation first |
| Agent dispatched without Step 0 (skills) in the brief | The brief always carries `Read()` of the skills |
| Chaining in an infinite loop "to help" | Brake: depth `loop_max_iterations`, 3x-nothing → stop |
| Inventing next steps outside the scope | Only declared chains / named pipelines (steward) |
| Chaining from the **report** of a step that produced visual/binary output (image, PDF, vector, build) | Verify the **artifact**: open/rasterise it and compare with the reference before accepting. An agent can report success and describe badly what it produced; a build with no errors can have 3 visual bugs |
| Ending the turn with contract steps left open | `.joca/loop.json` rules: continue until `verificado`, or mark `aguarda_utilizador`/delete the contract |
| The same agent that wrote it signing off the verification | Verifier ≠ producer, always — including when the producer was the main loop |

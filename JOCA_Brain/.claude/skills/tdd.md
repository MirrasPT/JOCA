---
name: tdd
description: "Arms test-first mode (TDD guard) for the session — editing production code without a new/changed test first triggers a confirmation (ask, never deny) via the check-tdd hook. Use when the user says: tdd, test first, tests first, tdd mode, tdd guard, red green, force tests."
triggers: tdd, test first, test-first, tests first, tdd mode, tdd guard, red green, red-green, force tests, write tests first
chain: unfreeze
---
# /tdd — Test-first guard-rail

Enforces the red→green discipline: with the mode armed, any Edit/Write of **production code** without a test touched in the recent window (30 min) triggers a **confirmation** — the `check-tdd.js` hook (PreToolUse) asks instead of blocking. Writing/changing tests is always free and re-arms the window.

It complements (does not replace) the existing auto-test: PostToolUse still recommends testers AFTER the code; this guard acts BEFORE.

## Mechanism
- The `check-tdd.js` hook runs on every Edit/Write and reads `.joca/tdd.flag` in the cwd.
- No flag → no-op. Fail-open (a bug in the hook never blocks work).
- Test file (`tests/`, `.test.`, `.spec.`, `_test.`, `*Test.php`, `*Tests.cs`) → allows it and records a timestamp in `.joca/tdd-last-test.txt`.
- Production code (php/ts/tsx/js/py/cs/vue/go/rb, outside config) with no test in the window → `permissionDecision: "ask"` with the reason.

## Setup (run)
```bash
mkdir -p .joca && touch .joca/tdd.flag && echo "TDD guard armed."
```
Confirm to the user: "Test-first mode active. Production code with no recent test asks for confirmation. `/unfreeze` turns it off."

## Notes
- **Ask, not deny** — the code→test heuristic has legitimate false positives (glue code, hotfix); the final decision is the user's.
- Applies to Edit/Write; `sed` via Bash is not intercepted (same limitation as /freeze — combine with /careful if needed).
- Combinable with /freeze and /careful (independent hooks, all flag-file).

## Next step (chain)
- To turn it off → `/unfreeze` (also removes freeze/careful).

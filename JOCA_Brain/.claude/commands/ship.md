# /ship — Take code to a PR (sync → tests → review → push → PR)

Adapted from gstack's `ship`. Pre-merge delivery pipeline: syncs the base, runs the tests, reviews the diff, updates version/CHANGELOG, commits, and **only after the gate** pushes + opens the PR. Never pushes/opens a PR blind.

⚠ Contains **irreversible** steps (push, PR) → mandatory confirmation gate (soul.md / Decision Filter).

## When to use
- "ship", "ship it", "put it in a PR", "push to main", "it's ready, send it".
- Proactive: the user says the code is ready / wants to open a PR → invoke this (do not push directly).

## Pipeline (auto-runner; stops at the gates)

1. **Clean state** — `git status`. Working tree with unrelated junk → resolve/warn first (do not mix it into the ship commit).
2. **Sync the base** — detect the base branch (`main`/`master`), `git fetch`, check the divergence. If the feature branch is behind → integrate the base (merge/rebase per the repo's convention). Conflicts → resolve (or delegate to `pr-repair`).
3. **Tests** — run the project's suite (detect: `npm test`/`pest`/`vitest`/`pytest`…). **Red → stop** and report (do not ship broken code). No suite → `tester-code` (review) as the minimum safety net.
4. **Review the diff** — `git diff` against the base: scope drift? secrets? forgotten `console.log`/`dd()`? extra files? Dispatch `tester-code` if the diff is non-trivial. Secrets in the diff → **stop** (do not commit secrets).
5. **Version + CHANGELOG** (if the project has them) — bump `VERSION`/`package.json`, entry in `CHANGELOG.md` (what changed, in 1-3 lines).
6. **Commit** — coherent message (repo convention). Co-authored trailer per the environment's rules.
7. **⛔ GATE** — show 1 line: branch, number of files, base, destination. Confirm before pushing.
8. **Push + PR** — `git push`; open the PR via the `github` skill / `gh pr create` with title + body (summary + test plan). Return the link.

## Rules
- **Never** push/open a PR without the gate (step 7), even with high autonomy — it is irreversible/outward-facing.
- **Never** commit secrets or ship red tests.
- Protected branch (default `main`/`master`) → work on a feature branch + PR, never push directly (unless explicitly instructed).
- Record the release in the Brain if relevant: `node .claude/scripts/joca-brain.mjs decide --text "shipped <feature> in PR #N" --source user`.

## Next step (chain)
- PR merged and there is a deploy to do → `deploy-executor` agent (runs the pipeline + health-check; ⛔ gate of its own).
- Red PR (CI failing / conflicts / bot reviews) → `pr-repair` agent. See `rules/chaining.md`.

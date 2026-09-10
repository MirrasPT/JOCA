# /joca-doctor — installation diagnostic

Shortcut to the `.claude/scripts/joca-doctor.mjs` script. Node ESM, zero dependencies, read-only
(except with `--fix`). It is the same check that `/save`, `/update-joca` and `/clean-install` use
as a gate.

## Run

```bash
node .claude/scripts/joca-doctor.mjs          # diagnostic only
node .claude/scripts/joca-doctor.mjs --fix    # applies the safe fixes
```

Exit code: `0` = no errors (⚠ do not count) · `1` = at least one ✗.

## What it checks

| # | Section | Catches |
|---|---|---|
| 1 | Runtimes | Node ≥ 18 · python3 |
| 2 | CLIs | `claude` · `codex` · `agy` on PATH (informational) |
| 3 | `settings.json` + hooks | Valid JSON · `<JOCA_ROOT>` placeholders still to be replaced · hook files that do not exist on disk |
| 4 | Inventory vs indexes | disk × `memory/SKILL_INDEX.json` × the counts in `README.md` |
| 5 | Cross-CLI bridges | `.agents/` and `.codex/` stale against `.claude/` · malformed descriptions in the `.toml` files |
| 6 | `GEMINI.md` / `AGENTS.md` | they exist and are in sync with the canonical source |
| 7 | `memory/` | `soul.md` still on the template · `projects/` and `feedback/` exist |
| 8 | `JOCA_OS` | valid JSON in `data/` · `node_modules` installed (read-only) |
| 9 | Content integrity | pointers cited in skills/agents/commands/rules that do not resolve · skills with no entry in the trigger map (they exist but nothing fires them) · execution skills with no twin agent · `.bat`/`.cmd` with LF (they do not start on Windows) |

## Reading the result

- **Freshly made clone → 1 ✗ on the `<JOCA_ROOT>` placeholders is the CORRECT state.** The repository
  is published with the placeholders; the one that replaces them is `/install`. Do not "fix" `settings.json`
  by hand — it is exactly what must not go into the repository.
- For the same reason, `soul.md` on the template gives a ⚠ in a new clone. Both disappear after `/install`.
- `.agents/` stale → `bash .claude/scripts/compile-bridges.sh`.
- Indexes out of sync → `python3 .claude/scripts/build-skill-index.py` (Windows: `python`).

## When to run

- After adding/changing skills, agents, commands or hooks.
- Before publishing (together with `public-release-audit`).
- As a gate for `/save` STEP 6, `/update-joca` and `/clean-install` — compare the summary with the baseline
  from the start of the run: a new ⚠ is a defect of the run, not noise.

---
name: careful
description: "Turns on warnings before destructive Bash commands (rm -rf, DROP/TRUNCATE, git push --force, git reset --hard, taskkill /F, format, dd) — the check-careful hook asks for confirmation before executing (it does not block, you can confirm). Use when the user says: careful, cautious mode, warn me before deleting, careful with destructive, protect against mistakes. Guard-rail adapted from gstack."
triggers: careful, cautious mode, warn before deleting, careful with destructive, protect from mistakes, warn destructive, careful mode, safety warnings
chain: unfreeze
---
# /careful — Warn before destructive commands

Enables warnings (`permissionDecision: "ask"`) before dangerous Bash commands. It does not block — it asks for confirmation and you can go ahead. For debugging in prod / live systems.

## Mechanism
- The `check-careful.js` hook (PreToolUse Bash) runs on every command and reads `.joca/careful.flag` in the cwd.
- If the flag exists and the command matches a destructive pattern → `ask` (confirmation). Otherwise → allow.
- No flag → no-op. Fail-open.

## Patterns covered
`rm -rf`, `Remove-Item -Recurse -Force`, `rmdir /s`, `del /s`, `git push --force`, `git reset --hard`, `git clean -f`, `git checkout -- .`, `DROP/TRUNCATE TABLE`, `DELETE FROM` without `WHERE`, `taskkill /F`, `format`/`mkfs`, `dd of=/dev/`, fork bomb.

## Setup (run this)
```bash
mkdir -p .joca && echo '{"on":true}' > .joca/careful.flag
```
Confirm: "Careful mode active — destructive commands ask for confirmation before running. `/unfreeze` turns it off."

## Next step (chain)
- To also lock edits to a folder → `/freeze` (or `/guard` = careful+freeze in one go). Turn off → `/unfreeze`.

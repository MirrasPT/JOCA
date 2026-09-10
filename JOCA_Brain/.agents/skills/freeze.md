---
name: freeze
description: "Locks edits (Edit/Write) to ONE directory for the session — any edit outside it is BLOCKED by the check-freeze hook. Use when the user says: freeze, lock edits, lock scope, only edit this folder, restrict changes, don't touch anything outside X, scope-lock. Safety guard-rail adapted from gstack."
triggers: freeze, lock edits, lock scope, scope lock, only edit this folder, restrict changes, don't touch anything outside, freeze edits
chain: unfreeze
---
# /freeze — Lock edits to one directory

Limits Edit/Write to one directory for the session. Edits outside it are **blocked** (not merely warned about) by the `check-freeze.js` hook (PreToolUse). Useful while debugging (stops you "fixing" unrelated code) or for surgical scope.

## Mechanism
- The `check-freeze.js` hook runs on every Edit/Write and reads `.joca/freeze-dir.txt` in the cwd.
- If the file exists, edits outside the path → `permissionDecision: "deny"`.
- No file → no-op. Fail-open (a bug in the hook never locks the user out).

## Setup (run this)
1. Ask the user which directory to lock (text input, not multiple choice), unless it was already given in the request.
2. Resolve it to an absolute path and save the state:
```bash
mkdir -p .joca
# <DIR> = path given by the user, resolved to absolute
node -e "const p=require('path'),fs=require('fs');const d=p.resolve(process.argv[1]);fs.writeFileSync('.joca/freeze-dir.txt',d);console.log('Freeze:',d)" "<DIR>"
```
3. Confirm to the user: "Edits locked to `<DIR>/`. Any Edit/Write outside it is blocked. `/freeze` again changes the scope; `/unfreeze` removes it."

## Notes
- The trailing separator stops `/src` from matching `/src-old`.
- Applies to Edit/Write — Read/Bash/Glob/Grep are unaffected (it is NOT a security boundary: `sed` via Bash still writes outside; combine it with `/careful` or use `/guard`).
- Disable: `/unfreeze` or end of session.

## Next step (chain)
- To turn it off → `/unfreeze`. To also get warnings about destructive commands in Bash → `/careful` (or use `/guard` from the start, which is freeze+careful).

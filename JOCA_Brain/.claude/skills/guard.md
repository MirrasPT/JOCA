---
name: guard
description: "Maximum safety mode: turns on /careful (warnings for destructive commands) AND /freeze (locks edits to one directory) in one go. Use when the user says: guard, safe mode, maximum security, lock it down, protect everything, full safety, lock everything down. Composite guard-rail adapted from gstack."
triggers: guard, safe mode, maximum security, lock it down, protect everything, full safety, lock everything down, maximum safety, guard mode
chain: unfreeze
---
# /guard — Maximum safety (careful + freeze)

Combines `/careful` (warnings before destructive Bash commands) with `/freeze` (blocks edits outside one directory), in a single activation. For touching prod or debugging live systems.

## Mechanism
Arms both states at once; the `check-careful.js` and `check-freeze.js` hooks (both PreToolUse, already registered in `settings.json`) start acting.

## Setup (run this)
1. Ask for the directory to lock (text input), unless already given.
2. Arm both:
```bash
mkdir -p .joca && echo '{"on":true}' > .joca/careful.flag
node -e "const p=require('path'),fs=require('fs');fs.writeFileSync('.joca/freeze-dir.txt',p.resolve(process.argv[1]));console.log('Guard:',p.resolve(process.argv[1]))" "<DIR>"
```
3. Confirm to the user:
   - "**Guard mode active.** 1) Destructive commands (rm -rf, DROP, force-push…) ask for confirmation. 2) Edits locked to `<DIR>/` — outside is blocked."
   - "`/unfreeze` removes everything; end of session too."

## Next step (chain)
- Turn everything off → `/unfreeze`.

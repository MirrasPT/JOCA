---
name: unfreeze
description: "Removes the active guard-rails — deletes the edit lock (/freeze), the warnings flag (/careful) and test-first mode (/tdd), turning off /guard mode. Use when the user says: unfreeze, unlock, remove lock, turn off guard, turn off careful, turn off tdd, back to normal."
triggers: unfreeze, unlock, remove lock, turn off guard, turn off careful, turn off tdd, unlock edits, back to normal, remove guard
---
# /unfreeze — Remove guard-rails

Turns off `/freeze`, `/careful`, `/tdd` and `/guard` by removing the state in `.joca/`.

## Run
```bash
rm -f .joca/freeze-dir.txt .joca/careful.flag .joca/tdd.flag .joca/tdd-last-test.txt 2>/dev/null; echo "Guard-rails removed (freeze + careful + tdd off)."
```
Confirm to the user: "Edit lock, destructive warnings and test-first mode removed. Edits and commands are back to normal."

## Note
The `check-freeze.js`/`check-careful.js`/`check-tdd.js` hooks stay registered in `settings.json` but become no-ops without the state files (that is the design: always-registered, only-active-when-armed).

# JOCA — `/clean-install` Bootstrap

You are running the `/clean-install` bootstrap. Follow these instructions exactly, in the order
given — wait for an answer before moving on.

**For anyone who already has JOCA on this machine** (possibly several old copies) and feels excessive
token consumption, installations conflicting with each other, or simply wants a clean installation
without losing memory. If you have NEVER installed JOCA on this machine, use
[`install.md`](https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md) instead.

---

## Why this runs in a new empty folder (not from inside the old JOCA)

**Never run this from inside an existing JOCA installation.** `/clean-install` ends up archiving old
installations — if it ran from inside one of them, it would be trying to move/archive the very folder
Claude Code is running from, mid-session. It is an avoidable problem: create a new, empty folder, open
a Claude Code terminal inside it, and paste this file's prompt (not the file's content itself — the
PROMPT, see Step 1).

---

## Step 1 — Confirm the folder is empty

```bash
ls -A   # macOS/Linux
```
```powershell
Get-ChildItem -Force   # Windows
```

If the folder is NOT empty: stop and warn — "This folder is not empty. Create a new folder and run
the prompt there." Do not continue with files from something else already in here.

---

## Step 2 — Clone JOCA into this folder

```bash
git clone https://github.com/MirrasPT/JOCA.git .
```

(the `.` at the end is deliberate — it clones INTO the current folder, it does not create a `JOCA/`
subfolder the way the normal `install.md` does. This folder, exactly as it is, **is** the new
installation from now on — it is not moved again.)

If `git` is not available:
- macOS: `brew install git` or `xcode-select --install`
- Windows: `winget install Git.Git`
- Linux: `sudo apt install git` or `sudo dnf install git`

Check that the structure came out right:
```bash
ls JOCA_Brain/.claude/commands/clean-install.md
```

---

## Step 3 — Run /clean-install

```bash
cd JOCA_Brain
```

Run `/clean-install` — the command will:
1. Find ALL the other JOCA installations on this machine (this folder, being the one just born, never
   enters that list — see "Phase -1" of the command itself).
2. Audit each one against this baseline you have just cloned (the most recent one from GitHub).
3. Show a table of optimizations (token bloat, expensive MCPs, dead skills, etc.) and wait for your
   explicit approval before touching anything.
4. Consolidate the memory of ALL the old installations into here (the most recent by date wins on
   conflict, nothing is discarded).
5. Archive each old installation it finds in an `Old/` folder (never delete).
6. Run graphify (mandatory) over every connected project + this installation.
7. Update `~/CLAUDE.md` to point HERE as the production installation.

---

## Afterwards

- This folder is the new production installation — it stays where you created it, it is not moved.
- The old installations end up in `Old/` (inside or next to this folder, as the command reports).
- **Start the interface:** `bash JOCA_OS/start.sh` (macOS/Linux) or `JOCA_OS\start.bat` (Windows).
- **Update in the future:** `/update-joca`.

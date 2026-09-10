# JOCA — JOCA_OS-ONLY Update

Brings in the interface (`JOCA_OS/`) from the public repository **without touching `JOCA_Brain/`**.
Read this file and follow the instructions.

**Public repository:** https://github.com/MirrasPT/JOCA.git

**One direction only: GitHub → local. Never push, never commit, never change the `origin` remote.**

---

## When to use this file instead of `update.md`

| You want | File |
|---|---|
| A new interface (terminals, dashboard, shortcuts) and **to keep your skills/agents/memory as they are** | **this one** |
| To bring in everything — engine and interface | `update.md` |

The normal case for a working installation is **this one**: each machine's `JOCA_Brain/` diverges from
the public one on purpose (its own skills, project memory, agents that exist only locally), and a full
update forces you to defend all of that. The interface has none of it — it is just code.

---

## Step 1 — Locate the installation

**macOS/Linux:**
```bash
JOCA_DIR=$(find ~ -maxdepth 6 -type d -name "JOCA_OS" 2>/dev/null | head -1 | sed 's|/JOCA_OS$||')
echo "JOCA: $JOCA_DIR"
cd "$JOCA_DIR" || exit 1
```

**Windows (PowerShell):**
```powershell
$jocaOs = Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_OS" -Depth 5 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$jocaDir = Split-Path $jocaOs
Set-Location $jocaDir
```

If there is more than one installation on the machine, **ask the owner which one** — do not pick the
first one that shows up.

---

## Step 2 — Make sure you can reach the public repository

The `origin` of a working installation may be a **private** repo (that is the case for the production
installation). The public one comes in as a separate remote, called `publico`.

```bash
git remote -v
git remote get-url publico 2>/dev/null || git remote add publico https://github.com/MirrasPT/JOCA.git
git fetch publico
```

If `origin` is already `https://github.com/MirrasPT/JOCA.git`, use `origin` instead of `publico` in
the following steps.

**Resolve the branch — never assume.** The public repo uses `main`; private installations use `master`.
```bash
BASE=$(git remote show publico | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main
REF="publico/$BASE"
echo "ref: $REF"
```

---

## Step 3 — See what changes, inside JOCA_OS only

```bash
git diff --name-status HEAD "$REF" -- JOCA_OS/
```

If empty → **the interface is already up to date.** Stop.

```bash
git log HEAD.."$REF" --oneline -- JOCA_OS/
```

⚠ **Look at the list before applying.** If anything outside `JOCA_OS/` shows up, the command is
wrong — this update touches nothing else.

---

## Step 4 — ⚠ The JOCA_OS `.gitignore`: the pitfall that swallows state

There are two variants of this folder, and the difference is invisible until it is too late:

| Installation | `JOCA_OS/data/` | Why |
|---|---|---|
| Public / single machine | **ignored** | The state is local and is never published |
| Working, alternating between 2 machines | **versioned, on purpose** | The state IS what you want to sync |

`JOCA_OS/.gitignore` is a versioned file **inside** `JOCA_OS/`, so Step 5 overwrites it with the
public version. On an installation of the second kind that deletes nothing immediately — but every
**new** chat, icon or project stops traveling to the other machine, with no error at all. You only
notice when work is missing on the other side.

Find out which case you are in **before** applying:
```bash
git ls-files JOCA_OS/data/ | wc -l
```
- Returns `0` → `data/` is ignored. Nothing to do, skip to Step 5.
- Returns **more than 0** → your installation versions the state. Save the file now:
```bash
cp JOCA_OS/.gitignore /tmp/joca-os-gitignore-local
```
and put it back in Step 6.

---

## Step 5 — Apply

```bash
git checkout "$REF" -- JOCA_OS/
```

What this command does and does not do, so there is no doubt:
- it writes the `JOCA_OS/` files that exist in the ref;
- it **does not delete** files that exist only locally — your `JOCA_OS/data/` survives even when it
  is ignored in the public repo;
- it **does not touch** `JOCA_Brain/`, nor the root, nor `memory/`;
- it leaves the changes **staged** (that is how `checkout` of a path works). Check with `git status`
  and commit when you want — or not, if your installation does not commit.

If you have local changes inside `JOCA_OS/` that you want to keep, **look at them first** — this
command writes over them:
```bash
git status --porcelain JOCA_OS/
git diff JOCA_OS/          # what you would lose
```

---

## Step 6 — Put the local `.gitignore` back (only if Step 4 said so)

```bash
cp /tmp/joca-os-gitignore-local JOCA_OS/.gitignore
git ls-files JOCA_OS/data/ | wc -l    # must still return the same number as before
```

---

## Step 7 — Rebuild

```bash
cd JOCA_OS/backend  && npm install && npm run build && cd ../..
cd JOCA_OS/frontend && npm install && npm run build && cd ../..
```

⚠ The **frontend** `npm run build` is not optional — the backend serves `frontend/dist/`, and without
it the interface stays on the previous version even though the new files are already on disk.

⚠ Neither is `npm install`: an update that brings new dependencies breaks the build without it, and
the error message does not say that is the problem.

---

## Step 8 — Restart

**Restarting kills the terminals and agents that are running.** The backend runs the compiled build,
with no watch — without a restart, the new backend code does not take effect.

```bash
bash JOCA_OS/stop.sh    # Windows: JOCA_OS\stop.bat
bash JOCA_OS/start.sh   # Windows: JOCA_OS\start.bat
```

Conversations closed this way no longer disappear silently: on the way back, JOCA reports how many
were closed and lets you read the output each of them had. They are not resumable — the CLI context
dies with the process — but the record stays.

If you have two installations on the same machine, start this one on its own ports:
```bash
JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 bash JOCA_OS/start.sh
```

---

## Step 9 — Confirm by effect, not by the silence of the commands

```bash
curl -s localhost:7491/runtime | head -c 200     # or whichever port you used
```

And **open the interface in the browser.** A green build proves that it compiles, not that it works:
confirm that the terminals open, that text reaches the CLI, and that the dashboard loads.

---

## Step 10 — Report

```
JOCA_OS UPDATED
───────────────
✓ N JOCA_OS files updated — <hash> <message>
✓ JOCA_Brain intact (git status --porcelain JOCA_Brain/ → empty)
✓ local .gitignore restored  (or: it was not needed)
✓ backend + frontend rebuilt
✓ restarted and opened in the browser

Left staged: git status
```

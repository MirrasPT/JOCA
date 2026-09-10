# JOCA — Install Bootstrap

You are running the JOCA bootstrap. Follow these instructions exactly.
Do each step in the order given — wait for an answer before moving on.

---

## Step 1 — Check for an existing installation

Detect the OS and look for an installation:

**macOS/Linux:**
```bash
find ~ -maxdepth 5 -name "JOCA_Brain" -type d 2>/dev/null | head -5
```

**Windows (PowerShell):**
```powershell
Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_Brain" -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 5 -ExpandProperty FullName
```

**If found:** report the path and ask:
```
I found JOCA at [path]. What do you want to do?
[1] Reconfigure this installation (runs /install)
[2] Install in another folder (new copy)
[3] Cancel
```

- If [1]: navigate to `[path]/JOCA_Brain` and run `/install`. End of this bootstrap.
- If [2]: continue to Step 2.
- If [3]: stop.

**If not found:** continue to Step 2.

---

## Step 2 — Choose a destination

Free text: "Where do you want to install JOCA? (e.g.: `~/`, `~/Documents/`, `~/Dev/`, `C:\Users\[name]\Desktop\`)"

The `JOCA/` folder will be created inside the chosen destination.

---

## Step 3 — Clone the repository

```bash
git clone https://github.com/MirrasPT/JOCA.git "<destination>/JOCA"
```

If `git` is not available:
- macOS: `brew install git` or `xcode-select --install`
- Windows: `winget install Git.Git`
- Linux: `sudo apt install git` or `sudo dnf install git`

Check that the structure came out right:

```bash
ls "<destination>/JOCA/JOCA_Brain/.claude/commands/" | head -5
```

---

## Step 4 — Run /install

Navigate to `JOCA_Brain/` and run the install command:

```
cd "<destination>/JOCA/JOCA_Brain"
```

Run `/install` — the wizard configures:
- Identity and personality (soul calibration)
- Skills (127 available, trigger system) + auto-orchestration (task-intake, 4 routes)
- Browser automation (Playwright CLI — never browser-use, never MCP) + Graphify (mandatory)
- MCPs (markitdown — the engine behind /know)
- External CLIs (gh, ffmpeg, codex, agy, gws, …) — full inventory with per-platform install commands in `JOCA_Brain/memory/tools/clis.md`
- API keys (OpenAI, Gemini, etc.)
- JOCA_OS (browser interface)
- StatusLine + Rate Limits tracking (Node.js cross-platform)
- `~/CLAUDE.md` (global profile)

> **Platform:** JOCA_OS was developed and validated on **macOS** (the reference platform). On **Windows**, `/install` automatically activates the `joca-os-windows` skill, which tests, checks and fixes the sensitive points in a single pass (node-pty build — requires Visual Studio Build Tools + Python, PowerShell PTY, paths, statusline/Keychain, launchers).

> **Safe reinstall:** `/install` detects an existing installation and preserves `memory/projects/`, `memory/feedback/`, `memory/soul.md` and `JOCA_OS/data/` (projects, sessions, user settings).

---

## Placeholders — what `/install` fills in

The repository is published without personal state. Where there was a machine path or a piece of
user data, there is a `<...>` placeholder. `/install` fills them in from the questionnaire answers;
this section exists so you know what each one is if you need to do it by hand.

**Mandatory — without this JOCA does not work:**

| Placeholder | Where | What it is |
|-------------|------|---------|
| `<JOCA_ROOT>` | `JOCA_Brain/.claude/settings.json` (11 hooks) | Absolute path of the folder that contains `JOCA_Brain/`, with `/` slashes and no trailing slash. **If it is not replaced, the 11 hooks fail silently** — with no visible error. Check with `grep -c '<JOCA_ROOT>' JOCA_Brain/.claude/settings.json` (must return `0`). |
| `<YOUR_NAME>` · `<YOUR_ROLE>` · `<YOUR_STRENGTHS>` · `<YOUR_LEARNING_AREAS>` · `<STRONG_DOMAIN>` · `<LEARNING_DOMAIN>` · `<YOUR_FRUSTRATION_TRIGGERS>` | `JOCA_Brain/memory/soul.md` | Your profile, collected in questions Q1/Q2 and Q-SOUL-5/6/7. While they are not filled in, JOCA uses the defaults from `Communication` + `Calibration Parameters`. |

**Contextual — they only matter if you use the respective skill** (they are examples in the
documentation, not configuration to fill in at startup): `<YOUR_PROJECTS_DIR>`, `<YOUR_PHP_PATH>`,
`<YOUR_DOMAIN>`, `<YOUR_SERVER_IP>`, `<YOUR_CPANEL_USER>`, `<YOUR_CPANEL_HOST>`,
`<YOUR_COMFYUI_DIR>`.

List every one still left at any time:
```bash
grep -rohE "<(YOUR_[A-Z_]+|JOCA_ROOT|STRONG_DOMAIN|LEARNING_DOMAIN)>" . --exclude-dir=.git | sort | uniq -c
```

---

## After the install

- **Start the interface:** `bash JOCA_OS/start.sh` (macOS/Linux) or `JOCA_OS\start.bat` (Windows)
- **Start or connect a project:** navigate to the folder and run **`/start`** — a full interview
  for new projects (product → flows/PRD → house stack → infra → design direction, with interactive
  forms), or it connects an existing project with no questionnaire
- **Session start:** `/resume`
- **Quick reference:** `/help-joca`
- **Update JOCA:** `/update-joca` (sync with GitHub, protects local files)

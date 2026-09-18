# /install — JOCA setup and configuration

Installation and reconfiguration assistant. It can run at any time — it reconfigures without deleting what already exists.

**Repository:** https://github.com/MirrasPT/JOCA.git

**The rule that governs this command:** *detect first, ask only for what is missing.* The operating
system, what is already installed, what is already configured — none of that gets asked, it gets seen.
The questions that remain are about **preferences** and **intent**, which no command guesses.

> This replaces the multi-select questionnaire this command used to be (map of areas->skills, lists
> of CLIs to tick one by one). That form had to be kept aligned with the real inventory of
> skills — that was the job of the old `/sync-questionnaires`, now removed — and even so it
> asked things a `command -v` answers better.

**Protected data (NEVER overwrite on a reinstall):**
- `memory/projects/` — the user's project data
- `memory/feedback/` — feedback sessions
- `memory/soul.md` — personality calibration
- `JOCA_OS/data/` — projects, sessions, UI settings
- Files with `origin: local` in the frontmatter — locally created skills/agents

---

## PHASE 0 — Survey (zero questions)

```bash
node -e "console.log(process.platform, process.version)"     # OS + Node (Node is mandatory)
cat ~/CLAUDE.md 2>/dev/null | head -30                        # does a profile already exist?
ls memory/soul.md memory/projects memory/feedback JOCA_OS/data 2>/dev/null
grep -n "autonomy_level\|communication_mode" memory/soul.md 2>/dev/null
grep -c "JOCA_ROOT" .claude/settings.json 2>/dev/null         # >0 = placeholder still to replace
# which CLIs already exist (do not ask about these):
for c in gh gws gcloud aws agy codex ffmpeg yt-dlp markitdown wp shopify wix ntn \
         sentry-cli stripe graphify python python3; do
  command -v "$c" >/dev/null 2>&1 && echo "HAS $c"
done
```

**What this decides on its own:**

| Signal | Conclusion — do not ask |
|---|---|
| `process.platform` | OS: `win32` -> PowerShell everywhere; `darwin`/`linux` -> bash |
| `~/CLAUDE.md` with a profile | the user's name and role already exist |
| `memory/soul.md` with `autonomy_level` filled in | it has already been calibrated — this is **reconfiguration**, not installation |
| `HAS <cli>` | that CLI is already installed; it only enters the list if it is missing |
| `JOCA_OS/data/` exists | JOCA_OS is already in use; do not reinstall over it |
| `<JOCA_ROOT>` in `settings.json` | placeholder still to replace — **with it there, no hook runs** |

If `node` does not exist: stop and say that it is mandatory.

If there is already a profile **and** a calibrated soul, show what is configured and ask one single thing:
*keep everything* · *change preferences* · *only add tools*. Keep -> jump to PHASE 3.

---

## PHASE 1 — Who you are (only what is missing)

If `~/CLAUDE.md` already gives the name and role, **confirm in one line** instead of asking again.
Otherwise: name, role (designer · dev · full-stack · marketing · PM · other) and, optionally, country
(it only matters for `portugal-payments`/`portugal-invoicing` and language).

The OS **is not asked about** — it was already detected in PHASE 0. Say which it is and move on.

---

## PHASE 2 — How you want JOCA to behave

Three questions. They are preferences: none is deduced from the disk. Use `AskUserQuestion`.

**1. Autonomy** — how much may it act without asking?
Maximum (recommended) `0.95` · High `0.80` · Moderate `0.60` · Low `0.30` -> `autonomy_level`.
At any level, **irreversible** actions (deploy, push, migrations, deletes, payments) always ask for
confirmation — that is not calibratable.

**2. Communication** — `lite` (terse, recommended) · `full` (explains) · `ultra` (fragments) -> `communication_mode`.

**3. Automatic tests** — run tests on its own after changing code? -> `auto_test`.

The remaining parameters (`assertiveness`, `error_tolerance`, `explanation_depth`,
`orchestration_threshold`, `loop_max_iterations`) stay at the `soul.md` defaults and are adjusted later
by editing the file. Asking eight parameters of someone who has not used the system yet does not produce
better answers — it produces invented ones.

### Areas of work — **not asked about**

JOCA ships **131 skills** that activate by relevance >= 60% via `SKILL_INDEX.json` + the Trigger Map in
`CLAUDE.md`. There is nothing to switch on or off: a WordPress skill never fires in a Laravel
project, because the trigger does not match. Choosing "areas" at install time would only serve to **hide**
skills the user would come to need.

What is specific to a project (stack, platform, that project's CLIs) is decided by
`/start`, which sees the folder. Here it is only about the machine.

---

## PHASE 3 — Tools (only the missing ones)

PHASE 0 already said what exists. Present **only what is missing**, grouped, with a note on what it is
for — and let them choose in blocks, not one by one:

```
You already have: gh, ffmpeg, python, graphify

Missing (choose the groups you want):
  [core]      markitdown   -> engine of /know (ingest PDF/Office/YouTube)
  [git/cloud] gws, gcloud, aws
  [ai]        agy (Gemini, multimodal) · codex (adversarial review) · huggingface-cli
  [media]     yt-dlp, whisperx        -> used by the `watch` agent
  [cms]       wp-cli · shopify · wix · ntn (Notion, Node >= 22)
  [dev]       sentry-cli · stripe-cli · cli-printing-press (Go 1.26+)
  [browser]   Playwright CLI (never browser-use, never MCP)
```

⚠ **`graphify` is not part of this choice — it is MANDATORY, always installed, without asking.** It is
JOCA's cheapest code/knowledge memory (see `memory/tools/clis.md`); without it, `/save`,
`/resume`, `/map-joca` and `/clean-install` end up rereading whole `.md` files instead of consulting
the graph. The installation in the EXECUTION PHASE runs unconditionally, even if the user chooses
no optional group.

Always recommend `[core]`; the rest only if the role (PHASE 1) justifies it — a designer does not need
`stripe-cli` by default. **Installing CLIs that are not used costs time and fails silently.**

Complete inventory with installation commands per OS and authentication notes:
`memory/tools/clis.md`. The concrete commands run in the EXECUTION PHASE.

### API keys

Ask **only** for the ones the chosen tools require — and never write them into versioned
files. If a key is not given, the tool is recorded as **PENDING** in the report,
with the manual step. Never invent a key or an endpoint to "unlock" a step.

---

## PHASE 4 — Proposal and single gate

```
USER:       <name> — <role> [· <country>]
SYSTEM:     <detected OS> · Node <version>
MODE:       autonomy <x> · communication <y> · auto-test <y/n>

ALREADY INSTALLED: <detected list>          <- not touched
WILL INSTALL:      <list>                   <- only what is missing and was chosen
KEYS:              <the ones given> | PENDING: <the missing ones>

WILL CREATE/UPDATE
  memory/soul.md                 <- parameters + alignment with the user
  ~/CLAUDE.md                    <- profile + commands + list of project names
  .claude/settings.json          <- real paths (replaces <JOCA_ROOT>)
  JOCA_OS                        <- dependencies + frontend build
  <launcher>                     <- startup shortcut
```

`AskUserQuestion`: "Do you confirm?" -> *Yes, install* · *Let me correct it*.

This is the **only** gate of the command. From here everything runs straight through, and whatever fails
goes into the final report as PENDING with the manual command — a CLI failure never aborts the installation.

---

## EXECUTION PHASE

### 1. Fill in soul.md

Read `memory/soul.md`, replace every `<...>` placeholder with the values gathered in PHASE 1 (identity) and PHASE 2 (behavior). Update the Calibration Parameters.

### 2. ~/CLAUDE.md

Read the current file. Add/update without deleting existing content:

```markdown
## User
[Name] — [role][, location]

## JOCA
Toolkit installed at: [joca_path]
Active skills: 127 (RFC 2119 trigger system — automatic activation by relevance)
Commands: /install, /start (new project or connect an existing one), /resume, /save, /create-skill, /plan, /debug, /review-code, /review-design, /help-joca, /one-shot, /upgrade-joca, /update-joca, /status, /wp-perf, /wp-perf-review, /migrate
Image generation: [selected engines]

## JOCA_OS
Interface: / triggers autocomplete of commands, skills and agents (dropdown)
Startup: start.bat (Windows) or bash start.sh (macOS/Linux)

## Workspace

## Projects
> Names only. Folder, status and detail -> `memory/INDEX.md` §Projects and `memory/projects/<x>.md`.

**Active:** <!-- name only, separated by ` · `; added by /start and /save -->

@[joca_path]/JOCA_Brain/CLAUDE.md
```

### 3. Memory structure

Confirm that these exist (create them if they do not):
- `memory/INDEX.md`
- `memory/projects/` (with `.gitkeep`)
- `memory/tools/`
- `memory/feedback/` (with `.gitkeep`)

**Windows (PowerShell):**
```powershell
$dirs = @("memory\projects", "memory\tools", "memory\feedback")
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d }
    $gk = Join-Path $d ".gitkeep"
    if (-not (Test-Path $gk)) { New-Item -ItemType File $gk }
}
if (-not (Test-Path "memory\INDEX.md")) { New-Item -ItemType File "memory\INDEX.md" }
```

**macOS / Linux (bash):**
```bash
mkdir -p memory/projects memory/tools memory/feedback
touch memory/projects/.gitkeep memory/feedback/.gitkeep
[ -f memory/INDEX.md ] || touch memory/INDEX.md
```

### 3b. Graphify (MANDATORY — always runs, without asking)

```bash
uv tool install graphifyy   # the real package is called "graphifyy"; it installs the "graphify" entrypoint
# without uv: pipx install graphifyy
bash .claude/scripts/graphify-patch.sh   # reapplies the patches (DOC_EXTENSIONS, dotdirs included)
```

Check: `graphify --help` or `python3 -c "import graphify"`. Without it, `/save`/`/resume`/
`/map-joca`/`/clean-install` degrade into rereading whole `.md` files instead of consulting the
graph — it is the cheapest cost optimization JOCA has, never skip this step.

### 4. Browser Automation (if selected)

⚠ **`browser-use` is BANNED — never install it, never suggest it.** The owner's policy (2026-08-05):
ad-hoc verification → the **Claude in Chrome** extension; scripted automation → **Playwright CLI**.
**Never install the Playwright MCP** (`@playwright/mcp`) — even if it looks like the simplest route.

**Playwright CLI (the only route for browser automation):**

```bash
npm install -g @playwright/cli
```

Check: `playwright-cli --help` (or `npx playwright --version`). If it is not installed on this
machine, ask the owner to install it — never use an MCP as a shortcut.

**markitdown (Knowledge Base / `/know`):**

```bash
python -m pip install markitdown-mcp        # MCP + core (Windows: python, not python3)
python -m pip install 'markitdown[all]'     # NOT optional — see the warning below
claude mcp add markitdown --scope user -- python -m markitdown_mcp
```

⚠ **Always install with `[all]`.** The brew markitdown (and the plain `pip install markitdown`) comes
without the `[docx]` extra → converting a `.docx` blows up with `MissingDependencyException`, with no clue
which extra is missing. If reinstalling is not an option: a `.docx` is a zip — `zipfile` + a regex over
`word/document.xml` extracts the text.

Check: `claude mcp list | grep markitdown` (it should say Connected). See `memory/tools/mcps.md`.

Google connectors: instruct activation at claude.ai/settings (native OAuth).

### 5. API Keys

For each key marked as "enter now":

**Agent keys** — add them to the global `env` block of `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<value>", "GEMINI_API_KEY": "<value>" } }
```

For PENDING keys — list them with the link to obtain them:
- `OPENAI_API_KEY` -> platform.openai.com/api-keys
- `GEMINI_API_KEY` -> aistudio.google.com/apikey
- `SENTRY_AUTH_TOKEN` -> sentry.io/settings/account/api/auth-tokens
- `STRIPE_API_KEY` -> dashboard.stripe.com/apikeys (test mode)

### 6. External CLIs

**gh CLI** (if selected and installed):
```
Run: gh auth login
Follow the interactive instructions to authenticate via the browser.
```

**gws** (if selected):

```bash
npm install -g @googleworkspace/cli
```

Authenticate:
```bash
gws auth setup    # creates a Cloud project + enables the APIs + login (requires gcloud)
gws auth login    # subsequent logins
```

Without gcloud: configure the OAuth client by hand in the Cloud Console, download the JSON to `~/.config/gws/client_secret.json`, then `gws auth login`.

Auth gotchas (lived through — **personal** account, not Workspace):
- `gws auth setup --login` asks for **86 scopes** (incl. Workspace admin, `cloud-identity.devices`) → on a personal account it gives `invalid_scope`/Error 400.
- `gws auth login --services gmail --readonly` does **NOT** restrict scopes — only `--scopes <explicit list>` restricts (e.g.: `https://www.googleapis.com/auth/gmail.readonly`).
- Consent screen in "Testing" with no test users → `403 access_denied` (add a user at `console.cloud.google.com/auth/audience?project=<id>`).
- App in "Testing" → Google **expires the refresh token in ~7 days**. Fix: **publish the app in Production** (a personal account has no Workspace-Internal route).
- Headless/VPS: creds in the keyring + `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`. Capabilities for automations (e2e): `gws gmail +triage` (unread), `+read`, `+send`/`+reply`/`+forward` — runs non-interactive via `child_process.exec`.
- **`+send` attachments have to be in the cwd** — `--attach <path>` outside the current folder → `validationError 400` ("outside the current directory"). Run `+send` from the files' folder (subshell `( cd <folder> && gws ... -a <relative-name> )`) or copy the attachment into the cwd first. A complete HTML body passes fine via `--body "$(cat file.html)" --html`.

**sentry-cli** (if selected):

macOS:
```bash
brew install getsentry/tools/sentry-cli
```

Linux:
```bash
curl -sL https://sentry.io/get-cli/ | sh
```

Windows (Scoop):
```powershell
scoop install sentry-cli
```

Instruct: `sentry-cli login` to authenticate, or set `SENTRY_AUTH_TOKEN` in the env.

**ffmpeg** (if selected):

macOS:
```bash
brew install ffmpeg
```

Linux (apt):
```bash
sudo apt install ffmpeg
```

Windows (Scoop):
```powershell
scoop install ffmpeg
```

Check: `ffmpeg -version`

**yt-dlp** (if selected — used by the `watch` agent):

macOS: `brew install yt-dlp`
Linux: `pip3 install -U yt-dlp` or `sudo apt install yt-dlp`
Windows: `scoop install yt-dlp` or `pip install -U yt-dlp`

Check: `yt-dlp --version`

**whisperx** (if selected — local transcription with no API):

Prereq: Python 3.10+ and ffmpeg.
```bash
pip install -U whisperx
```
The first run downloads the model (~3GB for `large-v3`).

Check: `whisperx --help`

**stripe-cli** (if selected):

macOS: `brew install stripe/stripe-cli/stripe`
Linux: download from github.com/stripe/stripe-cli/releases
Windows: `scoop install stripe`

Instruct: `stripe login` (interactive OAuth) and use `stripe listen --forward-to localhost:8000/webhook` for local tests.

**aws-cli** (if selected):

macOS: `brew install awscli`
Linux: `sudo apt install awscli` or the official installer at aws.amazon.com/cli
Windows: `winget install Amazon.AWSCLI`

Instruct: `aws configure` (key, secret, region, output).

**gcloud** (if selected — prereq for `gws auth setup`):

macOS: `brew install --cask google-cloud-sdk`
Linux: `curl https://sdk.cloud.google.com | bash`
Windows: `winget install Google.CloudSDK`

Instruct: `gcloud init` to authenticate and select a project.

**huggingface-cli** (if selected):

Windows (PowerShell):
```powershell
pip install -U "huggingface_hub[cli]"
```

macOS / Linux (bash):
```bash
pip3 install -U "huggingface_hub[cli]"
```

Instruct: `huggingface-cli login` to authenticate.

**Antigravity CLI** (if selected):

Windows (PowerShell):
```powershell
npm install -g @anthropic-ai/antigravity
```

macOS / Linux (bash):
```bash
npm install -g @anthropic-ai/antigravity
```

Instruct: `agy auth login` or set `GEMINI_API_KEY`.

**Codex CLI** (if selected):

Windows (PowerShell):
```powershell
npm install -g @openai/codex
```

macOS / Linux (bash):
```bash
npm install -g @openai/codex
```

Instruct: `codex login` or set `OPENAI_API_KEY`.

**CLI Printing Press** (if selected):

Prerequisite — Go 1.26+:
macOS: `brew install go`
Linux: `sudo apt install golang` or download from golang.org
Windows: download from golang.org/dl

Make sure `$GOPATH/bin` is on the PATH:
```bash
echo 'export PATH="$HOME/go/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Install:
```bash
go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest
```

Check: `cli-printing-press --version`

**Zoho Mail CLI** (if selected):

Prerequisite — Java 11+:
- macOS: `brew install openjdk@21` (keg-only, add `/opt/homebrew/opt/openjdk@21/bin` to the PATH)
- Linux: `sudo apt install openjdk-21-jdk` or equivalent
- Windows: download from adoptium.net (Eclipse Temurin)

Check: `java -version` (it should show 11+)

Install:
```bash
mkdir -p ~/.local/bin/zmail-cli
curl -L -o ~/.local/bin/zmail-cli/zmail-cli.jar \
  https://www.zohowebstatic.com/mail/3938191/ZMAIL_CLI/zmail-cli.jar
```

Create the `~/.local/bin/zmail` wrapper:
```bash
#!/usr/bin/env bash
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
exec java -jar "$HOME/.local/bin/zmail-cli/zmail-cli.jar" "$@"
```

Make it executable: `chmod +x ~/.local/bin/zmail`

Check: `zmail` (opens an interactive prompt — it asks for an encryption password on the first startup to protect local refresh tokens).

Instruct: `zmail:>login` for OAuth via the browser. For regional data centers use `login --dc <tld>` (`.com`, `.eu`, `.in`, `.au`, `.jp`, `.ca`, `.sa`).

Docs: https://www.zoho.com/mail/help/cli/getting-started-with-cli.html

### 7. The project's settings.json

**MANDATORY STEP — without it the hooks do not run.**

`JOCA_Brain/.claude/settings.json` ships with the **10 hooks** pointing at the placeholder
`<JOCA_ROOT>`. Replace **every** occurrence with the absolute path where JOCA was
cloned (the folder that contains `JOCA_Brain/`), with no trailing slash:

```bash
# macOS / Linux
JOCA_ROOT="$(cd "$(dirname "$0")" && pwd)"        # root resolved in PHASE 0
sed -i '' "s|<JOCA_ROOT>|$JOCA_ROOT|g" JOCA_Brain/.claude/settings.json
```
```powershell
# Windows
$JOCA_ROOT = "C:/Users/<user>/Desktop/JOCA"   # real path, with / slashes
(Get-Content JOCA_Brain\.claude\settings.json -Raw) -replace '<JOCA_ROOT>', $JOCA_ROOT |
  Set-Content JOCA_Brain\.claude\settings.json -NoNewline
```

Check (it has to give **0** and the JSON has to stay valid):
```bash
grep -c '<JOCA_ROOT>' JOCA_Brain/.claude/settings.json    # 0
node -e "JSON.parse(require('fs').readFileSync('JOCA_Brain/.claude/settings.json','utf8')); console.log('JSON ok')"
```

**Why absolute:** on Windows the hooks' cwd is not guaranteed to be the repo root and the
`$CLAUDE_PROJECT_DIR` variable can come back empty (besides which the hooks may run in `cmd`, which
does not expand `$VAR`). Relative paths fail **silently** — the hook does not run and there is no error.
Use `/` even on Windows.

⚠ If you move the JOCA folder elsewhere, you have to repeat this substitution.

```json
{
  "permissions": {
    "allow": [],
    "deny": []
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-freeze.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-tdd.js\"" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-careful.js\"" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/session-intake.js\"" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/prompt-triage.js\"" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/track-changes.js\" \"$TOOL_INPUT_FILE_PATH\"", "async": true },
          { "type": "command", "command": "bash \"<BRAIN>/.claude/scripts/check-skill-paths.sh\" \"$TOOL_INPUT_FILE_PATH\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/skill-lint.js\"" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/stop-checkpoint.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/auto-test-dispatch.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/stop-continue.js\"" }
        ]
      }
    ]
  }
}
```

Notes:
- **The order in the Stop array matters:** `stop-checkpoint.js` → `auto-test-dispatch.js` → `stop-continue.js`. The checkpoint runs BEFORE the dispatch (which clears `.joca/test-queue.jsonl`); `stop-continue.js` runs **last**, because it is the only one that can block the end of the turn — and it blocks **once** per turn (the `stop_hook_active` guard; see `rules/chaining.md`).
- Runtime `node` for every hook except `check-skill-paths.sh` (bash, lives in `.claude/scripts/`).
- Flag-file hooks (`check-freeze`, `check-careful`, `check-tdd`) are a no-op without the `.joca/*.flag` flag — armed by the `freeze`/`careful`/`tdd` skills, disarmed by `unfreeze`.

### 8. JOCA_OS (installed by default)

JOCA_OS runs on **port 7491** (backend) and **port 7492** (frontend). The interface automatically detects JOCA_Brain as a sibling directory — zero configuration.

> **macOS is the reference platform** — JOCA_OS was developed and validated on macOS. If the OS detected in PHASE 0 is **Windows** (`process.platform === 'win32'`), read and activate the `.claude/skills/joca-os-windows.md` skill BEFORE running `npm install`/`npm run build`: it drives the node-pty build (requires VS Build Tools + Python), the PowerShell PTY, paths, statusline/Keychain and launchers, testing and fixing in a single pass. Notify: `[skill: joca-os-windows]`.

**Windows (PowerShell):**

Use the temp batch launcher approach to avoid quoting problems in nested processes:

```powershell
Set-Location "<joca_path>\..\JOCA_OS\backend"
npm install
npm run build
Set-Location "<joca_path>\..\JOCA_OS\frontend"
npm install
```

Check: `node <joca_path>\..\JOCA_OS\backend\dist\server.js` starts without errors.

Windows startup: `start.bat` — creates temporary batch launchers in `%TEMP%\joca-ui\` for backend and frontend, avoiding quoting problems with paths that contain spaces.

**macOS / Linux (bash):**

```bash
cd "<joca_path>/../JOCA_OS"
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && cd ..
chmod +x start.sh stop.sh 2>/dev/null
```

Check: `node <joca_path>/../JOCA_OS/backend/dist/server.js` starts without errors.

macOS/Linux startup: `bash start.sh` — uses `nohup` + `disown` to keep the processes in the background.

**JOCA_OS Slash Command Autocomplete:**
JOCA_OS supports autocomplete of commands, skills and agents — typing `/` in the emulated terminal brings up a dropdown with every available command. Mention this to the user.

### 9. Launcher

`AskUserQuestion`:
```
question: "Create a shortcut to open the JOCA UI with one click?"
header: "Launcher"
options:
  - "Desktop"
  - "JOCA folder"
  - "Another path"
  - "Do not create"
```

If "Another path": ask for the path in free text.

If selected:

**macOS:**
```bash
cp "<joca_path>/../JOCA_OS/JOCA UI.command" "<destination>/JOCA UI.command"
chmod +x "<destination>/JOCA UI.command"
```

**Windows:**
```powershell
Copy-Item "<joca_path>\..\JOCA_OS\JOCA UI.vbs" "<destination>\JOCA UI.vbs"
```

### 10. New skills (if confirmed)

Run `/create-skill [name]` for each new skill that has been explicitly approved. There is no gap detection at install time: a real gap shows up while working on a project (and `/start` or `/upgrade-joca` raise it), not while answering a form.

### 11. Final report

```
OK Soul calibrated — [autonomy], [communication], [errors]
OK ~/CLAUDE.md updated
OK Memory: structure verified
OK Skills: 127 configured (RFC 2119 trigger system)
OK Integrations: [Browser: playwright-cli/none] · [Graphify: installed] · [CLIs: list]
OK JOCA_OS: installed (backend :7491, frontend :7492)[ · Windows: joca-os-windows skill applied]
OK StatusLine: installed (rate limits -> %TEMP%/joca-ui/rate-limits.json)
[state] Deps: node / npm / git / gh / jq / bun / docker

API KEYS
  OK [key] — configured
  PENDING [key] — PENDING -> [URL]

JOCA ready.
-> Start the interface: JOCA_OS\start.bat (Windows) or bash JOCA_OS/start.sh (macOS/Linux)
-> Autocomplete: type / in the terminal to see commands, skills and agents
-> To start/connect a project: navigate to the folder and run /start
-> Start of session: /resume
-> Quick reference: /help-joca
-> Repo: https://github.com/MirrasPT/JOCA.git
```

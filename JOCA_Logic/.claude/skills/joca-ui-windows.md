---
name: joca-ui-windows
description: "Adapt, test, verify and fix the JOCA_UI for Windows. The JOCA_UI was developed and validated on macOS — this skill makes it run correctly on Windows in one pass. MUST be invoked when installing or upgrading JOCA on Windows (process.platform === 'win32'), or when the user says: joca ui windows, joca não abre no windows, node-pty windows, terminal não arranca windows, powershell joca, fix joca windows, adaptar joca windows. SHOULD also invoke when: rate limits vazios no windows, statusline windows, start.bat falha."
triggers: joca ui windows, joca windows, node-pty windows, powershell joca, fix joca windows, adaptar joca windows, terminal não arranca windows, statusline windows, start.bat falha, rate limits windows
origin: local
---
# JOCA_UI — Windows Adaptation & Verification

The JOCA_UI (`JOCA_UI/backend` Node+Express+node-pty, `JOCA_UI/frontend` React+Vite+xterm.js) was **developed and validated on macOS (zsh)**. macOS is the reference platform. Windows support exists in the code (`IS_WINDOWS`, `powershell.exe`, `os.tmpdir()`) but is **not continuously tested** — divergences appear at native-build, PTY, path and credential layers.

**Activate this skill on every Windows install/upgrade.** Run the checklist top-to-bottom, fix what fails, and report. Goal: get JOCA_UI fully working on Windows **in one pass** instead of discovering breakage piecemeal.

**Hard rule:** macOS/Linux behaviour is canonical. Never change cross-platform code in a way that breaks macOS — guard every Windows-specific branch behind `process.platform === 'win32'` (backend) / `$IsWindows` or `%OS%` (scripts). Prefer additive `if (IS_WINDOWS)` branches over rewrites.

---

## Phase 0 — Confirm platform & prerequisites

```powershell
node -e "console.log(process.platform, process.arch, process.version)"   # expect win32
npm --version
python --version          # node-gyp needs Python 3.x
```

node-pty is a **native module**. On Windows it needs a C++ toolchain:
- **Visual Studio Build Tools** (Desktop development with C++) or `npm install -g windows-build-tools` (legacy)
- Python 3.x on PATH

If missing, instruct the user to install VS Build Tools before continuing — `npm install` for the backend will otherwise fail at node-pty.

---

## Phase 1 — Build (the most common failure point)

```powershell
Set-Location "<joca>\JOCA_UI\backend"
npm install
# node-pty native rebuild — if prebuilt binary not used:
Set-Location node_modules\node-pty
npx node-gyp rebuild
Set-Location "<joca>\JOCA_UI\backend"
npm run build
Set-Location "<joca>\JOCA_UI\frontend"
npm install
```

**Verify:** `node "<joca>\JOCA_UI\backend\dist\server.js"` starts without a node-pty `MODULE_NOT_FOUND` / `was compiled against a different Node.js version` error.

**If node-pty fails to load:** delete `node_modules\node-pty`, reinstall, and force a rebuild with the matching Node ABI. Note that `server.ts` chmods `node_modules/node-pty/prebuilds/.../spawn-helper` — that path is POSIX-only and is wrapped/ignored on Windows; confirm it does not throw (it should only `console.warn`).

---

## Phase 2 — PTY / shell

`server.ts` selects the shell as:
```ts
const IS_WINDOWS = process.platform === 'win32';
const SHELL = IS_WINDOWS ? 'powershell.exe' : (process.env.SHELL || '/bin/zsh');
const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
```

**Verify:**
- A new terminal session spawns PowerShell and is interactive (cursor, echo, resize).
- `claude` launches inside the PTY (Claude Code must be installed and on PATH for the Windows user).
- The PTY write pattern (text + `\r` with delay) submits commands correctly in PowerShell.

**If PowerShell is undesirable** (e.g. user prefers `pwsh` 7+ or Git Bash), make the shell configurable via env (`JOCA_SHELL`) rather than hardcoding — additive change, macOS default unchanged.

---

## Phase 3 — Paths & filesystem

- Rate-limit cache: `path.join(os.tmpdir(), 'joca-ui')` → `%TEMP%\joca-ui` on Windows. Confirm the dir is created and writable.
- `safePath()` / `safePathForRead()` sensitive-dir blocklist is POSIX-flavoured (`.ssh`, `Library/Keychains`, `.zshrc`...). On Windows the home-root sentinel and `..` handling still apply, but verify path normalization works with backslashes and drive letters (`C:\Users\...`). FileBrowser must list fixed drives.
- "Open in external app": `server.ts` picks an open command — must be `start ""` (cmd) / `Invoke-Item` on Windows, `open` on macOS, `xdg-open` on Linux. Verify `/open` and "reveal in explorer" resolve to the Windows command.

---

## Phase 4 — StatusLine & rate limits (known Windows gap)

`statusline-command.js` reads the Claude OAuth token via `readKeychainToken()`, which is **macOS Keychain only** (`if (process.platform === 'darwin')`). On Windows there is no Keychain, so the **7-day usage bar will be empty** unless a fallback is provided.

**Fix:** add a Windows token source in `readKeychainToken()` (or its caller), guarded by `process.platform === 'win32'`:
1. Read the token from `~/.claude/.credentials.json` / `%USERPROFILE%\.claude\` if Claude Code stores it there, or
2. Fall back gracefully (render the 5h/ctx bars, hide the 7d bar) — never crash the statusline.

Keep macOS Keychain path untouched. Verify `node statusline-command.js` produces valid ANSI output when fed the Claude Code stdin JSON, and writes `%TEMP%\joca-ui\rate-limits.json`. The UI reads it via `GET /rate-limits`.

---

## Phase 5 — Launchers (start.bat / stop.bat)

- `start.bat` creates **temp batch launchers in `%TEMP%\joca-ui\`** to avoid quoting issues when paths contain spaces. Verify both backend and frontend launch and that ports **7371 (backend) / 7372 (frontend)** come up.
- `stop.bat` must stop the processes by port using `netstat -ano` + `taskkill /PID` (Windows has no `lsof`/`kill`). Verify it does not kill unrelated processes.
- Confirm `JOCA UI.vbs` launcher (one-click) opens the UI and the browser at `http://localhost:7372`.

---

## Phase 6 — Smoke test

1. `start.bat` → both ports listening.
2. Browser opens `http://localhost:7372`.
3. Create a session → PowerShell PTY interactive → run `claude`.
4. Dashboard shows JOCA_Logic connected (sibling-dir detection works with Windows paths).
5. FileBrowser lists drives, previews a file, drag-to-terminal inserts a `file:///` path.
6. Statusline bars render (7d may be hidden if Phase 4 fallback used — acceptable, log it).
7. `stop.bat` cleanly stops both.

---

## Report

```
JOCA_UI WINDOWS ADAPTATION
--------------------------
Build:       [ok / fixed: node-pty rebuilt against Node <ver>]
PTY/shell:   [ok powershell.exe / configured JOCA_SHELL]
Paths:       [ok / fixed: open command, drive listing]
StatusLine:  [ok / 7d hidden (no Keychain) / fixed: <token source>]
Launchers:   [ok start.bat+stop.bat / fixed: <what>]
Smoke test:  [N/7 passed]

Files changed: <list — all Windows-guarded, macOS unaffected>
Remaining:   <anything needing manual user action, e.g. VS Build Tools>
```

**After fixing:** if any `JOCA_UI/` source changed, rebuild (`npm run build` backend) and recompile bridges if skills/agents touched. Surface any change that could affect macOS so the user can re-verify on the reference platform.

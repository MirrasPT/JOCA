# Workflows & Tooling

Recurring gotchas in multi-agent workflows and the local environment. **Loaded on-demand** (`Read()`), NOT in every session — the pointer is one line in `CLAUDE.md` (Repository Structure). Terse by design.

---

## Sub-agent briefs (Agent / Workflow)

Every worker brief MUST explicitly carry:
- **Anti-fabrication** — missing credential/endpoint/key → no-auth source or `TODO: missing credential` + report. Never invent (see `soul.md`).
- **Check parsers against a real response** — whoever writes an external API client makes 1 real call and validates the parsing before finishing (see `api-design.md`).
- **Validate CONTENT against the real source (not just code).** A worker writing content from a site/document (awards, news, specs, copy) MUST validate each block against the source and mark `TODO: not in the source` for whatever does not exist — by default, not only when the user asks for a comparison. The anti-fabrication rule applies to content, not just to APIs/credentials; without this step in the brief, workers invent plausible content that is only caught by an explicit audit. (Source: client e-commerce project, 2026-06-24.) **It extends to brand VISUAL ELEMENTS:** when iterating on a design from references, do NOT invent elements not present in the refs (bars, labels, watermarks, badges, slogans). If it is not visible in the reference → it does not exist. (Source: client social media project, 2026-06-26 — invented a sidebar + brand labels never present in the refs.)
- **Shared components before the fan-out** — in parallel builds by page/feature, define player/card/layout in a sequential foundation phase; fan-out agents IMPORT, they do not recreate (see `frontend.md`).
- **JOCA conventions in briefs that touch JOCA itself** — an agent that writes a validator/linter/script over JOCA gets the conventions in the brief, it does not infer them: the frontmatter `name:` is descriptive and ≠ the filename on purpose (e.g. `horizon`→`horizon-queues`); the `skills:` field in the frontmatter does NOT load a skill (the guarantee is `Read()` in the body); skills flat, depth 1. Source: `CLAUDE.md` + `docs/ARCHITECTURE.md`. (Lesson: a linter written without this marked 3 valid skills as FAIL.)

Sub-agents do **not inherit** `soul.md` automatically — they only receive the brief. That is why these rules go in the brief, they are not assumed.

## Workflow tool

- **`args` is unreliable** — data passed in `args` can arrive at the script as `undefined`. Embed data as literals in the script, or validate `args` at startup with a clear error before using it.
- **Adversarial verify without false positives** — give the verifier the exact set of files/lines of THIS task (or commit per phase). Otherwise the static review over the cumulative `git diff` marks previously approved work as "scope creep".
- **Destructive git ≠ workflow** — a deterministic, non-parallelizable sequence → use a versioned script. A workflow is good for fan-out (audit, research, drafting).
- **Lint/test gate: MEASURE the baseline, never hardcode it.** A gate with a constant `LINT_BASE` goes stale (lived: constant 24, real HEAD baseline 33 → gate `pass=false` and **3 useless repair iterations** trying to lower lint that was already the baseline). Measure at workflow startup: `git stash` → `npm run lint` → count → `git stash pop`; the regression is `current − measured_baseline`.
- **An agent that fails only the StructuredOutput ≠ an agent that died.** Symptom: the stream returns `null` ("retry cap (5) exceeded — 5 failed calls with no valid output") but the files are ALL written and compiling (lived: 249+418 lines + 4 endpoints given up for lost). Before re-running the stream, **check the disk** (`git status`/`ls` of the expected files). Mitigate at the source: return schemas with few `required` fields, and ask for the structured summary before the heavy work saturates the context.
- **Review by reading ≠ verification in execution.** Adversarial reviewers can give 9/10 and still let through trivial defects that only a smoke test catches (lived: missing assets + a column without the `ALTER` privilege, both invisible to reading). A pipeline that ends in deploy takes a **post-deploy** phase of end-to-end verification (real HTTP + DB state), separate from the code review.
- **Big upgrades of JOCA itself = 2 phases** (validated pattern): Phase 1 = analysis workflow → writes the plan + drafts in staging (`_improvement/`), does not touch canonical files. Phase 2 = application: independent files (new skills/agents/hooks) via a parallel workflow; shared canonical files (`CLAUDE.md`, `soul.md`, `settings.json`) via the sequential main loop (anti-clobber). Verify hooks with `node` before trusting them.

## Local environment (Windows-first)

The primary environment is **Windows**. When writing scripts/skills that touch credentials, binaries or paths:
- **`python`, not `python3`** — in **PowerShell/cmd** `python3` is the empty Microsoft Store stub (`ModuleNotFoundError`). ⚠ **In Git Bash `python3` may resolve to a real Python** — the warning is not universal, and treating it as universal creates a false alarm (lived: predicted that the Cloudflare purge of a `deploy-staging.sh` would fail for calling `python3`; it ran fine, `purge success: True`). Detect instead of assuming: `for PY in python python3; do command -v "$PY" && "$PY" -c "import <mod>" && break; done`.
- **Git Bash's `/tmp` is NOT visible to Windows-native Python.** A mixed Bash→`/tmp`→Python script sees non-existent files, returns empty lists and **truncates the destination** when rewriting (lived: `runs.jsonl` truncated; it was only saved because the blobs were still in the git index). Use a path both can see (the session scratchpad). And when rewriting a file from data that was read, **fail** instead of writing empty when the read returns 0 records.
- **`tar` with a drive letter → `--force-local`.** In Git Bash, `tar czf x.tgz C:/something` treats `C:` as a remote host (rmt) → `Cannot connect to C: resolve failed` / `Broken pipe`. Use `tar --force-local`.
- **Do not run a recursive `find` on cloud-sync drives** (`G:` Google Drive File Stream, `D:\Mega`) — File Stream materializes each folder as it walks it and `find -iname`/`-mtime` blows past Bash's 2 min timeout (lived 2×, one of them was left in the background running for nothing). Navigate through known paths with a targeted `ls`.
- **A port answering ≠ your process.** After restarting a server, confirm that the PID in LISTEN is the **new one** (`Get-NetTCPConnection -LocalPort <p> -State Listen | Select OwningProcess` + count instances) — otherwise you test the **previous** build without noticing (lived, with a repeated `EADDRINUSE` masking the old instance). Complements the IPv4+IPv6 double bind below.
- **Literal control characters break Write/Edit/Workflow.** Writing the real bytes into a regex class (`[\x00-\x20\x7f]`) makes the file "binary": `grep` refuses to show it, `Edit` stops matching strings, and the Workflow validator rejects the script. Prefer comparison by code point. ⚠ **CRLF in a Workflow script gives the SAME misleading error** ("control characters") — check line endings before hunting for a regex.
- **Rasterizing a PDF without poppler** — the Read tool fails on PDFs without poppler and `fitz`/`poppler` are not installed on this machine. Use `pypdfium2`: `pdf[i].render(scale=…).to_pil()`.
- **Credentials** — Claude in `~/.claude/.credentials.json` (not the macOS Keychain); Codex without the `sqlite3` binary → use `node:sqlite`.
- **Local process detection** — filter `Name='python.exe'` + `CommandLine -like '*main.py*'`. NEVER include the app's unique name in the `Win32_Process` filter — the pwsh running the query itself contains that string (false positive "restart loop").
- **Killing servers by port** — `taskkill /F /T /PID` (the `/T` kills the tree; vite/esbuild children hold the port).
- **`$PID` is read-only in PowerShell** — a reserved automatic variable. In a `taskkill` loop by port, use another name (`foreach ($p in $procs) { taskkill /F /T /PID $p }`); `$pid` blows up with "Cannot overwrite variable PID".
- **Git Bash's `sed -i` strips the CR from `.bat`/`.cmd` files** (CRLF→LF) — cmd.exe does not read batch files with LF: it breaks the parsing character by character (`setlocal`→`tlocal`, `set`→`et`) and gives misleading errors (e.g. an `if !errorlevel! neq 0` that does not expand → a FALSE "build failed" even with the build OK; or `LOG_DIR` inherited from the env because the `set` line failed). Symptom: the `.bat` "almost" runs but with commands eaten. Detect: `od -c x.bat | head` (look for `\n` without `\r`). Fix: reconvert ONLY the `.bat`/`.cmd` files back to CRLF — `sed -i 's/\r*$/\r/' x.bat` (idempotent). Do NOT convert `.sh`/`.command` (they must stay LF for macOS/Linux). Prefer editing `.bat` with Edit (preserves CRLF) over `sed -i`.
- **NEVER start a server on an already occupied port — check BEFORE starting.** On Windows two node processes CAN bind to the *same* port through different families: the 1st grabs `127.0.0.1` (IPv4), the 2nd grabs `::` (IPv6) → requests hit one or the other → **split state** (UI "messed up", inconsistent chat/projects). Symptom: `Get-NetTCPConnection -LocalPort <p> -State Listen` returns **2** lines (different PIDs). Reserved ports: **JOCA_OS 7491 (backend) / 7492 (frontend)** — the same in both installations, so they **never run at the same time**: stop one before starting the other, or pass ports through `JOCA_BACKEND_PORT`/`JOCA_FRONTEND_PORT`. Rule: before `node dist/server.js`/`vite`/`start.bat`, run `Get-NetTCPConnection -LocalPort <p> -State Listen` — if there is a listener, **stop it first** (`stop.bat` or `taskkill /F /T /PID`), only then start. Never relaunch a backend while the user's `start.bat` may be running (and vice versa). To recover: kill ALL the port's PIDs (IPv4+IPv6), rebuild, start **one** only.
- **`__dirname` in nested modules — shared data paths via an exported constant, not `../../`.** A module in `src/sub/x.ts` (→ `dist/sub/x.js`) resolves `__dirname/../../data` to a DIFFERENT directory than a module in `src/y.ts` (→ `dist/y.js`) — one level of depth more. Silent bug: two modules reading/writing distinct data folders (e.g. memory written to `backend/data` while the rest uses `JOCA_OS/data`). Fix: **export `DATA_DIR` from a single module and import it**; never recompute the data path with `../../` in each file. **When the data-dir consumer is an external subprocess/bridge** (e.g. a standalone `.mjs` executed by another process, which can NOT import the compiled TS module): the **parent process PASSES the absolute path** (computed from the single source `DATA_DIR`) through **argv/env**; the child reads it from there and **fails loudly** (stderr + exit≠0) if it is missing — it never recomputes with `../../`. (Symptom lived: the Codex bridge recomputed `backend/src/master → ../../data = backend/data` while the backend uses `JOCA_OS/data` → ENOENT at startup → the bridge dies → the external CLI ended up with 0 tools and did the work itself instead of orchestrating. JOCA_OS 2026-06-25.)
- **The Vite proxy has to list ALL the backend routes.** In a Vite-dev app + separate backend (e.g. JOCA_OS frontend :7392 → backend :7391), a relative `fetch('/x')` to a route **absent from `vite.config`'s `server.proxy`** does NOT error — the dev server serves `index.html` (SPA fallback) with **HTTP 200** → `await res.json()` blows up parsing HTML → the state silently ends up empty. **Misleading symptom:** data "lost on refresh" while the backend persists fine (it looks like a persistence bug, it is a routing one). `tsc`/build pass. Fix: add the route to `vite.config`'s `proxy`. Rule: when creating a new backend route that the frontend consumes by relative fetch, **add it to the proxy right away**; audit with `grep "fetch('/" frontend/src` against the proxy keys. (JOCA_OS 2026-06-25: `/master-chat` and `/roots` missing → the chat "lost" history.)
- **Writing JSON state to disk has to be ATOMIC (temp + rename).** A direct `fs.writeFileSync(file, json)` can leave a **half-written/"frozen"** file if the process dies mid-way (stop.bat, `taskkill /F /T`, crash) — on the next boot `JSON.parse` fails and a `catch { return [] }` **silently** reverts the state to the default (it looks like "blocked memory"/lost data). Fix: write to `file.tmp` and `fs.renameSync(tmp, file)` (rename is atomic on the same volume) + **log** the read error only when the file exists (not on the first run). Apply to ALL persisted state (projects, memory, settings). (JOCA_OS 2026-06-25.)
- **Git Bash (MSYS) converts an argument starting with `/` into a Windows path.** Passing `/labels/x` to a script via Git Bash arrives as `C:/Program Files/Git/labels/x` (junk prefix) — silent bug (e.g. `src` in the DB with the wrong prefix → "images disappeared"). Fix: `MSYS_NO_PATHCONV=1 <cmd>`, or run it via PowerShell, or normalize in the script by the known segment (`p.slice(p.indexOf('/labels/'))`). (Source: local label-generation app, 2026-06-24.)
- **Debugging a color/render discrepancy (source vs export): measure real pixels BEFORE touching the code.** Extracting pixels from both (PIL / canvas `getImageData`) + comparing by hash locates where the color changes — source (CMYK→sRGB), canvas (Chrome's color management → `createImageBitmap({colorSpaceConversion:'none'})`) or encoder. Theorizing = wasted cycles. (Source: local label-generation app, 2026-06-24; complements Asset readiness.)
- **Renaming/moving the project's root folder** — is NOT done from inside Claude: the cwd of the Claude process itself (and of the persistent shells) holds the directory → `Permission denied`/`Sharing violation` on `git mv`/`move`. Pattern: (1) update ALL the refs in-session with `sed`/Edit — *internal* files are writable, only the *dir rename* blocks; (2) stop apps that read the folder (release the handles); (3) leave a `.bat` (`cd /d %~dp0` + `git mv old new`) that the user runs **with Claude closed**; (4) reopen Claude in the new folder. Prefer `git mv` (preserves history) with `move` as fallback.

- **PHP/Laravel on native Windows — Octane impossible, `composer install` silently corrupts `vendor/`.** (1) **Octane** (any runtime, incl. FrankenPHP/RoadRunner) does **NOT run on native Windows** — it requires `pcntl`/`posix` (POSIX signals do not exist there); FrankenPHP only has Linux/macOS binaries (the installer refuses Windows). Persistent-worker/multi-thread on Windows → **WSL2 or Docker**; otherwise `php artisan serve` + opcache is the ceiling (single-thread, requests serialize). (2) **`composer install` fails to create symlinks** for some packages without Developer Mode/admin → inconsistent `vendor/`. With **opcache ON** that shows up as **function table corruption** (e.g. `mb_convert_encoding(...)` dispatches to `intltz_create_default()` → `ArgumentCountError` at boot, **masked** by "Class config does not exist"). Diagnose with opcache OFF (`php -d opcache.enable=0 -d opcache.enable_cli=0`); repair with `rm -rf vendor && composer install --no-scripts --ignore-platform-req=ext-pcntl --ignore-platform-req=ext-posix` + `php -d opcache.enable_cli=0 artisan package:discover`. (3) **Portable PHP 8.4**: the opcache JIT **segfaults** on Windows (exit 5) → keep `opcache.jit=disable`. Environment example (portable PHP on Windows): `<YOUR_PHP_PATH>`. (Source: Laravel SaaS project, 2026-06-26.)
- **Bulk writing to an external DB with duplicate names — validate the real one by metadata first.** Databases/data sources with the same name (e.g. a backup copy "Save DD-MM" created today + the real one) are easy to confuse → you edit the wrong one. Before a bulk write, **distinguish by metadata** (`created_time` / `database_parent` / `id`) and **confirm in 1 line** which is the real one. (Source: Notion `ntn` 2026-06-27 — edited the backup data source instead of the real one.)

## Line endings — false diffs between machines and server

Work on 2 machines (Windows + macOS) with deploys from both → CRLF vs LF produces divergences that are **not changes**.
- When syncing code from a server (with no `.git` there), `md5` marks files as different purely because of line endings (lived: 25 "different" files, **7 with real changes**, 18 only CRLF). Diff with `tr -d '\r'` **before** concluding there is a divergence; when bringing files from the server, convert them to the local file's style before writing.
- When comparing **builds** of the same commit across platforms: normalize line endings first. If the **vendor** chunks match and the **app** ones do not, suspect CRLF (`?raw` + `core.autocrlf`), not code.
- Probing corollary: in **minified** bundles, the absence of a string does NOT prove the absence of code (comments are removed at build time, identifiers are minified). Every probe needs a **positive control** — "does this detect something I KNOW is in there?". HTTP probes also need a negative control (Caddy returns 403 to everything under `config/`, whether the file exists or not). The reliable signal is rebuilding the commit and comparing hashes.

## macOS — gotchas

- **`~/.Trash` is blocked by TCC.** A direct `ls`/`find`/`stat` on the Trash from the Terminal gives `Operation not permitted`, even with the `trash` CLI able to write there. To empty it without requiring Full Disk Access: `osascript -e 'tell application "Finder" to empty trash'` (goes through the Finder API, no prompt).

## Claude Code plugins

Manage by CLI, not only through the interactive `/plugin` TUI:
```bash
claude plugin marketplace add <repo>
claude plugin install <plugin>@<marketplace>
```
Marketplace plugins are always **user-scope** → always-on cost in every session.

## Browser (Playwright) in the main loop

The playwright MCP can be **completely absent** — not just "sub-agents only". It can fail silently at MCP boot if `npx playwright install` was not run in the session. Do not assume it is available anywhere.
Canonical fallback when playwright is not available:
1. **Windows:** `Start-Process "<url>"` to open in the OS browser.
2. Programmatic verification: `tsc --noEmit` + the bundler's output (vite/next build) as a proxy.
3. Visual confirmation: ask the user "can you confirm that X shows up in the browser?".
Never report "I cannot verify" without trying the fallback first. Do not redirect to a sub-agent if the sub-agent does not have playwright either.

### MCP outputs land in JOCA_Brain (read-only production)
The playwright MCP only writes inside the **allowed roots** = the server's cwd. Under JOCA_OS the cwd is always `JOCA_Brain` → `.playwright-mcp/` and the `*.png` files are born **inside read-only production**, and an absolute `filename` pointing at the scratchpad gives `File access denied` / "outside allowed roots". Mandatory pattern: capture → immediate `Read` → **move to the scratchpad and delete** `JOCA_Brain/.playwright-mcp/` + the `*.png` at the root before closing the session.

### Browser lock recovery
`Browser is already in use for …ms-playwright-mcp… use --isolated` = a stale instance from a previous session holding the profile lock (blocks `navigate`/`resize`). Fix: kill the tree of chrome processes with `ms-playwright-mcp` in the command line (macOS: `pkill -f ms-playwright-mcp`) + remove the profile's `SingletonLock`; or start the MCP server with `--isolated`.

### Visual QA — what misleads
- **`page.screenshot({fullPage:true})` misplaces `position:fixed` elements** — they show up in the middle of the page and simulate a layout defect that does not exist. Confirm any suspicion of overlap with a **normal viewport** capture before treating it as a defect.
- **`img.decode()` on a `loading="lazy"` image not yet requested NEVER resolves** and hangs the script indefinitely. Set `loading="eager"` before walking the page and run `decode()` against a timeout.
- **Scroll-scrub (GSAP ScrollTrigger):** measuring `getComputedStyle` right after `scrollTo` gives wrong values (the scrub has ~1s of lag) → wait ≥2s. And **confirm the viewport BEFORE measuring** effects that depend on a media query (sticky/stack switch off on mobile and the geometry stops making sense — lived measuring a stack at 390px). To validate a scrub's **curve**, 3 screenshots at 3 points are more reliable than computed style.

## Vite on the HOST, not in the Sail container (Windows)

In Laravel Sail + Vite projects on Windows: **Vite always runs on the HOST** (PowerShell/local terminal), never inside the Sail container. Reasons:
- `node_modules/` has native binaries for the platform of the `npm install` — if installed on the Windows host, the binaries do not run in the Linux Alpine container.
- `docker-proxy` holds the mapped port (e.g. `:5173`) even with no process inside the container → the host's Vite uses `:5174` (auto-increment).
Rule: `npm run dev` in the host's PowerShell; never `sail npm run dev` unless `node_modules/` was installed inside the container.

## robocopy /XD — always an absolute path

`robocopy /XD <name>` excludes folders by name at **ANY level** of the tree, not just at the root level. Excluding `models` also removes `pip/_internal/models/` → broken pip (`No module named 'pip._internal.models'`).
Rule: **always use an absolute path** with `/XD`:
```
robocopy src dst /E /XD "C:\abs\path\to\models" "C:\abs\path\to\output"
```
Never use the bare name (`/XD models`) in trees that contain Python packages or node_modules.

## ComfyUI portable — python embeddable without .lib/Include

ComfyUI portable (python embeddable) does NOT ship `libs/python3XX.lib` or `Include/`. JITs that compile C (triton-tcc, some CUDA custom nodes) fail with `returned non-zero exit status 1`.
Fix — download the headers/lib via nuget:
```powershell
$ver = "3.13.2"  # exact version of python_embeded
$url = "https://api.nuget.org/v3-flatcontainer/python/$ver/python.$ver.nupkg"
Invoke-WebRequest $url -OutFile python_pkg.zip
Expand-Archive python_pkg.zip python_pkg
Copy-Item python_pkg/tools/libs/python313.lib python_embeded/libs/
Copy-Item -Recurse python_pkg/tools/include/* python_embeded/Include/
```
⚠ Windows: `flash_attn` has no practical wheel → use the `sdpa` backend (native torch). `xformers` only if a wheel exists for the exact torch installed.

## External SDK — check the types in the .d.ts, not in the docs

When writing code against an external SDK (e.g. `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk`), **read the installed `.d.ts`** as the source of truth before writing code:
```bash
cat node_modules/@anthropic-ai/claude-agent-sdk/dist/*.d.ts | head -100
```
Online docs may be stale; the `.d.ts` reflects the installed package. `tsc`/`build` pass with a wrong API option that only blows up at runtime.

## Plugin marketplace — SSH → HTTPS rewrite

`claude plugin marketplace add` uses SSH to clone from GitHub by default. On Windows with no SSH key configured for GitHub, it fails with `Permission denied (publickey)`.
Fix (idempotent, non-destructive):
```bash
git config --global url."https://github.com/".insteadOf "git@github.com:"
```
⚠ This global config affects every `git clone` over SSH from GitHub → remove it afterwards if undesirable: `git config --global --unset url."https://github.com/".insteadOf`.

## Asset readiness

A plan that depends on the **visual properties** of assets (video with no watermark, hook at sec. 0, clean image) is not verifiable from the filename. Before declaring "ready to publish", sample frames via `gemini-brain`/`watch`. A file existing ≠ a file being ready.

**Run it at the START, not at the end.** In branding/co-branding work, build the `brand · format · vector? · transparent? · usable for a lockup?` table before planning. Lived: a third party's brand material only existed as **JPEG with a solid background** — blocking for any lockup — and it was only detected at the end of the inventory.

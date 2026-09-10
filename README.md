# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Centralized toolkit of skills, agents, memory and commands for Claude Code — with an integrated visual browser interface. Install once, use in any project. macOS and Windows.

**The problem it solves:** every new project starts over from zero — no context, no tooling, no consistent behavior. JOCA is the persistent layer that lives above the projects.

---

## Architecture

```
JOCA/
├── install.md               <- bootstrap (new machine)
├── update.md                <- update guide
├── JOCA_Brain/              <- Agentic Engine
│   ├── CLAUDE.md            <- base behavior
│   ├── memory/
│   │   ├── INDEX.md         <- component catalog
│   │   ├── soul.md          <- calibratable personality
│   │   ├── SKILL_INDEX.json <- lazy-loading index
│   │   ├── projects/        <- state per project (/save)
│   │   ├── feedback/        <- feedback sessions (captured by /save)
│   │   └── tools/           <- graphify, MCP routing
│   └── .claude/
│       ├── commands/        <- 29 commands (/install, /save, /goal, /know, /upgrade-joca, ...)
│       ├── agents/          <- 105 agents (tester-*, debug, research, media, orchestration, ...)
│       ├── skills/          <- 152 flat skills — declarative triggers, on-demand loading
│       ├── rules/           <- 8 global directives (task-intake, chaining, pipelines, testing, ...)
│       ├── reference/       <- dense reference, loaded on-demand (does not live in context)
│       ├── hooks/           <- Node.js cross-platform (track-changes, auto-test, task-intake)
│       └── scripts/         <- statusline, compile-bridges, build-skill-index
│
└── JOCA_OS/                 <- Interface: multi-session terminals
    ├── backend/             <- Node.js + Express + WebSocket + node-pty
    ├── frontend/            <- React + Vite + xterm.js
    ├── data/                <- local state (projects, settings) — never committed
    ├── start.sh / start.bat <- cross-platform launchers
    └── stop.sh / stop.bat   <- stop scripts
```

**286 components:** 152 skills + 105 agents + 29 commands.

---

## JOCA_OS — Visual Interface

A browser dashboard with multi-session Claude Code terminals, file browser, toolkit panel and
real-time rate limits.

### Brand themes — JOCA with whichever face you want

Selector in Settings → Theme. It changes the interface's **name, logo and colors**; nothing else. The
brain, the memory and the work stay exactly the same — it is only appearance.

Five ship with it: **JOCA** (the original), **Alfredo**, **K.I.T.T.**, **R2-D2** and **HAL 9000**. Each
theme brings a light **and** a dark mode (an axis independent of the light/dark/dynamic selector), and
it also swaps the tab favicon.

> The logos that come with the non-JOCA themes are third-party art, included for local use. Anyone
> publishing a fork should replace them.

### Interface

- **Multi-session terminal:** each session runs a real Claude Code via node-pty (2M-line scrollback, 5MB buffer per session, cap of 30 simultaneous sessions)
- **File preview:** drag-resizable window, supports code (highlight.js), markdown, HTML (iframe sandbox), PDF, images, audio, video — focus trap + ARIA dialog
- **Slash command autocomplete:** `/` opens a dropdown of commands, skills and agents with an ARIA combobox + filtering
- **Rate limits dashboard:** Claude (context, 5h, 7d, Sonnet via OAuth + Keychain), Codex (SQLite), Gemini (agy statusline)
- **Dashboard:** projects, active sessions, JOCA_Brain engine status, multi-CLI rate limits
- **Toolkit panel:** browse/search/edit of JOCA_Brain's 286 components
- **File browser:** real filesystem with dotfiles toggle, window-focus refresh, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), connections
- **Quick agents in the rail:** sessions with no project show up at the top of the sidebar, with
  direct access, rename by double-click and close — without going through the global Agents view
- **Collapsible sidebars:** left rail (62px) and right rail (54px) with smooth animations (280ms ease-out-quart)
- **Cross-platform:** macOS (zsh) and Windows (PowerShell) — automatic OS detection

JOCA_OS automatically detects `JOCA_Brain` as a sibling directory — zero configuration.

### Security (local-only, single-user)

`JOCA_OS` runs only on `127.0.0.1` and implements defense-in-depth hardening against malicious browser tabs:

- **Origin guard:** HTTP middleware rejects mutations (POST/PATCH/DELETE) from non-loopback origins; the WebSocket uses `verifyClient` to reject pre-handshake (HTTP 401)
- **Path safety:** a single `safePath()` helper applied to every FS route — resolves symlinks via `fs.realpathSync.native()`, refuses HOME root, and blocks sensitive subdirs (`.ssh`, `.gnupg`, `.aws`, `.kube`, `.config/gh`, `.gitconfig`, `.env`, `.zshrc`, `Library/Keychains`, etc)
- **Write/rename:** `O_EXCL` (openSync `wx`) + `lstat` refuse symlink targets; refuses `nlink > 1` (hardlink → sensitive files)
- **`/open`:** allowlist of safe extensions (docs/media) + executable-bit check + `stat.isFile()` (rejects FIFO/socket/device)
- **`/file-content`:** SVG with CSP `sandbox`; HTML serves `Content-Disposition: attachment` except when `Sec-Fetch-Dest: empty` (fetch/XHR); global `nosniff`
- **PTY:** `resumePath` validated by a Unicode allowlist (`\p{L}\p{N}`); cap of 30 simultaneous sessions; resize bounds (cols 10-500, rows 5-200)
- **FilePreview iframe:** sandbox without `allow-same-origin` for HTML, `tabIndex={-1}` to contain the focus trap, focus-bounce on mouse-click
- **OAuth:** the statusline uses native `https` (no shell), the token is validated by regex before Bearer injection, cached in `tmpdir` with mode `0600`

> Threat model: machine compromise = game over (any dev tool falls). But in normal solo use + random tabs in the same browser, JOCA_OS is hardened to a level equivalent to the Vite dev server / Storybook.

### Remote mode (VPS) — opt-in with mandatory auth

To run JOCA on a VPS and reach it from the phone (installable PWA):

```bash
JOCA_PASSWORD='a-strong-password' JOCA_HOST=0.0.0.0 npm start
```

- **Mandatory auth:** a `JOCA_HOST` outside loopback refuses to start without a password (env `JOCA_PASSWORD` or set in the local UI before the deploy). Login issues a 30-day token (httpOnly cookie + Bearer); 5 failures = 30s lockout
- **TLS:** terminates at the reverse proxy (Caddy/nginx) or use a private network (Tailscale/WireGuard) — never expose plain http to the internet
- **Origins:** same-origin verified by default; extra origins via `JOCA_ALLOWED_ORIGINS=https://joca.example.com`
- **PWA:** open the link on the phone and "Add to Home Screen" — JOCA installs as an app

### Inbox and multi-CLI

- **Persistent inbox:** every notification (errors, sessions that ended) is stored — closing the tab no longer loses anything
- **Multi-CLI:** sessions can run Claude Code (default), Codex CLI, Antigravity or OpenCode — with a per-run configurable model

---

## Quick start

### New machine — full bootstrap

Paste into Claude Code:

```
Read the file install.md at https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md and follow the instructions.
```

The wizard clones the repo, configures identity, personality (soul), skills, CLIs and installs JOCA_OS.

### I already have JOCA but it is slow, expensive or causing problems — clean install

For anyone who has used JOCA for a while (possibly several old copies on the same machine) and feels
excessive token consumption, installations conflicting with each other, or just wants to start over
without losing memory.

**Step 1 — create a NEW and EMPTY folder** (never inside an existing JOCA installation — the command
ends up archiving old installations, and running it from inside one of them would try to
move/archive the very folder Claude Code is running from).

**Step 2 — open a Claude Code terminal inside that empty folder and paste:**

```
Read the file clean-install.md at https://raw.githubusercontent.com/MirrasPT/JOCA/main/clean-install.md and follow the instructions.
```

The wizard clones JOCA into this folder (which becomes the production installation, it is not moved
again), finds ALL the old installations on the machine, audits them against this baseline, proposes a
table of token optimizations (it never applies anything without your approval), consolidates the
memory of every old installation into here (the most recent one wins on conflict, nothing is
discarded), runs graphify (mandatory) over every connected project, and archives the old
installations in an `Old/` folder — it never deletes them.

### Start the interface

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```

It automatically opens `http://localhost:7492`.

### Update JOCA

**Option 1 — Command (inside a JOCA session):**
```
/update-joca
```

**Option 2 — Direct prompt (if the command fails or JOCA is not configured):**
```
Read the file update.md at https://raw.githubusercontent.com/MirrasPT/JOCA/main/update.md and follow the instructions.
```

One-way sync from GitHub. It protects project memory, feedback, soul calibration, local components
(`origin: local`) and all the JOCA_OS state in `JOCA_OS/data/` — projects, project groups, session
memory, settings (theme, default CLI) and notifications.

**After updating, if it touched JOCA_OS:**

```bash
cd JOCA_OS/backend  && npm install && npm run build && cd ../..
cd JOCA_OS/frontend && npm install && npm run build && cd ../..
bash JOCA_OS/stop.sh && bash JOCA_OS/start.sh   # Windows: stop.bat / start.bat
```

Two things that get forgotten and produce "the update did nothing":
- the **frontend needs `npm run build`** — the backend serves `frontend/dist/`, so without a build
  the interface stays on the previous version even with the new files on disk;
- the **backend runs the compiled build, with no watch** — it only picks up the changes on restart,
  and the restart **kills live agents and terminals**. Close whatever you are running first.

### Improve JOCA

```
/upgrade-joca
```

Reads accumulated feedback, researches best practices with `deep-research`, improves skills with the `skill-improver` + `skill-evaluator` loop, validates with a Codex review.

### Work session

```
/resume          <- session start
/save            <- session end (auto-feedback included)
/start           <- start or connect a project
```

---

## Skills (152)

Activated on-demand with an RFC 2119 trigger system (`MUST be invoked when...`, `SHOULD also invoke when...`). Automatic activation when relevance >= 60%. (Partial list — full inventory in `JOCA_Brain/memory/SKILL_INDEX.json`.)

### Base
`caveman` · `karpathy-guidelines` · `agent-context` · `plan` · `planning` · `prd` · `create-skill` · `pt-pt-translator` · `browser-automate` · `joca-terminal`

### Design
`frontend` · `mobile` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `lottie-animator` · `img-gen` · `design-system` · `design-tokens` · `component-system` · `html-review`

### Dev
`laravel-specialist` · `filament` · `mysql` · `rest-api` · `saas-patterns` · `file-storage` · `reverb-realtime` · `auth` · `transactional-email` · `postmark` · `error-tracking-dev` · `error-tracking-prod` · `search` · `queues` · `bullmq` · `webhooks` · `caching` · `availability` · `security` · `horizon`

### DevOps
`deploy-cpanel` · `deploy-docker` · `deploy-ploi` · `deploy-vps` · `cloudflare-dns` · `cpanel` · `selfhosted-arr` · `github`

### Marketing
`paid-ads` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `content-calendar` · `social-content` · `copywriting` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `lead-capture` · `competitor-profiling` · `landing-page` · `marketing`

### Analytics
`google-analytics` · `microsoft-clarity`

### Video & Media
`video` · `hyperframes` · `remotion` · `lyric-align` · `site-capture` · `html-to-pdf`

### WordPress
`wordpress-router` · `wp-project-triage` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-plugin-directory-guidelines` · `wp-rest-api` · `wp-wpcli-and-ops` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `wp-interactivity-api` · `wp-abilities-api` · `wpds` · `blueprint`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

### Architecture & Docs
`rfc` · `adr` · `tech-spec` · `task-breakdown` · `c4-diagram`

---

## Agents (105)

Agents run in isolated sub-processes, in parallel. (Partial list — full inventory in `JOCA_Brain/.claude/agents/`.)

### Review & Testing
`tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit` · `codex-review` · `prd-reviewer` · `design-system-audit`

### Debug
`log-debugger` · `query-debugger`

### Search & Analysis
`deep-research` · `seo-analyst` · `dependency-auditor`

### Orchestration
`master-orchestrator` · `self-improver` · `gemini-auditor`

### Generation & Media
`img-gen-openai` · `img-gen-google` · `video-gen` · `watch` · `gemini-brain`

### Specialists
`payment-integration` · `skill-evaluator` · `skill-improver` · `security-review`

### Execution (65, generated from the skills)
Every skill that **produces artifacts** has a twin agent `<skill>-agent` that reads the skill as Step 0
— same doctrine, its own context. They exist so that several jobs can run at the same time without
occupying the main conversation: `tailwind-agent`, `laravel-specialist-agent`, `copywriting-agent`,
`deploy-vps-agent`, `wp-block-development-agent`, `shopify-app-agent`, ...

They are not copies: the skill remains the source of truth and editing it updates both.
Regenerate: `node JOCA_Brain/.claude/scripts/skill-agents.mjs` (curated list at the top of the script).

**When to dispatch instead of reading the skill inline:** from **2 independent parts** in the request
onwards. A single part → reading the skill and doing it inline is cheaper. See `rules/task-intake.md`.

---

## Commands (29)

Partial list — full inventory in `JOCA_Brain/.claude/commands/`.

| Command | Function |
|---------|--------|
| `/install` | Interactive setup — identity, soul, skills, CLIs, statusline, JOCA_OS |
| `/start` | Starts a new project (interview → PRD → stack → design) or connects an existing one |
| `/execute-project` | The execution side of `/start`: foundation → design → gate → waves until production |
| `/resume` | Loads context at the start of the session |
| `/save` | Saves state + project feedback + toolkit feedback (auto) |
| `/plan` | Plan Mode — architecture |
| `/debug` | Error triage + skill for the detected stack |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + accessibility in parallel |
| `/one-shot` | Autonomous dev: PRD -> orchestrator -> parallel -> tests |
| `/build-plan` | Phased supervised build: plan in docs -> tasks -> loop with a test gate |
| `/create-skill` | Pipeline: research -> draft -> evaluate -> iterate |
| `/upgrade-joca` | Self-improvement: research -> plan -> execute -> validate |
| `/update-joca` | Sync with GitHub (protects local, rebuilds UI) |
| `/migrate` | v1-legacy -> v2.0 migration |
| `/wp-perf-review` | WordPress code review |
| `/wp-perf` | Quick WordPress triage |
| `/status` | Rate limits, context and model in use |
| `/joca-doctor` | Installation diagnosis (runtimes, hooks, indexes, bridges, memory) |
| `/help-joca` | Quick reference |

---

## Pipelines

Pre-defined sequences activated automatically:

| Workflow | Sequence |
|----------|-----------|
| New Laravel feature | `plan` -> `laravel-specialist` -> `tester-code` -> `tester-api` |
| SaaS / multi-tenant | `plan` -> `saas-patterns` -> `laravel-specialist` -> `tester-security` |
| Frontend | `frontend` -> `tester-ui-ux` -> `tester-performance` |
| One-shot | `master-orchestrator` -> parallel agents -> `tester-*` (auto) |
| Debug | `log-debugger` -> `query-debugger` (if SQL) |
| Self-improvement | `/save` (captures gaps) -> `/upgrade-joca` -> `deep-research` + `skill-evaluator` loop |
| New skill | `deep-research` -> `skill-improver` -> `skill-evaluator` (8.0/10 threshold) |

---

## Cross-CLI Bridge

JOCA works with 3 CLIs. Source of truth: `.claude/` — compiled to external formats:

| CLI | Bridge |
|-----|--------|
| Claude Code | `.claude/` (native) |
| Codex CLI | `.agents/skills/` + `.codex/agents/` |
| Antigravity (agy) | `GEMINI.md` + `AGENTS.md` |

```bash
bash .claude/scripts/compile-bridges.sh
```

---

## Requirements

- **Claude Code** installed and authenticated
- **Node.js 18+** (for JOCA_OS and the cross-platform hooks)
- **macOS** or **Windows** (Linux experimental)
- **gh CLI** (GitHub — `winget install GitHub.cli` / `brew install gh`)
- Optional: Python 3.10+ (graphify), Codex CLI, Antigravity CLI (agy), browser-use CLI, playwright-cli, sentry-cli, ffmpeg, gws, zmail-cli (Java 11+)

---

## Credits

Skills and agents built on the work of: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, and others. Full list in [`CREDITS.md`](JOCA_Brain/CREDITS.md).

---

**Repository:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> The license of the individual components belongs to their original authors. JOCA as an integration system: MIT.

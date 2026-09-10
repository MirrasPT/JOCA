# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Centralized toolkit of skills, agents, memory and workflows for Claude Code — with an integrated visual browser interface. Install once, use in any project. macOS and Windows.

**The problem it solves:** every new project starts over from zero — no context, no tooling, no consistent behavior. JOCA is the persistent layer that lives above the projects.

---

## Architecture

JOCA is made up of two modules that work together:

```
JOCA/
├── install.md               <- install bootstrap (new machine)
├── JOCA_Brain/              <- Agentic Engine (skills, agents, commands, memory)
│   ├── CLAUDE.md            <- base behavior
│   ├── memory/
│   │   ├── INDEX.md         <- component catalog
│   │   ├── soul.md          <- personality and decision filters
│   │   ├── SKILL_INDEX.json <- lazy-loading index
│   │   ├── projects/        <- state per project (/save)
│   │   └── tools/           <- graphify, routing
│   └── .claude/
│       ├── commands/        <- 25 commands (/install, /resume, /save, /plan, /goal, ...)
│       ├── agents/          <- 103 agents (tester-*, debug, research, media, orchestration, ...)
│       ├── skills/          <- 145 flat skills (.md) — on-demand loading
│       ├── hooks/           <- autonomous testing + task-intake pipeline
│       ├── rules/           <- api-design, testing, task-intake, orchestration-patterns
│       └── scripts/         <- compile-bridges, build-skill-index, statusline
│
└── JOCA_OS/                 <- Interface: multi-session terminals
    ├── backend/             <- Node.js + Express + WebSocket + node-pty
    ├── frontend/            <- React + Vite + xterm.js
    ├── data/                <- local state (projects, settings) — never committed
    ├── start.sh             <- macOS/Linux launcher
    ├── start.bat            <- Windows launcher
    └── stop.sh              <- macOS/Linux stop
```

**281 components:** 149 skills + 103 agents + 29 commands.

---

## JOCA_OS — Visual Interface

A browser dashboard with multi-session Claude Code terminals, file browser and toolkit panel.
Nothing starts on its own: the terminals are born when the user opens them, and the inbox warns when a
session ends or fails.

- **Multi-session terminal:** each session runs a real Claude Code via node-pty
- **Dashboard:** projects, active sessions, real-time JOCA_Brain status
- **Toolkit panel:** browse/search/edit of the JOCA_Brain components
- **File browser:** real filesystem with auto-refresh, preview, drag-to-terminal
- **Settings:** runtime info, CLI status (Claude/Codex/agy), JOCA_Brain engine status
- **Slash autocomplete:** typing `/` in the emulated terminal brings up a dropdown with commands, skills and agents
- **Cross-platform:** macOS (zsh) and Windows (PowerShell) via automatic OS detection

JOCA_OS automatically detects `JOCA_Brain` as a sibling directory — zero configuration.

> **Development platform:** JOCA_OS was developed and validated on **macOS**. The code supports Windows (automatic OS detection, PowerShell, `%TEMP%`), but Windows is not continuously tested. When **installing or updating on Windows**, JOCA activates the `joca-os-windows` skill, which tests, checks and fixes the sensitive points in a single pass (node-pty build, PowerShell PTY, paths, statusline/Keychain, launchers).

---

## Quick start

### New machine — full bootstrap

Paste into Claude Code:

```
Read the file install.md at https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md and follow the instructions.
```

The wizard clones the repo, configures identity, personality (soul), skills, external CLIs and installs JOCA_OS.

### Start the interface

```bash
# macOS / Linux
bash JOCA_OS/start.sh

# Windows
JOCA_OS\start.bat
```

Backend at `http://localhost:7491`, interface at `http://localhost:7492`.

### Update JOCA

```
/update-joca
```

Compares the local installation with the GitHub repository, shows what is new and applies updates after confirmation. It never overwrites project memory or personal feedback.

### Work session

At the start of each session:

```
/resume
```

To start a new project or connect an existing one:

```
/start
```

---

## Skills (151)

Skills are activated on-demand — they only load when invoked. Flat format: one `.md` per skill in `.claude/skills/`, with RFC 2119 triggers (MUST/SHOULD/MAY).

### Base & JOCA
`caveman` · `karpathy-guidelines` · `agent-context` · `create-skill` · `context-pack` · `pt-pt-translator` · `joca-os-windows` · `browser-automate` · `yagni` · `agent-sdk` · `comfy-mcp-workarounds`

### Guard-rails
`freeze` · `careful` · `guard` · `tdd` · `unfreeze`

### Planning & Specs
`plan` · `planning` · `prd` · `tech-spec` · `task-breakdown` · `adr` · `rfc` · `c4-diagram` · `blueprint` · `html-review`

### Design & Frontend
`frontend` · `mobile` · `design-system` · `design-tokens` · `component-system` · `brand-guidelines` · `graphic-design` · `slides` · `anima` · `lottie-animator` · `img-gen` · `design-review` · `tailwind` · `shadcn` · `react-composition` · `react-patterns` · `landing-page`

### Dev (Laravel / backend)
`laravel-specialist` · `filament` · `laravel-react` · `saas-patterns` · `rest-api` · `mysql` · `auth` · `security` · `file-storage` · `caching` · `queues` · `bullmq` · `horizon` · `reverb-realtime` · `search` · `webhooks` · `availability` · `error-tracking-dev` · `error-tracking-prod` · `github`

### Email
`react-email` · `transactional-email` · `postmark`

### Deploy
`deploy-cpanel` · `deploy-docker` · `deploy-ploi` · `deploy-vps`

### Portugal
`portugal-payments` (ifthenpay/MB WAY/Multibanco) · `portugal-invoicing` (Moloni/certified invoicing)

### Marketing
`marketing` · `paid-ads` · `seo` · `seo-local` · `copywriting` · `content-strategy` · `content-calendar` · `social-content` · `email-sequence` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `competitor-profiling` · `lead-capture`

### Analytics
`google-analytics` · `microsoft-clarity`

### Video
`video` · `hyperframes` · `remotion` · `lyric-align`

### WordPress
`wordpress-router` · `wp-project-triage` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-plugin-directory-guidelines` · `wp-rest-api` · `wp-abilities-api` · `wp-interactivity-api` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `wp-wpcli-and-ops` · `wpds`

### Shopify
`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

### Wix
`wix-cli`

### Autonomy & Personal
`knowledge-ingest` (/know) · `personal-comms` (Phase 2/3)

---

## Agents (105)

Agents run in isolated sub-processes, in parallel.

### Review & Testing
`tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit` · `codex-review` · `prd-reviewer` · `design-system-audit`

### Debug
`log-debugger` · `query-debugger`

### Search & Analysis
`deep-research` · `seo-analyst` · `dependency-auditor`

### Orchestration & Self-improvement
`master-orchestrator` · `task-router` · `self-improver` · `gemini-auditor` · `skill-evaluator` · `skill-improver`

### Generation & Media
`img-gen-openai` · `img-gen-google` · `video-gen` · `watch` · `gemini-brain`

### Specialists
`payment-integration` · `security-review` · `laravel-refactor` · `filament-builder` · `pr-repair` · `deploy-executor` · `a11y-fixer` · `tech-debt-auditor`

### Autonomy & Personal
`knowledge-ingest` · `personal-comms` (Phase 2/3)

---

## Commands (29)

| Command | Function |
|---------|--------|
| `/install` | Interactive setup on a new machine |
| `/start` | Starts a new project or connects an existing one to JOCA |
| `/resume` | Loads context at the start of the session |
| `/save` | Saves state at the end of the session |
| `/plan` | Plan Mode — architecture |
| `/debug` | Error triage + skill for the detected stack |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + accessibility in parallel |
| `/one-shot` | Autonomous end-to-end dev: PRD -> orchestrator -> parallel -> tests |
| `/goal` | Auto-orchestration from an NL task (no PRD) -> orchestrator in a loop |
| `/know` | Ingest content into the Knowledge Base (markitdown -> summary -> tags) |
| `/build-plan` | Phased supervised build: plan in docs -> tasks -> loop with a test gate |
| `/create-skill` | Self-improving pipeline for creating skills |
| `/upgrade-joca` | Reads feedback and implements improvements |
| `/update-joca` | Sync with the GitHub repository |
| `/migrate` | v1-legacy -> v2.0 migration guide |
| `/status` | Shows rate limits, model and context |
| `/wp-perf-review` | Full WP code review |
| `/wp-perf` | Quick WP triage |
| `/help-joca` | Quick command reference |

---

## Pipelines

Pre-defined sequences activated automatically:

| Workflow | Sequence |
|----------|-----------|
| New Laravel feature | `plan` -> `laravel-specialist` -> `tester-code` -> `tester-api` |
| SaaS / multi-tenant | `plan` -> `saas-patterns` -> `laravel-specialist` -> `tester-security` |
| Full-stack e-commerce | `plan` -> `saas-patterns` -> `laravel-specialist` -> `filament-builder` -> `laravel-react` -> `frontend`+`shadcn` -> `payment-integration` |
| Production frontend | `design-system` -> `frontend` -> `react-composition`+`tailwind`+`react-patterns` -> `anima` -> `design-review`+`tester-ui-ux` |
| One-shot | `master-orchestrator` -> parallel agents -> `tester-*` (auto) |
| Debug | `log-debugger` -> `query-debugger` (if SQL) |
| Deploy | `deploy-docker`/`deploy-ploi`/`deploy-cpanel` -> `tester-security` |
| New skill | `deep-research` -> `create-skill` |
| Self-improvement | `self-improver` -> `gemini-auditor` -> apply |

---

## Cross-CLI Bridge

JOCA works with 3 CLIs. Source of truth: `.claude/` — compiled to external formats via `compile-bridges.sh`:

| CLI | Model | Bridge |
|-----|-------|--------|
| Claude Code | Claude (Opus) | `.claude/` (native) |
| Codex CLI | OpenAI GPT | `.agents/skills/` + `.codex/agents/` |
| Antigravity (agy) | Google Gemini | `GEMINI.md` + `AGENTS.md` |

```bash
bash .claude/scripts/compile-bridges.sh
```

---

## Requirements

- **Claude Code** installed and authenticated
- **Node.js 18+** (for JOCA_OS)
- **macOS** or **Windows** (Linux experimental)
- On Windows: Visual Studio Build Tools + Python 3.x (node-pty build)
- Optional: Python 3.10+ (graphify), Docker (Firecrawl)

---

## Credits

Skills and agents built on the work of: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, and others. Full list in [`CREDITS.md`](JOCA_Brain/CREDITS.md).

---

**Repository:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> The license of the individual components belongs to their original authors. JOCA as an integration system: MIT.

# JOCA Memory Index

## Core
- [soul.md](soul.md) — Personality engine: drives, decision filters, motivational states, user alignment. Foundation for all agents.

## Projects
- [joca.md](projects/joca.md) — JOCA toolkit self-development (skills/agents/commands)
- [meu-site-github.md](projects/meu-site-github.md) — Portfolio pessoal Node.js + Express + SQLite + Vanilla JS + GSAP
- [bracaris-brasil-2026.md](projects/bracaris-brasil-2026.md) — Site Wix da marca de vinho Bracaris — conteúdo/copy/SEO para mercado Brasil (pt-BR)
- [bigorna-2026.md](projects/bigorna-2026.md) — Primeira loja online do Bigorna — e-commerce Laravel + Filament + React/Tailwind
- [unimedia.md](projects/unimedia.md) — Netflix self-hosted multi-fonte (Next.js 15 + SQLite + WebTorrent/FFmpeg), uso pessoal
- [simao-sina.md](projects/simao-sina.md) — Engine de lyric videos programáticos (Remotion + React) para o músico Simão/Sina
- [comfyui.md](projects/comfyui.md) — ComfyUI portable — experimentação pessoal de geração de media (imagem/vídeo/upscale/inpaint/3D) via MCP
- [mediaval-chess.md](projects/mediaval-chess.md) — Jogo táctica em grelha + deckbuilder (tema medieval), React + Vite + TS, motor de regras custom
- [bodegas-do-campo.md](projects/bodegas-do-campo.md) — Loja de vinho DO Ribeiro (ES) em WordPress+WooCommerce+Elementor Free, build do design homepage-v2 (Docker, pipeline JSON Elementor editável)
- [datalix-vps.md](projects/datalix-vps.md) — VPS Datalix 194.62.248.50 — infraestrutura pessoal/clientes. Ubuntu, Caddy v2.11.4, SSH por chave ED25519, Cloudflare DNS. Site activo: planobracaris.rfdev.pt.
## Feedback
<!-- Populated by /feedback-joca — processed sessions live in feedback/archive/ -->
_(none pending — all processed)_

Processed 2026-06-23 (/upgrade-joca + /sync-questionnaires — 10 sessions, 7 improvements) — archived:
- 3 new skills: `agent-sdk`, `deploy-vps`, `comfy-mcp-workarounds`; frontend.md (Game UI section + triggers)
- rules/workflows-and-tooling.md (6 gotchas: Playwright fallback, Vite/Sail Windows, robocopy /XD, ComfyUI portable, SDK types, plugin SSH→HTTPS)
- commands/resume.md (git-remote arg, drift detection, iteration flow) · commands/save.md (Conceito check PASSO 2b)

Processed 2026-06-20 (/upgrade-joca + /sync-questionnaires batch — 8 sessions, 13 improvements) — archived:
- 3 new skills: `content-calendar`, `lyric-align`, `browser-automate`; 1 new command: `/build-plan`
- soul.md (sub-agent anti-fabrication) · api-design.md (parser verification) · frontend.md (shared-components-before-fanout) · deploy-cpanel.md (Node/Passenger)
- python3→python (Windows Store stub) across resume/save/init-project/CLAUDE.md · graph exclusions · stop.bat `/T` · init-project real-vs-PLANNED
- new rule `workflows-and-tooling.md` (LOW gotchas bundle)

Processed 2026-05-31 (/upgrade-joca batch) — knowledge folded into skills/memory, sessions archived:
- laravel-sail-windows → memory `laravel-sail-windows` + `laravel-specialist` (Windows+Sail) | [archived](feedback/archive/laravel-sail-windows.md)
- filament-v5-gotchas → folded into `filament` skill (v5 type gotchas + HasIcon) | [archived](feedback/archive/filament-v5-gotchas.md)
- filament-shield-testing → folded into `filament` skill (RBAC/Shield) | [archived](feedback/archive/filament-shield-testing.md)

## Commands
- `/resume` — load project context and knowledge graph
- `/save` — save session state, update memory and graph
- `/plan` — Plan Mode for architecture decisions
- `/debug` — error triage with auto-detected stack skill
- `/review-code` — code review via tester-code + Codex adversarial
- `/review-design` — UI/UX + accessibility review in parallel
- `/one-shot` — autonomous end-to-end development from PRD
- `/goal` — auto-orchestration from NL task (no PRD) → master-orchestrator loop
- `/autoplan` — full auto-reviewed plan (product → design → eng), runs pipeline at depth, final gate
- `/learn` — Brain institutional memory (event-sourced decisions/learnings + auto-recall)
- `/retro` — retrospective: window learnings → actions (manual or cron automation)
- `/ship` — code to PR: sync base → tests → diff review → version/CHANGELOG → gate → push → PR
- `/map-joca` — knowledge map (skills/agents/commands/projects + chain connections) → interactive graph.html via graphify
- `/know` — ingest content into the Knowledge Base (markitdown → summary → tags)
- `/migrate` — v1-legacy → v2.0 migration guide
- `/build-plan` — supervised phased build: plan doc → per-phase tasks → loop with test gate
- `/feedback-joca` — capture workflow issues from this session
- `/init-project` — initialize new project entry in memory
- `/install` — JOCA setup on a new machine
- `/upgrade-joca` — apply feedback + self-improvement loop
- `/update-joca` — sync with official GitHub repo (protects local components)
- `/create-skill [desc]` — create new skill via research pipeline
- `/sync-questionnaires` — audit + realign questionnaires/counters with the real skill/agent inventory
- `/status` — mostra rate limits, modelo e uso de contexto atual


## Agents

### Review & Testing
- `tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api`
- `codex-review` (Master Review: Security/Perf/Clean/Arch) · `prd-reviewer`

### Orchestration
- `master-orchestrator` (goal-seeking loop) · `task-router` (classifica 4 vias) · `self-improver` · `gemini-auditor`

### Search & Analysis
- `deep-research` · `seo-analyst` · `log-debugger` · `query-debugger`

### Generation & Media
- `img-gen-google` · `img-gen-openai` · `gemini-brain` · `watch`

### Specialists
- `payment-integration` · `dependency-auditor` · `design-system-audit`
- `skill-evaluator` · `skill-improver`

### Backend (Laravel)
- `laravel-refactor` (dead code/complexity/Larastan/scale) · `filament-builder` (scaffold resource) · `security-review`
- `tech-debt-auditor` (mede ganho) · `pr-repair` (repara PR até verde) · `deploy-executor` (corre+verifica deploy)

### Autonomia & Pessoal (FUTUROS)
- `knowledge-ingest` (/know) · `automation-builder` (Fase 3) · `personal-comms` (email/calendário, Fase 2/3) · `a11y-fixer` (aplica fixes WCAG)

## Tools
- [mcps.md](tools/mcps.md) — MCP servers ligados (markitdown, playwright, comfy) + setup markitdown para /know

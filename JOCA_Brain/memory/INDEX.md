# JOCA Memory Index

## Core
- [soul.md](soul.md) — Personality engine: drives, decision filters, motivational states, user alignment. Foundation for all agents.

## Workflows (`.claude/workflows/`, correr via Workflow tool `{name: '<x>', args: {...}}`)
- `analisar-plataforma` — análise total de uma plataforma: recon → 8 lentes de auditoria em paralelo (backend/frontend/segurança/performance/código-morto/admin/produção/UX) → verificação adversarial de Critical/High → relatório em `docs/`. Args: `{ path, nome?, reportDir?, lentes?, dataISO? }`.

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
- [eurico-fertuzinhos.md](projects/eurico-fertuzinhos.md) — WEOPTIMIZE social media — img-gen com brand azul corporativo para Instagram/Facebook/LinkedIn
- [datalix-vps.md](projects/datalix-vps.md) — VPS Datalix 194.62.248.50 — infraestrutura pessoal/clientes. Ubuntu, Caddy v2.11.4, SSH por chave ED25519, Cloudflare DNS. Site activo: planobracaris.rfdev.pt.
- [royal-douro.md](projects/royal-douro.md) — Marca de vinho DOC Douro ultra-premium (cliente Luís Gonçalo) — híbrido marketing + website static (Vanilla HTML/CSS/JS + Tailwind CDN). royaldouro.com / @royaldouro.wine.
- [tcg.md](projects/tcg.md) — TCG 1v1 (duelo de cartas) tema histórico-medieval + mitologia — Unity (C#), alvo Android; motor de regras puro separado da UI
- [livro-de-elogios-geral.md](projects/livro-de-elogios-geral.md) — **Umbrella** Livro de Elogios: SaaS de elogios PT (rebuild + legacy Wireframes) + Brasil (logo/vídeo/site) + redes sociais + parceria FIZ
- [livro-de-elogios.md](projects/livro-de-elogios.md) — Plataforma (rebuild 2026): Laravel 13/PHP 8.4 + Filament v5 + React 19/Vite 8, multi-tenant multi-país
- [livro-elogios-redes-sociais.md](projects/livro-elogios-redes-sociais.md) — Pipeline mensal de conteúdo social (Posts/Stories IG+FB), Lato + ilustrações laranja+roxo, galeria leredes.rfdev.pt
- [stickers-premium.md](projects/stickers-premium.md) — Redesign de stickerspremium.com (loja vinil/decals auto, Shopify). Proposta template HTML/CSS/JS → Shopify. Conteúdo real extraído em content/
- [joca-archive-mac-2026-07-08.md](projects/joca-archive-mac-2026-07-08.md) — Registo do JOCA antigo (Mac) arquivado+apagado em 2026-07-08, substituído pelo snapshot de migração MirrasPT/JOCA-OS
## Feedback
<!-- Populated by /save (auto-extract) — processed sessions live in feedback/archive/ -->
_(none pending — all processed)_

Processed 2026-06-27 (/upgrade-joca — 10 sessions, 12 improvements) — archived:
- 2 new skills: `social-scheduler` (TryPost executor), `notion` (`ntn` wrapper)
- skills: `agent-sdk` (tools:[] pure completion) · `social-content` (Step 0 read refs + copy-fill) · `deploy-vps` (App Docker behind Caddy + 525 cert)
- rules/workflows-and-tooling.md (Windows PHP/Octane/composer, __dirname external subprocess, visual anti-fabrication, external-DB duplicate) · soul.md (git log --all before reconstruction)
- commands/resume.md (git branch -a/--all + PHP path) · commands/install.md (gws @googleworkspace/cli + auth gotchas) · scripts/cpanel.mjs (read dir/file fix, applied earlier)

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
- `/init-project` — initialize new project entry in memory
- `/install` — JOCA setup on a new machine
- `/upgrade-joca` — apply feedback + self-improvement loop
- `/update-joca` — sync with official GitHub repo (protects local components)
- `/create-skill [desc]` — create new skill via research pipeline
- `/sync-questionnaires` — audit + realign questionnaires/counters with the real skill/agent inventory
- `/status` — mostra rate limits, modelo e uso de contexto atual
- `/help-joca` — quick reference: commands, agents, skills
- `/wp-perf` — quick WordPress performance triage
- `/wp-perf-review` — WordPress performance code review (Critical/Warning/Info)


## Agents

### Review & Testing
- `tester-code` · `tester-ui-ux` · `tester-performance` · `tester-security` · `tester-api` · `tester-ratelimit`
- `codex-review` (Master Review: Security/Perf/Clean/Arch) · `prd-reviewer`

### Orchestration
- `master-orchestrator` (goal-seeking loop) · `task-router` (classifica 4 vias) · `self-improver` · `gemini-auditor`

### Search & Analysis
- `deep-research` · `seo-analyst` · `log-debugger` · `query-debugger`

### Generation & Media
- `img-gen-google` · `img-gen-openai` · `gemini-brain` · `watch` · `video-gen`

### Specialists
- `payment-integration` · `dependency-auditor` · `design-system-audit`
- `skill-evaluator` · `skill-improver`

### Backend (Laravel)
- `laravel-refactor` (dead code/complexity/Larastan/scale) · `filament-builder` (scaffold resource) · `security-review`
- `tech-debt-auditor` (mede ganho) · `pr-repair` (repara PR até verde) · `deploy-executor` (corre+verifica deploy)

### Game Dev (TCG + Unity)
- `tcg-balance-auditor` (power-budget + caça loops infinitos) · `card-catalog-sync` (cards.html ↔ motor C#) · `tcg-playtester` (self-play seeded: crashes/stalls/win-rate) · `unity-build-runner` (corre+verifica build headless, ignora exit code)
- Skills: `card-game-design` · `game-balance` · `card-art-pipeline` · `unity-gamedev` (director) · `unity-ui` (UGUI/board/animação/mobile) · `unity-build-android` (IL2CPP/AAB/keystore)

### Autonomia & Pessoal
- `knowledge-ingest` (/know) · `automation-builder` · `personal-comms` (email/calendário, Fase 2/3) · `a11y-fixer` (aplica fixes WCAG)

## Tools
- [clis.md](tools/clis.md) — inventário DEFINITIVO de CLIs externos (install + auth + usado-por); fonte de verdade p/ migrações de máquina
- [mcps.md](tools/mcps.md) — MCP servers ligados (markitdown, playwright, comfy) + setup markitdown para /know

## Knowledge
- [joca-os-macos-setup.md](knowledge/joca-os-macos-setup.md) — Correr JOCA_OS em macOS: node-pty prebuild + spawn-helper +x, launchers, portas 7491/7492, JOCA_EXTRA_ROOTS (validado 2026-07-08)

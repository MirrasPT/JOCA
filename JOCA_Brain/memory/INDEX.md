# JOCA Memory Index

## Core
- [soul.md](soul.md) — Personality engine: drives, decision filters, motivational states, user alignment. Foundation for all agents.

## Workflows (`.claude/workflows/`, correr via Workflow tool `{name: '<x>', args: {...}}`)
- `analisar-plataforma` — análise total de uma plataforma: recon → 8 lentes de auditoria em paralelo (backend/frontend/segurança/performance/código-morto/admin/produção/UX) → verificação adversarial de Critical/High → relatório em `docs/`. Args: `{ path, nome?, reportDir?, lentes?, dataISO? }`.

## Projects
<!-- Populated by /init-project — one line per project, detail lives in projects/<x>.md -->
_(none yet — run `/init-project` to add the first project)_

## Feedback
<!-- Populated by /save (auto-extract) — processed sessions live in feedback/archive/ -->
_(none yet — run `/save` at the end of a session to record feedback)_

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

### Autonomia & Pessoal
- `knowledge-ingest` (/know) · `automation-builder` · `personal-comms` (email/calendário, Fase 2/3) · `a11y-fixer` (aplica fixes WCAG)

## Tools
- [mcps.md](tools/mcps.md) — MCP servers ligados (markitdown, playwright, comfy) + setup markitdown para /know
- [clis.md](tools/clis.md) — inventário de CLIs externos (função + instalação macOS/Windows + auth interactiva); percorrido pelo /install

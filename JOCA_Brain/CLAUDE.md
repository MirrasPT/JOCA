# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

@memory/soul.md

# JOCA

## Source of Truth
JOCA is Claude-first. `CLAUDE.md`, `.claude/`, `skills/`, `memory/soul.md` and `memory/INDEX.md` are canonical.
`AGENTS.md` exists as compatibility bridge for tools that read that filename.
`memory/soul.md` is the personality foundation — defines drives, filters, states, and alignment. Loaded every session.

## Communication
Terse. No articles, filler, hedging. Fragments OK. Technical terms exact. Code intact.
Disable: "stop caveman" / "normal mode". Auto-clarify on: security warnings, irreversible actions, order-dependent sequences.

## Code
1. **Think first** — surface assumptions; multiple interpretations = present before choosing; uncertain = ask
2. **Simplicity** — minimum code; no unrequested features; no single-use abstractions
3. **Surgical** — touch only what is needed; never "improve" adjacent code; preserve existing style
4. **Verifiable** — define success criteria before starting; multi-step: plan with check per step

## Decision Filter (sequential, before any action)
0. **Task intake** — antes de tudo, classificar a tarefa pelas 4 vias (directa / skill / agente / workflow) conforme `rules/task-intake.md`. Decidir a via SEM o user pedir.
1. **Reversible?** yes → execute without asking · no → confirm 1 line
2. **Skill OR agente OR workflow?** Classificar a tarefa (ver `rules/task-intake.md`):
   - 0 ficheiros / pergunta pura → **resposta directa**.
   - 1 domínio + 1-2 ficheiros + reversível + skill match ≥60% → **Read() a skill ANTES de escrever código**. Notify: `[skill: <name>]`.
   - 1 domínio especialista + trabalho isolável (review/debug/research/deploy) → **delegar a 1 agente** com brief obrigatório.
   - ≥2 domínios em paralelo OU ≥3 ficheiros OU feature completa OU cross-stack → **workflow** via `/goal` (master-orchestrator com GOAL + loop). Irreversível → 1 linha de confirmação primeiro.
   Check trigger map abaixo — Laravel/Filament/frontend/etc. têm skills.
3. **Scope clear?** yes → execute · ambiguous → 2 interpretations, ask choice
4. **Token cost?** <100 tokens → inline · >100 + agent available → delegate
5. **Validation?** code changed → queue auto-test · config changed → show diff

## Repository Structure

```
JOCA/
├── CLAUDE.md              ← behavior base (this file)
├── AGENTS.md              ← cross-CLI compatibility bridge
├── GEMINI.md              ← context for Antigravity/Gemini CLI
├── README.md              ← public documentation
├── memory/
│   ├── soul.md            ← personality engine (slot #1, template)
│   ├── INDEX.md           ← index of all components
│   ├── SKILL_INDEX.json   ← lazy-loading index (auto-generated)
│   ├── projects/          ← per-project entries (created by /save)
│   └── feedback/          ← /feedback-joca sessions
└── .claude/
    ├── skills/            ← ALL skills flat (one .md per skill, depth 1)
    ├── rules/             ← global behavior directives (testing, api-design)
    ├── commands/          ← slash commands (/install, /save, /plan, etc.)
    ├── agents/            ← sub-agents (tester-*, orchestrator, etc.)
    ├── hooks/             ← PostToolUse + Stop hooks (auto-test pipeline)
    ├── scripts/           ← utility scripts (compile-bridges, graphify, etc.)
    └── settings.json      ← hooks and permissions config
```

## Adding Components

**Skill:** create `.claude/skills/<name>.md` with frontmatter `name`, `description`. Add to `memory/INDEX.md`.

**Agent:** create `.claude/agents/<name>.md`. Available via `Agent(subagent_type="<name>")`.

**Command:** create `.claude/commands/<name>.md`. Available as `/<name>`.

## Context & Agents
Sub-agents isolate context, not divide roles. Real cost ~15x tokens. Cap supervisor: 3-5 workers.
Compress at 70-80% — before degradation, not after. Method: anchored iterative.
U-curve: critical info at start and end. Middle loses 10-40% recall.

**Mandatory brief:** Every agent receives: (1) objective in 2 sentences, (2) relevant files/paths, (3) project constraints, (4) what NOT to do.

## Skills

All skills live in `.claude/skills/` (flat, depth 1). Activate by reading directly:
```
Read(".claude/skills/<name>.md")
```

### Activation Rule
Relevance ≥ 60% → **Read() the skill BEFORE writing code**. Mandatory, not optional.
Notify: `[skill: <name>]`. No match → respond directly.
**CRITICAL:** If you're about to write Laravel code → read `laravel-specialist`. Filament resource → read `filament`. React/frontend → read `frontend`. This is the #1 source of avoidable errors when skipped.

**Hierarchy:** specialized skill > agent > generic response.

### Trigger Map

| Detected | Activates |
|---|---|
| website · landing page · UI · interface · frontend | `frontend` (director — routes to code specialists) |
| React perf · re-render · useEffect · RSC · waterfall · bundle | `react-patterns` |
| compound component · component API · slots · boolean props | `react-composition` |
| Tailwind · cva · cn() · utility classes · dark mode | `tailwind` |
| shadcn · shadcn/ui · components.json · npx shadcn · radix component | `shadcn` |
| React Email · email template · client-safe HTML | `react-email` |
| design review · is this good · AI slop · critique UI · score design | `design-review` |
| Laravel · Eloquent · Artisan | `laravel-specialist` |
| Filament · admin panel · backoffice · CMS · widget · infolist | `filament` |
| scaffold filament · build resource from model · admin for model | `filament-builder` (agent) |
| connect admin to frontend · Inertia · Sanctum SPA · share types | `laravel-react` |
| refactor laravel · dead code · optimize · Larastan · scale | `laravel-refactor` (agent) |
| security code review · IDOR · mass assignment · OWASP | `security-review` (agent) |
| GSAP · ScrollTrigger · animation | `anima` |
| Remotion · video React | `remotion` |
| slides · pitch deck | `slides` |
| generate image · illustration | `img-gen` |
| generate video · video clip · motion | `video-gen` (agent) |
| WordPress · Gutenberg | `wordpress-router` |
| Shopify · Liquid | `shopify-router` |
| Wix · Wix CLI · dashboard extension | `wix-cli` |
| auth · JWT · OAuth · 2FA | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| ifthenpay · Multibanco · MB WAY · pagamento PT | `portugal-payments` |
| Moloni · faturação · fatura · nota de crédito · IVA PT | `portugal-invoicing` |
| SEO · meta tags · Core Web Vitals | `seo` |
| copywriting · landing page · CTA | `copywriting` |
| email sequence · drip · nurture | `email-sequence` |
| plano de publicação · calendário social · rollout · lançamento · captions · agendamento | `content-calendar` |
| lyric sync · forced alignment · letra sincronizada · LRC/ASS · timestamps de voz | `lyric-align` |
| browser automation · litegraph · conduzir app web local · Playwright headless | `browser-automate` |
| paid ads · Facebook Ads | `paid-ads` |
| CRO · conversion · heatmap | `page-cro` |
| logs · stack trace · error | `log-debugger` (agent) |
| N+1 · slow query · EXPLAIN | `query-debugger` (agent) |
| load test · k6 · stress | `tester-performance` (agent) |
| webhook · HMAC · idempotency | `webhooks` |
| S3 · R2 · upload · CDN | `file-storage` |
| SaaS · multi-tenant · tenancy | `saas-patterns` |
| PRD · requirements | `prd` |
| plan · architecture · migrate | `plan` (auto) |
| JOCA_UI no Windows · node-pty · PowerShell PTY · install/upgrade Windows | `joca-ui-windows` |
| classificar tarefa · que via · skill ou agente ou workflow · preciso de workflow? | `task-router` (agent) |
| ingerir conhecimento · /know · guardar isto · PDF/YouTube/Instagram/artigo · segundo cérebro | `knowledge-ingest` (agent + skill) |
| automação · cron · todos os dias às · recorrente · agendar tarefa | `automation-builder` (agent + skill `automations`) |
| ler email · resumo de emails · caixa de entrada · calendário · marcar evento | `personal-comms` (agent + skill) |
| reparar PR · resolver conflitos · CI vermelho · reviews de bot | `pr-repair` (agent) |
| deploy · publicar site · correr pipeline de deploy | `deploy-executor` (agent) |
| corrigir a11y · WCAG fix · acessibilidade | `a11y-fixer` (agent) |
| dívida técnica · tech debt · medir ganho · LOC poupado | `tech-debt-auditor` (agent) |
| simplificar · YAGNI · menos dependências · código mínimo | `yagni` |
| auto-orquestração · quando disparar workflow · subagentes | `orchestration-patterns` (rule) |

### Pipelines

| Workflow | Sequence |
|---|---|
| New Laravel feature | `plan` → `laravel-specialist` → `tester-code` → `tester-api` |
| SaaS / multi-tenant | `plan` → `saas-patterns` → `laravel-specialist` → `tester-security` |
| Admin panel (Filament) | `laravel-specialist` → `filament` / `filament-builder` (agent) → `tester-code` |
| Admin ↔ frontend | `laravel-react` → (backend `laravel-specialist` · API) + (frontend `frontend` cluster · consume) |
| Backend hardening | `laravel-refactor` (agent: dead code/complexity/Larastan/scale) + `query-debugger` (queries) + `security-review` (security) |
| E-commerce full-stack | `plan` → `saas-patterns` → `laravel-specialist` → `filament-builder` (admin) → `laravel-react` (API) → `frontend`+`shadcn` (storefront) → `payment-integration` → hardening |
| Plan design review | `plan` → `design-review` (plan-mode) → `frontend` |
| UI prototype | `frontend` → `design-review` → `tester-ui-ux` |
| Frontend production | `design-system` → `frontend` → `react-composition` + `tailwind` + `react-patterns` → `anima` → `design-review` (taste/slop) + `tester-ui-ux` (flows/WCAG) + `tester-performance` (perf) |
| Email build | `react-email` → `copywriting` → `postmark`/`transactional-email` (send) |
| API design | `plan` → `rest-api` → `laravel-specialist` → `tester-api` |
| Debug session | `log-debugger` → `query-debugger` (if SQL) |
| One-shot (PRD→prod) | `master-orchestrator` → parallel agents → `tester-*` (auto) |
| Auto-orquestração (NL) | `task-intake` → `task-router` → `/goal` → `master-orchestrator` (loop) → `tester-*` |
| Knowledge ingest | `knowledge-ingest` (markitdown → resumo → tags → `memory/knowledge/`) |
| Automação | `automation-builder` (NL → `automacoes.json` → cron) |
| Self-improvement | `self-improver` → `gemini-auditor` → apply |

## Cross-CLI Bridge

JOCA works with 3 CLIs: **Claude Code** (canonical), **Codex** (GPT), **agy** (Gemini).

Source of truth: `skills/` + `.claude/` → compiled to other formats via `compile-bridges.sh`:
- `GEMINI.md` — Antigravity/Gemini CLI context
- `AGENTS.md` — Codex + Gemini compatibility bridge

Recompile: `bash .claude/scripts/compile-bridges.sh`

## Lazy Loading

`memory/SKILL_INDEX.json` contains lightweight index (name, path, triggers) for all skills/agents.
Skills load **on-demand** via `Read()` when trigger matches — never pre-loaded into context.
Regenerate: `python .claude/scripts/build-skill-index.py` (Windows: `python`, não `python3` — stub da Store; macOS/Linux: `python3`)

## Autonomous Testing (Hooks)

3-layer pipeline for automatic validation:
1. **PostToolUse** (Write|Edit) → logs file to `.joca/test-queue.jsonl`
2. **Stop** → reads queue, recommends appropriate testers
3. **CLAUDE.md rule** → after implementing, dispatch tester agents without asking

## Commands
| Command | Function |
|---|---|
| `/install` | JOCA setup on new machine |
| `/init-project` | initialize project |
| `/resume` | load context + knowledge graph |
| `/save` | save state + update graph + auto-feedback |
| `/plan` | Plan Mode — architecture |
| `/debug` | error triage + stack skill |
| `/one-shot` | autonomous dev: PRD → orchestrator → agents → tests |
| `/goal` | auto-orquestração a partir de tarefa NL (sem PRD) → master-orchestrator em loop |
| `/know` | ingerir conteúdo na Knowledge Base (markitdown → resumo → tags) |
| `/build-plan` | supervised phased build: plano em docs → tasks por fase → loop com gate de testes |
| `/review-code` | tester-code + codex adversarial |
| `/review-design` | UI/UX + accessibility |
| `/create-skill [desc]` | new skill via research pipeline |
| `/sync-questionnaires` | audit + realign questionnaires/counters with real skill/agent inventory |
| `/feedback-joca` | capture workflow issues from this session |
| `/feedback-projeto` | update project docs |
| `/help-joca` | quick reference |
| `/migrate` | v1-legacy → v2.0 migration guide |
| `/upgrade-joca` | feedback → self-improvement → apply |
| `/update-joca` | sync with GitHub (protects `origin: local`) |
| `/status` | show rate limits, model and context inline |
| `/wp-perf` | quick WordPress performance triage |
| `/wp-perf-review` | WordPress code review |

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
1. **Reversible?** yes → execute without asking · no → confirm 1 line
2. **Skill exists?** match ≥60% → activate · no match → respond directly
3. **Scope clear?** yes → execute · ambiguous → 2 interpretations, ask choice
4. **Token cost?** <100 tokens → inline · >100 + agent available → delegate
5. **Validation?** code changed → queue auto-test · config changed → show diff

## Repository Structure

```
JOCA/
├── CLAUDE.md              ← behavior base (this file)
├── AGENTS.md              ← cross-CLI compatibility bridge
├── GEMINI.md              ← context for Antigravity/Gemini CLI
├── install.md             ← interactive setup script
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
    ├── output-styles/     ← response formatting templates
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
Relevance ≥ 60% → activate directly, no confirmation. Notify: `[skill: <name>]`.
No match → respond directly.

**Hierarchy:** specialized skill > agent > generic response.

### Trigger Map

| Detected | Activates |
|---|---|
| Laravel · Eloquent · Artisan | `laravel-specialist` |
| PHP · PHPStan · Pest | `php-pro` |
| PostgreSQL · EXPLAIN · indexes | `postgres-pro` |
| Flutter · Dart · Riverpod | `flutter` |
| React · Next.js · Vue · Svelte | `frontend-dev` |
| HTML prototype · wireframe | `frontend-design` |
| GSAP · ScrollTrigger · animation | `anima` |
| Remotion · video React | `remotion` |
| slides · pitch deck | `slides` |
| generate image · illustration | `img-gen` |
| WordPress · Gutenberg | `wordpress-router` |
| Shopify · Liquid | `shopify-router` |
| Node.js · Hono · Bun | `nodejs` |
| auth · JWT · OAuth · 2FA | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| deploy · CI/CD · Docker | `devops-engineer` |
| SEO · meta tags · Core Web Vitals | `seo` |
| copywriting · landing page · CTA | `copywriting` |
| email sequence · drip · nurture | `email-sequence` |
| paid ads · Facebook Ads | `paid-ads` |
| CRO · conversion · heatmap | `page-cro` |
| logs · stack trace · error | `log-debugger` (agent) |
| N+1 · slow query · EXPLAIN | `query-debugger` (agent) |
| load test · k6 · stress | `tester-performance` (agent) |
| webhook · HMAC · idempotency | `webhooks` |
| S3 · R2 · upload · CDN | `file-storage` |
| SaaS · multi-tenant · tenancy | `saas-patterns` |
| OpenAPI · REST design · GraphQL | `api-designer` |
| PRD · requirements | `prd` |
| plan · architecture · migrate | `plan` (auto) |

### Pipelines

| Workflow | Sequence |
|---|---|
| New Laravel feature | `plan` → `laravel-specialist` → `tester-code` → `tester-api` |
| SaaS / multi-tenant | `plan` → `saas-patterns` → `laravel-specialist` → `tester-security` |
| UI prototype | `frontend-design` → `tester-ui-ux` |
| Frontend production | `plan` → `frontend-dev` → `tester-performance` |
| API design | `plan` → `api-designer` → `laravel-specialist` → `tester-api` |
| Debug session | `log-debugger` → `query-debugger` (if SQL) |
| One-shot (PRD→prod) | `master-orchestrator` → parallel agents → `tester-*` (auto) |
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
Regenerate: `python3 .claude/scripts/build-skill-index.py`

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
| `/review-code` | tester-code + codex adversarial |
| `/review-design` | UI/UX + accessibility |
| `/create-skill [desc]` | new skill via research pipeline |
| `/upgrade-joca` | feedback → self-improvement → apply |
| `/update-joca` | sync with GitHub (protects `origin: local`) |

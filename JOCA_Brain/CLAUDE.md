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
   - ≥2 domínios em paralelo OU ≥3 ficheiros OU feature completa OU cross-stack → **workflow** via `/goal` (master-orchestrator com GOAL + loop). Se casar uma **pipeline nomeada** → o **auto-runner** corre-a a fundo (`rules/pipelines.md`): cada passo a fundo, auto-decide reversíveis, gate só em irreversível, encadeia via `chain:` (`rules/chaining.md`). Irreversível → 1 linha de confirmação primeiro.
   Check trigger map abaixo — Laravel/Filament/frontend/etc. têm skills.
3. **Scope clear?** yes → execute · ambiguous → 2 interpretations, ask choice
4. **Token cost?** <100 tokens → inline · >100 + agent available → delegate
5. **Validation?** code changed → queue auto-test · config changed → show diff

## Repository Structure
`memory/` — `soul.md` (personality, `@import`ed) · `INDEX.md`+`SKILL_INDEX.json` (component index) · `projects/`+`feedback/` (per-project, by `/save`).
`.claude/` — `skills/` (flat, depth 1) · `rules/` (global directives — task-intake/pipelines/chaining/orchestration/testing/api-design) · `commands/` · `agents/` · `hooks/` (auto-test) · `scripts/` · `settings.json`.
Add a **skill** = `.claude/skills/<name>.md` (frontmatter `name`+`description`, add to `INDEX.md`) · **agent** = `.claude/agents/<name>.md` (`Agent(subagent_type=…)`) · **command** = `.claude/commands/<name>.md` (`/<name>`).

## Context & Agents
Sub-agents isolate context, not divide roles. Real cost ~15x tokens. Cap supervisor 3-5 workers. Compress at 70-80% (anchored iterative). U-curve: critical info at start+end, middle loses 10-40% recall.
**Mandatory brief:** every agent gets (1) objective in 2 sentences, (2) relevant files/paths, (3) project constraints, (4) what NOT to do.

## Skills
Flat in `.claude/skills/`. Activate via `Read(".claude/skills/<name>.md")`. Lazy: `SKILL_INDEX.json` holds the light index (name/path/triggers); skills load on-demand, never pre-loaded. Regenerate: `python .claude/scripts/build-skill-index.py` (Windows: `python`, não `python3`).

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
| WooCommerce + Elementor · `_elementor_data` · HFE · storefront editável · content-product.php | `woocommerce-elementor` |
| Shopify · Liquid | `shopify-router` |
| Wix · Wix CLI · dashboard extension | `wix-cli` |
| auth · JWT · OAuth · 2FA | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| ifthenpay · Multibanco · MB WAY · pagamento PT | `portugal-payments` |
| Moloni · faturação · fatura · nota de crédito · IVA PT | `portugal-invoicing` |
| SEO · meta tags · Core Web Vitals | `seo` |
| copywriting · landing page · CTA | `copywriting` |
| AI slop · soa a AI · escrito por AI · limpar a escrita · polir copy · de-slop | `stop-slop` |
| email sequence · drip · nurture | `email-sequence` |
| plano de publicação · calendário social · rollout · lançamento · captions · agendamento | `content-calendar` |
| agendar/publicar post · publicar nas redes · TryPost · carrossel IG · publicar TikTok · executar campanha social | `social-scheduler` |
| Notion · ntn · tarefa Notion · base de dados/data source Notion · workspace de clientes | `notion` |
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
| claude-agent-sdk · agent sdk · programmatic claude · subscription claude · zero-cost claude · JOCA_OS backend · createSdkMcpServer | `agent-sdk` |
| enqueue_workflow not running · comfyui mcp bug · workflow crashes via MCP · start_comfyui fails · comfy plugin | `comfy-mcp-workarounds` |
| JOCA_OS no Windows · node-pty · PowerShell PTY · install/upgrade Windows | `joca-os-windows` |
| classificar tarefa · que via · skill ou agente ou workflow · preciso de workflow? | `task-router` (agent) |
| freeze · trancar edições · lock scope · só editar esta pasta | `freeze` (guard-rail) |
| careful · avisa antes de apagar · modo cauteloso · destrutivo | `careful` (guard-rail) |
| guard · modo seguro · segurança máxima · lock it down | `guard` (guard-rail) |
| tdd · test first · testes primeiro · red green · força testes | `tdd` (guard-rail) |
| unfreeze · destrancar · remover lock · desligar guard/tdd | `unfreeze` (guard-rail) |
| pack codebase · empacotar repo · repo num ficheiro · contexto para agente/gemini · repomix | `context-pack` |
| encadear skills · próximo passo · auto-delegação · auto-runner · pipeline corre sozinha | `rules/chaining.md` + `rules/pipelines.md` |
| registar decisão · guardar aprendizagem · o que decidimos · didn't we fix this | `/learn` (Brain log) |
| plano completo revisto · autoplan · planear a sério | `/autoplan` |
| retro · retrospectiva · o que correu bem/mal · revisão semanal | `/retro` |
| explorar variantes de design · opções de design · brainstorm visual · não gosto do look | `design-shotgun` |
| codificar o design · mockup → HTML · implementar este design · fazer o mockup real | `design-html` |
| ship · push para main · abrir PR · está pronto envia | `/ship` |
| cso · auditoria de segurança · threat model · STRIDE · OWASP review | `cso` |
| mapear conhecimento · como tudo se liga · grafo de skills/agentes/projectos · mapa do JOCA | `/map-joca` |
| o que as pessoas dizem · últimos 30 dias · sinal social · recon antes de reunião · trending real · Reddit/X/YouTube | `/last30days` (plugin externo) |
| ingerir conhecimento · /know · guardar isto · PDF/YouTube/Instagram/artigo · segundo cérebro | `knowledge-ingest` (agent + skill) |
| automação · cron · todos os dias às · recorrente · agendar tarefa | `automation-builder` (agent + skill `automations`) |
| ler email · resumo de emails · caixa de entrada · calendário · marcar evento | `personal-comms` (agent + skill) |
| reparar PR · resolver conflitos · CI vermelho · reviews de bot | `pr-repair` (agent) |
| deploy VPS · VPS setup · Caddy · SSH key VPS · Cloudflare DNS API · scp site · bootstrap SSH · publicar VPS | `deploy-vps` |
| cPanel · UAPI · addon domain · gerir hosting · conta de email cPanel · zona DNS cPanel · criar subdomínio | `cpanel` |
| media stack · *arr · Jellyfin · Jellyseerr · Sonarr/Radarr/Prowlarr · qBittorrent · self-hosted media | `selfhosted-arr` |
| deploy · publicar site · correr pipeline de deploy | `deploy-executor` (agent) |
| corrigir a11y · WCAG fix · acessibilidade | `a11y-fixer` (agent) |
| dívida técnica · tech debt · medir ganho · LOC poupado | `tech-debt-auditor` (agent) |
| simplificar · YAGNI · menos dependências · código mínimo | `yagni` |
| auto-orquestração · quando disparar workflow · subagentes | `orchestration-patterns` (rule) |

### Pipelines
Sequências nomeadas cross-stack (Feature Laravel, Frontend produção, E-commerce full-stack, Debug, Ship, CSO, etc.) correm pelo **auto-runner** — o JOCA conduz a sequência inteira sozinho (cada passo a fundo, auto-decide reversíveis, gate só em irreversível, encadeia via `chain:`). **Catálogo completo + princípios de auto-decisão: `rules/pipelines.md`** (não duplicar aqui).

## Cross-CLI Bridge
Claude Code (canonical) + Codex (GPT) + agy (Gemini). Fonte = `skills/`+`.claude/` → `GEMINI.md`/`AGENTS.md` compilados via `bash .claude/scripts/compile-bridges.sh`.

## Autonomous Testing (Hooks)
PostToolUse (Write|Edit) → fila `.joca/test-queue.jsonl` → Stop lê e recomenda testers → após implementar, despachar testers sem perguntar.

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
| `/autoplan` | plano completo auto-revisto (produto → design → eng) — corre a pipeline a fundo, gate final |
| `/learn` | memória institucional do Brain (decisões/aprendizagens event-sourced + recall) |
| `/retro` | retrospectiva: aprendizagens da janela → acções (manual ou automação cron) |
| `/ship` | levar código a PR: sync → testes → review diff → version/CHANGELOG → gate → push → PR |
| `/map-joca` | mapa de conhecimento (skills/agentes/comandos/projectos + chains) → graph.html interactivo via graphify |
| `/know` | ingerir conteúdo na Knowledge Base (markitdown → resumo → tags) |
| `/build-plan` | supervised phased build: plano em docs → tasks por fase → loop com gate de testes |
| `/review-code` | tester-code + codex adversarial |
| `/review-design` | UI/UX + accessibility |
| `/create-skill [desc]` | new skill via research pipeline |
| `/sync-questionnaires` | audit + realign questionnaires/counters with real skill/agent inventory |
| `/help-joca` | quick reference |
| `/migrate` | v1-legacy → v2.0 migration guide |
| `/upgrade-joca` | feedback → self-improvement → apply |
| `/update-joca` | sync with GitHub (protects `origin: local`) |
| `/status` | show rate limits, model and context inline |
| `/wp-perf` | quick WordPress performance triage |
| `/wp-perf-review` | WordPress code review |

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
0. **Task intake** — before anything else, classify the task into the 4 routes (direct / skill / agent / workflow) per `rules/task-intake.md`. Decide the route WITHOUT the user asking.
1. **Reversible?** yes → execute without asking · no → confirm 1 line
2. **Skill OR agent OR workflow?** Classify the task (see `rules/task-intake.md`):
   - 0 files / pure question → **direct answer**.
   - 1 domain + **1 file** + reversible + skill match ≥60% → **Read() the skill BEFORE writing code**. Notify: `[skill: <name>]`.
   - 1 specialist domain + isolable work (review/debug/research/deploy) **or 2 isolated files** → **delegate to 1 agent** with a mandatory brief.
   - ≥2 domains in parallel OR ≥2 parallelizable files OR a complete feature OR cross-stack → **workflow** via `/goal` (**system default**: when in doubt, delegate — the main loop orchestrates, the agents write the code) (master-orchestrator with GOAL + loop). If it matches a **named pipeline** → the **auto-runner** runs it in depth (`rules/pipelines.md`): each step in depth, auto-decides the reversible ones, gate only on irreversible, chains via `chain:` (`rules/chaining.md`). Irreversible → 1 line of confirmation first.
   Check the trigger map below — Laravel/Filament/frontend/etc. have skills.
2b. **Plan?** Route D · irreversible action · ≥3 files · new feature → **visible plan BEFORE** the first `Write`/`Agent()` (table in `rules/task-intake.md` → "Plan before executing"). Reversible route A/B → does not plan, acts.
   ⚠ **Two different thresholds, deliberately:** fan-out from **≥2 parallelizable files**; a written plan only from **≥3 files** (or irreversible/new feature). A 2-stream fan-out is delegated without writing a plan — the file boundary per agent goes in the brief. Source of truth for the numbers: `rules/task-intake.md` §Thresholds + §Plan before executing.
2c. **Project doctrine** — in any project (not only the `/start` ones): issue before code · design before UI · tests in a separate session · `PROGRESS.md` + `docs/DECISIONS.md` kept up to date. Table in `rules/pipelines.md` §Project doctrine.
3. **Scope clear?** yes → execute · ambiguous → 2 interpretations, ask choice
4. **Token cost?** <100 tokens → inline · >100 + agent available → delegate
5. **Validation?** code changed → queue auto-test · config changed → show diff

## Repository Structure
`memory/` — `soul.md` (personality, `@import`ed) · `INDEX.md`+`SKILL_INDEX.json` (component index) · `projects/`+`feedback/` (per-project, by `/save`).
`.claude/` — `skills/` (flat, depth 1) · `rules/` (global directives — task-intake/pipelines/chaining/orchestration/default-stack) · `reference/` (on-demand `Read()`) · `commands/` · `agents/` · `hooks/` (auto-test) · `scripts/` · `settings.json`.
⚠ `.claude/` is **canonical**; `.agents/` and `.codex/` are **compiled mirrors** that publish all the same —
any edit to skills/agents requires `bash .claude/scripts/compile-bridges.sh`, otherwise they diverge
silently (a real host/user/SSH key already survived in a mirror after being cleaned in the source).
On-demand reference: designing endpoints / API contracts → `.claude/reference/api-design.md` · multi-agent workflow, Windows scripts touching credentials/binaries/paths, or an environment gotcha → `.claude/reference/workflows-and-tooling.md` · adding a rule → `.claude/reference/rules-README.md`.
Add a **skill** = `.claude/skills/<name>.md` (frontmatter `name`+`description`, add to `INDEX.md`) · **agent** = `.claude/agents/<name>.md` (`Agent(subagent_type=…)`) · **command** = `.claude/commands/<name>.md` (`/<name>`).

## Context & Agents
Sub-agents isolate context, not divide roles. Real cost ~15x tokens. Cap supervisor 3-5 workers. Compress at 70-80% (anchored iterative). U-curve: critical info at start+end, middle loses 10-40% recall.
**Mandatory brief:** every agent gets (1) objective in 2 sentences, (2) relevant files/paths, (3) project constraints, (4) what NOT to do.

## Skills
Flat in `.claude/skills/`. Activate via `Read(".claude/skills/<name>.md")`. Lazy: `SKILL_INDEX.json` holds the light index (name/path/triggers); skills load on-demand, never pre-loaded. Regenerate: `python .claude/scripts/build-skill-index.py` (Windows: `python`, not `python3`).

### Inline skill OR execution agent
Every **execution** skill has a twin agent in `.claude/agents/<skill>-agent.md` (65). The agent reads the skill as Step 0 — same doctrine, its own context. For the same work:
- **1 trivial part** → `Read()` the skill, do it inline (cheap, immediate).
- **≥2 independent parts** → dispatch `<skill>-agent` for each, **in the same turn** (real parallelism, ~15x tokens each, the main loop stays free).

Choose deliberately: serializing parallelizable work costs time on every request; dispatching an agent to change a color costs 15x for nothing. Value gate + pitfalls in `rules/task-intake.md`. Regenerate the agents: `node .claude/scripts/skill-agents.mjs` (the curated list of execution skills lives at the top of the script).

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
| design system · create a design system from scratch · visual foundation · visual contract | `design-system` (router — brand-guidelines → design-tokens → component-system) |
| brand guidelines · DESIGN.md · BRAND.md · visual identity · brand palette · tone of voice | `brand-guidelines` |
| design tokens · tokens.css · DTCG · Style Dictionary · spacing scale · z-index | `design-tokens` |
| component inventory · component spec · component states · component anatomy · UI kit | `component-system` |
| responsive · PWA · bottom sheet · thumb zone · breakpoint · swipe gesture | `mobile` |
| Laravel · Eloquent · Artisan | `laravel-specialist` |
| Filament · admin panel · backoffice · CMS · widget · infolist | `filament` |
| scaffold filament · build resource from model · admin for model | `filament-builder` (agent) |
| connect admin to frontend · Inertia · Sanctum SPA · share types | `laravel-react` |
| refactor laravel · dead code · optimize · Larastan · scale | `laravel-refactor` (agent) |
| security code review · IDOR · mass assignment · OWASP | `security-review` (agent) |
| GSAP · ScrollTrigger · animation | `anima` |
| Remotion · React video | `remotion` |
| which tool for this video · AI avatar · talking head · HeyGen · Veo/Runway/Kling · video production | `video` (router) |
| HyperFrames · video in HTML · video composition · title card · caption sync · animated overlay | `hyperframes` |
| Lottie · lottie.json · animate SVG · animated icon · trim path · loading animation | `lottie-animator` |
| Blender · 3D · .blend · bpy · mesh · 3D model · 3D render | `blender` (director — CLI headless, routes to scripting/render) |
| bpy · Blender script · import/export 3D · glTF/GLB/FBX/OBJ/STL/USD · batch .blend · modifiers | `blender-scripting` |
| 3D render · Cycles · EEVEE · turntable · PBR material · light a 3D scene · 3D camera | `blender-render` |
| Meshy · generate a 3D model with AI · text-to-3D · image-to-3D · retexture · remesh · auto-rig | `meshy` (director — official MCP, routes to meshy-3d-print) |
| printability · watertight · non-manifold · repair a mesh · multicolor 3MF · slicer · slice | `meshy-3d-print` |
| slides · pitch deck | `slides` |
| roll-up · flyer · leaflet · poster · trifold · brochure · print material · bleed | `graphic-design` |
| generate image · illustration | `img-gen` |
| generate video · voiceover · TTS · music · SFX · vectorize · raster→SVG · upscale · remove background | `picsart` (gen-ai CLI) |
| generate video · video clip · motion | `video-gen` (agent — ⚠ `agy` does NOT generate video; routes to gen-ai/ComfyUI/HyperFrames) |
| upscale · enlarge an image · increase resolution · restore an image · image for print · ESRGAN | `image-upscale` |
| site capture · clean screenshot · full-page screenshot · visual QA · extract an image from a print/mockup | `site-capture` |
| html to pdf · export PDF · 1-page PDF · print-to-pdf · print-CSS A4 | `html-to-pdf` |
| publish a public repo · open source release · scrub before publishing · what goes out in the push · sanitize the repo · push to a client repo · hand code over to a third party · first push to a new remote | `public-release-audit` |
| WordPress · WP · Gutenberg · WP plugin · WP theme · block theme · WP-CLI · WooCommerce · Playground | **`wp-index`** (single entry point — classifies and routes to `wp-project-triage` · `wp-plugin-development` · `wp-block-development` · `wp-block-themes` · `wp-interactivity-api` · `wp-rest-api` · `wp-abilities-api` · `wp-wpcli-and-ops` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `blueprint` · `wp-plugin-directory-guidelines` · `wpds` · `woocommerce-elementor`; `wordpress-router` classifies the repo) |
| WooCommerce + Elementor · `_elementor_data` · HFE · editable storefront · content-product.php | `woocommerce-elementor` |
| Shopify · Liquid · Dawn · theme.liquid · Shopify app · audit a store | **`shopify-router`** (single entry point — `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`) |
| Wix · Wix CLI · dashboard extension | `wix-cli` |
| auth · JWT · OAuth · 2FA | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| ifthenpay · Multibanco · MB WAY · PT payment | `portugal-payments` |
| Moloni · invoicing · invoice · credit note · PT VAT | `portugal-invoicing` |
| GDPR · cookie consent · cookie banner · privacy policy · CNPD · right to erasure · analytics without consent | `gdpr-compliance` |
| SEO · meta tags · Core Web Vitals | `seo` |
| local SEO · Google Business Profile · GBP · map pack · NAP · local citations · near me | `seo-local` |
| copywriting · landing page · CTA | `copywriting` |
| AI slop · sounds like AI · written by AI · clean up the writing · polish copy · de-slop | `stop-slop` |
| translate to PT-PT · Portuguese from Portugal · localize UI · tu/você register · review the Portuguese | `pt-pt-translator` |
| email sequence · drip · nurture | `email-sequence` |
| publishing plan · social calendar · rollout · launch · captions · scheduling | `content-calendar` |
| schedule/publish a post · post to social · TryPost · IG carousel · publish to TikTok · run a social campaign | `social-scheduler` |
| marketing · marketing plan · how to grow · more clients · where do I start with marketing · marketing funnel | `marketing` (router — positioning/landing/leads/email/ads/SEO/social/CRO) |
| positioning · value proposition · ICP · who is this for · key message · differentiation | `brand-positioning` |
| build a landing page · squeeze page · opt-in page · capture page · webinar page | `landing-page` |
| lead magnet · grow the email list · opt-in form · capture popup · content upgrade | `lead-capture` |
| Product Hunt · go-to-market · beta launch · feature announcement · launch plan | `launch-strategy` |
| competitor profile · analyze the competition · competitive intelligence · who are my competitors | `competitor-profiling` |
| content strategy · what to write about · topic clusters · content pillars · blog ideas | `content-strategy` |
| LinkedIn post · Twitter/X thread · Reels · TikTok · post hook · content repurposing | `social-content` |
| Notion · ntn · Notion task · Notion database/data source · client workspace | `notion` |
| lyric sync · forced alignment · synced lyrics · LRC/ASS · voice timestamps | `lyric-align` |
| browser automation · litegraph · drive a local web app · headless Playwright | `browser-automate` |
| paid ads · Facebook Ads | `paid-ads` |
| CRO · conversion · heatmap | `page-cro` |
| tracking plan · GA4 · GTM · conversion events · UTM · audit tracking | `analytics-tracking` |
| gtag.js · GA4 Data API · runReport · DebugView/Realtime · consent mode · how many visits the site had | `google-analytics` |
| Clarity · session recording · rage click · dead click · scroll depth | `microsoft-clarity` |
| A/B test · split test · variant · statistical significance · sample size | `ab-test-setup` |
| logs · stack trace · error | `log-debugger` (agent) |
| N+1 · slow query · EXPLAIN | `query-debugger` (agent) |
| load test · k6 · stress | `tester-performance` (agent) |
| webhook · HMAC · idempotency | `webhooks` |
| S3 · R2 · upload · CDN | `file-storage` |
| SaaS · multi-tenant · tenancy | `saas-patterns` |
| design endpoints · OpenAPI/Swagger · RFC 9457 · version an API · API pagination · API contract | `rest-api` |
| composite index · covering index · SARGable · InnoDB · utf8mb4 · deadlock · design a MySQL schema | `mysql` |
| Cache::remember · cache invalidation · Cache-Control · ETag · stale-while-revalidate · TTL | `caching` |
| Meilisearch · Typesense · Algolia · full-text search · faceted search · typo tolerance | `search` |
| which queue to use · compare BullMQ vs Horizon · background jobs (choosing the stack) | `queues` (router — bullmq · horizon) |
| BullMQ · Redis queue in Node · Node worker · dead letter queue · delayed/scheduled job (Node) | `bullmq` |
| Horizon · ShouldQueue · supervisor · failed jobs · job chaining/batching · Laravel queue | `horizon` |
| backup · disaster recovery · failover · read replica · RTO/RPO · zero-downtime migration · maintenance mode | `availability` |
| Reverb · Laravel Echo · WebSocket · broadcasting · ShouldBroadcast · presence channel | `reverb-realtime` |
| Telescope · Debugbar · Ignition · Ray · Pail · Clockwork · see the queries in the browser | `error-tracking-dev` |
| Sentry · Flare · structured JSON logging · correlation ID · health check · error alert | `error-tracking-prod` |
| OWASP Top 10 · XSS · CSRF · SQL injection · CSP/HSTS · hardening · is it secure? | `security` (skill — deep code review → `security-review` agent; full audit → `cso`) |
| which transactional email provider · SPF/DKIM/DMARC · bounce handling · deliverability | `transactional-email` (router — postmark) |
| Postmark · message stream · bounce webhook · Postmark template · suppress a hard bounce | `postmark` |
| tests · unit/integration/E2E · coverage · flaky test · QA · quality gate · test strategy | `test-master` |
| PRD · requirements | `prd` |
| project planning · which document to do first · project documentation · kick off · before writing code | `planning` (router — prd · tech-spec · adr · c4-diagram · task-breakdown · rfc · html-review) |
| ADR · architecture decision · why we chose X · record this decision · alternatives considered | `adr` |
| RFC · change proposal · breaking change · cross-cutting · affects multiple modules | `rfc` |
| C4 · context/container/component diagram · Mermaid diagram · how the system is structured | `c4-diagram` |
| TECH_SPEC.md · technical specification · data model · component breakdown · sequence diagram | `tech-spec` |
| TASKS.md · break into tasks · epics · stories · estimation · sprint planning · RICE | `task-breakdown` |
| generate HTML from the PRD/plan · document for review · plan preview · render markdown | `html-review` |
| /start · new project · start from scratch · create a new product · connect a project to JOCA | `start` (interview via forms + PRD + house stack + design direction; single entry point for any project, new or existing). ⚠ The **way of working** it installs is global and does not depend on this command — `rules/pipelines.md` §Project doctrine |
| run the project · build the project · move on to execution | `execute-project` (foundation → design, 2 routes → gate → development in waves) |
| new issue · acceptance criteria · open an issue · backlog | `new-issue` |
| plan waves · organize the backlog · milestones · where do I start | `plan-waves` |
| design a screen · mockup · design brief · new screen | `prepare-design` (delivers the mockup as an Artifact) |
| validate a mockup · does the design match · can I implement this screen | `validate-design` |
| write the issue's tests · tests from the criteria | `write-tests` (session separate from the implementation) |
| plan · architecture · migrate · new feature · ≥3 files · migration/deploy/delete | `plan` (auto — gate in `rules/task-intake.md`) |
| claude-agent-sdk · agent sdk · programmatic claude · subscription claude · zero-cost claude · JOCA_OS backend · createSdkMcpServer | `agent-sdk` |
| enqueue_workflow not running · comfyui mcp bug · workflow crashes via MCP · start_comfyui fails · comfy plugin | `comfy-mcp-workarounds` |
| JOCA_OS on Windows · node-pty · PowerShell PTY · install/upgrade Windows | `joca-os-windows` |
| comment on the task · close the task · create a task · move the task · open a terminal · talk to the other terminal | `joca-terminal` |
| high token consumption · another machine · old installation · consolidate JOCA · clean up the installation · several JOCA versions on this machine | `/clean-install` |
| classify the task · which route · skill or agent or workflow · do I need a workflow? | `task-router` (agent) |
| freeze · lock edits · lock scope · only edit this folder | `freeze` (guard-rail) |
| careful · warn before deleting · cautious mode · destructive | `careful` (guard-rail) |
| guard · safe mode · maximum security · lock it down | `guard` (guard-rail) |
| tdd · test first · red green · force tests | `tdd` (guard-rail) |
| unfreeze · unlock · remove the lock · turn off guard/tdd | `unfreeze` (guard-rail) |
| pack codebase · package the repo · repo in one file · context for an agent/gemini · repomix | `context-pack` |
| organize a folder · tidy up files · rename files · organization plan · duplicate files · loose files | `file-organization` |
| orchestrate sub-agents · agent brief · fan-out · lost context · how many workers | `agent-context` |
| code discipline · avoid overengineering · typical LLM coding mistakes | `karpathy-guidelines` |
| create a new skill · improve a skill · skill upgrade | `create-skill` (`/create-skill`) |
| caveman mode · talk like caveman · fewer tokens · be brief · normal mode | `caveman` (mode) |
| chain skills · next step · auto-delegation · auto-runner · the pipeline runs itself | `rules/chaining.md` + `rules/pipelines.md` |
| record a decision · save a learning · what did we decide · didn't we fix this | `/learn` (Brain log) |
| full reviewed plan · autoplan · plan properly | `/autoplan` |
| retro · retrospective · what went well/badly · weekly review | `/retro` |
| explore design variants · design options · visual brainstorm · I don't like the look | `design-shotgun` |
| code the design · mockup → HTML · implement this design · make the mockup real | `design-html` |
| at the level of X · as good as · benchmark against a real product · gauntlet · aim prompt · loop until it is perfect | `gauntlet-loop` (`/gauntlet-loop`) |
| ship · push to main · open a PR · it's ready, send it | `/ship` |
| cso · security audit · threat model · STRIDE · OWASP review | `cso` |
| map the knowledge · how everything connects · graph of skills/agents/projects · JOCA map | `/map-joca` |
| what people are saying · last 30 days · social signal · recon before a meeting · real trending · Reddit/X/YouTube | `/last30days` (external plugin) |
| brag · launch video of this project · turn this into a video · share what I built | `/brag` (external plugin — story + music on top of HyperFrames) |
| ingest knowledge · /know · save this · PDF/YouTube/Instagram/article · second brain | `knowledge-ingest` (agent + skill) |
| read email · email summary · inbox · calendar · schedule an event | `personal-comms` (agent + skill) |
| see my email · inbox dashboard · email summary in HTML | `email-dashboard` |
| repair a PR · resolve conflicts · red CI · bot reviews | `pr-repair` (agent) |
| deploy VPS · VPS setup · Caddy · VPS SSH key · Cloudflare DNS API · scp a site · SSH bootstrap · publish to VPS | `deploy-vps` |
| cPanel · UAPI · addon domain · manage hosting · cPanel email account · cPanel DNS zone · create a subdomain | `cpanel` |
| media stack · *arr · Jellyfin · Jellyseerr · Sonarr/Radarr/Prowlarr · qBittorrent · self-hosted media | `selfhosted-arr` |
| public_html · Passenger · 503 Passenger · Setup Node.js App · restart.txt · .htaccess · shared hosting | `deploy-cpanel` |
| Dockerfile · docker compose · multi-stage build · Traefik · containerize · image registry | `deploy-docker` |
| Ploi · ploi.io · provision a server · deploy script · atomic/zero-downtime deploy · queue daemon | `deploy-ploi` |
| Ploi API · `ploi` CLI · Ploi PHP SDK · SSH key on the server · edit the site's nginx · Ploi token · automate Ploi infra | `ploi-api` |
| Cloudflare DNS · Email Routing · SPF merge · Cloudflare MX · forward a domain's email · DNS record via API | `cloudflare-dns` |
| deploy · publish a site · run the deploy pipeline | `deploy-executor` (agent) |
| fix a11y · WCAG fix · accessibility | `a11y-fixer` (agent) |
| technical debt · tech debt · measure the gain · LOC saved | `tech-debt-auditor` (agent) |
| simplify · YAGNI · fewer dependencies · minimum code | `yagni` |
| GitHub Actions · CI · workflow yml · gh pr · branch protection · Dependabot · release | `github` |
| auto-orchestration · when to trigger a workflow · sub-agents | `orchestration-patterns` (rule) |

### Pipelines
Named cross-stack sequences (Laravel Feature, Production frontend, Full-stack e-commerce, Debug, Ship, CSO, etc.) run through the **auto-runner** — JOCA drives the whole sequence on its own (each step in depth, auto-decides the reversible ones, gate only on irreversible, chains via `chain:`). **Auto-runner + auto-decision principles: `rules/pipelines.md`; full catalog (on-demand): `.claude/reference/pipelines-catalog.md`** (do not duplicate here).

## Cross-CLI Bridge
Claude Code (canonical) + Codex (GPT) + agy (Gemini). Source = `skills/`+`.claude/` → `GEMINI.md`/`AGENTS.md` compiled via `bash .claude/scripts/compile-bridges.sh`.

## Autonomous Testing (Hooks)
PostToolUse (Write|Edit) → `.joca/test-queue.jsonl` queue → Stop reads it and recommends testers → after implementing, dispatch the testers without asking.

## Commands
| Command | Function |
|---|---|
| `/install` | JOCA setup on new machine |
| `/start` | project startup: interview → PRD → stack → design direction → `execute-project` (single entry point, new or existing) |
| `/execute-project` | the execution side of `/start`: E1 foundation → E2 design → E3 gate ⏸ → E4 waves → production |
| `/resume` | load context + knowledge graph |
| `/save` | save state + update graph + auto-feedback |
| `/plan` | Plan Mode — architecture |
| `/debug` | error triage + stack skill |
| `/one-shot` | autonomous dev: PRD → orchestrator → agents → tests |
| `/goal` | auto-orchestration from an NL task (no PRD) → master-orchestrator in a loop |
| `/autoplan` | full self-reviewed plan (product → design → eng) — runs the pipeline in depth, final gate |
| `/learn` | the Brain's institutional memory (event-sourced decisions/learnings + recall) |
| `/retro` | retrospective: learnings from the window → actions |
| `/gauntlet-loop` | reframes any request into a workflow against a real reference: fan-out + severe critic + blind comparison, with no automatic stop |
| `/ship` | take code to a PR: sync → tests → review diff → version/CHANGELOG → gate → push → PR |
| `/map-joca` | knowledge map (skills/agents/commands/projects + chains) → interactive graph.html via graphify |
| `/know` | ingest content into the Knowledge Base (markitdown → summary → tags) |
| `/build-plan` | supervised phased build: plan in docs → tasks per phase → loop with a test gate |
| `/review-code` | tester-code + codex adversarial |
| `/review-design` | UI/UX + accessibility |
| `/create-skill [desc]` | new skill via research pipeline |
| `/help-joca` | quick reference |
| `/migrate` | v1-legacy → v2.0 migration guide |
| `/clean-install` | audits the existing JOCA installations (possibly several on the same machine), compares them with the baseline, proposes token optimizations, consolidates memory, archives the old one in `Old/`, promotes the new installation |
| `/upgrade-joca` | feedback → self-improvement → apply |
| `/update-joca` | sync with GitHub (protects `origin: local`) |
| `/status` | show rate limits, model and context inline |
| `/joca-doctor` | installation diagnosis (`.claude/scripts/joca-doctor.mjs`; `--fix` applies safe corrections; exit 1 if there are any ✗) |
| `/wp-perf` | quick WordPress performance triage |
| `/wp-perf-review` | WordPress code review |

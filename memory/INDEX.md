# JOCA Memory Index

## Projectos
<!-- Entradas adicionadas por /save -->
- [joca-ui.md](projects/joca-ui.md) — Browser UI para Claude Code; React+Vite+TypeScript + Node.js+Express+WebSocket+node-pty; terminal multi-sessão, sidebar, file browser, notificações

## Feedback
<!-- Entradas adicionadas por /feedback-joca -->

## Commands
- `/resume` — carrega contexto e knowledge graph do projecto
- `/save` — guarda estado da sessão e actualiza memory
- `/plan` — activa Plan Mode para arquitectura e decisões
- `/debug` — triage de erros com skill do stack detectado
- `/review-code` — code review via tester-code + Codex adversarial opcional
- `/review-design` — review UI/UX e acessibilidade em paralelo
- `/feedback-joca` — captura o que falhou no workflow JOCA nesta sessão
- `/feedback-projeto` — melhora ficheiros do projecto (Branding.md, CLAUDE.md, etc.) com base na sessão
- `/init-project` — inicializa entrada de projecto novo em JOCA/memory
- `/install` — setup do JOCA numa máquina nova
- `/wp-perf` — quick triage WordPress, issues críticos (rápido)
- `/wp-perf-review` — code review WP completo: Critical / Warning / Info
- `/help-joca` — referência rápida de todos os comandos, agentes e skills
- `/upgrade-joca` — lê todo o feedback acumulado, detecta gaps pendentes e implementa upgrades ao JOCA após confirmação
- `/update-joca` — compara instalação local com o repositório oficial (GitHub) e aplica updates após confirmação

## Agents

### Review & Testing
- `prd-reviewer` — revê PRD.md em 5 dimensões (estrutura, AC, parsability Claude Code, living doc health, consistência); relatório CRITICAL/WARNING/INFO; score /100; veredito PASS/NEEDS_WORK/FAIL
- `tester-code` — revê código contra plano e standards; Critical / Important / Suggestions
- `tester-ui-ux` — testa fluxos UI/UX + acessibilidade WCAG 2.1/3.0 (absorveu tester-accessibility); relatório defeitos com severidade e fixes; keyboard nav, ARIA, screen reader
- `tester-performance` — Lighthouse CI, Core Web Vitals, bundle size + load testing completo k6/Artillery: smoke/load/stress/spike/soak (absorveu load-testing-expert); relatório Critical/Warning/Good
- `tester-security` — CVE scan (composer/npm/pip), secrets detection (gitleaks), HTTP headers; relatório por severidade
- `tester-api` — testa endpoints REST: happy path, auth, schema, edge cases, perf baseline
- `codex-review` — code review adversarial via Codex CLI (OpenAI GPT/o3); perspectiva independente de Claude

### Search & Analysis
- `deep-research` — pesquisa web multi-fonte; Firecrawl+WebSearch; pipeline 8 fases; relatório citado MD+HTML+PDF
- `seo-analyst` — crawl + auditoria técnica SEO (CWV, schema, meta, sitemap, E-E-A-T); relatório priorizado
- `dependency-auditor` — CVEs + packages desactualizados + deps não usadas; plano de update priorizado

### Debug
- `log-debugger` — debug completo (absorveu log-analyst + error-detective + laravel-debugger): auto-selecciona modo por input — stack trace → root cause fix; log file → pattern analysis; cascade/spike → correlation + five-whys; Laravel → Artisan/Tinker diagnosis
- `query-debugger` — EXPLAIN plans, missing indexes, N+1 patterns, rewrite queries; PostgreSQL + MySQL

### Deploy
- `deploy-forge` — deploy via Laravel Forge CLI; confirmação obrigatória antes de produção

### Geração & Media
- `img-gen-openai` — gera imagens com gpt-image-2; texto em imagens, produtos, inpainting
- `img-gen-google` — gera imagens com Gemini (Nano Banana); cenas gerais, drafts baratos, aspect ratios
- `watch` — analisa vídeos (URL ou local): frames + transcrição WhisperX local (sem API)
- `gemini-brain` — análise multimodal via Gemini CLI: vídeo, PDF, contexto 1M tokens; tier gratuito

### Especialistas
- `skill-improver` — melhora SKILL.md (especialista em triggers, instruções, formato)
- `skill-evaluator` — avalia SKILL.md em 5 dimensões, retorna JSON score/verdict/feedback
- `flutter-expert` — apps Flutter 3+ cross-platform: UI, state management, nativo, performance
- `payment-integration` — gateways, PCI DSS, subscriptions, fraud prevention, multi-currency

## Skills

### Base (sempre activas)
- `caveman` — comunicação ultra-comprimida (~75% menos tokens)
- `karpathy-guidelines` — guidelines comportamentais de coding
- `agent-context` — orquestração de agentes + compressão + degradação de contexto
- `plan` — planeamento estruturado em 7 fases: orient (OODA) → ambiguidade check → assumptions bloqueante → abordagens → passos PAUL (ação|ficheiros|verificação|done) → pre-mortem (Sabotador+Outsider) → calibração de confiança; auto-activado em complexidade; aprovação implícita OK
- `prd` — gera e mantém PRD.md vivo; estrutura completa: visão, JTBD por persona, AC em Given/When/Then, NFRs, Analytics, Decision Log, Rollout, Glossário; activado no /init-project; validado em /save; formatos: Standard/Lean/Technical
- `create-skill` — pipeline self-improving para criar/melhorar skills
- `feedback-joca` — captura problemas de workflow JOCA numa sessão (tools falhadas, doc gaps, discovery gaps)
- `pt-pt-translator` — traduz/escreve em português de Portugal; AO90, gerúndios→"a+inf", pronomes enclíticos, register (tu/você/o senhor), vocab PT-PT vs PT-BR; checklist automática

### Created Skills
*(directório `created-skills/` vazio — skills foram integradas nas categorias respectivas)*

### Design
- `frontend-design` — protótipos HTML/CSS/JS hi-fi; anti-slop + ui-ux-pro-max; DESIGN.md integration; /components; `framework/` (ios-app-advanced, starter-components)
- `frontend-dev` — implementação production React/Vue/Svelte/Next.js a partir de protótipo; Tailwind/Bootstrap; cva variants; /init /extract /component /audit
- `graphic-design` — materiais impressos HTML/CSS→PDF: roll-ups, flyers, trifolds, posters, cartões; escala real mm/cm; export Playwright
- `anima` — animação specialist: GSAP (scroll, timeline, hover) + Lottie (ícones, ilustrações); router automático; sub-assets: `gsap/*` + `lottie-animator/`
- `slides` — apresentações HTML 1920×1080; anti-slop; /export-pdf; single-file vs multi-file; PPTX editável
- `canvas-design` — arte visual estática .png/.pdf museum-quality
- `brand-guidelines` — gera DESIGN.md + BRAND.md completo para qualquer marca: logo, OKLCH colors, tipografia, tom de voz, image style, component tokens
- `img-gen` — router: decide OpenAI vs Google, crafta prompt, spawna agente certo
- `comfyui/core` — nodes ComfyUI: estrutura, data types, lifecycle
- `comfyui/io` — inputs, outputs, frontend widgets
- `comfyui/deploy` — avançado, packaging, migração V1→V3
- `blender` — 3D modeling e automação no Blender via MCP; Python, assets PolyHaven/Sketchfab

### Marketing
- `paid-ads` — paid ads completo: estratégia + copy + targeting + optimização (Facebook/Google/LinkedIn/TikTok)
- `seo` — SEO técnico + on-page + AI search (AEO/GEO/LLMO) + internacional + auditoria
- `seo-local` — SEO local: GBP, NAP, citações, reviews, schema por vertical, multi-location
- `email-sequence` — sequências email automatizadas (welcome, nurture, onboarding, re-engagement)
- `content-strategy` — planeamento de conteúdo, pilares, clusters, calendário editorial
- `social-content` — conteúdo redes sociais + scripts vídeo curto
- `copywriting` — copy persuasivo: landing pages, headlines, CTAs, PAS/BAB/AIDA
- `page-cro` — conversão de páginas: value prop, CTA, trust signals, friction, quick wins vs testes
- `ab-test-setup` — design de A/B tests: hipótese, sample size, ICE scoring, programa de experimentação
- `brand-positioning` — framework de posicionamento: ICP, diferenciação, mapa competitivo, April Dunford-influenced
- `analytics-tracking` — implementação de tracking: GA4, GTM, UTM, tracking plan, event naming (queries GA4 → google-analytics)
- `launch-strategy` — lançamento de produto: ORB framework, 5 fases, Product Hunt, checklist pre/launch/post
- `competitor-profiling` — pesquisa competitiva: scraping Firecrawl + WebSearch; perfis estruturados + summary

### Vídeo
- `video` — router: decide HyperFrames vs Remotion vs AI generation vs avatars vs editing
- `hyperframes` — HTML+GSAP→vídeo: composição, timing, captions, TTS (Kokoro local), transcrição (Whisper), quality checks (lint/inspect/validate)
- `remotion` — vídeo React programático: useCurrentFrame, interpolate, spring, Sequence, TTS (MiniMax + Edge TTS), batch render, Lambda

### Dev *(backend: stacks + infraestrutura)*
- `laravel-specialist` — Laravel 10+: Eloquent, Sanctum, Horizon, Livewire, API Resources
- `php-pro` — PHP 8.3+: strict typing, PHPStan L9, DTOs, PSR standards
- `postgres-pro` — PostgreSQL: EXPLAIN, JSONB, replication, VACUUM, performance
- `flutter` — Flutter 3+: testing, security auditing, release pipeline, Riverpod, Mockito
- `nodejs` — Node.js/TypeScript Hono-first: routing, Zod validation, middleware, type-safe RPC, deploy CF Workers/Bun
- `saas-patterns` — arquitectura SaaS multi-tenant Laravel 11: stancl/tenancy (single-DB/multi-DB/hybrid), BelongsToTenant global scope, feature flags (Pennant/LaunchDarkly), subscription tiers (PlanGate/Cashier), onboarding assíncrono, queue isolation (Horizon), audit logs, GDPR por-tenant, testes de isolamento Pest
- `file-storage` — armazenamento e entrega segura de ficheiros Laravel; S3 + Cloudflare R2; presigned URLs (upload directo client→storage via S3Client); ClamAV virus scan assíncrono; CDN CloudFront/Cloudflare; magic bytes validation; variantes imagem intervention/image v3; isolamento multi-tenant por prefixo; EXIF stripping
- `reverb-realtime` — Laravel Reverb + Laravel Echo para real-time SaaS; ShouldBroadcast, broadcastOn/As/With, canais public/private/presence, channel auth, Echo frontend, model broadcasting, BroadcastNotification, Pusher fallback, produção Nginx+Supervisor+ext-uv, horizontal scaling Redis pub/sub
- `auth-security` — router: OWASP security review vs Better Auth vs Laravel auth
- `auth-security/owasp` — OWASP Top 10:2025, ASVS 5.0, LLM/Agentic AI security, secure code patterns (20+ linguagens)
- `auth-security/better-auth` — Better Auth completo: setup, DB adapters, sessions, 2FA/TOTP, OAuth providers, plugins
- `auth-security/auth-laravel` — auth stack completo Laravel 11+ SaaS: Sanctum (tokens + SPA), Passport (OAuth2/PKCE), Spatie RBAC (roles, permissions, teams), 2FA TOTP + backup codes + trusted devices, Socialite (account linking), Policies/Gates, password security, auth testing
- `transactional-email` — router: email transaccional por provider
- `transactional-email/postmark` — Postmark: send/batch/templates, webhooks, bounce handling, deliverability SPF/DKIM/DMARC
- `observability` — router: error monitoring / logging / tracing
- `observability/sentry` — Sentry: fix issues workflow 7-fases, SDK setup (Node/Laravel), MCP tools, performance
- `observability/structured-logging` — logging estruturado JSON para Laravel SaaS produção; Monolog JsonFormatter; correlation IDs via Context facade (L11); Telescope gating produção; Sentry (send_default_pii=false); N+1 detection; log channels stack; GDPR (o que nunca logar)
- `search` — Meilisearch/Typesense/Algolia: index config, faceted filtering, instant search, sync patterns
- `realtime` — WebSocket (ws + reconnect), SSE, polling, heartbeat, optimistic updates, auth
- `queues` — router: job queues por tecnologia
- `queues/bullmq` — BullMQ: queues, workers, retry/backoff, DLQ, cron jobs, concurrency, graceful shutdown
- `queues/horizon` — Laravel queues + Horizon para SaaS produção; job classes (ShouldQueue, ShouldBeUnique, ShouldBeEncrypted, Batchable), dispatching, chaining, batching, queue priorities, Horizon supervisors/config, failed jobs, multi-tenant queue context, Queue::fake() testing
- `webhooks` — Webhook receivers: HMAC verification (Stripe/GitHub/Svix), idempotency, Express/Next.js patterns

### Shopify *(activar só em projectos Shopify)*
- `shopify-router` — detecta tipo de projecto e roteia (app / tema / auditoria)
- `shopify-app` — apps: CLI, Admin API GraphQL, extensões, webhooks, OAuth
- `shopify-theme` — temas OS 2.0: Liquid, sections/blocks, Theme Check, CLI push/pull
- `shopify-store-audit` — auditoria: trust, conversão, Core Web Vitals, SEO, AEO, GEO (8 módulos)
- `shopify-store-fixer` — fixes via Admin API GraphQL; aprovação obrigatória antes de cada write

### Tools *(ferramentas stack-agnostic)*
- `api-designer` — REST/GraphQL API design: OpenAPI, versioning, pagination, error handling
- `devops-engineer` — CI/CD, Docker, Kubernetes, Terraform, GitHub Actions, GitOps
- `test-master` — Pest/PHPUnit, unit/integration/E2E, coverage, performance, security
- `webapp-testing` — testes Playwright: browser automation, console, element discovery
- `browser-use/browser-use` — automação browser via CLI: navigate, click, input, screenshot, cookies, tunnels, perfis Chrome
- `browser-use/remote-browser` — browser-use em sandboxes remotas (cloud VMs, CI): headless, tunnels, multi-agent --connect
- `browser-use/open-source` — biblioteca Python browser-use: Agent, Browser, Tools, hooks, MCP, LLM providers, monitorização
- `browser-use/cloud` — Browser Use Cloud API (v2/v3), SDK Python/TS, sessões, proxies, CAPTCHA, webhooks, integrações
- `google-analytics` — queries GA4: overview, pages, sources, devices, realtime, custom
- `microsoft-clarity` — analytics Clarity via Composio MCP (heatmaps, sessions, engagement)

### WordPress *(activar só em projectos WordPress)*
- `wordpress-router` — detecta tipo de repo e roteia (plugin / tema / block)
- `wp-project-triage` — auto-detecta tooling, versões, estrutura
- `wp-block-development` — Gutenberg blocks: block.json, attributes, deprecations
- `wp-block-themes` — block themes: theme.json, patterns, style variations
- `wp-plugin-development` — hooks, segurança, settings API, lifecycle
- `wp-rest-api` — custom endpoints, autenticação, schemas
- `wp-interactivity-api` — directives frontend, state management, SSR
- `wp-abilities-api` — sistema de permissões e capabilities
- `wp-wpcli-and-ops` — WP-CLI: automação, multisite, search-replace, cron
- `wp-performance` — profiling runtime: WP-CLI, Query Monitor, Server-Timing
- `wp-performance-review` — code review estático: anti-patterns, grep patterns
- `wp-phpstan` — análise estática: annotations, third-party classes
- `wp-playground` — ambiente local WP Playground: blueprints, CLI, debugging
- `wpds` — WordPress Design System components
- `wp-plugin-directory-guidelines` — compliance para publicar no directório WP
- `blueprint` — ambientes declarativos Playground

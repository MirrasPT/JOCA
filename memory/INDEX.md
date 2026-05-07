# JOCA Memory Index

## Tools
- [graphify.md](tools/graphify.md) — como instalar e usar Graphify em projectos
- [mcp-routing.md](tools/mcp-routing.md) — quando usar cada MCP: GitHub, Mermaid, Blender, HuggingFace, Playwright, Firecrawl, Google, Lunar, WordPress
- [laravel-stack.md](tools/laravel-stack.md) — Filament + Lunar PHP: AI integration, Boost install, workflow
- [motion.md](tools/motion.md) — biblioteca de animação React/JS (Motion/Framer Motion)

## Feedback

## Projects
<!-- Entradas adicionadas por /save -->

## Commands
- `/resume` — carrega contexto e knowledge graph do projecto
- `/save` — guarda estado da sessão e actualiza memory
- `/plan` — activa Plan Mode para arquitectura e decisões
- `/debug` — triage de erros com skill do stack detectado
- `/review-code` — code review via tester-code + Codex adversarial opcional
- `/review-design` — review UI/UX e acessibilidade em paralelo
- `/feedback-joca` — captura o que falhou no workflow JOCA nesta sessão
- `/init-project` — inicializa entrada de projecto novo em JOCA/memory
- `/install` — setup do JOCA numa máquina nova
- `/wp-perf` — quick triage WordPress, issues críticos (rápido)
- `/wp-perf-review` — code review WP completo: Critical / Warning / Info
- `/help-joca` — referência rápida de todos os comandos, agentes e skills

## Agents

### Review & Testing
- `tester-code` — revê código contra plano e standards; Critical / Important / Suggestions
- `tester-accessibility` — WCAG 2.1/3.0, screen readers, keyboard nav, ARIA
- `tester-ui-ux` — testa fluxos UI/UX; relatório defeitos com severidade e fixes
- `codex-review` — code review adversarial via Codex CLI (OpenAI GPT/o3); perspectiva independente de Claude

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
- `deep-research` — pesquisa web multi-fonte; Firecrawl+WebSearch; pipeline 8 fases; relatório citado MD+HTML+PDF

## Skills

### Base (sempre activas)
- `caveman` — comunicação ultra-comprimida (~75% menos tokens)
- `karpathy-guidelines` — guidelines comportamentais de coding
- `agent-context` — orquestração de agentes + compressão + degradação de contexto
- `create-skill` — pipeline self-improving para criar/melhorar skills
- `feedback-joca` — captura problemas de workflow JOCA numa sessão (tools falhadas, doc gaps, discovery gaps)

### Design
- `frontend-design` — interfaces web production-grade, polidas, sem estética AI genérica; disambiguation com `impeccable` (greenfield vs iteração)
- `impeccable` — design system frontend production-grade; 23 comandos (craft/shape/critique/polish/…); contexto de projecto via PRODUCT.md/DESIGN.md
- `slides` — apresentações HTML 1920×1080: estrutura narrativa, posicionamento visual, animações entrada, layouts responsivos
- `huashu-design` — protótipos HTML hi-fi, animações, app mockups; design advisor + review 5D (excluí slides → ver skill slides)
- `canvas-design` — arte visual estática .png/.pdf museum-quality
- `brand-guidelines` — cores e tipografia oficiais Anthropic para artefactos visuais
- `img-gen` — router: decide OpenAI vs Google, crafta prompt, spawna agente certo
- `lottie-animator` — animações Lottie JSON: entrance, loops, morphing, walk cycles, bezier easing
- `comfyui/core` — nodes ComfyUI: estrutura, data types, lifecycle
- `comfyui/io` — inputs, outputs, frontend widgets
- `comfyui/deploy` — avançado, packaging, migração V1→V3
- `gsap/gsap-core` — GSAP core API: gsap.to/from/fromTo, easing, stagger, matchMedia, transforms
- `gsap/gsap-timeline` — timelines GSAP: position parameter, labels, nesting, playback control
- `gsap/gsap-scrolltrigger` — ScrollTrigger: scroll-linked animations, pin, scrub, batch, horizontal scroll
- `gsap/gsap-plugins` — plugins GSAP: Flip, Draggable, SplitText, DrawSVG, MorphSVG, MotionPath, physics
- `gsap/gsap-utils` — gsap.utils: clamp, mapRange, snap, random, interpolate, wrap, distribute
- `gsap/gsap-react` — GSAP + React: useGSAP hook, refs, contextSafe, SSR, cleanup
- `gsap/gsap-frameworks` — GSAP + Vue/Nuxt/Svelte: lifecycle, gsap.context(), cleanup patterns
- `gsap/gsap-performance` — GSAP performance: transforms > layout, will-change, quickTo, batch reads
- `stitch/stitch-design` — Google Stitch MCP: prompt enhancement pipeline, design system synthesis, workflow routing
- `stitch/stitch-loop` — Stitch build loop: baton system (.stitch/next-prompt.md), iterative multi-page generation
- `stitch/design-md` — Stitch DESIGN.md generator: análise de projecto → documento semântico de design system
- `stitch/enhance-prompt` — Stitch prompt engineer: transforma ideias vagas em prompts estruturados e optimizados
- `stitch/react-components` — Stitch → React: converte designs em componentes modulares Vite/React com validação AST
- `stitch/remotion` — Stitch + Remotion: gera walkthrough videos de designs com transições e text overlays
- `stitch/shadcn-ui` — shadcn/ui: instalação, customização, variantes, cn(), acessibilidade, Radix UI
- `stitch/taste-design` — Stitch taste: DESIGN.md premium anti-slop; tipografia, cor calibrada, motion, anti-patterns

### Marketing
- `ads-creation` — paid ads completo: estratégia + copy + targeting + optimização
- `seo` — SEO técnico + on-page + AI search (AEO/GEO/LLMO) + internacional + auditoria
- `seo-local` — SEO local: GBP, NAP, citações, reviews, schema por vertical, multi-location
- `email-sequence` — sequências email automatizadas (welcome, nurture, onboarding, re-engagement)
- `content-strategy` — planeamento de conteúdo, pilares, clusters, calendário editorial
- `social-content` — conteúdo redes sociais + scripts vídeo curto
- `copywriting` — copy persuasivo: landing pages, headlines, CTAs, PAS/BAB/AIDA

### Vídeo
- `video` — produção vídeo AI (Remotion, HeyGen, Veo, Runway, Kling, Pika, Synthesia)
- `hyperframes/core` — HTML→vídeo: GSAP, captions, voiceover, audio-reactive
- `hyperframes/gsap` — animações GSAP: timelines, easing, scroll triggers
- `hyperframes/website-to-video` — websites → vídeo via Hyperframes

### Dev
- `browser-use/browser-use` — automação browser via CLI: navigate, click, input, screenshot, cookies, tunnels, perfis Chrome
- `browser-use/remote-browser` — browser-use em sandboxes remotas (cloud VMs, CI): headless, tunnels, multi-agent --connect
- `browser-use/open-source` — biblioteca Python browser-use: Agent, Browser, Tools, hooks, MCP, LLM providers, monitorização
- `browser-use/cloud` — Browser Use Cloud API (v2/v3), SDK Python/TS, sessões, proxies, CAPTCHA, webhooks, integrações
- `laravel-specialist` — Laravel 10+: Eloquent, Sanctum, Horizon, Livewire, API Resources
- `php-pro` — PHP 8.3+: strict typing, PHPStan L9, DTOs, PSR standards
- `postgres-pro` — PostgreSQL: EXPLAIN, JSONB, replication, VACUUM, performance
- `api-designer` — REST/GraphQL API design: OpenAPI, versioning, pagination, error handling
- `devops-engineer` — CI/CD, Docker, Kubernetes, Terraform, GitHub Actions, GitOps
- `test-master` — Pest/PHPUnit, unit/integration/E2E, coverage, performance, security
- `webapp-testing` — testes Playwright: browser automation, console, element discovery
- `google-analytics` — queries GA4: overview, pages, sources, devices, realtime, custom
- `microsoft-clarity` — analytics Clarity via Composio MCP (heatmaps, sessions, engagement)
- `blender` — 3D modeling e automação no Blender via MCP; Python, assets PolyHaven/Sketchfab

### Shopify *(activar só em projectos Shopify)*
- `shopify-router` — detecta tipo de projecto e roteia (app / tema / auditoria)
- `shopify-app` — apps: CLI, Admin API GraphQL, extensões, webhooks, OAuth
- `shopify-theme` — temas OS 2.0: Liquid, sections/blocks, Theme Check, CLI push/pull
- `shopify-store-audit` — auditoria: trust, conversão, Core Web Vitals, SEO, AEO, GEO (8 módulos)
- `shopify-store-fixer` — fixes via Admin API GraphQL; aprovação obrigatória antes de cada write

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

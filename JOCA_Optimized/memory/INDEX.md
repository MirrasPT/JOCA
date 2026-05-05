# JOCA Optimized — Memory Index

## Tools
- [graphify.md](tools/graphify.md) — como instalar e usar Graphify em projectos
- [mcp-routing.md](tools/mcp-routing.md) — quando usar cada MCP: GitHub, Mermaid, Blender, HuggingFace, Playwright, Firecrawl, Google, Lunar, WordPress
- [laravel-stack.md](tools/laravel-stack.md) — Filament + Lunar PHP: AI integration, Boost install, workflow
- [motion.md](tools/motion.md) — biblioteca de animação React/JS (Motion/Framer Motion)

## Projects
<!-- Entradas adicionadas por /save -->

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

## Skills (JOCA_Optimized — compactadas e consolidadas)

### Commands
- `/init-joca` — setup global JOCA: identidade, skills, MCPs, API keys, deps
- `/init-project` — ligar projecto ao JOCA: detecção automática de stack, MCPs projecto, memória
- `/install` — alias deprecated → aponta para `/init-joca`

### Base
- `create-skill` — pipeline self-improving para criar/melhorar skills (caveman · karpathy · agent-context → absorvidos no CLAUDE.md)

### Dev
- `php-stack` — PHP 8.3+ · Laravel 10+ · PostgreSQL · PHPStan L9 · Pest/PHPUnit (merge: php-pro + laravel-specialist + postgres-pro)
- `platform` — CI/CD · Docker · Kubernetes · Terraform · deployment strategies · incident response (compact: devops-engineer)
- `quality` — REST/GraphQL API design · OpenAPI 3.1 · testes unit/integration/E2E/performance/security (merge: api-designer + test-master)
- `flutter` — Flutter testing · OWASP Mobile audit · release pipeline (compact)
- `analytics` — Google Analytics 4 queries + Microsoft Clarity export (merge: google-analytics + microsoft-clarity)
- `web-tester` — Playwright Python para testar web apps locais (compact: webapp-testing)
- `blender` — 3D modeling e automação no Blender via MCP (compact)

### Dev · WordPress *(activar só em projectos WP)*
- `wordpress-router` — detecta tipo de repo e roteia
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

### Dev · Shopify *(activar só em projectos Shopify)*
- `shopify-router` — detecta tipo de projecto e roteia
- `shopify-app` — apps: CLI, Admin API GraphQL, extensões, webhooks, OAuth
- `shopify-theme` — temas OS 2.0: Liquid, sections/blocks, Theme Check, CLI push/pull
- `shopify-store-audit` — auditoria: trust, conversão, Core Web Vitals, SEO, AEO, GEO
- `shopify-store-fixer` — fixes via Admin API GraphQL; aprovação obrigatória antes de cada write

### Design
- `ui` — web UI production-grade + hi-fi prototypes HTML · fact-verification · brand assets · anti-slop (merge: frontend-design + huashu-design)
- `visual` — brand Anthropic · canvas design (filosofia → .png/.pdf) · image generation router OpenAI/Google (merge: brand-guidelines + canvas-design + img-gen)
- `motion` — animações Lottie JSON + slide decks HTML (merge: lottie-animator + slides)
- `comfyui/core` — nodes ComfyUI: estrutura, data types, lifecycle
- `comfyui/io` — inputs, outputs, frontend widgets
- `comfyui/deploy` — avançado, packaging, migração V1→V3

### Marketing
- `seo` — SEO técnico + on-page + AI search (AEO/GEO/LLMO) + Local SEO (GBP, NAP, citações) (merge: seo + seo-local)
- `content` — content strategy · copywriting · social media + short-form video (merge: content-strategy + copywriting + social-content)
- `performance` — paid ads (Google/Meta/LinkedIn/TikTok) + email sequences (welcome/nurture/re-engagement) (merge: ads-creation + email-sequence)

### Video
- `video` — produção vídeo AI: HTML→MP4 pipeline · Hyperframes/Remotion · Veo/Runway/Kling · HeyGen/Synthesia (compact)
- `hyperframes/core` — HTML→vídeo: GSAP, captions, voiceover, audio-reactive
- `hyperframes/gsap` — animações GSAP: timelines, easing, scroll triggers
- `hyperframes/website-to-video` — websites → vídeo via Hyperframes

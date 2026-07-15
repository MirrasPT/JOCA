# Créditos

Skills, agentes, scripts e sistemas usados no JOCA.

---

## Skills

### Base

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| caveman | Comunicação terse: sem artigos, filler, hedging; fragmentos OK | [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman) | Julius Brussee |
| karpathy-guidelines | Anti-padrões LLM: pensar antes de codar, simplicidade, mudanças cirúrgicas, execução orientada a objectivos | [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) | Forrest Chang |
| agent-context | Orquestração multi-agente: isolamento de contexto, compressão 70-80%, U-curve, degradação gradual | [muratcankoylan/agent-skills-for-context-engineering](https://github.com/muratcankoylan/agent-skills-for-context-engineering) | Murat Can Koylan |
| create-skill | Pipeline self-improving para criar/melhorar skills: research → draft → improve → evaluate (máx 3 iter.) | JOCA original | — |

### Design

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| frontend | Awwwards-level website/webapp designer+developer; funde filosofias de Anthropic frontend-design, huashu-design e ui-ux-pro-max | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design), [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design), [nextlevelbuilder/ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Anthropic, alchaincyf, nextlevelbuilder |
| mobile | Responsive + mobile-first specialist; touch, safe areas, PWA | JOCA original | -- |
| canvas-design | Arte visual estática .png/.pdf museum-quality | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/canvas-design) | Anthropic |
| brand-guidelines | Cores e tipografia oficiais Anthropic para artefactos visuais | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/brand-guidelines) | Anthropic |
| img-gen | Router OpenAI vs Google; crafta prompts; spawna img-gen-openai ou img-gen-google | JOCA original | — |
| lottie-animator | Gera animações Lottie profissionais a partir de SVGs: entrance, loops, morphing, walk cycles, frame-by-frame | [obeskay/lottie-animator-skill](https://github.com/obeskay/lottie-animator-skill) | obeskay |
| comfyui/core | Nodes ComfyUI: estrutura, data types (IMAGE/LATENT/MASK), lifecycle | [jtydhr88/comfyui-custom-node-skills](https://github.com/jtydhr88/comfyui-custom-node-skills) | jtydhr88 |
| comfyui/io | INPUT_TYPES, outputs, widgets JavaScript, UI customizada | [jtydhr88/comfyui-custom-node-skills](https://github.com/jtydhr88/comfyui-custom-node-skills) | jtydhr88 |
| comfyui/deploy | Nodes avançados, packaging, migração V1→V3 | [jtydhr88/comfyui-custom-node-skills](https://github.com/jtydhr88/comfyui-custom-node-skills) | jtydhr88 |

### Marketing

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| paid-ads | Estratégia de campanha + copy + targeting + optimização (Google/Meta/LinkedIn/TikTok) | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| seo | SEO técnico + on-page + AI search (AEO/GEO/LLMO) + internacional + auditoria | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| seo-local | SEO local: GBP, NAP, citações, reviews, schema por vertical, multi-location | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | AgriciDaniel |
| email-sequence | Sequências email automatizadas: welcome, nurture, onboarding, re-engagement | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| content-strategy | Planeamento de conteúdo: pilares, clusters, calendário editorial | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| social-content | Conteúdo redes sociais + scripts vídeo curto (LinkedIn, X, Instagram, TikTok) | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| copywriting | Copy persuasivo: landing pages, headlines, CTAs, PAS/BAB/AIDA | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |

### Vídeo

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| video | Produção vídeo AI: Remotion, HeyGen, Veo, Runway, Kling, Pika, Synthesia | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| hyperframes/core | Framework HTML→vídeo; composições GSAP, captions, voiceover, audio-reactive | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HeyGen |
| hyperframes/gsap | Animações GSAP: timelines, easing, scroll triggers | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HeyGen |
| hyperframes/website-to-video | Converter websites em vídeo com Hyperframes | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HeyGen |

### WordPress

Skills em `.claude/skills/dev/wordpress/` — activar só em projectos WordPress.

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| wordpress-router | Detecta tipo de repo (plugin/theme/block) e roteia | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-project-triage | Auto-detecta tooling, versões e estrutura | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-block-development | Gutenberg blocks: `block.json`, attributes, deprecations, dynamic rendering | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-block-themes | Block themes: `theme.json`, patterns, style variations, templates | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-plugin-development | Arquitectura de plugins: hooks, segurança, settings API, lifecycle | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-rest-api | Custom endpoints, autenticação, schemas, responses | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-interactivity-api | Directives frontend, state management, server-side rendering | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-abilities-api | Sistema de permissões e capabilities | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-wpcli-and-ops | WP-CLI: automação, multisite, search-replace seguro, cron | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-performance | Profiling runtime: WP-CLI, Query Monitor headless, Server-Timing | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) + [elvismdev/claude-wordpress-skills](https://github.com/elvismdev/claude-wordpress-skills) (refs) | WordPress Foundation / Elvis M. Dev |
| wp-performance-review | Code review estático: anti-patterns, grep patterns, file-type checks | [elvismdev/claude-wordpress-skills](https://github.com/elvismdev/claude-wordpress-skills) | Elvis M. Dev |
| wp-phpstan | Análise estática WordPress: annotations, third-party classes | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-playground | Ambiente local WP Playground: blueprints, CLI, debugging | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wpds | WordPress Design System components | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-plugin-directory-guidelines | Compliance para publicar no directório WP | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| blueprint | Ambientes declarativos Playground | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |

### Shopify

Skills em `.claude/skills/dev/shopify/` — activar só em projectos Shopify.

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| shopify-router | Detecta tipo de projecto (app/tema/auditoria) e roteia para a skill certa | JOCA original | — |
| shopify-app | Apps Shopify: CLI, Admin API GraphQL, extensões (checkout/admin/POS/functions), webhooks, OAuth | [Shopify/shopify-ai-toolkit](https://github.com/Shopify/shopify-ai-toolkit) + [microck-shopify](https://www.skillsdirectory.com/skills/microck-shopify) + JOCA | Shopify / JOCA |
| shopify-theme | Temas Online Store 2.0: Liquid, sections/blocks, settings schema, Theme Check, CLI push/pull | [Shopify/shopify-ai-toolkit](https://github.com/Shopify/shopify-ai-toolkit) + JOCA | Shopify / JOCA |
| shopify-store-audit | Auditoria de loja pública: trust, conversão, Core Web Vitals, SEO técnico, AEO, GEO (8 módulos) | [prajapatimehul/shopify-cowork](https://github.com/prajapatimehul/shopify-cowork) + JOCA | Mehul Prajapati / JOCA |
| shopify-store-fixer | Implementa fixes via Admin API GraphQL; requer aprovação explícita antes de cada write | [prajapatimehul/shopify-cowork](https://github.com/prajapatimehul/shopify-cowork) + JOCA | Mehul Prajapati / JOCA |

### Dev

| Skill | Descrição | Repo | Autor |
|-------|-----------|------|-------|
| laravel-specialist | Laravel 11+: single-action controllers, Actions, ULIDs, Sanctum, Horizon, Pest; invoca rest-api, mysql, filament | [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills), [JustSteveKing/api-skill](https://github.com/JustSteveKing/api-skill) | Jeff Allan, Steve King |
| filament | Filament v4/v5 admin panels: Resources, Forms, Tables, multi-tenancy scoping | [olakunlevpn/filament-skills](https://github.com/olakunlevpn/olakunlevpn-filament-skills) | olakunlevpn |
| mysql | MySQL optimization: EXPLAIN, composite indexes, SARGability, cursor pagination | [u1pns/skill-dba](https://github.com/u1pns/skill-dba), [github/awesome-copilot](https://github.com/github/awesome-copilot) | u1pns, GitHub |
| rest-api | REST API design: RFC 9457 errors, URL conventions, versioning Sunset, OpenAPI 3.1 | [JustSteveKing/api-skill](https://github.com/JustSteveKing/api-skill), [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills) | Steve King, Jeff Allan |
| deploy-ploi | Ploi.io deployment: provisioning, zero-downtime, Horizon, PHP SDK | [ploi/ploi-php-sdk](https://github.com/ploi/ploi-php-sdk), [ploi docs](https://ploi.io/documentation) | Ploi |
| deploy-cpanel | cPanel deployment: folder structure, .cpanel.yml, workarounds | JOCA original | -- |
| deploy-docker | Docker on VPS: multi-stage, Traefik/Caddy, CI/CD, backups | [Docker docs](https://docs.docker.com/guides/frameworks/laravel/) | Docker, community |
| test-master | Pest/PHPUnit, unit/integration/E2E, coverage, performance, security testing | [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills) | Jeff Allan |
| webapp-testing | Testes automatizados web com Playwright: browser automation, console, element discovery | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | Anthropic |
| google-analytics | Queries GA4 via Data API v1: 8 report types (overview, pages, sources, devices, realtime, custom) | JOCA original | — |
| microsoft-clarity | Exporta Clarity analytics (heatmaps, sessions, engagement) via Composio MCP | JOCA original | — |
| blender | 22 MCP tools para modelação 3D, materiais, iluminação, rendering e animação | [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) + JOCA | ahujasid / JOCA |

---

## Agentes

| Agente | Repo | Autor |
|--------|------|-------|
| tester-code | [obra/superpowers](https://github.com/obra/superpowers/blob/main/agents/code-reviewer.md) | Jesse Vincent |
| tester-accessibility | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/accessibility-tester.md) | VoltAgent |
| tester-ui-ux | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/ui-ux-tester.md) | VoltAgent |
| skill-improver | JOCA original — pipeline create-skill | — |
| skill-evaluator | JOCA original — pipeline create-skill | — |
| flutter-expert | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/flutter-expert.md) | VoltAgent |
| payment-integration | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/payment-integration.md) | VoltAgent |
| img-gen-openai | JOCA original — wraps gpt-image-2; texto em imagens, produtos, inpainting | — |
| img-gen-google | JOCA original — wraps `gemini-generate.py`; cenas gerais, drafts baratos, aspect ratios | — |
| deep-research | [199-biotechnologies/claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill) (metodologia) + JOCA (agente + Firecrawl) | 199 Biotechnologies / JOCA |
| watch | [bradautomates/claude-video](https://github.com/bradautomates/claude-video) · modificado: WhisperX local em vez de Whisper API | bradautomates / JOCA |
| gemini-brain | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) — bridge agent para análise multimodal (vídeo, PDF, contexto 1M) via Gemini CLI | Google / JOCA |
| codex-review | [openai/codex](https://github.com/openai/codex) — bridge agent para code review adversarial via Codex CLI (OpenAI) | OpenAI / JOCA |

---

## Scripts

| Script | Localização | Descrição |
|--------|-------------|-----------|
| `gemini-generate.py` | `.claude/scripts/` | Gera imagens via Google Gemini (Nano Banana); adaptado de [buildatscale-tv/claude-code-plugins](https://github.com/buildatscale-tv/claude-code-plugins) + [kingbootoshi/nano-banana-2-skill](https://github.com/kingbootoshi/nano-banana-2-skill) |
| `ga_query.py` | `.claude/skills/dev/google-analytics/` | Queries GA4 via Data API v1; 8 report types; JOCA original |
| `watch.py` | `.claude/agents/watch/scripts/` | Entry point do agente watch; orquestra download + frames + transcrição |
| `whisperx_local.py` | `.claude/agents/watch/scripts/` | Transcrição local com WhisperX (sem API); JOCA original |
| `download.py` | `.claude/agents/watch/scripts/` | yt-dlp wrapper para download de vídeos e legendas |
| `frames.py` | `.claude/agents/watch/scripts/` | Extracção de frames via ffmpeg com auto-fps |
| `transcribe.py` | `.claude/agents/watch/scripts/` | Parser de WebVTT (legendas nativas) |
| `setup.py` | `.claude/agents/watch/scripts/` | Preflight check: ffmpeg + yt-dlp + whisperx |

---

## MCP Tools

### `.mcp.json` (projecto JOCA)

| MCP | Comando / URL | Notas |
|-----|---------------|-------|
| blender | `uvx blender-mcp` · [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | Requer add-on + servidor activo |
| github | `https://api.githubcopilot.com/mcp/` | Requer `GITHUB_PERSONAL_ACCESS_TOKEN` |
| mermaid | `https://mcp.mermaid.ai/mcp` · [Mermaid Chart](https://mermaid.ai) | Sem auth p/ ferramentas base |
| huggingface | `https://hf.co/mcp` · [Hugging Face](https://huggingface.co) | `HF_TOKEN` opcional |

### WordPress MCP Adapter (por projecto WP)

| MCP | Instalação | Notas |
|-----|------------|-------|
| wordpress/mcp-adapter | `composer require wordpress/mcp-adapter` · [WordPress/mcp-adapter](https://github.com/WordPress/mcp-adapter) | Expõe WordPress Abilities API como tools MCP; requer WP 6.8+, auth via Application Passwords; sem chave externa |

Repositório Automattic arquivado — usar o oficial: [WordPress/mcp-adapter](https://github.com/WordPress/mcp-adapter)

### Plugin system (globais)

| MCP | Repo | Notas |
|-----|------|-------|
| playwright | [executeautomation/mcp-playwright](https://github.com/executeautomation/mcp-playwright) | Browser automation, 143 device presets |
| firecrawl | [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | Self-hosted Docker, `localhost:3002` |
| lunar-docs | [lunarphp/lunar](https://lunarphp.io) | MCP oficial docs Lunar PHP |

### Connectors nativos Claude (OAuth)

| Connector | Ferramentas |
|-----------|-------------|
| gmail | search_threads, get_thread, create_draft, list/create_label, label/unlabel, list_drafts |
| google-calendar | list_calendars, list/get/create/update/delete_event, respond_to_event, suggest_time |
| google-drive | list_recent_files, search_files, get_file_metadata, read/download_file_content, create_file |

---

## Tools / Referências

| Tool | Repo | Autor |
|------|------|-------|
| Graphify | [safishamsi/graphify](https://github.com/safishamsi/graphify) | Safi Shamsi |
| Motion | [motiondivision/motion](https://github.com/motiondivision/motion) | Motion Division |
| Memory setup | [lucasrosati/claude-code-memory-setup](https://github.com/lucasrosati/claude-code-memory-setup) | Lucas Rosati |
| WhisperX | [m-bain/whisperX](https://github.com/m-bain/whisperX) | Max Bain |

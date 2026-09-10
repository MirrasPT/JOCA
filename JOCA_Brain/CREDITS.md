# Credits

Skills, agents, scripts and systems used in JOCA.

---

## Skills

### Base

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| caveman | Terse communication: no articles, filler or hedging; fragments OK | [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman) | Julius Brussee |
| karpathy-guidelines | LLM anti-patterns: think before coding, simplicity, surgical changes, goal-oriented execution | [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) | Forrest Chang |
| agent-context | Multi-agent orchestration: context isolation, 70-80% compression, U-curve, graceful degradation | [muratcankoylan/agent-skills-for-context-engineering](https://github.com/muratcankoylan/agent-skills-for-context-engineering) | Murat Can Koylan |
| create-skill | Self-improving pipeline for creating/improving skills: research → draft → improve → evaluate (max 3 iter.) | JOCA original | — |

### Design

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| frontend | Awwwards-level website/webapp designer+developer; fuses the philosophies of Anthropic frontend-design, huashu-design and ui-ux-pro-max | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design), [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design), [nextlevelbuilder/ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Anthropic, alchaincyf, nextlevelbuilder |
| mobile | Responsive + mobile-first specialist; touch, safe areas, PWA | JOCA original | -- |
| canvas-design | Museum-quality static .png/.pdf visual art | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/canvas-design) | Anthropic |
| brand-guidelines | Official Anthropic colors and typography for visual artifacts | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/brand-guidelines) | Anthropic |
| img-gen | OpenAI vs Google router; crafts prompts; spawns img-gen-openai or img-gen-google | JOCA original | — |
| lottie-animator | Generates professional Lottie animations from SVGs: entrance, loops, morphing, walk cycles, frame-by-frame | [obeskay/lottie-animator-skill](https://github.com/obeskay/lottie-animator-skill) | obeskay |
| comfyui/core | ComfyUI nodes: structure, data types (IMAGE/LATENT/MASK), lifecycle | [jtydhr88/comfyui-custom-node-skills](https://github.com/jtydhr88/comfyui-custom-node-skills) | jtydhr88 |
| comfyui/io | INPUT_TYPES, outputs, JavaScript widgets, custom UI | [jtydhr88/comfyui-custom-node-skills](https://github.com/jtydhr88/comfyui-custom-node-skills) | jtydhr88 |
| comfyui/deploy | Advanced nodes, packaging, V1→V3 migration | [jtydhr88/comfyui-custom-node-skills](https://github.com/jtydhr88/comfyui-custom-node-skills) | jtydhr88 |

### Marketing

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| paid-ads | Campaign strategy + copy + targeting + optimization (Google/Meta/LinkedIn/TikTok) | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| seo | Technical SEO + on-page + AI search (AEO/GEO/LLMO) + international + audit | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| seo-local | Local SEO: GBP, NAP, citations, reviews, schema per vertical, multi-location | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | AgriciDaniel |
| email-sequence | Automated email sequences: welcome, nurture, onboarding, re-engagement | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| content-strategy | Content planning: pillars, clusters, editorial calendar | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| social-content | Social media content + short video scripts (LinkedIn, X, Instagram, TikTok) | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| copywriting | Persuasive copy: landing pages, headlines, CTAs, PAS/BAB/AIDA | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |

### Video

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| video | AI video production: Remotion, HeyGen, Veo, Runway, Kling, Pika, Synthesia | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Corey Haines |
| hyperframes/core | HTML→video framework; GSAP compositions, captions, voiceover, audio-reactive | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HeyGen |
| hyperframes/gsap | GSAP animations: timelines, easing, scroll triggers | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HeyGen |
| hyperframes/website-to-video | Convert websites into video with Hyperframes | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HeyGen |

### WordPress

Skills in `.claude/skills/dev/wordpress/` — activate only on WordPress projects.

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| wordpress-router | Detects the repo type (plugin/theme/block) and routes | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-project-triage | Auto-detects tooling, versions and structure | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-block-development | Gutenberg blocks: `block.json`, attributes, deprecations, dynamic rendering | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-block-themes | Block themes: `theme.json`, patterns, style variations, templates | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-plugin-development | Plugin architecture: hooks, security, settings API, lifecycle | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-rest-api | Custom endpoints, authentication, schemas, responses | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-interactivity-api | Frontend directives, state management, server-side rendering | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-abilities-api | Permissions and capabilities system | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-wpcli-and-ops | WP-CLI: automation, multisite, safe search-replace, cron | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-performance | Runtime profiling: WP-CLI, headless Query Monitor, Server-Timing | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) + [elvismdev/claude-wordpress-skills](https://github.com/elvismdev/claude-wordpress-skills) (refs) | WordPress Foundation / Elvis M. Dev |
| wp-performance-review | Static code review: anti-patterns, grep patterns, file-type checks | [elvismdev/claude-wordpress-skills](https://github.com/elvismdev/claude-wordpress-skills) | Elvis M. Dev |
| wp-phpstan | WordPress static analysis: annotations, third-party classes | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-playground | Local WP Playground environment: blueprints, CLI, debugging | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wpds | WordPress Design System components | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| wp-plugin-directory-guidelines | Compliance for publishing to the WP directory | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |
| blueprint | Declarative Playground environments | [WordPress/agent-skills](https://github.com/WordPress/agent-skills) | WordPress Foundation |

### Shopify

Skills in `.claude/skills/dev/shopify/` — activate only on Shopify projects.

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| shopify-router | Detects the project type (app/theme/audit) and routes to the right skill | JOCA original | — |
| shopify-app | Shopify apps: CLI, Admin GraphQL API, extensions (checkout/admin/POS/functions), webhooks, OAuth | [Shopify/shopify-ai-toolkit](https://github.com/Shopify/shopify-ai-toolkit) + [microck-shopify](https://www.skillsdirectory.com/skills/microck-shopify) + JOCA | Shopify / JOCA |
| shopify-theme | Online Store 2.0 themes: Liquid, sections/blocks, settings schema, Theme Check, CLI push/pull | [Shopify/shopify-ai-toolkit](https://github.com/Shopify/shopify-ai-toolkit) + JOCA | Shopify / JOCA |
| shopify-store-audit | Public store audit: trust, conversion, Core Web Vitals, technical SEO, AEO, GEO (8 modules) | [prajapatimehul/shopify-cowork](https://github.com/prajapatimehul/shopify-cowork) + JOCA | Mehul Prajapati / JOCA |
| shopify-store-fixer | Implements fixes via the Admin GraphQL API; requires explicit approval before each write | [prajapatimehul/shopify-cowork](https://github.com/prajapatimehul/shopify-cowork) + JOCA | Mehul Prajapati / JOCA |

### Dev

| Skill | Description | Repo | Author |
|-------|-----------|------|-------|
| laravel-specialist | Laravel 11+: single-action controllers, Actions, ULIDs, Sanctum, Horizon, Pest; invokes rest-api, mysql, filament | [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills), [JustSteveKing/api-skill](https://github.com/JustSteveKing/api-skill) | Jeff Allan, Steve King |
| filament | Filament v4/v5 admin panels: Resources, Forms, Tables, multi-tenancy scoping | [olakunlevpn/filament-skills](https://github.com/olakunlevpn/olakunlevpn-filament-skills) | olakunlevpn |
| mysql | MySQL optimization: EXPLAIN, composite indexes, SARGability, cursor pagination | [u1pns/skill-dba](https://github.com/u1pns/skill-dba), [github/awesome-copilot](https://github.com/github/awesome-copilot) | u1pns, GitHub |
| rest-api | REST API design: RFC 9457 errors, URL conventions, versioning Sunset, OpenAPI 3.1 | [JustSteveKing/api-skill](https://github.com/JustSteveKing/api-skill), [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills) | Steve King, Jeff Allan |
| deploy-ploi | Ploi.io deployment: provisioning, zero-downtime, Horizon, PHP SDK | [ploi/ploi-php-sdk](https://github.com/ploi/ploi-php-sdk), [ploi docs](https://ploi.io/documentation) | Ploi |
| deploy-cpanel | cPanel deployment: folder structure, .cpanel.yml, workarounds | JOCA original | -- |
| deploy-docker | Docker on VPS: multi-stage, Traefik/Caddy, CI/CD, backups | [Docker docs](https://docs.docker.com/guides/frameworks/laravel/) | Docker, community |
| test-master | Pest/PHPUnit, unit/integration/E2E, coverage, performance, security testing | [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills) | Jeff Allan |
| webapp-testing | Automated web testing with Playwright: browser automation, console, element discovery | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | Anthropic |
| google-analytics | GA4 queries via Data API v1: 8 report types (overview, pages, sources, devices, realtime, custom) | JOCA original | — |
| microsoft-clarity | Exports Clarity analytics (heatmaps, sessions, engagement) via Composio MCP | JOCA original | — |
| blender | 22 MCP tools for 3D modeling, materials, lighting, rendering and animation | [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) + JOCA | ahujasid / JOCA |

---

## Agents

| Agent | Repo | Author |
|--------|------|-------|
| tester-code | [obra/superpowers](https://github.com/obra/superpowers/blob/main/agents/code-reviewer.md) | Jesse Vincent |
| tester-accessibility | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/accessibility-tester.md) | VoltAgent |
| tester-ui-ux | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/ui-ux-tester.md) | VoltAgent |
| skill-improver | JOCA original — create-skill pipeline | — |
| skill-evaluator | JOCA original — create-skill pipeline | — |
| flutter-expert | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/flutter-expert.md) | VoltAgent |
| payment-integration | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/payment-integration.md) | VoltAgent |
| img-gen-openai | JOCA original — wraps gpt-image-2; text in images, products, inpainting | — |
| img-gen-google | JOCA original — wraps `gemini-generate.py`; general scenes, cheap drafts, aspect ratios | — |
| deep-research | [199-biotechnologies/claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill) (methodology) + JOCA (agent + Firecrawl) | 199 Biotechnologies / JOCA |
| watch | [bradautomates/claude-video](https://github.com/bradautomates/claude-video) · modified: local WhisperX instead of the Whisper API | bradautomates / JOCA |
| gemini-brain | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) — bridge agent for multimodal analysis (video, PDF, 1M context) via the Gemini CLI | Google / JOCA |
| codex-review | [openai/codex](https://github.com/openai/codex) — bridge agent for adversarial code review via the Codex CLI (OpenAI) | OpenAI / JOCA |

---

## Scripts

| Script | Location | Description |
|--------|-------------|-----------|
| `gemini-generate.py` | `.claude/scripts/` | Generates images via Google Gemini (Nano Banana); adapted from [buildatscale-tv/claude-code-plugins](https://github.com/buildatscale-tv/claude-code-plugins) + [kingbootoshi/nano-banana-2-skill](https://github.com/kingbootoshi/nano-banana-2-skill) |
| `ga_query.py` | `.claude/skills/dev/google-analytics/` | GA4 queries via Data API v1; 8 report types; JOCA original |
| `watch.py` | `.claude/agents/watch/scripts/` | Entry point of the watch agent; orchestrates download + frames + transcription |
| `whisperx_local.py` | `.claude/agents/watch/scripts/` | Local transcription with WhisperX (no API); JOCA original |
| `download.py` | `.claude/agents/watch/scripts/` | yt-dlp wrapper for downloading videos and subtitles |
| `frames.py` | `.claude/agents/watch/scripts/` | Frame extraction via ffmpeg with auto-fps |
| `transcribe.py` | `.claude/agents/watch/scripts/` | WebVTT parser (native subtitles) |
| `setup.py` | `.claude/agents/watch/scripts/` | Preflight check: ffmpeg + yt-dlp + whisperx |

---

## MCP Tools

### `.mcp.json` (JOCA project)

| MCP | Command / URL | Notes |
|-----|---------------|-------|
| blender | `uvx blender-mcp` · [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | Requires the add-on + an active server |
| github | `https://api.githubcopilot.com/mcp/` | Requires `GITHUB_PERSONAL_ACCESS_TOKEN` |
| mermaid | `https://mcp.mermaid.ai/mcp` · [Mermaid Chart](https://mermaid.ai) | No auth for the base tools |
| huggingface | `https://hf.co/mcp` · [Hugging Face](https://huggingface.co) | `HF_TOKEN` optional |

### WordPress MCP Adapter (per WP project)

| MCP | Install | Notes |
|-----|------------|-------|
| wordpress/mcp-adapter | `composer require wordpress/mcp-adapter` · [WordPress/mcp-adapter](https://github.com/WordPress/mcp-adapter) | Exposes the WordPress Abilities API as MCP tools; requires WP 6.8+, auth via Application Passwords; no external key |

The Automattic repository is archived — use the official one: [WordPress/mcp-adapter](https://github.com/WordPress/mcp-adapter)

### Plugin system (global)

| MCP | Repo | Notes |
|-----|------|-------|
| playwright | [executeautomation/mcp-playwright](https://github.com/executeautomation/mcp-playwright) | Browser automation, 143 device presets |
| firecrawl | [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | Self-hosted Docker, `localhost:3002` |
| lunar-docs | [lunarphp/lunar](https://lunarphp.io) | Official Lunar PHP docs MCP |

### Native Claude connectors (OAuth)

| Connector | Tools |
|-----------|-------------|
| gmail | search_threads, get_thread, create_draft, list/create_label, label/unlabel, list_drafts |
| google-calendar | list_calendars, list/get/create/update/delete_event, respond_to_event, suggest_time |
| google-drive | list_recent_files, search_files, get_file_metadata, read/download_file_content, create_file |

---

## Tools / References

| Tool | Repo | Author |
|------|------|-------|
| Graphify | [safishamsi/graphify](https://github.com/safishamsi/graphify) | Safi Shamsi |
| Motion | [motiondivision/motion](https://github.com/motiondivision/motion) | Motion Division |
| Memory setup | [lucasrosati/claude-code-memory-setup](https://github.com/lucasrosati/claude-code-memory-setup) | Lucas Rosati |
| WhisperX | [m-bain/whisperX](https://github.com/m-bain/whisperX) | Max Bain |

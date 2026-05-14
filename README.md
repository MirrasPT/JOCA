# JOCA — Joint Orchestrator of Cognitive Agents

[![GitHub](https://img.shields.io/badge/GitHub-MirrasPT%2FJOCA-blue?logo=github)](https://github.com/MirrasPT/JOCA)

Toolkit centralizado de skills, agentes, memória e MCPs para Claude Code. Instala uma vez, usa em qualquer projecto.

**Problema que resolve:** cada projecto novo recomeça do zero — sem contexto, sem ferramentas, sem comportamento consistente. O JOCA é a camada persistente que vive acima dos projectos.

**Fonte de verdade:** JOCA é Claude-first. `CLAUDE.md`, `.claude/`, `memory/INDEX.md` e `memory/tools/` são canónicos. Outros ficheiros de agente, quando existirem, são pontes de compatibilidade.

---

## Como funciona

Abre qualquer projecto no Claude Code com a pasta do JOCA como working directory adicional (ou define como path global nas definições do Claude Code). O `CLAUDE.md` do JOCA é lido automaticamente — comportamento, skills e agentes ficam disponíveis imediatamente.

```
JOCA/
├── CLAUDE.md          ← comportamento base (comunicação, código, agentes)
├── install.md         ← assistente interactivo de instalação
├── CREDITOS.md        ← créditos e origens das skills
├── JOCA_UI/           ← browser UI para Claude Code (terminal multi-sessão)
├── memory/
│   ├── INDEX.md       ← catálogo de skills, agentes e ferramentas
│   ├── projects/      ← entrada por projecto (criado por /save)
│   ├── feedback/      ← sessões /feedback-joca
│   └── tools/         ← graphify, MCP routing, motion, laravel-stack
└── .claude/
    ├── commands/      ← /install, /init-project, /resume, /save, /feedback-joca, ...
    ├── agents/        ← tester-*, img-gen-*, watch, gemini-brain, codex-review, deep-research, ...
    ├── scripts/       ← graphify-global.py, graphify-patch.sh
    └── skills/
        ├── base/      ← caveman, karpathy-guidelines, agent-context, plan, prd, create-skill, feedback-joca
        ├── design/    ← frontend-design, frontend-dev, brand-guidelines, slides, anima, graphic-design, ...
        ├── dev/       ← laravel, php, postgres, nodejs, saas-patterns, auth-security, ...
        ├── tools/     ← api-designer, devops-engineer, webapp-testing, browser-use/*, ...
        ├── marketing/ ← paid-ads, seo, copywriting, page-cro, brand-positioning, ...
        └── video/     ← video, hyperframes, remotion
```

---

## Início rápido

### Máquina nova — bootstrap completo

Cola no Claude Code:

```
Lê o ficheiro install.md em https://raw.githubusercontent.com/MirrasPT/JOCA/master/install.md e segue as instruções.
```

O assistente faz o questionário, detecta o teu stack, selecciona as skills relevantes e configura MCPs.

### Actualizar o JOCA

Se já tens o JOCA instalado, usa o comando:

```
/update-joca
```

Se o comando não for detectado (versão anterior, sessão sem contexto JOCA), cola isto directamente no Claude Code:

```
Lê o ficheiro https://raw.githubusercontent.com/MirrasPT/JOCA/master/.claude/commands/update-joca.md e segue as instruções para verificar e actualizar o JOCA instalado nesta máquina.
```

Ambas as variantes fazem o mesmo: comparam a instalação local com este repositório, mostram o que é novo e aplicam as actualizações após confirmação. Nunca sobrescrevem a tua memória de projectos ou ficheiros de feedback pessoais.

### Já tens o JOCA instalado

No início de cada sessão:

```
/resume
```

Para ligar um projecto existente ao JOCA:

```
/init-project
```

---

## JOCA_UI

Interface browser para o Claude Code — substitui o terminal do sistema por uma UI web com múltiplas sessões em simultâneo.

**Stack:** React + Vite + TypeScript · Node.js + Express + WebSocket · xterm.js · node-pty

**Funcionalidades:**
- Terminal emulado com fidelidade total (PTY real, cores ANSI, resize)
- Sidebar direita com múltiplas sessões independentes — cada uma = processo `claude` separado
- Painel de ficheiros com preview integrado
- Detecção de estado da sessão (working / idle) com notificações desktop
- Atalhos rápidos: `/save`, `/compact`, `/create-skill` directamente da barra do terminal
- Gestão de projectos: abrir sessão Claude directamente num projecto

**Arranque:**

```bash
cd JOCA_UI
npm run setup   # primeira vez — compila node-pty nativo
npm run dev     # backend :3001 + frontend Vite :5173
```

Aceder em: `http://localhost:5173`

---

## Skills disponíveis

Skills são activadas on-demand — só carregam quando invocadas.

### Base *(sempre activas — comportamento embutido)*

| Skill | O que faz |
|-------|-----------|
| `caveman` | Comunicação ultra-comprimida, sem filler |
| `karpathy-guidelines` | Pensar antes de codar, simplicidade, mudanças cirúrgicas |
| `agent-context` | Orquestração multi-agente, compressão de contexto 70-80% |
| `plan` | Planeamento em 7 fases: OODA, ambiguidade, assumptions, abordagens, passos PAUL, pre-mortem, confiança |
| `prd` | Gera e mantém PRD.md vivo com estrutura completa (JTBD, AC Given/When/Then, NFRs, Decision Log) |
| `create-skill` | Pipeline self-improving para criar/melhorar skills |
| `feedback-joca` | Captura problemas de workflow JOCA numa sessão |
| `pt-pt-translator` | Escreve/traduz em português de Portugal (AO90, gerúndios, pronomes enclíticos) |

### Design

| Skill | O que faz |
|-------|-----------|
| `frontend-design` | Protótipos HTML/CSS/JS hi-fi; anti-slop; DESIGN.md integration |
| `frontend-dev` | Implementação production React/Vue/Svelte/Next.js a partir de protótipo |
| `brand-guidelines` | Gera DESIGN.md + BRAND.md completo: logo, OKLCH colors, tipografia, tom de voz |
| `graphic-design` | Materiais impressos HTML/CSS→PDF: roll-ups, flyers, posters, cartões |
| `slides` | Apresentações HTML 1920×1080; /export-pdf; single/multi-file; PPTX editável |
| `anima` | Animação: GSAP (scroll, timeline, hover) + Lottie (ícones, ilustrações) |
| `canvas-design` | Arte visual estática .png/.pdf museum-quality |
| `img-gen` | Router: decide OpenAI vs Google, crafta prompt, spawna agente certo |
| `blender` | 3D modeling e automação no Blender via MCP; PolyHaven/Sketchfab |
| `comfyui/core` · `comfyui/io` · `comfyui/deploy` | Nodes ComfyUI: estrutura, inputs/outputs, packaging |

### Dev *(backend: stacks + infraestrutura)*

| Skill | O que faz |
|-------|-----------|
| `laravel-specialist` | Laravel 10+: Eloquent, Sanctum, Horizon, Livewire, API Resources |
| `php-pro` | PHP 8.3+: strict typing, PHPStan L9, DTOs, PSR standards |
| `postgres-pro` | PostgreSQL: EXPLAIN, JSONB, replication, VACUUM, performance |
| `nodejs` | Node.js/TypeScript Hono-first: routing, Zod, middleware, CF Workers/Bun |
| `flutter` | Flutter 3+: testing, security, release pipeline, Riverpod, Mockito |
| `saas-patterns` | Multi-tenant Laravel 11: stancl/tenancy, feature flags, Cashier, Horizon isolation |
| `file-storage` | S3 + Cloudflare R2: presigned URLs, ClamAV, CDN, isolamento multi-tenant |
| `reverb-realtime` | Laravel Reverb + Echo: broadcasting, canais private/presence, produção |
| `auth-security` | Router: OWASP / Better Auth / Laravel auth |
| `transactional-email` | Router: email transaccional por provider (Postmark) |
| `observability` | Router: Sentry / structured logging |
| `search` | Meilisearch/Typesense/Algolia: index, faceted filtering, instant search |
| `realtime` | WebSocket + SSE: reconnect, heartbeat, optimistic updates, auth |
| `queues` | Router: BullMQ / Laravel Horizon |
| `webhooks` | HMAC verification, idempotency, retry patterns |

### Tools *(stack-agnostic)*

| Skill | O que faz |
|-------|-----------|
| `api-designer` | REST/GraphQL API design: OpenAPI, versioning, pagination, error handling |
| `devops-engineer` | CI/CD, Docker, Kubernetes, Terraform, GitHub Actions |
| `test-master` | Pest/PHPUnit, unit/integration/E2E, coverage, performance |
| `webapp-testing` | Testes Playwright: browser automation, console, element discovery |
| `browser-use/browser-use` · `browser-use/remote-browser` · `browser-use/open-source` · `browser-use/cloud` | Automação browser via CLI e Python lib |
| `google-analytics` | Queries GA4: overview, pages, sources, devices, realtime |
| `microsoft-clarity` | Analytics Clarity via Composio MCP (heatmaps, sessions) |

### Marketing

`paid-ads` · `seo` · `seo-local` · `email-sequence` · `content-strategy` · `social-content` · `copywriting` · `page-cro` · `ab-test-setup` · `brand-positioning` · `analytics-tracking` · `launch-strategy` · `competitor-profiling`

### Vídeo

`video` (router) · `hyperframes` (HTML+GSAP→vídeo, TTS Kokoro, Whisper) · `remotion` (vídeo React programático, useCurrentFrame, spring)

### WordPress *(activar só em projectos WP)*

`wordpress-router` · `wp-block-development` · `wp-block-themes` · `wp-plugin-development` · `wp-rest-api` · `wp-performance` · `wp-phpstan` · `wp-playground` · e mais

### Shopify *(activar só em projectos Shopify)*

`shopify-router` · `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`

---

## Agentes disponíveis

Agentes correm em sub-processos isolados, em paralelo.

### Review & Testing
| Agente | O que faz |
|--------|-----------|
| `prd-reviewer` | Revê PRD.md em 5 dimensões; score /100; veredito PASS/NEEDS_WORK/FAIL |
| `tester-code` | Revê código contra plano e standards; Critical/Important/Suggestions |
| `tester-accessibility` | WCAG 2.1/3.0, screen readers, keyboard nav, ARIA |
| `tester-ui-ux` | Testa fluxos UI/UX; relatório defeitos com severidade e fixes |
| `tester-performance` | Lighthouse CI, Core Web Vitals, bundle size, k6 load tests |
| `tester-security` | CVE scan, secrets detection (gitleaks), HTTP headers |
| `tester-api` | Testa endpoints REST: happy path, auth, schema, edge cases, perf baseline |
| `codex-review` | Code review adversarial via Codex CLI (OpenAI GPT/o3) |

### Search & Analysis
| Agente | O que faz |
|--------|-----------|
| `deep-research` | Pesquisa web multi-fonte; Firecrawl+WebSearch; relatório citado MD+HTML+PDF |
| `seo-analyst` | Crawl + auditoria técnica SEO (CWV, schema, meta, sitemap, E-E-A-T) |
| `log-analyst` | Lê logs Laravel/Nginx, identifica padrões de erro, spikes, slow queries |
| `dependency-auditor` | CVEs + packages desactualizados + deps não usadas; plano de update priorizado |

### Debug
| Agente | O que faz |
|--------|-----------|
| `log-debugger` | Lê stack trace, encontra root cause no código, sugere fix específico |
| `query-debugger` | EXPLAIN plans, missing indexes, N+1 patterns, rewrite queries |
| `error-detective` | Correlação cross-service, anomaly detection, cascade analysis, five-whys |
| `laravel-debugger` | Debug Laravel-específico: Eloquent, queues, events, routes, Tinker |
| `load-testing-expert` | k6 + Artillery; smoke/load/stress/spike/soak; SLA thresholds |

### Deploy & Publish
| Agente | O que faz |
|--------|-----------|
| `deploy-forge` | Deploy via Laravel Forge CLI; confirmação obrigatória antes de produção |
| `github-releaser` | Cria GitHub releases com release notes geradas do git log |
| `wp-publisher` | Cria/actualiza posts e páginas WordPress via WP-CLI |
| `gmail-sender` | Redige e envia emails via Gmail MCP; preview e confirmação obrigatória |

### Geração & Media
| Agente | O que faz |
|--------|-----------|
| `img-gen-openai` | Gera imagens com gpt-image-2; texto em imagens, produtos, inpainting |
| `img-gen-google` | Gera imagens com Gemini (Nano Banana); cenas gerais, drafts baratos |
| `watch` | Analisa vídeos (URL ou local): frames + transcrição WhisperX local |
| `gemini-brain` | Análise multimodal via Gemini CLI: vídeo, PDF, contexto 1M tokens |

### Especialistas
| Agente | O que faz |
|--------|-----------|
| `flutter-expert` | Apps Flutter 3+ cross-platform: UI, state management, nativo, performance |
| `payment-integration` | Stripe, Cashier, MB Way, PCI DSS, subscriptions, fraud prevention |
| `skill-improver` | Melhora SKILL.md: triggers, instruções, formato |
| `skill-evaluator` | Avalia SKILL.md em 5 dimensões; JSON score/verdict/feedback |

---

## Commands

| Command | Função |
|---------|--------|
| `/install` | Setup interactivo numa máquina nova |
| `/init-project` | Liga um projecto ao JOCA |
| `/resume` | Carrega contexto no início da sessão |
| `/save` | Guarda estado no fim da sessão |
| `/feedback-joca` | Captura gaps no workflow JOCA desta sessão |
| `/feedback-projeto` | Actualiza docs do projecto com aprendizagens da sessão |
| `/upgrade-joca` | Lê feedback acumulado e implementa melhorias ao JOCA |
| `/update-joca` | Verifica e aplica updates do repositório oficial GitHub |
| `/review-code` | Code review + adversarial via Codex |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | Triage de erros + skill do stack detectado |
| `/create-skill [desc]` | Cria nova skill via pipeline self-improving |
| `/create-skill --upgrade [nome]` | Melhora skill existente |
| `/wp-perf-review [path]` | Code review WP completo |
| `/wp-perf [path]` | Quick triage WP |
| `/help-joca` | Referência rápida de todos os comandos, agentes e skills |

---

## MCPs configurados

| MCP | Uso |
|-----|-----|
| `github` | Issues, PRs, repos |
| `mermaid` | Diagramas técnicos |
| `blender` | 3D modeling e renderização |
| `huggingface` | Modelos e datasets open-source |
| `playwright` | Browser automation e testes E2E |
| `firecrawl` | Web scraping (self-hosted, Docker) |
| `gmail` · `google-calendar` · `google-drive` | Google Workspace (OAuth) |
| `lunar-docs` | Documentação Lunar PHP |
| `wordpress/mcp-adapter` | Gestão de conteúdo WP (WP 6.8+) |

Guia de decisão completo: [`memory/tools/mcp-routing.md`](memory/tools/mcp-routing.md)

---

## Knowledge Graph

O JOCA integra com [graphify](https://github.com/safishamsi/graphify) para mapear código, documentação e designs em grafos semânticos persistentes — elimina releituras repetidas entre sessões.

```bash
# Instalar
pip install graphifyy && graphify install

# Gerar / actualizar grafo do projecto actual (usar sempre a Python API — CLI tem bugs)
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"

# Grafo global: JOCA + todos os projectos activos numa rede ligada
python3 .claude/scripts/graphify-global.py

# Re-gerar tudo do zero
python3 .claude/scripts/graphify-global.py --refresh

# Output: graphify-out/global/graph.json + GRAPH_REPORT.md + graph.html
```

O grafo global liga automaticamente os nós JOCA (skills, agentes, commands) aos ficheiros de cada projecto activo via uma ponte filesystem — uma única rede navegável. Projectos descobertos via `memory/projects/*.md`.

Após actualizar graphify: `bash .claude/scripts/graphify-patch.sh`

---

## Créditos

Skills e agentes construídos sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, iSerter, rshah515, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`CREDITOS.md`](CREDITOS.md).

---

**Repositório público:** [github.com/MirrasPT/JOCA](https://github.com/MirrasPT/JOCA)

> Licença dos componentes individuais pertence aos autores originais. JOCA como sistema de integração: MIT.

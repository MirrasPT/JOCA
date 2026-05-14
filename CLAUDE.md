# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# JOCA

## Fonte de verdade
JOCA é Claude-first. `CLAUDE.md`, `.claude/`, `memory/INDEX.md` e `memory/tools/` são canónicos.
`AGENTS.md` existe só como ponte para ferramentas externas que procuram esse nome. Não criar lógica principal fora de `.claude/`.

## Comunicação
Terse. Sem artigos, filler, hedging. Fragmentos OK. Termos técnicos exactos. Código intacto.
Desactivar: "stop caveman" / "normal mode". Auto-clarify em: avisos de segurança, acções irreversíveis, sequências onde ordem importa.

## Código
1. **Pensar primeiro** — expõe assumptions; múltiplas interpretações = apresentar antes de escolher; incerto = pergunta
2. **Simplicidade** — mínimo código; sem features não pedidas; sem abstrações para uso único
3. **Cirúrgico** — toca só o necessário; não "melhora" código adjacente; mantém estilo existente
4. **Verificável** — define critérios de sucesso antes de começar; multi-step: plano com check por step

## Estrutura do repositório

```
JOCA/
├── CLAUDE.md                   ← comportamento base (este ficheiro)
├── install.md                  ← script interactivo de instalação
├── README.md                   ← documentação pública
├── CREDITOS.md                 ← créditos e origens das skills
├── JOCA_UI/                    ← browser UI para Claude Code (terminal multi-sessão)
│   ├── frontend/               ← React + Vite + TypeScript
│   ├── backend/                ← Node.js + Express + WebSocket + node-pty
│   ├── data/projects.json      ← projectos configurados no UI
│   └── CLAUDE.md               ← contexto do sub-projecto JOCA_UI
├── memory/
│   ├── INDEX.md                ← índice de skills, agentes e ferramentas
│   ├── projects/               ← entrada por projecto (criado por /save)
│   ├── feedback/               ← sessões /feedback-joca
│   └── tools/                  ← graphify, mcp-routing, laravel-stack, motion
└── .claude/
    ├── commands/               ← /install /init-project /resume /save /plan /debug /review-* /wp-perf*
    ├── agents/                 ← tester-*, img-gen-*, watch, gemini-brain, codex-review, deep-research, ...
    ├── skills/
    │   ├── base/               ← caveman, karpathy-guidelines, agent-context, create-skill, feedback-joca, pt-pt-translator
    │   ├── created-skills/     ← directório reservado para /create-skill (actualmente vazio)
    │   ├── design/             ← frontend-design (framework/*), frontend-dev, brand-guidelines, graphic-design, slides, anima (gsap/*, lottie-animator/), canvas-design, img-gen, comfyui/*, blender
    │   ├── dev/                ← backend puro: stacks + infraestrutura
    │   │   ├── laravel-specialist/ · php-pro/ · postgres-pro/ · flutter/ · nodejs/
    │   │   ├── saas-patterns/  ← multi-tenant Laravel 11, stancl/tenancy, feature flags, Cashier
    │   │   ├── file-storage/   ← S3/R2, presigned URLs, ClamAV, CDN, multi-tenant isolation
    │   │   ├── reverb-realtime/ ← Laravel Reverb + Echo, broadcasting, channels, produção
    │   │   ├── auth-security/  ← router + owasp/ + better-auth/ + auth-laravel/
    │   │   ├── transactional-email/ ← router + postmark/
    │   │   ├── observability/  ← router + sentry/ + structured-logging/
    │   │   ├── search/         ← Meilisearch + Algolia + Typesense
    │   │   ├── realtime/       ← WebSocket + SSE (genérico)
    │   │   ├── queues/         ← router + bullmq/ + horizon/
    │   │   ├── webhooks/       ← HMAC, idempotency, retry
    │   │   ├── wordpress/      ← activar só em projectos WP
    │   │   └── shopify/        ← activar só em projectos Shopify
    │   ├── tools/              ← ferramentas stack-agnostic
    │   │   ├── api-designer/   ← REST/GraphQL design
    │   │   ├── devops-engineer/ ← CI/CD, Docker, K8s, Terraform
    │   │   ├── test-master/    ← Pest/PHPUnit/k6, cobertura, performance
    │   │   ├── webapp-testing/ ← Playwright: browser automation, UI testing
    │   │   ├── browser-use/    ← automação browser: CLI, remote, Python lib, Cloud API
    │   │   ├── google-analytics/ ← queries GA4
    │   │   └── microsoft-clarity/ ← heatmaps, sessions via Composio MCP
    │   ├── marketing/          ← paid-ads, seo, seo-local, email-sequence, content-strategy, copywriting, page-cro, ab-test-setup, brand-positioning, analytics-tracking, launch-strategy, competitor-profiling, social-content
    │   └── video/              ← video, hyperframes/*, remotion/
    ├── scripts/
    │   └── gemini-generate.py  ← geração de imagens via Gemini
    └── settings.json
```

## Adicionar skill / agente / comando

**Skill:** criar `.claude/skills/<categoria>/<nome>.md` com frontmatter `name`, `description`, triggers. Adicionar entrada em `memory/INDEX.md`.

**Agente:** criar `.claude/agents/<nome>.md`. Disponível via `Agent(subagent_type="<nome>")`. Adicionar entrada em `memory/INDEX.md`.

**Comando:** criar `.claude/commands/<nome>.md`. Disponível como `/<nome>` no Claude Code.

## Contexto e Agentes
Sub-agentes isolam contexto, não dividem papéis. Custo real ~15x tokens. Cap supervisor: 3-5 workers.
Comprimir a 70-80% — antes da degradação, não depois. Método: anchored iterative (sumariza só span novo, nunca re-sumariza o summary).
U-curve: info crítica no início e fim. Meio perde 10-40% recall — nunca colocar instruções importantes no centro.
Tema diferente = sugerir `/compact`. Novo contexto limpo bate correcções em cascata.

**Brief obrigatório ao invocar agentes:** Todo o agente recebe no prompt: (1) objectivo da tarefa em 2 frases, (2) ficheiros/paths relevantes, (3) constraints do projecto (stack, standards), (4) o que NÃO fazer. Agente sem brief começa em folha em branco — resultado genérico.

## Skills e Agentes

Skills por categoria: `design/` · `dev/` · `tools/` · `marketing/` · `video/` · `base/`

### Regra: activar sem pedir

Relevância ≥ 60% → activar directamente, sem confirmação, sem "quer que eu use X?".
Notificar em 1 linha no início da resposta: `[skill: laravel-specialist]` ou `[agente: tester-code]`.
Sem match → responder directamente.

**Hierarquia:** skill especializada > agente > resposta genérica.
Nunca responder genericamente quando existe skill para o mesmo domínio.

**`plan` skill — activação por complexidade:**
Auto-activar antes de executar quando a tarefa tiver ≥ 2 de: ≥3 ficheiros envolvidos · passos com dependências · decisão de arquitectura · feature nova · pedido ambíguo · scope > 20 min. Sinal verbal: "planeia", "arquitectura de", "como faríamos", "implementa X e Y e Z", "migra", "reestrutura".

### Trigger Map

| Detectado na tarefa | Activa |
|---|---|
| Laravel · Eloquent · Artisan · `composer.json` | `laravel-specialist` |
| PHP · PHPStan · strict types · Pest | `php-pro` |
| PostgreSQL · EXPLAIN · índices · replication | `postgres-pro` |
| Flutter · Dart · `pubspec.yaml` · Riverpod · BLoC | `flutter-expert` (agente) |
| React · Next.js · Vue · Svelte · produção frontend | `frontend-dev` |
| HTML prototype · mockup · hi-fi · wireframe | `frontend-design` |
| GSAP · ScrollTrigger · timeline · animação | `anima` |
| Lottie · ícones animados · JSON animation | `anima` (sub: lottie-animator) |
| Remotion · lyric video · vídeo React programático | `remotion` |
| slides · apresentação · pitch deck · 1920×1080 | `slides` |
| Blender · 3D · PolyHaven · modelação | `blender` |
| gerar imagem · foto · ilustração · image gen | `img-gen` |
| vídeo URL · analisar vídeo · transcrever | `watch` (agente) |
| PDF grande · contexto 1M tokens · multimodal | `gemini-brain` (agente) |
| WordPress · WooCommerce · Gutenberg · `wp-content/` | `wordpress-router` |
| Shopify · Liquid · Admin API · `shopify.app.toml` | `shopify-router` |
| Node.js · Hono · TypeScript API · Bun | `nodejs` |
| auth · login · JWT · OAuth · sessões · 2FA | `auth-security` (router) |
| Stripe · pagamento · subscriptions · MB Way | `payment-integration` (agente) |
| deploy · Forge · CI/CD · Docker · Kubernetes | `devops-engineer` |
| SEO · meta tags · schema · Core Web Vitals | `seo` |
| SEO local · Google Business Profile · NAP | `seo-local` |
| copywriting · landing page · headline · CTA | `copywriting` |
| email sequence · nurture · onboarding · re-engagement | `email-sequence` |
| paid ads · Facebook Ads · Google Ads · LinkedIn | `paid-ads` |
| CRO · conversão · friction · heatmap · quick wins | `page-cro` |
| brand · posicionamento · ICP · diferenciação | `brand-positioning` |
| lançamento · Product Hunt · go-to-market · launch | `launch-strategy` |
| concorrentes · market research · competitive | `competitor-profiling` |
| logs · stack trace · error · root cause · analyze logs · log patterns · spike in errors · cascade failure · Laravel debug · Eloquent issue · queue failing | `log-debugger` (agente) |
| N+1 · query lenta · EXPLAIN · missing index | `query-debugger` (agente) |
| load test · k6 · stress test · spike test · soak · SLA validation · performance under load | `tester-performance` (agente) |
| webhook · HMAC · idempotency · retry | `webhooks` |
| S3 · R2 · upload · CDN · presigned URLs | `file-storage` |
| Reverb · Echo · broadcast · WebSocket Laravel | `reverb-realtime` |
| Meilisearch · Algolia · Typesense · full-text search | `search` |
| queues · jobs · BullMQ · Horizon · workers | `queues` (router) |
| SaaS · multi-tenant · tenancy · tenant isolation | `saas-patterns` |
| OpenAPI · REST design · GraphQL · API spec | `api-designer` |
| Playwright · browser test · E2E · automação UI | `webapp-testing` |
| GA4 · Google Analytics · UTM · tracking plan | `google-analytics` |
| brand identity · DESIGN.md · cores · tipografia · tokens | `brand-guidelines` |
| print · roll-up · flyer · poster · PDF impressão | `graphic-design` |
| canvas · HTML Canvas · 2D canvas · WebGL | `canvas-design` |
| social media · posts · conteúdo social · Instagram · LinkedIn | `social-content` |
| email transaccional · SMTP · Postmark · email de boas-vindas | `transactional-email` |
| ComfyUI · nodes · AI image workflow | `comfyui/core` |
| PRD · documento de requisitos · especificação produto | `prd` |
| revê PRD · valida PRD · PRD completo? | `prd-reviewer` (agente) |
| planeia · arquitectura de · como faríamos · migra · reestrutura | `plan` (auto) |

### Stack auto-detection

Ao entrar num projecto (via `/resume` ou ao ler ficheiros), activar sem pedir:

| Sinal detectado | Skill |
|---|---|
| `artisan` + `composer.json` com Laravel | `laravel-specialist` |
| `pubspec.yaml` | `flutter` / `flutter-expert` |
| `wp-content/` ou `functions.php` | `wordpress-router` |
| `shopify.app.toml` | `shopify-router` |
| `package.json` com `remotion` | `remotion` |
| `package.json` com `hono` | `nodejs` |

### Quality gates (sugestão automática)

Após implementar, sugerir em 1 linha no fim da resposta — não correr automaticamente:

| Tarefa concluída | Sugestão |
|---|---|
| Código implementado | "Queres `tester-code`?" |
| Endpoints criados | "Queres `tester-api`?" |
| Design / HTML implementado | "Queres `tester-ui-ux`?" (cobre UI/UX + acessibilidade WCAG) |
| Deploy configurado | "Queres `tester-security`?" |
| Performance duvidosa | "Queres `tester-performance`?" (Lighthouse + load test) |

### Pipelines

Workflows completos do início ao fim. Claude segue a sequência ao detectar o tipo de tarefa.

| Workflow | Sequência |
|---|---|
| Nova feature Laravel | `plan` → `laravel-specialist` → `tester-code` → `tester-api` |
| SaaS / multi-tenant | `plan` → `saas-patterns` → `laravel-specialist` → `tester-security` |
| Protótipo UI | `frontend-design` → `tester-ui-ux` |
| Frontend produção | `plan` → `frontend-dev` → `tester-performance` → `tester-security` |
| API design + implementação | `plan` → `api-designer` → `laravel-specialist` → `tester-api` |
| Debug sessão | `log-debugger` → `query-debugger` (se SQL) |
| Deploy | `devops-engineer` → `tester-security` → `deploy-forge` |
| Nova skill JOCA | `deep-research` → `create-skill` |

**Regra de activação:** ao detectar o tipo de tarefa (pela linguagem do pedido ou contexto do ficheiro), activar o primeiro skill/agente da sequência. Ao concluir cada passo, notificar o próximo com `→ próximo: [nome]`.

### Como activar uma skill

**NUNCA usar `Skill("<nome>")` para skills em categorias** — o Skill tool só descobre profundidade 1 (`.claude/skills/<nome>/SKILL.md`). Skills em `.claude/skills/<categoria>/<nome>/SKILL.md` são invisíveis ao Skill tool.

Activar = **ler o ficheiro directamente**:
```
Read(".claude/skills/<categoria>/<nome>/SKILL.md")
```

Exemplos:
- `frontend-design` → `Read(".claude/skills/design/frontend-design/SKILL.md")`
- `laravel-specialist` → `Read(".claude/skills/dev/laravel-specialist/SKILL.md")`
- `php-pro` → `Read(".claude/skills/dev/php-pro/SKILL.md")`

`Skill()` válido apenas para: comandos (`/debug`, `/save`, `/plan`, etc.) e a skill `video` (profundidade 1).

## Knowledge Graph
Se `graphify-out/GRAPH_REPORT.md` existir: consultar antes de arquitectura/catálogo. Detalhes: `graphify-out/graph.json`.
Actualizar (CLI tem bugs — usar sempre API Python):
```bash
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path>'))"
```

## MCP
`blender` · `github` (`GITHUB_PERSONAL_ACCESS_TOKEN`) · `mermaid` · `huggingface` (`HF_TOKEN`) · `playwright` · `firecrawl` (localhost:3002) · `lunar-docs` · `gmail` · `google-calendar` · `google-drive` · `wordpress/mcp-adapter` (WP 6.8+)

## Commands
| Command | Função |
|---|---|
| `/review-code` | tester-code + codex-review adversarial opcional |
| `/review-design` | UI/UX + acessibilidade em paralelo |
| `/plan` | Plan Mode — arquitectura |
| `/debug` | triage de erros + skill do stack detectado |
| `/create-skill [desc]` | nova skill: research → draft → improve → evaluate |
| `/create-skill --upgrade [nome]` | melhorar skill existente |
| `/install` | setup JOCA numa máquina nova |
| `/init-project` | inicializar projecto real |
| `/resume` | carregar contexto + knowledge graph |
| `/save` | guardar estado + actualizar knowledge graph |
| `/wp-perf-review [path]` | code review WP completo (Critical/Warning/Info) |
| `/wp-perf [path]` | quick triage WP — issues críticos |
| `/upgrade-joca` | lê feedback acumulado → lista upgrades → implementa após confirmação |
| `/update-joca` | compara local com repositório oficial GitHub → aplica updates após confirmação |

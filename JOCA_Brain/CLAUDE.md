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
   - 1 domínio + **1 ficheiro** + reversível + skill match ≥60% → **Read() a skill ANTES de escrever código**. Notify: `[skill: <name>]`.
   - 1 domínio especialista + trabalho isolável (review/debug/research/deploy) **ou 2 ficheiros isolados** → **delegar a 1 agente** com brief obrigatório.
   - ≥2 domínios em paralelo OU ≥2 ficheiros paralelizáveis OU feature completa OU cross-stack → **workflow** via `/goal` (**default do sistema**: na dúvida, delegar — o principal orquestra, os agentes escrevem o código) (master-orchestrator com GOAL + loop). Se casar uma **pipeline nomeada** → o **auto-runner** corre-a a fundo (`rules/pipelines.md`): cada passo a fundo, auto-decide reversíveis, gate só em irreversível, encadeia via `chain:` (`rules/chaining.md`). Irreversível → 1 linha de confirmação primeiro.
   Check trigger map abaixo — Laravel/Filament/frontend/etc. têm skills.
2b. **Plano?** Via D · acção irreversível · ≥3 ficheiros · feature nova → **plano visível ANTES** do primeiro `Write`/`Agent()` (tabela em `rules/task-intake.md` → "Plano antes de executar"). Via A/B reversível → não planeia, age.
   ⚠ **Dois limiares diferentes, de propósito:** fan-out a partir de **≥2 ficheiros paralelizáveis**; plano escrito só a partir de **≥3 ficheiros** (ou irreversível/feature nova). Um fan-out de 2 streams delega-se sem redigir plano — a fronteira de ficheiros por agente vai no brief. Fonte de verdade dos números: `rules/task-intake.md` §Thresholds + §Plano antes de executar.
2c. **Doutrina de projecto** — em qualquer projecto (não só nos do `/start`): issue antes de código · design antes de UI · testes em sessão separada · `PROGRESSO.md` + `docs/DECISIONS.md` actualizados. Tabela em `rules/pipelines.md` §Doutrina de projecto.
3. **Scope clear?** yes → execute · ambiguous → 2 interpretations, ask choice
4. **Token cost?** <100 tokens → inline · >100 + agent available → delegate
5. **Validation?** code changed → queue auto-test · config changed → show diff

## Repository Structure
`memory/` — `soul.md` (personality, `@import`ed) · `INDEX.md`+`SKILL_INDEX.json` (component index) · `projects/`+`feedback/` (per-project, by `/save`).
`.claude/` — `skills/` (flat, depth 1) · `rules/` (global directives — task-intake/pipelines/chaining/orchestration/api-design/workflows-and-tooling) · `commands/` · `agents/` · `hooks/` (auto-test) · `scripts/` · `settings.json`.
⚠ `.claude/` é **canónico**; `.agents/` e `.codex/` são **espelhos compilados** que publicam à mesma —
qualquer edição a skills/agentes exige `bash .claude/scripts/compile-bridges.sh`, senão divergem em
silêncio (já sobreviveram host/utilizador/chave SSH reais num espelho depois de limpos na fonte).
Add a **skill** = `.claude/skills/<name>.md` (frontmatter `name`+`description`, add to `INDEX.md`) · **agent** = `.claude/agents/<name>.md` (`Agent(subagent_type=…)`) · **command** = `.claude/commands/<name>.md` (`/<name>`).

## Context & Agents
Sub-agents isolate context, not divide roles. Real cost ~15x tokens. Cap supervisor 3-5 workers. Compress at 70-80% (anchored iterative). U-curve: critical info at start+end, middle loses 10-40% recall.
**Mandatory brief:** every agent gets (1) objective in 2 sentences, (2) relevant files/paths, (3) project constraints, (4) what NOT to do.

## Skills
Flat in `.claude/skills/`. Activate via `Read(".claude/skills/<name>.md")`. Lazy: `SKILL_INDEX.json` holds the light index (name/path/triggers); skills load on-demand, never pre-loaded. Regenerate: `python .claude/scripts/build-skill-index.py` (Windows: `python`, não `python3`).

### Skill inline OU agente de execução
Cada skill de **execução** tem um agente gémeo em `.claude/agents/<skill>-agent.md` (65). O agente lê a skill como Step 0 — mesma doutrina, contexto próprio. Para o mesmo trabalho:
- **1 parte trivial** → `Read()` a skill, faz inline (barato, imediato).
- **≥2 partes independentes** → despacha `<skill>-agent` para cada, **no mesmo turno** (paralelo real, ~15x tokens cada, principal fica livre).

Escolher de propósito: serializar trabalho paralelizável custa tempo em cada pedido; despachar um agente para mudar uma cor custa 15x por nada. Gate de valor + armadilhas em `rules/task-intake.md`. Regenerar agentes: `node .claude/scripts/skill-agents.mjs` (a lista curada de skills de execução vive no topo do script).

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
| design system · sistema de design · criar design system do zero · fundação visual · contrato visual | `design-system` (router — brand-guidelines → design-tokens → component-system) |
| brand guidelines · DESIGN.md · BRAND.md · identidade visual · paleta de marca · tom de voz | `brand-guidelines` |
| design tokens · tokens.css · DTCG · Style Dictionary · escala de espaçamento · z-index | `design-tokens` |
| inventário de componentes · spec de componente · estados do componente · anatomia do componente · UI kit | `component-system` |
| responsivo · PWA · bottom sheet · thumb zone · breakpoint · gesto swipe | `mobile` |
| Laravel · Eloquent · Artisan | `laravel-specialist` |
| Filament · admin panel · backoffice · CMS · widget · infolist | `filament` |
| scaffold filament · build resource from model · admin for model | `filament-builder` (agent) |
| connect admin to frontend · Inertia · Sanctum SPA · share types | `laravel-react` |
| refactor laravel · dead code · optimize · Larastan · scale | `laravel-refactor` (agent) |
| security code review · IDOR · mass assignment · OWASP | `security-review` (agent) |
| GSAP · ScrollTrigger · animation | `anima` |
| Remotion · video React | `remotion` |
| que ferramenta para este vídeo · AI avatar · talking head · HeyGen · Veo/Runway/Kling · produção de vídeo | `video` (router) |
| HyperFrames · vídeo em HTML · composição de vídeo · title card · caption sync · overlay animado | `hyperframes` |
| Lottie · lottie.json · animar SVG · ícone animado · trim path · loading animation | `lottie-animator` |
| Blender · 3D · .blend · bpy · malha · modelo 3D · render 3D | `blender` (director — CLI headless, routes to scripting/render) |
| bpy · script Blender · importar/exportar 3D · glTF/GLB/FBX/OBJ/STL/USD · batch .blend · modificadores | `blender-scripting` |
| render 3D · Cycles · EEVEE · turntable · material PBR · iluminar cena 3D · câmara 3D | `blender-render` |
| slides · pitch deck | `slides` |
| roll-up · flyer · folheto · cartaz · trifold · brochura · material impresso · sangria/bleed | `graphic-design` |
| generate image · illustration | `img-gen` |
| gerar vídeo · voiceover · TTS · música · SFX · vectorizar · raster→SVG · upscale · remove background | `picsart` (gen-ai CLI) |
| generate video · video clip · motion | `video-gen` (agent — ⚠ o `agy` NÃO gera vídeo; rota para gen-ai/ComfyUI/HyperFrames) |
| upscale · ampliar imagem · aumentar resolução · restaurar imagem · imagem para print · ESRGAN | `image-upscale` |
| captura de site · screenshot limpo · screenshot full-page · QA visual · extrair imagem de print/mockup | `site-capture` |
| html to pdf · exportar PDF · PDF de 1 página · print-to-pdf · print-CSS A4 | `html-to-pdf` |
| publicar repo público · open source release · scrub antes de publicar · o que vai sair no push · sanitizar repo · push para repo de cliente · entregar código a terceiros · primeiro push para remote novo | `public-release-audit` |
| WordPress · WP · Gutenberg · plugin WP · tema WP · block theme · WP-CLI · Playground | **`wordpress-router`** (porta única — classifica o repo e encaminha para `wp-project-triage` · `wp-plugin-development` · `wp-block-development` · `wp-block-themes` · `wp-interactivity-api` · `wp-rest-api` · `wp-abilities-api` · `wp-wpcli-and-ops` · `wp-performance` · `wp-performance-review` · `wp-phpstan` · `wp-playground` · `blueprint` · `wp-plugin-directory-guidelines` · `wpds`) |
| WooCommerce + Elementor · `_elementor_data` · HFE · storefront editável · content-product.php | `woocommerce-elementor` |
| Shopify · Liquid · Dawn · theme.liquid · app Shopify · auditar loja | **`shopify-router`** (porta única — `shopify-app` · `shopify-theme` · `shopify-store-audit` · `shopify-store-fixer`) |
| Wix · Wix CLI · dashboard extension | `wix-cli` |
| auth · JWT · OAuth · 2FA | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| ifthenpay · Multibanco · MB WAY · pagamento PT | `portugal-payments` |
| Moloni · faturação · fatura · nota de crédito · IVA PT | `portugal-invoicing` |
| SEO · meta tags · Core Web Vitals | `seo` |
| SEO local · Google Business Profile · GBP · map pack · NAP · citações locais · perto de mim | `seo-local` |
| copywriting · landing page · CTA | `copywriting` |
| AI slop · soa a AI · escrito por AI · limpar a escrita · polir copy · de-slop | `stop-slop` |
| traduzir para PT-PT · português de Portugal · localizar UI · registo tu/você · rever português | `pt-pt-translator` |
| email sequence · drip · nurture | `email-sequence` |
| plano de publicação · calendário social · rollout · lançamento · captions · agendamento | `content-calendar` |
| agendar/publicar post · publicar nas redes · TryPost · carrossel IG · publicar TikTok · executar campanha social | `social-scheduler` |
| marketing · plano de marketing · como crescer · mais clientes · por onde começo no marketing · funil de marketing | `marketing` (router — posicionamento/landing/leads/email/ads/SEO/social/CRO) |
| posicionamento · proposta de valor · ICP · para quem é isto · mensagem-chave · diferenciação | `brand-positioning` |
| construir landing page · squeeze page · opt-in page · página de captura · página de webinar | `landing-page` |
| lead magnet · crescer lista de email · formulário de opt-in · popup de captura · content upgrade | `lead-capture` |
| Product Hunt · go-to-market · beta launch · anúncio de feature · plano de lançamento | `launch-strategy` |
| perfil de concorrente · analisar concorrência · competitive intelligence · quem são os meus concorrentes | `competitor-profiling` |
| estratégia de conteúdo · sobre o que escrever · topic clusters · pilares de conteúdo · ideias de blog | `content-strategy` |
| post LinkedIn · thread Twitter/X · Reels · TikTok · hook do post · repurposing de conteúdo | `social-content` |
| Notion · ntn · tarefa Notion · base de dados/data source Notion · workspace de clientes | `notion` |
| lyric sync · forced alignment · letra sincronizada · LRC/ASS · timestamps de voz | `lyric-align` |
| browser automation · litegraph · conduzir app web local · Playwright headless | `browser-automate` |
| paid ads · Facebook Ads | `paid-ads` |
| CRO · conversion · heatmap | `page-cro` |
| plano de tracking · GA4 · GTM · eventos de conversão · UTM · auditar tracking | `analytics-tracking` |
| gtag.js · GA4 Data API · runReport · DebugView/Realtime · consent mode · quantas visitas teve o site | `google-analytics` |
| Clarity · gravação de sessão · rage click · dead click · profundidade de scroll | `microsoft-clarity` |
| A/B test · teste A/B · split test · variante · significância estatística · sample size | `ab-test-setup` |
| logs · stack trace · error | `log-debugger` (agent) |
| N+1 · slow query · EXPLAIN | `query-debugger` (agent) |
| load test · k6 · stress | `tester-performance` (agent) |
| webhook · HMAC · idempotency | `webhooks` |
| S3 · R2 · upload · CDN | `file-storage` |
| SaaS · multi-tenant · tenancy | `saas-patterns` |
| desenhar endpoints · OpenAPI/Swagger · RFC 9457 · versionar API · paginação de API · contrato de API | `rest-api` |
| índice composto · covering index · SARGable · InnoDB · utf8mb4 · deadlock · desenhar schema MySQL | `mysql` |
| Cache::remember · invalidação de cache · Cache-Control · ETag · stale-while-revalidate · TTL | `caching` |
| Meilisearch · Typesense · Algolia · full-text search · pesquisa facetada · tolerância a erros de escrita | `search` |
| que fila usar · comparar BullMQ vs Horizon · background jobs (escolher stack) | `queues` (router — bullmq · horizon) |
| BullMQ · fila Redis em Node · worker Node · dead letter queue · job atrasado/agendado (Node) | `bullmq` |
| Horizon · ShouldQueue · supervisor · failed jobs · job chaining/batching · fila Laravel | `horizon` |
| backup · disaster recovery · failover · read replica · RTO/RPO · zero-downtime migration · maintenance mode | `availability` |
| Reverb · Laravel Echo · WebSocket · broadcasting · ShouldBroadcast · canal de presença | `reverb-realtime` |
| Telescope · Debugbar · Ignition · Ray · Pail · Clockwork · ver queries no browser | `error-tracking-dev` |
| Sentry · Flare · logging estruturado JSON · correlation ID · health check · alerta de erro | `error-tracking-prod` |
| OWASP Top 10 · XSS · CSRF · SQL injection · CSP/HSTS · hardening · está seguro? | `security` (skill — review profundo de código → `security-review` agente; auditoria completa → `cso`) |
| que provider de email transaccional · SPF/DKIM/DMARC · bounce handling · deliverability | `transactional-email` (router — postmark) |
| Postmark · message stream · webhook de bounce · template Postmark · suprimir hard bounce | `postmark` |
| testes · unit/integration/E2E · coverage · flaky test · QA · quality gate · test strategy | `test-master` |
| PRD · requirements | `prd` |
| planeamento de projecto · que documento fazer primeiro · documentação do projecto · kick off · antes de escrever código | `planning` (router — prd · tech-spec · adr · c4-diagram · task-breakdown · rfc · html-review) |
| ADR · decisão arquitectural · porque escolhemos X · regista esta decisão · alternativas consideradas | `adr` |
| RFC · proposta de mudança · breaking change · cross-cutting · afecta múltiplos módulos | `rfc` |
| C4 · diagrama de contexto/container/componente · diagrama Mermaid · como o sistema se estrutura | `c4-diagram` |
| TECH_SPEC.md · especificação técnica · modelo de dados · component breakdown · diagrama de sequência | `tech-spec` |
| TASKS.md · quebrar em tarefas · epics · stories · estimativa · sprint planning · RICE | `task-breakdown` |
| gerar HTML do PRD/plano · documento para revisão · preview do plano · render markdown | `html-review` |
| /start · projecto novo · arrancar do zero · criar produto novo · ligar projecto ao JOCA | `start` (entrevista por formularios + PRD + stack da casa + direccao de design; entrada unica de qualquer projecto, novo ou existente). ⚠ A **forma de trabalho** que ela instala e global e nao depende deste comando — `rules/pipelines.md` §Doutrina de projecto |
| executar projeto · constroi o projecto · avanca para a execucao | `executar-projeto` (fundacao → design 2 vias → gate → desenvolvimento em ondas) |
| novo issue · criterios de aceitacao · abrir issue · backlog | `novo-issue` |
| planear ondas · organizar backlog · milestones · por onde comeco | `planear-ondas` |
| desenhar ecra · mockup · briefing de design · ecra novo | `preparar-design` (entrega o mockup como Artifact) |
| validar mockup · o design bate certo · posso implementar este ecra | `validar-design` |
| escrever testes do issue · testes a partir dos criterios | `escrever-testes` (sessao separada da implementacao) |
| plan · architecture · migrate · feature nova · ≥3 ficheiros · migration/deploy/delete | `plan` (auto — gate em `rules/task-intake.md`) |
| claude-agent-sdk · agent sdk · programmatic claude · subscription claude · zero-cost claude · JOCA_OS backend · createSdkMcpServer | `agent-sdk` |
| enqueue_workflow not running · comfyui mcp bug · workflow crashes via MCP · start_comfyui fails · comfy plugin | `comfy-mcp-workarounds` |
| JOCA_OS no Windows · node-pty · PowerShell PTY · install/upgrade Windows | `joca-os-windows` |
| comenta na tarefa · fecha a tarefa · cria uma tarefa · move a tarefa · abre um terminal · fala com o outro terminal | `joca-terminal` |
| consumo de tokens alto · outra máquina · instalação antiga · consolidar JOCA · limpar instalação · várias versões do JOCA nesta máquina | `/clean-install` |
| classificar tarefa · que via · skill ou agente ou workflow · preciso de workflow? | `task-router` (agent) |
| freeze · trancar edições · lock scope · só editar esta pasta | `freeze` (guard-rail) |
| careful · avisa antes de apagar · modo cauteloso · destrutivo | `careful` (guard-rail) |
| guard · modo seguro · segurança máxima · lock it down | `guard` (guard-rail) |
| tdd · test first · testes primeiro · red green · força testes | `tdd` (guard-rail) |
| unfreeze · destrancar · remover lock · desligar guard/tdd | `unfreeze` (guard-rail) |
| pack codebase · empacotar repo · repo num ficheiro · contexto para agente/gemini · repomix | `context-pack` |
| orquestrar sub-agentes · brief de agente · fan-out · contexto perdido · quantos workers | `agent-context` |
| disciplina de código · evitar overengineering · erros típicos de LLM a programar | `karpathy-guidelines` |
| criar skill nova · melhorar uma skill · upgrade de skill | `create-skill` (`/create-skill`) |
| caveman mode · fala como caveman · menos tokens · sê breve · normal mode | `caveman` (modo) |
| encadear skills · próximo passo · auto-delegação · auto-runner · pipeline corre sozinha | `rules/chaining.md` + `rules/pipelines.md` |
| registar decisão · guardar aprendizagem · o que decidimos · didn't we fix this | `/learn` (Brain log) |
| plano completo revisto · autoplan · planear a sério | `/autoplan` |
| retro · retrospectiva · o que correu bem/mal · revisão semanal | `/retro` |
| explorar variantes de design · opções de design · brainstorm visual · não gosto do look | `design-shotgun` |
| codificar o design · mockup → HTML · implementar este design · fazer o mockup real | `design-html` |
| ao nível de X · tão bom como · benchmark contra um produto real · gauntlet · aim prompt · loop até ficar perfeito | `gauntlet-loop` (`/gauntlet-loop`) |
| ship · push para main · abrir PR · está pronto envia | `/ship` |
| cso · auditoria de segurança · threat model · STRIDE · OWASP review | `cso` |
| mapear conhecimento · como tudo se liga · grafo de skills/agentes/projectos · mapa do JOCA | `/map-joca` |
| o que as pessoas dizem · últimos 30 dias · sinal social · recon antes de reunião · trending real · Reddit/X/YouTube | `/last30days` (plugin externo) |
| ingerir conhecimento · /know · guardar isto · PDF/YouTube/Instagram/artigo · segundo cérebro | `knowledge-ingest` (agent + skill) |
| ler email · resumo de emails · caixa de entrada · calendário · marcar evento | `personal-comms` (agent + skill) |
| reparar PR · resolver conflitos · CI vermelho · reviews de bot | `pr-repair` (agent) |
| deploy VPS · VPS setup · Caddy · SSH key VPS · Cloudflare DNS API · scp site · bootstrap SSH · publicar VPS | `deploy-vps` |
| cPanel · UAPI · addon domain · gerir hosting · conta de email cPanel · zona DNS cPanel · criar subdomínio | `cpanel` |
| media stack · *arr · Jellyfin · Jellyseerr · Sonarr/Radarr/Prowlarr · qBittorrent · self-hosted media | `selfhosted-arr` |
| public_html · Passenger · 503 Passenger · Setup Node.js App · restart.txt · .htaccess · hosting partilhado | `deploy-cpanel` |
| Dockerfile · docker compose · multi-stage build · Traefik · containerizar · registry de imagem | `deploy-docker` |
| Ploi · ploi.io · provisionar servidor · deploy script · atomic/zero-downtime deploy · daemon de fila | `deploy-ploi` |
| Cloudflare DNS · Email Routing · SPF merge · MX Cloudflare · reencaminhar email domínio · registo DNS por API | `cloudflare-dns` |
| deploy · publicar site · correr pipeline de deploy | `deploy-executor` (agent) |
| corrigir a11y · WCAG fix · acessibilidade | `a11y-fixer` (agent) |
| dívida técnica · tech debt · medir ganho · LOC poupado | `tech-debt-auditor` (agent) |
| simplificar · YAGNI · menos dependências · código mínimo | `yagni` |
| GitHub Actions · CI · workflow yml · gh pr · branch protection · Dependabot · release | `github` |
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
| `/start` | arranque de projecto: entrevista → PRD → stack → direcção de design → `executar-projeto` (entrada única, novo ou existente) |
| `/executar-projeto` | a execução do `/start`: E1 fundação → E2 design → E3 gate ⏸ → E4 ondas → produção |
| `/resume` | load context + knowledge graph |
| `/save` | save state + update graph + auto-feedback |
| `/plan` | Plan Mode — architecture |
| `/debug` | error triage + stack skill |
| `/one-shot` | autonomous dev: PRD → orchestrator → agents → tests |
| `/goal` | auto-orquestração a partir de tarefa NL (sem PRD) → master-orchestrator em loop |
| `/autoplan` | plano completo auto-revisto (produto → design → eng) — corre a pipeline a fundo, gate final |
| `/learn` | memória institucional do Brain (decisões/aprendizagens event-sourced + recall) |
| `/retro` | retrospectiva: aprendizagens da janela → acções |
| `/gauntlet-loop` | reformula qualquer pedido num workflow contra uma referência real: fan-out + crítico severo + comparação cega, sem paragem automática |
| `/ship` | levar código a PR: sync → testes → review diff → version/CHANGELOG → gate → push → PR |
| `/map-joca` | mapa de conhecimento (skills/agentes/comandos/projectos + chains) → graph.html interactivo via graphify |
| `/know` | ingerir conteúdo na Knowledge Base (markitdown → resumo → tags) |
| `/build-plan` | supervised phased build: plano em docs → tasks por fase → loop com gate de testes |
| `/review-code` | tester-code + codex adversarial |
| `/review-design` | UI/UX + accessibility |
| `/create-skill [desc]` | new skill via research pipeline |
| `/help-joca` | quick reference |
| `/migrate` | v1-legacy → v2.0 migration guide |
| `/clean-install` | audita instalações JOCA existentes (possivelmente várias na mesma máquina), compara com o baseline, propõe optimizações de tokens, consolida memória, arquiva o antigo em `Old/`, promove instalação nova |
| `/upgrade-joca` | feedback → self-improvement → apply |
| `/update-joca` | sync with GitHub (protects `origin: local`) |
| `/status` | show rate limits, model and context inline |
| `/joca-doctor` | diagnóstico da instalação (`.claude/scripts/joca-doctor.mjs`; `--fix` aplica correcções seguras; exit 1 se houver ✗) |
| `/wp-perf` | quick WordPress performance triage |
| `/wp-perf-review` | WordPress code review |

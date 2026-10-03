# Trigger Map — detecção → skill

<!-- gerado por .claude/scripts/trigger-map-gen.mjs (anotações: trigger-map-notas.json) — não editar à mão -->

Referência **on-demand** — não é auto-carregada. O encaminhamento a cada mensagem é o hook
`.claude/hooks/prompt-triage.js` sobre `memory/SKILL_INDEX.json`; esta tabela serve para consulta
e alimenta as pontes `AGENTS.md`/`GEMINI.md` (`compile-bridges.sh`), que não têm o hook.

## Trigger Map
Sufixo = tipo do componente: **sem sufixo → skill** (`.claude/skills/`); `(agent)`, `(rule)`, `(modo)`, `(auto)`, `(agent + skill)`, `(plugin externo)` → o que diz. Tabela gerada: anotar em `.claude/scripts/trigger-map-notas.json`, nunca à mão.
<!-- TRIGGER-MAP:INICIO -->
| Detected | Activates |
|---|---|
| website · landing page · site · webapp | `frontend` (director — routes to code specialists) |
| react performance · re-render · useEffect · server component | `react-patterns` |
| compound component · component api · boolean props · prop proliferation | `react-composition` |
| oklab · tailwind · tailwindcss · utility classes | `tailwind` |
| shadcn · components.json · radix component · drawer | `shadcn` |
| design review · review design · is this good · critique UI | `design-review` |
| CSS variables · DTCG · Style Dictionary · escala de espaçamentos | `design-system` (núcleo — tokens e componentes em reference/ · marca → brand-guidelines · auditoria → design-system-audit) |
| nome para a app · como chamar isto · preciso de um nome · sugere nomes | `brand-guidelines` |
| responsivo · responsive · mobile · touch | `mobile` |
| Laravel · Eloquent · Artisan · composer.json | `laravel-specialist` |
| Filament · admin · backoffice · Resource | `filament` |
| scaffold filament · build resource from model · admin for model | `filament-agent` (agent — scaffold de resource; ex-`filament-builder`) |
| laravel react · connect admin to frontend · ligar admin ao frontend · inertia | `laravel-react` |
| refactor laravel · dead code · optimize · Larastan · scale | `laravel-refactor` (agent) |
| security code review · IDOR · mass assignment · OWASP | `security-review` (agent) |
| trim path · animacao · animation · gsap | `anima` (dona da animação — GSAP e Lottie, incl. gerar JSON a partir de SVG, em reference/) |
| vídeo · video · slideshow · legendas | `video` (router — HyperFrames por defeito · Remotion só em projecto existente · AI gen · avatares) |
| bpy · batch blend · renderizar · cycles | `blender` (núcleo — CLI headless · scripting e render em reference/) |
| slides · apresentação · presentation · deck | `slides` |
| montagem de fotos · colagem de fotos · mosaico de fotos · montagem estática | `graphic-design` |
| generate image · create image · illustration · product shot | `img-gen` |
| generate video · video clip · animate image · voiceover | `picsart` (gen-ai CLI) |
| generate video · video clip · motion | `video-gen` (agent — ⚠ o `agy` NÃO gera vídeo; rota para gen-ai/ComfyUI/HyperFrames) |
| upscale · ampliar imagem · aumentar resolução · restaurar imagem | `image-upscale` |
| vectorizar · raster para vector · raster to vector · PNG para SVG | `raster-para-vector` |
| publicar repo público · open source release · release público · scrub PII | `public-release-audit` |
| unit/integration/E2E · coverage · flaky test · test strategy | `escrever-testes` (ex-`test-master`; ⚠ sessão separada da implementação) |
| WPDS · @wordpress/components · wpress · ai1wm | **`wp-index`** (porta única — lista e encaminha para as 12 skills `wp-*`; WPDS em `wpds.md`) |
| que tipo de projecto WP é este | `wp-project-triage` |
| block invalid · block.json · create-block | `wp-block-development` |
| site editor · template parts · template part · style variations | `wp-block-themes` |
| WordPress Interactivity API | `wp-interactivity-api` |
| criar plugin WP · settings page · nonces/capabilities | `wp-plugin-development` |
| plugin directory guidelines · GPL compliance · license header · plugin submission | `wp-plugin-directory-guidelines` |
| WordPress REST API · CPTs | `wp-rest-api` |
| abilities API · ability not visible | `wp-abilities-api` |
| wp search-replace · migração de domínio · wp db | `wp-wpcli-and-ops` |
| WordPress performance review · optimization audit WordPress · slow WordPress · slow queries WordPress | `wp-performance` |
| PHPStan · WordPress | `wp-phpstan` |
| Playground blueprint · blueprint.json · run-blueprint · Playground steps | `wp-playground` |
| elementor · woocommerce · HFE · wpforms | `woocommerce-elementor` |
| Shopify | `shopify-router` |
| shopify app init · checkout extension · admin extension | `shopify-app` |
| Shopify · Liquid · Dawn · Theme Check | `shopify-theme` |
| Shopify · Core Web Vitals · SEO · AEO | `shopify-store-audit` |
| fix shopify store · bulk update products · apply audit fixes | `shopify-store-fixer` |
| Wix · dashboard extension · wix.config.json · Velo | `wix-cli` |
| auth · authentication · login · logout | `auth` |
| Stripe · payments · subscriptions | `payment-integration` (agent) |
| ifthenpay · Multibanco · MB WAY · pagamento Portugal | `portugal-payments` |
| Moloni · faturação · fatura · invoice Portugal | `portugal-invoicing` |
| RGPD · GDPR · consentimento · cookie banner | `gdpr-compliance` |
| SEO audit · technical SEO · why am I not ranking · traffic dropped | `seo` |
| write copy for · improve this copy · rewrite this page · marketing copy | `copywriting` |
| stop slop · AI slop · soa a AI · parece AI | `stop-slop` |
| traduzir para PT-PT · localizar UI · rever português | `pt-pt-translator` |
| email sequence · drip campaign · nurture sequence · onboarding emails | `email-sequence` |
| content calendar · social calendar · plano de publicacao · calendario social | `content-calendar` |
| agendar post · publicar nas redes · schedule social post · trypost | `social-scheduler` |
| marketing · grow my business · get more customers · como crescer | `marketing` (router — posicionamento/landing/leads/email/ads/SEO/social/CRO) |
| positioning · value proposition · who is this for · how do I describe my product | `brand-positioning` |
| landing page · lead gen page · squeeze page · opt-in page | `landing-page` |
| lead magnet · grow email list · opt-in form · email capture | `lead-capture` |
| launch · Product Hunt · feature release · announcement | `launch-strategy` |
| competitor profile · competitor research · competitor analysis · profile this competitor | `competitor-profiling` |
| content strategy · what should I write about · content ideas · blog strategy | `content-strategy` |
| LinkedIn post · Twitter thread · social media · engagement | `social-content` |
| local SEO · Google Business Profile · GBP · map pack | `seo-local` |
| Notion · ntn · workspace de clientes | `notion` |
| lyric sync · lyric timestamps · karaoke timing · forced alignment | `lyric-align` |
| Playwright canvas · automate ComfyUI · drive litegraph · page.evaluate workflow | `browser-automate` |
| captura de site · screenshot limpo · screenshot full-page · QA visual | `site-capture` |
| html to pdf · exportar PDF · PDF de 1 página · print-to-pdf | `html-to-pdf` |
| gravar o ecrã · screen recording · screen-record · gravar demo | `screen-record` |
| run ads · ad campaign · Facebook ads · Google ads | `paid-ads` |
| CRO · conversion rate · page not converting · my landing page isn't working | `page-cro` |
| ga4 · gtag · consent mode · utm | `analytics-tracking` |
| A/B test · split test · experiment · test this change | `ab-test-setup` |
| logs · stack trace · error | `log-debugger` (agent) |
| N+1 · slow query · EXPLAIN | `query-debugger` (agent) |
| load test · k6 · stress | `tester-performance` (agent) |
| webhook · signature verification · idempotency · svix | `webhooks` |
| file upload · S3 · R2 · presigned URL | `file-storage` |
| multi-tenancy Laravel · tenant isolation · feature flags SaaS · subscription tiers gate | `saas-patterns` |
| API design · REST API · endpoint · OpenAPI | `rest-api` |
| MySQL · query lenta · slow query · EXPLAIN | `mysql` |
| cache · caching · Redis · Cache::remember | `caching` |
| search · meilisearch · typesense · algolia | `search` |
| bullmq · bull board · delayed jobs · jobs agendados | `queues` (dona — BullMQ em reference/bullmq.md · Laravel → horizon) |
| laravel queue · laravel queues · laravel jobs · filas laravel | `horizon` |
| backup · backups · failover · replication | `availability` |
| real-time · WebSockets · broadcasting · Reverb | `reverb-realtime` |
| debugbar · telescope · ignition · ray | `error-tracking-dev` |
| sentry · flare · production logging · structured logging | `error-tracking-prod` |
| security · segurança · vulnerabilidade · vulnerability | `security` (skill — review profundo de código → `security-review` agente; auditoria completa → `seguranca` / `/seguranca`) |
| postmark · react email · @react-email · email template | `transactional-email` (núcleo do email — Postmark e React Email em reference/) |
| PRD · requirements doc · product spec | `prd` |
| planear · planning · como comecar · how to start | `plan` (auto) |
| C4 · diagrama de arquitectura · architecture diagram · container diagram | `c4-diagram` |
| RFC · request for comments · proposta de mudanca · change proposal | `tech-spec` |
| gerar html · review html · html do prd · html review | `html-review` |
| start · novo projeto · comecar projeto · arrancar projeto | `start` (entrevista por formulários + PRD + stack da casa `rules/stack-padrao.md` + direcção de design; absorve o `/init-project`) |
| executar projeto · avanca para a execucao · constroi o projecto · executa o plano do start | `executar-projeto` (fundação → design 2 vias → gate → desenvolvimento em ondas) |
| novo issue · criar issue · abrir issue · issue no GitHub | `novo-issue` |
| quebrar em tarefas · break into tasks · breakdown · estimativa | `planear-ondas` |
| preparar design · desenhar ecra · briefing de design · fazer o ecra | `preparar-design` (entrega o mockup em HTML local, aberto no browser) |
| validar design · validar o mockup · o mockup esta bom · rever o ecra | `validar-design` |
| mocking · mocks · cobertura de testes · testes unitarios | `escrever-testes` (⚠ sessão separada da implementação) |
| enqueue_workflow not running · comfyui mcp bug · workflow crashes via MCP · start_comfyui fails | `comfy-mcp-workarounds` |
| joca os windows · joca windows · node-pty windows · powershell joca | `joca-os-windows` |
| comenta na tarefa · fecha a tarefa · marca como feito · cria uma tarefa | `joca-terminal` |
| caveman mode · talk like caveman · use caveman · less tokens | `caveman` (modo) |
| consumo de tokens alto · outra máquina · instalação antiga · consolidar JOCA · limpar instalação · várias versões do JOCA nesta máquina | `/clean-install` |
| classificar tarefa · que via · skill ou agente ou workflow · preciso de workflow? | `task-router` (agent) |
| freeze · trancar edicoes · trancar edições · lock scope | `freeze` (guard-rail) |
| careful · modo cauteloso · avisa antes de apagar · cuidado destrutivo | `careful` (guard-rail) |
| guard · modo seguro · seguranca maxima · segurança máxima | `guard` (guard-rail) |
| tdd · test first · testes primeiro · red green | `tdd` (guard-rail) |
| unfreeze · destrancar · remover lock · desligar guard | `unfreeze` (guard-rail) |
| pack codebase · empacotar repo · pack context · context pack | `context-pack` |
| organizar pasta · arrumar ficheiros · renomear ficheiros · limpar pasta | `file-organization` |
| encadear skills · próximo passo · auto-delegação · auto-runner · pipeline corre sozinha | `.claude/rules/chaining.md` + `.claude/rules/pipelines.md` |
| registar decisão · guardar aprendizagem · o que decidimos · didn't we fix this | `/learn` (Brain log) |
| plano completo revisto · autoplan · planear a sério | `/autoplan` |
| criar skill · nova skill · melhorar skill · upgrade skill · create skill | `/create-skill` (command — a skill tem `disable-model-invocation`, só o utilizador a invoca; `--upgrade <nome>` melhora uma existente) |
| retro · retrospectiva · o que correu bem/mal · revisão semanal | `/retro` |
| explorar variantes · variantes de design · opções de design · design shotgun | `design-shotgun` |
| codificar design · transformar em HTML · construir página · implementar design | `design-html` |
| gauntlet · aim prompt · prompt do Shumer · ao nível de | `gauntlet-loop` (`/gauntlet-loop`) |
| ship · push para main · abrir PR · está pronto envia | `/ship` |
| /seguranca · auditoria de segurança · security audit · security review completo | `seguranca` |
| o que as pessoas dizem · últimos 30 dias · sinal social · recon antes de reunião · trending real · Reddit/X/YouTube | `/last30days` (plugin externo) |
| /know · guardar isto · knowledge base · segundo cérebro | `knowledge-ingest` (agent + skill) |
| ler email · resumir inbox · enviar email · responder email | `personal-comms` (agent + skill) |
| reparar PR · resolver conflitos · CI vermelho · reviews de bot | `pr-repair` (agent) |
| Laravel SPA mesmo origin · 403 depois do rsync · deploy VPS · VPS setup | `deploy-vps` |
| cloudflare dns · email routing · registo dns · spf merge | `cloudflare-dns` |
| email nao recebe · mx spf dkim cloudflare · autossl certificado · cpanel | `cpanel` |
| media stack · arr stack · *arr · selfhosted | `selfhosted-arr` |
| stderr.log · SetEnv htaccess · shared hosting · hosting partilhado | `deploy-cpanel` |
| docker · container · Dockerfile · VPS | `deploy-docker` |
| ploi · deploy · ploi.io · deployment | `deploy-ploi` |
| github · CI · workflow · pipeline | `github` |
| deploy · publicar site · correr pipeline de deploy | `deploy-executor` (agent) |
| corrigir a11y · WCAG fix · acessibilidade | `a11y-fixer` (agent) |
| dívida técnica · tech debt · medir ganho · LOC poupado | `tech-debt-auditor` (agent) |
| disciplina de codigo · alteracao cirurgica · coding discipline · avoid overengineering | `yagni` |
| auto-orquestração · quando disparar workflow · subagentes | `orchestration-patterns` (rule) |
| checksum · dígito de controlo · check digit · validar nif | `algoritmo-de-terceiros` |
| coordenadas de toque android · input tap · screencap · adb | `android-adb` |
| jetpack compose · kotlin android · app android nativa · android nativo kotlin | `android-compose` |
| auditoria site publicado · SPA fallback · curl da 200 mas esta partido · XHR real | `auditoria-site-live` |
| click path · botao nao faz nada · botão não faz nada · clico e nao acontece | `click-path-audit` |
| analytics cloudflare · quantas visitas · isto são bots · tráfego do site | `cloudflare-analytics` |
| colei um token · token colado · credencial · credential | `credential-handling` |
| testar app electron ao vivo · sessão de testes com o dono · gate de runtime electron · janela real vs curl verde | `electron-teste-ao-vivo` |
| email-dashboard · ve o meu email · dashboard do email · dashboard da inbox | `email-dashboard` |
| fact-check · verifica os factos · verificar factos · confirmar factos | `fact-check` |
| tratar fotos de produto · foto de produto real · fotografia de produto · corrigir foto de telemóvel | `foto-produto` |
| h3 prompt · prompt minimax · prompt H3 · MiniMax H3 | `h3-prompt-writing` |
| favicon · ícone da marca · app icon · icon set | `icon-design` |
| fatiar · slicer cli · gcode · editar 3mf | `impressao-3d` |
| /marketeer · ciclo de marketing · marketing da marca · marketing do cliente | `marketeer` |
| /marketeer-review · review de marketing · rever campanhas · resultados das campanhas | `marketeer-review` |
| meshy · meshy.ai · gerar modelo 3d · criar modelo 3d | `meshy` |
| imprimibilidade · imprimivel · watertight · estanque | `meshy-3d-print` |
| auditoria · auditar · baseline · métricas atuais | `mkt-auditoria` |
| verificar acessos · conectores · matriz de acessos · acesso às contas | `mkt-conectores` |
| mkt-copy · copys da campanha · copy da campanha · textos dos anúncios | `mkt-copy` |
| artes da campanha · criativos · F3 marketeer · brief criativo | `mkt-criativos` |
| email marketing · newsletter · campanha de email · sequência de emails | `mkt-email` |
| mkt-estrategia · proposta de marketing · estratégia de marketing · plano de campanhas | `mkt-estrategia` |
| google business profile · gbp · perfil empresarial google · ficha google maps | `mkt-gbp` |
| google ads · campanha search · campanha google · performance max | `mkt-google-ads` |
| linkedin ads · campaign manager · campanha linkedin · sponsored content | `mkt-linkedin-ads` |
| perfil da marca · voz da marca · tom de voz · estilo de escrita | `mkt-marca` |
| mkt-medicao · medição · tracking · UTM | `mkt-medicao` |
| análise de mercado · concorrentes · concorrência · ad library | `mkt-mercado` |
| meta ads · facebook ads · instagram ads · ads manager | `mkt-meta-ads` |
| orgânico · publicações orgânicas · posts orgânicos · calendário de publicações | `mkt-organico` |
| psicologia · persuasão · gatilhos mentais · vieses cognitivos | `mkt-psicologia` |
| relatório · proposta html · resumo executivo · report | `mkt-relatorio` |
| mutation testing · teste de mutação · testes de mutação · partir o código de propósito | `mutation-testing` |
| pacote de testes · pacote executável · preparar entrega para terceiro · enviar projecto para testar | `pacote-entrega` |
| preencher formulario pdf · preencher pdf com campos · checkbox acroform · need_appearances | `pdf-form-fill` |
| redigir pdf · redact pdf · tarjar · tarja preta | `pdf-redaction` |
| ronda de teste · questionário local · banco de provas · checklist de teste | `questionario-local` |
| admin Shopify pelo browser · configurar loja Shopify pelo browser · importar CSV Shopify · csv de import Shopify | `shopify-admin-browser` |
| source-driven · documentacao oficial · documentação oficial · segue a documentacao | `source-driven-development` |
| gerar musica no suno · suno.com · criar no suno · suno hcaptcha | `suno` |
<!-- TRIGGER-MAP:FIM -->

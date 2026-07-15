# /init-project — Inicializar Projecto

Liga um projecto ao JOCA. Corre este comando a partir da pasta do projecto.
Segue as fases abaixo uma de cada vez — aguarda resposta antes de avançar.

**Modo de apresentação:**
- Perguntas com ≤4 opções exclusivas → usar a ferramenta `AskUserQuestion` (selector visual com setas)
- Perguntas com mais de 4 opções ou multi-select → apresentar lista e aguardar input de texto

---

## Verificação inicial

```bash
node --version 2>/dev/null || echo "node_unavailable"
graphify --version 2>/dev/null || echo "graphify_unavailable"
```

Se node não disponível: avisar "Node.js é necessário. Instala primeiro." e parar.
Se graphify não disponível: avisar que knowledge graph não estará disponível, mas continuar (é opcional).

---

## FASE 1 — Contexto do projecto

**Q1 — Natureza do projecto** *(branch cedo — define todo o fluxo)*
`AskUserQuestion`:
```
question: "Que tipo de trabalho é este projecto?"
header: "Natureza"
options:
  - "Dev (código) — construir/manter software"
  - "Conteúdo / Marketing — site ou canal existente (copy, SEO, conteúdo)"
```

- **Dev** → fluxo completo (graphify + stack/backend/db). Continua para Q2.
- **Conteúdo / Marketing** → SALTAR graphify e perguntas de stack/backend/db. Ir direto para **Q2-C** abaixo, depois **FASE 2** (rota copy/SEO/content).

---

### Branch [C] — Conteúdo / Marketing

Projecto = site/canal existente. Sem código a manter. Não correr graphify nem perguntas de stack.

**Q2-C — Plataforma e foco**
Lista numerada:
```
Onde vive o conteúdo e qual o foco?
[1] Wix (site existente, editor)        → browser + Wix Stores REST API
[2] WordPress (site existente)          → copy/SEO sobre WP
[3] Shopify (loja existente)            → copy/SEO + auditoria loja
[4] Site genérico / landing             → copy/SEO/CRO
[5] Canal social / email                → social/email
[6] Outro: ___
```

Pré-seleccionar skills de conteúdo conforme escolha:
- (1) Wix → `wix-cli` (secção Backend/REST: Wix Stores REST API via browser/HTTP), `seo`, `seo-local`, `copywriting`, `content-strategy`
- (2) WordPress → `seo`, `copywriting`, `content-strategy` (sem dev WP)
- (3) Shopify → `shopify-store-audit`, `seo`, `copywriting`
- (4) Genérico → `copywriting`, `landing-page`, `page-cro`, `seo`
- (5) Social/email → `social-content`, `email-sequence`, `copywriting`

Continua para **FASE 2** (saltar Q3–Q7 e CLIs de dev).

---

### Fluxo Dev — Estado do projecto

*(só se Q1 = Dev)*

**Q2 — Estado do projecto**
`AskUserQuestion`:
```
question: "Este projecto já tem código ou estrutura?"
header: "Estado"
options:
  - "Já tem código / estrutura existente"
  - "Projecto novo (a começar do zero)"
```

- "Já tem código" → **Branch [A]**.
- "Projecto novo" → **Branch [B]**.

---

### Branch [A] — Projecto Existente

*(só fluxo Dev)*

Correr scan:
```bash
# Windows: `python` (o `python3` e o stub vazio da Store); macOS/Linux: `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify_unavailable"
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "no_claude_md"
```

Apresentar resumo do detectado:
```
Detectei:
  Stack:     [detectado]
  Descrição: [detectada]
  Fase:      [detectada]
  Estrutura: [resumo graphify — god nodes, comunidades]

Está correcto? Corrige o que estiver errado.
```

Confirmar com `AskUserQuestion`:
```
question: "O resumo detectado está correcto?"
header: "Confirmar"
options:
  - "Sim, avançar"
  - "Não, deixa-me corrigir"
```

Continua para **FASE 2**.

---

### Branch [B] — Projecto Novo

**Q3 — Nome do projecto**
Texto livre: "Nome do projecto?"

**Q4 — Tipo de projecto**
Lista numerada (>4 opções):
```
Que tipo de projecto é?
[1] Website / App / Software
[2] WordPress
[3] Shopify
[4] Wix
[5] Design
[6] Vídeo
[7] Research / Análise
[8] Marketing
[9] Outro: ___
```

> Sub-perguntas de stack/tipo abaixo numeradas Q5+ (deslocadas de Q4+).

### Sub-branch: Website / App / Software

**Q4 — Frontend** *(multi-select)*
```
Que tecnologias de frontend usas? (selecciona todas as que se aplicam)
[ ] Vanilla HTML/CSS/JS
[ ] React
[ ] Vue
[ ] Next.js / Nuxt
[ ] Flutter
[ ] Nenhum
[ ] Outro: ___
```

**Q5 — Backend** *(multi-select)*
```
[ ] PHP puro   [ ] Laravel   [ ] Node.js / Express
[ ] Python     [ ] Rails     [ ] Nenhum   [ ] Outro: ___
```

**Q6 — Base de dados** *(multi-select)*
```
[ ] SQLite   [ ] MySQL/MariaDB   [ ] PostgreSQL
[ ] MongoDB  [ ] Supabase/Firebase   [ ] Nenhuma   [ ] Outro: ___
```

**Q7 — Deploy**
Lista numerada:
```
[1] Vercel / Netlify
[2] cPanel
[3] VPS
[4] AWS / GCP / Azure
[5] Ainda não sei
[6] Outro: ___
```

### Sub-branch: WordPress

**Q4 — Tipo de trabalho WP** *(multi-select)*
```
[ ] Plugin
[ ] Tema (block theme)
[ ] Tema (clássico)
[ ] Bloco Gutenberg
[ ] Site completo (FSE)
[ ] Headless (REST/GraphQL)
[ ] Outro: ___
```

**Q5 — Extras** *(multi-select)*
```
[ ] WooCommerce   [ ] Multisite   [ ] WP-CLI disponível   [ ] Nenhum
```

> **⚠ WooCommerce — desligar "coming soon" à cabeça.** O onboarding recente do WooCommerce activa `woocommerce_coming_soon=yes` por defeito → a loja inteira serve o placeholder "Great things are on the horizon" e o loop de produtos vem vazio no front-end (mesmo com produtos publicados/instock e query OK). Se WooCommerce for seleccionado, correr logo:
> ```bash
> wp option update woocommerce_coming_soon no
> wp option update woocommerce_store_pages_only no
> ```
> (Fonte: projecto WooCommerce 2026-06-23 — custou diagnóstico longo.)

**Q6 — Ambiente local**
Lista numerada:
```
[1] WP Playground
[2] Local by Flywheel
[3] MAMP / WAMP
[4] Docker
[5] Staging/Prod directo
[6] Outro: ___
```

**Q7 — Deploy**
Lista numerada:
```
[1] cPanel   [2] WP Engine   [3] Kinsta   [4] VPS   [5] WordPress.com   [6] Outro: ___
```

### Sub-branch: Shopify

**Q4 — Tipo de trabalho Shopify** *(multi-select)*
```
[ ] App (integração externa, multi-loja, lógica programática)
[ ] Extensão (checkout UI, admin UI, POS, customer account, Shopify Functions)
[ ] Tema (Online Store 2.0 / Liquid)
[ ] Auditoria de loja (SEO, conversão, AEO/GEO)
[ ] Outro: ___
```

**Q5 — Deploy**
Lista numerada:
```
[1] Shopify App Store (público)
[2] App privada / custom app
[3] Shopify Plus (merchant)
[4] Tema — loja do cliente
[5] Outro: ___
```

### Sub-branch: Wix

**Q5 — Modo Wix** *(define dev vs conteúdo)*
Lista numerada:
```
Que tipo de trabalho Wix?
[1] Site existente no Wix Editor       → conteúdo/copy/SEO
[2] Wix CLI app / headless             → dev
[3] Velo + git                         → dev
```

- **(1) Editor existente** → fluxo CONTEÚDO. Saltar stack/backend/db e CLIs de dev.
  Skills: `wix-cli` (secção Backend/REST — Wix Stores REST API via browser/HTTP), `seo`, `seo-local`, `copywriting`, `content-strategy`.
  Acesso: browser (Playwright) + Wix Stores REST API. Não há repo local a indexar.
- **(2) Wix CLI app / headless** → fluxo DEV. Skills: `wix-cli`. CLI: `@wix/cli`.
- **(3) Velo + git** → fluxo DEV. Skills: `wix-cli`. CLI: `@wix/cli` (Velo sync via git).

### Sub-branch: Design

**Q4** *(multi-select)*:
```
[ ] UI/UX   [ ] Branding   [ ] Motion/Animação   [ ] Print/Large format   [ ] Ilustração   [ ] Outro
```

**Q5** *(multi-select)*:
```
[ ] Protótipos HTML   [ ] SVG/Figma   [ ] Lottie   [ ] Assets PNG/WebP   [ ] PDF   [ ] Outro
```

### Sub-branch: Vídeo

**Q4** *(multi-select)*:
```
[ ] Social media   [ ] Explainer   [ ] Documental   [ ] Tutorial   [ ] Outro
```

**Q5** *(multi-select)*:
```
[ ] AI video   [ ] Remotion   [ ] Edição tradicional   [ ] Legendas locais   [ ] Outro
```

### Sub-branch: Research

**Q4**:
```
[1] Mercado   [2] Tecnologia   [3] Conteúdo/SEO   [4] Científico   [5] Outro
```

**Q5** *(multi-select)*:
```
[ ] Relatório MD/PDF   [ ] Resumo executivo   [ ] Tabela comparativa   [ ] JSON/CSV   [ ] Outro
```

### Sub-branch: Marketing

**Q4** *(multi-select)*:
```
[ ] SEO   [ ] Google Ads   [ ] Meta Ads   [ ] LinkedIn   [ ] Email   [ ] Social orgânico   [ ] Outro
```

**Q5**:
```
[1] Leads   [2] E-commerce   [3] Brand awareness   [4] Retenção   [5] Outro
```

---

## FASE 2 — Skills e gaps

Com base no tipo de projecto, pré-seleccionar áreas relevantes:

| Tipo                    | Áreas sugeridas                                                              |
|-------------------------|------------------------------------------------------------------------------|
| Website/App (genérico)  | `frontend`, `tailwind`, `shadcn`, `react-patterns`, `react-composition`, `rest-api`, `auth`, `yagni`, Analytics (+ agent `a11y-fixer`) |
| Laravel / SaaS          | `laravel-specialist`, `filament`, `laravel-react`, `saas-patterns`, `auth`, `security`, `mysql`, `queues`/`horizon`, `file-storage`, `caching`, `webhooks`, `error-tracking-dev`/`error-tracking-prod`, `yagni` (+ agents `tech-debt-auditor`, `pr-repair`) |
| E-commerce (PT)         | + `portugal-payments` (ifthenpay/MB WAY), `portugal-invoicing` (Moloni), `payment-integration` (agent) |
| Email transacional      | `react-email`, `transactional-email`, `postmark`                            |
| Deploy / DevOps         | `deploy-docker`, `deploy-ploi`, `deploy-cpanel`, `github` (+ agents `deploy-executor`, `pr-repair`) |
| WordPress               | `wordpress-router`, `wp-project-triage` (+ wp-* conforme trabalho), Analytics |
| Shopify                 | `shopify-router` (+ shopify-* conforme trabalho), Analytics                 |
| Wix — dev (CLI/Velo)    | `wix-cli`, Analytics                                                         |
| Wix — Editor (conteúdo) | `wix-cli` (REST/Stores), `seo`, `seo-local`, `copywriting`, `content-strategy` |
| Conteúdo / Marketing    | `seo`, `copywriting`, `content-strategy`, `content-calendar` (+ `page-cro`/`social`/`email` cf. canal) |
| Design UI/UX greenfield | `frontend`, `brand-guidelines`, `mobile` (+ agent `a11y-fixer`)              |
| Design UI/UX iteração   | `frontend`, `brand-guidelines`                                               |
| Design Motion/Animação  | `anima` (GSAP + Lottie), `frontend`                                          |
| Design Print            | `graphic-design`, `brand-guidelines`                                         |
| Vídeo                   | `video`, `hyperframes`, `remotion`, `lyric-align` (sync de letra)            |
| Research                | `deep-research`, `knowledge-ingest` (`/know`), Analytics                     |
| Marketing               | Marketing/SEO, Analytics                                                     |
| Automação / Scraping    | `browser-use`, `browser-automate` (apps web locais/litegraph), Desenvolvimento web |

**Nota disambiguation design:** se o projecto já tem `DESIGN.md` ou `PRODUCT.md` → activar também `brand-guidelines`. Se greenfield → `frontend`.

**Nota autonomia (global, todos os tipos):** a auto-orquestração (`rules/task-intake.md`, 4 vias) e o `/goal` aplicam-se a qualquer projecto sem configuração; `/know` (Knowledge Base via markitdown) está sempre disponível. `yagni` é skill base.

Apresentar sugestões e perguntar se há algo a acrescentar ou remover.

### Detecção de gaps

Para cada aspecto específico sem cobertura directa:
1. Identificar o gap
2. `WebSearch` em GitHub e awesome-lists (procurar skill ou CLI relevante)
3. Apresentar resultado:

```
Para "[caso específico]": sem cobertura nativa.

[Se encontrou]
→ repo/skill — descrição breve
Instalo? [S/N]

[Se não encontrou]
Não encontrei nada relevante.
Criar via /create-skill? [S/N/Mais tarde]

[Se cobertura parcial]
[skill-x] cobre A — falta B
[1] Procurar  [2] Criar  [3] Ignorar
```

---

## FASE 3 — CLIs do projecto

Pré-selecção automática baseada no tipo de projecto:

| Tipo projecto       | CLIs sugeridos (pré-marcados)                    |
|---------------------|--------------------------------------------------|
| WordPress           | `wp-cli`, `composer`                             |
| Shopify             | `shopify-cli` (theme/app)                        |
| Wix — dev (CLI/Velo)| `@wix/cli`                                       |
| Wix — Editor / Conteúdo / Marketing | nenhum CLI de dev — browser + REST |
| Laravel             | `composer`, `stripe-cli` (se usar pagamentos)    |
| Web app genérico    | `stripe-cli` (se pagamentos), `aws-cli` (se S3)  |
| Vídeo / Media       | `ffmpeg`, `yt-dlp` — já globais via /install     |
| Research / Design   | `markitdown` (ingestão /know, se aplicável) — já global via /install |

Apresentar lista contextual:
```
Que CLIs específicos este projecto precisa?
[ ] wp-cli         — WordPress core/plugin/post management (só projectos WP)
[ ] shopify-cli    — Shopify dev (theme/app, requer Node 18+)
[ ] @wix/cli       — Wix dev (CLI app / Velo) — só fluxo Wix dev
[ ] stripe-cli     — webhooks listen, payments testing
[ ] composer       — PHP package manager (Laravel/WP)
[ ] aws-cli        — S3, deploy (se file-storage skill activa)
[ ] Outro: ___
[ ] Nenhum
```

> CLIs globais (gh, agy, codex, ffmpeg, yt-dlp, whisperx, sentry-cli, zmail, etc.) instalam-se em `/install` — só listar aqui se faltarem.

**Comandos de instalação:**

**wp-cli** (se seleccionado):
```bash
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar && sudo mv wp-cli.phar /usr/local/bin/wp
```
Windows: `scoop install wp-cli` (precisa de PHP).
Verificar: `wp --info`

**shopify-cli** (se seleccionado, projecto Shopify):
```bash
npm install -g @shopify/cli @shopify/theme
```
Verificar: `shopify version`. Login: `shopify auth login`.

**@wix/cli** (se seleccionado, fluxo Wix dev):
```bash
npm install -g @wix/cli
```
Verificar: `wix --version`. Login: `wix login`. (Só fluxo dev — Wix Editor/conteúdo usa browser + REST, sem CLI.)

**stripe-cli** (se seleccionado):
- macOS: `brew install stripe/stripe-cli/stripe`
- Linux: download em github.com/stripe/stripe-cli/releases
- Windows: `scoop install stripe`

Verificar: `stripe --version`. Login: `stripe login`. Teste webhook: `stripe listen --forward-to localhost:8000/webhook`.

**composer** (se seleccionado e em falta):
- macOS: `brew install composer`
- Linux: `curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer`
- Windows: installer em getcomposer.org/download

Verificar: `composer --version`

**aws-cli** (se seleccionado e em falta):
- macOS: `brew install awscli`
- Linux: `sudo apt install awscli`
- Windows: `winget install Amazon.AWSCLI`

Configurar: `aws configure`.

---

## FASE 4 — PRD

Activar skill `prd`: ler `.claude/skills/prd.md`.

`AskUserQuestion`:
```
question: "Queres que eu gere um PRD.md para este projecto?"
header: "PRD"
options:
  - "Sim — gerar agora"
  - "Não / mais tarde"
```

Se sim: fazer as 3 perguntas mínimas da skill prd (problema, funcionalidades MVP, métricas de sucesso). Gerar PRD.md na raiz do projecto.

---

## FASE 5 — Confirmação

```
PROJECTO: [nome] — [tipo]
Stack: [detectado ou declarado]

SKILLS RELEVANTES: [lista]
SKILLS NOVAS:      [lista — se gaps aprovados]
CLIs PROJECTO:     [lista — wp-cli, shopify-cli, stripe-cli, etc.]

FICHEIROS A CRIAR/ACTUALIZAR
  CLAUDE.md                          ← navegação de código + projecto info
  PRD.md                             ← se aprovado na Fase 4
  [joca]/memory/projects/[nome].md   ← entrada de memória
  ~/CLAUDE.md                        ← adicionar à tabela de projectos activos
```

`AskUserQuestion`:
```
question: "Confirmas a configuração acima?"
header: "Confirmar"
options:
  - "Sim, aplicar"
  - "Voltar atrás para ajustar"
```

---

## EXECUÇÃO

### 0. Gerar PRD.md (se aprovado na Fase 4)

Gerar na raiz do projecto com contexto recolhido. Adicionar referência no CLAUDE.md do projecto e na entrada de memória.

### 1. Correr graphify (só fluxo Dev — saltar em Conteúdo/Marketing e Wix Editor)

> Branch Conteúdo / Marketing (Q1) e Wix Editor (Q5=1): SALTAR este passo. Sem código a indexar.

```bash
# Windows: `python` (não `python3` — stub da Store); macOS/Linux: `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify indisponível — a saltar knowledge graph"
```

Se WordPress:
```bash
wp --version 2>/dev/null || echo "wp_cli_unavailable"
wp core version 2>/dev/null
wp plugin list --status=active --format=csv 2>/dev/null
```

### 2. Criar/actualizar CLAUDE.md do projecto

> Fluxo Conteúdo/Marketing e Wix Editor: OMITIR a secção "Navegação de Código" (não há graphify). Incluir só o bloco `## Projecto` + plataforma/foco e skills de conteúdo.

Se não existir, criar (fluxo Dev):

```markdown
## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, perguntas sugeridas
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Ler ficheiros raw só quando necessário para editar ou o graph não tiver a resposta
4. Actualizar: `python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"` (Windows: `python`; macOS/Linux: `python3`)

## Projecto
**Nome:** [nome]
**Stack:** [stack]
**Objectivo:** [descrição]
**Directório:** [caminho absoluto]
```

Se já existir, adicionar secção de navegação sem apagar conteúdo existente.

### 3. Instalar CLIs do projecto (se confirmados na FASE 3)

Correr os comandos de instalação listados na FASE 3 para cada CLI seleccionado. Verificar cada um após instalar (`wp --info`, `shopify version`, `stripe --version`, etc.).

Se algum CLI falhar a instalação, registar como PENDENTE no relatório final com o comando para o utilizador correr manualmente.

### 4. Criar entrada de memória no JOCA

> **Estado real vs PLANEADO (obrigatório).** Para projectos dev, a memória só pode afirmar "instalado/inicializado/configurado" depois de **verificar no disco** que o directório contém o que descreve (ex.: `.mcp.json` existe, dependências instaladas, servidor responde). O que ainda não foi feito marca-se explicitamente `PLANEADO` / `POR VERIFICAR` — nunca registar setup aspiracional como concluído. Contadores (nº de skills/tools/MCPs) devem vir de contagem real, não de estimativa.

Criar `[joca]/memory/projects/[nome-projecto].md`:

```markdown
---
name: [nome]
description: [stack e objectivo]
type: project
directorio: [caminho absoluto da pasta do projecto]
---

**Stack:** [stack]
**Objectivo:** [descrição]
**Directório:** `[caminho absoluto]`
**Iniciado:** [data]
**PRD:** [PRD.md existe | não gerado]
**Why:** [razão de existir]
**How to apply:** [como o JOCA deve ajudar neste projecto]

## Estado actual
A iniciar.

## Decisões tomadas
<!-- preenchido por /save -->

## Pendente
<!-- preenchido por /save -->
```

O campo `directorio:` no frontmatter é obrigatório — usado por `graphify-global.py` para incluir o projecto no grafo global.

Actualizar `memory/INDEX.md`:
```markdown
- [nome-projecto.md](projects/nome-projecto.md) — [descrição curta]
```

### 5. Actualizar ~/CLAUDE.md

Adicionar linha na tabela de projectos activos se não existir.

### 6. Executar /create-skill (se gaps aprovados)

Para cada skill nova confirmada.

### 7. Relatório final

```
✓ CLAUDE.md do projecto criado/actualizado
✓ PRD.md gerado — se aprovado
✓ CLIs do projecto instalados — [lista] (ou PENDENTE com comando manual)
✓ Memória: [nome-projecto].md criado (directorio: [caminho])
✓ ~/CLAUDE.md actualizado (tabela de projectos)
[✓/○] graphify actualizado — se disponível

Pronto.
→ /resume no início de cada sessão
→ /save para guardar estado e actualizar memória
→ JOCA_OS mostra rate limits na barra do terminal (requer statusline configurada via /install)
```

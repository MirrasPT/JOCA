# /install — Setup e Configuração do JOCA

Assistente interactivo de instalação e reconfiguração. Pode correr em qualquer altura — reconfigura sem apagar o que já existe.

**Modo de apresentação:**
- Perguntas com ≤4 opções exclusivas → usar a ferramenta `AskUserQuestion` (selector visual com setas)
- Perguntas com mais de 4 opções ou multi-select → apresentar lista numerada/com checkboxes e aguardar input de texto
- Uma fase de cada vez. Aguardar resposta antes de avançar.

---

## FASE 0 — Identidade

Verificar se já existe perfil em `~/CLAUDE.md`. Se existir, extrair nome e papel e perguntar via `AskUserQuestion`:

```
question: "Encontrei o teu perfil: [Nome], [papel]. O que queres fazer?"
header: "Perfil"
options:
  - "Manter como está" → saltar para FASE 1
  - "Actualizar perfil" → continuar abaixo
```

Se não existir perfil, ou se escolheu actualizar:

**Q1 — Nome**
Pergunta de texto livre: "Como te chamas?"

**Q2 — Papel**
Lista numerada (>4 opções):
```
Qual é o teu papel principal?
[1] Designer
[2] Desenvolvedor
[3] Full-stack
[4] Marketer / Growth
[5] Product Manager
[6] Outro: ___
```

**Q3 — Localização** *(opcional)*
`AskUserQuestion`:
```
question: "Onde estás localizado? (opcional)"
header: "Localização"
options:
  - "Portugal"
  - "Brasil"
  - "Outro país"
  - "Prefiro não dizer"
```

**Q4 — Sistema Operativo**
`AskUserQuestion`:
```
question: "Que sistema operativo usas?"
header: "Sistema"
options:
  - "macOS"
  - "Windows"
  - "Linux"
  - "Outro"
```

---

## FASE 1 — Contexto

**Q5 — Intenção**
`AskUserQuestion`:
```
question: "O que queres fazer agora?"
header: "Intenção"
options:
  - "Configurar o JOCA globalmente (sem projecto)"  → FASE 3
  - "Ligar o JOCA a um projecto existente"           → Branch [A]
  - "Iniciar um projecto novo"                        → Branch [B]
```

---

## Branch [A] — Projecto Existente

Pedir o caminho da pasta do projecto (texto livre).

```bash
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify_unavailable"
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "no_claude_md"
```

Apresentar resumo do que foi detectado e pedir confirmação antes de continuar.
Avança para **FASE 3** com contexto do projecto activo.

---

## Branch [B] — Projecto Novo

**Q6 — Nome do projecto**
Texto livre: "Nome do projecto?"

**Q7 — Tipo de projecto**
Lista numerada (>4 opções):
```
Que tipo de projecto é?
[1] Website / App / Software
[2] WordPress
[3] Shopify
[4] Design
[5] Vídeo
[6] Research / Análise
[7] Marketing
[8] Outro: ___
```

### Sub-branch: Website / App / Software

**Q8 — Frontend** *(multi-select — lista com checkboxes)*
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

**Q9 — Backend** *(multi-select)*
```
[ ] PHP puro   [ ] Laravel   [ ] Node.js / Express
[ ] Python     [ ] Rails     [ ] Nenhum   [ ] Outro: ___
```

**Q10 — Base de dados** *(multi-select)*
```
[ ] SQLite   [ ] MySQL/MariaDB   [ ] PostgreSQL
[ ] MongoDB  [ ] Supabase/Firebase   [ ] Nenhuma   [ ] Outro: ___
```

**Q11 — Deploy**
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

**Q8 — Tipo de trabalho WP** *(multi-select)*
```
[ ] Plugin
[ ] Tema (block theme)
[ ] Tema (clássico)
[ ] Bloco Gutenberg
[ ] Site completo (FSE)
[ ] Headless (REST/GraphQL)
[ ] Outro: ___
```

**Q9 — Extras** *(multi-select)*
```
[ ] WooCommerce   [ ] Multisite   [ ] WP-CLI disponível   [ ] Nenhum
```

**Q10 — Ambiente local**
Lista numerada:
```
[1] WP Playground   [2] Local by Flywheel   [3] MAMP/WAMP
[4] Docker          [5] Staging/Prod directo   [6] Outro: ___
```

**Q11 — Deploy**
Lista numerada:
```
[1] cPanel   [2] WP Engine   [3] Kinsta   [4] VPS   [5] WordPress.com   [6] Outro: ___
```

### Sub-branch: Shopify

**Q8 — Tipo de trabalho Shopify** *(multi-select)*
```
[ ] App (integração externa, multi-loja, lógica programática)
[ ] Extensão (checkout UI, admin UI, POS, customer account)
[ ] Shopify Functions (descontos, entrega, pagamento)
[ ] Tema (Online Store 2.0 / Liquid)
[ ] Auditoria de loja (SEO, conversão, AEO/GEO)
[ ] Outro: ___
```

**Q9 — Deploy**
Lista numerada:
```
[1] Shopify App Store (público)
[2] App privada / custom app
[3] Shopify Plus (merchant)
[4] Outro: ___
```

### Sub-branch: Design

**Q8** *(multi-select)*:
```
[ ] UI/UX   [ ] Branding   [ ] Motion/Animação   [ ] Print/Large format   [ ] Ilustração   [ ] Outro
```

**Q9** *(multi-select)*:
```
[ ] Protótipos HTML   [ ] SVG/Figma   [ ] Lottie   [ ] Assets PNG/WebP   [ ] PDF   [ ] Outro
```

### Sub-branch: Vídeo

**Q8** *(multi-select)*:
```
[ ] Social media   [ ] Explainer   [ ] Documental   [ ] Tutorial   [ ] Outro
```

**Q9** *(multi-select)*:
```
[ ] AI video   [ ] Remotion   [ ] Edição tradicional   [ ] Legendas locais   [ ] Outro
```

### Sub-branch: Research

**Q8**:
```
[1] Mercado   [2] Tecnologia   [3] Conteúdo/SEO   [4] Científico   [5] Outro
```

**Q9** *(multi-select)*:
```
[ ] Relatório MD/PDF   [ ] Resumo executivo   [ ] Tabela comparativa   [ ] JSON/CSV   [ ] Outro
```

### Sub-branch: Marketing

**Q8** *(multi-select)*:
```
[ ] SEO   [ ] Google Ads   [ ] Meta Ads   [ ] LinkedIn   [ ] Email   [ ] Social orgânico   [ ] Outro
```

**Q9**:
```
[1] Leads   [2] E-commerce   [3] Brand awareness   [4] Retenção   [5] Outro
```

---

## FASE 3 — Configuração JOCA

### Áreas de trabalho

Pré-seleccionar com base no projecto detectado/declarado:

| Tipo                 | Pré-seleccionado                                    |
|----------------------|-----------------------------------------------------|
| Website/App          | Desenvolvimento web, DevOps, Analytics              |
| WordPress            | WordPress, DevOps, Analytics                        |
| Shopify              | Shopify, Analytics                                  |
| Design UI/UX         | UI/UX, Ilustração, Animação                         |
| Design Print         | Ilustração                                          |
| Vídeo                | Vídeo                                               |
| Research             | Research, Analytics                                 |
| Marketing            | Marketing/SEO, Analytics                            |
| Global               | Nenhum                                              |

Apresentar lista com pré-selecção e perguntar confirmação (multi-select, lista):
```
Áreas de trabalho activas: (confirma ou ajusta)
[x] Design de interfaces (UI/UX)
[x] Ilustração / arte visual
[ ] Animação (Lottie, motion)
[ ] Vídeo / conteúdo
[ ] 3D (Blender)
[ ] Marketing / SEO / Ads
[ ] Desenvolvimento web
[ ] WordPress
[ ] Shopify
[ ] DevOps / infra
[ ] Analytics / dados
[ ] Research
[ ] TODOS
[ ] Outro: ___
```

### Mapeamento áreas → skills

| Área               | Skills activadas                                                               |
|--------------------|--------------------------------------------------------------------------------|
| UI/UX              | frontend-design, huashu-design                                                 |
| Ilustração         | canvas-design, brand-guidelines                                                |
| Animação           | lottie-animator                                                                |
| Vídeo              | video, hyperframes/core, hyperframes/gsap, watch                               |
| 3D                 | blender skill + blender MCP                                                    |
| Marketing/SEO      | paid-ads, seo, seo-local, email-sequence, content-strategy, social-content, copywriting |
| Dev web            | webapp-testing, api-designer + por stack (tabela abaixo)                       |
| WordPress          | wordpress/* (router, triage, plugin, block, themes, rest-api, wpcli, performance, phpstan, playground, interactivity, abilities, wpds, guidelines, blueprint) |
| Shopify            | shopify/* (router, app, theme, store-audit, store-fixer)                       |
| DevOps             | devops-engineer                                                                |
| Analytics          | google-analytics, microsoft-clarity                                            |
| Research           | deep-research                                                                  |
| Base (sempre)      | caveman, karpathy-guidelines, agent-context, create-skill                      |

Skills adicionais por stack:

| Stack              | Skills                                                      |
|--------------------|-------------------------------------------------------------|
| Laravel            | laravel-specialist, php-pro, postgres-pro, test-master      |
| PHP puro           | php-pro                                                     |
| PostgreSQL         | postgres-pro                                                |
| WP + WooCommerce   | wordpress/* + php-pro                                       |

### Detecção de gaps

Para cada aspecto do projecto sem cobertura directa nas skills existentes:
1. Identificar o gap
2. `WebSearch` em GitHub / mcpmarket.com
3. Apresentar resultado:

```
Para "[caso]": sem cobertura nativa.

[Se encontrou]
→ repo/skill — descrição
Instalo? [S/N]

[Se não encontrou]
Não encontrei nada relevante.
Crio via /create-skill? [S/N/Mais tarde]

[Se cobertura parcial]
[skill-x] cobre A ✓ — falta B
[1] Procurar online  [2] Criar  [3] Ignorar
```

### Integrações e MCPs

**Google** *(multi-select)*:
```
[ ] Gmail   [ ] Google Calendar   [ ] Google Drive/Docs   [ ] Google Analytics (GA4)   [ ] Nenhuma
```

**Ferramentas** *(multi-select)*:
```
[ ] GitHub (repositórios, PRs, issues — requer token)
[ ] Playwright (browser automation)
[ ] Firecrawl (web scraping — requer Docker ou API key)
[ ] Microsoft Clarity (requer Composio API key)
[ ] HuggingFace (modelos Hub, Spaces — requer token p/ privado)
[ ] WordPress MCP Adapter (WP 6.8+ — só p/ projectos WP)
[ ] Gemini CLI (análise multimodal: vídeo, PDF, contexto 1M — tier gratuito)
[ ] Codex CLI (code review adversarial — requer ChatGPT Plus ou OPENAI_API_KEY)
[ ] Outro: ___
```

**Geração de imagens**
`AskUserQuestion`:
```
question: "Que motor de geração de imagens queres usar?"
header: "Img Gen"
options:
  - "Google Gemini (recomendado — geral, drafts, aspect ratios)"
  - "OpenAI gpt-image-2 (texto em imagens, produto, inpainting)"
  - "Ambos"
  - "Não preciso"
```

---

## FASE APIs — Chaves de API

Com base nas selecções, determinar quais chaves são necessárias:

| Ferramenta                    | Variável                        | Quando é necessária                       |
|-------------------------------|----------------------------------|-------------------------------------------|
| GitHub MCP                    | `GITHUB_PERSONAL_ACCESS_TOKEN`  | GitHub seleccionado                       |
| HuggingFace MCP               | `HF_TOKEN`                      | HuggingFace seleccionado                  |
| OpenAI (img-gen + Codex)      | `OPENAI_API_KEY`                | img-gen OpenAI ou Codex CLI               |
| Google Gemini (img-gen + CLI) | `GEMINI_API_KEY`                | img-gen Gemini ou Gemini CLI sem OAuth    |
| Firecrawl cloud               | `FIRECRAWL_API_KEY`             | Firecrawl sem Docker local                |
| Composio (Clarity)            | `COMPOSIO_API_KEY`              | Microsoft Clarity                         |

Para cada chave necessária, perguntar via `AskUserQuestion`:
```
question: "[Ferramenta] precisa de [NOME_CHAVE]. Estado actual: [detectado / não encontrado]"
header: "API Key"
options:
  - "Introduzir agora"
  - "Já está configurada no sistema"
  - "Configurar mais tarde"
```

- "Introduzir agora" → receber o valor (não mostrar em claro depois de confirmar)
- "Já está configurada" → assumir OK, não tocar
- "Mais tarde" → marcar como ⚠ pendente no relatório final

**Onde ficam guardadas:**
- Chaves MCP servers → bloco `env` do servidor em `.mcp.json`
- `OPENAI_API_KEY`, `GEMINI_API_KEY` → `env` global em `~/.claude.json`
- Se preferir não escrever em `~/.claude.json`: instruir comando exacto:
  - Windows: `setx OPENAI_API_KEY "<valor>"`
  - macOS/Linux: `export OPENAI_API_KEY="<valor>"` + adicionar a `~/.zshrc`

---

## FASE 4 — Confirmação

Apresentar resumo completo:

```
IDENTIDADE
  [Nome] — [papel][, localização] — [OS]

SKILLS ([n])
  Base:  caveman, karpathy-guidelines, agent-context, create-skill
  [categoria]: [lista]

MCPs GLOBAIS:   [lista]
MCPs PROJECTO:  [lista — se aplicável]
SKILLS NOVAS:   [lista — se gaps detectados]

API KEYS
  ✓ [NOME_CHAVE] — configurada
  ⚠ [NOME_CHAVE] — pendente (instruções no final)
  ○ [NOME_CHAVE] — assumida do sistema

FICHEIROS
  ~/CLAUDE.md           actualizar
  memory/               criar estrutura
  [projecto]/.mcp.json  criar — se aplicável

Confirmas?
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

## FASE UI — JOCA UI

`AskUserQuestion`:
```
question: "JOCA UI é a interface visual para o Claude Code — terminal multi-sessão, file browser, sidebar de projectos. Quer configurá-lo?"
header: "JOCA UI"
options:
  - "Sim — configurar e lançar JOCA UI (Recomendado)"
  - "Mais tarde — continuar sem UI"
  - "Já está configurado"
```

**Se "Sim — configurar":**

1. Verificar dependências:
```bash
node --version 2>/dev/null || echo "node: NOT FOUND"
npm --version 2>/dev/null || echo "npm: NOT FOUND"
ls "[caminho_joca]/JOCA_UI/frontend/package.json" 2>/dev/null || echo "joca_ui: NOT FOUND"
```

2. Se Node.js não estiver instalado → instruir: `brew install node` (macOS) ou `https://nodejs.org`

3. Se JOCA UI encontrado, instalar dependências e lançar:
```bash
cd "[caminho_joca]/JOCA_UI"
npm install 2>/dev/null || echo "install_failed"
```

4. Perguntar como lançar:
```
question: "Como preferes lançar o JOCA UI?"
header: "Launch"
options:
  - "Script .command (duplo-clique no Finder — macOS)"
  - "Terminal (npm start)"
  - "Mostrar-me como funciona"
```

- **Script .command**: `ls "[caminho_joca]/JOCA_UI/JOCA UI.command"` — se existir, está pronto. Instruir duplo-clique no Finder.
- **Terminal**: `npm start` na pasta `JOCA_UI/` — abre em `http://localhost:3000`
- **Como funciona**: resumo em 3 linhas: sidebar de sessões · terminal integrado · file browser

5. Adicionar ao relatório final: `✓ JOCA UI configurado — lançar: [método escolhido]`

**Se "Já configurado"**: verificar se `node_modules` existe, se não existir: `npm install`.

---

## FASE DEP — Dependências

```bash
python3 --version 2>/dev/null || python --version
graphify --version 2>/dev/null || echo "graphify_unavailable"
node --version 2>/dev/null
bun --version 2>/dev/null
docker --version 2>/dev/null
curl -s http://localhost:3002/health 2>/dev/null || echo "firecrawl_unavailable"
gemini --version 2>/dev/null || echo "gemini_cli_unavailable"
codex --version 2>/dev/null || echo "codex_cli_unavailable"
```

Para cada ferramenta em falta que foi seleccionada, instruir instalação antes de continuar.

---

## EXECUÇÃO

### 1. ~/CLAUDE.md

Ler ficheiro actual. Adicionar/actualizar secção JOCA sem apagar conteúdo existente:

```markdown
## Utilizador
[Nome] — [papel][, localização]

## Workspace
[pasta de projectos]

## Projectos activos
| Directório | Descrição |
|-----------|-----------|
| [caminho] | [stack e objectivo] |

## JOCA
Toolkit em: [caminho_joca]
Skills: [lista por categoria]
MCPs globais: [lista]
Comandos: /install, /init-project, /resume, /save, /feedback-joca, /feedback-projeto, /upgrade-joca, /update-joca, /create-skill
```

### 2. Estrutura de memória

Confirmar que existem (criar se não existirem):
- `memory/INDEX.md`
- `memory/projects/` (com `.gitkeep`)
- `memory/tools/`
- `memory/feedback/` (com `.gitkeep`)

### 3. MCPs globais

Playwright e Firecrawl: verificar `~/.claude.json`. Se ausentes, mostrar ao utilizador o bloco JSON a adicionar.
Google connectors: instruir activação em claude.ai/settings (OAuth nativo).

### 3a. API Keys

Para cada chave marcada como "introduzir agora":

**MCP servers** — escrever no bloco `env` do servidor em `.mcp.json`:
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<valor>" }
},
"huggingface": {
  "command": "npx",
  "args": ["-y", "@huggingface/mcp-server"],
  "env": { "HF_TOKEN": "<valor>" }
}
```

**Chaves de agentes** — adicionar ao bloco `env` global de `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<valor>", "GEMINI_API_KEY": "<valor>" } }
```

Para chaves ⚠ pendentes — listar com link de obtenção:
- `GITHUB_PERSONAL_ACCESS_TOKEN` → github.com/settings/tokens (scope: repo, read:org)
- `HF_TOKEN` → huggingface.co/settings/tokens
- `OPENAI_API_KEY` → platform.openai.com/api-keys
- `GEMINI_API_KEY` → aistudio.google.com/apikey
- `COMPOSIO_API_KEY` → app.composio.dev/settings

### 3b. CLIs externos

**Gemini CLI** (se seleccionado):
```bash
npm install -g @google/gemini-cli
gemini auth login          # opção 1: Google account (tier gratuito)
# ou: definir GEMINI_API_KEY no sistema
```

**Codex CLI** (se seleccionado):
```bash
npm install -g @openai/codex
codex login                # opção 1: ChatGPT Plus/Pro
# ou: definir OPENAI_API_KEY no sistema
```

### 4. .mcp.json do projecto (se Branch [A] ou [B])

Criar ou actualizar com os MCPs específicos confirmados.

### 5. Entrada de memória do projecto (se Branch [A] ou [B])

Criar `memory/projects/[nome].md` e actualizar `memory/INDEX.md`.

### 6. Skills novas (se confirmado)

Executar `/create-skill [nome]` para cada skill nova aprovada.

### 7. Relatório final

```
✓ ~/CLAUDE.md actualizado
✓ Memória: [n] entradas
✓ Skills: [n] configuradas
✓ MCPs: [lista]
[estado] Deps: python / graphify / node / bun / docker / firecrawl / gemini-cli / codex-cli

API KEYS
  ✓ [chave] — configurada em [localização]
  ⚠ [chave] — PENDENTE → [URL para obter]

JOCA UI
  ✓ Configurado — lançar: [duplo-clique em "JOCA UI.command" / npm start em JOCA_UI/]
  ou: ⚠ Não configurado (correr /install de novo para configurar)

JOCA pronto.
Próximo: lançar JOCA UI · /init-project num projecto · /resume no início de cada sessão.
```

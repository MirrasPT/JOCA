# /install — Setup e Configuração do JOCA

Executa o assistente de instalação/reconfiguração completo do JOCA.  
Segue as fases abaixo. Faz as perguntas bloco a bloco, aguarda resposta antes de avançar.

---

## FASE 0 — Identidade

Verifica se já existe perfil em `~/CLAUDE.md`. Se existir, extrai nome e papel e apresenta:
```
Encontrei o teu perfil: [Nome], [papel].
Queres actualizar? [S/N]
```
Se não existir, faz as perguntas:

**Q1 — Nome**
```
Resposta livre
```

**Q2 — Papel**
```
[1] Designer
[2] Desenvolvedor
[3] Full-stack
[4] Marketer / Growth
[5] Product Manager
[6] Outro: ___
```

**Q3 — Localização** *(opcional)*
```
[1] Portugal
[2] Brasil
[3] Outro: ___
[4] Prefiro não dizer
```

**Q4 — Sistema Operativo**
```
[1] macOS
[2] Windows
[3] Linux
[4] Outro: ___
```

---

## FASE 1 — Contexto

**Q5 — O que queres fazer agora?**
```
[1] Reconfigurar JOCA global (sem projecto específico)
[2] Ligar o JOCA a um projecto existente
[3] Iniciar um projecto novo
```

Se [1]: avança para **FASE 3**.  
Se [2] ou [3]: continua abaixo.

---

### Branch [2] — Projecto Existente

Pergunta o caminho:
```
Qual é o caminho da pasta do projecto?
```

```bash
cd <caminho>
graphify . 2>/dev/null || echo "graphify_unavailable"
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "no_claude_md"
```

Apresenta resumo detectado e pede confirmação antes de continuar.  
Avança para **FASE 3** com contexto do projecto activo.

---

### Branch [3] — Projecto Novo

**Q6 — Nome do projecto**
```
Resposta livre
```

**Q7 — Tipo de projecto**
```
[1] Website / App / Software
[2] WordPress
[3] Shopify
[4] Design
[5] Vídeo
[6] Research / Análise
[7] Marketing
[8] Outro: ___
```

#### Sub-branch: Website / App / Software

**Q8 — Frontend** *(multi-select)*
```
[ ] Vanilla HTML/CSS/JS   [ ] React   [ ] Vue
[ ] Next.js / Nuxt        [ ] Flutter [ ] Nenhum   [ ] Outro: ___
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
```
[1] Vercel / Netlify   [2] cPanel   [3] VPS   [4] AWS/GCP/Azure   [5] Ainda não sei   [6] Outro: ___
```

#### Sub-branch: Shopify

**Q8 — Tipo de trabalho Shopify** *(multi-select)*
```
[ ] App (integração externa, multi-loja, lógica programática)
[ ] Extensão (checkout UI, admin UI, POS, customer account)
[ ] Shopify Functions (descontos, entrega, pagamento customizado)
[ ] Tema (Online Store 2.0 / Liquid)
[ ] Auditoria de loja (SEO, conversão, AEO/GEO)
[ ] Outro: ___
```

**Q9 — Ferramentas Shopify** *(multi-select)*
```
[ ] Shopify CLI (já instalado)   [ ] Admin API (GraphQL)
[ ] Polaris (Admin UI)           [ ] Theme Check
[ ] Shopify AI Toolkit (MCP)     [ ] Nenhum
```

**Q10 — Deploy**
```
[1] Shopify App Store (público)   [2] App privada / custom app
[3] Shopify Plus (merchant)       [4] Outro: ___
```

#### Sub-branch: WordPress

**Q8 — Tipo de trabalho WP** *(multi-select)*
```
[ ] Plugin          [ ] Tema (block theme)    [ ] Tema (clássico)
[ ] Bloco Gutenberg [ ] Site completo (FSE)   [ ] Headless (REST/GraphQL)
[ ] Outro: ___
```

**Q9 — Extras** *(multi-select)*
```
[ ] WooCommerce   [ ] Multisite   [ ] WP-CLI disponível   [ ] Nenhum
```

**Q10 — Ambiente local**
```
[1] WP Playground   [2] Local by Flywheel   [3] MAMP/WAMP
[4] Docker          [5] Staging/Prod directo   [6] Outro: ___
```

**Q11 — Deploy**
```
[1] cPanel   [2] WP Engine   [3] Kinsta   [4] VPS   [5] WordPress.com   [6] Outro: ___
```

#### Sub-branch: Design

**Q8** *(multi-select)*: UI/UX · Branding · Motion/Animação · Print/Large format · Ilustração · Outro  
**Q9** *(multi-select)*: Protótipos HTML · SVG/Figma · Lottie · Assets PNG/WebP · PDF · Outro

#### Sub-branch: Vídeo

**Q8** *(multi-select)*: Social media · Explainer · Documental · Tutorial · Outro  
**Q9** *(multi-select)*: AI video · Remotion · Edição tradicional · Legendas locais · Outro

#### Sub-branch: Research

**Q8**: Mercado · Tecnologia · Conteúdo/SEO · Científico · Outro  
**Q9** *(multi-select)*: Relatório MD/PDF · Resumo executivo · Tabela comparativa · JSON/CSV · Outro

#### Sub-branch: Marketing

**Q8** *(multi-select)*: SEO · Google Ads · Meta Ads · LinkedIn · Email · Social orgânico · Outro  
**Q9**: Leads · E-commerce · Brand awareness · Retenção · Outro

---

## FASE 3 — Configuração JOCA

### Áreas de trabalho

Pré-selecciona com base no projecto (se existir contexto):

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

```
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

| Área               | Skills                                                                          |
|--------------------|---------------------------------------------------------------------------------|
| UI/UX              | `ui`                                                                            |
| Ilustração         | `visual`                                                                        |
| Animação           | `motion`                                                                        |
| Vídeo              | `video`, `hyperframes/core`, `hyperframes/gsap`                                 |
| 3D                 | `blender` + blender MCP (.mcp.json)                                             |
| Marketing/SEO      | `seo`, `content`, `performance`                                                 |
| Dev web            | `web-tester`, `quality` + por stack (tabela abaixo)                             |
| WordPress          | `wordpress/wordpress-router`, `wp-project-triage`, `wp-plugin-development`, `wp-block-development`, `wp-block-themes`, `wp-rest-api`, `wp-wpcli-and-ops`, `wp-performance`, `wp-phpstan`, `wp-playground`, `wp-interactivity-api`, `wp-abilities-api`, `wpds`, `wp-plugin-directory-guidelines`, `blueprint` |
| Shopify            | `shopify/shopify-router`, `shopify-app`, `shopify-theme`, `shopify-store-audit`, `shopify-store-fixer` |
| DevOps             | `platform`                                                                      |
| Analytics          | `analytics`                                                                     |
| Research           | agente `deep-research`                                                          |
| Base (sempre)      | `create-skill`                                                                  |

Skills adicionais por stack:

| Stack           | Skills                                                              |
|-----------------|---------------------------------------------------------------------|
| Laravel         | `php-stack`, `quality`                                              |
| PHP puro        | `php-stack`                                                         |
| PostgreSQL      | `php-stack` (inclui postgres)                                       |
| WP + WooCommerce | `wordpress/*` + `php-stack`                                        |
| WP + WP-CLI     | `wordpress/wp-wpcli-and-ops` (já incluído no pacote WordPress)     |

### Detecção de gaps

Para cada resposta específica que não tenha cobertura directa nas skills existentes:

1. Identifica o gap (ex: "Unity/game design" → sem skill nativa)
2. `WebSearch` para encontrar skill relevante em GitHub ou mcpmarket.com
3. Apresenta:

```
Para "[caso]": não existe skill nativa.

[Se encontrou]
Encontrei: → repo/skill — descrição
Instalo? [S/N]

[Se não encontrou]
Não encontrei nada relevante online.
Crio via /create-skill? [S/N/Mais tarde]

[Se parcialmente coberto]
Cobertura parcial: [skill-x] cobre A ✓ — falta B
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
[ ] WordPress MCP Adapter (expõe WP Abilities como tools — só p/ projectos WP, requer WP 6.8+)
[ ] Gemini CLI (análise multimodal: vídeo, PDF, contexto 1M — tier gratuito com Google account)
[ ] Codex CLI (code review adversarial via OpenAI — requer ChatGPT Plus ou OPENAI_API_KEY)
[ ] Outro: ___
```

**Geração de imagens**:
```
[1] OpenAI gpt-image-2   [2] Google Gemini   [3] Ambos   [4] Não preciso
```

---

## FASE APIs — Chaves de API

Com base nas selecções anteriores, determina quais chaves são necessárias:

| MCP / Ferramenta         | Variável                        | Trigger                          |
|--------------------------|----------------------------------|----------------------------------|
| GitHub MCP               | `GITHUB_PERSONAL_ACCESS_TOKEN`  | GitHub seleccionado              |
| HuggingFace MCP          | `HF_TOKEN`                      | HuggingFace seleccionado         |
| OpenAI (img-gen + Codex) | `OPENAI_API_KEY`                | img-gen [1]/[3] ou Codex CLI    |
| Google Gemini (img-gen + CLI) | `GEMINI_API_KEY`           | img-gen [2]/[3] ou Gemini CLI sem OAuth |
| Firecrawl cloud          | `FIRECRAWL_API_KEY`             | Firecrawl sem Docker local       |
| Composio (Clarity)       | `COMPOSIO_API_KEY`              | Microsoft Clarity seleccionado   |

Para cada chave necessária, pergunta individualmente:

```
[Ferramenta] precisa de [NOME_CHAVE].
Estado actual: [detectado / não encontrado]
[1] Introduzir agora   [2] Já está no sistema   [3] Mais tarde
```

- Opção [1]: recebe o valor (não mostra em claro depois de confirmar)
- Opção [2]: assume configurado, não toca em nada
- Opção [3]: marca como ⚠ pendente no relatório final

**Onde ficam guardadas:**
- Chaves de MCP servers → bloco `env` do servidor em `.mcp.json`
- `OPENAI_API_KEY`, `GEMINI_API_KEY` → `env` global em `~/.claude.json` (disponíveis a todos os agentes)
- Se `~/.claude.json` não existir ou o user preferir: instruir a definir como variável de sistema (setx no Windows, export no macOS/Linux)

---

## FASE 4 — Confirmação

```
IDENTIDADE
  [Nome] — [papel][, localização]

SKILLS ([n])
  Base:  create-skill (caveman · karpathy · agent-context embutidos no CLAUDE.md)
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

Confirmas? [S/N]
```

---

## FASE DEP — Dependências

```bash
python3 --version 2>/dev/null || python --version
graphify --version 2>/dev/null
node --version 2>/dev/null
bun --version 2>/dev/null
docker --version 2>/dev/null
curl -s http://localhost:3002/health 2>/dev/null
gemini --version 2>/dev/null || echo "gemini_cli_unavailable"
codex --version 2>/dev/null || echo "codex_cli_unavailable"
```

Se algo em falta for necessário para as escolhas feitas, instrui o utilizador antes de continuar.

---

## EXECUÇÃO

### 1. ~/CLAUDE.md

Lê o ficheiro actual. Adiciona/actualiza secção JOCA sem apagar conteúdo existente:

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
Comandos: /install, /init-project, /resume, /save, /create-skill
```

### 2. Estrutura de memória

Confirmar que existem:
- `memory/INDEX.md`
- `memory/projects/`
- `memory/tools/`
- `memory/feedback/`

### 3. MCPs globais

Playwright e Firecrawl: verificar `~/.claude.json`. Se ausentes, mostrar ao utilizador o bloco JSON a adicionar.  
Google connectors: instruir activação em claude.ai/settings (OAuth nativo).

### 3a. API Keys

Para cada chave marcada como "introduzir agora":

**MCP servers** — escrever no bloco `env` do servidor em `.mcp.json` (global `~/.claude.json` ou projecto):
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

**Chaves de agentes** (OPENAI_API_KEY, GEMINI_API_KEY) — adicionar ao bloco `env` global de `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<valor>", "GEMINI_API_KEY": "<valor>" } }
```
Se o utilizador preferir não escrever em `~/.claude.json`, mostrar o comando exacto para definir no sistema:
- Windows: `setx OPENAI_API_KEY "<valor>"`
- macOS/Linux: `export OPENAI_API_KEY="<valor>"` (e adicionar a `~/.zshrc` ou `~/.bashrc`)

Para chaves ⚠ pendentes: listar no relatório final com link de obtenção:
- `GITHUB_PERSONAL_ACCESS_TOKEN` → github.com/settings/tokens (scope: repo, read:org)
- `HF_TOKEN` → huggingface.co/settings/tokens
- `OPENAI_API_KEY` → platform.openai.com/api-keys
- `GEMINI_API_KEY` → aistudio.google.com/apikey
- `COMPOSIO_API_KEY` → app.composio.dev/settings

### 3b. CLIs externos (se Gemini CLI ou Codex CLI seleccionados)

**Gemini CLI:**
```bash
npm install -g @google/gemini-cli

# Autenticação — opção 1: Google account (tier gratuito, sem API key)
gemini auth login

# Autenticação — opção 2: API key do AI Studio (também gratuito)
# setx GEMINI_API_KEY "<chave>"   # Windows
# export GEMINI_API_KEY="<chave>" # macOS/Linux
# Obter em: aistudio.google.com/apikey
```

**Codex CLI:**
```bash
npm install -g @openai/codex

# Autenticação — opção 1: ChatGPT Plus/Pro (usa subscrição existente)
codex login

# Autenticação — opção 2: API key OpenAI (pago por uso)
# setx OPENAI_API_KEY "<chave>"   # Windows
# export OPENAI_API_KEY="<chave>" # macOS/Linux
# Obter em: platform.openai.com/api-keys
```

### 4. .mcp.json do projecto (se branch 2 ou 3)

Criar ou actualizar com os MCPs específicos confirmados.

### 5. Entrada de memória do projecto (se branch 2 ou 3)

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

JOCA pronto.
Próximo passo: /init-project num projecto · /resume no início de cada sessão.
```

Se existirem chaves pendentes: listar com instrução exacta de como adicionar depois (setx / export / editar .mcp.json).

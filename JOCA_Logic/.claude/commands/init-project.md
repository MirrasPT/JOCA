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

**Q1 — Estado do projecto**
`AskUserQuestion`:
```
question: "Este projecto já tem código ou estrutura?"
header: "Estado"
options:
  - "Já tem código / estrutura existente"
  - "Projecto novo (a começar do zero)"
```

---

### Branch [A] — Projecto Existente

Correr scan:
```bash
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify_unavailable"
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

**Q2 — Nome do projecto**
Texto livre: "Nome do projecto?"

**Q3 — Tipo de projecto**
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

**Q8 — WordPress MCP Adapter?** *(expõe WP Abilities como MCP tools; requer WP 6.8+)*
`AskUserQuestion`:
```
question: "Instalar WordPress MCP Adapter neste projecto?"
header: "WP MCP"
options:
  - "Sim — instalar via Composer"
  - "Não"
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

**Q5 — Shopify AI Toolkit MCP?** *(docs + schema em contexto; requer Node.js 18+)*
`AskUserQuestion`:
```
question: "Instalar Shopify AI Toolkit MCP?"
header: "Shopify MCP"
options:
  - "Sim — MCP server local (sem auth)"
  - "Sim — plugin (auto-updates)"
  - "Não"
```

Se seleccionado:
```bash
# Opção 1 — MCP server local
claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest

# Opção 2 — Plugin
/plugin marketplace add Shopify/shopify-ai-toolkit
```

**Q6 — Deploy**
Lista numerada:
```
[1] Shopify App Store (público)
[2] App privada / custom app
[3] Shopify Plus (merchant)
[4] Tema — loja do cliente
[5] Outro: ___
```

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
| Website/App             | Desenvolvimento web, DevOps, Analytics                                       |
| WordPress               | WordPress, DevOps, Analytics                                                 |
| Shopify                 | Shopify, Analytics                                                           |
| Design UI/UX greenfield | `frontend`, `brand-guidelines`, `mobile`                                     |
| Design UI/UX iteração   | `frontend`, `brand-guidelines`                                               |
| Design Motion/Animação  | `anima` (GSAP + Lottie), `frontend`                                          |
| Design Print            | `graphic-design`, `brand-guidelines`                                         |
| Vídeo                   | `video`, `hyperframes`, `remotion`                                           |
| Research                | `deep-research`, Analytics                                                   |
| Marketing               | Marketing/SEO, Analytics                                                     |
| Automação / Scraping    | `browser-use`, Desenvolvimento web                                           |

**Nota disambiguation design:** se o projecto já tem `DESIGN.md` ou `PRODUCT.md` → activar também `brand-guidelines`. Se greenfield → `frontend`.

Apresentar sugestões e perguntar se há algo a acrescentar ou remover.

### Detecção de gaps

Para cada aspecto específico sem cobertura directa:
1. Identificar o gap
2. `WebSearch` em GitHub / mcpmarket.com
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

## FASE 3 — MCPs do projecto

Apresentar lista de MCPs específicos de projecto:
```
Que MCPs específicos este projecto precisa?
[ ] Blender (3D)
[ ] Browser Use (automação browser AI-driven)
[ ] WordPress MCP Adapter (WP 6.8+ — só projectos WP)
[ ] Shopify AI Toolkit MCP (só projectos Shopify)
[ ] Outro: ___
[ ] Nenhum
```

Se Browser Use seleccionado:
```bash
pip install browser-use
```
Adicionar ao `.mcp.json`:
```json
"browser-use": {
  "command": "uvx",
  "args": ["browser-use-mcp"]
}
```

Se WordPress MCP Adapter seleccionado:
```bash
composer require wordpress/mcp-adapter
```
Adicionar ao `.mcp.json` do projecto:
```json
"wordpress-mcp": {
  "command": "wp",
  "args": ["mcp", "start"],
  "env": { "WP_PATH": "<caminho-para-wp>" }
}
```

---

## FASE 4 — PRD

Activar skill `prd`: ler `.claude/skills/SKILL.md`.

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
SKILLS NOVAS: [lista — se gaps aprovados]
MCPs PROJECTO: [lista]

FICHEIROS A CRIAR/ACTUALIZAR
  CLAUDE.md                          ← navegação de código + projecto info
  PRD.md                             ← se aprovado na Fase 4
  .mcp.json                          ← se MCPs de projecto
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

### 1. Correr graphify (se disponível e não correu ainda)

```bash
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify indisponível — a saltar knowledge graph"
```

Se WordPress:
```bash
wp --version 2>/dev/null || echo "wp_cli_unavailable"
wp core version 2>/dev/null
wp plugin list --status=active --format=csv 2>/dev/null
```

### 2. Criar/actualizar CLAUDE.md do projecto

Se não existir, criar:

```markdown
## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, perguntas sugeridas
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Ler ficheiros raw só quando necessário para editar ou o graph não tiver a resposta
4. Actualizar: `python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"`

## Projecto
**Nome:** [nome]
**Stack:** [stack]
**Objectivo:** [descrição]
**Directório:** [caminho absoluto]
```

Se já existir, adicionar secção de navegação sem apagar conteúdo existente.

### 3. Criar .mcp.json (se MCPs de projecto confirmados)

```json
{
  "mcpServers": {
    "[nome-mcp]": {
      "command": "[comando]",
      "args": ["[args]"]
    }
  }
}
```

### 4. Criar entrada de memória no JOCA

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
✓ .mcp.json configurado — se aplicável
✓ Memória: [nome-projecto].md criado (directorio: [caminho])
✓ ~/CLAUDE.md actualizado (tabela de projectos)
[✓/○] graphify actualizado — se disponível

Pronto.
→ /resume no início de cada sessão
→ /save para guardar estado e actualizar memória
→ JOCA_UI mostra rate limits na barra do terminal (requer statusline configurada via /install)
```

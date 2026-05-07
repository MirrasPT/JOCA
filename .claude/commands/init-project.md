# /init-project — Inicializar Projecto

Liga um projecto ao JOCA. Corre este comando a partir da pasta do projecto.  
Segue as fases abaixo. Faz as perguntas bloco a bloco, aguarda resposta antes de avançar.

---

## Verificação inicial

```bash
graphify --version 2>/dev/null || echo "graphify_unavailable"
```

Se graphify não disponível: avisar "Corre `/install` no JOCA primeiro." e parar.

---

## FASE 1 — Contexto do projecto

**Q1 — Este projecto é novo ou já tem código?**
```
[1] Já tem código / estrutura
[2] Projecto novo (a começar do zero)
```

---

### Branch [1] — Projecto Existente

Corre scan:
```bash
graphify update . 2>/dev/null || echo "graphify_unavailable"
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "no_claude_md"
```

Apresenta resumo do que detectaste:
```
Detectei:
- Stack: [detectado]
- Descrição: [detectada]
- Fase: [detectada]
- Estrutura: [resumo graphify]

Está correcto? Corrige o que estiver errado.
```

Continua para **FASE 2**.

---

### Branch [2] — Projecto Novo

**Q2 — Nome do projecto**
```
Resposta livre
```

**Q3 — Tipo de projecto**
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

**Q4 — Frontend** *(multi-select)*
```
[ ] Vanilla HTML/CSS/JS   [ ] React   [ ] Vue
[ ] Next.js / Nuxt        [ ] Flutter [ ] Nenhum   [ ] Outro: ___
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
```
[1] Vercel / Netlify   [2] cPanel   [3] VPS   [4] AWS/GCP/Azure   [5] Ainda não sei   [6] Outro: ___
```

#### Sub-branch: WordPress

**Q4 — Tipo de trabalho WP** *(multi-select)*
```
[ ] Plugin          [ ] Tema (block theme)    [ ] Tema (clássico)
[ ] Bloco Gutenberg [ ] Site completo (FSE)   [ ] Headless (REST/GraphQL)
[ ] Outro: ___
```

**Q5 — Extras** *(multi-select)*
```
[ ] WooCommerce   [ ] Multisite   [ ] WP-CLI disponível   [ ] Nenhum
```

**Q6 — Ambiente local**
```
[1] WP Playground   [2] Local by Flywheel   [3] MAMP/WAMP
[4] Docker          [5] Staging/Prod directo   [6] Outro: ___
```

**Q7 — Deploy**
```
[1] cPanel   [2] WP Engine   [3] Kinsta   [4] VPS   [5] WordPress.com   [6] Outro: ___
```

**Q8 — WordPress MCP Adapter?** *(expõe WP Abilities como MCP tools; requer WP 6.8+)*
```
[1] Sim — instalar via Composer no projecto
[2] Não
```

#### Sub-branch: Shopify

**Q4 — Tipo de trabalho Shopify** *(multi-select)*
```
[ ] App (integração externa, multi-loja, lógica programática)
[ ] Extensão (checkout UI, admin UI, POS, customer account, Shopify Functions)
[ ] Tema (Online Store 2.0 / Liquid)
[ ] Auditoria de loja (SEO, conversão, AEO/GEO)
[ ] Outro: ___
```

**Q5 — Shopify AI Toolkit MCP?** *(docs + schema em contexto; requer Node.js 18+)*
```
[1] Sim — instalar MCP server local (shopify-dev-mcp)
[2] Sim — instalar como plugin (auto-updates)
[3] Não
```

Se MCP seleccionado:
```bash
# Opção 1 — MCP server local (sem auth)
claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest

# Opção 2 — Plugin (auto-updates)
/plugin marketplace add Shopify/shopify-ai-toolkit
/plugin install shopify-plugin@shopify-plugin
```

**Q6 — Deploy**
```
[1] Shopify App Store (público)   [2] App privada / custom app
[3] Shopify Plus (merchant)       [4] Tema — loja do cliente   [5] Outro: ___
```

#### Sub-branch: Design

**Q4** *(multi-select)*: UI/UX · Branding · Motion/Animação · Print/Large format · Ilustração · Outro  
**Q5** *(multi-select)*: Protótipos HTML · SVG/Figma · Lottie · Assets PNG/WebP · PDF · Outro

#### Sub-branch: Vídeo

**Q4** *(multi-select)*: Social media · Explainer · Documental · Tutorial · Outro  
**Q5** *(multi-select)*: AI video · Remotion · Edição tradicional · Legendas locais · Outro

#### Sub-branch: Research

**Q4**: Mercado · Tecnologia · Conteúdo/SEO · Científico · Outro  
**Q5** *(multi-select)*: Relatório MD/PDF · Resumo executivo · Tabela comparativa · JSON/CSV · Outro

#### Sub-branch: Marketing

**Q4** *(multi-select)*: SEO · Google Ads · Meta Ads · LinkedIn · Email · Social orgânico · Outro  
**Q5**: Leads · E-commerce · Brand awareness · Retenção · Outro

---

## FASE 2 — Skills e gaps

Com base no tipo de projecto, pré-selecciona as áreas relevantes e verifica cobertura:

| Tipo                   | Áreas sugeridas                                                  |
|------------------------|------------------------------------------------------------------|
| Website/App            | Desenvolvimento web, DevOps, Analytics                           |
| WordPress              | WordPress, DevOps, Analytics                                     |
| Shopify                | Shopify, Analytics                                               |
| Design UI/UX greenfield | UI/UX (`frontend-design`), Ilustração, Animação                 |
| Design UI/UX iteração  | UI/UX (`impeccable`), Animação, Stitch                           |
| Design Motion/GSAP     | Animação (`gsap/*`), UI/UX, Stitch                               |
| Design Print           | Ilustração                                                       |
| Vídeo                  | Vídeo                                                            |
| Research               | Research, Analytics                                              |
| Marketing              | Marketing/SEO, Analytics                                         |
| Automação / Scraping   | Automação de browser, Desenvolvimento web                        |

**Nota disambiguation design:** se o projecto já tem `PRODUCT.md` ou `DESIGN.md` → sugerir `impeccable`. Se greenfield → `frontend-design`.

Apresenta as sugestões e pergunta se há algo a acrescentar ou remover.

### Detecção de gaps

Para cada aspecto específico do projecto sem cobertura directa nas skills instaladas:

1. Identifica o gap
2. `WebSearch` — procura em GitHub / mcpmarket.com
3. Apresenta:

```
Para "[caso específico]": sem cobertura nativa.

[Se encontrou]
→ repo/skill — descrição breve
Instalo? [S/N]

[Se não encontrou]
Não encontrei nada relevante.
Criar via /create-skill? [S/N/Mais tarde]

[Se parcialmente coberto]
Cobertura parcial: [skill-x] cobre A — falta B
[1] Procurar  [2] Criar  [3] Ignorar
```

---

## FASE 3 — MCPs do projecto

Pergunta se este projecto precisa de MCPs específicos:

```
[ ] Blender (3D)
[ ] Browser Use (automação browser AI-driven — browser-use/browser-use)
[ ] WordPress MCP Adapter (só se projecto WP + WP 6.8+ — expõe Abilities como tools MCP)
[ ] Shopify AI Toolkit MCP (docs + schema Shopify em contexto — só projectos Shopify)
[ ] Analytics / GA4 (já coberto por skill — não precisa MCP)
[ ] Outro: ___
[ ] Nenhum
```

Se Browser Use seleccionado: verificar `pip install browser-use` e instalar skills `browser-use/browser-use` + `browser-use/open-source`. Adicionar ao `.mcp.json` se usar MCP server:
```json
"browser-use": {
  "command": "uvx",
  "args": ["browser-use-mcp"]
}
```

Se WordPress MCP Adapter seleccionado: instrui instalação no projecto:
```bash
composer require wordpress/mcp-adapter
# WP 6.8 apenas (6.9+ já inclui Abilities API):
# composer require wordpress/abilities-api
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

## FASE 4 — Confirmação

```
PROJECTO: [nome] — [tipo]
Stack: [detectado ou declarado]

SKILLS RELEVANTES: [lista]
SKILLS NOVAS: [lista — se gaps aprovados]
MCPs PROJECTO: [lista]

FICHEIROS A CRIAR
  CLAUDE.md           — navegação de código
  .mcp.json           — se MCPs de projecto
  [joca]/memory/projects/[nome].md

Confirmas? [S/N]
```

---

## EXECUÇÃO

### 1. Correr graphify (se não correu ainda)

```bash
graphify update .
```

Se Laravel + Filament:
```bash
composer require laravel/boost --dev
php artisan boost:install
```

Se WordPress:
```bash
# Verificar WP-CLI disponível
wp --version 2>/dev/null || echo "wp_cli_unavailable"
# Detectar versão WP e plugins activos
wp core version 2>/dev/null
wp plugin list --status=active --format=csv 2>/dev/null
```

### 2. Criar/actualizar CLAUDE.md do projecto

Se não existir, criar com:

```markdown
## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, perguntas sugeridas
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Ler ficheiros raw só quando necessário para editar ou o graph não tiver a resposta
4. Actualizar: `graphify update .`

## Projecto
**Nome:** [nome]
**Stack:** [stack]
**Objectivo:** [descrição]
**Directório:** [caminho absoluto]
```

Adicionar `directorio: [caminho absoluto]` no frontmatter para que o grafo global o descubra automaticamente.

Se já existir, adicionar secção de navegação sem apagar conteúdo existente.

### 3. Criar .mcp.json (se MCPs de projecto confirmados)

Criar ou actualizar `.mcp.json` na raiz do projecto:

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
**Why:** [razão de existir]
**How to apply:** [como o JOCA deve ajudar neste projecto]

## Estado actual
A iniciar.

## Decisões tomadas
<!-- preenchido por /save -->

## Pendente
<!-- preenchido por /save -->
```

O campo `directorio:` no frontmatter é obrigatório — é usado pelo script `graphify-global.py` para descobrir e incluir este projecto no grafo global.

Actualizar `memory/INDEX.md`:
```markdown
- [nome-projecto.md](projects/nome-projecto.md) — [descrição curta]
```

### 5. Actualizar Workspace Overview em ~/CLAUDE.md

Adicionar linha na tabela de projectos activos se não existir.

### 6. Executar /create-skill (se gaps aprovados)

Para cada skill nova confirmada.

### 7. Relatório final

```
✓ graphify update . corrido
✓ CLAUDE.md do projecto criado/actualizado
✓ .mcp.json configurado — se aplicável
✓ Memória: [nome-projecto].md criado (com directorio: [caminho])
✓ ~/CLAUDE.md actualizado

Pronto. Usa /resume no início de cada sessão neste projecto.
Para incluir no grafo global: python3 [joca]/.claude/scripts/graphify-global.py
```

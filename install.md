# JOCA — Assistente de Instalação

Estás a executar o assistente de instalação do JOCA.  
Segue estas instruções exactamente. Faz as perguntas bloco a bloco, aguarda resposta antes de avançar.

---

## Verificação inicial

```bash
# Procura pasta chamada JOCA em locais comuns (o caminho antes não importa)
find ~ -maxdepth 5 -name "JOCA" -type d 2>/dev/null | head -5
```

Se encontrou: informa que JOCA já existe nesse caminho e vai actualizar a configuração.

Se não encontrou: pergunta onde instalar — o utilizador escolhe a pasta pai (ex: `~/`, `~/Documents/`, `~/Dev/`); a pasta será criada como `<destino>/JOCA`. Depois:

```bash
# Opção A — clonar repositório público (recomendado)
git clone https://github.com/MirrasPT/JOCA.git <caminho_destino>

# Opção B — copiar de instalação local existente (outra máquina com JOCA)
# O utilizador indica o caminho fonte; o assistente copia estrutura .claude/ e memory/

# Opção C — criar estrutura mínima manualmente
mkdir -p <destino>/.claude/{skills,agents,commands}
mkdir -p <destino>/memory/{tools,projects,feedback}
# Depois copiar manualmente os ficheiros do sistema de origem
```

Perguntar ao utilizador qual opção usar antes de continuar.

---

## FASE 0 — Identidade

Apresenta-te: "Olá. Sou o assistente de instalação do JOCA. Vou fazer algumas perguntas para configurar o teu ambiente. Começa por te apresentares."

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

**Q3 — Localização** *(opcional — influencia língua e contexto cultural)*
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
[1] Instalação global — configurar JOCA sem projecto específico
[2] Tenho um projecto existente — quero ligar o JOCA a ele
[3] Vou começar um projecto novo
```

---

### Branch [1] — Instalação Global

Sem perguntas de projecto. Avança directamente para **FASE 3**.

---

### Branch [2] — Projecto Existente

Pergunta o caminho do projecto:
```
Qual é o caminho da pasta do projecto? (ex: ~/Desktop/_Projetos/meu-site)
```

Depois:
```bash
cd <caminho_projeto>
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify_unavailable"
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "no_claude_md"
```

Apresenta resumo do que detectaste (stack, descrição, fase). Pede confirmação:
```
Detectei:
- Stack: [detectado]
- Descrição: [detectada]
- Fase: [detectada]

Está correcto? Se não, corrige o que estiver errado.
```

Avança para **FASE 3** (com contexto do projecto para pré-selecção de áreas).

---

### Branch [3] — Projecto Novo

**Q6 — Nome do projecto**
```
Resposta livre
```

**Q7 — Tipo de projecto**
```
[1] Website / App / Software
[2] Design
[3] Vídeo
[4] Research / Análise
[5] Marketing
[6] Outro: ___
```

#### Sub-branch 7-1: Website / App / Software

**Q8 — Frontend** *(multi-select)*
```
[ ] Vanilla HTML/CSS/JS
[ ] React
[ ] Vue
[ ] Next.js / Nuxt
[ ] Flutter
[ ] Nenhum (só backend/API)
[ ] Outro: ___
```

**Q9 — Backend** *(multi-select)*
```
[ ] PHP puro
[ ] Laravel
[ ] Node.js / Express
[ ] Python / Django / FastAPI
[ ] Ruby on Rails
[ ] Nenhum (só frontend)
[ ] Outro: ___
```

**Q10 — Base de dados** *(multi-select)*
```
[ ] SQLite
[ ] MySQL / MariaDB
[ ] PostgreSQL
[ ] MongoDB
[ ] Supabase / Firebase
[ ] Nenhuma
[ ] Outro: ___
```

**Q11 — Deploy / Hosting**
```
[1] Vercel / Netlify
[2] cPanel / shared hosting
[3] VPS (DigitalOcean, Hetzner…)
[4] AWS / GCP / Azure
[5] Ainda não sei
[6] Outro: ___
```

#### Sub-branch 7-2: Design

**Q8 — Tipo de design** *(multi-select)*
```
[ ] UI/UX (interfaces digitais)
[ ] Branding / identidade visual
[ ] Motion / animação
[ ] Print / editorial / large format
[ ] Ilustração
[ ] Outro: ___
```

**Q9 — Deliverables esperados** *(multi-select)*
```
[ ] Protótipos HTML/CSS
[ ] Ficheiros SVG / Figma
[ ] Animações Lottie
[ ] Assets de imagem (PNG/WebP)
[ ] PDF / apresentações
[ ] Outro: ___
```

#### Sub-branch 7-3: Vídeo

**Q8 — Tipo de vídeo** *(multi-select)*
```
[ ] Social media (shorts, reels, TikTok)
[ ] Explainer / produto
[ ] Documental / entrevista
[ ] Tutorial / screen recording
[ ] Outro: ___
```

**Q9 — Pipeline / ferramentas** *(multi-select)*
```
[ ] AI video (HeyGen, Runway, Kling…)
[ ] Remotion (código → vídeo)
[ ] Edição tradicional (Premiere, Resolve)
[ ] Legendas / transcrição local
[ ] Outro: ___
```

#### Sub-branch 7-4: Research / Análise

**Q8 — Domínio**
```
[1] Mercado / competidores
[2] Tecnologia / produto
[3] Conteúdo / SEO
[4] Científico / académico
[5] Outro: ___
```

**Q9 — Output esperado** *(multi-select)*
```
[ ] Relatório MD/PDF com citações
[ ] Resumo executivo
[ ] Tabela comparativa
[ ] Dados estruturados (JSON/CSV)
[ ] Outro: ___
```

#### Sub-branch 7-5: Marketing

**Q8 — Canais** *(multi-select)*
```
[ ] SEO / blog
[ ] Google Ads
[ ] Meta Ads (Facebook/Instagram)
[ ] LinkedIn
[ ] Email / newsletters
[ ] Social orgânico
[ ] Outro: ___
```

**Q9 — Objectivo principal**
```
[1] Geração de leads
[2] E-commerce / vendas directas
[3] Brand awareness
[4] Retenção / comunidade
[5] Outro: ___
```

---

## FASE 3 — Configuração JOCA

### Áreas de trabalho

Se vier de branch [2] ou [3], pré-selecciona com base no tipo de projecto:

| Tipo de projecto       | Pré-seleccionado                                           |
|------------------------|------------------------------------------------------------|
| Website/App/Software   | Desenvolvimento web, DevOps, Analytics                     |
| Design — UI/UX         | UI/UX, Branding / identidade, Animação                     |
| Design — Motion/GSAP   | UI/UX, Animação, Stitch                                    |
| Design — Print/Large   | Print / large format, Branding / identidade                |
| Vídeo                  | Vídeo                                                      |
| Research               | Research, Analytics                                        |
| Marketing              | Marketing/SEO, Analytics                                   |
| Automação / Scraping   | Automação de browser, Desenvolvimento web                  |
| Global only            | Nenhum pré-seleccionado                                    |

Apresenta assim:
```
Com base no teu projecto, sugiro estas áreas:

[x] Design de interfaces (UI/UX)        <- pré-seleccionado
[x] Branding / identidade visual        <- pré-seleccionado
[ ] Print / large format (roll-ups, flyers, trifolds)
[ ] Animação (Lottie, GSAP, motion)
[ ] Vídeo / conteúdo
[ ] 3D (Blender)
[ ] Marketing / SEO / Ads
[ ] Desenvolvimento web
[ ] Automação de browser
[ ] DevOps / infra
[ ] Analytics / dados
[ ] Research
[ ] TODOS
[ ] Outro: ___

Confirmas, ajustas ou adicionas?
```

### Mapeamento de áreas para skills

Após confirmação das áreas, determina as skills a instalar:

| Área                  | Skills                                                                                        |
|-----------------------|-----------------------------------------------------------------------------------------------|
| UI/UX                 | `frontend-design` (protótipo), `frontend-dev` (produção React/Vue), `impeccable` (iteração/polish), `slides`, `huashu-design` |
| Branding / identidade | `brand-guidelines` (DESIGN.md + BRAND.md), `canvas-design`                                   |
| Print / large format  | `graphic-design` (roll-ups, flyers, trifolds, posters, HTML→PDF)                             |
| Animação              | `anima` (GSAP+Lottie router), `lottie-animator` (Lottie avançado), `gsap/gsap-core`, `gsap/gsap-timeline`, `gsap/gsap-scrolltrigger`, `gsap/gsap-plugins`, `gsap/gsap-performance` + React/Vue/Svelte se aplicável |
| Stitch (design-to-code) | `stitch/stitch-design`, `stitch/stitch-loop`, `stitch/design-md`, `stitch/taste-design`, `stitch/react-components` |
| Vídeo                 | `video`, `hyperframes/core`, `hyperframes/website-to-video`, `watch`                         |
| 3D                    | `blender` (skill) + blender (MCP em .mcp.json)                                               |
| Marketing/SEO         | `paid-ads`, `seo`, `seo-local`, `email-sequence`, `content-strategy`, `social-content`, `copywriting` |
| Desenvolvimento web   | `webapp-testing` + skills por stack (ver tabela abaixo)                                      |
| Automação de browser  | `browser-use/browser-use` (CLI) + opcionalmente `browser-use/remote-browser`, `browser-use/open-source`, `browser-use/cloud` |
| DevOps                | `devops-engineer`                                                                             |
| Analytics             | `google-analytics`, `microsoft-clarity`                                                      |
| Research              | `deep-research`                                                                               |
| Sempre (base)         | `caveman`, `karpathy-guidelines`, `agent-context`, `create-skill`, `feedback-joca`           |

Skills por stack (desenvolvimento web):

| Stack       | Skills adicionais                                      |
|-------------|--------------------------------------------------------|
| Laravel     | laravel-specialist, php-pro, postgres-pro, test-master |
| PHP puro    | php-pro                                                |
| PostgreSQL  | postgres-pro                                           |
| React       | webapp-testing, gsap/gsap-react (se animações)        |
| Qualquer    | api-designer                                           |

### Detecção de gaps

Após mapear as áreas para skills, verifica se o caso concreto do utilizador tem cobertura adequada.

Para cada área/resposta específica que não encaixe directamente nas skills existentes:

1. **Identifica o gap**: ex. "design de lona" → não existe skill de large format print
2. **Pesquisa online**: usa `WebSearch` para procurar skills relevantes em GitHub ou mcpmarket.com
3. **Apresenta opções**:

Se encontrou algo:
```
Para "design de lona / large format", não existe skill nativa no JOCA.

Encontrei online:
→ [repo/skill-name] — descrição breve

Instalo? [S/N]
```

Se não encontrou:
```
Para "[caso específico]", não existe skill nativa nem encontrei nada relevante online.

Posso criar uma via /create-skill (research → draft → improve → evaluate).

Criar skill "[nome-sugerido]"? [S/N/Mais tarde]
```

Se parcialmente coberto:
```
Para "[caso]" tens cobertura parcial:
→ [skill-a] cobre X ✓
→ Falta cobertura de Y

Procuro skill específica ou ignoro por agora?
[1] Procurar online
[2] Criar com /create-skill
[3] Ignorar
```

### Integrações Google *(multi-select)*
```
[ ] Gmail
[ ] Google Calendar
[ ] Google Drive / Docs
[ ] Google Analytics (GA4)
[ ] Nenhuma
```

### Ferramentas extra *(multi-select)*
```
[ ] Browser automation (Playwright — MCP)
[ ] Browser Use (automação browser AI-driven — pip install browser-use)
[ ] Web scraping (Firecrawl — requer Docker)
[ ] Microsoft Clarity (requer Composio)
[ ] HuggingFace
[ ] Outro: ___
```

Se Browser Use seleccionado — verificar dependência:
```bash
pip install browser-use 2>/dev/null || echo "pip_unavailable"
```
Instala skills `browser-use/browser-use` + `browser-use/open-source`. Para uso remoto/cloud adicionar `browser-use/remote-browser` e `browser-use/cloud`.

### Geração de imagens
```
[1] OpenAI gpt-image-2 (alta qualidade, texto em imagens)
[2] Google Gemini (drafts rápidos, barato)
[3] Ambos
[4] Não preciso
```

---

## FASE 4 — Confirmação

Apresenta o plano completo antes de executar:

```
Vou configurar o seguinte:

IDENTIDADE
  Utilizador: [Nome] ([papel][, localização])

SKILLS ([n] total)
  Base:    caveman, karpathy-guidelines, agent-context, create-skill, feedback-joca
  Design:  [lista]
  Dev:     [lista]
  ...

MCPs GLOBAIS
  [lista]

MCPs PROJECTO (.mcp.json)
  [lista — só se vier de branch 2 ou 3]

SKILLS A CRIAR / INSTALAR DA NET
  [lista — se detectou gaps]

FICHEIROS A CRIAR/ACTUALIZAR
  ~/CLAUDE.md              — perfil + workspace overview
  [caminho_joca]/memory/   — estrutura de memória
  [caminho_projeto]/.mcp.json  — se aplicável

Confirmas? [S/N]
```

---

## FASE DEP — Dependências técnicas

Após confirmação, verifica dependências antes de executar:

```bash
python3 --version 2>/dev/null || python --version 2>/dev/null
graphify --version 2>/dev/null
node --version 2>/dev/null
bun --version 2>/dev/null
docker --version 2>/dev/null
curl -s http://localhost:3002/health 2>/dev/null
```

Reporta o estado de cada um. Se algo em falta e for necessário para as escolhas feitas, instrui o utilizador a instalar antes de continuar.

---

## EXECUÇÃO

### 1. Actualizar ~/CLAUDE.md

Lê o ficheiro actual. Actualiza ou cria a secção JOCA:

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
Toolkit instalado em: [caminho_joca]
Skills activas: [lista por categoria]
MCPs globais: [lista]
Comandos: /install, /init-project, /resume, /save, /create-skill, /feedback-joca, /help-joca
```

Não apagar conteúdo existente não relacionado com JOCA.

### 2. Criar estrutura de memória (se não existir)

```
[joca]/memory/
  INDEX.md
  projects/      ← entradas por projecto (/save cria automaticamente)
  tools/         ← graphify, mcp-routing, laravel-stack, motion
  feedback/      ← sessões /feedback-joca
```

### 3. Configurar MCPs globais

Para Playwright e Firecrawl — verificar se já estão em `~/.claude.json`. Se não, instruir o utilizador a adicioná-los (Claude Code não pode editar ~/.claude.json directamente sem permissão).

Para Google (Gmail/Calendar/Drive) — são connectors nativos OAuth; instruir o utilizador a activá-los em claude.ai/settings.

### 4. Criar/actualizar .mcp.json do projecto (se branch 2 ou 3)

Para MCPs específicos do projecto (ex: blender):
```json
{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["blender-mcp"]
    }
  }
}
```

### 5. Criar entrada de memória do projecto (se branch 2 ou 3)

Criar `[joca]/memory/projects/[nome-projecto].md` e actualizar `INDEX.md`.

### 6. Executar /create-skill para gaps detectados (se confirmado pelo utilizador)

Para cada skill nova confirmada, executar o pipeline create-skill.

### 7. Relatório final

```
✓ ~/CLAUDE.md actualizado
✓ Estrutura de memória criada
✓ [n] skills configuradas
✓ MCPs: [lista]
[✓/✗] Dependências técnicas: [resumo]

JOCA pronto.
→ Navega para um projecto e corre /init-project para o ligar ao JOCA.
→ No início de cada sessão, corre /resume para carregar contexto.
→ Para gerar o grafo global (JOCA + todos os projectos): python3 .claude/scripts/graphify-global.py
→ Referência completa de comandos: /help-joca
```

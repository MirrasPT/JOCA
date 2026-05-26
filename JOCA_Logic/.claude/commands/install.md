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

## FASE 1 — Soul / Calibração de Personalidade

Configura os parâmetros core do `memory/soul.md`. Estes valores moldam o comportamento de todo o JOCA em todas as sessões.

**Q-SOUL-1 — Nível de Autonomia**
`AskUserQuestion`:
```
question: "Quanto autónomo queres que o JOCA seja?"
header: "Autonomia"
options:
  - "Máxima — executa tudo sem perguntar, só pára em irreversíveis (Recomendado)"
  - "Alta — executa a maioria, pede em decisões de arquitectura"
  - "Moderada — pede confirmação em alterações multi-ficheiro"
  - "Baixa — pede sempre antes de alterar código"
```

Mapear para `autonomy_level`: Máxima=0.95, Alta=0.80, Moderada=0.60, Baixa=0.30

**Q-SOUL-2 — Estilo de Comunicação**
`AskUserQuestion`:
```
question: "Como preferes que o JOCA comunique?"
header: "Comunicação"
options:
  - "Caveman Full — fragmentos, zero filler, máxima compressão (Recomendado)"
  - "Caveman Lite — sem filler mas frases completas"
  - "Normal — profissional e conciso, sem compressão extrema"
```

Mapear para `communication_mode`: full, lite, normal (se normal: desactivar caveman default)

**Q-SOUL-3 — Comportamento em Erros**
`AskUserQuestion`:
```
question: "Quando encontra um erro no teu código, o JOCA deve:"
header: "Erros"
options:
  - "Corrigir imediatamente sem perguntar (Recomendado)"
  - "Mostrar o problema e a correcção, aplicar após confirmação"
  - "Reportar o problema sem corrigir — eu decido"
```

Mapear para `error_tolerance`: fail-fast, balanced, permissive

**Q-SOUL-4 — Testes Automáticos**
`AskUserQuestion`:
```
question: "Queres que o JOCA corra testes automaticamente após alterações?"
header: "Auto-test"
options:
  - "Sim — trigger automático após código implementado (Recomendado)"
  - "Não — só quando eu pedir"
```

Mapear para `auto_test`: true, false

**Q-SOUL-5 — Pontos Fortes** *(multi-select — lista com checkboxes)*
```
Quais são as tuas áreas fortes? (selecciona todas as que se aplicam)
[ ] Design / UX
[ ] Frontend (HTML, CSS, JS, React, Vue…)
[ ] Backend (PHP, Python, Node, Ruby…)
[ ] DevOps / Infra
[ ] Marketing / Growth
[ ] Gestão de produto
[ ] Outro: ___
```

**Q-SOUL-6 — Áreas de Aprendizagem** *(multi-select — lista com checkboxes)*
```
Em que áreas estás a aprender ou tens menos experiência? (selecciona todas as que se aplicam)
[ ] Design / UX
[ ] Frontend
[ ] Backend / Arquitectura
[ ] DevOps / Infra
[ ] Marketing / Growth
[ ] Gestão de produto
[ ] Outro: ___
```

### Aplicar Calibração

Após as respostas, ler `memory/soul.md` e substituir os placeholders:

| Placeholder | Valor |
|-------------|-------|
| `<USER_NAME>` | Q1 (Nome) |
| `<USER_ROLE>` | Q2 (Papel) |
| `<COMMUNICATION_MODE>` | Q-SOUL-2 (full / lite / normal) |
| `<USER_STRENGTHS>` | Q-SOUL-5 (lista separada por vírgula) |
| `<USER_LEARNING_AREAS>` | Q-SOUL-6 (lista separada por vírgula) |
| `<STRENGTH_AREA>` | Primeiro item de Q-SOUL-5 |
| `<LEARNING_AREA>` | Primeiro item de Q-SOUL-6 |

Actualizar secção Calibration Parameters:

```yaml
autonomy_level: [Q-SOUL-1]
communication_mode: [Q-SOUL-2]
assertiveness: [inferido: máxima autonomia → 0.85, alta → 0.75, moderada → 0.60, baixa → 0.50]
error_tolerance: [Q-SOUL-3]
explanation_depth: on-demand
auto_test: [Q-SOUL-4]
```

Confirmar inline:
```
✓ Soul calibrado — autonomia [X], comunicação [Y], erros [Z]
  Fortes: [lista] · A aprender: [lista]
```

---

## FASE 2 — Áreas de Trabalho

Áreas globais que determinam quais skills ficam activas.

`AskUserQuestion`:
```
question: "Que áreas de trabalho usas?"
header: "Áreas"
multiSelect: true
options:
  - "Design (UI/UX, branding, print, ilustração)"
  - "Desenvolvimento web (frontend + backend)"
  - "Marketing (SEO, ads, email, conteúdo)"
  - "Media (vídeo, animação, 3D)"
```

Opção "Outro" (automática) permite especificar: WordPress, Shopify, Research, Analytics, DevOps, ou combinações específicas.

### Mapeamento áreas → skills

| Área               | Skills activadas                                                               |
|--------------------|--------------------------------------------------------------------------------|
| UI/UX              | frontend-design, frontend-dev, brand-guidelines                                |
| Branding           | brand-guidelines, canvas-design                                                |
| Print              | graphic-design, brand-guidelines                                               |
| Animação           | anima (GSAP+Lottie router), gsap/gsap-core, gsap/gsap-timeline, gsap/gsap-scrolltrigger, gsap/gsap-plugins, gsap/gsap-performance + React/Vue/Svelte se aplicável |
| Vídeo              | video, hyperframes, remotion, watch                                             |
| 3D                 | blender (skill + MCP)                                                          |
| Marketing/SEO      | paid-ads, seo, seo-local, email-sequence, content-strategy, social-content, copywriting |
| Dev web            | webapp-testing, api-designer, laravel-specialist, test-master                  |
| WordPress          | wordpress-router, wp-block-development, wp-block-themes, wp-plugin-development, wp-rest-api, wp-performance, wp-phpstan, wp-playground |
| Shopify            | shopify-router, shopify-app, shopify-theme, shopify-store-audit, shopify-store-fixer |
| DevOps             | devops-engineer                                                                |
| Analytics          | google-analytics, microsoft-clarity                                            |
| Research           | deep-research                                                                  |
| Base (sempre)      | caveman, karpathy-guidelines, agent-context, create-skill, feedback-joca       |

### Detecção de gaps

Para cada área seleccionada sem cobertura directa nas skills existentes:
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

---

## FASE 3 — MCPs e Integrações

### Google *(multi-select)*
```
[ ] Gmail   [ ] Google Calendar   [ ] Google Drive/Docs   [ ] Google Analytics (GA4)   [ ] Nenhuma
```

### Ferramentas *(multi-select)*
```
[ ] GitHub (repositórios, PRs, issues — requer token)
[ ] Playwright (browser automation)
[ ] Firecrawl (web scraping — requer Docker ou API key)
[ ] Microsoft Clarity (requer Composio API key)
[ ] Antigravity CLI (Gemini — análise multimodal, vídeo, PDF, contexto 1M)
[ ] Codex CLI (code review adversarial — requer ChatGPT Plus ou OPENAI_API_KEY)
[ ] Outro: ___
```

### Geração de imagens
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

## FASE 4 — Chaves de API

Com base nas selecções, determinar quais chaves são necessárias:

| Ferramenta                    | Variável                        | Quando é necessária                       |
|-------------------------------|----------------------------------|-------------------------------------------|
| GitHub MCP                    | `GITHUB_PERSONAL_ACCESS_TOKEN`  | GitHub seleccionado                       |
| OpenAI (img-gen + Codex)      | `OPENAI_API_KEY`                | img-gen OpenAI ou Codex CLI               |
| Google Gemini (img-gen + agy) | `GEMINI_API_KEY`                | img-gen Gemini ou Antigravity CLI         |
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
- "Já está configurada" → assumir OK
- "Mais tarde" → marcar como ⚠ pendente no relatório final

**Onde ficam guardadas:**
- Chaves MCP servers → bloco `env` do servidor em `.mcp.json`
- `OPENAI_API_KEY`, `GEMINI_API_KEY` → `env` global em `~/.claude.json`
- Se preferir não escrever em ficheiros: instruir comando de export para o shell

---

## FASE 5 — Confirmação

Apresentar resumo completo:

```
IDENTIDADE
  [Nome] — [papel][, localização] — [OS]

SOUL
  Autonomia: [nível] · Comunicação: [modo] · Erros: [comportamento] · Auto-test: [sim/não]
  Fortes: [lista] · A aprender: [lista]

SKILLS ([n])
  Base:  caveman, karpathy-guidelines, agent-context, create-skill, feedback-joca
  [categoria]: [lista]

MCPs GLOBAIS:   [lista]
SKILLS NOVAS:   [lista — se gaps detectados]

API KEYS
  ✓ [NOME_CHAVE] — configurada
  ⚠ [NOME_CHAVE] — pendente (instruções no final)
  ○ [NOME_CHAVE] — assumida do sistema

FICHEIROS
  ~/CLAUDE.md           actualizar
  memory/soul.md        preencher placeholders
  memory/               criar estrutura (se não existir)
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

## FASE 6 — Execução

### 1. Preencher soul.md

Ler `memory/soul.md`, substituir todos os placeholders `<...>` com os valores recolhidos nas FASE 0 e FASE 1. Actualizar Calibration Parameters.

### 2. ~/CLAUDE.md

Ler ficheiro actual. Adicionar/actualizar sem apagar conteúdo existente:

```markdown
## Utilizador
[Nome] — [papel][, localização]

## JOCA
Toolkit instalado em: [caminho_joca]
Comandos: /install · /init-project · /resume · /save · /create-skill · /plan · /debug · /review-code · /review-design · /feedback-joca · /feedback-projeto · /help-joca · /one-shot · /upgrade-joca · /update-joca

Skills activas:
- Base: [lista]
- [categoria]: [lista]

MCPs globais: [lista]

CLIs externos: [lista — se Codex/Gemini CLI seleccionados]

## Workspace

## Projectos activos
| Directório | Descrição |
|-----------|-----------|
<!-- Entradas adicionadas por /init-project e /save -->

@[caminho_joca]/JOCA_Logic/CLAUDE.md
```

### 3. Estrutura de memória

Confirmar que existem (criar se não existirem):
- `memory/INDEX.md`
- `memory/projects/` (com `.gitkeep`)
- `memory/tools/`
- `memory/feedback/` (com `.gitkeep`)

### 4. MCPs globais

Playwright e Firecrawl: verificar `~/.claude.json`. Se ausentes, mostrar ao utilizador o bloco JSON a adicionar.
Google connectors: instruir activação em claude.ai/settings (OAuth nativo).

### 5. API Keys

Para cada chave marcada como "introduzir agora":

**MCP servers** — escrever no bloco `env` do servidor em `.mcp.json`:
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<valor>" }
}
```

**Chaves de agentes** — adicionar ao bloco `env` global de `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<valor>", "GEMINI_API_KEY": "<valor>" } }
```

Para chaves ⚠ pendentes — listar com link de obtenção:
- `GITHUB_PERSONAL_ACCESS_TOKEN` → github.com/settings/tokens (scope: repo, read:org)
- `OPENAI_API_KEY` → platform.openai.com/api-keys
- `GEMINI_API_KEY` → aistudio.google.com/apikey
- `COMPOSIO_API_KEY` → app.composio.dev/settings

### 6. CLIs externos

**Antigravity CLI** (se seleccionado):
```bash
npm install -g @anthropic-ai/antigravity
```
Instruir: `agy auth login` ou definir `GEMINI_API_KEY`.

**Codex CLI** (se seleccionado):
```bash
npm install -g @openai/codex
```
Instruir: `codex login` ou definir `OPENAI_API_KEY`.

### 7. Dependências

```bash
python3 --version 2>/dev/null || python --version
graphify --version 2>/dev/null || echo "graphify_unavailable"
node --version 2>/dev/null
bun --version 2>/dev/null
docker --version 2>/dev/null
```

Para cada ferramenta em falta que foi seleccionada, instruir instalação.

### 8. JOCA_UI (instala por defeito)

```bash
cd <caminho_joca>/../JOCA_UI
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && cd ..
chmod +x start.sh stop.sh 2>/dev/null
```

Verificar: `node <caminho_joca>/../JOCA_UI/backend/dist/server.js` inicia sem erros.
O JOCA_UI detecta automaticamente o JOCA_Logic como directório irmão — zero configuração.

### 9. StatusLine (silencioso)

```bash
mkdir -p ~/.claude
cp <caminho_joca>/.claude/scripts/statusline-command.sh ~/.claude/statusline-command.sh 2>/dev/null || true
chmod +x ~/.claude/statusline-command.sh 2>/dev/null || true
```

Configurar `~/.claude/settings.json` — merge com existente:
- `statusLine` → `bash ~/.claude/statusline-command.sh`
- Hook `UserPromptSubmit` → timestamp última mensagem

### 10. Launcher

`AskUserQuestion`:
```
question: "Criar atalho para abrir o JOCA UI com um clique?"
header: "Launcher"
options:
  - "Desktop"
  - "Pasta do JOCA"
  - "Outro caminho"
  - "Não criar"
```

Se "Outro caminho": pedir caminho em texto livre.

Se seleccionado:

**macOS:**
```bash
cp "<caminho_joca>/../JOCA_UI/JOCA UI.command" "<destino>/JOCA UI.command"
chmod +x "<destino>/JOCA UI.command"
```

**Windows:**
```powershell
Copy-Item "<caminho_joca>\..\JOCA_UI\JOCA UI.vbs" "<destino>\JOCA UI.vbs"
```

### 11. Skills novas (se confirmado)

Executar `/create-skill [nome]` para cada skill nova aprovada na FASE 2.

### 12. Relatório final

```
✓ Soul calibrado — [autonomia], [comunicação], [erros]
✓ ~/CLAUDE.md actualizado
✓ Memória: estrutura verificada
✓ Skills: [n] configuradas
✓ MCPs: [lista]
✓ JOCA_UI: [instalado/saltado]
✓ StatusLine: instalada
[estado] Deps: python / graphify / node / bun / docker

API KEYS
  ✓ [chave] — configurada
  ⚠ [chave] — PENDENTE → [URL]

JOCA pronto.
→ Iniciar interface: bash JOCA_UI/start.sh (macOS) ou JOCA_UI\start.bat (Windows)
→ Para ligar projectos: navega para a pasta e corre /init-project
→ Início de sessão: /resume
→ Referência rápida: /help-joca
```

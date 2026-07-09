# /install — Setup e Configuracao do JOCA

Assistente interactivo de instalacao e reconfiguracao. Pode correr em qualquer altura — reconfigura sem apagar o que ja existe.

**Repositorio:** https://github.com/MirrasPT/JOCA.git

**Dados protegidos (NUNCA sobrescrever em reinstalacao):**
- `memory/projects/` — dados de projectos do utilizador
- `memory/feedback/` — sessoes de feedback
- `memory/soul.md` — calibracao de personalidade
- `JOCA_UI/data/` — projectos, sessoes, settings do UI (projects.json, project-memory.json, session-snapshots.json, ui-settings.json)
- Ficheiros com `origin: local` no frontmatter — skills/agents criados localmente

**Modo de apresentacao:**
- Perguntas com <=4 opcoes exclusivas -> usar a ferramenta `AskUserQuestion` (selector visual com setas)
- Perguntas com mais de 4 opcoes ou multi-select -> apresentar lista numerada/com checkboxes e aguardar input de texto
- Uma fase de cada vez. Aguardar resposta antes de avancar.

---

## FASE 0 — Identidade

Verificar se ja existe perfil em `~/CLAUDE.md`. Se existir, extrair nome e papel e perguntar via `AskUserQuestion`:

```
question: "Encontrei o teu perfil: [Nome], [papel]. O que queres fazer?"
header: "Perfil"
options:
  - "Manter como esta" -> saltar para FASE 1
  - "Actualizar perfil" -> continuar abaixo
```

Se nao existir perfil, ou se escolheu actualizar:

**Q1 — Nome**
Pergunta de texto livre: "Como te chamas?"

**Q2 — Papel**
Lista numerada (>4 opcoes):
```
Qual e o teu papel principal?
[1] Designer
[2] Desenvolvedor
[3] Full-stack
[4] Marketer / Growth
[5] Product Manager
[6] Outro: ___
```

**Q3 — Localizacao** *(opcional)*
`AskUserQuestion`:
```
question: "Onde estas localizado? (opcional)"
header: "Localizacao"
options:
  - "Portugal"
  - "Brasil"
  - "Outro pais"
  - "Prefiro nao dizer"
```

**Q4 — Sistema Operativo**

Detectar automaticamente via ambiente de execucao (verificar `process.platform` ou `$env:OS` / `uname`). Apresentar o resultado e perguntar via `AskUserQuestion`:

```
question: "Detectei [OS]. Confirmas?"
header: "Sistema"
options:
  - "Sim, correcto"
  - "Nao — macOS"
  - "Nao — Windows"
  - "Nao — Linux"
```

Guardar o OS confirmado — sera usado ao longo de toda a instalacao para escolher comandos cross-platform:
- **Windows** -> PowerShell (`powershell` / `pwsh`) para todos os comandos
- **macOS / Linux** -> `bash` para todos os comandos

---

## FASE SOUL — Calibracao de Personalidade

Configura os parametros core do `memory/soul.md`. Estes valores moldam o comportamento de todo o JOCA em todas as sessoes.

**Q-SOUL-1 — Nivel de Autonomia**
`AskUserQuestion`:
```
question: "Quanto autonomo queres que o JOCA seja?"
header: "Autonomia"
options:
  - "Maxima — executa tudo sem perguntar, so para em irreversiveis (Recomendado)"
  - "Alta — executa a maioria, pede em decisoes de arquitectura"
  - "Moderada — pede confirmacao em alteracoes multi-ficheiro"
  - "Baixa — pede sempre antes de alterar codigo"
```

Mapear para `autonomy_level`: Maxima=0.95, Alta=0.80, Moderada=0.60, Baixa=0.30

**Q-SOUL-2 — Estilo de Comunicacao**
`AskUserQuestion`:
```
question: "Como preferes que o JOCA comunique?"
header: "Comunicacao"
options:
  - "Caveman Full — fragmentos, zero filler, maxima compressao (Recomendado)"
  - "Caveman Lite — sem filler mas frases completas"
  - "Normal — profissional e conciso, sem compressao extrema"
```

Mapear para `communication_mode`: full, lite, normal (se normal: desactivar caveman default)

**Q-SOUL-3 — Comportamento em Erros**
`AskUserQuestion`:
```
question: "Quando encontra um erro no teu codigo, o JOCA deve:"
header: "Erros"
options:
  - "Corrigir imediatamente sem perguntar (Recomendado)"
  - "Mostrar o problema e a correccao, aplicar apos confirmacao"
  - "Reportar o problema sem corrigir — eu decido"
```

Mapear para `error_tolerance`: fail-fast, balanced, permissive

**Q-SOUL-4 — Testes Automaticos**
`AskUserQuestion`:
```
question: "Queres que o JOCA corra testes automaticamente apos alteracoes?"
header: "Auto-test"
options:
  - "Sim — trigger automatico apos codigo implementado (Recomendado)"
  - "Nao — so quando eu pedir"
```

Mapear para `auto_test`: true, false

**Q-SOUL-5 — Pontos Fortes** *(multi-select — lista com checkboxes)*
```
Quais sao as tuas areas fortes? (selecciona todas as que se aplicam)
[ ] Design / UX
[ ] Frontend (HTML, CSS, JS, React, Vue...)
[ ] Backend (PHP, Python, Node, Ruby...)
[ ] DevOps / Infra
[ ] Marketing / Growth
[ ] Gestao de produto
[ ] Outro: ___
```

**Q-SOUL-6 — Areas de Aprendizagem** *(multi-select — lista com checkboxes)*
```
Em que areas estas a aprender ou tens menos experiencia? (selecciona todas as que se aplicam)
[ ] Design / UX
[ ] Frontend
[ ] Backend / Arquitectura
[ ] DevOps / Infra
[ ] Marketing / Growth
[ ] Gestao de produto
[ ] Outro: ___
```

### Aplicar Calibracao

Apos as respostas, ler `memory/soul.md` e substituir os placeholders:

| Placeholder | Valor |
|-------------|-------|
| `<USER_NAME>` | Q1 (Nome) |
| `<USER_ROLE>` | Q2 (Papel) |
| `<COMMUNICATION_MODE>` | Q-SOUL-2 (full / lite / normal) |
| `<USER_STRENGTHS>` | Q-SOUL-5 (lista separada por virgula) |
| `<USER_LEARNING_AREAS>` | Q-SOUL-6 (lista separada por virgula) |
| `<STRENGTH_AREA>` | Primeiro item de Q-SOUL-5 |
| `<LEARNING_AREA>` | Primeiro item de Q-SOUL-6 |

Actualizar seccao Calibration Parameters:

```yaml
autonomy_level: [Q-SOUL-1]
communication_mode: [Q-SOUL-2]
assertiveness: [inferido: maxima autonomia -> 0.85, alta -> 0.75, moderada -> 0.60, baixa -> 0.50]
error_tolerance: [Q-SOUL-3]
explanation_depth: on-demand
auto_test: [Q-SOUL-4]
```

Confirmar inline:
```
OK Soul calibrado — autonomia [X], comunicacao [Y], erros [Z]
  Fortes: [lista] · A aprender: [lista]
```

---

## FASE 2 — Areas de Trabalho

Areas globais que determinam quais skills ficam activas. O JOCA tem **133 skills** com sistema de triggers RFC 2119 (MUST/SHOULD/MAY) — activacao automatica quando relevancia >= 60%.

`AskUserQuestion`:
```
question: "Que areas de trabalho usas?"
header: "Areas"
multiSelect: true
options:
  - "Design (UI/UX, branding, print, ilustracao)"
  - "Desenvolvimento web (frontend + backend)"
  - "Marketing (SEO, ads, email, conteudo)"
  - "Media (video, animacao, 3D)"
```

Opcao "Outro" (automatica) permite especificar: WordPress, Shopify, Research, Analytics, DevOps, ou combinacoes especificas.

### Mapeamento areas -> skills

| Area               | Skills activadas                                                               |
|--------------------|--------------------------------------------------------------------------------|
| UI/UX              | frontend, mobile, design-system, design-tokens, component-system, tailwind, shadcn, react-composition, react-patterns, design-review, landing-page |
| Branding           | brand-guidelines, brand-positioning                                            |
| Print              | graphic-design, brand-guidelines                                               |
| Animacao           | anima (GSAP router), lottie-animator                                           |
| Video              | video, hyperframes, remotion, lyric-align (+ agent `watch`)                      |
| Marketing/SEO      | marketing, paid-ads, seo, seo-local, email-sequence, content-strategy, content-calendar, social-content, copywriting, page-cro, lead-capture, launch-strategy, ab-test-setup, competitor-profiling, analytics-tracking |
| Dev web (Laravel)  | laravel-specialist, filament, laravel-react, rest-api, mysql, auth, security, saas-patterns, file-storage, caching, queues, bullmq, horizon, reverb-realtime, search, webhooks, availability, error-tracking-dev, error-tracking-prod, github |
| Email              | react-email, transactional-email, postmark                                     |
| Deploy / DevOps    | deploy-docker, deploy-ploi, deploy-cpanel, deploy-vps                          |
| Portugal           | portugal-payments (ifthenpay/MB WAY), portugal-invoicing (Moloni)              |
| WordPress          | wordpress-router, wp-project-triage, wp-block-development, wp-block-themes, wp-plugin-development, wp-plugin-directory-guidelines, wp-rest-api, wp-abilities-api, wp-interactivity-api, wp-performance, wp-performance-review, wp-phpstan, wp-playground, wp-wpcli-and-ops, wpds |
| Shopify            | shopify-router, shopify-app, shopify-theme, shopify-store-audit, shopify-store-fixer |
| Wix                | wix-cli                                                                        |
| Automacao          | browser-automate (conduzir apps web locais / litegraph via Playwright)          |
| JOCA / SDK         | agent-sdk (Agent SDK orquestrador), comfy-mcp-workarounds (ComfyUI MCP)        |
| Analytics          | google-analytics, microsoft-clarity                                            |
| Research           | deep-research (agent)                                                          |
| Specs / Planning   | plan, planning, prd, tech-spec, task-breakdown, adr, rfc, c4-diagram, blueprint, html-review |
| Base (sempre)      | caveman, karpathy-guidelines, agent-context, create-skill, pt-pt-translator, yagni |
| Autonomia (sempre) | auto-orquestracao via `rules/task-intake.md` (4 vias) + agentes `task-router`, `master-orchestrator` (loop) + comando `/goal`; padroes em `rules/orchestration-patterns.md` |
| Knowledge & Pessoal | knowledge-ingest (`/know`, requer markitdown), automations, personal-comms (+ agentes `knowledge-ingest`, `automation-builder`, `personal-comms`) — FUTUROS Fases 2/3/5 |
| Windows (auto)     | `joca-ui-windows` — activa automaticamente quando o OS (Q4) e Windows (ver FASE EXECUCAO 8) |

### Deteccao de gaps

Para cada area seleccionada sem cobertura directa nas skills existentes:
1. Identificar o gap
2. `WebSearch` em GitHub e awesome-lists (procurar skill ou CLI relevante)
3. Apresentar resultado:

```
Para "[caso]": sem cobertura nativa.

[Se encontrou]
-> repo/skill — descricao
Instalo? [S/N]

[Se nao encontrou]
Nao encontrei nada relevante.
Crio via /create-skill? [S/N/Mais tarde]

[Se cobertura parcial]
[skill-x] cobre A OK — falta B
[1] Procurar online  [2] Criar  [3] Ignorar
```

---

## FASE 3 — Integracoes e Ferramentas

### Browser Automation *(multi-select)*
`AskUserQuestion`:
```
question: "Que ferramentas de browser automation queres instalar?"
header: "Browser"
options:
  - "browser-use CLI (scraping, screenshots, automacao com AI)"
  - "Playwright Agent CLI (browser control para coding agents)"
  - "Ambos (recomendado)"
  - "Nenhum"
```

Se seleccionado: instalar via comandos na FASE EXECUCAO.

### CLIs Externos *(multi-select, agrupados)*

```
Source control & cloud
[ ] gh             — GitHub (repos, PRs, issues, code search)
[ ] gws            — Google Workspace CLI `@googleworkspace/cli` (Drive, Gmail, Calendar, Sheets) — requer gcloud; auth com `--scopes` explícito + publicar app (senão token expira ~7d)
[ ] gcloud         — Google Cloud (prereq para gws auth setup)
[ ] aws-cli        — AWS S3, deploy, file-storage skill

AI assistants (cross-CLI bridge)
[ ] Antigravity (agy)    — Gemini multimodal (video, PDF, 1M ctx)
[ ] Codex                — OpenAI code review adversarial (ChatGPT Plus ou OPENAI_API_KEY)
[ ] huggingface-cli      — modelos, datasets, spaces

Media & content
[ ] ffmpeg         — video/audio processing, encoding, thumbnails
[ ] yt-dlp         — download de video (usado pelo agent `watch`)
[ ] whisperx       — transcricao local STT (usado pelo agent `watch`)
[ ] markitdown     — converte ficheiros/URL (PDF/Office/img/audio/YouTube) -> Markdown; motor do /know (skill knowledge-ingest). pip install markitdown-mcp + registar MCP markitdown
[ ] zmail-cli      — Zoho Mail terminal (envio/leitura) — requer Java 11+

Dev & observability
[ ] sentry-cli         — error tracking, releases, source maps
[ ] stripe-cli         — webhooks listen, payment testing local
[ ] cli-printing-press — gera CLIs/MCP servers a partir de APIs (requer Go 1.26+)

[ ] Nenhum
```

### Google Connectors *(multi-select)*
```
[ ] Gmail   [ ] Google Calendar   [ ] Google Drive/Docs   [ ] Google Analytics (GA4)   [ ] Nenhuma
```
Nota: Google connectors sao activados em claude.ai/settings (OAuth nativo) — nao precisam de MCP.

### Geracao de imagens
`AskUserQuestion`:
```
question: "Que motor de geracao de imagens queres usar?"
header: "Img Gen"
options:
  - "Google Gemini (recomendado — geral, drafts, aspect ratios)"
  - "OpenAI gpt-image-2 (texto em imagens, produto, inpainting)"
  - "Ambos"
  - "Nao preciso"
```

---

## FASE APIs — Chaves de API

Com base nas seleccoes, determinar quais chaves sao necessarias. Apenas duas chaves de agente:

| Ferramenta                    | Variavel                        | Quando e necessaria                       |
|-------------------------------|----------------------------------|-------------------------------------------|
| OpenAI (img-gen + Codex)      | `OPENAI_API_KEY`                | img-gen OpenAI ou Codex CLI               |
| Google Gemini (img-gen + agy) | `GEMINI_API_KEY`                | img-gen Gemini ou Antigravity CLI         |

**Nota:** GitHub usa `gh auth login` (OAuth interactivo) — nao precisa de token manual. HuggingFace usa `huggingface-cli login`. Sentry/Stripe usam tokens proprios (`SENTRY_AUTH_TOKEN`, `STRIPE_API_KEY`) ou login interactivo.

Para cada chave necessaria, perguntar via `AskUserQuestion`:
```
question: "[Ferramenta] precisa de [NOME_CHAVE]. Estado actual: [detectado / nao encontrado]"
header: "API Key"
options:
  - "Introduzir agora"
  - "Ja esta configurada no sistema"
  - "Configurar mais tarde"
```

- "Introduzir agora" -> receber o valor (nao mostrar em claro depois de confirmar)
- "Ja esta configurada" -> assumir OK
- "Mais tarde" -> marcar como PENDENTE no relatorio final

**Onde ficam guardadas:**
- `OPENAI_API_KEY`, `GEMINI_API_KEY` -> `env` global em `~/.claude.json`
- Se preferir nao escrever em ficheiros: instruir comando de export para o shell

---

## FASE DEP — Dependencias

Detectar OS (guardado em Q4) e correr os comandos apropriados:

**Windows (PowerShell):**
```powershell
try { python --version } catch { "python_unavailable" }
try { node --version } catch { "node_unavailable" }
try { npm --version } catch { "npm_unavailable" }
try { bun --version } catch { "bun_unavailable" }
try { docker --version } catch { "docker_unavailable" }
try { gh --version } catch { "gh_unavailable" }
try { jq --version } catch { "jq_unavailable" }
try { git --version } catch { "git_unavailable" }
```

**macOS / Linux (bash):**
```bash
python3 --version 2>/dev/null || python --version 2>/dev/null || echo "python_unavailable"
node --version 2>/dev/null || echo "node_unavailable"
npm --version 2>/dev/null || echo "npm_unavailable"
bun --version 2>/dev/null || echo "bun_unavailable"
docker --version 2>/dev/null || echo "docker_unavailable"
gh --version 2>/dev/null || echo "gh_unavailable"
jq --version 2>/dev/null || echo "jq_unavailable"
git --version 2>/dev/null || echo "git_unavailable"
```

Dependencias obrigatorias: `node`, `npm`, `git`.
Dependencias recomendadas: `gh` (GitHub CLI), `jq` (JSON processing para scripts).

Para cada ferramenta em falta que foi seleccionada, instruir instalacao com comandos especificos ao OS:

| Ferramenta | Windows | macOS | Linux |
|------------|---------|-------|-------|
| `node` | `winget install OpenJS.NodeJS.LTS` | `brew install node` | `curl -fsSL https://deb.nodesource.com/setup_lts.x \| sudo bash -` |
| `gh` | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` ou `brew install gh` |
| `jq` | `winget install jqlang.jq` | `brew install jq` | `sudo apt install jq` |
| `bun` | `powershell -c "irm bun.sh/install.ps1 \| iex"` | `curl -fsSL https://bun.sh/install \| bash` | `curl -fsSL https://bun.sh/install \| bash` |
| `docker` | Docker Desktop via docker.com | `brew install --cask docker` | docs.docker.com/engine/install |

---

## FASE STATUSLINE — StatusLine + Rate Limits Tracking (silencioso)

Copiar o script Node.js cross-platform para `~/.claude/`:

**Windows (PowerShell):**
```powershell
Copy-Item "<caminho_joca>\.claude\scripts\statusline-command.js" "$env:USERPROFILE\.claude\statusline-command.js"
```

**macOS / Linux (bash):**
```bash
cp "<caminho_joca>/.claude/scripts/statusline-command.js" ~/.claude/statusline-command.js
```

Configurar `~/.claude/settings.json` — merge com existente (preservar o que ja existe):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline-command.js"
  },
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node -e \"require('fs').writeFileSync(require('path').join(require('os').tmpdir(),'joca-ui','last-msg.txt'),new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}))\""
      }]
    }]
  }
}
```

O script `statusline-command.js`:
- Recebe JSON do Claude Code via stdin com dados de modelo, contexto, e rate limits
- Produz output ANSI colorido para o terminal (modelo, tokens, ctx%, 5h%, 7d%)
- Guarda `rate-limits.json` em `%TEMP%/joca-ui/` (Windows) ou `/tmp/joca-ui/` (macOS/Linux)
- O JOCA_UI le este ficheiro via `GET /rate-limits` e mostra os limites na barra do terminal
- Actualiza automaticamente a cada mensagem enviada ao Claude Code

**Nota:** usa Node.js em vez de bash — funciona em Windows, macOS e Linux sem dependencias extra. Todos os hooks usam `node` como runtime.

---

## FASE 4 — Confirmacao

Apresentar resumo completo:

```
IDENTIDADE
  [Nome] — [papel][, localizacao] — [OS]

SOUL
  Autonomia: [nivel] · Comunicacao: [modo] · Erros: [comportamento] · Auto-test: [sim/nao]
  Fortes: [lista] · A aprender: [lista]

SKILLS (133 — trigger system RFC 2119)
  Base:  caveman, karpathy-guidelines, agent-context, create-skill
  [categoria]: [lista]

INTEGRACOES
  Browser: [browser-use CLI / playwright-cli / ambos / nenhum]
  CLIs:    [seleccionados — agrupar por categoria: source/AI/media/dev]
  Google:  [lista — se algum connector]
  Img Gen: [motor(es)]

SKILLS NOVAS:   [lista — se gaps detectados]

API KEYS
  OK [NOME_CHAVE] — configurada
  PENDENTE [NOME_CHAVE] — pendente (instrucoes no final)
  SISTEMA [NOME_CHAVE] — assumida do sistema

DEPENDENCIAS
  [OK/FALTA] node / npm / git / gh / jq / bun / docker

FICHEIROS
  ~/CLAUDE.md           actualizar
  memory/soul.md        preencher placeholders
  memory/               criar estrutura (se nao existir)
```

`AskUserQuestion`:
```
question: "Confirmas a configuracao acima?"
header: "Confirmar"
options:
  - "Sim, aplicar"
  - "Voltar atras para ajustar"
```

---

## FASE EXECUCAO

### 1. Preencher soul.md

Ler `memory/soul.md`, substituir todos os placeholders `<...>` com os valores recolhidos nas FASE 0 e FASE SOUL. Actualizar Calibration Parameters.

### 2. ~/CLAUDE.md

Ler ficheiro actual. Adicionar/actualizar sem apagar conteudo existente:

```markdown
## Utilizador
[Nome] — [papel][, localizacao]

## JOCA
Toolkit instalado em: [caminho_joca]
Skills activas: 133 (trigger system RFC 2119 — activacao automatica por relevancia)
Comandos: /install, /init-project, /resume, /save, /create-skill, /sync-questionnaires, /plan, /debug, /review-code, /review-design, /help-joca, /one-shot, /upgrade-joca, /update-joca, /status, /wp-perf, /wp-perf-review, /migrate
Geracao de imagens: [motores seleccionados]

## JOCA_UI
Interface: / triggers autocomplete de commands, skills e agents (dropdown)
Arranque: start.bat (Windows) ou bash start.sh (macOS/Linux)

## Workspace

## Projectos activos
| Directorio | Descricao |
|-----------|-----------|
<!-- Entradas adicionadas por /init-project e /save -->

@[caminho_joca]/JOCA_Brain/CLAUDE.md
```

### 3. Estrutura de memoria

Confirmar que existem (criar se nao existirem):
- `memory/INDEX.md`
- `memory/projects/` (com `.gitkeep`)
- `memory/tools/`
- `memory/feedback/` (com `.gitkeep`)

**Windows (PowerShell):**
```powershell
$dirs = @("memory\projects", "memory\tools", "memory\feedback")
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d }
    $gk = Join-Path $d ".gitkeep"
    if (-not (Test-Path $gk)) { New-Item -ItemType File $gk }
}
if (-not (Test-Path "memory\INDEX.md")) { New-Item -ItemType File "memory\INDEX.md" }
```

**macOS / Linux (bash):**
```bash
mkdir -p memory/projects memory/tools memory/feedback
touch memory/projects/.gitkeep memory/feedback/.gitkeep
[ -f memory/INDEX.md ] || touch memory/INDEX.md
```

### 4. Browser Automation (se seleccionado)

**browser-use CLI:**

macOS / Linux:
```bash
curl -fsSL https://browser-use.com/cli/install.sh | bash
```

Windows (PowerShell):
```powershell
& "C:\Program Files\Git\bin\bash.exe" -c 'curl -fsSL https://browser-use.com/cli/install.sh | bash'
```

Apos instalar:
```bash
source ~/.zshrc   # ou ~/.bashrc
browser-use doctor
```

**Playwright Agent CLI:**

```bash
npm install -g @playwright/cli
```

Verificar: `playwright-cli --help`

**markitdown (Knowledge Base / `/know`):**

```bash
python -m pip install markitdown-mcp        # MCP + core (Windows: python, nao python3)
python -m pip install 'markitdown[all]'     # opcional: todos os parsers (OCR, audio)
claude mcp add markitdown --scope user -- python -m markitdown_mcp
```

Verificar: `claude mcp list | grep markitdown` (deve dizer Connected). Ver `memory/tools/mcps.md`.

**Playwright MCP (browser automation — main loop + sub-agentes):**

```bash
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest
```

⚠ Usar SEMPRE `@playwright/mcp` (oficial Microsoft). **NUNCA `@anthropic-ai/mcp-server-playwright`** — esse pacote NÃO existe no npm (404) e deixa o MCP em "Failed to connect" silencioso (browser automation morto).
Verificar: `claude mcp list | grep playwright` (Connected). Nota: "Connected" ≠ tools acessíveis via ToolSearch no main loop — manter sempre o fallback canónico (build/`tsc` como proxy + pedir confirmação visual ao user). Ver `rules/workflows-and-tooling.md`.

Google connectors: instruir activacao em claude.ai/settings (OAuth nativo).

### 5. API Keys

Para cada chave marcada como "introduzir agora":

**Chaves de agentes** — adicionar ao bloco `env` global de `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<valor>", "GEMINI_API_KEY": "<valor>" } }
```

Para chaves PENDENTE — listar com link de obtencao:
- `OPENAI_API_KEY` -> platform.openai.com/api-keys
- `GEMINI_API_KEY` -> aistudio.google.com/apikey
- `SENTRY_AUTH_TOKEN` -> sentry.io/settings/account/api/auth-tokens
- `STRIPE_API_KEY` -> dashboard.stripe.com/apikeys (test mode)

### 6. CLIs externos

**gh CLI** (se seleccionado e instalado):
```
Correr: gh auth login
Segue as instrucoes interactivas para autenticar via browser.
```

**gws** (se seleccionado):

```bash
npm install -g @googleworkspace/cli
```

Autenticar:
```bash
gws auth setup    # cria projecto Cloud + activa APIs + login (requer gcloud)
gws auth login    # logins subsequentes
```

Sem gcloud: configurar OAuth client manualmente no Cloud Console, download JSON para `~/.config/gws/client_secret.json`, depois `gws auth login`.

Gotchas de auth (vividos — conta **pessoal**, não Workspace):
- `gws auth setup --login` pede **86 scopes** (incl. admin de Workspace, `cloud-identity.devices`) → numa conta pessoal dá `invalid_scope`/Erro 400.
- `gws auth login --services gmail --readonly` **NÃO** restringe scopes — só `--scopes <lista explícita>` restringe (ex.: `https://www.googleapis.com/auth/gmail.readonly`).
- Consent screen em "Testing" sem test users → `403 access_denied` (add user em `console.cloud.google.com/auth/audience?project=<id>`).
- App em "Testing" → Google **expira o refresh token ~7 dias**. Fix: **publicar a app em Production** (conta pessoal não tem via Workspace-Internal).
- Headless/VPS: creds no keyring + `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`. Capacidades p/ automações (e2e): `gws gmail +triage` (não-lidos), `+read`, `+send`/`+reply`/`+forward` — corre non-interactive via `child_process.exec`.
- **`+send` anexos têm de estar no cwd** — `--attach <path>` fora da pasta actual → `validationError 400` ("outside the current directory"). Correr o `+send` a partir da pasta dos ficheiros (subshell `( cd <pasta> && gws ... -a <nome-relativo> )`) ou copiar o anexo para cwd primeiro. Body HTML completo passa bem por `--body "$(cat file.html)" --html`.

**sentry-cli** (se seleccionado):

macOS:
```bash
brew install getsentry/tools/sentry-cli
```

Linux:
```bash
curl -sL https://sentry.io/get-cli/ | sh
```

Windows (Scoop):
```powershell
scoop install sentry-cli
```

Instruir: `sentry-cli login` para autenticar, ou definir `SENTRY_AUTH_TOKEN` em env.

**ffmpeg** (se seleccionado):

macOS:
```bash
brew install ffmpeg
```

Linux (apt):
```bash
sudo apt install ffmpeg
```

Windows (Scoop):
```powershell
scoop install ffmpeg
```

Verificar: `ffmpeg -version`

**yt-dlp** (se seleccionado — usado pelo agent `watch`):

macOS: `brew install yt-dlp`
Linux: `pip3 install -U yt-dlp` ou `sudo apt install yt-dlp`
Windows: `scoop install yt-dlp` ou `pip install -U yt-dlp`

Verificar: `yt-dlp --version`

**whisperx** (se seleccionado — transcricao local sem API):

Prereq: Python 3.10+ e ffmpeg.
```bash
pip install -U whisperx
```
Primeira execucao descarrega modelo (~3GB para `large-v3`).

Verificar: `whisperx --help`

**stripe-cli** (se seleccionado):

macOS: `brew install stripe/stripe-cli/stripe`
Linux: download de github.com/stripe/stripe-cli/releases
Windows: `scoop install stripe`

Instruir: `stripe login` (OAuth interactivo) e usar `stripe listen --forward-to localhost:8000/webhook` para testes locais.

**aws-cli** (se seleccionado):

macOS: `brew install awscli`
Linux: `sudo apt install awscli` ou installer oficial em aws.amazon.com/cli
Windows: `winget install Amazon.AWSCLI`

Instruir: `aws configure` (key, secret, region, output).

**gcloud** (se seleccionado — prereq para `gws auth setup`):

macOS: `brew install --cask google-cloud-sdk`
Linux: `curl https://sdk.cloud.google.com | bash`
Windows: `winget install Google.CloudSDK`

Instruir: `gcloud init` para autenticar e seleccionar projecto.

**huggingface-cli** (se seleccionado):

Windows (PowerShell):
```powershell
pip install -U "huggingface_hub[cli]"
```

macOS / Linux (bash):
```bash
pip3 install -U "huggingface_hub[cli]"
```

Instruir: `huggingface-cli login` para autenticar.

**Antigravity CLI** (se seleccionado):

Windows (PowerShell):
```powershell
npm install -g @anthropic-ai/antigravity
```

macOS / Linux (bash):
```bash
npm install -g @anthropic-ai/antigravity
```

Instruir: `agy auth login` ou definir `GEMINI_API_KEY`.

**Codex CLI** (se seleccionado):

Windows (PowerShell):
```powershell
npm install -g @openai/codex
```

macOS / Linux (bash):
```bash
npm install -g @openai/codex
```

Instruir: `codex login` ou definir `OPENAI_API_KEY`.

**CLI Printing Press** (se seleccionado):

Prerequisito — Go 1.26+:
macOS: `brew install go`
Linux: `sudo apt install golang` ou download de golang.org
Windows: download de golang.org/dl

Garantir `$GOPATH/bin` no PATH:
```bash
echo 'export PATH="$HOME/go/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Instalar:
```bash
go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest
```

Verificar: `cli-printing-press --version`

**Zoho Mail CLI** (se seleccionado):

Prerequisito — Java 11+:
- macOS: `brew install openjdk@21` (keg-only, adicionar `/opt/homebrew/opt/openjdk@21/bin` ao PATH)
- Linux: `sudo apt install openjdk-21-jdk` ou equivalente
- Windows: download de adoptium.net (Eclipse Temurin)

Verificar: `java -version` (deve mostrar 11+)

Instalar:
```bash
mkdir -p ~/.local/bin/zmail-cli
curl -L -o ~/.local/bin/zmail-cli/zmail-cli.jar \
  https://www.zohowebstatic.com/mail/3938191/ZMAIL_CLI/zmail-cli.jar
```

Criar wrapper `~/.local/bin/zmail`:
```bash
#!/usr/bin/env bash
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
exec java -jar "$HOME/.local/bin/zmail-cli/zmail-cli.jar" "$@"
```

Tornar executável: `chmod +x ~/.local/bin/zmail`

Verificar: `zmail` (abre prompt interactivo — pede password de encriptação no primeiro arranque para proteger refresh tokens locais).

Instruir: `zmail:>login` para OAuth via browser. Para data centers regionais usar `login --dc <tld>` (`.com`, `.eu`, `.in`, `.au`, `.jp`, `.ca`, `.sa`).

Docs: https://www.zoho.com/mail/help/cli/getting-started-with-cli.html

### 7. settings.json do projecto

Verificar que `<caminho_joca>/.claude/settings.json` tem os **10 hooks** configurados. Substituir `<BRAIN>` pelo caminho absoluto do JOCA_Brain instalado (ex.: `C:/Users/<user>/Desktop/JOCA/JOCA_Brain`) — **paths absolutos porque no Windows o cwd dos hooks não é garantidamente a raiz do repo**, e paths relativos falham em silêncio.

```json
{
  "permissions": {
    "allow": [],
    "deny": []
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-freeze.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-tdd.js\"" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-careful.js\"" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/session-intake.js\"" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/prompt-triage.js\"" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/track-changes.js\" \"$TOOL_INPUT_FILE_PATH\"", "async": true },
          { "type": "command", "command": "bash \"<BRAIN>/.claude/scripts/check-skill-paths.sh\" \"$TOOL_INPUT_FILE_PATH\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/skill-lint.js\"" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/stop-checkpoint.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/auto-test-dispatch.js\"" }
        ]
      }
    ]
  }
}
```

Notas:
- **Ordem no array Stop importa:** `stop-checkpoint.js` corre ANTES de `auto-test-dispatch.js` (este limpa a `.joca/test-queue.jsonl`).
- Runtime `node` para todos os hooks excepto `check-skill-paths.sh` (bash, vive em `.claude/scripts/`).
- Hooks flag-file (`check-freeze`, `check-careful`, `check-tdd`) são no-op sem a flag `.joca/*.flag` — armados pelas skills `freeze`/`careful`/`tdd`, desarmados por `unfreeze`.

### 8. JOCA_UI (instala por defeito)

O JOCA_UI corre em **porta 7371** (backend) e **porta 7372** (frontend). A interface detecta automaticamente o JOCA_Brain como directorio irmao — zero configuracao.

> **macOS e a plataforma de referencia** — o JOCA_UI foi desenvolvido e validado em macOS. Se o OS confirmado (Q4) for **Windows**, ler e activar a skill `.claude/skills/joca-ui-windows.md` ANTES de correr `npm install`/`npm run build`: ela conduz build do node-pty (requer VS Build Tools + Python), PTY PowerShell, paths, statusline/Keychain e launchers, testando e corrigindo numa so passagem. Notificar: `[skill: joca-ui-windows]`.

**Windows (PowerShell):**

Usa a abordagem de temp batch launcher para evitar problemas de quoting em nested processes:

```powershell
Set-Location "<caminho_joca>\..\JOCA_UI\backend"
npm install
npm run build
Set-Location "<caminho_joca>\..\JOCA_UI\frontend"
npm install
```

Verificar: `node <caminho_joca>\..\JOCA_UI\backend\dist\server.js` inicia sem erros.

Arranque Windows: `start.bat` — cria batch launchers temporarios em `%TEMP%\joca-ui\` para backend e frontend, evitando problemas de quoting com caminhos que contem espacos.

**macOS / Linux (bash):**

```bash
cd "<caminho_joca>/../JOCA_UI"
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && cd ..
chmod +x start.sh stop.sh 2>/dev/null
```

Verificar: `node <caminho_joca>/../JOCA_UI/backend/dist/server.js` inicia sem erros.

Arranque macOS/Linux: `bash start.sh` — usa `nohup` + `disown` para manter os processos em background.

**JOCA_UI Slash Command Autocomplete:**
O JOCA_UI suporta autocomplete de comandos, skills e agents — ao digitar `/` no terminal emulado, aparece um dropdown com todos os comandos disponiveis. Mencionar isto ao utilizador.

### 9. Launcher

`AskUserQuestion`:
```
question: "Criar atalho para abrir o JOCA UI com um clique?"
header: "Launcher"
options:
  - "Desktop"
  - "Pasta do JOCA"
  - "Outro caminho"
  - "Nao criar"
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

### 10. Skills novas (se confirmado)

Executar `/create-skill [nome]` para cada skill nova aprovada na FASE 2.

### 11. Relatorio final

```
OK Soul calibrado — [autonomia], [comunicacao], [erros]
OK ~/CLAUDE.md actualizado
OK Memoria: estrutura verificada
OK Skills: 133 configuradas (RFC 2119 trigger system)
OK Integracoes: [Browser: browser-use/playwright-cli/ambos/nenhum] · [CLIs: lista]
OK JOCA_UI: instalado (backend :7371, frontend :7372)[ · Windows: skill joca-ui-windows aplicada]
OK StatusLine: instalada (rate limits -> %TEMP%/joca-ui/rate-limits.json)
[estado] Deps: node / npm / git / gh / jq / bun / docker

API KEYS
  OK [chave] — configurada
  PENDENTE [chave] — PENDENTE -> [URL]

JOCA pronto.
-> Iniciar interface: JOCA_UI\start.bat (Windows) ou bash JOCA_UI/start.sh (macOS/Linux)
-> Autocomplete: digita / no terminal para ver commands, skills e agents
-> Para ligar projectos: navega para a pasta e corre /init-project
-> Inicio de sessao: /resume
-> Referencia rapida: /help-joca
-> Repo: https://github.com/MirrasPT/JOCA.git
```

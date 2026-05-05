# /init-joca — Instalar JOCA numa máquina nova

Configura o JOCA globalmente: identidade, skills, MCPs, API keys, dependências.  
Faz as perguntas bloco a bloco. Aguarda resposta antes de avançar.

---

## FASE 0 — Identidade

Verifica `~/CLAUDE.md`. Se existir com perfil JOCA:
```
Perfil encontrado: [Nome], [papel].
Queres actualizar? [S/N]
```
Se não existir:

**Q1 — Nome** (livre)

**Q2 — Papel**
```
[1] Designer   [2] Desenvolvedor   [3] Full-stack
[4] Marketer   [5] Product Manager   [6] Outro: ___
```

**Q3 — OS**
```
[1] macOS   [2] Windows   [3] Linux
```

---

## FASE 1 — Áreas de trabalho *(multi-select)*

```
[ ] Design de interfaces (UI/UX)
[ ] Ilustração / arte visual
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
[ ] TODOS   [ ] Outro: ___
```

### Mapeamento áreas → skills

| Área          | Skills                                                      |
|---------------|-------------------------------------------------------------|
| UI/UX         | `ui`                                                        |
| Ilustração    | `visual`                                                    |
| Animação      | `motion`                                                    |
| Vídeo         | `video`                                                     |
| 3D            | `blender` + blender MCP                                     |
| Marketing/SEO | `seo`, `content`, `performance`                             |
| Dev web       | `web-tester`, `quality`                                     |
| WordPress     | `wordpress/wordpress-router` + skills WP                    |
| Shopify       | `shopify/shopify-router` + skills Shopify                   |
| DevOps        | `platform`                                                  |
| Analytics     | `analytics`                                                 |
| Research      | agente `deep-research`                                      |
| Base (sempre) | `create-skill`                                              |

**Stack extra** — se Dev web seleccionado:
```
[ ] Laravel / PHP   [ ] PostgreSQL   [ ] Flutter   [ ] Nenhum específico
```
→ Laravel/PHP/PostgreSQL: adiciona `php-stack` · Flutter: agente `flutter-expert`

---

## FASE 2 — Integrações e MCPs

**Google** *(multi-select)*:
```
[ ] Gmail   [ ] Google Calendar   [ ] Google Drive/Docs   [ ] Google Analytics (GA4)   [ ] Nenhuma
```
→ Gmail / Calendar / Drive: activar em claude.ai/settings (OAuth nativo — sem config local)

**Ferramentas** *(multi-select)*:
```
[ ] GitHub (PRs, issues — requer token)
[ ] Playwright (browser automation)
[ ] Firecrawl (web scraping — requer Docker ou API key)
[ ] HuggingFace (modelos Hub — requer token p/ privado)
[ ] Gemini CLI (análise multimodal, contexto 1M — gratuito com Google account)
[ ] Codex CLI (code review adversarial via OpenAI)
[ ] Outro: ___
```

**Geração de imagens**:
```
[1] OpenAI gpt-image-2   [2] Google Gemini   [3] Ambos   [4] Não preciso
```

---

## FASE 3 — API Keys

Com base nas selecções, para cada chave necessária:

| MCP / Ferramenta         | Variável                        |
|--------------------------|---------------------------------|
| GitHub MCP               | `GITHUB_PERSONAL_ACCESS_TOKEN`  |
| HuggingFace MCP          | `HF_TOKEN`                      |
| OpenAI (img-gen / Codex) | `OPENAI_API_KEY`                |
| Gemini (img-gen / CLI)   | `GEMINI_API_KEY`                |
| Firecrawl cloud          | `FIRECRAWL_API_KEY`             |
| Microsoft Clarity        | `COMPOSIO_API_KEY`              |

Para cada chave:
```
[Ferramenta] precisa de [NOME_CHAVE].
Estado: [detectado / não encontrado]
[1] Introduzir agora   [2] Já está no sistema   [3] Mais tarde
```

---

## FASE DEP — Dependências

```bash
python3 --version 2>/dev/null || echo "python_unavailable"
graphify --version 2>/dev/null || echo "graphify_unavailable"
node --version 2>/dev/null || echo "node_unavailable"
docker --version 2>/dev/null || echo "docker_unavailable"
curl -s http://localhost:3002/health 2>/dev/null || echo "firecrawl_unavailable"
gemini --version 2>/dev/null || echo "gemini_cli_unavailable"
codex --version 2>/dev/null || echo "codex_cli_unavailable"
```

Reportar apenas o que falta e é necessário para as escolhas feitas.

---

## FASE 4 — Confirmação

```
IDENTIDADE
  [Nome] — [papel] ([OS])

SKILLS
  Base:   create-skill
  [cat]:  [lista]

MCPs GLOBAIS:  [lista]
API KEYS
  ✓ [chave] — configurada
  ⚠ [chave] — pendente

FICHEIROS A CRIAR/ACTUALIZAR
  ~/CLAUDE.md
  memory/INDEX.md · memory/projects/ · memory/tools/ · memory/feedback/

Confirmas? [S/N]
```

---

## EXECUÇÃO

### 1. ~/CLAUDE.md

Lê e actualiza sem apagar conteúdo existente:
```markdown
## Utilizador
[Nome] — [papel] ([OS])

## JOCA
Toolkit em: [caminho_joca]
Skills: [lista por categoria]
MCPs globais: [lista]
Comandos: /init-joca, /init-project, /resume, /save, /create-skill

## Projectos activos
| Directório | Descrição |
|-----------|-----------|
```

### 2. Estrutura de memória

Verificar/criar:
- `memory/INDEX.md`
- `memory/projects/`
- `memory/tools/`
- `memory/feedback/`

### 3. MCPs globais (`~/.claude.json`)

Playwright, Firecrawl: verificar se já configurados. Se ausentes, mostrar bloco JSON a adicionar.  
Google connectors: instruir activação em claude.ai/settings (OAuth nativo).

### 3a. API Keys

MCP servers → bloco `env` no servidor em `~/.claude.json`:
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<valor>" }
}
```

Chaves de agentes (OPENAI_API_KEY, GEMINI_API_KEY) → bloco `env` global em `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<valor>", "GEMINI_API_KEY": "<valor>" } }
```

Alternativa (preferência do utilizador): variável de sistema:
- Windows: `setx NOME_CHAVE "<valor>"`
- macOS/Linux: `export NOME_CHAVE="<valor>"` → adicionar a `~/.zshrc` ou `~/.bashrc`

### 3b. CLIs externos

**Gemini CLI** (se seleccionado):
```bash
npm install -g @google/gemini-cli
gemini auth login  # Google account (gratuito) — ou GEMINI_API_KEY
```

**Codex CLI** (se seleccionado):
```bash
npm install -g @openai/codex
codex login  # ChatGPT Plus — ou OPENAI_API_KEY
```

### 4. Relatório final

```
✓ ~/CLAUDE.md actualizado
✓ Memória configurada
✓ Skills: [n] configuradas
✓ MCPs: [lista]
[estado] python / graphify / node / docker / firecrawl / gemini-cli / codex-cli

API KEYS
  ✓ [chave] — em [localização]
  ⚠ [chave] — PENDENTE → [URL para obter]
    GITHUB_PERSONAL_ACCESS_TOKEN → github.com/settings/tokens (scope: repo, read:org)
    HF_TOKEN                     → huggingface.co/settings/tokens
    OPENAI_API_KEY               → platform.openai.com/api-keys
    GEMINI_API_KEY               → aistudio.google.com/apikey
    COMPOSIO_API_KEY             → app.composio.dev/settings

JOCA pronto.
Próximo: /init-project numa pasta de projecto.
```

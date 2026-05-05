# Graphify

Transforma qualquer pasta de ficheiros num knowledge graph consultável e persistente. Em vez de Claude re-ler todos os ficheiros a cada sessão, consulta o `graph.json` e o `GRAPH_REPORT.md` — que sobrevivem entre sessões e custam uma fracção dos tokens.

---

## ⚠️ Limitação: pastas dotfile (.claude/)

O `graphify detect()` exclui hardcoded qualquer directório que começa com `.` (incluindo `.claude/`). Não é configurável via `.graphifyignore`.

**Consequência:** skills e agentes em `.claude/` ficam fora do mapa semântico → nós órfãos no grafo.

**Workaround para incluir `.claude/`:**

```
# Passo 1 — extrair .claude/ separadamente (como root, não dotdir)
/graphify .claude/
# → gera graphify-out/.graphify_claude_graph.json (escolher output path diferente)

# Passo 2 — merge com o grafo raiz existente
graphify merge-graphs \
  graphify-out/graph-root.json \
  graphify-out/graph-claude.json \
  --out graphify-out/graph.json

# Passo 3 — regenerar report
graphify cluster-only .
```

**Frequência:** correr após adicionar/modificar skills ou agentes. O grafo raiz raramente muda.

**Redução de tokens documentada:**
- 71.5x numa codebase mista (código + docs + imagens)
- 49x em tarefas diárias em repos grandes
- 6.8x em code review

---

## Instalação

```bash
# Verificar se está instalado
graphify --version

# Instalar (escolher um)
pip install graphifyy && graphify install
pipx install graphifyy && graphify install
uv tool install graphifyy && graphify install
```

`graphify install` faz duas coisas automaticamente:
1. Escreve a secção de navegação no `CLAUDE.md` do projecto
2. Regista o hook `PreToolUse` no `settings.json` — dispara antes de cada `Glob` e `Grep`, injectando o contexto do graph

### Instalação manual do skill (se necessário)
```bash
mkdir -p ~/.claude/skills/graphify
curl -fsSL https://raw.githubusercontent.com/safishamsi/graphify/v4/graphify/skill.md \
  > ~/.claude/skills/graphify/SKILL.md
```

### Desinstalar
```bash
graphify claude uninstall
```

---

## Comandos principais

```bash
# Geração
graphify .                          # corre no directório actual
graphify ./src                      # pasta específica
graphify . --update                 # só processa ficheiros modificados
graphify . --mode deep              # extracção semântica agressiva (usa LLM)
graphify . --watch                  # rebuild automático ao guardar
graphify . --no-viz                 # salta HTML, só report + JSON
graphify . --directed               # preserva direcção das edges
graphify . --cluster-only           # re-corre clustering sem re-extrair

# Query
graphify query "pergunta"
graphify query "..." --dfs          # percorre caminho específico
graphify query "..." --budget 1500  # limita a N tokens
graphify path "NodeA" "NodeB"       # caminho mais curto entre nós
graphify explain "ConceptName"      # explicação em linguagem simples

# Conteúdo externo
graphify add <url>                  # importa paper/tweet/vídeo para o corpus
graphify add <url> --author "Name"

# Exports alternativos
graphify . --obsidian               # vault Obsidian
graphify . --wiki                   # markdown estilo Wikipedia
graphify . --svg                    # exporta graph.svg
graphify . --graphml                # para Gephi/yEd
graphify . --neo4j                  # gera cypher.txt
graphify . --neo4j-push bolt://localhost  # push directo para Neo4j
graphify . --mcp                    # inicia MCP stdio server

# Git hooks
graphify hook install               # instala post-commit + post-checkout
graphify hook uninstall
graphify hook status
```

---

## Output gerado

```
graphify-out/
├── GRAPH_REPORT.md     ← Claude lê este primeiro (god nodes, comunidades, perguntas sugeridas)
├── graph.json          ← graph persistente e consultável
├── graph.html          ← visualização interactiva (abrir no browser)
├── transcripts/        ← cache de transcrições de vídeo/áudio
└── cache/
    ├── ast/
    └── semantic/
```

---

## .gitignore recomendado

```gitignore
# ignorar sempre
graphify-out/manifest.json
graphify-out/cost.json

# ignorar cache (opcional — commitar acelera extracção para a equipa)
graphify-out/cache/
```

Manter `graph.json` e `GRAPH_REPORT.md` versionados — úteis para toda a equipa.

---

## .graphifyignore

Criar na raiz do projecto com sintaxe `.gitignore`:

```
vendor/
node_modules/
dist/
*.generated.py
AGENTS.md
CLAUDE.md
.gemini/
docs/translations/
```

---

## Adicionar ao CLAUDE.md do projecto

Após `graphify .`, o `graphify install` faz isto automaticamente. Manualmente:

```markdown
## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` antes de responder a questões de arquitectura
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Só ler ficheiros raw quando for necessário editar ou o graph não tiver a resposta
4. Para actualizar: `graphify . --update`
```

---

## Como o hook funciona

O hook `PreToolUse` dispara antes de cada `Glob` e `Grep`. Quando existe um knowledge graph, Claude recebe automaticamente:

> *"graphify: Knowledge graph exists. Read GRAPH_REPORT.md for god nodes and community structure before searching raw files."*

Queries profundas (`/graphify query`, `/graphify path`, `/graphify explain`) percorrem o `graph.json` hop-a-hop com detalhe de edge-level: tipo de relação, confidence scores, e localizações no código.

---

## Confiança das edges

| Tipo | Score |
|------|-------|
| EXTRACTED | 1.0 |
| INFERRED | 0.6–0.9 |
| AMBIGUOUS | 0.1–0.3 |

---

## Workflow em equipa

1. Uma pessoa corre `/graphify .` e faz commit do `graphify-out/`
2. Equipa faz pull — Claude lê o `GRAPH_REPORT.md` imediatamente na sessão seguinte
3. Instalar o hook: `graphify hook install`
4. Para mudanças em docs/imagens: `graphify . --update`

---

## Requisitos

- Python 3.10+
- Extras opcionais:
  ```bash
  pip install graphifyy[office]   # suporte .docx/.xlsx
  pip install graphifyy[video]    # transcrição de vídeo/áudio
  ```

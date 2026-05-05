# /init-project — Inicializar Projecto

Liga um projecto ao JOCA. Corre a partir da pasta do projecto.  
Detecta a stack automaticamente — perguntas só para confirmar ou preencher gaps.

---

## FASE 0 — Auto-detecção

```bash
ls package.json composer.json shopify.app.toml wp-config.php pubspec.yaml go.mod requirements.txt 2>/dev/null
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "no_claude_md"
graphify . 2>/dev/null || echo "graphify_unavailable"
```

Se graphify indisponível: avisar "Corre `/init-joca` primeiro." e parar.

Apresenta o que detectaste:
```
Detectei:
  Stack:   [detectado ou "não detectado"]
  Nome:    [nome da pasta]
  Tipo:    [inferido ou "?"]
```

---

## FASE 1 — Confirmar contexto

**Q1 — Nome do projecto** *(confirmar ou corrigir o detectado)*

**Q2 — Tipo** *(confirmar ou corrigir)*
```
[1] Website / App   [2] WordPress   [3] Shopify
[4] Design          [5] Vídeo       [6] Research
[7] Marketing       [8] Outro: ___
```

**Q3 — Stack** *(confirmar ou corrigir o detectado; livre)*

---

## FASE 2 — MCPs do projecto

Pré-selecciona com base no tipo detectado. Mostra só o relevante:

```
[ ] WordPress MCP Adapter (só WP 6.8+ — expõe Abilities como tools)
[ ] Shopify AI Toolkit MCP (só projectos Shopify — docs + schema em contexto)
[ ] Blender MCP (só projectos 3D)
[ ] Outro: ___
[ ] Nenhum
```

Se WordPress MCP seleccionado:
```bash
composer require wordpress/mcp-adapter
# WP 6.8 only (6.9+ inclui Abilities API nativamente)
```
Adicionar ao `.mcp.json` do projecto:
```json
"wordpress-mcp": { "command": "wp", "args": ["mcp", "start"], "env": { "WP_PATH": "<caminho>" } }
```

Se Shopify MCP seleccionado:
```bash
claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest
```

---

## FASE 3 — Gaps de skills

Para cada aspecto do projecto sem cobertura directa nas skills activas:
```
Para "[caso]": sem cobertura nativa.

[Se encontrou via WebSearch]
→ [repo/skill] — [descrição]. Instalo? [S/N]

[Se não encontrou]
Não encontrei nada relevante. Crio via /create-skill? [S/N/Mais tarde]

[Se parcialmente coberto]
[skill-x] cobre A ✓ — falta B. [1] Procurar  [2] Criar  [3] Ignorar
```

---

## FASE 4 — Confirmação

```
PROJECTO: [nome] — [tipo]
Stack:    [stack]

MCPs PROJECTO: [lista]
SKILLS NOVAS:  [lista — se gaps aprovados]

FICHEIROS A CRIAR
  CLAUDE.md do projecto
  .mcp.json — se MCPs confirmados
  [joca]/memory/projects/[nome].md

Confirmas? [S/N]
```

---

## EXECUÇÃO

### 1. graphify

```bash
graphify .
```

Se Laravel + Filament:
```bash
composer require laravel/boost --dev && php artisan boost:install
```

Se WordPress:
```bash
wp --version 2>/dev/null && wp core version && wp plugin list --status=active --format=csv
```

### 2. CLAUDE.md do projecto

Se não existir, criar:
```markdown
## Projecto
**Nome:** [nome]  **Stack:** [stack]  **Objectivo:** [descrição]

## Navegação
1. `graphify-out/graph.json` — estrutura e dependências
2. Ler ficheiros raw só para editar
3. Actualizar: `graphify . --update`
```
Se existir, adicionar secção de navegação sem apagar conteúdo.

### 3. .mcp.json (se MCPs confirmados)

Criar ou actualizar na raiz do projecto.

### 4. Memória JOCA

Criar `[joca]/memory/projects/[nome].md`:
```markdown
---
name: [nome]
type: project
---
**Stack:** [stack]  **Iniciado:** [data]
**Objectivo:** [descrição]
**How to apply:** [como o JOCA deve ajudar]

## Estado actual
A iniciar.

## Decisões tomadas
<!-- preenchido por /save -->

## Pendente
<!-- preenchido por /save -->
```
Actualizar `memory/INDEX.md`.

### 5. ~/CLAUDE.md — tabela de projectos

Adicionar linha se não existir.

### 6. Skills novas

`/create-skill [nome]` para cada gap aprovado.

### 7. Relatório final

```
✓ graphify corrido
✓ CLAUDE.md do projecto criado/actualizado
✓ .mcp.json configurado — se aplicável
✓ memory/projects/[nome].md criado
✓ ~/CLAUDE.md actualizado

Pronto. Usa /resume no início de cada sessão neste projecto.
```

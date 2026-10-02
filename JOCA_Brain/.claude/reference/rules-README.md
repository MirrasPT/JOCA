# .claude/rules/ — LÊ ANTES DE ADICIONAR

⚠ **Custo:** todos os `.md` de `.claude/rules/` são **auto-carregados em TODAS as sessões** (contam como "memory files no `/context`). Cada linha aqui é re-enviada em **cada mensagem** — custa tokens recorrentes, não uma vez.

Regras:
- **Só directivas de comportamento global** que valem sempre (task-intake, chaining, pipelines, orchestration, testing). Não meter aqui referência/gotchas de nicho.
- **Terse.** Tabelas > prosa. Sem repetir o que já está no `CLAUDE.md` ou noutra rule.
- **Detalhe extenso → `.claude/reference/`** (NÃO auto-carregado; `Read()` on-demand) ou `memory/projects/<slug>/`. Já lá vivem `api-design.md`, `workflows-and-tooling.md` e `pipelines-catalogo.md` — o ponteiro para eles vive no `CLAUDE.md`, não num `.md` próprio em `rules/`.
- Antes de adicionar uma rule nova, perguntar: "isto tem de estar em contexto SEMPRE?" Se não → não é uma rule.
- **Sinal de intruso:** um `.md` aqui com frontmatter de skill (`name:` + `description:` + `triggers:`) foi lá parar por engano → mover para `.claude/skills/`. Aconteceu com o `testing.md` (era o skill `test-master` de terceiros): 94 linhas / ~1k tokens em **cada mensagem**, zero valor comportamental, e a tabela de `references/*.md` que continha apontava para ficheiros que nunca existiram no repo. Ao adicionar/editar uma rule, confirmar que **cada path citado resolve** (`ls`).
- Este README vive em `reference/` (saiu de `rules/` a 2026-09-23 para não ser auto-carregado).

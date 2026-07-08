# .claude/rules/ — LÊ ANTES DE ADICIONAR

⚠ **Custo:** todos os `.md` desta pasta são **auto-carregados em TODAS as sessões** (contam como "memory files no `/context`). Cada linha aqui é re-enviada em **cada mensagem** — custa tokens recorrentes, não uma vez.

Regras:
- **Só directivas de comportamento global** que valem sempre (task-intake, chaining, pipelines, orchestration, testing). Não meter aqui referência/gotchas de nicho.
- **Terse.** Tabelas > prosa. Sem repetir o que já está no `CLAUDE.md` ou noutra rule.
- **Detalhe extenso → `.claude/reference/`** (NÃO auto-carregado; `Read()` on-demand) ou `memory/projects/*.md`. Já lá vivem `api-design.md` e `workflows-and-tooling.md` — os pointers de 1-parágrafo ficam aqui em `rules/`.
- Antes de adicionar uma rule nova, perguntar: "isto tem de estar em contexto SEMPRE?" Se não → não é uma rule.
- Este README também é auto-carregado → mantê-lo curto.

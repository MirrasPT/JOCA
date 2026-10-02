---
name: notion
description: Gerir um workspace Notion via CLI oficial `ntn` (winget Notion.ntn) a partir de Git Bash/PowerShell no Windows. Query/criar/actualizar/arquivar páginas e tarefas em databases (data sources). Cobre os gotchas reais (MSYS_NO_PATHCONV, body por stdin no PATCH, data sources vs databases, UTF-8). Triggers Notion, ntn, tarefa Notion, base de dados Notion, workspace de clientes Notion, arquivar tarefa Notion.
triggers:
  - Notion
  - ntn
  - tarefa Notion
  - base de dados Notion
  - data source Notion
  - workspace de clientes
  - arquivar tarefa Notion
  - notion
  - ntn
  - tarefa notion
  - base de dados notion
  - data source notion
origin: local
---

# Notion (`ntn` CLI)

Wrapper fino sobre o CLI oficial **`ntn`** (Notion CLI, `winget install Notion.ntn`). Acesso programático ao workspace (ex.: tarefas de clientes). A API expõe **data sources** (não "databases" no sentido antigo) — cada database tem um ou mais data sources com `id` próprio.

## Uso
```bash
ntn api /v1/<path>                           # GET (método inferido)
ntn api /v1/<path> -d '<json>'               # com body
ntn api /v1/<path> -X PATCH -d @-  < body.json   # método explícito, body por stdin
ntn api /v1/<path> --docs                    # doc oficial do endpoint; --spec dá o schema
```
- **O método NÃO é posicional.** A forma antiga `ntn api <METHOD> /v1/<path>` dá «Failed to parse inline request input» no `ntn` actual (API `2026-03-11`, 2026-10-01). O método é inferido; para forçar usa-se `-X <METHOD>` (`ntn api --help`, verificado 2026-10-01).
- **macOS/Linux:** a mesma sintaxe, **sem** o `MSYS_NO_PATHCONV=1` (é só do Git Bash). O `winget` é só Windows — noutro SO instalar pelo canal oficial do Notion e confirmar com `ntn --help`.
- Read-only (`GET`/query) → corre sem perguntar. Escrita em massa / arquivar → confirmar 1 linha (irreversível-ish).

## Gotchas (vividos — não inferir)
- **Git Bash converte paths que começam por `/`** → `MSYS_NO_PATHCONV=1 ntn api /v1/...` (senão o path vira `C:/Program Files/Git/v1/...`). Ou correr via PowerShell.
- **Inserir blocos a meio de uma página:** no `PATCH /v1/blocks/<id>/children` a posição vai em `"position": {"type": "after_block", "after_block": {"id": "<block_id>"}}` (também `{"type": "start"}` / `{"type": "end"}`). O campo antigo `after` dá **400** (2026-10-01; schema em `ntn api /v1/blocks/<id>/children -X PATCH --spec`).
- **500 «Cross-cell memcached access is not allowed» intermitente** — inclusive em escritas que **ficaram gravadas** (2026-10-01). Repetir com backoff, mas **reler o estado antes de repetir uma escrita** (`GET` dos children/da página): repetir às cegas duplica blocos.
- **`ntn api -d @file` PENDURA (timeout) no `PATCH /v1/blocks/{id}/children`** — embora funcione no `POST /v1/pages`. **Passar o body por stdin** no PATCH de children (não `-d @file`). (Custou 2 timeouts de 2min.)
- **Data sources com nomes duplicados** (ex.: cópia de backup "Save DD-MM" criada hoje + a real): distinguir a real por **metadados** (`created_time`/`parent`/`id`) e confirmar 1 linha **antes** de escrita em massa — fácil editar a errada. (Ver `reference/workflows-and-tooling.md`.)
- **UTF-8**: garantir encoding correcto no body (acentos PT-PT).

## Padrões comuns
- Listar tarefas de um data source: `POST /v1/data_sources/<id>/query` (filtros no body).
- Criar tarefa: `POST /v1/pages` com `parent: { data_source_id | database_id }` + properties.
- Editar conteúdo de página: `PATCH /v1/blocks/<page_id>/children` (**body por stdin**).
- Arquivar: `PATCH /v1/pages/<id>` com `{ "archived": true }`.

> Skill fina por design — só vale enquanto o uso de Notion recorrer. Capacidades/gotchas adicionais → registar aqui à medida que aparecem. (Fonte: sessão 2026-06-27.)

---
name: notion
description: Gerir um workspace Notion via CLI oficial `ntn` (winget Notion.ntn) a partir de Git Bash/PowerShell no Windows. Query/criar/actualizar/arquivar páginas e tarefas em databases (data sources). Cobre os gotchas reais (MSYS_NO_PATHCONV, body por stdin no PATCH, data sources vs databases, UTF-8). Triggers Notion, ntn, tarefa Notion, base de dados Notion, workspace de clientes Notion, arquivar tarefa Notion.
triggers:
  - notion
  - ntn
  - tarefa notion
  - base de dados notion
  - data source notion
origin: local
---

# Notion (`ntn` CLI)

Wrapper fino sobre o CLI oficial **`ntn`** (Notion CLI, `winget install Notion.ntn`). Acesso programático ao workspace (o Renato tem tarefas de clientes — Luís Gonçalo / Elite Cozinhas / Bracaris). A API expõe **data sources** (não "databases" no sentido antigo) — cada database tem um ou mais data sources com `id` próprio.

## Uso
```bash
ntn api <METHOD> /v1/<path> [-d @file | (body por stdin)]
```
- Read-only (`GET`/query) → corre sem perguntar. Escrita em massa / arquivar → confirmar 1 linha (irreversível-ish).

## Gotchas (vividos — não inferir)
- **Git Bash converte paths que começam por `/`** → `MSYS_NO_PATHCONV=1 ntn api GET /v1/...` (senão o path vira `C:/Program Files/Git/v1/...`). Ou correr via PowerShell.
- **`ntn api -d @file` PENDURA (timeout) no `PATCH /v1/blocks/{id}/children`** — embora funcione no `POST /v1/pages`. **Passar o body por stdin** no PATCH de children (não `-d @file`). (Custou 2 timeouts de 2min.)
- **Data sources com nomes duplicados** (ex.: cópia de backup "Save DD-MM" criada hoje + a real): distinguir a real por **metadados** (`created_time`/`parent`/`id`) e confirmar 1 linha **antes** de escrita em massa — fácil editar a errada. (Ver `rules/workflows-and-tooling.md`.)
- **UTF-8**: garantir encoding correcto no body (acentos PT-PT).

## Padrões comuns
- Listar tarefas de um data source: `POST /v1/data_sources/<id>/query` (filtros no body).
- Criar tarefa: `POST /v1/pages` com `parent: { data_source_id | database_id }` + properties.
- Editar conteúdo de página: `PATCH /v1/blocks/<page_id>/children` (**body por stdin**).
- Arquivar: `PATCH /v1/pages/<id>` com `{ "archived": true }`.

> Skill fina por design — só vale enquanto o uso de Notion recorrer. Capacidades/gotchas adicionais → registar aqui à medida que aparecem. (Fonte: sessão 2026-06-27.)

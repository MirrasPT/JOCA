---
name: notion
description: Manage a Notion workspace via the official `ntn` CLI (winget Notion.ntn) from Git Bash/PowerShell on Windows. Query/create/update/archive pages and tasks in databases (data sources). Covers the real gotchas (MSYS_NO_PATHCONV, body via stdin on PATCH, data sources vs databases, UTF-8). Triggers Notion, ntn, Notion task, Notion database, Notion client workspace, archive Notion task.
triggers:
  - notion
  - ntn
  - notion task
  - notion database
  - notion data source
origin: local
---

# Notion (`ntn` CLI)

Thin wrapper over the official **`ntn`** CLI (Notion CLI, `winget install Notion.ntn`). Programmatic access to the workspace (e.g. client tasks). The API exposes **data sources** (not "databases" in the old sense) — each database has one or more data sources with their own `id`.

## Usage
```bash
ntn api <METHOD> /v1/<path> [-d @file | (body via stdin)]
```
- Read-only (`GET`/query) → run without asking. Bulk writes / archiving → confirm 1 line (irreversible-ish).

## Gotchas (lived — do not infer)
- **Git Bash converts paths that start with `/`** → `MSYS_NO_PATHCONV=1 ntn api GET /v1/...` (otherwise the path becomes `C:/Program Files/Git/v1/...`). Or run it via PowerShell.
- **`ntn api -d @file` HANGS (timeout) on `PATCH /v1/blocks/{id}/children`** — even though it works on `POST /v1/pages`. **Pass the body via stdin** on the children PATCH (not `-d @file`). (Cost 2 timeouts of 2 min.)
- **Data sources with duplicate names** (e.g. a backup copy "Save DD-MM" created today + the real one): tell the real one apart by **metadata** (`created_time`/`parent`/`id`) and confirm 1 line **before** a bulk write — easy to edit the wrong one. (See `.claude/reference/workflows-and-tooling.md`.)
- **UTF-8**: make sure the body encoding is correct (PT-PT accents).

## Common patterns
- List the tasks of a data source: `POST /v1/data_sources/<id>/query` (filters in the body).
- Create a task: `POST /v1/pages` with `parent: { data_source_id | database_id }` + properties.
- Edit page content: `PATCH /v1/blocks/<page_id>/children` (**body via stdin**).
- Archive: `PATCH /v1/pages/<id>` with `{ "archived": true }`.

> Thin skill by design — only worth it while Notion use keeps recurring. Additional capabilities/gotchas → record them here as they show up. (Source: session 2026-06-27.)

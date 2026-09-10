# /learn — The Brain's institutional memory (decisions + learnings)

Record, review and search what JOCA has learned/decided per project. Event-sourced (append-only JSONL), computed "active", secret-scan on write, automatic recall at session startup.

Adapted from gstack's `learn`/`gstack-decision`. Local-first (markdown/JSONL in the Brain) — does **not** use Postgres.

CLI: `.claude/scripts/joca-brain.mjs` (slug = name of the cwd's git repo).

⚠ **Syntax.** The text goes **positional**; `--text` is also accepted. `--help` per command prints the
signature (`node .claude/scripts/joca-brain.mjs learn --help`). Valid forms:
`… learn "text" [--tags a,b,c] [--slug X]` · `… decide "text"` · `… learn --text "text"`.

⚠ **Always pass `--slug <project>`** when the cwd is not the project being worked on. The default slug is
the cwd's git repo — working on another project from `JOCA_Brain`, the decisions end up stamped
`(JOCA)` (this happened with decisions that belonged to Livro de Elogios). `decide`, `learn`, `active`, `search`
and `recall` all accept `--slug`.

---

## When to use
- "record this decision", "save this learning", "what did we decide about X", "didn't we fix this before?", "show what we learned", "note down: …".
- **Proactive:** when a non-obvious architecture decision is taken OR a bug that would bite again is fixed → record without asking (reversible).

## Actions

| Intent | Command |
|---|---|
| Record a decision | `node .claude/scripts/joca-brain.mjs decide --text "<decision>" [--rationale "<why>"] [--scope repo\|branch] [--source user\|skill\|agent]` |
| Record a learning | `node .claude/scripts/joca-brain.mjs learn --text "<lesson>" [--tags a,b] [--file path]` |
| Supersede an old decision | `node .claude/scripts/joca-brain.mjs supersede <id>` |
| Expunge (captured secret) | `node .claude/scripts/joca-brain.mjs redact <id>` |
| View active decisions | `node .claude/scripts/joca-brain.mjs active` |
| Search | `node .claude/scripts/joca-brain.mjs search "<query>"` |

## Rules
- **Never log secrets** — the CLI rejects HIGH-tier (AWS/JWT/GitHub/Slack/credential-shaped). If it rejects, remove the value and record again.
- **`source`** — `user` (the user decided), `skill`/`agent` (auto). `user` decisions gain weight in the recall.
- **Scope** — `repo` (always relevant) or `branch` (only on the branch). Default `repo`.
- The recall (active decisions + recent learnings) is injected **automatically** at the start of every session by the `session-intake.js` hook.

## Relationship with the markdown memory
It complements `memory/projects/<proj>.md` (prose, session narrative), it does not replace it. The JSONL log is for **searchable atomic facts** (decisions/lessons); the prose is for session context. `/save` keeps writing the prose.

## Next step (chain)
- In a retrospective → `/retro` (reads the learnings from the window and proposes actions).

# /learn — Memória institucional do Brain (decisões + aprendizagens)

Registar, rever e pesquisar o que o JOCA aprendeu/decidiu por projecto. Event-sourced (JSONL append-only), "activo" computado, secret-scan na escrita, recall automático no arranque de sessão.

Adaptado do `learn`/`gstack-decision` do gstack. Local-first (markdown/JSONL no Brain) — **não** usa Postgres.

CLI: `.claude/scripts/joca-brain.mjs` (slug = nome do repo git do cwd).

---

## Quando usar
- "regista esta decisão", "guarda esta aprendizagem", "o que decidimos sobre X", "didn't we fix this before?", "mostra o que aprendemos", "anota: …".
- **Proactivo:** quando se toma uma decisão de arquitectura não-óbvia OU se resolve um bug que voltaria a morder → registar sem pedir (reversível).

## Acções

| Intenção | Comando |
|---|---|
| Registar decisão | `node .claude/scripts/joca-brain.mjs decide --text "<decisão>" [--rationale "<porquê>"] [--scope repo\|branch] [--source user\|skill\|agent]` |
| Registar aprendizagem | `node .claude/scripts/joca-brain.mjs learn --text "<lição>" [--tags a,b] [--file path]` |
| Substituir decisão antiga | `node .claude/scripts/joca-brain.mjs supersede <id>` |
| Expungir (segredo capturado) | `node .claude/scripts/joca-brain.mjs redact <id>` |
| Ver decisões activas | `node .claude/scripts/joca-brain.mjs active` |
| Pesquisar | `node .claude/scripts/joca-brain.mjs search "<query>"` |

## Regras
- **Nunca logar segredos** — o CLI rejeita HIGH-tier (AWS/JWT/GitHub/Slack/credential-shaped). Se rejeitar, remove o valor e re-regista.
- **`source`** — `user` (o Renato decidiu), `skill`/`agent` (auto). Decisões de `user` ganham peso no recall.
- **Scope** — `repo` (sempre relevante) ou `branch` (só na branch). Default `repo`.
- O recall (decisões activas + aprendizagens recentes) é injectado **automaticamente** no arranque de cada sessão pelo hook `session-intake.js`.

## Relação com a memória markdown
Complementa `memory/projects/<proj>.md` (prosa, narrativa de sessão), não a substitui. O log JSONL é para **factos atómicos pesquisáveis** (decisões/lições); a prosa é para contexto de sessão. `/save` continua a escrever a prosa.

## Próximo passo (chain)
- Numa retrospectiva → `/retro` (lê as aprendizagens da janela e propõe acções).

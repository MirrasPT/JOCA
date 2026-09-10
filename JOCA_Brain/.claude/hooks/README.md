# JOCA Hooks

11 hooks wired in `.claude/settings.json` (runtime `node`, except `check-skill-paths.sh`, which is bash and lives in `.claude/scripts/`). Absolute paths in the settings — on Windows the cwd of the hooks is not guaranteed to be the repo root.

| Hook | Event (matcher) | Function | Armed by |
|---|---|---|---|
| `check-freeze.js` | PreToolUse (Edit\|Write) | Blocks edits outside the locked scope | flag `.joca/freeze.flag` — skill `freeze`; disarmed by `unfreeze` |
| `check-tdd.js` | PreToolUse (Edit\|Write) | Test-first guard: production code with no test touched → `ask` (never deny) | flag `.joca/tdd.flag` — skill `tdd`; disarmed by `unfreeze` |
| `check-careful.js` | PreToolUse (Bash) | Warns/asks for confirmation on destructive commands | flag `.joca/careful.flag` — skills `careful`/`guard`; disarmed by `unfreeze` |
| `session-intake.js` | SessionStart | Injects the session startup context | always on |
| `prompt-triage.js` | UserPromptSubmit | Injects task-intake (4 routes) on every prompt | always on |
| `track-changes.js` | PostToolUse (Write\|Edit) | Records the touched file + domain in `.joca/test-queue.jsonl` | always on |
| `check-skill-paths.sh` | PostToolUse (Write\|Edit) | Validates paths referenced in skills (bash, in `.claude/scripts/`) | always on |
| `skill-lint.js` | PostToolUse (Write\|Edit) | Frontmatter lint when the file is a skill (non-blocking) | always on |
| `stop-checkpoint.js` | Stop (1st in the array) | Auto-checkpoint if the queue has code (runs BEFORE the dispatch, which clears the queue) | always on |
| `auto-test-dispatch.js` | Stop (2nd in the array) | Cross-checks the queue with `git status`, recommends testers **once** per set, clears the queue; goes quiet with `.joca/loop.json` still open | always on |
| `stop-continue.js` | Stop (3rd in the array) | Blocks the end of the turn while `.joca/loop.json` has steps pending or done-but-unverified; refuses a verification signed by the producer | contract `.joca/loop.json`; kill-switch `.joca/loop-off.flag` |

## Auto-test pipeline

1. Write/Edit → `track-changes.js` appends to `.joca/test-queue.jsonl` (file + domain).
2. Stop → `stop-checkpoint.js` writes a checkpoint if there is code in the queue; then `auto-test-dispatch.js` reads the queue and recommends testers.
3. The main loop dispatches the testers without asking. The queue is cleared on every Stop.

Four brakes against looped recommendation (measured: 6-9 identical refusals per session):

| Brake | Rule | Effect on the queue |
|---|---|---|
| Work in progress | `.joca/loop.json` (in the cwd or in the Brain) with a step ≠ `verificado` | does **not** clear — the recommendation waits |
| What changed | a file absent from disk, or inside the repo and absent from `git status --porcelain --ignored`, does not count. No git → everything counts (fail-open) | clears |
| Refusal memory | the same set of testers already recommended in this `session_id`, or less than 15 min ago → silence (`.joca/test-dispatch-memo.json`) | clears |
| Explicit exits | the message names the 3 one-line exits, including "the session forbids dispatching agents" | — |

Order in the `Stop` array (do not swap): `stop-checkpoint` reads the queue **before** the dispatch clears it;
`stop-continue` comes next because it is the only one that emits `decision: block` — the dispatch
recommendation has to be written already when the turn is blocked.

## Continuity contract (`.joca/loop.json`)

Written by the main loop when starting multi-step work (route C/D or a pipeline). Without it
`stop-continue.js` is a no-op — the loop never starts itself.

```json
{
  "objectivo": "one sentence",
  "criado": "2026-08-20T10:00:00Z",
  "max_iteracoes": 4,
  "aguarda_utilizador": false,
  "passos": [
    { "id": "1", "desc": "…", "estado": "pendente|feito|verificado",
      "produtor": "frontend-agent", "verificador": "" }
  ]
}
```

`estado` only becomes `verificado` when `verificador` ≠ `produtor` and there is evidence. The hook writes
`iteracao`, `sem_progresso` and `assinatura`; it deletes the file when everything is verified or after
6 h. Kill-switch: `touch .joca/loop-off.flag`. In a target project, make sure `.joca/` is in the
`.gitignore` (in the Brain it already is: `JOCA_Brain/.gitignore:2`).

Flag-file hooks are no-ops without their respective flag — zero cost when disarmed. Full wiring: `install.md` EXECUTION PHASE 7.

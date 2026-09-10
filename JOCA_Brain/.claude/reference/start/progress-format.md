# PROGRESS.md — format

**What it is:** the project's SHARED memory. It lives at the root, **it goes in git** — any
collaborator who clones sees the state without asking anyone. It complements JOCA's Brain memory,
which is individual per user: the Brain holds the personal context (gotchas, fine-grained decisions,
history); PROGRESS.md holds the project's **public state**. They point at each other, never duplicate.

**Who writes it:** `/start` creates it · `execute-project` updates it per step/wave · `/save`
syncs it at the end of every session. Several people can write to it — it is a normal git file;
conflicts are resolved like any merge.

## Format

```markdown
# PROGRESS — <project name>

> Shared state of the project. Updated by JOCA (/start · execute-project · /save).
> Each collaborator's personal context lives in their own JOCA Brain.

## Current state
<1-3 lines: where the project is NOW and what the next step is>

## Phases
| Phase | State | Evidence |
|---|---|---|
| S1 Product (initial PRD)        | ✅ 2026-08-19 | docs/PRD.md |
| S2 Flows and capabilities       | ✅ 2026-08-19 | PRD §Flows |
| S3 Stack + local environment    | ✅ 2026-08-19 | PRD §Stack (includes the Local environment table) + docs/DECISIONS.md |
| S4 Infrastructure               | ✅ 2026-08-19 | repo <owner>/<name> · deploy: <target> |
| S5 Design direction             | ✅ 2026-08-19 | docs/DESIGN.md |
| E1 Foundation (scaffold+CI+hooks) | ⏳ in progress | — |
| E2 Design (route: <direct|claude-design>) | ⬜ | — |
| E3 Status checkpoint            | ⬜ | — |
| E4 Development (waves)          | ⬜ | — |
| Production                      | ⬜ | — |

## Waves (filled in at E4)
| Wave | Issues | State | Gate |
|---|---|---|---|

## Diary (most recent first)
- 2026-08-19 · <who/machine> · <what happened, in 1 line>
```

## Rules

- **State is marked with evidence**, never with ✅ alone — the path/command that confirms it. The
  `/start` resume checks the evidence, not the symbol.
- The **Diary** is append-only, 1 line per work session. It is not a code changelog (that is
  git) — it is the "who did what and where it landed".
- No secrets, tokens or personal-machine paths — the file is public inside the repo. The
  **local environment** (Herd · Laragon · Sail · native) lives in `.ai/guidelines/00-project.md` —
  only the evidence that the phase closed goes in here.

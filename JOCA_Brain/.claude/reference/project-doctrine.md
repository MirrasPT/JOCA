# Project doctrine — detail (on-demand)

Compressed version (auto-loaded) in `.claude/rules/pipelines.md` §Project doctrine. This file keeps the full table and the whys. `Read()` when you start/adopt a project or when the short version is not enough.

## Project doctrine — ALWAYS applies, with or without `/start`

The way of working of `/start`/`execute-project` is the **default mode of any project** —
new, inherited or mid-flight. `/start` is the door that installs it from scratch; its absence does not waive it.

Unit of work = **issue**. Gate = **GitHub Actions**. Shared state = **`PROGRESS.md`**.

| Moment | Action |
|---|---|
| **1st session in a project with no `PROGRESS.md`** | Survey of the disk (`pwd`/`ls`/git/manifests/`memory/projects/`) → create `PROGRESS.md` (format: `.claude/reference/start/progress-format.md`) with the **observed** state + Brain memory. Do not open the full interview on your own initiative — that is `/start`; here it is a single question: "what do we do next?" |
| New work (idea, bug, screen) | `new-issue` **before** code; no implementing straight from the chat. Without "Likely files" the issue is not ready — that is what decides parallelism |
| Screen/UI that does not exist yet | `prepare-design` (Artifact) → `validate-design` (gatekeeper) → only then implement. Designing during implementation is what produces the screen that clashes |
| ≥3 open issues with no plan | `plan-waves` (milestones + `blocked-by` + `docs/WAVES.md`) |
| ≥2 issues to implement | **wave loop**: implement (domain agents, parallel only with disjoint "Likely files") → `write-tests` **in another session** → `tester-code` → PR `Closes #N` → cross-cutting sweep → runtime gate → human gate |
| Technical decision taken (stack, schema, off-house) | 1 entry in `docs/DECISIONS.md` — create the file if it does not exist. A decision with no record repeats itself |
| Gates (lint · tests · build) | run in **Actions** (`github` skill); by hand only as a local pre-check |
| Repo with no `.github/workflows/` | create the CI (`github`) before closing the next wave — a gate by convention is not a gate |
| Closing | `/ship` → PR; the issue closes via the PR (`Closes #N`), not by hand |
| End of session | `PROGRESS.md` updated and **committed** with the work (`/save` does the rest) |

**What does NOT get globalised:** the Phase 1-5 interview, the design directions page, the E1
scaffold (create repo/CI/hooks/templates) and the E3 status checkpoint are **startup** — they only run in
`/start`/`execute-project`. In a mid-flight project, what already exists **is not recreated**: it is adopted.

**⚠ Do not invent documents.** `docs/PRD.md` is only created on request or by `/start`. `PROGRESS.md` and
`docs/DECISIONS.md` are created when the work requires them (above) — the rest, no.

A new project already brings this in E1 of `execute-project` (steps 7-10). Green CI does **not** replace the
runtime gate below: it proves that it compiles and that the tests pass, not that it works.

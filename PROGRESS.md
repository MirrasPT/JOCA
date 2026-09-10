# PROGRESS — JOCA (public release)

> Shared project state. Updated by JOCA (`/save`).
> Each contributor's personal context lives in their own JOCA Brain, not here.

## Current state

Mature toolkit, in use. Published in waves out of the working installation: each wave is a commit on
`main` with what has already been verified live.

**The toolkit is now fully in English — on a branch, not on `main`.** `feat/english-translation`
(`c64c9bd`) carries 710 files across 3 commits; `main` is still Portuguese at `cc3d6b0`. Nothing a
contributor has cloned changes until the branch is merged.

Next step: decide what happens to that branch. While the two coexist, porting between the working
installation and this repo stops being a clean merge — 32 files were renamed and nearly every file
changed content, so the port becomes a cherry-pick of the delta.

> This project was born before `/start`, so it does not have the S1-S5/E1-E4 phases of a guided
> startup. The table below is what actually exists, with the evidence for each row.

## State by area

| Area | State | Evidence |
|---|---|---|
| Engine (`JOCA_Brain/`) | ✅ published | 152 skills · 105 agents · 29 commands in `JOCA_Brain/.claude/` |
| Interface (`JOCA_OS/`) | ✅ published | `cc3d6b0` · `cd JOCA_OS/backend && npm test` → 67 tests, 7 files |
| Install from scratch | ✅ | `install.md` |
| Full update (engine + interface) | ✅ | `update.md` |
| Interface-only update | ✅ 2026-09-08 | `update-os.md` |
| Consolidate old installations | ✅ | `clean-install.md` |
| Frontend tests | ⬜ **do not exist** | `JOCA_OS/frontend/src` with no test files |
| CI | ⬜ **does not exist** | no `.github/workflows/` |

## Diary (most recent first)

- 2026-09-10 · macOS · **The whole toolkit translated to English** on `feat/english-translation`.
  710 files, 37 translation workers against a shared contract and glossary, 32 renames with ~300
  references rewritten, mirrors regenerated. What the translation exposed, all pre-existing:
  `prompt-triage.js` matched Portuguese only (an English prompt never triggered a fan-out),
  `compile-bridges.sh` was already broken on disk because it extracts sections by literal heading,
  five skills had frontmatter no strict YAML parser could read, and `joca-terminal` documents CLI
  commands this build does not implement. Gates: backend 67/67, frontend build and eslint clean,
  UI verified live in a browser. → `317b647` · `f64fbba` · `c64c9bd`
- 2026-09-08 · macOS · `JOCA_OS`: sessions snapshotted to disk — restarting the backend no longer
  makes conversations vanish without explanation, and the output they had stays readable. Collapsible
  composer, `Save all` on the dashboard, `start.sh`/`stop.sh` no longer confusing a port's clients
  with its server, and `update-os.md`. WebGL renderer measured and rejected (bench stays in
  `JOCA_OS/frontend/bench/`). → `cc3d6b0`
- 2026-08-20 · macOS · Chat UI reordered, Automations subsystem removed, `AGENTS.md`/`GEMINI.md`
  bridges compiled from the canonical source, and 4 skills that existed only locally published.
  → `bde0032`
- 2026-08-19 · macOS · Cleanup of the tail left behind after the Tasks subsystem went out. → `be16f5c`
- 2026-08-13 · macOS · Two defects reported and fixed: attachment allowlist silently rejecting `.svg`,
  and the `send` button illegible in the dark theme. → `13fa294`

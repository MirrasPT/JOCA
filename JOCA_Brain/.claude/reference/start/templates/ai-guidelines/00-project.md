# Project context

<!--
This file is YOURS and goes into git.

Laravel Boost automatically includes everything under `.ai/guidelines/`
in the CLAUDE.md it generates. That is: you write here, Boost regenerates CLAUDE.md, and
your content is still there. Never edit CLAUDE.md by hand.

Keep it short — this is read in every session. Long detail lives in docs/ and
is referenced, not pasted.
-->

## What it is

<one or two sentences: what problem it solves, for whom>

Detail in `docs/PRODUCT.md`.

## Commands

<Delete the lines of the stack that is not this project's.>

**Laravel / Livewire**
- Tests: `./vendor/bin/pest` · a single one: `--filter=<name>`
- Formatting: `./vendor/bin/pint` · Analysis: `./vendor/bin/phpstan analyse`
- Dev: `composer run dev`

**Next.js**
- Tests: `npm test` · Lint: `npm run lint` · Types: `npx tsc --noEmit`
- Dev: `npm run dev` · Build: `npm run build`

**Flutter**
- Tests: `flutter test` · Analysis: `flutter analyze --fatal-infos`
- Formatting: `dart format .` · Dev: `flutter run`

## Local environment

Where this runs on the machine of whoever develops it. One line per machine.

| Machine / OS | Environment | Local DB | Dev URL |
|---|---|---|---|
| macOS | Laravel Herd | MySQL 8.4 (Herd's) | https://<name>.test |
| Windows | Laragon | MySQL 8.4 (Laragon's) | https://<name>.test |

- **The local DB engine is the same one as production.** Divergence only with an entry in `docs/DECISIONS.md`.
- Versions: PHP `<v>` · Node `<v>`. With no declared manager, it is whatever the environment ships.
- New machine: add your own line, do not replace anyone else's.
- **No personal paths and no third-party ports here** — that lives in each person's JOCA memory.

## Reference documents

Read them when the work touches them — they are deliberately not pasted here:

- `docs/PRODUCT.md` — the problem, the boundaries, the flows
- `docs/DESIGN.md` — visual system (mandatory before touching views)
- `docs/ARCHITECTURE.md` — data model, modules, packages
- `docs/DECISIONS.md` — the why of the structural decisions
- `REVIEW.md` — review criteria

## This project's conventions

<Only what departs from standard Laravel. If you follow the framework's
conventions, this section stays almost empty — and that is a good sign.>

## Never do

- Change migrations already applied in production — create a new one
- Introduce colors, sizes or radii outside `docs/DESIGN.md`
- Write tests in the same session in which the code was implemented
- Commit directly on `main`

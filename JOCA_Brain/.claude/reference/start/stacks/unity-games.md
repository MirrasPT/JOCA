# Delta — Mobile games: Unity 6

The house route for mobile games (doctrine `rules/default-stack.md`). The backend, if there is one, is a
Laravel API — the `laravel-livewire.md` delta covers that half.

## Before starting

The `unity-*` skills (gamedev, ui, build-android) **are not part of every JOCA installation** —
check `memory/SKILL_INDEX.json`. With them: follow them like any domain skill. Without them:
Unity is treated as a manual stack — record it in `docs/DECISIONS.md` and execution is limited to what is
verifiable by CLI (batchmode builds, EditMode/PlayMode tests).

## What changes in the flow

- **E1**: the scaffold is a Unity 6 (LTS) project, not `laravel new`. CI: batchmode builds + Unity
  tests; the batchmode exit code LIES — check by the `Build Finished, Result: Success` log +
  the artifact on disk, never by the exit code.
- **E2**: the design system is game-art direction (palette, UI kit, in-game typography) — /start's
  directions page serves all the same; the materialization is in prefabs/UI Toolkit, not Tailwind.
- **E4**: the "screens" are scenes; the preferred tests are PlayMode over the game rules (a
  UI-independent engine testable without a scene is the architecture to require in the PRD).
- **Deploy** ⛔: Play Console/App Store — keystore and secrets NEVER in git.

## Game PRD — extra sections

Core loop (30s) · economy/progression · win/lose conditions · monetization (if any — in-app payments
have their own store rules, not ifthenpay/Stripe web).

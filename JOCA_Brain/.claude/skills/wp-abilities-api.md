---
name: wp-abilities-api
description: "Register/expose/consume WordPress Abilities (wp_register_ability, wp-abilities/v1 REST, @wordpress/abilities). Invoke on: abilities API, ability not visible."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP Abilities API

## When to use

Activate when the task involves:

- registering abilities or ability categories in PHP,
- exposing abilities via REST (`wp-abilities/v1`),
- consuming abilities in JS (`@wordpress/abilities`),
- diagnosing "ability doesn't show up" / "client can't see ability" / "REST returns empty".

## Inputs required

- Repo root (run `wp-project-triage` first if not done).
- Target WordPress version(s) and whether this is core or plugin/theme.
- Where the change lives (plugin vs theme vs mu-plugin).

## Procedure

### 1) Confirm availability and version constraints

- Core work: check `signals.isWpCoreCheckout` and `versions.wordpress.core`.
- Targeting WP < 6.9: may need the Abilities API plugin/package instead of core.

### 2) Find existing usage

Search the repo for:

- `wp_register_ability(`
- `wp_register_ability_category(`
- `wp_abilities_api_init`
- `wp_abilities_api_categories_init`
- `wp-abilities/v1`
- `@wordpress/abilities`

If none exist, decide whether to introduce fresh registrations + client consumption, or only consume.

### 3) Register categories (optional)

For logical grouping, register an ability category early.

### 4) Register abilities (PHP)

Register with:

- stable `id` (namespaced),
- `label`/`description`,
- `category`,
- `meta`:
  - `readonly: true` for informational abilities,
  - `show_in_rest: true` for client-visible abilities.

Use documented init hooks for registration timing.

### 5) Confirm REST exposure

- Verify endpoints exist and return expected results.
- Ability invisible to client: confirm `meta.show_in_rest` is enabled and query targets the right endpoint.

### 6) Consume from JS (if needed)

- Prefer `@wordpress/abilities` APIs for client-side access and checks.
- Ensure build tooling includes the dependency and bundles it.

## Verification

- `wp-project-triage` shows `signals.usesAbilitiesApi: true` after change.
- REST check: endpoints under `wp-abilities/v1` return your ability and category.
- If repo has tests, add/update coverage for:
  - PHP: ability registration and meta exposure
  - JS: ability consumption and UI gating

## Failure modes / debugging

- Ability never appears:
  - registration code not running (wrong hook / file not loaded),
  - missing `meta.show_in_rest`,
  - incorrect category/ID mismatch.
- REST shows ability but JS doesn't:
  - wrong REST base/namespace,
  - JS dependency not bundled,
  - object/page caches masking changes.

## Escalation

- Uncertain about version support: confirm target WP core versions and whether Abilities API comes from core or plugin.

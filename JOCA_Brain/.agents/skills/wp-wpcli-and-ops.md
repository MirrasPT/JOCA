---
name: wp-wpcli-and-ops
description: "Working with WP-CLI (wp) for WordPress operations: safe search-replace, db export/import, plugin/theme/user/content management, cron, cache flushing, multisite. MUST be invoked when the user mentions: WP, CLI, WordPress."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Requires WP-CLI in the execution environment."
---

# WP-CLI and Ops

## When to use

WordPress operational work via WP-CLI:

- `wp search-replace` (URL changes, domain migrations, protocol switch)
- DB export/import, resets, inspections (`wp db *`)
- Plugin/theme install/activate/update, language packs
- Cron event listing/running
- Cache/rewrite flushing
- Multisite operations (`wp site *`, `--url`, `--network`)
- Repeatable scripts (`wp-cli.yml`, shell scripts, CI jobs)

## Inputs required

- Where WP-CLI runs (local dev, staging, production) and whether safe to run.
- How to target the correct site root:
  - `--path=<wordpress-root>` and (multisite) `--url=<site-url>`
- Whether multisite and whether commands should run network-wide.
- Constraints (no downtime, no DB writes, maintenance window).

## Procedure

### 0) Guardrails: confirm environment and blast radius

WP-CLI commands can be destructive. Before any write operation:

1. Confirm environment (dev/staging/prod).
2. Confirm targeting (path/url) to avoid hitting the wrong site.
3. Back up before risky operations.

Read `references/safety.md`.

### 1) Inspect WP-CLI and site targeting (deterministic)

Run the inspector:

- `node skills/wp-wpcli-and-ops/scripts/wpcli_inspect.mjs --path=<path> [--url=<url>]`

If WP-CLI is unavailable, install via the project's documented tooling (Composer, container, or system package), or ask for the expected execution environment.

### 2) Choose the right workflow

#### A) Safe URL/domain migration (`search-replace`)

Follow this sequence:

1. `wp db export` (backup)
2. `wp search-replace --dry-run` (review impact)
3. Run the real replace with appropriate flags
4. Flush caches/rewrite if needed

Read `references/search-replace.md`.

#### B) Plugin/theme operations

Use `wp plugin *` / `wp theme *`. Confirm you are acting on the intended site (and network) first.

Read `references/packages-and-updates.md`.

#### C) Cron and queues

Inspect cron state and run individual events for debugging rather than running everything blindly.

Read `references/cron-and-cache.md`.

#### D) Multisite operations

Multisite changes can affect many sites. Always decide scope:

- Single site (`--url=`), or
- Network-wide (`--network` / iterating sites)

Read `references/multisite.md`.

### 3) Automation patterns (scripts + wp-cli.yml)

For repeatable ops, prefer:

- `wp-cli.yml` for defaults (path/url, PHP memory limits)
- Shell scripts that log commands and stop on error
- CI jobs that run read-only checks by default

Read `references/automation.md`.

## Verification

- Re-run `wpcli_inspect` after changes that affect targeting or config.
- Confirm intended side effects:
  - Correct URLs updated
  - Plugins/themes in expected state
  - Cron/caches flushed where needed
- Run health check endpoint or smoke tests after ops changes.

## Failure modes / debugging

- "Error: This does not seem to be a WordPress installation."
  - Wrong `--path`, wrong container, or missing `wp-config.php`
- Multisite commands affecting the wrong site
  - Missing `--url` or wrong URL
- Search-replace causes unexpected serialization issues
  - Wrong flags or changing serialized data unsafely

Read `references/debugging.md`.

## Escalation

- If environment safety is unconfirmed, do not run write operations.
- If the repo uses containerized tooling (Docker/wp-env) but you lack access, ask for the intended command runner or CI job.

---
name: wp-plugin-development
description: "Plugin architecture, hooks, activation/deactivation/uninstall, admin UI, Settings API, data storage, cron, security. MUST be invoked when the user mentions: WordPress, UI, Settings API."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP Plugin Development

## When to use

- Creating or refactoring plugin structure (bootstrap, includes, namespaces/classes)
- Adding hooks/actions/filters
- Activation/deactivation/uninstall behaviour and migrations
- Settings pages / options / admin UI (Settings API)
- Security fixes (nonces, capabilities, sanitization/escaping, SQL safety)
- Packaging a release (build artifacts, readme, assets)

## Inputs required

- Repo root + target plugin(s) (path to main file if known).
- Environment: single site vs multisite; WP.com conventions if applicable.
- Target WordPress + PHP versions (affects available APIs and `$wpdb->prepare()` placeholder support).

## Procedure

### 0) Triage and locate entrypoints

1. Run triage:
   - `node skills/wp-project-triage/scripts/detect_wp_project.mjs`
2. Detect plugin headers:
   - `node skills/wp-plugin-development/scripts/detect_plugins.mjs`

For full site repos, pick the specific plugin under `wp-content/plugins/` or `mu-plugins/` before editing.

### 1) Architecture

- Single bootstrap file (main plugin file with header).
- No heavy side effects at load time; load on hooks.
- Dedicated loader/class to register hooks.
- Admin-only code behind `is_admin()` (or admin hooks) to cut frontend overhead.

See: `references/structure.md`

### 2) Hooks and lifecycle

Activation hooks are fragile; follow guardrails:

- Register activation/deactivation hooks at top-level, not inside other hooks.
- Flush rewrite rules only when needed, only after registering CPTs/rules.
- Explicit, safe uninstall (`uninstall.php` or `register_uninstall_hook`).

See: `references/lifecycle.md`

### 3) Settings and admin UI (Settings API)

- `register_setting()`, `add_settings_section()`, `add_settings_field()`
- Sanitize via `sanitize_callback`

See: `references/settings-api.md`

### 4) Security baseline (always)

- Validate/sanitize input early; escape output late.
- Nonces for CSRF + capability checks for authorization.
- Never trust raw `$_POST`/`$_GET`; use `wp_unslash()` and specific keys.
- `$wpdb->prepare()` for SQL; no string-concatenated queries.

See: `references/security.md`

### 5) Data storage, cron, migrations (if needed)

- Options for small config; custom tables only when necessary.
- Cron tasks must be idempotent; provide manual run paths (WP-CLI or admin).
- Schema changes need upgrade routines + stored schema version.

See: `references/data-and-cron.md`

## Verification

- Plugin activates with no fatals/notices.
- Settings save and read correctly (capability + nonce enforced).
- Uninstall removes intended data only.
- Run repo lint/tests (PHPUnit/PHPCS if present) and JS build steps if plugin ships assets.

## Failure modes / debugging

- Activation hook not firing:
  - Hook registered incorrectly (not in main file scope), wrong main file path, or network-activated plugin.
- Settings not saving:
  - Settings not registered, wrong option group, missing capability, nonce failure.
- Security regressions:
  - Nonce present but missing capability checks; sanitized input not escaped on output.

See: `references/debugging.md`

## Escalation

Consult the Plugin Handbook and security guidelines before inventing patterns.

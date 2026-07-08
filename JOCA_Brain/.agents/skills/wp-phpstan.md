---
name: wp-phpstan
description: "Configuring, running, or fixing PHPStan static analysis in WordPress projects (plugins/themes/sites): phpstan.neon setup, baselines, WordPress-specific typing, and handling. MUST be invoked when the user mentions: PHPStan, WordPress."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Requires Composer-based PHPStan."
---

# WP PHPStan

## When to use

- Setting up or updating `phpstan.neon` / `phpstan.neon.dist`
- Generating or updating `phpstan-baseline.neon`
- Fixing PHPStan errors via WordPress-friendly PHPDoc (REST requests, hooks, query results)
- Handling third-party plugin/theme classes safely (stubs/autoload/targeted ignores)

## Inputs required

- `wp-project-triage` output (run first if missing).
- Whether adding/updating Composer dev dependencies is allowed (stubs).
- Whether changing the baseline is allowed.

## Procedure

### 0) Discover PHPStan entrypoints (deterministic)
1. Inspect PHPStan setup manualmente: `phpstan.neon*`, baseline, scripts em `composer.json` — o script inspector não existe nesta instalação.

Prefer the repo's existing `composer` script (e.g. `composer run phpstan`) when present.

### 1) Ensure WordPress core stubs are loaded

`szepeviktor/phpstan-wordpress` or `php-stubs/wordpress-stubs` are required for most WordPress repos. Without them, expect high error volume about unknown core functions.

- Confirm package is installed (check `composer.json`).
- Ensure PHPStan config references stubs.

### 2) Ensure a sane `phpstan.neon` for WordPress

- Keep `paths` focused on first-party code (plugin/theme directories).
- Exclude generated and vendored code (`vendor/`, `node_modules/`, build artifacts, tests unless explicitly analyzed).
- Keep `ignoreErrors` narrow and documented.

### 3) Fix errors with WordPress-specific typing (preferred)

Prefer correcting types over ignoring errors. Common WP patterns needing help:

- REST endpoints: type request parameters using `WP_REST_Request<...>`
- Hook callbacks: add accurate `@param` types for callback args
- Database results and iterables: use array shapes or object shapes for query results
- Action Scheduler: type `$args` array shapes for job callbacks

### 4) Handle third-party plugin/theme classes (only when needed)

When integrating with plugins/themes absent from the analysis environment:

- Confirm the dependency is real (installed/required).
- Prefer plugin-specific stubs already in the repo (e.g. `php-stubs/woocommerce-stubs`, `php-stubs/acf-pro-stubs`).
- If PHPStan still cannot resolve classes, add targeted `ignoreErrors` for the specific vendor prefix.

### 5) Baseline management (migration tool, not trash bin)

- Generate baseline once for legacy code, then reduce over time.
- Never baseline newly introduced errors.

## Verification

- Run PHPStan via discovered command (`composer run ...` or `vendor/bin/phpstan analyse`).
- Confirm baseline (if used) is included and did not grow unexpectedly.
- Re-run after changing `ignoreErrors` to ensure patterns are not masking unrelated issues.

## Failure modes / debugging

- "Class not found":
  - Confirm autoloading/stubs, or add narrow ignore pattern
- Huge error counts after enabling PHPStan:
  - Reduce `paths`, add `excludePaths`, start at lower level, ratchet up
- Inconsistent types around hooks / REST params:
  - Add explicit PHPDoc (see references) rather than runtime guards

## Escalation

- Type depends on unconfirmable third-party plugin API: ask for dependency version or source before inventing types.
- Fixing requires new Composer dependencies (stubs/extensions): confirm with user first.

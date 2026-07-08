---
name: wordpress-router
description: "Classify a WordPress repo (plugin/theme/block theme/core/site) and route to the right wp-* skill. Invoke at the start of any WordPress task."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WordPress Router

## When to use

Activate at the start of WordPress tasks to:

- classify the codebase (plugin vs theme vs block theme vs core checkout vs full site),
- select the right workflow and guardrails,
- delegate to the relevant domain skill(s).

## Inputs required

- Repo root (cwd).
- User intent (desired change) and constraints (WP version targets, WP.com specifics, release needs).

## Procedure

1. Triage do repo:
   - Read(".claude/skills/wp-project-triage.md") e fazer o triage manualmente (o script não existe nesta instalação).
2. Read output and classify:
   - primary project kind(s),
   - available tooling (PHP/Composer, Node, @wordpress/scripts),
   - tests present (PHPUnit, Playwright, wp-env),
   - version hints.
3. Route to domain workflows based on intent + repo kind.
4. Apply guardrails before changes:
   - Confirm version constraints if unclear.
   - Prefer the repo's existing tooling and conventions for builds/tests.

## Verification

- Re-run triage script after creating or restructuring significant files.
- Run the repo's lint/test/build commands recommended by triage output.

## Failure modes / debugging

- Triage reports `kind: unknown` -- inspect:
  - root `composer.json`, `package.json`, `style.css`, `block.json`, `theme.json`, `wp-content/`.
- Huge repo -- narrow scanning scope or add ignore rules to triage script.

## Escalation

- Ambiguous routing -- ask one question:
  - "Is this a WordPress plugin, a theme (classic/block), or a full site repo?"

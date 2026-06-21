---
name: wordpress-router
description: "Classifies WordPress repos (plugin, theme, block theme, core, full site) and routes to the correct domain skill. MUST be invoked when the user mentions: WordPress, Gutenberg, WP, REST API, CLI."
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

1. Run triage script:
   - `node skills/wp-project-triage/scripts/detect_wp_project.mjs`
2. Read output and classify:
   - primary project kind(s),
   - available tooling (PHP/Composer, Node, @wordpress/scripts),
   - tests present (PHPUnit, Playwright, wp-env),
   - version hints.
3. Route to domain workflows based on intent + repo kind:
   - Decision tree: `skills/wordpress-router/references/decision-tree.md`.
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

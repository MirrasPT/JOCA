---
name: wp-project-triage
description: "Deterministic WP repo inspection (kind, tooling, versions) with JSON output — run before any WP change. Invoke on: what kind of WP project is this."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP Project Triage

## When to use

Quickly identify what kind of WordPress repo you are in and which commands/conventions apply before making changes.

## Inputs required

- Repo root (current working directory).

## Procedure

1. Inspect the repo manually (the detector script does not exist in this installation) — signals: plugin header in `*.php`, `style.css` + `theme.json`/`templates/` (block theme), `block.json`, `composer.json`/`package.json`, `wp-env.json`, `wp-content/`/`wp-includes/` (core/full site).
2. Produce the JSON report manually with `project.kind`, `signals`, `tooling` (tests, version hints).
3. Use the report to select workflow guardrails:
   - project kind(s), PHP/Node tooling, tests present, version hints and sources.
4. If the report lacks needed signals, inspect deeper instead of guessing.

## Verification

- JSON parses and includes: `project.kind`, `signals`, `tooling`.
- Re-run after structural/tooling changes (`theme.json`, `block.json`, build config).

## Failure modes / debugging

- Reports `unknown`: check repo root is correct.
- Scanning slow: add/extend ignore directories in the script.

---
name: wp-project-triage
description: "Deterministic inspection of a WordPress repository (plugin/theme/block theme/WP core/Gutenberg/full site) including tooling/tests/version hints, outputting structured JSON. MUST be invoked when the user mentions: WordPress, WP, Gutenberg, JSON."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP Project Triage

## When to use

Quickly identify what kind of WordPress repo you are in and which commands/conventions apply before making changes.

## Inputs required

- Repo root (current working directory).

## Procedure

1. Run the detector (prints JSON to stdout):
   - `node skills/wp-project-triage/scripts/detect_wp_project.mjs`
2. For the exact output contract, read:
   - `skills/wp-project-triage/references/triage.schema.json`
3. Use the report to select workflow guardrails:
   - project kind(s), PHP/Node tooling, tests present, version hints and sources.
4. If the report lacks needed signals, update the detector instead of guessing.

## Verification

- JSON parses and includes: `project.kind`, `signals`, `tooling`.
- Re-run after structural/tooling changes (`theme.json`, `block.json`, build config).

## Failure modes / debugging

- Reports `unknown`: check repo root is correct.
- Scanning slow: add/extend ignore directories in the script.

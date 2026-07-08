---
name: wp-block-themes
description: "Block theme development — theme.json, templates/parts, patterns, style variations, Site Editor debugging. Invoke on: theme.json, block theme, styles not applying."
compatibility: "WordPress 6.9+ (PHP 7.2.24+). Filesystem agent with bash + node. Some workflows need WP-CLI."
---

# WP Block Themes

## When to use

- Editing `theme.json` (presets, settings, styles, per-block styles)
- Adding/changing templates (`templates/*.html`) or template parts (`parts/*.html`)
- Adding patterns (`patterns/*.php`) and controlling inserter visibility
- Adding style variations (`styles/*.json`)
- Debugging "styles not applying" or "editor doesn't reflect theme.json"

## Inputs required

- Repo root and target theme directory (if multiple themes exist).
- Target WordPress version range (theme.json schema varies by core version).
- Where issue manifests: Site Editor, post editor, frontend, or all.

## Procedure

### 0) Triage and locate block theme roots

1. Run triage:
   - Read(".claude/skills/wp-project-triage.md") e fazer o triage manualmente (o script não existe nesta instalação).
2. Detect theme roots + key folders manualmente: procurar `theme.json` + `templates/`/`parts/` (Glob) — o script não existe nesta instalação.

If multiple themes exist, pick one and scope all changes to that theme root.

### 1) Create a new block theme (if needed)

When creating from scratch or converting a classic theme:

- Start from a known-good scaffold (or WP environment export) rather than guessing layout.
- Specify minimum supported WordPress version since `theme.json` schema versions differ.

After creating the theme root, re-detect theme roots and continue.

### 2) Confirm theme type and override expectations

- Block theme indicators: `theme.json` present, `templates/` and/or `parts/` present.
- Style hierarchy: core defaults -> theme.json -> child theme -> user customizations.
- User customizations can make theme.json edits appear "ignored".

### 3) Make `theme.json` changes safely

Decide whether changing:

- **settings** (what the UI allows): presets, typography scale, colors, layout, spacing
- **styles** (default appearance): CSS-like rules for elements/blocks

### 4) Templates and template parts

- Templates live under `templates/` as HTML.
- Template parts live under `parts/` -- must not be nested in subdirectories.

### 5) Patterns

Prefer filesystem patterns under `patterns/` for theme-owned patterns.

### 6) Style variations

Style variations are JSON files under `styles/`. Once a user picks a variation, that selection is stored in the DB -- changing the file may not update what the user sees.

## Verification

- Site Editor reflects changes (Styles UI, templates, patterns).
- Frontend renders with expected styles.
- If styles unchanged, check whether user customizations override theme defaults.
- Run build/lint scripts if assets are involved (fonts, custom JS/CSS).

## Failure modes / debugging

Common issues:

- Wrong theme root (editing inactive theme)
- User customizations override defaults
- Invalid `theme.json` shape/typos prevent application
- Templates/parts in wrong folders (or nested parts)

## Escalation

Consult canonical docs: Theme Handbook and Block Editor Handbook for `theme.json`, templates, patterns, and style variations.

---
name: wp-block-development
description: "Develop Gutenberg blocks — block.json, attributes/serialization, dynamic render, deprecations, @wordpress/scripts. Invoke on: block invalid, block.json, create-block."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP Block Development

## When to use

Activate for block work:

- creating or updating blocks
- changing `block.json` (scripts/styles/supports/attributes/render/viewScriptModule)
- fixing "block invalid / not saving / attributes not persisting"
- adding dynamic rendering (`render.php` / `render_callback`)
- block deprecations and migrations (`deprecated` versions)
- build tooling (`@wordpress/scripts`, `@wordpress/create-block`, `wp-env`)

## Inputs required

- Repo root and target (plugin vs theme vs full site).
- Block name/namespace and location (path to `block.json` if known).
- Target WordPress version range (especially for modules / `viewScriptModule`).

## Procedure

### 0) Triage and locate blocks

1. Run triage:
   - Read(".claude/skills/wp-project-triage.md") e fazer o triage manualmente (o script não existe nesta instalação).
2. List blocks: procurar ficheiros `block.json` no repo (Glob) — o script não existe nesta instalação.
3. Identify the block root (directory with `block.json`) you're changing.

For full site repos (`wp-content/` present), specify which plugin/theme contains the block.

### 1) Create a new block (if needed)

Prefer scaffolding over hand-rolling:

- Use `@wordpress/create-block` for modern block/plugin setup.
- For Interactivity API from day 1, use the interactive template.

After scaffolding:
1. Re-run the block list (Glob `block.json`), confirm new block root.
2. Continue with remaining steps (model choice, metadata, registration, serialization).

### 2) Ensure apiVersion 3 (WordPress 6.9+)

WP 6.9 enforces `apiVersion: 3` in block.json schema. Blocks with apiVersion 2 or lower trigger console warnings under `SCRIPT_DEBUG`.

**Why it matters:**
- WP 7.0 runs the post editor in an iframe regardless of apiVersion.
- apiVersion 3 ensures correct behavior inside the iframed editor (style isolation, viewport units, media queries).

**Migration:** Usually just updating the `apiVersion` field. Caveats:
- Test locally with iframe editor enabled.
- Ensure style handles are in `block.json` (styles missing from iframe won't apply).
- Third-party scripts on a specific `window` may have scoping issues.

### 3) Pick the right block model

- **Static block** (markup saved in post content): implement `save()`; keep attributes serialization stable.
- **Dynamic block** (server-rendered): use `render` in `block.json` (or `render_callback` in PHP); keep `save()` minimal or `null`.
- **Interactive frontend behavior**:
  - Prefer `viewScriptModule` for modern module-based view scripts.
  - For `data-wp-*` directives or stores, also use `wp-interactivity-api`.

### 4) Update `block.json` safely

Edit `block.json`, then confirm registration matches metadata.

Common pitfalls:
- changing `name` breaks compatibility (treat as stable API)
- changing saved markup without `deprecated` causes "Invalid block"
- adding attributes without correct source/serialization causes "attribute not saving"

### 5) Register the block (server-side preferred)

Prefer PHP registration using metadata when you need:
- dynamic rendering
- translations (`wp_set_script_translations`)
- conditional asset loading

### 6) Implement edit/save/render patterns

Wrapper attribute best practices:
- Editor: `useBlockProps()`
- Static save: `useBlockProps.save()`
- Dynamic render (PHP): `get_block_wrapper_attributes()`

### 7) Inner blocks (block composition)

For "container" blocks that nest other blocks:
- Use `useInnerBlocksProps()` to integrate inner blocks with wrapper props.
- Keep migrations in mind when changing inner markup.

### 8) Attributes and serialization

Before changing attributes:
- confirm where the value lives (comment delimiter vs HTML vs context)
- avoid the deprecated `meta` attribute source

### 9) Migrations and deprecations (avoid "Invalid block")

When changing saved markup or attributes:
1. Add a `deprecated` entry (newest to oldest).
2. Provide `save` for old versions and optional `migrate` to normalize attributes.

### 10) Tooling and verification commands

Prefer the repo's existing tooling:
- `@wordpress/scripts` (common) -- run existing npm scripts
- `wp-env` (common) -- use for local WP + E2E

## Verification

- Block appears in inserter and inserts correctly.
- Saving + reloading does not cause "Invalid block".
- Frontend output matches expectations (static: saved markup; dynamic: server output).
- Assets load where expected (editor vs frontend).
- Run repo's lint/build/tests recommended by triage.

## Failure modes / debugging

## Escalation

For uncertain upstream behavior/version support, consult canonical docs:
- WordPress Developer Resources (Block Editor Handbook, Theme Handbook, Plugin Handbook)
- Gutenberg repo docs for bleeding-edge behaviors

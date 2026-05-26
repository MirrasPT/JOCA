---
name: shopify-theme
description: "Building or customising a Shopify theme: Liquid templating, theme architecture (layout/templates/sections/blocks/snippets), theme.json settings, Dawn-based development, Theme. MUST be invoked when the user mentions: Shopify, Liquid, Dawn, Theme Check, CLI."
compatibility: "Shopify CLI 3.x+. Online Store 2.0 (sections everywhere). Node.js 20.10+."
---

# Shopify Theme

## When to use

- Building a custom Shopify theme from scratch or forking Dawn
- Adding/modifying sections, blocks, templates, snippets
- Customising `settings_schema.json` / `config/settings_data.json`
- Theme Check linting and fixing Liquid issues
- Pushing, pulling, publishing themes via CLI

## Inputs required

- Working directory (theme root with `layout/theme.liquid`).
- Dev store domain or theme ID for push/pull operations.
- Target Shopify version context (Online Store 2.0 assumed).

## Setup

```bash
npm install -g @shopify/cli@latest

# Clone Dawn as starting point (optional)
shopify theme init --clone-url https://github.com/Shopify/dawn
```

## Core workflow

1. **Init** — clone or scaffold theme
2. **Dev** — preview on store with hot reload
3. **Build** — implement sections/blocks/Liquid
4. **Lint** — Theme Check
5. **Push / publish** — deploy to store

Load detailed guidance based on context:

| Topic               | Reference                         | Load when                                           |
|---------------------|-----------------------------------|-----------------------------------------------------|
| Liquid basics       | `references/liquid-basics.md`     | Templating, filters, tags, objects                  |
| Theme architecture  | `references/theme-architecture.md`| Sections, blocks, snippets, layout, settings schema |
| CLI commands        | `references/cli-commands.md`      | dev, push, pull, publish, check, profile            |

## Constraints

### MUST DO
- Use Online Store 2.0 architecture (sections everywhere, blocks)
- Namespace section settings to avoid conflicts (`shopify__` prefix for app-injected)
- Use `{% render %}` over `{% include %}` (scoped, no variable leakage)
- Lazy-load images with `loading="lazy"` and provide `width`/`height`
- Run `shopify theme check` before every push
- Test in multiple browsers and on mobile viewport

### MUST NOT DO
- Use `{% include %}` in new code (deprecated, leaks variables)
- Inline CSS/JS when `{% stylesheet %}` / `{% javascript %}` tags are available
- Hardcode store-specific URLs or product handles
- Skip `alt` attributes on images (accessibility + SEO)
- Modify files under `assets/` that are compiled outputs (edit source, not output)

## Verification

```bash
shopify theme check                          # lint Liquid
shopify theme dev --store=mystore.myshopify.com   # preview
shopify theme push --unpublished             # upload without publishing
shopify theme publish --theme-id=<id>       # publish when ready
```

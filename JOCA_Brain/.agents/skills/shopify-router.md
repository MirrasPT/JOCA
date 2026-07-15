---
name: shopify-router
description: "Classifies Shopify project type and routes to the correct skill (shopify-app, shopify-theme, shopify-store-audit, shopify-store-fixer). MUST be invoked when the user mentions: Shopify."
compatibility: "Shopify CLI 3.x+. Node.js 20.10+. Some workflows require a Shopify Partner account and dev store."
---

# Shopify Router

## When to use

At the start of any Shopify task to:

- Identify the project type (app / theme / store audit / fix)
- Pick the right skill and workflow
- Detect available tooling (CLI, MCP, Admin API access)

## Inputs required

- Working directory (repo root, or store URL for audits).
- User intent: build, extend, theme, audit, or fix.

## Procedure

1. Detect project type from filesystem:
   - `shopify.app.toml` present → **Shopify App** (`shopify-app`)
   - `config/settings_schema.json` or `layout/theme.liquid` present → **Shopify Theme** (`shopify-theme`)
   - Store URL provided, no local repo → **Store Audit** (`shopify-store-audit`)
   - Admin API access + fix request → **Store Fixer** (`shopify-store-fixer`)

2. Check tooling:
   ```bash
   shopify version 2>/dev/null || echo "cli_unavailable"
   node --version 2>/dev/null
   ```

3. Route:

| Project type     | Skill                  | Load when                                     |
|------------------|------------------------|-----------------------------------------------|
| App / Extension  | `shopify-app`          | `shopify.app.toml`, extensions, Admin API     |
| Theme            | `shopify-theme`        | Liquid, `theme.liquid`, `theme.json`          |
| Store audit      | `shopify-store-audit`  | Store URL provided, analyse-only request      |
| Store fix        | `shopify-store-fixer`  | Admin API + write permission + fix request    |

## Decision: App vs Extension vs Theme

| Scenario                                          | Build                |
|--------------------------------------------------|----------------------|
| External service integration, multi-store, paid  | App                  |
| Checkout customisation, admin UI field, POS      | Extension (in app)   |
| Custom storefront design, brand-specific layout  | Theme                |
| Audit trust/SEO/AEO/conversion of existing store | Store Audit          |

## Verification

- Re-run detection if new files are added to the root.
- Confirm Partner account + dev store are linked before `shopify app dev`.

## Escalation

If routing is ambiguous, ask:
> "Is this a Shopify app, a theme, or do you want to audit/fix an existing store?"

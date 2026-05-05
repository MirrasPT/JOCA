---
name: shopify-app
description: "Use when building or extending a Shopify app: CLI scaffold, app config, Admin API (GraphQL preferred), extensions (checkout/admin/POS/customer account), webhooks, OAuth, Shopify Functions. Covers full development lifecycle from init to deploy."
compatibility: "Shopify CLI 3.x+. Node.js 20.10+. Requires Shopify Partner account and dev store."
---

# Shopify App

## When to use

- Scaffolding a new Shopify app (`shopify app init`)
- Building or modifying app extensions (checkout UI, admin UI, theme app extensions, Functions)
- Querying or mutating store data via Admin API (GraphQL)
- Implementing OAuth, webhooks, billing
- Deploying and releasing app versions

## Inputs required

- Working directory (repo root with `shopify.app.toml`).
- Dev store domain (e.g. `mystore.myshopify.com`).
- Extension type if building extensions.
- API access scopes needed.

## Setup

### CLI install
```bash
npm install -g @shopify/cli@latest
```

### Shopify AI Toolkit (recommended — provides docs + schema context in-editor)

Plugin (auto-updates):
```
/plugin marketplace add Shopify/shopify-ai-toolkit
/plugin install shopify-plugin@shopify-plugin
```

MCP server (no auth, local):
```bash
claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest
```

Per-skill install:
```bash
npx skills add Shopify/shopify-ai-toolkit --skill shopify-admin
```

## Core workflow

1. **Init / link** — scaffold or link existing app
2. **Dev** — local development with live preview on dev store
3. **Build extensions** — scaffold + implement
4. **Test** — webhook triggers, function local runs
5. **Deploy + release** — push config and extensions, publish version

Load detailed guidance based on context:

| Topic               | Reference                          | Load when                                             |
|---------------------|------------------------------------|-------------------------------------------------------|
| CLI commands        | `references/cli-commands.md`       | Any CLI operation (init, dev, build, deploy)          |
| GraphQL Admin API   | `references/graphql-admin-api.md`  | Store data queries/mutations, bulk operations         |
| Extensions          | `references/extensions.md`         | Checkout UI, Admin UI, POS, Customer Account, Theme   |
| Webhooks & OAuth    | `references/webhooks-oauth.md`     | Event handling, OAuth flow, billing, security         |

## Constraints

### MUST DO
- Use GraphQL Admin API for all new work (REST is legacy/maintenance only)
- Request only required fields — Shopify throttles by query cost, not count
- Use cursor-based pagination for large datasets
- Store credentials in env vars (never hardcode API keys)
- Verify all webhook payloads via HMAC signature
- Use OAuth for public apps; use custom app tokens only for private/internal use
- Respect API rate limits — monitor `X-Shopify-Shop-Api-Call-Limit` header
- Validate all user input before passing to Admin API

### MUST NOT DO
- Use REST Admin API for new features (deprecated path)
- Hardcode store domains or API credentials in source
- Skip webhook HMAC verification (security vulnerability)
- Run bulk operations without checking status + handling failures
- Deploy to production without first testing on dev store

## Verification

```bash
shopify app config validate       # validate app + extension config
shopify app info                  # confirm linked app + env
shopify app dev                   # live preview — check for errors in output
```

After deploy:
```bash
shopify app versions list         # confirm version created
```

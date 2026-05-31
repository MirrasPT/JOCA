---
name: wix-cli
origin: local
description: "Two paths: (1) develop/build/deploy Wix CLI projects (apps + headless sites) — extensions, CLI commands, official Wix skills; (2) edit an EXISTING classic Wix Editor site's catalog/content via the Wix Stores REST API (product description HTML, SEO, ribbon, brand, stock) WITHOUT any local project. MUST be invoked when the user mentions: Wix, Wix CLI, Wix app, dashboard extension, wix.config.json, Velo, edit Wix product, Wix store catalog, Wix Stores API, update Wix product description."
compatibility: "Wix CLI 1.x. Node.js 20.11+. Built on Astro. Requires a Wix account (wix login). App projects need a Wix app in the dashboard. REST path: API key + site ID, no local project needed."
---

# Wix CLI

## Route FIRST — three distinct paths

Before touching CLI or writing code, classify the task. Wrong path = wasted work.

| Goal | Path |
|---|---|
| Build/ship a Wix **app** or **headless** site (local project exists or to be created) | **CLI** → official skills (below) |
| Edit content/catalog of an **already-published** site, **no `wix.config.json`** locally | **inspect Editor type, then REST** (see decision) |

**Decision when no local `wix.config.json` and goal = edit a live published site:**

```bash
# classify the live site by its generator meta tag
curl -s "<site_url>" | grep -i 'name="generator"'
```

| `<meta name="generator">` | Editor type | Action |
|---|---|---|
| `content="Wix.com Website Builder"` | **Classic Wix Editor** | **REST API** — Velo/CLI cannot edit a classic Editor site's catalog from outside. Use *Edit existing Wix Editor site* below. |
| `content="Wix Studio"` | **Wix Studio** | CLI/headless possible (`wix dev`), or REST for catalog. |
| no generator tag (+ no `wix-warmup-data`, no `_wix_browser_sess` cookie) | **Headless** | CLI path. |

> Common mistake (fixed): routing a classic Editor catalog edit to Velo/CLI. A classic Editor site has no local project to clone — its catalog is mutated only via the **Stores REST API**. Go to that section.

## When to use (CLI path)

Any task involving a Wix CLI project — apps (dashboard/backend/site extensions) or headless sites. Detect, route, then defer deep work to the **official Wix skills** (installed in-project), falling back to this reference.

## First move — bootstrap official skills

Wix ships 16 specialised skills + an MCP server as a Claude Code plugin. They live **per-project** in `.claude/`, not in JOCA. Always ensure they are present before coding:

```bash
# inside the Wix project root (has wix.config.json):
wix skills add        # add official skills to an existing project
wix skills update     # keep skills aligned with CLI version
```

- New CLI projects include skills by default → nothing to do.
- Keep CLI and skills aligned: upgrade one → upgrade the other.
- The official skills handle extension registration, TypeScript validation, build checks, and Wix Design System component knowledge. **Prefer them over this file when present.**

## Project detection

| Signal | Meaning |
|---|---|
| `wix.config.json` (has `appId`, `projectId`) | Wix CLI project root |
| `.claude/` with Wix skills | official skills installed |
| `src/extension.ts` | extension registry (imports + registers all extensions) |
| `astro.config.mjs` | Astro-based (all Wix CLI projects) |
| extra `pages/ components/ layouts/` | headless site project |

```bash
wix --version 2>/dev/null || echo "cli_missing"   # install: npm i -g @wix/cli
node --version                                     # need 20.11+
wix whoami 2>/dev/null || wix login                # auth
```

## Structure

```
project/
├── wix.config.json   ← appId + projectId (DON'T edit by hand)
├── .env.local        ← local auth env vars
├── astro.config.mjs  ← Astro config
├── package.json · tsconfig.json
├── .wix/  .astro/  dist/   ← internal/build, auto-managed (don't edit)
├── public/           ← static, served at root
├── .claude/ .cursor/ ← AI skills per tool
└── src/
    ├── extension.ts  ← central registry: imports + registers EVERY extension
    └── extensions/   ← extension code (layout flexible; default dashboard/pages/...)
```

Rule: every extension must be wired into `src/extension.ts` or it won't register. The official skills do this automatically.

## Extension types

| Category | Builds |
|---|---|
| **Dashboard** | pages, modals, plugins, menu plugins |
| **Backend** | service plugins, event handlers, backend APIs, data collections |
| **Site** | custom elements, site plugins, embedded scripts |
| **Headless** | Astro pages, components, layouts |

Decision: external service / multi-site / monetised → **app**. Admin UI inside Wix dashboard → **dashboard extension**. Server logic, webhooks, CMS → **backend extension**. Storefront widget/script → **site extension**.

## CLI commands

```bash
# project
wix dev          # local dev server + live preview
wix generate     # scaffold an extension
wix build        # production build → dist/
wix preview      # deploy a shareable preview build
wix release      # release the app

# auth (global)
wix login | wix logout | wix whoami

# skills
wix skills add | wix skills update

# env
wix env-pull | wix env-set | wix env-remove

# misc
wix telemetry
```

## Workflow

1. **Setup** — `wix login`; ensure skills (`wix skills add`); `npm install`.
2. **Generate** — `wix generate` to scaffold the extension type.
3. **Develop** — `wix dev` for live preview; edit under `src/`, registered via `src/extension.ts`.
4. **Validate** — TypeScript check + build (official skills run these automatically).
5. **Ship** — `wix build` → `wix preview` (shareable) → `wix release`.

## Verification

- `wix.config.json` present and `wix whoami` authenticated before `dev`/`build`.
- New extension appears registered in `src/extension.ts`.
- `wix build` exits clean (no TS errors) before `release`.

## Escalation

- Official skills absent and `wix skills add` fails → CLI/project mismatch; run `wix skills update` and confirm Node ≥ 20.11.
- Routing ambiguous → ask: "Wix app extension (dashboard/backend/site) or a headless site?"

---

# Edit existing Wix Editor site (REST API)

No local project. Mutate a published classic Editor site's catalog/content directly. Auth = **API key + site ID**, no CLI.

## Credentials — read from a local file, NEVER env vars

Tool-calls do **not** share a shell; `export`/`$env:` set in one bash call is gone in the next. Persist reused secrets/IDs in a local gitignored file and read on each call:

```bash
# .wix-creds (gitignored). Read fresh in every tool-call:
WIX_API_KEY=...        # dashboard → Settings → API Keys; needs "Manage Products"
WIX_SITE_ID=...        # see below
```

```bash
KEY=$(grep WIX_API_KEY .wix-creds | cut -d= -f2)
SITE=$(grep WIX_SITE_ID .wix-creds | cut -d= -f2)
```

## Get the site ID

- From dashboard URL: `https://manage.wix.com/dashboard/<SITE_UUID>/...` → the UUID after `/dashboard/`.
- Or list sites: `GET https://www.wixapis.com/site-list/v2/sites/query` with **only** `wix-account-id`.

## Header rule — `wix-site-id` XOR `wix-account-id` (critical)

Stores is **site-level**. Send exactly:

```
Authorization: <WIX_API_KEY>
wix-site-id: <WIX_SITE_ID>
```

Never send `wix-account-id` together with `wix-site-id` → "No Metasite Context" error (API can't disambiguate). Account-level APIs (e.g. site-list) get `wix-account-id`; everything site-level gets `wix-site-id`.

## STEP 0 — detect catalog version (V1 vs V3)

```bash
curl -s "https://www.wixapis.com/stores/v3/provision/version" \
  -H "Authorization: $KEY" -H "wix-site-id: $SITE"
# → {"catalogVersion":"V1_CATALOG"}  or  "V3_CATALOG"
```

Classic Editor sites are **V1_CATALOG**. V3 = new sites from Q2 2025 only. **Calling a V3 endpoint on a V1 store → 428 Precondition Failed.** If V1, use only the `stores/v1` + `stores-reader/v1`/`v2` paths below.

## Catalog V1 endpoints

| Verb | URL | Purpose |
|---|---|---|
| `GET` | `https://www.wixapis.com/stores-reader/v1/products/{id}` | single product |
| `POST` | `https://www.wixapis.com/stores-reader/v2/products/query` | query (filter/sort/page) |
| `PATCH` | `https://www.wixapis.com/stores/v1/products/{product.id}` | update product fields |

Query body (find a product, get its id):

```json
{ "query": { "filter": "{\"name\": {\"$contains\": \"Chair\"}}", "paging": { "limit": 10 } } }
```

## PATCH product — partial, send only changed fields

```bash
curl -X PATCH "https://www.wixapis.com/stores/v1/products/$ID" \
  -H "Authorization: $KEY" -H "wix-site-id: $SITE" \
  -H "Content-Type: application/json" -d @body.json
```

```json
{
  "product": {
    "id": "<product_id>",
    "description": "<p>HTML, max 8000 chars</p>",
    "ribbon": "Sale",
    "brand": "BrandName",
    "slug": "my-product-url",
    "seoData": {
      "tags": [
        { "type": "title", "children": "SEO Page Title" },
        { "type": "meta", "props": { "name": "description", "content": "Meta description text" } }
      ]
    }
  }
}
```

- `description` — HTML subset: `p h1–h6 ul ol li br a span strong em u` + inline styles (font/color/text-align). Max 8000 chars.
- `ribbon` — plain string, max 30 chars.
- `brand` — string, 1–50 chars.
- `seoData` — shared Wix `SeoSchema`: `tags[]`, each `type` + `children` (title) or `props` (meta).

## Rich-text render rules (description HTML)

| Want | Use | Avoid |
|---|---|---|
| visible blank line | `<br><br>` inside a `<p>` | `<p>&nbsp;</p>` → renderer collapses to **zero height**, invisible on storefront |
| simple line break between sections | `</p><p>` (adjacent paragraphs = single line break) | relying on `&nbsp;` for spacing |

Need a gap before a new section → close with `<br><br></p>` then open `<p>`.

## Inventory V2 — stock

| Verb | URL | Purpose |
|---|---|---|
| `POST` | `https://www.wixapis.com/stores-reader/v2/inventoryItems/query` | query inventory by `productId` |
| `PATCH` | `https://www.wixapis.com/stores/v2/inventoryItems/product/{inventoryItem.productId}` | update `quantity`, `inStock`, `tracked` |

## Caveat — app-owned discount rules are NOT reliably manageable

Discount rules labelled "Created by `<app name>`" in the Stores dashboard are implicitly bound to that app. `/ecom/v1/discount-rules` exposes no `appId`/`createdBy`, but updating/deleting another app's rule fails (403 or silent no-op). Treat third-party-attributed rules as **read-only**. To manage discounts, create new rules under your own API key and ignore app-owned ones.

## REST anti-patterns

| Wrong | Correct |
|---|---|
| route classic Editor catalog edit to Velo/CLI | REST `stores/v1` PATCH |
| `wix-site-id` + `wix-account-id` on same call | exactly one (site-level → `wix-site-id`) |
| call V3 endpoint without checking version | STEP 0 provision check first (V3 on V1 = 428) |
| `<p>&nbsp;</p>` for blank line | `<br><br>` inside a `<p>` |
| stash API key in `$env:`/`export` between tool-calls | read from local gitignored file each call |
| send full product on PATCH | partial — only the changed fields |

## Quality-gate

After a write PATCH: re-`GET .../v1/products/{id}` and diff the changed fields; render the `description` HTML in a browser to confirm spacing (`<br><br>` visible, no collapsed `&nbsp;`). Confirm 200/204, not 428 (wrong catalog version) or "No Metasite Context" (bad headers).

---

## References

- Project structure: https://dev.wix.com/docs/wix-cli/guides/get-started/project-structure
- About Wix skills: https://dev.wix.com/docs/wix-cli/guides/development/about-wix-skills
- Official plugin (16 skills + MCP): https://claude.com/plugins/wix
- Skills source: https://github.com/wix/skills
- Stores Catalog V1 REST: https://dev.wix.com/docs/rest/business-solutions/stores/catalog/products-v1
- Stores Inventory V2 REST: https://dev.wix.com/docs/rest/business-solutions/stores/catalog/inventory-v2
- API keys & headers: https://dev.wix.com/docs/build-apps/build-your-app/authentication/api-keys

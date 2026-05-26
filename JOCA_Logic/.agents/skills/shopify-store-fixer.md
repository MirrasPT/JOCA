---
name: shopify-store-fixer
description: "Use when implementing fixes to a Shopify store via Admin API (GraphQL). Every write operation requires explicit user approval before execution. Covers products, metafields, pages, navigation, redirects, and theme settings."
compatibility: "Requires Shopify Admin API access (OAuth token or custom app token). GraphQL Admin API 2024-01+."
---

# Shopify Store Fixer

## When to use

- Implementing fixes identified by `shopify-store-audit`
- Bulk-updating products, metafields, or collections via Admin API
- Creating/updating pages, navigation menus, redirects programmatically
- Patching theme settings without direct theme file access

**Every write operation requires explicit user approval before execution.**

## Inputs required

- Admin API token (OAuth or custom app — never hardcode, use env var `SHOPIFY_ADMIN_API_TOKEN`)
- Store domain (`SHOPIFY_STORE_DOMAIN`, e.g. `mystore.myshopify.com`)
- List of fixes to implement (from audit output or user specification)
- Approval from user before each write or batch

## Guardrails

```
Before every write:
1. Show the exact mutation/operation to the user
2. Show which resources will be affected (IDs, count)
3. Wait for explicit confirmation: "yes / proceed / approve"
4. Log the operation after completion
```

Never:
- Batch-delete products or collections without per-item confirmation
- Overwrite theme files without showing the diff first
- Modify billing or payment settings via API

## Core operations

### Read (safe — no approval needed)

```graphql
# Get products
query {
  products(first: 10) {
    edges { node { id title status } }
  }
}
```

```bash
# Execute via CLI
shopify app execute graphql --query products.graphql
```

### Write (requires approval)

Common fix patterns:

**Update product SEO (title + description)**
```graphql
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title seo { title description } }
    userErrors { field message }
  }
}
```

**Add metafield**
```graphql
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key value }
    userErrors { field message }
  }
}
```

**Create redirect**
```graphql
mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
  urlRedirectCreate(urlRedirect: $urlRedirect) {
    urlRedirect { id fromPath toTarget }
    userErrors { field message }
  }
}
```

**Bulk operation (large datasets)**
```graphql
mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
  bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

Check bulk status:
```bash
shopify app bulk status
```

## Approval flow

For each fix batch:
```
FIX PLAN — [description]
Operations: [n] writes
Resources: [list of affected IDs or resource type + count]
Reversible: [yes/no — explain if no]

Approve? [yes/no]
```

Proceed only after explicit "yes".

## Verification

After each write:
- Check `userErrors` in mutation response — abort batch if any error
- Re-query the affected resources to confirm changes
- Log: operation type, resource IDs, timestamp

## Escalation

- For theme file changes: use `shopify-theme` + `shopify theme push`
- For app logic changes: use `shopify-app`
- If bulk operation fails: `shopify app bulk cancel` + investigate error log

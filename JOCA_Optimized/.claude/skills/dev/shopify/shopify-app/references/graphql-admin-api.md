# Shopify GraphQL Admin API

## Fundamentals

- **Always prefer GraphQL** over REST for new work. REST is in maintenance mode.
- API is **cost-based throttled**, not count-based. Each query has a `cost` based on fields requested.
- Endpoint: `https://{shop}.myshopify.com/admin/api/{version}/graphql.json`
- Current stable version: `2025-01` (update quarterly).

## Authentication

```http
POST /admin/api/2025-01/graphql.json
X-Shopify-Access-Token: {token}
Content-Type: application/json
```

## Rate limits

- **Calculated query cost** shown in response under `extensions.cost`.
- Throttle status in `extensions.cost.throttleStatus`.
- Monitor REST header for REST fallback: `X-Shopify-Shop-Api-Call-Limit: 39/40`.
- Best practice: check `throttleStatus.currentlyAvailable` before bulk mutations.

## Patterns

### Products

```graphql
query GetProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id title status
        seo { title description }
        variants(first: 5) {
          edges { node { id price sku } }
        }
      }
    }
  }
}
```

### Cursor-based pagination (required for large datasets)

```graphql
# Page 1
query { products(first: 50) { pageInfo { endCursor hasNextPage } edges { node { id } } } }

# Next page — pass cursor from previous pageInfo.endCursor
query { products(first: 50, after: "cursor_value") { ... } }
```

### Metafields

```graphql
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id namespace key value type }
    userErrors { field message }
  }
}
```

Variables:
```json
{
  "metafields": [{
    "ownerId": "gid://shopify/Product/1234567890",
    "namespace": "custom",
    "key": "care_instructions",
    "type": "single_line_text_field",
    "value": "Machine wash cold"
  }]
}
```

### Bulk operations

Use for datasets > 100 resources:

```graphql
# Start bulk query
mutation {
  bulkOperationRunQuery(query: """
    { products { edges { node { id title } } } }
  """) {
    bulkOperation { id status }
    userErrors { field message }
  }
}

# Poll status
query { currentBulkOperation { id status errorCode url objectCount } }

# When complete: download JSONL from `url`
```

### Error handling

Always check `userErrors` on mutations:
```graphql
mutation { productUpdate(input: $input) {
  product { id }
  userErrors { field message code }  # always check this
}}
```

## Common GIDs

Shopify uses Global IDs:
- Product: `gid://shopify/Product/1234567890`
- Variant: `gid://shopify/ProductVariant/1234567890`
- Order: `gid://shopify/Order/1234567890`
- Customer: `gid://shopify/Customer/1234567890`
- Collection: `gid://shopify/Collection/1234567890`

## Useful introspection

```graphql
# Discover available queries/mutations
query { __schema { queryType { fields { name description } } } }
```

## REST Admin API (legacy — maintenance mode only)

Only use REST for:
- Features not yet available in GraphQL (check API changelog)
- Maintaining existing REST-based integrations

Never start new features on REST.

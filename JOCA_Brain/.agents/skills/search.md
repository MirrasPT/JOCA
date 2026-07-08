---
name: search
description: "Implement full-text search with Meilisearch, Typesense, or Algolia, including faceted filtering, typo tolerance, instant results, and index synchronization. MUST be invoked when the user says: search, meilisearch, typesense, algolia, full-text search, faceted search, instant search, search index. SHOULD also invoke when: search engine, typo tolerance."
triggers: search, meilisearch, typesense, algolia, full-text search, faceted search, instant search, search index, search engine, typo tolerance
---

# Search Engine

## Platform Selection

| Platform | Best for | Hosting |
|----------|----------|---------|
| **Meilisearch** | Fast, typo-tolerant, zero-config — best for most projects | Self-hosted or Meilisearch Cloud |
| **Typesense** | Advanced features: geo-search, joins, analytics built-in | Self-hosted or Typesense Cloud |
| **Algolia** | Best DX, instant search widgets — expensive at scale | Managed only |

**Default:** Meilisearch self-hosted. Algolia if budget allows and widget ecosystem matters.

## Meilisearch Setup

```bash
# Docker
docker run -d -p 7700:7700 \
  -e MEILI_MASTER_KEY=your-master-key \
  getmeili/meilisearch:latest

# Node.js client
npm install meilisearch
```

```ts
import { MeiliSearch } from "meilisearch";

const client = new MeiliSearch({
  host: process.env.MEILI_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILI_MASTER_KEY,
});
```

Environment:
```
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=<secure random key>
MEILI_SEARCH_KEY=<search-only key for client — never expose master key>
```

## Index Configuration

```ts
const index = client.index("products");

// Searchable attributes (explicit, don't index everything)
await index.updateSearchableAttributes([
  "name",        // highest priority
  "description",
  "tags",
  "sku",
]);

// Filterable attributes (define upfront for categories, facets)
await index.updateFilterableAttributes([
  "category",
  "brand",
  "price",
  "in_stock",
  "tags",
]);

// Sortable attributes
await index.updateSortableAttributes(["price", "created_at", "popularity_score"]);

// Custom ranking rules
await index.updateRankingRules([
  "words",
  "typo",
  "proximity",
  "attribute",
  "sort",
  "exactness",
  "popularity_score:desc",  // custom ranking by popularity
]);

// Typo tolerance for short words
await index.updateTypoTolerance({
  enabled: true,
  minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
});
```

## Adding Documents

```ts
// Add/update documents (upsert by primary key)
await index.addDocuments([
  { id: "1", name: "Running Shoes", category: "footwear", price: 89.99, in_stock: true },
  { id: "2", name: "Trail Shoes", category: "footwear", price: 109.99, in_stock: false },
]);

// Wait for indexing task to complete (async operation)
const task = await index.addDocuments(documents);
await client.waitForTask(task.taskUid);
```

## Searching

```ts
// Basic search
const results = await index.search("running shoes");

// With filters and facets
const results = await index.search("shoes", {
  filter: ["category = footwear", "price < 100", "in_stock = true"],
  facets: ["category", "brand"],
  sort: ["price:asc"],
  hitsPerPage: 20,
  page: 1,
  attributesToHighlight: ["name", "description"],
  highlightPreTag: "<mark>",
  highlightPostTag: "</mark>",
});

// results.hits — matched documents
// results.facetDistribution — { category: { footwear: 12, ... } }
// results.totalHits — total count
```

## Index Synchronization

```ts
// Sync on write — after creating/updating a record
async function createProduct(data: ProductInput) {
  const product = await db.product.create({ data });
  // Queue async sync (don't block response)
  await searchQueue.add("sync-product", { id: product.id, operation: "upsert" });
  return product;
}

// Background job handler
searchQueue.process("sync-product", async (job) => {
  const product = await db.product.findUnique({ where: { id: job.data.id } });
  if (!product) {
    await index.deleteDocument(job.data.id.toString());
    return;
  }
  await index.addDocuments([formatForSearch(product)]);
});

// Full reindex — only on schema changes
async function fullReindex() {
  const allProducts = await db.product.findMany();
  const documents = allProducts.map(formatForSearch);
  // Use batches of 1000 to avoid memory issues
  for (let i = 0; i < documents.length; i += 1000) {
    await index.addDocuments(documents.slice(i, i + 1000));
  }
}
```

## Instant Search UI

```ts
// React hook with debounce
import { useState, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";

function useSearch(indexName: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchClient = new MeiliSearch({
    host: process.env.NEXT_PUBLIC_MEILI_HOST!,
    apiKey: process.env.NEXT_PUBLIC_MEILI_SEARCH_KEY!, // search-only key
  });

  const search = useDebouncedCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { hits } = await searchClient.index(indexName).search(q, { limit: 10 });
      setResults(hits);
    } finally {
      setLoading(false);
    }
  }, 250); // 200-300ms debounce

  return { query, setQuery: (q: string) => { setQuery(q); search(q); }, results, loading };
}
```

## Typesense Differences

```ts
import Typesense from "typesense";

const client = new Typesense.Client({
  nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2,
});

// Schema-first — define before adding documents
await client.collections().create({
  name: "products",
  fields: [
    { name: "name", type: "string" },
    { name: "description", type: "string" },
    { name: "price", type: "float", facet: true },
    { name: "category", type: "string", facet: true },
    { name: "location", type: "geopoint" }, // Typesense geo-search support
  ],
  default_sorting_field: "popularity_score",
});
```

## Algolia Quickstart

```ts
import algoliasearch from "algoliasearch";

const client = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!);
const index = client.initIndex("products");

// Configure index settings
await index.setSettings({
  searchableAttributes: ["name", "description", "tags"],
  attributesForFaceting: ["category", "brand", "price"],
  customRanking: ["desc(popularity)"],
});

// Add records
await index.saveObjects(products, { autoGenerateObjectIDIfNotExist: true });
```

For UI, use `instantsearch.js` or `react-instantsearch` for production-ready widgets.

## Avoid

- Database `LIKE` for search — slow, no relevance ranking, no typo tolerance
- Indexing large text blobs without truncation — index summaries or first 500 chars
- Exposing admin API keys to the client — use search-only keys with rate limits
- Full index rebuild on every document change — use partial updates
- Poll intervals under 3s for search-as-you-type — use debounce instead

## Resources

- [Meilisearch Docs](https://docs.meilisearch.com)
- [Typesense Docs](https://typesense.org/docs/)
- [Algolia Docs](https://www.algolia.com/doc/)
- [Meilisearch MCP](https://github.com/meilisearch/meilisearch-mcp)

<!-- Adapted from: https://github.com/YepAPI/skills (search-engine) + https://github.com/meilisearch/meilisearch-mcp -->

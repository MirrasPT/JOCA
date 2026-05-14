---
name: nodejs-backend
description: Node.js and TypeScript backend development with Hono-first API framework. Covers routing, middleware, request validation with Zod, type-safe RPC, error handling, environment configuration, deployment to Cloudflare Workers/Bun/Node.js, and TypeScript best practices. Use when building Node.js APIs, Hono routes, TypeScript backend services, or Express/Fastify alternatives.
triggers: nodejs, node.js, hono, typescript backend, api routes, express alternative, cloudflare workers, bun, middleware, zod validation, request validation, rpc, backend typescript
---

# Node.js / TypeScript Backend (Hono-First)

## Framework Selection

| Framework | Best for | Runtime |
|-----------|----------|---------|
| **Hono** | Lightweight APIs, Cloudflare Workers, multi-runtime, type-safe RPC | Node.js, Bun, Deno, CF Workers, Lambda |
| **Fastify** | High performance Node.js, plugin ecosystem | Node.js |
| **Express** | Legacy, vast ecosystem, most tutorials | Node.js |

**Default choice:** Hono for new APIs — ~10KB, multi-runtime, built-in RPC client.

## Hono Quick Start

```bash
npm create hono@latest my-app
# or: bun create hono my-app
cd my-app && npm install
```

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono();

app.get("/", (c) => c.json({ status: "ok" }));

// Route with Zod validation
app.post("/users",
  zValidator("json", z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
  })),
  async (c) => {
    const data = c.req.valid("json"); // type-safe validated data
    const user = await createUser(data);
    return c.json(user, 201);
  }
);

export default app;
```

## Routing

```ts
import { Hono } from "hono";

const app = new Hono();

// Route grouping
const api = new Hono().basePath("/api");
const users = new Hono();

users.get("/", listUsers);
users.get("/:id", getUser);
users.post("/", createUser);
users.put("/:id", updateUser);
users.delete("/:id", deleteUser);

api.route("/users", users);
app.route("/", api);

// Path params and query
app.get("/search", (c) => {
  const q = c.req.query("q");
  const limit = Number(c.req.query("limit") ?? "20");
  return c.json({ q, limit });
});

app.get("/posts/:postId/comments/:commentId", (c) => {
  const { postId, commentId } = c.req.param();
  return c.json({ postId, commentId });
});
```

## Request Validation

```ts
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// Validate different parts of the request
app.get("/products",
  zValidator("query", z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().max(100).default(20),
    category: z.string().optional(),
  })),
  async (c) => {
    const { page, limit, category } = c.req.valid("query");
    return c.json(await getProducts({ page, limit, category }));
  }
);

app.post("/items",
  zValidator("json", z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    tags: z.array(z.string()).max(10).default([]),
  })),
  async (c) => {
    const item = c.req.valid("json");
    return c.json(await createItem(item), 201);
  }
);

// Never access unvalidated data directly:
// ✗ c.req.json() in a validated handler
// ✓ c.req.valid("json") after zValidator middleware
```

## Middleware

```ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { rateLimiter } from "hono-rate-limiter";

const app = new Hono();

// Built-in middleware
app.use("*", logger());
app.use("/api/*", cors({
  origin: ["https://myapp.com"],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Custom authentication middleware
app.use("/api/*", async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = verifyJWT(token);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  c.set("userId", payload.sub); // store in context
  await next();
});

// Must call await next() to continue the chain
app.use("/api/admin/*", async (c, next) => {
  const userId = c.get("userId");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user?.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  await next();
});
```

## Context Variables (Type-safe)

```ts
// Define context variable types
type Variables = {
  userId: string;
  user: User;
  requestId: string;
};

const app = new Hono<{ Variables: Variables }>();

// Set in middleware
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

// Read in handlers — fully typed
app.get("/me", async (c) => {
  const userId = c.get("userId"); // string — no casting needed
  return c.json({ userId });
});
```

## Error Handling

```ts
import { HTTPException } from "hono/http-exception";

// Throw HTTP exceptions anywhere in handlers/middleware
app.get("/posts/:id", async (c) => {
  const post = await db.post.findUnique({ where: { id: c.req.param("id") } });
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  return c.json(post);
});

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof z.ZodError) {
    return c.json({ error: "Validation failed", details: err.flatten() }, 422);
  }
  // Log unexpected errors
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));
```

## Type-Safe RPC

```ts
// server.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const routes = new Hono()
  .get("/users/:id",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const user = await getUser(c.req.valid("param").id);
      return c.json(user);
    }
  )
  .post("/users",
    zValidator("json", z.object({ name: z.string(), email: z.string().email() })),
    async (c) => {
      const user = await createUser(c.req.valid("json"));
      return c.json(user, 201);
    }
  );

export type AppType = typeof routes;
export default routes;
```

```ts
// client.ts — fully type-safe, no manual types needed
import { hc } from "hono/client";
import type { AppType } from "./server";

const client = hc<AppType>("https://api.example.com");

// Types inferred from server
const user = await client.users[":id"].$get({ param: { id: "123" } });
const data = await user.json();

const newUser = await client.users.$post({ json: { name: "João", email: "joao@example.com" } });
```

## Environment Configuration

```ts
// Hono env() for Cloudflare Workers / Bun / Node.js
app.get("/", (c) => {
  const apiKey = c.env.API_KEY; // typed via Bindings
  return c.text("ok");
});

// For Node.js — use process.env with validation
import { z } from "zod";

const env = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
}).parse(process.env);

export { env };
```

## Deployment Targets

### Cloudflare Workers

```ts
// src/index.ts
import { Hono } from "hono";

const app = new Hono<{ Bindings: { DB: D1Database; KV: KVNamespace } }>();

app.get("/", async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM users").all();
  return c.json(result.results);
});

export default app;
```

```toml
# wrangler.toml
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "<ID>"
```

### Bun

```ts
// index.ts
import { Hono } from "hono";
const app = new Hono();
// ...routes...
export default { port: 3000, fetch: app.fetch };
```

```bash
bun run index.ts
```

### Node.js

```ts
import { serve } from "@hono/node-server";
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`Listening on :${port}`));
```

## TypeScript Best Practices

```ts
// Strict type config
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}

// Use satisfies for config objects
const config = {
  database: { host: "localhost", port: 5432 },
} satisfies Config;

// Prefer unknown over any
function parseData(input: unknown): User {
  const schema = z.object({ id: z.string(), name: z.string() });
  return schema.parse(input);
}

// Use Result type for error handling in business logic
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

## Project Structure

```
src/
├── index.ts          — entry point, Hono app + serve
├── routes/
│   ├── users.ts      — user routes (Hono instance)
│   ├── products.ts
│   └── auth.ts
├── middleware/
│   ├── auth.ts       — JWT verification middleware
│   └── logger.ts
├── services/
│   ├── user.service.ts
│   └── email.service.ts
├── db/
│   ├── client.ts     — database connection
│   └── schema.ts     — Drizzle/Prisma schema
├── lib/
│   ├── env.ts        — validated environment variables
│   └── errors.ts     — custom error classes
└── types/
    └── index.ts      — shared types
```

## Avoid

- `res.send()` / Express-style response — use `c.json()`, `c.text()`, `c.html()`
- Accessing `c.req.json()` in handlers with `zValidator` — use `c.req.valid("json")`
- Forgetting `await next()` in middleware — breaks the chain silently
- Using `any` — use `unknown` and parse with Zod
- Storing WebSocket/shared state in module scope without consideration for multi-instance deployment

## Resources

- [Hono Docs](https://hono.dev)
- [Hono Examples](https://github.com/honojs/examples)
- [Zod Docs](https://zod.dev)
- [Hono Middleware](https://hono.dev/docs/middleware/builtin)

<!-- Adapted from: https://github.com/secondsky/claude-skills (hono-routing/SKILL.md) + general Node.js/TypeScript best practices -->

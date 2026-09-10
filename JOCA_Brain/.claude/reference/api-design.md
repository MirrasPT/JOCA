---
name: rest-api
description: REST API design specialist. RFC 9457 errors, URL conventions, versioning with Sunset headers, pagination, rate limiting, OpenAPI 3.1 specs, ForceJsonResponse middleware. Callable autonomously by laravel-specialist for endpoint design.
triggers: API design, REST API, endpoint, OpenAPI, Swagger, API spec, API versioning, API pagination, API error, rate limit, throttle, CORS, API documentation, api route, api resource, API contract, problem+json, RFC 9457, RFC 7807, API endpoint, design API, define endpoints, API architecture
---

# REST API

REST API design. Resource-oriented URLs, RFC 9457 errors, versioning with Sunset, efficient pagination.

Invoked autonomously by the `laravel-specialist` skill when endpoints must be designed or contracts defined.

---

## URL design -- resources, not verbs

```
GET    /api/v1/team-members          # list
GET    /api/v1/team-members/{id}     # single
POST   /api/v1/team-members          # create
PUT    /api/v1/team-members/{id}     # full replace
PATCH  /api/v1/team-members/{id}     # partial update
DELETE /api/v1/team-members/{id}     # remove

# Nested for relations:
GET    /api/v1/posts/{postId}/comments
POST   /api/v1/posts/{postId}/comments

# Non-CRUD actions -- nouns, not verbs:
POST   /api/v1/orders/{id}/cancellation      # not /cancelOrder
POST   /api/v1/users/{id}/email-verification  # not /verifyEmail
```

**Conventions:** plural, kebab-case, `/v1/` from day 1.

---

## Status codes -- Symfony constants

```php
Response::HTTP_OK                    // 200 GET success
Response::HTTP_CREATED               // 201 POST creates resource
Response::HTTP_ACCEPTED              // 202 async job dispatched
Response::HTTP_NO_CONTENT            // 204 DELETE success
Response::HTTP_BAD_REQUEST           // 400 malformed request
Response::HTTP_UNAUTHORIZED          // 401 not authenticated
Response::HTTP_FORBIDDEN             // 403 authenticated but no permission
Response::HTTP_NOT_FOUND             // 404 resource not found
Response::HTTP_UNPROCESSABLE_ENTITY  // 422 validation failed
Response::HTTP_TOO_MANY_REQUESTS     // 429 rate limit
Response::HTTP_INTERNAL_SERVER_ERROR // 500 unexpected error
```

Never use bare integers (422). Always `Response::HTTP_*`.

---

## Errors -- RFC 9457 Problem Details

```json
{
    "type":   "https://api.example.com/problems/validation-error",
    "title":  "Validation Error",
    "status": 422,
    "detail": "The given data was invalid.",
    "errors": {
        "email": ["The email field is required."]
    }
}
```

- Content-Type: `application/problem+json` (not `application/json`)
- `type` is a stable, documented URI
- `detail` is human-readable and actionable
- `errors` for field-level validation

### ForceJsonResponse middleware -- FIRST in the stack
```php
final class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');
        return $next($request);
    }
}
```
Guarantees that exceptions never return HTML on the API.

---

## Versioning -- URL path + Sunset header

```php
// Both versions coexist:
Route::prefix('v1/posts')
    ->middleware(['auth:sanctum', 'throttle:api', 'sunset:2026-12-31'])
    ->group(function (): void { ... });

Route::prefix('v2/posts')
    ->middleware(['auth:sanctum', 'throttle:api'])
    ->group(function (): void { ... });
```

Rules:
- Maximum 2 active versions (current + previous)
- Minimum 6 months of deprecation notice
- Sunset header (RFC 8594) on deprecated routes

---

## Pagination -- always simplePaginate

```php
// simplePaginate(): no COUNT(*), more efficient
$posts = Post::query()->simplePaginate(20);

// Response:
{
    "data": [...],
    "links": {
        "first": "/v1/posts?page=1",
        "prev":  null,
        "next":  "/v1/posts?page=2"
    },
    "meta": {
        "current_page": 1,
        "per_page": 20
    }
}
```

Cursor pagination for large datasets:
```php
$posts = Post::query()->cursorPaginate(20);
```

---

## Filtering and sorting

```
GET /api/v1/products?status=active&sort=-created_at
    # prefix - = descending

GET /api/v1/products?price[gte]=10&price[lte]=100
    # bracket notation for comparisons

GET /api/v1/products?include=category,tags
    # eager loading control
```

---

## Rate limiting

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1718000000
Retry-After: 60       # included in the 429 response
```

Tiers:
- Anonymous: 30/min
- Authenticated: 100/min
- Redis-backed (never in-memory per-process)

---

## Auth -- Bearer token
```
Authorization: Bearer <token>
```
Sanctum stateless tokens for APIs. Never session-based for pure APIs.

## CORS
```php
// config/cors.php
'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', '*')),
// In production: list origins explicitly
```

---

## Consuming third-party APIs -- verify the parser against the real response

When writing a client/parser for an external API, **never infer the response format** — make 1 real call and validate the parsing against it BEFORE finalising. `tsc`/build pass with a wrong regex/shape; the bug is invisible to automatic validation and only shows up at runtime (a field always `0`/`null`, ordering silently broken).

Rules:
- **1 real call** (`curl`/`fetch`) → inspect the effective JSON/HTML/text → write the parser against THAT output.
- Validate critical fields against a known value (e.g. confirm that `seeders` is not always `0`, that the emoji/separator in the regex matches the real one).
- With no credential supplied: prefer a no-auth endpoint, or leave `TODO: missing credential` and report — **never invent a key** (see `soul.md` Hard Limits; applies to workflow sub-agents).
- In **workflows with parallel agents** writing API clients: include this verification step in every agent's brief.

---

## Visibility flag (published/draft, active/archived)

Introducing a visibility state on an entity **is not a CRUD change** — it is a contract change on EVERY route that touches the table. The default mistake is filtering the obvious resource and forgetting the side routes that JOIN the same table.

Checklist when adding the flag:
- `grep` for **all** routes/queries referencing the table (not just the resource) and check every `JOIN` — aggregators, featured lists, feeds, sitemaps, search, counters.
- **Test the anonymous side** with a credential-less call: does the unpublished record disappear from the public output?
- Assert by **count**, not by reading code (lived: `/api/featured/:section` kept serving an unpublished project on the homepage; it was only caught because the anonymous featured list went from 6 to 5).

---

## Anti-patterns

| Wrong | Right |
|--------|--------|
| Infer the shape of an external API response | 1 real call + validate the parser against it |
| Invent a missing API key/endpoint | No-auth source or `TODO` + report |
| Verbs in URLs: `/getUser` | Resource-based: `/users/{id}` |
| Bare integers for status | `Response::HTTP_CREATED` |
| Ad-hoc JSON error | RFC 9457 ProblemResponse |
| Breaking changes with no migration | Sunset header + 6 months |
| Inconsistent envelope | `JsonResource::withoutWrapping()` globally |
| Auto-increment IDs in URLs | ULIDs (prevents enumeration) |
| `paginate()` | `simplePaginate()` |
| In-memory rate limiting | Redis or gateway |
| HTML errors on API routes | `ForceJsonResponse` middleware |
| Route group without `throttle:api` | Always include it |
| Visibility flag applied only to the resource | `grep` the table + filter every JOIN + anonymous test by count |

---

## OpenAPI 3.1 -- mandatory spec

Every API must have an OpenAPI spec:
- All endpoints documented
- RFC 9457 error schemas included
- `operationId` on every operation
- Request/response examples
- Validate with: `npx @redocly/cli lint openapi.yaml`

---

## Pre-deploy checklist

- [ ] URLs: plural, kebab-case, no verbs
- [ ] Correct HTTP verbs (PUT = full replace, PATCH = partial)
- [ ] Status codes via Symfony constants
- [ ] RFC 9457 errors with `application/problem+json`
- [ ] `ForceJsonResponse` as the first middleware
- [ ] `throttle:api` on every route group
- [ ] `simplePaginate()` on every list
- [ ] ULIDs on API-exposed models
- [ ] CORS with explicit origins in production
- [ ] `/v1/` prefix from day 1
- [ ] OpenAPI spec validated
- [ ] Auth middleware on protected routes

---

## Quality gate
After implementing rate limiting: "Do you want `tester-ratelimit`?" -- tests threshold, bypass headers, path manipulation, config.

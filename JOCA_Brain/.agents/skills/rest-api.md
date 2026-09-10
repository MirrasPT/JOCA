---
name: rest-api
description: "REST API design specialist. MUST be invoked when the user says: API design, REST API, endpoint, OpenAPI, Swagger, API spec, API versioning, API pagination. SHOULD also invoke when: API error, rate limit, throttle, CORS, API documentation, api route."
triggers: API design, REST API, endpoint, OpenAPI, Swagger, API spec, API versioning, API pagination, API error, rate limit, throttle, CORS, API documentation, api route, api resource, API contract, problem+json, RFC 9457, RFC 7807, API endpoint, define endpoints, API architecture
chain: tester-api, tester-ratelimit
---

# REST API

REST API design. Resource-oriented URLs, RFC 9457 errors, Sunset versioning, efficient pagination.

Auto-invoked by `laravel-specialist` for endpoint design or contract definition.

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
Response::HTTP_ACCEPTED              // 202 job async dispatched
Response::HTTP_NO_CONTENT            // 204 DELETE success
Response::HTTP_BAD_REQUEST           // 400 malformed request
Response::HTTP_UNAUTHORIZED          // 401 not authenticated
Response::HTTP_FORBIDDEN             // 403 authenticated but no permission
Response::HTTP_NOT_FOUND             // 404 resource not found
Response::HTTP_UNPROCESSABLE_ENTITY  // 422 validation failed
Response::HTTP_TOO_MANY_REQUESTS     // 429 rate limit
Response::HTTP_INTERNAL_SERVER_ERROR // 500 unexpected error
```

Never bare integers (422). Always `Response::HTTP_*`.

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
- `type` = stable, documented URI
- `detail` = human-readable, actionable
- `errors` for field-level validation

### ForceJsonResponse middleware -- FIRST in stack
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
Prevents HTML error responses in API routes.

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

- Max 2 active versions (current + previous)
- Min 6 months deprecation notice
- Sunset header (RFC 8594) on deprecated routes

---

## Pagination -- simplePaginate always

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
    # - prefix = descending

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
// In production: make origins explicit
```

---

## Anti-patterns

| Wrong | Right |
|--------|----------|
| Verbs in URLs: `/getUser` | Resource-based: `/users/{id}` |
| Bare integers for status | `Response::HTTP_CREATED` |
| JSON error ad-hoc | RFC 9457 ProblemResponse |
| Breaking changes with no migration | Sunset header + 6 months |
| Inconsistent envelope | `JsonResource::withoutWrapping()` global |
| Auto-increment IDs in URLs | ULIDs (prevents enumeration) |
| `paginate()` | `simplePaginate()` |
| Rate limiting in-memory | Redis or gateway |
| HTML errors in API routes | `ForceJsonResponse` middleware |
| Route group without `throttle:api` | Always include it |

---

## OpenAPI 3.1 -- mandatory spec

Every API needs an OpenAPI spec:
- All endpoints documented
- RFC 9457 error schemas included
- `operationId` on each operation
- Request/response examples
- Validate: `npx @redocly/cli lint openapi.yaml`

---

## Pre-deploy checklist

- [ ] URLs: plural, kebab-case, no verbs
- [ ] Correct HTTP verbs (PUT = full replace, PATCH = partial)
- [ ] Status codes via Symfony constants
- [ ] RFC 9457 errors with `application/problem+json`
- [ ] `ForceJsonResponse` as first middleware
- [ ] `throttle:api` on all route groups
- [ ] `simplePaginate()` on all list endpoints
- [ ] ULIDs on API-exposed models
- [ ] CORS with explicit origins in production
- [ ] `/v1/` prefix from day 1
- [ ] OpenAPI spec validated
- [ ] Auth middleware on protected routes

---

## Quality gate
After implementing rate limiting: "Run `tester-ratelimit`?" -- tests threshold, bypass headers, path manipulation, config.

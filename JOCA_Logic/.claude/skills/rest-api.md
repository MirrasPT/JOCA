---
name: rest-api
description: "REST API design specialist. MUST be invoked when the user says: API design, REST API, endpoint, OpenAPI, Swagger, API spec, API versioning, API pagination. SHOULD also invoke when: API error, rate limit, throttle, CORS, API documentation, api route."
triggers: API design, REST API, endpoint, OpenAPI, Swagger, API spec, API versioning, API pagination, API error, rate limit, throttle, CORS, API documentation, api route, api resource, API contract, problema+json, RFC 9457, RFC 7807, API endpoint, desenhar API, definir endpoints, API architecture
---

# REST API

Design de APIs REST. URLs resource-oriented, RFC 9457 errors, versioning com Sunset, pagination eficiente.

Invocada autonomamente pela skill `laravel-specialist` quando preciso desenhar endpoints ou definir contratos.

---

## URL design -- recursos, nao verbos

```
GET    /api/v1/team-members          # listar
GET    /api/v1/team-members/{id}     # single
POST   /api/v1/team-members          # criar
PUT    /api/v1/team-members/{id}     # full replace
PATCH  /api/v1/team-members/{id}     # partial update
DELETE /api/v1/team-members/{id}     # remover

# Nested para relacoes:
GET    /api/v1/posts/{postId}/comments
POST   /api/v1/posts/{postId}/comments

# Accoes nao-CRUD -- nomes, nao verbos:
POST   /api/v1/orders/{id}/cancellation      # nao /cancelOrder
POST   /api/v1/users/{id}/email-verification  # nao /verifyEmail
```

**Convencoes:** plural, kebab-case, `/v1/` desde o dia 1.

---

## Status codes -- constantes Symfony

```php
Response::HTTP_OK                    // 200 GET sucesso
Response::HTTP_CREATED               // 201 POST cria recurso
Response::HTTP_ACCEPTED              // 202 job async dispatched
Response::HTTP_NO_CONTENT            // 204 DELETE sucesso
Response::HTTP_BAD_REQUEST           // 400 pedido malformado
Response::HTTP_UNAUTHORIZED          // 401 nao autenticado
Response::HTTP_FORBIDDEN             // 403 autenticado mas sem permissao
Response::HTTP_NOT_FOUND             // 404 recurso nao encontrado
Response::HTTP_UNPROCESSABLE_ENTITY  // 422 validacao falhou
Response::HTTP_TOO_MANY_REQUESTS     // 429 rate limit
Response::HTTP_INTERNAL_SERVER_ERROR // 500 erro inesperado
```

Nunca usar inteiros bare (422). Sempre `Response::HTTP_*`.

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

- Content-Type: `application/problem+json` (nao `application/json`)
- `type` e URI estavel e documentada
- `detail` e human-readable e actionable
- `errors` para validacao field-level

### ForceJsonResponse middleware -- PRIMEIRO na stack
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
Garante que exceptions nunca retornam HTML na API.

---

## Versioning -- URL path + Sunset header

```php
// Ambas as versoes coexistem:
Route::prefix('v1/posts')
    ->middleware(['auth:sanctum', 'throttle:api', 'sunset:2026-12-31'])
    ->group(function (): void { ... });

Route::prefix('v2/posts')
    ->middleware(['auth:sanctum', 'throttle:api'])
    ->group(function (): void { ... });
```

Regras:
- Maximo 2 versoes activas (actual + anterior)
- Minimo 6 meses de deprecation notice
- Sunset header (RFC 8594) em rotas deprecated

---

## Pagination -- simplePaginate sempre

```php
// simplePaginate(): sem COUNT(*), mais eficiente
$posts = Post::query()->simplePaginate(20);

// Resposta:
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

Cursor pagination para datasets grandes:
```php
$posts = Post::query()->cursorPaginate(20);
```

---

## Filtering e sorting

```
GET /api/v1/products?status=active&sort=-created_at
    # prefixo - = descendente

GET /api/v1/products?price[gte]=10&price[lte]=100
    # bracket notation para comparacoes

GET /api/v1/products?include=category,tags
    # controlo de eager loading
```

---

## Rate limiting

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1718000000
Retry-After: 60       # incluido na resposta 429
```

Tiers:
- Anonimo: 30/min
- Autenticado: 100/min
- Redis-backed (nunca in-memory per-process)

---

## Auth -- Bearer token
```
Authorization: Bearer <token>
```
Sanctum stateless tokens para APIs. Nunca session-based para APIs puras.

## CORS
```php
// config/cors.php
'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', '*')),
// Em producao: explicitar origens
```

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| Verbos em URLs: `/getUser` | Resource-based: `/users/{id}` |
| Inteiros bare para status | `Response::HTTP_CREATED` |
| JSON error ad-hoc | RFC 9457 ProblemResponse |
| Breaking changes sem migracao | Sunset header + 6 meses |
| Envelope inconsistente | `JsonResource::withoutWrapping()` global |
| IDs auto-increment em URLs | ULIDs (previne enumeration) |
| `paginate()` | `simplePaginate()` |
| Rate limiting in-memory | Redis ou gateway |
| Erros HTML em rotas API | `ForceJsonResponse` middleware |
| Route group sem `throttle:api` | Incluir sempre |

---

## OpenAPI 3.1 -- spec obrigatoria

Cada API deve ter spec OpenAPI:
- Todos os endpoints documentados
- Schemas de erro RFC 9457 incluidos
- `operationId` em cada operacao
- Exemplos de request/response
- Validar com: `npx @redocly/cli lint openapi.yaml`

---

## Checklist pre-deploy

- [ ] URLs: plural, kebab-case, sem verbos
- [ ] HTTP verbs correctos (PUT = full replace, PATCH = partial)
- [ ] Status codes via constantes Symfony
- [ ] RFC 9457 errors com `application/problem+json`
- [ ] `ForceJsonResponse` como primeiro middleware
- [ ] `throttle:api` em todos os route groups
- [ ] `simplePaginate()` em todas as listas
- [ ] ULIDs em modelos API-exposed
- [ ] CORS com origens explicitas em producao
- [ ] `/v1/` prefix desde dia 1
- [ ] OpenAPI spec validada
- [ ] Auth middleware em rotas protegidas

---

## Quality gate
Apos implementar rate limiting: "Queres `tester-ratelimit`?" -- testa threshold, bypass headers, path manipulation, config.

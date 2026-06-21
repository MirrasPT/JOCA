---
name: laravel-react
description: "Connecting a Laravel backend to a React frontend — Inertia vs headless API, Sanctum auth (SPA cookie or token), CORS, API contracts, TypeScript type sharing. MUST be invoked when the user says: laravel react, connect admin to frontend, inertia, sanctum spa, laravel api frontend, headless laravel, laravel cors, share types laravel react. SHOULD also invoke when: filament admin react storefront, api auth react, csrf react, eloquent to typescript, laravel sanctum token."
triggers: laravel react, connect admin to frontend, ligar admin ao frontend, inertia, inertiajs, sanctum spa, sanctum token, laravel api frontend, headless laravel, laravel cors, share types laravel react, filament react, api auth react, csrf react, eloquent to typescript, laravel sanctum, spa authentication, api contract, bearer token laravel, stateful domains
---
# Laravel ↔ React — Integration Specialist

The seam between the Laravel backend (`laravel-specialist`, `filament` admin) and the React frontend (`frontend` cluster: `react-patterns`, `tailwind`, `shadcn`). Owns auth, CORS, the API contract, and type sharing.

Invoked when wiring an admin/backend to a storefront/SPA. Default architecture for "Filament admin + React storefront" = **headless API**.

---

## Decision: Inertia vs Headless API

| Signal | Approach |
|--------|----------|
| One Laravel app, React views, no separate frontend repo, SEO via SSR | **Inertia.js** (monolith — no API layer) |
| Separate React app (Vite/Next), mobile client too, public API, independent deploy | **Headless API + Sanctum** |
| Filament admin + distinct React/Tailwind storefront (e.g. e-commerce) | **Headless API** — Filament manages data, React consumes `/api` |
| Ambiguous | Ask: "one deployable or two?" |

---

## Headless API + Sanctum

### Auth: pick ONE token strategy

| Strategy | When | How |
|----------|------|-----|
| **SPA cookie (stateful)** | React app on a domain you control (same site/subdomain) | `sanctum/csrf-cookie` → session cookie. CSRF-protected, no token storage. |
| **API token (stateless)** | Mobile, third-party, cross-origin, or no shared domain | `createToken()` → `Authorization: Bearer`. Store carefully (never localStorage for sensitive). |

**SPA cookie flow:**
```php
// config/sanctum.php — domains that get the stateful (cookie) guard
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:5173')),
```
```ts
// React — prime CSRF cookie once, then normal requests
await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
await fetch('/api/login', { method: 'POST', credentials: 'include', headers: {
  'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN')),
}, body });
```
Axios: `axios.defaults.withCredentials = true; axios.defaults.withXSRFToken = true;`

**Token flow:**
```php
$token = $user->createToken('spa', ['*'], now()->addDays(30))->plainTextToken;
// Route guard: ->middleware('auth:sanctum')
```
```ts
fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
```

### CORS (config/cors.php)
```php
'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout'],
'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173')),
'supports_credentials' => true,   // REQUIRED for SPA cookie auth
```
Never `allowed_origins = ['*']` with `supports_credentials = true` — browsers reject it and it's insecure. Explicit origins in production.

### API contract (the backend half)
Defer to `rest-api` rule + `laravel-specialist`:
- `JsonResource` responses, `JsonResource::withoutWrapping()` globally consistent.
- RFC 9457 problem+json errors (`ForceJsonResponse` middleware first).
- `simplePaginate()` / `cursorPaginate()` → React reads `data` + `links`/`meta`.
- ULIDs in URLs (no enumeration).
- `throttle:api` on every group.

### TypeScript type sharing (single source of truth)
Don't hand-write TS interfaces that drift from Eloquent:
- **`spatie/laravel-typescript-transformer`** — generate `.ts` types from PHP DTOs/enums/resources.
- Or **OpenAPI spec → `openapi-typescript`** → typed client.
- Or **Scramble** (auto OpenAPI from Laravel) → generate frontend types in CI.

Match the `frontend`/`react-patterns` consumption: typed fetch layer, decimals arrive as **strings** (Eloquent serializes `decimal` as string → `Number(v)` before arithmetic), dates as ISO strings.

---

## Inertia.js (monolith)

```php
return Inertia::render('Products/Index', [
    'products' => ProductResource::collection($products),   // shared as props
]);
```
- Forms: `useForm()` (Inertia React adapter) — CSRF handled automatically.
- Partial reloads: `only: ['products']` to avoid refetching everything.
- SSR: `@inertiajs/server` for SEO-critical pages.
- Auth: standard Laravel session (web guard) — no Sanctum token needed.
- Shared data: `HandleInertiaRequests` middleware `share()` for `auth.user`, flash, etc.

No separate API layer — props ARE the contract. Use Inertia when there's one repo and SSR/SEO matters but you want React DX.

---

## Filament admin + React storefront (e.g. e-commerce)

Common production shape:
```
Filament panel (/admin)  →  manages catalog, orders, content, payments  ──┐
                                                                          ▼
Laravel API (/api/v1/*)  ←  same models, JsonResources, Sanctum  ──→  React/shadcn storefront
```
- Filament writes; the storefront reads (and posts orders) via the API.
- Share Eloquent models + enums between both; expose read DTOs as `JsonResource`.
- Cart/checkout: storefront → `/api` → Actions (`laravel-specialist`) → payment (`payment-integration` agent).
- Auth: storefront customers via Sanctum (separate guard from Filament admin users).
- Keep admin (`FilamentUser` / `canAccessPanel`) and customer auth **separate guards**.

---

## Checklist

- [ ] Architecture chosen explicitly (Inertia vs headless) — not drifted into
- [ ] ONE auth strategy (SPA cookie OR token), documented
- [ ] `supports_credentials: true` + explicit origins (if SPA cookie)
- [ ] `SANCTUM_STATEFUL_DOMAINS` set for SPA
- [ ] API errors are RFC 9457 problem+json (not HTML)
- [ ] TS types generated from backend, not hand-maintained
- [ ] Decimals handled as strings on the React side
- [ ] Admin auth and customer auth use separate guards
- [ ] `throttle:api` on all API groups; CSRF on stateful routes

---

## Related skills

- `laravel-specialist` — backend (controllers, Actions, API resources)
- `rest-api` — API contract standards (RFC 9457, pagination, versioning)
- `auth` — Sanctum, sessions, 2FA depth
- `filament` — the admin panel side
- `frontend` · `react-patterns` · `shadcn` · `tailwind` — the React side that consumes this
- `payment-integration` (agent) — checkout/payments

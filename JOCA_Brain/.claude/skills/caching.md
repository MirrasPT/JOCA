---
name: caching
description: "Implementing caching strategies, Redis, Memcached, HTTP cache headers, CDN caching, or cache invalidation patterns. MUST be invoked when the user says: cache, caching, Redis, redis, Cache::remember, cache invalidation, CDN, Cloudflare cache. SHOULD also invoke when: HTTP cache, Cache-Control, ETag, stale-while-revalidate, responsecache, cache tags."
triggers: cache, caching, Redis, redis, Cache::remember, cache invalidation, CDN, Cloudflare cache, HTTP cache, Cache-Control, ETag, stale-while-revalidate, responsecache, cache tags, cache stampede, thundering herd, TTL, cache warming, config:cache, route:cache, opcache, performance cache, lento, slow, rapido, fast, optimizar, optimize
chain: tester-performance
---
# Caching

4 cache layers for Laravel + Redis + Cloudflare. Auto-invoked by `laravel-specialist`.

---

## Layer 0 -- Artisan Bootstrap Caches

```bash
php artisan optimize   # config + route + view + event cache
```

Run on EVERY deploy. After `config:cache`, `.env` is not read -- `env()` works only inside `config/*.php`.

---

## Layer 1 -- Application Cache (Redis)

### Config
```
CACHE_STORE=redis
REDIS_CLIENT=phpredis
REDIS_DB=0          # default
REDIS_CACHE_DB=1    # cache isolado
REDIS_SESSION_DB=2  # sessions isoladas
```

phpredis required in production (2-3x faster than predis).

### remember() -- cache-aside
```php
$products = Cache::remember('products.featured', now()->addHour(), function () {
    return Product::featured()->with('category', 'media')->get();
});
```

### flexible() -- stale-while-revalidate (Laravel 11+)
```php
// Fresh 30s, stale ate 120s (refresh em background), expira apos 120s
$listings = Cache::flexible('listings.active', [30, 120], function () {
    return Listing::active()->paginate(20);
});
```
Use when 30-120s staleness is acceptable (listings, feeds, dashboards).

### Cache tags -- grouped invalidation
```php
// Guardar com tags
Cache::tags(['products', "category:{$catId}"])
    ->put("product:{$id}", $product, 3600);

// Invalidar por tag (so Redis/Memcached)
Cache::tags(['products'])->flush();         // todos os produtos
Cache::tags(["category:{$catId}"])->flush(); // so uma categoria
```

### rememberForever() + explicit invalidation
```php
Cache::rememberForever('app.settings', fn() => Setting::all()->pluck('value', 'key'));

// No observer: invalidar quando muda
Cache::forget('app.settings');
```

### Null values -- TRAP
```php
// BAD: null nunca e guardado -> query a cada request
Cache::remember('user.404', 3600, fn() => User::find(9999));

// GOOD: sentinel value
Cache::remember('user.404', 3600, fn() => User::find(9999) ?? false);
```

---

## Invalidation

### Strategy 1: Model Observer (recommended)
```php
class ProductObserver
{
    public function updated(Product $product): void
    {
        Cache::forget("product:{$product->id}");
        Cache::tags(['products', "category:{$product->category_id}"])->flush();
    }
}
```

### Strategy 2: Event-driven
```php
class PriceUpdatedListener
{
    public function handle(ProductPriceUpdated $event): void
    {
        Cache::tags(['products', 'checkout.summaries'])->flush();
    }
}
```

### Strategy 3: Version-based (no explicit invalidation)
```php
$version = Cache::increment('products.version');
$products = Cache::remember("products.all.v{$version}", 3600, fn() => Product::all());
```

---

## Stampede Prevention (atomic locks)

```php
function getCachedLeaderboard(): array
{
    if ($cached = Cache::get('leaderboard')) return $cached;

    return Cache::lock('lock:leaderboard', 30)->block(5, function () {
        if ($cached = Cache::get('leaderboard')) return $cached; // re-check
        $result = DB::table('scores')->selectRaw('user_id, SUM(points) as total')
            ->groupBy('user_id')->orderByDesc('total')->limit(100)->get()->toArray();
        Cache::put('leaderboard', $result, 900);
        return $result;
    });
}
```

Lock TTL > worst-case computation time.

---

## Multi-tenant keys

```php
// Pattern: tenant:{id}:resource:{id}:qualifier
Cache::put("tenant:{$tenantId}:user:{$userId}:profile", $profile, 3600);

// Flush per tenant (never Cache::flush() in SaaS!)
Cache::tags(["tenant:{$tenantId}"])->flush();
```

---

## TTL by data type

| Dados | TTL | Strategy |
|-------|-----|----------|
| Stock, saldo, inventario | 0-30s ou sem cache | DB + query optimization |
| Dados por utilizador | 60-300s | `remember()` + private HTTP |
| Feature flags | 300s | `flexible(30, 300)` |
| Catalogo, listagens | 900-3600s | `remember()` + tags |
| Dashboards analytics | 60-300s | `flexible(60, 300)` |
| Categorias, paises | 86400s | `rememberForever()` + observer |
| Settings app | 86400s | `rememberForever()` + forget |

---

## Redis production

```conf
maxmemory 512mb
maxmemory-policy allkeys-lfu   # best para SaaS com hot keys
save ""                         # desactivar RDB para cache puro
```

Monitoring:
```bash
redis-cli info stats | grep -E "keyspace_hits|keyspace_misses"   # hit ratio >90%
redis-cli info memory | grep used_memory_human
redis-cli --bigkeys                                                # memory hogs
```

---

## Layer 2 -- HTTP Caching

### Public API (read-only, same for all)
```php
return response()->json($data)
    ->header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=30');
```

### Authenticated (per-user)
```php
return response()->json($userData)
    ->header('Cache-Control', 'private, no-store');
```

### ETag (conditional requests)
```php
$etag = '"' . md5(json_encode($data)) . '"';
if (request()->header('If-None-Match') === $etag) {
    return response('', 304)->header('ETag', $etag);
}
return response()->json($data)->header('ETag', $etag);
```

### Laravel middleware
```php
Route::get('/products', ProductController::class)
    ->middleware('cache.headers:public;max_age=300;s_maxage=600;etag');
```

### spatie/laravel-responsecache (full response cache)
```bash
composer require spatie/laravel-responsecache
```
Caches the entire HTTP response -- 200ms to 5ms. Public routes without session only.

---

## Layer 3 -- CDN (Cloudflare)

### Cache Rules (Dashboard > Caching > Cache Rules)

**Rule 1 (P1) -- Bypass sensitive:**
```
IF URI contains: /api/auth, /api/user, /admin, /sanctum, /checkout
THEN: Bypass cache
```

**Rule 2 (P2) -- Static assets:**
```
IF extension: jpg, png, css, js, woff2, svg
THEN: Cache, Edge TTL = use origin headers
```

**Rule 3 (P3) -- Public API:**
```
IF URI starts with /api/ (excluindo Rule 1)
THEN: Cache, Edge TTL = 60s
```

### Programmatic purge
```php
// Via yediyuz/laravel-cloudflare-cache
CloudflareCache::purgeByUrls([route('products.index')]);
CloudflareCache::purgeByTags(['products']);

// Directo via API
Http::withToken(config('services.cloudflare.token'))
    ->delete("https://api.cloudflare.com/client/v4/zones/{$zoneId}/purge_cache", [
        'files' => [$url],
    ]);
```

### Cloudflare + Laravel sessions
Laravel adds `Set-Cookie` on every request -> Cloudflare skips caching. Use a stateless middleware group for cacheable routes (no StartSession, no EncryptCookies).

---

## Layer 4 -- Nginx

### Static assets (Vite content-hashed)
```nginx
location ~* \.(js|css|woff|woff2|png|jpg|webp|svg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
}
```

### index.html (React SPA) -- NEVER cache
```nginx
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

## Anti-patterns

| Errado | Problema | Fix |
|--------|----------|-----|
| `Cache::remember` com null | Null nunca e guardado, query a cada request | Sentinel value (`?? false`) |
| TTL uniforme para tudo | Stock stale 1h, settings recalculados a cada request | TTL por volatilidade |
| `rememberForever` sem invalidacao | Dados stale para sempre | Observer/event + forget |
| `Cache::flush()` em SaaS | Limpa TODOS os tenants | Tags + flush scoped |
| Cache sem lock em hot keys | Stampede: N workers recomputing | `Cache::lock()->block()` |
| `public` em respostas autenticadas | CDN serve dados de um user a outro | `private, no-store` |
| `env()` fora de config/*.php | Null apos `config:cache` | Usar `config()` |

---

## Cache warming (post-deploy)
```php
// Artisan command
class WarmCache extends Command
{
    protected $signature = 'cache:warm';

    public function handle(): void
    {
        Cache::tags(['products'])->remember('products.featured', 3600,
            fn() => Product::featured()->get());
        Cache::rememberForever('app.settings',
            fn() => Setting::all()->pluck('value', 'key'));
        $this->info('Cache warmed.');
    }
}
```

Add to deploy: `php artisan cache:warm`

---

## Packages

| Package | Funcao |
|---------|--------|
| `spatie/laravel-responsecache` | Full HTTP response cache (200ms -> 5ms) |
| `yediyuz/laravel-cloudflare-cache` | Purge CDN por URL/tag no model observer |
| `werk365/etagconditionals` | ETag middleware automatico |

---

## Quality gate
After implementing caching: "Queres `tester-performance`?" (Lighthouse + load test to verify impact)

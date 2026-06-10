---
name: saas-patterns
description: "SaaS architecture patterns for Laravel 11+ multi-tenant platforms. MUST be invoked when the user says: multi-tenancy Laravel, tenant isolation, feature flags SaaS, subscription tiers gate, tenant onboarding workflow, queue tenant context."
when_to_use: Activate for any multi-tenant SaaS on Laravel. Covers stancl/tenancy v3/v4, single-DB vs multi-DB vs hybrid, BelongsToTenant global scope, Laravel Pennant feature flags, Cashier subscription tiers, PlanGate helper, tenant-aware Horizon queues, per-tenant audit logs, GDPR export/delete, Pest isolation tests. Complementary to laravel-specialist.
disable-model-invocation: false
allowed-tools: Read WebSearch WebFetch
---

# SaaS Patterns -- Laravel 11+ Multi-Tenant

Target: stancl/tenancy v3 (v4 differences noted). Laravel 11+-first; patterns are framework-adaptable.

---

## 0. Strategy Decision Tree

```
MVP or early SaaS (< 500 tenants)?
├─ YES → Single DB + row-level (tenant_id). Start here always.
│         Upgrade path: add per-tenant DB for enterprise later (~2 sprints).
└─ NO → Enterprise/compliance required?
         ├─ YES → Multi-DB via stancl/tenancy automatic mode
         └─ NO → Hybrid: shared DB default, dedicated DB on-request for whales
```

Skip multi-DB unless compliance demands it on day one.

---

## 1. stancl/tenancy Setup

```bash
composer require stancl/tenancy
php artisan tenancy:install
php artisan migrate
```

### Tenant Model
```php
// app/Models/Tenant.php
class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    public static function getCustomColumns(): array
    {
        return ['id', 'plan', 'trial_ends_at', 'settings'];
    }
}
```

### Two Modes
- **Automatic** (recommended): add `InitializeTenancyByDomain` (or Subdomain) middleware to tenant routes. Package switches DB connection, cache prefix, filesystem disk, and queue tenant-id automatically.
- **Manual**: call `tenancy()->initialize($tenant)` + `tenancy()->end()` in `finally`. Use for CLI commands, scheduled tasks, or jobs from central context.

### Bootstrappers (config/tenancy.php)
```php
'bootstrappers' => [
    Bootstrappers\DatabaseTenancyBootstrapper::class,   // DB connection switch
    Bootstrappers\CacheTenancyBootstrapper::class,       // cache prefix
    Bootstrappers\FilesystemTenancyBootstrapper::class,  // storage disk
    Bootstrappers\QueueTenancyBootstrapper::class,       // carry tenant in queued jobs
],
```

### Tenant Routes
```php
// routes/tenant.php
Route::middleware([
    'web',
    InitializeTenancyBySubdomain::class,        // empresa.app.com
    PreventAccessFromCentralDomains::class,
])->group(function () {
    // all tenant routes
});
```

Set `tenancy.central_domains` in `config/tenancy.php` to block central domain resolving as tenant.

---

## 2. Tenant Identification Strategies

| Strategy | Middleware | Use case |
|---|---|---|
| Subdomain | `InitializeTenancyBySubdomain` | empresa.app.com |
| Full domain | `InitializeTenancyByDomain` | empresa.com (custom domains) |
| Path | `InitializeTenancyByPath` | app.com/empresa (no DNS needed) |
| Request data | `InitializeTenancyByRequestData` | API, header `X-Tenant-ID` |

If tenant not found: `InitializeTenancyByDomain` throws `TenantCouldNotBeIdentifiedException`. Catch in `Handler.php`, return 404 with "tenant not found" page -- not 500.

---

## 3. Tenant Isolation

### Single-DB: BelongsToTenant Trait
```php
// app/Models/Concerns/BelongsToTenant.php
trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $query) {
            if (tenancy()->initialized) {
                $query->where('tenant_id', tenant('id'));
            }
        });

        static::creating(function (Model $model) {
            if (! tenancy()->initialized) {
                throw new \RuntimeException('Attempted to create '.static::class.' outside tenant context.');
            }
            $model->tenant_id ??= tenant('id');
        });
    }
}
```

Apply to every tenant-scoped model. Throw on missing `tenant_id` -- never silently default.

### Data Leak Prevention Checklist
- [ ] Every tenant model uses `BelongsToTenant` trait
- [ ] No raw `DB::table()` calls in tenant context (use Eloquent or add manual `->where('tenant_id', tenant('id'))`)
- [ ] `withoutGlobalScopes()` only in central/admin context -- guard with `abort_if(! auth()->user()->isSuperAdmin(), 403)`
- [ ] Tenant ID never exposed as integer in public URLs -- use UUID or slug
- [ ] Cross-tenant isolation test runs in CI (see S9)

### Multi-DB: stancl/tenancy handles isolation
With `DatabaseTenancyBootstrapper`, DB connection switches on tenancy init. No manual `tenant_id` scoping needed -- each tenant has own schema.

---

## 4. Tenant Onboarding Workflow

### Async provisioning (always async -- never block registration)
```php
// app/Jobs/OnboardTenant.php
class OnboardTenant implements ShouldQueue
{
    public function __construct(public readonly string $tenantId) {}

    public function handle(): void
    {
        $tenant = Tenant::find($this->tenantId);

        if (! $tenant) {
            $this->fail(new \RuntimeException("Tenant {$this->tenantId} not found — cannot onboard."));
            return;
        }

        tenancy()->initialize($tenant);

        try {
            // 1. Create DB (multi-DB mode only)
            // $tenant->createDatabase(); // uncomment for multi-DB

            // 2. Run tenant migrations
            Artisan::call('tenants:migrate', ['--tenants' => [$tenant->id]]);

            // 3. Seed default data
            Artisan::call('tenants:seed', [
                '--tenants' => [$tenant->id],
                '--class'   => TenantDefaultSeeder::class,
            ]);

            // 4. Create subdomain
            $tenant->domains()->create(['domain' => "{$tenant->slug}.app.com"]);

            // 5. Set trial
            $tenant->update(['plan' => 'trial', 'trial_ends_at' => now()->addDays(14)]);

        } finally {
            tenancy()->end(); // always — even if an exception is thrown
        }
    }
}
```

Dispatch from `TenantCreated` listener: `OnboardTenant::dispatch($tenant->id)`.

---

## 5. Feature Flags -- Laravel Pennant

```bash
composer require laravel/pennant
php artisan vendor:publish --provider="Laravel\Pennant\PennantServiceProvider"
php artisan migrate
```

### Define flags tied to plan
```php
// app/Providers/AppServiceProvider.php — inside boot()
Feature::define('advanced-analytics', fn (User $user) =>
    in_array($user->tenant->plan, ['pro', 'enterprise'])
);

// Tenant-scoped flag (e.g. SSO — whole tenant, not per-user)
Feature::define('sso', fn (Tenant $tenant) =>
    $tenant->plan === 'enterprise'
);
```

### Check flags
```php
// Code
if (Feature::active('advanced-analytics')) { ... }

// Explicit scope (tenant-level flag)
Feature::for(tenant())->active('sso') || abort(403, 'SSO requires Enterprise plan.');

// Blade
@feature('custom-branding')
    <x-branding-panel />
@endfeature
```

### External providers (LaunchDarkly / Flagsmith)
Use when: >50 flags, kill switches across distributed systems, or A/B testing needed.
Wrap in a contract so Pennant can be swapped without changing call sites.

```php
interface FeatureFlags
{
    public function isEnabled(string $flag, ?User $user = null): bool;
}

// Bind in AppServiceProvider: $this->app->bind(FeatureFlags::class, LaunchDarklyFlags::class);
```

---

## 6. Subscription Tiers + Permission Gates

### Plan-to-Feature map (single source of truth)
```php
// config/plans.php
return [
    'trial'      => ['users' => 5,   'features' => ['basic']],
    'starter'    => ['users' => 25,  'features' => ['basic', 'exports']],
    'pro'        => ['users' => 100, 'features' => ['basic', 'exports', 'analytics', 'api']],
    'enterprise' => ['users' => -1,  'features' => ['*']],
];
```

```php
// app/Support/PlanGate.php
class PlanGate
{
    public static function can(string $feature): bool
    {
        if (! tenancy()->initialized) {
            return false; // central context — deny by default
        }
        $features = config('plans.'.tenant('plan').'.features', []);
        return in_array($feature, $features) || in_array('*', $features);
    }

    public static function userLimit(): int
    {
        return config('plans.'.tenant('plan').'.users', 5);
    }
}
```

### Policy gate
```php
class FeaturePolicy
{
    public function accessAnalytics(User $user): bool
    {
        return PlanGate::can('analytics') && ! $user->tenant->isExpired();
    }
}

// Controller
$this->authorize('accessAnalytics'); // throws 403 automatically
```

### Cashier (Stripe billing)
```php
// Tenant model
class Tenant extends BaseTenant implements Billable { use Billable; }

// Checks
$tenant->subscribed()         // has active subscription
$tenant->onPlan('pro')        // on specific Stripe price
$tenant->onTrial()            // in trial period
$tenant->subscription()->cancel(); // cancel at period end
```

---

## 7. Background Jobs with Tenant Context

### Automatic (QueueTenancyBootstrapper active)
Jobs dispatched within initialized tenant context carry tenant_id automatically. No extra code -- bootstrapper serializes and restores context.

### Manual context (central-dispatched or CLI)
```php
class ProcessTenantReport implements ShouldQueue
{
    public function __construct(
        public readonly string $tenantId,  // scalar only — never Eloquent model
        public readonly int $reportId,
    ) {}

    public function handle(): void
    {
        $tenant = Tenant::find($this->tenantId);

        if (! $tenant) {
            $this->fail(new \RuntimeException("Tenant {$this->tenantId} not found."));
            return;
        }

        tenancy()->initialize($tenant);

        try {
            Report::find($this->reportId)?->process(); // scoped to tenant DB
        } finally {
            tenancy()->end();
        }
    }
}
```

### Queue isolation rules
- Dedicated central connection in `config/queue.php`: `'connection' => 'central'`
- Never mix central + tenant jobs on same queue connection (global state leaks)
- Redis queue: exclude queue's Redis connection from `tenancy.redis.prefixed_connections`
- Central jobs: `dispatch(new CentralJob())->onConnection('central')`

### Horizon (separate supervisors)
```php
// config/horizon.php
'supervisor-tenant'  => ['connection' => 'redis-tenant',  'queue' => ['tenant-high', 'tenant-default'], 'processes' => 20],
'supervisor-central' => ['connection' => 'redis-central', 'queue' => ['central'],                       'processes' => 5],
```

---

## 8. SaaS Security

### Audit logging (per-tenant, tenant-scoped)
```php
// AuditLog model uses BelongsToTenant — tenant_id auto-set
AuditLog::create([
    'action'  => $request->method().' '.$request->path(),
    'user_id' => auth()->id(),
    'ip'      => $request->ip(),
    'payload' => $request->except(['password', 'password_confirmation', 'token']),
]);
```

Register as middleware on all tenant write routes (POST/PUT/PATCH/DELETE).

### GDPR per-tenant
```php
// Export all data for a user (runs within tenant context)
class GdprExportAction
{
    public function execute(User $user): array
    {
        return [
            'profile'  => $user->toArray(),
            'activity' => AuditLog::where('user_id', $user->id)->get()->toArray(),
            'content'  => $user->content()->get()->toArray(),
        ];
    }
}

// Anonymise (irreversible — wrap in DB::transaction)
class GdprDeleteAction
{
    public function execute(User $user): void
    {
        DB::transaction(function () use ($user) {
            $user->update(['name' => 'Deleted User', 'email' => "deleted-{$user->id}@deleted.invalid"]);
            $user->tokens()->delete();
            AuditLog::where('user_id', $user->id)->update(['user_id' => null]);
        });
    }
}
```

### Security rules
- Rate-limit per tenant, not per IP: `Limit::perMinute(60)->by(tenant('id'))`
- Encrypt tenant secrets at rest: `'api_key' => 'encrypted:string'` cast in Eloquent
- Validate every resource in policies: `abort_if($resource->tenant_id !== tenant('id'), 403)`
- Never use `tenant_id` integer in public URLs -- use UUID/slug

---

## 9. Testing Multi-Tenant Code (Pest)

### Test trait
```php
// tests/Concerns/UsesTenant.php
trait UsesTenant
{
    protected Tenant $tenant;

    protected function setUpTenant(?array $state = []): void
    {
        $this->tenant = Tenant::factory()->create($state);
        tenancy()->initialize($this->tenant);
    }
}

// In test file:
beforeEach(fn () => $this->setUpTenant());
afterEach(fn () => tenancy()->end());
```

### Isolation test (required in CI)
```php
it('tenant B cannot read tenant A records', function () {
    $tenantA = Tenant::factory()->create();
    $tenantB = Tenant::factory()->create();

    tenancy()->initialize($tenantA);
    $record = Record::factory()->create(); // tenant_id = tenantA->id
    tenancy()->end();

    tenancy()->initialize($tenantB);
    expect(Record::find($record->id))->toBeNull(); // must be null — different scope
    tenancy()->end();
});
```

### Feature flag test
```php
it('pro tenant has analytics, starter does not', function () {
    $pro     = Tenant::factory()->create(['plan' => 'pro']);
    $starter = Tenant::factory()->create(['plan' => 'starter']);

    tenancy()->initialize($pro);
    $user = User::factory()->create();
    expect(Feature::for($user)->active('advanced-analytics'))->toBeTrue();
    tenancy()->end();

    tenancy()->initialize($starter);
    $user2 = User::factory()->create();
    expect(Feature::for($user2)->active('advanced-analytics'))->toBeFalse();
    tenancy()->end();
});
```

### Tenant Factory
```php
class TenantFactory extends Factory
{
    public function definition(): array
    {
        return ['id' => $this->faker->slug(2), 'plan' => 'starter'];
    }

    public function enterprise(): static { return $this->state(['plan' => 'enterprise']); }
    public function onTrial(): static    { return $this->state(['plan' => 'trial', 'trial_ends_at' => now()->addDays(14)]); }
    public function expired(): static    { return $this->state(['trial_ends_at' => now()->subDay()]); }
}
```

---

## 10. Anti-Patterns

| Anti-pattern | Correct approach |
|---|---|
| Eloquent model in job constructor | Store only scalar IDs (`string $tenantId`) |
| `withoutGlobalScopes()` in tenant code | Central/admin only -- guard with `isSuperAdmin()` |
| Single queue connection for central + tenant | Separate connections; never mix |
| `tenancy()->end()` outside `finally` | Always `try { ... } finally { tenancy()->end(); }` |
| `Tenant::find()` result not null-checked | `$this->fail(...)` on null -- don't proceed |
| Tenant ID as integer in URLs | UUID or slug for all tenant-owned resources |
| Feature check scattered inline | `PlanGate::can()` or Policy -- one place |
| Sync tenant DB provisioning on creation | Always async via `OnboardTenant` job |
| Raw `DB::table()` without tenant filter | Eloquent + `BelongsToTenant` trait |
| Assuming tenancy initialized in PlanGate | Check `tenancy()->initialized` -- return false if not |

---

## References
- stancl/tenancy v3: https://tenancyforlaravel.com/docs/v3/
- Laravel Pennant: https://laravel.com/docs/pennant
- Laravel Cashier: https://laravel.com/docs/cashier
- Spatie multitenancy (alternative): https://spatie.be/docs/laravel-multitenancy/v4/

---

## Workflow

Pipeline sequence:

-> **antes**: `plan` -- arquitectura multi-tenant, single-DB vs multi-DB decision
-> **implementacao**: `laravel-specialist` (Eloquent, queues, auth) in parallel
-> **pos-setup**: `tester-code` -- cross-tenant data isolation
-> **security review**: `tester-security` -- tenant escape, data leakage
-> **auth SaaS**: `auth`

Notify on scaffold complete: `-> proximo: laravel-specialist`

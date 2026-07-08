Parte da skill `saas-patterns` — carregado on-demand via `Read(".claude/reference/saas-patterns/onboarding-flags-billing.md")`. Cobre §4-6: onboarding assíncrono, Laravel Pennant e tiers/billing.

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

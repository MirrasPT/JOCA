Parte da skill `saas-patterns` — carregado on-demand via `Read(".claude/reference/saas-patterns/tenancy-setup.md")`. Cobre §1-3: setup stancl/tenancy, identificação de tenant e isolamento.

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

Parte da skill `saas-patterns` — carregado on-demand via `Read(".claude/reference/saas-patterns/tenant-queues-security.md")`. Cobre §7-8: jobs com contexto de tenant e segurança SaaS.

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

Parte da skill `saas-patterns` — carregado on-demand via `Read(".claude/reference/saas-patterns/testing.md")`. Cobre §9: testes multi-tenant com Pest.

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

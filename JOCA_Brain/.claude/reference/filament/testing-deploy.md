> Parte da skill `filament` — carregado on-demand via Read().

## Testing (Pest + Livewire)

```php
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    actingAs($this->user);
});

it('can list products', function () {
    $products = Product::factory()->count(5)->create();
    livewire(ListProducts::class)
        ->assertCanSeeTableRecords($products);
});

it('can create a product', function () {
    livewire(CreateProduct::class)
        ->fillForm(['name' => 'Widget', 'price' => 9.99])
        ->call('create')
        ->assertHasNoFormErrors()
        ->assertNotified();
    expect(Product::where('name', 'Widget')->exists())->toBeTrue();
});
```

---

## Deploy
```bash
php artisan optimize
php artisan filament:optimize   # SO PRODUCAO -- quebra dev local
```

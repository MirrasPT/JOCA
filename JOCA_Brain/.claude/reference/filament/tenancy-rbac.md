> Parte da skill `filament` — carregado on-demand via Read().

## Multi-tenancy -- CRITICAL

Form selects are NOT auto-scoped. Manual scoping required:

```php
Select::make('team_id')
    ->relationship('team', 'name')
    ->modifyQueryUsing(fn (Builder $query) =>
        $query->where('id', Filament::getTenant()->id))
    ->searchable()
    ->preload()

// Validacao tenant-aware:
->scopedUnique()    // NAO ->unique()
->scopedExists()    // NAO ->exists()
```

Without this = **data leak between tenants**.

---

## RBAC / Filament Shield

`shield:install` does **not** migrate the spatie permissions table. Run the steps in this order or `shield:generate` fails with *"Table 'permissions' doesn't exist"*:

```bash
php artisan shield:install <panel>
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate
php artisan shield:generate --all
php artisan shield:super-admin --user=1
```

`shield:generate` creates one Policy per resource (`$user->can('ViewAny:X')`). Under `RefreshDatabase` the DB has no permissions, so every Filament test 403s. Add a super_admin bypass in `AppServiceProvider::boot()` — more robust than seeded permissions (which `RefreshDatabase` wipes) and how the real admin gets full access:

```php
use Illuminate\Support\Facades\Gate;

Gate::before(fn ($user, $ability) =>
    method_exists($user, 'hasRole') && $user->hasRole('super_admin') ? true : null);
```

TestCase helper — `findOrCreate` the role and assign it to the acting user:

```php
protected function superAdmin(): User
{
    $role = \Spatie\Permission\Models\Role::findOrCreate('super_admin');
    $user = User::factory()->create();
    $user->assignRole($role);
    return $user;
}
```

# Delta — Laravel 13 + Livewire 4 + Flux UI (+ Filament v5)

Versions verified August 2026: Laravel 13.26.1 · Livewire 4.4.1 · Flux UI 2.17.0 ·
Filament 5.7.6 · Pest 5.1.1.

This is `execute-project`'s **default** route — Part E1 of the skill already describes this stack.
Only the extras go here.

## Filament v5

```bash
composer require filament/filament:"^5.0" -W
php artisan filament:install --panels
php artisan make:filament-user
```

**Creating the user is not optional.** A DB with 0 users returns `/admin/login → 200` all the same —
the door is there, the key is missing. Documentation has already announced, for months, an admin that
did not exist. Check by **effect**: actually log in, not just look at the form.

Runtime gate for the panel: submit the login **and** confirm that `window.Livewire` initializes.
Rendering the form is not evidence. Post-deploy, check the `content-type` of the JS assets served.

## Flux UI

Flux is **Blade only** — it does not render in standalone HTML. Mockups approximate it with
HTML+Tailwind and mark the real component in a comment (`<!-- flux:button variant=primary -->`).
Without those marks, whoever implements it rebuilds the decision from the looks.

The paid version (Flux Pro) has components the free one does not — confirm which one is licensed
before listing it in `docs/DESIGN.md` as available.

## Pitfalls

- **`--phpunit` on `laravel new`** is mandatory even when you are going to use Pest (otherwise it
  installs Pest 4 and the upgrade conflicts).
- **`php -d memory_limit=1G`** if the suite grows — Larastan and the suite blow past the default.
- **SQLite in dev, MySQL in production** is the most expensive pitfall: `VARCHAR`, strict mode and
  date types only fail at deploy. Run migrations+seeders against the production engine before publishing.

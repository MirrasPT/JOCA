---
name: filament-shield-testing
description: Filament Shield (RBAC) — migration do spatie em falta + como manter testes verdes com policies geradas
metadata:
  type: feedback
---

Ao instalar **Filament Shield** num projecto Filament v5 (RBAC), dois passos que faltam/partem:

**1. `shield:install` NÃO migra a tabela de permissões.** Depois de `php artisan shield:install <panel>`, `shield:generate` falha com *"Table 'permissions' doesn't exist"*. É preciso publicar+migrar a migration do spatie primeiro:
`php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider" && php artisan migrate`.
Sequência correcta: shield:install → publish spatie → migrate → `shield:generate --all` → `shield:super-admin --user=1`.

**2. As policies geradas partem TODOS os testes Filament (403).** `shield:generate` cria uma Policy por resource que verifica `$user->can('ViewAny:X')`. Em testes com `RefreshDatabase`, a BD não tem permissões nem o super_admin com elas → `Livewire::test(ListX)->assertOk()` dá 403.
**Fix (padrão spatie):** `Gate::before(fn($user,$ability)=> method_exists($user,'hasRole') && $user->hasRole('super_admin') ? true : null)` no `AppServiceProvider::boot()`. O super_admin passa por tudo sem precisar das 181 permissões existirem. Helper no `TestCase`: criar role `super_admin` (findOrCreate) + `assignRole` e usar esse user nos testes de resource.

**Why:** O Gate::before é mais robusto que depender das permissões seedadas (que `RefreshDatabase` apaga). Também é como o renato (admin real) ganha acesso total.

Ver [[bigorna-2026]] e [[filament-v5-gotchas]].

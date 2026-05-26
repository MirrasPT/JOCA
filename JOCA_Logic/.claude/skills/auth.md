---
name: auth
description: "Implementing authentication, login flows, JWT, OAuth, sessions, 2FA, password reset, or security middleware. MUST be invoked when the user says: auth, authentication, login, logout, register, sanctum, token, 2fa. SHOULD also invoke when: mfa, totp, oauth, socialite, social login, google login."
triggers: auth, authentication, login, logout, register, sanctum, token, 2fa, mfa, totp, oauth, socialite, social login, google login, facebook login, role, permission, spatie, policy, gate, authorize, password, session, csrf, guard, middleware auth, api token, access control, RBAC, permissoes, autenticacao, papel, acesso
---
# Auth

Auth completa para Laravel 11+ SaaS. Sanctum + Spatie RBAC + 2FA + Socialite + Policies.

Invocada autonomamente pela skill `laravel-specialist` quando detecta auth work.

---

## Decision tree

| Cenario | Usar |
|---------|------|
| SPA no mesmo dominio (cookie-based) | Sanctum SPA |
| Mobile / API tokens first-party | Sanctum tokens |
| OAuth2 server para third-party | Passport |
| Role/permission checks | Spatie laravel-permission |
| Login via Google, Facebook, GitHub | Socialite |
| Autorizacao por recurso | Policies + Gates |

---

## 1 -- Sanctum

### API token auth
```php
// Emitir com abilities + expiry
$token = $user->createToken('mobile', ['orders:read', 'orders:write'], now()->addDays(30));
return ['token' => $token->plainTextToken]; // devolver uma vez, nunca guardar plain

// Verificar ability
$request->user()->tokenCan('orders:write');

// Revogar
$request->user()->currentAccessToken()->delete(); // token actual
$request->user()->tokens()->delete();              // todos
```

### SPA (cookie-based)
```php
// config/sanctum.php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,127.0.0.1')),
```
- SPA chama `GET /sanctum/csrf-cookie` antes de qualquer POST
- `SESSION_DOMAIN` no `.env` deve corresponder ao dominio SPA
- Cross-domain SPA -> usar API tokens, nao cookies

**Regras:**
- Nunca guardar `plainTextToken` -- hash na DB, plain text so para o client
- Definir `expiration` em `config/sanctum.php` -- `null` = nunca expira (inseguro)
- Abilities minimas por token

---

## 2 -- Spatie Laravel Permission

### Setup
```bash
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate
```
User model: `use HasRoles;`

### Core patterns
```php
// Seeders
$role = Role::create(['name' => 'editor']);
Permission::create(['name' => 'articles.publish']);
$role->givePermissionTo('articles.publish');
$user->assignRole('editor');

// Checks
$user->hasRole('editor');
$user->hasPermissionTo('articles.publish');
$user->can('articles.publish');
$user->hasAnyRole(['editor', 'admin']);
```

### Middleware (Laravel 11 -- bootstrap/app.php)
```php
$middleware->alias([
    'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
    'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
    'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
]);
```

### Cache -- CRITICO
```bash
php artisan permission:cache-reset  # deploy pipeline obrigatorio
```
Permissoes stale apos deploy = cache nao foi reset.

### Teams (multi-tenant RBAC)
```php
// config/permission.php -> 'teams' => true
app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($user->current_team_id);
$user->unsetRelation('roles')->unsetRelation('permissions'); // ao mudar team
```

---

## 3 -- 2FA / MFA (TOTP)

### Schema
```php
$table->string('two_factor_secret')->nullable();
$table->text('two_factor_recovery_codes')->nullable();
$table->timestamp('two_factor_confirmed_at')->nullable();
```

### Enable flow
```php
$google2fa = app(\PragmaRX\Google2FA\Google2FA::class);
$secret = $google2fa->generateSecretKey();
$user->update(['two_factor_secret' => encrypt($secret)]);
$qrUrl = $google2fa->getQRCodeUrl(config('app.name'), $user->email, $secret);
// Confirmar: user entra primeiro codigo
// Gerar backup codes (mostrar uma vez)
```

### Enforcement middleware
```php
public function handle(Request $request, Closure $next): Response
{
    $user = $request->user();
    if ($user && $user->two_factor_confirmed_at
        && ! $request->session()->get('2fa_verified')
        && ! $this->hasTrustedDevice($user, $request)) {
        return redirect()->route('2fa.challenge');
    }
    return $next($request);
}
```

### Trusted devices
Apos 2FA bem-sucedido: guardar fingerprint (sha256 de userAgent+IP) em cookie secure+httpOnly por 30 dias.

---

## 4 -- Socialite

### social_accounts table (separada de users)
```php
$table->foreignId('user_id')->constrained()->cascadeOnDelete();
$table->string('provider');     // 'google' | 'facebook'
$table->string('provider_id');
$table->string('token')->nullable();
$table->string('refresh_token')->nullable();
$table->unique(['provider', 'provider_id']);
```

### Callback (account linking)
```php
$socialUser = Socialite::driver($provider)->user();
// 1. Social account existe -> login
// 2. Email ja registado -> ligar social account
// 3. Novo -> criar user + social account
```

**Regras:**
- `password = null` para social-only users
- Validar `$provider` contra allowlist
- Validar `email` non-null (alguns providers nao devolvem)

---

## 5 -- Policies + Gates

### Policies (preferir para CRUD de modelos)
```php
public function update(User $user, Article $article): bool
{
    return $user->id === $article->user_id
        || $user->hasPermissionTo('articles.edit-any');
}
```

### Gates (accoes nao-resource)
```php
Gate::define('access-admin', fn(User $user) => $user->hasRole('admin'));
Gate::before(fn(User $user) => $user->hasRole('super-admin') ? true : null);
```

### Usar em controllers/FormRequests
```php
// Controller
$this->authorize('update', $article);

// FormRequest (preferir)
public function authorize(): bool
{
    return $this->user()->can('update', $this->route('article'));
}
```

---

## 6 -- Security Hardening

### Passwords
```php
// AppServiceProvider::boot()
Password::defaults(fn () => Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised());
```

### Rate limiting login
```php
RateLimiter::for('login', function (Request $request) {
    $key = Str::transliterate(Str::lower($request->input('email')) . '|' . $request->ip());
    return Limit::perMinute(5)->by($key);
});
```

### Sessions
```php
$request->session()->regenerate();  // no login (previne session fixation)
// config/session.php: http_only=true, secure=true, same_site=lax, lifetime=120
// No logout: invalidate() + regenerateToken()
```

---

## OWASP Security Checklist

Aplicar automaticamente em qualquer code review de auth:

### Input
- [ ] Input validado server-side
- [ ] Queries parametrizadas (nunca concatenacao)
- [ ] Limites de tamanho enforced
- [ ] Allowlist > denylist

### Auth & Sessions
- [ ] Passwords com Argon2/bcrypt (nunca MD5/SHA1)
- [ ] Session tokens com 128+ bits entropy
- [ ] Sessions invalidadas no logout
- [ ] MFA disponivel para operacoes sensiveis

### Access Control
- [ ] Deny by default
- [ ] Autorizacao verificada em cada request
- [ ] Object references nao manipulaveis pelo user
- [ ] Privilege escalation paths revistos

### Data
- [ ] Dados sensiveis encriptados at rest
- [ ] TLS para dados em transito
- [ ] Sem dados sensiveis em URLs/logs

---

## Common pitfalls

| Problema | Fix |
|----------|-----|
| `unauthenticated` com token valido | Guard mismatch -- rota deve usar `auth:sanctum` |
| Spatie permissions stale | `permission:cache-reset` no deploy |
| Teams permissions bleed | `setPermissionsTeamId()` + `unsetRelation` por request |
| Social `email` null | Validar antes de `User::firstWhere` |
| CSRF 419 em SPA | SPA deve chamar `/sanctum/csrf-cookie`; verificar `SESSION_DOMAIN` |
| 2FA redirect loop | Excluir `2fa.challenge` do middleware |
| `remember me` bypassa 2FA | Re-prompt 2FA em restore via remember cookie |
| Sanctum token nunca expira | Definir `sanctum.expiration` em config |

---

## Testing

```php
// Sanctum com abilities
Sanctum::actingAs($user, ['orders:read']);
$this->getJson('/api/orders')->assertOk();

// Spatie permissions
beforeEach(function () {
    app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    $this->editor = User::factory()->create();
    $this->editor->assignRole(Role::create(['name' => 'editor']));
});

// Policy boundary
it('blocks non-owner from updating', function () {
    [$owner, $other] = User::factory()->count(2)->create();
    $article = Article::factory()->for($owner)->create();
    $this->actingAs($other)
        ->patchJson("/api/articles/{$article->id}", ['title' => 'Hack'])
        ->assertForbidden();
});
```

---

## Quality gate
Apos implementar auth: "Queres `tester-security`?" + "Queres `tester-ratelimit`?" (testa brute force em login/register/password reset)

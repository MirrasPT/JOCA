---
name: auth
description: "Implementing authentication, login flows, JWT, OAuth, sessions, 2FA, password reset, or security middleware. MUST be invoked when the user says: auth, authentication, login, logout, register, sanctum, token, 2fa. SHOULD also invoke when: mfa, totp, oauth, socialite, social login, google login."
triggers: auth, authentication, login, logout, register, sanctum, token, 2fa, mfa, totp, oauth, socialite, social login, google login, facebook login, role, permission, spatie, policy, gate, authorize, password, session, csrf, guard, middleware auth, api token, access control, RBAC, permissoes, autenticacao, papel, acesso
---
# Auth

Full auth for Laravel 11+ SaaS. Sanctum + Spatie RBAC + 2FA + Socialite + Policies.

Auto-invoked by `laravel-specialist` when auth work detected.

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
- SPA calls `GET /sanctum/csrf-cookie` before any POST
- `SESSION_DOMAIN` in `.env` must match the SPA domain
- Cross-domain SPA -> use API tokens, not cookies

**Rules:**
- Never store `plainTextToken` -- hash in DB, plain text only for client
- Set `expiration` in `config/sanctum.php` -- `null` = never expires (insecure)
- Minimal abilities per token

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

### Middleware (Laravel 11+ -- bootstrap/app.php)
```php
$middleware->alias([
    'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
    'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
    'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
]);
```

### Cache -- CRITICAL
```bash
php artisan permission:cache-reset  # mandatory in deploy pipeline
```
Stale permissions after deploy = cache not reset.

### Teams (multi-tenant RBAC)
```php
// config/permission.php -> 'teams' => true
app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($user->current_team_id);
$user->unsetRelation('roles')->unsetRelation('permissions'); // when switching team
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
// Confirm: user enters first code
// Generate backup codes (show once)
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
After successful 2FA: store fingerprint (sha256 of userAgent+IP) in secure+httpOnly cookie for 30 days.

---

## 4 -- Socialite

### social_accounts table (separate from users)
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
// 1. Social account exists -> login
// 2. Email already registered -> link social account
// 3. New -> create user + social account
```

**Rules:**
- `password = null` for social-only users
- Validate `$provider` against allowlist
- Validate `email` non-null (some providers omit it)

---

## 5 -- Policies + Gates

### Policies (prefer for model CRUD)
```php
public function update(User $user, Article $article): bool
{
    return $user->id === $article->user_id
        || $user->hasPermissionTo('articles.edit-any');
}
```

### Gates (non-resource actions)
```php
Gate::define('access-admin', fn(User $user) => $user->hasRole('admin'));
Gate::before(fn(User $user) => $user->hasRole('super-admin') ? true : null);
```

### Usage in controllers/FormRequests
```php
// Controller
$this->authorize('update', $article);

// FormRequest (prefer)
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
$request->session()->regenerate();  // on login (prevents session fixation)
// config/session.php: http_only=true, secure=true, same_site=lax, lifetime=120
// On logout: invalidate() + regenerateToken()
```

---

## OWASP Security Checklist

Apply in any auth code review:

### Input
- [ ] Server-side input validation
- [ ] Parameterized queries (never concatenation)
- [ ] Size limits enforced
- [ ] Allowlist > denylist

### Auth & Sessions
- [ ] Passwords with Argon2/bcrypt (never MD5/SHA1)
- [ ] Session tokens with 128+ bits entropy
- [ ] Sessions invalidated on logout
- [ ] MFA available for sensitive operations

### Access Control
- [ ] Deny by default
- [ ] Authorization checked per request
- [ ] Object references not user-manipulable
- [ ] Privilege escalation paths reviewed

### Data
- [ ] Sensitive data encrypted at rest
- [ ] TLS for data in transit
- [ ] No sensitive data in URLs/logs

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
| `remember me` bypasses 2FA | Re-prompt 2FA on restore via remember cookie |
| Sanctum token never expires | Set `sanctum.expiration` in config |

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
After implementing auth: "Queres `tester-security`?" + "Queres `tester-ratelimit`?" (tests brute force on login/register/password reset)

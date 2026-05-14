---
name: auth-laravel
description: Authentication and authorization for Laravel 11+ SaaS. Use when implementing Sanctum API tokens or SPA cookie auth, Passport OAuth2 server (authorization code, PKCE, client credentials), Spatie RBAC roles and permissions, 2FA/MFA with TOTP, social login with Socialite (Google, GitHub, Facebook), Laravel Policies and Gates, password security, or auth testing. Trigger phrases: "set up auth", "add roles permissions", "implement 2FA", "social login Google GitHub", "Sanctum token abilities", "Passport PKCE", "hasPermissionTo", "actingAs in tests", "authorize in controller", "rate limit login".
when_to_use: Activate for — Sanctum (SPA cookie auth, API tokens, token abilities, expiry), Passport (OAuth2 server, authorization code + PKCE, client credentials, PAT), Spatie laravel-permission (roles, permissions, teams, middleware, Blade directives, permission caching), 2FA/MFA (TOTP setup, backup codes, trusted devices, enforcement middleware), Socialite (account linking, first-login, provider callback), password security (Password rule object, breach check, throttling, session fixation), Policies/Gates (resource authorization, @can, authorize()), or auth testing (Sanctum::actingAs, permission factories).
disable-model-invocation: false
allowed-tools: Read Write Edit Bash
---

# auth-laravel

Full auth stack for Laravel 11+ SaaS. Covers Sanctum, Passport, Spatie RBAC, 2FA, Socialite, Policies/Gates, and security hardening.

---

## Decision tree

| Scenario | Use |
|---|---|
| SPA on same domain (cookie-based) | Sanctum SPA |
| Mobile / first-party API tokens | Sanctum tokens |
| OAuth2 server for third-party clients | Passport |
| Role/permission checks | Spatie laravel-permission |
| Third-party login (Google, GitHub) | Socialite |
| Per-resource authorization | Policies + Gates |

---

## 1 — Sanctum

### Install
```bash
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```

### API token auth
```php
// Issue with abilities + expiry
$token = $user->createToken('mobile', ['orders:read', 'orders:write'], now()->addDays(30));
return ['token' => $token->plainTextToken]; // return once, never store hash

// Check ability
$request->user()->tokenCan('orders:write'); // bool

// Revoke current token
$request->user()->currentAccessToken()->delete();
// Revoke all tokens
$request->user()->tokens()->delete();
```

**Rules:**
- Never store `plainTextToken` — hash is in DB, plain text is for the client only.
- Set `expiration` in `config/sanctum.php` (minutes). `null` = never expires — set a value in production.
- Assign minimum required abilities per token.

### SPA (cookie-based)
```php
// config/sanctum.php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,127.0.0.1')),
```
- SPA must call `GET /sanctum/csrf-cookie` before any POST (seeds XSRF-TOKEN cookie).
- `SESSION_DOMAIN` in `.env` must match the SPA domain.
- Cross-domain SPA → use API tokens, not cookies.
- `EnsureFrontendRequestsAreStateful` is auto-applied in Laravel 11's `sanctum` middleware group.

### Guard conflicts (Sanctum + Passport coexistence)
If both are installed, use separate guards:
```php
// config/auth.php guards
'sanctum' => ['driver' => 'sanctum', 'provider' => 'users'],
'api'     => ['driver' => 'passport', 'provider' => 'users'],

// Route protection
Route::middleware('auth:sanctum')->group(...); // Sanctum routes
Route::middleware('auth:api')->group(...);     // Passport routes
```
User model: use `HasApiTokens` from **only one** package. For coexistence, use `Laravel\Sanctum\HasApiTokens` + Passport's `HasApiTokens` from `Laravel\Passport\HasApiTokens` — the last `use` wins for method resolution; prefer Sanctum's unless Passport token introspection is needed.

---

## 2 — Passport (OAuth2 server)

Use Passport **only** when issuing tokens to third-party applications, implementing a full OAuth2 authorization server, or using the Client Credentials grant (machine-to-machine).

### Install
```bash
composer require laravel/passport
php artisan passport:install --uuids
php artisan migrate
```
Add to `AppServiceProvider::boot()`:
```php
Passport::routes();
Passport::tokensExpireIn(now()->addDays(15));
Passport::refreshTokensExpireIn(now()->addDays(30));
Passport::personalAccessTokensExpireIn(now()->addMonths(6));
```

### Authorization Code + PKCE (SPA/mobile — no client secret)
```
1. Generate: code_verifier (random 43–128 chars), code_challenge = base64url(sha256(verifier))
2. Redirect: /oauth/authorize?response_type=code&client_id=X&code_challenge=Y&code_challenge_method=S256&redirect_uri=Z
3. Exchange: POST /oauth/token { grant_type: authorization_code, code, code_verifier, client_id, redirect_uri }
```
- Never use Implicit grant for new SPAs — PKCE replaces it.
- `Passport::enableImplicitGrant()` only if supporting legacy clients.

### Client Credentials (machine-to-machine)
```php
Route::middleware('client')->get('/stats', StatsController::class);
// Token: POST /oauth/token { grant_type: client_credentials, client_id, client_secret, scope }
```

### Personal Access Tokens
```php
$token = $user->createToken('MyApp', ['place-orders']);
return $token->accessToken; // JWT string — return once
```

---

## 3 — Spatie Laravel Permission

### Install
```bash
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate
```
Add `HasRoles` trait to User model.

### Core patterns
```php
// Setup (typically in seeders)
$role = Role::create(['name' => 'editor']);
Permission::create(['name' => 'articles.publish']);
$role->givePermissionTo('articles.publish');
$user->assignRole('editor');

// Checks
$user->hasRole('editor');                        // role check
$user->hasPermissionTo('articles.publish');      // direct + via roles
$user->can('articles.publish');                  // Gate bridge (use in policies)
$user->hasAnyRole(['editor', 'admin']);
$user->hasAllPermissions(['articles.publish', 'articles.delete']);
```

### Middleware registration (Laravel 11 — bootstrap/app.php)
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
        'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
        'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
    ]);
})
```
```php
Route::middleware(['role:admin'])->group(...);
Route::middleware(['permission:articles.publish'])->group(...);
Route::middleware(['role_or_permission:editor|articles.publish'])->group(...);
```

### Blade directives
```blade
@role('admin') ... @endrole
@can('articles.publish') ... @endcan
@canany(['articles.publish', 'articles.delete']) ... @endcanany
```

### Cache (critical — must manage in deployments)
```bash
php artisan permission:cache-reset  # after seeder runs, or in deploy scripts
```
```php
// In seeders, tests, or after programmatic changes:
app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
```
If permissions appear stale after deployment: cache was not reset — add `permission:cache-reset` to deploy pipeline.

### Teams (multi-tenant RBAC)
```php
// config/permission.php → 'teams' => true

// Per-request: set active team before ANY permission/role check
app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($user->current_team_id);

// CRITICAL when switching teams: unset cached relations
$user->unsetRelation('roles')->unsetRelation('permissions');

// Assign role within a team
setPermissionsTeamId($teamId);
$user->assignRole('editor');
```

---

## 4 — 2FA / MFA (TOTP)

### Packages
```bash
composer require pragmarx/google2fa-laravel bacon/bacon-qr-code pragmarx/recovery
```

### Schema additions (users migration)
```php
$table->string('two_factor_secret')->nullable();
$table->text('two_factor_recovery_codes')->nullable();
$table->timestamp('two_factor_confirmed_at')->nullable();
```

### Enable + confirm flow
```php
// 1. Generate and store secret (encrypted)
$google2fa = app(\PragmaRX\Google2FA\Google2FA::class);
$secret = $google2fa->generateSecretKey();
$user->update(['two_factor_secret' => encrypt($secret)]);

// 2. Return QR URL for bacon-qr-code rendering
$qrUrl = $google2fa->getQRCodeUrl(config('app.name'), $user->email, $secret);

// 3. Confirm: user enters first code to prove app is configured
if (! $google2fa->verifyKey(decrypt($user->two_factor_secret), $request->code)) {
    return back()->withErrors(['code' => 'Invalid code — check your authenticator app.']);
}
$user->update(['two_factor_confirmed_at' => now()]);

// 4. Store backup codes (show once; user stores them)
$codes = \PragmaRX\Recovery\Recovery::generate(8);
$user->update(['two_factor_recovery_codes' => encrypt(json_encode($codes))]);
return response()->json(['recovery_codes' => $codes]); // show once
```

### Enforcement middleware
```php
// App\Http\Middleware\RequiresTwoFactor
public function handle(Request $request, Closure $next): Response
{
    $user = $request->user();
    if ($user
        && $user->two_factor_confirmed_at
        && ! $request->session()->get('2fa_verified')
        && ! $this->hasTrustedDevice($user, $request)
    ) {
        return redirect()->route('2fa.challenge');
    }
    return $next($request);
}

private function hasTrustedDevice(User $user, Request $request): bool
{
    $fingerprint = $request->cookie('trusted_device');
    if (! $fingerprint) return false;
    return $user->trustedDevices()
        ->where('fingerprint', $fingerprint)
        ->where('expires_at', '>', now())
        ->exists();
}
```

### Trusted devices
```php
// After successful 2FA challenge
$fingerprint = hash('sha256', $request->userAgent() . $request->ip());
$user->trustedDevices()->create(['fingerprint' => $fingerprint, 'expires_at' => now()->addDays(30)]);
Cookie::queue('trusted_device', $fingerprint, 60 * 24 * 30, '/', null, true, true); // secure + httpOnly
$request->session()->put('2fa_verified', true);
```

### Backup code redemption
```php
$codes = json_decode(decrypt($user->two_factor_recovery_codes), true);
if (! in_array($request->code, $codes, true)) {
    return back()->withErrors(['code' => 'Invalid recovery code.']);
}
// Invalidate used code
$remaining = array_values(array_filter($codes, fn($c) => $c !== $request->code));
$user->update(['two_factor_recovery_codes' => encrypt(json_encode($remaining))]);
$request->session()->put('2fa_verified', true);
```

---

## 5 — Social Login (Socialite)

### Install
```bash
composer require laravel/socialite
```

### social_accounts table (separate from users — supports multiple providers)
```php
$table->id();
$table->foreignId('user_id')->constrained()->cascadeOnDelete();
$table->string('provider');    // 'google' | 'github' | 'facebook'
$table->string('provider_id');
$table->string('token')->nullable();
$table->string('refresh_token')->nullable();
$table->unique(['provider', 'provider_id']);
```

### Callback controller (account linking pattern)
```php
public function callback(string $provider): RedirectResponse
{
    try {
        $socialUser = Socialite::driver($provider)->user();
    } catch (\Exception $e) {
        return redirect('/login')->withErrors(['provider' => 'Authentication failed. Please try again.']);
    }

    // Guard: some providers don't return email
    if (! $socialUser->getEmail()) {
        return redirect('/login')->withErrors(['provider' => 'No email returned by provider.']);
    }

    // 1. Existing social account → log in
    $account = SocialAccount::firstWhere(['provider' => $provider, 'provider_id' => $socialUser->getId()]);
    if ($account) {
        Auth::login($account->user);
        return redirect('/dashboard');
    }

    // 2. Email already registered → link social account
    $user = User::firstWhere('email', $socialUser->getEmail())
        ?? User::create([
            'name'              => $socialUser->getName() ?? $socialUser->getNickname(),
            'email'             => $socialUser->getEmail(),
            'email_verified_at' => now(),
            'password'          => null, // social-only user
        ]);

    $user->socialAccounts()->create([
        'provider'      => $provider,
        'provider_id'   => $socialUser->getId(),
        'token'         => $socialUser->token,
        'refresh_token' => $socialUser->refreshToken,
    ]);

    Auth::login($user);
    return redirect('/dashboard');
}
```

**Rules:**
- `password = null` for social-only users. In password-change flow: check `auth()->user()->password === null` and show "set password" instead of "change password".
- Encrypt `token`/`refresh_token` if they grant write access to the provider's API.
- Validate `$provider` against an allowlist: `abort_unless(in_array($provider, ['google', 'github', 'facebook']), 404)`.

---

## 6 — Security Hardening

### Password rules
```php
// AppServiceProvider::boot() — applies globally
Password::defaults(fn () => Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised());

// FormRequest
'password' => ['required', 'confirmed', Password::defaults()],
```
`uncompromised()` calls HaveIBeenPwned API — add try/catch or `uncompromised(3)` (allows up to 3 breach appearances) if network is unreliable.

### Rate limiting login (by email + IP)
```php
// AppServiceProvider::boot()
RateLimiter::for('login', function (Request $request) {
    $key = Str::transliterate(Str::lower($request->input('email')) . '|' . $request->ip());
    return Limit::perMinute(5)->by($key);
});

// routes/web.php
Route::post('/login', [LoginController::class, 'authenticate'])->middleware('throttle:login');
```
If 429 returned: respond with `Retry-After` header. Fortify/Breeze handle this automatically.

### Session security
```php
// On login — always regenerate to prevent session fixation
$request->session()->regenerate();

// config/session.php
'http_only' => true,
'secure'    => env('SESSION_SECURE_COOKIE', true),
'same_site' => 'lax',  // 'strict' breaks OAuth callbacks
'lifetime'  => 120,

// On logout — full invalidation
Auth::logout();
$request->session()->invalidate();
$request->session()->regenerateToken(); // rotate CSRF token
```

---

## 7 — Policies + Gates

### Gates (non-resource actions)
```php
// AppServiceProvider::boot()
Gate::define('access-admin', fn(User $user) => $user->hasRole('admin'));
Gate::before(fn(User $user) => $user->hasRole('super-admin') ? true : null); // super-admin bypass

// Usage
Gate::authorize('access-admin');       // throws 403
$user->can('access-admin');            // bool
```

### Policies (resource actions — preferred for model CRUD)
```bash
php artisan make:policy ArticlePolicy --model=Article
```
```php
public function update(User $user, Article $article): bool
{
    return $user->id === $article->user_id
        || $user->hasPermissionTo('articles.edit-any');
}

public function delete(User $user, Article $article): Response
{
    return $article->published_at
        ? Response::deny('Published articles cannot be deleted.')
        : Response::allow();
}
```

### In controllers / FormRequests
```php
// Controller
$this->authorize('update', $article); // throws AuthorizationException → 403

// FormRequest — prefer this for resource controllers
public function authorize(): bool
{
    return $this->user()->can('update', $this->route('article'));
}
```
Laravel auto-discovers `App\Policies\ArticlePolicy` for `App\Models\Article`. Custom: `Gate::policy(Order::class, OrderPolicy::class)` in `AppServiceProvider`.

---

## 8 — Testing Auth

```php
// Sanctum: actingAs with abilities
Sanctum::actingAs($user, ['orders:read']);
$this->getJson('/api/orders')->assertOk();

Sanctum::actingAs($user, []); // no abilities
$this->postJson('/api/orders', $data)->assertForbidden(); // tokenCan check fails

// Spatie: permission factory pattern
beforeEach(function () {
    app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    $this->editor = User::factory()->create();
    $this->editor->assignRole(Role::create(['name' => 'editor']));
});

// Policy: test authorization boundary
it('blocks non-owner from updating article', function () {
    [$owner, $other] = User::factory()->count(2)->create();
    $article = Article::factory()->for($owner)->create();

    $this->actingAs($other)
        ->patchJson("/api/articles/{$article->id}", ['title' => 'Hack'])
        ->assertForbidden();
});

// 2FA: test enforcement
it('redirects to 2FA challenge when session not verified', function () {
    $user = User::factory()->create(['two_factor_confirmed_at' => now()]);
    $this->actingAs($user)->get('/dashboard')->assertRedirect(route('2fa.challenge'));
});

it('passes through when 2FA already verified in session', function () {
    $user = User::factory()->create(['two_factor_confirmed_at' => now()]);
    session(['2fa_verified' => true]);
    $this->actingAs($user)->get('/dashboard')->assertOk();
});
```

---

## Common pitfalls

| Problem | Fix |
|---|---|
| `unauthenticated` with valid token | Guard mismatch — route must use `auth:sanctum`, not `auth:api` |
| Spatie permissions stale | Add `permission:cache-reset` to deploy pipeline; call `forgetCachedPermissions()` in tests |
| Teams permissions bleed | Call `setPermissionsTeamId()` + `unsetRelation` on every request before any permission check |
| Social `email` null | Validate non-null before `User::firstWhere`; redirect to `/login` with error |
| CSRF 419 on SPA login | SPA must call `/sanctum/csrf-cookie` before POST; check `SESSION_DOMAIN` matches SPA origin |
| 2FA middleware redirect loop | Exclude `2fa.challenge` route from the middleware; store `2fa_verified` in session not flash |
| `remember me` bypasses 2FA | Add `LoginViaRemember` listener; re-prompt 2FA when session is restored via remember cookie |
| `uncompromised()` times out | Wrap with try/catch or use `uncompromised(3)` to allow rare appearances |
| Sanctum token never expires | Set `sanctum.expiration` in config; `null` is never-expire, not a safe default |

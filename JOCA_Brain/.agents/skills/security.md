---
name: security
description: "Global security skill for Laravel + React SaaS. MUST be invoked when the user says: security, segurança, vulnerabilidade, vulnerability, OWASP, injection, XSS, CSRF. SHOULD also invoke when: mass assignment, IDOR, SQL injection, security review, audit, hardening."
triggers: security, segurança, vulnerabilidade, vulnerability, OWASP, injection, XSS, CSRF, mass assignment, IDOR, SQL injection, security review, audit, hardening, headers, CSP, HSTS, secrets, encryption, encriptação, rate limit, brute force, supply chain, CVE, pentest, security check, esta seguro, is it secure, code review security
chain: security-review, tester-security
---

# Security

Global security skill. OWASP Top 10:2025 + ASVS 5.0 + Laravel + React patterns. Callable by any skill.

---

## OWASP Top 10:2025 -- Laravel mapping

| # | Vulnerabilidade | Risco Laravel | Mitigacao |
|---|-----------------|---------------|-----------|
| A01 | Broken Access Control | IDOR, missing policies, SSRF | Policies+Gates, route model binding ownership, deny-by-default |
| A02 | Security Misconfiguration | `APP_DEBUG=true`, Telescope exposto, headers em falta | Config check, security headers, `.env` fora do public |
| A03 | Supply Chain Failures | Packages Composer comprometidos | `composer audit` em CI, pin versions, review packages |
| A04 | Insecure Design | Sem threat model no design | STRIDE threat model, abuse cases no PRD |
| A05 | Injection | `DB::raw()` com input, `{!! !!}` com user data | Eloquent parametrizado, Blade `{{ }}` |
| A06 | Vulnerable Components | CVEs em Composer/npm | `composer audit` + `npm audit` automatizado |
| A07 | Auth Failures | Password reset fraco, sem MFA | Sanctum, rate limiting, HaveIBeenPwned |
| A08 | Integrity Failures | Updates nao assinados, deserializacao | Verificar assinaturas, evitar `unserialize()` |
| A09 | Logging Failures | Sem logs de auth, logging PII | Structured logging, nunca `$request->all()` em logs |
| A10 | Error Handling Failures | Stack traces expostos | `APP_DEBUG=false`, error pages custom |

---

## Critical patterns -- detect always

### Mass Assignment (CRITICAL)
```php
// MAU -- $guarded vazio abre tudo
protected $guarded = [];

// MAU -- passa tudo incluindo role, is_admin
User::create($request->all());

// BOM -- allowlist explicita
protected $fillable = ['name', 'email', 'bio'];

// BOM -- so campos validados
User::create($request->validated());
```

### SQL Injection (CRITICAL)
```php
// MAU -- interpolacao em raw query
DB::select("SELECT * FROM users WHERE email = '$email'");
DB::table('users')->orderByRaw($request->input('sort'));

// BOM -- parametrizado
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
User::where('email', $email)->first(); // Eloquent sempre safe
```
Danger zones: `DB::raw()`, `whereRaw()`, `selectRaw()`, `orderByRaw()`, `havingRaw()` with `$request` or `$_`.

### XSS -- Blade (CRITICAL)
```php
// SAFE -- auto-escaped
{{ $userInput }}

// PERIGOSO -- nunca com user data sem sanitizer
{!! $userContent !!}

// ACEITAVEL -- com HTMLPurifier
{!! clean($userMarkdown) !!}
```

### XSS -- React (HIGH)
```jsx
// PERIGOSO -- bypassa React escaping
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// PERIGOSO -- javascript: protocol
<a href={userSuppliedUrl}>Link</a>

// BOM
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

const isSafeUrl = (url) => /^https?:\/\//.test(url);
<a href={isSafeUrl(url) ? url : '#'}>Link</a>
```

### IDOR (CRITICAL)
```php
// MAU -- qualquer user acede qualquer order
public function show(Order $order) { return $order; }

// BOM -- policy check
public function show(Order $order) {
    $this->authorize('view', $order);
    return $order;
}
```

### CORS (CRITICAL)
```php
// CRITICO -- wildcard + credentials = data theft
'allowed_origins' => ['*'],
'supports_credentials' => true,

// BOM -- origens explicitas
'allowed_origins' => ['https://app.yourdomain.com'],
'supports_credentials' => true,
```

### Path Traversal (CRITICAL)
```php
// MAU
Storage::get($request->input('filename')); // ../../.env

// BOM
Storage::get(basename($request->input('filename')));
```

---

## HTTP Security Headers

```nginx
# CRITICAL
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;

# IMPORTANT
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'self';" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), microphone=()" always;
```

CSP for React SPA: start with `Content-Security-Policy-Report-Only`, then tighten.

---

## Rate Limiting

```php
// Login -- brute force
RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by($request->input('email').'|'.$request->ip());
});

// Password reset
RateLimiter::for('password-reset', function (Request $request) {
    return Limit::perMinute(3)->by($request->ip());
});

// API geral
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// Expensive ops (exports, AI)
RateLimiter::for('expensive', function (Request $request) {
    return Limit::perHour(10)->by($request->user()->id);
});
```

Backing: Redis mandatory for multi-server. `CACHE_DRIVER=redis`.

---

## Encryption

```php
// Field-level encryption (sensitive data)
protected $casts = [
    'ssn'          => 'encrypted',
    'bank_account' => 'encrypted',
];

// Key rotation
APP_KEY=base64:newkey...
APP_PREVIOUS_KEYS=base64:oldkey1...,base64:oldkey2...
```

---

## Logging -- never log these

```php
// NUNCA
Log::info('Login', ['password' => $password]);
Log::debug('Request', $request->all());  // apanha passwords
Log::error('Failed', ['user' => $user]); // serializa modelo inteiro

// BOM
Log::info('Login', ['user_id' => $user->id, 'ip' => $request->ip()]);
Log::warning('Failed login', ['email_hash' => hash('sha256', $email), 'ip' => $request->ip()]);
```

Production: `LOG_LEVEL=warning` (never `debug`).

---

## Server Hardening

### PHP (php.ini production)
```ini
expose_php = Off
display_errors = Off
disable_functions = exec,passthru,shell_exec,system,proc_open,popen,eval
session.cookie_httponly = 1
session.cookie_secure = 1
session.use_strict_mode = 1
open_basedir = /var/www/html:/tmp
```

### Nginx
```nginx
server_tokens off;
autoindex off;
location ~ /\. { deny all; return 404; }
location ~* \.(env|git|htaccess|sql|bak)$ { deny all; return 404; }
```

### Laravel production
```
APP_DEBUG=false
APP_ENV=production
```

---

## Supply Chain

Real attack (2026-05-22): laravel-lang packages compromised -- 233 tags rewritten, 700+ repos affected, payload stole cloud keys, secrets, SSH keys.

```bash
# CI mandatory
composer audit --locked
npm audit --audit-level=high

# Verify integrity
composer validate --strict

# Pin versions in production (not ^1.2.3)
"vendor/package": "1.2.3"
```

---

## Invoke security agents

### Fast automated scan
```
Agent(subagent_type="tester-security", prompt="Security scan completo. Path: [path]. Stack: Laravel + React. Verificar: CVEs (composer+npm), secrets (gitleaks), HTTP headers, .env exposure, APP_DEBUG, CORS, mass assignment ($guarded=[]), raw SQL com $request, {!! !!} com user data, dangerouslySetInnerHTML, rate limiting em auth routes, Log:: com PII. Report: Critical/High/Medium/Low.")
```

### Deep code review
```
Agent(subagent_type="security-review", prompt="Security code review. Files: [paths]. Apply OWASP ASVS 5.0. Check: authorization on every endpoint (IDOR), FormRequest validation, mass assignment, file upload, session config, error handling, encryption on PII. Report: vulnerability + exploit scenario + Laravel-native fix.")
```

### Rate limiting test
```
Agent(subagent_type="tester-ratelimit", prompt="Test rate limiting on [URL]. Auth: Bearer [token]. Test: threshold verification (send N+10 requests, expect 429), IP header bypass (X-Forwarded-For + 10 variants), path/method manipulation, Laravel config audit (TRUSTED_PROXIES, throttle middleware). Endpoints to test: login, register, password reset, API. Report with OWASP API4:2019 mapping.")
```

---

## Checklist pre-deploy

### Critical (blocks deploy)
- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] `.env` fora do web root
- [ ] `$guarded = []` em zero modelos
- [ ] `$request->all()` nunca passa a `create()`/`update()`
- [ ] Zero `DB::raw()` com input de utilizador
- [ ] Zero `{!! !!}` com user data sem sanitizer
- [ ] `composer audit` sem CRITICAL/HIGH
- [ ] HTTPS enforced (HSTS)

### High (fix before going live)
- [ ] CORS com origens explicitas (nao wildcard)
- [ ] Rate limiting em login/password reset
- [ ] Session config: http_only, secure, same_site=lax
- [ ] Security headers configurados
- [ ] `LOG_LEVEL=warning` (nao debug)
- [ ] Zero `Log::` com passwords/tokens/PII
- [ ] Policies em todos os resource controllers
- [ ] `npm audit` sem HIGH

### Medium (fix next sprint)
- [ ] CSP configurado (pelo menos report-only)
- [ ] Encryption em campos PII (SSN, bank, etc.)
- [ ] PHP disable_functions configurado
- [ ] Nginx hardened (server_tokens off, file blocking)
- [ ] Dependabot activo

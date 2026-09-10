---
name: security
description: "Global security skill for Laravel + React SaaS. MUST be invoked when the user says: security, vulnerability, OWASP, injection, XSS, CSRF. SHOULD also invoke when: mass assignment, IDOR, SQL injection, security review, audit, hardening."
triggers: security, vulnerability, OWASP, injection, XSS, CSRF, mass assignment, IDOR, SQL injection, security review, audit, hardening, headers, CSP, HSTS, secrets, encryption, rate limit, brute force, supply chain, CVE, pentest, security check, is it secure, code review security
chain: security-review, tester-security
---

# Security

Global security skill. OWASP Top 10:2025 + ASVS 5.0 + Laravel + React patterns. Callable by any skill.

---

## OWASP Top 10:2025 -- Laravel mapping

| # | Vulnerability | Laravel risk | Mitigation |
|---|-----------------|---------------|-----------|
| A01 | Broken Access Control | IDOR, missing policies, SSRF | Policies+Gates, route model binding ownership, deny-by-default |
| A02 | Security Misconfiguration | `APP_DEBUG=true`, Telescope exposed, missing headers | Config check, security headers, `.env` outside public |
| A03 | Supply Chain Failures | Compromised Composer packages | `composer audit` in CI, pin versions, review packages |
| A04 | Insecure Design | No threat model in the design | STRIDE threat model, abuse cases in the PRD |
| A05 | Injection | `DB::raw()` with input, `{!! !!}` with user data | Parameterized Eloquent, Blade `{{ }}` |
| A06 | Vulnerable Components | CVEs in Composer/npm | `composer audit` + `npm audit` automated |
| A07 | Auth Failures | Weak password reset, no MFA | Sanctum, rate limiting, HaveIBeenPwned |
| A08 | Integrity Failures | Unsigned updates, deserialization | Verify signatures, avoid `unserialize()` |
| A09 | Logging Failures | No auth logs, logging PII | Structured logging, never `$request->all()` in logs |
| A10 | Error Handling Failures | Exposed stack traces | `APP_DEBUG=false`, custom error pages |

---

## Critical patterns -- detect always

### Mass Assignment (CRITICAL)
```php
// BAD -- empty $guarded opens everything
protected $guarded = [];

// BAD -- passes everything including role, is_admin
User::create($request->all());

// GOOD -- explicit allowlist
protected $fillable = ['name', 'email', 'bio'];

// GOOD -- only validated fields
User::create($request->validated());
```

### SQL Injection (CRITICAL)
```php
// BAD -- interpolation in a raw query
DB::select("SELECT * FROM users WHERE email = '$email'");
DB::table('users')->orderByRaw($request->input('sort'));

// GOOD -- parameterized
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
User::where('email', $email)->first(); // Eloquent always safe
```
Danger zones: `DB::raw()`, `whereRaw()`, `selectRaw()`, `orderByRaw()`, `havingRaw()` with `$request` or `$_`.

### XSS -- Blade (CRITICAL)
```php
// SAFE -- auto-escaped
{{ $userInput }}

// DANGEROUS -- never with user data without a sanitizer
{!! $userContent !!}

// ACCEPTABLE -- with HTMLPurifier
{!! clean($userMarkdown) !!}
```

### XSS -- React (HIGH)
```jsx
// DANGEROUS -- bypasses React escaping
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// DANGEROUS -- javascript: protocol
<a href={userSuppliedUrl}>Link</a>

// GOOD
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

const isSafeUrl = (url) => /^https?:\/\//.test(url);
<a href={isSafeUrl(url) ? url : '#'}>Link</a>
```

### IDOR (CRITICAL)
```php
// BAD -- any user can access any order
public function show(Order $order) { return $order; }

// GOOD -- policy check
public function show(Order $order) {
    $this->authorize('view', $order);
    return $order;
}
```

### CORS (CRITICAL)
```php
// CRITICAL -- wildcard + credentials = data theft
'allowed_origins' => ['*'],
'supports_credentials' => true,

// GOOD -- explicit origins
'allowed_origins' => ['https://app.yourdomain.com'],
'supports_credentials' => true,
```

### Path Traversal (CRITICAL)
```php
// BAD
Storage::get($request->input('filename')); // ../../.env

// GOOD
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

// General API
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
// NEVER
Log::info('Login', ['password' => $password]);
Log::debug('Request', $request->all());  // catches passwords
Log::error('Failed', ['user' => $user]); // serializes the whole model

// GOOD
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
Agent(subagent_type="tester-security", prompt="Full security scan. Path: [path]. Stack: Laravel + React. Check: CVEs (composer+npm), secrets (gitleaks), HTTP headers, .env exposure, APP_DEBUG, CORS, mass assignment ($guarded=[]), raw SQL with $request, {!! !!} with user data, dangerouslySetInnerHTML, rate limiting on auth routes, Log:: with PII. Report: Critical/High/Medium/Low.")
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

## Pre-deploy checklist

### Critical (blocks deploy)
- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] `.env` outside the web root
- [ ] `$guarded = []` in zero models
- [ ] `$request->all()` never passed to `create()`/`update()`
- [ ] Zero `DB::raw()` with user input
- [ ] Zero `{!! !!}` with user data without a sanitizer
- [ ] `composer audit` with no CRITICAL/HIGH
- [ ] HTTPS enforced (HSTS)

### High (fix before going live)
- [ ] CORS with explicit origins (not wildcard)
- [ ] Rate limiting on login/password reset
- [ ] Session config: http_only, secure, same_site=lax
- [ ] Security headers configured
- [ ] `LOG_LEVEL=warning` (not debug)
- [ ] Zero `Log::` with passwords/tokens/PII
- [ ] Policies on every resource controller
- [ ] `npm audit` with no HIGH

### Medium (fix next sprint)
- [ ] CSP configured (at least report-only)
- [ ] Encryption on PII fields (SSN, bank, etc.)
- [ ] PHP disable_functions configured
- [ ] Nginx hardened (server_tokens off, file blocking)
- [ ] Dependabot active

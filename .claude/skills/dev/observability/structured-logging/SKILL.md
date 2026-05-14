---
name: structured-logging
description: Structured JSON logging, correlation IDs, and observability for Laravel SaaS in production. Use when setting up JSON log formatting with Monolog, implementing correlation IDs per request, configuring Laravel Telescope for production, integrating Sentry error tracking, detecting N+1 queries, setting up Slack/Papertrail/Logtail log channels, adding tenant/user context to all logs, or tracking response time and memory. Trigger phrases: "structured logging Laravel", "JSON logs Monolog", "correlation ID request tracking", "add Sentry to Laravel", "Laravel Telescope setup", "log N+1 queries", "log tenant context", "ship logs to Papertrail Logtail", "GDPR log retention policy".
when_to_use: |
  - "structured logs", "JSON logging", "machine-readable logs", "logs Kibana Loki"
  - "correlation ID", "request ID", "trace ID across logs and jobs"
  - "Laravel Telescope", "Telescope shouldRecord", "Telescope production gating"
  - "Sentry Laravel", "captureException", "Sentry breadcrumbs", "error tracking"
  - "log channels stack", "Slack critical errors", "log to multiple destinations"
  - "N+1 detection", "slow query log", "DB::listen query"
  - "Log::withContext", "Log::shareContext", "Context facade logs"
  - "Papertrail", "Logtail", "Monolog handler aggregation"
  - "what not to log GDPR", "log retention", "hide sensitive params"
  - "Log::shouldReceive", "asserting log calls in tests"
allowed-tools: Read Write Edit Bash Grep
---

# Structured Logging

Observability for Laravel SaaS in production. Every log entry must be: JSON (machine-readable), contextualised (correlation ID + tenant + user), correctly levelled, and PII-free.

---

## 1. JSON log formatting

```php
// config/logging.php — set JsonFormatter on the daily channel
'daily' => [
    'driver'     => 'daily',
    'path'       => storage_path('logs/laravel.log'),
    'level'      => env('LOG_LEVEL', 'warning'),
    'days'       => 30,
    'formatter'  => Monolog\Formatter\JsonFormatter::class,
    'formatter_with' => ['includeStacktraces' => true],
],
```

Verify: `tail -f storage/logs/laravel-$(date +%Y-%m-%d).log | jq .`

The `extra` key in each JSON entry will contain Context data (correlation ID, tenant, user) automatically once middleware is set up (section 2).

---

## 2. Correlation IDs — per-request context

### Laravel 11+ — Context facade (auto-propagates to queued jobs)

```php
// app/Http/Middleware/CorrelationId.php
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;

class CorrelationId
{
    public function handle(Request $request, Closure $next): Response
    {
        // Accept upstream correlation ID or generate new one
        $id = $request->header('X-Correlation-ID') ?: (string) Str::uuid();

        Context::add('correlation_id', $id);
        Context::add('tenant_id', $request->user()?->tenant_id);
        Context::add('user_id', $request->user()?->id);
        // Context data is automatically appended to every Log:: call as 'extra'
        // and automatically dehydrated/hydrated with queued jobs — no extra code needed

        return tap($next($request), function ($response) use ($id) {
            $response->headers->set('X-Correlation-ID', $id);
        });
    }
}
```

Register in `bootstrap/app.php` (append, so auth middleware runs first):

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->append(CorrelationId::class);
})
```

### Laravel 10 — Log::shareContext()

`Log::shareContext()` adds context to **all subsequent log calls** (for the request lifecycle).
`Log::withContext()` adds context to the **next log call only**.

```php
// In middleware for Laravel 10:
Log::shareContext([
    'correlation_id' => $id,
    'tenant_id'      => auth()->user()?->tenant_id,
    'user_id'        => auth()->id(),
]);

// In queued jobs (manual — Context facade not available in L10):
public function handle(): void
{
    Log::shareContext(['correlation_id' => $this->correlationId]);
}
```

Package: `bilfeldt/laravel-correlation-id` — auto-middleware + queue propagation for both L10/L11.

---

## 3. Log levels — decision table

| Level | Use when | Example |
|-------|----------|---------|
| `debug` | Dev only; high-frequency internals | "Cache miss for key: X" |
| `info` | Normal significant events | "Order created #1234" |
| `warning` | Recoverable degradation | "Third-party API slow (2.3s), retry 2/3" |
| `error` | Exception caught and handled | "Stripe charge failed" |
| `critical` | Service impaired, needs immediate human response | "DB connection lost", "Queue not processing" |

`LOG_LEVEL=warning` in production `.env` — suppresses `debug`/`info` noise from file/Sentry channels.
`critical` always routes to Slack webhook in addition to file and Sentry.

---

## 4. Log channels stack

```php
// config/logging.php
'channels' => [
    'stack' => [
        'driver'   => 'stack',
        'channels' => ['daily', 'sentry', 'slack'],
        'ignore_exceptions' => false,
    ],

    'daily' => [
        'driver'    => 'daily',
        'path'      => storage_path('logs/laravel.log'),
        'level'     => env('LOG_LEVEL', 'warning'),
        'days'      => 30,
        'formatter' => Monolog\Formatter\JsonFormatter::class,
    ],

    'sentry' => [
        'driver' => 'sentry',
        'level'  => 'error',   // error+ goes to Sentry
        'bubble' => true,
    ],

    'slack' => [
        'driver'   => 'slack',
        'url'      => env('LOG_SLACK_WEBHOOK_URL'),
        'username' => env('APP_NAME'),
        'emoji'    => ':fire:',
        'level'    => 'critical',  // only critical+ hits Slack
    ],

    'papertrail' => [
        'driver'  => 'monolog',
        'level'   => env('LOG_LEVEL', 'debug'),
        'handler' => Monolog\Handler\SyslogUdpHandler::class,
        'handler_with' => [
            'host' => env('PAPERTRAIL_URL'),
            'port' => (int) env('PAPERTRAIL_PORT', 514),
        ],
    ],

    'logtail' => [
        // composer require logtail/monolog-logtail
        'driver'  => 'monolog',
        'level'   => env('LOG_LEVEL', 'debug'),
        'handler' => Logtail\Monolog\LogtailHandler::class,
        'handler_with' => ['sourceToken' => env('LOGTAIL_TOKEN')],
    ],
],
```

---

## 5. Laravel Telescope

```bash
composer require laravel/telescope --dev
php artisan telescope:install && php artisan migrate
```

### Production gating

```php
// app/Providers/TelescopeServiceProvider.php
protected function gate(): void
{
    Gate::define('viewTelescope', fn($user) =>
        in_array($user->email, explode(',', env('TELESCOPE_ALLOWED_EMAILS', '')))
    );
}

public function register(): void
{
    $this->hideSensitiveRequestDetails();

    Telescope::filter(function (IncomingEntry $entry) {
        if ($this->app->isLocal()) return true;

        // Production: only record errors, slow queries, failed jobs
        return $entry->isReportableException()
            || $entry->isFailedRequest()
            || $entry->isFailedJob()
            || $entry->hasMonitoredTag();
    });
}

protected function hideSensitiveRequestDetails(): void
{
    if ($this->app->isProduction()) {
        Telescope::hideRequestParameters(['password', 'password_confirmation', 'token', 'api_key', 'secret']);
        Telescope::hideRequestHeaders(['Authorization', 'Cookie', 'X-CSRF-TOKEN']);
    }
}
```

Add to scheduler (prune old entries): `$schedule->command('telescope:prune')->daily();`

Watchers to enable: `QueryWatcher` (slow threshold 100ms), `RequestWatcher`, `JobWatcher`, `ExceptionWatcher`, `LogWatcher`.

---

## 6. N+1 and slow query detection

```php
// config/telescope.php
'watchers' => [
    Watchers\QueryWatcher::class => [
        'enabled' => env('TELESCOPE_ENABLED', false),
        'slow'    => 100,  // flag queries > 100ms
    ],
],
```

```php
// Runtime detection via DB::listen — enable only when APP_DEBUG=true
// app/Providers/AppServiceProvider.php
public function boot(): void
{
    if (config('app.debug')) {
        DB::listen(function (QueryExecuted $query) {
            if ($query->time > 100) {
                Log::warning('Slow query detected', [
                    'sql'      => $query->sql,
                    'time_ms'  => round($query->time, 2),
                    // Include backtrace to identify caller — strip 4 internal frames
                    'caller'   => collect(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 10))
                        ->skip(4)->take(3)->values()
                        ->map(fn($f) => ($f['class'] ?? '') . '::' . ($f['function'] ?? ''))
                        ->implode(' → '),
                ]);
            }
        });
    }
}
```

For production N+1 detection in CI: `barryvdh/laravel-debugbar` (never in production) or assert query count in feature tests:

```php
it('loads orders without N+1', function () {
    $user = User::factory()->has(Order::factory()->count(20))->create();
    $queryCount = 0;
    DB::listen(fn() => $queryCount++);

    $this->actingAs($user)->getJson('/api/orders');

    expect($queryCount)->toBeLessThanOrEqual(3); // 1 user + 1 orders + 1 items eager
});
```

---

## 7. Sentry integration

```bash
composer require sentry/sentry-laravel
php artisan sentry:publish --dsn=https://...@sentry.io/...
```

```php
// config/sentry.php — critical settings
return [
    'dsn'                  => env('SENTRY_LARAVEL_DSN'),
    'traces_sample_rate'   => (float) env('SENTRY_TRACES_SAMPLE_RATE', 0.05), // 5% in production
    'send_default_pii'     => false,  // GDPR: never send PII automatically
    'release'              => env('SENTRY_RELEASE'),  // set to git SHA in CI
    'environment'          => env('APP_ENV'),
];
```

```php
// Add user context (ID only — no PII like email)
use Sentry\State\Scope;

\Sentry\configureScope(fn(Scope $scope) => $scope->setUser([
    'id'        => $user->id,
    'tenant_id' => $user->tenant_id,
]));

// Breadcrumb before critical operations
\Sentry\addBreadcrumb(
    message: 'Checkout initiated',
    category: 'checkout',
    level: \Sentry\Breadcrumb::LEVEL_INFO,
    metadata: ['cart_id' => $cartId, 'item_count' => $count],
);

// Capture exception with context (always re-throw or handle — Sentry doesn't suppress)
try {
    $stripe->charge($amount);
} catch (StripeException $e) {
    \Sentry\captureException($e);
    Log::error('Stripe charge failed', ['amount' => $amount, 'code' => $e->getStripeCode()]);
    throw new PaymentException('Payment failed', 0, $e);
}
```

---

## 8. Response time and memory logging

```php
// app/Http/Middleware/LogPerformance.php
class LogPerformance
{
    public function handle(Request $request, Closure $next): Response
    {
        $start    = hrtime(true);
        $response = $next($request);
        $ms       = round((hrtime(true) - $start) / 1e6, 2);
        $mb       = round(memory_get_peak_usage(true) / 1048576, 2);

        if ($ms > 2000) {
            Log::warning('Slow response', [
                'route'       => $request->route()?->getName() ?? $request->path(),
                'method'      => $request->method(),
                'duration_ms' => $ms,
                'memory_mb'   => $mb,
                'status'      => $response->getStatusCode(),
            ]);
        }

        $response->headers->set('X-Response-Time', "{$ms}ms");
        return $response;
    }
}
```

---

## 9. GDPR — what never to log

**Never log under any log level:**
- Passwords, tokens, API keys, session IDs, OAuth codes
- Credit card numbers, CVV, bank account numbers
- User email, full name, phone, address, IP address (use user ID only)
- Request bodies of auth endpoints: `/login`, `/register`, `/password/reset`, `/oauth/token`

If you must log a user identifier for debugging, log only the opaque `user_id` (integer/UUID). Never log display names or contact info.

---

## 10. Testing log calls

```php
use Illuminate\Support\Facades\Log;

it('logs error when payment fails', function () {
    Log::shouldReceive('error')
        ->once()
        ->with('Stripe charge failed', Mockery::on(fn($ctx) =>
            isset($ctx['amount']) &&
            !isset($ctx['card_number']) &&  // PII must be absent
            !isset($ctx['email'])
        ));

    $this->actingAs($this->user)->postJson('/api/checkout', ['amount' => 100]);
});

it('logs slow request warning when response exceeds 2s', function () {
    Log::shouldReceive('warning')
        ->with('Slow response', Mockery::on(fn($ctx) => $ctx['duration_ms'] > 2000));

    // Test with a route that has a forced delay
    $this->getJson('/api/test/slow');
});

it('does not log sensitive fields', function () {
    Log::shouldReceive('info')->withArgs(fn($msg, $ctx) =>
        !array_key_exists('password', $ctx) &&
        !array_key_exists('token', $ctx)
    );

    $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'secret']);
});
```

---

## Quick-start checklist

- [ ] `JsonFormatter` on `daily` channel; verify with `tail | jq .`
- [ ] `CorrelationId` middleware registered (append order — after auth)
- [ ] Context adds `correlation_id` + `tenant_id` + `user_id` on every request
- [ ] `LOG_LEVEL=warning` in production `.env`
- [ ] `sentry` channel active; `send_default_pii=false`; `release` set to git SHA
- [ ] `slack` channel active for `critical` level
- [ ] Telescope gated behind `TELESCOPE_ALLOWED_EMAILS`; filter for production
- [ ] `telescope:prune` in scheduler
- [ ] `QueryWatcher` slow threshold at 100ms
- [ ] Sensitive params hidden from Telescope
- [ ] Log retention: 30 days on disk; external service per data policy
- [ ] No PII in any log call (audited)

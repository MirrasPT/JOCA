---
name: error-tracking-prod
description: Production error tracking, structured logging, health checks, and monitoring for Laravel. Sentry/Flare (error tracking), Monolog JSON (structured logs), Context facade (correlation IDs), spatie/laravel-health (health checks), Horizon monitoring, uptime monitoring. Activar no setup de producao.
triggers: sentry, flare, production logging, structured logging, JSON logs, correlation ID, health check, laravel health, horizon monitoring, uptime monitoring, oh dear, better stack, producao logs, production errors, error monitoring, alerta, alerting, monitoring, observability, observabilidade, log producao, erro producao
---

# Error Tracking — Production

Monitoring e logging para producao. Sentry/Flare + structured logging + health checks.

**Activar** quando `laravel-specialist` ou `deploy-*` configura ambiente de producao.

---

## 1. Sentry — error tracking

### Setup
```bash
composer require sentry/sentry-laravel
php artisan sentry:publish --dsn=https://key@o0.ingest.sentry.io/0
php artisan sentry:test   # verificar
```

### Bootstrap (Laravel 11+)
```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions) {
    Integration::handles($exceptions);
})
```

### Config essencial
```php
// config/sentry.php
'dsn'                => env('SENTRY_LARAVEL_DSN'),
'environment'        => env('APP_ENV', 'production'),
'release'            => env('SENTRY_RELEASE'),            // git hash no deploy
'traces_sample_rate' => env('SENTRY_TRACES_SAMPLE_RATE', 0.1), // 10% baseline
'sample_rate'        => env('SENTRY_SAMPLE_RATE', 1.0),
'send_default_pii'   => false,                             // NUNCA true sem GDPR review

'ignore_exceptions' => [
    Illuminate\Auth\AuthenticationException::class,         // 401
    Illuminate\Auth\Access\AuthorizationException::class,   // 403
    Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class, // 404
    Illuminate\Validation\ValidationException::class,       // 422
],

'ignore_transactions' => ['GET /health', 'GET /up'],
```

### User context
```php
// Middleware
configureScope(function (\Sentry\State\Scope $scope): void {
    if ($user = auth()->user()) {
        $scope->setUser(['id' => $user->id]);
    }
});
```

### .env
```ini
SENTRY_LARAVEL_DSN=https://key@o0.ingest.sentry.io/0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_RELEASE=1.0.0
```

Desactivar local: `SENTRY_LARAVEL_DSN=null`

---

## 2. Flare — alternativa Laravel-native

Do team Spatie. GDPR-native (Belgica/EU). Mais contexto Laravel que Sentry.

```bash
composer require spatie/laravel-flare
```

```ini
FLARE_KEY=your-api-key
```

```bash
php artisan flare:test
```

### Flare vs Sentry

| | Flare | Sentry |
|---|---|---|
| Contexto Laravel | Profundo | Standard |
| Performance monitoring | Sim (L11+) | Sim |
| Pricing | EUR 9/mo | Free tier + $26/mo |
| GDPR/EU | Belgica | US (EU disponivel) |
| Multi-linguagem | PHP/Laravel | 50+ plataformas |

**Recomendacao:** Sentry para equipas multi-stack. Flare para solo/agencia Laravel-only.

---

## 3. Structured Logging (JSON)

### JSON formatter
```php
// app/Logging/JsonFormatter.php
namespace App\Logging;
use Monolog\Formatter\JsonFormatter as MonologJsonFormatter;

class JsonFormatter
{
    public function __invoke($logger): void
    {
        foreach ($logger->getHandlers() as $handler) {
            $handler->setFormatter(new MonologJsonFormatter());
        }
    }
}
```

### Channels producao
```php
// config/logging.php
'channels' => [
    'stack' => [
        'driver'   => 'stack',
        'channels' => ['production', 'slack'],
    ],
    'production' => [
        'driver'  => 'monolog',
        'handler' => \Monolog\Handler\StreamHandler::class,
        'with'    => ['stream' => 'php://stderr'],
        'tap'     => [\App\Logging\JsonFormatter::class],
        'level'   => env('LOG_LEVEL', 'warning'),
    ],
    'slack' => [
        'driver'  => 'slack',
        'url'     => env('LOG_SLACK_WEBHOOK_URL'),
        'level'   => 'critical',
    ],
    'daily' => [
        'driver' => 'daily',
        'path'   => storage_path('logs/laravel.log'),
        'level'  => 'error',
        'days'   => 14,
    ],
],
```

### Correlation IDs (Context facade, Laravel 11+)
```php
// app/Http/Middleware/AttachRequestContext.php
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;

class AttachRequestContext
{
    public function handle($request, $next)
    {
        Context::add('request_id', (string) Str::uuid());
        Context::add('url', $request->url());
        Context::add('ip', $request->ip());
        if ($user = $request->user()) {
            Context::add('user_id', $user->id);
            Context::add('tenant_id', $user->tenant_id ?? null);
        }
        return $next($request);
    }
}
```

Registar em `bootstrap/app.php`:
```php
$middleware->prepend(\App\Http\Middleware\AttachRequestContext::class);
```

Cada `Log::*` inclui automaticamente request_id, url, ip, user_id. Propaga para jobs via queue.

### Log levels producao

| Level | Quando usar |
|-------|------------|
| emergency | Sistema down |
| critical | Componente falhou |
| error | Runtime errors -- sempre notificar |
| warning | Degradado, recuperavel |
| info/debug | **Nunca em producao** |

```ini
LOG_LEVEL=warning
```

### O que NUNCA logar
- Passwords, hashes
- API keys, tokens, secrets
- Cartoes credito, contas bancarias
- PII completo (emails, telefones, NIFs)
- `$request->all()` (apanha passwords)
- Modelos inteiros (`$user` -- serializa tudo)

### PII scrubber
```php
class ScrubSensitiveData implements ProcessorInterface
{
    private array $keys = ['api_key', 'token', 'secret', 'credit_card', 'ssn', 'password'];

    public function __invoke(LogRecord $record): LogRecord
    {
        $context = $record->context;
        array_walk_recursive($context, function (&$value, $key) {
            if (in_array(strtolower($key), $this->keys)) $value = '[REDACTED]';
        });
        return $record->with(context: $context);
    }
}
```

---

## 4. Health Checks (spatie/laravel-health)

```bash
composer require spatie/laravel-health
php artisan vendor:publish --tag="health-config"
php artisan vendor:publish --tag="health-migrations"
php artisan migrate
```

### Checks recomendados
```php
// AppServiceProvider::boot()
Health::checks([
    DatabaseCheck::new(),
    RedisCheck::new(),
    QueueCheck::new(),
    HorizonCheck::new(),
    UsedDiskSpaceCheck::new()
        ->warnWhenUsedSpaceIsAbovePercentage(80)
        ->failWhenUsedSpaceIsAbovePercentage(90),
    CacheCheck::new(),
    DebugModeCheck::new(),                              // APP_DEBUG=false
    EnvironmentCheck::new()->expectEnvironment('production'),
    SecurityAdvisoryCheck::new(),                        // CVEs em packages
]);
```

### Agendar
```php
Schedule::command(RunHealthChecksCommand::class)->everyMinute();
Schedule::command(DispatchQueueCheckJobsCommand::class)->everyMinute();
```

### Endpoint
```php
Route::get('/health', HealthCheckResultsController::class);
```

### Notificacoes
```php
// config/health.php
'notifications' => [
    'enabled'  => true,
    'channels' => ['mail', 'slack'],
    'throttle_notifications_for_minutes' => 60,
],
```

---

## 5. Horizon Monitoring

### Metrics (obrigatorio para dashboard)
```php
Schedule::command('horizon:snapshot')->everyFiveMinutes();
```

### Autorizacao
```php
Gate::define('viewHorizon', fn (User $user) => $user->hasRole('admin'));
```

### Alertas de wait time
```php
// config/horizon.php
'waits' => [
    'redis:critical' => 30,   // segundos
    'redis:default'  => 60,
],
```

### Notificacoes
```php
Horizon::routeMailNotificationsTo('[email protected]');
Horizon::routeSlackNotificationsTo(env('HORIZON_SLACK_WEBHOOK'));
```

---

## 6. Uptime Monitoring

| Tool | Tipo | Melhor para |
|------|------|------------|
| Oh Dear | Managed | Laravel-native (integra com laravel-health) |
| Better Stack | Managed | Logs + uptime + on-call |
| Uptime Kuma | Self-hosted | Gratis, Docker |

Oh Dear monitoriza: uptime, SSL expiry, cron heartbeats, broken links, health endpoint.

---

## .env producao completo

```ini
APP_ENV=production
APP_DEBUG=false
LOG_CHANNEL=stack
LOG_LEVEL=warning

SENTRY_LARAVEL_DSN=https://key@o0.ingest.sentry.io/0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_RELEASE=1.0.0

LOG_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
HORIZON_SLACK_WEBHOOK=https://hooks.slack.com/services/yyy
```

---

## Checklist producao

- [ ] `APP_DEBUG=false`
- [ ] `LOG_LEVEL=warning`
- [ ] Sentry/Flare configurado e `sentry:test` passa
- [ ] `ignore_exceptions` configurado (401, 403, 404, 422)
- [ ] JSON log formatter activo
- [ ] Correlation ID middleware registado
- [ ] PII scrubber registado
- [ ] `send_default_pii=false`
- [ ] Health checks agendados (everyMinute)
- [ ] `/health` endpoint exposto para monitoring
- [ ] `horizon:snapshot` agendado (every5Minutes)
- [ ] Slack/email alertas verificados
- [ ] Uptime monitor apontado a `/health` ou `/up`
- [ ] `telescope:prune` agendado (se Telescope em producao)

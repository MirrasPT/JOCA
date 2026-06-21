---
name: error-tracking-dev
description: "Development error tracking and debugging for Laravel. MUST be invoked when the user says: debugbar, telescope, ignition, ray, debug, debug panel, query inspector, N+1. SHOULD also invoke when: slow query dev, log viewer, clockwork, pail, desenvolvimento, development debug."
triggers: debugbar, telescope, ignition, ray, debug, debug panel, query inspector, N+1, slow query dev, log viewer, clockwork, pail, desenvolvimento, development debug, debug bar, barra debug, ver queries, ver logs, painel debug, erros dev, errors dev, dump, dd, stack trace dev
---

# Error Tracking — Development

Debug tools for dev. Activate at project start for continuous tracking of queries, exceptions, performance, and jobs.

**Auto-activate** when `laravel-specialist` detects local/dev environment.

---

## Quick setup (new project)

```bash
# Core — install all at once
composer require fruitcake/laravel-debugbar --dev
composer require laravel/telescope --dev
composer require beyondcode/laravel-query-detector --dev
composer require opcodesio/log-viewer --dev

php artisan telescope:install
php artisan migrate
php artisan vendor:publish --provider="Fruitcake\LaravelDebugbar\ServiceProvider"
```

```ini
# .env
APP_DEBUG=true
DEBUGBAR_ENABLED=true
TELESCOPE_ENABLED=true
LOG_LEVEL=debug
```

---

## 1. Debugbar — browser bar

Real-time overlay at bottom of browser:

| Painel | O que mostra |
|--------|-------------|
| Queries | SQL com bindings, tempo, duplicados, EXPLAIN |
| Timeline | Boot + execution timing, memoria por fase |
| Models | Frequencia de loading — detecta N+1 |
| Route | Rota actual, middleware stack |
| Views | Templates renderizados |
| Exceptions | Exceptions com stack trace |
| Memory | Peak memory usage |
| Cache | Hits/misses (activar em config) |
| Mail | Emails enviados com preview (activar) |
| Events | Eventos disparados (activar) |
| Auth | Estado de login (activar) |

### Recommended config
```php
// config/debugbar.php
'collectors' => [
    'models'  => true,   // N+1 detection
    'cache'   => true,   // hit/miss
    'events'  => true,   // event flow
    'auth'    => true,   // login state
    'mail'    => true,   // email preview
    'gate'    => true,   // authorization checks
    'config'  => false,  // NUNCA — expoe secrets
    'logs'    => false,  // NUNCA — expoe log content
],
```

### Auto N+1 detection
```bash
composer require beyondcode/laravel-query-detector --dev
```
```php
// config/query-detector.php
'threshold' => 1,
'output' => [
    \BeyondCode\QueryDetector\Outputs\Debugbar::class,
    \BeyondCode\QueryDetector\Outputs\Log::class,
],
```

### Measure code blocks
```php
Debugbar::startMeasure('render', 'Render blade');
// ... codigo ...
Debugbar::stopMeasure('render');

// Ou com closure
Debugbar::measure('complex-op', function () {
    // codigo a medir
});
```

---

## 2. Telescope — web dashboard

Dashboard at `/telescope`. Records everything: requests, queries, jobs, mail, cache, exceptions.

### Register in dev only
```php
// app/Providers/AppServiceProvider.php
public function register(): void
{
    if ($this->app->environment('local')) {
        $this->app->register(\Laravel\Telescope\TelescopeServiceProvider::class);
        $this->app->register(TelescopeServiceProvider::class);
    }
}
```

```json
// composer.json — prevent auto-discovery
"extra": {
    "laravel": {
        "dont-discover": ["laravel/telescope"]
    }
}
```

### Essential watchers
```php
// config/telescope.php
Watchers\QueryWatcher::class => [
    'enabled' => true,
    'slow'    => 100,   // ms — marca queries lentas
],
Watchers\ExceptionWatcher::class  => true,
Watchers\JobWatcher::class        => true,
Watchers\MailWatcher::class       => true,
Watchers\CacheWatcher::class     => true,
Watchers\DumpWatcher::class      => true,   // dump() aparece no Telescope
Watchers\RequestWatcher::class   => true,
Watchers\ModelWatcher::class     => ['enabled' => true, 'hydrations' => true],
```

### Pruning required
```php
// routes/console.php
Schedule::command('telescope:prune --hours=48')->daily();
```

---

## 3. Ignition — rich error pages

Pre-installed in Laravel. Shows:
- Interactive stack trace (click to open in editor)
- Auto solution suggestions
- Context: request, headers, session, query string

### Config
```php
// config/ignition.php
'editor' => env('IGNITION_EDITOR', 'vscode'), // phpstorm, sublime, atom
'theme'  => 'auto',
```

### Custom solutions
```php
use Spatie\Ignition\Contracts\ProvidesSolution;
use Spatie\Ignition\Contracts\Solution;

class InvalidConfigException extends \RuntimeException implements ProvidesSolution
{
    public function getSolution(): Solution
    {
        return new class implements Solution {
            public function getSolutionTitle(): string { return 'Config invalida'; }
            public function getSolutionDescription(): string { return 'Corre php artisan config:clear'; }
            public function getDocumentationLinks(): array { return []; }
        };
    }
}
```

---

## 4. Ray — desktop debugger (optional)

Desktop app that receives debug output without polluting browser or logs. Great for jobs and events.

```bash
composer require spatie/laravel-ray --dev
```

```php
ray('hello world');
ray($user)->label('User payload');
ray()->showQueries();       // mostra todas as queries
ray()->showEvents();        // mostra eventos
ray()->showJobs();          // mostra jobs
ray()->measure();           // start timer
// ... codigo ...
ray()->measure();           // stop — mostra elapsed + memory delta
ray()->trace();             // stack trace
ray()->pause();             // pausa execucao
```

License: EUR 49/year. Free tier: 20 messages per session.

---

## 5. Log Viewer — logs in browser

```bash
composer require opcodesio/log-viewer --dev
```

Access at `{URL}/log-viewer`. Search, level filters, real-time tailing.

```php
// Authorize access
LogViewer::auth(fn ($request) => $request->user()?->hasRole('admin'));
```

---

## 6. Pail — tail logs in terminal

```bash
composer require laravel/pail --dev
php artisan pail              # basic tail
php artisan pail -vv          # with stack traces
php artisan pail --level=error
php artisan pail --filter="QueryException"
php artisan pail --user=42    # filter by user
```

Requires `pcntl` extension (Linux/macOS).

---

## 7. Clockwork — Debugbar alternative

No HTML injection. Data appears in browser DevTools (Chrome/Firefox extension).

```bash
composer require itsgoingd/clockwork
```

Better for APIs (Debugbar pollutes JSON responses). Install "Clockwork" browser extension.

---

## Full dev .env

```ini
APP_ENV=local
APP_DEBUG=true
LOG_CHANNEL=stack
LOG_LEVEL=debug
DEBUGBAR_ENABLED=true
TELESCOPE_ENABLED=true
RAY_ENABLED=true
```

---

## When to use each tool

| Contexto | Ferramenta |
|----------|-----------|
| Browser (HTML responses) | Debugbar |
| API debugging (JSON) | Clockwork ou Telescope |
| Jobs, mail, queues | Telescope |
| Investigar exception especifica | Ignition |
| Debug sem poluir output | Ray |
| Ler logs sem SSH | Log Viewer |
| Tail logs no terminal | Pail |
| N+1 detection | Debugbar + query-detector |

---

## Clean before deploy

```bash
# Check no ray() calls remain
grep -rn "ray(" app/ --include="*.php"

# Check Telescope not registered in production
grep -rn "TelescopeServiceProvider" app/Providers/
```

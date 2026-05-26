---
name: error-tracking-dev
description: "Development error tracking and debugging for Laravel. MUST be invoked when the user says: debugbar, telescope, ignition, ray, debug, debug panel, query inspector, N+1. SHOULD also invoke when: slow query dev, log viewer, clockwork, pail, desenvolvimento, development debug."
triggers: debugbar, telescope, ignition, ray, debug, debug panel, query inspector, N+1, slow query dev, log viewer, clockwork, pail, desenvolvimento, development debug, debug bar, barra debug, ver queries, ver logs, painel debug, erros dev, errors dev, dump, dd, stack trace dev
---

# Error Tracking — Development

Ferramentas de debug para desenvolvimento. Activar no inicio do projecto para tracking continuo de queries, exceptions, performance, e jobs.

**Activar automaticamente** quando `laravel-specialist` detecta ambiente local/dev.

---

## Setup rapido (novo projecto)

```bash
# Core — instalar tudo de uma vez
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

## 1. Debugbar — barra no browser

Mostra em tempo real no fundo do browser:

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

### Config recomendada
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

### N+1 detection automatico
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

### Medir blocos de codigo
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

## 2. Telescope — dashboard web

Dashboard em `/telescope`. Grava TUDO: requests, queries, jobs, mail, cache, exceptions.

### Registar so em dev
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
// composer.json — prevenir auto-discovery
"extra": {
    "laravel": {
        "dont-discover": ["laravel/telescope"]
    }
}
```

### Watchers essenciais
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

### Pruning obrigatorio
```php
// routes/console.php
Schedule::command('telescope:prune --hours=48')->daily();
```

---

## 3. Ignition — paginas de erro ricas

Pre-instalado no Laravel. Mostra:
- Stack trace interactivo (clicar para abrir no editor)
- Sugestoes de solucao automaticas
- Contexto: request, headers, session, query string

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

## 4. Ray — desktop debugger (opcional)

App desktop que recebe debug output sem poluir o browser ou logs. Excelente para jobs e eventos.

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

Licenca: EUR 49/ano. Free tier: 20 mensagens por sessao.

---

## 5. Log Viewer — logs no browser

```bash
composer require opcodesio/log-viewer --dev
```

Aceder em `{URL}/log-viewer`. Pesquisa, filtros por nivel, real-time tailing.

```php
// Autorizar acesso
LogViewer::auth(fn ($request) => $request->user()?->hasRole('admin'));
```

---

## 6. Pail — tail logs no terminal

```bash
composer require laravel/pail --dev
php artisan pail              # tail basico
php artisan pail -vv          # com stack traces
php artisan pail --level=error
php artisan pail --filter="QueryException"
php artisan pail --user=42    # filtrar por user
```

Requer `pcntl` extension (Linux/macOS).

---

## 7. Clockwork — alternativa ao Debugbar

Nao injecta HTML na pagina. Dados aparecem no DevTools do browser (Chrome/Firefox extension).

```bash
composer require itsgoingd/clockwork
```

Melhor para APIs (Debugbar polui respostas JSON). Instalar extension "Clockwork" no browser.

---

## .env desenvolvimento completo

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

## Quando activar cada ferramenta

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

## Limpar antes de deploy

```bash
# Verificar que nao ficaram ray() calls
grep -rn "ray(" app/ --include="*.php"

# Verificar que Telescope nao esta registado em producao
grep -rn "TelescopeServiceProvider" app/Providers/
```

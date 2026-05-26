---
name: horizon-queues
description: "Laravel queues and Horizon monitoring for production SaaS. MUST be invoked when the user says: queues, jobs, Horizon, workers, dispatching, chaining."
when_to_use: Activate for any queue-related work in Laravel projects: job classes, event listeners with ShouldQueue, queue connections (Redis/database/SQS), supervisor daemon setup, Horizon configuration, queue priorities, tenant-scoped jobs, or production worker monitoring.
disable-model-invocation: false
allowed-tools: Read Write Edit Bash
---

# Laravel Queues & Horizon

## Job Class

```php
class ProcessOrder implements ShouldQueue // ShouldBeUnique | ShouldBeEncrypted optional
{
    use Queueable; // add Batchable for batch support

    public int   $tries        = 3;
    public int   $timeout      = 120;   // max seconds per attempt
    public int   $maxExceptions = 2;    // fail after N distinct exceptions
    public bool  $failOnTimeout = true; // mark failed instead of re-queue on timeout
    public array $backoff      = [10, 60, 180]; // stepped delay between retries (seconds)
    public int   $uniqueFor    = 3600;  // ShouldBeUnique lock duration (seconds)

    public function __construct(public readonly int $orderId) {}

    public function handle(OrderService $service): void
    {
        $service->process($this->orderId);
    }

    public function failed(Throwable $e): void
    {
        // Called after final attempt. Do: notify owner, compensate, update DB status.
        Notification::send(User::find($this->ownerId), new JobFailed($e));
        Order::where('id', $this->orderId)->update(['status' => 'failed']);
    }

    public function retryUntil(): \DateTime  // replaces $tries with time window
    {
        return now()->addMinutes(30);
    }

    public function uniqueId(): string  // required with ShouldBeUnique
    {
        return (string) $this->orderId;
    }

    public function tags(): array  // Horizon dashboard tags
    {
        return ['order:'.$this->orderId];
    }
}
```

**ShouldBeUnique:** lock held until job completes — use `ShouldBeUniqueUntilProcessing` to release lock before `handle()` starts.
**ShouldBeEncrypted:** requires `APP_KEY` to be stable — key rotation breaks queued payloads.

## Dispatching

```php
ProcessOrder::dispatch($order->id);                           // async
ProcessOrder::dispatchSync($order->id);                       // blocking (no queue)
ProcessOrder::dispatch($order->id)->delay(now()->addMinutes(5));
ProcessOrder::dispatch($order->id)->onQueue('critical')->onConnection('redis');
ProcessOrder::dispatch($order->id)->afterCommit();            // after DB transaction
ProcessOrder::dispatchIf($condition, $order->id);
ProcessOrder::dispatchAfterResponse($order->id);              // after HTTP response sent
```

**Never dispatch inside a DB transaction without `->afterCommit()`** — job may run before commit completes.

## Chaining & Batching

```php
// Chain — sequential; stops on first failure
Bus::chain([
    new ValidateOrder($id),
    new ChargePayment($id),
    new SendConfirmation($id),
])->catch(fn(Throwable $e) => Order::markFailed($id))
  ->dispatch();

// Batch — parallel; callbacks on progress/completion
$batch = Bus::batch([
    new ProcessRow(1), new ProcessRow(2),
])->then(fn(Batch $b) => Import::complete($b->id))
  ->catch(fn(Batch $b, Throwable $e) => Import::fail($b->id))
  ->finally(fn(Batch $b) => event(new ImportFinished))
  ->name('CSV Import')
  ->allowFailures()  // continue batch even if individual jobs fail
  ->dispatch();
```

Inside a batchable job's `handle()`, always guard: `if ($this->batch()?->cancelled()) return;`

Run `php artisan make:queue-batches-table && php artisan migrate` before using batches.

## Queue Connections (config/queue.php)

```php
'default' => env('QUEUE_CONNECTION', 'redis'),

'connections' => [
    'redis' => [
        'driver'      => 'redis',
        'connection'  => 'default',
        'queue'       => '{default}',  // braces = Redis Cluster hash tag (keeps keys on same node)
        'retry_after' => 90,           // MUST be > job $timeout or job re-queues while still running
        'block_for'   => 5,
        'after_commit' => true,
    ],
    'database' => [
        'driver'      => 'database',
        'table'       => 'jobs',
        'queue'       => 'default',
        'retry_after' => 90,
        'after_commit' => true,
    ],
    'sqs' => [
        'driver'  => 'sqs',
        'key'     => env('AWS_ACCESS_KEY_ID'),
        'secret'  => env('AWS_SECRET_ACCESS_KEY'),
        'prefix'  => env('SQS_PREFIX'),
        'queue'   => env('SQS_QUEUE', 'default'),
        'region'  => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],
],
```

Run `php artisan make:queue-table && php artisan migrate` for database driver.

## Queue Priorities

Workers process queues left-to-right — earlier = higher priority:

```bash
php artisan queue:work --queue=critical,high,default,low
```

Dispatch to named queue: `->onQueue('critical')`

In Horizon supervisor, set `'queue' => ['critical', 'high', 'default', 'low']`.

## Laravel Horizon

### Installation
```bash
composer require laravel/horizon
php artisan horizon:install  # publishes config/horizon.php + HorizonServiceProvider
php artisan migrate          # only needed for batch support, not Horizon itself
```

### config/horizon.php

```php
'use'    => 'default',               // Redis connection — never name a connection 'horizon'
'prefix' => env('HORIZON_PREFIX', 'horizon:'),

'waits' => [
    'redis:critical' => 30,          // Trigger notification if queue waits >30s
    'redis:default'  => 60,
],

'trim' => [
    'recent'         => 60,          // minutes to keep completed job data
    'failed'         => 10080,       // 7 days for failed jobs
    'recent_failed'  => 10080,
    'monitored'      => 10080,
],

'environments' => [
    'production' => [
        'supervisor-1' => [
            'connection'          => 'redis',
            'queue'               => ['critical', 'high', 'default'],
            'balance'             => 'auto',          // auto | simple | false
            'autoScalingStrategy' => 'time',          // time | size
            'minProcesses'        => 2,
            'maxProcesses'        => 20,
            'balanceMaxShift'     => 2,               // max workers added/removed per cycle
            'balanceCooldown'     => 3,               // seconds between rebalance checks
            'tries'               => 3,
            'timeout'             => 90,
            'memory'              => 256,             // MB per worker before restart
            'force'               => false,           // true = process jobs in maintenance mode
        ],
        'supervisor-low' => [
            'connection'   => 'redis',
            'queue'        => ['low', 'notifications'],
            'balance'      => 'simple',
            'minProcesses' => 1,
            'maxProcesses' => 5,
        ],
    ],
    'local' => [
        'supervisor-1' => [
            'connection' => 'redis', 'queue' => ['default'],
            'balance' => 'simple', 'maxProcesses' => 3,
        ],
    ],
],
```

### Artisan Commands

```bash
php artisan horizon                           # Start (replaces queue:work in production)
php artisan horizon:status                    # running / paused / inactive
php artisan horizon:pause && horizon:continue # pause/resume all workers
php artisan horizon:terminate                 # graceful shutdown — run before every deploy
php artisan horizon:snapshot                  # collect metrics (schedule every 5 min)
php artisan horizon:forget {id}               # delete one failed job from dashboard
php artisan horizon:forget --all              # delete all failed jobs from dashboard
php artisan horizon:clear --queue=emails      # remove pending jobs from a queue
php artisan horizon:pause-supervisor supervisor-1
php artisan horizon:continue-supervisor supervisor-1
```

### Dashboard Auth (HorizonServiceProvider)

```php
protected function gate(): void
{
    Gate::define('viewHorizon', fn(?User $u) =>
        $u && in_array($u->email, config('horizon.allowed_emails', []))
    );
}
```

### Notifications & Metrics

```php
// In HorizonServiceProvider::boot()
Horizon::routeMailNotificationsTo('[email protected]');
Horizon::routeSlackNotificationsTo(env('SLACK_WEBHOOK'), '#ops');

// Schedule metrics collection (routes/console.php)
Schedule::command('horizon:snapshot')->everyFiveMinutes();
```

### Silencing Noisy Jobs

```php
// config/horizon.php
'silenced' => [App\Jobs\PollExternalApi::class],

// Or on the job class itself:
use Laravel\Horizon\Contracts\Silenced;
class PollExternalApi implements ShouldQueue, Silenced { use Queueable; }
```

## Production: Supervisor Daemon

`/etc/supervisor/conf.d/horizon.conf`:
```ini
[program:horizon]
process_name=%(program_name)s
command=php /var/www/artisan horizon
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/storage/logs/horizon.log
stopwaitsecs=3600
```

```bash
sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start horizon
```

**`stopwaitsecs` must exceed your longest job duration** — otherwise Supervisor force-kills Horizon mid-job on restart.
**Deploy sequence:** `horizon:terminate` → deploy code → Supervisor auto-restarts with new code.

## Failed Jobs (queue:* commands, not horizon:*)

```bash
php artisan queue:failed                   # list failed jobs
php artisan queue:retry {id}               # retry one
php artisan queue:retry --all              # retry all
php artisan queue:forget {id}              # delete one
php artisan queue:flush                    # delete all
php artisan queue:prune-failed --hours=168 # prune jobs older than 7 days
```

Fail a job from inside `handle()` immediately (skips remaining retries):
```php
$this->fail(new \RuntimeException('Unrecoverable error'));
```

Disable failed job storage entirely (`config/queue.php`):
```php
'failed' => ['driver' => 'null'],
```

## Multi-Tenant Queues (SaaS)

**Rule: never serialize a tenant-scoped Eloquent model — pass IDs as scalars only.**

### Pattern A — Manual context (no package)

```php
class ProcessTenantOrder implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $tenantId,
        public readonly int $orderId,
    ) {}

    public function handle(): void
    {
        app(TenantManager::class)->initialize($this->tenantId);
        try {
            Order::find($this->orderId)->process();  // scoped to tenant
        } finally {
            app(TenantManager::class)->end();        // always clean up
        }
    }
}
```

### Pattern B — stancl/tenancy package

`QueueTenancyBootstrapper` automatically carries tenant context from dispatch point. For jobs that must run in central context, use a dedicated connection:

```php
// config/queue.php
'central' => [
    'driver' => 'database', 'table' => 'jobs',
    'queue' => 'default', 'retry_after' => 90,
    'central' => true,  // prevents tenant bootstrapping
],
```

Dispatch: `dispatch(new GenerateReport())->onConnection('central');`

**Never mix central and tenant queue connections** — stale tenant state persists between jobs on the same worker.

### Horizon Multi-Tenant: Separate supervisors per connection

```php
'supervisor-tenant'  => ['connection' => 'redis',         'queue' => ['tenant-critical', 'tenant-default'], 'maxProcesses' => 15],
'supervisor-central' => ['connection' => 'redis-central', 'queue' => ['central'],                           'maxProcesses' => 3],
```

## Testing

```php
Queue::fake();                // all jobs intercepted, none executed

ProcessOrder::dispatch($order->id);

Queue::assertPushed(ProcessOrder::class);
Queue::assertPushed(ProcessOrder::class, fn($job) => $job->orderId === $order->id);
Queue::assertPushedOn('critical', ProcessOrder::class);
Queue::assertNotPushed(RefundOrder::class);
Queue::assertCount(1);

Queue::fake([ProcessOrder::class]);  // only fake this class; others execute normally
```

Test job logic directly (bypasses queue):
```php
(new ProcessOrder($order->id))->handle(app(OrderService::class));
$this->assertTrue(Order::find($order->id)->isProcessed());
```

Test chains/batches:
```php
Bus::fake();
Bus::chain([new StepA, new StepB])->dispatch();
Bus::assertDispatched(StepA::class);
Bus::assertBatched(fn(Batch $b) => $b->name === 'CSV Import' && $b->totalJobs === 2);
```

## Job Middleware

```php
use Illuminate\Queue\Middleware\{RateLimited, WithoutOverlapping, ThrottlesExceptions};

public function middleware(): array
{
    return [
        new RateLimited('exports'),              // rate-limit group defined in ServiceProvider
        new WithoutOverlapping($this->userId),   // no concurrent same-user jobs; queues others
        (new ThrottlesExceptions(10, 5 * 60))->backoff(5), // fail after 10 exceptions in 5 min
    ];
}
```

Define limiter in AppServiceProvider: `RateLimiter::for('exports', fn($job) => Limit::perHour(5)->by($job->userId));`

## Event Listeners on Queue

```php
class SendWelcomeEmail implements ShouldQueue
{
    public string $queue = 'notifications';
    public int    $delay = 30;  // seconds after event fires before processing

    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user)->send(new WelcomeEmail($event->user));
    }

    public function failed(UserRegistered $event, Throwable $e): void
    {
        Log::error('WelcomeEmail failed', ['user' => $event->user->id, 'error' => $e->getMessage()]);
    }
}
```

Register in EventServiceProvider normally — `ShouldQueue` makes it async automatically.

## Critical Pitfalls

| Pitfall | Fix |
|---|---|
| `retry_after` < job `$timeout` | Set `retry_after` to at least `$timeout + 30` |
| `stopwaitsecs` < longest job | Set `stopwaitsecs` to max job duration + buffer |
| Dispatch inside DB transaction | Add `->afterCommit()` to all dispatches inside transactions |
| `ShouldBeUnique` lock never released on failure | Switch to `ShouldBeUniqueUntilProcessing` |
| APP_KEY rotation with `ShouldBeEncrypted` jobs | Drain queue before rotating key |
| Redis Cluster without hash tags | Use `{queue-name}` braces in queue name |
| Tenant model in job constructor | Pass `$tenantId` scalar only; re-resolve in `handle()` |

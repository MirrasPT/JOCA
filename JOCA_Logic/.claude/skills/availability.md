---
name: availability
description: "Availability and disaster recovery for Laravel. MUST be invoked when the user says: backup, backups, disaster recovery, failover, replication, read replica, high availability, HA. SHOULD also invoke when: uptime, downtime, zero downtime, maintenance mode, artisan down, restore."
triggers: backup, backups, disaster recovery, failover, replication, read replica, high availability, HA, uptime, downtime, zero downtime, maintenance mode, artisan down, restore, recovery, RTO, RPO, redundancy, resilience, spatie backup, laravel backup, database backup, Redis Sentinel, MySQL replication, rolling deploy, blue green, disponibilidade, recuperacao, desastre
---

# Availability & Recovery

Backups, failover, zero-downtime deploys and recovery for Laravel.

**Activate** when `laravel-specialist` or `deploy-*` sets up production.

---

## 1. Backups (spatie/laravel-backup)

### Setup
```bash
composer require spatie/laravel-backup
php artisan vendor:publish --provider="Spatie\Backup\BackupServiceProvider"
```

### Config
```php
// config/backup.php
'backup' => [
    'name' => env('APP_NAME', 'laravel'),
    'source' => [
        'files' => [
            'include' => [base_path()],
            'exclude' => [
                base_path('vendor'),
                base_path('node_modules'),
                storage_path('logs'),
                storage_path('framework/cache'),
            ],
        ],
        'databases' => ['mysql'],
    ],
    'destination' => [
        'disks' => ['s3'],          // NUNCA so local
    ],
],
'cleanup' => [
    'strategy' => \Spatie\Backup\Tasks\Cleanup\Strategies\DefaultStrategy::class,
    'default_strategy' => [
        'keep_all_backups_for_days'                            => 7,
        'keep_daily_backups_for_days'                          => 30,
        'keep_weekly_backups_for_days'                         => 60,
        'keep_monthly_backups_for_months'                      => 6,
        'keep_yearly_backups_for_years'                        => 0,
        'delete_oldest_backups_when_using_more_megabytes_than' => 5000,
    ],
],
```

### S3/R2 disk
```php
// config/filesystems.php
'backup' => [
    'driver' => 's3',
    'key'    => env('BACKUP_AWS_ACCESS_KEY_ID'),
    'secret' => env('BACKUP_AWS_SECRET_ACCESS_KEY'),
    'region' => env('BACKUP_AWS_DEFAULT_REGION', 'eu-west-1'),
    'bucket' => env('BACKUP_AWS_BUCKET'),
    'root'   => env('APP_NAME', 'laravel') . '/backups',
],
```

Separate S3/R2 account from the app -- if app is compromised, backups survive.

### Schedule
```php
// bootstrap/app.php ou routes/console.php
Schedule::command('backup:run')->dailyAt('03:00');
Schedule::command('backup:run --only-db')->everyFourHours();
Schedule::command('backup:clean')->dailyAt('04:00');
Schedule::command('backup:monitor')->dailyAt('05:00');
```

### DB-only backup (fast, more frequent)
```bash
php artisan backup:run --only-db
```

### Monitoring
```php
// config/backup.php
'monitor_backups' => [
    [
        'name'          => env('APP_NAME'),
        'disks'         => ['s3'],
        'health_checks' => [
            \Spatie\Backup\Tasks\Monitor\HealthChecks\MaximumAgeInDays::class => 1,
            \Spatie\Backup\Tasks\Monitor\HealthChecks\MaximumStorageInMegabytes::class => 5000,
        ],
    ],
],
'notifications' => [
    'notifications' => [
        \Spatie\Backup\Notifications\Notifications\BackupHasFailedNotification::class         => ['mail', 'slack'],
        \Spatie\Backup\Notifications\Notifications\UnhealthyBackupWasFoundNotification::class => ['mail', 'slack'],
        \Spatie\Backup\Notifications\Notifications\BackupWasSuccessfulNotification::class     => ['slack'],
        \Spatie\Backup\Notifications\Notifications\CleanupHasFailedNotification::class        => ['mail', 'slack'],
    ],
    'mail' => ['to' => env('BACKUP_NOTIFY_EMAIL')],
    'slack' => ['webhook_url' => env('BACKUP_SLACK_WEBHOOK')],
],
```

### .env
```ini
BACKUP_AWS_ACCESS_KEY_ID=xxx
BACKUP_AWS_SECRET_ACCESS_KEY=xxx
BACKUP_AWS_DEFAULT_REGION=eu-west-1
BACKUP_AWS_BUCKET=myapp-backups
BACKUP_NOTIFY_EMAIL=[email protected]
BACKUP_SLACK_WEBHOOK=https://hooks.slack.com/services/xxx
```

---

## 2. Database Replication

### MySQL read replicas
```php
// config/database.php
'mysql' => [
    'read' => [
        'host' => [
            env('DB_READ_HOST_1', '127.0.0.1'),
            env('DB_READ_HOST_2', '127.0.0.1'),
        ],
    ],
    'write' => [
        'host' => [env('DB_WRITE_HOST', '127.0.0.1')],
    ],
    'sticky' => true,   // after write, reads go to writer in same request
    'driver' => 'mysql',
    'database' => env('DB_DATABASE'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
],
```

`sticky: true` avoids replication lag -- after INSERT, next SELECT reads from writer.

### Force writer on critical reads
```php
// When data must be 100% fresh (payments, stock)
DB::connection('mysql')->useWritePdo();
$balance = Account::find($id)->balance;

// Or via explicit connection
Account::on('mysql::write')->find($id);
```

### Redis Sentinel (auto failover)
```php
// config/database.php
'redis' => [
    'client' => 'phpredis',
    'default' => [
        'host'             => env('REDIS_SENTINEL_HOST', '127.0.0.1'),
        'port'             => env('REDIS_SENTINEL_PORT', 26379),
        'sentinel_service' => env('REDIS_SENTINEL_SERVICE', 'mymaster'),
        'password'         => env('REDIS_PASSWORD'),
        'database'         => 0,
    ],
],
```

```ini
REDIS_CLIENT=phpredis
REDIS_SENTINEL_HOST=sentinel-1.internal,sentinel-2.internal,sentinel-3.internal
REDIS_SENTINEL_PORT=26379
REDIS_SENTINEL_SERVICE=mymaster
```

Sentinel monitors Redis master; on failure, promotes a replica. Minimum 3 sentinels.

---

## 3. Zero-Downtime Deploys

### Envoy (Laravel-native)
```bash
composer require laravel/envoy --dev
```

```blade
{{-- Envoy.blade.php --}}
@servers(['web' => ['deploy@production.server']])

@setup
    $repository = 'git@github.com:org/app.git';
    $releases_dir = '/home/deploy/app/releases';
    $current_dir = '/home/deploy/app/current';
    $shared_dir = '/home/deploy/app/shared';
    $release = date('YmdHis');
    $new_release = $releases_dir . '/' . $release;
@endsetup

@story('deploy')
    clone_repository
    run_composer
    update_symlinks
    migrate
    optimize
    reload_services
    cleanup
@endstory

@task('clone_repository')
    echo "Cloning {{ $release }}"
    git clone --depth 1 {{ $repository }} {{ $new_release }}
@endtask

@task('run_composer')
    cd {{ $new_release }}
    composer install --no-dev --optimize-autoloader --no-interaction
@endtask

@task('update_symlinks')
    ln -nfs {{ $shared_dir }}/.env {{ $new_release }}/.env
    ln -nfs {{ $shared_dir }}/storage {{ $new_release }}/storage
    ln -nfs {{ $new_release }} {{ $current_dir }}
@endtask

@task('migrate')
    cd {{ $new_release }}
    php artisan migrate --force
@endtask

@task('optimize')
    cd {{ $new_release }}
    php artisan optimize
    php artisan cache:warm 2>/dev/null || true
@endtask

@task('reload_services')
    sudo systemctl reload php8.3-fpm
    cd {{ $new_release }} && php artisan horizon:terminate 2>/dev/null || true
    cd {{ $new_release }} && php artisan queue:restart
@endtask

@task('cleanup')
    cd {{ $releases_dir }} && ls -dt */ | tail -n +6 | xargs rm -rf
@endtask
```

```bash
envoy run deploy
```

Symlink swap (`ln -nfs`) is atomic -- zero downtime. Keep 5 releases for instant rollback.

### Instant rollback
```bash
# Point symlink to previous release
ln -nfs /home/deploy/app/releases/YYYYMMDDHHMMSS /home/deploy/app/current
sudo systemctl reload php8.3-fpm
```

Rollback in <5 seconds. No git pull or composer install needed.

### Safe migrations (zero-downtime)

| Operation | Safe? | How |
|----------|-------|-----|
| Add column (nullable) | Yes | `$table->string('x')->nullable()` |
| Add column (NOT NULL default) | Yes (MySQL 8+) | `$table->string('x')->default('y')` |
| Add index | Yes | `$table->index('col')` |
| Drop column | 2 deploys | Deploy 1: remove from code. Deploy 2: drop migration |
| Rename column | 2 deploys | Deploy 1: add new + backfill. Deploy 2: drop old |
| Rename table | 2 deploys | Deploy 1: create new + view alias. Deploy 2: drop old |
| Change column type | Depends | Add new column + backfill + swap |

**Golden rule:** never remove/rename something the current code still uses.

---

## 4. Maintenance Mode

### Basic
```bash
php artisan down                           # 503 for all
php artisan down --secret="bypass-token"   # access via /bypass-token
php artisan down --redirect=/              # redirect instead of 503
php artisan down --render="errors::503"    # custom view
php artisan down --retry=60                # Retry-After header
php artisan up                              # back to normal
```

### Pre-rendered maintenance page
```bash
php artisan down --render="errors::503" --status=503
```

The view must be self-contained (inline CSS, no external assets) -- during maintenance the framework may not serve normal assets.

### Bypass by IP (custom middleware)
```php
class AllowMaintenanceBypass
{
    public function handle($request, $next)
    {
        $allowed = explode(',', env('MAINTENANCE_ALLOWED_IPS', ''));
        if (app()->isDownForMaintenance() && !in_array($request->ip(), $allowed)) {
            abort(503);
        }
        return $next($request);
    }
}
```

### Maintenance-safe deploy pattern
```bash
php artisan down --secret="deploy-$(date +%s)"
php artisan migrate --force
php artisan optimize
php artisan up
```

For zero-downtime: use Envoy symlink deploy instead of maintenance mode.

---

## 5. Queue Resilience

### Retry and backoff
```php
class ProcessPayment implements ShouldQueue
{
    public int $tries = 5;
    public int $maxExceptions = 3;
    public int $timeout = 120;

    public function backoff(): array
    {
        return [10, 30, 60, 300, 900]; // exponential
    }

    public function retryUntil(): DateTime
    {
        return now()->addHours(24);
    }

    public function failed(\Throwable $e): void
    {
        Log::critical('Payment failed permanently', [
            'order_id' => $this->order->id,
            'error'    => $e->getMessage(),
        ]);
    }
}
```

### Dead letter / failed jobs
```bash
php artisan queue:failed                    # list
php artisan queue:retry all                 # retry all
php artisan queue:retry 5                   # retry job #5
php artisan queue:flush                     # clear all (careful)
```

### Horizon failover (multiple supervisors)
```php
// config/horizon.php
'environments' => [
    'production' => [
        'critical-supervisor' => [
            'connection' => 'redis',
            'queue'      => ['critical', 'payments'],
            'balance'    => 'auto',
            'minProcesses' => 2,     // never below 2
            'maxProcesses' => 10,
            'tries'        => 5,
        ],
        'default-supervisor' => [
            'connection' => 'redis',
            'queue'      => ['default', 'emails', 'notifications'],
            'balance'    => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => 5,
            'tries'        => 3,
        ],
    ],
],
```

Separate queues by criticality. Payments never share workers with emails.

---

## 6. Recovery Runbook

### RTO/RPO targets

| Component | RPO (max data loss) | RTO (time to recover) |
|-----------|--------------------|-----------------------|
| Database | 4h (backup each 4h) | 30min |
| Uploads/media | 24h (daily backup) | 1h |
| Redis cache | 0 (rebuildable) | 5min (restart) |
| Queue jobs | 0 (persistent) | 5min (restart workers) |
| App code | 0 (git) | 5min (rollback symlink) |

### Restore database
```bash
# List available backups
aws s3 ls s3://myapp-backups/myapp/backups/ --recursive | tail -10

# Download
aws s3 cp s3://myapp-backups/myapp/backups/2026-05-25-03-00-00.zip /tmp/restore.zip

# Restore (spatie/laravel-backup)
unzip /tmp/restore.zip -d /tmp/restore
mysql -u root -p myapp < /tmp/restore/db-dumps/mysql-myapp.sql

# Verify
php artisan tinker --execute="echo User::count();"
```

### Full restore
```bash
# 1. Database
mysql -u root -p myapp < /tmp/restore/db-dumps/mysql-myapp.sql

# 2. Uploads (if needed)
aws s3 sync s3://myapp-backups/myapp/backups/latest/storage/ /home/deploy/app/shared/storage/

# 3. Verify integrity
php artisan migrate:status                  # migrations OK
php artisan tinker --execute="DB::select('SELECT 1');"  # DB OK
php artisan cache:clear                     # clear stale cache

# 4. Restart services
sudo systemctl restart php8.3-fpm
php artisan queue:restart
php artisan horizon:terminate && php artisan horizon
```

### Incident timeline template
```
[HH:MM] Detection: how it was detected (alert, report, monitoring)
[HH:MM] Triage: what is down, estimated impact
[HH:MM] Communication: stakeholders/clients notified
[HH:MM] Mitigation: immediate action (rollback, restart, scale)
[HH:MM] Resolution: fix applied
[HH:MM] Verification: confirmed working (health checks, smoke tests)
[HH:MM] Post-mortem: root causes, preventive actions
```

---

## .env production

```ini
# Backups
BACKUP_AWS_ACCESS_KEY_ID=xxx
BACKUP_AWS_SECRET_ACCESS_KEY=xxx
BACKUP_AWS_DEFAULT_REGION=eu-west-1
BACKUP_AWS_BUCKET=myapp-backups
BACKUP_NOTIFY_EMAIL=[email protected]
BACKUP_SLACK_WEBHOOK=https://hooks.slack.com/services/xxx

# Database replication
DB_WRITE_HOST=primary.db.internal
DB_READ_HOST_1=replica-1.db.internal
DB_READ_HOST_2=replica-2.db.internal

# Redis Sentinel
REDIS_SENTINEL_HOST=sentinel-1.internal,sentinel-2.internal,sentinel-3.internal
REDIS_SENTINEL_PORT=26379
REDIS_SENTINEL_SERVICE=mymaster

# Maintenance
MAINTENANCE_ALLOWED_IPS=1.2.3.4,5.6.7.8
```

---

## Production checklist

- [ ] `spatie/laravel-backup` installed and configured
- [ ] DB backups every 4h, full daily
- [ ] Backups go to S3/R2 on SEPARATE account
- [ ] `backup:monitor` scheduled daily
- [ ] Backup failure notifications configured (mail + slack)
- [ ] Restore tested at least once (never trust untested backups)
- [ ] Read replicas configured (if >1000 req/min)
- [ ] `sticky: true` active in database config
- [ ] Redis Sentinel configured (if Redis is critical)
- [ ] Atomic deploy via Envoy or equivalent (symlink swap)
- [ ] 5 releases kept for instant rollback
- [ ] Migrations follow zero-downtime rules
- [ ] Maintenance page pre-rendered and self-contained
- [ ] Queue supervisors separated by criticality
- [ ] `failed()` method on critical jobs
- [ ] RTO/RPO defined and documented
- [ ] Restore runbook accessible to the whole team

---

## Quality gate
After implementing availability: "Queres `tester-security`?" (verify backups don't expose data, health endpoints are protected)

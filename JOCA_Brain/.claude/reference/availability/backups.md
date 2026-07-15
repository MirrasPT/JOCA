Parte da skill `availability` — carregado on-demand via `Read(".claude/reference/availability/backups.md")` ao configurar ou rever backups.

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

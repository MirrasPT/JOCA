Parte da skill `availability` — carregado on-demand via `Read(".claude/reference/availability/recovery-runbook.md")` em incidentes, restores e resiliência de queues. (Tabela RTO/RPO vive no corpo da skill.)

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

## 6. Recovery Runbook

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

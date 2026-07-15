---
name: availability
description: "Availability and disaster recovery for Laravel. MUST be invoked when the user says: backup, backups, disaster recovery, failover, replication, read replica, high availability, HA. SHOULD also invoke when: uptime, downtime, zero downtime, maintenance mode, artisan down, restore."
triggers: backup, backups, disaster recovery, failover, replication, read replica, high availability, HA, uptime, downtime, zero downtime, maintenance mode, artisan down, restore, recovery, RTO, RPO, redundancy, resilience, spatie backup, laravel backup, database backup, Redis Sentinel, MySQL replication, rolling deploy, blue green, disponibilidade, recuperacao, desastre
chain: tester-security
---

# Availability & Recovery

Backups, failover, zero-downtime deploys and recovery for Laravel.

**Activate** when `laravel-specialist` or `deploy-*` sets up production.

---

## RTO/RPO targets

| Component | RPO (max data loss) | RTO (time to recover) |
|-----------|--------------------|-----------------------|
| Database | 4h (backup each 4h) | 30min |
| Uploads/media | 24h (daily backup) | 1h |
| Redis cache | 0 (rebuildable) | 5min (restart) |
| Queue jobs | 0 (persistent) | 5min (restart workers) |
| App code | 0 (git) | 5min (rollback symlink) |

---

## Safe migrations (zero-downtime)

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

## Referências (carregar on-demand)

| Tema | Reference | Carregar quando |
|---|---|---|
| Backups (spatie/laravel-backup: setup, config, S3/R2 disk, schedule, monitoring, .env) | `Read(".claude/reference/availability/backups.md")` | configurar/rever backups |
| Replicação (MySQL read replicas, sticky, force writer, Redis Sentinel) | `Read(".claude/reference/availability/replication.md")` | read replicas, failover Redis |
| Zero-downtime deploy (Envoy symlink, instant rollback, maintenance mode + bypass) | `Read(".claude/reference/availability/zero-downtime-deploy.md")` | deploy sem downtime, artisan down, rollback |
| Recovery runbook (queue resilience/retries/Horizon, restore DB/full, incident timeline) | `Read(".claude/reference/availability/recovery-runbook.md")` | incidente, restore, failed jobs |

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

---
name: php-stack
description: PHP 8.3+, Laravel 10+, and PostgreSQL specialist. Use for PHP applications, Laravel APIs, Eloquent models, Sanctum auth, Horizon queues, Livewire components, PostgreSQL optimization, JSONB, replication. Triggers: PHP, Laravel, Eloquent, Sanctum, Horizon, Livewire, Artisan, Blade, Composer, PHPStan, PSR, PostgreSQL, Postgres, EXPLAIN ANALYZE, JSONB, pgvector, VACUUM.
---

PHP 8.3+ · Laravel 10+ · PostgreSQL stack.

ENFORCE: `strict_types=1` · PHPStan L9 · PSR-12 · typed properties/params/returns · readonly properties · DI over global state · API resources for responses · eager loading (no N+1) · >80% test coverage · `EXPLAIN (ANALYZE, BUFFERS)` before complex queries · proper index type (B-tree/GIN/GiST/BRIN) · `ANALYZE` after bulk ops

LARAVEL: Eloquent relationships/scopes/casts · Sanctum token auth · Horizon for queue monitoring · Livewire wire:model + actions · service layer (no business logic in controllers) · factories + Pest feature tests

POSTGRES: JSONB for dynamic schemas + GIN indexes · streaming/logical replication · VACUUM + autovacuum tuning · `pg_stat_activity` / `pg_stat_user_tables` for monitoring

NEVER: raw queries without binding (SQL injection) · plain-text passwords · N+1 without eager loading · business logic in controllers · hardcoded config · skip input validation · deprecated Laravel features · ignore queue failures

REF (load on demand):
- Eloquent → `references/eloquent.md`
- Routing/API → `references/routing.md`
- Queues/Horizon → `references/queues.md`
- Livewire → `references/livewire.md`
- Testing → `references/testing.md` · `references/testing-quality.md`
- Modern PHP 8.3+ → `references/modern-php-features.md`
- Async (Swoole/ReactPHP) → `references/async-patterns.md`
- PostgreSQL JSONB → `references/jsonb.md`
- PostgreSQL replication → `references/replication.md`
- PostgreSQL performance → `references/performance.md`

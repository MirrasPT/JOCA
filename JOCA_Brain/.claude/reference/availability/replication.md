Parte da skill `availability` — carregado on-demand via `Read(".claude/reference/availability/replication.md")` para read replicas MySQL e failover Redis.

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

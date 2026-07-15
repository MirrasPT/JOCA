> Parte da skill `reverb-realtime` — carregado on-demand via Read().

## Production Deployment

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name ws.example.com;

    # SSL config here

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host             $http_host;
        proxy_set_header Scheme           $scheme;
        proxy_set_header SERVER_PORT      $server_port;
        proxy_set_header REMOTE_ADDR      $remote_addr;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade          $http_upgrade;
        proxy_set_header Connection       "Upgrade";
        proxy_pass http://127.0.0.1:8080;
    }
}

# Tune Nginx for high connection counts:
worker_rlimit_nofile 10000;
events { worker_connections 10000; multi_accept on; }
```

Set OS file descriptor limit (`/etc/security/limits.conf`):
```
www-data  soft  nofile  10000
www-data  hard  nofile  10000
```

### Supervisor Daemon

`/etc/supervisor/conf.d/reverb.conf`:
```ini
[program:reverb]
process_name=%(program_name)s
command=php /var/www/artisan reverb:start --host="0.0.0.0" --port="8080" --hostname="ws.example.com"
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/storage/logs/reverb.log
stopwaitsecs=30

[supervisord]
minfds=10000
```

Deploy: `reverb:restart` -- Supervisor restarts cleanly (drains connections first).

### Performance

Install `ext-uv` for >1,000 concurrent connections:
```bash
pecl install uv
# Reverb auto-detects and uses it instead of stream_select
```

### Horizontal Scaling

```env
REVERB_SCALING_ENABLED=true
```

Requires shared Redis. All Reverb nodes subscribe to the same pub/sub channel. Place nodes behind a load balancer (sticky sessions not required -- pub/sub distributes to all).

Run `php artisan pulse:check` on one node only for Reverb metrics.

## Laravel Pulse (Monitoring)

```php
// config/pulse.php
'recorders' => [
    \Laravel\Reverb\Pulse\Recorders\ReverbConnections::class => ['sample_rate' => 1],
    \Laravel\Reverb\Pulse\Recorders\ReverbMessages::class    => ['sample_rate' => 1],
],
```

```blade
{{-- Pulse dashboard --}}
<x-pulse>
    <livewire:reverb.connections cols="full" />
    <livewire:reverb.messages cols="full" />
</x-pulse>
```

## Pusher as Fallback

Switch to Pusher by changing `.env` only:

```env
BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=your-pusher-app-id
PUSHER_APP_KEY=your-pusher-app-key
PUSHER_APP_SECRET=your-pusher-app-secret
PUSHER_APP_CLUSTER=eu
```

Frontend (`resources/js/echo.js`), swap the broadcaster:
```javascript
window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
});
```

No PHP changes needed -- Reverb speaks the Pusher protocol, so `routes/channels.php` auth and event classes stay identical.

---
name: reverb-realtime
description: "Laravel Reverb (WebSocket server) + Laravel Echo (frontend) for real-time features in Laravel SaaS. MUST be invoked when the user says: real-time, WebSockets, broadcasting, Reverb, Echo, presence."
when_to_use: Activate for any broadcasting or WebSocket work in Laravel: ShouldBroadcast events, channel authorization in routes/channels.php, Laravel Echo frontend integration, Reverb production deployment (Nginx/Caddy, SSL, horizontal scaling), client events (whisper), notification broadcasting, or Event::fake() testing of broadcast events.
disable-model-invocation: false
allowed-tools: Read Write Edit Bash
---

# Laravel Reverb + Broadcasting

## Installation

```bash
php artisan install:broadcasting
# Installs Reverb, publishes config/broadcasting.php, creates routes/channels.php
# Configures .env with BROADCAST_CONNECTION=reverb
```

Required .env variables:
```env
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=my-app-id
REVERB_APP_KEY=my-app-key
REVERB_APP_SECRET=my-app-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

Frontend:
```bash
npm install --save-dev laravel-echo pusher-js
# laravel-echo >= 1.16.0 required for Reverb broadcaster
```

## Running Reverb

```bash
php artisan reverb:start                             # Start on 0.0.0.0:8080
php artisan reverb:start --host=127.0.0.1 --port=9000
php artisan reverb:start --debug                     # Verbose connection logging
php artisan reverb:restart                           # Graceful restart (drain connections first)
```

**Queue must be running** — broadcast events are dispatched as queued jobs. Run `php artisan queue:work` alongside Reverb.

## Broadcast Events

```php
use Illuminate\Broadcasting\{Channel, PrivateChannel, PresenceChannel};
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class OrderStatusUpdated implements ShouldBroadcast
{
    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('orders.'.$this->order->id)];
    }

    public function broadcastAs(): string
    {
        return 'order.updated';  // frontend listens to this name, not class name
    }

    public function broadcastWith(): array
    {
        return [
            'id'     => $this->order->id,
            'status' => $this->order->status,
        ];
        // Return only what the frontend needs — never serialize full Eloquent models
    }

    public function broadcastWhen(): bool
    {
        return $this->order->isDirty('status');  // conditional broadcast
    }

    public function broadcastQueue(): string
    {
        return 'broadcasts';  // custom queue name
    }
}
```

**ShouldBroadcastNow** — skip queue, broadcast synchronously (bypasses queue worker requirement):
```php
class OrderStatusUpdated implements ShouldBroadcastNow { ... }
```

**afterCommit()** — if dispatching inside a DB transaction, add `->afterCommit()` to the dispatch call or use `$dispatchesEvents` with `afterCommit: true` — otherwise event may fire before commit.

## Dispatching Broadcast Events

```php
// Standard — queued by default
OrderStatusUpdated::dispatch($order);

// Using broadcast() helper — supports ->toOthers()
broadcast(new OrderStatusUpdated($order));
broadcast(new OrderStatusUpdated($order))->toOthers();  // exclude sender's socket

// Anonymous broadcast (no event class needed)
Broadcast::on('orders.'.$order->id)
    ->as('order.updated')
    ->with(['status' => $order->status])
    ->send();
```

**`toOthers()`** requires frontend to send `X-Socket-ID` header in HTTP requests:
```javascript
axios.defaults.headers.common['X-Socket-ID'] = Echo.socketId();
```

## Channel Types

| Type | Class | Auth required | Use for |
|------|-------|---------------|---------|
| Public | `Channel` | No | Non-sensitive data |
| Private | `PrivateChannel` | Yes (user auth) | User/resource-specific data |
| Presence | `PresenceChannel` | Yes (user data) | User lists, who's online |

## Channel Authorization (routes/channels.php)

```php
// Private channel — return true/false
Broadcast::channel('orders.{orderId}', function (User $user, int $orderId) {
    return $user->id === Order::findOrFail($orderId)->user_id;
});

// Model binding (resolves Order from DB automatically)
Broadcast::channel('orders.{order}', function (User $user, Order $order) {
    return $user->id === $order->user_id;
});

// Policy-based auth
Broadcast::channel('orders.{order}', function (User $user, Order $order) {
    return $user->can('view', $order);
});

// Presence channel — return array of user data (not bool)
Broadcast::channel('chat.{roomId}', function (User $user, int $roomId) {
    if ($user->canJoinRoom($roomId)) {
        return ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url];
    }
    // return null/false to deny access
});
```

Use channel classes for complex logic:
```bash
php artisan make:channel OrderChannel
```
```php
Broadcast::channel('orders.{order}', OrderChannel::class);
```

## Laravel Echo — Frontend

```javascript
// resources/js/echo.js (or bootstrap.js)
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    // Pusher fallback (if Reverb is down):
    // broadcaster: 'pusher',
    // key: import.meta.env.VITE_PUSHER_APP_KEY,
    // cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
});
```

## Listening to Events

```javascript
// Public channel
Echo.channel('announcements')
    .listen('AnnouncementPublished', (e) => console.log(e));

// Private channel
Echo.private(`orders.${orderId}`)
    .listen('OrderStatusUpdated', (e) => {
        // e.id, e.status — matches broadcastWith() return
    })
    .listen('.order.updated', (e) => { });  // dot prefix = custom broadcastAs() name

// Stop listening
Echo.private(`orders.${orderId}`).stopListening('OrderStatusUpdated');

// Leave channel entirely
Echo.leave(`orders.${orderId}`);         // leaves private AND presence
Echo.leaveChannel(`orders.${orderId}`);  // leaves only the specific variant
```

## Presence Channels

```javascript
Echo.join(`chat.${roomId}`)
    .here((users) => {
        // users = array of all currently connected users (from channel auth return value)
        this.onlineUsers = users;
    })
    .joining((user) => {
        this.onlineUsers.push(user);
    })
    .leaving((user) => {
        this.onlineUsers = this.onlineUsers.filter(u => u.id !== user.id);
    })
    .listen('NewChatMessage', (e) => {
        this.messages.push(e.message);
    })
    .error((error) => {
        console.error('Presence channel error', error);
    });
```

## Client Events (Whisper)

Peer-to-peer events without hitting the server — private and presence channels only:

```javascript
// Send whisper
Echo.private(`chat.${roomId}`)
    .whisper('typing', { userId: this.user.id, name: this.user.name });

// Receive whisper
Echo.private(`chat.${roomId}`)
    .listenForWhisper('typing', (e) => {
        this.typingUsers[e.userId] = e.name;
        setTimeout(() => delete this.typingUsers[e.userId], 3000);
    });
```

Enable client events in `config/reverb.php`:
```php
'apps' => [['client_messages' => true, ...]],
```

## Notification Broadcasting

```php
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class OrderShipped extends Notification implements ShouldBroadcast
{
    public function via($notifiable): array
    {
        return ['broadcast', 'mail'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'order_id' => $this->order->id,
            'message'  => 'Your order has shipped.',
        ]);
    }
    // Channel: App.Models.User.{id} (automatic for notifiable User model)
}
```

Frontend:
```javascript
Echo.private(`App.Models.User.${userId}`)
    .notification((notification) => {
        // notification.type = 'App\\Notifications\\OrderShipped'
        // notification.order_id, notification.message
        this.notifications.push(notification);
    });
```

## Model Broadcasting (Eloquent)

```php
use Illuminate\Database\Eloquent\BroadcastsEvents;

class Post extends Model
{
    use BroadcastsEvents;

    public function broadcastOn(string $event): array
    {
        return match ($event) {
            'deleted' => [],                     // don't broadcast deletes
            default   => [$this, $this->user],   // broadcast on model channel + user channel
        };
    }
}
```

Frontend listens for `.PostCreated`, `.PostUpdated`, `.PostTrashed` (dot-prefixed, camel-cased):
```javascript
Echo.private(`App.Models.User.${userId}`)
    .listen('.PostUpdated', (e) => console.log(e.model));
```

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

**Deploy sequence:** `reverb:restart` → Supervisor restarts cleanly (drains all connections first).

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

Requires a shared Redis instance. All Reverb nodes subscribe to the same pub/sub channel. Put all nodes behind a load balancer (sticky sessions not required — pub/sub distributes to all nodes).

Run `php artisan pulse:check` on **one node only** to collect Reverb metrics.

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

## Testing Broadcasting

```php
use Illuminate\Support\Facades\Event;

Event::fake();

OrderStatusUpdated::dispatch($order);

Event::assertDispatched(OrderStatusUpdated::class);
Event::assertDispatched(OrderStatusUpdated::class, fn($e) => $e->order->id === $order->id);
Event::assertNotDispatched(OrderCancelled::class);
```

Test channel authorization endpoints directly:
```php
// Private channel — authorized user
$this->actingAs($owner)
     ->post('/broadcasting/auth', ['channel_name' => 'private-orders.'.$order->id])
     ->assertStatus(200);

// Private channel — unauthorized user
$this->actingAs($stranger)
     ->post('/broadcasting/auth', ['channel_name' => 'private-orders.'.$order->id])
     ->assertStatus(403);

// Presence channel — check returned user data shape
$this->actingAs($member)
     ->post('/broadcasting/auth', ['channel_name' => 'presence-chat.'.$room->id])
     ->assertStatus(200)
     ->assertJsonStructure(['channel_data' => ['user_id', 'user_info']]);
```

Test broadcastWith() payload without running Reverb:
```php
$event = new OrderStatusUpdated($order);
$this->assertEquals(['id' => $order->id, 'status' => $order->status], $event->broadcastWith());
$this->assertEquals('order.updated', $event->broadcastAs());
$this->assertEquals([new PrivateChannel('orders.'.$order->id)], $event->broadcastOn());
```

## Pusher as Fallback

If Reverb is unavailable, switch to Pusher by changing `.env` only:

```env
BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=your-pusher-app-id
PUSHER_APP_KEY=your-pusher-app-key
PUSHER_APP_SECRET=your-pusher-app-secret
PUSHER_APP_CLUSTER=eu
```

Frontend (`resources/js/echo.js`), swap out the broadcaster:
```javascript
window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
});
```

No PHP code changes needed — Reverb speaks the Pusher protocol, so `routes/channels.php` auth and event classes are identical.

## Critical Pitfalls

| Pitfall | Fix |
|---|---|
| WebSocket connects but events don't arrive | Verify queue worker is running — broadcast jobs require a worker |
| `toOthers()` delivers to sender | Send `X-Socket-ID: Echo.socketId()` header on all HTTP requests |
| Private channel auth 403 | Check `routes/channels.php` is loaded; auth route is `/broadcasting/auth` by default |
| Presence channel returns `{}` for users | Channel auth callback must return an array, not `true` |
| Reverb restart drops active connections | Use `reverb:restart` not process kill — it drains connections first |
| High connection count causes "too many open files" | Set `ulimit -n 10000` + Supervisor `minfds=10000` |
| broadcastWith() serializes Eloquent model | Return only scalar/array values — never Eloquent instances |
| Horizontal scaling — events only reach some users | Enable `REVERB_SCALING_ENABLED=true` + shared Redis |

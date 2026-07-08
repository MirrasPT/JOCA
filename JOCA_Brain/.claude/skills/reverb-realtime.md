---
name: reverb-realtime
description: "Laravel Reverb (WebSocket server) + Laravel Echo (frontend) for real-time features in Laravel SaaS. MUST be invoked when the user says: real-time, WebSockets, broadcasting, Reverb, Echo, presence."
when_to_use: Activate for broadcasting or WebSocket work in Laravel: ShouldBroadcast events, channel auth in routes/channels.php, Echo frontend integration, Reverb production deploy (Nginx/Caddy, SSL, scaling), client events (whisper), notification broadcasting, or Event::fake() testing.
disable-model-invocation: false
allowed-tools: Read Write Edit Bash
chain: tester-code
---

# Laravel Reverb + Broadcasting

## Installation

```bash
php artisan install:broadcasting
# Installs Reverb, publishes config/broadcasting.php, creates routes/channels.php
# Configures .env with BROADCAST_CONNECTION=reverb
```

Required .env:
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
php artisan reverb:restart                           # Graceful restart (drains first)
```

Queue must run alongside Reverb -- broadcast events dispatch as queued jobs. Run `php artisan queue:work`.

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
        // Return only what frontend needs -- never serialize full Eloquent models
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

**ShouldBroadcastNow** -- skip queue, broadcast synchronously:
```php
class OrderStatusUpdated implements ShouldBroadcastNow { ... }
```

**afterCommit()** -- when dispatching inside a DB transaction, add `->afterCommit()` or use `$dispatchesEvents` with `afterCommit: true`. Otherwise event may fire before commit.

## Dispatching Broadcast Events

```php
// Standard -- queued by default
OrderStatusUpdated::dispatch($order);

// broadcast() helper -- supports ->toOthers()
broadcast(new OrderStatusUpdated($order));
broadcast(new OrderStatusUpdated($order))->toOthers();  // exclude sender's socket

// Anonymous broadcast (no event class needed)
Broadcast::on('orders.'.$order->id)
    ->as('order.updated')
    ->with(['status' => $order->status])
    ->send();
```

`toOthers()` requires frontend to send `X-Socket-ID` header:
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
// Private channel -- return true/false
Broadcast::channel('orders.{orderId}', function (User $user, int $orderId) {
    return $user->id === Order::findOrFail($orderId)->user_id;
});

// Model binding (resolves Order automatically)
Broadcast::channel('orders.{order}', function (User $user, Order $order) {
    return $user->id === $order->user_id;
});

// Policy-based auth
Broadcast::channel('orders.{order}', function (User $user, Order $order) {
    return $user->can('view', $order);
});

// Presence channel -- return user data array (not bool)
Broadcast::channel('chat.{roomId}', function (User $user, int $roomId) {
    if ($user->canJoinRoom($roomId)) {
        return ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url];
    }
    // return null/false to deny
});
```

Channel classes for complex logic:
```bash
php artisan make:channel OrderChannel
```
```php
Broadcast::channel('orders.{order}', OrderChannel::class);
```

## Laravel Echo -- Frontend

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
        // e.id, e.status -- matches broadcastWith() return
    })
    .listen('.order.updated', (e) => { });  // dot prefix = custom broadcastAs() name

// Stop listening
Echo.private(`orders.${orderId}`).stopListening('OrderStatusUpdated');

// Leave channel
Echo.leave(`orders.${orderId}`);         // leaves private AND presence
Echo.leaveChannel(`orders.${orderId}`);  // leaves only the specific variant
```

## Critical Pitfalls

| Pitfall | Fix |
|---|---|
| WebSocket connects but events don't arrive | Verify queue worker is running -- broadcast jobs need a worker |
| `toOthers()` delivers to sender | Send `X-Socket-ID: Echo.socketId()` header on all HTTP requests |
| Private channel auth 403 | Check `routes/channels.php` is loaded; auth route is `/broadcasting/auth` |
| Presence channel returns `{}` for users | Channel auth callback must return an array, not `true` |
| Reverb restart drops connections | Use `reverb:restart` not process kill -- drains connections first |
| High connection count "too many open files" | Set `ulimit -n 10000` + Supervisor `minfds=10000` |
| broadcastWith() serializes Eloquent model | Return only scalar/array values -- never Eloquent instances |
| Horizontal scaling -- events reach some users only | Enable `REVERB_SCALING_ENABLED=true` + shared Redis |

## Referências (carregar on-demand)

| Referência | Quando |
|---|---|
| `Read(".claude/reference/reverb-realtime/presence-whisper.md")` | Presence channels (here/joining/leaving), client events/whisper (typing), notification broadcasting, model broadcasting (Eloquent) |
| `Read(".claude/reference/reverb-realtime/production-deploy.md")` | Deploy em produção: Nginx reverse proxy, Supervisor, ext-uv, scaling horizontal (Redis), Pulse monitoring, fallback Pusher |
| `Read(".claude/reference/reverb-realtime/testing.md")` | Testar broadcasting: Event::fake(), auth de canais via /broadcasting/auth, payload broadcastWith() |

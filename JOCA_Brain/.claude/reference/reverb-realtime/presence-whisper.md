> Parte da skill `reverb-realtime` — carregado on-demand via Read().

## Presence Channels

```javascript
Echo.join(`chat.${roomId}`)
    .here((users) => {
        // users = all currently connected users (from channel auth return)
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

Peer-to-peer events without hitting the server -- private and presence channels only:

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
    // Channel: App.Models.User.{id} (automatic for notifiable User)
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
            default   => [$this, $this->user],   // broadcast on model + user channel
        };
    }
}
```

Frontend listens for `.PostCreated`, `.PostUpdated`, `.PostTrashed` (dot-prefixed, camel-cased):
```javascript
Echo.private(`App.Models.User.${userId}`)
    .listen('.PostUpdated', (e) => console.log(e.model));
```

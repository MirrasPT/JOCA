> Parte da skill `reverb-realtime` — carregado on-demand via Read().

## Testing Broadcasting

```php
use Illuminate\Support\Facades\Event;

Event::fake();

OrderStatusUpdated::dispatch($order);

Event::assertDispatched(OrderStatusUpdated::class);
Event::assertDispatched(OrderStatusUpdated::class, fn($e) => $e->order->id === $order->id);
Event::assertNotDispatched(OrderCancelled::class);
```

Test channel auth endpoints directly:
```php
// Private channel -- authorized user
$this->actingAs($owner)
     ->post('/broadcasting/auth', ['channel_name' => 'private-orders.'.$order->id])
     ->assertStatus(200);

// Private channel -- unauthorized user
$this->actingAs($stranger)
     ->post('/broadcasting/auth', ['channel_name' => 'private-orders.'.$order->id])
     ->assertStatus(403);

// Presence channel -- check returned user data shape
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

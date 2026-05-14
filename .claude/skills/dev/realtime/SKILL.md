---
name: realtime
description: Implement real-time features using WebSockets, Server-Sent Events (SSE), or polling. Covers bidirectional communication, reconnection with exponential backoff, heartbeat/keepalive, optimistic updates, message formats, authentication, and graceful degradation. Use when building chat, live notifications, collaborative features, real-time feeds, or live data updates.
triggers: websocket, sse, server-sent events, realtime, real-time, live updates, chat, polling, socket.io, push notifications, bidirectional, reconnection, heartbeat
---

# Real-Time Data

## Transport Selection

| Transport | When to use | Direction | Auto-reconnect |
|-----------|-------------|-----------|----------------|
| **WebSocket** | Chat, collaboration, gaming, bidirectional | Both ways | Manual |
| **SSE** | Notifications, feeds, live dashboards | Server → Client | Built-in |
| **Polling** | Simple low-frequency updates, simple infra | Client pulls | N/A |

**Rule:** WebSocket for bidirectional (chat, collaboration), SSE for server-to-client (notifications, feeds), polling for simple/low-frequency updates (5-30s intervals).

## WebSocket — Node.js Server

```bash
npm install ws
npm install @types/ws -D
```

```ts
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import * as http from "http";

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Connected clients map (keyed by userId for targeting)
const clients = new Map<string, WebSocket>();

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  // Authenticate on connection
  const userId = authenticateRequest(req);
  if (!userId) { ws.close(1008, "Unauthorized"); return; }

  clients.set(userId, ws);

  // Heartbeat — detect dead connections
  let isAlive = true;
  ws.on("pong", () => { isAlive = true; });

  const heartbeat = setInterval(() => {
    if (!isAlive) { ws.terminate(); return; }
    isAlive = false;
    ws.ping();
  }, 30_000); // 30s ping/pong

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    handleMessage(userId, message, ws);
  });

  ws.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(userId);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${userId}:`, error);
    clients.delete(userId);
  });
});

// Rate limit incoming messages
const messageCount = new Map<string, number>();
function handleMessage(userId: string, message: any, ws: WebSocket) {
  const count = (messageCount.get(userId) ?? 0) + 1;
  messageCount.set(userId, count);
  setTimeout(() => messageCount.set(userId, (messageCount.get(userId) ?? 1) - 1), 1000);
  if (count > 20) { ws.close(1008, "Rate limit exceeded"); return; }

  // Process message...
}

// Ping every 30s to clean dead connections
setInterval(() => {
  wss.clients.forEach((ws) => { if (ws.readyState === WebSocket.OPEN) ws.ping(); });
}, 30_000);

server.listen(8080);
```

## WebSocket — Client with Reconnection

```ts
class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private messageHandlers: Map<string, (payload: any) => void> = new Map();

  constructor(private url: string, private getToken: () => string) {
    this.connect();
  }

  private connect() {
    // Pass JWT in URL query param (WebSocket doesn't support custom headers easily)
    this.ws = new WebSocket(`${this.url}?token=${this.getToken()}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log("WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      this.messageHandlers.get(type)?.(payload);
    };

    this.ws.onclose = (event) => {
      if (event.code !== 1000) this.scheduleReconnect(); // 1000 = clean close
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s... max 30s
    const base = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    const jitter = Math.random() * 1000; // avoid thundering herd
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), base + jitter);
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }

  on(type: string, handler: (payload: any) => void) {
    this.messageHandlers.set(type, handler);
    return this;
  }

  close() { this.ws?.close(1000); }
}

// Usage
const socket = new ReconnectingWebSocket("wss://api.example.com/ws", () => getAuthToken());
socket.on("message", (payload) => console.log("New message:", payload));
socket.on("notification", (payload) => showNotification(payload));
socket.send("subscribe", { channel: "room:123" });
```

## Server-Sent Events (SSE)

SSE is simpler for server-to-client streams. Auto-reconnects via `EventSource`.

### Next.js App Router

```ts
// app/api/stream/route.ts
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const userId = await getUserId(req); // authenticate

  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      // Subscribe to events (pub/sub, Redis, etc.)
      const subscription = eventBus.subscribe(userId, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          subscription.unsubscribe();
        }
      });

      // Heartbeat — keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          subscription.unsubscribe();
        }
      }, 15_000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscription.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### SSE Client

```ts
function useSSE(url: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const source = new EventSource(url);  // SSE auto-reconnects

    source.onmessage = (event) => {
      setData(JSON.parse(event.data));
    };

    source.onerror = () => {
      // EventSource handles reconnection automatically
      console.error("SSE connection error, will retry...");
    };

    return () => source.close();
  }, [url]);

  return data;
}
```

## Polling (Simple Cases)

```ts
function usePolling<T>(fetcher: () => Promise<T>, interval = 10_000) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      while (active) {
        try {
          const result = await fetcher();
          if (active) setData(result);
        } catch (error) {
          console.error("Poll error:", error);
        }
        await new Promise(r => setTimeout(r, interval));
      }
    }

    poll();
    return () => { active = false; };
  }, [fetcher, interval]);

  return data;
}
```

Use `If-None-Match` / ETags on the server for efficient polling:
```ts
// Server
res.set("ETag", computeHash(data));
if (req.headers["if-none-match"] === res.get("ETag")) {
  return res.status(304).end(); // Not Modified — no body sent
}
```

## Message Format

Use a consistent message envelope:
```ts
type Message<T = any> = {
  type: string;    // discriminator — e.g., "chat.message", "order.updated"
  payload: T;      // event-specific data
  timestamp: number; // Unix ms
  id?: string;     // optional correlation/idempotency ID
};
```

## Authentication

```ts
// WebSocket — token in URL query param (Secure with wss://)
const ws = new WebSocket(`wss://api.example.com/ws?token=${jwt}`);

// SSE — cookies sent automatically (same-origin), or Authorization header via fetch EventSource polyfill
// For cross-origin SSE, use a token in the URL or implement a ticket exchange:
const { ticket } = await fetch("/api/ws-ticket").then(r => r.json());
const source = new EventSource(`/api/stream?ticket=${ticket}`);
```

## Optimistic Updates

```ts
async function sendMessage(roomId: string, text: string) {
  // 1. Update UI immediately
  const tempId = `temp-${Date.now()}`;
  addMessage({ id: tempId, text, pending: true });

  try {
    // 2. Send to server
    const { message } = await api.post(`/rooms/${roomId}/messages`, { text });
    // 3. Replace temp message with confirmed one
    replaceMessage(tempId, { ...message, pending: false });
  } catch (error) {
    // 4. Revert on failure
    removeMessage(tempId);
    showError("Failed to send message");
  }
}
```

## Graceful Degradation

```ts
async function connect() {
  if ("WebSocket" in window) {
    try {
      return await connectWebSocket();
    } catch { /* fall through */ }
  }
  if ("EventSource" in window) {
    try {
      return await connectSSE();
    } catch { /* fall through */ }
  }
  return startPolling(10_000);
}
```

## Avoid

- WebSocket for simple notification feeds — SSE is simpler and auto-reconnects
- Polling intervals under 3 seconds — use SSE or WebSocket instead
- Storing WebSocket connections in React component state — use a singleton connection manager or context
- Unbounded message queues — cap buffer size and drop oldest messages if client falls behind
- Broadcasting to all clients on every message — use room/channel targeting

## Resources

- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [EventSource API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [ws library](https://github.com/websockets/ws)
- [Socket.IO](https://socket.io/docs/) — for rooms, namespaces, auto-fallback

<!-- Adapted from: https://github.com/YepAPI/skills (real-time-data) + general WebSocket patterns -->

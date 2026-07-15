---
name: webhooks
description: "Implement webhook receivers with signature verification, idempotent processing, retry handling, and framework-specific patterns for Express, Next.js, Fastify, and Laravel. MUST be invoked when the user says: webhook, webhook receiver, signature verification, idempotency, stripe webhook, github webhook, shopify webhook, svix. SHOULD also invoke when: hookdeck, webhook handler, webhook retry, hmac signature."
triggers: webhook, webhook receiver, signature verification, idempotency, stripe webhook, github webhook, shopify webhook, svix, hookdeck, webhook handler, webhook retry, hmac signature
chain: tester-api
---

# Webhooks

Production-ready webhook receiving: signature verification, idempotency, and retry handling.

## The Three Rules

**Verify -> Parse -> Handle Idempotently** — always this order.

1. **Verify signature first** — use raw body; reject invalid requests with 4xx
2. **Parse payload second** — only after verification
3. **Handle idempotently third** — check event ID before processing

> Parsing before verifying = security vulnerability. Missing idempotency = duplicate processing (double charges, double emails).

## Response Codes

| Code | Meaning | Provider behavior |
|------|---------|-------------------|
| `2xx` | Success | No retry |
| `4xx` | Client error | Usually no retry (except 429) |
| `5xx` | Server error | Retry with backoff |
| `429` | Rate limited | Retry after delay |

**Return 2xx fast** — offload heavy processing to a background job.

## Signature Verification by Provider

### Stripe

```ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Next.js App Router
export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  await handleStripeEvent(event);
  return new Response("OK", { status: 200 });
}
```

### GitHub

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyGitHubSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";

  if (!verifyGitHubSignature(rawBody, sig, process.env.GITHUB_WEBHOOK_SECRET!)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType = req.headers.get("x-github-event")!;
  const deliveryId = req.headers.get("x-github-delivery")!; // unique ID for idempotency

  await handleGitHubEvent(eventType, deliveryId, event);
  return new Response("OK", { status: 200 });
}
```

### Svix (Clerk, Resend, etc.)

```ts
import { Webhook } from "svix";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const wh = new Webhook(process.env.WEBHOOK_SECRET!);

  let event;
  try {
    event = wh.verify(rawBody, {
      "svix-id": req.headers.get("svix-id")!,
      "svix-timestamp": req.headers.get("svix-timestamp")!,
      "svix-signature": req.headers.get("svix-signature")!,
    });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  await handleEvent(event);
  return new Response("OK", { status: 200 });
}
```

### Generic HMAC-SHA256

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyHmac(rawBody: string, signature: string, secret: string, prefix = "sha256="): boolean {
  const computed = `${prefix}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    return false; // length mismatch
  }
}
```

Always use `timingSafeEqual` — regular string comparison is vulnerable to timing attacks.

## Idempotency

Webhooks are delivered **at least once** — the same event can arrive multiple times.

### Database Deduplication (recommended)

```ts
// Schema
// CREATE TABLE processed_webhook_events (
//   event_id VARCHAR(255) PRIMARY KEY,
//   event_type VARCHAR(100),
//   processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

async function handleStripeEvent(event: Stripe.Event) {
  // Atomic upsert — ON CONFLICT prevents duplicate processing in race conditions
  const result = await db.execute(sql`
    INSERT INTO processed_webhook_events (event_id, event_type)
    VALUES (${event.id}, ${event.type})
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  `);

  if (result.rows.length === 0) {
    console.log(`Duplicate event ${event.id}, skipping`);
    return; // already processed — return 2xx to stop retries
  }

  // Process the event
  await processStripeEvent(event);
}
```

### Transactional Processing

```ts
// For critical operations — wrap in a transaction
await db.transaction(async (tx) => {
  // Lock and check
  const existing = await tx.query(
    "SELECT 1 FROM processed_webhook_events WHERE event_id = $1 FOR UPDATE SKIP LOCKED",
    [event.id]
  );
  if (existing.rows.length > 0) return; // already processed

  // Side effects inside transaction
  await tx.query("UPDATE orders SET status = $1 WHERE payment_intent_id = $2", ["paid", event.data.object.id]);
  await tx.query("INSERT INTO processed_webhook_events (event_id, event_type) VALUES ($1, $2)", [event.id, event.type]);
});
```

### Redis Deduplication (simple cases)

```ts
const alreadyProcessed = await redis.set(`webhook:${event.id}`, "1", "NX", "EX", 7 * 86400);
if (!alreadyProcessed) return; // duplicate
await processEvent(event);
```

## Full Example (Next.js + Stripe)

```ts
// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { db } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  // 1. Verify signature (raw body)
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // 2. Idempotency check
  const inserted = await db.webhookEvent.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, type: event.type },
    update: {},
    select: { createdAt: true },
  });

  // 3. Enqueue for async processing (return fast)
  await webhookQueue.add("stripe-event", { eventId: event.id, type: event.type });

  return new Response("OK", { status: 200 });
}
```

## Express / Fastify

```ts
// Express — must use express.raw() for webhook routes, NOT express.json()
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch {
    res.status(400).send("Invalid signature");
  }
});

// Fastify — add rawBody support
await app.register(import("fastify-raw-body"), { global: false });
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => done(null, body));
```

## Local Development

```bash
# Stripe CLI — forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Hookdeck CLI — generic webhook tunnel
npx hookdeck-cli listen 3000 my-webhook-source

# ngrok
ngrok http 3000
```

## Security Checklist

- [ ] Signature verified before parsing payload
- [ ] Raw body used for signature (not parsed JSON)
- [ ] `timingSafeEqual` for HMAC comparison (not `===`)
- [ ] Idempotency implemented (event ID deduplication)
- [ ] Handler returns 2xx within 10-30 seconds
- [ ] Heavy processing offloaded to background queue
- [ ] Webhook secret in env var, not code
- [ ] Logs include event type, ID, and timestamp
- [ ] Webhook endpoint not rate-limited by own middleware

## Avoid

- Skipping signature verification — critical security vulnerability
- Parsing body before verifying — verification requires raw body
- Slow handler processing — return fast, process async
- Missing idempotency — webhooks retry on timeout or server error
- Regular string comparison for signatures — timing attack vector
- Assuming webhook arrival order — use event timestamps to resolve conflicts

## Resources

- [Stripe Webhook Docs](https://stripe.com/docs/webhooks)
- [GitHub Webhook Docs](https://docs.github.com/en/webhooks)
- [Svix Docs](https://docs.svix.com/receiving/verifying-payloads/how)
- [Hookdeck Webhook Skills](https://github.com/hookdeck/webhook-skills) — 37+ provider-specific skills

<!-- Adapted from: https://github.com/hookdeck/webhook-skills (webhook-handler-patterns + stripe-webhooks) + https://github.com/YepAPI/skills (webhook-handler) -->

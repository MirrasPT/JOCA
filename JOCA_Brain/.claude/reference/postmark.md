# Postmark (reference — read by `transactional-email`)

> Moved from `skills/postmark.md` (F4.2, email group merge). Owner skill: `transactional-email` — universal rules, provider choice and generic deliverability live there; this file is only the Postmark API.

## Contents
- [Setup](#setup)
- [Sending](#sending) — single, template, batch (≤500), attachments
- [Message streams](#message-streams)
- [Webhooks](#webhooks) — event types, signature check, event handling
- [Templates](#templates) — create, validate
- [Postmark DNS values](#postmark-dns-values) — SPF include, DKIM selector, Return-Path
- [Suppressions](#suppressions)
- [Rate limits and errors](#rate-limits-and-errors)
- [Testing](#testing)
- [Resources](#resources)

## Setup

```bash
npm install postmark
```

```ts
import * as postmark from "postmark";
const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN!);
```

Environment:
```
POSTMARK_SERVER_TOKEN=<from Account → API Tokens>
POSTMARK_WEBHOOK_SECRET=<from Webhooks settings, for verification>
```

## Sending

### Single email

```ts
await client.sendEmail({
  From: "sender@yourdomain.com",
  To: "recipient@example.com",
  Subject: "Hello!",
  HtmlBody: "<p>Hello <strong>World</strong></p>",
  TextBody: "Hello World",
  ReplyTo: "noreply@yourdomain.com",
  MessageStream: "outbound",  // or custom stream name
});
```

### With template

```ts
await client.sendEmailWithTemplate({
  From: "sender@yourdomain.com",
  To: "recipient@example.com",
  TemplateAlias: "welcome",
  TemplateModel: {
    user_name: "João",
    action_url: "https://app.example.com/confirm/abc123",
    product_name: "My App",
  },
  MessageStream: "outbound",
});
```

### Batch send (up to 500 messages)

```ts
await client.sendEmailBatch([
  { From: "...", To: "user1@example.com", Subject: "...", HtmlBody: "..." },
  { From: "...", To: "user2@example.com", Subject: "...", HtmlBody: "..." },
]);
```

### With attachments

```ts
await client.sendEmail({
  From: "sender@yourdomain.com",
  To: "recipient@example.com",
  Subject: "Invoice",
  TextBody: "Please find your invoice attached.",
  Attachments: [
    {
      Name: "invoice.pdf",
      Content: Buffer.from(pdfBytes).toString("base64"),
      ContentType: "application/pdf",
    },
  ],
});
```

## Message streams

| Stream | Type | Use for |
|--------|------|---------|
| `outbound` | Transactional | Password resets, confirmations, receipts |
| `broadcast` | Bulk | Newsletters, announcements (requires opt-in list) |
| Custom | Transactional | Separate streams per product/team |

Always specify `MessageStream` explicitly.

## Webhooks

### Event types

| Event | When |
|-------|------|
| `Delivery` | Email delivered |
| `Bounce` | Hard or soft bounce |
| `SpamComplaint` | Marked as spam |
| `Open` | Email opened (if tracking enabled) |
| `Click` | Link clicked (if tracking enabled) |
| `SubscriptionChange` | Unsubscribe/resubscribe |

### Verifying signatures

```ts
// Next.js App Router
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-postmark-signature") ?? "";

  // Validate via HMAC-SHA256
  const crypto = await import("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.POSTMARK_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  await handlePostmarkEvent(event);
  return new Response("OK", { status: 200 });
}
```

### Handling events

```ts
async function handlePostmarkEvent(event: any) {
  switch (event.RecordType) {
    case "Delivery":
      await db.emailLog.update({
        where: { messageId: event.MessageID },
        data: { deliveredAt: new Date(event.DeliveredAt), status: "delivered" },
      });
      break;

    case "Bounce":
      if (event.Type === "HardBounce") {
        // Permanently remove from sending list
        await db.user.update({
          where: { email: event.Email },
          data: { emailBounced: true, emailBouncedAt: new Date() },
        });
      }
      break;

    case "SpamComplaint":
      await db.user.update({
        where: { email: event.Email },
        data: { emailUnsubscribed: true },
      });
      break;

    case "SubscriptionChange":
      if (event.SuppressSending) {
        await db.user.update({
          where: { email: event.Recipient },
          data: { emailUnsubscribed: true },
        });
      }
      break;
  }
}
```

## Templates

### Creating via API

```ts
const template = await client.createTemplate({
  Name: "Welcome Email",
  Subject: "Welcome to {{product_name}}!",
  HtmlBody: `
    <h1>Hi {{user_name}},</h1>
    <p>Welcome to {{product_name}}.</p>
    <a href="{{action_url}}">Get Started</a>
  `,
  TextBody: "Hi {{user_name}}, welcome to {{product_name}}.\n\n{{action_url}}",
  Alias: "welcome",
});
```

Variables use `{{variable_name}}` syntax. Always provide both `HtmlBody` and `TextBody`.
Code-first templates (React components rendered to HTML): `skills/transactional-email.md` §Templates; pass the rendered `html`/`text` to `sendEmail`.

### Validating

```ts
const validation = await client.validateTemplate({
  HtmlBody: "<p>Hello {{name}}</p>",
  TextBody: "Hello {{name}}",
  TestRenderModel: { name: "Test User" },
});
// validation.AllContentIsValid, validation.HtmlBody.ValidationErrors
```

## Postmark DNS values

Generic SPF/DKIM/DMARC rules and checklist: `skills/transactional-email.md` §Deliverability. Postmark-specific values:

```
# SPF include
v=spf1 include:spf.mtasv.net ~all

# DKIM — Postmark generates the key; add to DNS
pm._domainkey.yourdomain.com  TXT  k=rsa; p=<postmark-key>
```

- Custom sending domain set up (not postmarkapp.com); DKIM verified in the dashboard; Return-Path on the sending domain.
- Bounce rate must stay < 2% — Postmark suspends high-bounce accounts.

## Suppressions

```ts
// List suppressed addresses
const suppressions = await client.getSuppressions("outbound");

// Delete suppression (re-enable sending)
await client.deleteSuppressions("outbound", {
  Suppressions: [{ EmailAddress: "user@example.com" }],
});
```

## Rate limits and errors

```ts
async function sendWithRetry(emailData: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.sendEmail(emailData);
    } catch (error: any) {
      if (error.code === 429) {
        // Rate limited — wait exponentially
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      if (error.code === 422) {
        // Validation error — don't retry
        throw error;
      }
      if (attempt === maxRetries) throw error;
    }
  }
}
```

| Code | Meaning | Action |
|------|---------|--------|
| 300 | Invalid email address | Validate before sending |
| 406 | Inactive recipient | Remove from list |
| 422 | Message rejected | Check content, from address |
| 429 | Rate limited | Exponential backoff |
| 500 | Server error | Retry with backoff |

## Testing

```ts
// Postmark provides a test token that accepts sends but doesn't deliver
// Find in: Account → API Tokens → Server API Tokens → Test
const testClient = new postmark.ServerClient(process.env.POSTMARK_TEST_TOKEN!);
```

With the test token, emails are accepted and logged in Postmark's activity feed but not delivered.

## Resources

- [Postmark Docs](https://postmarkapp.com/developer)
- [Node.js Client](https://github.com/ActiveCampaign/postmark.js)
- [Template Reference](https://postmarkapp.com/developer/api/templates-api)
- [Webhook Reference](https://postmarkapp.com/developer/webhooks/webhooks-overview)
- [Deliverability Guide](https://postmarkapp.com/guides/email-deliverability)

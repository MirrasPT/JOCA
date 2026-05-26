---
name: postmark
description: "Send transactional emails via Postmark, handle webhooks, manage templates, configure deliverability (SPF/DKIM/DMARC), and process bounces. MUST be invoked when the user says: postmark, transactional email, email sending, email webhook, bounce handling, email deliverability, spf dkim dmarc, message streams. SHOULD also invoke when: postmark api."
triggers: postmark, transactional email, email sending, email webhook, bounce handling, email deliverability, spf dkim dmarc, message streams, postmark api
---

# Postmark

Complete guide for Postmark transactional email: sending, webhooks, templates, and deliverability.

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

## Sending Emails

### Single Email

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

### With Template

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

### Batch Send (up to 500 messages)

```ts
await client.sendEmailBatch([
  { From: "...", To: "user1@example.com", Subject: "...", HtmlBody: "..." },
  { From: "...", To: "user2@example.com", Subject: "...", HtmlBody: "..." },
]);
```

### With Attachments

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

## Message Streams

Postmark uses message streams to separate email types:

| Stream | Type | Use for |
|--------|------|---------|
| `outbound` | Transactional | Password resets, confirmations, receipts |
| `broadcast` | Bulk | Newsletters, announcements (requires opt-in list) |
| Custom | Transactional | Separate streams per product/team |

Always specify `MessageStream` explicitly — don't rely on defaults.

## Webhooks

### Webhook Event Types

| Event | When |
|-------|------|
| `Delivery` | Email successfully delivered |
| `Bounce` | Hard or soft bounce |
| `SpamComplaint` | Marked as spam |
| `Open` | Email opened (if tracking enabled) |
| `Click` | Link clicked (if tracking enabled) |
| `SubscriptionChange` | Unsubscribe/resubscribe |

### Verifying Webhook Signatures

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

### Handling Webhook Events

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

### Creating Templates (API)

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

Template variables use `{{variable_name}}` syntax. Always provide both `HtmlBody` and `TextBody`.

### Validating Templates

```ts
const validation = await client.validateTemplate({
  HtmlBody: "<p>Hello {{name}}</p>",
  TextBody: "Hello {{name}}",
  TestRenderModel: { name: "Test User" },
});
// validation.AllContentIsValid, validation.HtmlBody.ValidationErrors
```

## Deliverability

### DNS Records Required

```
# SPF — add to your domain's TXT records
v=spf1 include:spf.mtasv.net ~all

# DKIM — Postmark generates this; add to DNS
pm._domainkey.yourdomain.com  TXT  k=rsa; p=<postmark-key>

# DMARC — recommended
_dmarc.yourdomain.com  TXT  v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### Deliverability Checklist

- [ ] Custom domain set up (not postmarkapp.com)
- [ ] SPF record includes Postmark
- [ ] DKIM signature verified in Postmark dashboard
- [ ] DMARC policy configured
- [ ] Return-Path / envelope from uses sending domain
- [ ] Unsubscribe link in every marketing/bulk email
- [ ] Bounce webhook configured and processing
- [ ] Spam complaint webhook configured and suppressing
- [ ] Bounce rate < 2% (Postmark may suspend high-bounce accounts)

### Suppression Management

```ts
// List suppressed addresses
const suppressions = await client.getSuppressions("outbound");

// Delete suppression (re-enable sending)
await client.deleteSuppressions("outbound", {
  Suppressions: [{ EmailAddress: "user@example.com" }],
});
```

## Rate Limits & Error Handling

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

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 300 | Invalid email address | Validate before sending |
| 406 | Inactive recipient | Remove from list |
| 422 | Message rejected | Check content, from address |
| 429 | Rate limited | Exponential backoff |
| 500 | Server error | Retry with backoff |

## Testing

```ts
// Use test/sandbox mode
const testClient = new postmark.ServerClient(process.env.POSTMARK_TEST_TOKEN!);

// Postmark provides a test token that accepts sends but doesn't deliver
// Find in: Account → API Tokens → Server API Tokens → Test
```

For local development, emails are accepted and logged in Postmark's activity feed but not delivered when using the test token.

## Best Practices

- **Queue sends** — Don't block API responses waiting for email delivery; use a background job
- **Log MessageID** — Store Postmark's `MessageID` to correlate delivery/bounce webhooks
- **Message streams** — Use separate streams for transactional vs marketing; different IPs and reputation
- **Plain text required** — Always include `TextBody` alongside `HtmlBody`
- **From address** — Use a consistent `From` with your verified sending domain
- **Bounce hygiene** — Process bounces immediately; hard bounces must be suppressed or Postmark will suspend
- **Monitor spam complaints** — Even one complaint per 1000 affects deliverability

## Resources

- [Postmark Docs](https://postmarkapp.com/developer)
- [Node.js Client](https://github.com/ActiveCampaign/postmark.js)
- [Template Reference](https://postmarkapp.com/developer/api/templates-api)
- [Webhook Reference](https://postmarkapp.com/developer/webhooks/webhooks-overview)
- [Deliverability Guide](https://postmarkapp.com/guides/email-deliverability)

<!-- Adapted from: https://github.com/ActiveCampaign/postmark-skills -->

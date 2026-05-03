# Shopify Webhooks & OAuth

## OAuth flow (public apps)

1. **Install redirect** — Shopify redirects merchant to app's `/auth` endpoint with `shop` and `hmac` params.
2. **Validate HMAC** — verify the request is genuine before proceeding.
3. **Request scopes** — redirect to `https://{shop}/admin/oauth/authorize` with `client_id`, `scope`, `redirect_uri`, `state`.
4. **Exchange code** — POST to `https://{shop}/admin/oauth/access_token` with `client_id`, `client_secret`, `code`.
5. **Store token securely** — never expose in logs or client-side code.

### HMAC validation (step 2)

```js
import crypto from "crypto";

function validateHmac(query) {
  const { hmac, ...params } = query;
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}
```

## Webhooks

### Register via API

```graphql
mutation {
  webhookSubscriptionCreate(
    topic: ORDERS_CREATE
    webhookSubscription: {
      format: JSON
      callbackUrl: "https://myapp.com/webhooks/orders/create"
    }
  ) {
    webhookSubscription { id }
    userErrors { field message }
  }
}
```

### Verify webhook payload (HMAC)

```js
import crypto from "crypto";

function verifyWebhook(rawBody, hmacHeader) {
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(hmacHeader)
  );
}
```

Always use `rawBody` (unparsed buffer) — parsing JSON before verification will fail.

### Common webhook topics

| Topic                | When it fires                         |
|----------------------|---------------------------------------|
| `ORDERS_CREATE`      | New order placed                      |
| `ORDERS_UPDATED`     | Order updated                         |
| `ORDERS_PAID`        | Payment confirmed                     |
| `ORDERS_FULFILLED`   | Order fulfilled                       |
| `PRODUCTS_CREATE`    | Product created                       |
| `PRODUCTS_UPDATE`    | Product updated                       |
| `CUSTOMERS_CREATE`   | New customer registered               |
| `APP_UNINSTALLED`    | App uninstalled — clean up data       |
| `SHOP_UPDATE`        | Shop settings updated                 |

### Test webhooks locally

```bash
shopify app webhook trigger --topic=ORDERS_CREATE
```

## Billing API

Charge merchants via Shopify Billing API (required for public apps on Shopify App Store):

```graphql
mutation {
  appSubscriptionCreate(
    name: "Pro Plan"
    returnUrl: "https://myapp.com/billing/callback"
    lineItems: [{
      plan: {
        appRecurringPricingDetails: {
          price: { amount: 29.99, currencyCode: USD }
          interval: EVERY_30_DAYS
        }
      }
    }]
    test: true  # remove for production
  ) {
    appSubscription { id status }
    confirmationUrl
    userErrors { field message }
  }
}
```

Redirect merchant to `confirmationUrl` → they approve → Shopify redirects to `returnUrl`.

## Security checklist

- [ ] Validate HMAC on every OAuth request
- [ ] Verify HMAC on every webhook payload
- [ ] Store access tokens encrypted at rest
- [ ] Never log tokens or expose in client-side code
- [ ] Use `state` param in OAuth to prevent CSRF
- [ ] Handle `APP_UNINSTALLED` webhook to delete merchant data (GDPR)
- [ ] Implement GDPR mandatory webhooks: `customers/data_request`, `customers/redact`, `shop/redact`

---
name: portugal-payments
origin: local
description: "Integrate the Portuguese ifthenpay gateway (Multibanco reference, MB WAY push, Cartão) in Laravel. MUST be invoked when the user says: ifthenpay, Multibanco, MB WAY, MBWay, pagamento Portugal, referência multibanco. SHOULD also invoke when: anti-phishing key, callback ifthenpay, mbWayKey, mbKey, entidade/referência."
triggers: ifthenpay, Multibanco, MB WAY, MBWay, MBWAY, pagamento Portugal, referencia multibanco, referência multibanco, anti-phishing key, antiPhishingKey, callback ifthenpay, webhook ifthenpay, mbWayKey, mbKey, creditCardKey, entidade referencia, SPG, gateway portugues
---
# Portugal Payments — ifthenpay

ifthenpay gateway for Laravel. Three flows: **Multibanco** (entity+reference, async), **MB WAY** (push to phone, async), **Cartão** (hosted redirect). Confirmation is always via **callback webhook** — never trust the init response as proof of payment.

Invoked by `laravel-specialist` or `payment-integration` agent on PT payment work, or by user.

**No sandbox exists.** Endpoints are production-only. Request a test account + test keys from ifthenpay support (`suporte@ifthenpay.com`). Install: `composer require ifthenpay/sdk` (official, PSR-18).

---

## Credentials (`.env`)

```dotenv
IFTHENPAY_BACKOFFICE_KEY=1111-1111-1111-1111   # master key, webhook registration only
IFTHENPAY_ANTI_PHISHING_KEY=your-32-char-secret # merchant-defined, echoed in every callback
IFTHENPAY_MBWAY_KEY=ITP-000000                  # per-method key
IFTHENPAY_MULTIBANCO_KEY=ITP-000000
IFTHENPAY_CCARD_KEY=ITP-000000
```

| Key | Format | Scope |
|---|---|---|
| `backofficeKey` | `1111-1111-1111-1111` | master account, registers webhooks |
| `antiPhishingKey` | string 10-50 chars | merchant secret, validates every callback |
| per-method key | `ITP-000000` | one per method (mbway / multibanco / ccard) |

`orderId` max **25 chars** in all flows. Amount = **string decimal** (`"25.50"`, dot or comma).

---

## Endpoints (canonical, from official SDK `Config.php`)

```
POST https://api.ifthenpay.com/multibanco/reference/init        # Multibanco init
POST https://api.ifthenpay.com/spg/payment/mbway                # MB WAY init
GET  https://api.ifthenpay.com/spg/payment/mbway/status         # MB WAY poll
POST https://api.ifthenpay.com/creditcard/init/{ccardKey}       # Card init (key in PATH)
POST https://ifthenpay.com/api/endpoint/callback/activation     # Webhook registration
POST https://api.ifthenpay.com/v2/payments/read                 # isPaid check (rate-limited)
```

All POST bodies are JSON, `Content-Type: application/json`.

---

## Method 1 — Multibanco (entity + reference)

**Init** POST `multibanco/reference/init`:
```json
{ "mbKey": "ITP-000000", "orderId": "order123", "amount": "25.50",
  "description": "max 255", "expiryDays": 3 }
```
**Success** `Status: "0"`:
```json
{ "Status": "0", "Entity": "11111", "Reference": "123 4567 89",
  "Amount": "25.50", "OrderId": "order123", "RequestId": "...", "ExpiryDate": "..." }
```
Store `Entity`, `Reference`, `RequestId`, `ExpiryDate`. **Show Entity + Reference + Amount** to user (they pay at ATM / homebanking). Error → `Status: "-1"` + `Message`. Payment confirmed only when callback arrives.

---

## Method 2 — MB WAY (push to phone)

**Init** POST `spg/payment/mbway`:
```json
{ "mbWayKey": "ITP-000000", "orderId": "order123", "amount": "25.50",
  "mobileNumber": "912345678", "description": "max 100", "email": null }
```
`mobileNumber`: `"912345678"` or `"351#912345678"`.
**Pending** `Status: "000"` (notification sent to phone):
```json
{ "Status": "000", "Amount": "25.50", "OrderId": "order123", "RequestId": "uuid..." }
```
Store `RequestId` as transaction id. **Expires in 4 min** (fixed, unconfigurable).

**Poll** GET `spg/payment/mbway/status?mbWayKey=...&requestId=...`:

| Status | Meaning |
|---|---|
| `000` | Paid |
| `123` | Pending |
| `020` | Rejected by user |
| `101` | Expired |
| `122` | Declined by SIBS |

Init-time errors: `999`/`100` retry · `122` declined · `-1` invalid key. Prefer callback over polling; poll only for UX feedback.

---

## Method 3 — Cartão (hosted redirect)

**Init** POST `creditcard/init/{ccardKey}` — **key in URL path, not body**:
```json
{ "orderId": "order123", "amount": "25.50",
  "successUrl": "https://...", "errorUrl": "https://...", "cancelUrl": "https://...",
  "language": "pt" }
```
Response returns a hosted checkout URL → **redirect** user. On return to `successUrl`, `$_GET['sk']` (secret) is present → verify locally via SDK `verifyPayment()`. Callback still fires for source of truth.

---

## Laravel integration shape

### Service — `app/Services/Payments/IfthenpayService.php`
Wraps `ifthenpay/sdk` via DI. One method per flow. Returns typed result arrays. Throws `IfthenpayException` on API error.
```php
public function initMultibanco(string $orderId, string $amount): MultibancoReference;
public function initMbway(string $orderId, string $amount, string $phone): MbwayPending;
public function initCreditCard(string $orderId, string $amount): string; // checkout URL
```

### Webhook controller — `app/Http/Controllers/Webhooks/IfthenpayWebhookController.php`
Incoming = **GET** with query params (you define them at registration):

| Param | Meaning |
|---|---|
| `oid` | orderId |
| `tid` | requestId / transaction id |
| `val` | amount |
| `apk` | anti-phishing key |
| `pm` | payment method code |
| `ref` | reference (Multibanco only) |

```php
public function handle(Request $request): Response
{
    // 1. Idempotency — tid already processed?
    if (IfthenpayWebhookLog::query()->where('tid', $request->query('tid'))->exists()) {
        return response('OK', 200);
    }
    // 2. Anti-phishing — reject any forged callback
    abort_unless(hash_equals(config('ifthenpay.anti_phishing_key'), (string) $request->query('apk')), 403);
    // 3. Load order by oid; validate val == stored amount (and tid for MB WAY)
    $order = Order::query()->where('order_ref', $request->query('oid'))->firstOrFail();
    abort_unless((string) $order->amount === (string) $request->query('val'), 422);
    // 4. Mark paid + fire event (idempotent transition)
    $order->markPaid();
    OrderPaid::dispatch($order);
    // 5. Log tid (unique index)
    IfthenpayWebhookLog::query()->create(['tid' => $request->query('tid'), 'oid' => $request->query('oid')]);
    return response('OK', 200); // ALWAYS 200, even on soft errors that you've logged
}
```

### Route — no CSRF, no auth
```php
Route::get('/webhooks/ifthenpay', IfthenpayWebhookController::class);
```

### Webhook registration (one-off, with backofficeKey)
POST `ifthenpay.com/api/endpoint/callback/activation`:
```json
{ "chave": "1111-1111-1111-1111", "entidade": "MBWAY",
  "subentidade": "ITP-000000", "antiPhishingKey": "your-apk",
  "urlCb": "https://site.com/webhooks/ifthenpay?oid=[ID]&tid=[REQUEST_ID]&val=[AMOUNT]&apk=[ANTI_PHISHING_KEY]&pm=MBWAY" }
```
`entidade`: `MBWAY` | `MULTIBANCO_DYNAMIC` | `CCARD`. Multibanco also appends `&ref=[REFERENCE]`. Success response body starts with `"OK:"`.

**Retries:** ifthenpay retries **13×** on non-200 (8× every 5 min, then hourly). Return 200 or you get duplicate hits — hence idempotency on `tid`.

---

## Status mapping → `orders.payment_status`

| API signal | Internal |
|---|---|
| MB WAY `000` / Multibanco callback (apk+val match) | `paid` |
| MB WAY `123` | `pending` |
| MB WAY `020`, `101`, `122` | `failed` |
| Card `sk` valid + callback | `paid` |
| init `Status: "-1"` / invalid key | `error` (do not expose to user) |

---

## Sandbox vs prod

| | Reality |
|---|---|
| Sandbox env | **None.** Same prod endpoints with test keys from support. |
| Test account | Request via `suporte@ifthenpay.com` — get throwaway `ITP-` keys. |
| Going live | Swap test keys for live keys in `.env`; re-register webhook with live `subentidade`. |
| Amounts | Use small real-flow amounts in test; SIBS sandbox limited. |

---

## Anti-patterns

| Wrong | Correct |
|---|---|
| Treat init response as "paid" | Wait for callback; init only creates the reference |
| Skip anti-phishing check | `hash_equals(config apk, $request->apk)` — else anyone can forge `paid` |
| String `==` on apk/amount | `hash_equals()` for apk; exact string compare on amount |
| Return non-200 on soft error | Always `200`; log + alert internally instead |
| No idempotency | Unique index on `tid`; retries hit you 13× |
| Float amounts | String decimal `"25.50"` end-to-end (avoid float drift) |
| `orderId` > 25 chars | Truncate / use short ref; long ids rejected |
| CSRF / auth on webhook route | Exclude — ifthenpay can't send your token |
| ccardKey in JSON body | It goes in the URL **path**: `/creditcard/init/{ccardKey}` |
| Poll MB WAY as source of truth | Callback is truth; poll only for live UX |
| Hardcode keys | All keys in `.env` / `config/ifthenpay.php` |
| MB WAY without 4-min timeout UX | Show countdown; status `101` = expired |

---

## Quality gate
After implementing the webhook: dispatch `tester-security` (anti-phishing bypass, forged callbacks, replay/idempotency) + `tester-api` (init flows, status mapping, 200-on-retry). Verify with a real test-key transaction end-to-end before go-live.

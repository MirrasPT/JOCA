---
name: portugal-invoicing
origin: local
description: "Portuguese certified e-invoicing (faturação certificada) from Laravel via Moloni, InvoiceXpress or Vendus — invoices, invoice-receipts, credit notes, IVA, AT series communication, ATCUD/QR. MUST be invoked when the user says: Moloni, faturação, fatura, fatura-recibo, invoice Portugal, nota de crédito, InvoiceXpress, Vendus, AT comunicação, ATCUD, série certificada, IVA Portugal. SHOULD also invoke when: certified invoicing, Portal das Finanças, isenção IVA, M01..M16, document series."
triggers: Moloni, faturação, fatura, fatura-recibo, invoice Portugal, nota de crédito, credit note Portugal, InvoiceXpress, Vendus, AT comunicação, ATCUD, série certificada, IVA Portugal, isenção IVA, M01, Portal das Finanças, faturação certificada, document series PT, cash-VAT, tax_exemption_reason
---
# Portugal Invoicing — faturação certificada

Certified e-invoicing from Laravel. Moloni primary; InvoiceXpress + Vendus alternatives. Backend lives in an Action/Service (`laravel-specialist`); Filament triggers issuance via a queued job (`filament`, `queues`).

Invoked by `laravel-specialist`/`filament` on PT billing, or by user.

---

## When to use

- Any VAT-liable PT company with organized accounting → AT-certified software is **legally mandatory**.
- Issuing invoices, fatura-recibo, simplified invoices, credit/debit notes, receipts, transport guides.
- Non-compliance: **€200–€3,750 fine per document**. Never hand-roll the fiscal numbering/QR — delegate to a certified provider.

### Legal baseline (since 2023-01-01)

| Requirement | Detail |
|---|---|
| **ATCUD** | `{series_validation_code}-{sequential_number}`, printed + encoded in QR Code |
| **Series communication** | Each série registered with AT **before first use**; AT returns a validation code. Uncommunicated series **block issuance** in Moloni |
| **Scope** | invoices, invoice-receipts, simplified, credit/debit notes, receipts, transport guides |

Provider auto-generates ATCUD + QR once the série is communicated — you never compute these.

---

## Moloni (primary)

### Auth — OAuth 2.0

| Flow | Use | Endpoint |
|---|---|---|
| Authorization code | Web apps | `GET /v1/grant/?grant_type=authorization_code&client_id=&client_secret=&redirect_uri=&code=` |
| Password grant | Native/server | `GET /v1/grant/?grant_type=password&username=&password=&client_id=&client_secret=` |
| Refresh | Renew | `GET /v1/grant/?grant_type=refresh_token&refresh_token=&client_id=&client_secret=` |

- `access_token` valid **1 h**; `refresh_token` valid **14 days**.
- Token passed as **GET param** `?access_token=` on every call. Body POSTed as JSON or `x-www-form-urlencoded`.
- Refresh **proactively** (cron / middleware-before-request) — never on 401 retry alone, the 14-day refresh expiry will silently log you out.

### Document endpoints (all POST, `?access_token=`)

| Document | Endpoint |
|---|---|
| Invoice (fatura) | `POST /v1/invoices/insert/` |
| Invoice-Receipt (fatura-recibo) | `POST /v1/invoiceReceipts/insert/` |
| Credit Note (nota de crédito) | `POST /v1/creditNotes/insert/` |

**Minimum invoice payload:**
```json
{
  "company_id": 123,
  "date": "2025-06-01",
  "expiration_date": "2025-06-30",
  "document_set_id": 456,
  "customer_id": 789,
  "status": 1,
  "products": [
    {
      "product_id": 10,
      "name": "Serviço X",
      "qty": 1.0,
      "price": 100.00,
      "taxes": [{ "tax_id": 5, "value": 23.0, "order": 1, "cumulative": 0 }]
    }
  ]
}
```
Response: `{ "valid": 1, "document_id": int }`. **Always assert `valid === 1`** — Moloni returns 200 with `valid: 0` on business errors.

- `status=0` → draft · `status=1` → closes the document (triggers AT real-time comms if enabled). Use `0` until ready to submit.

---

## IVA handling

- Taxes are **per line-item**, referenced by `tax_id` (pre-configured in Moloni `/v1/taxes/`). Resolve once, cache the id — never hardcode rates.
- PT fiscal zones: `"PT"`, `"PT-AC"` (Açores), `"PT-MA"` (Madeira). Standard rates 23 / 18 / 16%.
- **Zero-rate / exempt lines** require an exemption code `M01`–`M16` in `tax_exemption_reason` — omitting it rejects the document.
- **Cash-VAT** (IVA de caixa) companies must use a série with `cash_vat_scheme_indicator=1`.

```json
"taxes": [],
"tax_exemption_reason": "M16",
"exemption_reason": "Isento Artigo 14.º do RITI"
```

---

## Document series + AT certified communication

| Operation | Endpoint |
|---|---|
| List series | `GET /v1/documentSets/getAll/?company_id=&access_token=` |
| Create série | `POST /v1/documentSets/insert/` (prefix, cash-VAT flag) |
| Communicate one to AT | `POST /v1/documentSets/ATInsertCode/` |
| Communicate all to AT | `POST /v1/documentSets/ATInsertCodeBulk/` |

- Run `ATInsertCodeBulk` **once during onboarding** to register every série. Until done, issuance is blocked.
- AT returns the validation code → Moloni derives ATCUD per document automatically.

---

## Credit notes (notas de crédito)

`POST /v1/creditNotes/insert/?access_token=` — must reference the original:

```json
{
  "company_id": 123,
  "date": "2025-06-05",
  "document_set_id": 457,
  "customer_id": 789,
  "status": 1,
  "associated_documents": [{ "associated_id": 9001, "value": 100.00 }],
  "products": [
    { "related_id": 55001, "name": "Serviço X", "qty": 1.0, "price": 100.00,
      "taxes": [{ "tax_id": 5, "value": 23.0, "order": 1, "cumulative": 0 }] }
  ]
}
```

- `associated_documents[].associated_id` = original `document_id`; `related_id` per product = the original `document_product_id`.
- Validate **credited total ≤ original line amount** before posting.
- `status=1` closes + triggers AT reconciliation when real-time comms enabled.

---

## Laravel integration shape

**Token store** — persist `access_token` + `refresh_token` + `expires_at` (DB row or cache). Refresh before expiry, not after failure.

**Typed DTO** (`laravel-specialist` payload pattern):
```php
final readonly class InvoiceLine
{
    public function __construct(
        public int $productId,
        public string $name,
        public float $qty,
        public float $price,
        public int $taxId,
        public ?string $exemptionReason = null, // M01..M16
    ) {}
}

final readonly class CreateInvoicePayload
{
    public function __construct(
        public int $companyId,
        public int $documentSetId,
        public int $customerId,
        public CarbonImmutable $date,
        public array $lines,          // InvoiceLine[]
        public bool $draft = false,
    ) {}
}
```

**Service** — wraps auth + HTTP, asserts `valid === 1`:
```php
final class MoloniClient
{
    public function __construct(private readonly MoloniTokenStore $tokens) {}

    public function createInvoice(CreateInvoicePayload $p): int
    {
        $res = Http::asJson()->post("https://api.moloni.pt/v1/invoices/insert/?access_token={$this->tokens->valid()}", [
            'company_id'     => $p->companyId,
            'document_set_id'=> $p->documentSetId,
            'customer_id'    => $p->customerId,
            'date'           => $p->date->toDateString(),
            'status'         => $p->draft ? 0 : 1,
            'products'       => array_map($this->mapLine(...), $p->lines),
        ])->throw()->json();

        if (($res['valid'] ?? 0) !== 1) {
            throw new MoloniException('Moloni rejected document', $res);
        }
        return $res['document_id'];
    }
}
```

**Queued issuance** — fiscal docs are slow + external; never block the request/Filament action:
```php
final class IssueInvoiceJob implements ShouldQueue
{
    public function __construct(private readonly Order $order) {}

    public function handle(MoloniClient $moloni): void
    {
        $documentId = $moloni->createInvoice($this->toPayload($this->order));
        $this->order->update(['moloni_document_id' => $documentId, 'invoiced_at' => now()]);
    }

    public function failed(\Throwable $e): void
    {
        logger()->error('Invoice issuance failed', ['order' => $this->order->id, 'error' => $e->getMessage()]);
    }
}
// Filament action / controller dispatches the job → returns 202 / notifies.
```

- Resolve `company_id`, `document_set_id`, `customer_id`, `tax_id` via Moloni on first sync; **cache locally**.
- Validate PT customer postal code `XXXX-XXX` before creating the customer.

---

## Provider comparison

| Provider | Auth | Invoice endpoint | Pick when |
|---|---|---|---|
| **Moloni** | OAuth 2.0 (code/password grant), token as GET param | `POST /v1/invoices/insert/` | Full control + AT series comms built-in, richest API, free tier |
| **InvoiceXpress** | Static API key query param `?api_key=` | `POST https://{account}.app.invoicexpress.com/invoices.json` | Zero-OAuth simplicity, quick SaaS integrations |
| **Vendus** | Bearer `Authorization: Bearer {api_key}` (or Basic) | `POST https://www.vendus.pt/ws/v1.1/documents/` | Overlaps POS/retail, simplest payload (`items` only), Cegid stack |

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| Hand-roll invoice numbering / ATCUD / QR | Delegate to certified provider |
| Hardcode IVA rate (23) in payload | Reference pre-configured `tax_id` |
| Zero-rate line without exemption code | `tax_exemption_reason` = `M01`..`M16` |
| Issue on uncommunicated série | `ATInsertCodeBulk` during onboarding first |
| Refresh token only on 401 | Proactive refresh before `expires_at` (14-day cap) |
| Treat HTTP 200 as success | Assert `valid === 1` in the body |
| Create invoice in controller/Filament action sync | Queued `IssueInvoiceJob` → 202 / notify |
| Credit note without `associated_documents` + `related_id` | Always link original doc + line ids |
| Credit > original line amount | Validate `≤` before posting |
| Cash-VAT company on normal série | Série with `cash_vat_scheme_indicator=1` |
| Skip PT postal-code validation | Enforce `XXXX-XXX` for PT customers |

---

## Quality gate
After wiring issuance: dispatch `tester-code` (DTO mapping + `valid===1` assertion + queued job `failed()`); `tester-api` if exposing an invoicing endpoint. Verify against Moloni **sandbox** before any production token.

---
name: gdpr-compliance
origin: local
description: "Cookie consent banners, RGPD/GDPR checklists, gating third-party scripts (Google Analytics, Microsoft Clarity) behind consent, server-validated form consent with evidence in the DB, and data-subject rights (access/rectification/erasure/portability/objection) for Portuguese client sites. MUST be invoked when the user says: RGPD, GDPR, cookie consent, cookie banner, privacy policy, CNPD, right to erasure, personal data, opt-in. SHOULD also invoke when: contact form with consent, Google Analytics without consent, Microsoft Clarity, DPO, data breach, data portability."
triggers: RGPD, GDPR, consent, cookie banner, cookies, privacy policy, CNPD, data subject, right to erasure, personal data, opt-in, cookie wall, form consent, Google Analytics consent, Microsoft Clarity, DPO, data protection officer, data breach, data portability, right of access, right to object, third-party script gating, consent management
chain: security-review, tester-code
---
# GDPR / RGPD Compliance

Doctrine for RGPD compliance on PT client sites (Laravel+React or static) with a form and/or analytics. Recurring: any site with a contact form + Google Analytics/Clarity needs exactly this.

Invoked by `frontend`/`laravel-specialist` when the request involves cookies/consent/a form with personal data, or directly by the user.

---

## When to use it

- New or existing site with a **form** (contact, newsletter, checkout) that collects personal data.
- Site with **Google Analytics, Microsoft Clarity**, ad pixels, or any third-party script that writes cookies.
- Request for a **cookie banner**, "are we GDPR compliant?", a privacy audit.
- Implementation of the **right to erasure** or a data export at a data subject's request.

---

## 1 — Collection checklist (for each data-collection point)

Fill this in **before** writing code. One line per collection point (form, cookie, integration).

| Data | Purpose | Legal basis | Retention period |
|---|---|---|---|
| Name + email (contact) | Reply to the request | Consent / pre-contractual legitimate interest | E.g.: 12 months after last contact |
| Email (newsletter) | Direct marketing | Consent (its own opt-in, separate from the contact form) | Until revoked |
| Analytics cookies | Measure traffic/usage | Consent | As per the vendor's retention (confirm in the GA4/Clarity console) |
| Order data | Contract performance + tax obligations | Contract performance / legal obligation | Legal tax retention period (confirm with the client's accountant) |

**Possible legal bases** (pick the right one, do not always assume "consent"): consent, performance of a contract, compliance with a legal obligation, legitimate interest. Newsletter and analytics almost always require **consent** — never reuse the email from a contact form for a newsletter without its own, separate opt-in.

**Retention periods:** never "forever" by default. If the client does not have a number, propose a reasonable period per purpose and document it — do not invent a legal article to justify it.

---

## 2 — Consent banner (pattern)

Non-negotiable rules:
- **Prior opt-in** — non-essential scripts (analytics, marketing) do NOT run before there is explicit consent.
- **Reject with the same visual weight as Accept** — same size, color, contrast, position. Never "Accept" as a big colored button and "Reject" as a hidden grey link.
- **Granular by category** — necessary always on (not toggleable); analytics/marketing off by default, toggleable one by one.
- **Revocable** — a "Cookie preferences" link accessible (footer) at any time, without having to delete cookies by hand.
- **No cookie wall** — the site works (navigates, reads content, uses essential forms) even with everything rejected.

```js
// consent.js — consent state, versioned
const CONSENT_KEY = 'consent_v1'; // bump the version (v2, v3...) whenever the categories change — forces a re-ask

function getConsent() {
  const raw = localStorage.getItem(CONSENT_KEY);
  return raw ? JSON.parse(raw) : null; // null = has not decided yet, banner should appear
}

function setConsent(categories) {
  // categories = { necessary: true, analytics: bool, marketing: bool }
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...categories, ts: Date.now() }));
  document.dispatchEvent(new CustomEvent('consent:updated', { detail: categories }));
  if (!categories.analytics) purgeCookiesByCategory('analytics');
  if (!categories.marketing) purgeCookiesByCategory('marketing');
}

// on page load: if a decision is already stored, fire the event (turns on already-accepted scripts)
const existing = getConsent();
if (existing) document.dispatchEvent(new CustomEvent('consent:updated', { detail: existing }));
```

Banner: 3 visible actions — **Accept all**, **Reject all** (same weight), **Customize** (opens the granular panel). Never just 2 options where one of them is "accept or close without deciding" (closing the banner without choosing counts as neither rejection nor acceptance — persist nothing in that case).

---

## 3 — Gating third-party scripts + cleanup on revocation

**Never** inject `<script src="googletagmanager.com/...">` or the Clarity snippet directly in the `<head>`. Load only after consent:

```html
<script>
document.addEventListener('consent:updated', (e) => {
  if (e.detail.analytics) loadGoogleAnalytics();   // injects the <script> only here
  if (e.detail.marketing) loadMicrosoftClarity();  // same
});
</script>
```

⚠ **If the client uses Google Ads/remarketing on top of GA4, gating by event is not enough.** Google requires its own signal (Consent Mode v2: `gtag('consent','default',{...})` before any tag, then `gtag('consent','update',{...})` when the user decides) for EEA/UK traffic. Without it the gate looks compliant and the tags keep behaving as if there were consent. Check Google's current docs for which signals are in force — they change.

When consent previously given is **revoked**, besides stopping the script from loading, **clear the cookies already written** for that category — the script no longer running does not delete what is already there:

```js
function purgeCookiesByCategory(category) {
  // Prefixes documented by the vendors — check the current docs before assuming, they change without notice.
  const patterns = {
    analytics: [/^_ga/, /^_gid/, /^_gat/],                          // Google Analytics
    marketing: [/^_clck/, /^_clsk/, /^CLID/, /^MUID/, /^ANONCHK/, /^SM/], // Microsoft Clarity
  };
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if ((patterns[category] || []).some((re) => re.test(name))) {
      const expire = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
      document.cookie = `${name}=; ${expire}; path=/; domain=${location.hostname}`;
      document.cookie = `${name}=; ${expire}; path=/`; // without domain too — cookies written without an explicit domain only die this way
    }
  });
}
```

`httpOnly` cookies (server session, CSRF) are not visible to `document.cookie` — they are not part of this purge; classify them as **necessary**, never as analytics/marketing.

---

## 4 — Form consent (server-validated, with evidence in the DB)

Validation **client-side only (JS) does not count** — it has to be enforced on the server, with persisted evidence.

```php
// Migration
Schema::create('consent_records', function (Blueprint $table) {
    $table->id();
    $table->nullableMorphs('consentable'); // links to the form submission, lead, user, etc.
    $table->string('email')->nullable();
    $table->string('policy_version');      // version of the privacy text accepted at that moment
    $table->string('ip_address', 45);
    $table->text('user_agent')->nullable();
    $table->timestamp('consented_at');
    $table->timestamps();
});
```

```php
// FormRequest
public function rules(): array
{
    return [
        'consent' => ['required', 'accepted'], // checkbox never pre-ticked — real opt-in
        // ... the rest of the fields
    ];
}
```

```php
// Controller/Action — persist evidence when accepting the request
ConsentRecord::create([
    'consentable_type' => $submission::class,
    'consentable_id'   => $submission->id,
    'email'            => $request->input('email'),
    'policy_version'   => config('legal.privacy_policy_version'),
    'ip_address'       => $request->ip(),
    'user_agent'       => $request->userAgent(),
    'consented_at'     => now(),
]);
```

Rules:
- Consent checkbox **never pre-ticked** — `accepted` fails on blank/false, it only passes when explicitly ticked.
- `policy_version` goes up **every** time the privacy text changes — without this the evidence points at a text that no longer exists.
- An account/lead can have several `consent_records` (contact ≠ newsletter ≠ marketing) — do not collapse them into a single `consented` boolean.

---

## 5 — Data-subject rights

| Right | Implementation |
|---|---|
| **Access** | Admin endpoint/action that exports all personal data linked to the data subject (JSON) |
| **Rectification** | Profile edit form, or a manual update flow on request |
| **Erasure** | Anonymise/delete in **all** related tables — a soft-delete on the main table is not enough (see gotcha §6) |
| **Portability** | Structured export (JSON/CSV), machine-readable, not an image PDF |
| **Objection** | Marketing opt-out without deleting the account — its own flag, separate from "account deleted" |

Deadline for responding to requests: the GDPR gives **1 month** from receipt, extendable to **3 months** on complex requests (with notice to the data subject within the first month). Treat this as the legal ceiling, not as the SLA — set a shorter internal SLA and document it with the client/DPO. Borderline cases (repetitive requests, unconfirmed identity) → DPO.

---

## 6 — Expensive gotcha: JOIN to tables with a consent/visibility flag

**Real failure mode, it has already happened:** a flag (`consent_given`, `visible`, `deleted_at`, `anonymized_at`) is respected on the obvious route and **ignored** on another route that JOINs the same table — admin export, API endpoint, search index, report.

Before calling the feature done, **audit ALL routes/queries that touch the table**:

```bash
grep -rn "consent_records\|->join('.*consent\|whereHas('consent" app/
```

A flag that is only respected in half the places is worse than having no flag at all — it passes the superficial audit and fails the real one.

---

## 7 — CNPD framing (Portugal)

- **CNPD** is the national supervisory authority in Portugal; the GDPR is a European regulation that applies directly, and the CNPD supervises and receives complaints in PT (cnpd.pt).
- Principles to respect in the code, without citing a specific article: **data minimization** (collect only what is needed), **purpose limitation** (do not reuse data from one purpose for another without its own consent), **storage limitation** (delete/anonymize once the period from the §1 checklist is up).
- **Data breach:** notification to the supervisory authority (CNPD) within **72 hours** of becoming aware of it; past that deadline, the notification has to come with a justification for the delay. If there is a high risk to the data subjects, they are notified too. The channel and who is responsible for pressing the button are confirmed with the client/DPO **before** there is an incident, not during.
- **DPO (Encarregado de Protecção de Dados):** mandatory in certain scenarios (public bodies, large-scale monitoring, large-scale processing of special categories of data) — confirm applicability case by case; most small client sites do **not** need a formal DPO, but they always need a privacy contact.
- **Never cite a GDPR article number or a CNPD deliberation number from memory** — a wrong number reads exactly like a true one and is the most expensive possible error in a compliance piece. Write the principle; if the client needs the exact number, confirm the source before publishing.

---

## Anti-patterns

| Wrong | Right |
|---|---|
| GA/Clarity loaded directly in the `<head>`, without a gate | Inject only after `consent:updated` with the category active |
| "Reject" as a small grey link, "Accept" as a big colored button | Same visual weight — size, color, contrast, position |
| Site degraded/blocked until you accept (cookie wall) | Site works the same with everything rejected |
| Consent checkbox pre-ticked | `checked` never by default |
| Consent validated only in client-side JS | `required\|accepted` on the server + a record persisted in the DB |
| Closing the banner without choosing = treated as acceptance | Without an explicit decision, the banner reappears; nothing is persisted |
| Deleting only the main row when satisfying the "right to erasure" | Audit every table/route linked by JOIN (§6) |
| Consent evidence without `policy_version` | Store the version of the text accepted; bump it on every change |
| Reusing a contact email for a newsletter without its own opt-in | Separate consent per purpose |
| Citing a GDPR article/CNPD deliberation from memory | Write the principle; confirm the number before publishing |
| Cookie purge only without `domain=` (or only with it) | Try both variants — cookies written with an explicit domain survive a purge without domain |

---

## Quality gate

After implementing: dispatch `security-review` (server-side validation of the consent, PII exposure in exports/logs, and confirmation that **all** routes JOINing the consent/visibility table respect the flag — §6). If there was a new form with an endpoint, `tester-code` for the `FormRequest` + `ConsentRecord` persistence.

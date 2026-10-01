---
name: analytics-tracking
description: "Set up, improve, audit, verify and query analytics tracking and measurement (GA4, GTM, Consent Mode v2, UTM, GA4 Data API). MUST be invoked when the user says: set up tracking, GA4, Google Analytics, conversion tracking, event tracking, UTM parameters, tracking plan. SHOULD also invoke when: analytics, traffic, visitors, page views, sessions, GA4 report, GA4 Data API, DebugView, consent mode."
metadata:
  version: 1.1.0
---

# Analytics Tracking

Expert in analytics implementation and measurement. Sets up tracking that provides actionable insights for marketing and product decisions.

**Nota JOCA:** Single skill for tracking: implementation (events, GTM, UTM, consent), verification and GA4 reporting through the Data API. `google-analytics` was merged into this skill on 2026-10-01 and is now only a pointer. Inside a `/marketeer` cycle the measurement plan belongs to `mkt-medicao` and is proven with the pack's `tracking/prova.mjs` — this skill supplies the doctrine.

## Initial Assessment

**Check the brand profile first:**
If a marketeer brand profile exists (`clientes/<slug>/marca.md` under the marketeer workspace — see `.claude/marketeer/CONTRATO.md`), read it first; otherwise ask the 3-5 questions this skill needs.

Before implementing, understand:

1. **Business Context** - What decisions will this data inform? Key conversions?
2. **Current State** - What tracking exists? What tools in use?
3. **Technical Context** - Tech stack? Privacy/compliance requirements?

---

## Core Principles

### 1. Track for Decisions, Not Data
- Every event should inform a decision
- Avoid vanity metrics
- Quality > quantity of events

### 2. Start with the Questions
- What do you need to know?
- What actions follow from this data?
- Work backwards to required tracking

### 3. Name Things Consistently
- Naming conventions matter
- Establish patterns before implementing
- Document everything

### 4. Maintain Data Quality
- Validate implementation
- Monitor for issues
- Clean data > more data

---

## Tracking Plan Framework

### Structure

```
Event Name | Category | Properties | Trigger | Notes
---------- | -------- | ---------- | ------- | -----
```

### Event Types

| Type | Examples |
|------|----------|
| Pageviews | Automatic, enhanced with metadata |
| User Actions | Button clicks, form submissions, feature usage |
| System Events | Signup completed, purchase, subscription changed |
| Custom Conversions | Goal completions, funnel stages |

---

## Event Naming Conventions

### Recommended events first

Prefer GA4 recommended events (`sign_up`, `login`, `purchase`, `generate_lead`, …) — they get standard reports. Invent a custom name only when no recommended event fits.

**Leads (house standard):** every lead form fires `generate_lead` with a `formulario` parameter that names the form (`formulario: 'contact'`, `formulario: 'quote'`, `formulario: 'demo'`) — house standard shared with the marketeer pack; the brand's tracking plan wins if it already uses another name. One event name for all forms; the parameter tells them apart. Keep the same parameter name in every tag, trigger and report.

### Custom events: Object-Action

```
cta_clicked
article_read
checkout_payment_completed
```

### Rules
- Lowercase with underscores
- Be specific: `cta_hero_clicked` vs `button_clicked`
- Include context in properties, not event name
- No spaces or special characters
- Document decisions

---

## Essential Events

### Marketing Site

| Event | Properties |
|-------|------------|
| cta_clicked | button_text, location |
| generate_lead | formulario (e.g. `contact`, `demo`) — fire only on a 2xx server response, never on click |
| sign_up | method |

### Product/App

| Event | Properties |
|-------|------------|
| onboarding_step_completed | step_number, step_name |
| feature_used | feature_name |
| purchase | currency, value, transaction_id |
| subscription_cancelled | reason |

---

## Event Properties

### Standard Properties

| Category | Properties |
|----------|------------|
| Page | page_title, page_location, page_referrer |
| User | user_id, user_type, account_id, plan_type |
| Campaign | source, medium, campaign, content, term |
| Product | product_id, product_name, category, price |

### Rules
- Use consistent property names
- Include relevant context
- Don't duplicate automatic properties
- No PII in properties

---

## GA4 Implementation

### Quick Setup

1. Create GA4 property and data stream
2. Install gtag.js or GTM
3. Enable enhanced measurement
4. Configure custom events
5. Mark conversions in Admin

### gtag.js snippet

As early as possible in `<head>`, **after** the Consent Mode default (see Privacy below):
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```
- `G-XXXXXXXXXX` = Measurement ID (GA4 Admin → Data Streams → Web). Never guess it: missing → `TODO: credencial em falta`.
- SPAs: the automatic `page_view` only fires on the initial load — on route change send `gtag('event', 'page_view', {page_location, page_title})` or use Enhanced Measurement (history changes).

### Event examples

```javascript
gtag('event', 'generate_lead', { formulario: 'contact' });
gtag('event', 'sign_up', { method: 'email' });
gtag('event', 'purchase', { currency: 'EUR', value: 49.90, transaction_id: 'T-1001' });
```
- Custom parameters only show in reports after being registered as custom dimensions (Admin → Custom definitions) — register `formulario`.

---

## Google Tag Manager

### Container Structure

| Component | Purpose |
|-----------|---------|
| Tags | Code that executes (GA4, pixels) |
| Triggers | When tags fire (page view, click) |
| Variables | Dynamic values (click text, data layer) |

### Data Layer Pattern

```javascript
// only after the server answered 2xx
dataLayer.push({
  'event': 'generate_lead',
  'formulario': 'contact'
});
```

---

## UTM Parameter Strategy

### Standard Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| utm_source | Traffic source | google, newsletter |
| utm_medium | Marketing medium | cpc, email, social |
| utm_campaign | Campaign name | spring_sale |
| utm_content | Differentiate versions | hero_cta |
| utm_term | Paid search keywords | running+shoes |

### Naming Rules
- Lowercase everything
- Use underscores or hyphens consistently
- Be specific but concise: `blog_footer_cta`, not `cta1`
- Document all UTMs in a spreadsheet

---

## Debugging and Validation

### Testing Tools

| Tool | Use For |
|------|---------|
| GA4 DebugView | Real-time event monitoring |
| GTM Preview Mode | Test triggers before publish |
| Tag Assistant | Verify GA4 tags firing |
| GA4 Realtime report | Confirms page_views ~30 s after deploy |
| marketeer `tracking/prova.mjs` | Network proof of consent: 0 measurement/ads hits before consent and after refusal, hits after accept, lead event on a 2xx |

- **DebugView** (Admin → DebugView): `?debug_mode=1` in the URL, `gtag('config', ID, {debug_mode: true})`, or the GA Debugger extension.
- No data? Check the Measurement ID, disable ad-blockers for the test, and confirm Consent Mode grants `analytics_storage` after accept.
- Consent proof (marketeer pack): `MARKETEER_RAIZ="<RAIZ>" node "<MKT>/scripts/tracking/prova.mjs" <url> --formulario <url> --evento generate_lead [--cliente <slug>]` (`<MKT>`/`<RAIZ>` resolved as in `.claude/marketeer/CONTRATO.md` §2).

### Validation Checklist

- [ ] Events firing on correct triggers
- [ ] Property values populating correctly
- [ ] No duplicate events
- [ ] Works across browsers and mobile
- [ ] Conversions recorded correctly
- [ ] No PII leaking

### Common Issues

| Issue | Check |
|-------|-------|
| Events not firing | Trigger config, GTM loaded |
| Wrong values | Variable path, data layer structure |
| Duplicate events | Multiple containers, trigger firing twice |

---

## Privacy and Compliance

### Requirements
- Cookie consent required in EU/UK/CA
- No PII in analytics properties
- Configure data retention settings
- Provide user deletion capabilities

### Implementation — aligned with `gdpr-compliance`
Two accepted patterns (both must pass the network proof above):
1. **House default — Consent Mode v2, basic behaviour:** GTM/gtag may load on every page **only if** the `default denied` call runs inline in `<head>` before it **and** every tag in the container requires consent, so **no Google measurement or ads hit leaves before consent** (proven by `tracking/prova.mjs`: 0 hits before consent and after refusal). The library download itself (`googletagmanager.com/gtm.js`) still happens — say so in the privacy review.
2. **Strict gating:** inject GTM/gtag only after the visitor accepts (see `gdpr-compliance` §3). Needs a revocation event in the container.

Default before any tag:
```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied'
  });
</script>
```
After the visitor accepts: `gtag('consent', 'update', { analytics_storage: 'granted' });` (plus the ad signals only if marketing was accepted).
- Collect only what you need; no PII in events or parameters
- Banner rules (Reject with the same weight as Accept, revocation link, no cookie wall): `gdpr-compliance` §2

---

## Output: Tracking Plan Document

```markdown
# [Site/Product] Tracking Plan

## Overview
- Tools: GA4, GTM
- Last updated: [Date]

## Events

| Event Name | Description | Properties | Trigger |
|------------|-------------|------------|---------|
| generate_lead | Lead form accepted by the server (2xx) | formulario | dataLayer push on success |

## Custom Dimensions

| Name | Scope | Parameter |
|------|-------|-----------|
| user_type | User | user_type |

## Conversions

| Conversion | Event | Counting |
|------------|-------|----------|
| Lead | generate_lead | Once per event |
```

---

## Reading the Data — GA4 Data API (REST)

Needs OAuth or a service account with access to the property (Viewer role in GA4 Admin → Property access management). **Missing credential: leave `TODO: credencial em falta` and report — never invent keys/IDs (Hard Limit, soul.md).** In a marketeer cycle, credentials live in the pack's vault, never in the chat (`.claude/marketeer/CONTRATO.md` §5.3).

With gcloud authenticated (ADC):
```bash
# once, to get ADC with the Analytics read-only scope
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/analytics.readonly

TOKEN=$(gcloud auth application-default print-access-token)
curl -s -X POST \
  "https://analyticsdata.googleapis.com/v1beta/properties/PROPERTY_ID:runReport" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
    "dimensions": [{"name": "pagePath"}],
    "metrics": [{"name": "screenPageViews"}, {"name": "totalUsers"}],
    "limit": 20
  }'
```
- `PROPERTY_ID` = the property number (Admin → Property details) — **not** the `G-…` Measurement ID.
- Realtime: `:runRealtimeReport` endpoint (same shape, no `dateRanges`).
- Service account: JSON key in GCP + Viewer access for the SA email on the property; then `GOOGLE_APPLICATION_CREDENTIALS=/path/key.json gcloud auth application-default print-access-token`.

**Metrics**: `totalUsers` `newUsers` `sessions` `screenPageViews` `averageSessionDuration` `bounceRate` `engagementRate` `conversions` `eventCount` `activeUsers`

**Dimensions**: `date` `pagePath` `pageTitle` `sessionSource` `sessionMedium` `country` `city` `deviceCategory` `browser` `operatingSystem` `landingPage` `sessionDefaultChannelGroup`

### Reading the numbers — absent is not zero

Missing data reads as good news if nobody flags it. Before reporting a number:
- **A limited response describes its slice.** With `limit` or pagination, the sum of rows is not the total: the total comes from a request without that dimension, or it is labelled "partial".
- **Zero ≠ absent.** A metric at `0`, a missing row, an empty date: broken tracking, refused consent or the wrong property give the same "0" as a site with no visits. Implausible zero → "unknown".
- **Empty ≠ failed.** An empty result is checked against another source (Realtime, DebugView) before claiming "no visits".
- **The total is context, not the denominator.** A percentage of a subset is computed over the base it can reach (paid conversions ÷ paid sessions, not ÷ all sessions). The report names both bases.
- Mandatory question: "what would make this look like this if the business were fine, and if the data were broken?" If you cannot tell, say so.

Adapted from anthropics/knowledge-work-plugins `small-business/shared/absent-is-not-zero.md` + `chain-seams.md` (Apache-2.0, rewritten).

---

## Task-Specific Questions

1. What tools are you using (GA4, Mixpanel, etc.)?
2. What key actions do you want to track?
3. What decisions will this data inform?
4. Who implements -- dev team or marketing?
5. Are there privacy/consent requirements?
6. What's already tracked?

---

## Related Skills

- **ab-test-setup**: For experiment tracking
- **seo**: For organic traffic analysis
- **page-cro**: For conversion optimization (uses this data)
- **gdpr-compliance**: Consent banner, strict script gating, form consent
- **paid-ads**: Meta Pixel/CAPI and Google Ads conversion tags
- **microsoft-clarity**: Session/heatmap data export
- **mkt-medicao** (marketeer pack): Measurement plan and gate before any campaign goes live

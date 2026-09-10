---
name: google-analytics
description: "Google Analytics 4 — gtag setup on sites (snippet, custom events, consent mode), verification (DebugView/Realtime) and data queries via the GA4 Data API REST. MUST be invoked when the user says: analytics, traffic, visitors, page views, sessions, GA4."
---

# Google Analytics 4

GA4 knowledge: install tracking on a site, verify it fires, and query data via the Data API REST.

## Setup — gtag.js on a site

Base snippet in the `<head>`, as early as possible:
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
- `G-XXXXXXXXXX` = Measurement ID (GA4 Admin → Data Streams → Web).
- SPAs: the automatic `page_view` only fires on the initial load — on route change send `gtag('event', 'page_view', {page_location, page_title})` or use Enhanced Measurement (history changes).

### Custom events
```js
gtag('event', 'sign_up', { method: 'email' });
gtag('event', 'purchase', { currency: 'EUR', value: 49.90, transaction_id: 'T-1001' });
```
- Prefer GA4 recommended event names (`sign_up`, `login`, `purchase`, `generate_lead`, …) — they get standard reports.
- Custom parameters only show up in reports after being registered as custom dimensions (Admin → Custom definitions).

### Consent mode (mandatory with an EU cookie banner)
Before the gtag snippet:
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
After the user consents: `gtag('consent', 'update', { analytics_storage: 'granted' });`

## Verification

- **DebugView** (Admin → DebugView): real-time events with `?debug_mode=1` in the URL, `gtag('config', ID, {debug_mode: true})`, or the GA Debugger extension.
- **Realtime report**: confirms page_views ~30s after the deploy.
- No data? Check the Measurement ID, turn off ad-blockers while testing, and verify that consent mode grants `analytics_storage`.

## Data queries — GA4 Data API (REST)

Requires OAuth or a service account with access to the property (Viewer role in GA4 Admin → Property access management). **If the credential is missing: leave `TODO: missing credential` and report — never invent keys/IDs (Hard Limit soul.md).**

With gcloud authenticated (ADC):
```bash
# 1x, to get ADC with the Analytics read scope
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
- `PROPERTY_ID` = the property number (Admin → Property details) — it is **not** the `G-…` Measurement ID.
- Realtime: `:runRealtimeReport` endpoint (same shape, no `dateRanges`).
- Service account: JSON key in GCP + give Viewer access to the SA email on the property; then `GOOGLE_APPLICATION_CREDENTIALS=/path/key.json gcloud auth application-default print-access-token`.

## Metrics & dimensions reference (runReport)

**Metrics**: `totalUsers` `newUsers` `sessions` `screenPageViews` `averageSessionDuration` `bounceRate` `engagementRate` `conversions` `eventCount` `activeUsers`

**Dimensions**: `date` `pagePath` `pageTitle` `sessionSource` `sessionMedium` `country` `city` `deviceCategory` `browser` `operatingSystem` `landingPage` `sessionDefaultChannelGroup`

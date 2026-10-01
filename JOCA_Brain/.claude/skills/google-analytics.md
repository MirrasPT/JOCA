---
name: google-analytics
description: "Google Analytics 4 — setup gtag em sites (snippet, eventos custom, consent mode), verificação (DebugView/Realtime) e query de dados via GA4 Data API REST. MUST be invoked when the user says: analytics, traffic, visitors, page views, sessions, GA4."
---

# Google Analytics 4 → use `analytics-tracking`

Merged into **`analytics-tracking`** on 2026-10-01. This file only keeps the frontmatter so GA4 requests still route here.

**Do this:** `Read(".claude/skills/analytics-tracking.md")` and follow it. It now holds everything that lived here:
- gtag.js snippet, SPA `page_view`, custom definitions;
- event naming (GA4 recommended events; leads = `generate_lead` with a `formulario` parameter — house standard shared with the marketeer pack; the brand's tracking plan wins if it already uses another name);
- Consent Mode v2 (`default denied` before any tag) aligned with `gdpr-compliance`;
- verification (DebugView, Realtime, marketeer `tracking/prova.mjs`);
- GA4 Data API (REST) queries, metrics/dimensions reference and "absent is not zero".

---
name: analytics
description: Google Analytics 4 and Microsoft Clarity data queries. Use when asking about website traffic, page views, sessions, users, conversions, top pages, traffic sources, bounce rate, heatmaps, session recordings, rage clicks, dead clicks, scroll depth, or user behavior. Triggers: analytics, traffic, visitors, GA4, Google Analytics, sessions, page views, conversions, referrals, heatmap, session recording, rage clicks, dead clicks, scroll depth, Clarity, user behavior.
---

## Google Analytics 4

Script: `${CLAUDE_SKILL_DIR}/ga_query.py` · Run: `uv run "${CLAUDE_SKILL_DIR}/ga_query.py" --report <type> [--days N] [--limit N] [--output table|json|csv]`

Setup: `GA4_CREDENTIALS` (service account JSON path) + `GA4_PROPERTY_ID` (numbers only) — env vars or edit script top.

Reports: `overview` · `pages` · `sources` · `countries` · `devices` · `daily` · `realtime` · `custom`
Custom: `--metrics "sessions,totalUsers" --dimensions "city"`

Key metrics: `totalUsers` `sessions` `screenPageViews` `bounceRate` `engagementRate` `conversions` `averageSessionDuration`
Key dimensions: `date` `pagePath` `sessionSource` `sessionMedium` `country` `deviceCategory` `browser` `landingPage`

## Microsoft Clarity

Requires Composio MCP in `.mcp.json`: `"composio": {"type":"http","url":"https://mcp.composio.dev/microsoft_clarity/YOUR_TOKEN"}`

Tool: `MICROSOFT_CLARITY_DATA_EXPORT` · `numOfDays`: 1, 2, or 3 only · up to 3 breakdown dimensions.

Key dimensions (case-sensitive): `Browser` · `Country` · `Device` · `OS` · `Page` · `UTMSource` · `UTMMedium` · `UTMCampaign` · `Referrer` · `EngagementType`
Key metrics: `ActiveTime` · `ScrollDepth` · `EngagementRate` · `RageClicks` · `DeadClicks` · `TotalSessions` · `TotalPageViews`

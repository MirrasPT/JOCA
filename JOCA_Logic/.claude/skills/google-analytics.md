---
name: google-analytics
description: "Query Google Analytics 4 data. MUST be invoked when the user says: analytics, traffic, visitors, page views, sessions, GA4."
---

# Google Analytics 4 Skill

Query GA4 property data using the Google Analytics Data API v1.

## Setup

Edit `ga_query.py` and set at the top:
- `CREDENTIALS_PATH` — path to your service account JSON key
- `PROPERTY_ID` — your GA4 property ID (number only, e.g. `123456789`)

Or set via environment variables:
```bash
export GA4_CREDENTIALS=/path/to/service-account.json
export GA4_PROPERTY_ID=123456789
```

**Python dependency**: handled automatically via `uv run` (no install needed).

## Script path

```
${CLAUDE_SKILL_DIR}/ga_query.py
```

Run with:
```bash
uv run "${CLAUDE_SKILL_DIR}/ga_query.py" --report <type> [options]
```

## Available Reports

### `overview` — High-level summary
```bash
uv run "...ga_query.py" --report overview --days 30
```
Returns: total users, sessions, page views, avg session duration, bounce rate, new vs returning users.

### `pages` — Top pages by views
```bash
uv run "...ga_query.py" --report pages --days 30 --limit 20
```
Returns: page path, title, views, users, avg engagement time.

### `sources` — Traffic sources
```bash
uv run "...ga_query.py" --report sources --days 30 --limit 20
```
Returns: source, medium, sessions, users, conversions.

### `countries` — Geographic breakdown
```bash
uv run "...ga_query.py" --report countries --days 30 --limit 20
```
Returns: country, sessions, users, engagement rate.

### `devices` — Device breakdown
```bash
uv run "...ga_query.py" --report devices --days 30
```
Returns: device category (desktop/mobile/tablet), sessions, users.

### `daily` — Day-by-day trend
```bash
uv run "...ga_query.py" --report daily --days 30
```
Returns: date, users, sessions, page views per day.

### `realtime` — Active users now
```bash
uv run "...ga_query.py" --report realtime
```
Returns: active users in last 30 minutes by source.

### `custom` — Custom query
```bash
uv run "...ga_query.py" --report custom --metrics "sessions,totalUsers" --dimensions "city" --days 7 --limit 10
```
Pass any valid GA4 API metric/dimension names as comma-separated values.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--days` | `30` | Lookback period in days |
| `--limit` | `10` | Max rows returned |
| `--start` | — | Explicit start date (YYYY-MM-DD), overrides --days |
| `--end` | — | Explicit end date (YYYY-MM-DD), defaults to today |
| `--output` | `table` | Output format: `table`, `json`, `csv` |

## GA4 Metric & Dimension Reference (for `--report custom`)

**Metrics**: `totalUsers` `newUsers` `sessions` `screenPageViews` `averageSessionDuration` `bounceRate` `engagementRate` `conversions` `eventCount` `activeUsers`

**Dimensions**: `date` `pagePath` `pageTitle` `sessionSource` `sessionMedium` `country` `city` `deviceCategory` `browser` `operatingSystem` `landingPage` `sessionDefaultChannelGroup`

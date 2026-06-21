---
name: microsoft-clarity
description: "Export Microsoft Clarity user behavior analytics. MUST be invoked when the user says: clarity, heatmap, session recording, rage clicks, dead clicks, scroll depth."
---

# Microsoft Clarity Analytics

Export Clarity heatmap data, session metrics, and engagement analytics via Composio MCP.

## MCP Setup (one-time)

Requires Composio MCP server via rube.app:

```json
// Add to .mcp.json → mcpServers:
"composio": {
  "type": "http",
  "url": "https://mcp.composio.dev/microsoft_clarity/YOUR_TOKEN_HERE"
}
```

Get token at [rube.app/mcp](https://rube.app/mcp). Connect Microsoft Clarity account when prompted.

---

## Tool: `MICROSOFT_CLARITY_DATA_EXPORT`

Single tool. One call, up to 3 dimensions.

```
numOfDays   required   1, 2, or 3 only (last 24h / 48h / 72h)
dimension1  optional   first breakdown dimension
dimension2  optional   second breakdown dimension
dimension3  optional   third breakdown dimension
```

**Available dimensions** — exact names, case-sensitive:

| Dimension | Description |
|-----------|-------------|
| `Browser` | Chrome, Firefox, Safari, Edge, etc. |
| `Device` | Desktop, Mobile, Tablet |
| `Country/Region` | Geographic location |
| `OS` | Windows, macOS, iOS, Android, etc. |
| `Source` | Traffic source (google, direct, referral) |
| `Medium` | organic, cpc, referral, etc. |
| `Campaign` | Marketing campaign name |
| `Channel` | Traffic channel grouping |
| `URL` | Specific page URLs |

---

## Common Patterns

**Device performance** (responsive audit):
```
numOfDays: 3, dimension1: "Device", dimension2: "Browser"
```

**Traffic source engagement:**
```
numOfDays: 2, dimension1: "Source", dimension2: "Medium"
```

**Geographic behaviour:**
```
numOfDays: 3, dimension1: "Country/Region", dimension2: "Device"
```

**Page-level performance:**
```
numOfDays: 1, dimension1: "URL", dimension2: "Device"
```

**Campaign attribution:**
```
numOfDays: 3, dimension1: "Campaign", dimension2: "Channel", dimension3: "Device"
```

---

## Pitfalls

- `numOfDays` accepts only `1`, `2`, or `3`
- Dimension names must match exactly (`Country/Region` not `country`)
- Max 3 dimensions per call — run multiple exports for broader breakdowns
- `URL` + other dimensions = large payloads — narrow time window
- Recent data (last few minutes) may lag due to processing delay
- Heatmap visuals and session recordings require Clarity web dashboard — not available via API

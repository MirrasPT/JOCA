---
name: browser-automate
description: "Automate a local canvas/litegraph web app via Playwright headless — load a workflow template, serialize the graph via page.evaluate, POST to the job API, poll history. MUST be invoked when the user says: Playwright canvas, automate ComfyUI, drive litegraph, page.evaluate workflow, headless browser automation, POST to prompt API, poll history endpoint, automate local web app."
metadata:
  version: 1.0.0
  origin: local
---

# Browser Automate

Playwright-based automation for canvas/litegraph web apps (ComfyUI, InvokeAI, or any litegraph host). Drives the JS app object — never clicks canvas coordinates. Submits via HTTP API; uses the browser only for serialization the app exposes.

## Core Principle

Canvas apps render to a single `<canvas>` with no per-node DOM. Two-layer strategy:
1. **Browser layer** — reach the global JS app object via `page.evaluate` to load templates and serialize graph state
2. **HTTP layer** — submit the serialized prompt, poll results, fetch outputs

Never click canvas coordinates. Never submit the saved UI JSON to the API — always submit the `output` object (flat, node-id-keyed API format).

---

## Setup — System Browser, No Download

```js
const { chromium } = require('playwright');

// Use installed Chrome — no `npx playwright install` needed
const browser = await chromium.launch({ channel: 'chrome' });

// Fallback: explicit path when channel auto-detect fails
// const browser = await chromium.launch({
//   executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
// });

// CI: set env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 to skip bundled Chromium
// Edge: channel: 'msedge'
// Chrome Beta: channel: 'chrome-beta'
```

Note: Playwright 1.57 ships "Chrome for Testing" (memory-heavy). `channel: 'chrome'` drives the real system install and avoids that overhead.

---

## Wait for App Readiness

Canvas apps boot async. Always wait before touching the app object:

```js
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8188');  // adjust port/path

// Generic: wait for the app object and graph to exist
await page.waitForFunction(() => !!window.app?.graph, { timeout: 15000 });
```

ComfyUI-specific: `window.app` is the canonical handle. For other litegraph apps, substitute the actual global (e.g., `window.editor`, `window.LiteGraph.active`).

---

## Load Template

```js
import workflowJson from './my-template.json' assert { type: 'json' };

// Loads the full UI workflow (nodes, links, groups, widget values)
await page.evaluate((g) => window.app.loadGraphData(g), workflowJson);
```

To patch widget values before submitting (avoid mutating the source file):

```js
await page.evaluate(({ nodeId, widgetIndex, value }) => {
  const node = window.app.graph._nodes_by_id[nodeId];
  if (!node) throw new Error(`Node ${nodeId} not found`);
  node.widgets[widgetIndex].value = value;
}, { nodeId: '42', widgetIndex: 0, value: 'my prompt text' });
```

---

## Serialize Graph

`graphToPrompt()` returns two objects. Only `output` goes to the API:

```js
const { workflow, output } = await page.evaluate(() =>
  window.app.graphToPrompt()
);
// workflow  — full UI snapshot (for /save, not for /prompt)
// output    — flat, node-id-keyed API prompt; excludes muted/bypassed nodes
```

`output` is what the backend executor understands. Never POST `workflow` to `/prompt`.

---

## Submit Job

```js
import { randomUUID } from 'crypto';

const clientId = randomUUID();

const res = await fetch('http://127.0.0.1:8188/prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: output, client_id: clientId }),
});

if (!res.ok) throw new Error(`POST /prompt failed: ${res.status}`);
const { prompt_id } = await res.json();
```

Queue depth (lightweight): `GET /prompt`
Full queue: `GET /queue`

---

## Poll History

```js
async function waitForResult(promptId, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`http://127.0.0.1:8188/history/${promptId}`);
    if (!r.ok) throw new Error(`GET /history failed: ${r.status}`);
    const history = await r.json();
    if (history[promptId]?.outputs) return history[promptId];
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for prompt ${promptId}`);
}

const result = await waitForResult(prompt_id);
```

Alternative: WebSocket push (avoids polling):

```js
const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'executing' && msg.data.prompt_id === prompt_id && msg.data.node === null) {
    // null node = execution complete
  }
};
```

---

## Fetch Output Files

```js
// result.outputs is keyed by node id
for (const [nodeId, nodeOutput] of Object.entries(result.outputs)) {
  for (const img of nodeOutput.images ?? []) {
    const url = `http://127.0.0.1:8188/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
    const blob = await fetch(url).then(r => r.buffer());
    fs.writeFileSync(img.filename, blob);
  }
}
```

---

## Asserting Canvas State

No DOM nodes to query. Three valid assertion approaches:

```js
// 1. Read app state via evaluate
const nodeCount = await page.evaluate(() => window.app.graph._nodes.length);

// 2. Visual snapshot (canvas locator)
await expect(page.locator('canvas')).toHaveScreenshot('baseline.png');

// 3. Bounding rect works; pixel reads from getContext('2d') do NOT
//    (Playwright bug #29594 — canvas 2D context returns empty object)
const box = await page.locator('canvas').boundingBox();
```

---

## Windows: Detecting the Server Process

**Never query by the app's unique name** — the querying PowerShell process self-matches on `CommandLine` searches that include the app name as a string.

```powershell
# Wrong — self-matches when PowerShell evaluates the WQL string containing "comfyui"
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*comfyui*" }

# Correct — filter Name=python.exe + CommandLine contains main.py
Get-WmiObject Win32_Process |
  Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*main.py*' }
```

**Prefer HTTP health-check over process detection:**

```powershell
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8188/system_stats' -UseBasicParsing -TimeoutSec 2
  $running = $r.StatusCode -eq 200
} catch {
  $running = $false
}
```

**Port-owner lookup (fallback):**

```powershell
try {
  $conn = Get-NetTCPConnection -LocalPort 8188 -ErrorAction Stop
  Get-Process -Id $conn.OwningProcess
} catch {
  # No process on that port — throws non-zero, must catch
}
```

`netstat -b` needs admin privileges; silently omits exe names otherwise. `Get-NetTCPConnection` throws when no match — always wrap in try/catch.

---

## ComfyUI: Full End-to-End Example

```js
import { chromium } from 'playwright';
import { randomUUID } from 'crypto';
import fs from 'fs';

const BASE = 'http://127.0.0.1:8188';
const template = JSON.parse(fs.readFileSync('./workflow.json', 'utf8'));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(BASE);
await page.waitForFunction(() => !!window.app?.graph, { timeout: 15000 });

// Load + patch
await page.evaluate((g) => window.app.loadGraphData(g), template);
await page.evaluate(({ nodeId, wi, value }) => {
  window.app.graph._nodes_by_id[nodeId].widgets[wi].value = value;
}, { nodeId: '6', wi: 0, value: 'a red fox in the snow, photorealistic' });

// Serialize
const { output } = await page.evaluate(() => window.app.graphToPrompt());

// Submit
const clientId = randomUUID();
const { prompt_id } = await fetch(`${BASE}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: output, client_id: clientId }),
}).then(r => r.json());

// Poll
const result = await waitForResult(prompt_id);

// Save outputs
for (const nodeOutput of Object.values(result.outputs)) {
  for (const img of nodeOutput.images ?? []) {
    const buf = await fetch(`${BASE}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`).then(r => r.arrayBuffer());
    fs.writeFileSync(img.filename, Buffer.from(buf));
    console.log('saved', img.filename);
  }
}

await browser.close();
```

---

## Failure Handling

| Failure | Cause | Fix |
|---------|-------|-----|
| `waitForFunction` timeout | App still booting | Increase timeout; verify port with health-check first |
| `graphToPrompt` undefined | App not ComfyUI or version mismatch | Inspect `window` keys to find the actual app global |
| POST 400 to `/prompt` | Submitted `workflow` not `output` | Always use the `output` key from `graphToPrompt()` |
| History never populates | Wrong `prompt_id` or server error | Check `/queue` for queue state; check server logs |
| Canvas pixel reads empty | Playwright bug #29594 | Use `page.evaluate` app state or `toHaveScreenshot` instead |
| `Get-NetTCPConnection` throws | No process on port | Wrap in try/catch; use HTTP health-check instead |

---

## Adapting to Other Litegraph Apps

All litegraph apps share the same `LGraph` serialization model. To adapt:

1. **Find the global app handle** — open browser console, type `window.` and tab-complete, or search source for `new LGraph`
2. **Find the load method** — usually `loadGraphData`, `loadJSON`, or `fromJSON`
3. **Find the serialize method** — usually `serialize()`, `toJSON()`, or app-specific like `graphToPrompt()`
4. **Check the API** — inspect Network tab when the UI submits a job; replicate that request

The HTTP submit/poll pattern (job API + history/status endpoint) is standard across litegraph-based tools.

---

## Related Skills

- **comfyui** — ComfyUI-specific skill (node types, ControlNet, workflows, model management)
- **remotion** — programmatic video via React (different paradigm: code, not canvas)
- **webhooks** — if the app exposes webhook callbacks instead of polling

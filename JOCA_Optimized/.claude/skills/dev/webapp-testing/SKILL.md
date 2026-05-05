---
name: webapp-testing
description: Test local web applications with Playwright (Python). Verifies frontend functionality, debugs UI behavior, captures screenshots, views browser logs. Triggers: Playwright, test web app, UI test, browser test, frontend test, screenshot, browser logs, web automation, E2E local, test this page.
license: Complete terms in LICENSE.txt
---

Write native Python Playwright scripts. Helper: `scripts/with_server.py` (manages server lifecycle).

RULE: Run scripts with `--help` first. DO NOT read script source — they're black-box tools; reading them pollutes context.

DECISION:
- Static HTML → read file for selectors → write Playwright script
- Dynamic (server needed) → `python scripts/with_server.py --help` → use helper + simplified Playwright script
- Server already running → navigate → wait for `networkidle` → screenshot/inspect DOM → identify selectors → execute actions

ENFORCE: wait for `networkidle` before interacting · screenshot on unexpected state · check console logs for errors (`page.on('console', ...)`) · use `data-testid` selectors when available, fallback to role/text

NEVER: read `scripts/with_server.py` source unless black-box use fails · hardcode ports if configurable · skip error state verification

---
name: site-capture
description: "Repeatable pipeline for clean headless screenshots + visual QA, and for extracting an image asset from a screenshot/mockup when the original file does not exist. MUST invoke when the user says: site capture, clean screenshot, full-page screenshot, visual QA, headless screenshot, extract image from a screenshot, extract image from a mockup, site-capture. SHOULD invoke when: blank page in the screenshot, section with opacity 0 in the capture, viewport cutting off vh sections, site contact sheet, slice of a long page, image only exists in a screenshot/mockup."
triggers: site capture, clean screenshot, full-page screenshot, visual QA, headless screenshot, extract image from a screenshot, extract image from a mockup, site-capture, page.screenshot, playwright-core, intro curtain, reveal-on-scroll, contact sheet, capture slice, slice screenshot, vh section cut off, lazy-load did not fire
origin: local
chain: design-review, tester-ui-ux
---

# Site Capture

Validated pipeline: URL(s) (or an existing screenshot) → a clean, correctly framed capture (full-page or per section), optionally sliced into bands + a labeled thumbnail, or an extracted asset. Re-derived ~8x before this skill existed — use this, do not reinvent it.

Distinct from `browser-automate` (which automates canvas/litegraph apps via a JS app object). Here the target is always a **real site** — DOM, not canvas.

---

## 1. Launch chain (fallback order)

| Order | Tool | When | Typical failure → next |
|---|---|---|---|
| 1 | MCP `claude-in-chrome` (if registered in this session) | Logged-in Chrome session, no friction | "extension not connected" / not registered → step 2 |
| 2 | Chrome headless CLI | No login needed — no extension | Not enough for authenticated pages → step 3 |
| 3 | MCP `playwright` | Authenticated pages / interactive QA | "Browser is already in use ... use --isolated" (orphan Chrome holding the profile) → step 4 |
| 4 | Playwright scripted (via `@playwright/cli`) | MCP blocked; full control of the browser | — |

⏳ **Startup recipe verified (macOS, 2026-08-20) — it is in `browser-automate`, section
"Playwright startup recipe". Read it from there, do not reinvent it: it cost 4 attempts per session
while it was not written down.** Summary of the three stumbles:

1. `playwright` **does not resolve by name** (it is neither in the project nor global) — it lives at
   `$(npm root -g)/@playwright/cli/node_modules/playwright`. `playwright-core` is **not**
   installed separately on this machine.
2. It is **CommonJS** → in an `.mjs` it needs `createRequire(import.meta.url)`.
3. The browser the package asks for may **not be in the cache** (it asks for 1224, the cache has 1148/1223/1234) →
   explicit `executablePath`, chosen at runtime from `~/Library/Caches/ms-playwright/`.

```js
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/@playwright/cli/node_modules/playwright`);
const CACHE = `${process.env.HOME}/Library/Caches/ms-playwright`;
const build = fs.readdirSync(CACHE).filter(d => d.startsWith('chromium-')).sort().pop();   // headed = faithful render
const browser = await chromium.launch({
  executablePath: `${CACHE}/${build}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  // or the system Chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
```

For capture prefer the **headed** build (`chromium-*`, Chrome for Testing): the
`chromium_headless_shell-*` is faster but is not the same render.

---

## 2. Capture snippet (copy-paste)

```js
// chromium + executablePath: see §1 (verified recipe). Abbreviated here.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); // never a tall window — see the vh gotcha
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(6000); // intro curtain (GSAP/ThemeREX/Elementor ~6s until 'load')
// if the capture still comes out blank → slower site: waitForSelector on the reveal target, or double the timeout

// reveal-on-scroll: IntersectionObserver does not fire in a static shot
await page.addStyleTag({
  content: '.bd-reveal,[data-reveal]{opacity:1!important;transform:none!important;}',
});

// lazy-load: scroll the whole page before forcing eager
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo({ top: y, behavior: 'instant' });   // 'smooth' falsifies rects read right after
    await new Promise((r) => setTimeout(r, 150));
  }
  document.querySelectorAll('img[data-src]').forEach((img) => {
    img.loading = 'eager';
    img.src = img.dataset.src;
  });
});
await page.waitForFunction(() =>
  [...document.querySelectorAll('img')].every((img) => img.naturalWidth > 0)
);

// popup/cookies — refuse the non-essential ones (privacy) or hide them by selector before capturing
// await page.click('.cookie-accept').catch(() => {});

await page.screenshot({ path: 'capture.png', fullPage: true });

// isolated section instead of full-page:
// const el = await page.$('#hero');
// await el.screenshot({ path: 'hero.png' });

await browser.close();
```

---

## 3. Gotchas (table — the real cause, not theory)

| Symptom | Cause | Fix |
|---|---|---|
| Blank page in the full-page shot | Intro curtain: `body`/`body_wrap` stays at 0px until the `load` event (~6s) | `waitUntil:'networkidle'` + `waitForTimeout(6000)` before capturing |
| Sections with `opacity:0` in the capture | `.bd-reveal`/`[data-reveal]` only reveals via IntersectionObserver — does not fire without real scroll | `addStyleTag` forcing `opacity:1!important;transform:none!important` |
| Giant or cut-off `min-height:80vh` section | A very tall capture window inflates `vh` (viewport = window height) | Normal viewport (1440×900) + `fullPage:true`, OR `element.screenshot({clip})`/boundingBox |
| Blank/gray images | Lazy-load (`data-src`) never fired outside the visible viewport | Full scroll + `img.loading='eager'` + `img.src=dataset.src` + `waitForFunction naturalWidth>0` |
| Black bands / "NO IMAGE" in the capture | `<video>` and broken placeholders render black in headless | Crop the band; stitch top+bottom with PIL (neutral background = invisible seam) |
| `Error: Browser is already in use ... --isolated` | An orphan Chrome from a previous session (or another session) holds the profile lock. Not even `browser_close` recovers — there is no way out through the tool itself | `pkill -f ms-playwright-mcp` (kills the tree + `crashpad-handler`) and delete the profile's `SingletonLock`; OR start the MCP isolated (`PLAYWRIGHT_MCP_ISOLATED=1`, = the `--isolated` flag in the error: in-memory profile); OR, more reliably, the direct script from §1 with `executablePath` |
| `Cannot find package 'playwright'` · `Executable doesn't exist at .../chromium_headless_shell-<N>` | the package only lives inside `@playwright/cli` (CommonJS) and the requested build is not in the cache | the full recipe from §1 — resolve via `npm root -g` + `createRequire` + `executablePath` from the cache |
| Plausible measurements but over the wrong pixels (contrast, rects, `y` outside the viewport) | `scroll-behavior:smooth` makes the scroll **animated** — the rects read in the same tick come from the old position | `behavior:'instant'` on every measuring scroll + confirm `window.scrollY` before reading rects |
| Link/button with the right `href` that does not respond to the click | another element paints on top (an Elementor sibling, an overlay, an `::after`) — the HTML does not show it | `document.elementFromPoint(cx,cy)` at the center of the box, on a clean load and after the last reload (recipe in `browser-automate`) |
| `claude-in-chrome`: "extension not connected" | Extension off | Fallback: Chrome headless CLI (no login) or MCP `playwright` (with login) |
| The MCP says "screenshot saved" and there is no file | relative `filename` in `browser_take_screenshot` — false success | **Absolute** path inside the allowed root (`<repo>/.playwright-mcp/`); read it, move it to the scratchpad, delete the folder (the MCP's cwd is `JOCA_Brain`, production read-only) |
| `browser_resize` does not take (you asked for 390, `innerWidth` stays 1170) · `devicePixelRatio` 0.333, `innerWidth` 3× what was asked | Browser MCP state, not page state — it persists across tabs | Do not trust the screenshot: measure with `browser_evaluate` (`getBoundingClientRect`, `gridTemplateColumns`, `scrollWidth`). Validated workarounds: ask for a resize at 1/3 of the value; measure mobile inside an `<iframe>` with the target width. Reliable: a `playwright-core` script with an explicit `viewport` |
| `locator('#id').screenshot()` returns another section of the page | Capture composition bug (the DOM is right — `getBoundingClientRect`/`getComputedStyle` confirm it) | When the image contradicts the DOM, believe the `evaluate()` |
| `page.screenshot({fullPage:true})` puts `position:fixed` elements in the middle of the page | Known fullPage behavior | Confirm any suspicion of overlap with a normal viewport capture BEFORE treating it as a defect |
| The script hangs forever on `img.decode()` | `decode()` on a `loading="lazy"` image not yet requested never resolves | Set `loading='eager'` before scrolling the page + run `decode()` against a timeout |
| `file://` blocked (playwright MCP and Chrome headless `--print-to-pdf`) | Protocol refused | Always serve over local HTTP: `python3 -m http.server` with `run_in_background: true` (in a normal Bash call the server dies at the end of the call) + version the assets (`site.css?v=N`), otherwise `http.server` sends `Last-Modified` and the browser serves cached CSS/JS after every edit |

### Chrome headless CLI: full-page via the shadow file

`--headless=new --screenshot` only captures the **viewport**. Forcing `--window-size=1440,7000` to "catch everything" blows up any hero with `min-height:100svh` (it becomes 7000px) — the capture comes out with no error and the wrong layout.

Pattern: copy the HTML to `_shot.html` with an extra `<style>` pinning the heroes' `min-height` and forcing `.reveal{opacity:1}`, capture that file, delete it at the end.

`--window-size=390` also does not give a 390px viewport (it renders at ~485px, `clientWidth ≠ window`) — the cuts on the right are an artifact, not overflow. Reliable overflow diagnosis, with no MCP at all:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth  // no overflow
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth)
```

Note: `python -m playwright` may not be installed even with the playwright MCP active.

---

## 4. Slicing + contact sheet (PIL)

```python
#!/opt/homebrew/bin/python3
from PIL import Image

img = Image.open('capture.png')
w, h = img.size
band_h = 1200  # readable height per band
bands = [img.crop((0, y, w, min(y + band_h, h))) for y in range(0, h, band_h)]
for i, b in enumerate(bands):
    b.save(f'band_{i:02d}.png')

# normalized contact sheet — mixing portrait/landscape breaks ffmpeg tile; use PIL
THUMB_W = 400
thumbs = [b.resize((THUMB_W, int(b.height * THUMB_W / b.width))) for b in bands]
max_h = max(t.height for t in thumbs)
sheet = Image.new('RGB', (THUMB_W * len(thumbs), max_h), 'white')
for i, t in enumerate(thumbs):
    sheet.paste(t, (i * THUMB_W, 0))
sheet.save('contact-sheet.png')
```

Mac: the interpreter is `python3`, never `python`. Pillow at `/opt/homebrew/bin/python3`.

---

## 5. Extract an asset from a screenshot/mockup (original file missing)

```python
#!/opt/homebrew/bin/python3
from PIL import Image

img = Image.open('screenshot.png')
region = img.crop((x0, y0, x1, y1))  # measure the region in the source file before cropping

print(f'extracted region: {region.width}x{region.height}px')
if region.width < 1920:
    print('⚠ below 4K — a 2x/retina screenshot renders the region at ~half the real width.')
    print('  Ask the client/brand for the original file. NEVER upscale silently.')

region.save('asset.webp', 'WEBP', quality=90)
```

Hard rule: if the measured resolution falls below what is needed, report the gap and ask for the original file — do not upscale and present it as if it were the real source.

---

## 6. Multi-page screengrabs (desktop + mobile)

A visual audit of N pages × 2 viewports done call-by-call in the main loop (navigate→resize→screenshot ×14) is slow and fragile. Pattern: **one script**, log in once, loop over routes per viewport.

1. Extract the route list from the router (do not write it by hand).
2. One `browser.newContext({viewport})` per viewport; authenticate once, reuse the context.
3. Per route: `goto` → wait for the reveal (see §2) → `screenshot({fullPage:true})` to `<scratchpad>/shots/<viewport>/<route>.png`.
4. Contact sheet per viewport (§4) for the side-by-side read.

## 7. Prove it before editing

Before touching the source file, prove the fix on the live page — it saves the edit→deploy→look cycle and produces concrete numbers (item by item) to show the client:

1. Reproduce it in the viewport of the defect (e.g. 390×844).
2. Measure: `getBoundingClientRect()` (`left`/`right` vs viewport width) and `getComputedStyle` (contrast measured, not estimated).
3. `page.addStyleTag({ content: <candidate css> })`.
4. Re-measure. Only if the numbers move in the right direction do you write to the file.

## Next step (chain)

After capture/visual QA → `design-review` (assess the result) → `tester-ui-ux` (if there is a regression to validate). Both reversible — chain without asking, notify `[chain → design-review]`.

## Related Skills

- **browser-automate** — automation of canvas/litegraph apps (different paradigm: JS app object, not DOM); its "Visual QA in a Browser" section covers the same fallback chain for ad-hoc cases — this skill is the canonical reference for the full pipeline (slice/thumbnail/extract-asset)
- **design-review** — assesses this skill's output
- **graphic-design** — when the output is for visual production, not just QA

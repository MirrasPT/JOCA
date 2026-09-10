---
name: html-to-pdf
description: "Export a single HTML page to a faithful 1-page PDF via headless Chrome, avoiding the default US-Letter page-split trap on tall content. MUST invoke when the user says: html to pdf, html-to-pdf, export PDF, 1-page PDF, print-to-pdf, generate PDF from HTML, print-CSS A4. SHOULD invoke when: PDF split across 2 pages, Chrome headless PDF, convert page to PDF, PDF faithful to the design, single-page PDF export."
triggers: html to pdf, html-to-pdf, export PDF, 1-page PDF, print-to-pdf, generate PDF from HTML, print-CSS A4, PDF split across 2 pages, Chrome headless PDF, convert HTML to PDF, single-page PDF, virtual-time-budget
origin: local
---
# HTML → PDF — faithful 1-page export

Validated pattern: HTML with `@page` print-CSS → Chrome headless `--print-to-pdf` → check the page count + visual re-read. Without this, Chrome uses **US Letter by default and splits tall content across 2+ pages** — pitfall no. 1.

---

## 1. Print-CSS in the HTML (mandatory before exporting)

Without `@page`, Chrome assumes US Letter (216×279mm) — content taller than that spills onto page 2.

```css
@page {
  size: 210mm 297mm; /* A4 — swap for a measured size if the content is not A4 */
  margin: 0;
}
html, body { margin: 0; padding: 0; }
-webkit-print-color-adjust: exact;
print-color-adjust: exact; /* preserves backgrounds/colors in the PDF */

@media print {
  .screen-only { display: none; } /* hide screen-only chrome (nav, buttons) */
}
```

**Exact fit to 1 page:** content with variable height (does not fit fixed A4) → measure `document.body.scrollHeight` (Playwright/DevTools) and inject `@page { size: <W>mm <H>mm; margin: 0 }` with the real height converted to mm (`px / 96 * 25.4`). Usable A4 height ≈ 269-297mm (depending on margins) — any excess spills.

---

## 2. Serving the HTML

`file://` can be blocked by Chrome headless (relative fonts/images fail). Always serve over HTTP:

```bash
python3 -m http.server 8123
# then point Chrome at http://localhost:8123/page.html
```

macOS: use `python3`, not `python`.

---

## 3. Export via Chrome headless

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --print-to-pdf=out.pdf \
  --no-pdf-header-footer \
  --virtual-time-budget=6000 \
  http://localhost:8123/page.html
```

- `--no-pdf-header-footer` — removes the date/URL/title Chrome injects by default.
- `--virtual-time-budget=6000` — gives async fonts/images 6s before printing; raise it if the page has heavy assets.
- Alternative (fallback, if Chrome is unavailable): the `cli-printing-press` CLI from the user's tool inventory.

---

## 4. Verify (mandatory — do not declare it done without this)

**a) Page count:**
```bash
mdls -name kMDItemNumberOfPages out.pdf                 # macOS (Spotlight)
pdfinfo out.pdf | grep Pages                            # cross-platform (poppler) — fallback
```
⚠ `mdls` can return `(null)` right after writing (Spotlight has not indexed yet) and does not exist outside macOS → use `pdfinfo` (or `pdftk out.pdf dump_data | grep NumberOfPages`) as a reliable fallback. It has to give the expected number (normally `1`). If it gives `2+` → the `@page size` does not cover the real content; go back to step 1 and measure the right height.

**a2) Count without a browser or external binaries (most reliable fallback):** when `mdls` returns `(null)` and poppler is not installed, count `/Type /Page` in the PDF's own bytes:
```bash
python3 -c "import re,sys;d=open('out.pdf','rb').read();print(len(re.findall(rb'/Type\s*/Page[^s]',d)))"
```

**a3) Calibrate the height by sweep (without Playwright):** instead of measuring `scrollHeight` in the browser, generate 4-5 PDFs into the scratchpad with candidate `@page` heights and keep the **smallest one that gives 1 page**. ~5 s in total and it depends on no browser at all — this was the route that worked in a session where Playwright was unavailable (`Browser is already in use for ~/Library/Caches/ms-playwright-mcp/mcp-chrome-<id>, use --isolated`; it happens whenever another session has the MCP browser open).

**b) Visual re-read:** read `out.pdf` with the `Read` tool (or `pdftoppm out.pdf preview -png` + open the image) and confirm visually that the layout matches the original HTML — cuts, overflow and backgrounds that vanished are only caught by eye. On macOS, `qlmanage -t -s 1000 -o <dir> out.pdf` generates the thumbnail without installing anything.

---

## 5. PDF from HTML with images (file size)

Chrome's `--print-to-pdf` **re-embeds PNG/WebP as lossless** — a manual with photographs comes out huge with nothing wrong in the HTML. Validated recipe: convert the rasters to **JPEG q80 before the build**, rebuild the HTML pointing at them, and only then print. On a real manual it took the PDF from **54.6 MB → 13.8 MB** with no visible difference.

Watch out: tiling patterns and `@media print` rules sit **at the end of the cascade** — an image swapped for JPEG can reappear via a print rule that was still pointing at the old PNG. Confirm the final weight with `ls -lh out.pdf`, do not assume.

---

## 6. Long self-contained document (brand book, standards manual, 50-80 pages)

A pattern rediscovered from scratch on every manual — pinning it down saves ~1h per project:
- **Fragments per part** + a `build.py` that concatenates. The final file is too big to edit by hand, and the sidebar repeated across ~70 pages is the biggest source of drift.
- The compiler **expands tokens**: `%%ASSET%%` (asset → base64 data URI, so the HTML is self-contained) and `%%NAV%%` (navigation/TOC generated once, not copied per page).
- **Extract assets from a PDF without inkscape/pdf2svg:** render with `pypdfium2` + keying by color distance + bbox trim.
- **Remove a page/part:** grep for the text → delete the block in the source fragment → update `PARTS`/TOC in `build.py` → rebuild → re-verify the page count and the neighboring page.

Sheet composition (accents on capitals that vanish into a dark bar, `min-height` of the text block, footer with `margin-top:auto`, `columns:N` that fragments) → see "Print CSS traps" and "Fixed-page pieces" in `graphic-design.md`.

---

## Gotchas

| Problem | Cause | Fix |
|----------|-------|-----|
| PDF with 2+ pages | Without `@page size`, Chrome uses US Letter | Set `@page { size: <W>mm <H>mm; margin: 0 }` in the HTML |
| Tall content keeps spilling even with A4 | Real height > 297mm | Measure the real `scrollHeight` and use that value in `@page size`, not fixed A4 |
| Backgrounds/colors disappear in the PDF | Chrome does not print backgrounds by default | `-webkit-print-color-adjust: exact; print-color-adjust: exact` |
| Fonts/images missing in the PDF | `file://` blocked or assets still loading | Serve via `python3 -m http.server` + raise `--virtual-time-budget` |
| Header/footer with URL and date in the PDF | Chrome's default header/footer | `--no-pdf-header-footer` |
| Tens of MB of PDF with few photos | Chrome re-embeds PNG/WebP as lossless | Convert rasters to JPEG q80 **before** the build (§5) |
| `Browser is already in use … use --isolated` | Another session has Playwright's MCP browser open | Chrome headless directly (§3) + count/sweep without a browser (§4 a2/a3) |

---

## Checklist

- [ ] `@page { size: ...; margin: 0 }` present in the HTML (A4 or measured)
- [ ] `print-color-adjust: exact` to preserve backgrounds/colors
- [ ] HTML served via `python3 -m http.server` (not `file://`)
- [ ] Chrome command with `--no-pdf-header-footer` + `--virtual-time-budget`
- [ ] Page count = expected (`mdls`/`pdfinfo`, or the `/Type /Page` regex from §4 a2 when there are no binaries)
- [ ] PDF visually re-read (Read tool / `pdftoppm`) and layout confirmed faithful to the HTML

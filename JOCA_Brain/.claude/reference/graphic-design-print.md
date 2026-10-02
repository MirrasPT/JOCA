# graphic-design — print, PDF e composição por código

Referência da skill `graphic-design` (núcleo em `.claude/skills/graphic-design.md`). Ler na exportação/verificação do PDF, em peças de página fixa, em cartazes e montagens/colagens compostos por código, e ao editar um PSD.

## Índice
- PDF Export — Chrome headless · Playwright · CSS @page · Editable deliverable (Illustrator) · Rasterizing a CMYK PDF · Press Export Instructions
- Fixed-page pieces (A4/A3 numa só folha) — Print CSS traps · Stroke icons
- Poster composed by code — Photo montage / collage by code (mosaico, story 9:16) · Builder scope (construir UM item)
- Editing an existing PSD (Photoshop + JSX)

## PDF Export

### Via Chrome headless (zero install — try this first)

Same engine as Playwright, no `npm i`. On machines where neither playwright nor puppeteer was installed this was the pragmatic path:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=out.pdf http://localhost:8000/design.html
```

`file://` is blocked in headless print — serve the folder over HTTP (`python3 -m http.server`) first. Playwright is also unavailable whenever another session has the MCP browser open (`Browser is already in use … use --isolated`), so do not build a delivery flow that assumes it.

### Via Playwright

```js
// export-print.mjs
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${process.cwd()}/design.html`);

await page.pdf({
  path: "design.pdf",
  width: "85cm",      // dimensões reais
  height: "200cm",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log("PDF exportado: design.pdf");
```

### Via CSS @page

```css
@page {
  size: 85cm 200cm;   /* dimensões reais */
  margin: 0;
}

@media print {
  .canvas {
    width: 85cm;
    height: 200cm;
    transform: none;
    box-shadow: none;
  }
}
```

### Editable deliverable (Illustrator)

A Chrome/Playwright PDF embeds text as **Type 3** fonts and **rasterizes CSS filters** (`drop-shadow`) —
fine for press, useless when the user asks for a "PDF em vector para editar no Illustrator". One job had to
be redone from scratch in reportlab for this reason (client project, 2026-09-29). Build the editable
version directly in **reportlab**:

- **Variable fonts** → pin an instance first: `fonttools varLib.instancer Font[wght].ttf wght=700 -o Font-Bold.ttf`, then `pdfmetrics.registerFont(TTFont(...))`.
- **CSS radial/elliptical gradient** → `canvas.radialGradient(...)` inside `saveState()` + `scale(sx, sy)` to stretch the circle into the ellipse.
- **SVG logos** → `svglib` (`svg2rlg` + `renderPDF.draw`) keeps them as vector paths (`pip install svglib` if missing).
- **Shadows** → bake them into the raster images beforehand; reportlab has no blur filter.

**Gate (Type 3 = fail):** `pdffonts out.pdf` (poppler, if installed) or PyMuPDF
`[f for p in fitz.open('out.pdf') for f in p.get_fonts() if f[2] == 'Type3']` must be empty.

### Rasterizing a CMYK PDF (mockups, previews)

Detect it first: `strings out.pdf | grep -c DeviceCMYK` (> 0 = CMYK content; `strings` if installed — otherwise `grep -ac DeviceCMYK out.pdf`). Then neither obvious tool is safe on its own (2026-09-29):

- `pdftoppm` (poppler, if installed) is **sharp but converts colour naively** — orange came out bright red.
- `sips` (macOS) **renders at 72 dpi and resamples** — the mockup came out blurred.

Recipe: rasterize with `pdftoppm -r 300` for sharpness, then **correct the colour against the JPG exported by Illustrator** for the same artwork (fit per channel on matching pixels) — never ship the naive conversion, and never use `sips` for print-size rasters.

### Press Export Instructions

Include in PDF output:
- Exact dimensions in mm (e.g. "85mm x 200mm final + 3mm bleed = 91mm x 206mm")
- Colour profile: sRGB (digital press) or manual CMYK conversion
- Resolution: >= 300dpi for raster images
- Embedded fonts (ensure @font-face uses correct format)

---

## Fixed-page pieces (A4/A3 that must stay on ONE sheet)

**Put the rhythm in CSS variables at the top** (`--line-h`, `--row-gap`, `--sec-gap`, `--pad`). On a single-page A4 every type or spacing change costs millimetres, and without the variables trimming a piece becomes a hunt through scattered values instead of a one-line edit. A session spent 6+ manual render→count-pages→trim cycles for exactly this reason.

**Estimate the vertical cost BEFORE applying a type-scale change.** "Make the text bigger" has a mm price that only shows up after rendering. In one session the compensation the user proposed (shrinking `--row-gap`/`--sec-gap`) yielded ~6mm against ~17mm of growth, and the sheet only fit after taking space from peripheral slack. Say where the space is coming from; if there is none, present the real levers — `@page` margin, cut content, shrink the display — instead of silently compressing everything to illegibility.

**Verify pagination as a gate, not by eye.** After every export, count pages and check the sheet size before showing it to anyone:

```python
import pypdfium2 as pdfium
d = pdfium.PdfDocument("out.pdf")
print(len(d), [(round(p.get_width()/72*25.4), round(p.get_height()/72*25.4)) for p in d])  # pages, mm
```

A browser-free fallback (no pypdfium2, no Playwright) is in `html-to-pdf.md`.

### Print CSS traps (each of these cost real time)

- `columns: N` inside a **fixed-height** container fragments to the next page instead of balancing. Use a grid or explicit columns.
- Flex children **shrink** when content overflows — 1–2px rules silently vanish with no error. Pin them (`flex: 0 0 auto`) and check the render, not the code.
- A footer anchored with `margin-top: auto` needs an explicit `min-height` inside `@media print`; with `min-height: auto` the flex column collapses and the footer floats up.
- Accented capitals on a dark bar disappear without generous `line-height` — the diacritic gets clipped by the line box.
- `vector-effect: non-scaling-stroke` is **ignored by Chrome `--print-to-pdf`**: shapes drawn with `transform: scale()` came out with a thick stroke and one filled solid (2026-09-22). Recipe: compute the **already-scaled absolute coordinates** in the path (no `scale()` on the element) and set a fixed `stroke-width` in mm.
- Chrome `--print-to-pdf` **rounds the page size and shrinks-to-fit silently**: 56×156 mm came out as 159.12×442.08 pt with a white sliver on the edge, and content wider than the page gets scaled down with no warning (2026-09-29). Recipe: after the 1st export read the real size with `pdfinfo out.pdf` (poppler, if installed) or PyMuPDF `fitz.open('out.pdf')[0].rect`, size `@page` **and** the container in those exact `pt`, re-export, and measure the border **per pixel** on the raster (no white column/row at the edges).

### Stroke icons

Balance of an SVG icon that mixes `stroke` paths with `fill` shapes is **not** predictable from reading the paths — it only appears when rasterized (this project hit the same wall twice: a squashed drop, then a solid bolt dominating its row). Always render at the real sizes of use (24 / 64 / 180 px) before accepting, and rebalance the `fill` shapes by hand whenever the stroke weight changes. Lucide (ISC) is the default base system.

---

## Poster composed by code (AI background + code-rendered lettering)

Canonical sequence for the recurring print-poster flow (several event and car-show posters):

1. **AI background with no text** — say so in the prompt, and keep the top/bottom bands empty so the lettering has somewhere to land.
2. **Upscale (ESRGAN) BEFORE compositing**, never after — the lettering must be drawn at final resolution.
3. **Lettering at 300 dpi** over the upscaled art.
4. **Check brand emblems at real size** — generated vehicles/objects keep recognisable manufacturer badges even when the prompt forbids them.
5. **Export JPG + PDF.**

Known gotchas: heavy display inks bleed past their glyph box; rotating a text block widens its bounding box; Pillow does not read `woff2` (convert to TTF/OTF first).

**Cut-out alignment:** enlarging the cut-out from the centre works only with **one** subject near the centre. With several scattered subjects each one moves a different distance and stops sitting on its own copy — there, enlarge the whole canvas (background + cut-out together) and separate by depth instead (blur + darken the background).

**Builders take `[source] [suffix]` arguments from day one.** Single-piece builders that always write the same filename destroy the previous version, so a "compare the two" request means rebuilding. With no arguments they write the canonical name. This happened twice in one session — both times the earlier version was already gone when the comparison was asked for.

### Photo montage / collage by code (mosaic, story 9:16)

Same rule as the poster: **AI generates only loose pieces, the composition is code (Pillow)**. Whole-image generation was rejected (9 versions of one story montage), and so were invented phrases.

- **Layout in grid units** (e.g. 12×16 cells), each photo spanning N×M cells — mixed sizes come from the spans, not from hand-placed pixels.
- **Crop with a focus point per photo** (face/subject), never a blind centre crop.
- **Text lives in an extra band outside the photos** (short gradient into the band), so it never covers faces; verify by cropping the text zone of the render and looking at it.
- **Decorative elements** (paper, polaroid frame, cut-out letters, tape, scribbles) → gpt-image with transparent background, one element per generation, all in one batch script (`img-gen-openai.md` §«Lote de N imagens»); the code places them.
- **Phrases only if the owner gives them** — never invent the caption/milestone text.
- Versioned names `-vN` from the first render (see builder arguments above).

### Builder scope: a batch builder must be able to build ONE item

A builder that generates N categories/pieces and takes no scope filter is a delivered-work destroyer. Real case: editing one social category re-rendered the seven already approved and **sent to the client**, and because the pipeline had a non-deterministic dependency (`rembg`), the re-renders came out *different* — the client's files changed silently and had to be restored by hand.

Rules, applied from the first version of the script (retrofitting a filter after the damage is not the same thing):

- **Scope argument from day one:** `build.py [categoria|all] [sufixo]`. No arguments = canonical name, full set — the convenient default stays convenient. `build.py posts` touches only `posts`.
- **Check the scope before running it.** List exactly which files the run will write (`--dry-run`, or just print the target paths) and confirm none is marked approved/sent — anything under `_Final/_Enviadas_Cliente/`, `_Sent/`, `_Aprovado/` or already handed over. A hit there is the irreversible case from `rules/task-intake.md` ("escrever por cima de um ficheiro existente é irreversível"): stop and ask, or write to a versioned sibling name.
- **Non-deterministic steps make "regenerate the same thing" false.** `rembg`, AI generation, any sampler with a seed you did not pin: re-running produces a *different* asset, not the same one. Treat every such builder as write-once per delivered piece.
- **Compare hashes after the build against what was delivered.** Cheap and catches exactly this class:
  ```bash
  # antes: guardar o estado do que foi entregue
  find _Final/_Enviadas_Cliente -type f -exec md5sum {} + | sort > /tmp/entregue.md5
  # depois do build:
  md5sum -c /tmp/entregue.md5 --quiet || echo "ALERTA: o build tocou em peças já enviadas ao cliente"
  ```
  Divergence = restore from the delivered copy first, then discuss. Never "it probably came out the same".

**Before showing variants side by side, assert they went through the same pipeline.** One comparison was invalidated because a variant skipped the ESRGAN step (568 KB vs 4.7 MB, ~88 dpi at A3) — the sharpness gap masked the drawing difference that was actually under evaluation. Comparing file sizes is a cheap test that catches it.

---

## Editing an existing PSD (Photoshop + JSX)

Swapping text, swapping a smart-object photo and exporting from a client PSD is driven by JSX through `osascript` (macOS). One session burned 5 attempts reinventing it (text vanishing, broken accents, paragraph text turned into point text). Rules:

- **Before opening:** `app.displayDialogs = DialogModes.NO` and set the colour-profile policy, otherwise a modal (Missing Profile) blocks the script. `osascript … do javascript` then **hangs until timeout with nothing on stdout** — wrap the call in `with timeout`, and if it hangs take a screenshot (computer-use) before waiting longer.
- **JSX source in ASCII:** write accented characters as `\uXXXX` escapes, never raw UTF-8.
- **setText restores the box:** after changing the contents, put back the original `textShape.bounds` so paragraph text is not lost or converted to point text.
- **Smart-object photo:** `replaceContents`, then refit the layer to the original bounds.
- **Verify on the exported file** (open it), never on the script's exit.

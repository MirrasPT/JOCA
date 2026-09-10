---
name: graphic-design
description: "Print and graphic design in HTML/CSS → PDF. MUST be invoked when the user says: roll-up, flyer, trifold, bifold, poster, brochure, leaflet. SHOULD also invoke when: business card, roll up, graphic material, marketing material, fold-out."
triggers: roll-up, flyer, trifold, bifold, poster, brochure, leaflet, business card, roll up, graphic material, marketing material, fold-out, banner, standee, print design, graphic design, export PDF, print
chain: design-review
---

# Graphic Design

Print materials in HTML/CSS with professional press quality. HTML is the canvas, PDF is the deliverable.

**Not web design.** A roll-up targets visual impact at 3 metres, not scroll or responsiveness.

---

## Supported Formats

| Format | Dimensions | Typical use |
|---------|-----------|------------|
| **Roll-Up** | 85×200cm | Events, trade fairs, receptions |
| **Wide Roll-Up** | 150×200cm | Stages, exhibitions |
| **Flyer A5** | 148×210mm | Promotions, events |
| **Flyer A4** | 210×297mm | Presentations, spec sheets |
| **Poster A3** | 297×420mm | Adverts, decoration |
| **Poster A2** | 420×594mm | Outdoor, shop windows |
| **Bifold A4** | 420×297mm (open) | 4-page brochures |
| **Trifold A4** | 630×297mm (open) | 6-page brochures |
| **Business card** | 90×55mm | Contacts |
| **Horizontal banner** | 300×100cm | Stages, platforms |

---

## Workflow

### Step 1 -- Clarify (1 round, all at once)

```
Before starting:
□ Format? (roll-up / flyer / trifold / poster / other)
□ Brand guidelines / DESIGN.md available?
□ Content: text ready, or need structure suggestion?
□ Print destination: online service, local press, self-print?
□ Visual references? (URLs, files, brands you admire)
```

### Step 2 -- Design Philosophy

Define the visual philosophy before writing code:

**Movement name** (1-2 words): e.g. "Editorial Tension", "Elegant Brutalism", "Zen Breathing"

**3 visual parameters:**
1. **Space** -- dense vs airy? full vs empty?
2. **Color temperature** -- warm/cool/neutral? saturated/muted?
3. **Typography** -- aggressive display vs classic serif vs clean sans?

The philosophy guides every decision. If a choice contradicts it, revise.

**Movement examples:**

| Movement | Visual expression |
|-----------|-----------------|
| Concrete Poetry | Monumental color blocks, sculptural typography, brutalist spatial divisions. Polish poster energy meets Le Corbusier. |
| Chromatic Language | Geometric precision, color zones create meaning. Josef Albers meets data viz. |
| Analog Meditation | Paper grain, ink bleeds, vast negative space. Japanese photobook aesthetic. |
| Organic Systems | Rounded shapes, organic arrangements, nature's color via architecture. |
| Geometric Silence | Grid precision, bold photography, dramatic negative space. Swiss formalism meets brutalism. |

**Art/poster mode:**
For artistic (non-commercial) pieces: treat output as museum art, not marketing. Repeated patterns, precise shapes, typography as visual element (not information). Minimal text -- composition communicates. Every alignment is intentional refinement.

### Step 3 -- Brand Assets (if brand involved)

Read `DESIGN.md` if present. Otherwise:
1. Request logo (SVG or high-res PNG >= 300dpi)
2. Confirm brand colors (hex -> OKLCH)
3. Confirm brand typography

**Print resolution rule:**
- Raster images: minimum 300dpi at final print size
- Example: 10x10cm image at 300dpi = 1181x1181px minimum

### Step 4 -- Build

Build in HTML/CSS with real dimensions in mm/cm using `@page` and scale for preview.

### Step 5 -- Export PDF

```bash
# Via Playwright
npx playwright screenshot --viewport=<w>x<h> file:///path/to/design.html output.png

# Or via a node script for a PDF with correct dimensions
node export-print.mjs design.html output.pdf --format A4
```

---

## HTML/CSS for Print

### Base template

```html
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* Real dimensions — scale for browser preview */
  :root {
    --scale: 0.35;  /* Adjust to fit the viewport */
    --width: 85cm;
    --height: 200cm;
  }

  body {
    background: #888;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px;
    min-height: 100vh;
  }

  .canvas {
    width: calc(var(--width) * var(--scale));
    height: calc(var(--height) * var(--scale));
    background: white;
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);

    /* Proportional font scaling */
    font-size: calc(10px * var(--scale));
  }

  /* To export: use real dimensions without scale */
  @media print {
    body { padding: 0; background: none; }
    .canvas {
      width: var(--width);
      height: var(--height);
      font-size: 10px;
      box-shadow: none;
    }
  }
</style>
</head>
<body>
  <div class="canvas">
    <!-- Design here -->
  </div>
</body>
</html>
```

### Print-specific CSS rules

```css
/* Bleed area — 3mm extra on each side for trimming */
.canvas {
  padding: calc(3mm * var(--scale));  /* Safe zone */
}

/* Safe zones */
.safe-zone {
  position: absolute;
  inset: calc(5mm * var(--scale));  /* 5mm minimum margin */
}

/* Minimum typography for print */
.caption { font-size: calc(7px * var(--scale)); }    /* 7pt minimum */
.body-text { font-size: calc(10px * var(--scale)); } /* 10pt comfortable */
.headline { font-size: calc(36px * var(--scale)); }  /* Display */

/* Avoid aliasing on small text */
* { -webkit-font-smoothing: antialiased; }

/* Fonts via @font-face to guarantee embedding in the PDF */
@font-face {
  font-family: 'BrandFont';
  src: url('assets/fonts/BrandFont.woff2') format('woff2');
}
```

---

## Format Templates

### Roll-Up (85x200cm)

**Typical structure (bottom to top):**
```
┌──────────────────────┐ ← Top (logo, tagline)
│    LOGO (top)        │
│    TAGLINE           │
│                      │
│    HERO IMAGE        │ ← 40% of the height
│    (impact image)    │
│                      │
│    MAIN TITLE        │ ← Large, readable at 3m
│    subtitle          │
│                      │
│    BULLETS / INFO    │ ← 3-4 points max
│    • Point 1         │
│    • Point 2         │
│    • Point 3         │
│                      │
│    CTA / CONTACT     │ ← Website, QR code
│    QR CODE           │
└──────────────────────┘ ← Base (background color or gradient)
```

**Roll-up visibility rules:**
- Main text >= 72pt (readable at 3 metres)
- Minimum contrast 4.5:1 text/background
- Max 40 words total
- 1 core message, not a feature list
- Logo at top AND bottom (intentional redundancy)

### Flyer A5/A4

```
┌──────────────────────┐
│  HERO VISUAL         │ ← 50-60% of the space
│  (photo/illustration)│
├──────────────────────┤
│  HEADLINE            │ ← Max 6 words
│  Subtitle            │ ← 1-2 lines
│                      │
│  Body text           │ ← Concise, short lists
│  • Point 1           │
│  • Point 2           │
│                      │
│  DATE / LOCATION     │ ← Practical info
│  LOGO + CONTACT      │
└──────────────────────┘
```

### Trifold A4

Three panels of 210x297mm each (folded = 3 visible panels):

```
FRONT (open):
┌──────────┬──────────┬──────────┐
│ Panel 4  │ Panel 5  │ Panel 6  │
│ (back)   │ (inside) │ (inside) │
└──────────┴──────────┴──────────┘

BACK (folded):
┌──────────────────────────────────┐
│ Panel 1    │ Panel 2  │ Panel 3 │
│ (cover)    │ (cover2) │ (back)  │
└──────────────────────────────────┘
```

**Panel 1 = Cover** -- headline + strong visual, no dense info
**Panel 6 = Back** -- contacts, QR code, final CTA
**Panels 2-5 = Interior** -- content, services, benefits

---

## Graphic Design Principles

### Composition Rules

1. **Visual hierarchy** -- eye follows: largest -> highest contrast -> most colorful. The most important element must dominate.
2. **Negative space** -- breathing room is design, not emptiness. Essential for premium formats.
3. **Alignment** -- max 2 alignments per piece (e.g. left + center). 3+ = visual chaos.
4. **Repetition** -- repeated elements (color, shape, style) create cohesion. Minimum 1 repeated element.
5. **Contrast** -- no contrast = no hierarchy. Use scale, color, weight, or space.

### Anti-slop for Print

| Avoid | Why |
|--------|--------|
| Generic clipart/stock | An obvious stock-library image destroys credibility |
| Text over busy images without legibility | Insufficient contrast = illegible in print |
| More than 3 fonts per piece | Visual fragmentation |
| Multi-color gradients | CMYK printing produces unpredictable results |
| Very light colors (< 15% opacity) | They vanish in print |
| Raster images < 300dpi | Pixelated in print |
| Text too small (< 7pt) | Illegible in print |
| Recycling the same background across N social pieces | Rejected in production: 4 poster backgrounds spread across 28 visuals read as "very weak". Event default: **1 dedicated AI background per category** (generated with the poster as ref via `-i`) and a **carousel** (cover + slides) for dense content, not a post full of text |

### Print Typography

- **Display/Headline**: classic serifs (Playfair Display, Cormorant, EB Garamond) or strong bold sans (Neue Haas, Aktiv Grotesk)
- **Body**: never below 10pt in print, max 65 characters per line
- **Contrast**: bold/regular (not medium/regular -- insufficient difference for print)
- **Avoid**: light/ultralight web fonts (vanish at small print sizes)

---

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
  width: "85cm",      // real dimensions
  height: "200cm",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log("PDF exported: design.pdf");
```

### Via CSS @page

```css
@page {
  size: 85cm 200cm;   /* real dimensions */
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

### Press Export Instructions

Include in PDF output:
- Exact dimensions in mm (e.g. "85mm x 200mm final + 3mm bleed = 91mm x 206mm")
- Color profile: sRGB (digital press) or manual CMYK conversion
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

### Stroke icons

Balance of an SVG icon that mixes `stroke` paths with `fill` shapes is **not** predictable from reading the paths — it only appears when rasterized (this project hit the same wall twice: a squashed drop, then a solid bolt dominating its row). Always render at the real sizes of use (24 / 64 / 180 px) before accepting, and rebalance the `fill` shapes by hand whenever the stroke weight changes. Lucide (ISC) is the default base system.

---

## Poster composed by code (AI background + code-rendered lettering)

Canonical sequence for the recurring print-poster flow (MICS, Montalegre, Espuma, Track Day, Acura):

1. **AI background with no text** — say so in the prompt, and keep the top/bottom bands empty so the lettering has somewhere to land.
2. **Upscale (ESRGAN) BEFORE compositing**, never after — the lettering must be drawn at final resolution.
3. **Lettering at 300 dpi** over the upscaled art.
4. **Check brand emblems at real size** — generated vehicles/objects keep recognizable manufacturer badges even when the prompt forbids them.
5. **Export JPG + PDF.**

Known gotchas: heavy display inks bleed past their glyph box; rotating a text block widens its bounding box; Pillow does not read `woff2` (convert to TTF/OTF first).

**Cut-out alignment:** enlarging the cut-out from the center works only with **one** subject near the center. With several scattered subjects each one moves a different distance and stops sitting on its own copy — there, enlarge the whole canvas (background + cut-out together) and separate by depth instead (blur + darken the background).

**Builders take `[source] [suffix]` arguments from day one.** Single-piece builders that always write the same filename destroy the previous version, so a "compare the two" request means rebuilding. With no arguments they write the canonical name.

**Before showing variants side by side, assert they went through the same pipeline.** One comparison was invalidated because a variant skipped the ESRGAN step (568 KB vs 4.7 MB, ~88 dpi at A3) — the sharpness gap masked the drawing difference that was actually under evaluation. Comparing file sizes is a cheap test that catches it.

---

## Assets: readiness and provenance

**Run an asset-readiness check at the START of any branding/print job**, not at the end. For each brand involved, a table: `format · vector? · transparent? · usable for a lockup?`. One session only discovered at inventory-close that the third-party mark existed solely as JPEG on a solid background — blocking for any co-branding lockup.

**Assets in cloud-sync folders (Google Drive File Stream, `G:`, `D:\Mega`):** never run a recursive `find`/`find -iname` from the client root. File Stream materializes each folder as it is walked and the call hangs past the Bash timeout with no error (happened twice in one session). Navigate to known paths with targeted `ls` instead.

**Also:** after structural edits to large files inside a sync folder, verify an invariant (section/page/ID count) before continuing — a whole brandbook section vanished mid-edit-sequence because the sync regressed the file between writes.

---

## Brand-guidelines Integration

If `DESIGN.md` exists:
```
1. Read logo paths → use them in the assets
2. Read --color-primary, --color-secondary → apply in the design
3. Read typography → use the brand fonts
4. Read anti-references → confirm the design does not look like these
```

If no `DESIGN.md`, run brand-guidelines skill first or request assets from user.

---

## Pre-delivery Checklist

- [ ] Correct dimensions in mm/cm
- [ ] 5mm safe zone respected
- [ ] Text/background contrast >= 4.5:1
- [ ] Fonts >= 7pt in print (>= 10pt for body)
- [ ] Images >= 300dpi (or SVG)
- [ ] Logo in SVG or PNG >= 600px
- [ ] PDF exported + validated in browser
- [ ] Page count + page size in mm verified on the exported PDF (fixed-page pieces: must be exactly 1)
- [ ] Max 3 fonts total
- [ ] Clear visual hierarchy (1 dominant element)
- [ ] **Literal content transcribed from an original:** spelling errors found in the source were listed to the user and a decision taken — never carry them silently into the client deliverable under "the instruction was literal"

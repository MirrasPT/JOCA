---
name: graphic-design
description: "Print and graphic design in HTML/CSS → PDF. MUST be invoked when the user says: roll-up, flyer, trifold, bifold, poster, brochure, folheto, cartaz. SHOULD also invoke when: cartão de visita, business card, roll up, material gráfico, material de marketing, desdobrável."
triggers: roll-up, flyer, trifold, bifold, poster, brochure, folheto, cartaz, cartão de visita, business card, roll up, material gráfico, material de marketing, desdobrável, banner, standee, print design, design gráfico, exportar PDF, imprimir
chain: design-review
---

# Graphic Design

Print materials in HTML/CSS with professional press quality. HTML is the canvas, PDF is the deliverable.

**Not web design.** A roll-up targets visual impact at 3 metres, not scroll or responsiveness.

---

## Supported Formats

| Formato | Dimensões | Uso típico |
|---------|-----------|------------|
| **Roll-Up** | 85×200cm | Eventos, feiras, recepções |
| **Roll-Up largo** | 150×200cm | Palcos, exposições |
| **Flyer A5** | 148×210mm | Promoções, eventos |
| **Flyer A4** | 210×297mm | Apresentações, fichas técnicas |
| **Poster A3** | 297×420mm | Anúncios, decoração |
| **Poster A2** | 420×594mm | Exterior, montras |
| **Bifold A4** | 420×297mm (aberto) | Brochuras 4 páginas |
| **Trifold A4** | 630×297mm (aberto) | Brochuras 6 páginas |
| **Cartão de visita** | 90×55mm | Contactos |
| **Banner horizontal** | 300×100cm | Palcos, estrados |

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
2. **Colour temperature** -- warm/cool/neutral? saturated/muted?
3. **Typography** -- aggressive display vs classic serif vs clean sans?

The philosophy guides every decision. If a choice contradicts it, revise.

**Movement examples:**

| Movimento | Expressao visual |
|-----------|-----------------|
| Concrete Poetry | Blocos de cor monumentais, tipografia escultural, divisoes espaciais brutalistas. Polish poster energy meets Le Corbusier. |
| Chromatic Language | Precisao geometrica, zonas de cor criam significado. Josef Albers meets data viz. |
| Analog Meditation | Grao de papel, sangrias de tinta, negativo vasto. Estetica photobook japones. |
| Organic Systems | Formas arredondadas, arranjos organicos, cor da natureza via arquitectura. |
| Geometric Silence | Precisao de grelha, fotografia bold, negativo dramatico. Swiss formalism meets brutalismo. |

**Art/poster mode:**
For artistic (non-commercial) pieces: treat output as museum art, not marketing. Repeated patterns, precise shapes, typography as visual element (not information). Minimal text -- composition communicates. Every alignment is intentional refinement.

### Step 3 -- Brand Assets (if brand involved)

Read `DESIGN.md` if present. Otherwise:
1. Request logo (SVG or high-res PNG >= 300dpi)
2. Confirm brand colours (hex -> OKLCH)
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

# Ou via node script para PDF com dimensões correctas
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
  
  /* Dimensões reais — escala para preview no browser */
  :root {
    --scale: 0.35;  /* Ajustar para caber no viewport */
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
    
    /* Font scaling proporcional */
    font-size: calc(10px * var(--scale));
  }
  
  /* Para exportar: usar dimensões reais sem scale */
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
    <!-- Design aqui -->
  </div>
</body>
</html>
```

### Print-specific CSS rules

```css
/* Bleed area — 3mm extra em cada lado para corte */
.canvas {
  padding: calc(3mm * var(--scale));  /* Safe zone */
}

/* Zonas seguras */
.safe-zone {
  position: absolute;
  inset: calc(5mm * var(--scale));  /* 5mm de margem mínima */
}

/* Tipografia mínima para print */
.caption { font-size: calc(7px * var(--scale)); }    /* 7pt mínimo */
.body-text { font-size: calc(10px * var(--scale)); } /* 10pt confortável */
.headline { font-size: calc(36px * var(--scale)); }  /* Display */

/* Evitar aliasing em texto pequeno */
* { -webkit-font-smoothing: antialiased; }

/* Fontes via @font-face para garantir embed no PDF */
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
┌──────────────────────┐ ← Topo (logo, tagline)
│    LOGO (topo)       │
│    TAGLINE           │
│                      │
│    HERO IMAGE        │ ← 40% da altura
│    (imagem impacto)  │
│                      │
│    TÍTULO PRINCIPAL  │ ← Grande, legível a 3m
│    subtítulo         │
│                      │
│    BULLETS / INFO    │ ← 3-4 pontos máximo
│    • Ponto 1         │
│    • Ponto 2         │
│    • Ponto 3         │
│                      │
│    CTA / CONTACTO    │ ← Website, QR code
│    QR CODE           │
└──────────────────────┘ ← Base (cor de fundo ou gradient)
```

**Roll-up visibility rules:**
- Main text >= 72pt (readable at 3 metres)
- Minimum contrast 4.5:1 text/background
- Max 40 words total
- 1 core message, not a feature list
- Logo at top AND bottom (intentional redundancy)

### Flyer A5/A4

```
┌────────────────────┐
│  HERO VISUAL       │ ← 50-60% do espaço
│  (foto/ilustração) │
├────────────────────┤
│  HEADLINE          │ ← Máx 6 palavras
│  Subtítulo         │ ← 1-2 linhas
│                    │
│  Corpo do texto    │ ← Conciso, listas curtas
│  • Ponto 1         │
│  • Ponto 2         │
│                    │
│  DATA / LOCAL      │ ← Info prática
│  LOGO + CONTACTO  │
└────────────────────┘
```

### Trifold A4

Three panels of 210x297mm each (folded = 3 visible panels):

```
FRENTE (aberto):
┌──────────┬──────────┬──────────┐
│ Painel 4 │ Painel 5 │ Painel 6 │
│ (back)   │ (inside) │ (inside) │
└──────────┴──────────┴──────────┘

TRÁS (dobrado):
┌──────────────────────────────────┐
│ Painel 1   │ Painel 2 │ Painel 3│
│ (capa)     │ (capa2)  │ (back)  │
└──────────────────────────────────┘
```

**Panel 1 = Cover** -- headline + strong visual, no dense info
**Panel 6 = Back** -- contacts, QR code, final CTA
**Panels 2-5 = Interior** -- content, services, benefits

---

## Graphic Design Principles

### Composition Rules

1. **Visual hierarchy** -- eye follows: largest -> highest contrast -> most colourful. The most important element must dominate.
2. **Negative space** -- breathing room is design, not emptiness. Essential for premium formats.
3. **Alignment** -- max 2 alignments per piece (e.g. left + centre). 3+ = visual chaos.
4. **Repetition** -- repeated elements (colour, shape, style) create cohesion. Minimum 1 repeated element.
5. **Contrast** -- no contrast = no hierarchy. Use scale, colour, weight, or space.

### Anti-slop for Print

| Evitar | Porquê |
|--------|--------|
| Clipart/stock genérico | Imagem de banco de imagens óbvia destrói credibilidade |
| Text over busy images sem legibilidade | Contraste insuficiente = ilegível impresso |
| Mais de 3 fontes por peça | Fragmentação visual |
| Gradientes de múltiplas cores | Impressão CMYK produz resultados imprevisíveis |
| Cores muito claras (< 15% opacidade) | Desaparecem na impressão |
| Imagens raster < 300dpi | Pixelado em print |
| Texto muito pequeno (< 7pt) | Ilegível impresso |
| Reciclar o mesmo fundo por N peças de social | Rejeitado em produção: 4 fundos do cartaz espalhados por 28 visuais leu-se como "muito fraco". Default de evento: **1 fundo AI próprio por categoria** (gerado com o cartaz como ref via `-i`) e **carrossel** (capa + slides) para conteúdo denso, não um post cheio de texto |

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

### Stroke icons

Balance of an SVG icon that mixes `stroke` paths with `fill` shapes is **not** predictable from reading the paths — it only appears when rasterized (this project hit the same wall twice: a squashed drop, then a solid bolt dominating its row). Always render at the real sizes of use (24 / 64 / 180 px) before accepting, and rebalance the `fill` shapes by hand whenever the stroke weight changes. Lucide (ISC) is the default base system.

---

## Poster composed by code (AI background + code-rendered lettering)

Canonical sequence for the recurring print-poster flow (MICS, Montalegre, Espuma, Track Day, Acura):

1. **AI background with no text** — say so in the prompt, and keep the top/bottom bands empty so the lettering has somewhere to land.
2. **Upscale (ESRGAN) BEFORE compositing**, never after — the lettering must be drawn at final resolution.
3. **Lettering at 300 dpi** over the upscaled art.
4. **Check brand emblems at real size** — generated vehicles/objects keep recognisable manufacturer badges even when the prompt forbids them.
5. **Export JPG + PDF.**

Known gotchas: heavy display inks bleed past their glyph box; rotating a text block widens its bounding box; Pillow does not read `woff2` (convert to TTF/OTF first).

**Cut-out alignment:** enlarging the cut-out from the centre works only with **one** subject near the centre. With several scattered subjects each one moves a different distance and stops sitting on its own copy — there, enlarge the whole canvas (background + cut-out together) and separate by depth instead (blur + darken the background).

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
1. Ler logo paths → usar nos assets
2. Ler --color-primary, --color-secondary → aplicar no design
3. Ler tipografia → usar as fontes de marca
4. Ler anti-references → confirmar que o design não se parece com estas
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

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

### Print Typography

- **Display/Headline**: classic serifs (Playfair Display, Cormorant, EB Garamond) or strong bold sans (Neue Haas, Aktiv Grotesk)
- **Body**: never below 10pt in print, max 65 characters per line
- **Contrast**: bold/regular (not medium/regular -- insufficient difference for print)
- **Avoid**: light/ultralight web fonts (vanish at small print sizes)

---

## PDF Export

### Via Playwright (recommended)

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
- [ ] Max 3 fonts total
- [ ] Clear visual hierarchy (1 dominant element)

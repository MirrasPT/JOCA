---
name: slides
description: "Creating HTML/CSS presentations, pitch decks, or slide-based content at 1920x1080. MUST be invoked when the user says: slides, apresentação, presentation, pitch deck, deck, powerpoint, pptx, pitch. SHOULD also invoke when: slide, keynote, html slides, html deck, apresentação html, criar slides."
triggers: slides, apresentação, presentation, pitch deck, deck, powerpoint, pptx, pitch, slide, keynote, html slides, html deck, apresentação html, criar slides, fazer apresentação, pitch institucional, deck de vendas
chain: design-review
---
# Slides

Presentation designer. HTML is the canvas — decks run in any browser, export to PDF and PPTX, and avoid generic templates.

**Not this skill:**
- Web components, UI, app mockups → `frontend`
- Animation exported as MP4/GIF → `video`
- Print materials (flyers, roll-ups) → `graphic-design`

---

## #0 Fact Verification

If the task involves a specific product, brand, or technology: **WebSearch first, never assume.**
Same as `frontend` skill rule #0.

---

## #1 DESIGN.md Integration

If `DESIGN.md` exists in the project → **read before any code**.

```
Read("DESIGN.md")
```

Extract: `--color-*`, typography, logo paths. Apply directly in deck CSS.

If absent but brand is defined → suggest `brand-guidelines` skill, or request assets.

---

## #2 Architecture Decision (always first)

**Decide before writing a single line.** Wrong choice = full rewrite.

| Scenario | Architecture | Key Asset |
|----------|-------------|-----------|
| ≤10 slides, pitch/portfolio, shared state | **Single-file** (`deck_stage.js` web component) | project script — see #9 |
| ≥10 slides, course, parallel multi-agent build | **Multi-file** (each slide = own HTML, aggregated) | `deck_index.html` template — see #9 |

**Single-file hard rules (CSS/JS scope breaks if violated):**
- `<script>` tag goes **after** `</deck-stage>` (never before)
- `display: flex` on sections only in `.active` class, never on base `section`

**Multi-file hard rules:**
- Each slide is self-contained (no shared CSS, no shared state)
- Rename `deck_index.html` → `index.html`, edit MANIFEST to list all slides
- iFrame isolation prevents CSS bleeding between slides

Announce choice with one justification sentence. Await confirmation before writing.

---

## #3 Design Philosophy (before any code)

Define philosophy before choosing colours or layout:

**Movement name** (1-2 words): e.g. "Editorial Tension", "Calculated Brutalism", "Minimal Breath"

**3 parameters:**
1. **Space** — dense vs airy? Compressed vs breathing?
2. **Colour temperature** — warm/cool/neutral? Saturated/desaturated?
3. **Typography** — aggressive display vs classic serif vs clean sans?

Philosophy guides all decisions. Any choice contradicting it → revise.

### Colour Strategy (OKLCH)

```css
:root {
  --color-primary: oklch(L C H);   /* never pure #000/#fff */
  --color-surface: oklch(L C H);
  --color-text: oklch(L C H);
  --color-accent: oklch(L C H);
}
```

Strategy before colours:
- **Restrained** — neutrals + 1 accent ≤10% of slides
- **Committed** — 1 saturated colour 30-60% with strong presence
- **Drenched** — the surface IS the colour (impact slides, transitions)

---

## #4 Junior Designer Mode

Show reasoning before executing. Always.

1. Define: slide count, narrative, aesthetic direction → show user
2. Build 2 showcase slides → Playwright screenshot → "Visual grammar correct?"
3. Await confirmation before building full deck
4. Check-in at ~50% of deck

**Checkpoint script:** "Built X slides. Next: Y. Confirm?" — and actually wait.

Wrong direction at 2 slides = 10 min fix. Wrong direction at 20 slides = start over.

---

## #5 Workflow

### Step 1 — Clarify (1 round, all at once)

```
Before starting — confirm (max 5 questions):
□ How many slides? (determines architecture)
□ Final output: HTML / PDF / editable PPTX?
□ Have brand guidelines, DESIGN.md, or reference deck?
□ Audience and context: investor pitch / conference / internal / course?
□ Tone: informative / persuasive / visual-heavy / data-heavy?
```

### Step 2 — Architecture + Direction

Declare: architecture choice + aesthetic direction (1 sentence each). Await confirmation.

If direction unclear → offer 3 aesthetic options from different schools (never 2 from the same). Generate 2 demo slides per option → Playwright screenshot → user chooses.

### Step 3 — Showcase First (≥5 slides)

2 showcase slides → screenshot → "Visual grammar correct?" → proceed only after confirmation.

### Step 4 — Full Build

Build remaining slides. Check-in at ~50%.

### Step 5 — Export

PDF, PPTX only if explicitly requested. HTML always included.

---

## #6 Variants, Not Answers

Never give a single "correct" direction. For open briefs, offer 3 variations from different schools:

| School | Character |
|--------|-----------|
| Information Architecture (Pentagram) | Rational, data-driven, restrained |
| Motion Poetry (Field.io) | Dynamic, immersive |
| Minimalism (Kenya Hara) | Negative space, refined |
| Experimental Vanguard | Avant-garde, visual impact |

---

## #7 Design Rules

### Fixed-size rendering (mandatory)

Slides are fixed 1920x1080. Implement JS auto-scale + letterboxing.

```js
// deck_stage.js handles this automatically in single-file
// Multi-file: implement scale wrapper per slide
function scaleSlide() {
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  document.querySelector('.slide').style.transform = `scale(${scale})`;
}
window.addEventListener('resize', scaleSlide);
scaleSlide();
```

### Layout rhythm

Never repeat the same structure on consecutive slides:

| Layout | When to use |
|--------|------------|
| **Hero text** | 1 bold statement, nothing else — transition, opening, closing |
| **Data** | chart/number is the hero; caption is secondary |
| **Image-dominant** | full-bleed visual, minimal text overlay |
| **Split** | visual left + text right (or inverted) |
| **Quote** | 1 attributed quote, generous negative space |
| **List** | only when enumeration genuinely serves content |
| **Transition** | between sections — different colour/typography, no dense content |

### Per-slide positioning

Before writing each slide, answer 4 questions:

| Question | Options |
|----------|---------|
| **Narrative role** | Hero / Transition / Data / Quote / Closing |
| **Viewer distance** | 10cm phone / 1m laptop / 10m projection |
| **Visual temperature** | Quiet / Exciting / Calm / Authoritative / Warm / Tense |
| **Content estimate** | 3 thumbnails at 5s — fits? |

### Slide typography

- Display: font with character (Playfair Display, Cormorant, Clash Display, Space Grotesk — never Inter/Roboto as display)
- Minimum contrast: bold/regular (not medium/regular — insufficient difference at distance)
- Hierarchy via scale + weight (ratio ≥1.5 between levels in presentations)
- Projection (≥10m): headline minimum 60px, body minimum 28px

### Space and composition

- Asymmetric grids > centred columns
- Full-bleed images > boxed images
- Generous negative space > cramming
- 1 dominant element per slide — never multiple competing

---

## #8 Anti-Slop for Slides

**Reflex check (two levels):**
- Can someone guess theme + palette from the slide category alone? ("tech startup → dark blue + purple gradient") → revise
- With category + anti-references, still recognise the generic aesthetic family? → revise again

| Avoid | Why |
|-------|-----|
| Inter/Roboto as display | Google Docs look — zero visual character |
| Same layout on consecutive slides | Monotony = low effort |
| Bullet list after bullet list | Death by PowerPoint |
| Purple gradients | AI-generated cliche |
| Emoji in business context | Amateur signal |
| Centred title + centred body on every slide | Default PowerPoint template |
| Decorative icons on every bullet | Icon slop — visual noise, zero meaning |
| Decorative stats with gradient fills | Data slop — only real, relevant data |
| Identical repeated cards | Grid slop |

---

## #9 /export-pdf Command

Export deck to PDF via Playwright.

### Export script

```js
// export-slides.mjs
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(`file://${process.cwd()}/deck.html`);

// Navigate through all slides and export
const slideCount = await page.evaluate(() => 
  document.querySelectorAll('section').length
);

await page.pdf({
  path: "deck.pdf",
  width: "1920px",
  height: "1080px",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log(`PDF exportado: deck.pdf (${slideCount} slides)`);
```

```bash
node export-slides.mjs
```

**Export notes:**
- Text is vector/searchable (not rasterised)
- GSAP animations: pause at final state before exporting (`gsap.globalTimeline.pause()`)
- Verify in browser before exporting: all slides render

---

## PPTX Warning

Editable PPTX requires 4 strict HTML constraints from the first line. Retrofit = 2-3h.

If user wants editable PPTX → confirm in Step 1 → warn about the 4 constraints before writing any code.

PDF only: no special constraints, any valid HTML works.

---

## #10 Speaker Notes

`deck_stage.js` supports speaker notes — add `<aside>` inside each `<section>`. Press `S` in browser for speaker view.

---

## #11 Expert Critique

On request ("review", "score", "is it good?") — or proactively when output seems uncertain:

0-10 across 5 dimensions:
1. **Philosophical coherence** — does the deck feel intentional?
2. **Visual hierarchy** — is priority clear in 3 seconds?
3. **Narrative rhythm** — do layouts vary? Is there progression?
4. **Detail execution** — spacing, alignment, typography
5. **Originality** — avoids the cliches listed above?

Output: total + **Keep** (what works) + **Fix** (critical / important / optimisation) + **Quick Wins** (top 3 under 5 min).

---

## Checklist before delivery

- [ ] Opens in browser, all slides render
- [ ] Keyboard navigation works (arrows, space, S for speaker view)
- [ ] No JS errors in console
- [ ] Fixed-size content scales correctly at different window sizes
- [ ] Text/background contrast ≥4.5:1
- [ ] Layout rhythm — never the same on consecutive slides
- [ ] Typography: display with character (not Inter/Roboto)
- [ ] PDF: text is vector/searchable (not rasterised)
- [ ] PPTX (if requested): text is editable (double-click in PowerPoint = editable text)

---

## Related skills

- `frontend` — web prototypes, UI, app mockups
- `video` — MP4/GIF pipeline for exported HTML animations
- `brand-guidelines` — generate DESIGN.md before this skill
- `anima` — GSAP + Lottie animations
- `graphic-design` — print materials (roll-ups, flyers, trifolds)

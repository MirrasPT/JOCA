Part of the `frontend` skill — loaded on-demand. Brand asset protocol, color/theme/typography/layout rules and Design Advisor mode.

### Brand Asset Protocol (when brand involved)

Brand recognition comes from real assets, not palettes.

| Priority | Asset | Impact |
|-----------|-------|---------|
| 1 | Logo (SVG/PNG) | Maximum |
| 2 | Product images / UI screenshots | Maximum |
| 3 | Colors (extracted from real assets) | Medium |
| 4 | Typography | Support |

**Protocol:**
1. Ask for full list (logo, images, colors, fonts, guidelines)
2. Search `brand.com/press`, `/brand`, `/press-kit`; extract SVG inline from header
3. Download via `curl` or Python `urllib`
4. Verify quality: logo opens clean, images >= 2000px, UI is current version
5. Write `brand-spec.md` with paths + CSS variables

**Never:** CSS shapes or SVG drawings to replace real photos. Stop and ask before using filler.

### Color
- OKLCH. Reduce chroma when lightness approaches 0 or 100.
- Never pure `#000` or `#fff` -- tint toward brand color (chroma 0.005-0.01).
- Pick strategy:
  - **Restrained** -- neutrals + 1 accent <= 10% (default product)
  - **Committed** -- 1 saturated color 30-60% (strong identity)
  - **Drenched** -- the surface IS the color (heroes, campaigns)
- Semantic CSS variables. Never raw hex in components. (Tokens → `design-tokens`; Tailwind mapping → `tailwind`.)
- Light and dark designed together, not one after the other.
- WCAG 4.5:1 body text, 3:1 large text.

### Theme (dark vs light)
Never a default. Write 1 sentence of physical scene: who uses it, where, what ambient light. If the sentence doesn't force the answer, it's not concrete enough.

### Typography
- Distinctive display + refined body. Ratio >= 1.25 between steps.
- Line length: 65-75ch long text, 35-60ch mobile.
- Vary fonts between generations -- never converge on the same one.
- 16px minimum body on mobile.

### Layout
- Vary spacing for rhythm. Same padding everywhere = monotony.
- Asymmetry, overlap, diagonal flow, grid-breaking > centered symmetric.
- **Cardless by default.** Sections, columns, dividers, lists, media blocks > cards. A card only when the card IS the interaction. If a panel works as plain layout without losing meaning, drop the card treatment. (Stacked-cards app UI is the #1 AI tell.)
- **Full-bleed hero:** hero runs edge-to-edge — no inherited page gutters, framed container, or shared max-width; constrain only the inner text/action column. First viewport is a poster, not a document.
  The mechanic (pair the two; `calc(50% - 50vw)` is the piece that does the work):
  ```css
  .container {
    --max-width: 1200px;
    --padding: clamp(20px, 5vw, 80px);
    width: min(var(--max-width), 100% - var(--padding) * 2);
    margin-inline: auto;
  }
  .full-bleed { width: 100vw; margin-left: calc(50% - 50vw); }
  ```
- **Viewport budget:** sticky/fixed header counts against the hero. Header + hero must fit the initial viewport — use `calc(100svh - var(--header-h))` or overlay the header, don't stack.
- Z-index scale defined as tokens, never ad-hoc.

## #5 Design Advisor (direction undefined)

Trigger: "make something beautiful", "I don't know what style", "help me design", "do whatever you think is best".

Don't guess and build. Enter advisor mode:

1. Max 3 questions: audience, main message, emotional tone
2. Restate brief in 100-150 words
3. Recommend 3 directions from 3 different schools:

| School | Character |
|--------|---------|
| Information Architecture (Pentagram) | Rational, data-driven, contained |
| Motion Poetry (Field.io) | Dynamic, immersive, technical beauty |
| Minimalism (Kenya Hara) | Order, negative space, refined |
| Experimental Avant-Garde (Sagmeister) | Avant-garde, generative, impact |
| Eastern Philosophy | Warm, poetic, contemplative |

4. Generate 3 quick HTML demos with real content -> Playwright screenshot -> show
5. User picks -> Junior Designer mode with chosen direction

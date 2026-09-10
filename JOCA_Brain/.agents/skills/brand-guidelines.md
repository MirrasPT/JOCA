---
name: brand-guidelines
description: "Generate a comprehensive brand system document (DESIGN.md + BRAND.md) for any brand or project. MUST be invoked when the user says: brand guidelines, brand system, design system, DESIGN.md, brand, brand audit, brand identity, design guide. SHOULD also invoke when: brand document, tone of voice, color palette, brand guide, visual identity, create DESIGN.md."
triggers: brand guidelines, brand system, design system, DESIGN.md, brand, brand audit, brand identity, design guide, brand document, tone of voice, color palette, create DESIGN.md, create BRAND.md, brand documentation, brand colors, brand typography, brand guide, visual identity
chain: design-tokens
---

# Brand Guidelines

Generates a complete brand system document. Output: `DESIGN.md` + `BRAND.md` — feeds the `frontend` and `slides` skills.

**You are not a visual designer.** You are a brand identity consultant who produces structured documentation for designers.

---

## #0 Fact Verification (top priority)

If the brand is a known one (Anthropic, Nike, Stripe, a local brand, etc.):

1. `WebSearch "<brand> brand guidelines 2026"` → confirm it exists, the current version, recent changes
2. Check whether `DESIGN.md` / `BRAND.md` already exist in the project → update, do not rewrite
3. Never assume colors, fonts or tone of voice without verification — training data is stale

---

## Workflow (8 steps)

### Step 1 · Discovery — 6 questions

One round, all at once:

```
Before starting, confirm:

1. Brand name and type of business?
2. Existing brand file? (guidelines PDF, Figma, assets ZIP, website)
3. Target audience? (age, context, level of sophistication)
4. Tone of voice — which adjectives describe the brand? (e.g. "serious but approachable", "irreverent and young")
5. 2-3 brands you admire aesthetically (not necessarily in the same sector)?
6. 2-3 brands that must NOT be a reference?
```

If the user has already provided enough context, skip to Step 2.

---

### Step 2 · Asset Collection (mandatory)

> Without real assets there is no brand system. CSS shapes or invented colors are not a brand.

#### 2.1 Logo

**Order of acquisition (in order):**
1. The user provides the file
2. `<brand>.com/brand`, `/press`, `/press-kit`, `/media-kit`
3. Inline SVG in the homepage header (`curl -A "Mozilla/5.0" <url>` → extract the `<svg>`)
4. GitHub/npmjs (tech brands have the SVG in the repo)
5. → If nothing works: ask the user

```bash
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -L https://<brand>.com -o /tmp/homepage.html
grep -o '<svg[^>]*>.*</svg>' /tmp/homepage.html | head -5
```

**Check:** the SVG opens without errors · it has a dark and a light version · transparent background

#### 2.1b Asset readiness (do this at the START, not at the end)

For **each** brand involved (including third-party ones in a co-branding), fill in the table before designing anything at all:

| Brand | Format | Vector? | Transparent? | Usable for a lockup? |
|---|---|---|---|---|

In one session the material for one of the brands only existed as a **JPEG with a solid background** — a blocker for any lockup — and that only surfaced when the inventory was closed, after the work had already been designed around it.

#### 2.2 Product / UI (if applicable)

- **Physical product**: official hero image (≥2000px), 2-3 angles
- **Digital product**: screenshots of the real product (App Store, current product — not mockups)

#### 2.3 Colors (extracted from the real HTML/CSS)

```bash
grep -hoE '#[0-9A-Fa-f]{6}' assets/homepage.html | sort | uniq -c | sort -rn | head -20
# Filter out greys (#000000, #ffffff, #f5f5f5) → identify 3-5 brand colors
```

#### 2.4 Typography

```bash
grep -hoE "font-family:[^;']+" assets/homepage.html | sort | uniq
# Or: inspect <link rel="stylesheet"> for Google Fonts / Typekit
```

---

### Step 3 · Color System (OKLCH)

Convert every color to OKLCH. Define 7 semantic roles:

| Role | Description | Example |
|-------|-----------|---------|
| `--color-primary` | Main brand color | Buttons, links, CTAs |
| `--color-secondary` | Complementary or variant | Secondary elements |
| `--color-surface` | Interface background | Backgrounds |
| `--color-surface-alt` | Alternative background | Cards, alternating sections |
| `--color-text` | Main text | Body copy |
| `--color-text-muted` | Secondary text | Labels, captions |
| `--color-accent` | Highlight or alert | Badges, highlights |

**OKLCH rules:**
- Never pure `#000` or `#fff` — tint towards the brand color (chroma 0.005–0.01)
- Reduce chroma as lightness approaches 0 or 100
- Color strategy before choosing:
  - **Restrained**: tinted neutrals + 1 accent ≤10% → product default
  - **Committed**: 1 saturated color 30–60% → strong identity
  - **Drenched**: the surface IS the color → heroes, campaigns

**Check contrast:** text over background ≥4.5:1 (WCAG AA)

---

### Step 4 · Typography System

Define 3 levels:

```
Display: <display-font> — main titles, hero text
Heading: <heading-font> — sections, cards, subtitles
Body: <body-font> — long text, paragraphs
Mono: <mono-font> — code, data, prices
```

**Type scale** (multiples of 4px):
```
xs: 12px / line-height 1.4
sm: 14px / line-height 1.5
base: 16px / line-height 1.6
lg: 18px / line-height 1.5
xl: 24px / line-height 1.3
2xl: 32px / line-height 1.2
3xl: 48px / line-height 1.1
4xl: 64px / line-height 1.05
```

**Rules:**
- Body minimum 16px (avoids iOS auto-zoom)
- Line length: 65–75ch for long text
- Hierarchy via scale + weight contrast (ratio ≥1.25 between steps)
- Never Inter/Roboto/Arial as display — no visual character

---

### Step 5 · Tone of Voice

3 sections:

#### 5.1 Personality (3-5 adjectives)
E.g.: "Direct, careful, no technical jargon, human"

#### 5.2 Writing rules
- **Yes:** short sentences, active voice, strong verbs
- **No:** corporate jargon, superlatives without substance, decorative capitals
- **Form of address:** formal/informal, familiar vs. polite
- **Lengths:** headlines (5-8 words), subtitles (15-25 words), CTAs (2-4 words)

#### 5.3 Contrasting examples

| Wrong | Right |
|--------|---------|
| "Cutting-edge enterprise solution" | "Software the team uses" |
| "We empower sustained growth" | "Grow faster, with less effort" |

---

### Step 6 · Image & Visual Style

4 dimensions:

1. **Photography**: Style (editorial/product/lifestyle), mood (warm/cold/neutral), composition (close-up/wide/overhead), palette (saturated/desaturated/monochrome)
2. **Illustration**: Use it or not? If yes: style (flat/line/3D/hand-drawn), complexity, use (decorative/functional/hero)
3. **Iconography**: Set (Lucide/Heroicons/Phosphor/custom), style (stroke/fill/duotone), sizes (16/20/24/32)
4. **Patterns/Textures**: Use them or not? Context (background/overlay/accent)

---

### Step 7 · Component Tokens

```css
/* Spacing (4px scale) */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-6: 24px;  --space-8: 32px;  --space-12: 48px; --space-16: 64px;

/* Border Radius */
--radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
--shadow-md: 0 4px 6px oklch(0 0 0 / 0.07);
--shadow-lg: 0 10px 15px oklch(0 0 0 / 0.10);

/* Motion */
--duration-fast: 150ms; --duration-base: 250ms; --duration-slow: 400ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);  /* ease-out-quart */
```

---

### Step 8 · Output DESIGN.md

Generate it with this template:

```markdown
# DESIGN.md — <Brand Name>
> Generated on: YYYY-MM-DD | Version: 1.0

## Assets
- Main logo: `assets/brand/logo.svg`
- White logo: `assets/brand/logo-white.svg`
- Dark logo: `assets/brand/logo-dark.svg`
- Favicon: `assets/brand/favicon.svg`

## Color System
```css
:root {
  --color-primary: oklch(L C H);    /* <color> — <usage context> */
  --color-secondary: oklch(L C H);
  --color-surface: oklch(L C H);
  --color-surface-alt: oklch(L C H);
  --color-text: oklch(L C H);
  --color-text-muted: oklch(L C H);
  --color-accent: oklch(L C H);
}
```

## Typography
- Display: <font> (<fallback-font>) — main titles
- Heading: <font> (<fallback-font>) — sections
- Body: <font> (<fallback-font>) — running text
- Mono: <font> — code and data

## Tone of Voice
<Brand personality in 3-5 adjectives>

**Yes:** <writing rules>
**No:** <anti-patterns>

## Image Style
- Photography: <description>
- Illustration: <use/do not use + style>
- Iconography: <set + style>

## Component Tokens
```css
/* copy from Step 7 + the brand's customizations */
```

## Anti-References
You must not look like: <list of brands/styles to avoid>

## register
brand | product  (delete one)
```

Generate `BRAND.md` with asset paths, checksums and update date to track asset refreshes.

---

## Quality rules

- **No invention**: an unconfirmed color/font → mark it `[TO VERIFY]` — never invent
- **OKLCH always**: convert hex → OKLCH before documenting
- **Real asset path**: list only assets that exist in the directory
- **Contrast verified**: calculate the text/background ratio before documenting
- **A contrast quoted in another source is recalculated**: a ratio that comes from an analysis, a briefing or an old manual is a claim, not a fact. In one session the client's `ANALISE.md` said the lockup's problem was "the turquoise over the green"; measured, the turquoise passes AA (5,19) and the one failing was the black of the other half of the wordmark (2,12) — the wrong premise would have gone into the manual whole.
- **Multicolor wordmark**: calculate **every** color of the wordmark against the background, not just the accent color
- **Anti-references mandatory**: without anti-refs the system has no guardrails
- **Trademark warning at delivery**: when proposing a logo/name for commercial use, warn the user that the INPI/EUIPO check is still missing. We have no access to those databases — it is a warning, not an executable task.

---

## Integration with other skills

| Skill | How to use DESIGN.md |
|-------|---------------------|
| `frontend` | Read it at the start — colors, fonts, assets |
| `frontend` | Extract → Tailwind config + CSS variables |
| `slides` | Apply the colors and typography to the deck |
| `graphic-design` | Use the logo, colors and image style |

# Design Dataset — palettes · font pairs · named styles

Bank of axes for consistent design variants. Consumed by `design-shotgun` (axes of the N variants), `frontend` (Design Read) and `design-html`. Load on-demand via `Read()` — NOT auto-loaded.

Goal: operationalise anti-convergence — instead of "diverge from previous projects" (vibes), pick DIFFERENT axes from this bank and record which were used. Inspired by the UI UX Pro Max pattern (dataset > ad-hoc generation).

**Usage rule (design-shotgun):** each variant = 1 named style + 1 palette + 1 font pair, DISTINCT combinations across variants. Never 2 variants with the same style. Record the combination in the output (e.g. `[V2: brutalist-editorial + Ember + Fraunces/Inter]`).

---

## Palettes (OKLCH, verified for AA contrast on body text)

Format: name — background / surface / text / primary / accent. Light and dark where applicable.

### Neutral + 1 accent (SaaS, dashboards, portfolios)
| Name | Background | Surface | Text | Primary | Accent |
|---|---|---|---|---|---|
| Graphite | oklch(98% 0 0) | oklch(94% 0 0) | oklch(22% 0 0) | oklch(55% 0.20 260) | oklch(70% 0.15 80) |
| Graphite Dark | oklch(18% 0.01 260) | oklch(24% 0.01 260) | oklch(93% 0 0) | oklch(70% 0.16 260) | oklch(78% 0.14 80) |
| Ivory | oklch(97% 0.01 90) | oklch(93% 0.02 90) | oklch(25% 0.02 60) | oklch(50% 0.14 30) | oklch(60% 0.11 150) |
| Slate Mint | oklch(97% 0.01 180) | oklch(92% 0.02 180) | oklch(24% 0.02 220) | oklch(58% 0.12 170) | oklch(65% 0.17 45) |
| Ink & Paper | oklch(99% 0 0) | oklch(95% 0 0) | oklch(15% 0 0) | oklch(15% 0 0) | oklch(60% 0.22 25) |

### Warm (artisanal brands, wine, food, editorial)
| Name | Background | Surface | Text | Primary | Accent |
|---|---|---|---|---|---|
| Ember | oklch(96% 0.02 70) | oklch(91% 0.03 70) | oklch(25% 0.04 40) | oklch(50% 0.18 35) | oklch(40% 0.10 130) |
| Terracotta | oklch(95% 0.02 50) | oklch(89% 0.04 50) | oklch(28% 0.05 40) | oklch(55% 0.15 45) | oklch(45% 0.08 200) |
| Bordeaux | oklch(97% 0.01 30) | oklch(92% 0.02 30) | oklch(24% 0.03 20) | oklch(38% 0.14 15) | oklch(72% 0.12 85) |
| Bordeaux Dark | oklch(20% 0.03 20) | oklch(26% 0.04 20) | oklch(94% 0.01 60) | oklch(65% 0.15 20) | oklch(78% 0.13 85) |
| Honey Oak | oklch(96% 0.03 85) | oklch(90% 0.05 85) | oklch(28% 0.04 60) | oklch(58% 0.13 70) | oklch(40% 0.09 260) |

### Cool (tech, fintech, health, legal)
| Name | Background | Surface | Text | Primary | Accent |
|---|---|---|---|---|---|
| Arctic | oklch(98% 0.005 240) | oklch(94% 0.01 240) | oklch(24% 0.02 250) | oklch(52% 0.18 250) | oklch(65% 0.14 190) |
| Deep Sea Dark | oklch(17% 0.02 230) | oklch(23% 0.03 230) | oklch(92% 0.01 220) | oklch(72% 0.13 210) | oklch(80% 0.14 140) |
| Sage Clinic | oklch(97% 0.01 150) | oklch(93% 0.02 150) | oklch(26% 0.02 180) | oklch(52% 0.10 160) | oklch(55% 0.15 260) |
| Steel | oklch(96% 0.005 260) | oklch(91% 0.01 260) | oklch(22% 0.01 270) | oklch(45% 0.08 260) | oklch(60% 0.18 20) |

### High contrast / statement (aggressive landing, streetwear, gaming)
| Name | Background | Surface | Text | Primary | Accent |
|---|---|---|---|---|---|
| Void Neon | oklch(12% 0.01 280) | oklch(18% 0.02 280) | oklch(96% 0 0) | oklch(75% 0.20 150) | oklch(70% 0.25 330) |
| Acid Poster | oklch(95% 0.15 110) | oklch(99% 0 0) | oklch(15% 0 0) | oklch(15% 0 0) | oklch(55% 0.25 300) |
| Blood Orange Dark | oklch(15% 0.01 30) | oklch(21% 0.02 30) | oklch(95% 0.01 60) | oklch(65% 0.23 35) | oklch(85% 0.05 90) |
| Royal Punch | oklch(97% 0 0) | oklch(93% 0.01 300) | oklch(18% 0.02 300) | oklch(45% 0.24 300) | oklch(75% 0.17 60) |

---

## Font pairs (Google Fonts, all with full PT-PT coverage)

| Pair | Display | Body | Personality | Avoid in |
|---|---|---|---|---|
| Classic editorial | Fraunces | Inter | magazine, wine, artisanal | dense dashboards |
| Swiss neutral | Inter (weights 700/400) | Inter | SaaS, fintech | brands with soul |
| Geo-humanist | Bricolage Grotesque | Work Sans | tech with character | legal, health |
| Luxury serif | Playfair Display | Source Sans 3 | premium, hotel, wine | utility apps |
| Brutal contrast | Archivo Black | Archivo | poster, streetwear | long-form content |
| Mono nostalgia | JetBrains Mono | Inter | dev tools, technical docs | consumer B2C |
| Friendly rounded | Nunito | Nunito Sans | kids, social, mental health | serious corporate |
| Condensed editorial | Oswald | Lora | news, sport | dense UI |
| Warm humanist | Poppins | Karla | lifestyle, food | data/tables |
| Grotesque display | Unbounded | Manrope | web3, gaming, music | traditional banking |
| Serious transitional | Libre Baskerville | PT Sans | legal, academic, long editorial | mobile-first apps |
| Technical neo-grotesque | IBM Plex Sans | IBM Plex Sans | enterprise, data | emotional brands |

---

⚠ **No display face in this table may violate `anti-slop-bans.md`.** `Inter`, `system-ui`, `Roboto`,
`Arial` and `Space Grotesk` are banned as display (⬛ hard-reject) — they only count as body. The
Geo-humanist pair had `Space Grotesk` in the display column and silently contradicted it; an agent
that got that combination in a brief built the whole variant on top of a hard-reject.
When adding a pair here, check the Display column against the ban list.

## Named styles (axes for design-shotgun)

Each style = layout + density + shape + motion. Pick 1 per variant.

| Style | Signature | Where it shines |
|---|---|---|
| swiss-grid | visible 12col grid, typography as UI, zero decoration | SaaS, agencies |
| brutalist-editorial | 2-3px borders, no shadows, giant type, flat colors | portfolios, fashion |
| soft-depth | cards with diffuse multi-layer shadow, 16-24px corners, occasional glassmorphism | consumer fintech, health |
| dense-data | tables first, 13-14px typography, zero hero, fixed toolbar | dashboards, admin |
| luxury-still | 60%+ whitespace, serif display, full-bleed photos, slow animation | wine, hotels, jewellery |
| neo-terminal | mono everywhere, green/amber on dark, ASCII, blinking cursor | dev tools, hacker aesthetic |
| paper-collage | paper textures, 1-3° rotations, hard shadows, cut-out elements | artisanal, food, editorial |
| kinetic-poster | giant animated type, scroll-driven, aggressive color | launches, music, events |
| calm-productivity | warm neutrals, medium density, thin iconography, subtle micro-interactions | notes, productivity |
| bento-showcase | asymmetric bento grid, one feature per cell, rich hover states | product landing, dev portfolio |
| retro-web | soft bevels, ironic 90s gradients, custom cursors | side-projects, casual gaming |
| editorial-longform | single 65-75ch column, drop caps, pull quotes, interleaved images | blogs, magazines, docs |

---

## Anti-convergence (mandatory)

Before picking axes, check `memory/projects/*.md` for the latest projects of the same type:
1. Which style/palette/pair was used in the previous 2-3? → **exclude those axes** from the variants.
2. Record in each variant's output the combination used (auditable next session).
3. If the client brief FORCES a repeated axis (brand colors), diverge on the other two.

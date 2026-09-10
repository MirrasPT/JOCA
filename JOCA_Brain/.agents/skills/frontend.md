---
name: frontend
description: "Building production frontend applications with React, Next.js, Vue, Svelte, or modern frontend frameworks. MUST be invoked when the user says: website, landing page, site, webapp, web app, frontend, interface, react. SHOULD also invoke when: next.js, nextjs, prototype, ui, ux. Also answers to the legacy name 'frontend-design' — the skills are flat in .claude/skills/, there is no skills/design/ tree."
triggers: frontend-design, frontend design, website, landing page, site, webapp, web app, frontend, interface, react, next.js, nextjs, prototype, ui, ux, web design, make a site, create page, homepage, components, interface design, website design, mockup, wireframe, tailwind, shadcn, radix, layout, hero, navbar, footer, dashboard, panel, form, checkout, onboarding, portfolio, blog design, e-commerce frontend, SaaS frontend, convert design, implement design, code up, web page, redesign, new site, design system, component library, dark mode, light mode, theme, board game, card game, game UI, deckbuilder, tile grid, engineStore, uiStore, game state react, grid game, card game react
chain: design-review, tester-ui-ux
---
# Frontend — Design Director + Router

Designer + developer. HTML and React. Awwwards as standard, not aspiration.

Each project is different. Never converge on the same choices. If someone looks and says "AI made this" -- failed.

**This skill is the director.** It owns design *direction* (philosophy, taste, UX, anti-slop) and **routes code work to specialists**. Read the relevant specialist BEFORE writing that layer's code.

---

## Decision: prototype vs production

| Signal | Mode |
|-------|------|
| "prototype", "mockup", "show me", "test this", exploring ideas, no existing React repo | **Prototype** -- single-file HTML+React+Babel via CDN, opens with a double-click |
| Existing React/Next.js repo, "implement", "component", "production", PR, deploy | **Production** -- React+TypeScript+Tailwind, component architecture |
| Ambiguous | Ask |

---

## Routing — invoke specialists (read before writing that layer)

The director decides direction, then delegates craft. Notify in 1 line: `[+ <skill>]`.

| Layer / task | Specialist | Read |
|--------------|-----------|------|
| **Design contract** (tokens, component specs, brand) | `design-system` (router) → `brand-guidelines` · `design-tokens` · `component-system` | `Read(".claude/skills/design-system.md")` |
| **React perf/correctness** (re-renders, effects, data-fetching, RSC, bundle) | `react-patterns` | `Read(".claude/skills/react-patterns.md")` |
| **Component API shape** (compound, context, slots, React 19 ref, kill boolean soup) | `react-composition` | `Read(".claude/skills/react-composition.md")` |
| **Styling** (Tailwind 4, cva, cn, dark mode, responsive) | `tailwind` | `Read(".claude/skills/tailwind.md")` |
| **shadcn/ui project** (has `components.json`, Radix+Tailwind copy-paste components) | `shadcn` | `Read(".claude/skills/shadcn.md")` |
| **Email templates** (React Email, client-safe HTML) | `react-email` | `Read(".claude/skills/react-email.md")` |
| **Motion** (GSAP scroll/hero/hover, Lottie icons) | `anima` | `Read(".claude/skills/anima.md")` |
| **Modern native CSS** (scroll-driven, container queries, `:has()`, `color-mix`, `content-visibility`) | modern-css reference | `Read(".claude/reference/frontend/modern-css.md")` |
| **Responsive/touch depth** | `mobile` | `Read(".claude/skills/mobile.md")` |
| **Images** | `img-gen` | `Read(".claude/skills/img-gen.md")` |
| **Review the result** (taste, AI-slop, composition critique) | `design-review` | `Read(".claude/skills/design-review.md")` |
| **Game UI** (board/card/tactical game, Zustand engine+UI stores, DOM grid vs Canvas) | game-ui reference | `Read(".claude/reference/frontend/game-ui.md")` |

**Typical production flow:**
```
design-system (contract) → frontend (direction + assembly)
   → react-composition (component shape) + tailwind (styling) + react-patterns (perf)
   → anima (motion) → design-review (taste/slop/composition) + tester-ui-ux (flows/WCAG) + tester-performance (perf)
```
(`html-review` is NOT a UI reviewer — it converts planning `.md` docs to HTML. Design critique = `design-review`.)
Read specialists on demand when their layer comes up — never pre-load all of them.

---

## #0 Fact Verification

If the task involves a specific product, brand, or technology: **WebSearch first, never assume.**

Triggers: product name, launch dates, versions, recent specs, "I think...", "probably...".

Rule: `WebSearch "<product> 2026 latest"`. Read 1-3 results. If uncertain -- ask.

---

## #1 DESIGN.md + Brand Assets

### DESIGN.md
If present in project -- **read before any code.** Extract `--color-*` tokens, typography, logo paths. Apply in CSS `:root {}`.

If absent and brand exists -- suggest `brand-guidelines` skill first (via `design-system`).

Brand Asset Protocol (priority of real assets + collection protocol) → `Read(".claude/reference/frontend/design-craft.md")`.

---

## #2 Junior Designer Mode

Show reasoning before executing. Always.

1. Write assumptions + reasoning + placeholders first
2. Show early -- grey blocks with labels OK
3. Checkpoint at ~50%: "Did X. Next: Y. Confirm?"
4. Polish only after confirmation

Wrong direction in placeholder = 5 min fix. In full implementation = 2h refactor.

---

## #3 Design Thinking (before any code)

Answer 3 questions:

- **Purpose** -- what problem does it solve? who uses it?
- **Tone** -- pick ONE extreme and execute with precision: brutalist / maximalist / editorial / luxury / organic / playful / industrial / quiet sophistication / raw energy / retro-futuristic
- **Unforgettable element** -- the one element the user will remember?

### Written pre-build artifact (before any production code)

Write 3 lines, show them, then build to them:
1. **Visual thesis** — one sentence: mood + material + energy ("warm editorial, paper texture, calm confidence").
2. **Content plan** — section list, each with ONE job: explain / prove / deepen / convert (hero → support → detail → final CTA).
3. **Interaction thesis** — 2-3 motions that change how the page *feels* (one hero entrance + one scroll/depth + one hover/reveal).

Hard caps unless an existing strong system overrides: **max 2 typefaces, 1 accent color, one dominant idea per section.**

If vision is maximalist -- code is elaborate with extensive animations.
If vision is minimal -- restraint, precision, spacing and typography.
Match execution depth to vision intensity.

Style/palette/font axes → `Read(".claude/reference/design-dataset.md")` (bank of OKLCH palettes + font pairs + named styles; anti-convergence mandatory).
Detailed rules for Color / Theme (dark vs light) / Typography / Layout → `Read(".claude/reference/frontend/design-craft.md")`.

---

## #4 Anti-AI Slop

**Reflex check (two levels):**
1. Can someone guess theme + palette from category alone? ("SaaS = dark blue", "health = white + teal") -> revise
2. Can someone guess the aesthetic family with category+anti-references? -> revise again

**Rule:** if removing an element loses no info, don't add it.

**Named ban — accent `border-left`.** A 2-4px colored bar on the left of a card / callout / message bubble = AI-slop tell. Use a **tinted background** (the same color at low opacity) instead of the bar. Global user rule, already a repeat offender (Kromway, Sala bubbles) — apply it while writing, do not wait for the review.

Table of absolute bans + adblock-safe naming (forbidden tokens in file/component/id/class/`data-*` names) → `Read(".claude/reference/frontend/anti-slop-bans.md")`.

### Anti-convergence (output diversity)

Before committing fonts / accent / aesthetic: check `memory/projects/` for the last JOCA-generated project's choices and **deliberately diverge.** Never converge on the same display font (e.g. Space Grotesk) or palette across projects. If every JOCA page would look alike, the direction failed.

---

## #4b Anti-slop guard-rails (generation)

Hard-stop writing guard-rails (em-dash ban, serif/Inter discipline, anti AI-purple, beige+brass banned, consistency lock, anti-center-hero, italic clearance) → `Read(".claude/reference/frontend/anti-slop-bans.md")`. Apply while WRITING, not only in review.

### Mechanism of the 3 calibrated dials

Before generating, fix 3 dials (each 0–10). Declare the values in the Design Read (below). They determine how far the piece moves away from the safe default:

| Dial | 0 | 10 | Effect |
|------|---|----|--------|
| **Density** | airy, lots of whitespace, few elements | dense, editorial, juxtaposed information | spacing, block size, no. of elements per viewport |
| **Boldness** | restrained, neutral, safe corporate | extreme, high contrast, dramatic scale, committed/drenched color | type scale, accent saturation, hero size |
| **Warmth** | cold, technical, geometric, blueish neutral | warm, organic, human, earthy tone/texture | palette temperature, shape curvature, texture, copy tone |

Rule: the dials must NOT all land in the middle (5/5/5) — that IS the slop. At least one dial at ≥8 or ≤2 (commitment). Each project diverges in dials from the previous one (see Anti-convergence #4).

### "1-line Design Read" pattern (before generating)

Before writing any generation code, emit ONE line that locks the decisions and the dials:

```
Design Read: <tone> · display=<face> body=<face> · accent=<color/non-banned hex> · density=<n> boldness=<n> warmth=<n> · anchor=<memorable element>
```

Example: `Design Read: brutalist editorial · display=Söhne body=Georgia · accent=#1f6f43 · density=8 boldness=9 warmth=3 · anchor=giant number bleeding outside the grid`

If any field lands on a banned default (Inter, purple, beige+brass, center-hero, 5/5/5 dials) → fix the line BEFORE generating, not after. The line is the contract; the code follows it.

---

## #5 Design Advisor (direction undefined)

Trigger: "make something beautiful", "I don't know what style", "help me design", "do whatever you think is best".

Full advisor mode (max 3 questions → brief → 3 directions from 3 schools → 3 HTML demos → choice) → `Read(".claude/reference/frontend/design-craft.md")`.

---

## #11 Verification (before saying "done")

**Prove before editing (CSS/layout fixes).** Do not edit the source file first: reproduce the page at the problem viewport (e.g. 390×844), measure with `getBoundingClientRect()` / `getComputedStyle()`, **inject the candidate fix** (`page.addStyleTag`), re-measure, and only then write to the file. It saves an edit→deploy→look cycle and produces concrete numbers (`left`/`right` vs viewport width, contrast ratio measured instead of estimated).

**Content parity gate** when the task is "rebuild / restyle preserving the content": compare against the source file, on every build, (a) the visible word count and (b) the set of image `src`s. Layout QA (bleed, contrast, touch targets) comes back all green and does not see missing content — in a real case 9 descriptions and 7 images disappeared without a single alarm.

**After batch frontend fixes**, the next step by default is verification in a **real browser** (headless Playwright: screenshot of each page + clean console). `node --check`, well-nested HTML and balanced CSS braces pass 100% on a site that may be inert to the touch. The report always declares what was **not** verified.

---

## References (load on-demand)

| Topic | Reference | Load when |
|---|---|---|
| Game UI (Zustand engine/UI stores, DOM vs Canvas, checklist) | `Read(".claude/reference/frontend/game-ui.md")` | board/card game, engineStore/uiStore, grid |
| Anti-slop bans (absolute table, adblock-safe naming, taste-skill guard-rails) | `Read(".claude/reference/frontend/anti-slop-bans.md")` | before generating new UI; slop review |
| Design craft (brand assets, color, theme, typography, layout, design advisor) | `Read(".claude/reference/frontend/design-craft.md")` | locking the visual direction; undefined direction |
| Design dataset (OKLCH palettes + font pairs + named styles) | `Read(".claude/reference/design-dataset.md")` | before the Design Read; anti-convergence |
| Production + UX + validation (#6 stack/foundation, #7 UX rules, #9 /components, #10 critique, checklists, quality gate) | `Read(".claude/reference/frontend/production-ux.md")` | writing production code; before delivering |
| Prototype mode (single-file HTML+React+Babel) | `Read(".claude/reference/frontend/prototype-mode.md")` | Prototype mode (no React repo) |

---

## Next step (chain)
After building new UI, chain automatically (reversible → without asking, notify `[chain → x]`):
1. `design-review` — taste/composition/AI-slop. If it raises WCAG violations → `a11y-fixer`.
2. `tester-ui-ux` (agent) — flows + WCAG accessibility.
Irreversible (deploy/push) → 1 line of confirmation. See `rules/chaining.md`.

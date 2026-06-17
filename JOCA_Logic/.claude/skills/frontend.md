---
name: frontend
description: "Building production frontend applications with React, Next.js, Vue, Svelte, or modern frontend frameworks. MUST be invoked when the user says: website, landing page, site, webapp, web app, frontend, interface, react. SHOULD also invoke when: next.js, nextjs, protótipo, prototype, ui, ux."
triggers: website, landing page, site, webapp, web app, frontend, interface, react, next.js, nextjs, protótipo, prototype, ui, ux, design web, fazer site, criar página, homepage, componentes, components, design de interface, design de website, mockup, wireframe, tailwind, shadcn, radix, layout, hero, navbar, footer, dashboard, painel, formulário, form, checkout, onboarding, portfolio, blog design, e-commerce frontend, SaaS frontend, converter design, implementar design, codificar, página web, redesign, redesenhar, novo site, design system, component library, dark mode, light mode, tema, theme
---
# Frontend — Design Director + Router

Designer + developer. HTML and React. Awwwards as standard, not aspiration.

Each project is different. Never converge on the same choices. If someone looks and says "AI made this" -- failed.

**This skill is the director.** It owns design *direction* (philosophy, taste, UX, anti-slop) and **routes code work to specialists**. Read the relevant specialist BEFORE writing that layer's code.

---

## Decisao: prototype vs production

| Sinal | Modo |
|-------|------|
| "protótipo", "mockup", "mostra-me", "testa isto", explorar ideias, sem repo React existente | **Prototype** -- single-file HTML+React+Babel via CDN, abre com duplo-clique |
| Repo React/Next.js existente, "implementa", "componente", "produção", PR, deploy | **Production** -- React+TypeScript+Tailwind, component architecture |
| Ambiguo | Perguntar |

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
| **Responsive/touch depth** | `mobile` | `Read(".claude/skills/mobile.md")` |
| **Images** | `img-gen` | `Read(".claude/skills/img-gen.md")` |
| **Review the result** (taste, AI-slop, composition critique) | `design-review` | `Read(".claude/skills/design-review.md")` |

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

### Brand Asset Protocol (when brand involved)

Brand recognition comes from real assets, not palettes.

| Prioridade | Asset | Impacto |
|-----------|-------|---------|
| 1 | Logo (SVG/PNG) | Maximo |
| 2 | Imagens produto / screenshots UI | Maximo |
| 3 | Cores (extraidas de assets reais) | Medio |
| 4 | Tipografia | Suporte |

**Protocol:**
1. Ask for full list (logo, images, colors, fonts, guidelines)
2. Search `brand.com/press`, `/brand`, `/press-kit`; extract SVG inline from header
3. Download via `curl` or Python `urllib`
4. Verify quality: logo opens clean, images >= 2000px, UI is current version
5. Write `brand-spec.md` with paths + CSS variables

**Never:** CSS shapes or SVG drawings to replace real photos. Stop and ask before using filler.

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

### Cor
- OKLCH. Reduce chroma when lightness approaches 0 or 100.
- Never pure `#000` or `#fff` -- tint toward brand color (chroma 0.005-0.01).
- Pick strategy:
  - **Restrained** -- neutrals + 1 accent <= 10% (default product)
  - **Committed** -- 1 saturated color 30-60% (strong identity)
  - **Drenched** -- the surface IS the color (heroes, campaigns)
- Semantic CSS variables. Never raw hex in components. (Tokens → `design-tokens`; Tailwind mapping → `tailwind`.)
- Light and dark designed together, not one after the other.
- WCAG 4.5:1 body text, 3:1 large text.

### Tema (dark vs light)
Never a default. Write 1 sentence of physical scene: who uses it, where, what ambient light. If the sentence doesn't force the answer, it's not concrete enough.

### Tipografia
- Distinctive display + refined body. Ratio >= 1.25 between steps.
- Line length: 65-75ch long text, 35-60ch mobile.
- Vary fonts between generations -- never converge on the same one.
- 16px minimum body on mobile.

### Layout
- Vary spacing for rhythm. Same padding everywhere = monotony.
- Asymmetry, overlap, diagonal flow, grid-breaking > centered symmetric.
- **Cardless by default.** Sections, columns, dividers, lists, media blocks > cards. A card only when the card IS the interaction. If a panel works as plain layout without losing meaning, drop the card treatment. (Stacked-cards app UI is the #1 AI tell.)
- **Full-bleed hero:** hero runs edge-to-edge — no inherited page gutters, framed container, or shared max-width; constrain only the inner text/action column. First viewport is a poster, not a document.
- **Viewport budget:** sticky/fixed header counts against the hero. Header + hero must fit the initial viewport — use `calc(100svh - var(--header-h))` or overlay the header, don't stack.
- Z-index scale defined as tokens, never ad-hoc.

---

## #4 Anti-AI Slop

**Reflex check (two levels):**
1. Can someone guess theme + palette from category alone? ("SaaS = dark blue", "health = white + teal") -> revise
2. Can someone guess the aesthetic family with category+anti-references? -> revise again

### Bans absolutos

| Evitar | Porque |
|--------|--------|
| Gradientes roxos em fundo branco | Cliche "tech/AI" -- zero identity |
| Inter/Roboto/Arial/Space Grotesk como display | No visual character, AI convergence |
| Card + left colored border accent | 2020-2024 slop |
| SVG-drawn people/faces/objects | Proportions always wrong |
| CSS silhouettes instead of product photos | Generic "tech animation", destroys brand identity |
| Emoji como icones | Amateur signal |
| Decorative stats/icons/gradients | Data slop, icon slop, gradient slop |
| Side-stripe borders como accent | `border-left/right` > 1px colorido |
| Gradient text | `background-clip: text` + gradient. Decorative, never meaningful |
| Glassmorphism como default | Decorative blurs without purpose |
| Hero-metric template | Big number + label + stats + gradient (SaaS cliche) |
| Identical repeated card grids | Same cards icon+heading+text |
| Modal como primeira opcao | Modals are lazy -- exhaust inline alternatives |
| PowerPoint transitions | Independent scenes that fade in/out separately |

**Rule:** if removing an element loses no info, don't add it.

### Naming (adblock-safe) — NUNCA usar tokens de adblock em nomes

Ficheiros, componentes, ids, classes e `data-*` do frontend **não podem conter** `banner, cookie, consent, ad, ads, advert, sponsor, promo, popup, newsletter, analytics, track, doubleclick`. O uBlock Origin (e outros adblockers) esconde-os (cosmético) ou **bloqueia o pedido** (`ERR_BLOCKED_BY_CLIENT`):
- token na **raiz** (ex. `<html data-cookie-banner>`) → filtros cosméticos escondem o `<html>` → **página toda branca**;
- token num **módulo carregado em todas as páginas** (ex. `CookieBanner.tsx` importado no layout) → no Vite dev os módulos servem-se no path de origem, e em produção em chunks/assets → o pedido é bloqueado → **ecrã branco em todo o lado**.

Usar nomes **neutros**: `BottomNotice` (não `CookieBanner`), `PresenteDestaque` (não `BannerPresente`), `presente.png` (não `banner.png`), `data-bottom-bar` (não `data-cookie-banner`). Um banner de cookies pode existir — mas o ficheiro/id/atributo tem de ser neutro. **Build verde e `tsc` NÃO apanham isto** — só se vê no browser com a extensão; testar com uBlock ligado ou simular bloqueio de `**/*banner*` e `[data-cookie*]`. (Aprendido em Bigorna 2026-06-16 — branqueou o site 2×.)

### Anti-convergence (output diversity)

Before committing fonts / accent / aesthetic: check `memory/projects/` for the last JOCA-generated project's choices and **deliberately diverge.** Never converge on the same display font (e.g. Space Grotesk) or palette across projects. If every JOCA page would look alike, the direction failed.

---

## #5 Design Advisor (direction undefined)

Trigger: "faz algo bonito", "nao sei que estilo", "ajuda-me a desenhar", "faz o que achares melhor".

Don't guess and build. Enter advisor mode:

1. Max 3 questions: audience, main message, emotional tone
2. Restate brief in 100-150 words
3. Recommend 3 directions from 3 different schools:

| Escola | Caracter |
|--------|---------|
| Arquitectura de Informacao (Pentagram) | Rational, data-driven, contained |
| Motion Poetry (Field.io) | Dynamic, immersive, technical beauty |
| Minimalismo (Kenya Hara) | Order, negative space, refined |
| Vanguarda Experimental (Sagmeister) | Avant-garde, generative, impact |
| Filosofia Oriental | Warm, poetic, contemplative |

4. Generate 3 quick HTML demos with real content -> Playwright screenshot -> show
5. User picks -> Junior Designer mode with chosen direction

---

## #6 Production stack (then delegate)

Default stack the specialists assume:
```
React 19 + TypeScript + Vite + Tailwind CSS 4
```
Alternatives accepted: Next.js (SSR/SSG), Remix, Astro (when it fits).

Standard component architecture:
```
src/
  components/{ui,layout,sections}/   hooks/   lib/{utils.ts,constants.ts}
  styles/globals.css                 types/   pages/
```

Then hand off the craft:
- **Component shape & API** → `react-composition` (compound, context, slots, controlled/uncontrolled)
- **Styling & variants** → `tailwind` (`@theme`, `cva`, `cn`, dark mode)
- **Performance & data** → `react-patterns` (re-renders, effects, waterfalls, RSC, bundle, Lighthouse targets)
- **Motion** → `anima`

The director assembles sections and enforces direction; specialists own their layer's correctness.

---

## #7 UX Rules (apply always, without asking)

### Accessibility (CRITICAL)
- Minimum contrast 4.5:1 text/background, 3:1 large text
- Visible focus rings (2-4px) on all interactives
- Alt text on meaningful images
- Labels on all inputs (not placeholder alone)
- Keyboard navigation works
- `prefers-reduced-motion` respected
- No info conveyed by color alone
- Tab order = visual order

### Touch & Interaction
- Clickable elements >= 44px (HIG) / >= 48px (Material)
- Minimum 8px between targets
- Cursor pointer on clickables
- Loading feedback on async actions
- All animations interruptible -- UI active during motion

### Layout & Responsive
- Mobile-first breakpoints: 375 / 768 / 1024 / 1440
- Correct `viewport-meta` (never disable zoom)
- No horizontal scroll on mobile
- `min-height: 100dvh` (not `100vh`)
- `aspect-ratio` or explicit `width`/`height` on images (CLS prevention)

### Utility copy (product UI ≠ marketing)

Dashboards/admin/app surfaces use **utility copy**, not marketing copy:
- Headings say what the area IS or what you can do: "Selected KPIs", "Plan status", "Last sync" — not "Unlock powerful insights".
- Litmus: an operator scanning only headings/labels/numbers understands the page.
- **No hero on a dashboard** unless explicitly asked.
- Active voice, Title Case, numerals for counts ("8 deployments"), specific button labels ("Save API Key" not "Continue"), error messages that state the fix.

(Marketing/landing copy → `copywriting`, `landing-page`.)

---

## #8 Prototype mode (single-file)

When no React project exists:
```html
<script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
  // React inline -- abre com file://
</script>
```
- Never `const styles = {...}` without unique names (`heroStyles`, `cardStyles`)
- Multiple babel scripts don't share scope -- export via `Object.assign(window, {...})`

Prototype is the director's own territory (fast, no build) — specialists kick in for production repos.

---

## #9 /components

When asked `/components` or "generate component library":

1. `components.md` -- design tokens + typography + each component with props and states
2. `components.html` -- interactive visual library with preview of all components

(Formal specs → `component-system`; styling implementation → `tailwind` + `react-composition`.)

---

## #10 Expert Critique

On request ("review", "score", "is this good?") or proactively when output seems uncertain:

0-10 on 5 dimensions:
1. **Philosophical coherence** -- does the whole feel intentional?
2. **Visual hierarchy** -- priority perceived in 3 seconds?
3. **Detail execution** -- spacing, alignment, typography
4. **Functionality** -- works as UI?
5. **Originality** -- avoids cliches?

Output: total + **Keep** + **Fix** (critical / important / optimization) + **Quick Wins** (top 3 in < 5 min).

### Falsifiable self-tests (run before delivery)

Not opinions — pass/fail gates:
- **Remove-the-image test** — if the first viewport still works without the hero image, the image is too weak.
- **Hide-the-nav test** — if the brand disappears when the nav is hidden, the hierarchy is too weak.
- **Delete-30%-copy test** — if cutting 30% of copy improves the page, keep cutting.
- **Remove-shadows test** — if it stops feeling premium with all decorative shadows removed, the design leaned on decoration.
- **Cardless test** — if any panel becomes plain layout without losing meaning, remove the card.

For a full, structured review pass (3-pillar rubric, AI-slop reject, file:line lint, verdict) → hand to the **`design-review`** skill. This #10 is the quick inline critique during generation.

---

## Validation before delivery

### Prototype
- [ ] Opens in browser without JS errors
- [ ] Mobile 375px tested
- [ ] Contrast verified
- [ ] Keyboard navigation works

### Production
- [ ] TypeScript error-free (`npm run type-check`)
- [ ] Build error-free (`npm run build`)
- [ ] Lighthouse >= 90 performance, >= 90 accessibility
- [ ] Mobile 375px, tablet 768px, desktop 1280px
- [ ] CSS variables from DESIGN.md applied
- [ ] No `any` in TypeScript
- [ ] Focus visible on all interactives
- [ ] No adblock tokens in file/component/id/class/`data-*` names (`banner`/`cookie`/`ad`/`sponsor`/`popup`/`analytics`…) — test once with uBlock ON (white page = blocked name)
- [ ] Code-craft specialists' checklists passed (`react-patterns`, `react-composition`, `tailwind`)

---

## Quality Gate

After delivery, suggest the right reviewer by need:
- **`design-review`** (skill) — taste, AI-slop, composition critique + file:line lint. The default "is this good?" pass.
- **`tester-ui-ux`** (agent) — QA flows + deep WCAG/screen-reader/keyboard.
- **`tester-performance`** (agent) — Lighthouse / load (production).

(`html-review` is unrelated — it converts planning `.md` to HTML for stakeholders, not UI review.)

---

## Related skills

**Code craft (invoked by this director):**
- `react-patterns` -- re-renders, effects, data fetching, bundle, RSC
- `react-composition` -- compound components, context, slots, React 19
- `tailwind` -- Tailwind 4, cva, cn, dark mode, responsive
- `shadcn` -- shadcn/ui component toolkit (Radix + Tailwind, CLI-driven)
- `react-email` -- email templates (React Email)

**Design contract:**
- `design-system` -- router for `brand-guidelines` → `design-tokens` → `component-system`

**Support:**
- `anima` -- GSAP + Lottie (invoked autonomously)
- `mobile` -- responsive and mobile-first
- `img-gen` -- generate images
- `html-review` -- review UI vs current web standards
- `video` -- export HTML animations as MP4/GIF

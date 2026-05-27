---
name: frontend
description: "Building production frontend applications with React, Next.js, Vue, Svelte, or modern frontend frameworks. MUST be invoked when the user says: website, landing page, site, webapp, web app, frontend, interface, react. SHOULD also invoke when: next.js, nextjs, protótipo, prototype, ui, ux."
triggers: website, landing page, site, webapp, web app, frontend, interface, react, next.js, nextjs, protótipo, prototype, ui, ux, design web, fazer site, criar página, homepage, componentes, components, design de interface, design de website, mockup, wireframe, tailwind, shadcn, radix, layout, hero, navbar, footer, dashboard, painel, formulário, form, checkout, onboarding, portfolio, blog design, e-commerce frontend, SaaS frontend, converter design, implementar design, codificar, página web, redesign, redesenhar, novo site, design system, component library, dark mode, light mode, tema, theme
---
# Frontend

Designer + developer. HTML and React. Awwwards as standard, not aspiration.

Each project is different. Never converge on the same choices. If someone looks and says "AI made this" -- failed.

---

## Decisao: prototype vs production

| Sinal | Modo |
|-------|------|
| "protótipo", "mockup", "mostra-me", "testa isto", explorar ideias, sem repo React existente | **Prototype** -- single-file HTML+React+Babel via CDN, abre com duplo-clique |
| Repo React/Next.js existente, "implementa", "componente", "produção", PR, deploy | **Production** -- React+TypeScript+Tailwind, component architecture |
| Ambiguo | Perguntar |

---

## #0 Fact Verification

If the task involves a specific product, brand, or technology: **WebSearch first, never assume.**

Triggers: product name, launch dates, versions, recent specs, "I think...", "probably...".

Rule: `WebSearch "<product> 2026 latest"`. Read 1-3 results. If uncertain -- ask.

---

## #1 DESIGN.md + Brand Assets

### DESIGN.md
If present in project -- **read before any code.** Extract `--color-*` tokens, typography, logo paths. Apply in CSS `:root {}`.

If absent and brand exists -- suggest `brand-guidelines` skill first.

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
- Semantic CSS variables. Never raw hex in components.
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
- Cards are the lazy answer -- use only when genuinely the best affordance.
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

## #6 React + Production

### Stack default
```
React 19 + TypeScript + Vite + Tailwind CSS 4
```

Alternatives accepted: Next.js (SSR/SSG), Remix, Astro (when it fits).

### Component architecture
```
src/
  components/
    ui/            -- Button, Input, Card, Modal (base)
    layout/        -- Header, Footer, Sidebar, Container
    sections/      -- Hero, Features, Pricing, Testimonials
  hooks/           -- custom hooks
  lib/
    utils.ts       -- cn(), formatters
    constants.ts
  styles/
    globals.css    -- design tokens (:root CSS variables)
  types/           -- TypeScript interfaces
  pages/           -- route components
```

### Design tokens -> CSS
```css
:root {
  --color-primary: oklch(0.6 0.15 250);
  --color-surface: oklch(0.98 0.01 250);
  --color-text: oklch(0.15 0.02 250);
  --font-display: 'Playfair Display', serif;
  --font-body: 'Source Sans 3', sans-serif;
  --space-1: 4px; --space-2: 8px; --space-4: 16px;
  --space-8: 32px; --space-16: 64px;
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms; --duration-base: 250ms;
}
```

### Component pattern (cva + TypeScript)
```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-8 text-base',
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

function Button({ variant, size, loading, className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
```

### Anti-patterns React
- Never generic `const styles = {...}` -- always unique names (`heroStyles`, `cardStyles`)
- Never `any` in TypeScript
- Never monolithic components > 200 lines -- compose
- Never inline styles for repeated styling -- Tailwind or CSS class
- Never raw hex -- `var(--color-*)` or Tailwind tokens
- Never `scrollIntoView` -- breaks container scroll

### Prototype mode (single-file)
When no React project exists:
```html
<script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
  // React inline -- abre com file://
</script>
```
- Never `const styles = {...}` without unique names
- Multiple babel scripts don't share scope -- export via `Object.assign(window, {...})`

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

---

## #8 Invoke specialists autonomously

During development, invoke without asking the user:

### Animation (anima)
When design needs motion -- scroll reveals, hero entrance, hover effects, page transitions:
```
Read(".claude/skills/SKILL.md")
```
Apply patterns directly. For complex animations (timeline sequences, scroll-driven narratives), spawn agent:
```
Agent(subagent_type="general-purpose", prompt="[brief with file + animation type + constraints]")
```

### Mobile/Responsive (mobile)
After first design draft, invoke to improve responsive:
```
Read(".claude/skills/SKILL.md")
```
Apply touch, safe areas, and responsive patterns automatically.

Notify in 1 line: `[+ anima]` or `[+ mobile]` when activating.

---

## #9 /components

When asked `/components` or "generate component library":

1. `components.md` -- design tokens + typography + each component with props and states
2. `components.html` -- interactive visual library with preview of all components

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

---

## #11 Performance (production)

- Images: WebP/AVIF with `srcset`, `loading="lazy"` below the fold
- Fonts: `font-display: swap`, preload only critical
- Code splitting: `React.lazy()` + dynamic imports per route
- Bundle: verify with `vite-bundle-visualizer`
- `font-display: swap` or `optional`
- Virtualize lists with 50+ items

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

---

## Quality Gate

After delivery, suggest: "Want `tester-ui-ux`?"

For production, also suggest: "Want `tester-performance`?"

---

## Related skills

- `brand-guidelines` -- generate DESIGN.md before this skill
- `anima` -- GSAP + Lottie animations (invoked autonomously)
- `mobile` -- responsive and mobile-first (invoked autonomously)
- `img-gen` -- generate images when needed
- `video` -- export HTML animations as MP4/GIF

Parte da skill `frontend` — carregado on-demand. Stack de produção (#6), UX rules (#7), /components (#9), Expert Critique (#10), validação e quality gate.

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

### Multi-agent builds: FOUNDATION before fan-out

When parallel agents build per-page or per-feature, shared components (player, card, layout primitives, nav) **MUST be defined and implemented in a sequential FOUNDATION phase** before any fan-out begins. Fan-out agents import from that foundation — they never recreate shared components independently. Classic failure: two agents each build a video player; result is two inconsistent implementations with divergent APIs, styles, and behaviour that cannot be merged without a rewrite. Foundation phase output = a locked shared-components module that all agents treat as read-only.

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

## #9 /components

When asked `/components` or "generate component library":

1. `components.md` -- design tokens + typography + each component with props and states
2. `components.html` -- interactive visual library with preview of all components

(Formal specs → `component-system`; styling implementation → `tailwind` + `react-composition`.)

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

## Quality Gate

After delivery, suggest the right reviewer by need:
- **`design-review`** (skill) — taste, AI-slop, composition critique + file:line lint. The default "is this good?" pass.
- **`tester-ui-ux`** (agent) — QA flows + deep WCAG/screen-reader/keyboard.
- **`tester-performance`** (agent) — Lighthouse / load (production).

(`html-review` is unrelated — it converts planning `.md` to HTML for stakeholders, not UI review.)

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

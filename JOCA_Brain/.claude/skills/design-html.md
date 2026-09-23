---
name: design-html
description: "Turn an approved mockup/design into clean, dependency-free production HTML/CSS — text really reflows, heights are computed, layout is dynamic, zero deps. Adapted from gstack's design-html. MUST be invoked when the user says: code the design, turn it into HTML, build this page, implement this design, make the mockup real, finish the design. SHOULD also invoke when: there is an approved design/mockup ready to become static code."
triggers: code the design, turn into HTML, build the page, implement the design, make the mockup real, finish the design, mockup to HTML, design to code, build the design, code the mockup, design to HTML
chain: frontend, design-review
---
# /design-html — Approved mockup → production HTML/CSS

Takes an approved design/mockup and produces **clean, dependency-free production HTML/CSS**: text really reflows, heights are computed, the layout is responsive. Adapted from gstack's `design-html` (which is Pretext-native; here it is standard HTML/CSS).

Difference from `frontend`: `frontend` builds the React/Next app; `design-html` materialises a **faithful static mockup** (landing page, marketing page, email-safe, navigable prototype) — then chains to `frontend` if it needs to become interactive/React.

## When to use it
- An approved mockup exists (from `design-shotgun`, from an image, or a description) → turn it into real HTML.
- "build this page", "turn it into HTML", "make the mockup real", static landing page.

## Principles
- **Zero deps by default** — HTML + native CSS (custom properties, grid/flex, container queries). No framework unless the project already has one.
- **Fidelity to the mockup** — replicate it faithfully (spacing, hierarchy, color, typography). Do NOT diverge after the 1st section (rule [[design-prototype-fidelity]]: the AI tends to start inventing from section 2 onwards — don't).
- **Design system tokens** — use the existing `DESIGN.md`/tokens; no invented hardcoded color/spacing (no suitable token → `TODO: missing token`, not a value that "looks about right").
- **Text reflows / heights are computed** — no fixed heights that cut content off; the layout adapts to the real content.
- **Smart pattern routing** — pick the right pattern per page type (marketing hero+rows; catalog card-grid; checkout form).
- **Accessible from birth** — semantics (`<main>/<nav>/<header>`), heading order, alt, visible focus, contrast from tokens.

## Workflow
1. **Ingest the mockup** — read the approved design + the system (`DESIGN.md`/tokens/`brand-guidelines`). Skill-first: `Read(".claude/skills/tailwind.md")` if the project uses Tailwind; otherwise native CSS.
2. **Structure** — semantics first (landmarks, headings), then layout (grid/flex), then visual detail.
3. **Implement section by section** — faithful to the mockup; real content where it exists, a marked placeholder where it does not (`<!-- TODO: real copy -->`).
4. **Verify** — a real render (Playwright MCP, or `Start-Process <file.html>` + ask the user for visual confirmation — `.claude/reference/workflows-and-tooling.md`). Confirm reflow, responsiveness, no overflow.

## Replicating the chrome of an existing site (header/footer/nav)

"Fidelity to the mockup" by eye is not enough when the target **exists and is measurable**. Approximating
the chrome by eye left 5 things wrong at once (the nav font, the header width, the language selector, the
active state, the accent) and the user caught them from a screenshot — the fix forced a full rebuild.

**Measure the target first, with numbers:**

```js
// Playwright, against the real site
const el = document.querySelector('header');
const cs = getComputedStyle(el);
({ w: el.getBoundingClientRect().width, font: cs.fontFamily, size: cs.fontSize,
   weight: cs.fontWeight, color: cs.color, bg: cs.backgroundColor, pad: cs.padding });
```

Collect them for **every** piece of the chrome: header · logo · nav items (normal + `:hover` + active
state) · language selector · footer · accent. Keep the table of measured values.

**Then verify with asserts**, not with impressions: re-measure the replica and compare value by value against
the table. A divergence is a defect, not "it looks close".

## ⛔ Never fabricate — it applies to design tokens

`soul.md` forbids inventing paths, APIs and credentials. **Colors, fonts and spacings are the same
class of fact** and they fail the same way: an invented color breaks nothing, passes the build, and is
simply wrong. In this house a plausible `#4aa3df` accent was once invented for a site whose real accent was
`#E9138B`.

Without a **measured** token (from the target) or a **documented** one (`DESIGN.md`/brand-guidelines): write
`TODO: missing token` and report it. Never a value that "looks about right".

## Next step (chain)
- Needs interactivity/state/React → `frontend` (integrates it). To validate taste/slop → `design-review` → (if WCAG) `a11y-fixer`. See `rules/chaining.md`.

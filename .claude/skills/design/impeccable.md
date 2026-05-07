---
name: impeccable
description: "Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks."
argument-hint: "[{{command_hint}}] [target]"
user-invocable: true
allowed-tools:
  - Bash(npx impeccable *)
license: Apache 2.0. Based on Anthropic's frontend-design skill. See NOTICE.md for attribution.
source: https://github.com/pbakaus/impeccable
---

Designs and iterates production-grade frontend interfaces. Real working code, committed design choices, exceptional craft.

## Skill disambiguation — impeccable vs frontend-design

Both skills design production-grade frontends. When in doubt, ask before proceeding:

> "Is there an existing project with PRODUCT.md / DESIGN.md context, or is this a greenfield build?"
> - Iterating / polishing / critiquing existing interface with product context → **impeccable** (this skill — uses `npx impeccable` CLI + PRODUCT.md gates)
> - New build / greenfield / no project context → **frontend-design** (no CLI dependency)

If the user's intent is ambiguous — ask. Don't assume and pivot mid-task.

## Setup (non-optional)

Before any design work or file edits, pass these gates. Skipping them produces generic output that ignores the project.

| Gate | Required check | If fail |
|---|---|---|
| Context | The PRODUCT.md / DESIGN.md loader result is known from `node {{scripts_path}}/load-context.mjs`. | Run the loader before continuing. |
| Product | PRODUCT.md exists and is not empty or placeholder (`[TODO]` markers, <200 chars). | Run `{{command_prefix}}impeccable teach`, refresh context, then resume. Never synthesize PRODUCT.md from the user's original prompt alone. |
| Command | The matching command reference is loaded when a sub-command is used. | Load the reference before continuing. |
| Craft | `{{command_prefix}}impeccable craft` has a user-confirmed shape brief for this task. `teach` / PRODUCT.md never counts as shape. | Run `{{command_prefix}}impeccable shape` and wait for explicit brief confirmation. |
| Image | Required visual probes / mocks are generated or skipped with a reason. | Resolve the image-generation gate in `shape.md` or `craft.md` before code. |
| Mutation | All active gates above pass. | Do not edit project files yet. |

Codex-style agents must state this before editing files:

```text
IMPECCABLE_PREFLIGHT: context=pass product=pass command_reference=pass shape=pass|not_required image_gate=pass|skipped:<reason> mutation=open
```

### 1. Context gathering

Two files, case-insensitive. The loader looks at the project root by default and falls back to `.agents/context/` and `docs/` if the root is clean. Override with `IMPECCABLE_CONTEXT_DIR=path/to/dir`.

- **PRODUCT.md**: required. Users, brand, tone, anti-references, strategic principles.
- **DESIGN.md**: optional, strongly recommended. Colors, typography, elevation, components.

Load both in one call:

```bash
node {{scripts_path}}/load-context.mjs
```

Never pipe through `head`, `tail`, `grep`, or `jq`. The output's `contextDir` field tells you where the files were resolved from.

If PRODUCT.md is missing, empty, or placeholder: run `{{command_prefix}}impeccable teach`, then resume the user's original task with the fresh context.

If DESIGN.md is missing: nudge once per session (*"Run `{{command_prefix}}impeccable document` for more on-brand output"*), then proceed.

### 2. Register

Every design task is **brand** (marketing, landing, campaign, long-form content, portfolio: design IS the product) or **product** (app UI, admin, dashboard, tool: design SERVES the product).

Identify before designing. Priority: (1) cue in the task itself; (2) the surface in focus; (3) `register` field in PRODUCT.md. First match wins.

Load the matching reference: `reference/brand.md` or `reference/product.md`. The shared design laws below apply to both.

## Shared design laws

Apply to every design, both registers. Match implementation complexity to the aesthetic vision. Vary across projects; never converge on the same choices.

### Color

- Use OKLCH. Reduce chroma as lightness approaches 0 or 100; high chroma at extremes looks garish.
- Never use `#000` or `#fff`. Tint every neutral toward the brand hue (chroma 0.005–0.01 is enough).
- Pick a **color strategy** before picking colors:
  - **Restrained**: tinted neutrals + one accent ≤10%. Product default; brand minimalism.
  - **Committed**: one saturated color carries 30–60% of the surface. Brand default for identity-driven pages.
  - **Full palette**: 3–4 named roles, each used deliberately. Brand campaigns; product data viz.
  - **Drenched**: the surface IS the color. Brand heroes, campaign pages.
- The "one accent ≤10%" rule is Restrained only. Committed / Full palette / Drenched exceed it on purpose.

### Theme

Dark vs. light is never a default. Before choosing, write one sentence of physical scene: who uses this, where, under what ambient light, in what mood. If the sentence doesn't force the answer, it's not concrete enough.

"Observability dashboard" does not force an answer. "SRE glancing at incident severity on a 27-inch monitor at 2am in a dim room" does. Run the sentence, not the category.

### Typography

- Cap body line length at 65–75ch.
- Hierarchy through scale + weight contrast (≥1.25 ratio between steps). Avoid flat scales.

### Layout

- Vary spacing for rhythm. Same padding everywhere is monotony.
- Cards are the lazy answer. Use them only when they're truly the best affordance. Nested cards are always wrong.
- Don't wrap everything in a container. Most things don't need one.

### Motion

- Don't animate CSS layout properties.
- Ease out with exponential curves (ease-out-quart / quint / expo). No bounce, no elastic.

### Absolute bans

Match-and-refuse. If you're about to write any of these, rewrite the element with different structure.

- **Side-stripe borders.** `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, callouts, or alerts. Never intentional. Rewrite with full borders, background tints, leading numbers/icons, or nothing.
- **Gradient text.** `background-clip: text` combined with a gradient background. Decorative, never meaningful. Use a single solid color. Emphasis via weight or size.
- **Glassmorphism as default.** Blurs and glass cards used decoratively. Rare and purposeful, or nothing.
- **The hero-metric template.** Big number, small label, supporting stats, gradient accent. SaaS cliché.
- **Identical card grids.** Same-sized cards with icon + heading + text, repeated endlessly.
- **Modal as first thought.** Modals are usually laziness. Exhaust inline / progressive alternatives first.

### Copy

- Every word earns its place. No restated headings, no intros that repeat the title.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses. Also not `--`.

### The AI slop test

If someone could look at this interface and say "AI made that" without doubt, it's failed.

**Category-reflex check** (two altitudes):
- **First-order:** if someone could guess the theme + palette from the category alone ("observability → dark blue", "healthcare → white + teal"), it's the first training-data reflex. Rework until the answer isn't obvious from the domain.
- **Second-order:** if someone could guess the aesthetic family from category-plus-anti-references, it's the trap one tier deeper. Rework until both answers are not obvious.

## Commands

| Command | Category | Description |
|---|---|---|
| `craft [feature]` | Build | Shape, then build a feature end-to-end |
| `shape [feature]` | Build | Plan UX/UI before writing code |
| `teach` | Build | Set up PRODUCT.md and DESIGN.md context |
| `document` | Build | Generate DESIGN.md from existing project code |
| `extract [target]` | Build | Pull reusable tokens and components into design system |
| `critique [target]` | Evaluate | UX design review with heuristic scoring |
| `audit [target]` | Evaluate | Technical quality checks (a11y, perf, responsive) |
| `polish [target]` | Refine | Final quality pass before shipping |
| `bolder [target]` | Refine | Amplify safe or bland designs |
| `quieter [target]` | Refine | Tone down aggressive or overstimulating designs |
| `distill [target]` | Refine | Strip to essence, remove complexity |
| `harden [target]` | Refine | Production-ready: errors, i18n, edge cases |
| `onboard [target]` | Refine | Design first-run flows, empty states, activation |
| `animate [target]` | Enhance | Add purposeful animations and motion |
| `colorize [target]` | Enhance | Add strategic color to monochromatic UIs |
| `typeset [target]` | Enhance | Improve typography hierarchy and fonts |
| `layout [target]` | Enhance | Fix spacing, rhythm, and visual hierarchy |
| `delight [target]` | Enhance | Add personality and memorable touches |
| `overdrive [target]` | Enhance | Push past conventional limits |
| `clarify [target]` | Fix | Improve UX copy, labels, and error messages |
| `adapt [target]` | Fix | Adapt for different devices and screen sizes |
| `optimize [target]` | Fix | Diagnose and fix UI performance |
| `live` | Iterate | Visual variant mode: pick elements in the browser, generate alternatives |

### Routing rules

1. **No argument**: render the table above as the user-facing command menu, grouped by category. Ask what they'd like to do.
2. **First word matches a command**: load its reference file and follow its instructions.
3. **First word doesn't match**: general design invocation. Apply the setup steps, shared design laws, and the loaded register reference.

## Pin / Unpin

**Pin** creates a standalone shortcut so `{{command_prefix}}<command>` invokes `{{command_prefix}}impeccable <command>` directly.

```bash
node {{scripts_path}}/pin.mjs <pin|unpin> <command>
```

# Design system

This file defines the product's visual constraints. **Every new screen is
composed inside them.** No new colors, sizes or components are introduced
without an explicit decision recorded here.

Read by Claude in any design or interface-implementation session.

---

## The four decisions

These are deliberate and human. This is where the product's identity lives.

**Typography:** <family> for interface, <family> for headings (if different)
Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48

**Brand color:** <hex> — used in primary actions and active states. Nothing more.
**Neutral:** <scale, e.g. slate / zinc / stone>

**Shape:** corner radius <value> · borders <thickness and color>

**Density:** <compact | balanced | spacious>
Base spacing unit: <4px | 8px>

---

## Colors

| Use | Token | When |
|---|---|---|
| Primary | `brand-600` | Main action of the screen — **one per screen** |
| Text | `neutral-900` | Body |
| Secondary text | `neutral-500` | Metadata, captions |
| Background | `white` / `neutral-50` | Page and surfaces |
| Border | `neutral-200` | Separators, outlines |
| Success / Warning / Error | `emerald-600` / `amber-600` / `red-600` | State feedback only |

Rule: **color communicates, it does not decorate.** If an element does not change meaning with color, it is neutral.

---

## Base components

They live in `resources/views/components/`. A screen is composed of these:

- `x-button` — variants: primary, secondary, ghost, danger
- `x-input` / `x-select` / `x-textarea` — with label, hint and error
- `x-card` — surface with consistent padding
- `x-badge` — states and labels
- `x-table` — header, rows, empty state
- `x-modal`
- `x-empty-state` — icon, title, description, action
- `x-alert` — info, success, warning, error

**Creating a new component requires justification.** If something appears in two
screens, it is a component. If it appears in one, it is composition.

---

## Composition rules

1. **One primary action per screen.** The rest are secondary or ghost.
2. **Maximum text width:** ~70 characters. Wide content in `max-w-3xl`.
3. **Vertical spacing** between sections: always the same value. Do not tune case by case.
4. **Left alignment** by default. Numbers right-aligned in tables.
5. **No shadows** except on floating elements (modal, dropdown).

---

## Mandatory states

Every screen that shows data has to define all four:

- **Empty** — first use. Explains what will show up here and gives the action to start.
- **Loading** — skeleton, not spinner, when the structure is known.
- **Error** — what failed, in human language, and what to do next.
- **Full** — with a lot of data. Where pagination or scroll comes in.

A screen with no empty state defined is not designed.

---

## Accessibility — minimums

- Text contrast ≥ 4.5:1 (≥ 3:1 for large text)
- All controls reachable by keyboard, with visible focus
- An icon alone as an action always carries `aria-label`
- Information is never conveyed by color alone

---

## Change log

Changes to the system go here, with date and reason.

| Date | Change | Why |
|---|---|---|
| | | |

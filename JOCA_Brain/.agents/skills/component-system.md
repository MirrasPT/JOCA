---
name: component-system
description: "Component inventory and per-component specification documents. MUST be invoked when the user says: component system, component inventory, component spec, component states, button spec. SHOULD also invoke when: input spec, card spec, UI components, UI kit, component library, component documentation."
triggers: component system, component inventory, component spec, component states, button spec, input spec, card spec, UI components, UI kit, component library, component documentation, component anatomy
chain: frontend
---

# Component System

Component inventory and spec. A closed contract that the Frontend consumes.

**Activate** after `design-tokens` generates tokens/, before UI implementation.

---

## Output

```
system/
├── component-inventory.md          ← master list
└── components/
    ├── button.md
    ├── input.md
    ├── textarea.md
    ├── select.md
    ├── checkbox.md
    ├── radio.md
    ├── toggle.md
    ├── badge.md
    ├── avatar.md
    ├── card.md
    ├── modal.md
    ├── toast.md
    ├── dropdown.md
    ├── tabs.md
    ├── table.md
    └── ...                         ← add as needed
```

---

## component-inventory.md

Master list. Read by the frontend at the start of EVERY session.

```markdown
# Component Inventory

**Tokens:** tokens/tokens.css
**Last updated:** [date]

## Session rule

> Before writing UI, read this file + tokens/tokens.css.
> Use ONLY the components and tokens listed here.
> Never invent variants, states or tokens outside this inventory.

## Components

| Component | Variants | Sizes | File |
|-----------|----------|-------|----------|
| Button | primary, secondary, ghost, destructive, link | sm, md, lg | [button.md](components/button.md) |
| Input | default, error | md | [input.md](components/input.md) |
| Textarea | default, error | md | [textarea.md](components/textarea.md) |
| Select | default, error | md | [select.md](components/select.md) |
| Checkbox | default | md | [checkbox.md](components/checkbox.md) |
| Radio | default | md | [radio.md](components/radio.md) |
| Toggle | default | md | [toggle.md](components/toggle.md) |
| Badge | default, success, warning, error | sm, md | [badge.md](components/badge.md) |
| Avatar | default | sm, md, lg | [avatar.md](components/avatar.md) |
| Card | default, interactive | md | [card.md](components/card.md) |
| Modal | default | md, lg | [modal.md](components/modal.md) |
| Toast | success, error, warning, info | md | [toast.md](components/toast.md) |
| Dropdown | default | md | [dropdown.md](components/dropdown.md) |
| Tabs | default | md | [tabs.md](components/tabs.md) |
| Table | default | md | [table.md](components/table.md) |

## Global State Contract

States applied uniformly to ALL interactive components:

| State | Visual | Token delta | CSS |
|--------|--------|------------|-----|
| **default** | Base state | — | — |
| **hover** | Lightness +5% on the bg | `*-hover` tokens | `:hover` |
| **focus-visible** | Ring 2px, offset 2px, color `--color-focus-ring` | `--focus-ring-*` | `:focus-visible` |
| **active** | Lightness -5% on the bg, scale 0.98 | — | `:active` |
| **disabled** | Opacity 0.4, cursor not-allowed | `--*-disabled-opacity` | `[aria-disabled="true"]` |
| **loading** | Spinner overlay, text hidden, pointer-events none | — | `[data-loading]` |

### Focus visible (non-negotiable)

```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

NEVER use `outline: none` without a visible alternative. NEVER use `:focus` without `:focus-visible`.

### Touch targets

Minimum 44x44px for interactive elements (WCAG 2.5.8). If the visual component is smaller (e.g. a 20px checkbox), expand the hit area with padding or a pseudo-element.
```

---

## Template per component

Each `system/components/<name>.md` follows this structure:

```markdown
# [Component Name]

## Anatomy

[Component parts — e.g. container, label, icon-left, icon-right, spinner]

## Variants

| Variant | Use | Tokens |
|---------|-----|--------|
| primary | Main CTA, confirmed destructive action | bg: `--button-bg-primary`, fg: `--button-fg-primary` |
| secondary | Secondary action, cancel | bg: `--button-bg-secondary`, fg: `--button-fg-secondary` |
| ghost | Tertiary action, inline | bg: transparent, fg: `--color-text` |

## Sizes

| Size | Height | Padding-x | Font size | Icon size |
|------|--------|-----------|-----------|-----------|
| sm | 32px | 12px | 14px | 16px |
| md | 40px | 16px | 16px | 20px |
| lg | 48px | 24px | 18px | 24px |

## States

| State | bg | fg | border | transform | extras |
|--------|----|----|--------|-----------|--------|
| default | `--button-bg-primary` | `--button-fg-primary` | none | — | — |
| hover | `--button-bg-primary-hover` | `--button-fg-primary` | none | — | cursor pointer |
| focus-visible | `--button-bg-primary` | `--button-fg-primary` | none | — | ring 2px `--color-focus-ring` offset 2px |
| active | `--button-bg-primary` adjusted -5% L | `--button-fg-primary` | none | scale(0.98) | — |
| disabled | `--button-bg-primary` | `--button-fg-primary` | none | — | opacity 0.4, aria-disabled="true" |
| loading | `--button-bg-primary` | hidden | none | — | spinner centered, pointer-events none |

## Responsive

| Breakpoint | Behavior |
|-----------|--------------|
| < sm | Full width (block), height lg for touch |
| >= sm | Inline, width auto |

## Accessibility

- **Role:** `button` (or a native `<button>`)
- **Disabled:** use `aria-disabled="true"` (not the `disabled` attr — it keeps focus for screen readers)
- **Loading:** `aria-busy="true"`, spinner text as `aria-label`
- **Icon-only:** a descriptive `aria-label` is mandatory
- **Keyboard:** Enter/Space activates

## Do / Don't

| Do | Don't |
|----|-------|
| Use primary for 1 CTA per view | 2+ primary buttons in the same view |
| Label with an action verb ("Save", "Send") | Vague labels ("Ok", "Submit") |
| Ghost for tertiary actions | Ghost for destructive actions |
| Disabled with an explanatory tooltip | Disabled with no explanation |
```

---

## Generation

### Input

1. **tokens/tokens.css** — mandatory (token refs for states)
2. **DESIGN.md** — typography, spacing
3. **PRD.md** — if it exists, extract features to map components
4. **Existing codebase** — if it already has components, document the existing ones

### Process

1. Read tokens/tokens.css
2. Identify the components needed:
   - PRD exists: map features to components
   - No PRD: generate the base set (button, input, card, badge, avatar, modal, toast)
3. Generate component-inventory.md
4. Generate a spec per component (priority: most used first)
5. Present for review
6. Iterate until approval

### Minimum questions

- "Components beyond the base set? (table, dropdown, tabs, sidebar, etc.)"
- "CSS framework? (Tailwind, vanilla CSS, CSS Modules) — it affects the token format in the spec"

---

## Session-start protocol (CRITICAL)

When the `frontend` skill is activated, it MUST:

1. `Read("system/component-inventory.md")`
2. `Read("tokens/tokens.css")`
3. For each component to implement: `Read("system/components/<name>.md")`

It closes the token set — the frontend cannot invent variants, states or tokens outside the inventory.

---

## Updating

Update when:
- A new component is needed (add a spec + an entry in the inventory)
- A token changed (check that the component refs resolve)
- Feedback from `design-system-audit` — missing states, incorrect ARIA
- A new feature in the PRD requires a new variant

---

## Workflow

Pipeline in the JOCA sequence:

-> **before**: `design-tokens` (tokens as input)
-> **after**: `design-system-audit` (validates the complete system) -> `frontend` (consumes it as a contract)

Notify on completion: `-> next: design-system-audit`

---
paths:
  - "resources/views/*.blade.php"
  - "resources/views/**/*.blade.php"
  - "resources/js/**/*.{vue,jsx,tsx,svelte}"
  - "resources/css/**/*.css"
---

# Interface rules

Loaded when Claude **reads** a view or styles file. When creating a screen from scratch without reading any view first, they may not be in context — in that case, read `docs/DESIGN.md` explicitly.

## Before changing anything

Read `docs/DESIGN.md`. It is the source of the visual constraints, not a suggestion.

## Mandatory

- Use the components in `resources/views/components/`. Creating a new component
  requires justification — if something appears in two places, it is a component;
  if it appears in one, it is composition.
- Tokens declared in `@theme` in `resources/css/app.css` (Tailwind 4).
  **There is no `tailwind.config.js`.**
- No color, font size or radius outside the defined tokens.
- A single primary action per screen.

## The four states

Any screen that shows data has to handle all four. A screen with no empty state
defined is not finished:

1. **Empty** — explains what will show up here and gives the action to start
2. **Loading** — skeleton when the structure is known, not a spinner
3. **Error** — what failed, in human language, and what to do next
4. **Full** — with a lot of data, where pagination or scroll comes in

## Accessibility — minimums

- Contrast ≥ 4.5:1 (≥ 3:1 for large text)
- Controls reachable by keyboard, with visible focus
- An icon alone as an action carries `aria-label`
- Information never conveyed by color alone

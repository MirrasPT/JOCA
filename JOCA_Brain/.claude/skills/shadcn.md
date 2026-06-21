---
name: shadcn
description: "Working in a project that uses shadcn/ui — adding, composing, theming, and updating copy-paste Radix+Tailwind components via the official CLI. MUST be invoked when the user says: shadcn, shadcn/ui, components.json, npx shadcn, add component, shadcn block, shadcn theme. SHOULD also invoke when: radix component, dialog, sheet, drawer, sidebar block, dashboard block, registry, cva variant in a shadcn project."
triggers: shadcn, shadcn/ui, shadcn ui, components.json, npx shadcn, shadcn add, shadcn block, shadcn theme, shadcn registry, radix component, dialog component, sheet component, drawer, sidebar block, dashboard block, login block, registry, base ui, lucide, sonner, react-hook-form shadcn, zod form, field group, input group
---
# shadcn — Component Toolkit Specialist

The **concrete implementation** of `tailwind` (cva, cn, semantic tokens, CSS-var theming) + `react-composition` (Radix primitives, asChild, compound). Invoked by `frontend` when a project uses shadcn/ui (has `components.json`).

shadcn/ui is **not a dependency** — components are copied into your codebase (`@/components/ui/*`). You own them. Full customization, no version lock, zero runtime lib.

**Source of truth = the CLI.** Never fetch raw component files from GitHub. Never hand-write what `npx shadcn@latest add` produces.

---

## When this vs design-system

| Situation | Path |
|-----------|------|
| Project has `components.json` / uses shadcn | **this skill** |
| Bespoke design system from scratch (own primitives, no Radix) | `design-system` pipeline |
| shadcn base + heavy brand customization | this skill + `design-tokens` (feed CSS vars) + `tailwind` |

shadcn components already encode `component-system`'s contract (variants/sizes/states) — don't re-author specs for them.

---

## 1. Project context (read first)

Before acting, know the project. Refresh with `npx shadcn@latest info`. Key `components.json` fields:

| Field | Meaning | Affects |
|-------|---------|---------|
| `aliases` | import prefix (`@/components`, `@/lib`) | every import path |
| `rsc` | React Server Components | whether to add `"use client"` |
| `tailwind.cssVariables` | theming mode | semantic tokens vs direct colors |
| `tailwind` version (v4/v3) | config style | `@theme` (v4) vs `tailwind.config` (v3) |
| `style` / `base` | primitive lib (`radix` or `base` = Base UI) | `asChild` vs `render` prop |
| `iconLibrary` | e.g. `lucide-react` | icon imports |
| `packageManager` | npm/pnpm/bun | non-shadcn deps install |
| `framework` | Next.js / Vite / … | routing, RSC defaults |

---

## 2. CLI workflow (always CLI, never manual)

```bash
npx shadcn@latest init                 # setup — creates components.json, css vars, lib/utils (cn)
npx shadcn@latest add button dialog    # add components (deps + files, into @/components/ui)
npx shadcn@latest add                  # interactive picker
npx shadcn@latest search <query>       # discover components/blocks in the registry
npx shadcn@latest view <component>     # inspect before adding
npx shadcn@latest add <comp> --dry-run --diff   # preview files / changes, no write
```

Rules:
- **Check installed first** — look in `@/components/ui` before adding; don't re-add.
- Use `--dry-run` + `--diff` to preview, especially when a file already exists.
- For blocks (login, dashboard, sidebar): `npx shadcn@latest add <block>` from the registry — don't rebuild by hand.
- If the registry isn't the default shadcn one, **confirm which registry** before adding.
- Updating: `add --overwrite` with `--diff` to merge upstream changes while preserving local edits. Never copy raw files from the repo.

---

## 3. Component-first

Compose existing components before writing custom UI.

- Settings page = `Tabs` + `Card` + form controls — not bespoke divs.
- Use built-in **variants** before custom styling (`<Button variant="outline" size="sm">`).
- Customize a variant via its `cva` in the component file (you own it), not via scattered `className`.

### Selection guide
| Need | Component |
|------|-----------|
| Actions | Button, DropdownMenu |
| Inputs | Input, Textarea, Select, Checkbox, Radio, Switch, Slider |
| 2–7 exclusive options | ToggleGroup |
| Forms | Form (react-hook-form + zod) + Field/FieldGroup |
| Overlays | Dialog, Sheet, Drawer, Popover |
| Data | Table, Card, Badge, DataTable |
| Navigation | Sidebar, Tabs, Breadcrumb, NavigationMenu |
| Feedback | Sonner (toast), Alert, Skeleton, Progress |
| Charts | Chart (recharts) |

---

## 4. Styling rules (shadcn conventions)

| Rule | Why |
|------|-----|
| `className` for **layout only** (spacing, position, sizing) | Color/typography come from the component + tokens |
| Semantic tokens, never raw values | `bg-primary text-primary-foreground`, not `bg-blue-600` |
| No manual `dark:` color overrides | Tokens flip via `.dark` automatically |
| `flex gap-*`, never `space-x/y-*` | gap is robust to wrap/RTL |
| `size-*` when w == h | `size-4`, not `h-4 w-4` |
| `truncate` for single-line overflow | shorthand |
| `cn()` for conditional/override classes | merges + resolves conflicts |

Theming = CSS variables in globals (`--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, …). To rebrand: change the vars (feed from `design-tokens`), not per-component classes. Tailwind v4 → vars live under `@theme` / `:root` + `.dark`.

---

## 5. Composition patterns (don't violate)

- **Keep items in their Group:** `SelectItem` inside `SelectGroup`; `DropdownMenuItem` inside its content.
- **Custom triggers:** `asChild` (Radix) or `render` (Base UI) — never wrap a trigger in an extra clickable.
  ```tsx
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  ```
- **Accessible overlays:** Dialog/Sheet/Drawer **must** have a title (`DialogTitle`; use `VisuallyHidden` if visually omitted).
- **Full Card structure:** `Card > CardHeader (CardTitle, CardDescription) > CardContent > CardFooter`.
- **Avatar always has `AvatarFallback`.**

### Forms (the shadcn way)
- Structure with `FieldGroup` + `Field` (label/control/description/error), not raw divs.
- `InputGroup` + `InputGroupInput`/`InputGroupTextarea` for addons (icons, buttons inside inputs).
- `FieldSet` + `FieldLegend` for grouped checkboxes/radios.
- Validation: `data-invalid` on `Field`, `aria-invalid` on the control. Wire with react-hook-form + zod resolver.

---

## 6. Icons

- Pass icon **components/objects**, not string keys.
- Inside buttons: mark with `data-icon` (or rely on `[&_svg]` styles) — **don't add sizing classes** to component icons; the component sizes them.
- Stay consistent with the project's `iconLibrary` (usually `lucide-react`).

---

## 7. MCP (optional)

shadcn ships a registry MCP server — gives the agent live registry/component metadata without doc lookups. If configured in the project, prefer it for discovery; otherwise use the CLI (`search`/`view`). Either way, **install via CLI**.

---

## Checklist

- [ ] Read project context (`components.json` / `info`) before acting
- [ ] Checked installed components before adding
- [ ] Added via CLI (`--dry-run --diff` when overwriting), never raw GitHub files
- [ ] Composed existing components before custom UI
- [ ] `className` layout-only; semantic tokens for color
- [ ] `asChild`/`render` for custom triggers; items inside their Group
- [ ] Overlays have accessible titles
- [ ] Forms use Field/FieldGroup + data-invalid/aria-invalid
- [ ] Icons consistent, no sizing classes, `data-icon` in buttons
- [ ] `"use client"` added where `rsc` requires it

---

## Related skills

- `frontend` — director; routes here when project uses shadcn
- `tailwind` — the styling layer shadcn is built on (cva, cn, `@theme`)
- `react-composition` — Radix/compound patterns shadcn embodies
- `design-tokens` — feed CSS variables to rebrand shadcn
- `component-system` — alternative (bespoke specs) when NOT using shadcn
- `react-patterns` — RSC/`"use client"` boundary rules

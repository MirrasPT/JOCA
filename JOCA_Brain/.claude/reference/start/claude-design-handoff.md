# Handoff to Claude Design (route 1 of Part E2)

The user chose to create the design in **Claude Design** (claude.ai). JOCA prepares the package,
pauses, and converts whatever comes back.

## 1. The package to deliver

Create `design/handoff/` with copies of:

| File | Why it goes |
|---|---|
| `PRD.md` | product context — Claude Design composes better with the why |
| `BRAND.md` | identity, tone, logo |
| `DESIGN.md` | the chosen direction (typography, palette, shape, density) — these are CONSTRAINTS |
| `SCREENS.md` | the full list of screens, each with purpose and states |

Plus `PROMPT.md` — the ready-to-paste text, generated from this skeleton:

```
I am going to give you 4 documents of a product called <name>. Create:
1. The design system (tokens as CSS custom properties, base components) following DESIGN.md
   to the letter — it is the contract, not inspiration.
2. Every screen listed in SCREENS.md, one standalone HTML file per screen,
   with THE FOUR STATES (empty · loading · error · full) separated by a heading.
3. Plausible sample data from the domain — never lorem ipsum.
4. HTML comments marking which design system component each block uses.
Format: standalone HTML/CSS/JS, no external frameworks, tokens only via custom properties.
```

Tell the user: upload the 4 + the prompt to Claude Design; when you are done, put the exported
files in `design/claude-design/` and let me know.

## 2. When the files come back

1. **Inventory against `SCREENS.md`** — screen by screen, an `ls` is not enough: what is missing is
   listed explicitly, do not assume everything came.
2. **`validate-design` on every screen** — tokens vs `DESIGN.md` (blocks if they diverge), 4 states,
   accessibility. Claude Design does not know the project; the gatekeeper is here.
3. **Convert to the stack** — the HTML is the REFERENCE, the conversion is a faithful re-implementation:
   - Laravel/Livewire → Blade + Flux components, tokens in `@theme` (`laravel-specialist` + `design-html`)
   - Next.js → React + Tailwind components (`frontend` + `tailwind` + `design-html`)
   - Flutter → `ThemeData` + widgets (`design-html` to read, theme by hand)
4. Originals stay in `docs/mockups/` (versioned reference). `design/claude-design/` can be deleted
   after the conversion is validated — ask first.

## Known pitfall

Claude Design generates its own CSS per screen. **Two screens with slightly different tokens is the
expected defect**, not the exception — that is why `validate-design` runs BEFORE the conversion:
converting a screen outside the system is paying for the conversion twice.

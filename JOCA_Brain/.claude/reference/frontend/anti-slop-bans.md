Part of the `frontend` skill — loaded on-demand. Absolute bans (#4), adblock-safe naming and generation guard-rails (#4b).

### Absolute bans

| Avoid | Why |
|--------|--------|
| Purple gradients on a white background | "tech/AI" cliche -- zero identity |
| Inter/Roboto/Arial/Space Grotesk as display | No visual character, AI convergence |
| Card + left colored border accent | 2020-2024 slop |
| SVG-drawn people/faces/objects | Proportions always wrong |
| CSS silhouettes instead of product photos | Generic "tech animation", destroys brand identity |
| Emoji as icons | Amateur signal |
| Decorative stats/icons/gradients | Data slop, icon slop, gradient slop |
| Side-stripe borders as accent | `border-left/right` > 1px colored |
| Gradient text | `background-clip: text` + gradient. Decorative, never meaningful |
| Glassmorphism as default | Decorative blurs without purpose |
| Hero-metric template | Big number + label + stats + gradient (SaaS cliche) |
| Identical repeated card grids | Same cards icon+heading+text |
| Modal as the first option | Modals are lazy -- exhaust inline alternatives |
| PowerPoint transitions | Independent scenes that fade in/out separately |

### Naming (adblock-safe) — NEVER use adblock tokens in names

Frontend files, components, ids, classes and `data-*` **must not contain** `banner, cookie, consent, ad, ads, advert, sponsor, promo, popup, newsletter, analytics, track, doubleclick`. uBlock Origin (and other adblockers) hides them (cosmetic) or **blocks the request** (`ERR_BLOCKED_BY_CLIENT`):
- token at the **root** (e.g. `<html data-cookie-banner>`) → cosmetic filters hide the `<html>` → **whole page blank**;
- token in a **module loaded on every page** (e.g. `CookieBanner.tsx` imported in the layout) → in Vite dev modules are served at the source path, and in production in chunks/assets → the request is blocked → **blank screen everywhere**.

Use **neutral** names: `BottomNotice` (not `CookieBanner`), `PresenteDestaque` (not `BannerPresente`), `presente.png` (not `banner.png`), `data-bottom-bar` (not `data-cookie-banner`). A cookie banner may exist — but the file/id/attribute has to be neutral. **A green build and `tsc` do NOT catch this** — it only shows in the browser with the extension; test with uBlock on or simulate blocking of `**/*banner*` and `[data-cookie*]`. (Learned on an e-commerce project, 2026-06-16 — it whited out the site 2×.)

## #4b Anti-slop guard-rails (generation) — adopted from taste-skill (MIT)

Apply while WRITING, not only in review. Every rule is a hard-stop during generation. (Origin: Leonxlnx/taste-skill, MIT — attribute it.)

- **Em-dash ban** — never write `—`/`–` in UI copy. Comma, parentheses or colon. It is the #1 LLM tell.
- **Serif / Inter discipline** — `Inter`/`system-ui`/`Roboto`/`Arial`/`Space Grotesk` NEVER as display/heading; body fallback only. Display = editorial serif / distinctive grotesque / face with character.
- **Anti AI-purple/lilac** — zero purple/indigo/violet as accent or gradient. Ban hue ~`250–290` and the hexes `#6366f1 #7c3aed #8b5cf6 #a855f7 #818cf8`. Purple→pink on a white background = forbidden.
- **Premium beige+brass palette banned** — do not use warm beige + gold/brass as the dominant pair (`#f5f0e8 #ede4d3 #e8dcc4` + `#b8860b #c9a227 #bfa46f #d4af37`). It is as much slop as the purple. Diverge.
- **Color/shape consistency lock** — 1 color decision + 1 shape language across the whole piece. Border-radius, shadow and border coherent between components of the same level. Look like a system, not a sampler.
- **Anti-center-hero** — do not center everything in the hero. Asymmetry, left alignment, overlap, grid-break. Center-everything = LLM default.
- **Italic descender clearance** — italics need `line-height`/`padding-right` so they do not clip descenders (`g j p q y`) nor the slant against the border. Never italics with a tight `overflow:hidden`.

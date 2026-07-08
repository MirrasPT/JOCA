Parte da skill `frontend` — carregado on-demand. Bans absolutos (#4), naming adblock-safe e guard-rails de geração (#4b).

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

### Naming (adblock-safe) — NUNCA usar tokens de adblock em nomes

Ficheiros, componentes, ids, classes e `data-*` do frontend **não podem conter** `banner, cookie, consent, ad, ads, advert, sponsor, promo, popup, newsletter, analytics, track, doubleclick`. O uBlock Origin (e outros adblockers) esconde-os (cosmético) ou **bloqueia o pedido** (`ERR_BLOCKED_BY_CLIENT`):
- token na **raiz** (ex. `<html data-cookie-banner>`) → filtros cosméticos escondem o `<html>` → **página toda branca**;
- token num **módulo carregado em todas as páginas** (ex. `CookieBanner.tsx` importado no layout) → no Vite dev os módulos servem-se no path de origem, e em produção em chunks/assets → o pedido é bloqueado → **ecrã branco em todo o lado**.

Usar nomes **neutros**: `BottomNotice` (não `CookieBanner`), `PresenteDestaque` (não `BannerPresente`), `presente.png` (não `banner.png`), `data-bottom-bar` (não `data-cookie-banner`). Um banner de cookies pode existir — mas o ficheiro/id/atributo tem de ser neutro. **Build verde e `tsc` NÃO apanham isto** — só se vê no browser com a extensão; testar com uBlock ligado ou simular bloqueio de `**/*banner*` e `[data-cookie*]`. (Aprendido em Bigorna 2026-06-16 — branqueou o site 2×.)

## #4b Anti-slop guard-rails (geração) — adoptado de taste-skill (MIT)

Aplicar na ESCRITA, não só no review. Cada regra é hard-stop durante a geração. (Origem: Leonxlnx/taste-skill, MIT — atribuir.)

- **Em-dash ban** — nunca escrever `—`/`–` em copy de UI. Vírgula, parêntesis ou dois pontos. É o tell #1 de LLM.
- **Serif / Inter discipline** — `Inter`/`system-ui`/`Roboto`/`Arial`/`Space Grotesk` NUNCA como display/heading; só body fallback. Display = serif editorial / grotesque distintivo / face com carácter.
- **Anti AI-purple/lila** — zero roxo/índigo/violeta como accent ou gradiente. Banir hue ~`250–290` e os hex `#6366f1 #7c3aed #8b5cf6 #a855f7 #818cf8`. Roxo→rosa em fundo branco = proibido.
- **Paleta premium beige+brass banida** — não usar bege quente + dourado/latão como par dominante (`#f5f0e8 #ede4d3 #e8dcc4` + `#b8860b #c9a227 #bfa46f #d4af37`). É tão slop como o roxo. Divergir.
- **Color/shape consistency lock** — 1 decisão de cor + 1 linguagem de forma em toda a peça. Border-radius, sombra e borda coerentes entre componentes do mesmo nível. Parecer sistema, não sampler.
- **Anti-center-hero** — não centrar tudo no hero. Assimetria, alinhamento à esquerda, overlap, grid-break. Center-everything = default de LLM.
- **Italic descender clearance** — itálico precisa de `line-height`/`padding-right` para não cortar descenders (`g j p q y`) nem a inclinação contra a borda. Nunca itálico com `overflow:hidden` apertado.

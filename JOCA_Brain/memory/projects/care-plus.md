---
name: care-plus
type: project
status: active
location: D:\Mega\Care Plus
last_session: 2026-07-01
---

# Care+ (CarePlus)

Marca de um **software de acompanhamento social** moderno e acolhedor — *"conectar pessoas,
instituições e comunidades por meio de um cuidado contínuo, humano e eficiente"*. Projecto de
design/branding (cliente/pessoal, PT-PT). Localização: `D:\Mega\Care Plus`.

## Identidade (fonte da verdade = `info/`)
- **Nome/tagline:** Care+ · "Acompanhamento social".
- **Símbolo:** 4 figuras humanas em catavento (rotação 90°) formando um "+" no espaço negativo — pessoas, ligação, cuidado contínuo. O "+" faz parte do wordmark.
- **Paleta (quente/terrosa):** castanho `#392519` · terracota `#c1603c` · ocre `#ca8f4d` · sálvia `#819b82` · creme `#f2e9e0`. Fundo = creme (não branco), texto = castanho (não preto).
- **Tipografia:** Sofia Pro (Adobe Typekit `https://use.typekit.net/ohm2sam.css`, `font-family:"sofia-pro"`), Regular 400 + Bold 700 (+ itálicos).
- **Logos:** 5 composições (símbolo · horizontal · horizontal+tagline · vertical · vertical+tagline) × 3 tratamentos (`cor` · `mono-escuro` · `claro`) × 3 formatos (SVG/PNG/PDF) = 45 ficheiros.

## Estrutura
- `info/` — assets originais do cliente (brandboard.png, info.txt, logos por tratamento). **NÃO mexer** — fonte.
- `brandguide/` — **criado 2026-07-01** (esta sessão): pasta organizada com `design.md` (sistema de marca completo, 9 secções, cores em OKLCH + papéis semânticos + WCAG), `README.md` (guia rápido), `brand-guide.html` (guia visual one-pager, valida os SVGs reais + Sofia Pro), `assets/brandboard.png`, `logos/{cor,mono-escuro,claro}` (45 ficheiros).

## Estado actual
Brand guide organizado e documentado. `brand-guide.html` renderizado e validado no browser (via http local — file:// está bloqueado no MCP playwright). Nenhum código de produto ainda.

## Decisões tomadas
- 2026-07-01 — `brandguide/` derivado 100% da fonte real (`info.txt` + brandboard + SVGs); OKLCH calculado dos HEX; nada de cores/fontes inventadas. Fonte `info/` intacta.
- 2026-07-01 — **Sem git.** Renato decidiu: `brandguide/` fica só no Mega, NÃO commitar.

## Pendente
- Eventual: site/produto Care+ (aplicar DESIGN.md via skill `frontend`).

## Última sessão
2026-07-01 — Criado `brandguide/` (design.md + README + brand-guide.html + 45 logos organizados); validado visualmente.

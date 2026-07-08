---
name: stickers-premium
description: Redesign de stickerspremium.com — proposta de template HTML/CSS/JS hoje, Shopify depois
type: project
directorio: D:\Mega\Stickers Premium
---

**Stack:** Design/Frontend (HTML/CSS/JS proposal) → Shopify (theme) depois
**Objectivo:** Redesign do site stickerspremium.com. HOJE: proposta de design (template) em HTML/CSS/JS a partir do conteúdo real. Depois: build em Shopify.
**Directório:** `D:\Mega\Stickers Premium`
**Iniciado:** 2026-07-03
**PRD:** não gerado
**Why:** Loja Shopify (vinil/decals automóvel) com tema genérico; precisa de identidade própria e melhor UX.
**How to apply:** Design usa SEMPRE conteúdo real extraído em `content/` — nunca inventar copy/produtos/preços/elementos de brand. Skills: `frontend`, `brand-guidelines`, `tailwind`, `copywriting`, `page-cro`, `seo`, `design-review`; fase Shopify `shopify-router`/`shopify-theme`.

## Site actual (snapshot 2026-07-03)
- Shopify, EN/PT/FR/DE, EUR €. Reviews Judge.me. Entidade **Kimage Design & Advertising Solutions**, Vila Nova de Famalicão, PT. Support support@stickerspremium.com (returns usa guisampaio1984@gmail.com — inconsistente).
- Escala: **176 produtos · 120 colecções · 7 páginas**. Product types finos (Decals|Stickers 130, Vinyl Banners 11, Hoodies 1, untyped 33) → segmentação por colecção+tags, taxonomia **brand-first** (BMW/Ferrari/Ducati/campervans).
- Marca: logo **STICKERS** preto condensed + **premium** script dourado. Paleta preto `#000` + dourado `#CFB53B` + CTA verde `#108474` (dois accents a unificar). Trust: envio grátis 99€, -15% em 2+, garantia 4–8 anos, devoluções 30 dias + EU 14 dias.
- Aviso fair-use sobre marcas registadas (essencial dado o catálogo).

## Estado actual
✅ Conteúdo TODO extraído para `D:\Mega\Stickers Premium\content\` (00-README index · 01-brand · 02-site-content · 03-product-catalogue 175 prods · 04-navigation-taxonomy · assets/logo.png · raw/products.json + sitemaps + 05-reference-analysis dos 3 concorrentes).
✅ **Design-shotgun: 3 direcções de homepage** construídas em `proposal/` (V1-midnight escuro · V2-atelier editorial · V3-apex motorsport), todas com conteúdo real + 13 imagens curadas de carros premium aplicados. `compare.html` compara-as. `BRIEF.md` = brief partilhado.
✅ **DECISÃO (2026-07-03): direcção = V1 Midnight** (premium escuro/cinematográfico, preto+dourado, Lamborghini). Homepage **refinada a acabamento**: off-road tile trocada de verde (Hoonigan) p/ monocromática (Jeep+tree-line), wordmark "premium" script melhorado, reveal-on-scroll + header solidify, focus-visible a11y. Desktop+mobile (390) verificados, zero overflow.
✅ **Tiles de categoria completas (8/8):** Sponsors/T-Shirts/Custom-Design não tinham foto (eram painéis sólidos). Reais existem no site (Red Bull/Gulf/Öhlins/Motul + hoodies Honda/Triumph) mas são estúdio-fundo-branco → destoavam da grelha escura. **Geradas 3 no estilo do site via Gemini nano-banana (agy)**: `gen-sponsors`/`gen-apparel`/`gen-custom` (preto+dourado, garagem escura, SEM trademarks). Reais guardadas em `content/refs/cats/` como alternativa.
✅ **ENTREGÁVEL: `stickers-premium-v1-midnight.zip`** (raiz do projecto, 3.85 MB) — auto-contido p/ o programador publicar online: index.html (caminhos `../assets/`→`assets/`) + 14 imagens + README.txt (nota fontes CDN, conteúdo real, 3 imgs AI-placeholder).
⏳ Próximo: estender V1 a páginas internas (colecção com filtros + produto) OU iterar detalhes; depois build Shopify.

## Direcção visual (V1 Midnight — fonte da verdade)
Base `#0A0A0B` + charcoal `#141416` · único accent dourado `#CFB53B` (+`#E5C97A`). Type: Oswald condensed (display/nav/kickers) + Inter (body) + Allura (script "premium"). Hero cinematográfico com scrim triplo. Cards charcoal c/ hairline dourado + pill "15 Colours" + hover lift/glow. SEM verde/laranja, sem grunge/topográfico (clichés dos concorrentes). Ficheiro: `proposal/v1-midnight/index.html` (self-contained, Google Fonts + imagens locais).

## Gaps flagados (não fabricar)
- FAQ page = placeholder vazio (sem Q&A real) → oportunidade de redesign.
- Emails de contacto inconsistentes.
- Dois accents (verde CTA vs dourado brand) — unificar no redesign.

## Decisões tomadas
- 2026-07-03 — Direcção de design = **V1 Midnight** (premium escuro preto+dourado). Descartado o verde do tema antigo e o laranja/PrestaShop dos concorrentes.
- 2026-07-03 — Estratégia de posicionamento: **"o extremo premium de uma categoria cheia de dropship baratas"** — não competir em catálogo/preço (Star Sam et al.), ganhar em percepção de qualidade (o logo + "Premium" no nome são o activo).
- 2026-07-03 — Imagens de categoria em falta: preferir reais do site; quando as reais destoam do estilo (estúdio-branco vs grelha escura), **gerar no estilo via Gemini nano-banana SEM logos reais** (trademark-safe).

## Última sessão
2026-07-03 — Extracção de conteúdo → análise das 3 refs do cliente → design-shotgun 3 variantes → escolha V1 → refinamento → 3 imagens de categoria geradas → ZIP entregável p/ programador.

## Pendente
- Estender V1 às páginas internas: **colecção** (listagem + filtros facetados) + **produto** (galeria, selector cor/tamanho, add-to-cart).
- (Opcional) trocar as 3 imgs geradas por foto de produto real; autorar FAQ real (page vazia).
- Depois: **build Shopify** (theme).

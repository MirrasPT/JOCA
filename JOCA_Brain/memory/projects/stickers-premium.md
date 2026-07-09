---
name: stickers-premium
description: Redesign de stickerspremium.com — proposta de template HTML/CSS/JS hoje, Shopify depois
type: project
directorio: /Users/renatoferreira/MEGA/Stickers Premium
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
✅ **V2 alternativo p/ o cliente (2026-07-08): direcção "Apex Motorsport"** em `proposal/v2-apex/index.html` — mesmo conteúdo real e mesmas 16 imagens do V1, layout cinético: display Anton pesado + oblíquos skewX, hero com numeral de corrida "01" outline + speed-lines + diagonal cut, ticker/marquee dourado de specs, tiles com panel-cut (canto cortado), pills angulares, numerais grandes na secção Why. Mantém preto+dourado (brand), energia vem do movimento — trademark-safe. Desktop verificado inteiro (todas as secções). Mobile não validável no browser-tool do Mac (min 500px + screenshot fixo ~1288px) mas breakpoints são cópia do V1 (verificado 390 zero overflow) + `overflow-x:hidden`. Cliente escolhe entre V1 Midnight e V2 Apex.
✅ **V3 — abordagem DIFERENTE (2026-07-08)** em `proposal/v3-technical/index.html`. Feedback do Renato: V1 e V2 partilhavam o mesmo esqueleto (escuro, preto+dourado, hero fotográfico full-bleed) → V2 lia como "V1.1". V3 muda a abordagem toda, não só a pele: **fundo claro (paper `#F4F1E9`)**, sistema tipográfico novo **Space Grotesk + Space Mono** (sem Oswald/Anton/Allura), **grelha visível** em tudo, orientado a **dados/specs** — códigos de secção R01–R07, CAT-0X, SKU, FIG.0X, REP-0X, `[DUR]/[FIT]/[SHIP]/[RET]`, key-values mono, marcas de registo nos cantos, highlighter dourado sobre palavras/preços-chave, custom band invertido (ink) como único bloco escuro. Hero = split spec-sheet (esquerda copy+spec-block / direita FIG.01 emoldurada). Dados reais surfaced: **176 produtos · 120 colecções**, 15 cores, 120 pcs, MFR Kimage Design & Advertising Solutions. **Sem inventar contagens por categoria** (não existiam no conteúdo real). Desktop verificado inteiro.
✅ **V4 — "Immersive" (2026-07-09), reconstruído de raiz** em `proposal/v4-immersive/index.html`. Feedback do Renato: mudar efeitos/fonts não chega — os V1/V2 partilham o MESMO esqueleto (hero foto full-bleed, escuro do início ao fim). V4 muda a **estrutura E a dinâmica de cor**: **bandas a alternar CLARO↔ESCURO conforme o scroll** (hero claro editorial → ticker escuro → categorias claro staggered → spotlight escuro full-bleed "01" gigante → best sellers claro rail numerado → custom escuro → why claro → reports escuro → newsletter dourado → footer). Hero = headline gigante + faixa letterbox (não texto-sobre-foto). Display **Archivo** (não Oswald/Space Grotesk). **Cores religadas ao logo**: dourado exacto amostrado do script = **`#C89830`** (não `#CFB53B`, que puxava a esverdeado) + **preto puro `#0A0A0A`** + branco. Parallax em várias camadas: faixa letterbox, thumbs (cat+rail, in-frame via `--par`), fundos full-bleed (spotlight/custom, `data-fb`), e números-índice gigantes (`data-py`). Best-sellers hover sem reflow (fundo dourado, sem barra lateral). `prefers-reduced-motion` desliga tudo.
✅ **Comparador `proposal/v1_v4/index.html`** — 2 iframes empilhados (V1 + V4), toggle **vertical à direita, centrado na vertical, ocultável** (hide à esquerda → aba `‹` reabre; atalhos 1/2/H). Rótulos **V1 / V2** — o "V2" aponta para o ficheiro `v4-immersive` (o V4 vai ser apresentado como **V2** ao cliente).
✅ **ENTREGÁVEL: `stickers-premium-compare-v1-v2.zip`** (raiz do projecto, 4.7 MB) — comparador self-contained testado por extracção limpa: `index.html` (compare, caminhos `../`→`./`) + `v1-midnight/` + `v4-immersive/` + `assets/img/` (17) + README. Só Google Fonts precisa de net.
⏳ Próximo: cliente escolhe. Direcções vivas: **V1 Midnight** (escuro cinematográfico) · **V2=V4 Immersive** (bandas claro/escuro + parallax) · V3 Technical (claro datasheet) · V2-apex antigo. Depois estender a vencedora a páginas internas (colecção+produto) → build Shopify.

## Direcção visual (V1 Midnight — fonte da verdade)
Base `#0A0A0B` + charcoal `#141416` · único accent dourado `#CFB53B` (+`#E5C97A`). Type: Oswald condensed (display/nav/kickers) + Inter (body) + Allura (script "premium"). Hero cinematográfico com scrim triplo. Cards charcoal c/ hairline dourado + pill "15 Colours" + hover lift/glow. SEM verde/laranja, sem grunge/topográfico (clichés dos concorrentes). Ficheiro: `proposal/v1-midnight/index.html` (self-contained, Google Fonts + imagens locais).

## Gaps flagados (não fabricar)
- FAQ page = placeholder vazio (sem Q&A real) → oportunidade de redesign.
- Emails de contacto inconsistentes.
- Dois accents (verde CTA vs dourado brand) — unificar no redesign.

## Decisões tomadas
- 2026-07-09 — **V4 "Immersive" = o que vai ser apresentado como "V2" ao cliente** (o V2-apex antigo saiu do palco). Direcção V4: bandas a alternar claro↔escuro no scroll + parallax multi-camada + estrutura editorial (rail numerado, spotlight, staggered grid) — o único que rompe o esqueleto dos outros.
- 2026-07-09 — **Cores ligadas ao logo**: dourado exacto = **`#C89830`** (amostrado do PNG do logo, mais âmbar que o `#CFB53B` usado antes) + **preto puro** + branco. Display do V4 = **Archivo** (escolha do Renato entre Archivo/Fraunces/Syne/Anton).
- 2026-07-09 — Entregar comparações como **comparador de iframes com toggle** (não zips separados): toggle vertical, pequeno, centrado, ocultável.
- 2026-07-03 — Direcção de design = **V1 Midnight** (premium escuro preto+dourado). Descartado o verde do tema antigo e o laranja/PrestaShop dos concorrentes.
- 2026-07-03 — Estratégia de posicionamento: **"o extremo premium de uma categoria cheia de dropship baratas"** — não competir em catálogo/preço (Star Sam et al.), ganhar em percepção de qualidade (o logo + "Premium" no nome são o activo).
- 2026-07-03 — Imagens de categoria em falta: preferir reais do site; quando as reais destoam do estilo (estúdio-branco vs grelha escura), **gerar no estilo via Gemini nano-banana SEM logos reais** (trademark-safe).

## Última sessão
2026-07-09 — Reanálise do V3 → V4 "Immersive" reconstruído de raiz (bandas claro/escuro + parallax + estrutura editorial) → display Archivo → cores religadas ao logo (`#C89830`) → hover best-sellers sem reflow → mais parallax (números-índice) → comparador `v1_v4` com toggle vertical ocultável (V1/V2) → ZIP `stickers-premium-compare-v1-v2.zip` testado.

## Pendente
- **Cliente escolhe** entre V1 e V2 (=V4 Immersive) — enviar `stickers-premium-compare-v1-v2.zip`.
- Estender a vencedora às páginas internas: **colecção** (listagem + filtros facetados) + **produto** (galeria, selector cor/tamanho, add-to-cart).
- (Opcional) trocar as 3 imgs geradas por foto de produto real; autorar FAQ real (page vazia).
- Depois: **build Shopify** (theme).

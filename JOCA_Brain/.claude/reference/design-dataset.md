# Design Dataset — paletas · pares de fontes · estilos nomeados

Banco de eixos para variantes de design consistentes. Consumido por `design-shotgun` (eixos das N variantes), `frontend` (Design Read) e `design-html`. Carregar on-demand via `Read()` — NÃO auto-carregado.

Objectivo: operacionalizar o anti-convergence — em vez de "diverge dos projectos anteriores" (vibes), escolher eixos DIFERENTES deste banco e registar quais foram usados. Inspirado no padrão UI UX Pro Max (dataset > geração ad-hoc).

**Regra de uso (design-shotgun):** cada variante = 1 estilo nomeado + 1 paleta + 1 par de fontes, combinações DISTINTAS entre variantes. Nunca 2 variantes com o mesmo estilo. Registar a combinação no output (ex: `[V2: brutalist-editorial + Ember + Fraunces/Inter]`).

---

## Paletas (OKLCH, verificadas p/ contraste AA em texto body)

Formato: nome — fundo / superfície / texto / primária / acento. Light e dark onde aplicável.

### Neutras + 1 acento (SaaS, dashboards, portfolios)
| Nome | Fundo | Superfície | Texto | Primária | Acento |
|---|---|---|---|---|---|
| Graphite | oklch(98% 0 0) | oklch(94% 0 0) | oklch(22% 0 0) | oklch(55% 0.20 260) | oklch(70% 0.15 80) |
| Graphite Dark | oklch(18% 0.01 260) | oklch(24% 0.01 260) | oklch(93% 0 0) | oklch(70% 0.16 260) | oklch(78% 0.14 80) |
| Ivory | oklch(97% 0.01 90) | oklch(93% 0.02 90) | oklch(25% 0.02 60) | oklch(50% 0.14 30) | oklch(60% 0.11 150) |
| Slate Mint | oklch(97% 0.01 180) | oklch(92% 0.02 180) | oklch(24% 0.02 220) | oklch(58% 0.12 170) | oklch(65% 0.17 45) |
| Ink & Paper | oklch(99% 0 0) | oklch(95% 0 0) | oklch(15% 0 0) | oklch(15% 0 0) | oklch(60% 0.22 25) |

### Quentes (marcas artesanais, vinho, food, editorial)
| Nome | Fundo | Superfície | Texto | Primária | Acento |
|---|---|---|---|---|---|
| Ember | oklch(96% 0.02 70) | oklch(91% 0.03 70) | oklch(25% 0.04 40) | oklch(50% 0.18 35) | oklch(40% 0.10 130) |
| Terracotta | oklch(95% 0.02 50) | oklch(89% 0.04 50) | oklch(28% 0.05 40) | oklch(55% 0.15 45) | oklch(45% 0.08 200) |
| Bordeaux | oklch(97% 0.01 30) | oklch(92% 0.02 30) | oklch(24% 0.03 20) | oklch(38% 0.14 15) | oklch(72% 0.12 85) |
| Bordeaux Dark | oklch(20% 0.03 20) | oklch(26% 0.04 20) | oklch(94% 0.01 60) | oklch(65% 0.15 20) | oklch(78% 0.13 85) |
| Honey Oak | oklch(96% 0.03 85) | oklch(90% 0.05 85) | oklch(28% 0.04 60) | oklch(58% 0.13 70) | oklch(40% 0.09 260) |

### Frias (tech, fintech, saúde, legal)
| Nome | Fundo | Superfície | Texto | Primária | Acento |
|---|---|---|---|---|---|
| Arctic | oklch(98% 0.005 240) | oklch(94% 0.01 240) | oklch(24% 0.02 250) | oklch(52% 0.18 250) | oklch(65% 0.14 190) |
| Deep Sea Dark | oklch(17% 0.02 230) | oklch(23% 0.03 230) | oklch(92% 0.01 220) | oklch(72% 0.13 210) | oklch(80% 0.14 140) |
| Sage Clinic | oklch(97% 0.01 150) | oklch(93% 0.02 150) | oklch(26% 0.02 180) | oklch(52% 0.10 160) | oklch(55% 0.15 260) |
| Steel | oklch(96% 0.005 260) | oklch(91% 0.01 260) | oklch(22% 0.01 270) | oklch(45% 0.08 260) | oklch(60% 0.18 20) |

### Alto contraste / statement (landing agressiva, streetwear, gaming)
| Nome | Fundo | Superfície | Texto | Primária | Acento |
|---|---|---|---|---|---|
| Void Neon | oklch(12% 0.01 280) | oklch(18% 0.02 280) | oklch(96% 0 0) | oklch(75% 0.20 150) | oklch(70% 0.25 330) |
| Acid Poster | oklch(95% 0.15 110) | oklch(99% 0 0) | oklch(15% 0 0) | oklch(15% 0 0) | oklch(55% 0.25 300) |
| Blood Orange Dark | oklch(15% 0.01 30) | oklch(21% 0.02 30) | oklch(95% 0.01 60) | oklch(65% 0.23 35) | oklch(85% 0.05 90) |
| Royal Punch | oklch(97% 0 0) | oklch(93% 0.01 300) | oklch(18% 0.02 300) | oklch(45% 0.24 300) | oklch(75% 0.17 60) |

---

## Pares de fontes (Google Fonts, todos com PT-PT completo)

| Par | Display | Body | Personalidade | Evitar em |
|---|---|---|---|---|
| Editorial clássico | Fraunces | Inter | revista, vinho, artesanal | dashboards densos |
| Suíço neutro | Inter (weights 700/400) | Inter | SaaS, fintech | marcas com alma |
| Geo-humanista | Space Grotesk | Work Sans | tech com carácter | legal, saúde |
| Serif de luxo | Playfair Display | Source Sans 3 | premium, hotel, vinho | apps utilitárias |
| Brutal contraste | Archivo Black | Archivo | poster, streetwear | conteúdo longo |
| Nostalgia mono | JetBrains Mono | Inter | dev tools, docs técnicas | consumer B2C |
| Redondo amigável | Nunito | Nunito Sans | infantil, social, saúde mental | corporate sério |
| Condensado editorial | Oswald | Lora | notícias, desporto | UI densa |
| Humanista quente | Poppins | Karla | lifestyle, food | dados/tabelas |
| Grotesque display | Unbounded | Manrope | web3, gaming, música | banca tradicional |
| Transitional sério | Libre Baskerville | PT Sans | legal, académico, editorial longo | mobile-first apps |
| Neo-grotesque técnico | IBM Plex Sans | IBM Plex Sans | enterprise, dados | marcas emocionais |

---

## Estilos nomeados (eixos p/ design-shotgun)

Cada estilo = layout + densidade + forma + movimento. Escolher 1 por variante.

| Estilo | Assinatura | Onde brilha |
|---|---|---|
| swiss-grid | grelha 12col visível, tipografia como UI, zero decoração | SaaS, agências |
| brutalist-editorial | borders 2-3px, sem sombras, tipos gigantes, cores chapadas | portfolios, moda |
| soft-depth | cards com sombra difusa multi-camada, cantos 16-24px, glassmorphism pontual | fintech consumer, health |
| dense-data | tabelas primeiro, tipografia 13-14px, zero hero, toolbar fixa | dashboards, admin |
| luxury-still | whitespace 60%+, serif display, fotos full-bleed, animação lenta | vinho, hotéis, joalharia |
| neo-terminal | mono everywhere, verde/âmbar sobre escuro, ASCII, cursor blink | dev tools, hacker aesthetic |
| paper-collage | texturas de papel, rotações 1-3°, sombras duras, elementos recortados | artesanal, food, editorial |
| kinetic-poster | tipo gigante animado, scroll-driven, cor agressiva | lançamentos, música, eventos |
| calm-productivity | neutros quentes, densidade média, iconografia fina, micro-interacções subtis | notas, produtividade |
| bento-showcase | grelha bento assimétrica, cada célula um feature, hover states ricos | product landing, portfolio dev |
| retro-web | bevels suaves, gradientes 90s ironizados, cursors custom | side-projects, gaming casual |
| editorial-longform | coluna única 65-75ch, drop caps, pull quotes, imagens intercaladas | blogs, revistas, docs |

---

## Anti-convergence (obrigatório)

Antes de escolher eixos, verificar `memory/projects/*.md` dos últimos projectos do mesmo tipo:
1. Que estilo/paleta/par foi usado nos 2-3 anteriores? → **excluir esses eixos** das variantes.
2. Registar no output de cada variante a combinação usada (auditável na próxima sessão).
3. Se o brief do cliente FORÇA um eixo repetido (brand colors), diverge nos outros dois.

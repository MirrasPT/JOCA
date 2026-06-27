---
name: bracaris-brasil-2026
description: Site Wix existente da marca de vinho Bracaris — melhoria de conteúdo/copy/SEO/imagens/ads para o mercado Brasil (pt-BR)
metadata:
  type: project
directorio: G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\Bracaris\2026_Website_Brasil
---

# Bracaris — Website Brasil 2026

> Memória de projecto. Iniciado 2026-05-30. Última actualização: 2026-06-27.
> Última sessão (2026-06-27): ligado `bracaris.com.br` ao Wix por pointing (Cloudflare); reescrita do testemunho Alvarinho→Loureiro.

## Descrição
Site Wix **já construído** da marca **Bracaris** — vinho português (Vinho Verde / casta Loureiro). Trabalho é **edição e melhoria de conteúdo** (copy, storytelling, SEO local, conversão, imagens), não dev from-scratch.
- **Cliente:** Luis Gonçalo — grupo Elite Cozinhas e Bracaris.
- **Mercado-alvo:** Brasil 🇧🇷 — conteúdo em **Português do Brasil (pt-BR)**, nunca pt-PT.
- **Gama:** Branco Blend (garrafa+lata), Loureiro Premium (garrafa), Rosé (garrafa+lata) + 3 packs.
- **Objectivo:** elevar o conteúdo do site para o lançamento no Brasil (copy de produto, marca, SEO BR, conversão); tom premium, vínico, adaptado ao consumidor brasileiro.
- **Why:** marca de Vinho Verde a entrar no Brasil; o site existe, falta conteúdo afinado ao consumidor BR.

## Stack / Plataforma
- **Wix Editor clássico** (generator "Wix.com Website Builder", engine thunderbolt — confirmado 2026-05-30 via inspecção de www.bracaris.com). NÃO é headless/Studio → **Wix CLI local NÃO aplica** (não clona/edita sites Editor). Edição de layout/copy = **Wix Editor no browser** (JOCA produz, Renato cola). Velo só para lógica custom.
- **Catálogo Wix Stores = editável via REST API** (read+write), apesar de o site ser Editor clássico. Só o catálogo; layout não.
  - **CATALOG_V1** → `https://www.wixapis.com/stores/v1/products/*` (V3 dá 428). Query: `POST stores/v1/products/query`. Update: `PATCH stores/v1/products/{id}` body `{"product":{...}}` (`description` em HTML, `seoData`, `ribbon`, `brand`).
  - **Headers:** `Authorization: <API key>` + **`wix-site-id`** sozinho. ⚠ Regra Wix: `wix-site-id` **OU** `wix-account-id`, **nunca os dois**.
  - **Site ID:** `38880aa1-afe8-42cb-a8cd-fb9e2b5b9df9` (conta tem 3 sites). Account ID: `76a16867-46e1-462e-9c9d-be28e25675e9`.
  - **Credenciais (não-committed):** `C:\Users\renat\.wix-bracaris.json` (`{key,account,site}`). ⚠ Renato vai regenerar a key no fim → actualizar o ficheiro. NUNCA gravar a key em memória.
  - ⚠ Env vars não propagam entre tool-calls do Claude → ler creds do ficheiro dentro de cada script.
  - ⚠ **STOCK ≠ updateProduct:** PATCH a `stock.inStock` é aceite (200) mas ignorado. Stock só via **Inventory API V2**: `POST stores/v2/inventoryItems/query` → `PATCH stores/v2/inventoryItems/{id}` body `{"inventoryItem":{"trackQuantity":false,"variants":[{"variantId":"...","inStock":false}]}}`. Backup: `.wix-bracaris-stock-backup.json`.
  - ⚠ **HTML na descrição:** Wix colapsa `<p>&nbsp;</p>` (altura zero) → usar `<br><br>` para espaçamento visível.
- **Descontos:** geridos pela app 3rd-party "Quantity & Volume Discounts" (appId `9574929e-f0d9-40cc-8f69-e9d3b70b7a7c`). API `ecom/v1/discount-rules` **instável** → gerir no **dashboard**, não por API. Backup: `.wix-bracaris-discounts-FULL-backup.json`.
- **Imagens:** router img-gen — `img-gen-openai` (gpt-image-2) por defeito (rótulos/texto exacto); `img-gen-google` (Gemini) só drafts/backgrounds sem texto.
- **WebP (sem cwebp/magick):** assets normais via ffmpeg `-c:v libwebp -lossless 1`; ⚠ JPGs de `_jpg/` são **CMYK c/ ICC** → converter com **Pillow CMYK→sRGB** (`ImageCms.profileToProfile`), nunca ffmpeg (desvio de cor). Script `.joca/convert_webp_icc.py`.
- **Render do site Wix:** Playwright `networkidle` NUNCA dispara em Wix (long-poll) → usar `domcontentloaded` + `waitForTimeout(4000)`. WebFetch é inútil (SPA JS-rendered).
- Pesquisa de mercado via skill `deep-research`. Skills core: copywriting, content-strategy, brand-positioning, seo/seo-local, page-cro, img-gen.

## Estado actual
- **Catálogo (6 produtos) reescrito LIVE via API** (2026-05-30): descrições ricas pt-BR ângulo **Portugal/Minho/Vinho Verde DOC**, notas de prova, harmonização BR, ficha técnica; **Brand=Bracaris**; **SEO** (meta description pt-BR + keyword "vinho portugues"); **ribbon "Vinho de Portugal"** nos 6. Packs Loureiro tinham descrição errada ("100% Loureiro") → corrigida.
- **Promo de quantidade LIVE** (2026-05-31): "COMPRE MAIS, POUPE MAIS — 3+ =5%, 6+ =10%" no topo da descrição dos 6 produtos (idempotente, marker `COMPRE MAIS, POUPE MAIS`).
- **Homepage LIVE com copy pt-BR colada** (2026-06-01): hero "O Vinho Verde português. Agora na sua mesa." + ângulo Portugal + age-gate activo (confirmado por render ao vivo). Copy deck completo em `Homepage_Copy_pt-BR.html`.
- **Imagens:** hero das 3 garrafas finalizada; 6 product shots 3:4 em vinha + cenas 1:1 estilo loja + 16:9 em `Gerados/produtos/`; 19 JPGs CMYK convertidos a WebP sRGB; `Produtos_Site/*.webp` prontos.
- **Campanhas pagas SP/RJ entregues** (2026-06-01): relatório HTML + pesquisa de mercado + 4 criativos gpt-image-2. Plano R$1.000/mês × 3 meses (Jun–Ago), 60/40 SP/RJ, 60/40 Meta/Google, 76/24 B2C/B2B.
- **Relatório publicado online** (2026-06-23): https://planobracaris.rfdev.pt (VPS Datalix + Caddy + DNS Cloudflare).
- **Domínio BR a apontar p/ Wix** (2026-06-27): `bracaris.com.br` (zona Cloudflare `2941377f3d0945ceb70b75bd409b3395`, conta datalix `~/.cloudflare/datalix.json`) recebeu o pointing Wix **via API**, valores **autoritativos do próprio ecrã Wix** (NÃO os 3 IPs do `.com` — Wix pede **1 só A**): A `@` → `185.230.63.107` + CNAME `www`→`pointing.wixdns.net`, **DNS-only/proxy OFF** (obrigatório). Mail (MX null + SPF + DMARC) intacto. ⚠ Wix oferece 2 métodos: usar **pointing** (mantém Cloudflare), NÃO nameservers (`ns6/ns7.wixdns.net` — perderia a Cloudflare + mail). Wix troca `pointing.wixdns.net`→`cdn1.wixdns.net` sozinho após verificar (normal). Renato fez o connect via pointing no Wix; **DNS propagado e verificado publicamente** (apex→`185.230.63.107`, www→`pointing.wixdns.net` em 1.1.1.1+8.8.8.8). **Wix em estado "a verificar"** (aviso padrão "até 48h", deadline 29 Jun 2026). **Falta** (quando Wix verificar): definir `.com.br` como **primário** (decisão 2026-06-27: manter `.com` conectado a fazer 301 p/ `.com.br`, não desligar) + confirmar SSL ao vivo.

## Pendências
**Site / homepage (achados render ao vivo 2026-06-01):**
- 🟠 **Testemunho falso refere "Alvarinho"** (Juliana Sá) — produto inexistente (gama BR = Loureiro/Branco Blend/Rosé, sem Alvarinho). Reescrita pt-BR fornecida 2026-06-27 (trocar Alvarinho→**Loureiro**: "Experimentei o Loureiro e me rendi: aroma floral intenso e sabor sofisticado, uma verdadeira experiência."). **Falta:** Renato colar no Wix + decidir o **autor** (Juliana Sá real? senão tornar genérico).
- 🔴 **Falta aviso CONAR persistente** "Beba com moderação. Venda proibida para menores de 18 anos" (rodapé/junto ao preço). Age-gate já existe ✓.
- 🟡 Rodapé "© 2025 Bracaris" → 2026.
- 🟡 **SEO title tags dos 6 produtos vazias** (usam nome por defeito) → corrigir por API (PATCH seoData title).
- 🟡 "Três rótulos, uma só origem" ao lado de 6 cards → ajustar.

**Campanhas (antes de lançar):** instalar Meta Pixel+CAPI e GA4 (eventos compra+lead)+UTMs; aplicar aviso CONAR como sobreposição nos 4 criativos; (opcional) corrigir fidelidade de rótulos em Figma/PS; criar landing/secção B2B (CNPJ) para M3/G2; contactar Evino/Divvino. ⚠ Confirmar manualmente anúncios activos dos concorrentes em facebook.com/ads/library?country=BR.

**Operacional Wix:** Renato regenera API key → actualizar `.wix-bracaris.json`; confirmar no dashboard que a app de descontos está a 3→5%/6→10%; Renato cola product shots de `Gerados/produtos/` nas páginas de produto.

## Decisões chave
- **2026-05-30:** Idioma = pt-BR; sem PRD (projecto de conteúdo); ponto de partida = homepage; via de edição = Wix Editor no browser (CLI descartado após inspecção ao vivo); imagens do site em WebP lossless.
- **2026-05-30 (catálogo):** descoberto acesso REST API V1 ao Wix Stores; ângulo de copy reforçado de "Origem" → **Portugal** (gatilho de valor no BR).
- **2026-05-31:** promo de quantidade no topo da descrição (não ribbon), via REST API com `<br><br>`; conversão de assets que preservam cor via **Pillow CMYK→sRGB**, nunca ffmpeg.
- **2026-06-01:** plano de media SP/RJ R$1.000/mês × 3, 60/40 SP/RJ, 60/40 Meta/Google, 76/24 B2C/B2B (Renato confirmou); concentração faseada, sem PMax/Advantage+; diferenciação por **origem/DOC/terroir**, não perseguir Gen Z da Casal Garcia; criativos de álcool **sem texto queimado** (copy + aviso CONAR como sobreposição na publicação).
- **Posicionamento de preço:** Loureiro R$54,90 (banda superior entrada/médio, ~Casal Garcia R$49–58); Branco/Rosé R$44,90 (em linha c/ Gazela). Carga fiscal import PT→BR ~60–82% → preços coerentes.

## Ficheiros / paths importantes
- `CLAUDE.md` — instruções e verdade técnica do projecto.
- `Homepage_Copy_pt-BR.html` — copy deck da homepage (7 secções pt-BR + SEO).
- `Pesquisa_Mercado_SP-RJ_2026.md` — inteligência de mercado citada.
- `Relatorio_Campanhas_Ads_SP-RJ_2026.html` — plano/síntese de campanhas (online em planobracaris.rfdev.pt).
- `Produtos/` — assets-base (garrafas+latas PNG alta resolução).
- `Produtos_Site/*.webp` — imagens prontas para o site; `Produtos_Site/_jpg/` — fontes CMYK (reconverter via Pillow).
- `Gerados/` — heros (`Bracaris_Hero_Final_OpenAI_2K.{png,webp}`); `Gerados/produtos/` — product shots vinha 3:4 + cenas; `Gerados/ads/` — 4 criativos (RJ_verao_9x16, SP_urbano_1x1, churrasco_1x1, b2b_horeca_1x1).
- `C:\Users\renat\.wix-bracaris.json` — credenciais Wix REST API (não-committed; key a regenerar).
- **IDs de produto:** Loureiro `69ec21ce-14ea-b498-4a5f-e480cd65a557` · Branco `dc42e6f4-2edb-b77a-6e3b-0e08650ca392` · Rosé `6f6de631-bfde-0672-4e41-7a290dd2aa9b` · Pack B+R `8acbe3fc-92a6-93bf-3599-aa233ea39aa3` · Pack L+B `c1b6bbf5-8c3d-2f9f-29cf-26aa7bada026` · Pack L+R `f8efa56f-e925-c5d9-8427-2a94f0f84ad2`.

DONE-f9a1c3e7

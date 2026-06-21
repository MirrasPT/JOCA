---
name: bracaris-brasil-2026
description: Site Wix existente da marca de vinho Bracaris — melhoria de conteúdo/copy/SEO para o mercado Brasil (pt-BR)
type: project
directorio: G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\Bracaris\2026_Website_Brasil
---

**Stack:** Wix **Editor clássico** (generator "Wix.com Website Builder", engine thunderbolt — confirmado 2026-05-30 via inspecção de www.bracaris.com). **NÃO** é headless/Studio → Wix CLI local NÃO aplica (não clona/edita sites Editor). Edição de conteúdo = Wix Editor no browser. Velo só p/ lógica custom.
**Objectivo:** Editar e melhorar conteúdo do site Bracaris para lançamento no Brasil — copy de produto, storytelling de marca, SEO local BR, conversão.
**Directório:** `G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\Bracaris\2026_Website_Brasil`
**Iniciado:** 2026-05-30
**PRD:** não gerado
**Why:** Marca de vinho português (Vinho Verde / Loureiro) a entrar no mercado brasileiro. Site existe, falta conteúdo afinado ao consumidor BR.
**How to apply:** Trabalho de conteúdo, não dev. Activar `copywriting`, `content-strategy`, `brand-positioning`, `seo`/`seo-local`, `page-cro`, `img-gen`. Conteúdo em **pt-BR** (não pt-PT). `wix-cli` só se editar via Velo/CLI.

**default_model:** `img-gen-openai` (Codex / gpt-image-2) — produtos são garrafas/latas com rótulo (product shots + texto exacto). `img-gen-google` só para drafts/backgrounds sem texto.

## Acesso API (catálogo Wix Stores) — FUNCIONA
- Site é Editor clássico **mas o catálogo Wix Stores é editável via REST API** (read+write). Layout do site não, só catálogo.
- **Catalog version: CATALOG_V1** → usar endpoints `https://www.wixapis.com/stores/v1/products/*` (V3 dá 428 "wrong catalog version").
- **Headers:** `Authorization: <API key>` + **`wix-site-id`** apenas. ⚠ Regra Wix: usar `wix-site-id` **OU** `wix-account-id`, **nunca os dois** (os dois juntos → "No Metasite Context"/erros).
- **Site ID Bracaris:** `38880aa1-afe8-42cb-a8cd-fb9e2b5b9df9` (conta tem 3 sites: Bracaris, Mariemi, Elite Cozinhas). Account ID: `76a16867-46e1-462e-9c9d-be28e25675e9`.
- **Credenciais locais:** `C:\Users\renat\.wix-bracaris.json` (`{key,account,site}`) — fora do Google Drive. ⚠ Renato vai **regenerar a API key** no fim → actualizar o ficheiro. NUNCA gravar a key nesta memória (vai p/ git).
- ⚠ **Gotcha de sessão:** env vars (setx/SetEnvironmentVariable User) **não propagam** entre tool calls do Claude — cada call é processo novo. Ler sempre do ficheiro `.wix-bracaris.json` dentro do script.
- Read confirmado: `POST stores/v1/products/query` body `{"query":{"paging":{"limit":100}}}` → 4 produtos.
- Write confirmado: `PATCH stores/v1/products/{id}` body `{"product":{"description":"<html>"}}` (description é HTML, seoData via products SEO, ribbon, brand). Wix guarda o HTML tal-e-qual (não sanitiza emoji).
- ⚠ **Render de HTML na descrição (gotcha forte):** o Wix renderiza **`<p>&nbsp;</p>` com altura ZERO** (parágrafo vazio colapsa → NÃO cria linha em branco visível). Para espaçamento vertical visível usar **`<br><br>`** dentro de um `<p>` com conteúdo real de cada lado. `<br>` = quebra de linha fiável; `</p><p>` entre parágrafos com texto = nova linha; `<p>&nbsp;</p>` = invisível. Para separar bloco promo do texto seguinte, juntar ao parágrafo seguinte via `<br><br>` em vez de parágrafo vazio.
- **Promo de quantidade (2026-05-31, LIVE nos 6):** destaque no topo da descrição de cada produto: "COMPRE MAIS, POUPE MAIS / ✔ 3+ garrafas: 5% / ✔ 6+ garrafas: 10% / Desconto aplicado automaticamente no carrinho". Prepended via PATCH, idempotente (marker `COMPRE MAIS, POUPE MAIS`). ⚠ Verificar no dashboard que a app "Quantity & Volume Discounts" está mesmo a 3→5%/6→10% (API discount-rules instável, não dá p/ ler config).
- ⚠ **STOCK ≠ updateProduct:** `PATCH stores/v1/products/{id}` com `stock.inStock` **aceita (200) mas ignora silenciosamente**. Stock altera-se só pela **Inventory API V2**: `POST stores/v2/inventoryItems/query` (obtém `id`+`variants[].variantId`, default `00000000-...`) → `PATCH stores/v2/inventoryItems/{id}` body `{"inventoryItem":{"trackQuantity":false,"variants":[{"variantId":"...","inStock":false}]}}`. inventory v1/v3 dão 404/428. (2026-05-31: os 6 produtos postos OUT_OF_STOCK via este método; backup do estado original em `C:\Users\renat\.wix-bracaris-stock-backup.json`.)

## Estado do catálogo — REESCRITO 2026-05-30
**6 produtos** (não 4 — 2 packs extra apareceram na 2ª query; não estavam no sitemap mas estão visible=True/live):
- Bracaris Loureiro (R$54,90) `bracaris-loureiro-2022`
- Bracaris Branco Blend (R$44,90) `bracaris-branco-blend-2022`
- Bracaris Rosé (R$44,90) `bracaris-rosé-2022`
- Pack Branco e Rosé (R$84,90) `bracaris-branco-e-rosé`
- Pack Loureiro e Branco (R$89,90) `pack-loureiro-e-branco`
- Pack Loureiro e Rosé (R$89,90) `pack-loureiro-e-rosé`

**FEITO (todos os 6):** descrições ricas pt-BR (ângulo Origem & Autenticidade — Minho/Vinho Verde DOC, notas de prova, harmonização adaptada à mesa BR, ficha técnica), **Brand=Bracaris** em todos, **SEO** (meta description pt-BR + keyword) em todos. Os 2 packs Loureiro tinham descrição ERRADA ("100% Loureiro" copiada do single) → corrigida. og:image preservada nos 3 que já tinham. Tom factual, sem prémios/notas inventadas.
- Map de IDs: Loureiro `69ec21ce-14ea-b498-4a5f-e480cd65a557` · Branco `dc42e6f4-2edb-b77a-6e3b-0e08650ca392` · Rosé `6f6de631-bfde-0672-4e41-7a290dd2aa9b` · Pack B+R `8acbe3fc-92a6-93bf-3599-aa233ea39aa3` · Pack L+B `c1b6bbf5-8c3d-2f9f-29cf-26aa7bada026` · Pack L+R `f8efa56f-e925-c5d9-8427-2a94f0f84ad2`
- 2026-05-30 (2ª passagem): descrições + SEO **reescritos para reforçar ângulo PORTUGAL** (gatilho de valor no BR) — abertura de cada produto lidera com "vinho português"/"de Portugal"/"Minho"; keywords SEO passaram a liderar com "vinho portugues". Ribbon **"Vinho de Portugal"** aplicada aos 6.
- Por fazer (opcional): rever title tags SEO (usa nome do produto por defeito), categorias.

## Homepage (home-1) — copy escrita 2026-05-30
- Página = `bracaris.com/home-1`, Wix Editor clássico (colar manual, sem API). Objetivo definido = **levar à loja** (e-commerce).
- Hero actual estava POR ACABAR: "Freshly Made For You" (inglês) + "Add paragraph text…" (placeholder default Wix).
- Secções actuais: Hero · Marca ("Da Terra ao Copo") · Testemunhos (3, nomes genéricos) · Newsletter (catálogo grátis) · Rodapé.
- **Entregue:** copy deck HTML estilizado `Homepage_Copy_pt-BR.html` na pasta do projeto. 7 secções pt-BR ângulo Portugal + 2 secções NOVAS sugeridas (Gama/Produtos, Por que Bracaris) + SEO da home.
- Flags deixadas: testemunhos genéricos → substituir por reais BR; falta aviso legal álcool ("Beba com moderação. Proibido p/ menores de 18") obrigatório no BR.
- Pendente homepage: Renato cola no Wix Editor; decidir tom final; opcional A/B do hero.

## Campanhas de Ads SP/RJ (2026-06-01)
- **Entregáveis** (raiz do projecto): `Relatorio_Campanhas_Ads_SP-RJ_2026.html` (relatório completo, design Bracaris — tokens `--green #3a5a40`, `--green-dark #283d2c`, `--gold #b08d57`, `--bg #faf8f4`; serif Cormorant Garamond + Inter). `Pesquisa_Mercado_SP-RJ_2026.md` (inteligência citada). 4 criativos em `Gerados/ads/`: `RJ_verao_9x16.png`, `SP_urbano_1x1.png`, `churrasco_1x1.png`, `b2b_horeca_1x1.png` (gpt-image-2, garrafas de `Produtos/` como `-i`).
- **Plano:** R$1.000/mês · 3 meses (Jun–Ago 2026) · 60/40 SP/RJ · Meta R$600 / Google R$400 · B2C R$760 / B2B R$240. Campanhas: M1 Meta B2C prospeção (R$320) · M2 Meta B2C remarketing (R$160) · M3 Meta B2B HORECA (R$120) · G1 Google Search B2C (R$280) · G2 Google Search B2B (R$120). Tudo aponta p/ homepage.
- **Mercado (deep-research):** vinho BR R$21,1bi/2025 (+9%); Portugal 3.º importador (US$84M, líder europeu); Vinho Verde categoria emergente (Casal Garcia educou); brancos +28% Q1/25; e-comm Evino+Wine ~95%. Bracaris R$44–54 compete de frente c/ Casal Garcia (R$49–58) e ~R$2 acima de Gazela.
- **Concorrentes:** Casal Garcia (líder, "alegria"+Fruitzy/Gen Z), Gazela (entrada, sem campanha), Mateus (nostalgia), Muralhas/Quinta Azevedo (premium HORECA). ⚠ Meta Ad Library não confirmou anúncios activos por WebSearch → verificar manual em facebook.com/ads/library?country=BR.
- **Sazonalidade:** Jun (Dia do Vinho 7/6, Namorados 12/6, inverno) e Ago (**Dia dos Pais 10/8/2026** = packs presente) fortes. Pico anual Set–Dez (~50% vendas) → escalar depois.
- **Projeção honesta:** ROAS directo ~0,9× em 3 meses (meses 1–2 = aprendizagem). Valor real = ativo pixel/públicos + recompra + contas B2B (1 restaurante recorrente paga a operação).

## Contexto da marca
- Bracaris: vinho português, casta Loureiro (Vinho Verde).
- Gama: Branco (garrafa + lata), Loureiro Premium (garrafa), Rosé (garrafa + lata).
- Cliente: Luis Gonçalo — grupo Elite Cozinhas e Bracaris.
- Assets de produto em `Produtos/` (PNGs).

## Descontos do site (investigado 2026-05-30)
- Por produto: **nenhum** (preços-base limpos). Volume ("compra 3 → 5% off", latas, Alvarinho): **geridos pela app 3rd-party "Quantity & Volume Discounts"** (appId `9574929e-f0d9-40cc-8f69-e9d3b70b7a7c`).
- ⚠ API `ecom/v1/discount-rules` **INSTÁVEL** neste site: contagem oscilou 17→5→2→0; regras listadas dão 404 no GET; sem `/disable`. Não fiável.
- **Remoção fiável = dashboard Wix:** Apps → Quantity & Volume Discounts (ou desinstalar) + Marketing → Promoções/Cupons. Pedido "remover todos os descontos" ficou nesta recomendação — NÃO executado via API. Backup: `C:\Users\renat\.wix-bracaris-discounts-FULL-backup.json`.

## Estado actual
Projecto ligado ao JOCA. Site é Wix Editor clássico (edição no browser). Catálogo Wix Stores reescrito via API (6 produtos, pt-BR, ângulo Portugal). **Promo de quantidade (3+ =5%, 6+ =10%) em destaque no topo da descrição dos 6 produtos (LIVE).** **Homepage já LIVE com a copy pt-BR colada** (hero "O Vinho Verde português. Agora na sua mesa." + ângulo Portugal + age-gate activo) — confirmado por render ao vivo 2026-06-01. Assets de produto em WebP.
Conjunto de imagens em `Gerados/produtos/`: 6 product shots 3:4 em vinha + cenas 1:1 estilo loja + 16:9. 19 JPGs de `_jpg/` (CMYK) convertidos a WebP lossless sRGB. Hero das 3 garrafas finalizada (`Gerados/Bracaris_Hero_Final_OpenAI_2K.{png,webp}`).
**Plano de campanhas pagas SP+RJ entregue (2026-06-01)** — relatório HTML + 4 criativos novos. Ver secção "Campanhas de Ads".

## Decisões tomadas
- 2026-05-30: Idioma do conteúdo = Português do Brasil (pt-BR), não pt-PT.
- 2026-05-30: Sem PRD — projecto é de conteúdo, não dev from-scratch.
- 2026-05-30: Skills core = copywriting, content-strategy, brand-positioning, seo/seo-local, page-cro.
- 2026-05-30: Ponto de partida do conteúdo = **homepage** (hero + storytelling de marca, posicionamento premium BR).
- 2026-05-30: Via de edição = **Wix Editor no browser** (site é Editor clássico, não headless). Wix CLI local NÃO aplica — corrigido após inspecção do site ao vivo. JOCA produz copy/SEO/imagens → Renato cola no editor. Velo só p/ lógica custom.
- 2026-05-30: Imagens do site em **WebP lossless** (13 de `Produtos_Site/` convertidas via ffmpeg `-lossless 1`, −62% tamanho, originais JPG mantidos).
- 2026-05-30: Estilo hero aprovado = vinha luminosa + uvas verdes + folhas + glow solar; garrafas **escalonadas** (umas à frente das outras) e de **corpo cheio** (não finas). Refs: `Gerados/Bracaris_Hero_OpenAI_v2.png` (cena/luz) + `Produtos_Site/Pack_Branco_Loureiro_Rose.jpg` (proporções + rótulos fiéis).
- 2026-05-31: Promo de quantidade (3+ =5%, 6+ =10%) colocada no topo da descrição dos produtos (não como ribbon) via REST API — Wix CLI não edita Editor clássico, REST API edita descrição live. Formato com `<br>` (não `<p>` vazios, que colapsam no render Wix).
- 2026-05-31: Conversão de assets que preservam cor → **Pillow CMYK→sRGB**, nunca ffmpeg (CMYK mal interpretado). Lossless `exact=True` p/ "sem alterar as cores".
- 2026-06-01: Plano de media SP/RJ = **R$1.000/mês, 3 meses, 60/40 SP/RJ, 60/40 Meta/Google, 76/24 B2C/B2B** (Renato confirmou estes 3 parâmetros). Budget pequeno → **concentração faseada** (Mês1 G1+M1; Mês2 +remarketing+B2B; Mês3 Dia dos Pais 10/8). Sem PMax/Advantage+ (<US$3k/mês). Diferenciação por **origem/DOC/terroir**, não perseguir Gen Z da Casal Garcia.
- 2026-06-01: Render do site Wix ao vivo para análise → **Playwright `waitUntil:'networkidle'` NUNCA dispara em Wix** (long-poll mantém ligações abertas → timeout). Usar `domcontentloaded` + `waitForTimeout(4000)`. WebFetch é inútil em Wix (SPA JS-rendered, devolve quase nada). Script render em `.joca/bracaris_render.js`.
- 2026-06-01: Criativos de ad de álcool → **não queimar texto na imagem**; copy + aviso CONAR entram como sobreposição na publicação (permite testar variações + cumprir label "AI-generated" da Meta).

## Pendente
**Site / homepage (achados da análise ao vivo 2026-06-01):**
- 🔴 **Testemunho falso refere "Alvarinho"** (Juliana Sá) — produto que NÃO existe no catálogo. Os 3 testemunhos são genéricos/inventados → substituir por reais BR ou remover (risco de credibilidade/legal).
- 🔴 **Falta aviso "Beba com moderação. Venda proibida para menores de 18 anos"** persistente (rodapé/junto ao preço) — obrigatório CONAR. (Age-gate JÁ existe ✓.)
- 🟡 Rodapé "© 2025 Bracaris" → 2026.
- 🟡 **SEO title tags dos 6 produtos = vazias** (usam nome por defeito) → otimizável por API (PATCH seoData title). Corrigir.
- 🟡 "Três rótulos, uma só origem" ao lado de 6 cards → ajustar texto.

**Campanhas de ads (antes de lançar):**
- Instalar Meta Pixel+CAPI e Google/GA4 (eventos compra+lead); UTMs.
- Aplicar aviso CONAR como sobreposição nos 4 criativos; (opcional) corrigir fidelidade dos rótulos em Figma/PS (gpt-image-2 não é pixel-perfect).
- Criar landing/secção B2B clara (CNPJ) para M3/G2 apontarem.
- Contactar Evino/Divvino (distribuição sem mídia).

**Operacional Wix:**
- Renato regenera API key Wix no fim → actualizar `C:\Users\renat\.wix-bracaris.json`.
- Confirmar no dashboard que app "Quantity & Volume Discounts" está a 3→5%/6→10%.
- Renato cola cenas/product shots (`Gerados/produtos/`) nas páginas de produto.
- (Opcional) variante WebP `quality 90` da hero.

## Assets de imagem
- Garrafas individuais (rótulo limpo, fundo branco): `Produtos/` — `Bracaris_{Rose,Branco,LoureiroPremium}_Garrafa.png`.
- Imagens do site em **WebP** (lossless): `Produtos_Site/*.webp` (14 ficheiros: singles + packs). **JPG originais movidos para `Produtos_Site/_jpg/`** (fonte para reconverter).
- Imagens geradas: `Gerados/`. Hero final = `Bracaris_Hero_Final_OpenAI_2K.{png,webp}`.
- **Cenas estilo `Branco_Rose_Photo` (2026-05-31):** `Gerados/produtos/` — fotos 1:1 estilo loja (garrafas num tronco rústico, folhas de vinha à esquerda, colinas ao sol dourado), via gpt-image-2 com cena `C:\Users\renat\Desktop\Branco_Rose_Photo.jpg` + garrafas como `-i`. `Pack_Loureiro_Branco_cena_realista.png`, `Pack_Loureiro_Rose_cena.png`, `Rose_cena.png`. ⚠ Lição: garrafas saíam com aspecto "mockup" plano → 2ª passada gpt-image-2 com ênfase "real photographed glass" (refracção, rótulo a curvar, brilhos) corrige. Refs de garrafa = `Produtos_Site/_jpg/{Loureiro,Rose}.jpg` (singles reais). Também `Pack_Branco_Rose_vinha_16x9.png` (1672×940).
- **Product shots em vinha (2026-05-31):** `Gerados/produtos/` — 6 imagens 3:4, fotografia de produto em vinha Vinho Verde (bokeh verde, condensação, luz natural). 1 por produto: `Loureiro_vinha_3x4`, `Branco_vinha_3x4`, `Rose_vinha_3x4`, `Pack_Branco_Rose_vinha_3x4`, `Pack_Loureiro_Branco_vinha_3x4`, `Pack_Loureiro_Rose_vinha_3x4` (PNG). Via img-gen-openai (gpt-image-2) com garrafas de `Produtos/` como `-i` refs → rótulos fiéis. gpt-image-2 não faz 3:4 nativo (faz 2:3) → center-crop ffmpeg `crop='min(iw,ih*3/4)':'min(ih,iw*4/3)'`. ⚠ Gotchas: codex confundiu Branco↔Rosé no pack Loureiro+Branco (1ª saiu dourado+rosa) → regenerado c/ aviso "BLUE not pink". Rosé original 864×1821 estreito → crop top-biased `crop=864:1152:0:30` p/ não cortar cápsula. **Para packs, usar o pack oficial `Produtos_Site/_jpg/Pack_*.jpg` como referência ÚNICA (-i)** — traz cor + escalonamento certos; garrafas individuais como ref → codex inventa composição/cor (Rosé saía pêssego/coral, cápsula Loureiro saía azul). Pack_Loureiro_Rose + Pack_Loureiro_Branco regenerados 2026-05-31 a partir das bases `_jpg`.
- Conversão WebP (não há cwebp/magick na máquina): `ffmpeg -i in.jpg -c:v libwebp -lossless 1 -compression_level 6 out.webp`. Para web leve: `-quality 90`.
- ⚠ **Os JPGs de `Produtos_Site/_jpg/` são CMYK com perfil ICC de impressão (~557 KB).** ffmpeg interpreta CMYK mal → **desvio de cor** (o "yuva444p"/alfa que reporta é o 4º canal CMYK, não transparência). **Converter com Pillow (CMYK→sRGB via ICC), não ffmpeg:** `Image.open().convert` + `ImageCms.profileToProfile(rgb_src, src_icc, sRGB, outputMode='RGB')` → save WEBP `lossless=True, exact=True, icc_profile=sRGB`. Script: `JOCA_Logic/.joca/convert_webp_icc.py`. 2026-05-31: 19 JPGs convertidos p/ webp lossless sRGB (cores fiéis, 1200×1200, ICC sRGB embebido) na própria pasta `_jpg/`.

## Última sessão
2026-06-01 — Análise da homepage ao vivo (render Playwright; achados: testemunho "Alvarinho" falso, aviso CONAR em falta, © 2025, SEO titles vazias) + **workflow completo de campanhas de ads SP/RJ**: deep-research (mercado/concorrência/regulação/sazonalidade) → plano de media R$1k/mês full-funnel B2C+B2B 60/40 → 4 criativos gpt-image-2 (RJ verão, SP urbano, churrasco, B2B) → relatório HTML design Bracaris (`Relatorio_Campanhas_Ads_SP-RJ_2026.html`). Gotcha: Playwright `networkidle` não dispara em Wix → `domcontentloaded`.
2026-05-30 — Definido ponto de partida (homepage) + via de edição (Velo/Wix CLI). Convertidas 13 imagens de `Produtos_Site/` para WebP lossless (14.2 MB → 5.3 MB). Skills lidas: copywriting, brand-positioning, wix-cli. Copy ainda por escrever.
2026-05-30 (img) — Geração da hero das 3 garrafas: v1 fila (rejeitada) → v2 estilo site OpenAI (aprovada, mas garrafas finas) → v3 3 tentativas com pack como ref de proporção (a gerar). Corrigidos agentes `img-gen-google` (agy lê prompt via **stdin**) e `img-gen-openai` (codex precisa `--dangerously-bypass-approvals-and-sandbox` + `-i` p/ referências).
2026-05-30 (assets) — Hero finalizada → `Bracaris_Hero_Final_OpenAI_2K.png` convertida a WebP lossless. Reconvertidos 3 packs (`Pack_Loureiro_Branco`, `Pack_Branco_Rose`, `Pack_Loureiro_Rose`) a partir de `Produtos_Site/_jpg/` (JPG originais foram movidos para essa subpasta). Fix JOCA: `compile-bridges.sh` abortava sob `set -e` por `((count++))` → corrigido para `count=$((count+1))`.
2026-05-31 (img) — 6 product shots em vinha (3:4) → `Gerados/produtos/`, 1 por produto, via img-gen-openai com garrafas como refs. Pack Loureiro+Branco regenerado (codex trocou Branco por Rosé). Rosé re-cropado top-biased. Detalhes na secção Assets.
2026-05-31 (img cenas) — Cenas 1:1 estilo `Branco_Rose_Photo` com gpt-image-2 (cena + garrafas como refs): Loureiro+Branco realista, Loureiro+Rosé, Rosé solo. Lição "real glass" p/ tirar aspecto mockup. + 16:9. Detalhes na secção Assets.
2026-05-31 (webp CMYK) — 19 JPGs de `_jpg/` (descobertos como **CMYK c/ ICC**) convertidos a WebP lossless sRGB via Pillow (ffmpeg dava desvio de cor). Script `.joca/convert_webp_icc.py`.
2026-05-31 (promo) — Promo de quantidade (3+ =5%, 6+ =10%) em destaque no topo da descrição dos 6 produtos, via REST API (Wix CLI não aplica). Várias iterações de formatação até descobrir que o Wix colapsa `<p>&nbsp;</p>` → usar `<br><br>` p/ linhas em branco. Idempotente.
2026-05-31 (stock) — Pedido de teste: pôr os 6 produtos OUT_OF_STOCK e repor. Descoberto que stock só altera via **Inventory API V2** (updateProduct ignora silenciosamente — ver secção API). Backup `.wix-bracaris-stock-backup.json`. Estado final = todos IN_STOCK (reposto).
2026-05-30 (catálogo+copy) — Descoberto acesso REST API ao catálogo Wix Stores (Editor clássico, V1). Reescritos os **6 produtos** live: descrições pt-BR (ângulo Origem→reforçado p/ PORTUGAL), SEO "vinho português", Brand, ribbon "Vinho de Portugal", bandeira 🇵🇹 (emoji renderiza como "PT" em Windows desktop, bandeira em mobile/Mac). Investigados descontos (geridos por app, API instável → remoção fica no dashboard). Copy completa da homepage (`home-1`, 7 secções) gravada em `Homepage_Copy_pt-BR.html`. Skills: wix-cli, copywriting, brand-positioning.

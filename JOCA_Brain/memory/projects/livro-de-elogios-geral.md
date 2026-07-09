---
name: livro-de-elogios-geral
description: Livro de Elogios — visão geral do projecto/cliente (umbrella). SaaS de elogios/testemunhos para empresas; cobre plataforma PT (rebuild + legacy), expansão Brasil, redes sociais, parceria FIZ. Não confundir com a entrada só-da-plataforma livro-de-elogios.md.
type: project
directorio: /Users/renatoferreira/MEGA/Livro_de_Elogios
---

# Livro de Elogios — Umbrella (todo o projecto/cliente)

> **Umbrella `CLAUDE.md` criado na raiz `D:\Mega\Livro_De_Elogios\CLAUDE.md`** (2026-07-01) — roteia para os sub-docs (a plataforma e as redes sociais têm CLAUDE.md próprios). Pasta re-analisada 2026-07-01 (4 agentes Explore): confirma este mapa; deltas → ver `plano_desenvolvimento.html` no Wireframes e risco de projectos editáveis BR abaixo.

**O que é:** SaaS B2B de **elogios/testemunhos de clientes** — empresas recolhem feedback positivo (elogios), centralizam-no num "livro digital" e usam-no para credibilidade/marketing. Plataforma legacy em produção com **27.000+ empresas**. Dono/voz da marca: **Pedro Silva**. SetupTech é a casa de software (Renato = design + frontend; Pedro = backend).

**Dois mercados (marcas distintas — NÃO misturar):**
| Mercado | Cor | Tipografia | Domínio |
|---|---|---|---|
| **Portugal** | laranja `#FD5000` (hover `#E54300`) | Poppins (web/produto) · **Lato** (redes sociais) | `livrodeelogios.com` |
| **Brasil** | verde `#039739` (+ `#111827`/`#f2f2f2`) | Poppins | `livrodeelogios.com.br` |

Regras de marca PT: 1 só laranja, botões pill (radius 9999px), SEM emojis/estrelas-texto/fundos pretos. Detalhe completo na entrada da plataforma.

## Mapa da pasta `D:\Mega\Livro_De_Elogios\`
| Subpasta | O que é | Estado |
|---|---|---|
| `2026_Nova_Plataforma/` | **Rebuild da plataforma** (greenfield, Laravel 13/PHP 8.4 + Filament v5 + React 19/Vite 8) | Activo — ver [[livro-de-elogios]] (detalhe exaustivo) |
| `Wireframes/` | **Plataforma LEGACY de produção** (a que está a ser substituída) | Congelada/referência — ver abaixo |
| `2026_Redes_Sociais/` | Pipeline mensal de conteúdo social (Posts/Stories IG+FB) | Activo — ver [[livro-elogios-redes-sociais]] |
| `2026_Landing_page_FIZ/` | Landing + emails da **parceria FIZ × LE** | Entregue (design; falta ligar API) |
| `2026_Logo_Brasil/` | Assets de marca Brasil (Logo/Favicon/Profile em SVG/PNG/PDF) | Entregue |
| `2026_Video_Brasil/` | Vídeo promo 15s para mercado Brasil | Entregue (`_Final/LivroElogiosBrasil.mp4`) |
| `2026_Website_Brasil/` | Mockups de design do site Brasil (só design, sem código) | Mockups (Gemini + device mockups + PSD) |
| `2026_Pacote_Cartaz/` | **Kit completo** do novo pacote físico (livro+suporte cartaz): `produto.md` · `imagens/` · `_ref/` · `redes-sociais/` · `anuncios/` · `email/` · **`video/` (reel)** · `apresentacao.html` | **LIVE em `packlancamento.rfdev.pt`** (2026-07-02) — ver abaixo |
| `2026_Newsletter/` | Email marketing **"Livro de Elogios Digital"** (QR Code/sustentabilidade): `email.html` + `banner/` + `copy.md` + `preview.png` | Pronto (2026-07-06) — falta hospedar banner + enviar. Ver abaixo. `2026_Newsletter.zip` na pasta-mãe |
| `2026_Landing_page_FIZ.zip` / `2026_Nova_Plataforma.zip` | backups zip | — |
| Wireframes (subpastas antigas) | — | — |

> ⚠ O prefixo `2026_` marca os assets da **era do rebuild**. `Wireframes/` (sem prefixo) = sistema antigo.

## Wireframes/ — plataforma LEGACY (a substituir) — survey 2026-06-30
Apesar do nome "Wireframes", é a **app de produção real** do Livro de Elogios (a dos 27k+ empresas).
- **Stack:** PHP `^8.1` · **Laravel 11** · **Filament 3.2** (+ filament-shield RBAC, google-maps, breezy, impersonate, tinyeditor) · Livewire 3.5 · Horizon · Scout + **Algolia + Elasticsearch** · Sanctum · Socialite · Saloon · `bavix/laravel-wallet` · `anayarojo/shoppingcart` · Firebase · Sentry + Nightwatch.
- **Domínio (25 models):** Company, CompanyAddresses, Shop, ShopDetail, **Compliment**, Pack, PackOrderHistory, OrderItem, ProductReview, Brand, Category, Article/ArticleCategory, ShippingCost/ShippingAddress/PostalCodeShippingCost, CustomField(+Value), Owner/OwnerHasPermission, User/UserSetting, **MoloniToken**, Contacts.
- **Pagamentos/faturação:** ifthenpay + MBWay + PayShop + Stripe + izipay (webhooks em `routes/api.php`); Moloni (faturação).
- **API pública:** `/v1/compliments/{token}`; `public_api_token` por shop (migração 2025-11-13).
- ⚠ **NÃO é repositório git** (`.git` ausente, sem `.env.example`/README próprio). Só **15 migrações** incrementais (2024-07 → 2025-11) — a base schema (companies/shops/compliments/users) NÃO está nas migrações → **BD de produção importada/estabelecida**, só deltas recentes versionados aqui. Mantida activa até ao rebuild começar.
- **Relação com o rebuild:** `Wireframes` = referência/sistema-a-substituir; `2026_Nova_Plataforma` = sucessor greenfield. Sem cross-reference de código entre as duas (pastas separadas, não-versionadas em conjunto).
- ⚠ **Peça mais valiosa na raiz de `Wireframes/`: `plano_desenvolvimento.html`** — plano COMPLETO de reconstrução (sumário executivo + "Análise da Plataforma Existente" que mapeia estes 26 models/12 Resources/integrações + nova arquitectura DDD-light + roadmap + novas features: afiliados/revendedores/badges/rankings/perfil-portátil/subscrições). Datado Abril 2026; previa manter Laravel 11+Filament 3+Livewire 3, mas o rebuild **evoluiu para L13+Filament 5+React 19** (decisão de stack mudou depois deste doc). **Recomendação: migrar/normalizar este HTML para dentro de `2026_Nova_Plataforma/` como spec de referência** (hoje está fora do radar). Acompanham-no `wireframes_{admin,loja,publico,user}.html` (mockups) + `izipay-postman.json` (colecção API do gateway Izipay/PE).

## Redes Sociais (`2026_Redes_Sociais/`)
Produção mensal automatizada de Posts/Stories (IG+FB) — substitui composição manual em Photoshop por geração HTML→Playwright→PNG. **Lato** (não Poppins), ilustrações flat **laranja `#FD5000` + roxo/lavanda**, logo topo + `www.livrodeelogios.com` rodapé em posição idêntica ao pixel. 4 templates intercalados (`post-bra-ilu` / `post-lar-ilu` / `post-ent` / `post-foto`) via `_template/<nome>/template.html`. Geração via `agy` (Gemini) com referência de estilo obrigatória; remoção de fundo Pillow/rembg. **Galeria de review LIVE: `leredes.rfdev.pt`** (VPS Datalix, Caddy estático atrás de Cloudflare — re-render + scp + purgar cache). Meses: **Maio 12, Junho 9, Julho 8** peças no `_Final/`. Detalhe + gotchas → [[livro-elogios-redes-sociais]] e o `CLAUDE.md` local da pasta.

## Parceria FIZ × Livro de Elogios (`2026_Landing_page_FIZ/`)
Co-marketing com a **FIZ** (fiz.pt — faturação certificada + gestão de despesas + IA fiscal PT). Duas direcções:
- **LE → clientes:** 15% no pacote anual FIZ (código `LIVRO15`, válido até 30 jun 2026).
- **FIZ → clientes:** 5 elogios digitais grátis no LE.
- **Landing** (`design/`): split-screen sem scroll (painel laranja com oferta + form 3 passos: Conta → Empresa → Perfil público), Poppins/`#FD5000`/Font Awesome, botões pill, `noindex,nofollow`. Form com validação por passo, máscara CP/NIF, upload de logo drag-drop. **Falta ligar API** — `submitForm()` tem `setTimeout` stub a substituir pelo endpoint de registo real.
- Copy das duas campanhas em `emails.md`.

## Brasil (expansão de mercado)
- **Logo Brasil:** identidade verde (`#039739`), 4 assets (Logo/Favicon/Profile/Profile_2) em SVG/PNG/PDF.
- **Vídeo Brasil:** promo 15s, 5 cenas (problema → livro digital → benefícios → CTA `livrodeelogios.com.br`), Poppins + ilustrações flat verde, Lottie JSONs + voz-off (`Voz_off.mp3` + tempos) + música. Entregue: `_Final/LivroElogiosBrasil.mp4` (3.6 MB; há `old_*` anterior). ⚠ pasta `Software/` **vazia** — projecto editável (Remotion/AE) NÃO arquivado; re-editar exigiria reconstruir do zero.
- **Website Brasil:** **só design/mockups** (sem código) — imagens de produto geradas por Gemini + device mockups (iPhone/MacBook) + PSDs. `_Final/Mockup_Produto.jpg`.

## Novo pacote físico: Livro em papel + Suporte para Cartaz (2026-06-30)
Campanha completa para um **novo bundle físico** (livro de papel + suporte acrílico de balcão + cartaz A4). **Tudo numa só pasta `2026_Pacote_Cartaz/`** (consolidada a pedido do Renato — era 2 pastas Email+Lancamento):
- **`produto.md`** — descrição + ficha técnica + preço.
- **`imagens/`** — **6 imagens lifestyle geradas por OpenAI gpt-image/codex** (balcão café, receção, loja close, mãos-escrever, flat-lay, ad-hero; fidelidade de marca alta).
- **`_ref/`** — packshots REAIS de estúdio (copiados de `2026_Nova_Plataforma/assets/produtos/`: pack, livro, suporte ×2, cartaz).
- **`redes-sociais/posts.md`** — 3 posts + story + calendário. **`anuncios/anuncios.md`** — Meta + Google.
- **`email/`** — email HTML bulletproof (table-based, Poppins+fallback, botão pill com VML p/ Outlook, checkmarks vetoriais) + `banner.html`→`banner.png` + logos PNG + `copy.md` + README. ⚠ Antes de enviar: hospedar PNG + URLs absolutos + `{{UNSUBSCRIBE_URL}}` (clientes de email não renderizam SVG nem paths relativos).

### Preços REAIS (fonte: `livrodeelogios.com/loja`, 2026-06-30, **todos + IVA 23%**)
| Produto | s/IVA |
|---|---|
| Livro de Elogios em Papel | 24,90 € |
| Suporte para Cartaz | **14,90 €** (subiu de 9,90; novo oficial 2026-07-01) |
| Cartaz A4 | 1,00 € |
| Livro de Elogios Digital | 19,90 € |
| Pack Papel + Digital | 39,90 € |
- **Pacote papel+suporte: PREÇO CONFIRMADO `34,90 € +IVA`** (Renato, 2026-07-01; supersede a proposta 29,90). Soma separada 40,80 € → poupa 5,90 € (−14,5%). **Falta actualizar o Suporte na loja live (9,90→14,90).**
- ⚠ Discrepância de preço RESOLVIDA: adopta-se **14,90 €** para o Suporte (valor do seeder do rebuild `ProductSeeder.php`); a loja live (9,90€) fica desactualizada até ser corrigida.
- Produto real: livro capa laranja 100 págs (50+50 destacáveis) desde 2013, 27.000+ empresas · suporte acrílico cristal T-shape A4 base antiderrapante · cartaz "Sorria. Aqui pode elogiar." Envio CTT, portes grátis >40€.

### Criativos produzidos + design pass (2026-07-01)
Kit criativo do pacote todo produzido e refinado:
- **Redes sociais** (`redes-sociais/_Final/` + fontes `software/`): **3 posts (1200×1500) + 1 story (1080×1920)** compostos com as regras do Livro de Elogios (Lato, logo centro 168px, arcos, URL rodapé) mas com **imagens de produto** em vez de ilustração. Post1=pack.png, Post2=lifestyle balcão (cor natural), Post3=suporte (foco na novidade; substituiu o conceito "mãos a escrever"→imagem inexistente), Story=loja-close vertical. Render via `npx playwright screenshot`.
- **Email** (`email/email.html`): **reconstruído a partir de `template_original.html`** (template oficial Brevo — logo hospedado, footer redes sociais reais, `{UNSUBSCRIBE_URL}`/`{WEB_VIEW_URL}`). Bespoke antigo em `email_bespoke_v1.html`.
- **Banner do email** (`email/banner_pacote.html`→`assets/img/banner_pacote.png`): **layout produtos-ESQUERDA / texto-DIREITA** (pedido do Renato — o texto tapava o produto quando estava por cima). Logo + eyebrow + título 900 + badge "Cartaz A4 incluído" + social proof 27.000, forma tint #FFF1EB atrás do produto.
  - **Iteração 2026-07-02 (banner do email FINAL):** o Renato rejeitou o banner e pediu novos via **OpenAI gpt-image-2** (`img-gen-openai`). Geradas 2 direcções (`banner_v2_studio.png` estúdio + `banner_v2_lifestyle.png`) e depois `banner_v3_lifestyle.png` (full-bleed, cena café real, **com o texto real do produto** citado verbatim). ⚠ **Aprendizagem:** o gpt-image-2 ao **regenerar** o produto a partir da ref **apaga o texto impresso** (wordmark da capa, copy do cartaz) se o brief tiver "não adicionar mais texto" — é preciso citar TODO o texto do produto como invariante. O Renato acabou por fornecer ele um **`imagens/Banner Final.png`** (2494×1005, versão polida em PSD). **Banner final actual = composição HTML** `email/banner_final_text.html` → `email/assets/img/banner_final_text.png` (**1200×640**, mais alto): `Banner Final.png` como fundo full-bleed (`object-position:22%`, produtos à direita) + **texto da marca à ESQUERDA por cima** sobre scrim claro (sem fundo preto). `email.html` aponta para este. Texto = HTML nítido/editável (não AI). Padrão validado: banner com texto = fundo AI/foto + overlay HTML (texto crisp), não texto renderizado por AI.
- **Imagens lifestyle do produto** (`imagens/hero-balcao.png` + `imagens/loja-close.png`) — **regeneradas 2026-07-02** via OpenAI gpt-image-2 (`codex exec`) com os packshots de `_ref/` como referências (`-i livro.png cartaz_a4.jpg suporte_3.webp`, prompt por stdin) e **todo o texto de cada produto citado verbatim** como invariante. Correcções pedidas pelo Renato, iteradas: (1) livro e cartaz **ambos A4 → renderizados ao MESMO tamanho** (topos alinhados); (2) o **texto completo do cartaz** voltou (o gpt-image-2 tinha apagado "Request the Book of Compliments." + logo-lockup de baixo); (3) **wordmark do livro** limpo/sem distorção; (4) **livro = capa lisa (soft-cover), lombada laranja como a capa** (a ref `livro.png` é hardcover → dizer ao modelo p/ usar a ref só p/ a arte da frente + lombada #FD5000, sem miolo branco). Rácios: **hero 3:4** (1024×1365), **loja 9:16** (864×1536). ⚠ gpt-image-2 só gera 1:1/2:3/3:2 nativo → gera-se em 2:3 e **center-crop** via `System.Drawing` (hero corta altura; loja corta largura, composta com margens laterais p/ não cortar a mão). Originais anteriores em `imagens/_prev/`. Padrão validado: **rácio arbitrário = gerar no nativo mais próximo + crop pós.**
- **Apresentação** (`apresentacao.html`): página única com tudo (produto/preço/posts/email/anúncios/plano de lançamento), Poppins, on-brand. Espaçamento generoso (container 1200/48px, secções 112px, grids 32px) + responsivo mobile.
- **Design audit workflow** (`le-pacote-design-audit`, 4 agentes Explore read-only + síntese) auditou tudo contra o `2026_Nova_Plataforma/DESIGN.md`; correcções aplicadas: cores→tokens neutros (#595959/#0D0D0D/#E8E8E8), radius único 12px, `#ff5722`→`#FD5000` no email, CTA pill sólido, remoção de side-stripes/gradientes/glows, emojis→Font Awesome. **Fonte de verdade do design = `DESIGN.md` (secção 15 Anti-Padrões).**
- ⚠ Falta (fora do meu alcance): publicar posts · hospedar `banner_pacote.png` em CDN + trocar `src` p/ enviar email · actualizar preço do Suporte na loja live · montar campanhas Meta/Google.

## Pendentes transversais
- **Plataforma (rebuild):** ver [[livro-de-elogios]] — backoffice mock→real, checkout loja, gaps backend (lane Pedro), decisões de produto Q1/Q2.
- **Landing FIZ:** ligar form ao endpoint real de registo (hoje stub).
- **Redes:** Stories por fazer (Julho); Elogio do Mês de Julho ignorado.
- **Legacy/spec:** migrar `Wireframes/plano_desenvolvimento.html` para `2026_Nova_Plataforma/docs/` como spec de referência (inventário do legacy + decisões de produto Abril 2026, hoje fora do radar).
- **Preços:** reconciliar as 3 fontes (loja live · seeder rebuild · Pacote Cartaz) antes de qualquer publicação comercial.
- **Brasil:** arquivar os projectos editáveis (vídeo/website) — hoje só existem os entregáveis finais.
- **Newsletter Digital:** hospedar `2026_Newsletter/banner/banner.png` em URL HTTPS + trocar `src` no `email.html` + assunto Brevo + teste + envio.

## Git / regras (herda da plataforma)
NUNCA push/branch sem ordem do Renato. `dev` = local-only. Push → sempre `setuptech/renato-dev`. (`Wireframes` legacy não é git.) Detalhe → [[livro-de-elogios]].

### Pacote Cartaz — campanha completa + LIVE (sessão 2026-07-02 tarde)
- **Vídeo reel:** `video/reel_pacote.mp4` — 19,5s, 1080×1920 (9:16), **HyperFrames** (HTML+GSAP), 5 cenas (hook kinetic type laranja → reveal pack → 3 quick-hits componentes → lifestyle balcão 27k → preço 34,90€+CTA), wipes skew entre cenas, música = `2026_Video_Brasil/_material/musica.wav` cortada a 19,5s c/ fade (ffmpeg→m4a). Fonte `video/index.html`, plano `video/PLANO.md`, lint/inspect/validate limpos, tipografia **Lato** (regra redes sociais). ⚠ Windows: CLI hyperframes dá `spawn UNKNOWN` sem `HYPERFRAMES_BROWSER_PATH` apontado ao chrome.exe. Render: `npm run render`.
  - **Regra de marca em publicidade (aplicada ao reel):** vídeos/anúncios do Livro de Elogios usam **SÓ laranja `#FD5000` + branco** e fazem hierarquia por **peso** (Lato normal 400 ↔ extra-bold 900), **NUNCA preto** — preto só em textos corridos normais. Removidos todos os `#0d0d0d` (títulos→laranja, palavras-chave a 900), fundo/scrim preto da cena lifestyle → **wash laranja**, pills pretas → branco/contorno branco. Também **removidos os `box-shadow` atrás das imagens** (pedido do Renato — cards do pack e quick-hits limpos).
- **Sincronização pós-refresh de imagens:** re-render **post2 + story** (`_Final/`), **6 crops de `formatos/`** (agora cover-crop Pillow directo das imagens novas — `src/` é só histórico) e **banner do email** (fundo novo `Banner Final.png` 2494×1575 copiado p/ `email/assets/img/banner_final.png` + re-render 1200×640).
- **Email PRONTO A ENVIAR:** banner hospedado (URL absoluto `https://packlancamento.rfdev.pt/email/assets/img/banner_final_text.png`), **preço 34,90€+IVA** antes do CTA (c/ 40,80€ riscado + poupança), pré-header implementado, "UNSUBSCRIBE"→"CANCELAR SUBSCRIÇÃO", frase institucional corrigida, neutros→`#E8E8E8`, CSS morto removido. Falta: assunto no Brevo + teste Gmail/Outlook/Apple Mail + envio.
- **`apresentacao.html` refinada** (pós-audit vs DESIGN.md): nav pill flutuante (padrão 8.4) **com o logótipo laranja `assets/logo.svg`** (não texto), CTAs reais `.btn-primary` (loja + reel), tipografia `clamp()` c/ hero 900, footer `rgba(255,255,255,.7)`, success-bg `#EBF5F0`, **secção Vídeo** (player + storyboard) + **secção KPIs** (metas propostas a validar: 50 pacotes/2,5% CTR/3× ROAS/10k alcance), calendário 4 dias (reel na terça). **Imagem da secção "três peças" trocada** de `_ref/livro_pack.jpg` (mostrava autocolante de vinil — item errado) → `_ref/pack.png` (packshot real livro+suporte+cartaz).
- **⚠ Ad-blocker (uBlock/Ghostery) escondia a secção de campanhas:** os filtros cosméticos apanham nomes de classe/id típicos de anúncio — `ad-block`/`ad-col`/`ad-p`/`id="anuncios"`. Renomeados para neutros (`mkt-group`/`mkt-col`/`mkt-line`/`id="campanhas"`) + texto "Publicidade paga"→"Media paga", "Meta & Google **Ads**"→"Campanhas Meta & Google", "**Ads** Manager"→"gestor de campanhas". **Regra: nunca usar `ad-*`/`anuncios`/`sponsor`/`banner-ad` em markup de páginas próprias.**
- **`material a publicar/`** (2026-07-08) — pasta consolidada com os entregáveis finais prontos a publicar: `reel_pacote.mp4` + 4 imagens de redes (`post1_anuncio`/`post2_balcao`/`post3_suporte`/`story_pacote`) + 5 imagens de produto usadas nos anúncios (`ad-hero`/`hero-balcao`/`flatlay-pack`/`loja-close` + packshot `pack.png`). Cópias, não movidos — fontes ficam no lugar.
- **`_FINAL/Produto/para_site/`** (2026-07-09) — 8 fotos de produto 1500×1500 convertidas para WebP **q90 lossy** (52–240 KB, −82 a −97% vs PNG; PSNR>39 dB) prontas para o site; PNGs ficam como master lossless. Receita cwebp → Brain `webp,imagens`. (Renato achou o WebP lossless ainda grande ~1 MB → q90 é o caminho web.)
- **Deploy `packlancamento.rfdev.pt`:** VPS Datalix, vhost Caddy `file_server` → `/var/www/packlancamento`, Cloudflare A proxied. Conteúdo (~18 MB): index.html (=apresentacao) + `assets/logo.svg`+`logo-branco.svg` + `_ref/` + `redes-sociais/_Final/` + `email/preview.png` + banner + `video/reel_pacote.mp4`. Verificado live (200 em tudo). Mudanças → scp + **purgar cache CF**. ⚠ DNS acabado de criar demora a propagar ao resolver local — validar via `curl --resolve packlancamento.rfdev.pt:443:104.21.94.239`.

## Newsletter Digital (`2026_Newsletter/`) — email marketing (2026-07-06)
Email marketing standalone do **Livro de Elogios Digital** (ângulo QR Code + sustentabilidade), copy fornecida verbatim pelo Renato. Assunto "Reconhecimento cabe no bolso".
- **`email.html`** — herda a identidade do email do Pacote Cartaz (`../2026_Pacote_Cartaz/email/email.html`): estrutura bulletproof table-based, Poppins, laranja `#FD5000`, botão pill, logo Brevo hospedado, footer institucional + social (FB/LinkedIn/IG reais) + `{UNSUBSCRIBE_URL}`/`{WEB_VIEW_URL}`. Copy do Renato verbatim; 2 frases destacadas ao estilo do template (pergunta a 600, fecho "cabe no bolso, literalmente" centrado laranja 900). CTA → `livrodeelogios.com/loja?utm_campaign=digital`.
- **`banner/banner.png`** (1200×640) — **padrão validado: fundo foto/AI + headline crisp em HTML por cima** (texto NUNCA renderizado por AI). Fonte `banner/banner.html` (re-render: `npx playwright screenshot --viewport-size=1200,640 banner.html banner.png`).
  - Fundo = `banner/hero_real.png` gerado por **OpenAI gpt-image-2 a partir de FOTOS REAIS do produto** (não packshot inventado): mãos a segurar telemóvel com a app de elogios laranja/branca, café luminoso, terço esquerdo limpo p/ texto.
  - **Refs reais sacadas do site** `livrodeelogios.com/loja/livro-de-elogios-digital` (10 imgs na página; a boa = foto real mãos+telemóvel com feed de elogios), guardadas em `banner/refs/`. ⚠ **Aprendizagem:** para produto DIGITAL o hero é o **telemóvel** (sem livro físico) — a 1ª tentativa com livro físico AI saiu com wordmark distorcido "(R)" na capa (gpt-image-2 mangla texto de capa). Tirar o livro do enquadramento eliminou o problema. Versão descartada: `banner/hero_raw.png`.
- **Antes de enviar (Brevo):** hospedar `banner/banner.png` em URL HTTPS absoluto + trocar `src` no `email.html` (email não renderiza caminhos relativos); definir assunto; teste Gmail/Outlook/Apple Mail; confirmar link da loja (produto digital 19,90 €+IVA).
- **`2026_Newsletter.zip`** (4,73 MB) na pasta-mãe = entregável completo (email + banner + refs + copy + preview).

## Última sessão (2026-07-06) — Newsletter Digital (email marketing)
Criado email marketing standalone do Livro de Elogios Digital em `2026_Newsletter/` (nova frente): `email.html` no template do Pacote Cartaz + copy do Renato verbatim + banner 1200×640 (foto real do produto sacada do site → gpt-image-2 → headline HTML por cima). Iterações do Renato: (1) faltava banner → gerado; (2) "usa imagens do produto REAL" → sacadas do site e re-geradas com refs reais (telemóvel, sem livro, sem "(R)"). Banner aprovado. Zip do email criado na pasta-mãe. Falta (Renato): hospedar banner + enviar no Brevo. Detalhe → secção "Newsletter Digital" acima.

## Última sessão (2026-07-02 tarde) — Pacote Cartaz: reel + página + deploy
Re-análise completa do kit + **reel de lançamento novo** (HyperFrames, 19,5s 9:16, música) + email pronto-a-enviar + `apresentacao.html` refinada (secções Vídeo/KPIs) + **deploy live `packlancamento.rfdev.pt`** (VPS Caddy + CF). Iterações do Renato aplicadas e redeployadas: (1) reel só laranja+branco, hierarquia por peso, zero preto; (2) remover box-shadows atrás das imagens; (3) renomear classes/ids `ad-*`→`mkt-*` (uBlock/Ghostery escondia a secção de campanhas); (4) logótipo na navbar; (5) imagem da secção "três peças" → packshot real do pack. Detalhe → secção "Pacote Cartaz — campanha completa + LIVE" acima. Falta (Renato): enviar email (assunto Brevo+teste), publicar posts/story/reel, preço Suporte na loja, campanhas Meta/Google.

### Sessão 2026-07-02 (manhã)
0. **Pacote Cartaz — imagens lifestyle regeneradas** (`hero-balcao.png` 3:4 + `loja-close.png` 9:16) via OpenAI gpt-image-2 com packshots `_ref/` + texto verbatim: produtos ao mesmo tamanho A4, texto completo do cartaz recuperado, wordmark limpo, livro soft-cover com lombada laranja. gpt-image-2 só faz 1:1/2:3/3:2 → gera 2:3 + center-crop (`System.Drawing`). Ver "Criativos produzidos" §Imagens lifestyle. Originais em `imagens/_prev/`.
1. **Pacote Cartaz — banner do email FINAL:** iteração via OpenAI gpt-image-2 (v2/v3) → o Renato forneceu `imagens/Banner Final.png` polido → banner final = composição HTML `email/banner_final_text.html`→`banner_final_text.png` (1200×640, fundo full-bleed + texto marca à esquerda por cima, scrim claro); `email.html` religado. Ver "Criativos produzidos" §Iteração. ⚠ Envio: falta hospedar PNG em CDN HTTPS + URL absoluto.
2. **Plataforma — review/teste de "Corrigir e melhorias LE"** (read-only, nada corrigido): tester-code + tester-ui-ux + smoke live meu (Playwright, :8000/:5173). **220/221 testes verdes** (1 vermelho = PlanTest pré-existente), tsc limpo, backend fixes verificados live (401-JSON, `authorize('manage')` fix 403 Créditos, `public_profile` null, id/slug). **0 Critical.** Achados: **SEV-001 High = regressão** (botão "Ver mais elogios" removido em `PerfilColaborador.tsx` → dead-end) a corrigir antes de shipar; + mobile grid inline (High), Partilhar sem onClick (Med), PT-PT "Ativado" vs "Activo" em Revendedor (Med), 4 Low. Detalhe → [[livro-de-elogios]]. ⚠ Seed `maria.silva@teste.pt`/`password` deixou de autenticar (422); smoke feito com `admin@livrodeelogios.com`. ⚠ Review foi sobre snapshot de 36 ficheiros mas o working tree cresceu para 47 durante a sessão (worker concorrente da tarefa continuou a escrever) — review é point-in-time, não estado final.

### Sessão anterior (2026-07-01)
Análise da pasta-mãe (4 Explore) + umbrella `CLAUDE.md`; fix `/resume` (resolve por caminho); Pacote Cartaz preço 34,90 €+IVA + kit criativo + design-audit anti-slop.

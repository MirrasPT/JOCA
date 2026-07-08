---
name: bodegas-do-campo
description: Loja online de vinho (DO Ribeiro, Galicia) em WordPress + WooCommerce + Elementor Free — build do design homepage-v2
type: project
directorio: D:\Mega\Bodegas do Campo (Espanhol)\website_wordpress
---

**Stack:** WordPress (php8.3) + WooCommerce + Elementor **Free** + HFE (Header Footer Elementor) + WPForms Lite · tema Hello Elementor + child `bodegas-child`
**Objectivo:** Loja online de vinho com a homepage **visualmente idêntica** a `website_design/homepage-v2.html`, **todas as páginas editáveis no Elementor** (sem "blocos de código").
**Directório:** `D:\Mega\Bodegas do Campo (Espanhol)\website_wordpress`
**Design escolhido:** `../website_design/homepage-v2.html` (+ `DESIGN.md` manda em cor/tipografia/regras premium). Cliente escolheu v2.
**Iniciado:** 2026-06-23
**PRD:** não gerado (design + DESIGN.md servem de spec)
**Why:** Fase 2 do projecto Bodegas do Campo — depois do design (fase 1) aprovado, construir a loja real.
**How to apply:** Build via pipeline JSON Elementor (ver abaixo). Fidelidade ao protótipo é o critério. Nunca despejar HTML num widget — estrutura Elementor real + CSS do child theme.

## Ambiente local (Docker — não há PHP/WP-CLI no host)
- `cd "D:/Mega/Bodegas do Campo (Espanhol)/website_wordpress"` → `docker compose up -d db wordpress adminer`
- WP-CLI: `docker compose run --rm wpcli <cmd>` (entrypoint já é `wp`); para encadear: `docker compose run --rm --entrypoint sh wpcli -c '...'`
- **WP:** http://localhost:8090 · admin/admin_local_pw · **Adminer:** http://localhost:8091 (server `db`)
- Portas 8090/8091 escolhidas para não colidir com JOCA_UI (7371/7372) / JOCA_OS (7381/7382).
- **Named volumes** `wp_core`+`db_data` (core/plugins/uploads/DB) **fora do MEGAsync**. Repo (em Mega) só tem: compose, `.env`, child theme, mu-plugins, `elementor-templates/`, docs. ⚠ não pôr runtime WP dentro do Mega.

## Pipeline de build Elementor (PROVADO end-to-end)
Páginas geradas por JSON `_elementor_data` → import via post meta → editáveis no Elementor:
1. Escrever JSON em `elementor-templates/<pagina>.json` (Containers + widgets nativos).
2. `wp post meta update <id> _elementor_data "<json>"` + `_elementor_edit_mode=builder` + `_elementor_template_type=wp-page` + `_wp_page_template=elementor_header_footer` + `_elementor_version=<ver>`.
3. `wp post meta delete <id> _elementor_css` + `wp elementor flush_css`.
4. Look bespoke vem das classes `bd-*` em `bodegas-child/assets/css/design-system.css`; nav transparente→sólido + reveal em `assets/js/nav.js`.

### ⚠ GOTCHA crítico (custa horas se ignorado)
- **Containers/sections/columns** → chave `css_classes` (SEM underscore).
- **Widgets** → chave `_css_classes` (COM underscore).
- Trocar = a classe é silenciosamente ignorada (renderiza sem ela). Confirmado em Elementor (common-base.php=`_css_classes` widget; container.php=`css_classes`).
- Limpar `_elementor_element_cache`/`_elementor_css` + `flush_css` ao re-importar; desligar experiment `e_element_cache` evita HTML em cache.

**Última sessão:** 2026-07-06 — deploy staging + diagnóstico de links partidos (Elementor relativo em subpasta); fix pronto, bloqueado em credenciais.

## Deploy staging (2026-07-06)
- **URL:** https://wp.setuptech.dev/bodegas/ (migrado via All-in-One WP Migration; SÓ acesso wp-admin, sem SSH conhecido).
- **Problema:** botões/nav não funcionam. Causa: botões Elementor com URL **relativo à raiz** (`/enoturismo/`, `/shop/`, `/la-bodega/`, `/noticias/`, `/premios/`, `/contacto/`) — sem prefixo `/bodegas/`. No localhost (raiz) resolviam; na subpasta apontam para fora → 404. Cabeçalho HFE (site-wide) + home/enoturismo. Menu WP + core WP OK.
- **Fix pronto (não aplicado):** Better Search Replace, `"url":"\/` → `"url":"\/bodegas\/` em wp_postmeta (dry-run→run UMA vez→Regenerate CSS→verificar por curl). Detalhe no CLAUDE.md do projecto.
- ⚠ **BLOQUEADO:** wp-admin remoto rejeita `admin` / `&w2%$0B$JP` E a local `admin_local_pw`. User `admin` existe mas password não bate. Preciso da password remota correcta (ou SSH, ou corrigir fonte + re-deploy). "Lost password" provavelmente não sai (SMTP produção pendente).
- **Alternativa definitiva:** tornar botões URLs absolutas na fonte local → migration-clean.

## Re-link JOCA (2026-07-06)

## Re-link JOCA (2026-07-06)
- `/init-project` correu em modo **refrescar** (projecto já estava ligado). Sem re-init do zero.
- graphify indexado sobre `website_wordpress`: **538 nós · 624 edges · 49 comunidades** (`graphify-out/`).
- `graphify-out/` adicionado ao `.gitignore` (não sincronizar no Mega nem versionar — regenerável).
- Secção **Navegação de Código** adicionada ao `CLAUDE.md` do projecto (aponta para `graphify-out/GRAPH_REPORT.md`).
- Nota: pasta-mãe `D:\Mega\Bodegas do Campo (Espanhol)` contém `website_design/`, `Logotipo/`, backup `.wpress` (314 MB) e `info/`; o projecto de código é só `website_wordpress/`.

## Estado actual (2026-06-24)
**SITE COMPLETO com conteúdo real, verificado e no GitHub** (`MirrasPT/Espanhol`, branch `main`). Todas as páginas Elementor-editáveis; forms a funcionar; WooCommerce es_ES; mobile ok; v0.5.2. Só falta deploy (em espera por decisão do cliente) + SMTP em produção. Detalhe na secção "Sessão 2026-06-24" abaixo.

## Estado anterior (2026-06-23)
**FOUNDATION COMPLETA + pipeline provado:**
- ✓ Docker WP 7.0 + MariaDB 11 + Adminer a correr; site serve (home 200).
- ✓ Plugins activos: elementor, woocommerce, header-footer-elementor, wpforms-lite. Tema `bodegas-child` activo (parent hello-elementor).
- ✓ WooCommerce: Espanha/Ourense, EUR (`right_space`, "10,00 €"), es_ES; páginas Shop(6)/Cart(7)/Checkout(8)/My-account(9).
- ✓ Media importada (IDs): logos 12/13, hero `pazo-pro` 14, eno img 16, vídeo `pazo-carballo.mp4` 17, news 18/19, produtos 22/24/26/28/30.
- ✓ 5 produtos: Pazo Carballo(21) 18,50€, Treixadura(23) 12,90€, Mencía(25) 13,50€, Godello(27) 14,90€, Vendimia de Oro(29) 16,00€ — **preços PLACEHOLDER, cliente confirma**.
- ✓ PoC Elementor importado e validado (classes aplicam) — depois apagado.

## Decisões tomadas
- Elementor **Free** (sem Pro) → header/footer via plugin HFE (editáveis no Elementor); efeitos bespoke via child theme CSS + classes `bd-*`.
- Newsletter: WPForms Lite (widget Elementor) estilizado.
- Imagens de produto PNG importadas como `.jpg` (WP 7.0 converte) — aceitável (DESIGN.md pede fundo branco 1:1); verificar transparência em QA visual se necessário.

## Feito (2026-06-23, cont.)
- ✓ **Header HFE** (id 45): nav fixo transparente→sólido, logo (custom_logo 12), menu "Principal", carrinho HFE, CTA "Comprar". Widgets HFE: `site-logo`, `navigation-menu`, `hfe-cart`.
- ✓ **Footer HFE** (id 46): 4 colunas, fundo terroir, icon-lists de links + contacto.
- ✓ **Homepage pixel-perfect** (front page id 38): 8 secções (hero, território+ghost "1979", produtos featured+4-up, enoturismo vídeo bg, stats-bar, noticias 1+2, prémios tabela, newsletter WPForms) — **QA visual com Playwright: bate com homepage-v2.html, 5/5 defeitos corrigidos, 0 regressões.**
- ✓ Páginas placeholder criadas: La Bodega(33), Enoturismo(34), Noticias(35), Contacto(36), Multimedia(37), Inicio(38). Tienda=shop(6).
- ✓ Newsletter form WPForms (id 49) — criar via `wpforms()->form->add(..., ['post_content'=>wpforms_encode(...)])` com `wp --user=admin eval` (precisa cap `create_forms`). Widget Elementor `wpforms`, control `form_id`.
- ✓ CSS: tokens + bespoke em `design-system.css`; CSS por página em `assets/css/pages/*.css` (auto-enqueued via glob em functions.php — evita clobber em paralelo). nav.js: interiores (sem `.bd-hero`) = nav sólido sempre.

### Gotchas extra confirmados
- Elementor kit default mete headings a AZUL (#6EC1E4) + Roboto → forçar no CSS `.elementor-widget-heading .elementor-heading-title{font-family:Cormorant!important;color:var(--terroir)!important}`; secções escuras override `#fff!important`; eyebrows `.bd-eyebrow` voltam a Overpass + cor própria (regras DEPOIS, com !important).
- HFE nav menu fazia wrap + item activo VERDE → `flex-wrap:nowrap` + override `.current-menu-item>a` color !important.
- Headings com `<em>`/`<br>` no `title` do widget heading: sobrevivem (wp_kses_post).
- Playwright MCP estava down (health-check falha) → QA agent usou Playwright local via Node (`NODE_PATH`→ `JOCA_FINAL/node_modules`).

## Feito (2026-06-23 — workflow fan-out, todas as páginas)
- ✓ **Workflow `bodegas-pages-build`** (6 agentes paralelos + QA) construiu todas as páginas restantes, editáveis no Elementor:
  - **Tienda/shop** premium: sem add-to-cart no listing (hook em mu-plugin), pill de varietal + "Ver vino →", grelha 4-col; **single produto** 2-col, único add-to-cart; carrinho/checkout de marca. CSS em `pages/woocommerce.css`.
  - **La Bodega**(33), **Enoturismo**(34), **Noticias**(35), **Contacto**(36, WPForms id 50 + google_maps), **Multimedia**(37, galeria). Cada uma: `elementor-templates/<page>.json` + `pages/<page>.css`.
- ✓ **Pretty permalinks ON** (`/%postname%/`) — todas as páginas resolvem (`/shop/`, `/la-bodega/`, etc.). Era OBRIGATÓRIO: sem isto os slugs caíam na homepage.
- ✓ **Varietais reais**: atributo "Varietal" por produto (WC_Product_Attribute via `wp --user=admin eval`); helper `bodegas_product_variety()` lê o atributo (fallback categoria). Pills mostram Treixadura/Godello/etc.
- ✓ Contact form: name field → format `simple` (evita "First/Last" em inglês).
- ✓ QA visual Playwright de todas as páginas: on-brand (Cormorant+Overpass, paleta), header sólido + footer, 0 headings azuis, 0 erros de consola.

### Gotchas extra (workflow)
- **Permalinks plain por defeito** → slugs 404/fall-through até `wp rewrite structure '/%postname%/' --hard && wp rewrite flush --hard`. Após flush, Apache recarrega ~1-2s (curl pode dar `000` transitório).
- **image-gallery widget**: control é `wp_gallery` (NÃO `gallery`); spacing `image_spacing="custom"`. Key errada → galeria renderiza vazia (ver [[elementor-json-pipeline]]).
- Atributo de produto custom via `WC_Product_Attribute` + `$p->set_attributes([...])->save()` (precisa `wc_get_product`).

## Catálogo real (2026-06-23)
- Produtos reais importados de bodegasdocampo.com/tienda: 5 vinhos caja-6 (Finca Pazo Carballo 77,70 · Viña do Campo Treixadura/Mencía 56,70 · Godello 65,40 · Vendimia Oro 171,00) + 5 estuches/packs (cat. "Estuches": 3-madeira 49,99 · Selección/Dúo Blanco/Imprescindible 22,99 · Pack personalizado desde 56,70). Imagens reais via `wp media import <url-remoto>` (container tem net).
- ⚠ **GOTCHA WooCommerce "Coming Soon"**: WooCommerce recente activa `woocommerce_coming_soon=yes` por defeito no onboarding → loja inteira mostra placeholder "Great things are on the horizon" em vez dos produtos (loop vazio, page id 6 sem Elementor, query devolve produtos mas front-end nada). Fix: `wp option update woocommerce_coming_soon no` (+ `woocommerce_store_pages_only no`).
- La Bodega (id 33) redesenhada com linguagem da home (hero **split-screen** 58/42, El Viñedo burgundy + nº fantasma "100", secção **vídeo YouTube** 9sMENz9NrJg, fecho editorial) + conteúdo real do site live. Hero 60vh.

## Sessão 2026-06-23 (cont.) — polish design + catálogo real + cards loja
Iteração visual com o cliente (cada fix verificado por screenshot Playwright local; **versão de assets `BODEGAS_VERSION` em functions.php → bump a cada mudança de CSS para cache-bust**; cliente vê só após Ctrl+F5).
- **Homepage hero**: botões compactos à esquerda (gap 12→10px), `bd-hero-btns` width fit-content; subtexto respiro reduzido. "1979" ghost a 15% (a regra QA `.bd-on-burgundy .heading{#fff!important}` estava a comê-lo → ghost-year com maior especificidade + !important). Newsletter: texto centrado (`.e-con-inner{text-align:center!important}`) + input/botão à mesma altura 50px (label WPForms escondida reservava altura → desnível) + placeholder claro.
- **Enoturismo (home)**: conteúdo full-width (era boxed 1140) + ações alinhadas à direita.
- **La Bodega (id 33) REDESENHADA 2× a pedido**: 1º editorial → "muito parecido ao site original"; 2º linguagem da home → "muito parecido à home". Final: **mesmo design system, composição própria** — hero **split-screen** 58/42 (foto | painel escuro; NÃO usa `.bd-hero` → nav sólido), El Viñedo burgundy+ghost "100"+stats, **secção vídeo YouTube** (9sMENz9NrJg, fundo escuro, widget `video` youtube + image_overlay), fecho editorial. Conteúdo REAL (WebFetch de /la-bodega/). Hero 60vh.
- **Loja**: catálogo real (10 produtos, ver acima) + **cards idênticos ao card de vinho da home** (`.bd-wine-card`): foto 3/4, pill sage, nome Cormorant, "Ver vino →" logo a seguir, **SEM preço no listing** (preço só no single). Remover `margin-top:auto` do link (criava vão) + alinhar margens pill/nome ao ritmo da home.

### Gotchas extra (esta sessão)
- **`.bd-btn` (wrapper do widget Button) NÃO leva padding** — duplicava com `.elementor-button` e inchava o botão (parecia "afastado"). Padding só em `.bd-btn .elementor-button`.
- **Pill em coluna flex estica à largura toda** (`align-items:stretch` default) → fundo verde full-width. Fix: `.bd-pill{align-self:flex-start;width:fit-content}`.
- **Hero full-bleed em página interior**: `body:has(.bd-hero){padding-top:0!important}` para o hero ir por baixo do nav fixo (senão a regra `body:not(.home){padding-top:72px}` deixa gap).
- **Cache do browser**: mudar CSS não chega — bump `BODEGAS_VERSION` (?ver=) e/ou re-import (regenera `post-<id>.css` com timestamp novo). Cliente queixou-se de "ainda afastado" = via versão em cache.
- **Verificação visual**: medir com Playwright local (Node + `NODE_PATH`) é mais fiável que screenshot do agente (um agente reportou 64px de gap que afinal eram 12 — mediu o texto, não a caixa do botão).

## Sessão 2026-06-24 — conteúdo real end-to-end + verificação + push GitHub
**Loja cards = card da home:** o listing usava markup WooCommerce com regras paralelas → as fotos de produto ficavam com barras brancas/corte. Fix em 2 camadas: (1) WC `woocommerce_thumbnail_cropping=uncropped` + width 600 + `wp media regenerate` (parou o corte quadrado 300×300); (2) **override `woocommerce/content-product.php`** que emite a markup IDÊNTICA do card da home (`.bd-wine-card > .bd-wine-card-img > img` tamanho `large`), e limpeza das regras de listing antigas no `woocommerce.css`. As "barras" residuais nos estuches eram o fundo branco das próprias fotos de estúdio (não CSS).
**Galeria do single invisível:** WooCommerce mete `opacity:0` no wrapper e revela por JS de galeria que não inicializava → imagem em branco. Fix: galeria estática (sem slider, que colapsa a 1px) + CSS `opacity:1!important` + anchor da imagem `display:block` (senão `img width:100%` colapsa a 0).
**Conteúdo real (fonte bodegasdocampo.com, ZERO fabricação):** 10 produtos com descrição+cata+elaboração+ficha analítica+preços reais; **/premios/** com ~32 prémios reais por vinho (shortcode `[bodegas_premios]`); **Noticias** = 10 posts WP reais (`[bodegas_noticias]`, singles a funcionar) — substituíram cards fabricados; **Contacto** form real (WPForms 50, tinha 0 campos); **Enoturismo** horário+telefone reais; **Multimedia** 10 fotos históricas reais + filtros; footer com CP 32414 + 2 telefones + FB/IG. Auditoria revelou que sessões anteriores tinham fabricado prémios/notícias.
**Telefones reais:** fixo **988 470 258** + WhatsApp/enoturismo **609 82 41 69** (o "632 19 27 95" era só de um post antigo — eliminado).
**Mobile:** workflow fan-out corrigiu overflow lateral (64px→0; causa = padding de secção 72-88px em mobile) e o carrinho de blocos partido (`alignwide` breakout -80px).
**Verificação logado:** todas as 8+1 páginas abrem no editor Elementor sem erro JSON; ambos os forms submetem+confirmam (AJAX). Newsletter (49) estava malformado → reconstruído.
**Plugins:** All-in-One WP Migration + S3 Client Extension instalados/activos.

## Pendente
- **Deploy** (cliente pediu para NÃO avançar ainda). Export via All-in-One WP Migration (S3) ou cPanel. **Artefacto pronto:** `../localhost-20260625-074919-wa6yzbu5bpph.wpress` (315 MB, full-site export AIO-WP-Migration, 2026-06-25) na pasta-pai — importar no destino quando o cliente autorizar.
- **SMTP em produção** — notificações dos forms configuradas p/ comercial@bodegasdocampo.com, mas local sem servidor de email (entrega só funciona com plugin SMTP no deploy).
- Confirmar preços/IVA finais com cliente; decidir se loja vende (preço visível + add-to-cart no single).
- Enoturismo: validar veracidade do alojamento s.XVI / imagem do hotel.
- Cart "Carrito" label (HFE só ícone+contador) — polish.

## Última sessão
2026-06-24 — Conteúdo REAL end-to-end (10 produtos, prémios, 10 posts, contacto form, enoturismo, multimédia, footer) só com dados do site antigo; loja/single corrigidos; mobile via workflow; verificação Elementor+forms logado; **push para github.com/MirrasPT/Espanhol (main)** com dump DB+uploads. Assets em v0.5.2.

## Refresh 2026-06-29 (/init-project — re-scan, sem mudança de scope)
Re-verificado o estado real no disco (projecto já inicializado no JOCA). Sem trabalho novo desde 2026-06-24:
- Git: `MirrasPT/Espanhol` main, **1 commit squashed** (`a4b2507`), em sync com origin. Working tree limpo exceto `M CLAUDE.md` (uncommitted — apenas documentação: secções shortcodes/gotchas-Woo/repo-backup, conteúdo já reflectido nesta memória).
- Snapshot DB+uploads presente (`snapshot/database/bodegas-docampo.sql` + `snapshot/uploads/`).
- **Único facto novo:** export full-site `.wpress` (315 MB, 2026-06-25) criado na pasta-pai (ver Pendente → Deploy). Não houve deploy.

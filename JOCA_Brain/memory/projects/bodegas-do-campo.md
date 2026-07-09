---
name: bodegas-do-campo
description: Loja online de vinho (DO Ribeiro, Galicia) em WordPress + WooCommerce + Elementor Free — build do design homepage-v2
type: project
directorio: /Users/renatoferreira/MEGA/Bodegas do Campo (Espanhol)/website_wordpress
---

**Stack:** WordPress (php8.3) + WooCommerce + Elementor **Free** + HFE (Header Footer Elementor) + WPForms Lite · tema Hello Elementor + child `bodegas-child`
**Objectivo:** Loja online de vinho com a homepage **visualmente idêntica** a `website_design/homepage-v2.html`, **todas as páginas editáveis no Elementor** (sem "blocos de código").
**Directório:** `/Users/renatoferreira/MEGA/Bodegas do Campo (Espanhol)/website_wordpress`
**Design escolhido:** `../website_design/homepage-v2.html` (+ `DESIGN.md` manda em cor/tipografia/regras premium). Cliente escolheu v2.
**Iniciado:** 2026-06-23
**PRD:** não gerado (design + DESIGN.md servem de spec)
**Why:** Fase 2 do projecto Bodegas do Campo — depois do design (fase 1) aprovado, construir a loja real.
**How to apply:** Build via pipeline JSON Elementor (ver abaixo). Fidelidade ao protótipo é o critério. Nunca despejar HTML num widget — estrutura Elementor real + CSS do child theme.

## Ambiente local (Docker — não há PHP/WP-CLI no host)
- `cd "/Users/renatoferreira/MEGA/Bodegas do Campo (Espanhol)/website_wordpress"` → `docker compose up -d db wordpress adminer`
- WP-CLI: `docker compose run --rm wpcli <cmd>` (entrypoint já é `wp`); para encadear: `docker compose run --rm --entrypoint sh wpcli -c '...'`
- **WP:** http://localhost:8090 · admin/admin_local_pw · **Adminer:** http://localhost:8091 (server `db`)
- Portas 8090/8091 escolhidas para não colidir com JOCA OS (7491/7492).
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
> ✅ **RESOLVIDO 2026-07-08** — ver secção "Fix staging RESOLVIDO" acima. Acesso agora via FTP + wp-admin. Os links partidos abaixo estão corrigidos.
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
- Nota: pasta-mãe `/Users/renatoferreira/MEGA/Bodegas do Campo (Espanhol)` contém `website_design/`, `Logotipo/`, backup `.wpress` (314 MB) e `info/`; o projecto de código é só `website_wordpress/`.

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
2026-07-08 (tarde) — **2 fixes no staging + auditoria site-wide** via FTP (acesso directo ao WP remoto desbloqueado): (1) links partidos na subpasta `/bodegas/` (3 classes de URL), (2) `.bd-reveal` invisível no editor Elementor (fix CSS scoped ao editor, v0.5.3), (3) auditei todo o CSS/JS por casos parecidos → só o `.bd-reveal` existia, site limpo. Detalhe nas secções abaixo. (Manhã: refresh Mac /init-project.)

## Fix editor Elementor — `.bd-reveal` invisível ao editar (2026-07-08)
**Sintoma:** no editor, o hero da home (e outras secções) mostra só a imagem de fundo — textos/botões editáveis (aparecem nas settings) mas invisíveis no preview. Frontend OK.
**Causa:** `design-system.css` tem `.bd-reveal{opacity:0}` (reveal-on-scroll); o `nav.js` (IntersectionObserver) adiciona `.is-visible` para revelar. **O editor Elementor NÃO corre o JS de frontend do tema** → os `.bd-reveal` ficam presos a `opacity:0`. 14 elementos `.bd-reveal` só na home (hero content `hpheroct`, cards, secções).
**Fix:** regra scoped ao editor no fim de `design-system.css` (frontend intacto):
```css
.elementor-editor-active .bd-reveal { opacity: 1 !important; transform: none !important; }
```
+ bump `BODEGAS_VERSION` 0.5.2→**0.5.3** (cache-bust). Aplicado no servidor E no repo local (estavam em sync). Confirmado no editor: hero completo visível.

**Auditoria site-wide (2026-07-08):** varri todo o CSS do child theme (`design-system.css` + `pages/*.css`) por padrões de invisibilidade-no-editor. Conclusão: **`.bd-reveal` (`opacity:0`) era o ÚNICO estado escondido-por-JS** → o fix cobre o site inteiro. Restantes `display:none`/`visibility:hidden` são todos legítimos (responsive/hover/intencional, nenhum revelado por JS). Nav transparente (`.bd-nav-transparent` sem `.is-scrolled`) verificado no editor do Contacto → renderiza **sólido e legível** (não há bug). Shortcodes (`[bodegas_*]`) **executam** no widget shortcode do Elementor (não ficam vazios). Mapa do Contacto (embed sem API key) renderiza. **Site limpo — sem mais casos.**

### ⚠ Gotcha FTP (stableserver/dominiosprofissionais) — ficheiros grandes
- Upload de ficheiro grande (~32KB) via **FTPS explícito com TLS no canal de dados** → **erro 451** ("local error in processing") e o curl **trunca o ficheiro-destino a 0 bytes** (partiu o CSS do site live momentaneamente). Ficheiros pequenos (~2KB functions.php) passam.
- **Fix:** `curl --ftp-ssl-control` (TLS só no canal de CONTROLO, dados em plano) → upload OK. **SEMPRE verificar o tamanho no servidor após upload** (curl LIST) e reenviar se 0/parcial.

## Fix staging RESOLVIDO (2026-07-08)

## Fix staging RESOLVIDO (2026-07-08)
O bug de links partidos em `wp.setuptech.dev/bodegas/` está **corrigido**. Todas as 7 páginas: hrefs `/bodegas/...`, destinos 200.

### Acesso ao staging (NÃO é Docker isolado — é hosting partilhado real)
- `wp.setuptech.dev` → **194.42.98.200** = **mesmo IP** que `s4835.lux1.stableserver.net`. O site vive no servidor partilhado (reseller `dominiosprofissionais.com`), conta com pasta por-site (`/bodegas/`, `/bigorna/`, `/clubio/`…).
- **FTP/FTPS explícito:** host `ftp.dominiosprofissionais.com` porta 21, user `claude@wp.setuptech.dev`. **Password NÃO guardada aqui** (pedir ao Renato). Cliente curl: `curl --ssl-reqd -k -u '<user>:<pw>' ftp://.../bodegas/`. Raiz WP em `/bodegas/` (wp-load.php, wp-config.php, wp-content).
- **wp-admin:** https://wp.setuptech.dev/bodegas/wp-admin/ · user `admin` (password fornecida pelo Renato) — **funciona**.
- **Prefixo de tabelas DB = `wpif_`** (não `wp_`). Alvo dos fixes: `wpif_postmeta`.
- Sem SSH/WP-CLI (shell partilhado off); DB não acessível de fora (host localhost). **Padrão que funcionou:** subir script PHP que faz `require wp-load.php` + `$wpdb`, disparar via HTTPS com `?key=<token>&mode=dry|run`, **apagar o script no fim**.

### As 3 classes de URL root-relative (Elementor guarda URLs em 3 formatos distintos!)
Uma migração para subpasta tem de corrigir **os 3** — o BSR default só apanha o 1º:
1. **JSON url escapado** `"url":"\/shop\/"` — botões Elementor (footer post 46, home 38, enoturismo 34). 3 células, 15 URLs.
2. **JSON url NÃO-escapado** `"url":"/shop/"` — header HFE (post 45) + La Bodega (33). Diferença = como o JSON foi importado. 2 células, 3 URLs.
3. **Âncora HTML escapada** `href=\"\/shop\/\"` dentro de widgets Text Editor — cards + "ver todos" da home (post 38). 1 célula, 8 hrefs. Técnica protect-replace-restore p/ não duplo-prefixar.
Itens de menu (`nav_menu_item` type=post_type) derivam URL do permalink → já corretos, não tocar. URLs absolutas (`http://.../bodegas/...`) intactas (não começam por `/`).

### Nota
- Instalei **Better Search Replace** (plugin) via wp-admin no início mas **NÃO o usei** (fiz via FTP+PHP) → **removido a pedido do Renato** (desactivado+apagado via `delete_plugins()`). Plugins no staging = mesmos da lista de 2026-06-24 (Akismet, AIO-WP-Migration+S3, Elementor, Hello Dolly, UAE, WooCommerce, WPForms Lite).

### Sessão original 2026-06-24 — Conteúdo REAL end-to-end (10 produtos, prémios, 10 posts, contacto form, enoturismo, multimédia, footer) só com dados do site antigo; loja/single corrigidos; mobile via workflow; verificação Elementor+forms logado; **push para github.com/MirrasPT/Espanhol (main)** com dump DB+uploads. Assets em v0.5.2.

## Refresh 2026-06-29 (/init-project — re-scan, sem mudança de scope)
Re-verificado o estado real no disco (projecto já inicializado no JOCA). Sem trabalho novo desde 2026-06-24:
- Git: `MirrasPT/Espanhol` main, **1 commit squashed** (`a4b2507`), em sync com origin. Working tree limpo exceto `M CLAUDE.md` (uncommitted — apenas documentação: secções shortcodes/gotchas-Woo/repo-backup, conteúdo já reflectido nesta memória).
- Snapshot DB+uploads presente (`snapshot/database/bodegas-docampo.sql` + `snapshot/uploads/`).
- **Único facto novo:** export full-site `.wpress` (315 MB, 2026-06-25) criado na pasta-pai (ver Pendente → Deploy). Não houve deploy.

## Refresh 2026-07-08 (/init-project em Mac — migração PC→Mac, sem mudança de scope)
Projecto migrou de PC (Windows) para Mac. Nenhum trabalho de dev; só reconciliação de ambiente:
- **Paths Windows→macOS** corrigidos (eram stale de `D:\Mega\…`): `directorio:` frontmatter + `Directório:` + `cd` docker + nota pasta-mãe nesta memória; `cd` + comando graphify (`python`→`python3`) em `website_wordpress/CLAUDE.md`.
- **Portas JOCA** actualizadas nas notas de "não colidir": `7371/7372 + 7381/7382` (JOCA_UI/JOCA_OS antigos) → **JOCA OS 7491/7492** (realidade actual). Loja continua em 8090/8091.
- **`~/CLAUDE.md`**: adicionada linha na tabela de projectos activos (faltava; aponta para `…/website_wordpress`).
- **Duplicado MEGAsync removido:** pasta `Bodegas do Campo (Espanhol) (1)/` era conflito de sync, **conteúdo byte-idêntico** (`.wpress` igual, mesmos ficheiros; só diferia o `CLAUDE.md` por ser pré-refresh). Apagada → projecto 13 GB → **6,4 GB**.

### Re-scan 2026-07-08 (2ª passagem /init-project — no-op)
- Segunda corrida do `/init-project` no mesmo dia. **Nada mudou de scope.** CLAUDE.md do projecto (nav + paths macOS `python3` + localhost:8090) e `~/CLAUDE.md` (tabela) já em sync da 1ª passagem.
- graphify re-indexado: **540 nós · 505 edges · 35 comunidades** (era 538/624/49 — drift menor, ok).
- **⚠ Sem `.git` local:** o `website_wordpress/` NÃO tem repositório git (MEGAsync não sincroniza `.git` na migração PC→Mac). O remoto `github.com/MirrasPT/Espanhol` (main) continua a existir, mas para voltar a versionar localmente é preciso `git clone`/`git init` + re-vincular ao remoto. Não bloqueia dev (build é via Docker+WP-CLI); só afecta versionamento.

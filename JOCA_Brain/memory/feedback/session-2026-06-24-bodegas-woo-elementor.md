---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-24
project: bodegas-do-campo
---

**Categoria:** missing-skill | **Severidade:** medium | **Descrição:** Sessão extensa de construção programática WooCommerce + Elementor (override de `content-product.php`, edição cirúrgica de `_elementor_data` via PHP/JSON, criação de forms WPForms via PHP, thumbnails uncropped, galeria single estática) feita do zero sem skill de apoio. As skills `wp-*` existentes cobrem core/blocks/REST/perf, mas não há guia para **WooCommerce storefront + Elementor Free programático** (o stack real deste cliente e provavelmente recorrente). | **Componente afectado:** `.claude/skills/` (família wp-*) | **Fix sugerido:** criar skill `woocommerce-elementor-build` com os gotchas validados: card de produto = override `content-product.php` com markup própria; `woocommerce_thumbnail_cropping=uncropped`+regenerate; galeria single `opacity:1`+anchor block (sem flexslider); WPForms via PHP precisa de estrutura completa + `ajax_submit`; conteúdo dinâmico via shortcodes editáveis em vez de N widgets Elementor.

**Categoria:** discovery-gap | **Severidade:** low | **Descrição:** A auditoria do site revelou que sessões anteriores fabricaram conteúdo (prémios, notícias, dados de enoturismo) apesar da regra anti-fabricação — só foi apanhado quando o user pediu comparação explícita com o site antigo. Reforça que builds de conteúdo a partir de uma fonte externa deviam validar contra essa fonte por defeito, não só quando pedido. | **Componente afectado:** soul.md / rules anti-fabricação (aplicação em workers de conteúdo) | **Fix sugerido:** no brief de agentes que escrevem conteúdo a partir de um site/fonte, incluir passo obrigatório "validar cada bloco contra a fonte real; marcar como TODO o que não existir na fonte" (análogo ao passo de verificar parsers em api-design.md).

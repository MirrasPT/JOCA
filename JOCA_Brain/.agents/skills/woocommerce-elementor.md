---
name: woocommerce-elementor
description: "Build a WordPress storefront programmatically with WooCommerce + Elementor (Free, no Pro) + Hello Elementor child theme, where pages are editable Elementor `_elementor_data` JSON and the child theme CSS does the look. MUST be invoked when the user says: Elementor, _elementor_data, Hello Elementor, WooCommerce storefront, WooCommerce + Elementor, HFE, Header Footer Elementor, WPForms, content-product.php. SHOULD also invoke when: WordPress shop build, programmatic Elementor pages, editable WordPress pages without code blocks, WooCommerce theme override."
triggers: elementor, _elementor_data, hello elementor, elementor free, woocommerce, woocommerce storefront, woocommerce elementor, HFE, header footer elementor, wpforms, content-product.php, woocommerce template override, programmatic elementor, elementor json, css_classes, _css_classes, loja woocommerce, storefront, wp post meta elementor, coming_soon
origin: local
---

# WooCommerce + Elementor (Free) Storefront — Programmatic Build

Build a WordPress shop where **every page is editable in Elementor** (no "code blocks") and the **child-theme CSS owns the look** while Elementor holds editable content. Stack: Hello Elementor + child theme + Elementor **Free** + HFE (Header Footer Elementor) + WPForms Lite + WooCommerce.

Verified end-to-end (real client project). All JSON patterns come from real exported `_elementor_data`, not docs alone.

**Doctrine:** child-theme CSS does the visual look (classes `bd-*`/your prefix); Elementor holds editable content; data-driven lists go in PHP shortcodes, not 200 widgets.

---

## 1. The `_elementor_data` import pipeline

`_elementor_data` is a **raw JSON array** of top-level containers — `[{...},{...}]`, NOT a wrapped template object. Store each page as `elementor-templates/<page>.json`.

```bash
JSON=$(cat elementor-templates/homepage.json)
wp post meta update $POST_ID _elementor_data        "$JSON"
wp post meta update $POST_ID _elementor_edit_mode    "builder"
wp post meta update $POST_ID _elementor_template_type "wp-page"
wp post meta update $POST_ID _wp_page_template        "elementor_header_footer"
wp post meta delete $POST_ID _elementor_css
wp elementor flush_css
```

- **No `_elementor_edit_mode=builder` → Elementor ignores the JSON** and renders the block-editor content instead (blank / classic page). #1 cause of "import did nothing".
- **No `flush_css` (and delete `_elementor_css`) → stale cached inline CSS** from the prior structure survives → visual drift that looks like a broken build but is a cache issue. Also clear `_elementor_element_cache`; disabling the `e_element_cache` experiment avoids cached HTML on re-import.

---

## 2. ⚠ `css_classes` (container) vs `_css_classes` (widget) — NOT interchangeable

The single most expensive gotcha. Confirmed in Elementor source (`container.php`=`css_classes`; widget `common-base.php`=`_css_classes`):

```json
// Container (elType:"container") — NO underscore
{ "settings": { "css_classes": "bd-hero bd-reveal" } }
// Widget (elType:"widget", any widgetType) — leading underscore
{ "settings": { "_css_classes": "bd-hero-h1" } }
```

Swap them and the class is **silently dropped** (element renders without it). Every styling hook depends on the class landing on the right element → this is the #1 cause of "design-system classes not applying" after a programmatic build.

---

## 3. Header/Footer via HFE CPT (same import)

HFE creates a `hfe_template` CPT — push `_elementor_data` to it exactly like a page:

```bash
HFE_ID=$(wp post create --post_type=hfe_template --post_title="Header" --post_status=publish --porcelain)
wp post meta update $HFE_ID _elementor_data    "$(cat elementor-templates/header.json)"
wp post meta update $HFE_ID _elementor_edit_mode "builder"
wp post meta update $HFE_ID hfe_template_type    "header"   # or "footer"
wp elementor flush_css
```

HFE widget types: `site-logo`, `navigation-menu`, `hfe-cart`. The "entire site" display condition is set once in the UI and survives rebuilds.

---

## 4. WooCommerce setup — disable `coming_soon` FIRST

WooCommerce 9.1+ ships `woocommerce_coming_soon=yes` by default → the whole storefront serves a "Great things are on the horizon" splash and the product loop is empty (query returns products, front-end shows nothing). **Admins bypass it, so it's invisible in local dev.** Disable at setup:

```bash
wp option update woocommerce_coming_soon "no"
wp option update woocommerce_store_pages_only "no"
```

Also: assign system pages (`woocommerce_shop_page_id` / `cart` / `checkout` / `myaccount`), set locale/currency, and **enable pretty permalinks** (`wp rewrite structure '/%postname%/' --hard && wp rewrite flush --hard`) — without permalinks the slugs fall through to the homepage. After flush, the server reloads ~1-2s (curl may give a transient `000`).

---

## 5. Product card = override `content-product.php` (don't fight WooCommerce markup)

To make the shop loop match the design card, override the template (never edit core):

```
wp-content/plugins/woocommerce/templates/content-product.php
→ wp-content/themes/<child>/woocommerce/content-product.php   (NOTE: strip the /templates/ segment)
```

Emit your card markup; add the BEM class via `wc_product_class()`:
```php
<li <?php wc_product_class('bd-wine-card', $product); ?>>
  <div class="bd-wine-card-img"><a href="<?php echo esc_url(get_permalink()); ?>"><?php echo $product->get_image('large'); ?></a></div>
  <div class="bd-wine-card-body">
    <h3 class="bd-card-name"><?php echo esc_html($product->get_name()); ?></h3>
    <a class="bd-card-link" href="<?php echo esc_url(get_permalink()); ?>">Ver &rarr;</a>
  </div>
</li>
```
Remove the loop add-to-cart in `functions.php`/MU plugin, NOT the template:
`remove_action('woocommerce_after_shop_loop_item','woocommerce_template_loop_add_to_cart',10);`

**Thumbnails:** WooCommerce's 1:1 crop destroys portrait shots (bottles). Set BEFORE media import, then regenerate:
```bash
wp option update woocommerce_thumbnail_cropping "uncropped"
wp option update woocommerce_thumbnail_image_width "600"
wp media regenerate --yes
```

**Single-product gallery invisible:** WooCommerce sets `opacity:0` on the gallery wrapper and reveals it via gallery JS that may not init → blank image. Fix: static gallery (no flexslider, which collapses to 1px) + `opacity:1!important` + the image anchor `display:block` (else `img{width:100%}` collapses to 0).

---

## 6. Forms (WPForms Lite via PHP)

```php
wpforms()->form->add($title, ['post_content' => wpforms_encode($formArray)]);  // needs cap create_forms
```
Run with `wp --user=admin eval`. A form needs the COMPLETE structure (fields + `settings.ajax_submit=1`); a malformed/0-field form submits nothing. Place via the Elementor `wpforms` widget (control `form_id`). For the name field use format `simple` (avoids English "First/Last").

---

## 7. Data-driven content → shortcodes, not 200 widgets

Prize lists, news grids, contact info, gallery filters → register a PHP shortcode in an MU plugin and drop ONE Elementor Shortcode widget. Keeps `_elementor_data` compact, keeps content editable without rebuilding JSON, and avoids Elementor's editor timing out (slows ~150 widgets, may fail to save at 250+).

**Anti-fabrication:** when content comes from a real source (an existing site, a brief), validate each block against that source and mark `TODO: não consta da fonte` for anything missing — by default, not only when asked (prior sessions fabricated prizes/news; see `workflows-and-tooling.md`).

---

## 8. Kit / theme gotchas

- Elementor default kit forces headings to blue (`#6EC1E4`) + Roboto → override in CSS with your font/colour (`!important`, rules placed AFTER the kit); dark sections re-override to `#fff!important`.
- `add_theme_support('woocommerce')`: Hello Elementor declares it — if you disable `hello_elementor_add_woocommerce_support`, re-add it in the child `after_setup_theme` or gallery zoom/lightbox/slider break.
- Hero full-bleed under a fixed nav: `body:has(.bd-hero){padding-top:0!important}`.
- **Cache-bust on every CSS change:** bump a `THEME_VERSION` constant used in the asset `?ver=` (clients see stale CSS otherwise — "still looks off" = cached). Per-page CSS auto-enqueued via glob in `functions.php` avoids clobber in parallel builds.

---

## References
- Elementor data structure (container/widget JSON): https://developers.elementor.com/docs/data-structure/
- Elementor CLI (`wp elementor flush_css` etc.): https://developers.elementor.com/docs/cli/
- WooCommerce template overrides: https://developer.woocommerce.com/docs/theming/theme-development/template-structure/
- WooCommerce coming-soon mode: https://developer.woocommerce.com/docs/extensions/extension-onboarding/integrating-coming-soon-mode/
- HFE plugin: https://wordpress.org/plugins/header-footer-elementor/

---

## Checklist
- [ ] Import sets `_elementor_data` + `_elementor_edit_mode=builder` + flush_css (deleted `_elementor_css`)
- [ ] `css_classes` on containers, `_css_classes` on widgets — verified in rendered HTML
- [ ] Header/Footer as `hfe_template` CPT, imported the same way
- [ ] `woocommerce_coming_soon=no` + pretty permalinks flushed
- [ ] Product card = `content-product.php` override (path strips `/templates/`), loop add-to-cart removed via hook
- [ ] Thumbnails uncropped + regenerated before QA; single gallery `opacity:1` static
- [ ] Data-driven lists as shortcodes, not many widgets; content validated against source
- [ ] Heading kit colour/font overridden; asset version bumped for cache-bust

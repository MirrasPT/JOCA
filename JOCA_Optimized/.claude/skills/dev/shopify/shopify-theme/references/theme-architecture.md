# Shopify Theme Architecture (Online Store 2.0)

## Folder structure

```
theme/
├── assets/           # CSS, JS, images, fonts (flat — no subdirs)
├── config/
│   ├── settings_schema.json   # Theme settings definition
│   └── settings_data.json     # Saved theme settings values
├── layout/
│   └── theme.liquid           # Main layout (wraps all pages)
├── sections/         # Reusable, merchant-customisable page sections
├── snippets/         # Reusable partials (no schema, no merchant UI)
├── templates/        # Page type templates
│   ├── index.json              # Home
│   ├── product.json            # Product pages
│   ├── collection.json         # Collection pages
│   ├── cart.liquid             # Cart
│   ├── page.json               # Standard pages
│   └── customers/login.liquid  # Account pages
└── locales/          # Translation strings
    ├── en.default.json
    └── pt-PT.json
```

## JSON vs Liquid templates

Online Store 2.0 templates are JSON by default:
```json
{
  "sections": {
    "main": {
      "type": "main-product",
      "settings": {}
    },
    "recommendations": {
      "type": "product-recommendations",
      "settings": { "heading": "You may also like" }
    }
  },
  "order": ["main", "recommendations"]
}
```

Use `.liquid` templates only when you need Liquid logic at the template level (e.g. `cart.liquid` for custom cart logic).

## Sections

Sections are the core building block — they appear in Theme Editor.

```liquid
{# sections/featured-collection.liquid #}
<div class="featured-collection">
  {% for product in section.settings.collection.products limit: section.settings.products_to_show %}
    {% render 'card-product', product: product %}
  {% endfor %}
</div>

{% schema %}
{
  "name": "Featured collection",
  "tag": "section",
  "class": "section",
  "settings": [
    { "type": "collection", "id": "collection", "label": "Collection" },
    { "type": "range", "id": "products_to_show", "min": 2, "max": 12, "step": 2, "default": 4, "label": "Products to show" }
  ],
  "presets": [{ "name": "Featured collection" }]
}
{% endschema %}
```

## Blocks

Blocks are nested within sections and individually draggable in the editor:

```json
"blocks": [
  { "type": "title",  "name": "Title",  "limit": 1 },
  { "type": "price",  "name": "Price",  "limit": 1 },
  { "type": "button", "name": "Button"             }
],
"max_blocks": 5
```

## Snippets

Snippets are reusable partials with no merchant UI — use `{% render %}`:

```liquid
{# snippets/card-product.liquid — called with: {% render 'card-product', product: product %} #}
<article class="card">
  <a href="{{ product.url }}">
    <img src="{{ product.featured_image | image_url: width: 400 }}"
         alt="{{ product.featured_image.alt | escape }}"
         width="400" height="400"
         loading="lazy">
    <h3>{{ product.title }}</h3>
    <p>{{ product.price | money }}</p>
  </a>
</article>
```

## Settings schema

`config/settings_schema.json` defines global theme settings (colours, fonts, etc.):

```json
[
  {
    "name": "Colors",
    "settings": [
      { "type": "color", "id": "color_primary", "label": "Primary", "default": "#000000" },
      { "type": "color", "id": "color_background", "label": "Background", "default": "#ffffff" }
    ]
  },
  {
    "name": "Typography",
    "settings": [
      { "type": "font_picker", "id": "type_header_font", "label": "Heading font", "default": "helvetica_n4" }
    ]
  }
]
```

Access in Liquid: `{{ settings.color_primary }}` / `{{ settings.type_header_font | font_face }}`

## Performance patterns

- **Hero image**: disable `loading="lazy"`, add `fetchpriority="high"` on LCP image
- **All other images**: `loading="lazy"` + explicit `width`/`height`
- **Image CDN**: always use `| image_url: width: 800` — never use raw `src`
- **CSS**: load section CSS via `{% stylesheet %}` (deferred per-section)
- **JS**: use `{% javascript %}` (concatenated + minified by Shopify)
- **Third-party scripts**: load via `defer` or `async`, never render-blocking

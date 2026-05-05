# Liquid Templating — Basics

Liquid is Shopify's templating language. It has three components: objects, tags, and filters.

## Objects

Output dynamic content:
```liquid
{{ product.title }}
{{ collection.description }}
{{ shop.name }}
{{ customer.first_name | default: "Guest" }}
```

## Tags

Control flow and logic (no output):

```liquid
{% if product.available %}
  <button>Add to cart</button>
{% else %}
  <p>Sold out</p>
{% endif %}

{% for product in collection.products %}
  <li>{{ product.title }}</li>
{% endfor %}

{% unless customer %}
  <a href="/account/login">Log in</a>
{% endunless %}

{% case product.type %}
  {% when "Shirt" %} ...
  {% when "Hat" %} ...
  {% else %} ...
{% endcase %}
```

## Filters

Transform output:
```liquid
{{ product.price | money }}                     {# → $29.99 #}
{{ product.title | upcase }}                    {# → SHIRT #}
{{ "hello world" | capitalize }}                {# → Hello world #}
{{ product.description | strip_html | truncate: 100 }}
{{ product.images | first | image_url: width: 800 }}
{{ product.created_at | date: "%B %d, %Y" }}
```

Common filters:

| Filter             | Use                                      |
|--------------------|------------------------------------------|
| `money`            | Format as store currency                 |
| `money_with_currency` | Format with currency code             |
| `image_url`        | Resize/format image via Shopify CDN      |
| `asset_url`        | URL to asset in `assets/` folder         |
| `link_to`          | Wrap value in `<a>` tag                  |
| `strip_html`       | Remove HTML tags                         |
| `truncate: n`      | Truncate to n chars                      |
| `default: value`   | Fallback if nil/false/empty              |
| `json`             | Output as JSON (safe for `<script>`)     |
| `metafield_tag`    | Render metafield as HTML                 |

## Render vs include

```liquid
{# CORRECT — use render (scoped, fast) #}
{% render 'card-product', product: product %}

{# DEPRECATED — avoid include (leaks variables) #}
{% include 'card-product' %}
```

## Sections and blocks

```liquid
{# In a section file (sections/featured-product.liquid) #}
{% schema %}
{
  "name": "Featured product",
  "settings": [
    { "type": "product", "id": "product", "label": "Product" }
  ],
  "blocks": [
    { "type": "title", "name": "Title", "limit": 1 },
    { "type": "price", "name": "Price", "limit": 1 }
  ],
  "presets": [{ "name": "Featured product" }]
}
{% endschema %}

{{ section.settings.product.title }}

{% for block in section.blocks %}
  {% case block.type %}
    {% when 'title' %}
      <h1 {{ block.shopify_attributes }}>{{ section.settings.product.title }}</h1>
    {% when 'price' %}
      <p {{ block.shopify_attributes }}>{{ section.settings.product.price | money }}</p>
  {% endcase %}
{% endfor %}
```

## Global objects

| Object      | Contains                                |
|-------------|-----------------------------------------|
| `shop`      | Store name, URL, currency, policies     |
| `product`   | Current product (PDP only)              |
| `collection`| Current collection (PLP only)           |
| `cart`      | Cart items, total, item count           |
| `customer`  | Logged-in customer (nil if logged out)  |
| `page`      | Current page (pages only)               |
| `blog`      | Current blog                            |
| `article`   | Current article                         |
| `request`   | Path, locale, design mode               |
| `settings`  | `config/settings_data.json` values      |

## Metafields in Liquid

```liquid
{# Access product metafield #}
{{ product.metafields.custom.care_instructions }}

{# With metafield_tag filter (renders as appropriate HTML) #}
{{ product.metafields.custom.care_instructions | metafield_tag }}
```

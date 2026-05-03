# Shopify Extensions

Extensions add UI or logic to existing Shopify surfaces without replacing them.

## Extension types

| Type                        | Surface                          | Tech stack              |
|-----------------------------|----------------------------------|-------------------------|
| Checkout UI extension       | Checkout pages                   | React + Checkout UI kit |
| Admin UI extension          | Shopify Admin UI                 | React + Polaris         |
| POS UI extension            | Point of Sale app                | React + POS UI kit      |
| Customer Account extension  | Customer account pages           | React + Customer Account UI kit |
| Theme App Extension         | Online store (Liquid)            | Liquid + JS + CSS       |
| Shopify Functions           | Backend logic (discounts, etc.)  | Rust or AssemblyScript  |
| Web Pixel extension         | Analytics/tracking               | JS sandbox              |

## Scaffold

```bash
shopify app generate extension
# follow prompts to choose extension type
```

## Checkout UI extensions

Location options (where to render):
- `purchase.checkout.block.render` — custom block anywhere in checkout
- `purchase.checkout.delivery-address.render-before` — before address form
- `purchase.checkout.payment-method-list.render-after` — after payment methods
- See full list: `shopify.extension.toml` locations

Basic React component:
```jsx
import { Banner, useCartLines } from "@shopify/ui-extensions-react/checkout";

export default function Extension() {
  const lines = useCartLines();
  return <Banner title={`${lines.length} items in your cart`} />;
}
```

## Shopify Functions

Server-side logic that runs inside Shopify's infrastructure:
- Discount functions (custom discount types)
- Delivery customisation
- Payment customisation
- Cart transforms

```bash
# Scaffold a function
shopify app generate extension --template discounts

# Build to Wasm
shopify app function build

# Test locally
shopify app function run

# Generate types from input query
shopify app function typegen
```

Function input/output are strict GraphQL schemas — always run `typegen` after `function schema`.

## Theme App Extensions

Extend theme without editing theme files:
- Liquid blocks, snippets, assets injected as a versioned extension
- Merchants can add blocks in Theme Editor
- Safe: survives theme updates

Structure:
```
extensions/my-theme-app-ext/
  blocks/
    my-block.liquid
  assets/
    my-styles.css
  snippets/
    my-snippet.liquid
  shopify.extension.toml
```

## Admin UI extensions

Use Polaris components:
```jsx
import { Page, Card, Text } from "@shopify/polaris";
```

Admin link targets:
- `admin.product-details.block.render`
- `admin.order-details.block.render`
- `admin.customers-index.action.link`

## Polaris design system

Reference: `https://polaris.shopify.com`

Use Polaris for all Admin UI extensions. Match existing Shopify Admin UX patterns — do not introduce custom design systems.

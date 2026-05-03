# Shopify Theme CLI Commands

## Init

```bash
# Clone starter theme (Dawn by default)
shopify theme init

# Clone a specific repo
shopify theme init --clone-url https://github.com/Shopify/dawn
shopify theme init --clone-url https://github.com/my-org/my-theme
```

## Development

```bash
# Start dev server — uploads theme to store, watches for changes
shopify theme dev --store=mystore.myshopify.com

# Dev with specific theme ID (edit existing theme)
shopify theme dev --store=mystore.myshopify.com --theme=<theme-id>

# Start Liquid REPL (interactive console)
shopify theme console --store=mystore.myshopify.com
```

## Lint

```bash
# Run Theme Check linter (catches Liquid errors + best practices)
shopify theme check

# Check specific files
shopify theme check sections/

# Auto-fix fixable issues
shopify theme check --auto-correct
```

## Push / Pull

```bash
# Upload local theme to store (as new unpublished theme)
shopify theme push --store=mystore.myshopify.com --unpublished

# Upload to specific theme (overwrite)
shopify theme push --store=mystore.myshopify.com --theme=<theme-id>

# Upload only specific files
shopify theme push --only sections/featured-product.liquid

# Ignore specific files during push
shopify theme push --ignore config/settings_data.json

# Download theme from store
shopify theme pull --store=mystore.myshopify.com --theme=<theme-id>

# Download only specific files
shopify theme pull --only config/settings_data.json
```

## Publish & share

```bash
# Publish an unpublished theme (makes it live)
shopify theme publish --store=mystore.myshopify.com --theme=<theme-id>

# Share as temporary preview URL (creates new unpublished theme)
shopify theme share --store=mystore.myshopify.com

# Package theme as ZIP (for Theme Store or upload)
shopify theme package
```

## Inspect & manage

```bash
# List all themes with IDs and statuses
shopify theme list --store=mystore.myshopify.com

# Get preview links for a theme
shopify theme open --store=mystore.myshopify.com --theme=<theme-id>

# Show theme environment info
shopify theme info --store=mystore.myshopify.com

# Profile Liquid rendering on a page (performance)
shopify theme profile --store=mystore.myshopify.com --url=/products/my-product

# Duplicate a theme
shopify theme duplicate --store=mystore.myshopify.com --theme=<theme-id>

# Rename a theme
shopify theme rename --store=mystore.myshopify.com --theme=<theme-id> --name="My Theme v2"

# Delete a theme
shopify theme delete --store=mystore.myshopify.com --theme=<theme-id>
```

## Metafields

```bash
# Pull metafield definitions from Shopify Admin
shopify theme metafields pull --store=mystore.myshopify.com
```

## Language Server (LSP)

```bash
# Start LSP for IDE integration (VS Code, etc.)
shopify theme language-server
```

## Recommended workflow

```bash
# 1. Pull current live theme
shopify theme pull --store=mystore.myshopify.com --theme=<live-theme-id>

# 2. Create a dev branch theme
shopify theme push --store=mystore.myshopify.com --unpublished --theme-name="Dev Branch"

# 3. Dev against it
shopify theme dev --store=mystore.myshopify.com --theme=<dev-theme-id>

# 4. Lint before push
shopify theme check

# 5. Push changes
shopify theme push --store=mystore.myshopify.com --theme=<dev-theme-id>

# 6. Preview → approve → publish
shopify theme open --store=mystore.myshopify.com --theme=<dev-theme-id>
shopify theme publish --store=mystore.myshopify.com --theme=<dev-theme-id>
```

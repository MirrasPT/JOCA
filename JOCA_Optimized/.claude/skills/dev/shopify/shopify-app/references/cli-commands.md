# Shopify App CLI Commands

## App lifecycle

```bash
# Scaffold new app
shopify app init

# Link existing app to Partner Dashboard
shopify app config link

# Pull latest config from linked app
shopify app config pull

# Validate app + extension configs
shopify app config validate

# Show app info (linked store, config, extensions)
shopify app info
```

## Development

```bash
# Start dev server — live preview on dev store
shopify app dev

# Stop dev preview
shopify app dev clean

# Pull env vars from Partners Dashboard → .env
shopify app env pull

# Show env vars that will be used on deploy
shopify app env show
```

## Extensions

```bash
# Scaffold a new extension
shopify app generate extension

# Import dashboard-managed extensions to local repo
shopify app import-extensions

# Import metafield/metaobject definitions from dev store
shopify app import-custom-data-definitions
```

## Functions

```bash
# Compile function to Wasm (for local testing)
shopify app function build

# Run function locally with test input
shopify app function run

# Replay function execution from current dir
shopify app function replay

# Show function info
shopify app function info

# Generate latest GraphQL schema for a function
shopify app function schema

# Generate TypeScript types from input query
shopify app function typegen
```

## Build & deploy

```bash
# Build (runs build script from shopify.app.toml)
shopify app build

# Build + deploy config and all extensions
shopify app deploy

# Release an existing app version
shopify app release

# List all deployed versions
shopify app versions list
```

## Webhooks & logging

```bash
# Trigger a sample webhook payload delivery (for testing)
shopify app webhook trigger

# Stream real-time logs from app + store
shopify app logs

# List loggable source names (filter logs)
shopify app logs sources
```

## Admin API — direct execution

```bash
# Run a GraphQL query/mutation on a store
shopify app execute graphql --query myquery.graphql

# Run as bulk operation
shopify app bulk execute --query mymutation.graphql

# Cancel running bulk operation
shopify app bulk cancel --operation-id=<id>

# Check bulk status (or list all)
shopify app bulk status
```

## Config

```bash
# Set default config for CLI commands
shopify app config use <config-file>
```

## Env vars (CLI behaviour)

| Variable                   | Effect                              |
|----------------------------|-------------------------------------|
| `SHOPIFY_HTTP_PROXY`       | Route traffic through HTTP proxy    |
| `SHOPIFY_HTTPS_PROXY`      | Route traffic through HTTPS proxy   |
| `SHOPIFY_CLI_NO_ANALYTICS=1` | Disable usage analytics           |

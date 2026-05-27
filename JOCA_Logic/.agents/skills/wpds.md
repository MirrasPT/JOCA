---
name: wpds
description: "Building UIs with the WordPress Design System (WPDS): components, tokens, patterns. MUST be invoked when the user mentions: UIs, WordPress Design System, WPDS."
compatibility: "Requires WPDS MCP server configured and running. Targets WordPress 6.9+ (PHP 7.2.24+)."
---

# WordPress Design System (WPDS)

## Prerequisites

Works best with the **WPDS MCP server** installed. The MCP provides access to WPDS documentation: components, token lists, patterns.

Synonyms: "WordPress"/"WP", "Design System"/"DS", "WordPress Design System"/"WPDS".

## When to use

- Building or reviewing UI in a WordPress context (Gutenberg, WooCommerce, WordPress.com, Jetpack, etc.)
- WordPress Design System, WPDS, Design System
- UI components, design tokens, color primitives, spacing scales, typography variables/presets
- Specific packages: @wordpress/components, @wordpress/ui

## Rules

### Use the WPDS MCP server for documentation

- Retrieve canonical documentation from the WPDS MCP:
  - Reference site (`wpds://pages`)
  - Available components (`wpds://components`) and details (`wpds://components/:name`)
  - Available tokens (`wpds://design-tokens`)
- DO NOT search the web for canonical WPDS documentation. If asked, push back and warn that the MCP server is the authoritative source.

### Required documentation

Read relevant reference site documentation before any WPDS task. This documentation takes absolute precedence when evaluating the best approach.

### Boundaries

- Skip non-UI aspects (data fetching from stores, string localization).
- Focus on UI that adheres to WPDS best practices using the most fitting components/tokens/patterns.

### Tech stack

Unless told otherwise or gathered from local context, assume: TypeScript, React, CSS.

### Validation

If the local context provides lint scripts, use them to validate proposed code output.

## Output

- Recap at end: concise explanation of the solution and rationale for each decision.
- State what was explicitly excluded as non-UI-related.
- Provide working code snippets.

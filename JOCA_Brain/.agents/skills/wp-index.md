---
name: wp-index
origin: local
description: "Single entry point for ANY WordPress work — routes to the right wp-* skill (repo triage, Gutenberg blocks/block.json, block themes/theme.json, Interactivity API, plugins and WP.org submission, WP REST API, Abilities API, WP-CLI and ops/migrations, runtime performance and code review, PHPStan on WP, Playground, WPDS design system) and to WooCommerce+Elementor. Invoke at the first sign of WordPress: WP site, wp-content, plugin, theme, Gutenberg, WP-CLI, wp-admin."
triggers: wordpress, wp, wp-content, wp-admin, wp plugin, wp theme, gutenberg, gutenberg block, block.json, theme.json, block theme, wp-cli, wp search-replace, wp db, wordpress rest api, register_rest_route, interactivity api, data-wp-, wp-env, wordpress playground, phpstan wordpress, wordpress slow, wordpress performance, wpds, elementor
chain: wp-project-triage, wordpress-router
---

# WP Index — WordPress routing

## Entry rule

**Any WordPress work goes through here first.** This skill **executes nothing** — it only
routes. After picking the destination: `Read(".claude/skills/<name>.md")` and notify
`[skill: <name>]`. If the request covers ≥2 independent destinations, dispatch the matching
`<skill>-agent`s in the same turn (`rules/task-intake.md`).

Do not pick blind: with a repo in front of you and an ambiguous route, run the **triage** first (see
below) — it is the repo classification that disambiguates plugin vs theme vs site.

## Execution order

1. **`wp-project-triage`** — whenever there is a repo and the route is not obvious. Determines kind
   (plugin/theme/block theme/core/full site), tooling, versions, tests.
2. **`wordpress-router`** — classification + guardrails + route; and it is the one that has the
   **content migration** pipeline local→staging over FTP (no SSH/WP-CLI), already validated end-to-end.
3. Domain skill(s) from the table.
4. Gate before delivering: `wp-phpstan` (PHP) and/or `wp-playground` (reproduce on a clean WP).

## Routing table

| Signal in the request / in the repo | Skill | What it does |
|---|---|---|
| "what WP project is this", first contact, `wp-content/`, `style.css`, `composer.json` at the root | `wp-project-triage` | Deterministic inspection of the repo → JSON with `project.kind`, `signals`, `tooling`. Run before changing code |
| Classify + pick a route; migrate content local→staging, `.wpress`, All-in-One WP Migration, shared hosting without SSH | `wordpress-router` | Classifies the repo and routes; has its own section with the migration pipeline (export UI → FTP → restore → URL fix → purge caches) |
| `block.json`, "invalid block / not saving", attributes not persisting, `render.php`/`render_callback`, `deprecated`, `@wordpress/create-block`, `@wordpress/scripts`, apiVersion 3 | `wp-block-development` | Create/update Gutenberg blocks: metadata, attribute serialization, dynamic render, deprecations, build |
| `theme.json`, `templates/*.html`, `parts/*.html`, `patterns/*.php`, `styles/*.json`, Site Editor, "the styles don't apply" | `wp-block-themes` | Block themes: presets/settings/styles, templates and parts, patterns, style variations, style hierarchy |
| `data-wp-interactive`, `data-wp-on--*`, `data-wp-bind--*`, `data-wp-context`, `viewScriptModule`, `@wordpress/interactivity`, "the directives don't fire" | `wp-interactivity-api` | Interactivity API: store/state/actions, SSR of the directives, hydration, integration with the block |
| `Plugin Name:` header, hooks/actions/filters, activation/uninstall, Settings API, nonces/capabilities/escaping, wp-cron, package a release | `wp-plugin-development` | Plugin architecture: bootstrap, hook loader, options/admin, security, packaging |
| Submit to WP.org, GPL, license header, name/trademark, trialware/upsell/freemium, embedded third-party code | `wp-plugin-directory-guidelines` | Review against the 18 Plugin Directory guidelines: licensing, naming, trialware, GPL compatibility |
| `register_rest_route`, `WP_REST_Controller`, `rest_api_init`, `show_in_rest`, `rest_base`, 401/403/404 in REST, meta/CPT in the response | `wp-rest-api` | Create/extend/debug WP REST endpoints: schema and arg validation, permissions/nonces, links and pagination |
| `wp_register_ability`, `wp_register_ability_category`, `wp-abilities/v1`, `@wordpress/abilities`, "the ability doesn't show up" | `wp-abilities-api` | Register, expose over REST and consume Abilities (WP 6.9+) |
| `wp search-replace`, `wp db export/import`, domain migration, `wp plugin/theme/user`, `wp cron`, multisite `--url`/`--network`, `wp-cli.yml` | `wp-wpcli-and-ops` | WP-CLI operations with blast-radius guardrails (environment, targeting, backup before writing) |
| Site/admin/REST **slow right now**, high TTFB, `wp profile`/`wp doctor`, autoloaded options, object cache, WP-Cron, remote HTTP calls | `wp-performance` | Backend-only runtime diagnosis: baseline, profiling, cache, queries. No browser |
| Review **code** looking for anti-patterns: `query_posts()`, `posts_per_page => -1`, `session_start()`, `update_option` on the frontend, `wp_remote_*` without cache, before a traffic spike | `wp-performance-review` | Static analysis by file type with severity + line number. Commands `/wp-perf` (quick) and `/wp-perf-review` (full) |
| `phpstan.neon`, `phpstan-baseline.neon`, core stubs, type errors in hooks/REST/`$wpdb`, third-party plugin classes | `wp-phpstan` | Configure/run/fix PHPStan on WP: stubs, baseline, WordPress-friendly PHPDoc, narrow ignores |
| Throwaway WP to test with, blueprint JSON, `@wp-playground/cli`, `--auto-mount`, swap WP/PHP version, snapshot, isolated Xdebug | `wp-playground` | Ephemeral WP instances (WASM+SQLite) to reproduce bugs, test a plugin/theme and run blueprints |
| Write/edit/review the blueprint **JSON** itself: `blueprint.json`, `run-blueprint`, Playground steps | `blueprint` | Authoring Playground blueprints. Natural pair of `wp-playground` (which runs the instance; this one describes it) |
| UI in a WordPress context: `@wordpress/components`, `@wordpress/ui`, color/spacing/typography tokens, Gutenberg/Woo/Jetpack UI patterns | `wpds` | WordPress Design System via the WPDS MCP (canonical source — do not search the web). ⚠ requires the MCP configured |
| **(adjacent, not `wp-*`)** Elementor, `_elementor_data`, Hello Elementor, HFE, WPForms, `content-product.php`, editable WooCommerce store | `woocommerce-elementor` | Build a Woo + Elementor Free store programmatically: `_elementor_data` import, child theme, template overrides |

## Frequent combinations

- **New block** → `wp-block-development` → `wp-interactivity-api` (if it has frontend interaction) → `wp-phpstan` before delivering; reproduce in `wp-playground`.
- **Publish a plugin on WP.org** → `wp-plugin-development` → `wp-plugin-directory-guidelines` (license/naming/trialware before submission).
- **"The site is slow"** → `wp-performance` to measure at runtime and locate the culprit → `wp-performance-review` to review that culprit's code. The two do not replace each other.
- **Domain change / taking content to staging** → `wordpress-router` (§ Content migration) when there is no SSH; `wp-wpcli-and-ops` (`wp search-replace`) when there is.
- **WooCommerce store** → `wp-project-triage` → `woocommerce-elementor`; post-restore of a migration, `wordpress-router` already points there.

---
name: wp-interactivity-api
description: "Building or debugging WordPress Interactivity API features (data-wp-* directives, @wordpress/interactivity store/state/actions, block viewScriptModule integration. MUST be invoked when the user mentions: WordPress Interactivity API."
compatibility: "WordPress 6.9+ (PHP 7.2.24+). Filesystem agent with bash + node. Some workflows need WP-CLI."
---

# WP Interactivity API

## When to use

- Interactivity API, `@wordpress/interactivity`
- `data-wp-interactive`, `data-wp-on--*`, `data-wp-bind--*`, `data-wp-context`
- Block `viewScriptModule` / module-based view scripts
- Hydration issues or "directives don't fire"

## Inputs required

- Repo root + triage output (`wp-project-triage`).
- Affected surfaces (frontend, editor, both).
- Constraints: WP version, module support in build.

## Procedure

### 1) Detect existing usage + integration style

Search for: `data-wp-interactive`, `@wordpress/interactivity`, `viewScriptModule`.

Determine:
- Block providing interactivity via `block.json` view script module?
- Theme-level interactivity?
- Plugin-side "enhance existing markup" usage?

For new interactive blocks, prefer the official scaffold: `@wordpress/create-block-interactive-template`.

### 2) Identify the store(s)

Locate store definitions and confirm: state shape, actions (mutations), callbacks/handlers used by `data-wp-on--*`.

### 3) Server-side rendering (best practice)

**Pre-render HTML on the server** to ensure:
- Correct initial state before JavaScript loads (no layout shift).
- SEO benefits and faster perceived load.
- Seamless client-side hydration.

#### Enable server directive processing

For `block.json` components, add `supports.interactivity`:

```json
{
  "supports": {
    "interactivity": true
  }
}
```

For themes/plugins without `block.json`, use `wp_interactivity_process_directives()`.

#### Initialize state/context in PHP

Use `wp_interactivity_state()` for initial global state:

```php
wp_interactivity_state( 'myPlugin', array(
  'items'    => array( 'Apple', 'Banana', 'Cherry' ),
  'hasItems' => true,
));
```

For local context, use `wp_interactivity_data_wp_context()`:

```php
<?php
$context = array( 'isOpen' => false );
?>
<div <?php echo wp_interactivity_data_wp_context( $context ); ?>>
  ...
</div>
```

#### Define derived state in PHP

When derived state affects initial HTML, replicate logic in PHP:

```php
wp_interactivity_state( 'myPlugin', array(
  'items'    => array( 'Apple', 'Banana' ),
  'hasItems' => function() {
    $state = wp_interactivity_state();
    return count( $state['items'] ) > 0;
  }
));
```

Ensures directives like `data-wp-bind--hidden="!state.hasItems"` render correctly on first load.

### 4) Implement or change directives safely

- Keep directive usage minimal and scoped.
- Prefer stable data attributes mapping clearly to store state.
- Ensure server-rendered markup and client hydration align.

**WordPress 6.9 changes:**

- **`data-wp-ignore` deprecated** -- broke context inheritance and client-side navigation. Avoid it.
- **Unique directive IDs**: Multiple same-type directives per element via `---` separator (e.g., `data-wp-on--click---plugin-a="..."` and `data-wp-on--click---plugin-b="..."`).
- **New TypeScript types**: `AsyncAction<ReturnType>` and `TypeYield<T>` for async action typing.

### 5) Build/tooling alignment

Verify module build path support:
- `@wordpress/scripts` -> prefer its conventions.
- Custom bundling -> confirm module output is supported.

### 6) Debug common failure modes

If "nothing happens" on interaction:
- Confirm `viewScriptModule` is enqueued/loaded.
- Confirm DOM element has `data-wp-interactive`.
- Confirm store namespace matches directive value.
- Confirm no JS errors before hydration.

## Verification

- `wp-project-triage` shows `signals.usesInteractivityApi: true` after change.
- Smoke test: directive triggers and state updates work as expected.
- If tests exist: add/extend Playwright E2E for the interaction path.

## Failure modes / debugging

- **Directives present but inert**: view script not loading, wrong module entrypoint, or missing `data-wp-interactive`.
- **Hydration mismatch / flicker**: server markup differs from client expectations. Simplify or align initial state. Derived state not defined in PHP -- use `wp_interactivity_state()` with closures.
- **Initial content missing/wrong**: `supports.interactivity` not set in `block.json` (blocks), or `wp_interactivity_process_directives()` not called (themes/plugins), or state/context not initialized in PHP before render.
- **Layout shift on load**: derived state like `state.hasItems` missing on server, causing `hidden` attribute absence.
- **Performance regressions**: overly broad interactive roots. Scope interactivity to smaller subtrees.
- **Client-side navigation (WP 6.9)**: `getServerState()` and `getServerContext()` reset between page transitions -- don't assume stale values persist. Router regions now support `attachTo` for dynamic overlays (modals, pop-ups).

## Escalation

- If build constraints unclear, ask: "Using `@wordpress/scripts` or custom bundler (webpack/vite)?"

---
name: wp-rest-api
description: "Building, extending, or debugging WordPress REST API endpoints/routes: register_rest_route, WP_REST_Controller/controller classes, schema/argument validation. MUST be invoked when the user mentions: WordPress REST API, CPTs."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP REST API

## When to use

- Create or update REST routes/endpoints
- Debug 401/403/404 errors or permission/nonce issues
- Add custom fields/meta to REST responses
- Expose CPTs or taxonomies via REST
- Implement schema + argument validation
- Adjust response links/embedding/pagination

## Inputs required

- Repo root + target plugin/theme/mu-plugin (path to entrypoint).
- Desired namespace + version (e.g. `my-plugin/v1`) and routes.
- Auth mode (cookie + nonce vs application passwords vs auth plugin).
- Target WordPress version constraints (if below 6.9, call out).

## Procedure

### 0) Triage and locate REST usage

1. Run triage:
   - Read(".claude/skills/wp-project-triage.md") e fazer o triage manualmente (o script não existe nesta instalação).
2. Search for existing REST usage:
   - `register_rest_route`
   - `WP_REST_Controller`
   - `rest_api_init`
   - `show_in_rest`, `rest_base`, `rest_controller_class`

For full site repos, pick the specific plugin/theme before changing code.

### 1) Choose the right approach

- **Expose CPT/taxonomy in `wp/v2`:**
  - Set `show_in_rest => true` + `rest_base` if needed.
  - Optionally provide `rest_controller_class`.
- **Custom endpoints:**
  - Use `register_rest_route()` on `rest_api_init`.
  - Prefer a controller class (`WP_REST_Controller` subclass) for non-trivial cases.

### 2) Register routes safely (namespaces, methods, permissions)

- Use unique namespace `vendor/v1`; avoid `wp/*` unless core.
- Always provide `permission_callback` (use `__return_true` for public endpoints).
- Use `WP_REST_Server::READABLE/CREATABLE/EDITABLE/DELETABLE` constants.
- Return data via `rest_ensure_response()` or `WP_REST_Response`.
- Return errors via `WP_Error` with explicit `status`.

### 3) Validate/sanitize request args

- Define `args` with `type`, `default`, `required`, `validate_callback`, `sanitize_callback`.
- Prefer JSON Schema validation with `rest_validate_value_from_schema` then `rest_sanitize_value_from_schema`.
- Never read `$_GET`/`$_POST` directly; use `WP_REST_Request`.

### 4) Responses, fields, and links

- Never remove core fields from default endpoints; add fields instead.
- Use `register_rest_field` for computed fields; `register_meta` with `show_in_rest` for meta.
- For `object`/`array` meta, define schema in `show_in_rest.schema`.
- For unfiltered post content (e.g., ToC plugins injecting HTML), request `?context=edit` to access `content.raw` (auth required). Pair with `_fields=content.raw` to keep responses small.
- Add related resource links via `WP_REST_Response::add_link()`.

### 5) Authentication and authorization

- For wp-admin/JS: cookie auth + `X-WP-Nonce` (action `wp_rest`).
- For external clients: application passwords (basic auth) or auth plugin.
- Use capability checks in `permission_callback` (authorization), not just "logged in".

### 6) Client-facing behavior (discovery, pagination, embeds)

- Ensure discovery works (`Link` header or `<link rel="https://api.w.org/">`).
- Support `_fields`, `_embed`, `_method`, `_envelope`, pagination headers.
- `per_page` capped at 100.

## Verification

- `/wp-json/` index includes your namespace.
- `OPTIONS` on your route returns schema (when provided).
- Endpoint returns expected data; permission failures return 401/403.
- CPT/taxonomy routes appear under `wp/v2` when `show_in_rest` is true.
- Run repo lint/tests and any PHP/JS build steps.

## Failure modes / debugging

- 404: `rest_api_init` not firing, route typo, or permalinks off (use `?rest_route=`).
- 401/403: missing nonce/auth, or `permission_callback` too strict.
- `_doing_it_wrong` for missing `permission_callback`: add it (use `__return_true` if public).
- Invalid params: missing/incorrect `args` schema or validation callbacks.
- Fields missing: `show_in_rest` false, meta not registered, or CPT lacks `custom-fields` support.

## Escalation

If version support or behavior is unclear, consult the REST API Handbook and core docs before inventing patterns.

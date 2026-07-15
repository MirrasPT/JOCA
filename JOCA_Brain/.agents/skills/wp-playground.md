---
name: wp-playground
description: "WordPress Playground workflows: fast disposable WP instances in the browser or locally via @wp-playground/cli (server, run-blueprint, build-snapshot), auto-mounting. MUST be invoked when the user mentions: WordPress Playground, WP, PHP, Xdebug."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Playground CLI requires Node.js 20.18+; runs WP in WebAssembly with SQLite."
---

# WordPress Playground

## When to use

- Spin up disposable WordPress to test plugin/theme without full stack.
- Run or iterate on Playground Blueprints (JSON) locally.
- Build reproducible snapshot for sharing or CI.
- Switch WP/PHP versions to reproduce issues.
- Debug plugin/theme code with Xdebug in isolated Playground.

## Inputs required

- Node.js >= 20.18, `npm`/`npx` available.
- Project path to mount (`--auto-mount` or explicit mapping).
- Desired WP/PHP version (optional; defaults to latest WP, PHP 8.3).
- Blueprint location/URL if running a blueprint.
- Port preference if 9400 conflicts.
- Whether Xdebug is needed.

## Procedure

### 0) Guardrails

- Playground instances are ephemeral and SQLite-backed; **never** point at production data.
- Confirm Node >= 20.18 (`node -v`) before running CLI.
- If mounting local code, ensure no secrets are present; Playground copies files into in-memory FS.

### 1) Quick local spin-up (auto-mount)

```bash
cd <plugin-or-theme-root>
npx @wp-playground/cli@latest server --auto-mount
```
- Opens http://localhost:9400 by default. Auto-detects plugin/theme and installs it.
- Add `--wp=<version>` / `--php=<version>` as needed.
- For existing full installs, add `--skip-wordpress-setup` and mount the whole tree.

### 2) Manual mounts or multiple mounts

- Use `--mount=/host/path:/vfs/path` (repeatable) for multi-plugin, mu-plugins, or custom content.
- Use `--mount-before-install` for bootstrapping installer flows.

### 3) Run a Blueprint (no server needed)

```bash
npx @wp-playground/cli@latest run-blueprint --blueprint=<file-or-url>
```
- For scripted setup/CI validation. Supports remote URLs and local files.
- Allow bundled assets with `--blueprint-may-read-adjacent-files` when required.

### 4) Build a snapshot for sharing

```bash
npx @wp-playground/cli@latest build-snapshot --blueprint=<file> --outfile=./site.zip
```
- Produces a ZIP loadable in Playground or attachable to bug reports.

### 5) Debugging with Xdebug

- Start with `--xdebug` (or `--enable-xdebug` depending on CLI release) to expose an IDE key, then connect VS Code/PhpStorm to host/port shown in CLI output.
- Combine with `--auto-mount` for plugin/theme debugging.

### 6) Version switching

- Use `--wp=` to pin WP (e.g. 6.9.0) and `--php=` to test compatibility.
- If feature depends on Gutenberg trunk, prefer latest WP release plus plugin; Playground images track stable WP plus bundled Gutenberg.

### 7) Browser-only workflows (no CLI)

- Launch previews with URL fragments or query params:
  - Fragment: `https://playground.wordpress.net/#<base64-or-json-blueprint>`
  - Query: `https://playground.wordpress.net/?blueprint-url=<public-url-or-zip>`
- Use the live Blueprint Editor (playground.wordpress.net) to author blueprints with schema help; paste JSON and copy shareable link.

## Verification

- Confirm mounted code is active (plugin listed/active; theme selected).
- For blueprints/snapshots, re-run with `--verbosity=debug` to confirm steps executed.
- Run targeted smoke (e.g. `wp plugin list` inside Playground shell) or UI click-path.

## Failure modes / debugging

- **CLI exits complaining about Node**: upgrade to >= 20.18.
- **Mount not applied**: check path, use absolute path, add `--verbosity=debug`.
- **Blueprint cannot read local assets**: add `--blueprint-may-read-adjacent-files`.
- **Port conflict**: `--port=<free-port>`.
- **Slow/locked UI**: disable `--experimental-multi-worker` if enabled; or enable it for CPU-bound runs.

## Escalation

- PHP extensions or native DB access required: Playground may be unsuitable; fall back to wp-env/Docker.
- Browser-only embedding or VS Code extension specifics: consult upstream docs at https://wordpress.github.io/wordpress-playground/

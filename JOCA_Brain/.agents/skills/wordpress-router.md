---
name: wordpress-router
description: "Classify a WordPress repo (plugin/theme/block theme/core/site) and route to the right wp-* skill. Invoke at the start of any WordPress task."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
triggers: WordPress, WP, wp-content, WP plugin, WP theme, what kind of WordPress project, migrate WordPress, wpress, ai1wm, All-in-One WP Migration, take WP content to staging
---

# WordPress Router

## When to use

Activate at the start of WordPress tasks to:

- classify the codebase (plugin vs theme vs block theme vs core checkout vs full site),
- select the right workflow and guardrails,
- delegate to the relevant domain skill(s).

## Inputs required

- Repo root (cwd).
- User intent (desired change) and constraints (WP version targets, WP.com specifics, release needs).

## Procedure

1. Triage the repo:
   - Read(".claude/skills/wp-project-triage.md") and do the triage by hand (the script does not exist in this installation).
2. Read output and classify:
   - primary project kind(s),
   - available tooling (PHP/Composer, Node, @wordpress/scripts),
   - tests present (PHPUnit, Playwright, wp-env),
   - version hints.
3. Route to domain workflows based on intent + repo kind.
4. Apply guardrails before changes:
   - Confirm version constraints if unclear.
   - Prefer the repo's existing tooling and conventions for builds/tests.

## Verification

- Re-run triage script after creating or restructuring significant files.
- Run the repo's lint/test/build commands recommended by triage output.

## Failure modes / debugging

- Triage reports `kind: unknown` -- inspect:
  - root `composer.json`, `package.json`, `style.css`, `block.json`, `theme.json`, `wp-content/`.
- Huge repo -- narrow scanning scope or add ignore rules to triage script.

## Content migration (local → shared hosting, no SSH/WP-CLI)

Route for when the request is "take the content from local/Docker to staging/production" on shared
hosting (no SSH, no WP-CLI). Pipeline validated end-to-end (2026-07-17) and reusable — the same FTP
account hosts ≥8 WP sites:

1. **Export** — All-in-One WP Migration, "Export to File" button **in the UI**. The free version's CLI
   is *gated*; the modified S3 extension, when out-of-date, **truncates the backup silently**. Validate
   the `.wpress` by comparing its **size with the original's**, not by inspecting the zeros at the end of the file.
2. **Upload** — FTP the `.wpress` to `wp-content/ai1wm-backups/`. These hosts' certificates
   force `curl -k --ftp-ssl-control` (without those two flags the upload fails at the handshake).
3. **Restore** — from wp-admin. The ⋮ menu on the backup list is hover-hidden → in automation, click
   with native JS on `a.ai1wm-backup-restore[data-archive]` (a synthetic click on the ⋮ does not open it).
4. **Post-restore** — the restore **also replaces the admin user** (reset the password). If the site
   lives in a subfolder, fix the root-relative URLs in **4 formats**: `/wp-content`, escaped in
   JSON (`\/wp-content`), URL-encoded (`%2Fwp-content`) and absolute (`https://<host>/wp-content`).
   Use **idempotent** `str_replace`, never regex.
5. **Caches that mask the DB fixes** — clear `_elementor_element_cache` (not just `_elementor_css`)
   and purge LSCache (PHP that emits `header('X-LiteSpeed-Purge: *')`). Without this, a correct
   fix in the database **appears to have no effect** and leads to "fixing" what was already right.

Detail on Elementor/WooCommerce post-restore → `Read(".claude/skills/woocommerce-elementor.md")`.

## Escalation

- Ambiguous routing -- ask one question:
  - "Is this a WordPress plugin, a theme (classic/block), or a full site repo?"

---
name: wordpress-router
description: "Classify a WordPress repo (plugin/theme/block theme/core/site) and route to the right wp-* skill. Invoke at the start of any WordPress task."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
triggers: WordPress, WP, wp-content, plugin WP, tema WP, que tipo de projecto WordPress, migrar WordPress, wpress, ai1wm, All-in-One WP Migration, levar conteudo WP para staging
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

1. Triage do repo:
   - Read(".claude/skills/wp-project-triage.md") e fazer o triage manualmente (o script não existe nesta instalação).
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

## Migração de conteúdo (local → shared hosting, sem SSH/WP-CLI)

Rota para quando o pedido é "levar o conteúdo do local/Docker para staging/produção" num alojamento
partilhado (sem SSH nem WP-CLI). Pipeline validado ponta-a-ponta (2026-07-17) e reutilizável — a
mesma conta FTP aloja ≥8 sites WP:

1. **Export** — All-in-One WP Migration, botão "Export to File" **na UI**. A CLI da versão free está
   *gated*; a extensão S3 modificada, quando out-of-date, **trunca o backup em silêncio**. Validar o
   `.wpress` comparando o **tamanho com o do original**, não por inspeccionar os zeros no fim do ficheiro.
2. **Upload** — FTP do `.wpress` para `wp-content/ai1wm-backups/`. Os certificados destes hosts
   obrigam a `curl -k --ftp-ssl-control` (sem estas duas flags o upload falha no handshake).
3. **Restore** — pela wp-admin. O menu ⋮ da lista de backups é hover-hidden → em automação, clicar
   por JS nativo em `a.ai1wm-backup-restore[data-archive]` (um click sintético no ⋮ não abre).
4. **Pós-restore** — o restore **substitui também o utilizador admin** (repor a password). Se o site
   vive numa subpasta, corrigir os URLs root-relative em **4 formatos**: `/wp-content`, escapado em
   JSON (`\/wp-content`), URL-encoded (`%2Fwp-content`) e absoluto (`https://<host>/wp-content`).
   Usar `str_replace` **idempotente**, nunca regex.
5. **Caches que mascaram os fixes de BD** — limpar `_elementor_element_cache` (não só `_elementor_css`)
   e purgar o LSCache (PHP que emita `header('X-LiteSpeed-Purge: *')`). Sem isto, uma correcção
   correcta na base de dados **parece não ter efeito** e leva a "corrigir" o que já estava certo.

Detalhe de Elementor/WooCommerce pós-restore → `Read(".claude/skills/woocommerce-elementor.md")`.

## Escalation

- Ambiguous routing -- ask one question:
  - "Is this a WordPress plugin, a theme (classic/block), or a full site repo?"

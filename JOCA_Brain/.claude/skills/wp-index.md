---
name: wp-index
origin: local
description: "Porta única de entrada para QUALQUER trabalho em WordPress — encaminha para a skill wp-* certa (triagem do repo, blocos Gutenberg/block.json, block themes/theme.json, Interactivity API, plugins e submissão ao WP.org, REST API do WP, Abilities API, WP-CLI e ops/migrações, performance em runtime e review de código, PHPStan em WP, Playground, design system WPDS) e para WooCommerce+Elementor. Invocar ao primeiro sinal de WordPress: site WP, wp-content, plugin, tema, Gutenberg, WP-CLI, wp-admin."
triggers: wordpress, wp, wp-content, wp-admin, plugin wp, tema wp, gutenberg, bloco gutenberg, block.json, theme.json, block theme, wp-cli, wp search-replace, wp db, rest api wordpress, register_rest_route, interactivity api, data-wp-, wp-env, wordpress playground, phpstan wordpress, wordpress lento, performance wordpress, wpds, elementor
chain: wp-project-triage, wordpress-router
---

# WP Index — routing de WordPress

## Regra de entrada

**Qualquer trabalho de WordPress passa por aqui primeiro.** Esta skill **não executa nada** — só
encaminha. Depois de escolher o destino: `Read(".claude/skills/<nome>.md")` e notificar
`[skill: <nome>]`. Se o pedido cobrir ≥2 destinos independentes, despachar os `<skill>-agent`
correspondentes no mesmo turno (`rules/task-intake.md`).

Não escolher às cegas: com repo à frente e rota ambígua, corre o **triage** primeiro (ver abaixo) —
é a classificação do repo que desambigua plugin vs tema vs site.

## Ordem de execução

1. **`wp-project-triage`** — sempre que houver repo e a rota não for óbvia. Determina kind
   (plugin/tema/block theme/core/full site), tooling, versões, testes.
2. **`wordpress-router`** — classificação + guardrails + rota; e é ele que tem o pipeline de
   **migração de conteúdo** local→staging por FTP (sem SSH/WP-CLI), já validado ponta-a-ponta.
3. Skill(s) de domínio da tabela.
4. Gate antes de entregar: `wp-phpstan` (PHP) e/ou `wp-playground` (reproduzir num WP limpo).

## Tabela de routing

| Sinal no pedido / no repo | Skill | O que faz |
|---|---|---|
| "que projecto WP é este", primeiro contacto, `wp-content/`, `style.css`, `composer.json` na raiz | `wp-project-triage` | Inspecção determinística do repo → JSON com `project.kind`, `signals`, `tooling`. Correr antes de mudar código |
| Classificar + escolher rota; migrar conteúdo local→staging, `.wpress`, All-in-One WP Migration, alojamento partilhado sem SSH | `wordpress-router` | Classifica o repo e encaminha; secção própria com o pipeline de migração (export UI → FTP → restore → fix de URLs → purgar caches) |
| `block.json`, "bloco inválido / não guarda", atributos não persistem, `render.php`/`render_callback`, `deprecated`, `@wordpress/create-block`, `@wordpress/scripts`, apiVersion 3 | `wp-block-development` | Criar/actualizar blocos Gutenberg: metadata, serialização de atributos, render dinâmico, deprecations, build |
| `theme.json`, `templates/*.html`, `parts/*.html`, `patterns/*.php`, `styles/*.json`, Site Editor, "os estilos não aplicam" | `wp-block-themes` | Block themes: presets/settings/styles, templates e partes, patterns, style variations, hierarquia de estilos |
| `data-wp-interactive`, `data-wp-on--*`, `data-wp-bind--*`, `data-wp-context`, `viewScriptModule`, `@wordpress/interactivity`, "as directivas não disparam" | `wp-interactivity-api` | Interactivity API: store/state/actions, SSR das directivas, hidratação, integração com o bloco |
| Header `Plugin Name:`, hooks/actions/filters, activation/uninstall, Settings API, nonces/capabilities/escaping, wp-cron, empacotar release | `wp-plugin-development` | Arquitectura de plugin: bootstrap, loader de hooks, opções/admin, segurança, packaging |
| Submeter ao WP.org, GPL, cabeçalho de licença, nome/marca, trialware/upsell/freemium, código de terceiros embebido | `wp-plugin-directory-guidelines` | Review contra as 18 guidelines do Plugin Directory: licenciamento, naming, trialware, compatibilidade GPL |
| `register_rest_route`, `WP_REST_Controller`, `rest_api_init`, `show_in_rest`, `rest_base`, 401/403/404 em REST, meta/CPT na resposta | `wp-rest-api` | Criar/estender/depurar endpoints REST do WP: schema e validação de args, permissões/nonces, links e paginação |
| `wp_register_ability`, `wp_register_ability_category`, `wp-abilities/v1`, `@wordpress/abilities`, "a ability não aparece" | `wp-abilities-api` | Registar, expor por REST e consumir Abilities (WP 6.9+) |
| `wp search-replace`, `wp db export/import`, migração de domínio, `wp plugin/theme/user`, `wp cron`, multisite `--url`/`--network`, `wp-cli.yml` | `wp-wpcli-and-ops` | Operações WP-CLI com guardrails de blast radius (ambiente, targeting, backup antes de escrever) |
| Site/admin/REST **lento agora**, TTFB alto, `wp profile`/`wp doctor`, autoloaded options, object cache, WP-Cron, chamadas HTTP remotas | `wp-performance` | Diagnóstico de runtime backend-only: baseline, profiling, cache, queries. Sem browser |
| Rever **código** à procura de anti-padrões: `query_posts()`, `posts_per_page => -1`, `session_start()`, `update_option` no frontend, `wp_remote_*` sem cache, antes de pico de tráfego | `wp-performance-review` | Análise estática por tipo de ficheiro com severidade + nº de linha. Comandos `/wp-perf` (rápido) e `/wp-perf-review` (completo) |
| `phpstan.neon`, `phpstan-baseline.neon`, stubs de core, erros de tipo em hooks/REST/`$wpdb`, classes de plugins terceiros | `wp-phpstan` | Configurar/correr/corrigir PHPStan em WP: stubs, baseline, PHPDoc WordPress-friendly, ignores estreitos |
| WP descartável para testar, blueprint JSON, `@wp-playground/cli`, `--auto-mount`, trocar versão WP/PHP, snapshot, Xdebug isolado | `wp-playground` | Instâncias WP efémeras (WASM+SQLite) para reproduzir bugs, testar plugin/tema e correr blueprints |
| Escrever/editar/rever o **JSON** do blueprint em si: `blueprint.json`, `run-blueprint`, steps do Playground | `blueprint` | Autoria de blueprints do Playground. Par natural do `wp-playground` (que corre a instância; este descreve-a) |
| UI em contexto WordPress: `@wordpress/components`, `@wordpress/ui`, tokens de cor/spacing/tipografia, padrões de UI do Gutenberg/Woo/Jetpack | `wpds` | WordPress Design System via MCP WPDS (fonte canónica — não pesquisar na web). ⚠ requer o MCP configurado |
| **(adjacente, não `wp-*`)** Elementor, `_elementor_data`, Hello Elementor, HFE, WPForms, `content-product.php`, loja WooCommerce editável | `woocommerce-elementor` | Construir loja Woo + Elementor Free programaticamente: import de `_elementor_data`, child theme, overrides de template |

## Combinações frequentes

- **Bloco novo** → `wp-block-development` → `wp-interactivity-api` (se tiver interacção no frontend) → `wp-phpstan` antes de entregar; reproduzir em `wp-playground`.
- **Publicar plugin no WP.org** → `wp-plugin-development` → `wp-plugin-directory-guidelines` (licença/naming/trialware antes da submissão).
- **"O site está lento"** → `wp-performance` para medir em runtime e localizar o culpado → `wp-performance-review` para rever o código desse culpado. As duas não se substituem.
- **Mudança de domínio / levar conteúdo para staging** → `wordpress-router` (§ Migração de conteúdo) quando não há SSH; `wp-wpcli-and-ops` (`wp search-replace`) quando há.
- **Loja WooCommerce** → `wp-project-triage` → `woocommerce-elementor`; pós-restore de migração, o `wordpress-router` já aponta para lá.

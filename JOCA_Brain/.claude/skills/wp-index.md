---
name: wp-index
origin: local
description: "Porta única de entrada para QUALQUER trabalho em WordPress — classifica o repo (plugin/tema/block theme/core/site) com guardrails e encaminha para a skill wp-* certa (blocos, block themes, Interactivity API, plugins e WP.org, REST, Abilities, WP-CLI e ops, performance, PHPStan, Playground e blueprints, WPDS) e para WooCommerce+Elementor; tem o pipeline de migração de conteúdo local→staging sem SSH (.wpress / All-in-One WP Migration). Usar quando aparece o primeiro sinal de WordPress (site WP, wp-content, plugin, tema, Gutenberg, wp-admin) e a skill de domínio ainda não é óbvia."
triggers: WPDS, @wordpress/components, Gutenberg UI, que tipo de projecto WordPress, migrar WordPress, wpress, ai1wm, All-in-One WP Migration, levar conteudo WP para staging, wordpress, wp, wp-content, wp-admin, plugin wp, tema wp, gutenberg, bloco gutenberg, wp-cli, rest api wordpress, register_rest_route, interactivity api, data-wp-, wp-env, phpstan wordpress
chain: wp-project-triage
---


# WP Index — routing de WordPress

## Regra de entrada

**Trabalho de WordPress sem skill de domínio óbvia passa por aqui primeiro**; se o pedido já casa
uma `wp-*` específica (o hook sugeriu-a), ir directo a ela. Esta skill **não escreve código** —
classifica e encaminha (excepção: o pipeline de migração de conteúdo, no fim). Depois de escolher o destino: `Read(".claude/skills/<nome>.md")` e notificar
`[skill: <nome>]`. Se o pedido cobrir ≥2 destinos independentes, despachar os `<skill>-agent`
correspondentes no mesmo turno (`rules/task-intake.md`).

Não escolher às cegas: com repo à frente e rota ambígua, corre o **triage** primeiro (ver abaixo) —
é a classificação do repo que desambigua plugin vs tema vs site.

## Ordem de execução

1. **`wp-project-triage`** — sempre que houver repo e a rota não for óbvia. Determina kind
   (plugin/tema/block theme/core/full site), tooling (PHP/Composer, Node, `@wordpress/scripts`),
   testes (PHPUnit, Playwright, wp-env) e versões.
2. **Classificar e aplicar guardrails** (secção abaixo) — inclui o pipeline de **migração de
   conteúdo** local→staging por FTP (sem SSH/WP-CLI), já validado ponta-a-ponta.
3. Skill(s) de domínio da tabela.
4. Gate antes de entregar: `wp-phpstan` (PHP) e/ou `wp-playground` (reproduzir num WP limpo).

## Classificação e guardrails

Entradas: raiz do repo (cwd) + intenção do utilizador e restrições (versões WP alvo, WP.com, release).

1. Triage do repo: `Read(".claude/skills/wp-project-triage.md")` e fazer o triage manualmente (o
   script não existe nesta instalação).
2. Ler o resultado e classificar: tipo(s) de projecto principal, tooling disponível, testes
   presentes, pistas de versão.
3. Encaminhar pela tabela abaixo, cruzando intenção com o tipo de repo.
4. Guardrails antes de mudar: confirmar as versões alvo se não forem claras; preferir o tooling e as
   convenções de build/teste que o repo já usa.

Verificação: repetir o triage depois de criar ou reestruturar ficheiros relevantes; correr os
comandos de lint/teste/build que o triage indicar.

Falhas: triage dá `kind: unknown` → inspeccionar `composer.json`, `package.json`, `style.css`,
`block.json`, `theme.json` e `wp-content/` na raiz. Repo enorme → estreitar o âmbito da varredura.
Rota ambígua → uma só pergunta: «É um plugin WordPress, um tema (clássico/de blocos) ou o repo de
um site completo?»

## Tabela de routing

| Sinal no pedido / no repo | Skill | O que faz |
|---|---|---|
| "que projecto WP é este", primeiro contacto, `wp-content/`, `style.css`, `composer.json` na raiz | `wp-project-triage` | Inspecção determinística do repo → JSON com `project.kind`, `signals`, `tooling`. Correr antes de mudar código |
| Migrar conteúdo local→staging, `.wpress`, All-in-One WP Migration, alojamento partilhado sem SSH | **esta skill** (§ Migração de conteúdo) | Pipeline validado: export UI → FTP → restore → fix de URLs → purgar caches |
| `block.json`, "bloco inválido / não guarda", atributos não persistem, `render.php`/`render_callback`, `deprecated`, `@wordpress/create-block`, `@wordpress/scripts`, apiVersion 3 | `wp-block-development` | Criar/actualizar blocos Gutenberg: metadata, serialização de atributos, render dinâmico, deprecations, build |
| `theme.json`, `templates/*.html`, `parts/*.html`, `patterns/*.php`, `styles/*.json`, Site Editor, "os estilos não aplicam" | `wp-block-themes` | Block themes: presets/settings/styles, templates e partes, patterns, style variations, hierarquia de estilos |
| `data-wp-interactive`, `data-wp-on--*`, `data-wp-bind--*`, `data-wp-context`, `viewScriptModule`, `@wordpress/interactivity`, "as directivas não disparam" | `wp-interactivity-api` | Interactivity API: store/state/actions, SSR das directivas, hidratação, integração com o bloco |
| Header `Plugin Name:`, hooks/actions/filters, activation/uninstall, Settings API, nonces/capabilities/escaping, wp-cron, empacotar release | `wp-plugin-development` | Arquitectura de plugin: bootstrap, loader de hooks, opções/admin, segurança, packaging |
| Submeter ao WP.org, GPL, cabeçalho de licença, nome/marca, trialware/upsell/freemium, código de terceiros embebido | `wp-plugin-directory-guidelines` | Review contra as 18 guidelines do Plugin Directory: licenciamento, naming, trialware, compatibilidade GPL |
| `register_rest_route`, `WP_REST_Controller`, `rest_api_init`, `show_in_rest`, `rest_base`, 401/403/404 em REST, meta/CPT na resposta | `wp-rest-api` | Criar/estender/depurar endpoints REST do WP: schema e validação de args, permissões/nonces, links e paginação |
| `wp_register_ability`, `wp_register_ability_category`, `wp-abilities/v1`, `@wordpress/abilities`, "a ability não aparece" | `wp-abilities-api` | Registar, expor por REST e consumir Abilities (WP 6.9+) |
| `wp search-replace`, `wp db export/import`, migração de domínio, `wp plugin/theme/user`, `wp cron`, multisite `--url`/`--network`, `wp-cli.yml` | `wp-wpcli-and-ops` | Operações WP-CLI com guardrails de blast radius (ambiente, targeting, backup antes de escrever) |
| Site/admin/REST **lento agora**, TTFB alto, `wp profile`/`wp doctor`, autoloaded options, object cache, WP-Cron, chamadas HTTP remotas; **ou** rever código à procura de anti-padrões (`query_posts()`, `posts_per_page => -1`, `session_start()`, `wp_remote_*` sem cache), antes de pico de tráfego | `wp-performance` | Dois modos: diagnóstico de runtime backend-only e review estático com severidade + nº de linha. Comandos `/wp-perf` (rápido) e `/wp-perf-review` (completo) |
| `phpstan.neon`, `phpstan-baseline.neon`, stubs de core, erros de tipo em hooks/REST/`$wpdb`, classes de plugins terceiros | `wp-phpstan` | Configurar/correr/corrigir PHPStan em WP: stubs, baseline, PHPDoc WordPress-friendly, ignores estreitos |
| WP descartável para testar, `@wp-playground/cli`, `--auto-mount`, trocar versão WP/PHP, snapshot, Xdebug isolado; escrever/editar/rever o **JSON** do blueprint (`blueprint.json`, `run-blueprint`, steps, bundles) | `wp-playground` | Instâncias WP efémeras (WASM+SQLite) para reproduzir bugs e testar plugin/tema; a autoria de blueprints está na referência que ela aponta |
| UI em contexto WordPress: `@wordpress/components`, `@wordpress/ui`, tokens de cor/spacing/tipografia, padrões de UI do Gutenberg/Woo/Jetpack | `Read(".claude/reference/wpds.md")` (referência, ex-skill `wpds`) | WordPress Design System via MCP WPDS (fonte canónica — não pesquisar na web). ⚠ requer o MCP configurado |
| **(adjacente, não `wp-*`)** Elementor, `_elementor_data`, Hello Elementor, HFE, WPForms, `content-product.php`, loja WooCommerce editável | `woocommerce-elementor` | Construir loja Woo + Elementor Free programaticamente: import de `_elementor_data`, child theme, overrides de template |

## Combinações frequentes

- **Bloco novo** → `wp-block-development` → `wp-interactivity-api` (se tiver interacção no frontend) → `wp-phpstan` antes de entregar; reproduzir em `wp-playground`.
- **Publicar plugin no WP.org** → `wp-plugin-development` → `wp-plugin-directory-guidelines` (licença/naming/trialware antes da submissão).
- **"O site está lento"** → `wp-performance`: medir em runtime para localizar o culpado, depois rever o código desse culpado (secção «Code review»). Os dois modos não se substituem.
- **Mudança de domínio / levar conteúdo para staging** → § Migração de conteúdo (abaixo) quando não há SSH; `wp-wpcli-and-ops` (`wp search-replace`) quando há.
- **Loja WooCommerce** → `wp-project-triage` → `woocommerce-elementor`; pós-restore de migração, a § Migração de conteúdo já aponta para lá.

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

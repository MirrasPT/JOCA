# Delta — WordPress (child theme + mu-plugins, WooCommerce opcional)

Stack de cliente herdada — não é stack da casa (`rules/stack-padrao.md`); usar exige entrada em `docs/DECISIONS.md` do projecto.

Entra quando o cliente já vive em WordPress (site institucional, equipa que o mantém, plugins pagos) e
converter não tem custo razoável. Já usada em vários projectos de cliente.
A entrada em `DECISIONS.md` diz **porquê** e **o custo aceite** (ex.: a D1 de um desses projectos).

Origem: CI e configs de um projecto de cliente (2026-09-03). Versões resolvidas pelo
`composer install` a 2026-09-15: `squizlabs/php_codesniffer` 3.13.6 · `wp-coding-standards/wpcs` 3.4.1 ·
`phpstan/phpstan` 2.2.14 · `szepeviktor/phpstan-wordpress` 2.0.4 (+ `php-stubs/wordpress-stubs` 7.1.0).

Aplica-se ao scaffold/testes/CI da Parte E1 do `executar-projeto`. O resto (contexto, skills, docs,
repositório, hooks, issues) é igual. Skills de domínio: `wp-index` → `wp-phpstan`, `wp-block-themes`,
`woocommerce-elementor`, `wp-wpcli-and-ops`.

## Conteúdo

- 2.1 — Âmbito do repositório
- 2.2 — Ferramentas de qualidade (Composer, só `require-dev`)
- 2.3 — `phpcs.xml.dist`
- 2.4 — `phpstan.neon.dist` (nível 5 por omissão)
- 2.5 — Testes
- 2.9 — CI
- Armadilhas

## 2.1 — Âmbito do repositório

**O git versiona só o código próprio:** `wp-content/themes/<tema>` (child theme) e
`wp-content/mu-plugins`. Core, plugins de terceiros e `uploads/` **não entram** — vêm do alojamento ou do
Docker local. Nenhuma ferramenta de qualidade pode assumir que existem.

Ambiente local: Docker (`wordpress:php8.3-apache` + `mariadb:11`, padrão dos projectos de cliente). **Nenhum
bind-mount vem do Google Drive** (código nunca no Drive).

## 2.2 — Ferramentas de qualidade (Composer, só `require-dev`)

`composer.json` na raiz (substituir `<tema>`):

```json
{
    "require-dev": {
        "squizlabs/php_codesniffer": "^3.9",
        "wp-coding-standards/wpcs": "^3.1",
        "dealerdirect/phpcodesniffer-composer-installer": "^1.0",
        "phpstan/phpstan": "^2.0",
        "szepeviktor/phpstan-wordpress": "^2.0"
    },
    "config": {
        "allow-plugins": { "dealerdirect/phpcodesniffer-composer-installer": true }
    },
    "scripts": {
        "lint": "find wp-content/themes/<tema> wp-content/mu-plugins -type f -name '*.php' -print0 | xargs -0 -n1 php -l",
        "phpcs": "phpcs",
        "phpstan": "phpstan analyse --memory-limit=1G"
    }
}
```

O `dealerdirect/...-installer` regista os standards sozinho: `vendor/bin/phpcs -i` tem de listar
`WordPress, WordPress-Core, WordPress-Docs and WordPress-Extra`.

## 2.3 — `phpcs.xml.dist`

```xml
<?xml version="1.0"?>
<ruleset name="<Projecto>">
    <file>wp-content/themes/<tema></file>
    <file>wp-content/mu-plugins</file>

    <exclude-pattern>vendor/*</exclude-pattern>
    <exclude-pattern>node_modules/*</exclude-pattern>
    <exclude-pattern>wp-content/uploads/*</exclude-pattern>
    <exclude-pattern>wp-content/plugins/*</exclude-pattern>

    <arg value="sp"/>
    <arg name="extensions" value="php"/>

    <rule ref="WordPress"/>

    <rule ref="WordPress.NamingConventions.PrefixAllGlobals">
        <properties>
            <property name="prefixes" type="array">
                <element value="<prefixo>"/>
            </property>
        </properties>
    </rule>

    <rule ref="WordPress.WP.I18n">
        <properties>
            <property name="text_domain" type="array">
                <element value="<text-domain>"/>
            </property>
        </properties>
    </rule>
</ruleset>
```

## 2.4 — `phpstan.neon.dist` (nível 5 por omissão)

```neon
includes:
    - vendor/szepeviktor/phpstan-wordpress/extension.neon

parameters:
    level: 5
    paths:
        - wp-content/themes/<tema>
        - wp-content/mu-plugins
    excludePaths:
        - vendor/*
        - node_modules/*
        - wp-content/uploads/*
        - wp-content/plugins/*
```

**Porquê nível 5:** apanha tipos incompatíveis, métodos/propriedades inexistentes e argumentos errados
sem exigir generics/strict (8+) num projecto a arrancar. Sobe-se depois de estabilizar — não se abre
com baseline. **Sem o `extension.neon`** quase todas as funções core dão «function not found» (o core
não está no repo).

## 2.5 — Testes

Sem runner por omissão: o gate estático é `php -l` + PHPCS + PHPStan, e o de runtime é o
`gate-runtime.mjs` contra o Docker local. Testes PHPUnit de integração WP (`wp-env`/`WP_TESTS_DIR`) só
quando houver lógica própria que o justifique — TODO: receita não medida na casa.

## 2.9 — CI

`ci-wordpress.yml` — corre os três scripts do Composer, sem `continue-on-error` nem `|| true`.

## Armadilhas

- **O ruleset `WordPress` completo parte um CI verde-à-primeira.** Nas configs desse projecto o próprio
  código saiu com 5 erros e 7 avisos (medido 2026-09-15): `Squiz.Commenting.InlineComment.InvalidEndChar`
  (comentário `//` sem pontuação final — frequente em PT) e `Squiz.PHP.CommentedOutCode.Found`. Correr
  `composer run phpcs` localmente **antes** do primeiro push; `vendor/bin/phpcbf` corrige só parte.
- **Avisos também falham o job.** Com só avisos o `phpcs` sai com código ≠ 0 (medido: 2). Aceitar avisos
  é decisão explícita: `--runtime-set ignore_warnings_on_exit 1` no script `phpcs`, registada em
  `DECISIONS.md` — nunca `|| true`.
- **`<config name="testVersion">` é inerte sem PHPCompatibility.** Esse standard não vem com o WPCS
  (`phpcs -i` não o lista); para verificar compatibilidade de versão PHP, instalar
  `phpcompatibility/phpcompatibility-wp` — TODO: não medido.
- **PHP do CI = PHP do alojamento**, não o da máquina (Mac: 8.5; Docker/CI: 8.3). Confirmar a versão do
  servidor antes de fixar o `php-version`.
- O gate de runtime continua a valer: PHPCS/PHPStan verdes **não** provam que a loja carrega nem que o
  checkout (WooCommerce) fecha.

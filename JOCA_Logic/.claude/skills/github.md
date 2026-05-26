---
name: github
description: "Use when working with GitHub Actions, CI/CD pipelines, PR workflows, or GitHub API integrations."
triggers: github, GitHub, github actions, CI, CI/CD, workflow, pipeline, gh pr, gh release, pull request, PR, issue, actions, dependabot, CODEOWNERS, branch protection, github cli, gh, continuous integration, continuous deployment, github container registry, ghcr, github workflow, yml workflow, yaml workflow, automatizar, automate pipeline, release, tag, versioning
---
# GitHub

GitHub specialist. Actions CI/CD para Laravel, gh CLI, Dependabot, branch protection, Environments, GHCR.

---

## CI Workflow -- Laravel (Pest + Pint + PHPStan + MySQL)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
    paths: ['**.php', 'composer.lock', '.github/workflows/ci.yml']
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: dom, curl, mbstring, zip, pcntl, pdo, mysql, pdo_mysql, bcmath, intl, gd
          coverage: none
          tools: composer:v2

      - uses: actions/cache@v4
        with:
          path: ~/.composer/cache
          key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
          restore-keys: ${{ runner.os }}-composer-

      - run: composer install --no-progress --prefer-dist --optimize-autoloader
      - run: vendor/bin/pint --test
      - run: vendor/bin/phpstan analyse --memory-limit=1G

  security:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3', tools: 'composer:v2' }
      - run: composer install --no-progress --prefer-dist
      - run: composer audit --locked

  tests:
    name: Tests
    runs-on: ubuntu-latest
    needs: [quality]
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ALLOW_EMPTY_PASSWORD: yes
          MYSQL_DATABASE: testing
        ports: ['3306']
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: dom, curl, mbstring, zip, pcntl, pdo, mysql, pdo_mysql, bcmath, intl, gd
          coverage: none
          tools: composer:v2
      - uses: actions/cache@v4
        with:
          path: ~/.composer/cache
          key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
          restore-keys: ${{ runner.os }}-composer-
      - run: composer install --no-progress --prefer-dist --optimize-autoloader
      - run: cp .env.example .env && php artisan key:generate
      - run: mkdir -p storage/framework/{sessions,views,cache} && chmod -R 777 storage bootstrap/cache
      - name: Run migrations
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: ${{ job.services.mysql.ports[3306] }}
          DB_DATABASE: testing
          DB_USERNAME: root
        run: php artisan migrate --force
      - name: Run Pest
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: ${{ job.services.mysql.ports[3306] }}
          DB_DATABASE: testing
          DB_USERNAME: root
        run: vendor/bin/pest --parallel
```

**Regras criticas:**
- `paths:` filter -- nao correr CI em changes de README/docs
- `job.services.mysql.ports[3306]` -- porta dinamica, nunca hardcode `3306`
- `needs: [quality]` -- testes so correm se Pint+PHPStan passam
- `--test` no Pint -- exit code erro em violacoes (sem auto-fix)
- `--memory-limit=1G` no PHPStan -- Laravel excede o default 128M

---

## Concurrency -- obrigatorio

```yaml
# PRs -- cancelar runs stale
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

# Deploys producao -- NUNCA cancelar
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

Sem concurrency, cada push numa PR lanca run novo enquanto o anterior continua a correr.

---

## gh CLI

### Pull Requests
```bash
gh pr create --title "feat: payment" --body "..." --base main --reviewer alice
gh pr create --fill                    # usa commit messages como body
gh pr view                             # PR da branch actual
gh pr checkout 123                     # checkout PR local
gh pr merge 123 --squash --delete-branch
gh pr merge 123 --auto --squash        # auto-merge quando checks passam
gh pr list --author @me
```

### Issues
```bash
gh issue create --title "Bug: login fails" --body "..." --label "bug"
gh issue develop 42 --checkout          # cria branch e checkout
gh issue list --assignee @me
gh issue close 42 --comment "Fixed in #123"
```

### Workflows
```bash
gh workflow run deploy.yml --ref main
gh workflow run deploy.yml -f environment=staging -f version=1.2.3
gh run list --workflow=ci.yml
gh run watch --exit-status              # espera e sai com erro se falhar
gh run view 12345678 --log
gh run rerun 12345678 --failed-only
```

### Releases
```bash
gh release create v1.2.3 --generate-notes
gh release create v1.2.3 --notes-file CHANGELOG.md --title "v1.2.3"
gh release create v2.0.0-beta.1 --prerelease
gh release create v1.2.3 --draft --generate-notes
gh release create v1.2.3 './dist/app.zip#App Bundle'  # upload com label
```

### gh em workflows
```yaml
steps:
  - name: Comment on PR
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: gh pr comment ${{ github.event.pull_request.number }} --body "CI passed."
```

---

## Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "composer"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Lisbon"
    target-branch: "develop"
    labels: ["dependencies", "php"]
    open-pull-requests-limit: 5
    ignore:
      - dependency-name: "laravel/framework"
        update-types: ["version-update:semver-major"]
    groups:
      minor-patch:
        patterns: ["*"]
        exclude-patterns: ["laravel/*"]
        update-types: ["minor", "patch"]

  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    labels: ["dependencies", "javascript"]
    groups:
      js-deps:
        patterns: ["*"]
        update-types: ["minor", "patch"]

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
    labels: ["dependencies", "github-actions"]
```

### Auto-merge Dependabot (patch/minor)
```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge
on: pull_request
permissions:
  contents: write
  pull-requests: write
jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: metadata
      - if: steps.metadata.outputs.update-type != 'version-update:semver-major'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh pr merge --auto --squash ${{ github.event.pull_request.number }}
```

---

## CODEOWNERS

```
# .github/CODEOWNERS
*                           @myorg/backend-team
/resources/                 @myorg/frontend-team
/.github/                   @myorg/devops
/database/migrations/       @dba-lead
/app/Services/Payment/      @security-lead @myorg/security
```

Activar "Require review from Code Owners" no branch protection.

---

## Branch Protection (Settings -> Branches)

| Regra | Valor |
|-------|-------|
| Require PR before merge | Sim |
| Required approvals | 1 |
| Require status checks | CI jobs |
| Require branches up to date | Sim |
| Require conversation resolution | Sim |

---

## Environments (staging / production)

```yaml
jobs:
  deploy-staging:
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    environment:
      name: production
      url: https://myapp.com
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh production
```

Configurar em Settings -> Environments:
- Required reviewers (aprovacao manual antes de producao)
- Deployment branches (so `main` para producao)
- Environment secrets (separados dos repo secrets)

---

## GHCR (GitHub Container Registry)

```yaml
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- uses: docker/build-push-action@v5
  with:
    push: true
    tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

Dockerfile label obrigatorio para linking:
```dockerfile
LABEL org.opencontainers.image.source="https://github.com/myorg/myrepo"
```

---

## Security

### Permissions -- minimo privilegio
```yaml
permissions:
  contents: read    # default restrictivo
```
Escalar por job conforme necessario.

### Action pinning
```yaml
# OK para actions/ oficiais
- uses: actions/checkout@v4

# Third-party: pin a SHA
- uses: some-vendor/action@a4cc859cef29adcf8317e156194b6197f025e667
```

### Script injection prevention
```yaml
# MAU: github context interpolado em shell
- run: echo "Processing ${{ github.event.pull_request.title }}"

# BOM: atribuir a env var
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Processing $PR_TITLE"
```

### OIDC (keyless cloud auth)
```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ vars.AWS_ROLE_ARN }}
      aws-region: eu-west-1
```
Nunca guardar AWS/GCP/Azure keys como secrets -- usar OIDC.

---

## Release automatica em tag push

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*.*.*']
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh release create ${{ github.ref_name }} --generate-notes --verify-tag
```

---

## Common pitfalls

| Problema | Fix |
|----------|-----|
| `::set-output` deprecated | `echo "name=value" >> $GITHUB_OUTPUT` |
| DB_PORT hardcoded 3306 | `${{ job.services.mysql.ports[3306] }}` |
| `cancel-in-progress: true` em deploy | So usar em test/lint jobs |
| `fail-fast` default true em matrix | Adicionar `fail-fast: false` |
| `pint` sem `--test` em CI | Sem `--test` faz auto-fix em vez de falhar |
| PHPStan out of memory | `--memory-limit=1G` |
| Environment secrets em reusable workflows | Nao propagam via `workflow_call` -- usar repo secrets |
| Vendor/ cached com key errada | Key deve incluir `hashFiles('**/composer.lock')` |

---

## Ficheiros standard

```
.github/
├── workflows/
│   ├── ci.yml                     # CI principal
│   ├── dependabot-auto-merge.yml  # Auto-merge patch/minor
│   └── release.yml                # Release em tag push
├── dependabot.yml                 # Config Dependabot
└── CODEOWNERS                     # Ownership por path
```

---

## Checklist novo projecto GitHub

- [ ] CI workflow com Pint + PHPStan + Pest + MySQL service
- [ ] Concurrency control em todos os workflows
- [ ] `paths:` filter para evitar runs desnecessarios
- [ ] Dependabot configurado (composer + npm + actions)
- [ ] CODEOWNERS definido
- [ ] Branch protection em `main`
- [ ] Environments staging + production (se deploy automatico)
- [ ] Permissions minimas por workflow
- [ ] Secrets nunca em logs ou interpolados em shell

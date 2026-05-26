---
name: deploy-ploi
description: "Use when deploying via Ploi.io, managing servers, or configuring Ploi deployments."
triggers: ploi, deploy, deploy to ploi, ploi.io, deployment, servidor, server, provisionar, site setup, deploy script, zero downtime, atomic deploy, production, producao, publicar, colocar online, ir para producao, push to server, lançar, launch
---
# Deploy — Ploi.io

Ploi.io e a plataforma principal de deploy. Provisiona servidores, configura sites Laravel automaticamente, e faz deploy com zero-downtime.

---

## Server provisioning

1. Conectar cloud provider (DigitalOcean, Hetzner, Vultr, AWS) via API key em Server Providers
2. Criar servidor: escolher PHP version, tipo (web/worker/database/Redis), regiao, plano
3. Ploi instala LEMP stack automaticamente

Tipos de servidor: web, load balancer, database dedicado, Redis/Valkey, worker, storage (MinIO), search (Meilisearch).

---

## Site setup

1. Criar site no servidor -- dominio, web directory `/public`, project directory `/`
2. Conectar repo Git (GitHub/GitLab/Bitbucket) -- gera deploy script inicial
3. Configurar DNS (A record para IP do servidor)
4. SSL -- tab SSL, Let's Encrypt automatico
5. Editar `.env` via environment editor (sem SSH)
6. Criar database via tab Databases
7. Primeiro deploy

---

## Deploy script (Laravel standard)

```bash
cd /home/ploi/example.com
git pull origin main
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev
echo "" | sudo -S service php8.3-fpm reload
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan queue:restart
php artisan horizon:terminate
```

**CRITICO:** Sempre `--force` em `php artisan migrate` -- sem ele, prompt interactivo bloqueia o deploy.

---

## Triggers de deploy

### Panel -- botao Deploy no UI

### Webhook (GitHub/GitLab)
```
POST https://ploi.io/webhooks/servers/{server_id}/sites/{site_id}/deploy?token=xxx
```
Copiar URL da tab Repository e configurar como push webhook no GitHub.

### GitHub Actions
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Ploi
        uses: fjogeleit/http-request-action@master
        with:
          url: ${{ secrets.PLOI_WEBHOOK_URL }}
          method: 'POST'
```

### Skip deploy
Incluir `[skip ci]` ou `[ci skip]` na mensagem de commit.

---

## Zero-downtime (atomic deploy)

Activar em Settings do site (requer plano Pro ou Unlimited).

Como funciona:
1. Cria directorio `{domain}-deploy/`
2. Cada deploy cria subdirectorio timestamped
3. Apos sucesso, symlink atomico para nova release
4. Mantem 3 releases (oldest, recent, current)

**Storage:** criar pasta `storage` dentro de `{domain}-deploy/` e symlink para persistir uploads entre releases.

**Web root:** configurar como `/current/public` quando atomic deploy activo.

---

## Queues e daemons

### Queue workers (tab Queues do site)
```
Connection: redis
Queue: default,high,low
Timeout: 90
Sleep: 3
Max tries: 3
Processes: 1
```

### Horizon (tab Daemons do servidor)
```
Command: php /home/ploi/my-app.com/artisan horizon
User: ploi
Processes: 1
```
Ploi cria config supervisor automaticamente. Adicionar `php artisan horizon:terminate` ao deploy script.

---

## PHP SDK

```bash
composer require ploi/ploi-php-sdk
```

```php
$ploi = new \Ploi\Ploi($apiToken);

// Deploy
$ploi->servers(123)->sites(456)->deployment()->deploy();

// Environment
$ploi->servers(123)->sites(456)->environment()->get();
$ploi->servers(123)->sites(456)->environment()->update($content);

// Database
$ploi->servers(123)->databases()->create($name, $user, $password);

// SSL
$ploi->servers(123)->sites(456)->certificates()->create($domain, 'letsencrypt');

// Cron
$ploi->servers(123)->cronjobs()->create('php artisan schedule:run', '* * * * *', 'ploi');
```

## CLI

```bash
composer global require ploi/cli
ploi login   # API token
```

---

## Common pitfalls

| Problema | Causa | Fix |
|----------|-------|-----|
| Deploy bloqueado | Comando interactivo | `--force` em migrate |
| Zero downtime nao funciona | Plano Free/Basic | Requer Pro ou Unlimited |
| Horizon nao reinicia | Falta terminate | `php artisan horizon:terminate` no deploy script |
| Codigo antigo apos deploy | OPcache | `sudo -S service php8.3-fpm reload` no deploy script |
| Storage perdido em atomic deploy | Sem symlink | Criar shared storage folder |

---

## Checklist deploy

- [ ] Deploy script inclui `--force` em migrate
- [ ] Deploy script inclui `horizon:terminate` (se Horizon)
- [ ] Deploy script inclui PHP-FPM reload
- [ ] `.env` configurado via Ploi (nunca em git)
- [ ] SSL Let's Encrypt activo
- [ ] Queue worker configurado (se aplicavel)
- [ ] Scheduler configurado automaticamente
- [ ] Webhook GitHub configurado para auto-deploy
- [ ] `APP_ENV=production` e `APP_DEBUG=false`

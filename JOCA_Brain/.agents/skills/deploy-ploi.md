---
name: deploy-ploi
description: "Deploying via Ploi.io, managing servers, or configuring Ploi deployments. MUST be invoked when the user says: ploi, deploy, deploy to ploi, ploi.io, deployment, servidor, server, provisionar. SHOULD also invoke when: site setup, deploy script, zero downtime, atomic deploy, production, producao."
triggers: ploi, deploy, deploy to ploi, ploi.io, deployment, servidor, server, provisionar, site setup, deploy script, zero downtime, atomic deploy, production, producao, publicar, colocar online, ir para producao, push to server, lançar, launch
chain: deploy-executor
---
# Deploy — Ploi.io

Ploi.io is the primary deploy platform. Provisions servers, configures Laravel sites, deploys with zero-downtime.

---

## Server provisioning

1. Connect cloud provider (DigitalOcean, Hetzner, Vultr, AWS) via API key in Server Providers
2. Create server: choose PHP version, type (web/worker/database/Redis), region, plan
3. Ploi installs LEMP stack automatically

Server types: web, load balancer, dedicated database, Redis/Valkey, worker, storage (MinIO), search (Meilisearch).

---

## Site setup

1. Create site -- domain, web directory `/public`, project directory `/`
2. Connect Git repo (GitHub/GitLab/Bitbucket) -- generates initial deploy script
3. Configure DNS (A record to server IP)
4. SSL -- tab SSL, automatic Let's Encrypt
5. Edit `.env` via environment editor (no SSH needed)
6. Create database via Databases tab
7. First deploy

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

**CRITICAL:** Always `--force` on `php artisan migrate` -- without it, interactive prompt blocks the deploy.

---

## Deploy triggers

### Panel -- Deploy button in UI

### Webhook (GitHub/GitLab)
```
POST https://ploi.io/webhooks/servers/{server_id}/sites/{site_id}/deploy?token=xxx
```
Copy URL from Repository tab, configure as push webhook in GitHub.

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
Include `[skip ci]` or `[ci skip]` in commit message.

---

## Zero-downtime (atomic deploy)

Activate in site Settings (requires Pro or Unlimited plan).

How it works:
1. Creates `{domain}-deploy/` directory
2. Each deploy creates timestamped subdirectory
3. On success, atomic symlink to new release
4. Keeps 3 releases (oldest, recent, current)

**Storage:** create `storage` folder inside `{domain}-deploy/` and symlink to persist uploads across releases.

**Web root:** set to `/current/public` when atomic deploy is active.

---

## Queues and daemons

### Queue workers (site Queues tab)
```
Connection: redis
Queue: default,high,low
Timeout: 90
Sleep: 3
Max tries: 3
Processes: 1
```

### Horizon (server Daemons tab)
```
Command: php /home/ploi/my-app.com/artisan horizon
User: ploi
Processes: 1
```
Ploi creates supervisor config automatically. Add `php artisan horizon:terminate` to deploy script.

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

## Deploy checklist

- [ ] Deploy script includes `--force` on migrate
- [ ] Deploy script includes `horizon:terminate` (if Horizon)
- [ ] Deploy script includes PHP-FPM reload
- [ ] `.env` configured via Ploi (never in git)
- [ ] SSL Let's Encrypt active
- [ ] Queue worker configured (if applicable)
- [ ] Scheduler configured
- [ ] GitHub webhook configured for auto-deploy
- [ ] `APP_ENV=production` and `APP_DEBUG=false`

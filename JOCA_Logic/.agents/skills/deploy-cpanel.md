---
name: deploy-cpanel
description: "Use when deploying to cPanel, shared hosting, or traditional FTP/SSH hosting environments."
triggers: cpanel, cPanel, shared hosting, hosting partilhado, public_html, FTP, phpMyAdmin, .htaccess, hosting barato, alojamento, hosting tradicional, cpanel deploy, deploy cpanel, file manager, hosting simples
---
# Deploy — cPanel

Deploy de Laravel/PHP em cPanel. Workarounds para limitacoes de shared hosting.

---

## Estrutura de pastas (CRITICO)

```
/home/username/
├── laravel/              <- projecto Laravel inteiro (FORA do public_html)
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── vendor/
│   └── ...
└── public_html/          <- SO conteudo de Laravel public/
    ├── index.php          <- paths corrigidos
    ├── .htaccess
    └── assets/
```

**NUNCA colocar a raiz do Laravel dentro de `public_html/`** -- expoe `.env`, config, e todo o codigo.

---

## Corrigir index.php

Copiar `laravel/public/*` para `public_html/` e corrigir paths em `public_html/index.php`:

```php
// Laravel < 11
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require_once __DIR__.'/../laravel/bootstrap/app.php';

// Laravel 11+
// Actualizar maintenance file path e autoloader path
```

---

## .htaccess security

Adicionar a `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Bloquear ficheiros sensiveis
<FilesMatch "\.(env|log|json|lock|config|yml|yaml|xml)$">
    Order allow,deny
    Deny from all
</FilesMatch>
```

---

## Metodos de deploy

### A. File upload (sem SSH)
1. Upload via File Manager ou FTP para `/home/username/laravel/`
2. Copiar `public/` para `public_html/`
3. Corrigir `index.php`
4. Permissoes: `storage/` e `bootstrap/cache/` = 775

### B. SSH + Git pull
```bash
ssh username@hostname
cd ~/laravel
git pull origin main
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### C. cPanel Git Version Control + .cpanel.yml
1. cPanel -> Git Version Control -> Create
2. URL do repo (SSH para privados)
3. Adicionar deploy key gerada pelo cPanel ao GitHub
4. Criar `.cpanel.yml` na raiz do repo:

```yaml
---
deployment:
  tasks:
    - export DEPLOYPATH=/home/username/
    - /bin/cp -r * $DEPLOYPATH
    - /bin/cp -r ./public/. $DEPLOYPATH/public_html/
    - cd $DEPLOYPATH && composer install --no-dev --optimize-autoloader --no-interaction
    - cd $DEPLOYPATH && php artisan migrate --force
    - cd $DEPLOYPATH && php artisan config:cache
    - cd $DEPLOYPATH && php artisan route:cache
```

**Limitacao:** `.cpanel.yml` usa `cp` (copia), nao `rsync` -- ficheiros apagados do repo NAO sao removidos do servidor.

---

## Workarounds (sem SSH)

### Storage symlink
Criar `public_html/symlink.php`:
```php
<?php
symlink('/home/username/laravel/storage/app/public', '/home/username/public_html/storage');
echo 'done';
```
Aceder via browser uma vez, depois apagar.

### Artisan commands
```php
// routes/web.php (temporario)
Route::get('/run-migrate', function() {
    \Artisan::call('migrate', ['--force' => true]);
    return \Artisan::output();
});
```
Correr uma vez, depois remover.

---

## Scheduler e queues

### Scheduler (cPanel -> Cron Jobs)
```
* * * * *   /usr/local/bin/php /home/username/laravel/artisan schedule:run >> /dev/null 2>&1
```

### Queue workers (shared hosting)
```
* * * * *   /usr/local/bin/php /home/username/laravel/artisan queue:work --stop-when-empty --tries=3 --timeout=90
```
`--stop-when-empty` e CRITICO -- previne processos long-running que cPanel mata.

Usar `QUEUE_CONNECTION=database` se Redis nao disponivel.

---

## PHP version

- cPanel -> MultiPHP Manager -> seleccionar versao por dominio
- Verificar CLI: `php -v` via SSH
- `.user.ini` em `public_html/` para override de settings

---

## SSL

- AutoSSL (Let's Encrypt): cPanel -> SSL/TLS -> AutoSSL (automatico)
- Manual: cPanel -> SSL/TLS -> Install SSL Certificate

---

## Database

- Criar: cPanel -> MySQL Databases -> Create Database + Create User + Add User to Database
- **Atencao:** nomes sao prefixados com username cPanel (ex: `john_myapp`, nao `myapp`)
- Import: phpMyAdmin -> seleccionar DB -> Import -> upload `.sql`
- `.env`: `DB_HOST=localhost`, `DB_USERNAME=cpanel_prefix_user`

---

## Common pitfalls

| Problema | Causa | Fix |
|----------|-------|-----|
| `vendor` nao existe | Git ignora `vendor/` | Upload zip + unzip, ou `composer install` via SSH |
| Migrate nao corre | Sem SSH | Route workaround temporario |
| Ficheiros antigos no servidor | `.cpanel.yml` usa `cp` nao `rsync` | Sem solucao nativa |
| Queue worker morto | Shared host mata processos longos | `--stop-when-empty` |
| PHP version errada | MultiPHP nao configurado | cPanel MultiPHP Manager |
| `.env` exposto | Laravel root dentro de `public_html` | Mover para fora |
| DB username errado | cPanel prefixa com account name | Usar nome completo prefixado |

---

## Checklist deploy cPanel

- [ ] Laravel root FORA de `public_html/`
- [ ] `index.php` paths corrigidos
- [ ] `.htaccess` com HTTPS redirect + file blocking
- [ ] Permissoes: storage/ e bootstrap/cache/ = 775
- [ ] `.env` fora do web root
- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] Database criada com user + privileges
- [ ] Cron job para scheduler configurado
- [ ] SSL activo (AutoSSL)
- [ ] Storage symlink criado

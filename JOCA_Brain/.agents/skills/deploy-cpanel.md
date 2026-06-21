---
name: deploy-cpanel
description: "Deploy Laravel/PHP or Node.js apps to cPanel, shared hosting, or traditional hosting environments. MUST be invoked when the user says: cpanel, cPanel, shared hosting, hosting partilhado, public_html, FTP, phpMyAdmin, .htaccess, Passenger, Node.js cPanel, Setup Node.js App. SHOULD also invoke when: hosting barato, alojamento, hosting tradicional, cpanel deploy, deploy cpanel, file manager, hosting simples, restart.txt, nodevenv."
triggers: cpanel, cPanel, shared hosting, hosting partilhado, public_html, FTP, phpMyAdmin, .htaccess, hosting barato, alojamento, hosting tradicional, cpanel deploy, deploy cpanel, file manager, hosting simples, Passenger, Node.js cPanel, Setup Node.js App, restart.txt, nodevenv
---
# Deploy — cPanel

Deploy Laravel/PHP e Node.js (Passenger) em cPanel. Workarounds para shared hosting.

---

## Estrutura de pastas (CRITICO — ambos os stacks)

**Laravel/PHP:**
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

**Node.js (Passenger):**
```
/home/username/
├── myapp/                <- app root (FORA do public_html; definida no UI)
│   ├── app.js            <- startup file
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   ├── data/             <- SQLite + uploads (nunca dentro de public/)
│   ├── public/           <- criado pelo Passenger automaticamente
│   └── tmp/              <- restart.txt aqui
└── public_html/          <- nao toca aqui para apps Node
```

**NUNCA colocar raiz do projecto dentro de `public_html/`** — expoe `.env`, config, código, e base de dados.

---

## Laravel/PHP

### Corrigir index.php

Copiar `laravel/public/*` para `public_html/`, corrigir paths em `public_html/index.php`:

```php
// Laravel < 11
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require_once __DIR__.'/../laravel/bootstrap/app.php';

// Laravel 11+
// Actualizar maintenance file path e autoloader path
```

---

### .htaccess security

Em `public_html/.htaccess`:

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

### Metodos de deploy (Laravel)

#### A. File upload (sem SSH)
1. Upload via File Manager ou FTP para `/home/username/laravel/`
2. Copiar `public/` para `public_html/`
3. Corrigir `index.php`
4. Permissoes: `storage/` e `bootstrap/cache/` = 775

#### B. SSH + Git pull
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

#### C. cPanel Git Version Control + .cpanel.yml (Laravel)
1. cPanel → Git Version Control → Create
2. URL do repo (SSH para privados)
3. Adicionar deploy key do cPanel ao GitHub
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

**Limitacao:** `.cpanel.yml` usa `cp` nao `rsync` — ficheiros apagados do repo NAO sao removidos do servidor.

---

### Workarounds Laravel (sem SSH)

#### Storage symlink
Criar `public_html/symlink.php`:
```php
<?php
symlink('/home/username/laravel/storage/app/public', '/home/username/public_html/storage');
echo 'done';
```
Aceder via browser uma vez, depois apagar.

#### Artisan commands
```php
// routes/web.php (temporario)
Route::get('/run-migrate', function() {
    \Artisan::call('migrate', ['--force' => true]);
    return \Artisan::output();
});
```
Correr uma vez, depois remover.

---

### Scheduler e queues

#### Scheduler (cPanel → Cron Jobs)
```
* * * * *   /usr/local/bin/php /home/username/laravel/artisan schedule:run >> /dev/null 2>&1
```

#### Queue workers (shared hosting)
```
* * * * *   /usr/local/bin/php /home/username/laravel/artisan queue:work --stop-when-empty --tries=3 --timeout=90
```
`--stop-when-empty` CRITICO — previne processos long-running que cPanel mata.

Usar `QUEUE_CONNECTION=database` se Redis indisponivel.

---

### PHP version

- cPanel → MultiPHP Manager → seleccionar versao por dominio
- Verificar CLI: `php -v` via SSH
- `.user.ini` em `public_html/` para override de settings

---

### SSL

- AutoSSL (Let's Encrypt): cPanel → SSL/TLS → AutoSSL (automatico)
- Manual: cPanel → SSL/TLS → Install SSL Certificate

---

### Database (MySQL)

- Criar: cPanel → MySQL Databases → Create Database + Create User + Add User to Database
- Nomes prefixados com username cPanel (ex: `john_myapp`, nao `myapp`)
- Import: phpMyAdmin → seleccionar DB → Import → upload `.sql`
- `.env`: `DB_HOST=localhost`, `DB_USERNAME=cpanel_prefix_user`

---

## Node.js apps em cPanel (Passenger)

cPanel usa Phusion Passenger + CloudLinux Node.js Selector. Passenger substitui PM2/forever — nao correr process manager proprio.

### 1. Criar app no UI

cPanel → **Setup Node.js App** → Create Application:

| Campo | Valor |
|-------|-------|
| Node.js version | versao desejada (ex: 20) |
| Application mode | Production |
| Application root | `myapp` (relativo a `/home/username/`) — FORA de public_html |
| Application URL | dominio ou subdominio |
| Application startup file | `app.js` (ou `server.js`) — entry point da app |

Passenger cria automaticamente `~/myapp/public/` e `~/myapp/tmp/` e configura o reverse proxy.

### 2. Startup file

O ficheiro definido em "Application startup file" e o entry point. Regras criticas:

```js
// CORRECTO — Passenger injeta PORT via env
app.listen(process.env.PORT);

// ERRADO — porta hardcoded impede Passenger de funcionar
app.listen(3000);
```

Mudar o nome do ficheiro requer actualizar o campo no UI.

### 3. Variaveis de ambiente

Adicionar em cPanel → Setup Node.js App → **Environment variables** (nao commitar `.env`):

```
NODE_ENV=production
DB_PATH=/home/username/myapp/data/app.db
UPLOAD_DIR=/home/username/myapp/uploads
```

Passenger injeta-as no processo. Mais seguro que `.env` ficheiro e sobrevive a restarts. dotenv funciona como fallback mas e secundario.

### 4. Instalar dependencias (virtualenv)

Cada app tem um virtualenv isolado em `~/nodevenv/<app-root>/<version>/`. O comando exacto de activacao aparece na caixa azul da pagina de setup.

**Via SSH** (recomendado para reproducibilidade):
```bash
source /home/username/nodevenv/myapp/20/bin/activate && cd /home/username/myapp
npm ci
```

`npm ci` e preferido sobre `npm install` — instala exactamente o que esta no `package-lock.json`. Requer `package-lock.json` commitado.

Nunca correr `npm` bare fora do virtualenv — usa o binario errado.

O botao "Run NPM Install" no UI e equivalente mas menos determinista.

### 5. Restart

```bash
# Graceful restart (deploy-friendly, sem downtime)
touch ~/myapp/tmp/restart.txt
```

Passenger faz rolling restart na proxima request. Nao requer acesso ao UI. O botao Restart no UI e o equivalente manual.

### 6. Deploy via .cpanel.yml (Node.js)

```yaml
---
deployment:
  tasks:
    - export DEPLOYPATH=/home/username/myapp
    - /bin/cp -R app.js package.json package-lock.json src $DEPLOYPATH
    - source /home/username/nodevenv/myapp/20/bin/activate && cd $DEPLOYPATH && npm ci --omit=dev
    - /bin/mkdir -p $DEPLOYPATH/tmp
    - /bin/touch $DEPLOYPATH/tmp/restart.txt
```

**Regras criticas:**
- Tasks correm como `sh`, uma shell por linha — encadear venv-activate + cd + npm com `&&` na mesma linha
- `npm ci --omit=dev` para producao (exclui devDependencies)
- NAO copiar `node_modules/` do repo
- NAO incluir `data/` ou `uploads/` na lista de copia (ver Persistencia abaixo)
- O numero da versao no path do venv (`/20/`) deve corresponder ao seleccionado no UI

### 7. Persistencia — SQLite e uploads

Guardar base de dados e uploads no app root, FORA de `public/`:

```
~/myapp/data/app.db      <- SQLite
~/myapp/uploads/         <- ficheiros de utilizador
```

Nunca dentro de `~/myapp/public/` — seriam servidos directamente pela web.

**CRITICO para git deploy:** `.cpanel.yml` nao deve sobrescrever nem apagar estes directórios em cada deploy. Excluir da lista de `cp`. Adicionar ao `.gitignore`:
```
data/
uploads/
```

### Gotchas Node.js/Passenger

| Problema | Causa | Fix |
|----------|-------|-----|
| App nao inicia | Porta hardcoded | `app.listen(process.env.PORT)` |
| `npm` usa versao errada | Fora do virtualenv | `source .../nodevenv/.../bin/activate` antes de npm |
| Deploy apaga dados | `.cpanel.yml` copia data/ | Excluir data/ e uploads/ do cp |
| Restart nao funciona | tmp/ nao existe | `/bin/mkdir -p $DEPLOYPATH/tmp` no .cpanel.yml |
| Env vars em branco | Definidas em .env em vez do UI | Mover para Setup Node.js App → Environment variables |
| Versao Node errada no venv | Path `/18/` vs `/20/` | Verificar versao no UI e ajustar path no .cpanel.yml |

---

## Common pitfalls (Laravel/PHP)

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

### Laravel/PHP
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

### Node.js (Passenger)
- [ ] App root definido FORA de `public_html/`
- [ ] Startup file correcto no UI (app.js / server.js)
- [ ] `app.listen(process.env.PORT)` — sem porta hardcoded
- [ ] Env vars definidas no UI (nao em .env commitado)
- [ ] Deps instaladas via `npm ci` dentro do virtualenv
- [ ] `package-lock.json` commitado
- [ ] `data/` e `uploads/` em `.gitignore` e excluidos do cp
- [ ] `.cpanel.yml` com venv-activate + npm ci + touch tmp/restart.txt numa linha
- [ ] Path do venv no .cpanel.yml corresponde a versao Node seleccionada no UI
- [ ] SSL activo (AutoSSL)

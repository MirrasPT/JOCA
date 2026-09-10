---
name: deploy-cpanel
description: "Deploy Laravel/PHP or Node.js apps to cPanel, shared hosting, or traditional hosting environments. MUST be invoked when the user says: shared hosting, public_html, FTP, phpMyAdmin, .htaccess, Passenger, Node.js cPanel, Setup Node.js App. SHOULD also invoke when: cheap hosting, hosting, traditional hosting, cpanel deploy, deploy cpanel, file manager, simple hosting, restart.txt, nodevenv."
triggers: shared hosting, public_html, FTP, phpMyAdmin, .htaccess, cheap hosting, hosting, traditional hosting, cpanel deploy, deploy cpanel, file manager, simple hosting, Passenger, Node.js cPanel, Setup Node.js App, restart.txt, nodevenv
chain: deploy-executor
---
# Deploy — cPanel

Deploy Laravel/PHP and Node.js (Passenger) on cPanel. Workarounds for shared hosting.

> **WordPress?** This skill covers code. Moving WP **content** (DB+uploads) from local/Docker to
> shared hosting without SSH/WP-CLI has its own pipeline (All-in-One WP Migration + FTP of the `.wpress` +
> restore through wp-admin + caches) → `Read(".claude/skills/wordpress-router.md")`, section "Content
> migration". Do not improvise: it already cost hours once.

---

## Folder structure (CRITICAL — both stacks)

**Laravel/PHP:**
```
/home/username/
├── laravel/              <- the whole Laravel project (OUTSIDE public_html)
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── vendor/
│   └── ...
└── public_html/          <- ONLY the contents of Laravel public/
    ├── index.php          <- corrected paths
    ├── .htaccess
    └── assets/
```

**Node.js (Passenger):**
```
/home/username/
├── myapp/                <- app root (OUTSIDE public_html; set in the UI)
│   ├── app.js            <- startup file
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   ├── data/             <- SQLite + uploads (never inside public/)
│   ├── public/           <- created automatically by Passenger
│   └── tmp/              <- restart.txt goes here
└── public_html/          <- do not touch this for Node apps
```

**NEVER put the project root inside `public_html/`** — it exposes `.env`, config, code, and the database.

---

## Laravel/PHP

### Fix index.php

Copy `laravel/public/*` to `public_html/`, fix the paths in `public_html/index.php`:

```php
// Laravel < 11
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require_once __DIR__.'/../laravel/bootstrap/app.php';

// Laravel 11+
// Update the maintenance file path and the autoloader path
```

---

### .htaccess security

In `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Block sensitive files
<FilesMatch "\.(env|log|json|lock|config|yml|yaml|xml)$">
    Order allow,deny
    Deny from all
</FilesMatch>
```

---

### Deploy methods (Laravel)

#### A. File upload (no SSH)
1. Upload via File Manager or FTP to `/home/username/laravel/`
2. Copy `public/` to `public_html/`
3. Fix `index.php`
4. Permissions: `storage/` and `bootstrap/cache/` = 775

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
2. Repo URL (SSH for private ones)
3. Add the cPanel deploy key to GitHub
4. Create `.cpanel.yml` at the repo root:

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

**Limitation:** `.cpanel.yml` uses `cp` not `rsync` — files deleted from the repo are NOT removed from the server.

---

### Laravel workarounds (no SSH)

#### Storage symlink
Create `public_html/symlink.php`:
```php
<?php
symlink('/home/username/laravel/storage/app/public', '/home/username/public_html/storage');
echo 'done';
```
Open it in the browser once, then delete it.

#### Artisan commands
```php
// routes/web.php (temporary)
Route::get('/run-migrate', function() {
    \Artisan::call('migrate', ['--force' => true]);
    return \Artisan::output();
});
```
Run it once, then remove it.

---

### Scheduler and queues

#### Scheduler (cPanel → Cron Jobs)
```
* * * * *   /usr/local/bin/php /home/username/laravel/artisan schedule:run >> /dev/null 2>&1
```

#### Queue workers (shared hosting)
```
* * * * *   /usr/local/bin/php /home/username/laravel/artisan queue:work --stop-when-empty --tries=3 --timeout=90
```
`--stop-when-empty` is CRITICAL — it prevents long-running processes that cPanel kills.

Use `QUEUE_CONNECTION=database` if Redis is unavailable.

---

### PHP version

- cPanel → MultiPHP Manager → select the version per domain
- Check the CLI: `php -v` via SSH
- `.user.ini` in `public_html/` to override settings

---

### SSL

- AutoSSL (Let's Encrypt): cPanel → SSL/TLS → AutoSSL (automatic)
- Manual: cPanel → SSL/TLS → Install SSL Certificate

---

### Database (MySQL)

- Create: cPanel → MySQL Databases → Create Database + Create User + Add User to Database
- Names are prefixed with the cPanel username (e.g. `john_myapp`, not `myapp`)
- Import: phpMyAdmin → select the DB → Import → upload the `.sql`
- `.env`: `DB_HOST=localhost`, `DB_USERNAME=cpanel_prefix_user`

---

## Node.js apps on cPanel (Passenger)

cPanel uses Phusion Passenger + CloudLinux Node.js Selector. Passenger replaces PM2/forever — do not run your own process manager.

### 1. Create the app in the UI

cPanel → **Setup Node.js App** → Create Application:

| Field | Value |
|-------|-------|
| Node.js version | the version you want (e.g. 20) |
| Application mode | Production |
| Application root | `myapp` (relative to `/home/username/`) — OUTSIDE public_html |
| Application URL | domain or subdomain |
| Application startup file | `app.js` (or `server.js`) — the app's entry point |

Passenger automatically creates `~/myapp/public/` and `~/myapp/tmp/` and configures the reverse proxy.

### 2. Startup file

The file set in "Application startup file" is the entry point. Critical rules:

```js
// CORRECT — Passenger injects PORT via env
app.listen(process.env.PORT);

// WRONG — a hardcoded port stops Passenger from working
app.listen(3000);
```

Renaming the file requires updating the field in the UI.

### 3. Environment variables

Add them in cPanel → Setup Node.js App → **Environment variables** (do not commit `.env`):

```
NODE_ENV=production
DB_PATH=/home/username/myapp/data/app.db
UPLOAD_DIR=/home/username/myapp/uploads
```

Passenger injects them into the process. Safer than an `.env` file and it survives restarts. dotenv works as a fallback but it is secondary.

### 4. Install dependencies (virtualenv)

Each app has an isolated virtualenv in `~/nodevenv/<app-root>/<version>/`. The exact activation command appears in the blue box on the setup page.

**Via SSH** (recommended for reproducibility):
```bash
source /home/username/nodevenv/myapp/20/bin/activate && cd /home/username/myapp
npm ci
```

`npm ci` is preferred over `npm install` — it installs exactly what is in `package-lock.json`. It requires `package-lock.json` to be committed.

Never run bare `npm` outside the virtualenv — it uses the wrong binary.

The "Run NPM Install" button in the UI is equivalent but less deterministic.

### 5. Restart

```bash
# Graceful restart (deploy-friendly, no downtime)
touch ~/myapp/tmp/restart.txt
```

Passenger does a rolling restart on the next request. It does not require UI access. The Restart button in the UI is the manual equivalent.

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

**Critical rules:**
- Tasks run as `sh`, one shell per line — chain venv-activate + cd + npm with `&&` on the same line
- `npm ci --omit=dev` for production (excludes devDependencies)
- Do NOT copy `node_modules/` from the repo
- Do NOT include `data/` or `uploads/` in the copy list (see Persistence below)
- The version number in the venv path (`/20/`) must match the one selected in the UI

### 7. Persistence — SQLite and uploads

Keep the database and uploads in the app root, OUTSIDE `public/`:

```
~/myapp/data/app.db      <- SQLite
~/myapp/uploads/         <- user files
```

Never inside `~/myapp/public/` — they would be served directly by the web.

**CRITICAL for a git deploy:** `.cpanel.yml` must not overwrite or delete these directories on every deploy. Exclude them from the `cp` list. Add to `.gitignore`:
```
data/
uploads/
```

### Node.js/Passenger gotchas

| Problem | Cause | Fix |
|----------|-------|-----|
| App does not start | Hardcoded port | `app.listen(process.env.PORT)` |
| `npm` uses the wrong version | Outside the virtualenv | `source .../nodevenv/.../bin/activate` before npm |
| Deploy wipes data | `.cpanel.yml` copies data/ | Exclude data/ and uploads/ from the cp |
| Restart does not work | tmp/ does not exist | `/bin/mkdir -p $DEPLOYPATH/tmp` in .cpanel.yml |
| Blank env vars | Set in .env instead of in the UI | Move them to Setup Node.js App → Environment variables |
| Wrong Node version in the venv | Path `/18/` vs `/20/` | Check the version in the UI and adjust the path in .cpanel.yml |

---

## Common pitfalls (Laravel/PHP)

| Problem | Cause | Fix |
|----------|-------|-----|
| `vendor` does not exist | Git ignores `vendor/` | Upload a zip + unzip, or `composer install` via SSH |
| Migrate does not run | No SSH | Temporary route workaround |
| Old files left on the server | `.cpanel.yml` uses `cp` not `rsync` | No native solution |
| Dead queue worker | The shared host kills long processes | `--stop-when-empty` |
| Wrong PHP version | MultiPHP not configured | cPanel MultiPHP Manager |
| `.env` exposed | Laravel root inside `public_html` | Move it outside |
| Wrong DB username | cPanel prefixes it with the account name | Use the full prefixed name |

---

## cPanel deploy checklist

### Laravel/PHP
- [ ] Laravel root OUTSIDE `public_html/`
- [ ] `index.php` paths fixed
- [ ] `.htaccess` with HTTPS redirect + file blocking
- [ ] Permissions: storage/ and bootstrap/cache/ = 775
- [ ] `.env` outside the web root
- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] Database created with a user + privileges
- [ ] Cron job for the scheduler configured
- [ ] SSL active (AutoSSL)
- [ ] Storage symlink created
- [ ] **Negative test run**: `.git/config`, `.env`, logs, internal docs and old versions of the
      deliverable return **403/404** on the public URL (200 = exposed credential, failed deploy)
- [ ] **Health-check by the BODY**, not just by the status — an API route returns JSON, not the HTML fallback
- [ ] The remote size of each entry point (HTML, JS/CSS bundle) matches the local one
> Full block of the 4 verification steps: `deploy-executor` agent, Step 4.

### Node.js (Passenger)
- [ ] App root set OUTSIDE `public_html/`
- [ ] Correct startup file in the UI (app.js / server.js)
- [ ] `app.listen(process.env.PORT)` — no hardcoded port
- [ ] Env vars set in the UI (not in a committed .env)
- [ ] Deps installed via `npm ci` inside the virtualenv
- [ ] `package-lock.json` committed
- [ ] `data/` and `uploads/` in `.gitignore` and excluded from the cp
- [ ] `.cpanel.yml` with venv-activate + npm ci + touch tmp/restart.txt on one line
- [ ] The venv path in .cpanel.yml matches the Node version selected in the UI
- [ ] SSL active (AutoSSL)

---
name: deploy-vps
description: "Deploy static sites, SPAs, PHP/LEMP apps or Docker apps to a Linux VPS behind Caddy, with Cloudflare DNS. MUST invoke when the user says: deploy VPS, VPS setup, Caddy server, Caddyfile, SSH key setup VPS, Cloudflare DNS API, scp upload site, static site VPS. SHOULD invoke when: fresh Ubuntu server, bootstrap SSH, ED25519 key, /var/www, site live, publish on the VPS, take a site offline, php_fastcgi, try_files, 403 in Caddy, publish under a subpath."
triggers: deploy VPS, VPS setup, Caddy, Caddyfile, caddy validate, caddy reload, SSH key VPS, Cloudflare DNS API, scp site, static site VPS, SPA on VPS, try_files, php_fastcgi, LEMP, fresh Ubuntu server, bootstrap SSH, ED25519 key, /var/www, publish to VPS, take a site offline, delete site VPS, configure server, caddy vhost, static hosting, 403 Caddy, basePath, subpath
origin: local
chain: deploy-executor
---
# Deploy VPS — Caddy + Cloudflare

Ubuntu VPS + Caddy v2 + Cloudflare DNS through the API. **One Caddyfile serves dozens of sites** — almost every
accident in this skill comes from that, or from file ownership/permissions.

**Reading order:** §0 (golden rule) → the vhost pattern for your case (§3x) → §4 permissions →
§6 verification. If you are **taking a site down**, go straight to §8.

---

## 0. Golden rule — the Caddyfile is shared infra

A syntax error in one block brings down **every** site in the file. Mandatory sequence, always:

```bash
ssh <host> "cp /etc/caddy/Caddyfile /root/Caddyfile.bak-$(date +%F-%H%M)"   # 1. dated backup
# 2. change ONE block
ssh <host> "caddy validate --config /etc/caddy/Caddyfile"                   # 3. validate BEFORE reloading
ssh <host> "systemctl reload caddy"                                         # 4. reload
# 5. check N sites, not just the one you touched
```

**Count the blast radius before touching anything** (`grep -c '^\S.*{' /etc/caddy/Caddyfile` ≈ number of blocks) and
say it out loud. An invalid `split_path` was once one reload away from taking down 22 sites; `caddy validate`
caught it in seconds.

> ⚠ **`split_path` is not a sub-directive of `php_fastcgi`** in every version — it breaks `validate`.
> Any directive you do not know: validate before believing it.

---

## 1. ED25519 SSH key (macOS/Linux — the normal route)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/<name>_id -N "" -C "joca@<host>"
ssh-copy-id -i ~/.ssh/<name>_id.pub root@<ip>        # if password access already exists
ssh-keygen -R <ip>                                   # clear the old known_hosts entry
ssh -i ~/.ssh/<name>_id -o StrictHostKeyChecking=accept-new root@<ip> "whoami"   # → root
```

"ECDSA vs ED25519 mismatch" → `ssh-keygen -R <ip>` always fixes it.

Once the key is in, harden: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`,
`MaxAuthTries 3` + `fail2ban`.

### 1b. Bootstrap from Windows (only if there is no `ssh-copy-id`)

Requires PuTTY (`winget install PuTTY.PuTTY`). `plink` refuses to connect without a host key, and it is not interactive:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\<name>_id" -N "" -C "joca@<host>"
$pubkey = Get-Content "$env:USERPROFILE\.ssh\<name>_id.pub"
plink -pw "<pass>" root@<ip> "echo test"        # fails, but prints the host SHA256
plink -pw "<pass>" -batch -hostkey "SHA256:<fingerprint>" root@<ip> `
  "mkdir -p ~/.ssh && echo '$pubkey' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
ssh-keygen -R <ip>
```

After the bootstrap you use **OpenSSH** (`ssh`/`scp`), not `plink` — plink only reads `.ppk` keys.

---

## 2. Install Caddy (Ubuntu)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy && sudo systemctl enable caddy
```

Caddy handles TLS (Let's Encrypt) on its own. It runs as the **`caddy`** user.

---

## 3. Choosing the vhost pattern

| What you are publishing | Section | Sign you chose wrong |
|---|---|---|
| HTML/CSS/JS with no router | §3a static | — |
| SPA (React Router, Vue Router) | §3b `try_files` | **404 when reloading a sub-route** |
| App in Docker, private on `127.0.0.1:<port>` | §3c reverse proxy | — |
| PHP app on the host (PHP-FPM + MySQL/MariaDB) | §3d LEMP | — |
| Laravel/Filament **+** SPA on the same domain | §3e same origin | Livewire 404, `/images` mixed up |

Picking `root`+`file_server` for an SPA is the most frequent mistake: `/` answers 200 and everything else
404s on a direct refresh or a shared link.

---

## 3a. Static vhost

```caddyfile
subdomain.example.com {
    root * /var/www/mysite
    file_server
    encode gzip
}
```

Internal preview? Add `header X-Robots-Tag "noindex,nofollow,noarchive"` **and** a
`/robots.txt` with `Disallow: /` — the header does not travel if there is a CDN in between.

## 3b. SPA vhost — `try_files` is mandatory

```caddyfile
app.example.com {
    root * /var/www/app
    encode gzip
    try_files {path} /index.html
    file_server
}
```

**The SPA health-check tests a deep sub-route** (`/wiki/cards`, `/admin/users`), never just `/`.
Without `try_files`, `/` is green and the app is broken.

## 3c. Docker app behind the system Caddy

The app publishes only on `127.0.0.1:<port>` (never `0.0.0.0`) and the **system** Caddy does the proxy + TLS —
not the Caddy embedded in the compose file, which would collide on 80/443. Static pages coexist via `handle`:

```caddyfile
app.example.com {
    encode gzip
    handle /privacy* {
        root * /var/www/app-static
        file_server
    }
    handle {
        reverse_proxy 127.0.0.1:8000
    }
}
```

> **Transient HTTP 525/502 with Cloudflare proxied:** the 1st request while Caddy is still issuing the
> cert returns 525 for a few seconds. Check again after 10-30 s before debugging. Behind the orange proxy
> `tls-alpn-01` never passes, and `http-01` 404s while the edges still have the old origin cached —
> wait ~3 min after changing DNS and only then `systemctl reload caddy`.

## 3d. LEMP — PHP app + MySQL on the host

Provisioning:

```bash
apt install -y mariadb-server php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml \
                php8.3-curl php8.3-intl php8.3-zip php8.3-bcmath php8.3-sqlite3
mysql -e "CREATE DATABASE app; CREATE USER 'app'@'localhost' IDENTIFIED BY '<pass>';
          GRANT ALL ON app.* TO 'app'@'localhost'; FLUSH PRIVILEGES;"
# password in a root-only file, never in the vhost or in the repo
```

> ⚠ **Strict `sql_mode` rejects schemas with zero-dates.** Symptom: the installer runs locally (permissive
> XAMPP) and blows up on the server. Fix it with a file at `/etc/mysql/mariadb.conf.d/99-<app>.cnf`
> (`sql_mode=NO_ENGINE_SUBSTITUTION`), not with `SET GLOBAL` — which does not survive a restart.

Vhost — `route{}` is Caddy's equivalent of `.htaccess`, and the **order matters**: the `respond 403`s
come before `php_fastcgi`, otherwise PHP serves what should have been denied.

```caddyfile
app.example.com {
    root * /var/www/app
    encode gzip
    route {
        respond /.env* 403
        respond /api/config/* 403
        respond /api/services/* 403
        php_fastcgi unix//run/php/php8.3-fpm.sock
        try_files {path} /index.html      # SPA on top of the PHP API
        file_server
    }
}
```

Confirm the real socket before writing it down: `ls /run/php/`. The name has the version inside it and it changes
with an `apt upgrade`.

> ⚠ **`php artisan tinker` / PsySH hangs over non-interactive `ssh`** (it waits on stdin;
> `--execute` returns empty). To run arbitrary PHP on the server: a script that bootstraps the
> framework with an **absolute** path (`__DIR__` resolves to `/tmp`, not to the app).

## 3e. Laravel/Filament + SPA on the same origin

A named matcher with the backend prefixes → `php_fastcgi`; everything else → SPA.

```caddyfile
app.example.com {
    root * /var/www/app/spa
    encode gzip
    @laravel path /api/* /sanctum/* /admin* /livewire* /storage/* /build/* /up
    handle @laravel {
        root * /var/www/app/backend/public
        php_fastcgi unix//run/php/php8.3-fpm.sock
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Measured pitfalls, all specific to this pattern:

| Pitfall | Effect | Fix |
|---|---|---|
| `/livewire/*` in the matcher | Livewire serves its JS at a hashed path (`/livewire/livewire.min.js?id=…`) that `/livewire/*` does **not** catch | use the glob `/livewire*` |
| `/images/*` exists on both sides | The backend's email/PDF logo collides with the SPA's assets | copy the backend ones into the SPA and serve everything from the SPA |
| Caddy matchers are case-**insensitive**; the Linux disk is case-sensitive | `redir /design /Design` also catches `/Design` → a 301 to itself | solve it with a **symlink on disk**, never with a redirect |
| Admin panel taken as verified because the login page returns 200 | The panel was unusable for a whole day | submit the login and confirm that `window.Livewire` initializes; check the `content-type` of the JS assets served, not just the status |

---

## 4. Sending files — and then ownership and permissions

### 4a. rsync (the normal route)

```bash
rsync -rlptzD --no-owner --no-group --delete --dry-run --itemize-changes local/ root@<ip>:/var/www/app/
rsync -rlptzD --no-owner --no-group --delete local/ root@<ip>:/var/www/app/
```

**`rsync -a` as root stamps the source uid** (macOS's 501) on the destination: `www-data` (uid 33)
can no longer write, and the CMS reads fine but blows up when saving from the panel. `--dry-run
--itemize-changes` is mandatory — it catches local cache and `.DS_Store` travelling by accident.

### 4b. tar over ssh (large bundles)

```bash
tar czf - -C dist . | ssh -i ~/.ssh/<name>_id root@<ip> "cd /var/www/app && rm -rf assets && tar xzf -"
```

### 4c. Ownership and permissions — the block that fixes the 403s

After **any** transfer. A bundle extracted with `tar` ends up `501:root` mode 600 and
Caddy returns **403 with every file in the right place**; rsync from macOS stamps
directories 700 and gives **403 on everything**.

```bash
# 1. modes — always
find /var/www/app -type d -exec chmod 755 {} \;
find /var/www/app -type f -exec chmod 644 {} \;

# 2. owner — depends on the stack
chown -R caddy:caddy /var/www/app                    # static site / pure SPA
chown -R www-data:www-data /var/www/app              # app served by PHP-FPM
chown -R 33:33 /dest                                 # Linux container (33 = www-data inside it)

# 3. app writes (Laravel)
chmod -R 775 /var/www/app/backend/storage /var/www/app/backend/bootstrap/cache
```

> ⚠ **PHP-FPM runs as `www-data`, not as `caddy`.** A reflex `chown -R caddy:caddy` over a
> PHP app puts `.env` at `caddy:caddy 640` → `www-data` cannot read it → **every** endpoint returns
> "Database connection failed" over HTTP while the CLI and root work fine. Fix:
> `chown www-data:www-data <app>/.env && chmod 640`.

> ⚠ **An `.env` read by `parse_ini_file` is INI:** comments take `;`, not `#`. A `#` with parentheses
> breaks the file and takes down every credential at once.

---

## 5. Publishing under a subpath (`/something` instead of the root)

Two defects of its own, both silent:

1. **The prefix is verified in the generated HTML, not in the configuration.** If `basePath` (Next) / `base`
   (Vite) fails, the build stays green and the published page loads **with no styles**:
   `curl -s https://host/sub/ | grep -o 'href="[^"]*\.css"'` must show the prefix.
2. **Capitals:** see §3e — symlink on disk, never `redir`.

---

## 6. Post-deploy verification (not optional)

1. **Compare remote vs local size file by file** and abort if they diverge. Never trust the exit
   code of the transfer client: a 41 KB `.css` has arrived with **0 bytes** and `curl` gave
   exit 0 — staging was left with no stylesheet at all.
2. **Derive the dependencies from the published HTML**, not from the list of what you sent. A script that
   forgot `form.css`/`form.js` came out all green with the site broken.
3. **The health-check checks the BODY, never just the status** — the SPA fallback returns **200 with HTML**
   for an API endpoint that does not exist.
4. **A new path in the app ⇒ look in the deploy script for the step that sends it.** If it does not exist, it is a
   deploy that passes and does not deliver (it happened: `/api/v1/health` updated, the `scp` of the `api/v1/` folder
   forgotten).
5. **Access bootstrap:** a deploy can go green with the panel unreachable. Confirm that there is
   ≥1 user with an admin role and that it **authenticates** — a `200` on `/login` does not prove an account exists.
6. **A deep sub-route** in the SPA (§3b) and **one asset** (not just the page).

### 6b. Cloudflare caches 404s (~4 h)

Negative caching: a **new** file requested once before it existed keeps returning the edge's 404
after it lands. "New names ⇒ no purge" holds for **replacements** and is false for
**additions**. Symptom: origin 200, public 404. Purging by URL requires the URL **with** the query string.

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### 6c. Probes that lie

Comparing what is deployed against the repo by `grep`ping a **minified** bundle proves nothing: comments are
stripped and identifiers minified. Every probe needs a **positive control** ("does this detect
something I KNOW is there?") — and a negative control, because a `respond 403` answers the same whether
the file exists or not. A reliable signal = rebuild the commit and compare hashes, after normalizing
line endings (CRLF changes the hash of the same code).

---

## 7. DNS through the Cloudflare API

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
  -H "Authorization: Bearer <CF_API_TOKEN>" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"<sub>","content":"<ip>","ttl":1,"proxied":true}'
```

`ZONE_ID`: dashboard → domain → Overview → API (right-hand side). Token: My Profile → API Tokens → "Edit
zone DNS". Proxied `true` → CDN + DDoS; `false` → pure DNS (IP exposed).

> ⚠ **When pointing an already existing domain, do not touch the EMAIL records** (MX, SPF, `mail`,
> `autoconfig`, SRV) — the mail is usually with another provider and it vanishes silently.
> ⚠ **Hand-written lists of subdomains go stale silently.** Query the API before claiming
> what exists.
> ⚠ **When reading a credentials file, extract only the key you need** — never print the
> structure. A filter by key name fails on nested blocks.

---

## 8. Taking a site offline (⛔ irreversible)

It touches **4 independent systems** and leaves orphans if you miss one. **Canonical order** — from what shouts
to what gets deleted:

| # | Layer | Command | Why in this order |
|---|---|---|---|
| 1 | Monitor (Uptime Kuma / equivalent) | delete the monitor | otherwise it beeps for the rest of the process |
| 2 | DNS (Cloudflare) | `DELETE .../dns_records/<id>` | takes the traffic away before the server stops answering |
| 3 | Block in the Caddyfile | backup → remove block → `caddy validate` → `reload` | §0 applies: the other sites are in this file |
| 4 | Files | `rm -rf /var/www/<site>` | last; it is the one that cannot be undone |

**Before:** inventory what falls with it (docroot and size, associated DB, cron, container, cert) and
show the list. A request like "delete these 5 URLs" is a **destructive infra operation across 4 layers**,
not a frontend task — confirm in 1 line before starting. A 366 MB gallery sitting under a docroot marked for
deletion has already been taken out, with the decision made knowingly.

**After:** check that the sites left behind still return 200.

---

## Gotchas

| Problem | Cause | Fix |
|---|---|---|
| Caddy 403 with the files in place | `tar` left 501:root 600; rsync from macOS left dirs 700 | §4c (`find -type d/f -exec chmod`) |
| "Database connection failed" only over HTTP | `chown caddy:caddy` on the `.env` of a PHP-FPM app | `chown www-data:www-data <app>/.env` |
| 404 on SPA sub-routes | missing `try_files {path} /index.html` | §3b |
| Livewire 404 | matcher `/livewire/*` | `/livewire*` |
| `caddy reload` takes down every site | invalid syntax (e.g. `split_path` out of place) | `caddy validate` first, always (§0) |
| Published page with no styles under a subpath | `basePath`/`base` not applied | check the prefix in the published HTML (§5) |
| 525/502 in the first seconds | LE cert still being issued behind the CF proxy | wait 10-30 s (§3c) |
| Origin 200, public 404 | CF negative caching on new files | purge (§6b) |
| plink refuses without a hostkey | non-interactive TOFU | `-hostkey "SHA256:…"` from the 1st error |
| SSH fails after the bootstrap | known_hosts with the old key | `ssh-keygen -R <ip>` |
| `tinker` hangs over ssh | PsySH waits on stdin | bootstrap script with an absolute path |

---

## VPS deploy checklist

- [ ] ED25519 key installed; key login tested (`whoami` = root)
- [ ] Caddy active (`systemctl status caddy`)
- [ ] Vhost pattern picked from the §3 table (static ≠ SPA ≠ LEMP ≠ same origin)
- [ ] Dated backup of the Caddyfile + `caddy validate` **before** the reload
- [ ] `rsync --dry-run --itemize-changes` run before the real rsync
- [ ] Modes 755/644 + the right owner for the stack (§4c); `.env` owned by `www-data` if there is PHP-FPM
- [ ] Remote sizes compared with the local ones
- [ ] Health-check on the **body**: page + asset + deep sub-route + API endpoint
- [ ] Panel access proven with a real login, not with a 200 on the form
- [ ] DNS record created; the domain's email records intact
- [ ] Cloudflare purge if there were **new** files
- [ ] Neighbouring sites in the Caddyfile checked at 200

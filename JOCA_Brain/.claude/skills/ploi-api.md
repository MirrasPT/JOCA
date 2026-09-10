---
name: ploi-api
description: "Control Ploi.io programmatically — REST API, `ploi` CLI, PHP SDK. MUST be invoked when the user says: ploi api, ploi cli, manage ploi server, create site on ploi, ploi ssh key, ssh key ploi, deploy script ploi, nginx config ploi, ploi token. SHOULD also invoke when: automate infra, provision site, add a key to the server, edit nginx, list servers, deploy webhook."
triggers: ploi api, ploi cli, ploi sdk, manage ploi server, create site on ploi, ploi ssh key, ssh key ploi, deploy script ploi, nginx config ploi, ploi token, automate infra, provision site, add a key to the server, edit nginx, list servers, ploi webhook, ploi.io api
chain: deploy-ploi, deploy-executor
---
# Ploi — programmatic control (API · CLI · SDK)

Manage the Ploi **account/infra** by code: servers, sites, SSH keys, deploy scripts, Nginx, DBs.
For the **deploy doctrine** (Laravel deploy script, zero-downtime, asset integrity) → `deploy-ploi.md`.

**Base URL:** `https://ploi.io/api/` · **Auth:** `Authorization: Bearer <token>` + `Accept: application/json`

---

## The 3 routes — choose deliberately

| Route | When | Hard limit |
|---|---|---|
| **CLI `ploi`** | Interactive use, manual deploy, `env:pull/push`, listing | **It does not manage SSH keys nor Nginx.** `repository:install` requires GitHub OAuth already connected |
| **REST API** (curl) | Everything else — it is the superset. The default route for automation | None known; it covers what the dashboard does |
| **PHP SDK** | Inside a PHP/Laravel app | `composer require ploi/ploi-php-sdk` |

⚠ **The CLI is not the ceiling of what can be done.** Hitting a CLI limit is **not** a blocker —
it is a signal to drop down to the REST API. One session gave "blocked, needs the dashboard" for adding an
SSH key; `POST /servers/{id}/ssh-keys` solved it in 1 call.

---

## Token

The CLI keeps it in **`~/.ploi/config.php`** (a PHP file, **not** JSON), key `'token' => '...'` (~1880 chars).

```bash
# extract into a variable — NEVER print the value
TOK=$(python3 -c "
import re
print(re.search(r\"'token'\s*=>\s*'([^']*)'\", open('$HOME/.ploi/config.php').read()).group(1))
")
curl -s -H "Authorization: Bearer $TOK" -H "Accept: application/json" https://ploi.io/api/servers
```

New token: `ploi token` (interactive) or ploi.io → Profile → API keys.

---

## Endpoint map (authoritative — extracted from the official SDK)

⚠ **The rule that causes 404s: endpoints in `kebab-case`, SDK methods in `camelCase`.**
`sshKeys()` → `/ssh-keys` · `systemUsers()` → `/system-users` · `nginxConfiguration()` → `/nginx-configuration`.
And there is one that does not even match the method name: **`cronjobs()` → `/crontabs`**.

**Server** — `servers/{server}/…`

| Resource | Endpoint |
|---|---|
| Sites | `/sites` |
| Databases | `/databases` (→ `/{db}/users`, `/{db}/backups`) |
| SSH keys | `/ssh-keys` |
| System users | `/system-users` |
| Cronjobs | `/crontabs` ⚠ |
| Daemons | `/daemons` |
| Services | `/services/{name}` (restart nginx/mysql/…) |
| Network rules | `/network-rules` |
| Load balancer | `/load-balancer` |
| Opcache / Insights | `/opcache` · `/insights` |

**Site** — `servers/{server}/sites/{site}/…`

| Resource | Endpoint |
|---|---|
| Deploy (trigger) | `POST /deploy` |
| Deploy script (read/write) | `GET`/`PUT /deploy/script` |
| Nginx config | `GET` / `PATCH /nginx-configuration` |
| SSL certificates | `/certificates` |
| Repository | `/repository` |
| Environment (`.env`) | `/environment` |
| Queues | `/queues` · Redirects `/redirects` · Aliases `/aliases` |
| FastCGI cache | `/fastcgi-cache` · Auth users `/auth-users` · Tenants `/tenants` |

**Top level:** `/projects` · `/scripts` · `/user` · `/webserver-templates` · `/backups/database` · `/backups/file`

**A 404 on an endpoint = wrong name, almost never "it does not exist".** Confirm against the SDK before concluding
absence: `gh repo clone ploi/ploi-php-sdk` → `src/Ploi/Resources/*.php` → `buildEndpoint()`.
(It cost me declaring `nginx-configuration` non-existent, after guessing `/nginx`, `/nginx/config`,
`/webserver`, `/vhost` — all 404. The resource existed.)

---

## Recipes verified live (2026-08-14)

### Self-authorize an SSH key (unblocks rsync/scp without the dashboard)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ploi_deploy -N "" -C "deploy-automation"

curl -s -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json;print(json.dumps({
      'name':'deploy-automation',
      'key':open('$HOME/.ssh/ploi_deploy.pub').read().strip(),
      'user':'ploi'}))")" \
  https://ploi.io/api/servers/{server}/ssh-keys        # → 201
```
Fields: `name` · `key` (public) · `user` (system user, typically `ploi`). It propagates in seconds.

⚠ **Ploi's SSH port is not 22** — it comes in `ssh_port` from `GET /servers` (e.g. `4213`).
The `ip_address` can be a **hostname**, not an IP.
```bash
ssh -i ~/.ssh/ploi_deploy -p <ssh_port> ploi@<ip_address>
```

### Read/write the deploy script

```bash
curl -s -H "Authorization: Bearer $TOK" .../sites/{site}/deploy/script      # GET
curl -s -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
     -d '{"deploy_script":"cd /home/ploi/site\ngit pull origin master\n"}' \
     .../sites/{site}/deploy/script
```
⚠ `PUT /deploy` → **405** (GET/HEAD/POST only — that one *triggers* the deploy). The script lives at `/deploy/script`,
and the body field is **`deploy_script`**, not `content`.

### Edit the Nginx config

`PATCH /sites/{site}/nginx-configuration` with `{"content": "<full config>"}`. The `GET` returns `{"content": …}`.

---

## Static site on Ploi

`project_type: "html"`, `web_directory: "/"`. **The default Nginx config (the PHP app one) already serves
statics correctly** — `index index.html` resolves `/sub/` → `sub/index.html` before the `/index.php`
fallback, which is never reached. There is no need to rewrite the Nginx to publish HTML; only for aesthetics.

A static site's deploy script does not take `composer install` nor a PHP-FPM reload:
```bash
cd /home/ploi/{domain}
git pull origin master
```

---

## Verification (gate, not optional)

A site created and with files on disk does **not** prove a published site:
```bash
curl -sI https://domain/           # 200 + valid certificate
curl -s  https://domain/ | grep -o "<title>[^<]*</title>"   # does it match the local file?
curl -sI https://domain/assets/x.jpg   # the assets too, not just the HTML
```
Let's Encrypt SSL can take a while to issue — report "SSL pending issue", not "it failed".

---

## Anti-patterns

| Wrong | Right |
|---|---|
| "The CLI does not have that command, so the dashboard is needed" | The CLI is a subset of the API. Try REST before declaring a blocker |
| Guessing the endpoint path until you hit it | Read the SDK's `src/Ploi/Resources/*.php` — `buildEndpoint()` is the truth |
| Assuming `camelCase` in the URL because the SDK method is like that | The URL is `kebab-case`; and `cronjobs()` → `/crontabs` |
| `PUT` on `/deploy` to save the script | `/deploy` triggers (POST); the script is `/deploy/script` |
| Assuming SSH port 22 | Read `ssh_port` from `GET /servers` |
| Printing the token to "confirm it was read" | Only the length (`${#TOK}`); the value never shows up in a transcript/report |
| Accepting "site created" as published | `curl` the public URL + an asset |
| Rewriting the Nginx to serve static HTML | The default already serves it; only touch it if there is a real reason |

---

## PHP SDK (inside a PHP app)

```php
$ploi = new \Ploi\Ploi($token);
$ploi->server(123)->sites(456)->deployment()->deploy();
$ploi->server(123)->sites(456)->nginxConfiguration()->update($config);
$ploi->server(123)->sshKeys()->create($name, $key, $user);
```
Fluent chaining (the ID is passed once), pagination `->page($n, $perPage)`, and **typed exceptions**
by status: `Unauthenticated` 401 · `NotFound` 404 · `NotAllowed` 405 · `NotValid` 422 ·
`TooManyAttempts` 429 · `InternalServerError` 500. Catch the specific one (above all `TooManyAttempts`
→ back off and retry), never a generic `\Exception`.
Response: `->getData()` (the `data` property) · `->getJson()` · `->toArray()`.

---

## Links

- `deploy-ploi.md` — deploy pipeline, zero-downtime, integrity of published assets
- `memory/tools/clis.md` — CLI installation/auth in the inventory
- SDK (endpoint map): `github.com/ploi/ploi-php-sdk` → `src/Ploi/Resources/`
- Docs: `developers.ploi.io` (⚠ it is only the HTTP API; it does not document the CLI installation)

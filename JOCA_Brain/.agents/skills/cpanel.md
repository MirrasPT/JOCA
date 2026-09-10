---
name: cpanel
description: Manage cPanel accounts (files, domains, DNS, email, databases, cron, SSL) via UAPI with an API token. Driver = .claude/scripts/cpanel.mjs reading creds from ~/.cpanel/<account>.json. Triggers cPanel, UAPI, addon domain, cPanel DNS zone, cPanel email account, manage hosting, create subdomain, cPanel redirect.
triggers:
  - cpanel
  - uapi
  - addon domain
  - manage hosting
  - cpanel email account
  - cpanel dns zone
  - create subdomain
  - cpanel database
chain: deploy-cpanel
---

# cPanel (UAPI)

Manage cPanel accounts from Windows via an **API token** (no password, revocable). Everything goes through the generic driver `.claude/scripts/cpanel.mjs`, which reads the credentials from `~/.cpanel/<account>.json` (outside git) and **never prints the token**.

## Setup (once per account)
1. cPanel → **Security → Manage API Tokens → Create** (Full Access or restricted).
2. Save it in `%USERPROFILE%\.cpanel\<account>.json`:
   ```json
   { "host": "<YOUR_CPANEL_HOST>", "port": 2083, "user": "<YOUR_CPANEL_USER>", "primaryDomain": "<YOUR_DOMAIN>", "token": "..." }
   ```
   The token lives only in this file (outside git), never in the chat/memory.

Configured accounts: `node .claude/scripts/cpanel.mjs accounts`. Multi-account: `--account=<name>`.

## Usage
```bash
# Generic passthrough — ANY UAPI module/function:
node .claude/scripts/cpanel.mjs uapi <Module> <function> [key=value ...] [--post]

# Read-only shortcuts:
node .claude/scripts/cpanel.mjs domains          # DomainInfo/list_domains
node .claude/scripts/cpanel.mjs email            # Email/list_pops
node .claude/scripts/cpanel.mjs dns <zone>       # DNS/parse_zone
node .claude/scripts/cpanel.mjs ls <dir>         # Fileman/list_files (relative to home)
node .claude/scripts/cpanel.mjs read <path>      # Fileman/get_file_content
```

**Rule:** **mutating** calls (create/delete/edit) → use `--post`. Output = raw JSON (`status:1` ok, `status:0` error → exit≠0).

## UAPI modules by domain

| Domain | Module · function |
|---|---|
| Files | `Fileman/list_files`, `get_file_content`, `save_file_content` (`--post`, params `dir`/`file`/`content`), `Fileman/copy`, `move`, `trash` |
| Domains | `DomainInfo/list_domains`, `SubDomain/addsubdomain`/`delsubdomain`, `AddonDomain/addaddondomain` |
| DNS | `DNS/parse_zone` (read), `DNS/mass_edit_zone` (edit — `--post`) |
| Email | `Email/list_pops`, `add_pop` (`email`,`password`,`quota`,`domain` — `--post`), `delete_pop`, `Email/add_forwarder`, `list_forwarders` |
| Databases | `Mysql/list_databases`, `create_database`, `create_user`, `set_privileges_on_database` (`--post`) |
| Cron | `Cron/list_cron`, `Cron/add_line` (`--post`) |
| SSL | `SSL/list_certs`, `SSL/install_ssl` (`--post`) |
| Redirects | `Mime/add_redirect` (`--post`) |

> Full list of UAPI modules: `https://api.docs.cpanel.net/cpanel/introduction/` (reference; confirm the exact function + params against the docs before a new mutating call — do not invent function names).

## Irreversible
Deleting an email/DB/domain, editing a DNS zone, installing SSL → **1 line of confirmation** first (`soul.md` gate). Read-only (`list_*`, `parse_zone`, `get_file_content`) → run without asking.

## SSH / SFTP
Account `<YOUR_CPANEL_USER>`: ED25519 key in `~/.ssh/cpanel_<account>` (authorized in cPanel, named `JOCA`), **port 22**.
- **Interactive shell DISABLED** by the host (`Shell access is not enabled`) → `git`/`mysql`/scripts on the server need a **ticket to the hosting provider** asking to "enable shell/SSH access".
- **SFTP WORKS** even with the shell off — use it for upload/download/bulk and file deploys:
  ```bash
  KEY=~/.ssh/cpanel_<account>; HOST=<YOUR_CPANEL_HOST>; USR=<YOUR_CPANEL_USER>
  printf 'put -r dist/* public_html/\n' | sftp -i "$KEY" -P 22 -o BatchMode=yes "$USR@$HOST"
  # "post-quantum key exchange" warnings are noise (stderr), ignore them.
  ```
- Prefer **SFTP** for binaries/deploys (the multipart `Fileman/upload_files` is not in the driver) and **UAPI** for management (DNS/email/DB/cron).

## Limits
- Token = **cPanel user** level (1 account). Managing *multiple* accounts / server config needs the **WHM API** (root/reseller) — not the case for this account.
- No shell: nothing runs *on* the server (only transfer via SFTP + management via UAPI). Ask the host for a shell if `git pull`/migrations on the server are needed.
- **Create/delete an addon domain: UAPI fails → use API2.** On some shared hosts (cPanel 130/134) the UAPI modules `AddonDomain`/`Domains`/`Park` **do not load** (`Can't locate Cpanel/API/*.pm`). The fallback that works = **API2** via direct curl (the `cpanel.mjs` driver only does UAPI `/execute/`):
  ```bash
  read HOST USER TOKEN <<<"$(node -e "const c=require(require('os').homedir()+'/.cpanel/<acc>.json');process.stdout.write(c.host+' '+c.user+' '+c.token)")"
  # create:  newdomain=<dom> subdomain=<short-label> dir=<docroot-rel-home>
  curl -s "https://$HOST:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=addaddondomain&newdomain=ex.pt&subdomain=expt&dir=ex.pt" -H "Authorization: cpanel $USER:$TOKEN"
  # delete (keeps files): domain=<dom> subdomain=<label>_<maindomain>
  curl -s "https://$HOST:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=deladdondomain&domain=ex.pt&subdomain=expt_<YOUR_DOMAIN>" -H "Authorization: cpanel $USER:$TOKEN"
  ```
  API2 envelope = `cpanelresult.data[].result:1`. `deladdondomain` removes the vhost/subdomain/local zone but **does not delete the docroot**. Standalone subdomain: API2 `SubDomain/delsubdomain&domain=<sub>_<rootdomain>` (the `domainkey`, e.g. `app_example.pt` — get it from `SubDomain/listsubdomains`). User-level AutoSSL: UAPI `SSL/start_autossl_check --post` (status:1 = queued; it issues the cert as soon as the domain resolves + serves HTTP). The DNS for this account's `.pt`/etc. domains lives on **Cloudflare** (not in the cPanel zone) → create an A record `<YOUR_SERVER_IP>` (+ www) via the Cloudflare API.
- **Deleting files: UAPI `Fileman/trash` does not exist; `fileop unlink` only deletes FILES (a silent no-op on a non-empty dir, and it returns `result:1` all the same).** Deleting a docroot recursively = **SFTP** (`-rm`/`-rmdir`, the `-` prefix = carry on through errors; **rmdir is bottom-up**, deepest-first). ⚠ Files with **spaces** in the name → SFTP commands must be **quoted** (`-rm "…/a b.svg"`); generate the batch from the remote `ls`, not from the local `find` (the local backup may miss names with spaces). Check with `ls` at the end — a failed rmdir leaves the folder with leftovers.
- **Cloudflare caches the `404→index.html` BEFORE the asset exists.** In a docroot with an `.htaccess` SPA-rewrite (fallback `index.html`), an asset requested before the upload returns `index.html` (HTTP 200) and Cloudflare **caches that** (`Cf-Cache-Status: HIT`, long `max-age`). After the upload, the URL keeps serving HTML. **Misleading symptom:** `curl` on a binary asset returns `content-type: text/html` (it looks like a failed upload, but the file is there). Diagnosis: `curl '<url>?cb=RANDOM'` (cache-buster) → shows the real origin. Fix: serve **versioned** URLs (`?v=N`) or purge the CF cache. Applies to any static/SPA site behind Cloudflare. (Source: real case 2026-06-27.)
- **DB dump without a shell:** `getsqlbackup/<db>.sql.gz` gives **Forbidden** with a token (it needs a session). Instead: (1) UAPI `Mysql/add_host host=<my-public-ip> --post` (Remote MySQL whitelist), (2) connect from outside with `mysql2` (node) reading the creds from the app's `.env`/`config`, dump via `SHOW CREATE TABLE` + `SELECT *`, (3) **remove the whitelist** `Mysql/delete_host host=<ip> --post` at the end. Deleting a DB = `Mysql/delete_database name=<db>` + `Mysql/delete_user name=<user>` (`--post`).

## Chain
`deploy-cpanel` — site deploy to this account (FTP/git). This skill manages the infra (DNS/email/subdomains); `deploy-cpanel` publishes the code.

---
name: cpanel
description: Gerir contas cPanel (ficheiros, domínios, DNS, email, bases de dados, cron, SSL) via UAPI com API token. Driver = .claude/scripts/cpanel.mjs lendo creds de ~/.cpanel/<account>.json. Triggers cPanel, UAPI, addon domain, zona DNS cPanel, conta de email cPanel, gerir hosting, stableserver, criar subdomínio, redirect cPanel.
triggers:
  - cpanel
  - uapi
  - addon domain
  - gerir hosting
  - conta de email cpanel
  - zona dns cpanel
  - criar subdominio
  - cpanel database
chain: deploy-cpanel
---

# cPanel (UAPI)

Gerir contas cPanel a partir do Windows via **API token** (sem password, revogável). Tudo passa pelo driver genérico `.claude/scripts/cpanel.mjs`, que lê as credenciais de `~/.cpanel/<account>.json` (fora do git) e **nunca imprime o token**.

## Setup (1 vez por conta)
1. cPanel → **Security → Manage API Tokens → Create** (Full Access ou restrito).
2. Guardar em `C:\Users\renat\.cpanel\<account>.json`:
   ```json
   { "host": "s4835.lux1.stableserver.net", "port": 2083, "user": "renatoferreira", "primaryDomain": "renatoferreira.org", "token": "..." }
   ```
   O token vive só neste ficheiro (fora do git), nunca no chat/memória.

Contas configuradas: `node .claude/scripts/cpanel.mjs accounts`. Multi-conta: `--account=<name>`.

## Uso
```bash
# Passthrough genérico — QUALQUER módulo/função UAPI:
node .claude/scripts/cpanel.mjs uapi <Module> <function> [key=value ...] [--post]

# Atalhos read-only:
node .claude/scripts/cpanel.mjs domains          # DomainInfo/list_domains
node .claude/scripts/cpanel.mjs email            # Email/list_pops
node .claude/scripts/cpanel.mjs dns <zone>       # DNS/parse_zone
node .claude/scripts/cpanel.mjs ls <dir>         # Fileman/list_files (relativo à home)
node .claude/scripts/cpanel.mjs read <path>      # Fileman/get_file_content
```

**Regra:** chamadas **mutadoras** (criar/apagar/editar) → usar `--post`. Saída = JSON cru (`status:1` ok, `status:0` erro → exit≠0).

## Módulos UAPI por domínio

| Domínio | Módulo · função |
|---|---|
| Ficheiros | `Fileman/list_files`, `get_file_content`, `save_file_content` (`--post`, params `dir`/`file`/`content`), `Fileman/copy`, `move`, `trash` |
| Domínios | `DomainInfo/list_domains`, `SubDomain/addsubdomain`/`delsubdomain`, `AddonDomain/addaddondomain` |
| DNS | `DNS/parse_zone` (ler), `DNS/mass_edit_zone` (editar — `--post`) |
| Email | `Email/list_pops`, `add_pop` (`email`,`password`,`quota`,`domain` — `--post`), `delete_pop`, `Email/add_forwarder`, `list_forwarders` |
| Bases de dados | `Mysql/list_databases`, `create_database`, `create_user`, `set_privileges_on_database` (`--post`) |
| Cron | `Cron/list_cron`, `Cron/add_line` (`--post`) |
| SSL | `SSL/list_certs`, `SSL/install_ssl` (`--post`) |
| Redirects | `Mime/add_redirect` (`--post`) |

> Lista completa de módulos UAPI: `https://api.docs.cpanel.net/cpanel/introduction/` (referência; confirmar a função exacta + params contra a doc antes de uma chamada mutadora nova — não inventar nomes de função).

## Irreversível
Apagar email/BD/domínio, editar zona DNS, instalar SSL → **1 linha de confirmação** antes (gate `soul.md`). Read-only (`list_*`, `parse_zone`, `get_file_content`) → corre sem perguntar.

## SSH / SFTP
Conta `renatoferreira` (stableserver): chave ED25519 em `~/.ssh/cpanel_renatoferreira` (autorizada no cPanel, nome `JOCA`), **porta 22**.
- **Shell interactivo DESACTIVADO** pelo host (`Shell access is not enabled`) → `git`/`mysql`/scripts no servidor precisam de **ticket ao stableserver** a pedir "enable shell/SSH access".
- **SFTP FUNCIONA** mesmo com shell off — usar para upload/download/bulk e deploy de ficheiros:
  ```bash
  KEY=~/.ssh/cpanel_renatoferreira; HOST=s4835.lux1.stableserver.net; USR=renatoferreira
  printf 'put -r dist/* public_html/\n' | sftp -i "$KEY" -P 22 -o BatchMode=yes "$USR@$HOST"
  # avisos "post-quantum key exchange" são ruído (stderr), ignorar.
  ```
- Preferir **SFTP** para binário/deploy (o `Fileman/upload_files` multipart não está no driver) e **UAPI** para gestão (DNS/email/BD/cron).

## Limites
- Token = nível **utilizador cPanel** (1 conta). Gerir *múltiplas* contas / config de servidor precisa de **WHM API** (root/reseller) — não é o caso desta conta.
- Sem shell: nada corre *no* servidor (só transferência via SFTP + gestão via UAPI). Pedir shell ao host se for preciso `git pull`/migrations no servidor.
- **Criar/apagar addon domain: UAPI falha → usar API2.** Neste host (stableserver, cPanel 130/134) os módulos UAPI `AddonDomain`/`Domains`/`Park` **não carregam** (`Can't locate Cpanel/API/*.pm`). Fallback que funciona = **API2** via curl directo (o driver `cpanel.mjs` só faz UAPI `/execute/`):
  ```bash
  read HOST USER TOKEN <<<"$(node -e "const c=require(require('os').homedir()+'/.cpanel/<acc>.json');process.stdout.write(c.host+' '+c.user+' '+c.token)")"
  # criar:  newdomain=<dom> subdomain=<label-curto> dir=<docroot-rel-home>
  curl -s "https://$HOST:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=addaddondomain&newdomain=ex.pt&subdomain=expt&dir=ex.pt" -H "Authorization: cpanel $USER:$TOKEN"
  # apagar (mantém ficheiros): domain=<dom> subdomain=<label>_<maindomain>
  curl -s "https://$HOST:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=deladdondomain&domain=ex.pt&subdomain=expt_renatoferreira.org" -H "Authorization: cpanel $USER:$TOKEN"
  ```
  Envelope API2 = `cpanelresult.data[].result:1`. `deladdondomain` remove vhost/subdomínio/zona-local mas **não apaga o docroot**. Subdomínio standalone: API2 `SubDomain/delsubdomain&domain=<sub>_<rootdomain>` (a `domainkey`, ex.: `app_rateitplus.pt` — obter de `SubDomain/listsubdomains`). AutoSSL user-level: UAPI `SSL/start_autossl_check --post` (status:1 = queued; emite cert assim que o domínio resolve + serve HTTP). DNS desta conta de domínios `.pt`/etc. vive no **Cloudflare** (não na zona cPanel) → criar A record `194.42.98.200` (+ www) via Cloudflare API.
- **Apagar ficheiros: UAPI `Fileman/trash` não existe; `fileop unlink` só apaga FICHEIROS (no-op silencioso em dir não-vazia, devolve `result:1` na mesma).** Apagar docroot recursivamente = **SFTP** (`-rm`/`-rmdir`, prefixo `-` = continua em erro; **rmdir é bottom-up**, deepest-first). ⚠ Ficheiros com **espaços** no nome → comandos SFTP têm de ser **quoted** (`-rm "…/a b.svg"`); gerar a batch a partir do `ls` remoto, não do `find` local (o backup local pode falhar nomes com espaços). Verificar com `ls` no fim — uma rmdir falhada deixa a pasta com sobras.
- **Cloudflare cacheia o `404→index.html` ANTES do asset existir.** Em docroot com `.htaccess` SPA-rewrite (fallback `index.html`), um asset acedido antes do upload devolve `index.html` (HTTP 200) e o Cloudflare **cacheia isso** (`Cf-Cache-Status: HIT`, `max-age` longo). Depois do upload, o URL continua a servir HTML. **Sintoma enganador:** `curl` a um asset binário devolve `content-type: text/html` (parece upload falhado, mas o ficheiro está lá). Diagnóstico: `curl '<url>?cb=RANDOM'` (cache-buster) → vê o origin real. Fix: servir URLs **versionados** (`?v=N`) ou purgar a cache CF. Aplica-se a qualquer site static/SPA atrás de Cloudflare. (Fonte: royal-douro 2026-06-27.)
- **Dump de BD sem shell:** `getsqlbackup/<db>.sql.gz` dá **Forbidden** com token (precisa de sessão). Em vez disso: (1) UAPI `Mysql/add_host host=<meu-ip-público> --post` (Remote MySQL whitelist), (2) ligar de fora com `mysql2` (node) lendo creds do `.env`/`config` do app, dump por `SHOW CREATE TABLE` + `SELECT *`, (3) **remover a whitelist** `Mysql/delete_host host=<ip> --post` no fim. Apagar BD = `Mysql/delete_database name=<db>` + `Mysql/delete_user name=<user>` (`--post`).

## Chain
`deploy-cpanel` — deploy de site para esta conta (FTP/git). Esta skill gere a infra (DNS/email/subdomínios); `deploy-cpanel` publica o código.

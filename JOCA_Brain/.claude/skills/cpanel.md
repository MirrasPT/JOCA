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

## Chain
`deploy-cpanel` — deploy de site para esta conta (FTP/git). Esta skill gere a infra (DNS/email/subdomínios); `deploy-cpanel` publica o código.

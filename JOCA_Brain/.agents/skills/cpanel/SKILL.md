---
name: cpanel
description: Gerir contas cPanel (ficheiros, domínios, DNS, email, bases de dados, cron, SSL) via UAPI com API token. Driver = .claude/scripts/cpanel.mjs lendo creds de ~/.cpanel/<account>.json. Triggers cPanel, UAPI, addon domain, zona DNS cPanel, conta de email cPanel, gerir hosting, criar subdomínio, redirect cPanel.
triggers:
  - email nao recebe
  - mx spf dkim cloudflare
  - autossl certificado
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
2. Guardar em `%USERPROFILE%\.cpanel\<account>.json` (macOS/Linux: `~/.cpanel/<account>.json`):
   ```json
   // <account> = nome do DOMÍNIO PRIMÁRIO da conta (ex.: exemplo.org.json), NÃO o utilizador cPanel.
   // Confirmar sempre com: node .claude/scripts/cpanel.mjs accounts
   { "host": "<YOUR_CPANEL_HOST>", "port": 2083, "user": "<YOUR_CPANEL_USER>", "primaryDomain": "<YOUR_DOMAIN>", "token": "..." }
   ```
   O token vive só neste ficheiro (fora do git), nunca no chat/memória.

⚠ **O nome do ficheiro é o do domínio primário da conta, não o do utilizador cPanel.** Assumir o utilizador dá `MODULE_NOT_FOUND` a meio de uma operação. Antes de qualquer `require(...~/.cpanel/....json)` ou `--account=`, listar os disponíveis: `node .claude/scripts/cpanel.mjs accounts`.

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

**Windows / Git Bash:** `export MSYS_NO_PATHCONV=1` antes de qualquer comando com caminho remoto absoluto (`/home/...`). Sem isto o MSYS converte o caminho POSIX e o servidor devolve um erro que parece dele — `The directory "/home/<user>/C:/...' does not exist`. O driver já avisa quando detecta o padrão, mas o `export` evita-o de todo.

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

## ⚠ Email + NS na Cloudflare — a zona local do cPanel NÃO é usada

**O DNS dos domínios desta conta vive na Cloudflare.** Quando os NS do domínio apontam para a Cloudflare, a zona que o cPanel gera (MX, SPF, DKIM, DMARC) é **ignorada pelo mundo**: `Email/add_pop` cria a caixa, o IMAP autentica, o webmail abre — **e não entra correio nenhum de fora**. Todos os testes locais passam; o defeito é silencioso e só aparece quando alguém repara que não chegam mensagens.

**Passo obrigatório: addon domain + NS na Cloudflare → replicar os 5 registos de correio na Cloudflare ANTES de dar a caixa por pronta.**

| # | Registo | Origem |
|---|---|---|
| 1 | `MX` do domínio | zona local do cPanel (prioridade incluída) |
| 2 | `A`/`CNAME` do host de mail (ex.: `mail.<dom>`) | zona local · **DNS-only na Cloudflare, nunca proxied** |
| 3 | `TXT` SPF (`v=spf1 …`) | zona local |
| 4 | `TXT` DKIM (`default._domainkey`) | zona local |
| 5 | `TXT` DMARC (`_dmarc`) | zona local |

Ler a zona local (a fonte dos 5 valores):
```bash
node .claude/scripts/cpanel.mjs dns <dominio>     # atalho: já descodifica base64
# ou cru:
node .claude/scripts/cpanel.mjs uapi DNS parse_zone zone=<dominio>
```
⚠ A UAPI `DNS/parse_zone` devolve `dname_b64` e `data_b64` em **base64** — sem descodificar, os campos parecem vazios/`undefined` e conclui-se (erradamente) que a zona não tem nada. O atalho `dns` já descodifica.

⚠ O módulo UAPI `DKIM` **não carrega neste host** (`Can't locate Cpanel/API/*.pm`) — o valor da chave DKIM tira-se do `TXT default._domainkey` da `parse_zone`, não de `DKIM/*`.

**Critério de pronto:** a caixa só se dá por pronta depois de os 5 registos existirem na Cloudflare *e* de um email enviado **de fora** chegar. Autenticação IMAP/webmail não prova recepção.

## Ordem DNS → AutoSSL (addon domain novo)

Domínio que **nunca apontou** para o cPanel serve um certificado **auto-assinado** (`subject == issuer`). Se o `.htaccess` publicado forçar HTTPS antes de existir cert válido, o site passa de «funciona em http» a **aviso de segurança do browser** no momento em que o DNS é reapontado — pior do que antes. Sequência fixa:

1. **Publicar os ficheiros** no docroot (site a funcionar em `http://`, sem redirect forçado).
2. **Reapontar o DNS** para `<YOUR_SERVER_IP>` (A + www; na Cloudflare, **DNS-only** durante a emissão — proxy laranja quebra o desafio HTTP-01).
3. `node .claude/scripts/cpanel.mjs uapi SSL start_autossl_check --post` (`status:1` = queued).
4. **Esperar e confirmar `issuer != subject`** antes de avançar:
   ```bash
   echo | openssl s_client -connect <dominio>:443 -servername <dominio> 2>/dev/null \
     | openssl x509 -noout -subject -issuer
   # issuer == subject → auto-assinado, AutoSSL ainda não emitiu. NÃO ligar o redirect.
   ```
5. **Só então** ligar o redirect HTTPS no `.htaccess`.

**Regra permanente do `.htaccess`:** `RewriteRule ^\.well-known/ - [L]` **antes** de qualquer redirect — senão o redirect engole o desafio do AutoSSL e a renovação falha em silêncio meses depois. Metade do `.htaccess` → skill `deploy-cpanel`.

## Irreversível
Apagar email/BD/domínio, editar zona DNS, instalar SSL → **1 linha de confirmação** antes (gate `soul.md`). Read-only (`list_*`, `parse_zone`, `get_file_content`) → corre sem perguntar.

## SSH / SFTP
Conta `<YOUR_CPANEL_USER>`: chave ED25519 em `~/.ssh/cpanel_<account>` (autorizada no cPanel, nome `JOCA`), **porta 22**.
- **Shell interactivo DESACTIVADO** pelo host (`Shell access is not enabled`) → `git`/`mysql`/scripts no servidor precisam de **ticket ao fornecedor de hosting** a pedir "enable shell/SSH access".
- **SFTP FUNCIONA** mesmo com shell off — usar para upload/download/bulk e deploy de ficheiros:
  ```bash
  KEY=~/.ssh/cpanel_<account>; HOST=<YOUR_CPANEL_HOST>; USR=<YOUR_CPANEL_USER>
  printf 'put -r dist/* public_html/\n' | sftp -i "$KEY" -P 22 -o BatchMode=yes "$USR@$HOST"
  # avisos "post-quantum key exchange" são ruído (stderr), ignorar.
  ```
- **Batch SFTP gerado a partir de uma lista:** a lista acaba em newline e lê-se com
  `while IFS= read -r f || [ -n "$f" ]` — sem isso o último ficheiro fica de fora em silêncio
  (2026-09-25, só o 404 no live o mostrou). No fim, contagem enviados = lista e **todos** os ficheiros
  conferidos contra o local (tamanho via `ls -l` no SFTP; hash quando houver shell), nunca por amostra.
  Receita: `deploy-cpanel` §Integridade da transferencia, passo 1b.
- **`posix-rename` não existe no `sftp` do macOS** e aborta o batch a meio (2026-09-25: código e
  imagens enviados, BD por trocar). Trocar ficheiros com `rename` em 2 passos (actual → nome de
  reserva, novo → actual), nunca `posix-rename`.
- **Entrega de email prova-se no Maildir, por SFTP:** as mensagens recebidas ficam em
  `mail/<dominio>/<caixa>/new`, comprimidas em gzip — descarregar e descomprimir para ler.
- Preferir **SFTP** para binário/deploy (o `Fileman/upload_files` multipart não está no driver) e **UAPI** para gestão (DNS/email/BD/cron).

## Limites
- Token = nível **utilizador cPanel** (1 conta). Gerir *múltiplas* contas / config de servidor precisa de **WHM API** (root/reseller) — não é o caso desta conta.
- Sem shell: nada corre *no* servidor (só transferência via SFTP + gestão via UAPI). Pedir shell ao host se for preciso `git pull`/migrations no servidor.
- **Criar/apagar addon domain: UAPI falha → usar API2.** Nalguns hosts partilhados (cPanel 130/134) os módulos UAPI `AddonDomain`/`Domains`/`Park` **não carregam** (`Can't locate Cpanel/API/*.pm`). Fallback que funciona = **API2** via curl directo (o driver `cpanel.mjs` só faz UAPI `/execute/`):
  ```bash
  read HOST USER TOKEN <<<"$(node -e "const c=require(require('os').homedir()+'/.cpanel/<acc>.json');process.stdout.write(c.host+' '+c.user+' '+c.token)")"
  # criar:  newdomain=<dom> subdomain=<label-curto> dir=<docroot-rel-home>
  curl -s "https://$HOST:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=addaddondomain&newdomain=ex.pt&subdomain=expt&dir=ex.pt" -H "Authorization: cpanel $USER:$TOKEN"
  # apagar (mantém ficheiros): domain=<dom> subdomain=<label>_<maindomain>
  curl -s "https://$HOST:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=deladdondomain&domain=ex.pt&subdomain=expt_<YOUR_DOMAIN>" -H "Authorization: cpanel $USER:$TOKEN"
  ```
  Envelope API2 = `cpanelresult.data[].result:1`. `deladdondomain` remove vhost/subdomínio/zona-local mas **não apaga o docroot**. Subdomínio standalone: API2 `SubDomain/delsubdomain&domain=<sub>_<rootdomain>` (a `domainkey`, ex.: `app_example.pt` — obter de `SubDomain/listsubdomains`). AutoSSL user-level: UAPI `SSL/start_autossl_check --post` (status:1 = queued; emite cert assim que o domínio resolve + serve HTTP). DNS desta conta de domínios `.pt`/etc. vive no **Cloudflare** (não na zona cPanel) → criar A record `<YOUR_SERVER_IP>` (+ www) via Cloudflare API.
- **Apagar ficheiros: UAPI `Fileman/trash` não existe; `fileop unlink` só apaga FICHEIROS (no-op silencioso em dir não-vazia, devolve `result:1` na mesma).** Apagar docroot recursivamente = **SFTP** (`-rm`/`-rmdir`, prefixo `-` = continua em erro; **rmdir é bottom-up**, deepest-first). ⚠ Ficheiros com **espaços** no nome → comandos SFTP têm de ser **quoted** (`-rm "…/a b.svg"`); gerar a batch a partir do `ls` remoto, não do `find` local (o backup local pode falhar nomes com espaços). Verificar com `ls` no fim — uma rmdir falhada deixa a pasta com sobras.
- **Cloudflare cacheia o `404→index.html` ANTES do asset existir.** Em docroot com `.htaccess` SPA-rewrite (fallback `index.html`), um asset acedido antes do upload devolve `index.html` (HTTP 200) e o Cloudflare **cacheia isso** (`Cf-Cache-Status: HIT`, `max-age` longo). Depois do upload, o URL continua a servir HTML. **Sintoma enganador:** `curl` a um asset binário devolve `content-type: text/html` (parece upload falhado, mas o ficheiro está lá). Diagnóstico: `curl '<url>?cb=RANDOM'` (cache-buster) → vê o origin real. Fix: servir URLs **versionados** (`?v=N`) ou purgar a cache CF. Aplica-se a qualquer site static/SPA atrás de Cloudflare. (Fonte: caso real 2026-06-27.)
- **Dump de BD sem shell:** `getsqlbackup/<db>.sql.gz` dá **Forbidden** com token (precisa de sessão). Em vez disso: (1) UAPI `Mysql/add_host host=<meu-ip-público> --post` (Remote MySQL whitelist), (2) ligar de fora com `mysql2` (node) lendo creds do `.env`/`config` do app, dump por `SHOW CREATE TABLE` + `SELECT *`, (3) **remover a whitelist** `Mysql/delete_host host=<ip> --post` no fim. Apagar BD = `Mysql/delete_database name=<db>` + `Mysql/delete_user name=<user>` (`--post`).

## Chain
`deploy-cpanel` — deploy de site para esta conta (FTP/git). Esta skill gere a infra (DNS/email/subdomínios); `deploy-cpanel` publica o código.

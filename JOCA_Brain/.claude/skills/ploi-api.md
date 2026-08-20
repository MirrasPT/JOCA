---
name: ploi-api
description: "Controlar o Ploi.io programaticamente — API REST, CLI `ploi`, SDK PHP. MUST be invoked when the user says: ploi api, ploi cli, gerir servidor ploi, criar site no ploi, chave ssh ploi, ssh key ploi, deploy script ploi, nginx config ploi, token ploi. SHOULD also invoke when: automatizar infra, provisionar site, adicionar chave ao servidor, editar nginx, listar servidores, webhook de deploy."
triggers: ploi api, ploi cli, ploi sdk, gerir servidor ploi, criar site no ploi, chave ssh ploi, ssh key ploi, deploy script ploi, nginx config ploi, token ploi, automatizar infra, provisionar site, adicionar chave ao servidor, editar nginx, listar servidores, ploi webhook, ploi.io api
chain: deploy-ploi, deploy-executor
---
# Ploi — controlo programático (API · CLI · SDK)

Gerir a **conta/infra** Ploi por código: servidores, sites, chaves SSH, deploy scripts, Nginx, BDs.
Para a **doutrina de deploy** (deploy script Laravel, zero-downtime, integridade de assets) → `deploy-ploi.md`.

**Base URL:** `https://ploi.io/api/` · **Auth:** `Authorization: Bearer <token>` + `Accept: application/json`

---

## As 3 vias — escolher de propósito

| Via | Quando | Limite duro |
|---|---|---|
| **CLI `ploi`** | Uso interactivo, deploy manual, `env:pull/push`, listar | **Não gere chaves SSH nem Nginx.** `repository:install` exige OAuth do GitHub já ligado |
| **API REST** (curl) | Tudo o resto — é o superset. Via por omissão para automação | Nenhum conhecido; cobre o que o dashboard faz |
| **SDK PHP** | Dentro de uma app PHP/Laravel | `composer require ploi/ploi-php-sdk` |

⚠ **O CLI não é o tecto do que se consegue fazer.** Bater num limite do CLI **não** é bloqueio —
é sinal para descer à API REST. Uma sessão deu "bloqueado, precisa do dashboard" para adicionar uma
chave SSH; o `POST /servers/{id}/ssh-keys` resolveu em 1 chamada.

---

## Token

O CLI guarda-o em **`~/.ploi/config.php`** (ficheiro PHP, **não** JSON), chave `'token' => '...'` (~1880 chars).

```bash
# extrair para variável — NUNCA imprimir o valor
TOK=$(python3 -c "
import re
print(re.search(r\"'token'\s*=>\s*'([^']*)'\", open('$HOME/.ploi/config.php').read()).group(1))
")
curl -s -H "Authorization: Bearer $TOK" -H "Accept: application/json" https://ploi.io/api/servers
```

Token novo: `ploi token` (interactivo) ou ploi.io → Profile → API keys.

---

## Mapa de endpoints (autoritativo — extraído do SDK oficial)

⚠ **A regra que causa 404s: endpoints em `kebab-case`, métodos do SDK em `camelCase`.**
`sshKeys()` → `/ssh-keys` · `systemUsers()` → `/system-users` · `nginxConfiguration()` → `/nginx-configuration`.
E há um que nem sequer bate com o nome do método: **`cronjobs()` → `/crontabs`**.

**Servidor** — `servers/{server}/…`

| Recurso | Endpoint |
|---|---|
| Sites | `/sites` |
| Bases de dados | `/databases` (→ `/{db}/users`, `/{db}/backups`) |
| Chaves SSH | `/ssh-keys` |
| Utilizadores de sistema | `/system-users` |
| Cronjobs | `/crontabs` ⚠ |
| Daemons | `/daemons` |
| Serviços | `/services/{nome}` (restart de nginx/mysql/…) |
| Regras de rede | `/network-rules` |
| Load balancer | `/load-balancer` |
| Opcache / Insights | `/opcache` · `/insights` |

**Site** — `servers/{server}/sites/{site}/…`

| Recurso | Endpoint |
|---|---|
| Deploy (disparar) | `POST /deploy` |
| Deploy script (ler/escrever) | `GET`/`PUT /deploy/script` |
| Config Nginx | `GET` / `PATCH /nginx-configuration` |
| Certificados SSL | `/certificates` |
| Repositório | `/repository` |
| Ambiente (`.env`) | `/environment` |
| Filas | `/queues` · Redirects `/redirects` · Aliases `/aliases` |
| FastCGI cache | `/fastcgi-cache` · Auth users `/auth-users` · Tenants `/tenants` |

**Topo:** `/projects` · `/scripts` · `/user` · `/webserver-templates` · `/backups/database` · `/backups/file`

**404 num endpoint = nome errado, quase nunca "não existe".** Confirmar contra o SDK antes de concluir
ausência: `gh repo clone ploi/ploi-php-sdk` → `src/Ploi/Resources/*.php` → `buildEndpoint()`.
(Custou-me dar por inexistente o `nginx-configuration`, depois de adivinhar `/nginx`, `/nginx/config`,
`/webserver`, `/vhost` — todos 404. O recurso existia.)

---

## Receitas verificadas ao vivo (2026-08-14)

### Auto-autorizar uma chave SSH (desbloqueia rsync/scp sem dashboard)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ploi_deploy -N "" -C "deploy-automation"

curl -s -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json;print(json.dumps({
      'name':'deploy-automation',
      'key':open('$HOME/.ssh/ploi_deploy.pub').read().strip(),
      'user':'ploi'}))")" \
  https://ploi.io/api/servers/{server}/ssh-keys        # → 201
```
Campos: `name` · `key` (pública) · `user` (utilizador de sistema, tipicamente `ploi`). Propaga em segundos.

⚠ **A porta SSH do Ploi não é a 22** — vem no `ssh_port` do `GET /servers` (ex.: `4213`).
O `ip_address` pode ser um **hostname**, não um IP.
```bash
ssh -i ~/.ssh/ploi_deploy -p <ssh_port> ploi@<ip_address>
```

### Ler/escrever o deploy script

```bash
curl -s -H "Authorization: Bearer $TOK" .../sites/{site}/deploy/script      # GET
curl -s -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
     -d '{"deploy_script":"cd /home/ploi/site\ngit pull origin master\n"}' \
     .../sites/{site}/deploy/script
```
⚠ `PUT /deploy` → **405** (só GET/HEAD/POST — esse é o *disparar* deploy). O script vive em `/deploy/script`,
e o campo do body é **`deploy_script`**, não `content`.

### Editar a config Nginx

`PATCH /sites/{site}/nginx-configuration` com `{"content": "<config completa>"}`. O `GET` devolve `{"content": …}`.

---

## Site estático no Ploi

`project_type: "html"`, `web_directory: "/"`. **A config Nginx por omissão (a de app PHP) já serve
estáticos correctamente** — `index index.html` resolve `/sub/` → `sub/index.html` antes do fallback
`/index.php`, que nunca é atingido. Não é preciso reescrever o Nginx para publicar HTML; só por estética.

Deploy script de um site estático não leva `composer install` nem reload do PHP-FPM:
```bash
cd /home/ploi/{dominio}
git pull origin master
```

---

## Verificação (gate, não opcional)

Um site criado e com ficheiros no disco **não** prova um site publicado:
```bash
curl -sI https://dominio/           # 200 + certificado válido
curl -s  https://dominio/ | grep -o "<title>[^<]*</title>"   # bate com o ficheiro local?
curl -sI https://dominio/assets/x.jpg   # os assets também, não só o HTML
```
SSL Let's Encrypt pode demorar a emitir — reportar "SSL por emitir", não "falhou".

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| "O CLI não tem esse comando, logo é preciso o dashboard" | O CLI é subconjunto da API. Tentar a REST antes de declarar bloqueio |
| Adivinhar o path do endpoint até acertar | Ler `src/Ploi/Resources/*.php` do SDK — o `buildEndpoint()` é a verdade |
| Assumir `camelCase` no URL porque o método do SDK é assim | URL é `kebab-case`; e `cronjobs()` → `/crontabs` |
| `PUT` no `/deploy` para gravar o script | `/deploy` dispara (POST); o script é `/deploy/script` |
| Assumir porta SSH 22 | Ler `ssh_port` do `GET /servers` |
| Imprimir o token para "confirmar que leu" | Só o comprimento (`${#TOK}`); o valor nunca aparece em transcript/relatório |
| Aceitar "site criado" como publicado | `curl` ao URL público + a um asset |
| Reescrever o Nginx para servir HTML estático | O default já serve; mexer só se houver motivo real |

---

## SDK PHP (dentro de app PHP)

```php
$ploi = new \Ploi\Ploi($token);
$ploi->server(123)->sites(456)->deployment()->deploy();
$ploi->server(123)->sites(456)->nginxConfiguration()->update($config);
$ploi->server(123)->sshKeys()->create($name, $key, $user);
```
Encadeamento fluente (ID passa-se uma vez), paginação `->page($n, $perPage)`, e **excepções tipadas**
por status: `Unauthenticated` 401 · `NotFound` 404 · `NotAllowed` 405 · `NotValid` 422 ·
`TooManyAttempts` 429 · `InternalServerError` 500. Apanhar a específica (sobretudo `TooManyAttempts`
→ recuar e repetir), nunca `\Exception` genérica.
Resposta: `->getData()` (propriedade `data`) · `->getJson()` · `->toArray()`.

---

## Ligações

- `deploy-ploi.md` — pipeline de deploy, zero-downtime, integridade de assets publicados
- `memory/tools/clis.md` — instalação/auth do CLI no inventário
- SDK (mapa de endpoints): `github.com/ploi/ploi-php-sdk` → `src/Ploi/Resources/`
- Docs: `developers.ploi.io` (⚠ é só a API HTTP; não documenta a instalação do CLI)

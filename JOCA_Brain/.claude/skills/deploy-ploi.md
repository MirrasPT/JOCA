---
name: deploy-ploi
description: "Deploying via Ploi.io, managing servers, configuring Ploi deployments, or controlling Ploi by API/CLI/SDK. MUST be invoked when the user says: ploi, ploi api, ploi cli, deploy, deploy to ploi, ploi.io, deployment, servidor, server, provisionar. SHOULD also invoke when: site setup, deploy script, zero downtime, atomic deploy, production, producao, chave ssh ploi, nginx config ploi, token ploi."
triggers: ploi api, ploi cli, chave ssh ploi, nginx config ploi, token ploi, ploi, deploy, deploy to ploi, ploi.io, deployment, servidor, server, provisionar, site setup, deploy script, zero downtime, atomic deploy, production, producao, publicar, colocar online, ir para producao, push to server, lançar, launch
chain: deploy-executor
---
# Deploy — Ploi.io

Ploi.io is the primary deploy platform. Provisions servers, configures Laravel sites, deploys with zero-downtime.

> **Controlo programático (API REST · CLI · SDK PHP, endpoints, token, chaves SSH, Nginx) →
> `Read(".claude/reference/ploi-api.md")`.** Se bateres num limite do CLI `ploi`, a resposta está lá — não no dashboard.

---

## Server provisioning

1. Connect cloud provider (DigitalOcean, Hetzner, Vultr, AWS) via API key in Server Providers
2. Create server: choose PHP version, type (web/worker/database/Redis), region, plan
3. Ploi installs LEMP stack automatically

Server types: web, load balancer, dedicated database, Redis/Valkey, worker, storage (MinIO), search (Meilisearch).

---

## Site setup

1. Create site -- domain, web directory `/public`, project directory `/`
2. Connect Git repo (GitHub/GitLab/Bitbucket) -- generates initial deploy script
3. Configure DNS (A record to server IP)
4. SSL -- tab SSL, automatic Let's Encrypt
5. Edit `.env` via environment editor (no SSH needed)
6. Create database via Databases tab
7. First deploy

⚠ **Segredos que vêm de outro site do mesmo servidor não se copiam por script** (o deploy script a ler
o `.env` do vizinho foi bloqueado, e bem) nem se escrevem no browser pelo modelo. Vias válidas
(`credential-handling.md` §1): **(1)** o utilizador cola no editor de ambiente; **(2)** gera-se no
destino — `php artisan key:generate`, BD com utilizador próprio criado pelo dono do servidor.
**À cabeça do plano de deploy, antes de montar o resto, listar os valores que o utilizador tem de colar**
(só os nomes das variáveis) — descobri-lo a meio acabou em mensagem ao dono do servidor (2026-09-21).

---

## Site estatico sem repo (`scp`)

O deploy script pressupoe repo git. Um HTML unico (landing, apresentacao, mockup publicado) nao
precisa de repo — mas o caminho nao esta no painel e descobre-se todo a mao:

1. **Criar o site pelo painel.** A API do Ploi esta fechada no plano free (`HTTP 422` ate em
   `GET /api/user`) — criar sites e pelo painel. Web directory `/public`, sem repo git ligado.
   Ordem de tentativa a partir do Claude (nao ha plugin nem MCP de Ploi): **API → CLI → painel por
   browser**. A CLI tem `site:create`, mas fala pela mesma API fechada — 422 na API = 422 na CLI, nao
   insistir. O painel por browser (extensao do Chrome) exige **sessao iniciada no Ploi no perfil
   ligado**: sem ela, `ploi.io/panel/*` devolve a pagina **404 de marketing** — parece que o site nao
   existe, e e so a sessao em falta. Ver esse 404 → pedir ao utilizador que inicie sessao, nao concluir
   ausencia (verificado 2026-09-11).
2. **`scp` para `/home/ploi/<host>/public/`.** A raiz web e `<host>/public`, nunca `<host>/`.
   **Por cima de um site ja no ar (export estatico com chunks):** nao numa passagem — ver
   `deploy-vps.md` §4a «Estatico por cima de um site no ar»: `rsync` em 2 passagens (sem e depois com
   `--delete`) + cobertura do conteudo aprovado, build novo vs live, antes de publicar.
3. **`ssl-upstream.conf`** se o site estiver atras de um edge com TLS proprio (seccao seguinte) —
   sem ele o site da 502 nas duas portas e o painel nao diz porque.
4. **Test configuration → Deploy** no painel (o Deploy so desbloqueia se o Test passar).
5. **Verificar pelo CORPO, nunca pelo status:**
   `curl -s https://<host>/ | grep -F "<marcador da pagina>"`. Um 200 pode ser o catchall, a versao
   anterior, ou o fallback de outro site.

Servidor, porta SSH, utilizador e nome da chave: nas notas locais do teu servidor (ex.:
`memory/tools/ploi-<servidor>.md`, que não se commita num repo público). Nao adivinhar a porta — no mesmo IP pode responder
outra maquina.

**Verificação da máquina e envio encadeados por `&&`, nunca em linhas soltas:**
`test "$(ssh … hostname)" = <hostname esperado> && rsync …`. Com linhas soltas, um `ssh` que falha
(ex.: comando guardado numa variável que o zsh não parte em palavras) não trava o `rsync` seguinte,
mesmo com `set -e`, e o envio corre sem a verificação que o protegia da máquina errada (2026-09-15).
Comando SSH reutilizável no zsh → array (`S=(ssh -p <porta> …)`; `"${S[@]}"`), ver
`reference/workflows-and-tooling.md`.

---

## Edge com TLS terminado a frente do Ploi (`listen 443 ssl`)

**Sintoma:** site novo da **502 nas duas portas** (80 e 443), o TLS publico e valido, e o nginx do
Ploi serve 200 quando se lhe fala directamente no servidor:
`curl -s -o /dev/null -w '%{http_code}' -H 'Host: <host>' http://127.0.0.1/` → 200.

**Teste que discrimina:** pedir ao edge um **hostname inventado**. Se der o mesmo 502, o edge e
**wildcard** e nao tem mapa por host — logo o 502 quer dizer «nao ha vhost que responda», nao «o
proxy recusa este host». Sem este teste o diagnostico obvio (mapa por host em falta no proxy) esta
errado; duas sessoes do mesmo dia tropecaram nisto.

**Causa:** o edge fala **HTTPS** com o nginx do Ploi. Sem vhost em 443 o handshake falha e o edge
devolve 502. O Let's Encrypt do painel tambem nao resolve — o desafio HTTP-01 entra na porta 80, o
edge reencaminha para 443, nao ha vhost, cai no catchall. Ovo e galinha.

**Receita (validada 2026-08-28 num servidor Ploi real):**
1. certificado auto-assinado — so serve o salto edge→nginx; o publico continua a ver o wildcard do edge:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -days 825 -keyout k.pem -out c.pem \
     -subj "/CN=<host>/O=<organizacao>/C=PT" -addext "subjectAltName=DNS:<host>"
   ```
2. `scp` para `/home/ploi/<host>/ssl/{fullchain,privkey}.pem` (`chmod 700` na pasta, `600` na chave)
3. **pelo painel:** Manage → NGINX configuration → Server → `+`, ficheiro `ssl-upstream.conf` com
   `listen 443 ssl; listen [::]:443 ssl; http2 on;` + os dois `ssl_certificate*`.
   Depois do `+`, **confirmar que o campo «File name» apareceu antes de escrever** — o `+` nem sempre
   abre o ficheiro novo à primeira, e o texto cai no vhost principal (um Save por hábito parte-o).
4. **Test configuration** → **Deploy**

⚠ **O passo 3 tem de ser pelo painel:** `/etc/nginx/ploi/<host>/server/` e `root:root 755` e o
utilizador `ploi` **nao tem sudo** (`sudo: a password is required`) — medido, nao assumido.
✅ **Via limpa, por fazer:** ligar um provedor **Cloudflare** em Profile → Integrations do Ploi; ai o
Let's Encrypt emite por DNS-01 e dispensa o auto-assinado (exige colar uma chave de API).
---

## Laravel `api/` + Next `web/` num só site Ploi

Servidor de cada projecto: confirmar no painel qual é **antes** de mexer — nem todos os projectos vivem
no mesmo servidor, e há servidores com sites por utilizador de sistema (não o `ploi`). Receita genérica:

1. **nginx pelo painel** — uma app fica na raiz do vhost; a outra entra por prefixo com
   `location ^~ /<prefixo>/ { proxy_pass http://127.0.0.1:<N>; }` (o `^~` impede que a `location ~ \.php$`
   do vhost apanhe o pedido primeiro). Next servido sob prefixo precisa de `basePath: '/<prefixo>'`.
2. **Daemon** (separador Daemons do servidor, utilizador do site): `npm run start -- -p <N>` com
   diretório `…/web` — uma porta local por site, nunca repetida no servidor.
3. **Redeploy do Next** = build → matar o processo **pela porta** (`fuser -k <N>/tcp`, ou
   `kill $(lsof -t -i :<N> -sTCP:LISTEN)` se o `fuser` não existir) → o daemon relança. Nunca por
   nome: o Next renomeia o processo para `next-server (v…)` e um `pkill -f "next start…"` não apanha
   nada, em silêncio — fica a servir o build antigo. Nunca `pkill node` (mata os Next dos outros sites).
   Confirmar que o PID na porta mudou (`lsof -t -i :<N> -sTCP:LISTEN` antes e depois).
4. Verificar pelo **corpo** nos dois caminhos (`/` e `/<prefixo>/`), como na secção do site estático.

---

## App Node (`next start`) sem repo

Um Next.js **dinâmico** também corre no Ploi — não é só estático e Laravel (validada 1×, 2026-09-28,
num projecto de cliente):

1. **Site do tipo NodeJS** pelo painel — o vhost faz proxy para a porta local da app.
2. **Daemon** do painel (utilizador do site) com o `next start` na mesma porta, a escutar em
   `127.0.0.1` — uma porta por site, nunca repetida no servidor. Redeploy = §anterior, passo 3.
3. **`ssl-upstream.conf`** (secção «Edge com TLS») com `root …/public` também lá dentro: as
   `location = /favicon.ico` e `= /robots.txt` do vhost NodeJS servem do disco e não fazem proxy.
4. Verificar pelo **corpo**, como no site estático.

⚠ Se o `npm run build` falhar no servidor, a via usada foi enviar o `.next` já compilado noutra máquina.

---

## Editar pelo painel (browser)

Os editores do painel (nginx, ambiente, deploy script) são **Monaco sem `window.monaco`**: um
`ClipboardEvent` sintético não cola, `ctrl+g` não abre o ir-para-linha, e o auto-close de `{` meteu
uma `}` a mais no nginx (2026-09-21).
- **Ler** o estado pelos props Inertia — o `<script>` que começa por `{"component"` — não pelo ecrã.
- **Escrever** com `type`, navegar com as setas.
- **Conferir** chavetas e linhas pelos props **antes** de «Test configuration».

---

## Deploy script (Laravel standard)

```bash
cd /home/ploi/example.com
git pull origin main
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev
echo "" | sudo -S service php8.3-fpm reload
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan queue:restart
php artisan horizon:terminate
```

**CRITICAL:** Always `--force` on `php artisan migrate` -- without it, interactive prompt blocks the deploy.

---

## Deploy triggers

### Panel -- Deploy button in UI

### Webhook (GitHub/GitLab)
```
POST https://ploi.io/webhooks/servers/{server_id}/sites/{site_id}/deploy?token=xxx
```
Copy URL from Repository tab, configure as push webhook in GitHub.

### GitHub Actions
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Ploi
        uses: fjogeleit/http-request-action@master
        with:
          url: ${{ secrets.PLOI_WEBHOOK_URL }}
          method: 'POST'
```

### Skip deploy
Include `[skip ci]` or `[ci skip]` in commit message.

---

## Zero-downtime (atomic deploy)

Activate in site Settings (requires Pro or Unlimited plan).

How it works:
1. Creates `{domain}-deploy/` directory
2. Each deploy creates timestamped subdirectory
3. On success, atomic symlink to new release
4. Keeps 3 releases (oldest, recent, current)

**Storage:** create `storage` folder inside `{domain}-deploy/` and symlink to persist uploads across releases.

**Web root:** set to `/current/public` when atomic deploy is active.

---

## Queues and daemons

### Queue workers (site Queues tab)
```
Connection: redis
Queue: default,high,low
Timeout: 90
Sleep: 3
Max tries: 3
Processes: 1
```

### Horizon (server Daemons tab)
```
Command: php /home/ploi/my-app.com/artisan horizon
User: ploi
Processes: 1
```
Ploi creates supervisor config automatically. Add `php artisan horizon:terminate` to deploy script.

---

## PHP SDK

```bash
composer require ploi/ploi-php-sdk
```

```php
$ploi = new \Ploi\Ploi($apiToken);

// Deploy
$ploi->servers(123)->sites(456)->deployment()->deploy();

// Environment
$ploi->servers(123)->sites(456)->environment()->get();
$ploi->servers(123)->sites(456)->environment()->update($content);

// Database
$ploi->servers(123)->databases()->create($name, $user, $password);

// SSL
$ploi->servers(123)->sites(456)->certificates()->create($domain, 'letsencrypt');

// Cron
$ploi->servers(123)->cronjobs()->create('php artisan schedule:run', '* * * * *', 'ploi');
```

## CLI

```bash
composer global require ploi/cli   # Laravel Zero, PHP >= 8.2; sem phar nas releases
ploi token                         # auth interactiva — API key em ploi.io -> Profile
```

⚠ Verificado na v1.22 (2026-08-12): o comando de auth e `ploi token`, **nao `ploi login`** (nao
existe). O binario fica em `~/.composer/vendor/bin` — confirmar que esta no PATH.
⚠ `--server` aceita **nome ou IP**, **nao o ID numerico** que a propria `server:list` imprime
(`--server=<nome-do-servidor>` OK, `--server=<id numerico>` -> "not found").
Instalacao no inventario: `memory/tools/clis.md`.

---

## Integridade do build publicado (CRITICO)

Caso real noutro alvo: `design-system.css` (41 KB) aterrou com **0 bytes**, o cliente de transferencia
devolveu exit 0 e o staging ficou sem folha de estilos, com 200 em todos os pedidos. No Ploi o codigo
chega por `git pull` (integro por definicao), mas os **assets sao construidos no servidor** — um
`npm run build` OOM-killed, um disco cheio ou um Vite interrompido deixam ficheiros vazios em
`public/build/` sem parar o deploy script.

**1. Comparar tamanho remoto vs local (ou vs manifest) e abortar se divergir.** No fim do deploy
script, antes do reload do PHP-FPM:

```bash
# nenhum asset construido pode ter 0 bytes
find public/build -type f -empty -print | grep . && { echo "ABORTAR: assets de 0 bytes"; exit 1; }

# cada ficheiro do manifest do Vite existe e tem tamanho
php -r '
  $m = json_decode(file_get_contents("public/build/manifest.json"), true);
  foreach ($m as $e) { foreach (array_merge([$e["file"]], $e["css"] ?? []) as $f) {
    $p = "public/build/$f";
    if (!is_file($p) || filesize($p) === 0) { fwrite(STDERR, "ABORTAR: $f vazio ou em falta\n"); exit(1); }
  }}
  echo "manifest OK\n";
' || exit 1
```
Comparacao contra o local (quando se builda na maquina e se envia): `wc -c` de cada lado, ou
`md5sum` dos assets criticos — nunca "o build correu, logo esta la".

**2. Nunca confiar no exit code do passo de transferencia/build.** `git pull`, `rsync`, `scp`,
`composer install` e `npm run build` podem devolver **0** com o resultado truncado (disco cheio,
OOM no filho, `--force` a mascarar). Exit 0 nao e prova — a prova e o tamanho no destino. No deploy
script do Ploi, `set -e` nao apanha um ficheiro vazio: e preciso o `find`/manifest acima.

**3. Health-check pos-deploy: `content-length > 0` E `content-type` correcto.** Um 200 sozinho nao
distingue um CSS bom de um CSS de 0 bytes — o nginx do Ploi serve o vazio com 200.

```bash
check() {  # check <url> <content-type esperado>
  H=$(curl -sSI -H 'Accept-Encoding: identity' "$1")
  LEN=$(printf '%s' "$H" | awk '/^[Cc]ontent-[Ll]ength:/{print $2+0}')
  CT=$(printf '%s' "$H" | awk '/^[Cc]ontent-[Tt]ype:/{print tolower($2)}')
  [ "${LEN:-0}" -gt 0 ] || { echo "FALHA vazio: $1 (content-length=$LEN)"; return 1; }
  case "$CT" in *"$2"*) ;; *) echo "FALHA tipo: $1 -> $CT (esperado $2)"; return 1;; esac
  echo "OK $1  $LEN bytes  $CT"
}
check https://example.com/build/assets/app.css text/css
check https://example.com/build/assets/app.js  javascript
```
Falha em qualquer asset = deploy FALHADO. Com atomic deploy activo, isto corre **antes** do symlink
final — o release novo so entra em `current` se os assets passarem.

**4. Caminho novo na app → procurar no deploy script o passo que o ENVIA/builda; se nao existir, e um
deploy que passa e nao entrega.** Real: o health-check passou a `/api/v1/health` sem ninguem
acrescentar o envio da pasta `api/v1/` — o pedido caiu no fallback da SPA, que devolve **200 com
HTML**, e o deploy deu verde sem entregar nada. O health-check verifica o **corpo**, nunca so o status.

---

## Common pitfalls

| Problema | Causa | Fix |
|----------|-------|-----|
| Deploy bloqueado | Comando interactivo | `--force` em migrate |
| Zero downtime nao funciona | Plano Free/Basic | Requer Pro ou Unlimited |
| Horizon nao reinicia | Falta terminate | `php artisan horizon:terminate` no deploy script |
| Codigo antigo apos deploy | OPcache | `sudo -S service php8.3-fpm reload` no deploy script |
| Storage perdido em atomic deploy | Sem symlink | Criar shared storage folder |
| CSS/JS de 0 bytes com 200 | Build no servidor OOM/disco cheio, exit 0 mentiroso | `find public/build -type f -empty` + health-check `content-length`>0 |
| 502 nas duas portas num site novo | Edge fala HTTPS com o nginx; falta vhost em 443 | `ssl-upstream.conf` com `listen 443 ssl` (seccao acima) |
| Backup da BD com 20 bytes, `mysqldump` com «Access denied» | senha lida do `.env` por `grep\|cut` | `~/.my-dump.cnf` temporário (`[client]`, modo 600, gerado por `php artisan tinker` a partir de `config('database.connections.<ligação>')`, sem a senha passar pelo ecrã) → `mysqldump --defaults-extra-file=~/.my-dump.cnf <bd>` (a opção tem de ser a 1.ª) → `rm -f` no fim; **o backup prova-se pelo nº de `CREATE TABLE`, nunca por o ficheiro existir** |

---

## Deploy checklist

- [ ] Deploy script includes `--force` on migrate
- [ ] Deploy script includes `horizon:terminate` (if Horizon)
- [ ] Deploy script includes PHP-FPM reload
- [ ] `.env` configured via Ploi (never in git)
- [ ] SSL Let's Encrypt active
- [ ] Queue worker configured (if applicable)
- [ ] Scheduler configured
- [ ] GitHub webhook configured for auto-deploy
- [ ] `APP_ENV=production` and `APP_DEBUG=false`
- [ ] **Teste negativo corrido**: `.git/config`, `.env`, logs, docs internos e versoes antigas do
      entregavel dao **403/404** no URL publico (200 = credencial exposta, deploy falhado)
- [ ] **Health-check pelo CORPO**, nao so pelo status — rota de API devolve JSON, nao o fallback HTML
- [ ] Tamanho remoto de cada entry point (HTML, bundle JS/CSS) bate com o local
- [ ] Deploy script aborta com assets de 0 bytes (`find public/build -type f -empty` / manifest)
- [ ] Health-check: cada asset com `content-length` > 0 e `content-type` correcto (antes do symlink `current`)
> Bloco completo dos 4 passos de verificacao: agente `deploy-executor`, Step 4.

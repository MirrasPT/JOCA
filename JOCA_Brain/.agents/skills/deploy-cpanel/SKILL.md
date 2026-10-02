---
name: deploy-cpanel
description: "Deploy Laravel/PHP or Node.js apps to cPanel, shared hosting, or traditional hosting environments. MUST be invoked when the user says: shared hosting, hosting partilhado, public_html, FTP, phpMyAdmin, .htaccess, Passenger, Node.js cPanel, Setup Node.js App. SHOULD also invoke when: hosting barato, alojamento, hosting tradicional, cpanel deploy, deploy cpanel, file manager, hosting simples, restart.txt, nodevenv."
triggers: 503 Passenger, stderr.log, SetEnv htaccess, shared hosting, hosting partilhado, public_html, FTP, phpMyAdmin, .htaccess, hosting barato, alojamento, hosting tradicional, cpanel deploy, deploy cpanel, file manager, hosting simples, Passenger, Node.js cPanel, Setup Node.js App, restart.txt, nodevenv
chain: deploy-executor
---
# Deploy — cPanel

Deploy Laravel/PHP e Node.js (Passenger) em cPanel. Workarounds para shared hosting.

> **WordPress?** Esta skill cobre codigo. Levar **conteudo** WP (BD+uploads) de local/Docker para
> shared hosting sem SSH/WP-CLI tem pipeline propria (All-in-One WP Migration + FTP do `.wpress` +
> restore pela wp-admin + caches) → `Read(".claude/skills/wp-index.md")`, seccao "Migração de
> conteúdo". Nao improvisar: ja custou horas uma vez.

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

⚠ **O redirect HTTPS é o ULTIMO passo, nunca o primeiro.** Dominio novo (addon) que ainda nao
apontou para o cPanel serve um certificado **auto-assinado**: forcar HTTPS antes de haver cert valido
troca «funciona em http» por um **aviso de seguranca do browser** assim que o DNS for reapontado.
Ordem obrigatoria (1 publicar ficheiros → 2 reapontar DNS → 3 `SSL/start_autossl_check --post` →
4 confirmar `issuer != subject` → 5 so entao ligar o redirect) e comando de verificacao:
skill `cpanel`, seccao «Ordem DNS → AutoSSL».

Em `public_html/.htaccess`:

```apache
RewriteEngine On
# Deixar passar o desafio do AutoSSL — TEM de vir ANTES de qualquer redirect,
# senao o redirect engole a validacao e a renovacao falha em silencio.
RewriteRule ^\.well-known/ - [L]

# Passo 5 da ordem acima: so activar depois de o certificado ser valido.
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

Node.js/Passenger (criar app no UI, startup file, env vars, nodevenv, restart, `.cpanel.yml`, SQLite/uploads, deploy sem shell = 503, gotchas) → `Read(".claude/reference/deploy-cpanel-node.md")`.

---

## Gate obrigatorio — inventario antes de restauro ou sync destrutivo

Antes de **qualquer** restauro (AIO, backup completo, dump de BD), `rsync --delete`, ou sobreposicao
de uma arvore por outra: **produz e mostra o inventario do que existe SO NO DESTINO** — a lista do
que vai desaparecer. Corre **antes** de escrever, nao depois.

- O **comando de prova entra literalmente** no relatorio, com caminhos completos:
  `rsync -avn --delete --itemize-changes <origem>/ <destino>/ | grep -i deleting` — **ensaia com um
  ficheiro plantado so no destino**: se a corrida a seco nao o nomear, o inventario esta cego e nao
  avancas (no alojamento partilhado o `rsync` muitas vezes nem existe; entao e o `diff` abaixo) ·
  `diff <(ssh <destino> 'ls -1 <dir>') <(ls -1 <dir>)` ·
  plugins/extensoes activas nos dois lados (`wp plugin list --status=active --field=name`) ·
  encomendas, utilizadores e posts modificados contados nos dois lados.
- **Um `--dry-run`/`--itemize-changes` conta. «A pasta parece igual», o total de ficheiros bater e o
  «concluido» da ferramenta nao contam.**
- Inventario **vazio** e resultado e diz-se. Inventario **nao vazio** → para e leva a lista ao
  utilizador (e irreversivel); nunca a resumas nem a filtres.

Porque: um deploy por AIO completo quase apagou o plugin Redsys e checkouts que so existiam no
staging, instalados por terceiro. O que os salvou foi o inventario ter sido feito primeiro.
Doutrina completa: `.claude/reference/gates-runtime.md`, categoria «Restauro · `rsync --delete`».

## Integridade da transferencia (CRITICO — FTP/cPanel)

Caso real: `design-system.css` (41 KB) chegou ao servidor com **0 bytes** por causa do TLS no FTP.
O `curl` devolveu exit 0, o deploy reportou verde, e o staging do cliente ficou sem folha de estilos.

**1. Comparar tamanho remoto vs local a cada upload — abortar se divergir.**

```bash
# Upload + verificacao (curl FTPS)
FTP="ftps://ftp.example.com/public_html/assets"
CRED="user:pass"
for f in dist/assets/*; do
  curl --ssl-reqd -T "$f" "$FTP/$(basename "$f")" -u "$CRED"
  LOCAL=$(wc -c < "$f")
  REMOTE=$(curl -sI --ssl-reqd "$FTP/$(basename "$f")" -u "$CRED" | awk '/^Content-Length:/{print $2+0}')
  [ -z "$REMOTE" ] && REMOTE=$(curl -s --ssl-reqd -Q "SIZE /public_html/assets/$(basename "$f")" "$FTP/" -u "$CRED" 2>&1 | awk '/^213 /{print $2}')
  [ "$LOCAL" = "$REMOTE" ] || { echo "ABORTAR: $f local=$LOCAL remoto=$REMOTE"; exit 1; }
done
```
Com SSH disponivel, mais barato: `ssh user@host "wc -c < ~/public_html/assets/app.css"` e comparar.

**1b. Lote a partir de uma lista de ficheiros: newline final + verificar TODOS, não uma amostra.**
Caso real (2026-09-25): lista gerada com `'\n'.join(...)` (sem newline final) + `while read f` → o
**último ficheiro não foi enviado**; a verificação por amostra não o apanhou, só o 404 no live.
```bash
printf '%s\n' "${FICHEIROS[@]}" > lista.txt          # cada linha termina em \n, a última também
while IFS= read -r f || [ -n "$f" ]; do               # o || apanha a última linha sem \n
  ...enviar "$f"...; echo "$f" >> enviados.txt
done < lista.txt
[ "$(wc -l < enviados.txt)" -eq "$(wc -l < lista.txt)" ] || { echo "ABORTAR: contagem enviados != lista"; exit 1; }
```
Depois, **cada** ficheiro da lista confere com o local — hash (`sha256sum`) quando há SSH, tamanho
(passo 1) quando só há FTP/SFTP. Uma amostra só prova a amostra.
Em `.cpanel.yml` (git deploy), o `cp` e local ao servidor — verificar na mesma no fim:
`- cd $DEPLOYPATH/public_html && find . -type f -empty -print | grep . && exit 1 || true`

**2. Nunca confiar no exit code do cliente de transferencia.** `curl`, `ftp`, `lftp`, `rsync` e `scp`
devolvem **0** com o ficheiro truncado ou vazio no destino (sessao TLS cortada, quota cheia, disco
cheio, `mode ascii` a comer bytes). Exit 0 nao e prova de nada — a prova e o tamanho no destino.

**3. Health-check pos-deploy: `content-length > 0` E `content-type` correcto.** Um 200 sozinho nao
distingue um CSS bom de um CSS de 0 bytes — o Apache serve o ficheiro vazio com 200 alegremente.

```bash
check() {  # check <url> <content-type esperado>
  H=$(curl -sSI "$1")
  LEN=$(printf '%s' "$H" | awk '/^[Cc]ontent-[Ll]ength:/{print $2+0}')
  CT=$(printf '%s' "$H" | awk '/^[Cc]ontent-[Tt]ype:/{print tolower($2)}')
  [ "${LEN:-0}" -gt 0 ] || { echo "FALHA vazio: $1 (content-length=$LEN)"; return 1; }
  case "$CT" in *"$2"*) ;; *) echo "FALHA tipo: $1 -> $CT (esperado $2)"; return 1;; esac
  echo "OK $1  $LEN bytes  $CT"
}
check https://example.com/assets/app.css text/css
check https://example.com/assets/app.js  javascript
```
Falha em qualquer asset = deploy FALHADO, nao "deployado com aviso".

**4. Caminho novo na app → procurar no script de deploy o passo que o ENVIA; se nao existir, e um
deploy que passa e nao entrega.** Real: o health-check passou a `/api/v1/health` sem ninguem
acrescentar o envio da pasta `api/v1/` — o pedido caiu no fallback da SPA, que devolve **200 com
HTML**, e o deploy deu verde sem entregar nada. O health-check verifica o **corpo**, nunca so o status.

**5. Dominio atras da Cloudflare → purgar ANTES de comparar.** Se `curl -sSI https://host/ | grep -i
'^server: cloudflare'` responder, o `check` e a comparacao de tamanho medem o edge, nao o cPanel: um
deploy certo deu «6 de 8 diferentes» com `cf-cache-status: HIT`. Purgar por URL (com a query string que
o HTML publicado pede) e so depois comparar — bloco no agente `deploy-executor`, Step 4c. Sem token
Cloudflare → verificacao «por verificar», nunca «deploy falhado».

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
| CSS/JS de 0 bytes com 200 | Sessao FTP/TLS cortada, exit 0 mentiroso | Comparar tamanho remoto vs local + health-check `content-length`>0 |

---

## Checklist deploy cPanel

### Laravel/PHP
- [ ] Laravel root FORA de `public_html/`
- [ ] `index.php` paths corrigidos
- [ ] `.htaccess` com HTTPS redirect + file blocking
- [ ] `RewriteRule ^\.well-known/ - [L]` antes de qualquer redirect
- [ ] Redirect HTTPS ligado **so depois** de `issuer != subject` (cert nao auto-assinado)
- [ ] Permissoes: storage/ e bootstrap/cache/ = 775
- [ ] `.env` fora do web root
- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] Database criada com user + privileges
- [ ] Cron job para scheduler configurado
- [ ] SSL activo (AutoSSL)
- [ ] Storage symlink criado
- [ ] **Teste negativo corrido**: `.git/config`, `.env`, logs, docs internos e versoes antigas do
      entregavel dao **403/404** no URL publico (200 = credencial exposta, deploy falhado)
- [ ] **Health-check pelo CORPO**, nao so pelo status — rota de API devolve JSON, nao o fallback HTML
- [ ] Tamanho remoto de cada entry point (HTML, bundle JS/CSS) bate com o local
- [ ] Tamanho remoto == local em todos os ficheiros enviados (exit code ignorado)
- [ ] Health-check: cada asset com `content-length` > 0 e `content-type` correcto
> Bloco completo dos 4 passos de verificacao: agente `deploy-executor`, Step 4.

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
- [ ] Sem shell: `package.json` confrontado com o instalado no `~/nodevenv/<app>/<versao>/lib/node_modules/` ANTES do upload
- [ ] `touch <approot>/tmp/restart.txt` feito depois do upload
- [ ] Nenhum `.env` local enviado (vars vivem em `SetEnv` no `.htaccess` / UI)
- [ ] `~/<approot>/stderr.log` lido se houver 503
- [ ] SSL activo (AutoSSL)

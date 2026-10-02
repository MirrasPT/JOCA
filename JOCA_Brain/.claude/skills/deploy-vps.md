---
name: deploy-vps
description: "Deploy static sites, SPAs, PHP/LEMP apps or Docker apps to a Linux VPS behind Caddy, with Cloudflare DNS. MUST invoke when the user says: deploy VPS, VPS setup, Caddy server, Caddyfile, SSH key setup VPS, Cloudflare DNS API, scp upload site, static site VPS. SHOULD invoke when: fresh Ubuntu server, bootstrap SSH, ED25519 key, /var/www, site no ar, publicar no VPS, retirar site do ar, php_fastcgi, try_files, 403 no Caddy, publicar em subcaminho."
triggers: Laravel SPA mesmo origin, Livewire Caddy, matcher Caddy, 403 depois do rsync, deploy VPS, VPS setup, Caddy, Caddyfile, caddy validate, caddy reload, SSH key VPS, Cloudflare DNS API, scp site, static site VPS, SPA no VPS, try_files, php_fastcgi, LEMP, fresh Ubuntu server, bootstrap SSH, ED25519 key, /var/www, publicar VPS, retirar site do ar, apagar site VPS, configurar servidor, caddy vhost, static hosting, 403 Caddy, basePath, subcaminho
origin: local
chain: deploy-executor
---
# Deploy VPS — Caddy + Cloudflare

Ubuntu VPS + Caddy v2 + Cloudflare DNS por API. **Um Caddyfile serve dezenas de sites** — quase todos
os acidentes desta skill vêm daí ou de propriedade/permissões de ficheiros.

**Ordem de leitura:** §0 (regra de ouro) → o padrão de vhost do teu caso (§3x) → §4 permissões →
§6 verificação. Se estiveres a **retirar** um site, vai directo ao §8.
macOS/Linux (chave, rsync, Caddyfile por append, assets por symlink) → `Read(".claude/reference/deploy-vps-unix.md")` §Ramo macOS/Linux.

---

## 0. Regra de ouro — o Caddyfile é infra partilhada

Um erro de sintaxe num bloco derruba **todos** os sites do ficheiro. Sequência obrigatória, sempre:

```bash
ssh <host> "cp /etc/caddy/Caddyfile /root/Caddyfile.bak-$(date +%F-%H%M)"   # 1. backup datado
# 2. alterar UM bloco
ssh <host> "caddy validate --config /etc/caddy/Caddyfile"                   # 3. valida ANTES de recarregar
ssh <host> "systemctl reload caddy"                                         # 4. reload
# 5. verificar N sites, não só o que mexeste
```

**Conta o raio de impacto antes de mexer** (`grep -c '^\S.*{' /etc/caddy/Caddyfile` ≈ nº de blocos) e
di-lo. Um `split_path` inválido já esteve a um reload de derrubar 22 sites; o `caddy validate`
apanhou-o em segundos.

> ⚠ **`split_path` não é subdirectiva de `php_fastcgi`** em todas as versões — parte o `validate`.
> Qualquer directiva que não conheças: validar antes de acreditar.

---

## 1. Chave SSH ED25519 (macOS/Linux — via normal)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/<name>_id -N "" -C "joca@<host>"
ssh-copy-id -i ~/.ssh/<name>_id.pub root@<ip>        # se já houver acesso por password
ssh-keygen -R <ip>                                   # limpar known_hosts antigo
ssh -i ~/.ssh/<name>_id -o StrictHostKeyChecking=accept-new root@<ip> "whoami"   # → root
```

"ECDSA vs ED25519 mismatch" → `ssh-keygen -R <ip>` resolve sempre.

Depois de a chave entrar, endurecer: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`,
`MaxAuthTries 3` + `fail2ban`.

### 1b. Bootstrap a partir do Windows (só se não houver `ssh-copy-id`)

Requer PuTTY (`winget install PuTTY.PuTTY`). O `plink` recusa ligar sem host key, e não é interactivo:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\<name>_id" -N "" -C "joca@<host>"
$pubkey = Get-Content "$env:USERPROFILE\.ssh\<name>_id.pub"
plink -pw "<pass>" root@<ip> "echo test"        # falha, mas imprime o SHA256 do host
plink -pw "<pass>" -batch -hostkey "SHA256:<fingerprint>" root@<ip> `
  "mkdir -p ~/.ssh && echo '$pubkey' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
ssh-keygen -R <ip>
```

Depois do bootstrap usa-se **OpenSSH** (`ssh`/`scp`), não `plink` — o plink só lê chaves `.ppk`.

---

## 2. Instalar Caddy (Ubuntu)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy && sudo systemctl enable caddy
```

Caddy trata do TLS (Let's Encrypt) sozinho. Corre como utilizador **`caddy`**.

---

## 3. Escolher o padrão de vhost

| O que estás a publicar | Secção | Sinal de que escolheste mal |
|---|---|---|
| HTML/CSS/JS sem router | §3a estático | — |
| SPA (React Router, Vue Router) | §3b `try_files` | **404 ao recarregar uma sub-rota** |
| App em Docker, privada em `127.0.0.1:<porta>` | §3c reverse proxy | — |
| App PHP no host (PHP-FPM + MySQL/MariaDB) | §3d LEMP | — |
| Laravel/Filament **+** SPA no mesmo domínio | §3e mesmo origin | Livewire 404, `/images` trocado |

Escolher `root`+`file_server` para uma SPA é o erro mais frequente: `/` responde 200 e tudo o resto
dá 404 em refresh directo ou link partilhado.

---

## 3a. Vhost estático

```caddyfile
subdominio.exemplo.com {
    root * /var/www/mysite
    file_server
    encode gzip
}
```

Preview interno? Acrescentar `header X-Robots-Tag "noindex,nofollow,noarchive"` **e** um
`/robots.txt` com `Disallow: /` — o header não viaja se houver CDN pelo meio.

## 3b. Vhost SPA — `try_files` obrigatório

```caddyfile
app.exemplo.com {
    root * /var/www/app
    encode gzip
    try_files {path} /index.html
    file_server
}
```

**Health-check da SPA testa uma sub-rota profunda** (`/wiki/cards`, `/admin/users`), nunca só `/`.
Sem `try_files`, `/` está verde e a app está partida.

## 3c. App Docker atrás do Caddy do sistema

A app publica só em `127.0.0.1:<porta>` (nunca `0.0.0.0`) e o Caddy **do sistema** faz proxy + TLS —
não o Caddy embutido no compose, que colidiria na 80/443. Páginas estáticas coexistem via `handle`:

```caddyfile
app.exemplo.com {
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

> **HTTP 525/502 transitório com Cloudflare proxied:** o 1.º pedido enquanto o Caddy ainda emite o
> cert devolve 525 por segundos. Confirmar passados 10-30 s antes de debugar. Atrás do proxy laranja
> o `tls-alpn-01` nunca passa, e o `http-01` dá 404 enquanto os edges têm a origem antiga em cache —
> esperar ~3 min depois de mudar a DNS e só então `systemctl reload caddy`.

## 3d. LEMP — app PHP + MySQL no host

Provisionar:

```bash
apt install -y mariadb-server php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml \
                php8.3-curl php8.3-intl php8.3-zip php8.3-bcmath php8.3-sqlite3
mysql -e "CREATE DATABASE app; CREATE USER 'app'@'localhost' IDENTIFIED BY '<pass>';
          GRANT ALL ON app.* TO 'app'@'localhost'; FLUSH PRIVILEGES;"
# password num ficheiro root-only, nunca no vhost nem no repo
```

> ⚠ **`sql_mode` estrito rejeita schemas com zero-date.** Sintoma: o instalador corre em local (XAMPP
> permissivo) e rebenta no servidor. Fixar por ficheiro em `/etc/mysql/mariadb.conf.d/99-<app>.cnf`
> (`sql_mode=NO_ENGINE_SUBSTITUTION`), não por `SET GLOBAL` — que não sobrevive a reinício.

Vhost — o `route{}` é o equivalente Caddy do `.htaccess`, e a **ordem importa**: os `respond 403`
vêm antes do `php_fastcgi`, senão o PHP serve o que devia estar negado.

```caddyfile
app.exemplo.com {
    root * /var/www/app
    encode gzip
    route {
        respond /.env* 403
        respond /api/config/* 403
        respond /api/services/* 403
        php_fastcgi unix//run/php/php8.3-fpm.sock
        try_files {path} /index.html      # SPA por cima da API PHP
        file_server
    }
}
```

Confirmar o socket real antes de o escrever: `ls /run/php/`. O nome tem a versão lá dentro e muda
com um `apt upgrade`.

> ⚠ **`php artisan tinker` / PsySH pendura em `ssh` não-interactivo** (fica à espera de stdin;
> `--execute` devolve vazio). Para correr PHP arbitrário no servidor: script que faz bootstrap do
> framework com caminho **absoluto** (`__DIR__` resolve para `/tmp`, não para a app).
> **Medições posteriores — as duas formas não se comportam igual:**
> - `tinker <ficheiro>` **pendura** (corre o ficheiro e fica à espera de input) — medido 2026-07-17 e
>   2026-09-22 (2 min pendurado em produção).
> - `tinker --execute="…"` **funcionou**: 2× contra um servidor de produção, `--execute="$(cat f)"` a 2026-09-22,
>   e no container do TryPost na VPS (`docker exec … php artisan tinker --execute='echo …;'`).
> - A saída **vazia** de `--execute` foi observada uma vez (2026-07-17); a condição que a distingue
>   dos casos que funcionaram **não foi isolada**. Hipótese por medir: o `--execute` só imprime o que
>   tiver `echo`/`dump`. Até se medir, preferir `--execute` com `echo` e confirmar pelo efeito; o
>   script de bootstrap continua a ser a via segura.

## 3e. Laravel/Filament + SPA no mesmo origin

> Esta secção era a **§5c. Laravel + SPA no mesmo origin (Caddy)** antes da renumeração do §3; as
> duas versões foram fundidas aqui.

Padrão: um SPA estático servido na raiz e uma app Laravel (com Livewire/Filament) por baixo do **mesmo
domínio** — evita CORS e cookies cross-site. Todas as armadilhas abaixo foram reinventadas à mão numa
sessão e duas falharam; não improvisar o vhost.

Matcher nomeado com os prefixos do backend → `php_fastcgi`; tudo o resto → SPA.

```caddyfile
app.exemplo.com {
    root * /var/www/app/spa
    encode gzip
    @laravel path /api/* /sanctum/* /admin* /livewire* /vendor/livewire* /storage/* /build/* /up
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

Armadilhas medidas, todas específicas deste padrão:

| Armadilha | Efeito | Fix |
|---|---|---|
| `/livewire/*` no matcher | O Livewire serve o JS num caminho com hash (`/livewire/livewire.min.js?id=…`) que `/livewire/*` **não** apanha | usar o glob `/livewire*` |
| `/images/*` existe nos dois lados | O logo do email/PDF do backend colide com os assets da SPA | copiar os do backend para dentro da SPA e servir tudo pela SPA |
| Matchers do Caddy são **insensíveis** a maiúsculas; o disco Linux é sensível | `redir /design /Design` apanha também `/Design` → 301 para si próprio | resolver por **symlink no disco**, nunca por redirecção |
| Painel de admin dado por verificado com 200 na página de login | O painel esteve inutilizável um dia inteiro | submeter o login e confirmar que `window.Livewire` inicializa; verificar o `content-type` dos assets JS servidos, não só o status |

**Usa `/livewire*`, não `/livewire/*`.** O Livewire serve-se de vários caminhos
(`/livewire/livewire.js?id=<hash>`, `/livewire/livewire.min.js`, `/livewire/update`) e `/livewire*`
apanha-os a todos, incluindo qualquer variante futura sem a barra. O sintoma quando o matcher falha é
traiçoeiro: o painel **carrega** e nada é interactivo, sem erro visível no HTML — o pedido do JS caiu
no SPA e devolveu `index.html` com 200.
⚠ *Não confirmado:* houve a hipótese de `/livewire/*` falhar por causa da query string, mas a query
não faz parte do path em Caddy e o `*` cobre `/` — a explicação provavelmente estava errada, mesmo
tendo o sintoma sido real. **Não debatas a teoria: mede.** `curl -sI https://<host>/livewire/livewire.js`
tem de devolver `content-type: text/javascript` (ou `application/javascript`), não `text/html`.

**`/images` (e `/assets`, `/js`, `/css`) colidem entre as duas árvores.** SPA e Laravel têm ambos uma
pasta com esse nome; quem ficar com o prefixo rouba os ficheiros do outro e o sintoma é imagens em
falta só de um dos lados. Namespacear um dos lados (`/app-images`, ou servir os do Laravel só por
`/storage`) em vez de tentar adivinhar precedências no vhost.

**Purgar a CDN exige o URL COM query string.** A chave de cache da Cloudflare inclui a query, portanto
purgar `https://example.com/livewire/livewire.js` **não** purga
`https://example.com/livewire/livewire.js?id=<hash>` — o edge continua a servir o ficheiro antigo e o
debug vai parar ao sítio errado. Purgar o URL exacto que o HTML publicado pede (extrair do HTML, não
escrever de memória) ou, na dúvida, `purge_everything` (ver §6e).

**Verificar o deploy atrás da Cloudflare = purgar ANTES de comparar.** Com `server: cloudflare` no
header (`curl -sSI https://host/ | grep -i '^server: cloudflare'`), comparar md5/bytes sem purga mede
o edge (`cf-cache-status: HIT`, `max-age=14400`), não a VPS — um deploy certo deu «6 de 8 diferentes»
em todas as rondas. Purgar os URLs a comparar (§6e), só depois comparar. Bloco: agente
`deploy-executor`, Step 4c.

---

## 4. Enviar ficheiros — e a seguir, propriedade e permissões

### 4a. rsync (via normal)

```bash
rsync -rlptzD --no-owner --no-group --delete --dry-run --itemize-changes local/ root@<ip>:/var/www/app/
rsync -rlptzD --no-owner --no-group --delete local/ root@<ip>:/var/www/app/
```

**Estático por cima de um site no ar (export Next/Vite com chunks com hash) — 2 passagens, não 1.**
Numa só passagem com `--delete` há uma janela em que o HTML novo já está no servidor e os chunks a
que aponta ainda não — ou os velhos, que o HTML antigo ainda pede, já foram apagados. Por ordem:

```bash
# 0. cobertura: o conteúdo aprovado que está no ar continua no build novo?
curl -s https://<host>/ | perl -pe 's/<[^>]*>/\n/g' | grep -v '^\s*$' | sort -u > /tmp/live.txt   # perl: o sed do macOS não põe \n
perl -pe 's/<[^>]*>/\n/g' out/index.html | grep -v '^\s*$' | sort -u > /tmp/build.txt
comm -23 /tmp/live.txt /tmp/build.txt   # texto no ar que o build novo perde — ler antes de publicar
# 1. acrescentar (chunks novos chegam antes de o HTML os pedir), sem apagar nada
rsync -rlptzD --no-owner --no-group out/ root@<ip>:/var/www/app/
# 2. só depois, limpar o que ficou órfão
rsync -rlptzD --no-owner --no-group --delete --dry-run --itemize-changes out/ root@<ip>:/var/www/app/
rsync -rlptzD --no-owner --no-group --delete out/ root@<ip>:/var/www/app/
```

A cobertura (passo 0) é a que distingue «removeu-se texto que ninguém aprovou» de «perdeu-se copy
aprovada» — cada linha do `comm` é uma decisão, não ruído. Repetir por cada rota com copy aprovada
(verificado 2026-09-11).

**`rsync -a` como root carimba o uid da origem** (501 do macOS) no destino: o `www-data` (uid 33)
deixa de conseguir escrever e o CMS lê bem mas rebenta a gravar no painel. O `--dry-run
--itemize-changes` é obrigatório — apanha cache local e `.DS_Store` a viajar por engano.

### 4b. tar sobre ssh (bundles grandes)

```bash
tar czf - -C dist . | ssh -i ~/.ssh/<name>_id root@<ip> "cd /var/www/app && rm -rf assets && tar xzf -"
```

### 4c. Propriedade e permissões — o bloco que resolve os 403

Depois de **qualquer** transferência. Um bundle extraído com `tar` fica `501:root` modo 600 e o
Caddy devolve **403 com os ficheiros todos no sítio certo**; o rsync a partir do macOS carimba
directórios 700 e dá **403 em tudo**.

```bash
# 1. modos — sempre
find /var/www/app -type d -exec chmod 755 {} \;
find /var/www/app -type f -exec chmod 644 {} \;

# 2. dono — conforme o stack
chown -R caddy:caddy /var/www/app                    # site estático / SPA pura
chown -R www-data:www-data /var/www/app              # app servida por PHP-FPM
chown -R 33:33 /dest                                 # container Linux (33 = www-data lá dentro)

# 3. escrita da app (Laravel)
chmod -R 775 /var/www/app/backend/storage /var/www/app/backend/bootstrap/cache
```

**Depois de rsync a partir de macOS: `chmod` recursivo aos directórios, obrigatório.**

```bash
ssh root@<ip> "find /var/www/spa /var/www/app -type d -exec chmod 755 {} + \
             && find /var/www/spa -type f -exec chmod 644 {} +"
```
Sem isto o Caddy/PHP-FPM devolve **403** em pastas inteiras: o rsync trouxe modos do macOS onde
directórios sem bit de execução para "others" ficam intransponíveis. O sintoma é 403 (não 404) e não
tem nada a ver com o vhost — é a causa mais provável de um 403 logo a seguir a um deploy do Mac.

> ⚠ **PHP-FPM corre como `www-data`, não como `caddy`.** Um `chown -R caddy:caddy` reflexo sobre uma
> app PHP põe o `.env` em `caddy:caddy 640` → o `www-data` não o lê → **todos** os endpoints devolvem
> "Database connection failed" via HTTP enquanto o CLI e o root funcionam. Fix:
> `chown www-data:www-data <app>/.env && chmod 640`.

> ⚠ **`.env` lido por `parse_ini_file` é INI:** comentários levam `;`, não `#`. Um `#` com parênteses
> parte o ficheiro e derruba todas as credenciais de uma vez.

---

## 5. Publicar em subcaminho (`/algo` em vez da raiz)

Publicar em `/algo` obriga a três coisas alinhadas: o **build** tem de conhecer o prefixo
(`basePath` no Next, `base` no Vite), o **vhost** tem de servir a subpasta, e o prefixo verifica-se
no **HTML publicado**, nunca na configuração (§6d). Maiúsculas/minúsculas no caminho resolvem-se por
symlink no disco, nunca por `redir` (§3e).

---

## 6. Verificação do deploy — integridade e health-check

### 6c. Integridade da transferência (CRÍTICO — scp/rsync)

Caso real: `design-system.css` (41 KB) aterrou com **0 bytes** e o cliente de transferência devolveu
exit 0. O staging ficou sem folha de estilos, com 200 em todos os pedidos.

**1. Comparar tamanho remoto vs local a cada upload — abortar se divergir.**

```bash
# depois do scp/rsync, comparar byte a byte (nome + tamanho)
find dist -type f -printf '%P %s\n' | sort > /tmp/local.txt
ssh -i ~/.ssh/<name>_id root@<ip> "cd /var/www/mysite && find . -type f -printf '%P %s\n'" | sort > /tmp/remote.txt
diff /tmp/local.txt /tmp/remote.txt || { echo "ABORTAR: divergência local vs remoto"; exit 1; }

# rede: nenhum ficheiro vazio no destino
ssh -i ~/.ssh/<name>_id root@<ip> "find /var/www/mysite -type f -empty -print" | grep . \
  && { echo "ABORTAR: ficheiros de 0 bytes no servidor"; exit 1; }
```
Mais forte quando vale a pena (assets críticos): comparar hashes —
`md5sum dist/app.css` vs `ssh … "md5sum /var/www/mysite/app.css"`.

**2. Nunca confiar no exit code.** `scp`, `rsync`, `sftp` e `curl` devolvem **0** com ficheiro
truncado ou vazio no destino (sessão cortada, disco/quota cheios, `--partial` sem `--partial-dir`).
Exit 0 não é prova de nada — a prova é o tamanho no destino. Usar sempre `rsync --checksum` ou o
`diff` acima; nunca `rsync` mudo seguido de "deployado".

**3. Health-check pós-deploy: `content-length > 0` E `content-type` correcto.** Um 200 sozinho não
distingue um CSS bom de um CSS de 0 bytes — o `file_server` do Caddy serve o vazio com 200.

```bash
check() {  # check <url> <content-type esperado>
  H=$(curl -sSI "$1")
  LEN=$(printf '%s' "$H" | awk '/^[Cc]ontent-[Ll]ength:/{print $2+0}')
  CT=$(printf '%s' "$H" | awk '/^[Cc]ontent-[Tt]ype:/{print tolower($2)}')
  [ "${LEN:-0}" -gt 0 ] || { echo "FALHA vazio: $1 (content-length=$LEN)"; return 1; }
  case "$CT" in *"$2"*) ;; *) echo "FALHA tipo: $1 -> $CT (esperado $2)"; return 1;; esac
  echo "OK $1  $LEN bytes  $CT"
}
check https://subdomain.example.com/assets/app.css text/css
check https://subdomain.example.com/assets/app.js  javascript
```
> Com `encode gzip` o Caddy pode não mandar `Content-Length` na resposta comprimida — pedir sem
> compressão para medir: `curl -sSI -H 'Accept-Encoding: identity' <url>`.

**4. Caminho novo na app → procurar no script de deploy o passo que o ENVIA; se não existir, é um
deploy que passa e não entrega.** Real: o health-check passou a `/api/v1/health` e ninguém acrescentou
o `scp` da pasta `api/v1/` — o pedido caiu no fallback da SPA, que devolve **200 com HTML**, e o
deploy deu verde sem ter entregue nada. O health-check verifica o **corpo**, nunca só o status.

**5. Bootstrap de acesso.** Um deploy pode ficar verde com o painel inacessível: confirmar que
existe ≥1 utilizador com papel de admin e que **autentica** — um `200` no `/login` não prova que há
conta (uma BD com 0 users devolve 200 na mesma).

**6. Verificar uma sub-rota PROFUNDA da SPA (§3b) e um ASSET**, não só a página de entrada.

Falha em qualquer asset = deploy FALHADO, não "deployado com aviso".

### 6d. Verificação: derivar do HTML publicado

Um deploy só está verificado quando **as dependências da página publicada** respondem 200 — não
quando os ficheiros que enviaste respondem 200. Um script que esqueceu `form.css`/`form.js` deu tudo
verde com o site partido em produção. Ver o bloco de verificação no agente `deploy-executor`.

1. **O prefixo verifica-se no HTML gerado, não na configuração.** Se o `basePath` (Next) / `base`
   (Vite) falhar, o build fica verde e a página publicada carrega **sem estilos**:
   `curl -s https://host/sub/ | grep -o 'href="[^"]*\.css"'` tem de mostrar o prefixo.
2. **Maiúsculas:** ver §3e — symlink no disco, nunca `redir`.

### 6e. Cloudflare guarda 404 em cache (~4 h)

Negative caching: um ficheiro **novo** pedido uma vez antes de existir continua a devolver 404 do
edge depois de aterrar. "Nomes novos ⇒ sem purge" vale para **substituições** e é falso para
**adições**. Sintoma: origin 200, público 404. Purgar por URL exige o URL **com** a query string.

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

`<CF_API_TOKEN>` vem do ficheiro local, e o **nome do campo pode variar entre instalações** (`token`
ou `api_token`): extrair com o fallback de `cloudflare-dns.md` §Auth
(`jq -r '.api_token // .token // empty'`), nunca `jq -r .token` de memória.

### 6f. Sondas que mentem

Comparar o deployado com o repo por `grep` a um bundle **minificado** não prova nada: comentários são
removidos e identificadores minificados. Toda a sonda precisa de **controlo positivo** ("isto detecta
algo que eu SEI que lá está?") — e de controlo negativo, porque um `respond 403` responde igual
exista ou não o ficheiro. Sinal fiável = rebuildar o commit e comparar hashes, depois de normalizar
line endings (CRLF muda o hash do mesmo código).

---

## 7. DNS via Cloudflare API

Criar/apontar registos (incl. o aviso de não tocar nos registos de EMAIL) → skill `cloudflare-dns` §6 (`Read(".claude/skills/cloudflare-dns.md")`).

---

## 8. Retirar um site do ar ⛔ (irreversível)

4 camadas (monitor → DNS → Caddy → ficheiros), inventário, ordem canónica, gate e verificação → `Read(".claude/reference/deploy-vps-unix.md")` §Retirar um site do ar.

---

## Gotchas Windows

| Problema | Causa | Fix |
|---|---|---|
| Caddy 403 com os ficheiros no sítio | `tar` deixou 501:root 600; rsync do macOS deixou dirs 700 | §4c (`find -type d/f -exec chmod`) |
| "Database connection failed" só via HTTP | `chown caddy:caddy` no `.env` de app PHP-FPM | `chown www-data:www-data <app>/.env` |
| 404 em sub-rotas da SPA | falta `try_files {path} /index.html` | §3b |
| Livewire 404 | matcher `/livewire/*` | `/livewire*` |
| `caddy reload` derruba todos os sites | sintaxe inválida (ex.: `split_path` fora de sítio) | `caddy validate` antes, sempre (§0) |
| Página publicada sem estilos em subcaminho | `basePath`/`base` não aplicado | verificar o prefixo no HTML publicado (§5) |
| 525/502 nos primeiros segundos | cert LE ainda a emitir atrás do proxy CF | esperar 10-30 s (§3c) |
| Origin 200, público 404 | negative caching da CF em ficheiros novos | purga (§6e) |
| plink recusa sem hostkey | TOFU não-interactivo | `-hostkey "SHA256:…"` do 1.º erro |
| SSH falha após bootstrap | known_hosts com chave antiga | `ssh-keygen -R <ip>` |
| `tinker` pendura por ssh | PsySH espera stdin | script de bootstrap com caminho absoluto; `tinker <ficheiro>` pendura, `--execute` com `echo` funcionou (§3d) |

---

## Checklist deploy VPS

- [ ] Chave ED25519 instalada; login por chave testado (`whoami` = root)
- [ ] Caddy activo (`systemctl status caddy`)
- [ ] Padrão de vhost escolhido pela tabela §3 (estático ≠ SPA ≠ LEMP ≠ mesmo origin)
- [ ] Backup datado do Caddyfile + `caddy validate` **antes** do reload
- [ ] `rsync --dry-run --itemize-changes` corrido antes do rsync real
- [ ] Modos 755/644 + dono certo para o stack (§4c); `.env` a `www-data` se houver PHP-FPM
- [ ] Tamanhos remotos comparados com os locais (exit code ignorado)
- [ ] Nenhum ficheiro de 0 bytes no destino (`find … -type f -empty`)
- [ ] Health-check pelo **corpo**: página + asset + sub-rota profunda + endpoint de API; cada asset com `content-length` > 0 e `content-type` correcto
- [ ] Laravel+SPA no mesmo origin: matcher `/livewire*` (glob) testado pelo `content-type` do `livewire.js`
- [ ] Após rsync do macOS: `find … -type d -exec chmod 755` corrido (senão 403)
- [ ] Acesso ao painel provado com login real, não com 200 no formulário
- [ ] Registo DNS criado; registos de email do domínio intactos
- [ ] Purga da Cloudflare se houve ficheiros **novos** — com o URL **com** query string
- [ ] Sites vizinhos do Caddyfile verificados a 200

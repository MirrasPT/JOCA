---
name: deploy-vps
description: "Deploy static sites, SPAs, PHP/LEMP apps or Docker apps to a Linux VPS behind Caddy, with Cloudflare DNS. MUST invoke when the user says: deploy VPS, VPS setup, Caddy server, Caddyfile, SSH key setup VPS, Cloudflare DNS API, scp upload site, static site VPS. SHOULD invoke when: fresh Ubuntu server, bootstrap SSH, ED25519 key, /var/www, site no ar, publicar no VPS, retirar site do ar, php_fastcgi, try_files, 403 no Caddy, publicar em subcaminho."
triggers: deploy VPS, VPS setup, Caddy, Caddyfile, caddy validate, caddy reload, SSH key VPS, Cloudflare DNS API, scp site, static site VPS, SPA no VPS, try_files, php_fastcgi, LEMP, fresh Ubuntu server, bootstrap SSH, ED25519 key, /var/www, publicar VPS, retirar site do ar, apagar site VPS, configurar servidor, caddy vhost, static hosting, 403 Caddy, basePath, subcaminho
origin: local
chain: deploy-executor
---
# Deploy VPS — Caddy + Cloudflare

Ubuntu VPS + Caddy v2 + Cloudflare DNS por API. **Um Caddyfile serve dezenas de sites** — quase todos
os acidentes desta skill vêm daí ou de propriedade/permissões de ficheiros.

**Ordem de leitura:** §0 (regra de ouro) → o padrão de vhost do teu caso (§3x) → §4 permissões →
§6 verificação. Se estiveres a **retirar** um site, vai directo ao §8.

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

## 3e. Laravel/Filament + SPA no mesmo origin

Matcher nomeado com os prefixos do backend → `php_fastcgi`; tudo o resto → SPA.

```caddyfile
app.exemplo.com {
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

Armadilhas medidas, todas específicas deste padrão:

| Armadilha | Efeito | Fix |
|---|---|---|
| `/livewire/*` no matcher | O Livewire serve o JS num caminho com hash (`/livewire/livewire.min.js?id=…`) que `/livewire/*` **não** apanha | usar o glob `/livewire*` |
| `/images/*` existe nos dois lados | O logo do email/PDF do backend colide com os assets da SPA | copiar os do backend para dentro da SPA e servir tudo pela SPA |
| Matchers do Caddy são **insensíveis** a maiúsculas; o disco Linux é sensível | `redir /design /Design` apanha também `/Design` → 301 para si próprio | resolver por **symlink no disco**, nunca por redirecção |
| Painel de admin dado por verificado com 200 na página de login | O painel esteve inutilizável um dia inteiro | submeter o login e confirmar que `window.Livewire` inicializa; verificar o `content-type` dos assets JS servidos, não só o status |

---

## 4. Enviar ficheiros — e a seguir, propriedade e permissões

### 4a. rsync (via normal)

```bash
rsync -rlptzD --no-owner --no-group --delete --dry-run --itemize-changes local/ root@<ip>:/var/www/app/
rsync -rlptzD --no-owner --no-group --delete local/ root@<ip>:/var/www/app/
```

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

> ⚠ **PHP-FPM corre como `www-data`, não como `caddy`.** Um `chown -R caddy:caddy` reflexo sobre uma
> app PHP põe o `.env` em `caddy:caddy 640` → o `www-data` não o lê → **todos** os endpoints devolvem
> "Database connection failed" via HTTP enquanto o CLI e o root funcionam. Fix:
> `chown www-data:www-data <app>/.env && chmod 640`.

> ⚠ **`.env` lido por `parse_ini_file` é INI:** comentários levam `;`, não `#`. Um `#` com parênteses
> parte o ficheiro e derruba todas as credenciais de uma vez.

---

## 5. Publicar em subcaminho (`/algo` em vez da raiz)

Dois defeitos próprios, ambos silenciosos:

1. **O prefixo verifica-se no HTML gerado, não na configuração.** Se o `basePath` (Next) / `base`
   (Vite) falhar, o build fica verde e a página publicada carrega **sem estilos**:
   `curl -s https://host/sub/ | grep -o 'href="[^"]*\.css"'` tem de mostrar o prefixo.
2. **Maiúsculas:** ver §3e — symlink no disco, nunca `redir`.

---

## 6. Verificação pós-deploy (não é opcional)

1. **Comparar tamanho remoto vs local por ficheiro** e abortar se divergir. Nunca confiar no exit
   code do cliente de transferência: um `.css` de 41 KB já chegou com **0 bytes** e o `curl` deu
   exit 0 — o staging ficou sem folha de estilos nenhuma.
2. **Derivar as dependências do HTML publicado**, não da lista do que enviaste. Um script que
   esqueceu `form.css`/`form.js` deu tudo verde com o site partido.
3. **Health-check verifica o CORPO, nunca só o status** — o fallback da SPA devolve **200 com HTML**
   para um endpoint de API que não existe.
4. **Caminho novo na app ⇒ procurar no script de deploy o passo que o envia.** Se não existir, é um
   deploy que passa e não entrega (aconteceu: `/api/v1/health` actualizado, `scp` da pasta `api/v1/`
   esquecido).
5. **Bootstrap de acesso:** um deploy pode ficar verde com o painel inacessível. Confirmar que existe
   ≥1 utilizador com papel de admin e que **autentica** — um `200` no `/login` não prova que há conta.
6. **Sub-rota profunda** na SPA (§3b) e **um asset** (não só a página).

### 6b. Cloudflare guarda 404 em cache (~4 h)

Negative caching: um ficheiro **novo** pedido uma vez antes de existir continua a devolver 404 do
edge depois de aterrar. "Nomes novos ⇒ sem purge" vale para **substituições** e é falso para
**adições**. Sintoma: origin 200, público 404. Purgar por URL exige o URL **com** a query string.

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### 6c. Sondas que mentem

Comparar o deployado com o repo por `grep` a um bundle **minificado** não prova nada: comentários são
removidos e identificadores minificados. Toda a sonda precisa de **controlo positivo** ("isto detecta
algo que eu SEI que lá está?") — e de controlo negativo, porque um `respond 403` responde igual
exista ou não o ficheiro. Sinal fiável = rebuildar o commit e comparar hashes, depois de normalizar
line endings (CRLF muda o hash do mesmo código).

---

## 7. DNS via Cloudflare API

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
  -H "Authorization: Bearer <CF_API_TOKEN>" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"<sub>","content":"<ip>","ttl":1,"proxied":true}'
```

`ZONE_ID`: dashboard → domínio → Overview → API (direita). Token: My Profile → API Tokens → "Edit
zone DNS". Proxied `true` → CDN + DDoS; `false` → DNS puro (IP exposto).

> ⚠ **Ao apontar um domínio já existente, não tocar nos registos de EMAIL** (MX, SPF, `mail`,
> `autoconfig`, SRV) — o correio costuma ser de outro fornecedor e desaparece em silêncio.
> ⚠ **Listas de subdomínios escritas à mão envelhecem em silêncio.** Consultar a API antes de afirmar
> o que existe.
> ⚠ **Ao ler um ficheiro de credenciais, extrair só a chave de que precisas** — nunca imprimir a
> estrutura. Um filtro por nome de chave falha em blocos aninhados.

---

## 8. Retirar um site do ar (⛔ irreversível)

Toca em **4 sistemas independentes** e deixa órfãos se falhares um. **Ordem canónica** — do que grita
para o que se apaga:

| # | Camada | Comando | Porquê nesta ordem |
|---|---|---|---|
| 1 | Monitor (Uptime Kuma / equivalente) | apagar o monitor | senão apita durante o resto do processo |
| 2 | DNS (Cloudflare) | `DELETE .../dns_records/<id>` | tira o tráfego antes de o servidor deixar de responder |
| 3 | Bloco no Caddyfile | backup → remover bloco → `caddy validate` → `reload` | §0 aplica-se: os outros sites estão neste ficheiro |
| 4 | Ficheiros | `rm -rf /var/www/<site>` | último; é o que não se desfaz |

**Antes:** inventariar o que cai com isto (docroot e tamanho, BD associada, cron, container, cert) e
mostrar a lista. Um pedido tipo "apaga estes 5 URLs" é **operação destrutiva de infra em 4 camadas**,
não uma tarefa de frontend — confirmar 1 linha antes de começar. Já se levou à frente, com decisão
consciente, uma galeria de 366 MB que estava debaixo de um docroot a apagar.

**Depois:** verificar que os sites que ficaram continuam a 200.

---

## Gotchas

| Problema | Causa | Fix |
|---|---|---|
| Caddy 403 com os ficheiros no sítio | `tar` deixou 501:root 600; rsync do macOS deixou dirs 700 | §4c (`find -type d/f -exec chmod`) |
| "Database connection failed" só via HTTP | `chown caddy:caddy` no `.env` de app PHP-FPM | `chown www-data:www-data <app>/.env` |
| 404 em sub-rotas da SPA | falta `try_files {path} /index.html` | §3b |
| Livewire 404 | matcher `/livewire/*` | `/livewire*` |
| `caddy reload` derruba todos os sites | sintaxe inválida (ex.: `split_path` fora de sítio) | `caddy validate` antes, sempre (§0) |
| Página publicada sem estilos em subcaminho | `basePath`/`base` não aplicado | verificar o prefixo no HTML publicado (§5) |
| 525/502 nos primeiros segundos | cert LE ainda a emitir atrás do proxy CF | esperar 10-30 s (§3c) |
| Origin 200, público 404 | negative caching da CF em ficheiros novos | purga (§6b) |
| plink recusa sem hostkey | TOFU não-interactivo | `-hostkey "SHA256:…"` do 1.º erro |
| SSH falha após bootstrap | known_hosts com chave antiga | `ssh-keygen -R <ip>` |
| `tinker` pendura por ssh | PsySH espera stdin | script de bootstrap com caminho absoluto |

---

## Checklist deploy VPS

- [ ] Chave ED25519 instalada; login por chave testado (`whoami` = root)
- [ ] Caddy activo (`systemctl status caddy`)
- [ ] Padrão de vhost escolhido pela tabela §3 (estático ≠ SPA ≠ LEMP ≠ mesmo origin)
- [ ] Backup datado do Caddyfile + `caddy validate` **antes** do reload
- [ ] `rsync --dry-run --itemize-changes` corrido antes do rsync real
- [ ] Modos 755/644 + dono certo para o stack (§4c); `.env` a `www-data` se houver PHP-FPM
- [ ] Tamanhos remotos comparados com os locais
- [ ] Health-check pelo **corpo**: página + asset + sub-rota profunda + endpoint de API
- [ ] Acesso ao painel provado com login real, não com 200 no formulário
- [ ] Registo DNS criado; registos de email do domínio intactos
- [ ] Purga da Cloudflare se houve ficheiros **novos**
- [ ] Sites vizinhos do Caddyfile verificados a 200

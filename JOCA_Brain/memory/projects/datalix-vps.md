---
name: datalix-vps
description: VPS Datalix — infraestrutura pessoal/clientes. Ubuntu, Caddy, SSH por chave, Cloudflare DNS.
type: project
directorio: N/A (servidor remoto)
---

**Servidor:** Datalix VPS · IP `194.62.248.50` · Gateway `194.62.248.1` · IPv6 `/64` `2a0e:97c0:3ea:2db::/64`
**OS:** Ubuntu 7.0.0-15-generic (kernel Linux x86_64, instalado ~2026-06-18)
**Acesso SSH:** `root` · chave `~/.ssh/datalix_id` (ED25519) · host fingerprint `SHA256:tWycRkZCkOoVPccMjfO5/+HBgZYeE7W78/RRiQk6qSk`
**Chave Mac instalada (2026-07-08):** o Mac (`/Users/renatoferreira`) tem a SUA própria `~/.ssh/datalix_id` (ED25519, `joca@datalix-mac`, fp `SHA256:hBrafNJ6979oxs0c1Ftcypsu4lsxyUVqJEhCmZHCKOc`) instalada no `authorized_keys` da VPS via password bootstrap. Acesso por chave confirmado (`root@v66474`). (Password root também disponível; Renato optou por não rotacionar — 2026-07-08.)
**Comando SSH:** `ssh -i ~/.ssh/datalix_id root@194.62.248.50 "comando"`
**Servidor web:** Caddy v2.11.4 (instalado 2026-06-23). Config em `/etc/caddy/Caddyfile`. Reiniciar: `systemctl restart caddy`.

## Sites activos

| Domínio | Dir | Descrição |
|---------|-----|-----------|
| `planobracaris.rfdev.pt` | `/var/www/planobracaris/` | Relatório campanhas ads Bracaris SP/RJ 2026 (HTML + 5 imagens) |
| `trypost.rfdev.pt` | Docker `/opt/trypost` (127.0.0.1:8000) | **TryPost** — agendador/publicador social self-hosted (Laravel, AGPL-3.0). Caddy → 127.0.0.1:8000 |
| `cartastcg.rfdev.pt` | `/var/www/cartastcg/` | **TCG — Codex de cartas** (catálogo estático do projecto `tcg`): `index.html` (= `cards.html`) + `assets/cards/*.png` (38 PNGs). Vhost estático Caddy. Deploy 2026-06-27 |
| `leredes.rfdev.pt` | `/var/www/leredes/` | **Livro de Elogios — galeria Redes Sociais** (review do cliente): `index.html` mobile-first (Lato, `#FD5000`, grid 2-col→1-col, lightbox, `noindex`) + `img/julho/` (9) + `img/junho/` (9) + `img/maio/` (6). Secções por mês (array `DATA` no HTML, newest first). Vhost estático Caddy. Deploy 2026-06-29. |
| `renatoferreira.rfdev.pt` | `/opt/portfolio/` (Node, `127.0.0.1:3002`) | **Portfólio Renato Ferreira** (projecto `meu-site-github`) — **app dinâmica Node/Express+SQLite** (NÃO estático). Serviço `systemd portfolio.service` → `node server.js` em `/opt/portfolio/backend`, bound `127.0.0.1:3002` (ufw off → HOST=127.0.0.1 no `.env` é o que o mantém privado). Caddy `reverse_proxy 127.0.0.1:3002`. 32 projectos na BD + 245 MB de imagens em `frontend/public/uploads/`. Deploy 2026-07-03. |
| `luisplanoredes.rfdev.pt` | `/var/www/luisplanoredes/` | **Elite Imagens DB — calendário de posts** (projecto `elite-imagens-db`, cliente Luis Gonçalo): `index.html` (= `posts_MM-2026.html`) + PNGs (Alkimia/Royal Douro/Bracaris) na raiz. Vhost estático Caddy. Deploy 2026-07-03 (ciclo Julho, 6/8 posts — 2 pendentes de quota Gemini, redeploy a seguir). |

> **Media stack (*arr/Jellyfin) REMOVIDA pelo user em 2026-06-27** — decisão intencional, completamente apagada (0 containers, sem `/opt/media`). A secção histórica abaixo fica só como referência do que existiu.

## TryPost — `/opt/trypost` (Docker Compose) — instalado 2026-06-27

Stack `compose.prod.yaml` (imagem publicada `ghcr.io/trypostit/trypost:latest` — nginx+php-fpm+Horizon+Reverb+scheduler via supervisord) + `postgres:16-alpine` + `redis:7-alpine`. **Caddy embutido NÃO usado** (profile `proxy` desligado — colidiria na 80/443 com o Caddy do sistema). App bound a `127.0.0.1:8000` (web) + `127.0.0.1:8080` (Reverb WS) — privado, só o Caddy do sistema alcança (`reverse_proxy 127.0.0.1:8000`).
- **Login admin:** `admin@rfdev.pt` / `password` → **MUDAR password no 1º login** (email já alterado de `admin@trypost.it` via tinker 2026-06-27; registo público desligado em self-hosted; novos users só por convite Settings→Members). Criado via `db:seed --class=UserSeeder`.
- **Segredos (root-only):** `/root/.trypost-creds.json` na VPS (APP_KEY, DB password, Reverb secret). Passwords geradas com `openssl rand`; APP_KEY=`base64:…`. compose editado in-place (config inline `environment:`, não `.env`); backup em `compose.prod.yaml.orig`.
- **Entrypoint idempotente:** migrations/storage:link/Passport keys/config:cache/permissões automáticos no boot. Comandos: `cd /opt/trypost && docker compose -f compose.prod.yaml {ps,logs trypost,restart,up -d,down}`.
- **⚠ Reverb (websockets live-UI) NÃO funciona no domínio custom** com a imagem publicada — o cliente JS vem com `localhost:8080` baked. Para live-updates no browser remoto: rebuild da imagem com `--build-arg VITE_REVERB_HOST=trypost.rfdev.pt VITE_REVERB_PORT=443 VITE_REVERB_SCHEME=https` + proxy `/app`→8080 no Caddy. Publicação/agendamento/MCP (HTTP) funcionam sem isto.
- **⚠ Upload de média grande:** Cloudflare proxy orange limita uploads a 100MB (plano free) → vídeos grandes falham. Saída: grey-cloud o registo, ou usar storage R2/S3 (`FILESYSTEM_DISK=r2` no compose — R2 keys já existem em `~/.cloudflare/datalix.json`).
- **Páginas legais** (p/ review das apps sociais — TikTok/Meta exigem): `https://trypost.rfdev.pt/{privacy,terms,data-deletion}` servidas estáticas pelo Caddy (`/var/www/trypost-legal/*.html`, blocos `handle /privacy*`+`/terms*`+`/data-deletion*`; resto `handle`→reverse_proxy app). `/data-deletion` = exigido pela Meta (User data deletion URL). App "Post", operador Renato Ferreira, contacto `admin@rfdev.pt`. Ícone gerado em `C:\Users\renat\JOCA_Drops\trypost-icon\`.
- **Connectors OAuth** (creds no `compose.prod.yaml`/`environment:` da VPS, restart `up -d` aplica via config:cache): **TikTok cablado** 2026-06-27 — usa creds **SANDBOX** (Client Key `sbawj40cus80zlx7cx`, prefixo `sb`; secret na VPS). App name no TikTok = "Trypost Joca". ⚠ Ao auditar/passar a produção, trocar p/ creds de produção (`awi3dwc1wa3cvouk`). Redirect registado na app TikTok: `https://trypost.rfdev.pt/accounts/tiktok/callback`. ⚠ **GOTCHA:** o TryPost precisa da env **`<PLAT>_CLIENT_REDIRECT`** explícita (não só ID+SECRET) — `config('services.tiktok.redirect')` vem `null` sem ela → TikTok recusa com erro `redirect_uri`. Set `TIKTOK_CLIENT_REDIRECT="https://trypost.rfdev.pt/accounts/tiktok/callback"` no compose. **Aplica-se a TODOS os connectors** (Facebook precisará de `FACEBOOK_CLIENT_REDIRECT`, etc.). Verificação domínio TikTok = TXT `tiktok-developers-site-verification=…` em `trypost.rfdev.pt` (Cloudflare). ⚠ TikTok: app precisa de auditoria p/ publicar público (sandbox só posta a contas de teste / força SELF_ONLY) + pode exigir verificação de domínio. **Instagram LIGADO** 2026-06-27 — conta `simao_sina` (IG id 17841432191131017) conectada e2e via flow standalone `connect/instagram`. Creds = Instagram App ID `1688527865747503` (produto "Instagram API with Instagram login" da app Meta "JOCA Trypost"; standalone, sem Página FB). `INSTAGRAM_CLIENT_ID/SECRET/REDIRECT` no compose, redirect `accounts/instagram/callback`. Setup Meta: app criada "without a use case" → caso "Manage messaging & content on Instagram" → Instagram business login (redirect) + conta como **Instagram Tester** (tem de **aceitar o convite** no IG: Settings→Apps and websites→Tester invites, senão erro "cargo de programador insuficiente"). Para PUBLICAR (não só ligar) falta a permissão `instagram_business_content_publish` (defaults são só messaging). **Facebook**: app Meta existe (App ID `2447191762442849` e/ou `1342702778017532`), secret nas mãos do Renato — **não cablado** ainda (TryPost precisaria `FACEBOOK_CLIENT_ID/SECRET/REDIRECT`).
- **MCP no Claude Code REGISTADO** 2026-06-27: `claude mcp add --transport http trypost https://trypost.rfdev.pt/mcp/trypost -s user` (user scope, em `~/.claude.json`). Endpoint = **`/mcp/trypost`** (não `/mcp`). Self-hosted **suporta OAuth** (`.well-known/oauth-authorization-server`+`oauth-protected-resource`+`oauth/register` DCR) → sem API key, autentica por browser. Auth: `/mcp` no Claude Code → trypost → Authenticate → login `admin@rfdev.pt`. (Fallback API key: Settings→API Keys + `--header "Authorization: Bearer <key>"`.) 14 tools MCP (create-post, attach-media-from-url, publish-post, get-post-metrics, list-social-accounts, etc.) → JOCA pode publicar sozinho.
- **Próximo:** OpenWA (WhatsApp, Fase 2 automações JOCA) — gateway `rmyndharis/OpenWA` Docker porta 2785 + MCP. Ver doc `gestao-autonoma-redes-sociais.docx`.
- **Media stack:** removida intencionalmente pelo user (2026-06-27) — TryPost é agora o único serviço Docker na VPS.

## Media stack (*arr) — `/opt/media` (Docker Compose)

Instalada 2026-06-23. Docker 29.6 + Compose v5.1 (repo oficial, codename `resolute`). 6 containers, geridos por `docker compose` em `/opt/media/docker-compose.yml`. Mount único `/opt/media/data` (`/data` nos containers) → **hardlinks atómicos** (TRaSH guides): `data/torrents/{movies,tv}` + `data/media/{movies,tv}`. PUID/PGID 1000 (user `media`), TZ Europe/Lisbon.

| Serviço | Imagem | Porta | Exposição |
|---|---|---|---|
| Jellyfin | `lscr.io/linuxserver/jellyfin` | 8096 | público (Caddy → `jellyfin.rfdev.pt`) |
| Jellyseerr | `fallenbagel/jellyseerr` ⚠ (NÃO `fallenbark`) | 5055 | público (Caddy → `requests.rfdev.pt`) |
| Sonarr | `lscr.io/linuxserver/sonarr` | 8989 | privado `127.0.0.1` (túnel SSH) |
| Radarr | `lscr.io/linuxserver/radarr` | 7878 | privado `127.0.0.1` (túnel SSH) |
| Prowlarr | `lscr.io/linuxserver/prowlarr` | 9696 | privado `127.0.0.1` (túnel SSH) |
| qBittorrent | `lscr.io/linuxserver/qbittorrent` | 8080 (web) / 6881 (peers) | web privado `127.0.0.1`; 6881 público |

- **Admin privado** — bound a `127.0.0.1`. Acesso por túnel: `ssh -i ~/.ssh/datalix_id -L 8989:127.0.0.1:8989 -L 7878:127.0.0.1:7878 -L 9696:127.0.0.1:9696 -L 8080:127.0.0.1:8080 root@194.62.248.50` → abrir `http://localhost:<porta>`.
- **qBittorrent** — password inicial era temporária (regenerada nos logs: `docker logs qbittorrent | grep -i password`). Mudar em Settings → Web UI.
- **Sem VPN** no qBittorrent (decisão 2026-06-23) — IP do VPS exposto aos peers. Gluetun adicionável depois.
- **Wiring COMPLETO** (via APIs, 2026-06-23): qBittorrent download client em Sonarr+Radarr (categorias `tv-sonarr`/`radarr`, root folders `/data/media/tv` e `/data/media/movies`) · Prowlarr↔Sonarr+Radarr (fullSync) · Jellyfin wizard feito (admin `renato`, bibliotecas Movies→`/data/media/movies`, Shows→`/data/media/tv`) · Jellyseerr inicializado (owner `renato` via login Jellyfin, Radarr+Sonarr default). **Credenciais das apps:** ficheiro local `C:\Users\renat\.datalix\media-stack-creds.json` (fora do git).
- **qBittorrent auth:** `WebUI\LocalHostAuth=false` + `AuthSubnetWhitelist=172.18.0.0/16` no `qBittorrent.conf` → túnel SSH (localhost) e os *arr entram sem password; `HostHeaderValidation=false`. A API de auth do qBit é chata (exige header `Referer`, devolve `204`, bane IP após falhas) — preferir config por ficheiro a lutar com a API.
- **FALTA (só o user pode):** adicionar **indexers no Prowlarr** (precisam das escolhas/contas do Renato — não inventar). Depois sincronizam sozinhos para Sonarr/Radarr.
- **Gotchas de setup via API:** Jellyseerr image = `fallenbagel/jellyseerr` (não `fallenbark`). Jellyfin wizard headless: a ordem é `POST /Startup/Configuration` → **`GET /Startup/User`** (obrigatório, inicializa o user — sem ele o POST seguinte dá 400) → `POST /Startup/User` → `RemoteAccess` → `Complete`; após wipe do config esperar `/Startup/User`==200 (não `/System/Info/Public`, que dá 200 cedo demais com a DB ainda a migrar → 503). Sonarr/Radarr/Prowlarr download-client/application: construir payload a partir de `GET .../schema` (não adivinhar campos).
- Comandos: `cd /opt/media && docker compose {ps,logs <svc>,restart <svc>,pull,up -d}`.

## DNS (Cloudflare)
- Conta `Renatorff93@gmail.com` · Account ID: `d75abae5fd10148a3690efdf61f34445`
- Plugin Cloudflare instalado: `cloudflare@cloudflare` (user scope)
- **Nameservers da conta (par fixo p/ TODAS as zonas):** `bill.ns.cloudflare.com` + `rosalyn.ns.cloudflare.com`. A Cloudflare atribui sempre **este mesmo par** a qualquer domínio novo adicionado a esta conta → ao migrar um domínio para CF, são estes os 2 NS a meter no registrador (apagar os outros campos). Confirmável no momento da criação.
- **Zonas na conta:** `rfdev.pt` (`5249326e14740641fc7bca37bbe0c0c8`), `bracaris.com.br`, `divinealvarinho.com`, `renatoferreira.org`, `royaldouro.com`, `vinartis.pt`, `alkimiawine.pt` (`396f62f329714d98b96a3e3bd80a255c`, **active** 2026-06-27, **vazia** — 0 records).
- ⚠ API token e credenciais R2/S3 NÃO guardados aqui (sensíveis). **Pointer:** `C:\Users\renat\.cloudflare\datalix.json` (local, fora do git) — token `red-frost-a681` (`cfat_…`), + R2 S3 keys. Reutilizar este ficheiro, NÃO criar tokens novos.
- **⚠ Escopo do token:** **lê TODAS as zonas da conta** + DNS CRUD, MAS **NÃO tem `zone.create`** (erro `com.cloudflare.api.account.zone.create`) nem `/user/tokens/verify`. → **Adicionar uma zona nova faz-se pelo dashboard** (ou bump da permissão Account→Zone→Create no token); depois a gestão de DNS records dessa zona já é por API.
- **Subdomínios `rfdev.pt` LIVE** (confirmado por API 2026-07-06 — 7 registos A, todos proxied → `194.62.248.50`): `cartastcg`, `leredes`, `luisplanoredes`, `packlancamento`, `planobracaris`, `renatoferreira`, `trypost`. (+ TXT `tiktok-developers-site-verification` em `trypost`.) ⚠ `jellyfin`/`requests` já **não existem** (media stack removida). ⚠ `packlancamento.rfdev.pt` aponta para o VPS mas **não está na tabela Sites activos** — origem/docroot por documentar.
- ⚠ **rfdev.pt ≠ cPanel.** rfdev.pt vive **só** aqui (Cloudflare DNS → VPS). A conta cPanel/stableserver (`renatoferreira`) aloja `renatoferreira.org` + addons `alkimiawine.pt`/`bracaris.com`/`divinealvarinho.com`/`royaldouro.com`/`vinartis.pt` + subs `luz`/`borntobyhype`/`baby`.renatoferreira.org — infra distinta.

## Setup SSH (padrão estabelecido 2026-06-23)
1. Gerar chave: `ssh-keygen -t ed25519 -f ~/.ssh/datalix_id -N "" -C "joca@datalix"`
2. Instalar no servidor via plink (aceita host key com `-hostkey`):
   ```
   plink -pw "<pass>" -batch -hostkey "SHA256:..." root@<ip> "mkdir -p ~/.ssh && echo '<pubkey>' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
   ```
3. Limpar known_hosts antigos: `ssh-keygen -R <ip>`
4. Testar: `ssh -i ~/.ssh/datalix_id -o StrictHostKeyChecking=accept-new root@<ip> "whoami"`

## Caddyfile (padrão vhost estático)
```
exemplo.rfdev.pt {
    root * /var/www/exemplo
    file_server
    encode gzip
}
```

## Estado actual
VPS operacional. Caddy v2.11.4 activo. Sites: `planobracaris.rfdev.pt` (relatório Bracaris) + **`trypost.rfdev.pt` (TryPost LIVE)** + **`cartastcg.rfdev.pt` (TCG Codex de cartas — estático)**. **TryPost** = único serviço Docker (`/opt/trypost`, stack `compose.prod.yaml`: app+Postgres16+Redis, atrás do Caddy do sistema em `127.0.0.1:8000`). **Media stack (*arr) REMOVIDA pelo user (2026-06-27)** — 0 containers, sem `/opt/media`. **Connectors TryPost ligados e2e:** Instagram (`simao_sina`) ✓ + TikTok (sandbox) ✓. MCP do TryPost registado no Claude Code (user scope, OAuth, pending auth pelo user). PuTTY local (plink em `C:\Program Files\PuTTY\`).

## Decisões tomadas
- 2026-06-23: Caddy em vez de nginx (HTTPS automático, config simples).
- 2026-06-23: Proxy Cloudflare activo (laranja) no `planobracaris.rfdev.pt` — CDN + DDoS.
- 2026-06-23: SSH por chave ED25519 (sem password em background); plink usado apenas para bootstrap inicial.
- 2026-06-23: Media stack via Docker Compose (`/opt/media`), mount único `/data` para hardlinks atómicos (TRaSH).
- 2026-06-23: Admin (*arr/qBit) privados em `127.0.0.1` + túnel SSH; só Jellyfin+Jellyseerr públicos. Sem VPN no qBittorrent (por agora).
- 2026-06-23: Credenciais sensíveis (CF token+R2, passwords das apps) em ficheiros locais fora do git (`~/.cloudflare/datalix.json`, `~/.datalix/media-stack-creds.json`).
- 2026-06-27: **TryPost deployado via Docker atrás do Caddy do sistema** (não bare-metal Nginx do `production.md`, não o Caddy embutido do compose) — VPS padroniza Caddy+Docker; app em `127.0.0.1:8000` (privado, padrão *arr). Segredos `openssl` em `/root/.trypost-creds.json` (chmod 600). Verificação cor/cert: o cert LE é on-demand (1º pedido dispara emissão → 525 transitório do CF até emitir; depois 200).
- 2026-06-27: **Connectors sociais via apps próprias do user** (TikTok Developers + Meta), creds inline no `compose.prod.yaml` `environment:`. **Gotcha-chave: TryPost precisa de `<PLAT>_CLIENT_REDIRECT` explícito** (não só ID+SECRET) — `config('services.<plat>.redirect')` vem `null` sem ela → erro `redirect_uri`. Aplica-se a todos os connectors.
- 2026-06-27: **Instagram via flow standalone** (`connect/instagram`, "Instagram API with Instagram login") — sem Página FB; creds = Instagram App ID do produto (≠ App ID Meta). Erro "cargo de programador insuficiente" = conta não é tester OU convite não aceite no IG (Settings→Apps and websites→Tester invites). Publicar exige permissão `instagram_business_content_publish` ("Ready for testing" basta em dev mode).
- 2026-06-27: **Páginas legais servidas pelo Caddy** (`/privacy`,`/terms`,`/data-deletion` em `/var/www/trypost-legal`, blocos `handle` no Caddyfile) para satisfazer review TikTok/Meta. Ícone da app gerado por img-gen (`JOCA_Drops/trypost-icon/post-icon.png`).
- 2026-06-27: **`alkimiawine.pt` migrado para Cloudflare** (cliente Alkimia/Luís Gonçalo). Zona adicionada pelo user via dashboard (token não tem `zone.create`); estava parqueada em `host-redirect.com` (0 records, sem A/www/MX/TXT — não servia nada, nada a recriar). NS no registrador → `bill`+`rosalyn`; zona **active**. Continua vazia — não aponta para nada até definir records.

## Pendente
- **TryPost — autenticar o MCP no Claude Code** (só o user): `/mcp` → trypost → Authenticate → login `admin@rfdev.pt`. Depois ficam 14 tools (JOCA publica sozinho).
- **TryPost — mudar password do admin** (`admin@rfdev.pt`, ainda `password`).
- **Instagram — adicionar `instagram_business_content_publish`** + reconectar (para PUBLICAR, não só ler). "Ready for testing" basta em dev mode.
- **Testar publicação** e2e (post de teste IG/TikTok via TryPost).
- **WhatsApp (OpenWA)** — Fase 2: gateway `rmyndharis/OpenWA` Docker :2785 + MCP (precisa telemóvel extra). Ref: `gestao-autonoma-redes-sociais.docx`.
- **Facebook** — app Meta existe (App IDs `2447191762442849`/`1342702778017532`, secret nas mãos do user) — não cablado; se quiser, set `FACEBOOK_CLIENT_ID/SECRET/REDIRECT`.
- **TikTok/Meta produção** — auditoria/App Review p/ publicar a terceiros (sandbox só posta a contas tester/privado). App OAuth Meta em dev mode.
- **TryPost Reverb (live-UI)** — não funciona no domínio custom com imagem publicada (cliente baked `localhost:8080`); rebuild c/ build-args se quiser updates ao vivo. Publicar/MCP não dependem disto.
- **TryPost uploads >100MB** — proxy CF orange corta; usar R2 (`FILESYSTEM_DISK=r2`) ou grey-cloud.
- (media stack) ~~Indexers Prowlarr~~ — N/A (stack removida).
- Selector de domínio root (`rfdev.pt @` e `www`) — ainda não configurado.
- **`alkimiawine.pt`** — zona Cloudflare **active mas vazia** (0 records). Definir para onde aponta (site / redirect / VPS Datalix) quando o user decidir — records via API (token tem DNS CRUD na zona).

## Última sessão
2026-07-08 — **1º acesso à VPS a partir do Mac + fix do `trypost-redis` em crash-loop.** Chave `datalix_id` do Mac instalada (ver secção Acesso SSH). Redis com **1814 reinícios** (ExitCode 1): AOF incremental corrompido (`Bad file format ... appendonly.aof.58.incr.aof`) — base RDB (228 keys) intacto, só a cauda do incr. Fix: `docker stop` → backup `appendonlydir.bak-<ts>` → `redis-check-aof --fix` (truncou 19767 B de 44 MB) → `docker start`. Estável: `RestartCount=0`, `PONG`, 3 containers `healthy`. ⚠ Se a corrupção do AOF repetir, investigar causa (disco cheio / kill abrupto / OOM do host) — a `vm.overcommit_memory` está OFF (warning nos logs; considerar `sysctl vm.overcommit_memory=1`).

2026-07-06 — **Auditoria de subdomínios `rfdev.pt`** (read-only). Consulta à zona Cloudflare (`5249326e14740641fc7bca37bbe0c0c8`) via API: 7 subdomínios A live (todos proxied → VPS). Corrigida a lista de registos A (estava a listar `jellyfin`/`requests` já removidos; faltavam `renatoferreira`/`leredes`/`packlancamento`). Detectado `packlancamento.rfdev.pt` sem entrada na tabela Sites activos. Confirmado que rfdev.pt não toca no cPanel (esse = `renatoferreira.org` + 5 addons).

2026-06-27 (d) — **Deploy de `cartastcg.rfdev.pt`** (catálogo estático de cartas do projecto `tcg`). DNS A via API (proxied) + `/var/www/cartastcg/` (`cards.html`→`index.html` + 38 PNGs de `assets/cards/`, 48 MB) via scp + vhost estático Caddy (`root`+`file_server`+`encode gzip`) + `chown caddy:caddy` + `caddy fmt`+reload. Health-check 200 à 1ª (página + arte `image/png`), sem 525 transitório. Cartas Astecas/Gregas mostram placeholder (`noart:true`, sem PNG).

2026-06-27 (c) — **`alkimiawine.pt` migrado para a Cloudflare** (cliente Alkimia). Confirmado que o token Datalix lê todas as zonas + DNS CRUD mas **não cria zonas** → user adicionou a zona pelo dashboard. Verificado que o domínio estava parqueado em `host-redirect.com` e **não servia nada** (0 records públicos). NS no registrador → `bill`+`rosalyn` (par fixo da conta); zona confirmada **active** por API. Fica vazia até definir records. Aprendizagem-chave persistida: par de NS da conta + escopo do token.

2026-06-27 — **TryPost (agendador social self-hosted) DEPLOYADO na VPS em `trypost.rfdev.pt` + 2 connectors ligados e2e + MCP no Claude.** Docker `compose.prod.yaml` (app+pg16+redis) atrás do Caddy do sistema (127.0.0.1:8000), segredos `openssl` em `/root/.trypost-creds.json`, DNS+cert LE OK, admin email → `admin@rfdev.pt`. **Instagram** (`simao_sina`, flow standalone) e **TikTok** (sandbox) ligados — incluiu criar apps no TikTok Developers + Meta, páginas legais servidas pelo Caddy (`/privacy`,`/terms`,`/data-deletion`), ícone gerado (img-gen), verificação de domínio TikTok (TXT Cloudflare). Gotcha-chave: `<PLAT>_CLIENT_REDIRECT` explícito senão `redirect_uri` falha. MCP registado (`claude mcp add ... /mcp/trypost -s user`, OAuth) — falta o user autenticar via `/mcp`. **Media stack removida pelo user.**

2026-06-23 (b) — Media stack **instalada E cablada** end-to-end via APIs: qBittorrent (paths+categorias, auth bypass localhost/subnet), Sonarr+Radarr (download client + root folders), Prowlarr (apps fullSync), Jellyfin (wizard headless + admin + bibliotecas), Jellyseerr (owner via login Jellyfin + Radarr/Sonarr default). Tudo verificado. Credenciais em `~/.datalix/media-stack-creds.json`. Falta só indexers (user).

2026-06-23 (a) — Media stack instalada: Docker 29.6 + Compose v5.1; 6 containers em `/opt/media`; Caddy a servir `jellyfin.rfdev.pt` + `requests.rfdev.pt` (HTTPS LE via proxy CF, 302/307); 2 registos A via API; credenciais CF em `~/.cloudflare/datalix.json`.

2026-06-23 (anterior) — Setup completo: SSH por chave (plink bootstrap + OpenSSH), instalação Caddy v2.11.4, upload relatório Bracaris, DNS `planobracaris.rfdev.pt → 194.62.248.50` via API Cloudflare. Plugin Cloudflare instalado no Claude Code (`cloudflare@cloudflare`).

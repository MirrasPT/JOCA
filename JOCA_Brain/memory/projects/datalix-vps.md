---
name: datalix-vps
description: VPS Datalix — infraestrutura pessoal/clientes. Ubuntu, Caddy, SSH por chave, Cloudflare DNS.
type: project
directorio: N/A (servidor remoto)
---

**Servidor:** Datalix VPS · IP `194.62.248.50` · Gateway `194.62.248.1` · IPv6 `/64` `2a0e:97c0:3ea:2db::/64`
**OS:** Ubuntu 7.0.0-15-generic (kernel Linux x86_64, instalado ~2026-06-18)
**Acesso SSH:** `root` · chave `~/.ssh/datalix_id` (ED25519) · host fingerprint `SHA256:tWycRkZCkOoVPccMjfO5/+HBgZYeE7W78/RRiQk6qSk`
**Comando SSH:** `ssh -i ~/.ssh/datalix_id root@194.62.248.50 "comando"`
**Servidor web:** Caddy v2.11.4 (instalado 2026-06-23). Config em `/etc/caddy/Caddyfile`. Reiniciar: `systemctl restart caddy`.

## Sites activos

| Domínio | Dir | Descrição |
|---------|-----|-----------|
| `planobracaris.rfdev.pt` | `/var/www/planobracaris/` | Relatório campanhas ads Bracaris SP/RJ 2026 (HTML + 5 imagens) |
| `jellyfin.rfdev.pt` | Docker (8096) | Jellyfin — media server (público via Caddy) |
| `requests.rfdev.pt` | Docker (5055) | Jellyseerr — gestão de pedidos (público via Caddy) |

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
- Domínios geridos: `rfdev.pt` (zone `5249326e14740641fc7bca37bbe0c0c8`), e outros
- Plugin Cloudflare instalado: `cloudflare@cloudflare` (user scope)
- Account ID: `d75abae5fd10148a3690efdf61f34445`
- ⚠ API token e credenciais R2/S3 NÃO guardados aqui (sensíveis). **Pointer:** `C:\Users\renat\.cloudflare\datalix.json` (local, fora do git) — token `red-frost-a681` (`cfat_…`), tem Zone:DNS read+write em `rfdev.pt` (verify genérico falha mas DNS CRUD funciona), + R2 S3 keys. Reutilizar este ficheiro, NÃO criar tokens novos.
- Registos A geridos via API (proxied, → `194.62.248.50`): `planobracaris`, `jellyfin`, `requests`.

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
VPS operacional. Caddy v2.11.4 activo. `planobracaris.rfdev.pt` live com relatório Bracaris. **Media stack (*arr) completa e cablada** em `/opt/media` (Docker): Jellyfin + Jellyseerr públicos (`jellyfin.rfdev.pt`/`requests.rfdev.pt`), Sonarr/Radarr/Prowlarr/qBittorrent privados (túnel SSH). Pipeline end-to-end funcional excepto indexers (a adicionar pelo user no Prowlarr).
PuTTY instalado localmente (plink em `C:\Program Files\PuTTY\`).

## Decisões tomadas
- 2026-06-23: Caddy em vez de nginx (HTTPS automático, config simples).
- 2026-06-23: Proxy Cloudflare activo (laranja) no `planobracaris.rfdev.pt` — CDN + DDoS.
- 2026-06-23: SSH por chave ED25519 (sem password em background); plink usado apenas para bootstrap inicial.
- 2026-06-23: Media stack via Docker Compose (`/opt/media`), mount único `/data` para hardlinks atómicos (TRaSH).
- 2026-06-23: Admin (*arr/qBit) privados em `127.0.0.1` + túnel SSH; só Jellyfin+Jellyseerr públicos. Sem VPN no qBittorrent (por agora).
- 2026-06-23: Credenciais sensíveis (CF token+R2, passwords das apps) em ficheiros locais fora do git (`~/.cloudflare/datalix.json`, `~/.datalix/media-stack-creds.json`).

## Pendente
- **Indexers no Prowlarr** (0) — precisam das escolhas/contas do user; sincronizam para Sonarr/Radarr depois de adicionados.
- Mudar passwords iniciais (Jellyfin admin, opcional qBittorrent).
- (opcional) VPN Gluetun para o qBittorrent se ToS/IP for preocupação.
- Configurar HTTPS end-to-end (Cloudflare Origin Certificate → Caddy) se proxy orange causar problemas SSL.
- Selector de domínio root (`rfdev.pt @` e `www`) — ainda não configurado.

## Última sessão
2026-06-23 (b) — Media stack **instalada E cablada** end-to-end via APIs: qBittorrent (paths+categorias, auth bypass localhost/subnet), Sonarr+Radarr (download client + root folders), Prowlarr (apps fullSync), Jellyfin (wizard headless + admin + bibliotecas), Jellyseerr (owner via login Jellyfin + Radarr/Sonarr default). Tudo verificado. Credenciais em `~/.datalix/media-stack-creds.json`. Falta só indexers (user).

2026-06-23 (a) — Media stack instalada: Docker 29.6 + Compose v5.1; 6 containers em `/opt/media`; Caddy a servir `jellyfin.rfdev.pt` + `requests.rfdev.pt` (HTTPS LE via proxy CF, 302/307); 2 registos A via API; credenciais CF em `~/.cloudflare/datalix.json`.

2026-06-23 (anterior) — Setup completo: SSH por chave (plink bootstrap + OpenSSH), instalação Caddy v2.11.4, upload relatório Bracaris, DNS `planobracaris.rfdev.pt → 194.62.248.50` via API Cloudflare. Plugin Cloudflare instalado no Claude Code (`cloudflare@cloudflare`).

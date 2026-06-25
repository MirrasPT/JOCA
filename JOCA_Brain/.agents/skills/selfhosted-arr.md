---
name: selfhosted-arr
description: "Deploy and wire a self-hosted *arr media stack (Jellyfin + Jellyseerr + Sonarr + Radarr + Prowlarr + qBittorrent) on a Docker VPS, including inter-app wiring via REST APIs. MUST be invoked when the user says: media stack, *arr, arr stack, Jellyfin, Jellyseerr, Sonarr, Radarr, Prowlarr, qBittorrent, self-hosted media, Plex alternative. SHOULD also invoke when: TRaSH guides, hardlinks media, docker media server, indexers, download client wiring."
triggers: media stack, arr stack, *arr, selfhosted, self-hosted media, jellyfin, jellyseerr, sonarr, radarr, prowlarr, qbittorrent, TRaSH, trash guides, hardlinks, docker media, download client, indexers, servarr, linuxserver, media server, plex alternative
origin: local
---

# Self-Hosted *arr Media Stack

Deploy + wire Jellyfin · Jellyseerr · Sonarr · Radarr · Prowlarr · qBittorrent on a Docker VPS. Complements `deploy-vps` (Caddy/SSH/Cloudflare bootstrap) and `deploy-docker`.

**Doctrine:** single `/data` tree for atomic hardlinks · same PUID/PGID everywhere · only Jellyfin+Jellyseerr public · wire via REST using `/schema` (never guess fields) · qBittorrent configured by FILE, not API.

---

## 1. Filesystem — single `/data` tree (TRaSH)

All services share ONE root so imports hardlink instead of copy (atomic move, same fs, zero extra I/O):

```
/data
  torrents/  movies/  tv/  music/
  media/     movies/  tv/  music/
```

Mounts in compose:
- Sonarr/Radarr → `/data:/data` (full RW — sees both torrents + media)
- qBittorrent → `/data/torrents:/data/torrents`
- Jellyfin → `/data/media:/data/media` (read-only ok)

⚠ Split mounts (`/downloads` + `/media` on different bind paths) **break hardlinks** → forces copy+delete (double disk, slow, non-atomic). One root only.

---

## 2. docker-compose — consistent PUID/PGID/UMASK

Every container runs as the SAME OS user so files one service writes are writable by another:

```yaml
environment:
  - PUID=1000
  - PGID=1000
  - UMASK=002
  - TZ=Europe/Lisbon
```

Images (pin `:latest` from linuxserver.io except Jellyseerr):

| Service | Image | Port |
|---|---|---|
| Jellyfin | `lscr.io/linuxserver/jellyfin` | 8096 |
| Jellyseerr | `fallenbagel/jellyseerr` ⚠ (NOT `linuxserver/jellyseerr` — doesn't exist; NOT `fallenbark`) | 5055 |
| Sonarr | `lscr.io/linuxserver/sonarr` | 8989 |
| Radarr | `lscr.io/linuxserver/radarr` | 7878 |
| Prowlarr | `lscr.io/linuxserver/prowlarr` | 9696 |
| qBittorrent | `lscr.io/linuxserver/qbittorrent` | 8080 web / 6881 peers |

`docker compose {ps,logs <svc>,restart <svc>,pull,up -d}` from the compose dir.

---

## 3. Exposure — Caddy public for Jellyfin + Jellyseerr ONLY

```
jellyfin.example.com  { reverse_proxy jellyfin:8096 }
requests.example.com  { reverse_proxy jellyseerr:5055 }
```

The *arr admin (8989/7878/9696) + qBittorrent web (8080) stay **private, bound to `127.0.0.1`** — never in Caddy, never `*:port` on the host. Reach them over SSH tunnel:

```bash
ssh -i ~/.ssh/<key> -L 8989:127.0.0.1:8989 -L 7878:127.0.0.1:7878 \
    -L 9696:127.0.0.1:9696 -L 8080:127.0.0.1:8080 root@<vps>
# then open http://localhost:8989 etc.
```

Caddy does Let's Encrypt automatically. 6881 (peers) is the only other public port.

---

## 4. qBittorrent — configure by FILE, not the WebUI API

The qBittorrent WebUI API is hostile to automation:
- login (`POST /api/v2/auth/login`) requires a `Referer` header matching the exact Host:port → mismatch fails **silently**;
- returns **204** (empty body, not `"Ok."` in some builds) and sets a `SID` cookie all later calls must carry;
- **bans the source IP after ~5 failed logins** (default 3600 s) — in Docker, containers share a source IP, so one misconfigured *arr can ban the whole stack.

**Prefer file config** on first start — edit `/config/qBittorrent/qBittorrent.conf`:
```ini
[Preferences]
WebUI\LocalHostAuth=false
WebUI\AuthSubnetWhitelist=172.18.0.0/16    # your docker bridge subnet
WebUI\HostHeaderValidation=false
```
Then the *arr apps (and the SSH-tunnelled localhost) reach it without a password. The initial random password is in the logs: `docker logs qbittorrent | grep -i password`.

---

## 5. Wiring order (API) — apps BEFORE indexers, schema-first

Order matters; a wrong order silently no-ops the sync:

1. **Prowlarr → add applications** (`POST /api/v1/applications`): Sonarr + Radarr with their API keys + base URLs. Prowlarr pushes indexers to them on Full Sync.
2. **Prowlarr → add indexers** (`Settings → Indexers`). They sync to Sonarr/Radarr by category caps (TV→Sonarr, Movies→Radarr). ⚠ Indexers added BEFORE the apps never sync → trigger `POST /api/v1/applications/actionall` (force sync) after both.
3. **Sonarr + Radarr → add download client** (`POST /api/v3/downloadclient`): qBittorrent, categories `tv-sonarr` / `radarr`, root folders `/data/media/tv` and `/data/media/movies`.

**Schema-first — NEVER guess fields.** Each app returns the exact payload shape:
```bash
curl -H "X-Api-Key: <sonarr-key>"  http://localhost:8989/api/v3/downloadclient/schema
curl -H "X-Api-Key: <prowlarr-key>" http://localhost:9696/api/v1/applications/schema
```
The response carries `implementation`, `configContract`, `fields[]` (exact names/types). A field not in the schema → silent 422 / ignored config that only surfaces at runtime (download never starts). Schemas drift between minor versions — read them at deploy time, never hardcode an old payload.

---

## 6. Jellyfin headless first-run wizard

The API is not fully open until the wizard completes. Programmatic order (no web UI):
```
GET  /Startup/User          # initialises admin, returns current username — REQUIRED first
POST /Startup/User          # {Name, Password}
POST /Startup/Configuration # UI language / metadata locale
POST /Startup/RemoteAccess
POST /Startup/Complete       # server becomes fully operational
```
- Calling `POST /Startup/User` (or `/Users/authenticatebyname`) **before** `GET /Startup/User` → **400**.
- After a config wipe, poll **`/Startup/User`==200** (not `/System/Info/Public`, which returns 200 too early while the DB still migrates → later 503). Concrete poll: every 2 s, max ~30 tries (~60 s), then fail loud.
- Jellyseerr: initialise its owner by logging in **with the Jellyfin admin account**, then set Radarr/Sonarr as defaults.

---

## 7. Credentials & anti-fabrication

- App passwords / API keys → write to a **local file outside git** (e.g. `~/.<host>/media-stack-creds.json`), leave a pointer in the project memory. Never commit.
- **Indexers are the user's choice** (private trackers / accounts) — NEVER invent indexer names or credentials. Wire everything else, then leave `TODO: indexers (escolha do user no Prowlarr)` and report. They auto-sync to Sonarr/Radarr once the user adds them.

---

## References
- TRaSH Guides — folder structure / hardlinks / PUID-PGID: https://trash-guides.info/File-and-Folder-Structure/
- Servarr wiki (Prowlarr/Sonarr/Radarr settings + API): https://wiki.servarr.com/
- linuxserver.io images: https://docs.linuxserver.io/ · Jellyseerr: https://hub.docker.com/r/fallenbagel/jellyseerr

---

## Checklist
- [ ] Single `/data` tree; torrents + media siblings on same fs (hardlinks work)
- [ ] Same PUID/PGID/UMASK on all 6 services
- [ ] Caddy public ONLY for Jellyfin + Jellyseerr; *arr/qBit bound to 127.0.0.1 + SSH tunnel
- [ ] qBittorrent auth via `qBittorrent.conf` (LocalHostAuth=false + subnet whitelist), not the API
- [ ] Wiring: Prowlarr apps → indexers → force-sync; qBittorrent download client in Sonarr/Radarr
- [ ] All API payloads built from `GET .../schema`, never hardcoded
- [ ] Jellyfin: `GET /Startup/User` before any POST; poll `/Startup/User`==200 after wipe
- [ ] Jellyseerr image = `fallenbagel/jellyseerr`
- [ ] Creds in a local file outside git + pointer in memory; indexers left to the user (no fabrication)

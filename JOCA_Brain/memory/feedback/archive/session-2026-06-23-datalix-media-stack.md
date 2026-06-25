---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-23
project: datalix-vps
processed: true
processed_date: 2026-06-25
---

**Categoria:** missing-skill | **Severidade:** medium | **Descrição:** Instalação+wiring de uma media stack self-hosted (*arr: Jellyfin/Jellyseerr/Sonarr/Radarr/Prowlarr/qBittorrent) em VPS Docker correu toda à mão via ssh+curl. Existe `deploy-vps` (bootstrap Caddy/SSH/Cloudflare DNS) mas nada para deploy de **stack Docker self-hosted + wiring inter-app por API**. Muito conhecimento não-óbvio descoberto em runtime (ver fixes abaixo) que se perde sem skill. | **Componente afectado:** `.claude/skills/` (falta `selfhosted-arr` ou `docker-media-stack`); complementa `deploy-vps` + `deploy-docker`. | **Fix sugerido:** criar skill `selfhosted-arr` com: layout `/data` único p/ hardlinks (TRaSH), compose canónico dos 6 serviços, PUID/PGID, exposição Caddy só p/ Jellyfin+Jellyseerr, e o playbook de wiring por API (abaixo).

**Categoria:** doc-gap | **Severidade:** low | **Descrição:** Gotchas de setup-via-API descobertos e que deviam estar documentados numa skill/knowledge: (1) imagem Jellyseerr = `fallenbagel/jellyseerr` (não `fallenbark`); (2) Jellyfin wizard headless exige `GET /Startup/User` ANTES do `POST` (sem ele → 400) e após wipe esperar `/Startup/User`==200, não `/System/Info/Public` (200 cedo demais, DB ainda a migrar → 503); (3) qBittorrent API de auth exige header `Referer`, devolve `204` (corpo vazio, não "Ok."), e bane o IP após N falhas → preferir config por ficheiro (`LocalHostAuth=false` + `AuthSubnetWhitelist`) a lutar com a API; (4) Sonarr/Radarr/Prowlarr: construir payload de downloadclient/application a partir de `GET .../schema`, não adivinhar campos. | **Componente afectado:** knowledge base / nova skill. | **Fix sugerido:** incluir no corpo da skill `selfhosted-arr` ou ingerir via `/know`.

**Categoria:** discovery-gap | **Severidade:** low | **Descrição:** Token Cloudflare criado numa sessão anterior não tinha sido persistido → user teve de criar outro. Também: o endpoint genérico `/user/tokens/verify` falha para tokens R2-scoped mas o CRUD de DNS na zona funciona à mesma (não concluir "token inválido" pelo verify). | **Componente afectado:** convenção de persistência de credenciais (`deploy-vps` / memória de projecto). | **Fix sugerido:** ao receber credencial reutilizável, gravar logo em ficheiro local fora do git e deixar pointer na memória do projecto (feito esta sessão: `~/.cloudflare/datalix.json`).

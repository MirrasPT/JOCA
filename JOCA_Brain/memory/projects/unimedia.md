---
name: unimedia
description: Netflix self-hosted multi-fonte (Next.js 15 + SQLite + WebTorrent/FFmpeg) para uso pessoal
type: project
directorio: C:\Users\renat\Projetos\UniMedia
---

**Stack:** Next.js 15 (React, full-stack) + SQLite + servidor streaming Node (WebTorrent + FFmpeg)
**Objectivo:** Netflix self-hosted que agrega torrents, VidSrc, IPTV (m3u) e ficheiros locais numa só interface, para deixar subscrições. Uso pessoal/família.
**Directório:** `C:\Users\renat\Projetos\UniMedia`
**Deploy:** VPS (Node + PM2 ou Docker)
**Iniciado:** 2026-06-17
**PRD:** PRD.md existe — actualizar via skill prd no /save
**Why:** Substituir subscrições de streaming por interface única self-hosted com catálogo amplo (multi-fonte).
**How to apply:** Frontend (player, catálogo, cards) → cluster `frontend`. Endpoints streaming/catálogo → `rest-api`. Perfis/login → `auth`. Cache de streams/metadata → `caching`. Media local → `file-storage`. Pesquisa de catálogo → `search`. Para WebTorrent/IPTV/FFmpeg/VidSrc não há skill nativa — usar UniTV como referência + memória de gotchas.

## Referência
Projecto-irmão **UniTV** (`C:\Users\renat\Projetos\UniTV`) usa a mesma stack — reaproveitar padrões. Gotchas WebTorrent v2 documentados na memória de auto (unitv-torrent-server): async client.get, keep-alive reader, no deselect, HTTP trackers, selecção de track de áudio.

Diferença vs UniTV: UniTV foi reiniciado SEM VidSrc/Real-Debrid. UniMedia volta a incluir VidSrc + torrents para catálogo amplo.

## Estado actual
**Fases 0, 1 e 2 COMPLETAS** (todas commitadas, build verde). Next.js 16.2.9 + Tailwind v4 + better-sqlite3. Dir `C:\Users\renat\Projetos\UniMedia` (npm package `unimedia`). Dev server na porta **7371** (3000 ocupada). `.env` tem TMDB_READ_TOKEN (v4) + SESSION_SECRET gerado.
- **Fase 0:** scaffold + `lib/db.ts` (profiles/watch_state/local_media/app_settings).
- **Fase 1:** `lib/media.ts` (helpers client-safe) + `lib/tmdb.ts` (server-only, pt-PT) + `/api/browse` + home/browse/detalhe. Verificado live (A Origem etc.).
- **Fase 2:** `lib/sources/` framework plugável + registry (allSettled, dedup por infoHash, ranking) + providers torrentio/yts/eztv/apibay/x1337/uindex + `/api/title/sources` + `SourceList` UI. Verificado: Inception 106 fontes, Breaking Bad S1E1 7.

### Domínios de fontes (rede PT — importante p/ UniMedia E UniTV)
- ✓ **apibay.org** (TPB) — funciona, devolve ~100. Workhorse nesta rede.
- ✓ **eztvx.to** (EZTV TV) — funciona JSON. (en.eztv-official.is dá 403 Cloudflare.)
- ✓ **1337xx.to** (mirror 1337x, scrape) — funciona. 1337x.to tem cert expirado.
- ✗ **yts.mx** — NXDOMAIN (domínio morto). yts.lu serve HTML (não é a API). yts.am cert expirado. Sem API YTS viável nesta rede.
- ✗ **torrentio.strem.io** — só IPv6 (AAAA, sem A) → inalcançável sem IPv6. Falha graciosa; funciona noutras redes.
- ✗ **uindex.org** — 403.
- Técnica DoH (undici `fetch`+`Agent` com `connect.lookup` via cloudflare-dns.com) testada — funciona, mas NÃO resolve estes casos (domínio morto/IPv6/cert), por isso não foi integrada. `undici` instalado, disponível se preciso para bypass de DNS-block real.

- **Fase 3 COMPLETA:** `streaming-server/` (Express 5 + WebTorrent + FFmpeg, porta 3201) + `VideoPlayer.tsx` + wiring no `SourceList`. Verificado: Sintel remux a fluir 6MB+ contínuo, 21 peers, estável.

### Gotchas WebTorrent+FFmpeg resolvidos (Windows) — guardar p/ UniTV também
- **utp:false obrigatório** no Windows: `utp-native` lança `ENOBUFS` ("no buffer space available") como erro não-tratado → crash. Desligar µTP (TCP+webseed chega). + `process.on('uncaughtException')` guard.
- **ffmpeg input = servidor HTTP interno do WebTorrent** (`client.createServer()`, range-capable) em vez de `createReadStream` pipe → resolve o stall de MP4 com **moov-at-end** (pipe não-seekable não consegue). URL: `http://127.0.0.1:<wtPort>/webtorrent/<infoHash>/<file.path>`.
- **file.path no Windows usa `\`** — o wt server compara `file.path.replace(/\\/g,'/')`, por isso normalizar backslash→`/` antes de montar a URL (senão 404 → ffmpeg 0 bytes).
- Remux: `-c:v copy -c:a aac -movflags frag_keyframe+empty_moov+default_base_moof -f mp4`. Selecção de audio track por original_language via ffprobe (best-effort).
- **Limitação conhecida:** `-c:v copy` não transcoda vídeo → torrents H.265/HEVC não tocam no browser (só H.264). Refinamento futuro: detectar codec e transcodar HEVC→H264.

**Testar playback:** precisa Next dev (7371) + streaming server (3201) a correr. Abrir filme → Procurar fontes → clicar fonte → toca.

**Fase 4 COMPLETA (build verde, tsc/eslint/next build OK) — por commitar.** Construída via workflow multi-agente (4 streams paralelos + integrate + review adversarial). Backend já existia da sessão anterior; esta sessão ligou o frontend e corrigiu o que o review apanhou.
- **Auth:** `lib/auth.ts` (cookies HMAC-SHA256 via Web Crypto p/ funcionar em edge+node, PIN PBKDF2 100k iter), `lib/session.ts` (`currentProfileId`, `isAdmin`), `middleware.ts` (gate: app cookie → profile cookie, deny-by-default). Login global (`GLOBAL_PASSWORD`, dev=`unimedia-dev`) + perfis com PIN.
- **`/profiles`:** `app/profiles/page.tsx` + `components/ProfilePicker.tsx` — picker estilo Netflix, modal PIN, gerir (add/edit/delete), empty-state bootstrap (1º perfil = admin).
- **Playback wiring:** `SourceList`+`TitleDetail` passam `startTime`/`subtitleUrl`/`onProgress`/`onEnded` ao `VideoPlayer` (já tinha os props). Resume via GET watch-state, save via POST, legendas via `<track>` → `/api/subtitles`.
- **Continuar a ver:** `components/ContinueWatching.tsx` (client island) + row no topo de `app/page.tsx`.
- **Header:** `app/api/auth/me/route.ts` + `SiteHeader.tsx` (avatar + "Mudar de perfil" → /profiles + "Terminar sessão" → POST logout).
- **Legendas:** `lib/subtitles.ts` (OpenSubtitles REST, pt-PT→pt-BR fallback, SRT→VTT). Key já no `.env`.

### Fixes do review adversarial (aplicados)
- 🔴 **Autz:** rotas `POST/PATCH/DELETE /api/profiles` não tinham auth (qualquer um passado o gate global resetava PIN do admin / apagava perfis — middleware deixa `/api/*` passar só com app cookie). Adicionado guard `isAdmin()` nas 3 rotas. **Excepção bootstrap:** 1º perfil cria-se sem auth. **Tradeoff:** gerir perfis no `/profiles` só funciona com cookie de admin já presente (via header → "Mudar de perfil"). Afrouxável se a fricção incomodar.
- 🔴 **completed bug:** era marcado em cada tick ≥95% → item sumia do "Continuar a ver" a meio. Agora só `onEnded` marca completo (`onProgress` envia sempre `completed:false`).
- 🟠 **SESSION_SECRET:** fallback silencioso p/ constante hardcoded → cookies forjáveis. Agora `throw` em produção se faltar.

**Próximo:** smoke-test live (login→perfil→home→tocar→continue) · commitar Fase 4 · Suggestions não-bloqueantes (save no fecho do player, AbortController no fetch ao stream-server, `/api/subtitles` 502 não expor `err.message`) · confirmar `next.config` remotePatterns p/ image.tmdb.org · Fase 5 (VidSrc embed iframe + failover — spike antes).

## Decisões tomadas
- 2026-06-17: **Greenfield — NADA do UniTV** (Q1). UniTV só como blueprint de leitura, nunca copiar ficheiros. Reescrever limpo.
- 2026-06-17: Stack Next.js 16 + SQLite + Node streaming server (Express+WebTorrent+FFmpeg).
- 2026-06-17: **Máxima redundância de fontes** + failover automático no player (torrent→vidsrc directo→vidsrc embed→local). Indexers: Torrentio (primário), YTS, EZTV, apibay/TPB, 1337x, uindex, VidSrc (vidsrcme.ru embed+directo).
- 2026-06-17: Arquitectura de **SourceProvider** plugável (lib/sources/) — adicionar fonte = 1 ficheiro + registo.
- 2026-06-17: **Legendas sempre PT-PT** (forçado).
- 2026-06-17: Auth = **login global + perfis com PIN** (Q3).
- 2026-06-18: **Gestão de perfis = admin-only** (não só o gate global). 1º perfil = admin (bootstrap sem auth); criar/editar/apagar perfis exige sessão admin. PIN é fronteira real, não só UX. Afrouxável p/ LAN se incomodar.
- 2026-06-18: `completed` no watch-state é **evento terminal** (só `onEnded`), nunca derivado de tick de progresso.

## Pendente
- Commitar Fase 4 (ainda untracked/uncommitted).
- Smoke-test live do fluxo auth+playback (GLOBAL_PASSWORD=unimedia-dev).
- Suggestions não-bloqueantes do review: save no fecho do player, AbortController no fetch ao stream-server, `/api/subtitles` 502 não expor `err.message`.
- Confirmar `next.config` remotePatterns p/ `image.tmdb.org`.
- Spike VidSrc embed actual antes da Fase 5 (estrutura muda) + failover automático no player.
<!-- preenchido por /save -->

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

### UNIFICAÇÃO UniTV+UniMedia + redesign Netflix (2026-06-23) — COMPLETA, build verde, NÃO commitada
Decisão: **UniMedia é a base** (Next 16, mais moderno); portou-se do UniTV só o que faltava. Produto final único = **Filmes + Séries + TV(IPTV) + Ficheiros locais** num só app Netflix-grade. Análise + plano em `_unification/` (PLAN.md + 4 relatórios). Construído em 4 workflows multi-agente (análise → foundation → fan-out → polish), todos com gate tsc+build+smoke autenticado.
- **Design Netflix:** tokens OKLCH dark + aliases legacy (`globals.css`), fontes **Bricolage Grotesque + Hanken Grotesk** (subst. Geist), `@custom-variant fine-pointer` (NUNCA usar arbitrary `[@media(hover:hover)and(...)]` — gera CSS inválido E o Tailwind v4 faz scan de `.md`/comentários, branqueia tudo). Componentes: `layout/Navbar` (global no `layout.tsx`, esconde-se em /login+/profiles via usePathname), `hero/Billboard(+Carousel)`, `row/{Row,RowContinue,RowTop10,RowChannels}`, `card/{PosterCard,HoverCard,ChannelCard}`, `ui/{Button(CVA),IconButton,Skeleton}`, `modal/TitleDetail`.
- **Modal de detalhe = Intercepting Routes:** `app/@modal/(.)title/[id]` (overlay sobre a home) + `app/title/[id]` (deep-link) partilham `components/modal/TitleDetail`. PosterCard liga a `/title/{id}?type=movie|tv` (sem ?type, TV abria como movie).
- **Player único** `components/player/{Player,HlsVideo}`: HLS via hls.js (IPTV) + progressivo (torrent remux/local), failover (onFatal→próxima fonte), prebuffer 15s só torrents, legendas PT forçadas (track mode='showing'). `VideoPlayer.tsx` antigo órfão.
- **IPTV** (`/live`): `lib/iptv.ts` parseM3U robusto + `app/api/iptv`. ⚠ **`m3upt.com/pt/` está PARTIDO** (HTML Hugo, 0 canais) — fonte real = `https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u` (1119 canais, default; override via app_settings `iptv_m3u_url`). **Headers anti-leech por canal** via `#EXTVLCOPT` (http-user-agent/referrer/origin) são REQUERIDOS (RTP1 sem UA→204, SIC sem header→403) → proxy `/iptv?u=&ua=&ref=` no streaming-server. 978 HLS + 112 DASH(.mpd, isHLS:false) + alguns DRM clearkey (flagged, não tocam). AES-128 = TODO no proxy.
- **Ficheiros locais** (`/local` + `/admin/sources`): `lib/local-media.ts` (fast-glob scan + parse-torrent-title + match TMDB best-effort, sem match=campos null), provider `local` no registry (prioridade máxima), serving `/local` (Range 206 + guard anti-traversal Windows path.sep) + `probeAndDecide` (HEVC/10bit/VP9/AV1→transcode H264; H264→nativo seek real) no streaming-server. **Precisa configurar pastas em /admin/sources + Scan** (LOCAL_LIBRARY_DIRS ou app_settings `local_dirs`).
- **streaming-server** (porta 3201): + `/local`, `/iptv`, transcode, cache sweep (cap ~20GB + destroyStore, antes vazava disco), anti-dub no detectAudioRel. **fix pickFile pack-aware** (SxxEyy regex; entries key = `infoHash:fileIndex`; evictTorrent não destrói pack partilhado) — resolve o bug "episódio errado em season-pack" que ambos os apps tinham.
- **Spatial-nav TV/comando** (`lib/spatial.tsx`, port geométrico do UniTV): 1 listener global, ←→↑↓ por proximidade geométrica, Enter nativo, Back/Esc=history.back, scrollIntoView centrado, rato/touch preservados. `data-focusable` em PosterCard. SpatialProvider em `app/providers.tsx`.
- **Deps novas:** motion(v12), hls.js(1.6), parse-torrent-title, fast-glob, lucide-react.
- **Pendentes desta fase:** "Mais como este" (tmdb.recommendations) ✓ feito; continue-watching DELETE ✓ feito. Falta: **commitar tudo** (uncommitted, decisão do user de não fazer baseline); testar playback real end-to-end de 1 canal IPTV + 1 ficheiro local na UI; AES-128 IPTV (TODO); HEVC torrent transcode (só local resolvido).

### (anterior) Fases 0, 1 e 2 — base de filmes/séries via torrent
Next.js 16.2.9 + Tailwind v4 + better-sqlite3. Dir `C:\Users\renat\Projetos\UniMedia` (npm package `unimedia`). Dev server na porta **7371** (3000 ocupada). `.env` tem TMDB_READ_TOKEN (v4) + SESSION_SECRET gerado.
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
- 2026-06-23: **Auto-select de fonte + failover** (Netflix-style) — botão "▶ Reproduzir" tenta a melhor fonte ranked, salta 502/dead e em onFatal avança sozinho; lista manual atrás de "Outras fontes".
- 2026-06-23: **UNIFICAR UniTV → UniMedia** (não fundir 50/50): UniMedia é a base (Next 16), porta-se do UniTV só IPTV+HLS+spatial-nav+micro-lifts; descarta-se perfis/watch-state/TMDB/torrent-sourcing/player do UniTV (UniMedia já melhor).
- 2026-06-23: **TV/comando é objectivo** (Q user) → spatial-nav portado. Accent vermelho `#E50914` literal (clone Netflix pedido). Modal = intercepting routes (não só modal nem só página). IPTV = secção `/live` separada (por-canal, não polui catálogo TMDB).
- 2026-06-23: user optou por **não fazer commit baseline** antes da reescrita grande (avançou sobre uncommitted).

## Pendente
- **Commitar TUDO** (unificação inteira + Fase 4 anterior está uncommitted — MUITO código; recomendado urgente como ponto de restauro).
- Testar **playback real end-to-end na UI**: 1 canal IPTV (clicar→toca via proxy /iptv) + 1 ficheiro local (configurar pasta em /admin/sources → Scan → tocar). Rotas todas 200; falta o clique-e-toca visual.
- Config local files: definir `LOCAL_LIBRARY_DIRS` ou pastas em /admin/sources (serving recusa pastas não-configuradas por segurança).
- TODOs conhecidos: **AES-128** em canais IPTV encriptados (proxy `/iptv`); **transcode HEVC para torrents** (só local resolvido, `-c:v copy` em torrents → HEVC não toca); DASH(.mpd)/DRM-clearkey flagged mas não tocam.
- Limpeza Fase 3: remover `components/VideoPlayer.tsx` órfão + `components/{MediaCard,MediaRow,SiteHeader,TitleDetail}.tsx` antigos (substituídos) + aliases legacy em globals.css; renomear `middleware`→`proxy` (aviso Next 16).
- Suggestions antigas ainda válidas: AbortController no fetch ao stream-server; `/api/subtitles` 502 não expor `err.message`.

## Última sessão
2026-06-23: Unificação UniTV+UniMedia + redesign Netflix completo em 4 workflows multi-agente (análise→foundation→fan-out→polish, 15 agentes). Filmes+Séries+IPTV+Locais num só app, build verde + smoke autenticado (todas as rotas 200). Por commitar.
<!-- preenchido por /save -->

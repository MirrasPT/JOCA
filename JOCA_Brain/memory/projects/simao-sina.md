---
name: simao-sina
description: Engine de lyric videos programáticos (Remotion + React) para o músico Simão/Sina — horizontal 16:9 + verticais 9:16
type: project
directorio: D:\Mega\_1_Varios_Save\Simao-sina
---

**Stack:** Remotion 4.0.446 · React 19.2.3 · React-DOM 19.2.3 · TypeScript 5.9.3 · Tailwind v4 (`@remotion/tailwind-v4` 4.0.446) · ESLint 9 + Prettier 3.8.1. FPS=30 em todas as composições.
**Objectivo:** Engine de lyric videos programáticos para o músico Simão/Sina. Cada música gera versão horizontal 1920×1080 (YouTube) + 3 clips verticais 1080×1920 (IG Reels / TikTok / YT Shorts). Código `.tsx` define timing e tratamento visual; render frame-accurate via Remotion (sem editor manual por clip).
**Directório:** `D:\Mega\_1_Varios_Save\Simao-sina` (código em `remotion-studio/`)
**Why:** Produzir vídeos de letra à escala, programaticamente — o timing e o estilo vivem em código versionável, não numa timeline de editor.
**How to apply:** Composições/timing/props → skill `remotion`. Pipeline render → `video` + `hyperframes`. Análise de vídeo gerado → `watch` (WhisperX local) ou `gemini-brain` (cloud). Composições React/TSX → cluster `frontend` / `frontend-design`. Sync letra↔áudio → `whisper-sync.py` (WhisperX).

## Estrutura
- `remotion-studio/src/` — código principal (23 `.tsx`)
  - `Root.tsx` — registo de **32 composições** (8 horizontais + 24 clips verticais)
  - `<Musica>.tsx` (horizontal 1920×1080) + `<Musica>Vertical.tsx` (vertical 1080×1920, props clipStart/End)
  - `LyricVideo.tsx`/`LyricVideoV2/V3/V4.tsx` — engines reutilizáveis (Recreio horizontal usa V3)
  - `lyrics.ts` (=música 1) + `lyrics2..8.ts` — dados de letra + timing por música. Variantes de trabalho no disco: `lyrics1_new`, `lyrics2_new`, `lyrics2_whisperx`, `lyrics3_new` (não importadas no Root)
  - **Órfãos no disco** (não importados): `RecreioCimentoV2.tsx` (referência do pattern location-based), `OVelhoNoBanco.tsx` (horizontal antigo de Banco de Jardim, manter até validar "Manifesto")
  - `whisper-sync.py` — sync automático letra↔áudio (WhisperX)
- `remotion-studio/public/` — `audioN.wav` (1–8; `audio.wav`=1) + `coverN.png` (1–8). `audio2_whisperx.txt` extra.
- `remotion-studio/out/` — **vazio** (os renders finais vivem em `Albuns/O Ciclo/Videos/`, não aqui)
- `Albuns/` — `Lapis Azul` (standalone), `O Ciclo` (8 faixas: Material/Musicas/Social/Videos), `Volume no Máximo` (Material/Musicas/Videos — em produção), `Planear` (clips agendados)
- `Planos/` — `Plano-Social-O-Ciclo.html` + `YouTube-Descricoes.md`. (`Planos/Mes_1/` = plano de conteúdo 25 Abr→24 Mai 2026, janela expirada)
- `graphify-out/` — graph do código (GRAPH_REPORT.md + graph.json); última build 2026-06-19

## Estado actual
**Álbum "O Ciclo" COMPLETO E RENDERIZADO** — 8 músicas, cada uma com horizontal 16:9 + 3 clips verticais 9:16. Os **32 MP4 finais estão exportados** em `Albuns/O Ciclo/Videos/`:
01 Recreio de Cimento · 02 Contra Todos · 03 Evento Perdido · 04 Só Mais Um · 05 A Mesma Canção · 06 Herança · 07 Banco de Jardim · 08 O Eco (ex-OFimDaEscala).
**"Volume no Máximo"** — em produção (música pronta, **sem vídeos** feitos).
**"Lápis Azul"** — faixa standalone (material/música/social/vídeos).

### IDs das composições (`Root.tsx`)
- Horizontais: `01-Recreio-Final` (LyricVideoV3, 217s) · `02-Contra-Todos-Final` (205s) · `03-EventoPerdido` (167s) · `04-SoMaisUm` (151.64s) · `05-AMesmaCAncao` (205.64s) · `06-Heranca` (190.84s) · `07-BancodeJardim` (238.78s) · `08-OEco` (componente `OFimDaEscala`, 165s).
- Verticais A/B/C por música (`<Musica>Vertical`), parametrizados via props. Ex.: `08-OEco-CLIP-A-EcoDeAmor`/`-B-ATempestade`/`-C-OMiudo`; `07-BancodeJardim-CLIP-A-ContaCheia`/`-B-Netos`/`-C-VendiASaude`.
- **Nota:** `08-OEco` mudou só o `id` da composição; **ficheiros e componente mantêm `OFimDaEscala*`**.

## Distribuição — O Ciclo (campanha social)
Concept album = ciclo de vida (8 cap.): 01 escola → 02 rebeldia → 03 desamor → 04 trabalho → 05 rotina → 06 paternidade → 07 velhice → 08 morte/legado.
- **Letras canónicas:** `Albuns/O Ciclo/Material/NN <nome>.txt` (limpas; NÃO os `_whisperx`/`_tempos`).
- **Vídeos finais:** `Albuns/O Ciclo/Videos/` — 8 horizontais + 24 verticais A/B/C. **Imagens:** `Albuns/O Ciclo/Social/0N-post.png` + `_Imagens/*.png`.
- **YouTube (estado 2026-06-20):** 04 Só Mais Um + 05 A Mesma Canção já publicados; restantes 6 a publicar. Descrições dos 6 em falta → `Planos/YouTube-Descricoes.md` (hook poético → `LETRA` → boilerplate "Sobre este Projeto", site simaosina.renatoferreira.org → hashtags). Falta criar playlist "O Ciclo" (ordem 01→08).
- **Plano social** → `Planos/Plano-Social-O-Ciclo.html` (auto-contido, dark, copy-buttons). Sprint **1 clip/dia, 20 Jun→17 Jul 2026**, mesmo clip cross-post TikTok+Reels+Shorts (Reel primeiro, export limpo sem watermark), 8 carrosséis IG intercalados. Inclui calendário 28 dias, 24+8 captions, descrições YT.
- **Estratégia** (workflow 5 agentes): sequência por força de hook ≠ ordem álbum (liderar 04+05); hook texto no seg. 0 + legendar tudo; Official Sound + "usa este som"; 4-5 hashtags (`#raptuga #rapportugues #hiphoptuga #rapdeintervencao`); maior ROI = pitch à **Rimas e Batidas** + **Hip Hop Portugal** semana 1; carrosséis = save-engine; posicionar na linhagem Valete/Capicua/Sam The Kid.

## Workflow: re-sincronizar letra ↔ áudio (forced alignment)
WhisperX vive num **venv separado**: `C:\Users\renat\Projetos\musica\whisperx\venv\Scripts\python.exe` (NÃO no python global — falta `whisperx`/`torch`). Modelos cached em `~/.cache/huggingface/hub`: faster-whisper base/large-v2/**large-v3** + wav2vec2-pt.
- `whisper-sync.py` usa modelo `base` → mistranscreve voz cantada. Para correcção fina: **large-v3**.
- Melhor abordagem: transcrever+alinhar com large-v3, despejar timeline palavra-a-palavra, corrigir só os `start` das linhas existentes (preservar texto/segmentação). NÃO regenerar via script (re-divide linhas, reintroduz parênteses).
- **Convenção:** `lyrics*.ts` = tempos whisperx − **0,20s** (lead-in). Manter ao corrigir.
- Console Windows: `sys.stdout.reconfigure(encoding="utf-8")` (cp1252 rebenta em `Δ`).
- Fontes de timing por música: `Albuns/O Ciclo/Material/NN <nome>_whisperx.txt` (limpo) e `_tempos.txt` (Premiere, word-level, garbled mas 2ª fonte; timecode 25fps → `seg = HH*3600+MM*60+SS+FF/25`).
- **Colisão a vigiar:** 2 linhas com o mesmo `start` → o motor mostra só a última (a outra nunca aparece).

## Pattern: location-based composition (RecreioCimentoV2)
Para músicas com 2+ ambientes narrativos distintos (recreio↔aula, cama↔rua, dia↔noite):
- `type Location = "A" | "B"` + `type Phase` granular (mantém fidelidade lírica)
- `getLocation(phase)` mapeia cada phase ao local primário
- Backgrounds: 2 `AbsoluteFill` stacked, opacidade por location; bells = phases de transição → cross-fade `interpolate`
- Text style (palette, font, jitter, rotation) segue location; phases especiais (interrogation, erased) fazem overlay DENTRO da location
- Vantagem vs phase-linear: arquitectura visual binária e clara, sem inflação de tratamentos.

## Pattern: tipografia editorial "Manifesto" (BancoDeJardim)
Estilo alternativo ao fotográfico/sépia — **só tipografia**, GPU-leve. Em `BancoDeJardim.tsx` (horizontal) + `BancoDeJardimVertical.tsx` (clips):
- Canvas carvão quente (`#100D0A`), serifa de alto contraste (Playfair Display) nos versos + sans pesado maiúsculas (Anton) nos refrões; cor narrativa por secção (`getSection`).
- Motion: **uma linha de cada vez** — cascata por palavra na entrada; a linha sobe+desvanece antes da próxima. **Sem crossfade de 2 linhas grandes** (colidem).
- **Performance (lição):** o arraste no preview vinha de `filter` CSS full-screen (sépia+blur) re-rasterizado por frame. Regras: **animar só `transform`+`opacity`**, nunca `filter`/blur full-screen; Ken Burns sobre imagem filtrada → isolar o `scale` num wrapper com `willChange:transform`; glows = radial-gradient estático com `opacity` animada.

## Pattern: clips verticais (componentes `*Vertical`)
Cada música tem 3 clips 9:16 (A/B/C) que reutilizam UM componente `<Musica>Vertical.tsx`, parametrizado em `Root.tsx`.
- **Engine clássico** (props `clipStartSec`, `clipEndSec`, `paddingSec`): `durationInFrames = Math.ceil((clipEndSec - clipStartSec + 2*paddingSec) * FPS)`. Frame 0 = song-time `clipStartSec - paddingSec` (= offset do áudio via `startFrom`). `paddingSec` controla fade (≈`padding*0.85`s) E offset de áudio em simultâneo (acoplados).
- **Engine novo `BancoDeJardimVertical`**: `clipStartSec`/`clipEndSec` directos + fade in/out via overlay preto (`opacity = 1 - clipFade`), **SEM `paddingSec`**. `virtualSec = frame/fps + clipStartSec`.

### Bug "primeira frase em falta" (CORRIGIDO em vários)
Lógica antiga escondia a 1ª linha apanhada pela janela e deixava vazar a linha anterior no frame 0. **Fix:** filtro limpo `lyrics.filter(l => l.start >= clipStartSec && l.start <= clipEndSec)` + pôr `clipStartSec` = `start` exacto da 1ª frase.
- **Já com filtro limpo / zona-based:** `RecreioCimentoVertical`, `HerancaVertical`, `ContraTodosVertical`.
- **Com props `keepFirstLine`/`keepLastLine`:** `EventoPerdidoVertical` (só First), `OFimDaEscalaVertical` (First+Last, + `tunnelClimaxSec`).
- **POR VERIFICAR:** `AMesmaCancaoVertical` (provável lógica antiga).
- `OVelhoNoBancoVertical` apagado (Banco de Jardim usa `BancoDeJardimVertical`).

### Safe zones TikTok/Reels
Texto fora do topo (~200px: user/som) e fundo (~560-700px: caption+botões). Linha activa grande+centrada-baixa; passadas pequenas/dim. Não cross-promover plataformas (sem end card "no YouTube").

## Regras de iteração (CRÍTICO)
- **NÃO renderizar MP4 entre iterações.** Editar `.tsx` → Remotion Studio (`localhost:3000`) hot-reload + scrub frame-accurate. Render só com pedido explícito (`renderiza`/`exporta`). ~2-3 min por vídeo de ~217s.
- **Port:** Remotion default 7371 colide com JOCA. Usar `PORT=3000 npm run dev`.
- **Lint:** outros ficheiros têm 10+ erros pré-existentes não relacionados — ignorar. Verificar só `npx tsc --noEmit 2>&1 | grep <ficheiro-actual>`.
- **Python:** neste Windows, `python3` é o stub da Store (sem pacotes). Usar `python` (Python312) para graphify/whisper.
- **Graph:** CLI tem bug → actualizar via `python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"`.

## Comandos
```bash
cd remotion-studio
PORT=3000 npm run dev        # Remotion Studio (dev)
npm run build                # remotion bundle
npm run lint                 # eslint src && tsc
npx remotion render src/index.ts <CompositionId> out/<nome>.mp4
```

## Distribuição agendada via TryPost (2026-06-27)
Campanha "O Ciclo" **agendada e2e no TryPost** (`trypost.rfdev.pt`, MCP `mcp__trypost__*`, workspace "Admin's Workspace"). Contas ligadas: **Instagram** `simao_sina` + **TikTok** `simaosinapt`. **34 posts `scheduled`** (27 Jun 18:00 → 18 Jul 11:30, Lisboa):
- **26 Reels/clips** (vídeo): IG diário + TikTok dia-sim-dia-não, **cruzam a 5 Jul** (clip idx 11 "SóMaisUm-C") e daí publicam juntos. 18 têm TikTok activo.
- **8 carrosséis** (IG feed, `instagram_feed`, 4:5): ordem de álbum 1→8, midday, ~1 cada 3 dias. Caps. 1-4 = capa `0N-post.png` + extras `_Imagens/NN.png` (mapa NN = capítulo_slide); **caps. 5-8 = só capa** (slides de letra/CTA nunca gerados como ficheiros).
- Captions do `Plano-Social-O-Ciclo.html` (preset IG nos IG-só, preset TikTok nos TikTok-só/conjuntos).
- **Verdade do estado pré-sessão (confirmado pelo user):** publicaram-se em ordem do plano até TikTok=Dia 6 (Contra Todos-A) e IG=Dia 2 (A Mesma Canção-A); TryPost estava vazio (posts feitos manualmente nas apps).
- **Mecânica TryPost:** `create-post` (draft) → `request-media-upload` (token, cap 50 MB) → `curl -F media=@file` (HTTP 201) → `attach-media-from-upload` (anexa por ordem; para carrossel, capa primeiro depois extras em passos separados p/ não competir). Agendar = `update-post` (TikTok exige `meta.privacy_level`, usei `PUBLIC_TO_EVERYONE`; em joint passar AMBAS as plataformas senão IG é desactivado) → `publish-post` com `scheduled_at` futuro (status draft→scheduled).
- ⚠ **TikTok em sandbox** — agendamento aceite, mas publicação real pode falhar/sair privada até auditar a app. IG não afectado.
- **Fora do TryPost:** YouTube Shorts (sem conta ligada) = manual.

## Pendente / decisões em aberto
- **Re-render** (se houver mudanças desde 2026-06-19): os MP4 em `Albuns/O Ciclo/Videos/` reflectem o último estado renderizado — confirmar que correspondem ao código actual antes de publicar.
- **YouTube:** publicar 6 descrições em falta (01,02,03,06,07,08) + criar playlist "O Ciclo" (01→08). Confirmar que os 24 MP4 verticais estão limpos (sem watermark) com hook de texto no seg. 0. **Shorts não dão pelo TryPost (sem conta YT ligada) → manual.**
- **TikTok sandbox:** monitorizar o 1º TikTok agendado (27 Jun 18:30) para validar publicação real antes de confiar nos 17 seguintes; se falhar, auditar/sair do sandbox da app TikTok.
- **Carrosséis caps. 5-8:** só têm a capa (1 slide). Opcional: gerar slides de letra+CTA em falta (img-gen, no sistema visual da capa) para carrosséis completos.
- **Verificar bug "primeira frase em falta"** em `AMesmaCancaoVertical`.
- **Banco de Jardim:** decidir se o estilo "Manifesto" se aplica a outras músicas; `OVelhoNoBanco.tsx` órfão — apagar quando o autor validar o novo.
- **08 O Eco:** opcional renomear ficheiros/componente `OFimDaEscala*` → `OEco*` (só a `id` mudou). Re-sync large-v3 de outras músicas se reportarem dessync.
- **Ficheiros órfãos no disco** a decidir apagar/manter: `RecreioCimentoV2.tsx` (referência pattern), `OVelhoNoBanco.tsx` (comparação Manifesto), variantes `lyrics*_new`/`lyrics2_whisperx`.
- **"Volume no Máximo":** produzir vídeos (música pronta).
- **Plano de conteúdo `Mes_1`** (25 Abr→24 Mai 2026) — janela expirada; reavaliar calendário (sprint social 20 Jun→17 Jul é o plano vivo).
- Replicar (se pedido) pattern location-based e/ou estilo "Manifesto" + fades a outras músicas.

## Última sessão
2026-06-27 — **Agendamento social via TryPost** (sem código): 34 posts `scheduled` (26 Reels/clips IG+TikTok + 8 carrosséis IG), 27 Jun→18 Jul, a partir do `Plano-Social-O-Ciclo.html`. Reels re-sincronizam IG↔TikTok (cruzam 5 Jul); carrosséis ordem de álbum 1→8. TikTok em sandbox (risco de publicação real). Ver secção "Distribuição agendada via TryPost".
2026-06-20 — **Distribuição/marketing** (sem código): plano de distribuição completo de "O Ciclo" entregue (`Planos/Plano-Social-O-Ciclo.html` + `Planos/YouTube-Descricoes.md`). 04+05 já no YouTube; restantes 6 por publicar.
2026-06-19 — afinação de clips verticais 9:16; redesign de Banco de Jardim ("Manifesto"); re-sync large-v3 da lyrics8 (O Eco) e verificação 4-fontes da lyrics7; correcção do bug "primeira frase em falta" em Recreio/Herança/ContraTodos; Clip C de O Eco substituído por "O Miúdo". Última build do graph nesta data.
<!-- preenchido por /resume + análise directa do código -->

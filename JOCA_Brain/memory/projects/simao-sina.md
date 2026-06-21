---
name: simao-sina
description: Engine de lyric videos programáticos (Remotion + React) para o músico Simão/Sina — horizontal 16:9 + verticais 9:16
type: project
directorio: D:\Mega\_1_Varios_Save\Simao-sina
---

**Stack:** Remotion 4.0.446 · React 19.2.3 · TypeScript 5.9.3 · Tailwind v4
**Objectivo:** Engine de lyric videos programáticos para o músico Simão/Sina. Cada música gera versão horizontal 1920×1080 (YouTube) + 3 clips verticais 1080×1920 (IG Reels / TikTok / YT Shorts).
**Directório:** `D:\Mega\_1_Varios_Save\Simao-sina` (código em `remotion-studio/`)
**Why:** Produzir vídeos de letra à escala, programaticamente, sem editor manual por clip — código `.tsx` define timing e tratamento visual, render frame-accurate via Remotion.
**How to apply:** Composições/timing/props → skill `remotion`. Pipeline render → `video` + `hyperframes`. Análise de vídeo gerado → `watch` (WhisperX local) ou `gemini-brain` (cloud). Composições React/TSX → cluster `frontend`. Sync letra↔áudio → `whisper-sync.py` (WhisperX).

## Estrutura
- `remotion-studio/src/` — código principal (22 `.tsx`)
  - `Root.tsx` — registo de composições (8 músicas × 4 = 32 comps)
  - `<Musica>.tsx` (horizontal) + `<Musica>Vertical.tsx` (vertical, com clipStart/End)
  - `LyricVideo.tsx`..`LyricVideoV4.tsx` — engines reutilizáveis (V1–V4)
  - `lyrics1..8.ts` — dados de letra + timing por música
  - `whisper-sync.py` — sync automático letra↔áudio (WhisperX)
- `remotion-studio/public/` — `audioN.wav` + `coverN.png` (1–8)
- `Albuns/` — `Lapis Azul` (standalone), `O Ciclo` (8 faixas), `Volume no Máximo` (em produção), `Planear` (clips agendados)
- `Planos/Mes_1/` — plano de conteúdo + `plano_visualizacao.html`

## Estado actual
**Álbum "O Ciclo" COMPLETO** — 8 músicas, cada uma com horizontal 16:9 + 3 clips verticais 9:16:
01 Recreio de Cimento · 02 Contra Todos · 03 Evento Perdido · 04 Só Mais Um · 05 A Mesma Canção · 06 Herança · 07 Banco de Jardim · 08 O Eco (ex-OFimDaEscala).
**"Volume no Máximo"** — em produção (música pronta, sem vídeos).
**"Lápis Azul"** — faixa standalone.

Última sessão (2026-06-19): afinação de clips verticais 9:16. Corrigido bug "primeira frase em falta" nos componentes `*Vertical` (ver secção abaixo). Recreio A/B/C, Herança A/B/C alinhados na 1ª frase. Só Mais Um (04) melhorado para TikTok/Reels (end card removido, terminal/excel centrado+maior, clip A cortado em 00:23.04, queue sem flash de popups). Vários ajustes finos de duração por pedido.

Continuação (2026-06-19, tarde): **03 Evento Perdido** clips A/B/C — UI TikTok/IG: fonte maior (58/48/40), centrado no terço superior, band `top:300`→`bottom:560`; removidos gradiente-máscara + `overflow:hidden` (cortavam caixas); `keepFirstLine` nos 3 (1ª frase visível); Clip C +2,5s no fim.
**08 O Eco:** renomeado `08-OFimDaEscala` → `08-OEco` (só `id`; ficheiros/componente mantêm `OFimDaEscala*`). **lyrics8 re-sincronizada** via WhisperX large-v3 forced alignment (workflow abaixo) — 9 linhas corrigidas, pior "O que é que fica…" ~3s atrasada; "O eco… o eco…" separada de "Um eco de amor…" (tinham `start` igual → eco tapava a principal). Clips 08: `STROBE_TIMES` revivido (estava morto — valores raw sem −0.2), fases re-alinhadas, props `keepFirstLine`/`keepLastLine`/`tunnelClimaxSec`. **Clip C substituído**: era "Ponto Final" (explosão) → `08-OEco-CLIP-C-OMiudo` (nostalgia "miúdo que queria mudar o mundo", 23.2–38s, fase tunnel).

Continuação (2026-06-19, noite): **02 Contra Todos** clips A/B/C re-âncorados na 1ª frase certa — corrigida a exclusão de `ContraTodosVertical` para **zona-based** (esconde só lyrics dentro do padding, não "primeiro >= offset"; comportamento idêntico para B/C, verificado). A=hook "E é por isso…", B=pergunta "O que é que vais ser da vida?", C="E no meio da guerra…".
**07 Banco de Jardim REFEITO DE RAIZ:** primeiro optimizada a perf (Ken Burns isolado + `willChange` + snap do zoom + blur de texto reduzido), depois **redesign total** → novo estilo **"Manifesto"** (`BancoDeJardim.tsx`, ver pattern no CLAUDE.md do projecto). lyrics7 **verificada com 4 fontes** (whisperx + `_tempos.txt` + faster-whisper + gemini-brain) → confirmada certa (whisperx−0.2); fix colisão "Mas é cansaço"/"Yeah" (Yeah→24.0), "vi"→"vivi", + vários nudges do autor. **3 clips verticais novos** escolhidos por **workflow de análise viral** (painel 3 lentes→síntese): `BancoDeJardimVertical` (engine novo: `clipStartSec`/`clipEndSec` directos + fade in/out via overlay preto, SEM `paddingSec`). A=ContaCheia (201.7–216.8s, "Com a conta cheia e o coração vazio"), B=Netos (167.3–182.7s, glow âmbar), C=VendiASaude (125.5–144.6s, tom frio). Apagados os 3 clips antigos + `OVelhoNoBancoVertical.tsx`. `OVelhoNoBanco.tsx` (horizontal antigo) mantido órfão p/ comparar.

Sessão 2026-06-20: **Distribuição/marketing** (sem código). YouTube: 04 Só Mais Um + 05 A Mesma Canção já publicados; restantes 6 a publicar. Entregue **plano de distribuição completo** — ver secção "## Distribuição — O Ciclo" abaixo.

## Distribuição — O Ciclo (campanha social)
Concept album = ciclo de vida (8 cap.): 01 escola → 02 rebeldia → 03 desamor → 04 trabalho → 05 rotina → 06 paternidade → 07 velhice → 08 morte/legado.
- **Letras canónicas:** `Albuns/O Ciclo/Material/NN <nome>.txt` (limpas; NÃO os `_whisperx`/`_tempos`).
- **Vídeos finais:** `Albuns/O Ciclo/Videos/` — 8 horizontais (YouTube) + 24 verticais A/B/C (TikTok/IG/Shorts). **Imagens:** `Albuns/O Ciclo/Social/0N-post.png` (8 quadrados) + `_Imagens/*.png` (extra).
- **Descrições YouTube** (6 em falta) → `Planos/YouTube-Descricoes.md`. Formato: hook poético → `LETRA` → boilerplate "Sobre este Projeto" (site simaosina.renatoferreira.org) → hashtags por música. Calibrado pelo exemplo publicado de 05.
- **Plano social** → `Planos/Plano-Social-O-Ciclo.html` (auto-contido, dark, copy-buttons). Sprint **1 clip/dia, 20 Jun→17 Jul 2026**, mesmo clip cross-post TikTok+Reels+Shorts (Reel primeiro, export limpo sem watermark), 8 carrosséis IG intercalados. Inclui calendário 28 dias, 24+8 captions prontas, descrições YT integradas.
- **Estratégia** (de workflow de análise de mercado, 5 agentes): sequência por força de hook ≠ ordem álbum (liderar 04+05, dores universais já no YT); hook texto no seg. 0 + legendar tudo; Official Sound/faixa + "usa este som"; 4-5 hashtags (`#raptuga #rapportugues #hiphoptuga #rapdeintervencao`); maior ROI = pitch à **Rimas e Batidas** + **Hip Hop Portugal** semana 1; carrosséis = save-engine; posicionar na linhagem Valete/Capicua/Sam The Kid.

## Workflow: re-sincronizar letra ↔ áudio (forced alignment)
WhisperX vive num **venv separado**: `C:\Users\renat\Projetos\musica\whisperx\venv\Scripts\python.exe` (NÃO no python global — falta `whisperx`/`torch`). Modelos cached em `~/.cache/huggingface/hub`: faster-whisper base/large-v2/**large-v3** + wav2vec2-pt.
- `whisper-sync.py` usa modelo `base` → mistranscreve voz cantada + heurística `find_line_start` falha. Para correcção fina: **large-v3**.
- Melhor abordagem: transcrever+alinhar com large-v3, despejar timeline palavra-a-palavra, corrigir só os `start` das linhas existentes (preservar texto/segmentação). NÃO regenerar via script (re-divide linhas, reintroduz parênteses).
- **Convenção:** `lyrics*.ts` = tempos whisperx − **0,20s** (lead-in). Manter ao corrigir.
- Console Windows: `sys.stdout.reconfigure(encoding="utf-8")` (cp1252 rebenta em `Δ`).
- Fontes de timing por música em `Albuns/O Ciclo/Material/NN <nome>_whisperx.txt` (limpo) e `_tempos.txt` (Premiere, word-level, garbled mas 2ª fonte independente).

Sessão 2026-06-18: removida a composição `01-Recreio-Final-V2` do `Root.tsx` (bloco `<Composition>` + import `RecreioCimentoV2`). `01-Recreio-Final` (engine V3) mantém-se. Ficheiro `RecreioCimentoV2.tsx` ficou órfão no disco. Criada esta entrada de memória + index. (Sessão anterior, 28 Mai: introdução do pattern location-based em `RecreioCimentoV2`.)

## Pattern: location-based composition (RecreioCimentoV2)
Para músicas com 2+ ambientes narrativos distintos (recreio↔aula, cama↔rua, dia↔noite):
- `type Location = "A" | "B"` + `type Phase` granular (mantém fidelidade lírica)
- `getLocation(phase)` mapeia cada phase ao local primário
- Backgrounds: 2 `AbsoluteFill` stacked, opacidade controlada por location; bells = phases de transição → cross-fade `interpolate`
- Text style (palette, font, jitter, rotation) segue location; phases especiais (interrogation, erased) fazem overlay DENTRO da location
- Vantagem vs phase-linear: arquitectura visual binária e clara, sem inflação de tratamentos.

## Pattern: clips verticais (componentes `*Vertical`)
Cada música tem 3 clips 9:16 (A/B/C) que reutilizam UM componente `<Musica>Vertical.tsx`, parametrizado em `Root.tsx` via props `clipStartSec`, `clipEndSec`, `paddingSec`.
- **Duração:** `durationInFrames = Math.ceil((clipEndSec - clipStartSec + 2*paddingSec) * FPS)`. FPS=30.
- **Timeline do clip:** frame 0 = song-time `offsetSec = clipStartSec - paddingSec` (é também onde o áudio entra, via `startFrom`). Duração do clip em segundos = `clipEnd - clipStart + 2*padding`. Para "terminar aos MM:SS", resolver `clipEndSec` a partir disso.
- **Fade in/out:** `paddingSec` controla o fade (≈`padding*0.85`s) E o offset de áudio em simultâneo — são acoplados. Mudar padding muda início+fade+outro juntos.

### Bug "primeira frase em falta" (CORRIGIDO em Recreio + Herança)
Lógica antiga escondia a linha apanhada pela janela (`firstClipLyricIdx`/`lastClipLyricIdx`) e DEIXAVA VAZAR a linha anterior no frame 0. Resultado: 1ª frase real escondida + frase errada a aparecer.
**Fix aplicado:** substituir por filtro limpo
```ts
const visibleLyrics = lyrics.filter(l => l.start >= clipStartSec && l.start <= clipEndSec);
```
Depois pôr `clipStartSec` = `start` exacto da 1ª frase desejada (o autor punha-o ~0.2s à frente, o que dropava a linha). Ajustar `clipEndSec` para preservar a última frase (o filtro limpo já não a esconde).
**Componentes já com filtro limpo:** `RecreioCimentoVertical`, `HerancaVertical`, `ContraTodosVertical` (zona-based, 2026-06-19). `OVelhoNoBancoVertical` apagado (Banco de Jardim usa agora `BancoDeJardimVertical`). **Por verificar:** `AMesmaCancaoVertical`. **Com props `keepFirstLine`/`keepLastLine`** (mantêm o trim mas permitem manter fronteira): `EventoPerdidoVertical` (só First), `OFimDaEscalaVertical` (First+Last, + `tunnelClimaxSec`).

### Safe zones TikTok/Reels (aplicado ao `SoMaisUmVertical`)
Manter texto fora do topo (~top 200px: user/som) e fundo (~bottom 560-700px: caption+botões). Linha activa grande + centrada-baixa; linhas passadas pequenas/dim. Não cross-promover plataformas (removido end card "no YouTube").

## Regras de iteração (CRÍTICO)
- **NÃO renderizar MP4 entre iterações.** Editar `.tsx` → Remotion Studio (`localhost:3000`) hot-reload + scrub frame-accurate. Render só com pedido explícito (`renderiza`/`exporta`). Render ~2-3 min por vídeo de ~217s.
- **Port:** Remotion default 7371 colide com JOCA. Usar `PORT=3000 npm run dev`.
- **Lint:** outros ficheiros têm 10+ erros pré-existentes não relacionados — ignorar. Verificar só `npx tsc --noEmit 2>&1 | grep <ficheiro-actual>`.
- **Python:** neste ambiente Windows, `python3` é o stub da Store (sem pacotes). Usar `python` (Python312) para graphify/whisper.

## Comandos
```bash
cd remotion-studio
PORT=3000 npm run dev        # Remotion Studio
npm run build                # bundle
npm run lint                 # eslint + tsc
npx remotion render src/index.ts <CompositionId> out/<nome>.mp4
```

## Pendente
- **Publicar 6 descrições YouTube** em falta (01,02,03,06,07,08) + criar playlist "O Ciclo" (ordem 01→08).
- **Campanha social a começar 20 Jun 2026** (ver `Planos/Plano-Social-O-Ciclo.html`). Pré-publicação: confirmar que os 24 MP4 verticais estão exportados limpos (sem watermark) e com hook de texto no seg. 0 — não verificado nesta sessão.
- **Verificar bug "primeira frase em falta"** no restante: `AMesmaCancaoVertical` (provável lógica antiga). (`Recreio`, `Heranca`, `ContraTodos` zona-based; `EventoPerdido`/`OFimDaEscala` com keep-props; `OVelhoNoBancoVertical` apagado.)
- **Banco de Jardim:** decidir se o estilo "Manifesto" novo se aplica a outras músicas; `OVelhoNoBanco.tsx` (horizontal antigo) órfão — apagar quando o autor validar o novo.
- Replicar (se pedido) o estilo "Manifesto" + fades nos clips de outras músicas.
- **08 O Eco:** opcional renomear ficheiros/componente `OFimDaEscala*` → `OEco*` (esta sessão mudou só a `id` da composição). Re-sync large-v3 das outras músicas se reportarem dessync.
- Melhorias Excel do `SoMaisUmVertical` ficaram inertes (clip A cortado antes da fase excel) — manter no código, prontas se o clip for estendido.
- `RecreioCimentoV2.tsx` órfão (já não importado) — decidir apagar ficheiro ou manter como referência do pattern.
- Vídeos para "Volume no Máximo".
- Plano de conteúdo 30 dias (25 Abr → 24 Mai 2026) — janela já passou; reavaliar calendário de publicação.
- Avaliar aplicar pattern location-based V2 a outras músicas com 2+ ambientes.
<!-- preenchido por /save -->

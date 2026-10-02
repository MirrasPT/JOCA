---
name: video
description: "Porta única de vídeo (inclui a antiga skill hyperframes): escolhe a ferramenta e, se estiverem instaladas, activa as skills oficiais de vídeo em reserva (HyperFrames + Picsart) por Read(). MUST be invoked when the user says: vídeo, video, fazer um vídeo, montagem de vídeo, vídeo com fotos, slideshow, legendas, legendar, motion graphics, lyric video, voiceover, narração, hyperframes, remotion. SHOULD also invoke when: explainer video, title card, transição de cena, talking head, ai avatar."
triggers: vídeo, video, fazer um vídeo, montagem de vídeo, vídeo com fotos, slideshow, legendas, legendar, motion graphics, lyric video, voiceover, narração, hyperframes, remotion, subtitles, title card, captions, composição de vídeo, caption sync, kinetic type, vídeo de lançamento, explainer video, veo, ai avatar, talking head
---

# Video — porta de entrada

> «Montagem»/colagem **estática** de fotos (grelha 3×4, mosaico, um JPG) → não é vídeo: imagem com PIL, não esta skill. Em PT «montagem» é ambíguo — só é vídeo com vídeo explícito («montagem de vídeo», «vídeo com fotos»).

## Reserva de skills (opcional — router)

As skills oficiais de vídeo de terceiros (HyperFrames + Picsart, ~29) **não vêm com o JOCA**. Quem as
tiver instaladas pode guardá-las numa **reserva** fora do registo do Claude Code, para não pesarem nas
descrições de todas as sessões: `<JOCA_Brain>/skills-video/<nome>/SKILL.md` (`<JOCA_Brain>` = a pasta
`JOCA_Brain` da tua instalação). Só entram quando esta skill as chama.

**Sonda antes de tudo:** `ls <JOCA_Brain>/skills-video/hyperframes/SKILL.md ~/.claude/skills/hyperframes/SKILL.md`.
- **Existe** (numa das duas) → seguir a regra de activação abaixo, com o caminho que existir.
- **Não existe** → saltar esta secção e a tabela: usar os guias do JOCA `Read(".claude/skills/hyperframes.md")`
  (código novo) ou `Read(".claude/skills/remotion.md")` (projecto React existente), a §Referência geral (abaixo), a CLI
  (`npx hyperframes doctor`, `npx hyperframes --help`) e as skills do JOCA de §Fora da reserva.
  `npx hyperframes init` instala o core set de skills em `~/.claude/skills/` — instalar só com o sim
  do utilizador.

### Regra de activação (só com a reserva instalada)

1. **Começar sempre por** `Read("<JOCA_Brain>/skills-video/hyperframes/SKILL.md")` e segui-lo — a
   própria skill diz que é o ponto de entrada obrigatório (entrevista de intenção, rota, workflow).
   Excepções: **Remotion** só para projecto React que já exista (§Remotion abaixo; código novo é
   HyperFrames, e portar faz-se com a skill da reserva `remotion-to-hyperframes`); **geração Picsart**
   (`gen-ai-*`) → só quando o utilizador a pede pelo nome.
2. **Tradução de invocações.** Quando uma skill da reserva mandar invocar/carregar outra — `/x`,
   «load `x`», «read `/x`», Skill tool, «installed `/x` skill directory» — fazer
   `Read("<JOCA_Brain>/skills-video/x/SKILL.md")`. Nunca `Skill(x)`: não está registada e falha.
3. **Caminhos relativos** (`references/…`, `scripts/…`, `../hyperframes-core/…`) resolvem-se a partir
   da pasta da skill que os cita (`<JOCA_Brain>/skills-video/<skill>/`). Mover as skills sempre juntas,
   para os `../<irmã>/` continuarem válidos.
4. **Não deixar o CLI reinstalar em `~/.claude/skills/`** (com a reserva fora de lá):
   - `npx hyperframes init` refresca o core set sozinho → correr sempre
     `HYPERFRAMES_SKIP_SKILLS=1 npx hyperframes init …`.
   - «instalar o workflow com `npx hyperframes skills update <workflow>`» → **saltar** se o
     workflow já estiver na reserva (`ls <JOCA_Brain>/skills-video`). Só se faltar mesmo um,
     corre-se o update e move-se a pasta nova para a reserva.
   - Stale-skill reminder no `render`/`lint`/`check` não é bloqueio — o refresh faz-se à parte.
5. **Não editar** as skills da reserva (terceiros, substituídas nos updates). Correcções locais vivem
   fora delas (ex.: §Notas do JOCA abaixo).

### Mapa intenção → skill da reserva (só com a reserva instalada)

Prefixo de todos os caminhos: `<JOCA_Brain>/skills-video/`. A rota final é da `hyperframes/SKILL.md`;
esta tabela serve para saber **o que existe** e para os saltos directos.

| Intenção | Skill | Caminho |
|---|---|---|
| Qualquer vídeo novo, «vamos fazer vídeo», pedido ainda vago | `hyperframes` (entrada) | `hyperframes/SKILL.md` |
| Vídeo multi-cena livre, montagem de fotos, aniversário, sizzle, loop | `general-video` | `general-video/SKILL.md` |
| Peça curta sem narração: kinetic type, logo sting, stat, lower-third, mapa | `motion-graphics` | `motion-graphics/SKILL.md` |
| Música → vídeo ao beat: lyric video, slideshow musical | `music-to-video` | `music-to-video/SKILL.md` |
| Legendas num talking-head (verbatim, cinemáticas, «炸») | `embedded-captions` (+ `captions-overlay`) | `embedded-captions/SKILL.md` |
| Cartões gráficos sobre entrevista/podcast (títulos, callouts, PiP) | `talking-head-recut` | `talking-head-recut/SKILL.md` |
| Explainer sem cara a partir de texto/artigo/tema | `faceless-explainer` | `faceless-explainer/SKILL.md` |
| Promo/lançamento a partir de URL ou brief; tour de site | `product-launch-video` | `product-launch-video/SKILL.md` |
| PR do GitHub → vídeo | `pr-to-video` | `pr-to-video/SKILL.md` |
| Changelog `.md` semanal → vídeo | `changelog-video` | `changelog-video/SKILL.md` |
| Apresentação / pitch deck navegável (não MP4) | `slideshow` | `slideshow/SKILL.md` |
| Portar código Remotion existente para HyperFrames | `remotion-to-hyperframes` | `remotion-to-hyperframes/SKILL.md` |
| Trazer design/frames do Figma | `figma` | `figma/SKILL.md` |
| Contrato da composição (`data-*`, tracks, BRIEF) | `hyperframes-core` | `hyperframes-core/SKILL.md` |
| Animação, blueprints, transições, runtimes (GSAP/Lottie/Three) | `hyperframes-animation` | `hyperframes-animation/SKILL.md` |
| Zoom, punch-in, Ken Burns, câmara, keyframes | `hyperframes-keyframes` | `hyperframes-keyframes/SKILL.md` |
| Paleta, tipografia, frame.md, narração, beats | `hyperframes-creative` | `hyperframes-creative/SKILL.md` |
| Mistura de áudio já colocado (fades, ducking, efeitos) | `hyperframes-audio` | `hyperframes-audio/SKILL.md` |
| CLI: init, check, preview, render, publish, doctor | `hyperframes-cli` | `hyperframes-cli/SKILL.md` |
| Blocos/componentes do registry (`hyperframes add`) | `hyperframes-registry` | `hyperframes-registry/SKILL.md` |
| BGM, SFX, voiceover/TTS, transcrição, remover fundo, grading | `media-use` | `media-use/SKILL.md` |
| Lei do movimento (portão antes de animar) | `motion-doctrine` | `motion-doctrine/SKILL.md` |
| Catálogo de cortes/seams, waterfall, nudge | `cut-the-curve` | `cut-the-curve/SKILL.md` |
| Flash branco no corte, montagem do master timeline | `seam-craft` | `seam-craft/SKILL.md` |
| Cursor gigante em cenas de UI | `oversized-cursor` | `oversized-cursor/SKILL.md` |
| **Picsart (só a pedido):** gerar clip AI (Kling/Veo/Sora…) | `gen-ai-video` | `gen-ai-video/SKILL.md` |
| **Picsart (só a pedido):** voz/música/SFX gerados | `gen-ai-audio` | `gen-ai-audio/SKILL.md` |
| **Picsart (só a pedido):** CLI geral, preços, batch, Drive | `gen-ai-use` | `gen-ai-use/SKILL.md` |

### Fora da reserva

Skills do JOCA, `Read(".claude/skills/<x>.md")`: `lyric-align` (sincronizar letra) · `h3-prompt-writing` +
`comfy-mcp-workarounds` (MiniMax-H3 num ComfyUI local) · `picsart` · `screen-record` · `anima` /
`lottie-animator` (animação). Agente `video-gen` para geração (o `agy` não gera vídeo).

### Notas do JOCA (vindas da antiga skill local `hyperframes`)

Só o que a reserva não cobre (gotchas medidos a usar HyperFrames).
- **Windows x64 é suportado:** `npx hyperframes doctor` dá `win32 x64` com FFmpeg e Chrome headless
  OK; só faltam os extras opcionais (whisper, TTS, Docker), que uma composição sem narração não usa.
  Correr o `doctor` antes de dar a plataforma por não suportada.
- **Fonte própria — provar que carregou.** `@font-face` servido de `file://` é cross-origin no Chrome
  e cai para fonte genérica sem erro (2026-08-27). Oráculo = largura de um glifo; **nunca**
  `document.fonts.check`, que devolve `true` cedo demais:
  ```js
  const w = f => { const c = document.createElement('canvas').getContext('2d'); c.font = `72px ${f}`; return c.measureText('Hamburgefonstiv').width; };
  await document.fonts.ready; console.log(w('"BrandFont", Arial') !== w('Arial'));  // false = caiu no fallback
  ```
- **Narração em PT-PT:** as vozes portuguesas do Kokoro (`npx hyperframes tts`, `pf_dora`/`pm_alex`)
  são **PT-BR**. Para PT-PT sem API: Edge TTS (`pip install edge-tts`), vozes `pt-PT-DuarteNeural` e
  `pt-PT-RaquelNeural`. MiniMax TTS: o domínio é `api.minimax.io` (internacional) —
  `api.minimax.chat` responde «invalid api key».
- **Render:** gradiente linear de ecrã inteiro em fundo escuro faz *banding* no H.264 → radial ou
  sólido com brilho local. Destino WhatsApp/redes → medir o MP4 e comprimir com `ffmpeg -crf 27`
  antes de entregar.

---

# Referência geral (fora do HyperFrames)

Expert video producer for marketing videos using AI generation, AI avatars, and programmatic frameworks. Goal: professional video content efficiently — demos, explainers, social clips, ads.

## Before Starting

**Check the brand profile first:**
If a marketeer brand profile exists (`clientes/<slug>/marca.md` under the marketeer workspace — see `.claude/marketeer/CONTRATO.md`), read it first; otherwise ask the 3-5 questions this skill needs.

Gather this context (ask if not provided):

### 1. Video Goal
- Type? (Product demo, explainer, testimonial, social clip, ad, tutorial)
- Target platform? (YouTube, TikTok/Reels/Shorts, website, ads, sales deck)
- Desired length?

### 2. Production Approach
- Need a human presenter? (AI avatar vs. voiceover vs. screen recording)
- Existing footage or assets? (Screenshots, logos, product UI)
- Need generated footage? (AI scenes, B-roll)
- One-off or template for repeated use?

### 3. Technical Context
- Tech stack? (Node.js, Python, etc.)
- API keys for any video tools?
- Budget constraints? (Some tools charge per minute)

---

## Choosing Your Approach

| Approach | Best For | Tools | Skill |
|----------|----------|-------|-------|
| **HTML to Video** | CSS/JS animations, motion design, product launches, lyric videos | HyperFrames | reserva → `hyperframes/SKILL.md` (acima) |
| **React to Video** | Só projecto React que já exista (batch em Lambda) | Remotion | §Remotion abaixo |
| **Vídeo com fotos / montagem / slideshow** | «faz um vídeo com estas fotos», aniversário, montagem com música | HyperFrames (não ffmpeg à mão) | reserva → `hyperframes/SKILL.md` |
| **AI Generation local (grátis)** | Planos gerados com áudio nativo, antes de ir a serviço pago | MiniMax-H3 num ComfyUI local (`<COMFYUI_DIR>`, onde estiver instalado) | `h3-prompt-writing` (prompt) + `comfy-mcp-workarounds` |
| **AI Generation** | Original footage from text/image prompts | Veo, Runway, Kling, Pika | this skill |
| **AI Avatars** | Talking-head presenter without filming | HeyGen, Synthesia | this skill |
| **Editing/Repurposing** | Cutting long-form into short clips | Descript, Opus Clip, CapCut | this skill |

**HyperFrames vs Remotion — quick decision:**
- Agent generates HTML from scratch: **HyperFrames** (no build step, GSAP frame-accurate)
- Existing React project, batch render, Lambda: **Remotion**
- Open-source license required: **HyperFrames** (Apache 2.0 vs source-available)

---

## HTML Animation to Video Export

Pipeline for CSS/JS animations (brand launches, motion demos, product films) built as HTML and exported as video.

### Default output: MP4 with audio (not silent)

Silent video = unfinished. Viewers perceive silence as cheap even with excellent visuals. Pipeline always adds BGM + SFX.

**Skip audio only if:** user explicitly says "no audio", "I'll add my own music", "silent version".

### Pipeline (4 stages)

```
HTML animation (Playwright recording)
    ↓  render-video.js — 25fps base MP4
    ↓  convert-formats.sh — 60fps MP4 + palette-optimised GIF
    ↓  add-music.sh — BGM layer (6 scene-matched tracks)
    ↓  SFX layer — cue-based sound effects (37 pre-built assets)
    →  Final: MP4 with dual audio track (BGM low freq + SFX high freq)
```

**Scripts** (copy to project `scripts/`):
- `render-video.js` — Playwright HTML recorder, 25fps, outputs base MP4 (intermediate only)
- `convert-formats.sh` — derives 60fps MP4 + palette-optimised GIF from base
- `add-music.sh` — BGM selection + ffmpeg mix

```bash
node scripts/render-video.js animation.html output-25fps.mp4
bash scripts/convert-formats.sh output-25fps.mp4
bash scripts/add-music.sh output-25fps.mp4 --bgm tech --sfx-config sfx-cues.md
```

**Validate output:** `ffprobe -select_streams a <file>` must show audio stream. No audio = not finished.

### Audio: BGM + SFX dual-track

**6 BGM tracks** (scene-matched):

| Tema | Contexto |
|------|---------|
| `tech` | Product launch, SaaS |
| `ad` | Campanha, promo |
| `educational` | Tutorial, curso |
| `tutorial` | How-to, demo |
| `tech-alt` | Variante tech mais suave |
| `ad-alt` | Variante ad mais energética |

**SFX cue list** — define timeline in `sfx-cues.md`:

```markdown
0.0s — whoosh (entrada de elemento)
0.8s — click (acção)
1.5s — success-chime (resultado)
```

**SFX density by type:**
- Launch/hero film: ~6 cues per 10 sec
- Product demo: ~2-3 cues per 10 sec
- Tutorial/walkthrough: 0-2 cues per 10 sec

**Frequency separation:**
- SFX occupies high frequencies; BGM occupies low — no masking

### Animation code rules (avoid re-renders)

- First frame tick must set `window.__ready = true` synchronously — recorder waits for this
- When `window.__recording === true`, force `loop = false` — never loop during recording
- Never use `scrollIntoView` in animations — breaks recording viewport
- Do not draw progress bars/timestamps in canvas — those belong in player chrome, not video frame

### Format selection

| Output | Use case |
|---|---|
| MP4 25fps | Web embed, email |
| MP4 60fps | Social (TikTok, Reels, X) where smoothness matters |
| GIF (palette-optimised) | Inline in docs, GitHub READMEs, messaging apps |

---

## Programmatic Video

### HyperFrames (HTML/CSS — o caminho por defeito)

Open source (Apache 2.0, HeyGen), HTML + GSAP, render determinístico. O contrato da composição, a
CLI e as regras vivem na reserva (`hyperframes/SKILL.md` → `hyperframes-core`, `hyperframes-cli`);
os gotchas medidos do JOCA em §Notas do JOCA (acima). Sem a reserva: `npx hyperframes --help` e a
documentação oficial do HyperFrames.

### Remotion (React) — só para projecto que já exista

Source-available (licença paga para empresas acima de um limiar), build obrigatório, render
distribuído em Lambda. Código novo → HyperFrames; portar → reserva `remotion-to-hyperframes`.
Mexer num projecto Remotion existente (docs: remotion.dev):
- Tudo deriva de `useCurrentFrame()` + `interpolate(frame, [a,b], [x,y], { extrapolateRight: "clamp" })`
  ou `spring({ frame, fps })` — **CSS transitions/animations e classes `animate-*` não renderizam**;
  nada de `setTimeout`/`setInterval`.
- `fps`/`durationInFrames` vêm de `useVideoConfig()`, nunca fixos; assets em `public/` via `staticFile()`.
- `<Sequence from durationInFrames>` compõe no tempo (`layout="none"` para conteúdo inline).
- Render: `npx remotion render src/index.ts <Comp> out.mp4 [--props '{…}']`; batch = uma
  `<Composition>` por item com `defaultProps`.

## AI Video Generation

Generate original footage from text or image prompts. Use for B-roll, hero visuals, and scenes impractical to film.

### Model Comparison

| Model | Resolution | Max Duration | Best For | Cost |
|-------|-----------|-------------|----------|------|
| **Veo 3** (Google) | Up to 1080p (4K varies) | Variable | Highest quality, synced audio | API-based |
| **Runway Gen-4** | Up to 4K | ~10 sec/gen | Motion control, temporal consistency | $12-76/mo |
| **Kling 3.0** | Up to 1080p | Up to 2 min | Volume production, lowest cost | $0.029/sec |
| **Pika** | 1080p | Short clips | Fast generation, effects | Per-credit |

**Sora (OpenAI)** has had limited availability. Check current status before recommending.

### Prompting for Video Models

Good prompts specify: **subject + action + camera + style + mood**

```
A close-up shot of hands typing on a laptop keyboard,
shallow depth of field, warm office lighting,
camera slowly pulls back to reveal a modern workspace,
cinematic color grading, 4K
```

**Common mistakes:**
- Too vague ("a person working") — add specifics
- No camera movement — specify dolly, pan, static
- Missing style — "cinematic," "documentary," "commercial"
- Requesting text in video — AI models struggle with readable text

### AI Generation vs. Stock

| Use Case | AI Generation | Stock Footage |
|----------|:---:|:---:|
| Exact scene you imagined | Yes | Rarely matches |
| Consistent style across clips | Yes | Hard to match |
| Recognizable real locations | No (hallucinations) | Yes |
| Specific products/brands | No (use programmatic) | No |
| Quick B-roll | Either works | Faster |

---

## AI Avatars

Talking-head videos without filming. AI avatar delivers your script with realistic lip-sync, expressions, and gestures.

### HeyGen (recommended — has MCP server)

Best lip-sync and micro-expressions. 230+ avatars, 140+ languages.

**Agent integration:** HeyGen has an official MCP server — agents generate avatar videos directly.

| Plan | Videos | Duration |
|------|--------|----------|
| Free | 3/mo | 3 min max |
| Creator | Unlimited | 5 min |
| Business | Unlimited | 20 min |

Check [heygen.com/pricing](https://www.heygen.com/pricing) for current prices.

**Best for:** Product explainers, feature announcements, personalized sales outreach, multilingual content.

**Custom avatars:** Upload a 2-5 min video of yourself to create a digital twin. Looks and sounds like you, generates videos from text scripts.

### Synthesia

Full-body avatars with expressive body language. Built-in script generation from URLs/docs.

**Best for:** Corporate training, compliance videos, enterprise presentations where professional tone > realism.

### Avatars vs. Other Approaches

| Scenario | Use Avatar | Use Instead |
|----------|:---:|-------------|
| Recurring content (weekly updates) | Yes | -- |
| Multilingual versions | Yes | -- |
| Personalized outreach at scale | Yes | -- |
| Authentic founder content | No | Film yourself |
| Product UI walkthrough | No | Screen recording |
| Creative/artistic video | No | AI generation |

---

## Editing and Repurposing Tools

Turn existing content into multiple video formats.

| Tool | Function | Best For |
|------|----------|----------|
| **Descript** | Transcript-based editing — edit video by editing text | Cleaning interviews, podcasts, webinars |
| **Opus Clip** | Auto-clips long videos, scores virality potential | Long-form to short-form at scale |
| **CapCut** | Visual effects, captions, platform-native styling | TikTok/Reels polish |
| **Captions.ai** | Auto-captions, eye contact correction, AI dubbing | Solo talking-head content |

### Repurposing Workflow

```
Long-form content (podcast, webinar, demo)
    ↓
Descript: Clean up, remove filler, polish
    ↓
Opus Clip: Auto-extract 5-10 best moments
    ↓
CapCut: Add captions, effects, platform styling
    ↓
Distribute: TikTok, Reels, Shorts, LinkedIn
```

---

## Production Workflows

### Product Demo Video

1. **Script** key features and value props (use copywriting skill)
2. **Screen record** the product flow
3. **Programmatic overlay** — Hyperframes/Remotion for titles, callouts, transitions
4. **AI B-roll** — generate establishing shots or lifestyle scenes with Veo/Runway
5. **Voiceover** — record yourself or use AI avatar for narration
6. **Export** at platform-appropriate specs

### Explainer Video

1. **Script** the problem-solution-CTA arc
2. **Choose presenter** — AI avatar (HeyGen) or voiceover + visuals
3. **Build visuals** — programmatic slides, screen recordings, AI scenes
4. **Add captions** — always, for accessibility and engagement
5. **Export** — landscape for YouTube/website, vertical for social

### Batch Social Clips

1. **Create master template** in Hyperframes/Remotion
2. **Feed data** — product features, testimonials, stats
3. **Render batch** — one template, many variations
4. **Add platform-specific captions** via CapCut or Captions.ai
5. **Schedule** across platforms

---

## Agent-Native Video Pipeline

The most powerful setup combines tools agents control directly:

```
Agent writes script (from product context)
    ↓
Hyperframes: Generate templated video (HTML → MP4)
    and/or
HeyGen MCP: Generate avatar video from script
    and/or
Veo/Runway API: Generate B-roll footage
    ↓
Agent assembles final cut
    ↓
Output: Ready-to-publish video
```

**What makes this agent-native:**
- Hyperframes uses HTML — any coding agent can generate it
- HeyGen MCP server — agents call it directly
- Video model APIs — standard HTTP requests
- No manual editing step required

---

## Common Mistakes

1. **Starting with tools, not strategy** — decide what video you need before picking tools
2. **AI-generated text in video** — models cannot reliably render readable text; use programmatic overlays
3. **Uncanny valley avatars** — if quality matters, invest in HeyGen Creator+ tier
4. **No captions** — much social video is watched without sound [unverified share]
5. **Wrong aspect ratio** — 9:16 for social, 16:9 for YouTube/website, 1:1 for feeds
6. **Over-producing** — authentic often outperforms polished, especially on TikTok

---

## Task-Specific Questions

1. What type of video? (Demo, explainer, social clip, ad, tutorial)
2. Need a human presenter or voiceover/text?
3. One-off or repeatable template?
4. Target platform? (Determines aspect ratio and length)
5. Existing assets? (Screenshots, footage, scripts)
6. Budget for video tools?

---

## Tool Integrations

| Tool | Type | MCP | Guide |
|------|------|:---:|-------|
| **HeyGen** | AI avatars | Yes | [heygen.com](https://www.heygen.com) — check current API docs |
| **Hyperframes** | Programmatic video | - | reserva → `hyperframes/SKILL.md` |
| **Remotion** | Programmatic video | - | [remotion.dev](https://www.remotion.dev/docs) |
| **Runway** | AI generation | - | [runwayml.com/docs](https://docs.dev.runwayml.com) |

---

## Related Skills

- **social-content**: Video content strategy, hooks, posting cadence
- **paid-ads**: Paid video ad creative and iteration (absorbed the former ad-creative)
- **copywriting**: Video scripts and messaging
- **mkt-psicologia** (marketeer pack): Hooks and persuasion in video

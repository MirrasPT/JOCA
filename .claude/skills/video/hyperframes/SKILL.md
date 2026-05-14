---
name: hyperframes
description: Create video compositions, animations, title cards, overlays, captions, voiceovers, audio-reactive visuals, and scene transitions using HyperFrames HTML. Use when building HTML-based video content, syncing captions to audio, generating TTS narration, creating audio-reactive animation, or adding scene transitions. Authoritative skill for HyperFrames — covers composition authoring, CLI workflow, quality checks, and media preprocessing.
triggers: hyperframes, video html, html video, composição de vídeo, criar vídeo html, video composition, title card, caption sync, voiceover, tts, narração, transição de cena, scene transition, audio-reactive, kinetic type, product launch video, vídeo de lançamento, fazer vídeo com html
---

# HyperFrames

HTML is the source of truth for video. A composition is an HTML file with `data-*` attributes for timing, a GSAP timeline for animation, and CSS for appearance. The framework handles clip visibility, media playback, and timeline sync.

**Não é esta skill:**
- Vídeo React programático → `remotion`
- Geração AI (Veo, Runway, Kling) → `video`
- AI avatars (HeyGen, Synthesia) → `video`

---

## Approach

### Discovery (exploratory requests only)

For open-ended requests where the user hasn't committed to a direction, clarify intent first:

- **Audience** — who watches this?
- **Platform** — social (15s), website hero, product demo, internal?
- **Priority** — motion quality? content accuracy? brand fidelity? speed?

For specific requests ("add a title card", "fix timing"), skip discovery.

### Step 1: Design System

If `DESIGN.md` exists → **read it first**. It's the source of truth for brand colors, fonts, and constraints. Use its exact values — don't invent colors or substitute fonts.

If `DESIGN.md` doesn't exist → ask 3 questions before writing any HTML:
1. What's the mood? (explosive / cinematic / fluid / technical / warm / chaotic)
2. Light or dark canvas?
3. Any brand colors, fonts, or visual references?

<HARD-GATE>
Before writing ANY composition HTML — verify you have a visual identity. If you're reaching for `#333`, `#3b82f6`, or `Roboto`, you skipped this step.
</HARD-GATE>

### Step 2: Plan

1. **What** — what should the viewer experience? Narrative arc, key moments, emotional beats.
2. **Structure** — how many compositions, sub-compositions vs inline, what tracks carry what.
3. **Rhythm** — which scenes are quick hits, which are holds, where does energy peak.
4. **Timing** — which clips drive the duration, where transitions land.
5. **Layout** — build end-state first (see below).
6. **Animate** — add motion after layout is verified.

**Build what was asked.** A request for "a title card" is not a request for 3 scenes + music + captions.

---

## Layout Before Animation

Position every element where it should be at its **most visible moment** — the frame where it's fully entered, correctly placed, and not yet exiting. Write this as static HTML+CSS first. No GSAP yet.

### The process

1. **Identify the hero frame** — the moment when the most elements are simultaneously visible.
2. **Write static CSS** for that frame. The `.scene-content` container MUST fill the full scene:
   ```css
   .scene-content {
     display: flex;
     flex-direction: column;
     justify-content: center;
     width: 100%;
     height: 100%;
     padding: 120px 160px;
     gap: 24px;
     box-sizing: border-box;
   }
   ```
   Use padding to push content inward — NEVER `position: absolute; top: Npx` on a content container. Reserve `position: absolute` for decoratives only.
3. **Add entrances with `gsap.from()`** — animate FROM offscreen/invisible TO the CSS position.
4. **Add exits with `gsap.to()`** — animate TO offscreen/invisible FROM the CSS position.

**WRONG — hardcoded absolute positioning:**
```css
.scene-content {
  position: absolute;
  top: 200px;
  left: 160px;
  width: 1920px;
  height: 1080px;
}
```

---

## Data Attributes

### All Clips

| Attribute | Required | Values |
|---|---|---|
| `id` | Yes | Unique identifier |
| `data-start` | Yes | Seconds or clip ID reference (`"el-1"`, `"intro + 2"`) |
| `data-duration` | Required for img/div/compositions | Seconds. Video/audio defaults to media duration. |
| `data-track-index` | Yes | Integer. Same-track clips cannot overlap. |
| `data-media-start` | No | Trim offset into source (seconds) |
| `data-volume` | No | 0-1 (default 1) |

`data-track-index` does **not** affect visual layering — use CSS `z-index`.

### Composition Clips

| Attribute | Required | Values |
|---|---|---|
| `data-composition-id` | Yes | Unique composition ID |
| `data-start` | Yes | Start time (root composition: use `"0"`) |
| `data-duration` | Yes | Takes precedence over GSAP timeline duration |
| `data-width` / `data-height` | Yes | Pixel dimensions (1920×1080 or 1080×1920) |
| `data-composition-src` | No | Path to external HTML file |

---

## Composition Structure

**Standalone compositions** (`index.html`) — put `data-composition-id` div directly in `<body>`. Do NOT use `<template>`.

**Sub-compositions** (loaded via `data-composition-src`) — use `<template>` wrapper:

```html
<template id="my-comp-template">
  <div data-composition-id="my-comp" data-width="1920" data-height="1080">
    <style>
      [data-composition-id="my-comp"] { /* scoped styles */ }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      // tweens...
      window.__timelines["my-comp"] = tl;
    </script>
  </div>
</template>
```

Load in root: `<div id="el-1" data-composition-id="my-comp" data-composition-src="compositions/my-comp.html" data-start="0" data-duration="10" data-track-index="1"></div>`

---

## Video and Audio

Video must be `muted playsinline`. Audio is always a separate `<audio>` element:

```html
<video id="el-v" data-start="0" data-duration="30" data-track-index="0"
  src="video.mp4" muted playsinline></video>
<audio id="el-a" data-start="0" data-duration="30" data-track-index="2"
  src="audio.mp3" data-volume="1"></audio>
```

---

## GSAP Timeline Contract

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });

  tl.from(".title", { y: 48, opacity: 0, duration: 0.6, ease: "power3.out" }, 0);
  tl.from(".subtitle", { y: 30, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.2);

  window.__timelines["main"] = tl; // key must equal data-composition-id
</script>
```

**Rules:**
- The registry key must match the composition root's `data-composition-id`
- All timelines start `{ paused: true }` — the player controls playback
- Do not call `tl.play()` for render-critical motion
- Do not build timelines inside async code, timers, or event handlers
- Duration comes from `data-duration`, not from GSAP timeline length
- Never create empty tweens to set duration

---

## Rules (Non-Negotiable)

1. **Deterministic** — no `Math.random()`, `Date.now()`, or time-based logic. Use seeded PRNG (mulberry32) if needed.
2. **GSAP** — only animate visual properties (`opacity`, `x`, `y`, `scale`, `rotation`, `color`, `backgroundColor`, `borderRadius`). Do NOT animate `visibility`, `display`, or call `video.play()` / `audio.play()`.
3. **No `repeat: -1`** — infinite-repeat breaks the capture engine. Calculate exact repeat count: `repeat: Math.ceil(duration / cycleDuration) - 1`.
4. **Synchronous timeline** — never build timelines inside `async`/`await`, `setTimeout`, or Promises.
5. **Animation conflicts** — never animate the same property on the same element from multiple timelines simultaneously.

**Never do:**
1. Forget `window.__timelines` registration
2. Use video for audio — always muted video + separate `<audio>`
3. Nest video inside a timed div — use a non-timed wrapper
4. Use `data-layer` (use `data-track-index`) or `data-end` (use `data-duration`)
5. Animate video element dimensions — animate a wrapper div
6. Call play/pause/seek on media — framework owns playback
7. Create a top-level container without `data-composition-id`
8. Use `repeat: -1` on any timeline or tween
9. Build timelines asynchronously
10. Use `gsap.set()` on clip elements from later scenes — they don't exist in DOM at page load. Use `tl.set(selector, vars, timePosition)` inside the timeline at or after the clip's `data-start` time.
11. Use `<br>` in content text — forces line breaks that don't account for actual rendered font width. Let text wrap via `max-width` instead. Exception: short display titles where each word is deliberately on its own line.

---

## Scene Transitions (Non-Negotiable)

Every multi-scene composition MUST follow ALL of these rules:

1. **ALWAYS use transitions between scenes.** No jump cuts. No exceptions.
2. **ALWAYS use entrance animations on every scene.** Every element animates IN via `gsap.from()`. No element may appear fully-formed.
3. **NEVER use exit animations** except on the final scene. The transition IS the exit. The outgoing scene's content MUST be fully visible at the moment the transition starts.
4. **Final scene only:** The last scene may fade elements out. This is the ONLY scene where `gsap.to(..., { opacity: 0 })` is allowed.

**WRONG — exit animation before transition:**
```js
// BANNED — empties the scene before the transition can use it
tl.to("#s1-title", { opacity: 0, y: -40, duration: 0.4 }, 6.5);
```

**RIGHT — entrance only, transition handles exit:**
```js
tl.from("#s1-title", { y: 50, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.3);
tl.from("#s1-subtitle", { y: 30, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.6);
// NO exit tweens — transition at 7.2s handles the scene change
tl.from("#s2-heading", { x: -40, opacity: 0, duration: 0.6, ease: "expo.out" }, 8.0);
```

---

## Animation Guardrails

- Offset first animation 0.1–0.3s (not t=0)
- Vary eases across entrance tweens — use at least 3 different eases per scene
- Don't repeat an entrance pattern within a scene
- Avoid full-screen linear gradients on dark backgrounds (H.264 banding — use radial or solid + localized glow)
- 60px+ headlines, 20px+ body, 16px+ data labels for rendered video
- `font-variant-numeric: tabular-nums` on number columns

---

## Typography

- **Fonts** — just write the `font-family` in CSS. The compiler embeds supported fonts automatically.
- 700–900 weight for headlines, 300–400 for body
- Serif + sans (not two sans)
- 60px+ headlines, 20px+ body

**Evitar (AI tells):**
- Gradient text (`background-clip: text` + gradient)
- Left-edge accent stripes
- Cyan-on-dark / purple-to-blue gradients / neon accents
- Pure `#000` ou `#fff` — tint toward accent hue
- Identical card grids
- Everything centered with equal weight

---

## CLI Workflow

```bash
npx hyperframes init my-video                         # interactive wizard
npx hyperframes init my-video --example warm-grain    # pick a template
npx hyperframes init my-video --tailwind              # with Tailwind v4 browser runtime
npx hyperframes init my-video --non-interactive       # CI/agents
```

**Templates:** `blank`, `warm-grain`, `play-mode`, `swiss-grid`, `vignelli`, `decision-tree`, `kinetic-type`, `product-promo`, `nyt-graph`

```bash
npx hyperframes lint                  # validate composition (missing IDs, overlapping tracks)
npx hyperframes lint --verbose        # info-level findings
npx hyperframes inspect               # visual layout check in headless Chrome
npx hyperframes inspect --at 1.5,4,7.25  # specific hero-frame timestamps
npx hyperframes preview               # serve with live reload
npx hyperframes preview --port 4567
npx hyperframes render                # standard MP4
npx hyperframes render --quality draft     # fast iteration
npx hyperframes render --fps 60 --quality high  # final delivery
npx hyperframes render --format webm       # transparent WebM
```

**Dev loop:** `lint` → `inspect` → `preview` → `render`

---

## Quality Checks

### Lint
Catches: missing `data-composition-id`, overlapping tracks, unregistered timelines.

### Inspect
Opens composition in headless Chrome, seeks through timeline, reports:
- Text spilling outside container/bubble
- Text clipped by fixed-width/height box
- Text extending outside the canvas
- Children escaping clipping containers

```bash
npx hyperframes inspect
npx hyperframes inspect --json         # agent-readable
npx hyperframes inspect --samples 15  # dense videos
```

Mark intentional overflow with `data-layout-allow-overflow`. Mark decoratives with `data-layout-ignore`.

### Contrast (validate)
WCAG AA contrast audit — seeks to 5 timestamps, screenshots, samples background pixels behind text, computes contrast ratios.

```bash
npx hyperframes validate
```

Failures: `⚠ WCAG AA contrast warnings`. Fix by brightening (dark bg) or darkening (light bg) the failing color until it clears 4.5:1 (normal text) or 3:1 (large text, 24px+ or 19px+ bold). Stay within the palette family.

---

## TTS — Texto para Fala (local, sem API)

Gerar narração com **Kokoro-82M** — sem API key, sem custo.

```bash
npx hyperframes tts "Texto aqui" --voice af_nova --output narration.wav
npx hyperframes tts script.txt --voice bf_emma --output narration.wav
npx hyperframes tts --list    # listar as 54 vozes disponíveis
```

**Vozes por tipo de conteúdo:**

| Conteúdo | Voz | Porquê |
|---|---|---|
| Demo de produto | `af_heart` / `af_nova` | Warm, professional |
| Tutorial | `am_adam` / `bf_emma` | Neutral, easy to follow |
| Marketing/promo | `af_sky` / `am_michael` | Energetic or authoritative |
| Casual/social | `af_heart` / `af_sky` | Approachable, natural |
| Português (BR) | `pf_dora` / `pm_alex` | Brazilian Portuguese |

**Velocidade:**
- `0.7–0.8` — tutorial, conteúdo complexo
- `1.0` — ritmo natural (default)
- `1.1–1.2` — intros, transições

**Requisitos:** Python 3.8+ com `kokoro-onnx` e `soundfile` (`pip install kokoro-onnx soundfile`). Modelo descarregado na primeira execução (~311 MB).

---

## Transcrição — Captions / Legendas

```bash
npx hyperframes transcribe audio.mp3
npx hyperframes transcribe video.mp4 --model small --language pt
npx hyperframes transcribe subtitles.srt   # importar SRT existente
```

**Regra de linguagem (non-negotiable):**
- Nunca usar modelos `.en` (ex: `small.en`) a não ser que o áudio seja explicitamente inglês. Os modelos `.en` **traduzem** áudio não-inglês para inglês em vez de transcrever.
- Default model: `small` (sem `.en`, sem `--language`) — whisper auto-detects.

**Modelos Whisper:**

| Modelo | Velocidade | Precisão | VRAM |
|---|---|---|---|
| `tiny` / `tiny.en` | Mais rápido | Mais baixa | <1 GB |
| `small` | Rápido | Boa | ~2 GB |
| `medium` | Médio | Muito boa | ~5 GB |
| `large-v2` | Lento | Excelente | ~10 GB |

---

## Checklist antes de entregar

- [ ] `npx hyperframes lint` passa sem erros
- [ ] `npx hyperframes inspect` passa (ou overflow marcado como intencional)
- [ ] `npx hyperframes validate` sem warnings de contraste
- [ ] Cada cena tem entrances (sem elementos que aparecem fully-formed)
- [ ] Sem exit animations (excepto na cena final)
- [ ] `window.__timelines` registado com o `data-composition-id` correcto
- [ ] Sem `repeat: -1` em qualquer tween
- [ ] Video: `muted playsinline` + `<audio>` separado
- [ ] Layout construído em estado final antes de animações

---

## GSAP Reference

Para documentação completa da API GSAP → ler skills em `../../anima/gsap/`:
- `gsap-core.md` — gsap.to/from/fromTo, easing, defaults
- `gsap-timeline.md` — position parameter, labels, nesting
- `gsap-scrolltrigger.md` — pin, scrub, batch
- `gsap-plugins.md` — Flip, SplitText, MorphSVG
- `gsap-performance.md` — quickTo, batch reads, will-change

**HyperFrames-specific GSAP rules:**
- Create paused timeline, register on `window.__timelines`
- Prefer `gsap.timeline({ defaults: { ease: "power2.out" } })` — one timeline per composition
- Use `gsap.matchMedia()` for `prefers-reduced-motion`
- No `repeat: -1` — always finite repeats

---

## Skills relacionadas

- `video` — router geral: AI generation (Veo/Runway), avatars (HeyGen), editing
- `remotion` — vídeo React programático (Sequence, useCurrentFrame, interpolate)
- `anima` — GSAP e Lottie para web (não para HyperFrames render)
- `brand-guidelines` — gerar DESIGN.md antes de começar composição

---
name: remotion
description: "Create programmatic videos with React and Remotion. MUST be invoked when the user says: remotion, react video, programmatic video, vídeo react, vídeo programático, useCurrentFrame, interpolate, spring animation. SHOULD also invoke when: lyric video, music visualizer, visualizador de música, batch video, data-driven video, vídeo dados."
triggers: remotion, react video, programmatic video, vídeo react, vídeo programático, useCurrentFrame, interpolate, spring animation, lyric video, music visualizer, visualizador de música, batch video, data-driven video, vídeo dados, vídeo template, criar vídeo react
---

# Remotion

Programmatic video with React. Each frame is a React component driven by `useCurrentFrame()`. Best for: batch generation, data-driven video, lyric videos, music visualization, 3D video (Three.js), complex templated production.

**Não é esta skill:**
- HTML-based video sem React → `hyperframes` (mais fácil para agentes, sem build step)
- AI generation (Veo, Runway, Kling) → `video`
- AI avatars (HeyGen) → `video`

**Remotion vs HyperFrames:**

| | HyperFrames | Remotion |
|---|---|---|
| Authoring | HTML + GSAP | React (TSX) |
| Build step | Nenhum | Obrigatório |
| GSAP seeking | Frame-accurate | Wall-clock (não seekable) |
| Distributed render | Single machine | Lambda/AWS |
| Licença | Apache 2.0 | Source-available (pago acima de threshold) |

---

## Setup

```bash
npx create-video@latest --yes --blank --no-tailwind my-video
cd my-video
npm run dev    # abre Remotion Studio no browser
```

**Estrutura do projecto:**

```
my-video/
├── src/
│   ├── Root.tsx         # regista todas as Compositions
│   ├── MyVideo.tsx      # componente de vídeo
│   └── index.ts
├── public/              # assets estáticos (audio, imagens)
├── remotion.config.ts
└── package.json
```

---

## Core Concepts

### Composition — definir o vídeo

```tsx
// Root.tsx
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={150}   // 5s @ 30fps
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
```

### useCurrentFrame — o driver de tudo

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const MyVideo = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "white", justifyContent: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: 100 }}>Frame {frame}</h1>
    </AbsoluteFill>
  );
};
```

---

## Animação

### interpolate — mapear frame para valor

```tsx
import { interpolate, useCurrentFrame } from "remotion";

const frame = useCurrentFrame();

// frames 0–30: opacity 0→1
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: "clamp",
  extrapolateLeft: "clamp",
});

// deslocamento (slide in)
const translateY = interpolate(frame, [0, 30], [50, 0], {
  extrapolateRight: "clamp",
});

// fade out (frames 120–150)
const fadeOut = interpolate(frame, [120, 150], [1, 0], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

### Easing

```tsx
import { interpolate, Easing, useCurrentFrame } from "remotion";

const frame = useCurrentFrame();

const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.16, 1, 0.3, 1),  // ease-out-expo
});

// Easings disponíveis:
// Easing.linear, Easing.ease, Easing.bezier(x1, y1, x2, y2)
// Easing.in(fn), Easing.out(fn), Easing.inOut(fn)
// Easing.elastic(bounciness), Easing.bounce, Easing.back(factor)
```

### spring — animação física

```tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({
  frame,
  fps,
  config: {
    damping: 10,      // amortecimento (>10 = sem bounce)
    stiffness: 100,   // velocidade de spring
    mass: 1,
  },
});

// delay: começa mais tarde
const scaleDelayed = spring({
  frame: frame - 15,  // começa no frame 15
  fps,
  config: { damping: 12, stiffness: 80 },
});
```

---

## Sequence — composição temporal

```tsx
import { Sequence } from "remotion";

const Main = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      <Sequence from={0} durationInFrames={2 * fps}>
        <Intro />
      </Sequence>
      <Sequence from={2 * fps} durationInFrames={3 * fps}>
        <MainContent />
      </Sequence>
      <Sequence from={5 * fps}>
        <Outro />
      </Sequence>
    </>
  );
};
```

`<Sequence>` é por defeito `AbsoluteFill`. Para conteúdo inline: `layout="none"`.

```tsx
// Alinhar múltiplos elementos sem absolute fill
<Sequence from={30} layout="none">
  <span style={{ fontSize: 24 }}>Texto inline</span>
</Sequence>
```

---

## Assets

Colocar em `public/` e referenciar com `staticFile()`:

```tsx
import { Img, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { Audio } from "@remotion/media";

// Imagem
<Img src={staticFile("logo.png")} style={{ width: 200 }} />

// Vídeo
<Video src={staticFile("clip.mp4")} style={{ opacity: 0.8 }} />

// Áudio (BGM, narração)
<Audio src={staticFile("music.mp3")} volume={0.4} />

// Remote URLs também funcionam
<Video src="https://example.com/video.mp4" />
```

---

## Regras Críticas (Non-Negotiable)

**CSS transitions e CSS animations são PROIBIDAS** — não renderizam correctamente:

```tsx
// ❌ ERRADO — não funciona em Remotion
<div style={{ transition: "opacity 0.5s" }}>...</div>

// ❌ ERRADO — Tailwind animation classes não funcionam
<div className="animate-fade-in">...</div>

// ✅ CORRECTO — sempre usar useCurrentFrame + interpolate
const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
<div style={{ opacity }}>...</div>
```

**Todas as animações derivam de `useCurrentFrame()`** — sem setTimeout, sem setInterval.

---

## Voiceover / TTS

### Opção 1: MiniMax TTS (recomendado — cloud, voice cloning)

```bash
pip install requests
export MINIMAX_API_KEY="your_api_key"
export MINIMAX_VOICE_ID="your_voice_id"
```

```python
# scripts/generate_audio_minimax.py
import os, requests, json, base64

def generate_tts(text: str, output_path: str):
    url = "https://api.minimax.io/v1/t2a_v2"  # ← domínio correcto (não .chat)
    headers = {
        "Authorization": f"Bearer {os.environ['MINIMAX_API_KEY']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "speech-01-turbo",
        "text": text,
        "voice_id": os.environ["MINIMAX_VOICE_ID"],
        "format": "mp3",
    }
    response = requests.post(url, headers=headers, json=payload)
    audio_data = base64.b64decode(response.json()["audio"])
    with open(output_path, "wb") as f:
        f.write(audio_data)
```

**Atenção:** `api.minimax.chat` é o domínio errado — retorna "invalid api key". Usar `api.minimax.io` (internacional) ou `api.minimaxi.com` (China).

**Suporte de idiomas:** Português (BR e PT), Inglês, Espanhol, Francês, Alemão, Japonês, Mandarim, Coreano.

### Opção 2: Edge TTS (fallback — gratuito, sem API, sem cloning)

```bash
pip install edge-tts
```

```python
# scripts/generate_audio_edge.py
import asyncio, edge_tts

async def generate_tts(text: str, output_path: str, voice: str = "pt-PT-DuarteNeural"):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

asyncio.run(generate_tts("Olá mundo", "output.mp3"))
```

**Vozes portuguesas Edge TTS:**
- `pt-PT-DuarteNeural` — PT masculino
- `pt-PT-RaquelNeural` — PT feminino
- `pt-BR-AntonioNeural` — BR masculino
- `pt-BR-FranciscaNeural` — BR feminino

### Fluxo TTS → Remotion

```bash
# 1. Gerar áudio
python scripts/generate_audio_minimax.py  # ou edge

# 2. Mover para public/
mv output.mp3 public/narration.mp3

# 3. Usar no componente
```

```tsx
import { Audio, staticFile } from "@remotion/media";

export const VideoWithNarration = () => {
  return (
    <AbsoluteFill>
      <Audio src={staticFile("narration.mp3")} />
      {/* resto do vídeo */}
    </AbsoluteFill>
  );
};
```

---

## Padrões comuns

### Lyric video / Karaoke

```tsx
const lyrics = [
  { text: "Primeira linha", start: 0, end: 60 },
  { text: "Segunda linha", start: 60, end: 120 },
];

export const LyricVideo = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      {lyrics.map(({ text, start, end }, i) => {
        const opacity = interpolate(frame, [start, start + 10, end - 10, end], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <p key={i} style={{ color: "#fff", fontSize: 64, opacity, position: "absolute" }}>
            {text}
          </p>
        );
      })}
    </AbsoluteFill>
  );
};
```

### Data-driven (batch)

```tsx
// Passar dados via props
interface Props { title: string; stat: number; color: string; }

export const StatCard: React.FC<Props> = ({ title, stat, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ backgroundColor: color, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${scale})` }}>
        <h1 style={{ fontSize: 120, color: "#fff" }}>{stat}</h1>
        <p style={{ fontSize: 32, color: "#fff" }}>{title}</p>
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// Root.tsx — registar variantes
{data.map((item) => (
  <Composition
    key={item.id}
    id={`stat-${item.id}`}
    component={StatCard}
    defaultProps={item}
    durationInFrames={90}
    fps={30}
    width={1080}
    height={1080}
  />
))}
```

---

## Render

```bash
# Remotion Studio (preview)
npm run dev

# Render para MP4
npx remotion render src/index.ts MyVideo output.mp4

# Com parâmetros
npx remotion render src/index.ts MyVideo output.mp4 --props '{"title":"Olá"}'

# Lambda (produção, batch)
npx remotion lambda render ...
```

**Output platforms:**

| Output | Comando |
|---|---|
| MP4 16:9 | `--width 1920 --height 1080` |
| Vertical 9:16 | `--width 1080 --height 1920` |
| Square 1:1 | `--width 1080 --height 1080` |
| GIF | `--codec gif` |

---

## Checklist antes de entregar

- [ ] Sem CSS transitions ou CSS animations (usar `interpolate`)
- [ ] Sem setTimeout / setInterval (tudo derivado de `useCurrentFrame`)
- [ ] Assets em `public/` referenciados via `staticFile()`
- [ ] `useVideoConfig()` para `fps` e `durationInFrames` (nunca hardcoded)
- [ ] TTS gerado e em `public/` antes de render
- [ ] `extrapolateRight: "clamp"` em todos os `interpolate` (evita overflow)
- [ ] `spring` tem delay negativo se necessário (`frame: frame - delay`)

---

## Skills relacionadas

- `hyperframes` — vídeo HTML+GSAP sem React, mais fácil para agentes
- `video` — router geral: AI generation, avatars, editing tools
- `anima` — GSAP para web (não para Remotion — usar interpolate)

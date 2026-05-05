---
name: video
description: Create, generate, or produce video content using AI tools or programmatic frameworks. Use for video production, AI video, Remotion, Hyperframes, HeyGen, Synthesia, Veo, Runway, Kling, Pika, video generation, AI avatar, talking head video, programmatic video, explainer video, product demo video, HTML animation to video, export animation as MP4, export as GIF, add music to video, animation pipeline. For video content strategy → content skill. For paid video ads → performance skill.
metadata:
  version: 2.0.0
---

CONTEXT: check `.agents/product-marketing-context.md` first.

## Tool Selection

| Approach | Best For | Tools |
|----------|----------|-------|
| **HTML → MP4** | CSS/JS animations, brand launches, motion demos | Playwright + ffmpeg (Hyperframes pipeline) |
| **Programmatic** | Templated, data-driven, batch video | Hyperframes (HTML, agent-native) · Remotion (React) |
| **AI Generation** | B-roll, hero shots, scenes you can't film | Veo 3 · Runway Gen-4 · Kling 3.0 · Pika |
| **AI Avatars** | Talking-head without filming | HeyGen (MCP) · Synthesia |
| **Repurposing** | Long-form → short clips | Descript → Opus Clip → CapCut |

## HTML Animation → Video Pipeline

Scripts in `.claude/skills/design/ui/assets/` (or `huashu-design/`):
```
HTML animation (Playwright) → render-video.js (25fps MP4) → convert-formats.sh (60fps MP4 + GIF) → add-music.sh (BGM + SFX)
```

Default: always add audio. Skip only if user says "silent version".

BGM tracks: `tech.mp3` · `ad.mp3` · `educational.mp3` · `tutorial.mp3` (in `assets/bgm/`)
Validate: `ffprobe -select_streams a <file>` must show audio stream.

Animation rules for recording compatibility:
- First frame: `window.__ready = true` synchronously
- When `window.__recording === true`: force `loop = false`
- Never `scrollIntoView` in animations

| Format | Use case |
|--------|----------|
| MP4 25fps | Web embed, email |
| MP4 60fps | TikTok, Reels, X |
| GIF (palette-optimised) | Docs, GitHub, messaging |

## Programmatic Video

**Hyperframes** (recommended for agents — plain HTML):
```bash
npm install hyperframes
```
```typescript
import { render } from "hyperframes";
await render({ frames: [{ html: "<h1>Title</h1>", duration: 3 }], output: "out.mp4", width: 1080, height: 1920 });
```

**Remotion** (React, more powerful):
```bash
npx create-video@latest
```
Use `useCurrentFrame()` + `<Sequence from={N}>` for timeline control. Lambda for batch rendering.

Hyperframes vs Remotion: Hyperframes = agent-native, minimal learning curve, CSS animations. Remotion = Spring/interpolate, complex animations, AWS Lambda scale.

## AI Video Generation

| Model | Best For |
|-------|----------|
| Veo 3 (Google) | Highest quality, synced audio |
| Runway Gen-4 | Motion control, temporal consistency |
| Kling 3.0 | Volume production, lowest cost (~$0.029/sec) |
| Pika | Fast generation, effects |

Prompt formula: `subject + action + camera movement + style + mood`
NEVER: request readable text in AI video (use programmatic overlays) · real locations (hallucinations) · specific products/brands

REF: `references/ai-video-prompting.md`

## AI Avatars

**HeyGen** (has MCP server — agents can call directly): best lip-sync, 230+ avatars, 140+ languages. Creator+ for quality. Custom avatar from 2-5min personal video.
**Synthesia**: full-body avatars, enterprise/training focus.

Use avatars for: recurring content · multilingual versions · personalized outreach at scale
Don't use for: authentic founder content · product UI walkthrough · creative/artistic video

## Common Mistakes

1. AI-generated text in video → use programmatic overlays instead
2. No captions → 85% of social video watched without sound
3. Wrong aspect ratio → 9:16 social · 16:9 YouTube/website · 1:1 feeds
4. Silent video export → always validate audio stream

ENFORCE: decide video type before picking tools · captions always · validate audio in pipeline output

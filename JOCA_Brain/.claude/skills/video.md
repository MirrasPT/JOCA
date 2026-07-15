---
name: video
description: "Router for video production — picks the right tool and activates the correct skill. MUST be invoked when the user says: video, vídeo, produção de vídeo, video production, AI video, video generation, explainer video, product demo. SHOULD also invoke when: ai avatar, talking head, heyGen, veo, runway, kling."
triggers: video, vídeo, produção de vídeo, video production, AI video, video generation, explainer video, product demo, ai avatar, talking head, heyGen, veo, runway, kling, pika, synthesia, descript, opus clip, video pipeline, export mp4, export gif, add music to video, fazer vídeo, criar vídeo
---

# Video

Expert video producer for marketing videos using AI generation, AI avatars, and programmatic frameworks. Goal: professional video content efficiently — demos, explainers, social clips, ads.

## Before Starting

**Check product marketing context first:**
If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md`), read it before asking. Use that context; only ask for info not covered or task-specific.

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
| **HTML to Video** | CSS/JS animations, motion design, product launches, lyric videos | HyperFrames | `hyperframes` |
| **React to Video** | Data-driven, batch, music visualizers, lyric videos, 3D | Remotion | `remotion` |
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

Build videos with code. Best for repeatable, templated, or data-driven video at scale.

### Hyperframes (HTML/CSS — recommended for agents)

Open-source, Apache 2.0, from HeyGen. Plain HTML/CSS/JS — no framework DSL. LLM-native: AI models generate better HTML than React components.

```bash
npm install hyperframes
```

**Key concept:** Each frame is an HTML document. Compose frames into a timeline, render to MP4.

```typescript
import { render } from "hyperframes";

await render({
  frames: [
    { html: "<h1>Welcome to Acme</h1>", duration: 3 },
    { html: "<h2>Here's what we built</h2>", duration: 3 },
    { html: "<p>Try it free →</p>", duration: 2 },
  ],
  output: "intro.mp4",
  width: 1080,
  height: 1920, // 9:16 for vertical
});
```

**Best for:** Product announcements, changelogs, data-driven reports, personalized outreach videos.

**Why agents prefer it:** Plain HTML/CSS means any coding agent can generate frames. Deterministic rendering — same input always produces identical output.

### Remotion (React)

Mature open-source framework. More powerful than Hyperframes but requires React knowledge.

```bash
npx create-video@latest
```

**Key concept:** React components are frames. Props drive content. Render locally or via Remotion Lambda (AWS) for scale.

```tsx
export const ProductDemo: React.FC<{ title: string; features: string[] }> = ({
  title, features
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000", color: "#fff" }}>
      <h1>{title}</h1>
      {features.map((f, i) => (
        <Sequence from={i * 30} key={i}>
          <p>{f}</p>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

**Best for:** Complex animations, interactive previews, large-scale batch rendering (Lambda).

### When to Pick Which

| Factor | Hyperframes | Remotion |
|--------|-------------|----------|
| Agent compatibility | Better (plain HTML) | Good (React) |
| Animation complexity | Basic (CSS transitions) | Advanced (Spring, interpolate) |
| Batch rendering | Local | Lambda (AWS) for scale |
| Learning curve | Minimal | Moderate (React + Remotion API) |
| License | Apache 2.0 | Company license for commercial use |

---

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
4. **No captions** — 85% of social video is watched without sound
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
| **HeyGen** | AI avatars | Yes | [heygen.md](../../tools/integrations/heygen.md) |
| **Hyperframes** | Programmatic video | - | [hyperframes.md](../../tools/integrations/hyperframes.md) |
| **Remotion** | Programmatic video | - | [remotion.dev](https://www.remotion.dev/docs) |
| **Runway** | AI generation | - | [runwayml.com/docs](https://docs.dev.runwayml.com) |

---

## Related Skills

- **social-content**: Video content strategy, hooks, posting cadence
- **ad-creative**: Paid video ad creative and iteration
- **copywriting**: Video scripts and messaging
- **marketing-psychology**: Hooks and persuasion in video

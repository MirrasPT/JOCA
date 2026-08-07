---
name: picsart
description: "Route creative generation to the Picsart gen-ai CLI (169 models, 31 providers) for VIDEO, AUDIO, VECTORIZE and UPSCALE. MUST be invoked when the user mentions: generate video, video clip, animate image, voiceover, narration, text-to-speech, music track, sound effect, vectorize, raster to SVG, upscale image, enhance resolution, remove background."
chain: design-review
---

# picsart -- Picsart gen-ai CLI Router

`gen-ai` CLI. One OAuth account, one credit balance, pay-per-generation.
Official skills in `~/.claude/skills/`: `gen-ai-use` (all-rounder), `gen-ai-video`, `gen-ai-audio` -- read those for model-level detail. This file decides only WHEN Picsart is the right tool and enforces the cost gate.

## 1. Routing -- Picsart vs img-gen

**Images are NOT the default here.** `img-gen` (gpt-image-2 via Codex, Gemini via agy) is included in existing subscriptions; Picsart burns credits per call.

| Task | Tool |
|---|---|
| Image generation (hero, product shot, illustration, mockup, background) | `img-gen` |
| Text inside image, non-square ratio | `img-gen` -> `img-gen-openai` |
| **Video** (clip, reel, animate a still, extend, talking head) | **picsart** |
| **Audio** (voiceover, TTS, music, SFX, dubbing) | **picsart** |
| **Vectorize** (raster -> SVG, logo without source vector) | **picsart** |
| **Upscale / enhance** (resolution, restoration) | **picsart** |
| Remove / replace background | **picsart** (`remove-bg` / `change-bg`) |
| Image gen where the model matters (Flux, Recraft, Seedream, Ideogram) | picsart, only if the user names the model |

## 2. Cost gate (MANDATORY before any generation)

Every generating command spends credits. Quoting does not.

```bash
gen-ai credits                      # balance
gen-ai pricing <model> [-d 8 -r 1080p]   # dry-run quote, free, charges nothing
```

Rules:
1. **Always quote before generating.** `gen-ai pricing` invokes no model.
2. **Video needs confirmation.** Quote, show the number, ask once.
3. **Image/audio single calls** are cheap -- generate without asking, report the cost after.
4. **Batch >5 outputs** -- quote the total first, one line of confirmation.
5. Compare candidates before committing on video:
   ```bash
   gen-ai pricing sora-2 --duration 8; gen-ai pricing veo-3.1-fast --duration 8
   ```

### Real credit costs (measured 2026-08-07, plan base = 500 credits)

Video is charged **per second** -- an 8s clip multiplies fast:

| Model | per second | 8s clip |
|---|---|---|
| `hailuo-2.3-fast` | 1 | **8** |
| `seedance-2.0-mini` | 1–3 | 8–24 |
| `sora-2` | 3 | 24 |
| `veo-3.1-fast` | 3–9 | 24–72 |
| `kling-v3-turbo` | 4–5 | 32–40 |
| `veo-3.1` | 6–18 | 48–144 |
| `sora-2-pro` | 9–21 | **72–168** |

Non-video is an order of magnitude cheaper:

| Task | Model | Cost |
|---|---|---|
| Vector (raster→SVG) | `recraftv4_1_vector` | 3 / generation |
| Image | `gemini-3.1-flash-image` | 2–5 / generation |
| Image | `flux-2-pro` / `flux-2-max` | 1–2 / 3 per megapixel |
| Image (free tier) | `picsart-sana-sprint-v1` | 0 |
| TTS | `eleven-v3` | 3 / 1k characters |
| Music | `elevenlabs-music-v2` | 5 / minute |
| SFX | `elevenlabs-sfx` | 4 / minute |

**Implication:** one `sora-2-pro` 8s clip can cost more than the entire vector + audio budget of a project. Never reach for a Pro video tier without an explicit ask.

### CLI gotchas (verified)

- Flag is `--duration`, **not** `-d`. `-d` errors with "Nonexistent flag".
- `gen-ai pricing --all --mode image|audio` fails server-side (`ModelPricingUnknownError: fetch failed`) -- **per-model** quotes work. Video bulk works.
- Per-model quotes fail intermittently with the same error; retry once before believing "no price".
- `--plain` output resists `grep` (padding chars). Parse `--json` instead.
- Auth is required for **everything**, including `gen-ai models` -- the docs claim browsing is free; it is not.
- `gen-ai check-skills` reports `source_skills: []` even with skills installed. Cosmetic bug; ignore it.

## 3. Command surface

```bash
gen-ai models                # catalogue (needs auth in current build)
gen-ai generate -m <id> ...  # universal entry point
gen-ai image | video | music | sfx | text-to-speech
gen-ai image-to-video | talking-photo | extend | video-audio
gen-ai vectorize | upscale | enhance | remove-bg | change-bg
gen-ai compare               # one prompt across several models
gen-ai history | replay | redo
gen-ai upload | download | list      # Picsart Drive
```

## 4. Auth

OAuth browser login, no API key: `gen-ai login` (once per machine). Token at `~/.gen-ai/credentials.json` (0600), auto-refreshed on 401.
`gen-ai whoami` to verify. **The login is interactive -- the user runs it, never the agent.**
Everything (including `gen-ai models`) fails with an auth error until login is done.

## 5. Do NOT

- Do not use Picsart for routine image generation -- that is `img-gen`, and it costs nothing extra.
- Do not generate video without a quote and a confirmation.
- Do not install the Picsart MCP server. The CLI does the same work; an always-on MCP costs tokens in every session (same reasoning as `browser-automate` preferring Playwright CLI).
- Do not install `gen-ai-images` from the official bundle -- its AUTO-TRIGGER description hijacks every "generate an image" request away from `img-gen`.

## Proximo passo (chain)

- Asset visual gerado -> `design-review` (avaliar antes de entregar).
- Vector saido de `vectorize` -> verificar o SVG (paths, cores) antes de o meter num design system.

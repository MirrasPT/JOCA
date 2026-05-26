---
name: img-gen
description: "Route and generate images via OpenAI (gpt-image-2) or Google Gemini (Nano Banana). MUST be invoked when the user mentions: OpenAI, Google Gemini, Nano Banana, Decides, API, Do NOT."
---

# img-gen — Image Generation Router

Analyse the request → pick the right model → craft the optimal prompt → spawn the agent.

---

## 1. Model selection

### Use OpenAI (`img-gen-openai`) when:
- **Text in the image** — labels, signs, product names, headlines, captions, subtitles, wine/beer labels, packaging copy, poster text, any readable text that must be accurate
- **Specific product shots** — branded packaging, bottles with labels, product with logo, mockups where brand identity must be exact
- **Complex precise composition** — exact object placement, multiple interacting elements where spatial relationships matter
- **Inpainting / masking** — replace or remove a region using a PNG alpha mask
- **Reference-image editing** — heavily transform or restyle an existing image
- **Dense typography / diagrams** — infographics with labels, data visualisations with text, Chinese characters, scientific figures
- **High-fidelity delivery** — final hero image, client deliverable, anything shipping-facing where quality matters more than cost

### Use Google (`img-gen-google`) when:
- **General imagery** — people, animals, landscapes, scenes, abstract patterns, textures, backgrounds
- **Simple/emotional concepts** — "a cute fluffy dog", "a misty mountain", "warm café interior"
- **Quick drafts / iteration** — explore multiple directions cheaply (flash ~$0.003/img)
- **Unusual aspect ratios** — ultra-narrow (1:4, 1:8), ultra-wide (4:1, 8:1) — model `2` only
- **High-volume generation** — 10+ images, batch workflows
- **Web/UI backgrounds** — abstract gradients, textures, UI mockup backgrounds
- **No text in image required**

### Use both when:
- User explicitly asks for both or a comparison
- High-stakes hero asset where seeing both approaches helps decide
- Brief is ambiguous and exploring both is cheaper than iterating on the wrong model

---

## 2. Prompt engineering

### For OpenAI (`img-gen-openai`)
Be explicit and literal. This model follows detailed instructions closely.

**Structure:**
```
[Medium/style] of [subject] [composition details] [lighting] [colour palette] [text if any] [technical specs]
```

**Text in image — always quote exact text:**
> Product photography of a wine bottle with a label reading "Monte Velho Reserva 2021" in gold serif font on dark green background, studio lighting, white background, 8K

**Product shots:**
> Professional product photography of [product], [material/finish], [environment], [lighting], isolated on [background], sharp focus, commercial advertising style

**Precision tips:**
- Name exact fonts if relevant: "Helvetica", "serif", "handwritten script"
- Name exact colours: "deep navy #1a2744", "warm ivory", "Pantone 485 red"
- Specify lighting: "studio softbox", "golden hour", "overcast diffuse", "dramatic side lighting"
- Include: `--quality high` for final assets, `--quality low` for drafts
- Include: `--size 1536x1024` landscape, `1024x1536` portrait, `1024x1024` square

**When to use `--quality`:**
- `low` — draft, exploration, multiple variants
- `medium` — normal exploration
- `high` — final asset, typography, products, anything shipping

### For Google Gemini (`img-gen-google`)
Lead with style, then subject. Clean descriptive language.

**Structure:**
```
[Style adjective(s)], [subject] [setting/context], [colour palette], [mood]
```

**Examples:**
> Minimalist illustration of a fluffy golden retriever sitting in autumn leaves, warm amber tones, soft diffused light, cosy mood
> Abstract geometric pattern with overlapping translucent shapes in coral/teal/gold on deep navy, suitable for fintech website hero section
> Photorealistic misty mountain lake at dawn, pine forest reflection, cool blue-green palette, cinematic

**Tips:**
- Front-load style: "minimalist", "watercolour", "photorealistic", "isometric", "flat illustration"
- Avoid text in image — not reliable
- For ultra-wide/narrow: use `--aspect 21:9` or `--aspect 1:4` (model `2` only)
- For cheap drafts: `--model flash` (~$0.003)
- For final quality: `--model pro --size 4K`

---

## 3. Agent invocation

Spawn with a structured brief:

```
BRIEF: [what the user wants in plain language]
STYLE/MOOD: [visual direction]
TEXT IN IMAGE: [exact text, or "none"]
OUTPUT: [path, or "auto"]
SIZE: [1K / 2K / 4K]
ASPECT: [16:9 / 1:1 / portrait / etc.]
QUALITY: [draft / standard / final]
REFERENCES: [paths to reference images, or "none"]
```

If spawning both: launch `img-gen-openai` and `img-gen-google` in parallel (same brief, let each adapt to their model's strengths).

---

## 4. After generation

Report back: file path(s), model used, estimated cost, key parameters. If multiple images, display or list all paths.

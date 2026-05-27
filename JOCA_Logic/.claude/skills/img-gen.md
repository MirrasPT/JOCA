---
name: img-gen
description: "Route and generate images via OpenAI (gpt-image-2) or Google Gemini (Nano Banana). MUST be invoked when the user mentions: OpenAI, Google Gemini, Nano Banana, Decides, API, Do NOT."
---

# img-gen -- Image Generation Router

Analyse request, pick model, craft prompt, spawn agent.

---

## 1. Model selection

### Use OpenAI (`img-gen-openai`) when:
- **Text in image** -- labels, signs, product names, headlines, captions, packaging copy, poster text, any readable text requiring accuracy
- **Product shots** -- branded packaging, bottles with labels, logo mockups, exact brand identity
- **Complex composition** -- exact object placement, multiple interacting elements with spatial precision
- **Inpainting / masking** -- replace or remove regions via PNG alpha mask
- **Reference-image editing** -- heavy transforms or restyle of existing image
- **Dense typography / diagrams** -- infographics with labels, data viz with text, scientific figures
- **High-fidelity delivery** -- final hero image, client deliverable, shipping-facing quality

### Use Google (`img-gen-google`) when:
- **General imagery** -- people, animals, landscapes, scenes, abstract patterns, textures, backgrounds
- **Simple/emotional concepts** -- "cute fluffy dog", "misty mountain", "warm cafe interior"
- **Quick drafts / iteration** -- explore directions cheaply (flash ~$0.003/img)
- **Unusual aspect ratios** -- ultra-narrow (1:4, 1:8), ultra-wide (4:1, 8:1) -- model `2` only
- **High-volume generation** -- 10+ images, batch workflows
- **Web/UI backgrounds** -- abstract gradients, textures, UI mockup backgrounds
- **No text in image required**

### Use both when:
- User explicitly requests both or a comparison
- High-stakes hero asset where seeing both approaches aids decision
- Ambiguous brief where exploring both is cheaper than iterating on wrong model

---

## 2. Prompt engineering

### For OpenAI (`img-gen-openai`)
Be explicit and literal. Model follows detailed instructions closely.

**Structure:**
```
[Medium/style] of [subject] [composition details] [lighting] [colour palette] [text if any] [technical specs]
```

**Text in image -- always quote exact text:**
> Product photography of a wine bottle with a label reading "Monte Velho Reserva 2021" in gold serif font on dark green background, studio lighting, white background, 8K

**Product shots:**
> Professional product photography of [product], [material/finish], [environment], [lighting], isolated on [background], sharp focus, commercial advertising style

**Precision tips:**
- Name exact fonts if relevant: "Helvetica", "serif", "handwritten script"
- Name exact colours: "deep navy #1a2744", "warm ivory", "Pantone 485 red"
- Specify lighting: "studio softbox", "golden hour", "overcast diffuse", "dramatic side lighting"
- `--quality high` for final assets, `--quality low` for drafts
- `--size 1536x1024` landscape, `1024x1536` portrait, `1024x1024` square

**`--quality` levels:**
- `low` -- draft, exploration, multiple variants
- `medium` -- normal exploration
- `high` -- final asset, typography, products, shipping quality

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
- Avoid text in image -- not reliable
- Ultra-wide/narrow: `--aspect 21:9` or `--aspect 1:4` (model `2` only)
- Cheap drafts: `--model flash` (~$0.003)
- Final quality: `--model pro --size 4K`

---

## 3. Agent invocation

Spawn with structured brief:

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

If spawning both: launch `img-gen-openai` and `img-gen-google` in parallel (same brief, each adapts to model strengths).

---

## 4. After generation

Report: file path(s), model used, estimated cost, key parameters. If multiple images, list all paths.

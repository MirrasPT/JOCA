---
name: img-gen
description: "Route and generate images via Codex CLI (OpenAI gpt-image-2) or Antigravity CLI (Gemini). MUST be invoked when the user mentions: generate image, create image, illustration, product shot, mockup, hero image, background image."
---

# img-gen -- Image Generation Router

Analyse request, pick CLI, craft prompt, spawn agent.

## 1. Model selection

**ROUTING RULE:** Gemini = 1:1 only (ignores ratio). Ratio != 1:1 -> use img-gen-openai.

### Use Codex CLI / OpenAI (`img-gen-openai`) when:
- **Text in image** -- labels, signs, product names, headlines, packaging copy, any readable text requiring accuracy
- **Product shots** -- branded packaging, bottles with labels, logo mockups, exact brand identity
- **Complex composition** -- exact object placement, multiple interacting elements with spatial precision
- **Inpainting / masking** -- replace or remove regions
- **Reference-image editing** -- heavy transforms or restyle of existing image
- **Dense typography / diagrams** -- infographics with labels, data viz with text
- **High-fidelity delivery** -- final hero image, client deliverable
- **Any non-square aspect ratio** (16:9, portrait, ultra-wide) -- gpt-image-2 honours ratios natively (~1672x941 for 16:9); upscale to 2K via `ffmpeg scale=2048:1152:flags=lanczos`

### Use Antigravity CLI / Gemini (`img-gen-google`) when:
- **General imagery** -- people, animals, landscapes, scenes, abstract patterns, textures, backgrounds
- **Simple/emotional concepts** -- "cute fluffy dog", "misty mountain", "warm cafe interior"
- **Quick drafts / iteration** -- explore directions cheaply
- **High-volume generation** -- 10+ images, batch workflows
- **Web/UI backgrounds** -- abstract gradients, textures, UI mockup backgrounds
- **No text in image required**

### Use both when:
- User explicitly requests both or a comparison
- High-stakes hero asset where seeing both approaches aids decision
- Ambiguous brief where exploring both is cheaper than iterating on wrong model

## 1.5 Use-case taxonomy (tag every request)

Pick one slug; keep it consistent across prompt, generation, and report. Sets polish level + which model.

**Generate:** `photorealistic` · `product-mockup` · `ui-mockup` · `infographic-diagram` · `logo-brand` · `illustration` · `stylized-concept` · `historical-scene`
**Edit:** `text-localization` · `identity-preserve` · `object-edit` (add/remove/replace region) · `background-replace` · `lighting-weather` · `style-transfer` · `compositing` · `sketch-to-render`

Per-slug cues: `ui-mockup` → declare fidelity first (shippable vs low-fi wireframe), avoid concept-art language. `logo-brand` → strong silhouette, balanced negative space, no decorative flourishes. `infographic` → declare exact labels. Texture → seamless edges, no focal element.

### Specificity policy (before augmenting)
- Prompt already detailed → **normalize/structure only**, don't invent.
- Prompt generic → add only detail that materially improves.
- **Allowed** augmentation: composition/framing, polish level, layout, scene concreteness.
- **Disallowed:** extra characters/props, unimplied brand colors/slogans/story beats, arbitrary placement.

## 2. Prompt engineering

### For Codex / OpenAI (`img-gen-openai`)
Be explicit and literal. Model follows detailed instructions closely.

**Structure:** `[Medium/style] of [subject] [composition] [lighting] [colour palette] [text if any]`

**Text in image — always quote exact text:**
> Product photography of a wine bottle with label reading "Monte Velho Reserva 2021" in gold serif font on dark green background, studio lighting, white background, 8K

**Tips:**
- Name exact fonts, colours, lighting
- Add "professional quality, 8K" for final assets

### For Antigravity / Gemini (`img-gen-google`)
Lead with style, then subject. Clean descriptive language.

**Structure:** `[Style adjective(s)], [subject] [setting/context], [colour palette], [mood]`

**Tips:**
- Front-load style: "minimalist", "watercolour", "photorealistic"
- Avoid text in image — not reliable
- Include aspect ratio in prompt when needed

### Text in image — verbatim protocol (both models, critical for OpenAI)
- Quote literal text in quotes or ALL CAPS; spell tricky words letter-by-letter.
- Specify typography + placement; forbid extra/garbled characters ("no extra text").
- Baseline avoid-list on most briefs: "no logos or trademarks, no watermark" (+ "no text" for icons/textures).

## 2.5 Editing existing images (invariants + roles)

Generative edits drift — discipline prevents it:
- **Label every input by index + role:** "Image 1: edit target · Image 2: style reference · Image 3: compositing input." Never assume a provided image is the edit target.
- **Declare invariants:** phrase as "change only X; keep Y unchanged" and **repeat the invariants on every iteration.**
- **One targeted change per iteration**, then re-check against the invariant + avoid list.
- Compositing: describe the interaction ("place subject from Image 2 into the scene of Image 1, matching its lighting").
- Masks / `input_fidelity` / background-transparency → these are CLI-only params (`img-gen-openai`), never on a built-in tool.

## 3. Agent invocation

Spawn with structured brief:

```
BRIEF: [what the user wants]
STYLE/MOOD: [visual direction]
TEXT IN IMAGE: [exact text, or "none"]
OUTPUT: [path, or "auto"]
ASPECT: [16:9 / 1:1 / portrait / etc.]
QUALITY: [draft / standard / final]
REFERENCES: [paths to reference images, or "none"]
```

If spawning both: launch `img-gen-openai` and `img-gen-google` in parallel.

## 4. After generation

**Validate** before iterating: subject, style, composition, text accuracy, invariants/avoid honored.

**Save-path discipline (non-destructive):**
- Never leave a project-referenced asset only at a CLI default temp path — move it into the project workspace.
- Never overwrite an existing asset unless replacement is explicitly requested — write a sibling versioned name (`hero-v2.png`).

**Report:** taxonomy slug, CLI used, final saved path(s), final prompt, key parameters. If multiple images, list all paths.

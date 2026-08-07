---
name: img-gen
description: "Route and generate images via Codex CLI (OpenAI gpt-image-2) or Antigravity CLI (Gemini). MUST be invoked when the user mentions: generate image, create image, illustration, product shot, mockup, hero image, background image."
chain: design-review
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

### Reference limits & CLI argument order (`codex -i`)
- **Hard cap of 5 references.** More than that fails with `referenced_image_paths must contain at most 5 paths`. A brief that asked for 8 refs errored and the agent had to fall back to 5 mid-run. Pick the ≤5 most authoritative refs (the canonical scene, the real logo file) and drop the rest.
- **Prompt first, `-i` last.** `-i` is variadic: `codex exec -i ref.png "PROMPT"` swallows the prompt as a second image and codex then hangs on "No prompt provided via stdin". Either put the prompt before the `-i` flags or pass it via stdin. This recurred across projects — it is a CLI gotcha, not a project detail.
- **Mockup/application of an existing brand → always attach the real logo file via `-i`.** Describing the mark in words produces the wrong symbol (observed on a first Kromway pass; fix required a full regeneration). Add the brand's usage rules to the prompt too; never let the model draw a logo from a verbal description.
- **Third-party brands as reference are a brand risk.** Passing real competitor/inspiration marks as refs makes the model drift visibly towards them — 3 of 6 outputs landed close to their reference *despite* an explicit "do not copy" in the prompt. "Do not copy" is not enough: compare each output against the refs and flag collisions to the user.
- **Model-only rendering (`NO_CODE_OVERLAY`).** Given a scene + a logo ref, Codex sometimes decides on its own to write a Python/PIL `alpha_composite` script and paste the logo instead of generating it (caught in the `codex exec` log: `ink.putalpha(...)`; the user rejected the result as "still looks pasted on"). When the brief requires everything rendered by the model, put the prohibition in the prompt verbatim: *"Do NOT write or run any Python/PIL/ImageMagick script to composite text or logos onto the image — render everything through the native image generation/edit tool only."*

### Product shots with fixed layout/colour (refs)
- **Use the official composite/scene photo as the single reference**, not loose individual components. Passing separate bottles/objects as refs makes gpt-image-2 invent composition and colour (observed: Rosé rendered coral/peach, capsule colour wrong, variants swapped). One canonical scene ref preserves identity.
- **"Label-fix 2-ref" recipe** — fixing a typo on a label in an AI product photo without regenerating from scratch: img2img with **two** refs (`-i` base scene + `-i` the real product mockup) and the instruction "copy label EXACTLY from image 2, reproduce scene from image 1", plus the text spelled out line by line. Validated on vertical/front-facing bottles; fails on small text at extreme angles (e.g. a pouring bottle) — regenerate there.
- **"Real glass vs mockup" 2nd pass:** first generation often looks like a flat mockup. A second pass emphasising "real photographed glass / physical product, natural reflections" corrects the plastic/flat look.

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

**Format ≠ content.** `file out.png` saying "PNG image data" proves nothing about what is in it. Several agents accepted a downloaded asset on `file` alone and shipped the Chinese handset maker's logo instead of the Brazilian carrier Vivo — a perfectly valid PNG of the wrong company. Any asset fetched from search must be *looked at* before it is accepted.

**Fan-out collision check.** After N parallel image generations, `md5` all outputs. Byte-identical files mean the copy step grabbed another session's PNG (`~/.codex/generated_images/` is shared) — regenerate, don't ship.

**Deriving a family (variants of an approved asset):** every `codex exec` redraws the shape — angles, stroke widths and proportions change between generations, so asking the model for "the inverted one", "the mono" and "the favicon" gives N similar drawings, not one mark. Variants of an approved asset are derived by **processing** (Pillow: split by colour mask, recolour, crop, scale), never by regeneration. Regenerating is fine to *explore*; never to produce the final family.

**Never trust the CLI's claim that it saved the file.** `codex exec` answers "Image saved at <dest>" while the PNG only ever exists in `~/.codex/generated_images/<session-id>/` — it does not write to network/UNC paths (`G:\…`) at all. Copy from the session folder, then prove the destination: `file dest.png` must say `PNG image data, WxH` (one run copied a redirected `.log` and wrote 6 KB of text with a `.png` extension). Do not redirect logs into the folder the copy step scans.

**List the whole destination folder at the end, not just the expected names.** With `--dangerously-bypass-approvals-and-sandbox`, codex invents extra unrequested files on its own initiative (a whole fictional "social pack" with plausible names). Delete what was not asked for before reporting.

**Save-path discipline (non-destructive):**
- Never leave a project-referenced asset only at a CLI default temp path — move it into the project workspace.
- Never overwrite an existing asset unless replacement is explicitly requested — write a sibling versioned name (`hero-v2.png`).

**Report:** taxonomy slug, CLI used, final saved path(s), final prompt, key parameters. If multiple images, list all paths.

**Colour-faithful conversion:** for "convert without changing colours" (e.g. JPG→WEBP), check the source colour space first. **ffmpeg shifts CMYK** images (with ICC profile) — it treats the 4th channel as YUV/alpha. Use **Pillow** instead: `ImageCms.profileToProfile(img, src_icc, srgb, outputMode='RGB')` then save WEBP `lossless=True, exact=True`. ffmpeg is fine for RGB sources.

**Never drop the alpha channel in a conversion pipeline.** `Image.open(x).convert("RGB")` discards transparency silently and bakes a black background. Check `im.mode` (`RGBA`/`LA`/`P` with `transparency`) *before* converting, and preserve the source format rather than flattening. Alarm signal: when several layers of the system "compensate" for the same anomaly (three design variants masking it with `mix-blend-mode`), suspect the asset, not the CSS.

**Rasterizing SVG on macOS:** use `cairosvg` (respects the `viewBox`). `qlmanage -t` is the obvious native path and is wrong here — it forces a square thumbnail and crops horizontal lockups, which looks like a broken SVG when it isn't. Note: recent macOS system pip is PEP-668, so create a `.venv` in the project before installing.

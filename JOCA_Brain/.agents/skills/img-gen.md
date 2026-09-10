---
name: img-gen
description: "Route and generate images via Codex CLI (OpenAI gpt-image-2) or Antigravity CLI (Gemini). MUST be invoked when the user mentions: generate image, create image, illustration, product shot, mockup, hero image, background image."
chain: design-review
---

# img-gen -- Image Generation Router

Analyze request, pick CLI, craft prompt, spawn agent.

## 1. Model selection

**Default engine = `agy` (Antigravity/Gemini).** It is included in the subscription. Picsart's gen-ai
CLI is only used when the user asks for it **by name** — a request by model ("use nano
banana 2") is a request for a **model**, not for a provider, and the same model comes out free via `agy`
(measured: 928×1152 identical on both routes, 21 credits spent for nothing).

**ROUTING RULE (measured 2026-08-13, replaces the old "Gemini = 1:1 only"):** `agy` **does generate
non-square**. 16:9 → 1376×768 · 4:5 → 928×1152 (deviation ~0.8%). The old rule sent all
non-square work to OpenAI needlessly. Route by **content** (text/brand/precision
→ OpenAI), not by ratio.

**`agy` ratios** — list self-declared by the CLI: `1:1` (default, comes out exactly 1024×1024) ·
`16:9` · `9:16` · `4:3` · `3:4` · `3:2` · `2:3`.
⚠ **`4:5` (Instagram Feed) is OUTSIDE the list** and it is the format of all social-media work.
It was produced when demanded imperatively, but it is not guaranteed: a ratio outside the list **falls
silently to the neighbor** (4:5 → 3:4, 896×1200). Hard consequence: **measure the file's dimensions
before accepting it, always** — and compute any cover-fit from the file's **real** ratio,
never from the request.

### GPT Image 2.5 — what exists (verified 2026-09-09)

OpenAI released **GPT Image 2.5** on **2026-09-08** — in the app it is «ChatGPT Images 2.5» (up to
50% lower latency, better subject preservation from reference photos, more consistent edits across
several turns, Sketch, Templates, comments pinned on the image). In the API there are **two** models:

| Model | What for |
|---|---|
| `gpt-image-2.5-flare` (snapshot `-2026-09-08`) | fast, day-to-day and volume |
| `gpt-image-2.5-sunburst` (snapshot `-2026-09-08`) | maximum edit precision, longer generations |

Both on `v1/images/generations` + `v1/images/edits`, with inpainting. `quality` gains **`xhigh`** and
**`max`** above `high`, and the size becomes **arbitrary** (each side ≤ 3840 px, both multiples of
16, ratio ≤ 3:1, total between 0.65 MP and 8.3 MP; above 3.69 MP it is experimental). Rates **the same as
gpt-image-2's**: $5/1M text-in · $8/1M image-in · $30/1M image-out (verified 2026-09-09; the
gpt-image-2 calculator does not estimate 2.5's consumption).

⚠ **`codex`'s built-in tool does not get there.** In `codex-cli 0.153.4` (the latest on npm as of
2026-09-09) the model is **fixed in the binary** — the `ext/image-generation` extension only knows
`gpt-image-2` and there is no model flag. What gives access to 2.5 is OpenAI's own **fallback CLI**
(route 1 of the policy below). Re-verify after every `codex update`:

```bash
strings "$(npm root -g)"/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex \
  | grep -oiE 'gpt-image[a-z0-9.-]*' | sort -u
```

### Default model: **GPT Image 2.5** (decided by Renato, 2026-09-09)

Whenever the model is **choosable**, ask for 2.5 — `gpt-image-2.5-flare` by default,
`gpt-image-2.5-sunburst` when what is at stake is **text, brand or edit precision**. Resolution
order, without asking:

| # | Condition | Route | Model that comes out |
|---|---|---|---|
| 1 | `OPENAI_API_KEY` present | OpenAI's fallback CLI (`image_gen.py`, see below) — accepts `--model` | **2.5 flare/sunburst** |
| 2 | no key (this machine's state, auth by ChatGPT subscription) | `codex exec` → built-in `image_gen` tool | `gpt-image-2` (fixed in the binary, no model parameter) |

Test the key **before** choosing the route — do not infer:

```bash
python3 -c "import json,os,pathlib;p=pathlib.Path.home()/'.codex/auth.json';print('key:', bool(os.getenv('OPENAI_API_KEY') or (p.exists() and json.load(open(p)).get('OPENAI_API_KEY'))))"
```

**Route 1 — the CLI that `codex` itself ships** (`~/.codex/skills/.system/imagegen/scripts/image_gen.py`,
subcommands `generate` · `edit` · `generate-batch`; it is an OpenAI file, **do not edit it**):

```bash
python3 ~/.codex/skills/.system/imagegen/scripts/image_gen.py generate \
  --model gpt-image-2.5-flare --prompt-file prompt.txt \
  --size 1024x1536 --quality high --out dest.png
# edit/inpainting with a real mask:
python3 ~/.codex/skills/.system/imagegen/scripts/image_gen.py edit \
  --model gpt-image-2.5-sunburst --image base.png --mask mask.png \
  --prompt-file prompt.txt --out dest.png
```

⚠ **Two pitfalls of this script, read in the code (2026-09-09):** the validators predate 2.5,
so (a) an arbitrary `--size` is only accepted when `--model` is exactly `gpt-image-2` — with 2.5 only
`1024x1024`, `1536x1024`, `1024x1536` and `auto` pass; (b) `--quality` only accepts `low|medium|high|auto` — `xhigh`
and `max` are refused. For an arbitrary size or `xhigh`/`max` **on 2.5** you have to call
`v1/images/generations` directly (curl), not this script.

⚠ **The report always names the model that actually generated** — `gpt-image-2.5-flare`, `-sunburst` or
`gpt-image-2`. Writing «2.5» in a deliverable that came out via route 2 is a false report.

### Use Codex CLI / OpenAI (`img-gen-openai`) when:
- **Text in image** -- labels, signs, product names, headlines, packaging copy, any readable text requiring accuracy
- **Product shots** -- branded packaging, bottles with labels, logo mockups, exact brand identity
- **Complex composition** -- exact object placement, multiple interacting elements with spatial precision
- **Inpainting / masking** -- replace or remove regions
- **Reference-image editing** -- heavy transforms or restyle of existing image
- **Dense typography / diagrams** -- infographics with labels, data viz with text
- **High-fidelity delivery** -- final hero image, client deliverable
- **Ratio outside `agy`'s list** (e.g. 21:9) or a ratio that must come out exact -- gpt-image-2 honors ratios natively (~1672x941 for 16:9); upscale to 2K via `ffmpeg scale=2048:1152:flags=lanczos`. For 16:9/9:16/4:3/3:4/3:2/2:3 `agy` is enough (⚠ arbitrary size is a capability of **2.5 in the API**, not of `codex` — see above)

### Use Antigravity CLI / Gemini (`img-gen-google`) when:
- **General imagery** -- people, animals, landscapes, scenes, abstract patterns, textures, backgrounds
- **Simple/emotional concepts** -- "cute fluffy dog", "misty mountain", "warm cafe interior"
- **Quick drafts / iteration** -- explore directions cheaply
- **High-volume generation** -- 10+ images, batch workflows
- **Ratios from the supported list** -- 16:9, 9:16, 4:3, 3:4, 3:2, 2:3 (always measure the file)
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

**Structure:** `[Medium/style] of [subject] [composition] [lighting] [color palette] [text if any]`

**Text in image — always quote exact text:**
> Product photography of a wine bottle with label reading "Monte Velho Reserva 2021" in gold serif font on dark green background, studio lighting, white background, 8K

**Tips:**
- Name exact fonts, colors, lighting
- Add "professional quality, 8K" for final assets

### For Antigravity / Gemini (`img-gen-google`)
Lead with style, then subject. Clean descriptive language.

**Structure:** `[Style adjective(s)], [subject] [setting/context], [color palette], [mood]`

**Tips:**
- Front-load style: "minimalist", "watercolor", "photorealistic"
- Avoid text in image — not reliable
- Include aspect ratio in prompt when needed

#### JSON prompt (Nano Banana / Gemini) — the route with the most control
Prose gives style; **JSON gives framing**. Validated skeleton:

```json
{
  "subject": { "description": "...", "placement": "lower third, centered", "scale_in_frame": "35%" },
  "environment": { "description": "...", "excluded": ["people", "text", "logos"] },
  "composition": { "upper_third": "clean, no elements — reserved for copy" },
  "lighting": "...", "camera": "35mm, eye level, shallow depth of field",
  "negative": ["watermark", "wordmarks", "frame", "text"]
}
```

⚠ **The ratio is the exception that lives OUTSIDE the JSON.** Buried as an `"aspect_ratio"` field it was
ignored (4:5 requested → 896×1200 came out, i.e. 3:4). The ratio goes as an **imperative instruction in
running text, at the top of the prompt**, before the JSON block.

#### Invoking `agy` (measured 1.1.12 → 1.1.16)
```bash
agy --print "$(cat prompt.txt)" --dangerously-skip-permissions --effort high --print-timeout 30m
```
- **`--dangerously-skip-permissions` is mandatory** with `--print`. Without it headless dies with
  `a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied`
  and **produces no file**. ⚠ This instruction **has already been the other way round** (in 1.1.5 the flag broke
  `--print`): this is the second inversion. If `agy --version` does not match, **test before trusting**.
- Without the flag, `agy` **writes the file even while reporting a permission error** — always verify
  by the **artifact** (`ls`), never by the exit code nor by the last line of the log.
- **There is no image `-i` flag in `agy`** (`-i` is an alias of `--prompt-interactive`). References
  go as **absolute paths in the body of the prompt**, with an explicit instruction to read them first.
  The CLI declares it accepts **up to 3 refs** (`codex` accepts 5).
- **Where it lands:** changes between versions — 1.1.12 in `~/.gemini/antigravity-cli/brain/<session-id>/`,
  1.1.15+ in `~/.gemini/antigravity-cli/scratch/<name>.png` (sometimes with a copy in the home dir). Pin the
  name in the prompt (`Name the generated image file EXACTLY: <name>`) and **locate by name**
  (`find ~/.gemini/antigravity-cli ~ -name '<name>.*'`), never "the most recent" nor a fixed folder.
- **A generation takes >2 min → the shell kills it in the foreground (exit 143).** Batch:
  `run_in_background` + wait with `until [ -f <file> ]; do ...; done`. 1 of 3 parallel
  generations was lost to this.
- **Generating means calling the generator.** `agy` has a shell and, when the generation fails, it tends to write a
  PIL/matplotlib/SVG script and call it an image. Forbid it in the prompt; if the generator does not run,
  report and stop.

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

### Product shots with fixed layout/color (refs)
- **Use the official composite/scene photo as the single reference**, not loose individual components. Passing separate bottles/objects as refs makes gpt-image-2 invent composition and color (observed: Rosé rendered coral/peach, capsule color wrong, variants swapped). One canonical scene ref preserves identity.
- **"Label-fix 2-ref" recipe** — fixing a typo on a label in an AI product photo without regenerating from scratch: img2img with **two** refs (`-i` base scene + `-i` the real product mockup) and the instruction "copy label EXACTLY from image 2, reproduce scene from image 1", plus the text spelled out line by line. Validated on vertical/front-facing bottles; fails on small text at extreme angles (e.g. a pouring bottle) — regenerate there.
- **"Real glass vs mockup" 2nd pass:** first generation often looks like a flat mockup. A second pass emphasizing "real photographed glass / physical product, natural reflections" corrects the plastic/flat look.

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

**Measure the ratio on the file, not on the request.** `sips -g pixelWidth -g pixelHeight <f>` (macOS) or
`python3 -c "from PIL import Image;print(Image.open('f.png').size)"`. A request outside the supported list
falls to the neighbor **silently** — the file exists and is wrong.

**Contact sheet before accepting a batch.** A set that has to read as a system (avatars,
icons, the month's posts) is not validated image by image: tile N×N into a single PNG and look. It caught 2 of 9
illegible in one look, and cut 23 image reads down to 3.

```bash
# 3×3 montage (ffmpeg; tested). The scale+pad is mandatory: tile assumes equal cells
ffmpeg -y -pattern_type glob -i 'out*.png' -filter_complex \
  "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,tile=3x3:margin=8:padding=8" \
  -frames:v 1 contact.png
```

**Invented wordmarks.** Photorealistic models write fake brands on clothing and equipment —
3 out of 3 generations with people in close shot. They go unnoticed because they are illegible. Look
with **zoom** at clothing/equipment before accepting. If there is clone-based removal (PIL):
a mask with blur ≥3 in a small box dilutes the opacity to ~50% and leaves the logo **translucent
underneath** — verify by the **maximum luminance of the box vs reference fabric**, not by eye.

**Format ≠ content.** `file out.png` saying "PNG image data" proves nothing about what is in it. Several agents accepted a downloaded asset on `file` alone and shipped the Chinese handset maker's logo instead of the Brazilian carrier Vivo — a perfectly valid PNG of the wrong company. Any asset fetched from search must be *looked at* before it is accepted.

**Fan-out collision check.** After N parallel image generations, `md5` all outputs. Byte-identical files mean the copy step grabbed another session's PNG (`~/.codex/generated_images/` is shared) — regenerate, don't ship.

**Deriving a family (variants of an approved asset):** every `codex exec` redraws the shape — angles, stroke widths and proportions change between generations, so asking the model for "the inverted one", "the mono" and "the favicon" gives N similar drawings, not one mark. Variants of an approved asset are derived by **processing** (Pillow: split by color mask, recolor, crop, scale), never by regeneration. Regenerating is fine to *explore*; never to produce the final family.

**Never trust the CLI's claim that it saved the file.** `codex exec` answers "Image saved at <dest>" while the PNG only ever exists in `~/.codex/generated_images/<session-id>/` — it does not write to network/UNC paths (`G:\…`) at all. Copy from the session folder, then prove the destination: `file dest.png` must say `PNG image data, WxH` (one run copied a redirected `.log` and wrote 6 KB of text with a `.png` extension). Do not redirect logs into the folder the copy step scans.

**List the whole destination folder at the end, not just the expected names.** With `--dangerously-bypass-approvals-and-sandbox`, codex invents extra unrequested files on its own initiative (a whole fictional "social pack" with plausible names). Delete what was not asked for before reporting.

**Save-path discipline (non-destructive) — ⛔ hard rule:**
- **`test -f <destination>` BEFORE writing.** If it exists → **versioned sibling name** (`hero-v2.png`).
  Writing over an existing file is **irreversible**: two emblems already approved by the
  user were overwritten in a later generation and were only recovered by luck, from the codex
  cache. You only overwrite when the user explicitly asked for **replacement**.
  ```bash
  test -f "$DEST" && DEST="${DEST%.png}-v2.png"; cp "$SRC" "$DEST"
  ```
- Never leave a project-referenced asset only at a CLI default temp path — move it into the project workspace.

**Detect a fake PNG (extension ≠ content).** The destination has to be proven, not assumed:
```bash
file "$DEST"   # must say: PNG image data, WxH
```
One run copied a redirected `.log` and wrote 6 KB of **text** with a `.png` extension. Do not
redirect logs into the folder the copy step scans. (Format ≠ content — see above.)

**Report:** taxonomy slug, CLI used, final saved path(s), final prompt, key parameters. If multiple images, list all paths.

**Color-faithful conversion:** for "convert without changing colors" (e.g. JPG→WEBP), check the source color space first. **ffmpeg shifts CMYK** images (with ICC profile) — it treats the 4th channel as YUV/alpha. Use **Pillow** instead: `ImageCms.profileToProfile(img, src_icc, srgb, outputMode='RGB')` then save WEBP `lossless=True, exact=True`. ffmpeg is fine for RGB sources.

**Never drop the alpha channel in a conversion pipeline.** `Image.open(x).convert("RGB")` discards transparency silently and bakes a black background. Check `im.mode` (`RGBA`/`LA`/`P` with `transparency`) *before* converting, and preserve the source format rather than flattening. Alarm signal: when several layers of the system "compensate" for the same anomaly (three design variants masking it with `mix-blend-mode`), suspect the asset, not the CSS.

**Rasterizing SVG on macOS:** use `cairosvg` (respects the `viewBox`). `qlmanage -t` is the obvious native path and is wrong here — it forces a square thumbnail and crops horizontal lockups, which looks like a broken SVG when it isn't. Note: recent macOS system pip is PEP-668, so create a `.venv` in the project before installing.

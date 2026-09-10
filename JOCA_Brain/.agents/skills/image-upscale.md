---
name: image-upscale
description: "Upscale or restore images for print/large-format/client assets — choosing the ESRGAN model by content type, tiling with feather blending for large images, and verification on a crop before running the whole image. MUST be invoked when the user says: upscale, enlarge image, increase resolution, restore image, image for print, pixelated image, stretch without losing quality. SHOULD also invoke when: a delivered asset has less resolution than the final format requires."
triggers: upscale, enlarge image, increase resolution, restore image, image for print, large format, pixelated image, ESRGAN, Remacri, UltraSharp, RealESRGAN, super resolution, improve image quality
chain: graphic-design, img-gen
metadata:
  origin: user
---
# image-upscale — enlarge without inventing

Recurring work (print, banners, posters, client assets) that has already been figured out from
scratch over a whole session: pick a model, find a runtime with torch, tiling, verification.

## 1. Pick the model by CONTENT

There is no "best upscaler" — there is the right one for what is in the image. Getting this wrong
produces artifacts that only show up at final scale, when it is already too late.

| Content | Model | Why |
|---|---|---|
| **Text, logos, illustration, line art** | **Remacri** | Keeps hard edges and legibility; the only one that holds up on small text |
| **Aggressive texture, detail you want exaggerated** | **UltraSharp** | Accentuates a lot; excellent on texture, bad on skin and soft gradients |
| **Photography, skin, gradients** | **RealESRGAN** (`x4plus`) | Soft and natural; does not invent micro-detail where there was none |
| **Photo with faces** | RealESRGAN + face restore (GFPGAN/CodeFormer) | Faces degrade first; treat them separately |

⛔ **Compare models on a CROP before running the whole image.** Crop 512×512 from the most demanding
area (small text, an eye, a logo edge), put it through the 2-3 candidates, compare side by side.
Running a large image with the wrong model costs minutes or hours and gets repeated.

## 2. Where to run it

In practical order of preference:

1. **gen-ai CLI (Picsart)** — `Read` the `gen-ai-use` skill; it has an enhance/upscale operation via API.
   No setup, no GPU, good for volume and for anyone who does not want to maintain models.
2. **Local ComfyUI** — an installation already exists (`~/comfy ui` on the Mac, `D:\_Comfyui` on Windows) with
   torch; upscale nodes accept ESRGAN `.pth` files directly. This is the offline, no-cost route.
3. **Standalone Python + torch** — only if the above do not serve. Needs a runtime with torch (and CUDA
   on Windows, so it does not take forever on CPU).

**`.pth` models:** resolve the download URL on **openmodeldb.info** (or the author's Hugging Face)
at the time — mirrors change. **Record the resolved URL and the date in the project memory** instead
of looking it up again. Do not invent a URL: if you cannot find it, report it.

## 3. Tiling — large images do not go through in one piece

Above ~2000 px the model blows up for lack of memory. Cut, process, stitch — and **the stitch is
where the defect shows**: linear blending leaves visible banding.

- **Tile 512 or 768**, with **overlap ≥ 64 px** (more overlap = safer stitch, more time).
- **Cosine feather** on the overlap, not linear: the weight goes from 0 to 1 by `0.5*(1-cos(pi*t))`, which matches the
  derivatives at the borders and makes the joint disappear.
- Process in **float**, convert to 8 bits only at the end — rounding per tile leaves steps.
- Check the stitch: look at the joint lines at 100% on a soft gradient (sky, plain background), which is
  where any banding jumps out.

## 4. Verification (before delivering)

- [ ] Crop of **text** at 100% — legible, no halo and no invented aliasing
- [ ] Invisible stitches on a soft gradient
- [ ] Faces/skin without a plastic look
- [ ] Final resolution matches what the format requires (**print: 150 dpi at final size** for
      large-format seen at a distance; 300 dpi for handheld material)
- [ ] **New** file, versioned sibling name — never over the original
      (`test -f` first; see `rules/task-intake.md`)

## Anti-patterns

| Wrong | Right |
|---|---|
| Running the whole image only to find out the model was the wrong one | Compare candidates on a 512 px crop first |
| Linear blending on the overlap | Cosine feather — linear leaves banding |
| 8× upscale in one go | 2× chained, evaluating between steps |
| Accepting "looks better" | Crop at 100% of the most demanding detail |
| Overwriting the original | Versioned sibling name |

## Next step (chain)
- Asset for a print piece → `graphic-design`.
- What is missing is resolution that never existed (not enlargement, generation) → `img-gen`.

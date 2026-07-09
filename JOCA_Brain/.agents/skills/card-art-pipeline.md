---
name: card-art-pipeline
description: "Generate consistent trading-card-game card art at scale via local ComfyUI + ANIMA — the OmniClash 'estilo 5' recipe (semi-realistic painterly splash art). Exact model stack, prompt scaffold, anti-card-frame negatives, per-card-type composition, headless POST /prompt driver, and the deploy+Cloudflare-purge step. MUST be read before generating or unifying OmniClash card art. Triggers: card art, gerar arte de cartas, estilo 5, ANIMA splash art, unificar arte, card key art, regenerate card, OmniClash art."
triggers: card art, gerar arte de cartas, estilo 5, ANIMA splash art, unificar arte, card key art, regenerate card, OmniClash art, cartastcg art
chain: deploy-vps
metadata:
  type: skill
  category: art-pipeline
---

# Card Art Pipeline (ANIMA "estilo 5")

How OmniClash card art is produced: local **ComfyUI + ANIMA 1.0** (Cosmos DiT 2B), painterly splash-art style, ~5s/image warm. This skill is the reusable recipe so the look stays consistent across the ~105-card catalogue. Complements the generic `img-gen` skill (this is the project-specific, reproducible card recipe) and the `comfy:anima-base` plugin skill (the model's full reference).

> **Read-first** before generating/regenerating any `assets/cards/*.png`. The filename **must equal the card `Id`** in `cards.html`/`Cards.cs` (e.g. `rom_legionario.png`) — that is the contract the Unity loader and the live catalogue both depend on.

---

## 1. Model stack (verified, ComfyUI portable :8188)
| Slot | Node | File |
|---|---|---|
| Diffusion | `UNETLoader` | `anima-base-v1.0.safetensors` |
| Text enc. | `CLIPLoader` | `qwen_3_06b_base.safetensors`, type `stable_diffusion` |
| VAE | `VAELoader` | `qwen_image_vae.safetensors` |
| Turbo LoRA | `LoraLoaderModelOnly` | `anima-turbo-lora-v0.1.safetensors`, strength 1.0 |

**Sampler:** `er_sde` / `simple` / **12 steps** / **cfg 1** / denoise 1. **Resolution 896×1152** (3:4 card ratio). Turbo path → cfg 1 is correct (not washed; it's turbo).

### Alt engine — Krea 2 Turbo (estilo 5, richer oil-paint look)
The same "estilo 5" descriptor can be driven by **Krea 2 Turbo** instead of ANIMA (o utilizador pode pedir por nome; Krea2 gives a richer painterly/oil-paint finish). Stack: `UNETLoader krea2_turbo_fp8_scaled.safetensors` · `CLIPLoader qwen3vl_4b_fp8_scaled.safetensors` type **`krea2`** · `VAELoader qwen_image_vae.safetensors` · negative via `ConditioningZeroOut` (cfg 1 ⇒ negative unused) · KSampler **`euler` / `simple` / 8 steps / cfg 1** / 896×1152. **CRITICAL — bypass the template's LLM enhancer:** the `image_krea2_turbo_t2i` template routes the prompt through a `TextGenerate` enhancer (System+User prompt) that *rewrites* it and breaks set consistency. Build the graph WITHOUT it: feed the estilo-5 prompt straight to `CLIPTextEncode`. Verified 2026-06-29: 20 Romans + 20 Vikings.

## 2. The "estilo 5" descriptor (exact — do not paraphrase)
Positive prompt = this prefix, then `\n\n`, then the subject:
```
semi-realistic digital painting, richly rendered fantasy splash art,
cinematic dramatic lighting, painterly brushwork, trading card game key art,
artstation quality, highly detailed,
immersive full-bleed scene, background extends to all four edges, no empty space
```
This is the chosen style after the user rejected the earlier manga/cel-shaded look (decision 2026-06-28). Keep it identical across cards so the set is cohesive.

## 3. Negatives — anti card-frame (balanced, NOT aggressive)
```
border, frame, card frame, isometric diorama, isolated on white,
cel shading, flat colors, manga screentone,
worst quality, low quality, blurry, bad anatomy, bad hands, extra fingers,
deformed, text, watermark, signature, logo
```
**Brain learning:** the art must be **full-bleed** (the Unity/HTML card draws its own frame on top). Forbid `border/frame/card frame`. But *aggressive* anti-frame negatives push the model into a cutout/diorama/floating-object look — keep them balanced and reinforce full-bleed in the **positive** ("background extends to all four edges"). Cards that came out with a painted frame (e.g. Cajado Was, Mumificação) were fixed by regenerating with the scene filling all four corners, not by piling on negatives.

## 4. Composition by card type
- **Unidade / General** → a single hero **character**, heroic full-body pose, environment behind extending to the edges. Generals = grander setting (forum, fjord, pyramid, Acropolis) + faction standard/totem. Seeds convention: Egyptians 600001+, the 4 generals 700001+ (one stable seed per card so regens are reproducible).
- **Equipamento** → the **object in a spotlight** (weapon/armour/relic on a dramatic surface), **no people**.
- **Evento** → an **action scene** (the spell/effect happening), motion and energy, no card-frame.

Per-faction subject anchors must be historically/mythologically faithful (no invented regalia) — see `card-game-design` faction identity and soul.md anti-fabrication.

## 5. Headless driver — POST /prompt directly (NOT the MCP enqueue)
The `comfy` MCP `enqueue_workflow` fails `"not running"` against a live server. Drive ComfyUI by POSTing the raw workflow graph to `http://127.0.0.1:8188/prompt`, poll `/history/<id>`, fetch via `/view`. Reference driver (Python): `gen_generals.py` pattern —
```python
def post(wf):
    data = json.dumps({"prompt": wf}).encode()
    req = urllib.request.Request(COMFY+"/prompt", data=data, headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["prompt_id"]
```
The 10-node graph (UNET→CLIP→VAE→turbo-LoRA→2×CLIPTextEncode→EmptyLatentImage→KSampler→VAEDecode→SaveImage) is in the OmniClash session history; rebuild it with the params in §1. Batch all cards from a JSON of `{id: {seed, subject}}`. Save to `C:\Users\<user>\Projetos\tcg\assets\cards\<id>.png`.

## 6. Verify before declaring done (asset readiness)
A file existing ≠ the art being right. After a batch, **visually sample** the PNGs: full-bleed (no painted frame), correct subject, style matches the rest. Regenerate the misses (frame leaked, wrong subject) with the same seed + a nudged subject. Don't trust filenames.

## 7. Deploy — ALWAYS push to the live catalogue + purge Cloudflare
The user reviews the catalogue **live** at `<dominio-do-projecto>`, not locally. Any art change ships immediately (permanent instruction):
1. `scp -i ~/.ssh/<key> assets/cards/<ids>.png <user>@<vps-host>:/var/www/<projecto>/assets/cards/`
2. Purge Cloudflare (else it serves the old image): `POST zones/<zone_rfdev_pt>/purge_cache {files:[urls]}`, Bearer token from `~/.cloudflare/<conta>.json`.
3. Verify: `curl -I` → `200` + `cf-cache-status: MISS` + new content-length.
See the `deploy-vps`/`cpanel` skills and o teu ficheiro de projecto VPS (`/init-project`) for the full recipe. (Also covered by the always-deploy-live memory.)

## Anti-patterns
| Wrong | Right |
|---|---|
| Filename ≠ card `Id` | `assets/cards/<id>.png` exactly (Unity + catalogue contract) |
| Manga/cel-shaded look | estilo 5 painterly descriptor verbatim |
| Aggressive anti-frame negatives | balanced negatives + full-bleed in the positive |
| `enqueue_workflow` via comfy MCP | POST raw graph to `/prompt` |
| Random seed per regen | one stable seed per card (reproducible) |
| "File exists → done" | visually sample frames first |
| Generate and stop | scp to VPS + purge Cloudflare every time |
| Invent faction regalia/symbols | validate against real history/myth |

## Próximo passo (chain)
After a batch is generated + sampled → `deploy-vps` (scp + Cloudflare purge to `<dominio-do-projecto>`). Integrating the PNGs into the Unity card UI → `unity-gamedev`.

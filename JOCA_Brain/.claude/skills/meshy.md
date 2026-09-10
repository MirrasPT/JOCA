---
name: meshy
description: "Director of AI 3D generation on Meshy (official MCP). MUST be invoked when the user says: meshy, generate 3d model, create 3d model with ai, text-to-3d, image-to-3d, retexture, remesh, rig, animate model. SHOULD also invoke when: 3d asset for a game from a prompt, figurine from a photo, convert model format, uv unwrap, creative lab."
triggers: meshy, meshy.ai, generate 3d model, create 3d model, ai 3d model, text-to-3d, image-to-3d, photo to 3d, retexture, remesh, decimate mesh, uv unwrap, auto-rig, rig, animate character, creative lab, glb, obj, fbx, usdz, 3mf
chain: meshy-3d-print, blender, design-review
---

# Meshy — Director

AI 3D generation through the **official MCP** (`@meshy-ai/meshy-mcp-server`). This skill decides the
route, brakes the cost, and picks the parameters the installed version actually accepts.

**Printing** work (slicing, printability, multicolor, slicer) → `meshy-3d-print`.

## Rule zero — the cost is confirmed beforehand, always

Every generation call spends **real, non-refundable** credits from the user's account. Before
any tool that costs: state the cost and wait for confirmation. It is not ceremony — it is money.

```
meshy_check_balance          # 0 credits. The only honest gate: it proves the key AUTHENTICATES.
```

`Connected` in `claude mcp list` only proves the process starts, **not** that the key is valid nor
that the plan gives access. The Meshy API requires a **Pro plan or higher** ⏳(verified 2026-08-25).

| Tool | Credits |
|---|---|
| `convert` · `resize` | 1 |
| `animate` | 3 |
| `remesh` · `rig` · `uv_unwrap` | 5 |
| `text_to_3d` (preview) | 5 with `meshy-5` · **20** with `meshy-6`/`latest` |
| `text_to_3d_refine` · `retexture` · `repair_printability` · `process_multicolor` | 10 |
| `image_to_3d` · `multi_image_to_3d` | 5–30 |
| `text_to_image` / `image_to_image` | 3–9 / 3–12, depending on the model |
| `creative_lab` | **36** (6 prototype + 30 build, it runs both phases on its own) |
| **`analyze_printability`** · `check_balance` · `list_tasks` · `download_model` | **0** |

## The format is decided BEFORE generating

`target_formats` is fixed at creation time — it is not added later without paying again
(`convert`, 1 credit). Ask for the destination before the first call.

| Destination | Format | Route |
|---|---|---|
| Printing in white | `obj` | `meshy-3d-print` (Scenario A) |
| Printing in color | `3mf` via `process_multicolor` | `meshy-3d-print` (Scenario B) |
| Unity · Unreal · Godot | `fbx` | generate → texture → `remesh` `topology:"quad"` |
| Web · three.js · visualization | `glb` | default |
| AR · Apple Quick Look | `usdz` | generate → texture → `remesh target_formats:["usdz"]` |
| Texturing elsewhere (Blender, Substance) | `glb` + `uv_unwrap` | mesh ≤40k faces |

⚠ Omitting `target_formats` produces **everything except 3MF**. 3MF is asked for deliberately or it does not exist.

## Parameters — what the installed version accepts

**Meshy's public API runs ahead of the MCP.** The web doc talks about `meshy-7`, `model_type:
"smart-topology"` and `ultra_mode`; MCP server **0.4.0** does not know them and the call is rejected.
Confirm the version before copying parameters from the doc:

```bash
npx -y @meshy-ai/meshy-mcp-server --version   # or read the package.json in the npx cache
```

Real 0.4.0 enums ⏳(verified 2026-08-25): `ai_model` ∈ `meshy-5 | meshy-6 | latest` ·
`model_type` ∈ `standard | lowpoly` · `topology` ∈ `quad | triangle` · `origin_at` ∈ `bottom | center`
· `pose_mode` ∈ `a-pose | t-pose`.

| Pitfall | Effect |
|---|---|
| `decimation_mode` set | **`target_polycount` is silently ignored.** Use one or the other, never both |
| `model_type: "lowpoly"` | ignores `ai_model`, `topology`, `target_polycount` and `should_remesh` |
| `symmetry_mode` | **DEPRECATED, no effect since 2026-05-11.** Passing it does nothing |
| `hd_texture` · `image_enhancement` · `remove_lighting` | `meshy-6`/`latest` only; with `meshy-5` the server strips them from the request |
| `refine` with an `ai_model` different from the preview | error — they have to match |
| `rig` above 300,000 faces | blocked **locally**, without spending credits → `remesh` first |
| `uv_unwrap` | GLB only and ≤40,000 faces; quad meshes are triangulated |

## Prompt — the official formula

**Subject + Material + Art Style + Technical Constraints**, 2–600 characters.

> *"Longsword with etched steel blade and bronze crossguard, dark fantasy style, low-poly game-ready"*

What works: important detail **first** (the first words weigh more) · **one** object,
never a scene · 3–6 central details · real physical materials (`polished brass`, not `shiny`) ·
a declared pose for characters that are going to be rigged (`T-pose`).

What ruins it: empty adjectives (`amazing`, `epic`) · stacked materials · non-physical elements
(smoke, glow, particles) that do not survive a solid mesh.

**There is no `negative_prompt` field in text-to-3d** — exclusions are written inside the prompt:
*"no background elements"*, *"without floating particles"*.

## Preview → refine

`text_to_3d` creates the **untextured mesh** (preview). `text_to_3d_refine` adds the texture, and it is
a separate paid call, with `preview_task_id`.

**For printing in white you never refine** — the texture is not going to be printed and it costs 10
credits for nothing. Generate the preview and go straight to the `meshy-3d-print` flow.

## Where the files land

`meshy_download_model` saves in **`{cwd of the MCP process}/meshy_output/{date}_{slug}_{id8}/`** — the
`cwd` is the **server's**, not yours. If the destination matters, pass `save_to` with an **absolute path**.

- File: `{stage}.{format}` (`preview`, `refined`, `remeshed`, `retextured`, `rigged`, …).
- To chain into the same folder as the preview → pass `parent_task_id`.
- Textures: alongside if there are ≤2, in `textures/` if there are more.
- **Meshy's download URLs expire in 24 h.** It is the local file that is permanent — download
  before closing the subject, do not keep the URL.
- ⚠ Writing over a model the user has already approved is irreversible: `test -f` first; if it
  exists, a versioned sibling name.

## Task status — two pitfalls

`meshy_get_task_status` infers the `task_type` on its own **for only 10 types**. It does not cover `convert`,
`resize`, `uv-unwrap`, `print-analyze`, `print-repair` nor Creative Lab: for those the `task_type`
has to be **right**, otherwise you get `Task <id> not found on any endpoint`.

Worse: an invalid `task_type` **gives no error** — it silently falls back to `text-to-3d`.

**`meshy_list_tasks` only sees tasks created via API.** Measured: on an account with work done through the
site, it returned **zero** for every type ⏳(verified 2026-08-25). Consequence: models generated in the
web app **have no usable `task_id`** — to touch them via API you need the file and a
`model_url`. And `meshy_list_models` ignores the `workspace_id` it receives: it lists only `text-to-3d`.

## Verification loop

A `SUCCEEDED` says the pipeline ran. It does not say the model is what was asked for.

```
1. GENERATE  → preview, format already decided
2. DOWNLOAD  → absolute save_to
3. LOOK      → Read() the thumbnail, or a preview render (blender-render)
4. COMPARE   → against the request; list the differences
5. DECIDE    → accept · refine the prompt and regenerate (it costs again) · fix it in Blender
```

Generating again **pays again**. Before the second attempt, state the cost and ask — three
absent-minded regenerations are 60 credits.

## Anti-patterns

| Wrong | Right |
|---|---|
| Calling a paid tool without announcing the cost | Cost + confirmation first, always |
| `Connected` in `claude mcp list` read as "the key works" | `meshy_check_balance` — free, and the only one that proves it |
| Copying parameters from the web doc into the MCP | Confirm the version; 0.4.0 knows neither `meshy-7` nor `smart-topology` |
| `decimation_mode` **and** `target_polycount` in the same call | One of the two; the second is ignored without warning |
| Refining (texturing) a model that is going to be printed in white | Preview and move on to `meshy-3d-print` |
| Keeping the download URL instead of the file | It expires in 24 h |
| Assuming a model made on the site has a `task_id` for the API | Only tasks created via API show up; the web app is invisible |
| Letting the download land in the MCP server's `cwd` | Absolute `save_to` |
| Declaring it done because the status is `SUCCEEDED` | Look at the model — thumbnail or render |

## Next step (chain)

- Model destined for printing → **`meshy-3d-print`** (that is where the analysis, the multicolor and the slicer live).
- Mesh that needs a manual fix, boolean, cut or join → `blender`.
- Model to present to the user or the client → `blender-render` for the turntable, then `design-review`.

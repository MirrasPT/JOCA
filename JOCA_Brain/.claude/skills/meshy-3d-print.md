---
name: meshy-3d-print
description: "Take a 3D model to print: printability analysis, mesh repair, multicolor 3MF and handoff to the slicer, via Meshy's MCP. MUST be invoked when the user says: print 3d model, printability, printable mesh, watertight, non-manifold, multicolor, 3mf, slicer, slice, print-ready. SHOULD also invoke when: figurine to print, miniature, does the model print well, prepare for the printer."
triggers: printability, printable, printable mesh, watertight, non-manifold, holes in the mesh, degenerate faces, repair mesh, print analyze, print repair, multicolor, 3mf, slicer, slice, orcaslicer, bambu studio, prusaslicer, cura, anycubic slicer, print ready, figurine, miniature, 3d print, creative lab
chain: blender, meshy
---

# Meshy — 3D printing

From the model to the printer. Meshy guarantees a **valid mesh and color**; it does not decide orientation, supports,
walls or layer height — that belongs to the slicer, and it stays there.

Generation and parameter choice → `meshy`. Manual geometry fixing → `blender`.

## The analysis is free — you always run it

`meshy_analyze_printability` costs **0 credits**. There is no reason to guess whether a mesh prints.

| Status | Meaning | Action |
|---|---|---|
| `healthy` | watertight, no non-manifold edges, no holes | print as is |
| `warning` | degenerate faces or holes | repair optional; recommended on pieces with fine detail |
| `error` | non-watertight, non-positive volume, or non-manifold edges | **repair before printing** |
| `unknown` | it could not process | inspect by hand; do not read it as approval |

Metrics returned: `is_watertight` · `volume` · `non_manifold_edges` · `degenerate_faces` ·
`holes`. **Read the numbers, not just the status** — `warning` with 4,000 degenerate faces and `warning` with
2 are different decisions.

⚠ **The status is more optimistic than the table promises.** Measured with a cube with one face removed:
`is_watertight: false`, 1 hole, 4 non-manifold edges → it returned **`warning`**, not `error`
⏳(verified 2026-08-25). An open mesh prints badly and the status does not shout it. **The signal that rules
is `is_watertight`**, not the label. Positive control from the same test: the closed cube gave `healthy`
with `volume: 8000` — the volume comes in the file's own cubic units (20 mm cube → 8000 mm³),
which works as a cheap scale check.

⚠ `analyze` by `input_task_id` requires the source task to have used **Meshy 6 or a Preview
model**. With Meshy 5 it fails — the way out is to pass `model_url`.

## What the analysis accepts — and the problem that creates

`analyze` and `repair` accept **exactly one** source: a Meshy `input_task_id`, **or** a
`model_url` that Meshy can download. Formats `.glb .gltf .obj .fbx .stl`, up to **100 MB**.

**There is no local file upload.** A mesh sitting on your disk — made in Blender, exported
from another program, or generated in Meshy's web app (which leaves no `task_id` visible to the API) — can only be
analyzed if it is at a **public URL**.

### Publishing temporarily

Publishing is the user's decision, not a technical detail. While the file is up it is
downloadable by **anyone who knows the URL**, and the URL travels: it goes to Meshy's servers,
to their logs, and to the conversation transcript. If the geometry belongs to a client,
to a person, or to a product not yet launched, **ask first** — never publish on your own
initiative.

Ephemeral publisher pattern (a static host the user controls):

```bash
publish-mesh.sh <file>          # random 128-bit name, prints the URL
publish-mesh.sh --delete <url>  # deletes and confirms 404
publish-mesh.sh --clean [min]   # sweeps what was left behind (default 60 min)
```

Server-side requirements, and why each one:

| Requirement | Reason |
|---|---|
| Random name ≥128 bits | it cannot be guessed or enumerated |
| No directory listing (`browse` off) | the folder cannot be read |
| `X-Robots-Tag: noindex, nofollow` **and** `robots.txt` | two layers — neither is enough alone |
| Check with a real `HEAD` after uploading | `scp`'s exit 0 does not prove Caddy/nginx serves it |
| Delete at the end **and** sweep by age | deleting by hand gets forgotten |
| Guard page at the vhost root | monitoring that probes the root does not stay down forever |

⚠ If Meshy's *fetch* fails on a URL that answers 200 to `curl`, suspect nº1 is `robots.txt`
blocking their downloader. `X-Robots-Tag` is enough for the noindex; `robots.txt` can go.

## Repairing destroys the texture — the order is not negotiable

`meshy_repair_printability` (10 credits) fixes non-manifold edges, degenerate faces, holes and
open boundaries. **The repaired model comes back with no texture and no UV.**

```
RIGHT: generate → analyze → repair → texture/multicolor → 3MF
WRONG: generate → texture → multicolor → repair          ← loses all the color
```

The output format **mirrors the input one**: `task_id`→GLB · `.stl`→STL · `.obj`→OBJ · `.glb`→GLB.

When Meshy's `repair` is not enough (infinitely thin surface meshes, which are manifold and
still do not print): Blender + the **3D Print Toolbox** add-on → Clean Up → Make Manifold → Check
All until it gives 0 non-manifold edges; if the shell has no volume, a **Solidify** modifier with ~2 mm.
See `blender`.

## White vs color

### White (Scenario A)

1. Detect installed slicers — `meshy_send_to_slicer` with `slicer_type:"auto"`. **Do this
   first**, before generating: finding out at the end that there is no slicer is too late.
2. Generate **without texture**, `target_formats:["obj"]` (see `meshy`).
3. `meshy_download_model` with `format:"obj"`, `print_ready:true`, `print_height_mm:<real height>`.
4. Open it in the slicer with the returned `launch_command`.

### Color (Scenario B)

1. Detect slicers with `is_multicolor:true`.
2. Generate **with texture** (preview + refine, or textured image-to-3d).
3. `meshy_process_multicolor` — 10 credits, requires a **textured** model, produces **3MF**.
   `max_colors` 1–16 (default 4) · `max_depth` 3–6 (default 4; 3 coarse, 6 fine).
4. Download the 3MF and open it.

Real multicolor requires a **multi-filament** printer (AMS and the like). A single nozzle only changes color
**per layer**, not per region within the same layer. Resin does not do this flow.

⚠ Multicolor-capable according to the detector: OrcaSlicer, Bambu Studio, Creality Print, Elegoo Slicer,
Anycubic Slicer Next. **PrusaSlicer and Cura are left out.**

⚠ When opening **several** models, space the commands ~1–2 s apart — in a burst Bambu Studio only answers one.

## `print_ready` — what it does exactly, and what it breaks

It only acts with **`format:"obj"`**; in the other formats it is **silently ignored**. It rewrites the file
**in place, with no backup**:

1. Rotates Y-up (glTF) → Z-up (slicer): `(x,y,z) → (x,−z,y)`, normals included.
2. Uniform scale to `print_height_mm` (**default 75**), measured on the already-rotated bounding box.
3. Centers in XY and seats the base at Z=0.

The output is in **millimeters**. The multicolor 3MF **already comes out Z-up** — it does not need this, and applying it
would lay the piece down.

⚠ **It is not idempotent**, despite the tool announcing itself as such. Running it twice rotates the piece
twice: it ends up lying down. If there is doubt about whether it already ran, download again instead of repeating.

⚠ **`print_height_mm: 0` falls back to 75 mm** — it is a `||` coalescence in the code, not a choice. For
a piece of minimal height, give the real value.

## Scale is failure nº1

The AI has no notion of physical size. A model "of a knight" does not know whether it is a
28 mm miniature or a half-meter statue — and the 75 mm default applies all the same, silently.

**The target height is always an explicit decision.** If the user does not say it, ask; if it is
obvious from the use (game miniature, keychain), state the number you assumed.

## Runtime gate — what proves it is ready

`SUCCEEDED` and `healthy` are not evidence that the piece prints well.

| Check | How |
|---|---|
| The mesh is what was asked for | `Read()` the thumbnail or a render; look, do not infer |
| The scale is right | read the final file's bounding box, in mm |
| The orientation is right | the base seated, the piece standing — do not trust `print_ready` without looking |
| Printability metrics | the five numbers, not just the status |
| What the slicer says | open it and **read the profile inside the file** — a project 3MF carries the printer profile in it |

⚠ **Silence is not approval.** A slicer that does not warn may have the check **turned off** — it has
already accepted a 48 mm bridge with the profile declaring a 10 mm maximum, and reported "0 supports", because
it had supports disabled. Before reading the absence of a warning as approval, confirm that the
check was on.

## What stays with the slicer

Print orientation · supports · number of walls · layer height · infill · brim/raft ·
temperature. Meshy decides none of this. Say it again at handoff, instead of leaving implicit that
"it is ready to print".

Minimum wall thickness and a stable base are common-sense guidance (Meshy's documentation
suggests a base ≥ ~3 mm for figurines), not a limit the platform guarantees — treat it as a starting
point, not as a specification.

## Creative Lab — the expensive shortcut

`meshy_creative_lab` does `figure`, `lamp`, `keychain`, `fridge-magnet` from a photo (or text,
for the lamp). It runs prototype → build on its own: **36 credits in one call**, with no gate in between,
and the intermediate concept image is never shown.

Confirm the cost first. And if there is an image **and** text, the image wins — the text is ignored.

## Anti-patterns

| Wrong | Right |
|---|---|
| Guessing whether the mesh prints | `analyze` is free — you always run it |
| Reading `warning` without looking at the numbers | Five metrics; 4,000 degenerate faces ≠ 2 |
| `repair` after texturing | Repair **first**; the repair wipes the texture |
| Publishing the user's mesh to analyze it, without asking | The URL is public and it travels — the decision is theirs |
| Leaving the file published after the analysis | Delete and confirm 404; sweep by age |
| Running `print_ready` again "just to be safe" | It is not idempotent — it lays the piece down |
| `print_ready` on a 3MF or GLB | It only takes effect on OBJ; on the others it is silently ignored |
| Accepting the 75 mm default without saying so | The height is an explicit decision, and you say which one it was |
| "It is ready to print" | Meshy gives mesh and color; orientation, supports and walls belong to the slicer |
| Absence of a slicer warning read as approval | Confirm the check was on |

## Next step (chain)

- A failed mesh that `repair` does not solve → `blender` (3D Print Toolbox, Solidify, boolean).
- Needs another model, another texture or another format → `meshy`.
- Piece delivered and the user wants to judge how it looks → `blender-render` + `design-review`.

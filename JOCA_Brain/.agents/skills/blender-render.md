---
name: blender-render
description: "Render in Blender by code: engine (Cycles/EEVEE), camera, lights, PBR materials, output, animation and sequences. MUST be invoked when the user says: render 3d, render, cycles, eevee, turntable, 3d product shot, pbr material, light a 3d scene, 3d camera, 3d animation. SHOULD also invoke when: transparent render, passes, denoise, samples, hdri, depth of field, frame sequence, mp4 from blender."
triggers: render 3d, render, cycles, eevee, turntable, product shot, pbr material, blender shader, light a scene, three point lighting, hdri, world background, 3d camera, focal length, depth of field, dof, samples, denoise, denoiser, transparent render, film transparent, render passes, exr, frame sequence, 3d animation, keyframe, mp4 blender, agx, view transform, metal gpu, render gpu
chain: design-review
---

# Blender Render — camera, light, material, output

Produce images and sequences by code. Values verified on **Blender 5.1.1 / Apple M4 Pro**; on
another version, confirm with `Read(".claude/reference/blender-api-5x.md")`.

## Engine

```python
import bpy
sc = bpy.context.scene

# EEVEE — rasteriser. Seconds per frame. Use it to ITERATE.
sc.render.engine = 'BLENDER_EEVEE'        # ⚠ 5.x. On 4.2–4.5 it is 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 64

# Cycles — path tracing. Use it to DELIVER.
sc.render.engine = 'CYCLES'
sc.cycles.samples = 128
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.01
```

Engine enum on 5.1: `('BLENDER_EEVEE', 'BLENDER_WORKBENCH', 'CYCLES')` — **`BLENDER_EEVEE_NEXT`
does not exist** and assigning it raises `TypeError`. It is the error most public bpy examples carry,
because they were written for 4.2.

### GPU — Apple Silicon (Metal)

```python
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'        # NVIDIA: 'OPTIX' (>'CUDA') · AMD: 'HIP' · Intel: 'ONEAPI'
prefs.get_devices()
for d in prefs.devices:
    d.use = True                            # or only those where d.type == 'METAL'
sc.cycles.device = 'GPU'
```

Verified on this machine: `prefs.devices` returns `Apple M4 Pro (CPU)` and
`Apple M4 Pro (GPU - 20 cores) (METAL)`.

⚠ **The first Cycles GPU render pays for kernel compilation** — measured, ~90 s for 320×240 @16
samples in a fresh process. It is not the scene being heavy. Consequences: do not estimate total time
from the first frame, and in a batch render everything **in the same Blender process** instead of one
process per frame.

## Output

```python
r = sc.render
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
r.image_settings.file_format = 'PNG'        # PNG · JPEG · OPEN_EXR · OPEN_EXR_MULTILAYER · TIFF · WEBP
r.image_settings.color_mode  = 'RGBA'       # 'RGBA' requires film_transparent for a useful alpha
r.image_settings.compression = 15
r.film_transparent = True                   # transparent background

sc.view_settings.view_transform = 'AgX'     # 5.1: 'Standard' · 'AgX' · 'Filmic' · 'Khronos PBR Neutral'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0

r.filepath = "/out/render_"                 # still: comes out as "/out/render_.png"
bpy.ops.render.render(write_still=True)
```

### Render region — turn it on by default in scenes with a camera

```python
r.use_border = True
r.border_min_x, r.border_min_y = 0.0, 0.0
r.border_max_x, r.border_max_y = 1.0, 1.0
r.use_crop_to_border = False      # True crops the final image to the size of the region
```

Without this, the Rendered viewport also computes the grey area outside the passepartout — GPU spent
on pixels nobody sees. With the bounds at 0–1 the framing does not change; you only stop rendering
outside the camera.

Equivalent to **Ctrl+B** in camera view. Two distinct properties, and it is the API description that
tells them apart:

| Context | Property | Reach |
|---|---|---|
| through the camera (Numpad 0) | `scene.render.use_border` | Rendered viewport **and** final render |
| outside the camera | `space.use_render_border` | viewport only — *"when not viewing through the camera"* |

It is **per scene**, saved in the `.blend` — not a global preference, every new file is born without
it. That is why it goes in the script.

`Standard` for composition/UI where the colors have to come out as they were defined; `AgX` for
photographic imagery (compresses highlights, desaturates on clipping); **`Khronos PBR Neutral` for
product/e-commerce** — preserves the material color without AgX's washout. Delivering a brand color
swatch in AgX returns the wrong color.

⚠ **`sc.cycles.samples` comes at 4096 by default on 5.1.** Not lowering it explicitly is the
difference between 30 s and an hour per frame — and the script gives no warning.

## Camera

```python
import math
from mathutils import Vector

bpy.ops.object.camera_add(location=(7, -6, 5))
cam = bpy.context.active_object
sc.camera = cam

cam.data.lens = 50            # mm. 35 = wide · 50 = neutral · 85+ = compresses, flatters product
cam.data.sensor_width = 36
cam.data.clip_start, cam.data.clip_end = 0.1, 1000

# Point at a location (once)
direction = Vector((0, 0, 1)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# Or track an object (stays pointed if something moves) — prefer this in animation
track = cam.constraints.new(type='TRACK_TO')
track.target, track.track_axis, track.up_axis = target, 'TRACK_NEGATIVE_Z', 'UP_Y'
# ⚠ up_axis='UP_Z' on a camera is DEGENERATE: measured, the matrix ends up at euler [0,0,0] — the
# camera points at nothing and looks straight down. For cameras it is always 'UP_Y'.
# Verified equivalent to the direct quaternion: both give euler [72.6, 0, 45] (Y=0 → no roll).

# Depth of field
cam.data.dof.use_dof = True
cam.data.dof.focus_object = target
cam.data.dof.aperture_fstop = 2.8
```

Frame everything that exists without guessing positions:
```python
bpy.ops.object.select_all(action='SELECT')
bpy.ops.view3d.camera_to_view_selected()   # needs a 3D context; in headless, compute the bbox
```
In `-b` there is no 3D area — compute it by hand from the objects' `bound_box` and pull the camera
back by the bounding box diagonal divided by `2*tan(fov/2)`, with ~15% margin.

## Light

```python
bpy.ops.object.light_add(type='AREA', location=(3, -3, 4))
key = bpy.context.active_object.data
key.energy = 500          # WATTS on AREA/POINT/SPOT — big numbers are normal
key.size = 2.0            # bigger = softer shadow

bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
sun = bpy.context.active_object.data
sun.energy = 3            # SUN is irradiance, not watts — 1–5 is the useful range
sun.angle = math.radians(0.526)   # solar disc; bigger = softer shadow
```

Starting three-point (product/prop, object at the origin, ~1 m):
`key` AREA 500 W at 45° front-left · `fill` AREA 150 W on the opposite side, further away ·
`rim` AREA 300 W behind and above, separating it from the background.

### World / HDRI

```python
world = bpy.data.worlds['World'] if 'World' in bpy.data.worlds else bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.05, 0.05, 0.06, 1)
bg.inputs['Strength'].default_value = 1.0

# HDRI from a file
env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load("/path/studio.hdr")
world.node_tree.links.new(env.outputs['Color'], bg.inputs['Color'])
```

With no HDRI and no light, Cycles returns black — it is not a bug.

## PBR material

```python
def pbr(name, base=(0.8, 0.8, 0.8, 1), roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = base
    b.inputs["Roughness"].default_value  = roughness
    b.inputs["Metallic"].default_value   = metallic
    return mat

obj.data.materials.append(pbr("MAT_Metal", (0.7, 0.7, 0.75, 1), 0.25, 1.0))
```

The Principled socket names **changed in 4.0** (`Specular`→`Specular IOR Level`,
`Emission`→`Emission Color`+`Emission Strength`, `Subsurface`→`Subsurface Weight`). Do not trust
memory — list them before writing:
```python
print([s.name for s in mat.node_tree.nodes["Principled BSDF"].inputs])
```

Emissive (light coming from the object itself):
```python
b.inputs["Emission Color"].default_value = (1, 0.6, 0.2, 1)
b.inputs["Emission Strength"].default_value = 5.0
```
Do not put emission on a material shared by several pieces — it lights up everything that uses it.

## Animation and sequences

```python
sc.frame_start, sc.frame_end, sc.render.fps = 1, 120, 24

obj.location = (0, 0, 0);  obj.keyframe_insert("location", frame=1)
obj.location = (0, 0, 3);  obj.keyframe_insert("location", frame=60)

for fc in obj.animation_data.action.fcurves:      # interpolation
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'; kp.easing = 'EASE_IN_OUT'

r.filepath = "/out/frames/f_"       # sequence: f_0001.png …
bpy.ops.render.render(animation=True)
```

**Always render to a PNG/EXR sequence, never straight to video.** A crash at 80% of an MP4 loses
everything; with frames, you resume. Assemble afterwards with ffmpeg:

```bash
ffmpeg -framerate 24 -i /out/frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 /out/video.mp4
# with alpha (ProRes 4444):
ffmpeg -framerate 24 -i /out/frames/f_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le /out/video.mov
```

Turntable — rotate the **camera**, not the object (a rotating object drags shadows and reflections):
```python
bpy.ops.object.empty_add(location=(0, 0, 0.5))
pivot = bpy.context.active_object
cam.parent = pivot
pivot.rotation_euler.z = 0;                 pivot.keyframe_insert("rotation_euler", frame=1)
pivot.rotation_euler.z = math.radians(360); pivot.keyframe_insert("rotation_euler", frame=121)
for fc in pivot.animation_data.action.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'         # otherwise the turn speeds up and stalls — no loop
```

## Passes (later compositing)

```python
vl = sc.view_layers[0]
vl.use_pass_combined = vl.use_pass_z = vl.use_pass_normal = True
vl.use_pass_diffuse_color = vl.use_pass_ambient_occlusion = True
vl.use_pass_cryptomatte_object = True            # per-object masks — lives on the VIEW LAYER,
vl.use_pass_cryptomatte_material = True          # not on sc.cycles (common error)
r.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
r.image_settings.color_depth = '32'
```

## Time budget

| Purpose | Engine | Samples | Resolution |
|---|---|---|---|
| iterating framing/composition | EEVEE | 16–32 | 480–720p |
| preview to show | EEVEE | 64 | 1080p |
| still delivery | Cycles | 128–256 + denoise | 1080p–4K |
| animation delivery | Cycles | 64–128 + denoise | 1080p |

Going past 256 samples with denoise on rarely changes what you see — it costs time, not quality.

## Measured gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `TypeError: enum "BLENDER_EEVEE_NEXT" not found` | example written for 4.2 | `'BLENDER_EEVEE'` on 5.x |
| First frame takes ~90 s for no reason | Metal kernel compilation | normal; render everything in the same process |
| Black render | no light and no world | add a light or an HDRI |
| Alpha does not show in the PNG | `film_transparent` missing | `r.film_transparent = True` + `RGBA` |
| Brand color comes out wrong | `view_transform='AgX'` | `'Standard'` for exact color |
| `KeyError` on a Principled input | names changed in 4.0 | list `inputs` before writing |
| Turntable jolts at the loop | Bézier interpolation | `LINEAR` on the rotation keyframes |
| MP4 lost mid-render | rendering straight to video | frames + ffmpeg |

## Next step (chain)

- Render delivered and there is a visual judgement to make → `design-review`.
- The render does not match the request → back to the `blender` skill's verification loop (max 3 rounds).

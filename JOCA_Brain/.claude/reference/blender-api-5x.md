# Blender bpy — API deltas and measured facts

On-demand reference. `Read()` when a bpy snippet fails, when the target version is not the one
measured here, or before copying examples from tutorials and public repos.

**Measured on Blender 5.1.1 (build 2026-04-14), macOS / Apple M4 Pro, headless (`-b`).** Everything
here was obtained by running, not from the documentation nor from memory.

---

## Why this file exists

Practically all public bpy material — including Blender skill packs for agents — was written for
3.x/4.2 and **does not run on 5.x without editing**. The errors are not subtle: they raise
`TypeError`/`KeyError` on the first line, or worse, they run and silently produce the wrong thing.

Audited: `arjun988/blender-skills` (94 skills), `Andrew1326/dominations` (5), `kevinbadi/blender-skills`
(16), `Dev-GOM/blender-toolkit`. All of them break on at least one of the points below.

---

## Deltas that break code

| Written in the public examples | Blender 5.1 | Effect |
|---|---|---|
| `engine = 'BLENDER_EEVEE_NEXT'` | `'BLENDER_EEVEE'` | `TypeError: enum not found` |
| `compute_device_type = 'CUDA'` on Mac | `'METAL'` | no GPU, falls back to CPU |
| `inputs["Specular"]` | `inputs["Specular IOR Level"]` | `KeyError` |
| `inputs["Emission"]` | `inputs["Emission Color"]` + `["Emission Strength"]` | `KeyError` |
| `inputs["Subsurface"]` | `inputs["Subsurface Weight"]` | `KeyError` |
| `inputs["Clearcoat"]` | `inputs["Coat Weight"]` | `KeyError` |
| `inputs["Sheen"]` | `inputs["Sheen Weight"]` | `KeyError` |
| `sc.cycles.use_pass_crypto_object` | `view_layer.use_pass_cryptomatte_object` | attribute does not exist |
| `bpy.ops.export_scene.obj` | `bpy.ops.wm.obj_export` | operator does not exist |
| `bpy.ops.import_mesh.stl` | `bpy.ops.wm.stl_import` | operator does not exist |

Full engine enum on 5.1: `('BLENDER_EEVEE', 'BLENDER_WORKBENCH', 'CYCLES')`.

## Default values that cost dearly

| Property | 5.1 default | Why it matters |
|---|---|---|
| `sc.cycles.samples` | **4096** | not lowering it = hour-long frames; nothing warns you |
| startup scene | Cube + Camera + Light | the cube hides whatever you create at the origin |
| `sc.cycles.device` | `'CPU'` | setting GPU is not enough — you need `compute_device_type` + `get_devices()` |
| `r.film_transparent` | `False` | `RGBA` without this gives an opaque alpha |

## Import/export operators (5.1, verified with `dir()`)

`bpy.ops.wm.*`: `obj_import` `obj_export` `stl_import` `stl_export` `ply_import` `ply_export`
`usd_import` `usd_export` `alembic_import` `alembic_export` `fbx_import` `collection_export_all`
`grease_pencil_import_svg` `grease_pencil_export_svg` `grease_pencil_export_pdf` `drop_import_file`

`bpy.ops.import_scene.*`: `fbx` `gltf` — `bpy.ops.export_scene.*`: `fbx` `gltf`

FBX has two entries on 5.1 (`wm.fbx_import` new, `import_scene.fbx` legacy). FBX export is still
only in `export_scene`.

Command to confirm on another version:
```python
print(sorted(o for o in dir(bpy.ops.wm) if 'import' in o or 'export' in o))
print(sorted(dir(bpy.ops.import_scene)), sorted(dir(bpy.ops.export_scene)))
```

## Enums that cannot be read by introspection

`view_transform`, `denoiser` and `compute_device_type` are filled in by a callback at runtime.
`bl_rna.properties[...].enum_items` returns an **empty list or `['NONE']`** — that is not a sign
that the option does not exist. Test by assignment inside `try/except`, not by introspection.

Values confirmed by assignment on 5.1:
- `view_transform`: `Standard` · `AgX` · `Filmic` · `Khronos PBR Neutral`
- `denoiser`: `OPENIMAGEDENOISE` (accepted; `OPTIX` depends on NVIDIA hardware)
- `compute_device_type`: `METAL` on this hardware

## Apple Silicon — Metal

```
prefs.devices → [('Apple M4 Pro', 'CPU'), ('Apple M4 Pro (GPU - 20 cores)', 'METAL')]
```

**Kernel compilation on the first render:** ~90 s measured for 320×240 @16 samples in a fresh
Blender process. It is a fixed cost per process, not per frame. Implications:
- do not estimate total time from the first frame;
- in a batch, render everything **inside the same process** (`bpy.ops.render.render` in a loop),
  never one `blender -b` per frame;
- an EEVEE preview does not pay this cost — one more reason to iterate in EEVEE.

## Principled BSDF names on 5.1 (full list, verified)

```
Base Color · Metallic · Roughness · IOR · Alpha · Normal · Weight · Diffuse Roughness
Subsurface Weight · Subsurface Radius · Subsurface Scale · Subsurface IOR · Subsurface Anisotropy
Specular IOR Level · Specular Tint · Anisotropic · Anisotropic Rotation · Tangent
Transmission Weight · Coat Weight · Coat Roughness · Coat IOR · Coat Tint · Coat Normal
Sheen Weight · Sheen Roughness · Sheen Tint · Emission Color · Emission Strength
Thin Film Thickness · Thin Film IOR
```

On another version, print instead of assuming:
```python
print([s.name for s in mat.node_tree.nodes["Principled BSDF"].inputs])
```

## Output formats (5.1)

`AVIF` `JPEG` `OPEN_EXR` `PNG` `WEBP` `BMP` `CINEON` `DPX` `IRIS` `JPEG2000` `HDR` `TARGA`
`TARGA_RAW` `TIFF` `OPEN_EXR_MULTILAYER` `FFMPEG`

## View layer passes (5.1)

`combined` `z` `mist` `normal` `position` `vector` `uv` `object_index` `material_index` `shadow`
`ambient_occlusion` `emit` `environment` `grease_pencil` · `diffuse_{direct,indirect,color}` ·
`glossy_{direct,indirect,color}` · `transmission_{direct,indirect,color}` ·
`subsurface_{direct,indirect,color}` · `cryptomatte_{object,material,asset,accurate}`

All prefixed with `use_pass_`, all under `scene.view_layers[i]`.

## Protocol when porting a third-party snippet

1. `blender --version` — compare with the version the snippet was written for.
2. Run the snippet in isolation with `-b` and read the **whole** traceback (not `| head`).
3. `KeyError` on a socket → print `inputs`. `TypeError` on an enum → the message lists the valid ones.
4. Missing operator → `dir()` on the matching namespace.
5. Ran without error ≠ correct → render and look (verification loop of the `blender` skill).

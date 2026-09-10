---
name: blender-scripting
description: "Write and run headless bpy scripts: build scenes, transform objects, modifiers, 3D import/export, batch of .blend, hierarchy and custom properties. MUST be invoked when the user says: bpy, blender script, automate blender, batch blend, import model, export model, convert 3d, glb, gltf, fbx, obj, stl, usd. SHOULD also invoke when: geometry by code, modifier, boolean, array, mirror, subdivision, bulk rename objects, clear scene, 3d hierarchy."
triggers: bpy, blender script, blender python, automate blender, headless blender, batch blend, import 3d model, export 3d model, convert 3d, glb, gltf, fbx, obj, stl, usd, alembic, modifier, boolean, array modifier, mirror, subdivision surface, solidify, bevel, clear scene, rename objects, 3d hierarchy, parent, collection, custom property, mathutils, geometry nodes
chain: blender-render
---

# Blender Scripting — bpy headless

Build and manipulate scenes by code. No GUI, no clicks, reproducible.

Entry point and execution contract: skill `blender` (binary, version check, verification loop).
API deltas between versions: `Read(".claude/reference/blender-api-5x.md")`.

## The three namespaces

```python
import bpy

bpy.data      # the file's data — direct access, fast, no context. PREFER THIS.
bpy.context   # current state — active object, selection, scene
bpy.ops       # operators (what a click does) — need the right context, more fragile
```

**Rule:** `bpy.data` to read and write properties; `bpy.ops` only when there is no equivalent
(adding primitives, applying modifiers, import/export). A `bpy.ops` with the wrong object active
fails silently or acts on the wrong object — the most common error in headless scripts.

```python
# Before any bpy.ops that depends on selection:
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
```

## Clear the scene — always, before building

The startup file **already has** Cube + Camera + Light. Not deleting them is the #1 cause of
"empty" or covered renders: the default cube sits at the origin, exactly where you put your object.

```python
import bpy

def clear_scene():
    """Empty scene + orphan data removed."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                 bpy.data.armatures, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)

def setup_units(system='METRIC', scale=1.0):
    s = bpy.context.scene
    s.unit_settings.system = system
    s.unit_settings.scale_length = scale   # 1 Blender unit = 1 metre
```

## Create and transform

```python
import bpy, math
from mathutils import Vector, Euler, Matrix

bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
obj = bpy.context.active_object
obj.name = "SM_Box"

obj.location       = (3, 0, 1)
obj.rotation_euler = (0, 0, math.radians(45))    # RADIANS, always
obj.scale          = (1, 2, 0.5)

# Apply transforms (freeze into the mesh) — required before exporting to an engine
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Origin at the base (pivot on the floor) — what engines expect for props
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
obj.location.z += obj.dimensions.z / 2

# Hierarchy without moving the visual position
child.parent = parent
child.matrix_parent_inverse = parent.matrix_world.inverted()
```

Primitives: `primitive_cube_add` · `_uv_sphere_add` · `_ico_sphere_add` · `_cylinder_add` ·
`_cone_add` · `_torus_add` · `_plane_add` · `_grid_add` · `_monkey_add`.

## Modifiers — non-destructive until applied

```python
m = obj.modifiers.new(name="Bevel", type='BEVEL')
m.width, m.segments, m.limit_method = 0.02, 2, 'ANGLE'
m.angle_limit = math.radians(30)

arr = obj.modifiers.new(name="Array", type='ARRAY')
arr.count, arr.relative_offset_displace = 5, (1.1, 0, 0)

boo = obj.modifiers.new(name="Cut", type='BOOLEAN')
boo.operation, boo.object, boo.solver = 'DIFFERENCE', cutter, 'EXACT'

# Apply (needs the active object)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="Bevel")
```

**Order matters:** the stack runs top to bottom. `Mirror → Array → Bevel → Subdivision` produces a
different result from `Bevel → Mirror`. Bevel after Subdivision is almost never what you want.

Useful types: `MIRROR` `ARRAY` `BEVEL` `SUBSURF` `SOLIDIFY` `BOOLEAN` `DECIMATE` `WELD` `REMESH`
`SCREW` `CURVE` `SHRINKWRAP` `NODES` (geometry nodes).

## Import / export

The operator names **changed between versions** — the glTF and FBX ones do not live in the same
place as the others. Verified on Blender 5.1:

| Format | Import | Export |
|---|---|---|
| OBJ | `bpy.ops.wm.obj_import` | `bpy.ops.wm.obj_export` |
| STL | `bpy.ops.wm.stl_import` | `bpy.ops.wm.stl_export` |
| PLY | `bpy.ops.wm.ply_import` | `bpy.ops.wm.ply_export` |
| USD | `bpy.ops.wm.usd_import` | `bpy.ops.wm.usd_export` |
| Alembic | `bpy.ops.wm.alembic_import` | `bpy.ops.wm.alembic_export` |
| FBX | `bpy.ops.wm.fbx_import` **or** `bpy.ops.import_scene.fbx` | `bpy.ops.export_scene.fbx` |
| glTF/GLB | `bpy.ops.import_scene.gltf` | `bpy.ops.export_scene.gltf` |

Confirm on the version in use before assuming:
```python
print([o for o in dir(bpy.ops.wm) if 'import' in o or 'export' in o])
print(dir(bpy.ops.import_scene), dir(bpy.ops.export_scene))
```

### Axes by destination — the error you only see in the engine

Blender is **Z-up**. Almost everything else is **Y-up**. Exporting without converting gives you the
model lying down, and that shows up in no log.

```python
# glTF/GLB — web, three.js, Godot. The exporter converts Y-up on its own.
bpy.ops.export_scene.gltf(
    filepath="/out/asset.glb", export_format='GLB',
    use_selection=True, export_apply=True,          # applies modifiers
    export_yup=True,
)

# FBX — Unity
bpy.ops.export_scene.fbx(
    filepath="/out/asset.fbx", use_selection=True,
    apply_scale_options='FBX_SCALE_ALL',
    axis_forward='-Z', axis_up='Y',
    bake_space_transform=True, mesh_smooth_type='FACE',
)

# FBX — Unreal (cm, X-forward)
bpy.ops.export_scene.fbx(
    filepath="/out/asset.fbx", use_selection=True,
    global_scale=1.0, apply_unit_scale=True,
    axis_forward='X', axis_up='Z',
)
```

Verify by re-importing the exported file into a clean scene and rendering — not by the file size on
disk.

## Batch of .blend

```python
import bpy, glob, os

for filepath in sorted(glob.glob("/projects/**/*.blend", recursive=True)):
    bpy.ops.wm.open_mainfile(filepath=filepath)
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            print(f"{os.path.basename(filepath)}: {obj.name} — {len(obj.data.polygons)} faces")
    out = filepath.replace(".blend", "_processed.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out)
```

**Never overwrite the original** unless the user explicitly asks for replacement — `open_mainfile`
followed by `save_mainfile` is destructive and has no undo outside the GUI. Write to a sibling name.

## Command-line args

```python
import sys
argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []

import argparse
p = argparse.ArgumentParser()
p.add_argument("--out", required=True)
p.add_argument("--samples", type=int, default=64)
args = p.parse_args(argv)
```

## Inspect before acting

On a `.blend` you did not build, read first:

```python
import bpy
print(f"objects={len(bpy.data.objects)} meshes={len(bpy.data.meshes)} mats={len(bpy.data.materials)}")
print(f"tris={sum(len(m.loop_triangles) for m in bpy.data.meshes)}")
for o in bpy.data.objects:
    extra = f" — {len(o.data.vertices)}v" if o.type == 'MESH' else ""
    print(f"  {o.name} ({o.type}) loc={tuple(round(c, 3) for c in o.location)}{extra}")
```
(`loop_triangles` needs `mesh.calc_loop_triangles()` first, if the mesh has not been evaluated.)

## Measured gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Render shows a cube you did not create | startup scene not cleared | `clear_scene()` first |
| `bpy.ops` acts on the wrong object | wrong active object/selection | `select_all(DESELECT)` + `select_set` + `objects.active` |
| Absurd rotation | degrees passed where radians are expected | `math.radians()` |
| Object vanishes in the engine | scale/rotation not applied | `transform_apply(rotation=True, scale=True)` |
| Model lying down in the engine | Z-up vs Y-up | axis flags in the exporter; verify by re-importing |
| Modifiers do not show up in the export | `export_apply` set to `False` | turn it on, or apply beforehand |
| Memory growing during the batch | orphan datablocks pile up | remove orphans each iteration |
| `print()` does not show | GUI instead of `-b` | run with `--background` |

## Next step (chain)

- Geometry ready → `blender-render` (camera, light, material, preview).
- Always, before calling it done → the `blender` skill's verification loop: render and **look**.

---
name: blender
description: >
  3D modeling, scene manipulation, and automation in Blender via MCP. Use when the user
  wants to create or modify 3D objects, materials, lighting, animations, or run Python
  scripts in Blender. Requires Blender running with the BlenderMCP add-on connected.
  Triggered by: "blender", "3D model", "3D scene", "create mesh", "modifier", "geometry nodes",
  "material", "shader", "render", "animation", "rigging", "blender script".
---

# Blender

You control a live Blender session via MCP. All operations apply to the active Blender instance — changes persist to disk only when saved inside Blender.

## Prerequisites (one-time setup)

1. **Install BlenderMCP add-on in Blender:**
   - Download `addon.py` from https://github.com/ahujasid/blender-mcp
   - In Blender: Edit → Preferences → Add-ons → Install → select `addon.py` → enable "Interface: Blender MCP"

2. **Connect:** Press `N` in the 3D Viewport → BlenderMCP tab → "Start Server"

3. **MCP active:** The `blender` MCP server must be running (`uvx blender-mcp`).

## Workflow

**Always start by reading the scene:**
```
get_scene_info → understand what's there before doing anything
get_viewport_screenshot → visual confirmation of the current state
```

**After significant changes:** take a screenshot to verify the result.

**For complex operations:** use `execute_blender_code` with Python. It's the most powerful tool — everything Blender can do via Python is available.

---

## Available MCP Tools

### Scene inspection

| Tool | What it does |
|------|-------------|
| `get_scene_info` | Full scene overview: objects, collections, active object, frame range |
| `get_object_info` | Details on one object: type, location, rotation, scale, modifiers, materials |
| `get_viewport_screenshot` | Screenshot of the 3D viewport (param: `max_size`, default 800px) |

### Code execution

| Tool | What it does |
|------|-------------|
| `execute_blender_code` | Run arbitrary Python in Blender (param: `code`) |

### Asset integrations

| Tool | Requires | What it does |
|------|----------|-------------|
| `get_polyhaven_status` | PolyHaven enabled in add-on | Check if PolyHaven is active |
| `get_polyhaven_categories` | PolyHaven | List categories (`hdris`, `textures`, `models`, `all`) |
| `search_polyhaven_assets` | PolyHaven | Search by type + category |
| `download_polyhaven_asset` | PolyHaven | Download + import (id, type, resolution, format) |
| `set_texture` | PolyHaven | Apply downloaded texture to an object |
| `search_sketchfab_models` | Sketchfab key | Search models (query, categories, count) |
| `get_sketchfab_model_preview` | Sketchfab key | Thumbnail preview by UID |
| `download_sketchfab_model` | Sketchfab key | Download + import model by UID |
| `generate_hyper3d_model_via_text` | Hyper3D key | Generate 3D asset from text prompt |
| `generate_hyper3d_model_via_images` | Hyper3D key | Generate from image references |
| `poll_rodin_job_status` | Hyper3D | Check generation job status |
| `import_generated_asset` | Hyper3D | Import completed asset |
| `generate_hunyuan3d_model` | Hunyuan3D | Generate via text or image URL |
| `poll_hunyuan_job_status` | Hunyuan3D | Check Hunyuan3D job |
| `import_generated_asset_hunyuan` | Hunyuan3D | Import Hunyuan3D result |

---

## execute_blender_code patterns

The `code` param runs in Blender's Python environment. `bpy` is always available.

### Create a mesh object
```python
import bpy

bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
obj = bpy.context.active_object
obj.name = "MyCube"
```

### Apply a material
```python
import bpy

obj = bpy.data.objects["MyCube"]
mat = bpy.data.materials.new(name="RedMat")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.8, 0.1, 0.1, 1.0)
bsdf.inputs["Roughness"].default_value = 0.3
if obj.data.materials:
    obj.data.materials[0] = mat
else:
    obj.data.materials.append(mat)
```

### Add a modifier
```python
import bpy

obj = bpy.data.objects["MyCube"]
bpy.context.view_layer.objects.active = obj
mod = obj.modifiers.new("Subdiv", "SUBSURF")
mod.levels = 2
mod.render_levels = 3
```

### Batch rename objects
```python
import bpy

for i, obj in enumerate(bpy.data.objects):
    if obj.type == "MESH":
        obj.name = f"mesh_{i:03d}"
```

### Get scene stats (return as string)
```python
import bpy

scene = bpy.context.scene
stats = []
for obj in scene.objects:
    if obj.type == "MESH":
        poly_count = len(obj.data.polygons)
        stats.append(f"{obj.name}: {poly_count} polys")
print("\n".join(stats))
```

### Set HDRI lighting
```python
import bpy

world = bpy.context.scene.world
world.use_nodes = True
nodes = world.node_tree.nodes
links = world.node_tree.links

bg = nodes.get("Background") or nodes.new("ShaderNodeBackground")
env_tex = nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load("/path/to/hdri.exr")
links.new(env_tex.outputs["Color"], bg.inputs["Color"])
```

### Render to file
```python
import bpy

bpy.context.scene.render.filepath = "/tmp/render.png"
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
```

---

## Common workflows

### 1. Model from scratch
1. `get_scene_info` — check what exists
2. `execute_blender_code` — create base mesh
3. `execute_blender_code` — add modifiers (Subdivision, Bevel, etc.)
4. Apply material or download via PolyHaven
5. `get_viewport_screenshot` — verify

### 2. Scene cleanup / batch operations
1. `get_scene_info` — inventory
2. `execute_blender_code` — batch rename, remove unused data, fix transforms
3. Verify with `get_scene_info` again

### 3. AI-generated 3D asset
1. `generate_hyper3d_model_via_text` — describe asset
2. `poll_rodin_job_status` — wait for completion
3. `import_generated_asset` — bring into scene
4. `get_viewport_screenshot` — review

### 4. Texture an existing model
1. `get_polyhaven_status` — confirm integration active
2. `search_polyhaven_assets` — find appropriate texture
3. `download_polyhaven_asset` — import at desired resolution
4. `set_texture` — apply to object

---

## Important constraints

- Changes only apply to the **active Blender session** — nothing persists until the user saves in Blender (`Ctrl+S`)
- `execute_blender_code` output goes to stderr; to return data, use `print()` — the output is captured
- For long-running operations (rendering, AI generation), use polling tools rather than sleeping
- Blender must be running and the BlenderMCP add-on must be connected before any tool call works
- If a tool call fails with "connection refused", remind the user to start the server in the BlenderMCP tab

---

## Blender Python API quick reference

```python
import bpy

# Active object
bpy.context.active_object
bpy.context.view_layer.objects.active = bpy.data.objects["name"]

# All objects of a type
[o for o in bpy.data.objects if o.type == "MESH"]

# Select / deselect
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)

# Transforms
obj.location = (x, y, z)
obj.rotation_euler = (rx, ry, rz)  # radians
obj.scale = (sx, sy, sz)

# Apply transforms
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Delete object
bpy.data.objects.remove(obj, do_unlink=True)

# Scene frame range
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 250
bpy.context.scene.frame_set(frame_number)
```

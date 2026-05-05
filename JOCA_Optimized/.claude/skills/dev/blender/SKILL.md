---
name: blender
description: 3D modeling, scene manipulation, and automation in Blender via MCP. Use when creating/modifying 3D objects, materials, lighting, animations, or running Python scripts in Blender. Requires Blender running with BlenderMCP add-on. Triggers: blender, 3D model, 3D scene, create mesh, modifier, geometry nodes, material, shader, render, animation, rigging, blender script.
---

Controls a live Blender session via MCP. Changes persist to disk only when saved inside Blender.

SETUP (one-time): Install `addon.py` from https://github.com/ahujasid/blender-mcp → Blender: Edit → Preferences → Add-ons → Install → enable "Interface: Blender MCP" → N panel → BlenderMCP tab → "Start Server". MCP: `uvx blender-mcp`.

WORKFLOW: Always start with `get_scene_info` + `get_viewport_screenshot` before changes. Take screenshot after significant ops. Use `execute_blender_code` (Python) for complex operations — it's the most powerful tool.

ASSETS: PolyHaven (`get_polyhaven_assets`, `download_polyhaven_asset`) · Sketchfab (`search_sketchfab_models`, `download_sketchfab_model`, requires API key)

ENFORCE: read scene before modifying · screenshot after major changes · save explicitly in Blender (MCP doesn't auto-save)

MCP TOOLS: `get_scene_info` · `get_viewport_screenshot` · `create_object` · `modify_object` · `delete_object` · `set_material` · `render_image` · `execute_blender_code` · `get_polyhaven_assets` · `download_polyhaven_asset` · `search_sketchfab_models` · `download_sketchfab_model`

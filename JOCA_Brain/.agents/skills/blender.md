---
name: blender
description: "Director/router for 3D work in Blender via headless Python (bpy). MUST be invoked when the user says: blender, 3d, 3d model, 3d scene, 3d render, .blend, bpy, glb, gltf, fbx, obj, stl, mesh, model. SHOULD also invoke when: 3d asset for a game, turntable, 3d product shot, convert model, export to Unity/Unreal/Godot/three.js, batch of .blend, low poly, geometry nodes."
triggers: blender, bpy, 3d, 3d model, 3d modelling, 3d scene, 3d render, .blend, glb, gltf, fbx, obj, stl, usd, mesh, model, 3d asset, game-ready, low poly, lowpoly, turntable, product shot, geometry nodes, cycles, eevee, uv, unwrap, pbr material, rig, rigging, armature, convert 3d model, export to unity, export to unreal, export to godot, export to threejs, batch blend
chain: blender-scripting, blender-render
---

# Blender — Director

Entry point for any 3D work. Decides the route, sets the brief, and **closes the loop by looking at
the render** — not at the script's report.

## Execution contract (this machine)

```bash
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"   # macOS — NOT on the PATH
"$BLENDER" -b --python script.py                              # headless
"$BLENDER" -b scene.blend --python script.py                  # over an existing .blend
"$BLENDER" -b --python script.py -- --out /tmp/x.png          # args after `--`
```

Windows: `C:\Program Files\Blender Foundation\Blender <ver>\blender.exe`. Confirm with `where blender`
before assuming; if it does not exist, it is `TODO: Blender path missing`, never a plausible path.

**Check the version before writing the first line of bpy** — the API breaks between majors:

```bash
"$BLENDER" --version
```

Version ≠ 5.x → `Read(".claude/reference/blender-api-5x.md")` for the delta table. Writing
`BLENDER_EEVEE_NEXT` on a 5.x blows up; writing `BLENDER_EEVEE` on a 4.2 gives you EEVEE Legacy.

## Route — headless CLI vs MCP

| | **headless CLI (default)** | MCP (`blender-mcp`) |
|---|---|---|
| Requires | only the binary | Blender **open** + addon + server running |
| Deterministic | yes — versioned script, re-runs the same | no — live session state |
| Verifiable | render → file → compare | viewport screenshot |
| Typical failure | API error, visible in the log | connection drops, Blender crashes, half-done state |

**The default is the CLI.** MCP only enters if the user wants to see it happen live in the viewport
*and* already has the addon active. Not installed on this machine — do not assume it is available.

## Router

| Request | Skill |
|---|---|
| create/change geometry, modifiers, import/export, batch of `.blend`, hierarchy, custom props | `blender-scripting` |
| camera, lights, PBR materials, engine, output, animation, image/sequence render | `blender-render` |
| API deltas between versions, measured gotchas, table of I/O operators | `.claude/reference/blender-api-5x.md` (`Read()`) |

Work that crosses both (model → render) runs the sequence: `blender-scripting` →
`blender-render` → **verification loop**.

## Verification loop (mandatory — what separates this from a script run on luck)

A bpy script that runs without error does **not** prove the scene is right. The exit code says the
Python ran; it does not say the object is in frame, that the light catches it, or that the material
shows up. Measured: a script that created a monkey and a camera returned `RENDER_OK` and produced a
render of the **default cube** — the monkey was there, hidden inside the cube nobody deleted.

```
1. RUN      → blender -b --python script.py
2. RENDER   → cheap preview (EEVEE, 480p) to disk
3. LOOK     → Read() the .png. See, don't infer.
4. COMPARE  → against the reference or the request; list the differences
5. FIX      → edit the script (not the scene) and repeat. Max 3 rounds, then report.
```

Loop rules:
- **Preview in EEVEE, deliver in Cycles.** Iterating in Cycles burns minutes per round with no new
  information about framing and composition.
- **The script is the source of truth**, not the `.blend`. You fix the script and re-run from scratch;
  that way the result is reproducible and the diff is readable.
- Scene to be built from scratch → always start by clearing the startup scene (Cube + Camera + Light
  are already there). See `blender-scripting`.

## Brief before executing

Work bigger than a one-off tweak → write this first, in 6 lines:

```
Target:      [isolated asset / scene / conversion / batch]
Destination: [engine + format: glTF web · FBX Unity · USD · PNG · MP4]
Budget:      [tris, texture resolution, samples] — only if it targets an engine/real time
Scale:       [real units; 1 Blender unit = 1 m]
Axes:        [Blender is Z-up; Unity/three.js are Y-up — see the export table]
Ready:       [verifiable criterion: "the render shows X head-on, with no clipping"]
```

With no explicit budget and no basis in the project → do not invent numbers: ask, or assume and
state the assumption.

## Real limits (do not promise what does not come out)

Measured and corroborated by the public literature on Claude+Blender:

| Comes out well | Comes out badly |
|---|---|
| scene composition, hard-surface props, kitbash | organic shapes from primitives |
| lights, cameras, framing, turntables | sculpting (there is no useful headless sculpt mode) |
| PBR materials by nodes, colors, roughness/metallic | complex node graphs "first time" |
| import/export, format conversion, batch | character rigging and weight painting |
| procedural geometry by code (arrays, boolean, curves) | clean topology for deformation |
| renders, sequences, passes | judging on its own whether it "looks good" |

Spatial reasoning is approximate: the first placement almost always ends up needing correction.
That is why the verification loop is not optional — it is the mechanism that compensates for it.

## Anti-patterns

| Wrong | Correct |
|---|---|
| Declaring it done because the script ran without error | `Read()` the render and compare |
| Iterating framing in Cycles | EEVEE 480p to iterate, Cycles only for delivery |
| Editing the `.blend` by hand mid-flight | Fix the script and re-run from scratch |
| `blender` on the PATH | Full path to the binary; confirm it exists |
| Copying bpy snippets from 3.x tutorials | Confirm the version + `reference/blender-api-5x.md` |
| Building a scene without clearing the startup one | `clear_scene()` first — the cube covers everything |
| Overwriting a `.blend`/render the user has already approved | `test -f` first; if it exists, versioned sibling name |

## Next step (chain)

- Geometry/IO requested → `blender-scripting`.
- Once there is geometry → `blender-render` (preview and delivery).
- Render delivered and the user wants to judge the visual result → `design-review`.

---
name: blender-scripting
description: "Escrever e correr scripts bpy headless: construir cenas, transformar objectos, modificadores, importar/exportar 3D, batch de .blend, hierarquia e custom properties. MUST be invoked when the user says: bpy, script blender, automatizar blender, batch blend, importar modelo, exportar modelo, converter 3d, glb, gltf, fbx, obj, stl, usd. SHOULD also invoke when: geometria por codigo, modificador, boolean, array, mirror, subdivision, renomear objectos em massa, limpar cena, hierarquia 3d."
triggers: bpy, script blender, blender python, automatizar blender, headless blender, batch blend, importar modelo 3d, exportar modelo 3d, converter 3d, glb, gltf, fbx, obj, stl, usd, alembic, modificador, modifier, boolean, array modifier, mirror, subdivision surface, solidify, bevel, limpar cena, clear scene, renomear objectos, hierarquia 3d, parent, collection, custom property, mathutils, geometry nodes
chain: blender-render
---

# Blender Scripting — bpy headless

Construir e manipular cenas por código. Sem GUI, sem cliques, reprodutível.

Entrada e contrato de execução: skill `blender` (binário, verificação de versão, loop de verificação).
Deltas de API entre versões: `Read(".claude/reference/blender-api-5x.md")`.

## Os três namespaces

```python
import bpy

bpy.data      # os dados do ficheiro — acesso directo, rápido, sem contexto. PREFERIR.
bpy.context   # estado actual — objecto activo, selecção, cena
bpy.ops       # operadores (o que um clique faz) — precisam de contexto correcto, mais frágeis
```

**Regra:** `bpy.data` para ler e escrever propriedades; `bpy.ops` só quando não há equivalente
(adicionar primitivas, aplicar modificadores, import/export). Um `bpy.ops` com o objecto errado
activo falha em silêncio ou age no objecto errado — o erro mais comum em scripts headless.

```python
# Antes de qualquer bpy.ops que dependa de selecção:
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
```

## Limpar a cena — sempre, antes de construir

O ficheiro de arranque **já tem** Cube + Camera + Light. Não os apagar é a causa nº1 de renders
"vazios" ou tapados: o cubo por omissão fica na origem, exactamente onde tu pões o teu objecto.

```python
import bpy

def clear_scene():
    """Cena vazia + dados órfãos removidos."""
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
    s.unit_settings.scale_length = scale   # 1 unidade Blender = 1 metro
```

## Criar e transformar

```python
import bpy, math
from mathutils import Vector, Euler, Matrix

bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
obj = bpy.context.active_object
obj.name = "SM_Caixa"

obj.location       = (3, 0, 1)
obj.rotation_euler = (0, 0, math.radians(45))    # RADIANOS, sempre
obj.scale          = (1, 2, 0.5)

# Aplicar transformações (congelar no mesh) — necessário antes de exportar para engine
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Origem para a base (pivot no chão) — o que engines esperam em props
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
obj.location.z += obj.dimensions.z / 2

# Hierarquia sem mexer na posição visual
child.parent = parent
child.matrix_parent_inverse = parent.matrix_world.inverted()
```

Primitivas: `primitive_cube_add` · `_uv_sphere_add` · `_ico_sphere_add` · `_cylinder_add` ·
`_cone_add` · `_torus_add` · `_plane_add` · `_grid_add` · `_monkey_add`.

## Modificadores — não destrutivos até se aplicarem

```python
m = obj.modifiers.new(name="Bevel", type='BEVEL')
m.width, m.segments, m.limit_method = 0.02, 2, 'ANGLE'
m.angle_limit = math.radians(30)

arr = obj.modifiers.new(name="Array", type='ARRAY')
arr.count, arr.relative_offset_displace = 5, (1.1, 0, 0)

boo = obj.modifiers.new(name="Cut", type='BOOLEAN')
boo.operation, boo.object, boo.solver = 'DIFFERENCE', cutter, 'EXACT'

# Aplicar (precisa do objecto activo)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="Bevel")
```

**Ordem importa:** a stack corre de cima para baixo. `Mirror → Array → Bevel → Subdivision` produz
resultado diferente de `Bevel → Mirror`. Bevel depois de Subdivision quase nunca é o que se quer.

Tipos úteis: `MIRROR` `ARRAY` `BEVEL` `SUBSURF` `SOLIDIFY` `BOOLEAN` `DECIMATE` `WELD` `REMESH`
`SCREW` `CURVE` `SHRINKWRAP` `NODES` (geometry nodes).

## Import / export

Os nomes dos operadores **mudaram entre versões** — os do glTF e FBX não vivem no mesmo sítio dos
outros. Verificados em Blender 5.1:

| Formato | Import | Export |
|---|---|---|
| OBJ | `bpy.ops.wm.obj_import` | `bpy.ops.wm.obj_export` |
| STL | `bpy.ops.wm.stl_import` | `bpy.ops.wm.stl_export` |
| PLY | `bpy.ops.wm.ply_import` | `bpy.ops.wm.ply_export` |
| USD | `bpy.ops.wm.usd_import` | `bpy.ops.wm.usd_export` |
| Alembic | `bpy.ops.wm.alembic_import` | `bpy.ops.wm.alembic_export` |
| FBX | `bpy.ops.wm.fbx_import` **ou** `bpy.ops.import_scene.fbx` | `bpy.ops.export_scene.fbx` |
| glTF/GLB | `bpy.ops.import_scene.gltf` | `bpy.ops.export_scene.gltf` |

Confirmar na versão em uso antes de assumir:
```python
print([o for o in dir(bpy.ops.wm) if 'import' in o or 'export' in o])
print(dir(bpy.ops.import_scene), dir(bpy.ops.export_scene))
```

### Eixos por destino — o erro que só se vê no engine

Blender é **Z-up**. Quase tudo o resto é **Y-up**. Exportar sem converter dá o modelo deitado, e
isso não aparece em nenhum log.

```python
# glTF/GLB — web, three.js, Godot. O exportador converte Y-up sozinho.
bpy.ops.export_scene.gltf(
    filepath="/out/asset.glb", export_format='GLB',
    use_selection=True, export_apply=True,          # aplica modificadores
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

Verificar re-importando o ficheiro exportado numa cena limpa e renderizando — não pelo tamanho do
ficheiro em disco.

## Batch de .blend

```python
import bpy, glob, os

for filepath in sorted(glob.glob("/projectos/**/*.blend", recursive=True)):
    bpy.ops.wm.open_mainfile(filepath=filepath)
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            print(f"{os.path.basename(filepath)}: {obj.name} — {len(obj.data.polygons)} faces")
    out = filepath.replace(".blend", "_processado.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out)
```

**Nunca sobrescrever o original** sem o utilizador pedir substituição explícita — `open_mainfile`
seguido de `save_mainfile` é destrutivo e não tem undo fora da GUI. Escrever para nome irmão.

## Args de linha de comandos

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

## Inspeccionar antes de agir

Sobre um `.blend` que não construíste, ler primeiro:

```python
import bpy
print(f"objects={len(bpy.data.objects)} meshes={len(bpy.data.meshes)} mats={len(bpy.data.materials)}")
print(f"tris={sum(len(m.loop_triangles) for m in bpy.data.meshes)}")
for o in bpy.data.objects:
    extra = f" — {len(o.data.vertices)}v" if o.type == 'MESH' else ""
    print(f"  {o.name} ({o.type}) loc={tuple(round(c, 3) for c in o.location)}{extra}")
```
(`loop_triangles` precisa de `mesh.calc_loop_triangles()` antes, se o mesh não foi avaliado.)

## Gotchas medidos

| Sintoma | Causa | Fix |
|---|---|---|
| Render mostra um cubo que não criaste | cena de arranque não limpa | `clear_scene()` primeiro |
| `bpy.ops` age no objecto errado | objecto activo/selecção errados | `select_all(DESELECT)` + `select_set` + `objects.active` |
| Rotação absurda | graus passados onde se esperam radianos | `math.radians()` |
| Objecto some no engine | escala/rotação não aplicadas | `transform_apply(rotation=True, scale=True)` |
| Modelo deitado no engine | Z-up vs Y-up | flags de eixo no exportador; verificar re-importando |
| Modificadores não aparecem no export | `export_apply` a `False` | ligar, ou aplicar antes |
| Memória a crescer no batch | datablocks órfãos acumulam | remover órfãos por iteração |
| `print()` não aparece | GUI em vez de `-b` | correr com `--background` |

## Próximo passo (chain)

- Geometria pronta → `blender-render` (câmara, luz, material, preview).
- Sempre, antes de dar por feito → loop de verificação da skill `blender`: renderizar e **olhar**.

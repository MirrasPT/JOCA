# Blender — scripting bpy (referência do `blender`)

> Movido de `skills/blender-scripting.md` (F4.2). Contrato de execução, namespaces, `clear_scene()`, args
> de linha de comandos e loop de verificação ficam no núcleo `skills/blender.md`.
> Deltas de API entre versões: `blender-api-5x` (router do núcleo).

## Índice
- [Criar e transformar](#criar-e-transformar)
- [Modificadores](#modificadores--não-destrutivos-até-se-aplicarem) — inclui ⚠ encaixe em malha sobreposta → camada 2D + gate por raios
- [Import / export](#import--export) · [Eixos por destino](#eixos-por-destino--o-erro-que-só-se-vê-no-engine)
- [SVG → 3D](#svg--3d) — even-odd vs nonzero, cortador não-manifold, STL
- [Batch de .blend](#batch-de-blend) · [Juntar cenas](#juntar-cenas-a-partir-de-blend-guardados)
- [Booleana UNION com paredes coplanares](#booleana-union-com-paredes-coplanares)
- [Inspeccionar antes de agir](#inspeccionar-antes-de-agir)
- [Medir malha sem se enganar](#medir-malha-sem-se-enganar) — volume com sinal, gate de fabrico
- [Gotchas medidos](#gotchas-medidos)
- [Peça em camadas/relevo](#peça-em-camadasrelevo--a-silhueta-não-vê-profundidade)

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

⚠ **Rebaixo/encaixe com `DIFFERENCE` sobre forma feita de partes sobrepostas (malha não-manifold)
falha em silêncio** — deu encaixes tapados em 5 peças (projecto de cliente, 2026-09-22), sem erro e com volume
plausível. Nunca confiar no volume da booleana: fazer o encaixe por **camada 2D** (raster → traçar com
vtracer → importar o SVG → extrudir; ver §«SVG → 3D») e provar com **gate por raios** — `ray_cast`
vertical sobre o encaixe: o 1.º impacto tem de estar no **fundo do encaixe**, não no topo da peça.

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

## SVG → 3D

O importador de SVG do Blender preenche as curvas por **even-odd**. Os SVG de marca escrevem `fill`
sem `fill-rule`, e o default de SVG é **nonzero**. Contornos que se auto-intersectam desenham-se bem
no browser e **cancelam-se** no Blender (num lockup real: 12 dos 50 contornos).

Dois sintomas — e o pior é o silencioso:

| Sintoma | O que é |
|---|---|
| Glifo perde um traço | visível a olho; ainda se apanha no preview |
| Malha com centenas de vértices soltos | cortador **não-manifold** → o solver `EXACT`/`MANIFOLD` devolve a peça **INTACTA, sem erro nenhum**, e a booleana simplesmente **não corta** |

**Se uma booleana não corta e não dá erro, a hipótese nº1 é cortador não-manifold — verificar isso
primeiro, antes de mexer em profundidade/posição/solver do corte.** Diagnosticar de raiz pelo valor
do corte custou ~1 h.

```python
# cortador saudável? vértices soltos (0 arestas) e non-manifold
import bmesh
bm = bmesh.new(); bm.from_mesh(cutter.data)
soltos = [v for v in bm.verts if not v.link_edges]
nm     = [e for e in bm.edges if not e.is_manifold]
print(f"soltos={len(soltos)} non_manifold_edges={len(nm)} vol={bm.calc_volume():.4f}")
```

**Solução:** re-preencher os contornos com **winding não-zero** — varrimento por bandas, **glifo a
glifo** (não a arte toda de uma vez: cada glifo tem o seu conjunto de contornos e o winding só faz
sentido dentro dele). Implementação de referência (stdlib apenas, corre dentro do Python do
Blender): `<PROJECTO>/scripts/preencher_contornos.py` — **referência
externa, pode não existir nesta máquina**; ler se existir, não copiar para o projecto.

**Exportação: a via fiável é STL.** O addon `bl_ext.blender_org.ThreeMF_io` aparece em
`addon_utils.modules()` no Blender 5.1 mas **não regista operador nenhum** (nem
`bpy.ops.export_mesh.*` nem `bpy.ops.wm.*`), e o `addon_utils.enable()` explícito não resolve. Usar
`bpy.ops.wm.stl_export`.

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

### Juntar cenas a partir de `.blend` guardados

Quatro armadilhas seguidas numa montagem, **todas com render preto e gates verdes** (projecto de cliente, 2026-08-28):
- **Filtrar objectos por nome.** Um `.blend` traz o que a construção deixou — naquele caso 42 malhas de **cache** que não eram a peça. Nunca `append` de tudo.
- **Confirmar a convenção de eixos do ficheiro de origem** — as peças estavam em alçado e precisavam de +90° em X; a linha estava escrita e comentada no ficheiro vizinho. Ler o script que gerou o `.blend` antes de rodar à mão.
- **`bpy.context.view_layer.update()` ANTES de qualquer leitura de `matrix_world`** — sem isso a matriz é a da última avaliação. Mordeu 3× na mesma cena: posição, bbox pós-remalha, e câmara com `TRACK_TO` por avaliar.
- `clip_end` da câmara abaixo da distância à peça → render preto sem erro.

## Booleana UNION com paredes coplanares

O solver exacto **falha em silêncio** quando as peças se sobrepõem com paredes coplanares: um bloco saiu com **0,44 cm³ (de 42,8) e 1002 arestas não-manifold**, sem erro nenhum (projecto de cliente, 2026-09-09). O gate é volume com sinal + non-manifold (secção «Medir malha»), nunca a ausência de erro.

Caminho que funcionou:
1. **Fatiar com folga** (0,25 mm) em vez de unir faces coincidentes.
2. **Costurar os anéis de corte com `bmesh.ops.bridge_loops`** — não exige anéis com o mesmo nº de vértices (verificado 2026-09-15, 5.1.1: anel de 8 + anel de 12 → 20 faces, sem erro).
3. Diagnóstico barato antes de soldar: comparar a contagem de vértices dos anéis de corte.

```python
import bmesh
Z0, Z1 = 0.5, 0.75   # alturas dos dois anéis de corte (a folga fica entre eles)
bm = bmesh.new(); bm.from_mesh(obj.data)                 # obj = as duas fatias já juntas (object.join)
aneis = [e for e in bm.edges if e.is_boundary            # só os anéis que se enfrentam — não todas as bordas abertas
         and all(abs(v.co.z - Z0) < 1e-4 or abs(v.co.z - Z1) < 1e-4 for v in e.verts)]
bmesh.ops.bridge_loops(bm, edges=aneis)
bm.to_mesh(obj.data); bm.free()
```
(Testado 2026-09-15, 5.1.1: cilindro aberto de 8 + de 12 → 20 arestas de anel costuradas; as bordas das pontas ficam.)

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

## Medir malha sem se enganar

Verificações geométricas por **bounding box** dão falso positivo em peças rodadas. Com tudo
inclinado 15°, uma chapa de **espessura nula** tem bbox com as **três** dimensões > 0, e um teste de
interpenetração grita "atravessam-se" para peças que apenas encostam. Só o **volume** distingue as
duas coisas.

```python
import bmesh

def volume(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    v = bm.calc_volume(signed=True); bm.free()
    return v            # chapa de espessura nula → ~0, mesmo rodada 15°; NUNCA abs(v)
```

⚠ **Volume COM sinal, sempre — `signed=False` e `abs()` escondem normais viradas.** Esta receita
usava `signed=False`. Numa peça com cavidades internas o volume com sinal deu **43,48 cm³ em vez de
42,21** — a diferença era exactamente o dobro do volume das cavidades, que tinham ficado a contar como
material; sem sinal o erro não aparecia (projecto de cliente, 2026-09-09). O ficheiro já tinha sido
entregue ao slicer.

- **Nunca `bmesh.ops.recalc_face_normals` numa malha com vazios internos.** Vira as normais das
  cavidades para fora e o slicer lê-as como maciço.
- **Gate de exportação para fabrico:** `calc_volume(signed=True)` contra o valor calculado à mão
  (volume exterior − cavidades) · arestas não-manifold `== 0` · bounding box · e reler o ficheiro **no
  formato final**, não o `.blend`. Volume negativo = normais invertidas na malha toda.

Mesma classe de erro na medição do **passo de uma grelha**: usar o **mínimo** dos intervalos entre
coordenadas dá lixo — os cantos arredondados dos finders de um QR produziram intervalos minúsculos e
o passo saiu *"660×660 módulos a 0,067 mm"*. A **moda** (valor mais frequente, arredondado) é que é
robusta.

```python
from collections import Counter
passos = [round(b - a, 3) for a, b in zip(xs, xs[1:]) if b - a > 1e-6]
passo  = Counter(passos).most_common(1)[0][0]     # MODA, não min()
```

**Métrica agregada esconde falhas que se cancelam.** Ao confirmar que um corte booleano tinha
coberto 38 letras, o **volume total** bateu a **100,0 %** — e faltava uma letra: duas cópias
sobrepostas do "L" somavam exactamente o volume da que faltava. Só a intersecção **peça-a-peça**
revelou os 10,7 mm³ em falta. Verificar N coisas = medir as N, uma a uma.

> **Regra geral: medir a invariante, não o proxy.** Volume > bounding box. Moda > mínimo.
> Peça-a-peça > total.

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
| `DeprecationWarning: 'Material.use_nodes' is expected to be removed in Blender 6.0` | `m.use_nodes = True` (via antiga) — em 5.1.1 `materials.new()` já vem com `use_nodes=True` e `node_tree` | não escrever `use_nodes`; usar `m.node_tree` directamente (medido 2026-09-15). Detalhe: `blender-api-5x` (router do núcleo) |
| Letras renderizam como tubos · peça cinzenta sem erro | malha de curva/texto com `use_smooth` · slot de material vazio no índice 0 | ver `blender-api-5x` §Valores por omissão (router do núcleo) |

## Peça em camadas/relevo — a silhueta não vê profundidade

Um gate de silhueta (IoU, mapa de classes, contagem de pixéis) **não vê a ordem das bandas**. Mordeu 2× em 2 peças (projecto de cliente, 2026-08-28): uma espiga com a silhueta certa fazia um degrau de 7,5 mm; um laço batia a referência **ao pixel** (`y=590`: ref `458..648`, nosso `458..648`) e lia-se como um buraco na barriga, por estar na banda errada.
- Além da silhueta, **verificar a ORDEM DAS BANDAS** de cada elemento contra a referência (que banda está à frente de qual).
- **Olhar o render em luz real, com sombra** — o mapa chapado remove exactamente a pista que falta.

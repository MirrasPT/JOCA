---
name: blender-render
description: "Renderizar em Blender por código: engine (Cycles/EEVEE), camara, luzes, materiais PBR, output, animacao e sequencias. MUST be invoked when the user says: render 3d, renderizar, cycles, eevee, turntable, product shot 3d, material pbr, iluminar cena 3d, camara 3d, animacao 3d. SHOULD also invoke when: render transparente, passes, denoise, samples, hdri, depth of field, sequencia de frames, mp4 a partir de blender."
triggers: render 3d, renderizar, cycles, eevee, turntable, product shot, material pbr, shader blender, iluminar cena, three point lighting, hdri, world background, camara 3d, focal length, depth of field, dof, samples, denoise, denoiser, render transparente, film transparent, render passes, exr, sequencia de frames, animacao 3d, keyframe, mp4 blender, agx, view transform, metal gpu, render gpu
chain: design-review
---

# Blender Render — câmara, luz, material, output

Produzir imagens e sequências por código. Valores verificados em **Blender 5.1.1 / Apple M4 Pro**;
noutra versão, confirmar com `Read(".claude/reference/blender-api-5x.md")`.

## Engine

```python
import bpy
sc = bpy.context.scene

# EEVEE — rasterizador. Segundos por frame. Usar para ITERAR.
sc.render.engine = 'BLENDER_EEVEE'        # ⚠ 5.x. Em 4.2–4.5 é 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 64

# Cycles — path tracing. Usar para ENTREGAR.
sc.render.engine = 'CYCLES'
sc.cycles.samples = 128
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.01
```

Enum de engines em 5.1: `('BLENDER_EEVEE', 'BLENDER_WORKBENCH', 'CYCLES')` — **`BLENDER_EEVEE_NEXT`
não existe** e atribuí-lo levanta `TypeError`. É o erro que a maioria dos exemplos públicos de bpy
traz, porque foram escritos para 4.2.

### GPU — Apple Silicon (Metal)

```python
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'        # NVIDIA: 'OPTIX' (>'CUDA') · AMD: 'HIP' · Intel: 'ONEAPI'
prefs.get_devices()
for d in prefs.devices:
    d.use = True                            # ou só os que d.type == 'METAL'
sc.cycles.device = 'GPU'
```

Verificado nesta máquina: `prefs.devices` devolve `Apple M4 Pro (CPU)` e
`Apple M4 Pro (GPU - 20 cores) (METAL)`.

⚠ **O primeiro render Cycles GPU paga compilação de kernels** — medido, ~90 s para 320×240 @16
samples num processo novo. Não é a cena a ser pesada. Consequências: não estimar tempo total a
partir do primeiro frame, e num batch renderizar tudo **no mesmo processo Blender** em vez de um
processo por frame.

## Output

```python
r = sc.render
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
r.image_settings.file_format = 'PNG'        # PNG · JPEG · OPEN_EXR · OPEN_EXR_MULTILAYER · TIFF · WEBP
r.image_settings.color_mode  = 'RGBA'       # 'RGBA' exige film_transparent para ter alfa útil
r.image_settings.compression = 15
r.film_transparent = True                   # fundo transparente

sc.view_settings.view_transform = 'AgX'     # 5.1: 'Standard' · 'AgX' · 'Filmic' · 'Khronos PBR Neutral'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0

r.filepath = "/out/render_"                 # still: sai "/out/render_.png"
bpy.ops.render.render(write_still=True)
```

### Render region — ligar por omissão em cenas com câmara

```python
r.use_border = True
r.border_min_x, r.border_min_y = 0.0, 0.0
r.border_max_x, r.border_max_y = 1.0, 1.0
r.use_crop_to_border = False      # True corta a imagem final ao tamanho da região
```

Sem isto, o viewport Rendered calcula também a zona cinzenta fora do passepartout — GPU gasta em
pixels que ninguém vê. Com os limites a 0–1 o enquadramento não muda; só se deixa de renderizar
fora da câmara.

Equivale a **Ctrl+B** em vista de câmara. Duas propriedades distintas, e a descrição da API é que
as separa:

| Contexto | Propriedade | Alcance |
|---|---|---|
| pela câmara (Numpad 0) | `scene.render.use_border` | viewport Rendered **e** render final |
| fora da câmara | `space.use_render_border` | só o viewport — *"when not viewing through the camera"* |

É **por cena**, guardado no `.blend` — não é preferência global, cada ficheiro novo nasce sem ela.
Por isso vai no script.

`Standard` para composição/UI onde as cores têm de sair como foram definidas; `AgX` para imagem
fotográfica (comprime highlights, dessatura no clipping); **`Khronos PBR Neutral` para produto/
e-commerce** — preserva a cor do material sem a lavagem do AgX. Entregar um swatch de cor de marca
em AgX devolve a cor errada.

⚠ **`sc.cycles.samples` vem a 4096 por omissão na 5.1.** Não o baixar explicitamente é a diferença
entre 30 s e uma hora por frame — e o script não avisa.

## Câmara

```python
import math
from mathutils import Vector

bpy.ops.object.camera_add(location=(7, -6, 5))
cam = bpy.context.active_object
sc.camera = cam

cam.data.lens = 50            # mm. 35 = amplo · 50 = neutro · 85+ = comprime, favorece produto
cam.data.sensor_width = 36
cam.data.clip_start, cam.data.clip_end = 0.1, 1000

# Apontar a um ponto (uma vez)
direction = Vector((0, 0, 1)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# Ou seguir um objecto (mantém-se apontada se algo se mexer) — preferir em animação
track = cam.constraints.new(type='TRACK_TO')
track.target, track.track_axis, track.up_axis = alvo, 'TRACK_NEGATIVE_Z', 'UP_Y'
# ⚠ up_axis='UP_Z' numa câmara é DEGENERADO: medido, a matriz fica em euler [0,0,0] — a câmara
# não aponta a nada e olha a direito para baixo. Para câmaras é sempre 'UP_Y'.
# Verificado equivalente ao quaternion directo: ambos dão euler [72.6, 0, 45] (Y=0 → sem roll).

# Profundidade de campo
cam.data.dof.use_dof = True
cam.data.dof.focus_object = alvo
cam.data.dof.aperture_fstop = 2.8
```

Enquadrar tudo o que existe sem adivinhar posições:
```python
bpy.ops.object.select_all(action='SELECT')
bpy.ops.view3d.camera_to_view_selected()   # precisa de contexto 3D; em headless, calcular a bbox
```
Em `-b` não há área 3D — calcular à mão a partir das `bound_box` dos objectos e recuar a câmara pela
diagonal da bounding box a dividir por `2*tan(fov/2)`, com margem de ~15%.

## Luz

```python
bpy.ops.object.light_add(type='AREA', location=(3, -3, 4))
key = bpy.context.active_object.data
key.energy = 500          # WATTS em AREA/POINT/SPOT — números grandes são normais
key.size = 2.0            # maior = sombra mais suave

bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
sun = bpy.context.active_object.data
sun.energy = 3            # SUN é irradiância, não watts — 1–5 é a gama útil
sun.angle = math.radians(0.526)   # disco solar; maior = sombra mais suave
```

Three-point de partida (produto/prop, objecto na origem, ~1 m):
`key` AREA 500 W a 45° à frente-esquerda · `fill` AREA 150 W do lado oposto, mais afastada ·
`rim` AREA 300 W atrás e acima, a separar do fundo.

### World / HDRI

```python
world = bpy.data.worlds['World'] if 'World' in bpy.data.worlds else bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.05, 0.05, 0.06, 1)
bg.inputs['Strength'].default_value = 1.0

# HDRI a partir de ficheiro
env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load("/path/studio.hdr")
world.node_tree.links.new(env.outputs['Color'], bg.inputs['Color'])
```

Sem HDRI e sem luz, o Cycles devolve preto — não é bug.

## Material PBR

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

Nomes de sockets do Principled **mudaram na 4.0** (`Specular`→`Specular IOR Level`,
`Emission`→`Emission Color`+`Emission Strength`, `Subsurface`→`Subsurface Weight`). Não confiar de
memória — listar antes de escrever:
```python
print([s.name for s in mat.node_tree.nodes["Principled BSDF"].inputs])
```

Emissivo (luz vinda do próprio objecto):
```python
b.inputs["Emission Color"].default_value = (1, 0.6, 0.2, 1)
b.inputs["Emission Strength"].default_value = 5.0
```
Não pôr emissão num material partilhado por várias peças — acende tudo o que o usa.

## Animação e sequências

```python
sc.frame_start, sc.frame_end, sc.render.fps = 1, 120, 24

obj.location = (0, 0, 0);  obj.keyframe_insert("location", frame=1)
obj.location = (0, 0, 3);  obj.keyframe_insert("location", frame=60)

for fc in obj.animation_data.action.fcurves:      # interpolação
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'; kp.easing = 'EASE_IN_OUT'

r.filepath = "/out/frames/f_"       # sequência: f_0001.png …
bpy.ops.render.render(animation=True)
```

**Renderizar sempre para sequência de PNG/EXR, não para vídeo directo.** Um crash a 80% de um MP4
perde tudo; com frames, retoma-se. Montar depois com ffmpeg:

```bash
ffmpeg -framerate 24 -i /out/frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 /out/video.mp4
# com alfa (ProRes 4444):
ffmpeg -framerate 24 -i /out/frames/f_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le /out/video.mov
```

Turntable — rodar a **câmara**, não o objecto (o objecto a rodar arrasta sombras e reflexos):
```python
bpy.ops.object.empty_add(location=(0, 0, 0.5))
pivot = bpy.context.active_object
cam.parent = pivot
pivot.rotation_euler.z = 0;                 pivot.keyframe_insert("rotation_euler", frame=1)
pivot.rotation_euler.z = math.radians(360); pivot.keyframe_insert("rotation_euler", frame=121)
for fc in pivot.animation_data.action.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'         # senão a volta acelera e trava — não faz loop
```

## Passes (composição posterior)

```python
vl = sc.view_layers[0]
vl.use_pass_combined = vl.use_pass_z = vl.use_pass_normal = True
vl.use_pass_diffuse_color = vl.use_pass_ambient_occlusion = True
vl.use_pass_cryptomatte_object = True            # máscaras por objecto — vive no VIEW LAYER,
vl.use_pass_cryptomatte_material = True          # não em sc.cycles (erro comum)
r.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
r.image_settings.color_depth = '32'
```

## Orçamento de tempo

| Fim | Engine | Samples | Resolução |
|---|---|---|---|
| iterar enquadramento/composição | EEVEE | 16–32 | 480–720p |
| preview para mostrar | EEVEE | 64 | 1080p |
| entrega still | Cycles | 128–256 + denoise | 1080p–4K |
| entrega animação | Cycles | 64–128 + denoise | 1080p |

Passar de 256 samples com denoise ligado raramente muda o que se vê — custa tempo, não qualidade.

## Gotchas medidos

| Sintoma | Causa | Fix |
|---|---|---|
| `TypeError: enum "BLENDER_EEVEE_NEXT" not found` | exemplo escrito para 4.2 | `'BLENDER_EEVEE'` na 5.x |
| Primeiro frame demora ~90 s sem motivo | compilação de kernels Metal | normal; renderizar tudo no mesmo processo |
| Render preto | sem luz e sem world | adicionar luz ou HDRI |
| Alfa não aparece no PNG | falta `film_transparent` | `r.film_transparent = True` + `RGBA` |
| Cor de marca sai errada | `view_transform='AgX'` | `'Standard'` para cor exacta |
| `KeyError` num input do Principled | nomes mudaram na 4.0 | listar `inputs` antes de escrever |
| Turntable com solavanco no loop | interpolação Bézier | `LINEAR` nas keyframes de rotação |
| MP4 perdido a meio do render | render directo para vídeo | frames + ffmpeg |

## Próximo passo (chain)

- Render entregue e há julgamento visual a fazer → `design-review`.
- O render não bate com o pedido → voltar ao loop de verificação da skill `blender` (máx. 3 voltas).

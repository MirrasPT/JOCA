# Blender bpy — deltas de API e factos medidos

Referência on-demand. `Read()` quando um snippet de bpy falhar, quando a versão alvo não for a
medida aqui, ou antes de copiar exemplos de tutoriais e repos públicos.

**Medido em Blender 5.1.1 (build 2026-04-14), macOS / Apple M4 Pro, headless (`-b`).** Tudo o que
está aqui foi obtido a correr, não da documentação nem de memória.

---

## Porquê este ficheiro existe

Praticamente todo o material público de bpy — incluindo packs de skills de Blender para agentes —
foi escrito para 3.x/4.2 e **não corre na 5.x sem edição**. Os erros não são subtis: levantam
`TypeError`/`KeyError` à primeira linha, ou pior, correm e produzem a coisa errada em silêncio.

Auditados: `arjun988/blender-skills` (94 skills), `Andrew1326/dominations` (5), `kevinbadi/blender-skills`
(16), `Dev-GOM/blender-toolkit`. Todos partem em pelo menos um dos pontos abaixo.

---

## Deltas que partem código

| Escrito nos exemplos públicos | Blender 5.1 | Efeito |
|---|---|---|
| `engine = 'BLENDER_EEVEE_NEXT'` | `'BLENDER_EEVEE'` | `TypeError: enum não encontrado` |
| `compute_device_type = 'CUDA'` em Mac | `'METAL'` | sem GPU, cai para CPU |
| `inputs["Specular"]` | `inputs["Specular IOR Level"]` | `KeyError` |
| `inputs["Emission"]` | `inputs["Emission Color"]` + `["Emission Strength"]` | `KeyError` |
| `inputs["Subsurface"]` | `inputs["Subsurface Weight"]` | `KeyError` |
| `inputs["Clearcoat"]` | `inputs["Coat Weight"]` | `KeyError` |
| `inputs["Sheen"]` | `inputs["Sheen Weight"]` | `KeyError` |
| `sc.cycles.use_pass_crypto_object` | `view_layer.use_pass_cryptomatte_object` | atributo não existe |
| `bpy.ops.export_scene.obj` | `bpy.ops.wm.obj_export` | operador não existe |
| `bpy.ops.import_mesh.stl` | `bpy.ops.wm.stl_import` | operador não existe |

Enum de engines completo em 5.1: `('BLENDER_EEVEE', 'BLENDER_WORKBENCH', 'CYCLES')`.

## Valores por omissão que custam caro

| Propriedade | Default 5.1 | Porquê importa |
|---|---|---|
| `sc.cycles.samples` | **4096** | não baixar = frames de uma hora; nada avisa |
| cena de arranque | Cube + Camera + Light | o cubo tapa o que criares na origem |
| `sc.cycles.device` | `'CPU'` | pôr GPU não chega — é preciso `compute_device_type` + `get_devices()` |
| `r.film_transparent` | `False` | `RGBA` sem isto dá alfa opaco |

## Operadores de import/export (5.1, verificado por `dir()`)

`bpy.ops.wm.*`: `obj_import` `obj_export` `stl_import` `stl_export` `ply_import` `ply_export`
`usd_import` `usd_export` `alembic_import` `alembic_export` `fbx_import` `collection_export_all`
`grease_pencil_import_svg` `grease_pencil_export_svg` `grease_pencil_export_pdf` `drop_import_file`

`bpy.ops.import_scene.*`: `fbx` `gltf` — `bpy.ops.export_scene.*`: `fbx` `gltf`

FBX tem duas entradas na 5.1 (`wm.fbx_import` novo, `import_scene.fbx` legado). Export de FBX
continua só em `export_scene`.

Comando para confirmar noutra versão:
```python
print(sorted(o for o in dir(bpy.ops.wm) if 'import' in o or 'export' in o))
print(sorted(dir(bpy.ops.import_scene)), sorted(dir(bpy.ops.export_scene)))
```

## Enums que não se lêem por introspecção

`view_transform`, `denoiser` e `compute_device_type` são preenchidos por callback em runtime.
`bl_rna.properties[...].enum_items` devolve **lista vazia ou `['NONE']`** — não é sinal de que a
opção não existe. Testar por atribuição dentro de `try/except`, não por introspecção.

Valores confirmados por atribuição em 5.1:
- `view_transform`: `Standard` · `AgX` · `Filmic` · `Khronos PBR Neutral`
- `denoiser`: `OPENIMAGEDENOISE` (aceite; `OPTIX` depende de hardware NVIDIA)
- `compute_device_type`: `METAL` neste hardware

## Apple Silicon — Metal

```
prefs.devices → [('Apple M4 Pro', 'CPU'), ('Apple M4 Pro (GPU - 20 cores)', 'METAL')]
```

**Compilação de kernels no primeiro render:** ~90 s medidos para 320×240 @16 samples num processo
Blender novo. É custo fixo por processo, não por frame. Implicações:
- não estimar o tempo total a partir do primeiro frame;
- num batch, renderizar tudo **dentro do mesmo processo** (`bpy.ops.render.render` em ciclo), nunca
  um `blender -b` por frame;
- um preview EEVEE não paga este custo — mais uma razão para iterar em EEVEE.

## Nomes do Principled BSDF em 5.1 (lista completa, verificada)

```
Base Color · Metallic · Roughness · IOR · Alpha · Normal · Weight · Diffuse Roughness
Subsurface Weight · Subsurface Radius · Subsurface Scale · Subsurface IOR · Subsurface Anisotropy
Specular IOR Level · Specular Tint · Anisotropic · Anisotropic Rotation · Tangent
Transmission Weight · Coat Weight · Coat Roughness · Coat IOR · Coat Tint · Coat Normal
Sheen Weight · Sheen Roughness · Sheen Tint · Emission Color · Emission Strength
Thin Film Thickness · Thin Film IOR
```

Noutra versão, imprimir em vez de assumir:
```python
print([s.name for s in mat.node_tree.nodes["Principled BSDF"].inputs])
```

## Formatos de output (5.1)

`AVIF` `JPEG` `OPEN_EXR` `PNG` `WEBP` `BMP` `CINEON` `DPX` `IRIS` `JPEG2000` `HDR` `TARGA`
`TARGA_RAW` `TIFF` `OPEN_EXR_MULTILAYER` `FFMPEG`

## Passes de view layer (5.1)

`combined` `z` `mist` `normal` `position` `vector` `uv` `object_index` `material_index` `shadow`
`ambient_occlusion` `emit` `environment` `grease_pencil` · `diffuse_{direct,indirect,color}` ·
`glossy_{direct,indirect,color}` · `transmission_{direct,indirect,color}` ·
`subsurface_{direct,indirect,color}` · `cryptomatte_{object,material,asset,accurate}`

Todos com prefixo `use_pass_`, todos em `scene.view_layers[i]`.

## Protocolo ao portar um snippet de terceiros

1. `blender --version` — comparar com a versão para que o snippet foi escrito.
2. Correr o snippet isolado com `-b` e ler o traceback **inteiro** (não `| head`).
3. `KeyError` num socket → imprimir `inputs`. `TypeError` num enum → a mensagem lista os válidos.
4. Operador em falta → `dir()` no namespace correspondente.
5. Correu sem erro ≠ correcto → renderizar e olhar (loop de verificação da skill `blender`).

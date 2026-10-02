---
origin: local
name: impressao-3d
description: "Levar uma peça de Blender até à impressora 3D local: exportar STL/3MF, injectar o perfil da impressora, fatiar por CLI (medido no AnycubicSlicerNext; o CLI do OrcaSlicer não fatia headless — medido) e provar o resultado no G-code. Cobre também editar um 3MF sem abrir o Blender (não tem importador nativo) e converter um vector 2D (SVG) numa peça imprimível. MUST be invoked when the user says: fatiar, slicer cli, gerar gcode, editar 3mf, anycubicslicernext, erro do slicer, erro da impressora, perfil da impressora, vector para peça 3d. SHOULD also invoke when: exportar para o slicer, ficheiro de impressão, chapa/plate do slicer, o slicer não fatia, juntar chapas num 3mf."
triggers: fatiar, slicer cli, gcode, g-code, editar 3mf, 3mf sem importador, anycubicslicernext, anycubic slicer, ficheiro para slicer, perfil da impressora, erro do slicer, erro da impressora, vector para peca 3d, svg para peca imprimivel, project_settings.config, model_settings.config, chapa do slicer, assemble_index, juntar chapas 3mf
chain: blender, meshy-3d-print, design-review, design-shotgun
---

# Impressão 3D — Blender → slicer → G-code

Ponte entre geometria (bpy) e peça física. Não é a Meshy (`meshy-3d-print`: malhas geradas por IA,
via MCP próprio) nem a modelação em si (`blender`) — é o troço final: exportar, fatiar por
linha de comandos, e entregar um ficheiro que a impressora aceita.

## Configuração local (antes do 1.º comando)

A impressora e o slicer são **da tua montagem** — confirmar, não assumir:
- **Slicer** (`<SLICER>`) e o caminho do binário/CLI; **perfil da impressora** (`<PERFIL>`) e o
  tamanho real da mesa (`<MESA_MM>`); bico e filamentos.
- Os factos abaixo foram **medidos com o AnycubicSlicerNext** (fork da família Bambu/Orca) numa
  impressora com mesa 260×260. Noutro slicer/impressora, os princípios (perfil dentro do 3MF, chaves
  em string, provar no G-code) mantêm-se; flags, marcadores e códigos de erro confirmam-se no `--help`
  e na doc do teu slicer.

## Pipeline

```
gerador paramétrico (bpy) → gates geométricos (manifold, volume com sinal)
  → STL/3MF → carregar no slicer → injectar perfil → --arrange → --slice → provar no G-code
```

⛔ **Passo que produz um entregável guarda-se como script no projecto, no próprio turno** —
classificação de cores, escrita do 3MF, injecção de perfil. Nunca inline «para a próxima»: na sessão
seguinte foi preciso reescrevê-los e o 1.º resultado saiu errado (o k-means trocou as cores).

Exportar geometria e gate de malha: `reference/blender-scripting.md` §«Medir malha» (STL é a via fiável — ver
«3MF sem importador» abaixo). Categoria de evidência «ficheiro para slicer/fabrico»:
`.claude/reference/gates-runtime.md`.

## O 3MF é um ZIP (pacote OPC), não um binário opaco

```bash
unzip -l ficheiro.3mf
```

| Dentro do pacote | Conteúdo |
|---|---|
| `3D/3dmodel.model` | malha (XML): `<object>` → `<component>`/`<mesh>`, transformações |
| `Metadata/project_settings.config` | perfil de impressão — **554 chaves, TODAS strings** |
| `Metadata/model_settings.config` | objectos, `assemble_index` (funde N malhas num objecto com N partes), posições |
| `Metadata/slice_info.config` | metadados da última fatia |
| `Metadata/custom_gcode_per_layer.xml` | trocas de filamento/pausas por camada (raiz `custom_gcodes_per_layer`) |

**O perfil viaja DENTRO do ficheiro** — mudar o default do slicer não altera um 3MF já gerado; tem de
se injectar o perfil primeiro. Ordem que funciona, medida num projecto real: **carregar → injectar perfil
→ `--arrange 1` → `--slice`**. Arranjar antes de injectar arruma a peça contra a mesa errada (mesa
200×200 por omissão vs 260×260 real → "não cabe" com 41% de ocupação real) ⏳(verificado 2026-08-21).

⚠ **Todas as chaves do `project_settings.config` são strings.** `"outer_wall_speed": 150` (int) em
vez de `"150"` é **descartado em silêncio**: fatia sem aviso, e o percurso sai com o default (medido:
pedido 150 mm/s → saiu 60; pedido `detect_thin_wall: 1` → chegou `0` ao G-code). `assert
isinstance(v, str)` em cada chave mudada, e verificar o efeito no **toolpath**, nunca no bloco de
config ⏳(verificado 2026-08-28).

⚠ **O marcador de feature deste slicer é `;TYPE:Ironing`, não `; FEATURE: Ironing`** (esse é o do
Bambu Studio puro) — um gate com o marcador errado dá sempre 0 e lê-se como "não aconteceu".

⚠ **Espaço de `object id` é GLOBAL no 3MF, não isolado por ficheiro/`p:path`.** Juntar objectos de
dois 3MF de origem que declaram o mesmo `id="1"` faz o slicer resolver `<component objectid>` pelo
primeiro que encontra — troca a peça errada em silêncio. Renumerar em TODO o lado (declaração e
referência) e o gate é a **unicidade dos ids**. A regex de edição não pode assumir a ordem dos
atributos: `objectid` nem sempre vem colado a `<component`.

⚠ **3MF herdado de outra impressora rejeita no firmware sem explicação legível.** Um projecto salvo
com perfil de máquina de outro fabricante (ex. Bambu X1 Carbon) traz comandos que a impressora local
não parseia (`M1006`/`M620`/`M1002`), e o erro do firmware costuma citar só o nome do `.gcode`. Ler o
ficheiro de origem (`unzip -l` + `Metadata/project_settings.config`) antes de diagnosticar pelo padrão
do sintoma. Vale também quando o ficheiro é só **citado** num erro, não entregue — procurá-lo no disco
primeiro.

## AnycubicSlicerNext CLI — 5 falhas silenciosas medidas, nenhuma devolve erro útil

| Falha | Sintoma | Contorno |
|---|---|---|
| STL pequeno sozinho | `run found error, exit`, nada escrito | correr com `--debug 3` para ver a causa real |
| 3MF com 3–4 objectos | não fatia, sem aviso | isolar objecto a objecto qual falha |
| `custom_gcode_per_layer.xml` injectado | aceite e guardado, mas **não entra no percurso** (0 trocas no G-code) | confirmar a troca lendo o G-code fatiado, nunca o ficheiro de entrada |
| `filament_max_volumetric_speed` por filamento | **ignorado** — o limite por filamento não chega ao percurso | provar pelas velocidades por ferramenta no G-code fatiado (2026-09-22) |
| `layer_config_ranges.xml` | só funciona com `object id` = **ordem do objecto** no 3MF, não o id do XML | numerar pela ordem e provar no G-code (altura de camada por objecto) (2026-09-22) |

⏳(verificado 2026-08-27)

**E é intermitente mesmo sem mudar nada:** o mesmo ficheiro dá `run found error, exit` numa corrida e
fatia normalmente na seguinte. Isto interage mal com qualquer gate que teste "o ficheiro existe" em
vez de "o resultado está correcto" — foi essa combinação que deixou passar uma peça fora da mesa sem
ninguém dar por isso. **Regra: apagar o destino ANTES de o produzir, e verificar a INVARIANTE do
resultado** (a peça cabe na mesa, tem N trocas nas camadas certas) — nunca a existência do ficheiro
⏳(verificado 2026-08-28).

⚠ **Abrir no GUI: uma instância só.** `open -a AnycubicSlicerNext <ficheiro>` com a app já aberta
lançou instâncias novas (3 ao mesmo tempo) e confundiu gravações e o CLI (2026-10-01). Antes de
`open -a`: `pgrep -f AnycubicSlicerNext.app`; havendo instância, abrir pelo menu **File** dela.

`--load-assemble-list` **SEGFALTA (exit 139)** mesmo no caso mínimo de 1 chapa com 1 objecto — não
usar para juntar chapas num 3MF; monta-se o XML à mão (secção seguinte).

## Editar 3MF sem o Blender — não há importador

O Blender 5.1.1 **não tem importador 3MF** (nem no core, nem como extensão — o
`bl_ext.blender_org.ThreeMF_io` aparece listado em `addon_utils.modules()` mas não regista operador
nenhum, nem com `addon_utils.enable()` explícito). A exportação fiável a partir do Blender é **STL**
(`bpy.ops.wm.stl_export`); para 3MF, monta-se o pacote directamente:

1. `unzip` o 3MF; editar o XML dentro (não o zip como binário).
2. Trocar uma malha: substituir o `<mesh>`/`<component>` do objecto em `3D/3dmodel.model`,
   preservando `project_settings.config` e `model_settings.config` intocados.
3. Remover um objecto: apagar em **quatro** sítios em sincronia — `<build>`, `<resources>`, o
   `.rels`, e a entrada em `model_settings.config`. Esquecer um deixa referência morta.
4. Montar N chapas: **um** `<object>` com N `<component>` (cada um com `objectid` próprio e
   `extruder`) e um só item no `<build>` — não N objectos separados (o slicer colapsa-os na mesma
   mesa em vez de os tratar como chapas distintas).
5. Zip de volta preservando a estrutura (`3D/`, `Metadata/`, `_rels/`, `[Content_Types].xml`).

Gate: reabrir e listar `unzip -l`, contar objectos/ids únicos, e confirmar no G-code fatiado (nº de
trocas de filamento nas camadas esperadas) — nunca só "o zip abriu sem erro".

## Vector 2D → peça imprimível (SVG → Blender → STL)

O importador de SVG do Blender preenche por **even-odd**; SVG de marca costuma sair sem
`fill-rule` (o default do formato SVG é **nonzero**). Contornos que se auto-intersectam desenham-se
bem no browser e **cancelam-se** no Blender: malha com centenas de vértices soltos, e uma booleana com
esse cortador **não corta e não dá erro nenhum** (o solver `EXACT`/`MANIFOLD` devolve a peça intacta).

**Se uma booleana não corta e não avisa, o suspeito nº1 é o cortador não-manifold** — verificar isso
antes de mexer em profundidade, posição ou solver do corte. Fix: re-preencher os contornos com winding
**não-zero**, **glifo a glifo** (cada glifo tem o seu conjunto de contornos; o winding só faz sentido
dentro dele). Detalhe e script de referência: `reference/blender-scripting.md` §«SVG → 3D».

Pipeline sem geometria de texto (ex. disco gravado a partir de um SVG plano): SVG → Blender → STL →
montar 3MF à mão (secção anterior) → provar no G-code. Não redesenhar geometria já impressa — extrair
a malha do 3MF anterior é mais seguro que recriar (um "equivalente" desenhado de novo muda a peça em
silêncio).

## Gate de runtime — ficheiro para slicer/fabrico

| Verificar | Como |
|---|---|
| Malha fechada | 0 arestas não-manifold |
| Volume correcto | `bm.calc_volume(signed=True)` contra o valor calculado à mão — **nunca `abs()`**: esconde cavidades com normais invertidas |
| Dimensões | bounding box em mm, ao centésimo |
| Formato final | reler o STL/3MF exportado, não o `.blend` |
| Perfil aplicado | ler o `project_settings.config` de dentro do 3MF entregue, não assumir o default — e, se o dono vai abrir no GUI, ver «GUI ≠ CLI» em `meshy-3d-print.md` §Gate de runtime |

⚠ **Detalhe abaixo do bico falhou na impressão → peça de teste antes de mexer em definições.** Depois da
1.ª falha com detalhe mais fino do que o bico, imprimir só a zona mais fina **a 3 escalas numa chapa**
(10–30 min) e decidir pela foto dessa chapa. Sem foto da peça falhada, **no máximo 1 iteração às cegas** —
depois pede-se a foto e espera-se (caso real: 6 versões de definições/redesenho/orientação sem ver a peça;
resolveu o teste de escalas).

## Gosto tipográfico (texto gravado ou em relevo) — opções visuais antes de mexer

«Não gosto da fonte» / «mais grosso» é ambíguo (qual fonte? que grosso?). Antes de alterar a peça: renderizar uma folha com ~9 fontes candidatas no texto real da peça → board de comparação (`design-shotgun.md` §«Board de comparação») → `AskUserQuestion` multi-escolha. Só depois se gera a geometria com a escolhida (2026-09-22).

## Anti-patterns

| Errado | Correcto |
|---|---|
| `--arrange` antes de injectar o perfil | perfil primeiro — senão arruma contra a mesa errada |
| Escrever `int` numa chave do `project_settings.config` | sempre string; verificar no toolpath |
| Ler "0 trocas"/"0 suportes" como confirmação | confirmar que o check estava LIGADO no perfil |
| Testar "o ficheiro existe" depois do CLI correr | testar a INVARIANTE do resultado; apagar o destino antes |
| `--load-assemble-list` para juntar chapas | segfalta sempre; montar o XML à mão |
| Diagnosticar erro de impressora pelo nome do ficheiro | abrir o 3MF (`unzip -l` + `project_settings.config`) primeiro |
| Refatiar ao ver o erro **10113** «Slicing file error, suggest re-slicing» | 10113 = falha do MD5 do ficheiro descarregado da nuvem → reenviar ou passar por USB, não refatiar (fonte: [wiki Anycubic](https://wiki.anycubic.com/en/error-codes/10113-code)) |
| Recriar geometria "equivalente" já impressa | extrair a malha do 3MF anterior |
| `abs()` no volume ao validar exportação | `signed=True` — sem sinal esconde cavidades invertidas |
| Iterar definições/redesenho sem foto da peça falhada | 1 iteração às cegas no máximo; teste da zona mais fina a 3 escalas numa chapa |

## Próximo passo (chain)

- Geometria, modificadores, export bruto → `blender`.
- Malha gerada por IA (Meshy) em vez de bpy próprio → `meshy-3d-print`.
- Peça entregue e o utilizador quer julgar o aspecto → `blender` (render) + `design-review`.
- Pedido de gosto sobre a fonte da peça → `design-shotgun` (board de comparação) antes de gerar geometria.

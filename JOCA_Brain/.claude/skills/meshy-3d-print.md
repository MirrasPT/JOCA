---
name: meshy-3d-print
description: "Levar um modelo 3D a imprimir: análise de imprimibilidade, reparação de malha, multicolor 3MF e entrega ao slicer, via MCP da Meshy. MUST be invoked when the user says: imprimir modelo 3d, imprimibilidade, malha imprimível, watertight, non-manifold, multicolor, 3mf, slicer, fatiar, print-ready. SHOULD also invoke when: figurina para imprimir, miniatura, o modelo imprime bem, preparar para a impressora."
triggers: imprimibilidade, imprimivel, malha imprimivel, watertight, estanque, non-manifold, nao manifold, buracos na malha, faces degeneradas, reparar malha, print analyze, print repair, multicolor, multicor, 3mf, slicer, fatiar, orcaslicer, bambu studio, prusaslicer, cura, anycubic slicer, print ready, figurina, miniatura, imprimir em 3d, creative lab
chain: blender, meshy
---

# Meshy — impressão 3D

Do modelo à impressora. A Meshy garante **malha válida e cor**; não decide orientação, suportes,
paredes nem altura de camada — isso é do slicer, e continua a ser.

Geração e escolha de parâmetros → `meshy`. Correcção manual de geometria → `blender`.

## A análise é grátis — corre-se sempre

`meshy_analyze_printability` custa **0 créditos**. Não há razão para adivinhar se uma malha imprime.

| Estado | Significado | Acção |
|---|---|---|
| `healthy` | estanque, sem arestas não-manifold, sem buracos | imprimir como está |
| `warning` | faces degeneradas ou buracos | reparo opcional; recomendado em peças com detalhe fino |
| `error` | não-estanque, volume não-positivo, ou arestas não-manifold | **reparar antes de imprimir** |
| `unknown` | não conseguiu processar | inspeccionar à mão; não ler como aprovação |

Métricas devolvidas: `is_watertight` · `volume` · `non_manifold_edges` · `degenerate_faces` ·
`holes`. **Ler os números, não só o estado** — `warning` com 4 000 faces degeneradas e `warning` com
2 são decisões diferentes.

⚠ **O estado é mais optimista do que a tabela promete.** Medido com um cubo a que se tirou uma face:
`is_watertight: false`, 1 buraco, 4 arestas não-manifold → devolveu **`warning`**, não `error`
⏳(verificado 2026-08-25). Uma malha aberta imprime mal e o estado não o grita. **O sinal que manda
é `is_watertight`**, não a etiqueta. Controlo positivo do mesmo teste: o cubo fechado deu `healthy`
com `volume: 8000` — o volume vem nas unidades cúbicas do próprio ficheiro (cubo de 20 mm → 8000 mm³),
o que serve de verificação barata de escala.

⚠ `analyze` por `input_task_id` exige que a tarefa de origem tenha usado **Meshy 6 ou um modelo
Preview**. Com Meshy 5 falha — a saída é passar `model_url`.

## O que a análise aceita — e o problema que isso cria

`analyze` e `repair` aceitam **exactamente uma** fonte: um `input_task_id` da Meshy, **ou** um
`model_url` que a Meshy consiga descarregar. Formatos `.glb .gltf .obj .fbx .stl`, até **100 MB**.

**Não há upload de ficheiro local.** Uma malha que está no teu disco — feita no Blender, exportada
de outro programa, ou gerada na web app da Meshy (que não deixa `task_id` visível à API) — só se
analisa se estiver num **URL público**.

### Publicar temporariamente

Publicar é uma decisão do utilizador, não um detalhe técnico. Enquanto o ficheiro está no ar é
descarregável por **qualquer pessoa que saiba o URL**, e o URL viaja: vai para os servidores da
Meshy, para os registos deles, e para o transcript da conversa. Se a geometria for de um cliente,
de uma pessoa, ou de um produto por lançar, **perguntar antes** — nunca publicar por iniciativa
própria.

Padrão do publicador efémero (host estático que o utilizador controle):

```bash
publicar-malha.sh <ficheiro>      # nome aleatório de 128 bits, imprime o URL
publicar-malha.sh --apagar <url>  # apaga e confirma 404
publicar-malha.sh --limpar [min]  # varre o que ficou esquecido (default 60 min)
```

Requisitos do lado do servidor, e porquê cada um:

| Requisito | Razão |
|---|---|
| Nome aleatório ≥128 bits | não se adivinha nem se enumera |
| Sem listagem de directório (`browse` desligado) | a pasta não se lê |
| `X-Robots-Tag: noindex, nofollow` **e** `robots.txt` | duas camadas — nenhuma sozinha chega |
| Verificar por `HEAD` real depois de enviar | o exit 0 do `scp` não prova que o Caddy/nginx serve |
| Apagar no fim **e** varrer por idade | apagar à mão esquece-se |
| Página de guarda na raiz do vhost | monitorização que sonde a raiz não fica em baixo para sempre |

⚠ Se o *fetch* da Meshy falhar num URL que responde 200 no `curl`, o suspeito nº1 é o `robots.txt`
a bloquear o descarregador deles. O `X-Robots-Tag` chega para o noindex; o `robots.txt` pode sair.

## Reparar destrói a textura — a ordem não é negociável

`meshy_repair_printability` (10 créditos) corrige arestas não-manifold, faces degeneradas, buracos e
fronteiras abertas. **O modelo reparado volta sem textura nem UV.**

```
CERTO:  gerar → analyze → repair → texturar/multicolor → 3MF
ERRADO: gerar → texturar → multicolor → repair          ← perde a cor toda
```

O formato de saída **espelha o de entrada**: `task_id`→GLB · `.stl`→STL · `.obj`→OBJ · `.glb`→GLB.

Quando o `repair` da Meshy não chega (malhas de superfície infinitamente fina, que são manifold e
mesmo assim não imprimem): Blender + add-on **3D Print Toolbox** → Clean Up → Make Manifold → Check
All até dar 0 arestas não-manifold; se a casca não tiver volume, modificador **Solidify** com ~2 mm.
Ver `blender`.

## Branco vs cores

### Branco (Cenário A)

1. Detectar slicers instalados — `meshy_send_to_slicer` com `slicer_type:"auto"`. **Fazer isto
   primeiro**, antes de gerar: descobrir no fim que não há slicer é tarde.
2. Gerar **sem textura**, `target_formats:["obj"]` (ver `meshy`).
3. `meshy_download_model` com `format:"obj"`, `print_ready:true`, `print_height_mm:<altura real>`.
4. Abrir no slicer com o `launch_command` devolvido.

### Cores (Cenário B)

1. Detectar slicers com `is_multicolor:true`.
2. Gerar **com textura** (preview + refine, ou image-to-3d texturado).
3. `meshy_process_multicolor` — 10 créditos, exige modelo **texturado**, produz **3MF**.
   `max_colors` 1–16 (default 4) · `max_depth` 3–6 (default 4; 3 grosseiro, 6 fino).
4. Descarregar o 3MF e abrir.

Multicolor a sério exige impressora **multi-filamento** (AMS e afins). Bico único só troca de cor
**por camada**, não por região na mesma camada. Resina não faz este fluxo.

⚠ Multicolor-capable segundo o detector: OrcaSlicer, Bambu Studio, Creality Print, Elegoo Slicer,
Anycubic Slicer Next. **PrusaSlicer e Cura ficam de fora.**

⚠ Ao abrir **vários** modelos, espaçar os comandos ~1–2 s — em rajada o Bambu Studio só responde a um.

## `print_ready` — o que faz exactamente, e o que parte

Só actua com **`format:"obj"`**; nos outros formatos é **ignorado em silêncio**. Reescreve o ficheiro
**no lugar, sem cópia de segurança**:

1. Roda Y-up (glTF) → Z-up (slicer): `(x,y,z) → (x,−z,y)`, normais incluídas.
2. Escala uniforme para `print_height_mm` (**default 75**), medida na bounding box já rodada.
3. Centra em XY e assenta a base em Z=0.

A saída fica em **milímetros**. O 3MF do multicolor **já sai Z-up** — não precisa disto, e aplicá-lo
deitaria a peça.

⚠ **Não é idempotente**, apesar de a ferramenta se anunciar como tal. Corrê-lo duas vezes roda a peça
duas vezes: fica deitada. Se houver dúvida sobre se já correu, descarregar de novo em vez de repetir.

⚠ **`print_height_mm: 0` cai para 75 mm** — é uma coalescência `||` no código, não uma escolha. Para
uma peça de altura mínima, dar o valor real.

## Escala é a falha nº1

A IA não tem noção de tamanho físico. Um modelo "de um cavaleiro" não sabe se é uma miniatura de
28 mm ou uma estátua de meio metro — e o default de 75 mm aplica-se na mesma, calado.

**A altura-alvo é sempre uma decisão explícita.** Se o utilizador não a disser, perguntar; se for
óbvia pelo uso (miniatura de jogo, chaveiro), dizer o número que se assumiu.

## Gate de runtime — o que prova que está pronto

`SUCCEEDED` e `healthy` não são prova de que a peça imprime bem.

| Verificar | Como |
|---|---|
| A malha é o que foi pedido | `Read()` da thumbnail ou render; ver, não inferir |
| A escala está certa | ler a bounding box do ficheiro final, em mm |
| A orientação está certa | a base assente, a peça de pé — não confiar no `print_ready` sem olhar |
| Métricas de imprimibilidade | os cinco números, não só o estado |
| O que o slicer diz | abrir e **ler o perfil dentro do ficheiro** — um 3MF de projecto traz o perfil da impressora lá dentro |

⚠ **Silêncio não é aprovação.** Um slicer que não avisa pode ter a verificação **desligada** — já
aceitou uma ponte de 48 mm com o perfil a declarar 10 mm de máximo, e reportou "0 suportes", porque
tinha os suportes desactivados. Antes de ler a ausência de aviso como aprovação, confirmar que o
check estava ligado.

## O que continua a ser do slicer

Orientação de impressão · suportes · número de paredes · altura de camada · infill · brim/raft ·
temperatura. A Meshy não decide nada disto. Lembrá-lo ao entregar, em vez de deixar implícito que
"está pronto a imprimir".

Espessura mínima de parede e base estável são orientação de senso comum (a documentação da Meshy
sugere base ≥ ~3 mm para figurinhas), não um limite que a plataforma garanta — tratar como ponto de
partida, não como especificação.

## Creative Lab — o atalho caro

`meshy_creative_lab` faz `figure`, `lamp`, `keychain`, `fridge-magnet` a partir de foto (ou texto,
para o candeeiro). Corre protótipo → build sozinho: **36 créditos numa chamada**, sem gate no meio,
e a imagem-conceito intermédia nunca é mostrada.

Confirmar o custo antes. E se houver imagem **e** texto, a imagem ganha — o texto é ignorado.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Adivinhar se a malha imprime | `analyze` é grátis — corre-se sempre |
| Ler `warning` sem ver os números | Cinco métricas; 4 000 faces degeneradas ≠ 2 |
| `repair` depois de texturar | Reparar **primeiro**; o reparo apaga a textura |
| Publicar a malha do utilizador para analisar, sem perguntar | O URL é público e viaja — a decisão é dele |
| Deixar o ficheiro publicado depois da análise | Apagar e confirmar 404; varrer por idade |
| Correr `print_ready` outra vez "por garantia" | Não é idempotente — deita a peça |
| `print_ready` num 3MF ou GLB | Só faz efeito em OBJ; nos outros é ignorado em silêncio |
| Aceitar o default de 75 mm sem o dizer | A altura é decisão explícita, e diz-se qual foi |
| "Está pronto a imprimir" | A Meshy dá malha e cor; orientação, suportes e paredes são do slicer |
| Ausência de aviso do slicer lida como aprovação | Confirmar que o check estava ligado |

## Próximo passo (chain)

- Malha reprovada que o `repair` não resolve → `blender` (3D Print Toolbox, Solidify, boolean).
- Precisa de outro modelo, outra textura ou outro formato → `meshy`.
- Peça entregue e o utilizador quer julgar o aspecto → `blender-render` + `design-review`.

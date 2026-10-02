---
name: blender
description: "Trabalho 3D em Blender por Python headless (bpy): modelar e transformar geometria, modificadores, importar/exportar/converter modelos (glTF, FBX, STL, USD) para Unity/Unreal/Godot/three.js, batch de .blend, e renderizar (Cycles/EEVEE, câmara, luz, materiais PBR, turntable, sequências). MUST be invoked when the user says: blender, bpy, script blender, 3d, modelo 3d, cena 3d, render 3d, renderizar, .blend, glb, gltf, fbx, modelar. SHOULD also invoke when: turntable, product shot, material pbr, hdri, batch blend, geometry nodes, converter 3d."
triggers: bpy, script blender, blender python, batch blend, headless blender, converter 3d, render 3d, renderizar, cycles, eevee, turntable, product shot, material pbr, hdri, depth of field, blender, 3d, modelo 3d, cena 3d, .blend, glb, gltf, fbx, modelar, geometry nodes
chain: design-review
---

# Blender — núcleo (modelar · scripting bpy · render)

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

Ponto de entrada único para trabalho 3D. Decide a rota, define o brief, lê **só a referência do
pedido** e **fecha o loop olhando para o render** — não para o relatório do script.

## Router — que referência ler

| Pedido | Ler |
|---|---|
| criar/alterar geometria, modificadores, booleanas, encaixes, import/export/conversão, eixos por engine, SVG → 3D, batch de `.blend`, medir malha para fabrico | `Read(".claude/reference/blender-scripting.md")` |
| engine (Cycles/EEVEE), GPU, output, câmara, luz/HDRI, materiais PBR, animação, turntable, passes, orçamento de tempo | `Read(".claude/reference/blender-render.md")` |
| versão ≠ 5.x, deltas de API, valores por omissão, tabela de operadores I/O | `Read(".claude/reference/blender-api-5x.md")` |

Trabalho que atravessa os dois (modelar → renderizar): scripting → render → **loop de verificação**.
Ajuste pontual de um lado só → ler só essa referência.

## Contrato de execução (esta máquina)

```bash
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"   # macOS — NÃO está no PATH
"$BLENDER" -b --python script.py                              # headless
"$BLENDER" -b cena.blend --python script.py                   # sobre um .blend existente
"$BLENDER" -b --python script.py -- --out /tmp/x.png          # args depois de `--`
```

Windows: `C:\Program Files\Blender Foundation\Blender <ver>\blender.exe`. Confirmar com `where blender`
antes de assumir; se não existir, é `TODO: caminho do Blender em falta`, nunca um path plausível.

**Verificar a versão antes de escrever a primeira linha de bpy** — a API parte entre majors:

```bash
"$BLENDER" --version
```

Versão ≠ 5.x → `Read(".claude/reference/blender-api-5x.md")` para a tabela de deltas. Escrever
`BLENDER_EEVEE_NEXT` numa 5.x rebenta; escrever `BLENDER_EEVEE` numa 4.2 dá o EEVEE Legacy.

## Rota — CLI headless vs MCP

| | **CLI headless (default)** | MCP (`blender-mcp`) |
|---|---|---|
| Requer | só o binário | Blender **aberto** + addon + servidor a correr |
| Determinístico | sim — script versionado, re-corre igual | não — estado vivo da sessão |
| Verificável | render → ficheiro → comparar | screenshot da viewport |
| Falha típica | erro de API, visível no log | ligação cai, Blender crasha, estado meio-feito |

**Default é CLI.** O MCP só entra se o utilizador quiser ver acontecer na viewport ao vivo *e* já
tiver o addon activo. Não instalado nesta máquina — não o assumir disponível.

## Base de qualquer script bpy

### Os três namespaces

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

### Limpar a cena — sempre, antes de construir

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

### Args de linha de comandos

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

## Loop de verificação (obrigatório — o que separa isto de um script à sorte)

Um script bpy que corre sem erro **não** prova que a cena está certa. O exit code diz que o Python
correu; não diz que o objecto está no enquadramento, que a luz o apanha, ou que o material aparece.
Medido: um script que criou um macaco e uma câmara devolveu `RENDER_OK` e produziu um render do
**cubo por omissão** — o macaco estava lá, escondido dentro do cubo que ninguém apagou.

```
1. CORRER      → blender -b --python script.py
2. RENDERIZAR  → preview barato (EEVEE, 480p) para o disco
3. OLHAR       → Read() do .png. Ver, não inferir.
4. COMPARAR    → contra a referência ou o pedido; listar as diferenças
5. CORRIGIR    → editar o script (não a cena) e repetir. Máx. 3 voltas, depois reportar.
```

Regras do loop:
- **Preview em EEVEE, entrega em Cycles.** Iterar em Cycles gasta minutos por volta sem informação
  nova sobre enquadramento e composição.
- **O script é a fonte de verdade**, não o `.blend`. Corrige-se o script e re-corre-se do zero; assim
  o resultado é reprodutível e o diff é legível.
- Cena a construir de raiz → começar sempre por `clear_scene()` (acima).
- Peça para fabrico/encaixe → o render não chega: gates de malha em `reference/blender-scripting.md`
  §«Medir malha» e §«Modificadores» (encaixe em malha sobreposta → camada 2D + gate por raios).

## Brief antes de executar

Trabalho maior que um ajuste pontual → escrever isto primeiro, em 6 linhas:

```
Alvo:      [asset isolado / cena / conversão / batch]
Destino:   [engine + formato: glTF web · FBX Unity · USD · PNG · MP4]
Orçamento: [tris, resolução de textura, samples] — só se for para engine/tempo real
Escala:    [unidades reais; 1 unidade Blender = 1 m]
Eixos:     [Blender é Z-up; Unity/three.js são Y-up — ver a tabela de export]
Pronto:    [critério verificável: "o render mostra X de frente, sem clipping"]
```

Sem orçamento explícito e sem base no projecto → não inventar números: perguntar ou assumir e
declarar a assunção.

## Limites reais (não prometer o que não sai)

Medido e corroborado pela literatura pública sobre Claude+Blender:

| Sai bem | Sai mal |
|---|---|
| composição de cena, props hard-surface, kitbash | formas orgânicas a partir de primitivas |
| luzes, câmaras, enquadramento, turntables | escultura (não há sculpt mode headless útil) |
| materiais PBR por nodes, cores, roughness/metallic | grafos de nodes complexos "à primeira" |
| import/export, conversão de formatos, batch | rigging e weight painting de personagem |
| geometria procedural por código (arrays, boolean, curvas) | topologia limpa para deformação |
| renders, sequências, passes | julgar sozinho se "está bonito" |

Raciocínio espacial é aproximado: a primeira colocação fica quase sempre a precisar de correcção.
É por isso que o loop de verificação não é opcional — é o mecanismo que compensa isto.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Declarar feito porque o script correu sem erro | `Read()` do render e comparar |
| Iterar enquadramento em Cycles | EEVEE 480p para iterar, Cycles só na entrega |
| Editar o `.blend` à mão a meio | Corrigir o script e re-correr do zero |
| `blender` no PATH | Caminho completo do binário; confirmar que existe |
| Copiar snippets de bpy de tutoriais 3.x | Confirmar a versão + `reference/blender-api-5x.md` |
| Construir cena sem limpar a de arranque | `clear_scene()` primeiro — o cubo tapa tudo |
| Ler as duas referências para um pedido de um lado só | Router acima — só a referência do pedido |
| Sobrescrever um `.blend`/render que o utilizador já aprovou | `test -f` antes; se existe, nome irmão versionado |

## Próximo passo (chain)

- Render entregue e o utilizador quer julgar o resultado visual → `design-review`.
- O render não bate com o pedido → loop de verificação acima (máx. 3 voltas).
- Peça para imprimir → `impressao-3d` (export e gate de malha).

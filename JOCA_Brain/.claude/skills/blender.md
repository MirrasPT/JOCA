---
name: blender
description: "Director/router de trabalho 3D em Blender por Python headless (bpy). MUST be invoked when the user says: blender, 3d, modelo 3d, cena 3d, render 3d, .blend, bpy, glb, gltf, fbx, obj, stl, malha, mesh, modelar. SHOULD also invoke when: asset 3d para jogo, turntable, product shot 3d, converter modelo, exportar para Unity/Unreal/Godot/three.js, batch de .blend, low poly, geometry nodes."
triggers: blender, bpy, 3d, modelo 3d, modelacao 3d, cena 3d, render 3d, .blend, glb, gltf, fbx, obj, stl, usd, malha, mesh, modelar, asset 3d, game-ready, low poly, lowpoly, turntable, product shot, geometry nodes, cycles, eevee, uv, unwrap, material pbr, rig, rigging, armature, converter modelo 3d, exportar para unity, exportar para unreal, exportar para godot, exportar para threejs, batch blend
chain: blender-scripting, blender-render
---

# Blender — Director

Ponto de entrada para qualquer trabalho 3D. Decide a rota, define o brief, e **fecha o loop olhando
para o render** — não para o relatório do script.

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

## Router

| Pedido | Skill |
|---|---|
| criar/alterar geometria, modificadores, importar/exportar, batch de `.blend`, hierarquia, custom props | `blender-scripting` |
| câmara, luzes, materiais PBR, engine, output, animação, render de imagem/sequência | `blender-render` |
| deltas de API entre versões, gotchas medidos, tabela de operadores I/O | `.claude/reference/blender-api-5x.md` (`Read()`) |

Trabalho que atravessa os dois (modelar → renderizar) corre a sequência: `blender-scripting` →
`blender-render` → **loop de verificação**.

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
- Cena a construir de raiz → começar sempre por limpar a cena de arranque (Cube + Camera + Light já
  lá estão). Ver `blender-scripting`.

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
| Sobrescrever um `.blend`/render que o utilizador já aprovou | `test -f` antes; se existe, nome irmão versionado |

## Próximo passo (chain)

- Geometria/IO pedidos → `blender-scripting`.
- Depois de haver geometria → `blender-render` (preview e entrega).
- Render entregue e o utilizador quer julgar o resultado visual → `design-review`.

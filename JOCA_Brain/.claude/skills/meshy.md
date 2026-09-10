---
name: meshy
description: "Director de geração 3D por IA na Meshy (MCP oficial). MUST be invoked when the user says: meshy, gerar modelo 3d, criar modelo 3d por ia, text-to-3d, image-to-3d, texto para 3d, imagem para 3d, retexturar, remesh, riggar, animar modelo. SHOULD also invoke when: asset 3d para jogo a partir de prompt, figurina a partir de foto, converter formato de modelo, uv unwrap, creative lab."
triggers: meshy, meshy.ai, gerar modelo 3d, criar modelo 3d, modelo 3d por ia, text-to-3d, texto para 3d, image-to-3d, imagem para 3d, foto para 3d, retexture, retexturar, remesh, decimar malha, uv unwrap, auto-rig, riggar, animar personagem, creative lab, glb, obj, fbx, usdz, 3mf
chain: meshy-3d-print, blender, design-review
---

# Meshy — Director

Geração 3D por IA através do **MCP oficial** (`@meshy-ai/meshy-mcp-server`). Esta skill decide a
rota, trava o custo, e escolhe os parâmetros que a versão instalada aceita de facto.

Trabalho de **impressão** (fatiar, imprimibilidade, multicolor, slicer) → `meshy-3d-print`.

## Regra zero — o custo confirma-se antes, sempre

Cada chamada de geração gasta créditos **reais e não reembolsáveis** da conta do utilizador. Antes de
qualquer ferramenta que custe: dizer o custo e esperar confirmação. Não é cerimónia — é dinheiro.

```
meshy_check_balance          # 0 créditos. O único gate honesto: prova que a chave AUTENTICA.
```

`Connected` no `claude mcp list` prova só que o processo arranca, **não** que a chave é válida nem
que o plano dá acesso. A API da Meshy exige **plano Pro ou superior** ⏳(verificado 2026-08-25).

| Ferramenta | Créditos |
|---|---|
| `convert` · `resize` | 1 |
| `animate` | 3 |
| `remesh` · `rig` · `uv_unwrap` | 5 |
| `text_to_3d` (preview) | 5 com `meshy-5` · **20** com `meshy-6`/`latest` |
| `text_to_3d_refine` · `retexture` · `repair_printability` · `process_multicolor` | 10 |
| `image_to_3d` · `multi_image_to_3d` | 5–30 |
| `text_to_image` / `image_to_image` | 3–9 / 3–12, conforme o modelo |
| `creative_lab` | **36** (6 protótipo + 30 build, corre as duas fases sozinho) |
| **`analyze_printability`** · `check_balance` · `list_tasks` · `download_model` | **0** |

## O formato decide-se ANTES de gerar

`target_formats` fixa-se no momento da criação — não se acrescenta depois sem pagar outra vez
(`convert`, 1 crédito). Perguntar o destino antes da primeira chamada.

| Destino | Formato | Rota |
|---|---|---|
| Impressão em branco | `obj` | `meshy-3d-print` (Cenário A) |
| Impressão a cores | `3mf` via `process_multicolor` | `meshy-3d-print` (Cenário B) |
| Unity · Unreal · Godot | `fbx` | gerar → texturar → `remesh` `topology:"quad"` |
| Web · three.js · visualização | `glb` | default |
| AR · Apple Quick Look | `usdz` | gerar → texturar → `remesh target_formats:["usdz"]` |
| Texturar noutro sítio (Blender, Substance) | `glb` + `uv_unwrap` | malha ≤40k faces |

⚠ Omitir `target_formats` produz **tudo excepto 3MF**. O 3MF pede-se de propósito ou não existe.

## Parâmetros — o que a versão instalada aceita

**A API pública da Meshy vai à frente do MCP.** A doc web fala de `meshy-7`, `model_type:
"smart-topology"` e `ultra_mode`; o servidor MCP **0.4.0** não os conhece e a chamada é rejeitada.
Confirmar a versão antes de copiar parâmetros da doc:

```bash
npx -y @meshy-ai/meshy-mcp-server --version   # ou ler o package.json no cache do npx
```

Enums reais da 0.4.0 ⏳(verificado 2026-08-25): `ai_model` ∈ `meshy-5 | meshy-6 | latest` ·
`model_type` ∈ `standard | lowpoly` · `topology` ∈ `quad | triangle` · `origin_at` ∈ `bottom | center`
· `pose_mode` ∈ `a-pose | t-pose`.

| Armadilha | Efeito |
|---|---|
| `decimation_mode` definido | **`target_polycount` é ignorado em silêncio.** Usar um ou outro, nunca os dois |
| `model_type: "lowpoly"` | ignora `ai_model`, `topology`, `target_polycount` e `should_remesh` |
| `symmetry_mode` | **DEPRECATED, sem efeito desde 2026-05-11.** Passá-lo não faz nada |
| `hd_texture` · `image_enhancement` · `remove_lighting` | só `meshy-6`/`latest`; com `meshy-5` o servidor remove-os do pedido |
| `refine` com `ai_model` diferente do preview | erro — tem de coincidir |
| `rig` acima de 300 000 faces | bloqueado **localmente**, sem gastar créditos → `remesh` primeiro |
| `uv_unwrap` | só GLB e ≤40 000 faces; malhas quad são trianguladas |

## Prompt — a fórmula oficial

**Subject + Material + Art Style + Technical Constraints**, 2–600 caracteres.

> *"Longsword with etched steel blade and bronze crossguard, dark fantasy style, low-poly game-ready"*

O que funciona: detalhe importante **primeiro** (as primeiras palavras pesam mais) · **um** objecto,
nunca uma cena · 3–6 detalhes centrais · materiais físicos reais (`polished brass`, não `shiny`) ·
pose declarada para personagens que vão ser riggados (`T-pose`).

O que estraga: adjectivos vazios (`amazing`, `epic`) · materiais empilhados · elementos não-físicos
(fumo, brilho, partículas) que não sobrevivem a uma malha sólida.

**Não existe campo `negative_prompt` no text-to-3d** — as exclusões escrevem-se dentro do prompt:
*"no background elements"*, *"without floating particles"*.

## Preview → refine

`text_to_3d` cria a **malha sem textura** (preview). `text_to_3d_refine` acrescenta a textura, e é
uma chamada paga à parte, com `preview_task_id`.

**Para impressão em branco nunca se faz refine** — a textura não vai ser impressa e custa 10
créditos por nada. Gerar o preview e ir directo ao fluxo de `meshy-3d-print`.

## Onde os ficheiros aterram

`meshy_download_model` grava em **`{cwd do processo MCP}/meshy_output/{data}_{slug}_{id8}/`** — o
`cwd` é o do **servidor**, não o teu. Se o destino importa, passar `save_to` com **caminho absoluto**.

- Ficheiro: `{stage}.{formato}` (`preview`, `refined`, `remeshed`, `retextured`, `rigged`, …).
- Encadear na mesma pasta do preview → passar `parent_task_id`.
- Texturas: ao lado se forem ≤2, em `textures/` se forem mais.
- **Os URLs de download da Meshy expiram em 24 h.** O ficheiro local é que é permanente — descarregar
  antes de fechar o assunto, não guardar o URL.
- ⚠ Escrever por cima de um modelo que o utilizador já aprovou é irreversível: `test -f` antes; se
  existir, nome irmão versionado.

## Estado das tarefas — duas armadilhas

`meshy_get_task_status` infere o `task_type` sozinho **só para 10 tipos**. Não cobre `convert`,
`resize`, `uv-unwrap`, `print-analyze`, `print-repair` nem Creative Lab: para essas o `task_type`
tem de estar **certo**, senão vem `Task <id> not found on any endpoint`.

Pior: um `task_type` inválido **não dá erro** — cai em silêncio para `text-to-3d`.

**`meshy_list_tasks` só vê tarefas criadas por API.** Medido: numa conta com trabalho feito pelo
site, devolveu **zero** em todos os tipos ⏳(verificado 2026-08-25). Consequência: modelos gerados na
web app **não têm `task_id` utilizável** — para lhes tocar por API é preciso o ficheiro e um
`model_url`. E `meshy_list_models` ignora o `workspace_id` que recebe: lista só `text-to-3d`.

## Loop de verificação

Um `SUCCEEDED` diz que o pipeline correu. Não diz que o modelo é o que foi pedido.

```
1. GERAR       → preview, formato já decidido
2. DESCARREGAR → save_to absoluto
3. OLHAR       → Read() da thumbnail, ou render de preview (blender-render)
4. COMPARAR    → contra o pedido; listar diferenças
5. DECIDIR     → aceitar · refinar o prompt e regerar (custa outra vez) · corrigir no Blender
```

Gerar outra vez **paga outra vez**. Antes da segunda tentativa, dizer o custo e perguntar — três
regerações distraídas são 60 créditos.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Chamar uma ferramenta paga sem anunciar o custo | Custo + confirmação antes, sempre |
| `Connected` no `claude mcp list` lido como "a chave funciona" | `meshy_check_balance` — grátis, e é o único que prova |
| Copiar parâmetros da doc web para o MCP | Confirmar a versão; a 0.4.0 não conhece `meshy-7` nem `smart-topology` |
| `decimation_mode` **e** `target_polycount` na mesma chamada | Um dos dois; o segundo é ignorado sem aviso |
| Refinar (texturar) um modelo que vai ser impresso em branco | Preview e seguir para `meshy-3d-print` |
| Guardar o URL de download em vez do ficheiro | Expira em 24 h |
| Assumir que um modelo feito no site tem `task_id` para a API | Só tarefas criadas por API aparecem; a web app é invisível |
| Deixar o download cair no `cwd` do servidor MCP | `save_to` absoluto |
| Declarar feito porque o estado é `SUCCEEDED` | Olhar para o modelo — thumbnail ou render |

## Próximo passo (chain)

- Modelo destinado a impressão → **`meshy-3d-print`** (é lá que vive a análise, o multicolor e o slicer).
- Malha que precisa de correcção manual, boolean, corte ou junção → `blender`.
- Modelo para apresentar ao utilizador ou ao cliente → `blender-render` para o turntable, depois `design-review`.

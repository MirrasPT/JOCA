---
name: img-gen
description: "Route and generate images via Codex CLI (OpenAI gpt-image-2) or Antigravity CLI (Gemini). MUST be invoked when the user mentions: generate image, create image, illustration, product shot, mockup, hero image, background image."
chain: design-review
---

# img-gen -- Image Generation Router

Analyse request, pick CLI, craft prompt, spawn agent.

**O pedido de IA não se troca por uma fonte «melhor».** Havendo vector/PDF vector/ficheiro-mestre do
mesmo artefacto, **dizê-lo numa linha e fazer o que foi pedido** — ou perguntar qual dos dois. Entregar o
render do vector em vez da geração pedida foi deitado fora («o vetor é mau, quero mesmo com IA»).

## 1. Model selection

**Motor por omissão = `agy` (Antigravity/Gemini).** Está incluído na subscrição. O gen-ai CLI da
Picsart só se usa quando o utilizador o pedir **pelo nome** — um pedido por modelo ("usa o nano
banana 2") é pedido de **modelo**, não de fornecedor, e o mesmo modelo sai de graça pelo `agy`
(medido: 928×1152 idêntico nos dois caminhos, 21 créditos gastos por nada).

**ROUTING RULE (medida 2026-08-13, substitui a antiga "Gemini = 1:1 only"):** o `agy` **gera
não-quadrado**. 16:9 → 1376×768 · 4:5 → 928×1152 (desvio ~0,8 %). A regra antiga mandava todo o
trabalho não-quadrado para o OpenAI sem necessidade. Encaminhar por **conteúdo** (texto/marca/precisão
→ OpenAI), não por rácio.

**Rácios do `agy`** — lista auto-declarada pelo CLI: `1:1` (default, sai exactamente 1024×1024) ·
`16:9` · `9:16` · `4:3` · `3:4` · `3:2` · `2:3`.
⚠ **`4:5` (Feed Instagram) está FORA da lista** e é o formato de todo o trabalho de redes sociais.
Foi produzido quando pedido imperativamente, mas não é garantido: rácio fora da lista **cai em
silêncio no vizinho** (4:5 → 3:4, 896×1200). Consequência dura: **medir as dimensões do ficheiro
antes de o aceitar, sempre** — e calcular qualquer cover-fit a partir do rácio **real do ficheiro**,
nunca do pedido.

### GPT Image 2.5 — o que existe (verificado 2026-09-09)

A OpenAI lançou o **GPT Image 2.5** a **2026-09-08** — na app é «ChatGPT Images 2.5» (latência até
50 % menor, melhor preservação do sujeito das fotos de referência, edições mais consistentes ao longo
de vários turnos, Sketch, Templates, comentários pousados na imagem). Na API são **dois** modelos:

| Modelo | Para quê |
|---|---|
| `gpt-image-2.5-flare` (snapshot `-2026-09-08`) | rápido, dia-a-dia e volume |
| `gpt-image-2.5-sunburst` (snapshot `-2026-09-08`) | máxima precisão de edição, gerações mais longas |

Ambos em `v1/images/generations` + `v1/images/edits`, com inpainting. `quality` ganha **`xhigh`** e
**`max`** acima de `high`, e o tamanho passa a **arbitrário** (cada lado ≤ 3840 px, ambos múltiplos de
16, rácio ≤ 3:1, total entre 0,65 MP e 8,3 MP; acima de 3,69 MP é experimental). Tarifas **iguais às do
gpt-image-2**: $5/1M texto-in · $8/1M imagem-in · $30/1M imagem-out (verificado 2026-09-09; o
calculador do gpt-image-2 não estima o consumo do 2.5).

⚠ **A ferramenta interna do `codex` não chega lá.** No `codex-cli 0.153.4` (a última no npm a
2026-09-09) o modelo está **fixo no binário** — a extensão `ext/image-generation` só conhece
`gpt-image-2` e não há flag de modelo. Quem dá acesso ao 2.5 é o **CLI de fallback** da própria OpenAI
(via 1 da política abaixo). Reverificar depois de cada `codex update`:

```bash
strings "$(npm root -g)"/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex \
  | grep -oiE 'gpt-image[a-z0-9.-]*' | sort -u
```

### Modelo por omissão: **GPT Image 2.5** (decisão de 2026-09-09)

Sempre que o modelo for **escolhível**, pede-se o 2.5 — `gpt-image-2.5-flare` por omissão,
`gpt-image-2.5-sunburst` quando o que está em jogo é **texto, marca ou precisão de edição**. Ordem de
resolução, sem perguntar:

| # | Condição | Via | Modelo que sai |
|---|---|---|---|
| 1 | `OPENAI_API_KEY` presente | CLI de fallback da OpenAI (`image_gen.py`, ver abaixo) — aceita `--model` | **2.5 flare/sunburst** |
| 2 | sem chave (caso comum: auth por subscrição ChatGPT) | `codex exec` → ferramenta interna `image_gen` | `gpt-image-2` (fixo no binário, sem parâmetro de modelo) |

Testar a chave **antes** de escolher a via — não inferir:

```bash
python3 -c "import json,os,pathlib;p=pathlib.Path.home()/'.codex/auth.json';print('key:', bool(os.getenv('OPENAI_API_KEY') or (p.exists() and json.load(open(p)).get('OPENAI_API_KEY'))))"
```

**Via 1 — o CLI que o próprio `codex` traz** (`~/.codex/skills/.system/imagegen/scripts/image_gen.py`,
subcomandos `generate` · `edit` · `generate-batch`; é ficheiro da OpenAI, **não se edita**):

```bash
python3 ~/.codex/skills/.system/imagegen/scripts/image_gen.py generate \
  --model gpt-image-2.5-flare --prompt-file prompt.txt \
  --size 1024x1536 --quality high --out dest.png
# edição/inpainting com máscara real:
python3 ~/.codex/skills/.system/imagegen/scripts/image_gen.py edit \
  --model gpt-image-2.5-sunburst --image base.png --mask mascara.png \
  --prompt-file prompt.txt --out dest.png
```

⚠ **Duas armadilhas deste script, lidas no código (2026-09-09):** os validadores são anteriores ao 2.5,
logo (a) `--size` arbitrário só é aceite quando `--model` é exactamente `gpt-image-2` — com 2.5 só passam
`1024x1024`, `1536x1024`, `1024x1536` e `auto`; (b) `--quality` só aceita `low|medium|high|auto` — `xhigh`
e `max` são recusados. Para tamanho arbitrário ou `xhigh`/`max` **no 2.5** é preciso chamar
`v1/images/generations` directamente (curl), não este script.

⚠ **O relatório nomeia sempre o modelo que gerou de facto** — `gpt-image-2.5-flare`, `-sunburst` ou
`gpt-image-2`. Escrever «2.5» num entregável que saiu pela via 2 é relatório falso.

### Use Codex CLI / OpenAI (`img-gen-openai`) when:
- **Text in image** -- labels, signs, product names, headlines, packaging copy, any readable text requiring accuracy
- **Product shots** -- branded packaging, bottles with labels, logo mockups, exact brand identity
- **Complex composition** -- exact object placement, multiple interacting elements with spatial precision
- **Inpainting / masking** -- replace or remove regions
- **Reference-image editing** -- heavy transforms or restyle of existing image
- **Dense typography / diagrams** -- infographics with labels, data viz with text
- **High-fidelity delivery** -- final hero image, client deliverable
- **Identidade entre vistas** -- a mesma personagem em vários ângulos/gerações: com as mesmas refs, o `codex` teve 0 derivas de cabelo/roupa contra 1 clara no `agy` (medido 2026-08-21)
- **Rácio fora da lista do `agy`** (ex.: 21:9) ou rácio que tem de sair exacto -- gpt-image-2 honra rácios nativamente (~1672x941 para 16:9); upscale para 2K via `ffmpeg scale=2048:1152:flags=lanczos`. Para 16:9/9:16/4:3/3:4/3:2/2:3 o `agy` chega (⚠ tamanho arbitrário exige o 2.5 por chamada directa à API — ver acima)

### Use Antigravity CLI / Gemini (`img-gen-google`) when:
- **General imagery** -- people, animals, landscapes, scenes, abstract patterns, textures, backgrounds
- **Simple/emotional concepts** -- "cute fluffy dog", "misty mountain", "warm cafe interior"
- **Quick drafts / iteration** -- explore directions cheaply
- **High-volume generation** -- 10+ images, batch workflows
- **Rácios da lista suportada** -- 16:9, 9:16, 4:3, 3:4, 3:2, 2:3 (medir sempre o ficheiro)
- **Web/UI backgrounds** -- abstract gradients, textures, UI mockup backgrounds
- **No text in image required**

### Use both when:
- User explicitly requests both or a comparison
- High-stakes hero asset where seeing both approaches aids decision
- Ambiguous brief where exploring both is cheaper than iterating on wrong model

## 1.5 Use-case taxonomy (tag every request)

Pick one slug; keep it consistent across prompt, generation, and report. Sets polish level + which model.

**Generate:** `photorealistic` · `product-mockup` · `ui-mockup` · `infographic-diagram` · `logo-brand` · `illustration` · `stylized-concept` · `historical-scene`
**Edit:** `text-localization` · `identity-preserve` · `object-edit` (add/remove/replace region) · `background-replace` · `lighting-weather` · `style-transfer` · `compositing` · `sketch-to-render`

Per-slug cues: `ui-mockup` → declare fidelity first (shippable vs low-fi wireframe), avoid concept-art language. `logo-brand` → strong silhouette, balanced negative space, no decorative flourishes. `infographic` → declare exact labels. Texture → seamless edges, no focal element.

### Specificity policy (before augmenting)
- Prompt already detailed → **normalize/structure only**, don't invent.
- Prompt generic → add only detail that materially improves.
- **Allowed** augmentation: composition/framing, polish level, layout, scene concreteness.
- **Disallowed:** extra characters/props, unimplied brand colors/slogans/story beats, arbitrary placement.

## 2. Prompt engineering

### For Codex / OpenAI (`img-gen-openai`)
Be explicit and literal. Model follows detailed instructions closely.

**Structure:** `[Medium/style] of [subject] [composition] [lighting] [colour palette] [text if any]`

**Text in image — always quote exact text:**
> Product photography of a wine bottle with label reading "Monte Velho Reserva 2021" in gold serif font on dark green background, studio lighting, white background, 8K

**Tips:**
- Name exact fonts, colours, lighting
- Add "professional quality, 8K" for final assets
- **Tamanho em píxeis à letra, não só o rácio:** «EXACTLY 1024×1536 pixels». Pedido «retrato 2:3» saiu
  864×1821 (story) com o texto perfeito — só as dimensões o denunciaram (2026-09-05)
- **Explícito no PRODUTO, solto na CENA.** Produto deformado (lata esticada em forma de garrafa) costuma
  ser prompt a mais: cortar a descrição da cena e manter só a restrição do produto (2026-09-02)
- **Produto de pé e frontal.** Garrafa segurada por uma mão em diagonal saiu deformada 2 vezes seguidas
  no gpt-image-2; com o produto de pé e de frente não deforma (2026-10-01)
- **Pedir uma única imagem por corrida** («generate exactly ONE image»). O `codex` às vezes faz 2
  gerações numa corrida e gasta o tecto do brief (2026-10-01)

### For Antigravity / Gemini (`img-gen-google`)
Lead with style, then subject. Clean descriptive language.

**Structure:** `[Style adjective(s)], [subject] [setting/context], [colour palette], [mood]`

**Tips:**
- Front-load style: "minimalist", "watercolour", "photorealistic"
- Avoid text in image — not reliable
- Aspect ratio goes in the prompt as an **imperative instruction in running text**, and the produced file is **measured** afterwards (see the routing rule in §1)

#### Prompt em JSON (Nano Banana / Gemini) — a via de mais controlo
Prosa dá estilo; **JSON dá enquadramento**. Esqueleto validado:

```json
{
  "subject": { "description": "...", "placement": "lower third, centred", "scale_in_frame": "35%" },
  "environment": { "description": "...", "excluded": ["pessoas", "texto", "logótipos"] },
  "composition": { "upper_third": "clean, sem elementos — reservado para copy" },
  "lighting": "...", "camera": "35mm, eye level, shallow depth of field",
  "negative": ["watermark", "wordmarks", "moldura", "texto"]
}
```

⚠ **O rácio é a excepção que vive FORA do JSON.** Enterrado como campo `"aspect_ratio"` foi ignorado
(pedido 4:5 → saiu 896×1200, ou seja 3:4). O rácio vai como **instrução imperativa em texto corrido,
no topo do prompt**, antes do bloco JSON.

#### Invocação do `agy` (medido 1.1.12 → 1.1.24)
```bash
# todas as flags ANTES de --print; o prompt é o último argumento
agy --dangerously-skip-permissions --effort high --print-timeout 30m --print "$(cat prompt.txt)"
```
(Este bloco trazia `agy --print "<prompt>" --dangerously-skip-permissions …` — flags depois do prompt, com
um `--print` variádico. O `agy --help` da 1.2.0 não documenta a ordem; a forma segura é a de cima.)
- ⚠ **O que vem LOGO A SEGUIR a `--print` tem de ser o prompt.** `agy --print --dangerously-skip-permissions "…"`
  faz o `--print` engolir a flag como valor do prompt: o agy explica a flag, sai **`exit 0`** e **não
  gera ficheiro nenhum** (medido em 1.1.16/1.1.17). Alternativa segura: **todas as flags antes de
  `--print`, prompt em último** — `agy --dangerously-skip-permissions --effort high --print "$(cat prompt.txt)"`.
- **`--dangerously-skip-permissions` é obrigatório** em `--print` (reconfirmado em 1.1.24, 2026-09-03). Sem ela o headless morre com
  `a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied`
  e **não produz ficheiro**. ⚠ Esta instrução **já esteve ao contrário** (na 1.1.5 a flag partia o
  `--print`): é a segunda inversão. Se o `agy --version` não corresponder, **testar antes de confiar**.
- Sem a flag, o `agy` **escreve o ficheiro mesmo reportando erro de permissão** — verificar sempre
  pelo **artefacto** (`ls`), nunca pelo código de saída nem pela última linha do log.
- **Não existe flag `-i` de imagem no `agy`** (`-i` é alias de `--prompt-interactive`). Referências
  vão como **caminhos absolutos no corpo do prompt**, com instrução explícita de os ler primeiro.
  O CLI declara aceitar **até 3 refs** (o `codex` aceita 5).
- **Onde aterra:** muda entre versões — 1.1.12 em `~/.gemini/antigravity-cli/brain/<session-id>/`,
  1.1.15+ em `~/.gemini/antigravity-cli/scratch/<nome>.png` (às vezes com cópia na home); **1.1.24 grava
  o mesmo ficheiro em 3 sítios** — `brain/<session-id>/`, `scratch/` e a raiz `~/.gemini/antigravity-cli/`
  (verificado 2026-09-03). Fixar o nome no prompt (`Name the generated image file EXACTLY: <nome>`) e
  **localizar por nome** (`find ~/.gemini/antigravity-cli ~ -name '<nome>.*'`), nunca "o mais recente" nem uma pasta fixa.
- **`--add-dir` não é destino de escrita.** O agy decide sozinho onde grava (1.ª pasta do `--add-dir`,
  raiz do projecto, ou as duas — medido 1.1.16/1.1.17). Localizar por nome e mover.
- **O `scratch/` do agy é volátil, não é o scratchpad da sessão:** nome igual numa geração seguinte
  sobrescreve sem aviso, e o `/save` não o vigia. **O entregável aceite sai do `scratch/` para o
  projecto no mesmo turno.**
- **Filtro de conteúdo e figuras infantis:** descrever o CORPO de uma criança («toddler-like», «chubby»,
  «rounded belly») é recusado (`violate Google's Generative AI Prohibited Use policy`), mesmo para um
  boneco. **Descrever a escultura, não o corpo** — «shorten the lower half of the sculpt», «trouser
  section becomes two short cylindrical forms» — passa e dá a mesma proporção (medido 1.1.16, 2026-08-21).
- **Uma geração demora >2 min → a shell mata-a em primeiro plano (exit 143).** Lote:
  **um só script para as N imagens, lançado como UM job** `run_in_background` (nunca N jobs), com log
  por imagem e tecto por imagem (≤4 min); acompanhar o log / `until [ -f <ficheiro> ]; do ...; done` e
  devolver só no fim. Mesma regra do lote OpenAI (`.claude/agents/img-gen-openai.md` §«Lote de N imagens»).
- **O `agy` diz que gerou e não deixa ficheiro — também sozinho, e repete-se no mesmo prompt.** Medido
  em 1.1.24 (2026-09-03): o log afirma «The image <nome>.png has been generated», exit 0, e não há
  ficheiro em `~/.gemini/antigravity-cli/**` nem na home; a 2.ª tentativa correu **sem concorrência** e
  falhou igual. Não é o paralelismo. Regra: confirmar com `find ~/.gemini/antigravity-cli ~ -name '<nome>.*'`
  depois de cada chamada; **ao fim de 2 falhas no mesmo prompt, reformular o prompt** (trata-se como
  recusa silenciosa do modelo), nunca repetir uma 3.ª vez igual.
- **Gerar é chamar o gerador.** O `agy` tem shell e, quando a geração falha, tende a escrever um
  script PIL/matplotlib/SVG e a chamar-lhe imagem. Proibir no prompt; se o gerador não correr,
  reportar e parar.

### Text in image — verbatim protocol (both models, critical for OpenAI)
- Quote literal text in quotes or ALL CAPS; spell tricky words letter-by-letter.
- Specify typography + placement; forbid extra/garbled characters ("no extra text").
- Baseline avoid-list on most briefs: "no logos or trademarks, no watermark" (+ "no text" for icons/textures).
- **Faithfully recreating an existing text-heavy layout is still off the table** — the model redraws, it does not copy. If the user insists anyway, the only technique with a usable result is section-by-section regeneration + stitching: see `.claude/agents/img-gen-openai.md` § "If the user insists: section-by-section regeneration" (it carries the 4 traps that make the naive version fail).

## 2.5 Editing existing images (invariants + roles)

Generative edits drift — discipline prevents it:
- **Label every input by index + role:** "Image 1: edit target · Image 2: style reference · Image 3: compositing input." Never assume a provided image is the edit target.
- **Declare invariants:** phrase as "change only X; keep Y unchanged" and **repeat the invariants on every iteration.**
- **Série de mockups/variantes = edição de uma imagem-base comum, nunca gerações de raiz.** Placas por
  fase geradas de raiz saíram com cenários diferentes e foram reprovadas; só ficaram coerentes quando
  todas as variantes foram edição da mesma imagem-base. Regra por omissão no brief de qualquer série.
- **One targeted change per iteration**, then re-check against the invariant + avoid list.
- Compositing: describe the interaction ("place subject from Image 2 into the scene of Image 1, matching its lighting").
- Masks / `input_fidelity` / background-transparency → these are CLI-only params (`img-gen-openai`), never on a built-in tool.
- **O gpt-image-2 redesenha, não retoca.** Em 5 gerações com instrução para copiar as formas mudou
  sempre lettering, silhuetas, ícones e a base — e os textos curtos sobreviveram, logo a verificação
  por texto dá verde com a forma errada. Para preservar a peça real: **gerar só o cenário e compor a
  peça real por cima** (recorte com alfa); verificar por FORMA, não por texto (2026-08-31).
- **Ecrã real em aparelho inclinado → perspectiva, nunca rectângulo direito.** Colar o ecrã direito
  num telemóvel/portátil em ângulo foi apontado logo pelo utilizador. Receita: gerar a cena com a zona do
  ecrã pintada a **magenta** → localizar os **4 cantos** → `img.transform(size, Image.PERSPECTIVE,
  coefs, Image.BICUBIC)` com o ecrã real, **na resolução final** (não reescalar depois). Em grelhas
  (ícones, apps), derivar os cantos dos **vectores da grelha**, não da zona pintada pela IA (as bordas
  dela são irregulares).
- **Retoque local sem regenerar a cena.** Defeito pequeno (cápsulas, um rótulo) numa imagem aprovada:
  **recortar** a zona → img2img só do recorte → **colar com máscara** (feather) na original →
  **provar diff 0 px fora da máscara** (`numpy`: `abs(a-b)[~mascara].max() == 0`). Sem a prova do diff,
  não é retoque, é regeneração disfarçada (2026-10-01).

### Coupled attributes — the most expensive edit failure
Asking for **one** attribute to change makes the model drag its neighbours in the same aesthetic direction. Observed: "make the cars more realistic" calmed the whole **background** — smaller explosion, thinner speed streaks, sparser embers. None of it was requested, and none of it was named in the prompt.

Two references with declared distinct roles ("Image 1: keep this background · Image 2: cars only") **do not** fix it — the model averages the two instead of splitting them. Two rules that do:

- **(a) Counter-instruction on the coupled invariant.** Name the direction the error is allowed to take, so drift has nowhere cheap to go: *"increase the realism of the cars; the background stays the same or gets MORE intense — if it fails, let it fail towards MORE fire, never less."* An invariant with no declared failure direction always collapses towards "calmer".
- **(b) Localise by physical/anatomical region, not by object.** *"Everything that lives IN THE AIR stays exactly as it is (explosion, smoke, embers, streaks); only the bodywork surface changes."* A spatial boundary is obeyed; a semantic boundary ("only the cars") is re-read as an aesthetic direction and applied to the whole frame.

### Reference limits & CLI argument order (`codex -i`)
- **Hard cap of 5 references.** More than that fails with `referenced_image_paths must contain at most 5 paths`. A brief that asked for 8 refs errored and the agent had to fall back to 5 mid-run. Pick the ≤5 most authoritative refs (the canonical scene, the real logo file) and drop the rest.
- **Prompt first, `-i` last.** `-i` is variadic: `codex exec -i ref.png "PROMPT"` swallows the prompt as a second image and codex then hangs on "No prompt provided via stdin". Either put the prompt before the `-i` flags or pass it via stdin. This recurred across projects — it is a CLI gotcha, not a project detail.
- **Verified full invocation — `codex exec "PROMPT"` alone is not it.** On the machines measured the bare form fails *every* time with `Not inside a trusted directory and --skip-git-repo-check was not specified`, followed by `Reading additional input from stdin...` and it hangs there (cost: 3 failed calls before anyone read the second line). The invocation that works:
  ```bash
  codex exec --skip-git-repo-check "$(cat prompt.txt)" -i ref.png < /dev/null
  ```
  `--skip-git-repo-check` unblocks the run, `< /dev/null` closes stdin so it cannot hang waiting for more input, and the argument order still obeys the rule above — prompt first, `-i` at the end.
- **Timeout / `exit 124` is not a failure until the output file says so.** `codex exec` has hung *after* writing a valid image (timeout 600 s, exit 124, `bg.png` already complete). Before retrying or reporting failure, check the output file first: it exists, `file` says `PNG image data, WxH`, and it opens. Only a missing/invalid file is a failed generation.
- **Mockup/application of an existing brand → always attach the real logo file via `-i`.** Describing the mark in words produces the wrong symbol (observed on a first pass for a client brand; fix required a full regeneration). Add the brand's usage rules to the prompt too; never let the model draw a logo from a verbal description.
- **Third-party brands as reference are a brand risk.** Passing real competitor/inspiration marks as refs makes the model drift visibly towards them — 3 of 6 outputs landed close to their reference *despite* an explicit "do not copy" in the prompt. "Do not copy" is not enough: compare each output against the refs and flag collisions to the user.
- **Model-only rendering (`NO_CODE_OVERLAY`).** Given a scene + a logo ref, Codex sometimes decides on its own to write a Python/PIL `alpha_composite` script and paste the logo instead of generating it (caught in the `codex exec` log: `ink.putalpha(...)`; the user rejected the result as "still looks pasted on"). When the brief requires everything rendered by the model, put the prohibition in the prompt verbatim: *"Do NOT write or run any Python/PIL/ImageMagick script to composite text or logos onto the image — render everything through the native image generation/edit tool only."*

### Product shots with fixed layout/colour (refs)
- **Use the official composite/scene photo as the single reference**, not loose individual components. Passing separate bottles/objects as refs makes gpt-image-2 invent composition and colour (observed: Rosé rendered coral/peach, capsule colour wrong, variants swapped). One canonical scene ref preserves identity.
- **"Label-fix 2-ref" recipe** — fixing a typo on a label in an AI product photo without regenerating from scratch: img2img with **two** refs (`-i` base scene + `-i` the real product mockup) and the instruction "copy label EXACTLY from image 2, reproduce scene from image 1", plus the text spelled out line by line. Validated on vertical/front-facing bottles; fails on small text at extreme angles (e.g. a pouring bottle) — regenerate there.
- **"Real glass vs mockup" 2nd pass:** first generation often looks like a flat mockup. A second pass emphasising "real photographed glass / physical product, natural reflections" corrects the plastic/flat look.

## 2.6 Outpaint / mudar de racio — a AI so nas bandas novas

Pedido tipico: «poe isto em A4», «faz 16:9 sem cortar». Nao e gerar de raiz nem editar por
referencia — e **estender a tela preservando o conteudo**. Receita medida (2026-08-28):

1. **Tela do racio final com bandas BRANCAS** — o original colado na sua posicao, o resto branco.
2. **Gerar so as bandas:** prompt a mandar preencher **apenas as areas brancas**, continuando a cena.
3. **MEDIR a transformacao** entre o original e o resultado. O modelo reescala e desloca a imagem
   inteira sem o dizer:
   ```python
   import cv2, numpy as np
   sift = cv2.SIFT_create()
   k1, d1 = sift.detectAndCompute(cv2.cvtColor(orig, cv2.COLOR_BGR2GRAY), None)
   k2, d2 = sift.detectAndCompute(cv2.cvtColor(saida, cv2.COLOR_BGR2GRAY), None)
   pares = cv2.BFMatcher().knnMatch(d1, d2, k=2)
   bons = [a for a, b in pares if a.distance < 0.75 * b.distance]
   src = np.float32([k1[m.queryIdx].pt for m in bons]).reshape(-1, 1, 2)
   dst = np.float32([k2[m.trainIdx].pt for m in bons]).reshape(-1, 1, 2)
   M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC)
   escala = float(np.hypot(M[0, 0], M[1, 0]))          # ler ANTES de construir seja o que for
   ```
4. **Recompor o original por cima**, em resolucao maxima, com `cv2.warpAffine` usando `M`; suavizar
   as juntas com feather por `cv2.distanceTransform`. Resultado: **so a area que faltava e AI**.

⚠ **Comparar duas imagens de tamanhos diferentes a olho nao e medicao.** Numa sessao real concluiu-se
«o modelo reflui a composicao» e construiu-se em cima disso um pipeline de 4 tiras com registo por
correlacao de fase — deitado fora quando o SIFT mostrou que as 4 transformacoes eram **identicas**
(escala 0,7785 · rotacao 0,02 graus · translacao 107 px). A tela tinha ficado mais larga; nada se
tinha mexido dentro dela.

⚠ **Nao ha mascara por aqui.** O endpoint `edits` da API da OpenAI aceita mascara, mas **o `codex`
nao a expoe** (o CLI de fallback expoe, mas exige `OPENAI_API_KEY` — ver a politica de modelo em §1).
A recomposicao do passo 4 e o que substitui a mascara.

`cv2` (opencv-python) verificado a 2026-09-09: **4.13.0**, com `SIFT_create`,
`estimateAffinePartial2D`, `warpAffine` e `distanceTransform`.
## 3. Agent invocation

Spawn with structured brief:

```
BRIEF: [what the user wants]
STYLE/MOOD: [visual direction]
TEXT IN IMAGE: [exact text, or "none"]
OUTPUT: [path, or "auto"]
ASPECT: [16:9 / 1:1 / portrait / etc.] + tamanho em píxeis («EXACTLY WxH pixels»)
QUALITY: [draft / standard / final]
REFERENCES: [paths to reference images, or "none"]
DEFEITOS BLOQUEANTES: [o que falha o objectivo do pedido → regenerar]
DEFEITOS TOLERADOS: [limites conhecidos do modelo que não afectam o uso → aceitar e anotar, não parar]
```

Sem as duas linhas de defeitos, o agente pára a perguntar por um defeito conhecido e aceitável (números
de casas repetidos num conceito que era só referência de estilo) — e regenerar não o corrige.

If spawning both: launch `img-gen-openai` and `img-gen-google` in parallel.

## 4. After generation

**Validate** before iterating: subject, style, composition, text accuracy, invariants/avoid honored.

**Critério de aceitação é uma ACÇÃO, nunca uma pergunta sim/não.** «O circuito está fechado?» ou «o
texto está certo?» devolve um «sim» superficial — a confirmação sai sem se ter olhado para a
propriedade. Escrever o critério como coisa a executar sobre a imagem: **percorrer** o caminho do
início ao fim e dizer onde passa, **contar** os elementos, **comparar** lado a lado com a referência
e listar as diferenças. O relatório traz o resultado da acção (a contagem, o percurso), não o «sim».

**O asset real manda sobre o documento que o descreve.** Um `Branding.md`/brandguide/briefing que
DESCREVE um produto é fonte secundária. Antes de reportar «divergência de produto» (cor, rótulo,
forma), abrir o ficheiro de referência real **ampliado** e comparar com ele — o documento pode estar
desactualizado ou errado, e o defeito declarado a partir dele é falso.

**A direction the user picked is a visual CONTRACT — match it, do not systematise it.** Generating "a cleaner, more coherent" reading of the frame they chose is substituting your taste for theirs; it cost a full generation round and ~1M tokens once. Put the deliverable **side by side with the chosen reference** and ask "is this the same style?" before presenting. Full rule: `.claude/skills/design-shotgun.md` §4.
**Medir o rácio no ficheiro, não no pedido.** `sips -g pixelWidth -g pixelHeight <f>` (macOS) ou
`python3 -c "from PIL import Image;print(Image.open('f.png').size)"`. Pedido fora da lista suportada
cai no vizinho **em silêncio** — o ficheiro existe e está errado.

**Ficheiro para impressão = mm + dpi, não píxeis soltos.** Tela = `mm / 25.4 * dpi` (A4 300 dpi →
2480×3508). Exportar com `Image.save(dest, "PDF", resolution=300)` e provar a página:
`grep -a -o "/MediaBox *\[[^]]*\]" dest.pdf` → `[ 0 0 595.2 841.92 ]` para A4 (testado 2026-09-15).

**Folha de contacto antes de aceitar um lote.** Um conjunto que tem de ler como sistema (avatares,
ícones, posts do mês) não se valida imagem a imagem: montar N×N num só PNG e olhar. Apanhou 2 de 9
ilegíveis num olhar, e reduziu 23 leituras de imagem a 3.

```bash
# montagem 3×3 (ffmpeg; testado). O scale+pad é obrigatório: o tile assume células iguais
ffmpeg -y -pattern_type glob -i 'out*.png' -filter_complex \
  "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,tile=3x3:margin=8:padding=8" \
  -frames:v 1 contact.png
```

**Wordmarks inventados.** Modelos fotorrealistas escrevem marcas falsas em roupa e equipamento —
3 em 3 gerações com pessoas em plano próximo. Passam despercebidas porque são ilegíveis. Procurar
com **zoom** em vestuário/equipamento antes de aceitar. Se houver remoção por clonagem (PIL):
máscara com blur ≥3 numa caixa pequena dilui a opacidade para ~50 % e deixa o logótipo **translúcido
por baixo** — verificar por **luminância máxima da caixa vs tecido de referência**, não a olho.

**Format ≠ content.** `file out.png` saying "PNG image data" proves nothing about what is in it. Several agents accepted a downloaded asset on `file` alone and shipped the Chinese handset maker's logo instead of the Brazilian carrier Vivo — a perfectly valid PNG of the wrong company. Any asset fetched from search must be *looked at* before it is accepted.

**Fan-out collision check.** After N parallel image generations, `md5` all outputs. Byte-identical files mean the copy step grabbed another session's PNG (`~/.codex/generated_images/` is shared) — regenerate, don't ship.

**Deriving a family (variants of an approved asset):** every `codex exec` redraws the shape — angles, stroke widths and proportions change between generations, so asking the model for "the inverted one", "the mono" and "the favicon" gives N similar drawings, not one mark. Variants of an approved asset are derived by **processing** (Pillow: split by colour mask, recolour, crop, scale), never by regeneration. Regenerating is fine to *explore*; never to produce the final family.

**Never trust the CLI's claim that it saved the file.** `codex exec` answers "Image saved at <dest>" while the PNG only ever exists in `~/.codex/generated_images/<session-id>/` — it does not write to network/UNC paths (`G:\…`) at all. Copy from the session folder, then prove the destination: `file dest.png` must say `PNG image data, WxH` (one run copied a redirected `.log` and wrote 6 KB of text with a `.png` extension). Do not redirect logs into the folder the copy step scans.

**List the whole destination folder at the end, not just the expected names.** With `--dangerously-bypass-approvals-and-sandbox`, codex invents extra unrequested files on its own initiative (a whole fictional "social pack" with plausible names). Delete what was not asked for before reporting.

**Save-path discipline (non-destructive) — ⛔ regra dura:**
- **`test -f <destino>` ANTES de escrever.** Se existir → **nome irmão versionado** (`hero-v2.png`).
  Escrever por cima de um ficheiro existente é **irreversível**: dois emblemas já aprovados pelo
  utilizador foram sobrescritos numa geração seguinte e só se recuperaram por sorte, do cache do
  codex. Só se sobrescreve quando o utilizador pediu **substituição** explicitamente.
  ```bash
  test -f "$DEST" && DEST="${DEST%.png}-v2.png"; cp "$SRC" "$DEST"
  ```
- Never leave a project-referenced asset only at a CLI default temp path — move it into the project workspace.

**Detectar PNG falso (extensão ≠ conteúdo).** O destino tem de ser provado, não assumido:
```bash
file "$DEST"   # tem de dizer: PNG image data, WxH
```
Uma corrida copiou um `.log` redireccionado e escreveu 6 KB de **texto** com extensão `.png`. Não
redireccionar logs para a pasta que o passo de cópia varre. (Formato ≠ conteúdo — ver acima.)

**Report:** taxonomy slug, CLI used, final saved path(s), final prompt, key parameters. If multiple images, list all paths.

**Colour-faithful conversion:** for "convert without changing colours" (e.g. JPG→WEBP), check the source colour space first. **ffmpeg shifts CMYK** images (with ICC profile) — it treats the 4th channel as YUV/alpha. Use **Pillow** instead: `ImageCms.profileToProfile(img, src_icc, srgb, outputMode='RGB')` then save WEBP `lossless=True, exact=True`. ffmpeg is fine for RGB sources.

**Never drop the alpha channel in a conversion pipeline.** `Image.open(x).convert("RGB")` discards transparency silently and bakes a black background. Check `im.mode` (`RGBA`/`LA`/`P` with `transparency`) *before* converting, and preserve the source format rather than flattening. Alarm signal: when several layers of the system "compensate" for the same anomaly (three design variants masking it with `mix-blend-mode`), suspect the asset, not the CSS.

**Rasterizing SVG on macOS:** use `cairosvg` (respects the `viewBox`). `qlmanage -t` is the obvious native path and is wrong here — it forces a square thumbnail and crops horizontal lockups, which looks like a broken SVG when it isn't. Note: recent macOS system pip is PEP-668, so create a `.venv` in the project before installing.

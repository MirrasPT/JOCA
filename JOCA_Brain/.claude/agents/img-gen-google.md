---
name: img-gen-google
description: "imagem via Gemini: drafts, fundos"
tools: Bash, Read
model: inherit
modelo-sugerido: sonnet
effort-sugerido: medium
porque-modelo: "escreve o prompt e corre o script de geração"
triggers: gerar imagem, imagem com google, imagen, nano banana
---

Image generation agent using Google's Gemini via the **Antigravity CLI (agy)**.

## Step 0 — Read the skill (mandatory)

`Read(".claude/skills/img-gen.md")` antes de construir o prompt.

## ⛔ Hard limits (não negociáveis)

**1. Gerar é chamar o gerador.** O `agy` tem shell e, quando a geração falha, tende a escrever um
script PIL/matplotlib/SVG procedural e a chamar-lhe conceito. Produz um ficheiro plausível e reporta
sucesso — falha silenciosa. Proibido. Se o modelo de imagem não correr: reportar e parar. (PIL em
**pós-processamento** sobre uma imagem gerada é legítimo; PIL **em vez** do gerador não é.)

**2. Primeiro plano, um `agy` por agente.** Nunca `run_in_background`/`&`/`Start-Job` — quando a
sessão do agente acaba, os filhos morrem e não sai nada. Paralelismo faz-se com N agentes, cada um
síncrono e com o nome de ficheiro fixado no prompt.

**3. Destino próprio; nunca apagar o que não criaste.** Num fan-out, ficheiros que aparecem a meio na
pasta são de outro worker — não são lixo a limpar.

**4. Nunca sobrescrever um ficheiro existente.** `test -f` antes de escrever; se existir, nome irmão
versionado. Asset aprovado pelo utilizador = acção irreversível.

**5. Gotchas de CLI têm validade.** Cada nota de invocação nesta página traz a versão e a data em que
foi validada. Se o `agy --version` não corresponder, **testar antes de confiar** — este ficheiro já
esteve com a instrução exactamente ao contrário da realidade **duas vezes**: stdin vs argumento (custou
8 agentes a perder tentativas) e a flag `--dangerously-skip-permissions` (fora na 1.1.9, obrigatória na
1.1.12). Por isso a invocação escolhe-se pelo **passo de auto-detecção** abaixo, não pela tabela.

## Before generating

1. If `DESIGN.md` or `BRAND.md` exists at project root: read for colours, typography, visual style
2. Apply brand context to the prompt

## Auth check

```bash
agy --version 2>/dev/null || echo "AGY_NOT_INSTALLED"
```

Requer `agy` (Antigravity CLI) no PATH. Se faltar: reporta ao user e pára — NÃO tentes instalar por ti.

## Image generation via agy

**CRITICAL — a invocação do `agy` já se inverteu DUAS vezes** (stdin↔argumento, que custou 8 agentes;
e depois a flag `--dangerously-skip-permissions`, ligada→desligada→ligada). **A tabela de versões
caduca a cada release. O passo de auto-detecção não.** Detectar primeiro, tabela só como palpite inicial.

### Passo de auto-detecção (fazer SEMPRE, antes da geração a sério)

Uma geração de teste barata, e a invocação escolhe-se **pelo erro que sai**, não pela versão:

```bash
agy --version            # regista a versão no relatório, mas não decidas só por ela
cd "$TMP" && agy --print-timeout 3m --print "Generate a tiny 1:1 test image of a red square. Name the generated image file EXACTLY: agytest.png"
```

Ler o output e classificar:

| O que o erro/output diz | Invocação a usar |
|---|---|
| `a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied` (ou qualquer `auto-denied`/`permission`) | **ACRESCENTAR** `--dangerously-skip-permissions` |
| O modelo responde com uma lecture *sobre a própria flag* em vez de executar o prompt | **REMOVER** `--dangerously-skip-permissions` |
| Imprime o `--help` e não gera nada | O prompt não está a ser lido como argumento → tentar a forma legada por STDIN |
| Fica pendurado sem output | Fechar stdin (`< /dev/null`) e/ou trocar argumento↔stdin |
| Estourou o tecto (`exit 124` do `timeout`, ou o `--print-timeout`) sem ficheiro | **Reportar falha logo** e parar — não esperar em silêncio nem relançar às cegas |

**Tecto curto em TODA a geração, abaixo do watchdog de 600 s do agente** (caso real 2026-09-25: o agy
pendurou 600 s e o watchdog matou o agente; só ficou o `.prompt.txt`). Dois travões, porque o `timeout`
do GNU coreutils não existe no macOS sem `brew install coreutils` (`gtimeout`); o `--print-timeout` é
do próprio agy (`agy --help`, medido 1.2.14 a 2026-10-01):
```bash
T=$(command -v timeout || command -v gtimeout)   # vazio no Mac sem coreutils → fica só o --print-timeout
${T:+$T 270} agy --dangerously-skip-permissions --add-dir <dir> --print-timeout 4m --print "$(cat prompt.txt)"
```

Depois de a geração de teste produzir **um ficheiro de imagem verificado**, fixar essa invocação para
todas as gerações da sessão. Registar no relatório qual saiu vencedora + a versão do `agy`.

**Palpites iniciais por versão (histórico — validar com o passo acima, não confiar):**

**agy ≥ 1.1.16 (medido 2026-08-21, ~15 gerações em 1.1.16/1.1.17; instalado nesta máquina a
2026-09-09: `1.1.28`):** **todas as flags ANTES de `--print`, prompt como ÚLTIMO argumento.**

```bash
# agy >= 1.1.16 — flags primeiro, prompt no fim
agy --dangerously-skip-permissions --add-dir <dir> --print "$(cat prompt.txt)"
```

⚠ **`--add-dir` só acrescenta a pasta ao workspace — não é o destino de escrita** (`agy --help`: «Add a
directory to the workspace»). O agy grava onde decide (1.ª pasta do `--add-dir`, raiz do projecto, ou as
duas), ignorando o nome pedido — medido 1.1.16/1.1.17. Localizar **por nome** e mover para o destino.

⚠ **O padrão da entrada seguinte falha em SILÊNCIO nestas versões.** Com
`agy --print --dangerously-skip-permissions "…"`, o `--print` engole a flag **como sendo o valor do
próprio prompt**: o agy responde com uma explicação sobre a flag em vez de gerar, sai **`exit 0`**,
e **nenhuma imagem é produzida**. A regra segura é uma só: **o que vem logo a seguir a `--print` tem
de ser o prompt** — ou põe-se `--print` no fim, com o prompt colado a ele.

⚠ **Esta tabela já inverteu DUAS vezes** (1.1.9→1.1.12 mudou a *presença* da flag; 1.1.12→1.1.16
mudou a *ordem*). O passo de auto-detecção acima manda sempre — validar por **geração real** antes
de confiar em qualquer linha desta secção.

**agy ≥ 1.1.12 (relatado 2026-08-13 numa sessão real; NÃO re-validado por geração — instalado nesta
máquina a 2026-08-20: `1.1.13`):** prompt como **argumento** e a flag
`--dangerously-skip-permissions` **LIGADA**. Sem ela o `--print` headless morre com
`a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied`
e **não produz ficheiro nenhum**. Isto é o **inverso** do que valia na 1.1.9.

```bash
# agy >= 1.1.12 — argumento + flag LIGADA
agy --print --dangerously-skip-permissions "$(cat prompt.txt)" --print-timeout 4m
```

**agy 1.1.5–1.1.11 (validado 2026-08-03, 4 gerações):** o prompt vai como **argumento** e a flag
`--dangerously-skip-permissions` fica **de fora** (partia o `--print` — o modelo responde com uma
lecture sobre a própria flag em vez de executar o prompt). Piping via stdin não funciona: imprime
o help e não gera nada.

```bash
# agy 1.1.5–1.1.11 — prompt como argumento, SEM a flag
agy --print "$(cat prompt.txt)" --print-timeout 4m
```

**agy ≤ 1.1.4 (legado):** o prompt lia-se de STDIN e passar como argumento pendurava o processo.

```bash
# legado — só para versões antigas
echo "Generate an image: PROMPT_HERE. Save the generated image to OUTPUT_PATH." \
  | agy --print --dangerously-skip-permissions
```

**⚠ O `agy` escreve o ficheiro mesmo quando reporta erro de permissão no fim.** Confirmado noutra
sessão: o log termina em erro, o exit code é diferente de zero, e o PNG **está lá na mesma**.
Verificar sempre **pelo artefacto** (`ls`/`file`/`Read` da imagem no `brain/<session-id>/`), nunca
pelo código de saída nem pela última linha do log. Um "falhou" lido do exit code já mandou agentes
regenerar trabalho que estava feito.

**⚠ O inverso também acontece: o log diz que gerou e não há ficheiro.** Medido em 1.1.24
(2026-09-03): «The image <nome>.png has been generated…», exit 0, zero ficheiros em
`~/.gemini/antigravity-cli/**` e na home — e a 2.ª tentativa, **sozinha**, falhou igual. Não é culpa do
paralelismo; repete-se por prompt. Depois de cada chamada:
`find ~/.gemini/antigravity-cli ~ -name '<nome>.*'`. **2 falhas no mesmo prompt → reformular o prompt**
(recusa silenciosa) em vez de repetir; se a reformulação também falhar, reportar e parar.

**Onde aterra o ficheiro:** o `Save the generated image to:` do prompt é sugestão, não garantia —
o PNG/JPG aparece em `~/.gemini/antigravity-cli/brain/<session-id>/<nome>.jpg` (ou `scratch/`); a
**1.1.24 grava em 3 sítios** (`brain/<session-id>/`, `scratch/` e a raiz `~/.gemini/antigravity-cli/`,
verificado 2026-09-03, com `--dangerously-skip-permissions` ainda obrigatório). Copiar para o destino
**no mesmo turno**: o `scratch/` é volátil e um nome igual sobrescreve-o sem aviso. Pedir no prompt `Name the generated image file EXACTLY: <nome>` e
recolher **por nome** — nunca "o mais recente".

**Paralelismo:** com nome de ficheiro fixado por prompt, correr vários `agy` em simultâneo é
seguro (3 concorrentes validados, sem 429 e sem troca de outputs). A regra de correr sequencial
aplica-se ao **codex/gpt-image-2**, que partilha a temp dir por sessão.

For complex prompts, write the full brief to a temp file and pass it as an argument:

```
Generate an image with these specifications:
Subject: [subject]
Style: [style]
Aspect ratio: [ratio]
Colour palette: [colours]
Mood: [atmosphere]
Reference images to read first: [absolute paths, if any]
Save the generated image as: OUTPUT_PATH
```

Notes:
- **Imagens de referência (histórico — ler a data antes de confiar):** `agy` é agêntico e lê ficheiros
  locais, mas o *modelo de imagem* nem sempre condicionou neles. Estado por versão:
  `≤1.1.3` → sem reference-conditioning (3 conceitos saíram fora da família por isto);
  `≥1.1.4 / Nano Banana 2` → **aceita multi-image reference** (validado: 8 refs lidas, formas casadas),
  fraco em texto pequeno. Não existe flag `-i` no `agy` (`-i` é alias de `--prompt-interactive`) —
  os caminhos **absolutos** vão no corpo do prompt com instrução explícita de os ler primeiro.
  Confirmar com `agy --version` e, se o resultado ignorar a referência, dizê-lo em vez de assumir.
- The model's text reply is rendered to the TUI and is **not** reliably captured by stdout pipes —
  do not rely on stdout. Verify success by checking the saved file instead.
- Recolher **por nome fixado no prompt**, nunca "o PNG mais recente" — em paralelo, o mais recente é
  o de outro agente (foi assim que um Alvarinho saiu com o rótulo do Loureiro).
- **Aspect ratio — o `agy` RESPEITA rácios (medido 2026-08-13).** Devolveu **1376×768 para 16:9** e
  **928×1152 para 4:5**, desvio ~0,8 %. A nota anterior desta página ("só produz 1:1 1024×1024, ignora
  o rácio") era **falsa** e mandava trabalho não-quadrado para um fornecedor pago sem necessidade.
  Condições: o rácio tem de ser **instrução imperativa em texto corrido** ("Generate a 16:9 image"),
  e a lista declarada é **1:1 · 16:9 · 9:16 · 4:3 · 3:4 · 3:2 · 2:3** — um rácio fora da lista cai no
  vizinho mais próximo. ⚠ **4:5 (Feed Instagram) está FORA da lista declarada** e é o formato de todo
  o trabalho de redes sociais deste utilizador: saiu utilizável, mas por *snap*, não por garantia.
  **Medir sempre o ficheiro produzido** (`file`/`identify`/`Image.open(...).size`), nunca assumir o
  rácio pedido. Só ir a `img-gen-openai` quando o rácio tem de ser **exacto** ou está fora da lista
  (gpt-image-2 honra 16:9 nativamente, ~1672×941; upscale a 2K com
  `ffmpeg -vf scale=2048:1152:flags=lanczos`).

## Prompt construction rules

Lead with style, follow with subject. Gemini responds well to adjective-first, descriptive language.

**General structure:**
```
[Style adjective(s)], [subject] [in/on/at context], [colour palette], [mood/atmosphere]
```

**Good examples:**
```
Minimalist flat illustration of a fluffy golden retriever sitting in autumn leaves, warm amber palette, soft light

Photorealistic misty mountain lake at dawn, pine forest reflection, cool blue-green tones, cinematic

Abstract geometric pattern, overlapping translucent circles in coral, teal, gold on deep navy
```

**Style vocabulary:**
- `Minimalist`, `Flat illustration`, `Photorealistic`, `Watercolour`, `Isometric`, `Abstract`
- `Cinematic`, `Editorial`, `Concept art`, `Digital painting`, `3D render`

**Filtro de conteúdo — figura infantil (boneco, brinquedo):** descrever a **escultura** («shorten the
lower half of the sculpt», «two short cylindrical forms»), nunca o corpo («toddler-like», «chubby»,
«rounded belly» → recusa `violate Google's Generative AI Prohibited Use policy`). Medido 1.1.16, 2026-08-21.

**Avoid:**
- Text in image (unreliable — use img-gen-openai for text)
- Extremely precise spatial layouts
- Exact brand reproduction

## Product shots (bottle/packaging)

Structure the prompt as a brief:

```
Professional product photography of [product description].
Setting: [scene — marble table, cellar, etc.]
Position: [centred upright, slight angle, etc.]
Props: [secondary elements]
Lighting: [soft diffused, golden hour, etc.]
Style: [photorealistic editorial, dark moody luxury, etc.]
No text overlay, no hands, no label distortion.
```

## Aspect ratio hints

Include in the prompt:
- `square format (1:1)` — default
- `widescreen landscape (16:9)` — website hero
- `vertical portrait (9:16)` — mobile/stories
- `ultrawide (21:9)` — cinematic banner

## Output

After successful generation, report:
```
✓ Image generated via agy (Antigravity CLI)
  Path: [output path]
  Prompt: [first 80 chars...]
```

If error: report clearly and stop.

Critério de aceitação do brief = **acção executada sobre a imagem** (percorrer, contar, comparar com a
referência), nunca «sim» a uma pergunta fechada — o relatório traz o resultado dessa acção (`img-gen.md` §4).

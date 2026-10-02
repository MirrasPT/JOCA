---
name: raster-para-vector
description: "Vectorizar um raster (logo, marca, glifo, ícone) com fidelidade MENSURÁVEL — não à sorte: traçar, rasterizar de volta, sobrepor e medir IoU contra o original. MUST be invoked when the user says: vectorizar, raster para vector, PNG para SVG, traçar logo, converter logo em vetor, transformar imagem em SVG, preciso do vetor deste logo. SHOULD also invoke when: há várias marcas/glifos de um sistema de identidade para vectorizar em lote, ou o pedido é 'igualzinho ao original'/'fiel ao raster'."
triggers: vectorizar, raster para vector, raster to vector, PNG para SVG, traçar logo, converter logo em vetor, vtracer, potrace, fidelidade de vectorização, IoU, vector trace, logo em vetor, image trace
chain: image-upscale, graphic-design, brand-guidelines
origin: local
---

# raster-para-vector — vectorizar com número, não com olho

Nasce de uma sessão real: 25 marcas de um sistema de identidade vectorizadas a **IoU 0,96–0,99**.
"Vectoriza igualzinho" é uma exigência mensurável — trata-se como tal. O ganho não estava na
ferramenta: estava no passo ANTES dela (binarizar cada marca a 1 cor levou de 468 caminhos para 3
por marca, com a mesma fidelidade).

⚠ **Traçado automático não é logo de produção.** Serve para reproduzir fielmente um raster já
existente (escala, corte, impressão) — não substitui um vector desenhado de propósito. Se o pedido
é "preciso do logo em vetor" para um redesenho, isto não é a skill certa.

Ampliar/restaurar o raster ANTES de traçar → `image-upscale`. Vectorizar é o passo seguinte, não
o mesmo trabalho.

## O ciclo (é o núcleo da skill)

```
1. Recortar o raster com segurança (ver gotcha crop() abaixo)
2. Binarizar a 1 cor (tinta vs fundo)
3. Traçar (vtracer — o `potrace` não está instalado nesta máquina)
4. Rasterizar o SVG de volta, ao MESMO tamanho do raster original (Chrome headless — §3)
5. Sobrepor as duas máscaras e medir IoU
6. IoU abaixo do limiar → ajustar parâmetros de traçado, voltar ao passo 3
```

Sem o passo 4-5, "igualzinho" é opinião. Com eles, é um número reprodutível.

## 1. Preparar — recorte e binarização

**Recorte seguro (crítico, não é do vectorizador):**
`PIL.Image.crop()` com uma caixa que sai dos limites da imagem **preenche a PRETO**, não a branco
— documentado, mas ninguém lê antes de ser mordido. Num pipeline que binariza por "tinta = pixel
escuro", essa banda preta entra como tinta, a cor mediana da peça dá `#000000`, e o vectorizador
traça a tela inteira em vez da marca. Resultado: **IoU 0,0000 em TODAS as peças, sem um único
erro de execução.**

> **Assinatura de diagnóstico:** uma métrica de qualidade a **zero uniforme** em todas as peças é
> sinal de **defeito estrutural no pipeline** (recorte, canal, path errado) — não de "más
> vectorizações". Não ajustar parâmetros de traçado quando o IoU falha assim; ir ao recorte primeiro.

Verificar sempre: `crop_box` dentro de `(0, 0, largura, altura)` da imagem-fonte antes de cortar; se
o recorte vier de segmentação automática, confirmar as coordenadas contra a imagem original antes
de confiar nelas.

**Binarizar a 1 cor antes de traçar** (não deixar o vectorizador decidir cores):
- Fundo = o que **toca no canto** da imagem — nunca "o branco interior". Uma marca com miolo branco
  (letra "O", furo de um ícone) tem branco que É a marca, não o fundo.
- Depois de binarizar, o traçado sai com 1-3 caminhos por marca em vez de centenas — mais rápido,
  mais fiel, e mais fácil de auditar visualmente.

## 2. Traçar (vtracer)

`pip install vtracer` — biblioteca Python que embrulha o crate Rust do visioncortex. Alternativa
CLI: binário `vtracer` (mesmo motor, nomes de flag com hífen em vez de underscore).

```python
import vtracer
vtracer.convert_image_to_svg_py(
    "marca_binaria.png", "marca.svg",
    colormode="color",       # ver gotcha abaixo — NUNCA "binary"
    hierarchical="stacked",
    mode="spline",
    filter_speckle=4,
    color_precision=6,
    corner_threshold=60,
    path_precision=8,
)
```

**Estado da verificação [win] 2026-08-20** — medido nesta máquina:
- `vtracer` **instalado** e importável · `PIL` **12.2.0** ✓
- Assinatura confirmada a correr, **todos os parâmetros com default `None`** (o pacote deixa os
  defaults do lado Rust, não os expõe no Python):
  `convert_image_to_svg_py(image_path, out_path, colormode=None, hierarchical=None, mode=None, filter_speckle=None, color_precision=None, layer_difference=None, corner_threshold=None, length_threshold=None, max_iterations=None, splice_threshold=None, path_precision=None)`
- Outras entradas do módulo: `convert_pixels_to_svg`, `convert_raw_image_to_svg`.
- `potrace` · `cairosvg` · `resvg` · `inkscape` · ImageMagick: **ausentes**. A rasterização de volta
  faz-se por **Chrome headless**, testada ponta a ponta — receita em §3 "Rasterizar de volta".
- ⚠ A nomenclatura do CLI diverge da API Python (`--colormode {color,bw}` vs `colormode='binary'`) —
  não confundir, e lembrar que `colormode="binary"` na API devolve **vazio**.

**Gotchas medidos numa sessão real (todos silenciosos — nenhum devolve erro):**

| Gotcha | Efeito | Mitigação |
|---|---|---|
| `colormode="binary"` | Devolve SVG **vazio** | Usar `colormode="color"` mesmo em imagem já binarizada a 1 cor (a doc PyPI descreve `"binary"` como válido; medido nesta máquina, não é) |
| Branco do PNG não é `#ffffff` | Sai `#FDFDFD` — filtro por igualdade exacta de cor falha em silêncio | Comparar por **proximidade** (`abs(r-255)<3`), nunca por `==` |
| Fundo = branco interior (assumido) | Furo/miolo da letra apagado como se fosse fundo | Fundo = o que **toca no canto** (`M0,0` no path), não o que é branco |
| `transform` do `<path>` descartado ao extrair caminhos individuais | Peça desloca-se sem erro nenhum | Preservar o atributo `transform` de cada `<path>` ao separar/recompor SVGs |

## 3. Medir — IoU (stdlib + PIL apenas)

```python
from PIL import Image, ImageChops

def to_mask(img: Image.Image, thresh: int = 128) -> Image.Image:
    """Máscara 0/255: tinta = pixel ESCURO. Assume já binarizado a 1 cor (passo 1)."""
    gray = img.convert("L")
    return gray.point(lambda p: 255 if p < thresh else 0)

def iou(mask_a: Image.Image, mask_b: Image.Image) -> float:
    a = mask_a.point(lambda p: 1 if p else 0)
    b = mask_b.point(lambda p: 1 if p else 0)
    inter = sum(ImageChops.multiply(a, b).getdata())
    union = sum(ImageChops.lighter(a, b).getdata())
    return inter / union if union else 0.0

# passo 4 do ciclo: rasterizar o SVG de volta ao MESMO tamanho (ver bloco abaixo — via verificada)
original = Image.open("marca_binaria.png")
reraster = Image.open("marca_reraster.png").resize(original.size)
score = iou(to_mask(original), to_mask(reraster))
print(f"{score:.4f}")
```

### Rasterizar de volta — a via que FUNCIONA (medido [win] 2026-08-20)

Este é o passo que costuma não ter chão: `cairosvg`, `potrace`, `resvg`, `inkscape` e o ImageMagick
**não estão** nesta máquina. ⚠ E `command -v convert` **dá um falso positivo**: o `convert.exe` do
`system32` é o utilitário de disco do Windows, não o ImageMagick.

**Chrome headless rasteriza SVG e foi testado ponta a ponta** (SVG 200×200 → PNG 200×200, centro
`(0,0,0)`, canto `(255,255,255)`):

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=<W>,<H> --screenshot="C:/caminho/reraster.png" "file:///C:/caminho/marca.svg"
```

No macOS o mesmo passo é
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --screenshot=… file:///…`
(caminho POSIX normal, sem a armadilha da letra de drive) — **não medido nessa máquina**, ao contrário do bloco Windows acima.

⚠ **No Windows o caminho tem de ser `file:///C:/...`** — um caminho POSIX estilo Git Bash (`file:///c/Users/…`)
escreve um PNG **com sucesso** que contém a página de erro do Chrome (ver `reference/workflows-and-tooling.md`,
"a bancada mente antes do código"). O `--window-size` fixa o enquadramento: pôr o tamanho do raster
original, não deixar ao acaso.

Se preferires `cairosvg`: `pip install cairosvg` **não chega no Windows** — precisa das libs nativas
Cairo/GTK3 e falha na importação sem elas. Não é a via barata aqui.

**Nunca** usar o gerador de thumbnails do SO (`qlmanage` e afins) — força enquadramento quadrado e
corta lockups horizontais, dando um IoU falso-baixo que parece defeito de vectorização e é defeito
do rasterizador de verificação.

## 4. Decidir pelo número

| IoU | Leitura | Acção |
|---|---|---|
| **0,96–0,99** | Fidelidade de produção (o que a sessão de referência atingiu nas 25 marcas) | Aceitar |
| **0,90–0,96** | Aceitável para uso interno/rascunho; visível em zoom | Ajustar `corner_threshold`/`filter_speckle` antes de aceitar para cliente |
| **< 0,90** | Traçado perdeu detalhe real (curva simplificada demais, cor errada) | Rever binarização, não só parâmetros de traçado |
| **0,0000 uniforme em todas as peças** | **Não é qualidade — é defeito estrutural** (recorte, canal, path) | Voltar ao passo 1, nunca ajustar traçado |

## 5. Lote de várias marcas — não re-segmentar o que já foi aprovado

Quando duas ferramentas segmentam a MESMA imagem-mãe por critérios diferentes (ex.: componentes
ligados + proximidade vs. cortar pelos maiores vãos em branco), **a numeração delas não coincide** —
"marca 9" numa ferramenta pode não ser "marca 9" na outra, e todos os resultados parecem plausíveis
(mesma família visual). Isto já esteve a 1 passo de trocar 9 de 17 marcas sem nada denunciar.

- Traçar directamente o recorte **já escolhido/aprovado** — não voltar a segmentar a imagem-mãe.
- Se houver duas numerações a reconciliar, casar por **comparação de forma** (IoU cruzado, bounding
  box, silhueta), nunca por índice.

## Anti-patterns

| Errado | Correcto |
|---|---|
| "Parece igual" a olho | Rasterizar de volta + IoU |
| Deixar o vectorizador escolher cores da marca inteira | Binarizar a 1 cor primeiro — menos caminhos, mesma fidelidade |
| Filtrar branco por `== #ffffff` | Comparar por proximidade — o branco real vem `#FDFDFD` |
| Fundo = "o que é branco" | Fundo = o que toca no canto da imagem |
| IoU 0 em tudo → mexer nos parâmetros do traçador | IoU 0 uniforme → ir ao recorte/canal primeiro (defeito estrutural) |
| Descartar `transform` ao separar `<path>`s | Preservar sempre — descartá-lo desloca sem erro |
| Re-segmentar a imagem-mãe para "confirmar" uma marca já aprovada | Traçar o recorte aprovado directamente; casar numerações por forma |
| Entregar o SVG traçado como "o logo novo" | Avisar: é reprodução fiel do raster, não desenho de produção |

## Próximo passo (chain)

- Raster de origem com resolução baixa → `image-upscale` ANTES de traçar (mais fiel).
- SVG final entra em manual de marca / peça de print → `graphic-design`.
- Vários lockups de um sistema de identidade → confirmar consistência contra `brand-guidelines`.

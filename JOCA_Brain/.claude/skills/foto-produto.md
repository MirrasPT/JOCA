---
name: foto-produto
description: "Tratar fotos REAIS de um produto físico (foto de telemóvel) até ficarem prontas para a ficha de loja — diagnóstico por medição (não a olho), correcção determinística (exposição, equilíbrio de brancos, endireitar, recortar ao rácio do consumidor) OU cenário gerado por IA com a peça real composta por cima — nunca o produto gerado de raiz. MUST be invoked when the user says: tratar fotos de produto, foto de produto real, corrigir foto do telemóvel, preparar foto para a loja, fotografia de produto, retocar foto de produto, remover fundo da foto do produto. SHOULD also invoke when: uma foto entregue não bate no rácio da ficha de produto, ou o pedido é gerar um cenário para um produto que já foi fotografado a sério."
triggers: tratar fotos de produto, foto de produto real, fotografia de produto, corrigir foto de telemóvel, preparar foto para loja, retocar foto de produto, remover fundo da foto do produto, endireitar foto de produto, rácio da ficha de produto, cena de produto, product photography, HEIC de produto
chain: img-gen, image-upscale
origin: local
---

# foto-produto — tratar fotos reais, não gerar de raiz

Ponto de partida: **fotos que já existem** de uma peça física (normalmente de telemóvel). Não é
`img-gen` (gera de raiz) nem `image-upscale` (só resolução) — é diagnosticar o que está errado na
foto real e corrigi-lo, ou compor a peça real dentro de um cenário gerado.

## 0. Contrato antes de tocar em nada

- **Originais nunca se tocam nem se sobrescrevem.** Ficam na raiz/pasta própria; o tratamento sai
  sempre para uma pasta nova (`_tratadas/`, `_tratadas_<perfil>/`). `test -f` antes de escrever
  (`rules/task-intake.md`).
- **Listar o conteúdo intocável antes de gerar seja o que for com IA**: nome, datas, medidas,
  ícones — qualquer dado que a foto tenha de mostrar exacto. Gerar a peça por descrição em vez de
  compor a foto real escreve o nome mal (medido 2026-08-28, placa de nascimento).
- **O rácio e a resolução de saída derivam do CÓDIGO que os vai consumir, nunca da fonte.** Medido:
  `aspect-[4/5]` + `object-cover` no `ProductCard.tsx`/`ProdutoPage.tsx` de uma loja Next — qualquer
  imagem fora desse rácio é cortada pelo browser sem ninguém decidir onde (2026-09-01). `grep` ao
  componente do cartão antes de fixar o rácio.
- **A escolha de via (ver §2) é do utilizador, não da skill.** Um brief que já incluía contrato,
  armadilhas e gates foi rejeitado por decidir por ele — o brief certo diz só onde estão os
  ficheiros, quais tratar e para que produto vão (2026-09-02).

## 1. Diagnóstico por medição, nunca a olho

Ler os pixels antes de decidir o que está "amador":

```python
from PIL import Image
import numpy as np, cv2
img = np.array(Image.open("foto.jpg").convert("RGB"))
p995 = np.percentile(img, 99.5, axis=(0,1))          # equilíbrio de brancos (zona clara real)
hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
sat_por_matiz = hsv[...,1][hsv[...,0]==<matiz_da_madeira>].mean()   # saturação de uma cor específica
```

- **Um alvo numérico herdado de um diagnóstico é hipótese, não facto.** Um "secretária a ~230"
  escrito num contrato levou 3 rondas de tratamento até ser posto em causa contra o original — o
  alvo certo (215, não 230-231) só apareceu ao comparar lado a lado (2026-08-31).
  **Comparar sempre com o original antes de optimizar para um número escrito.**
- **A queixa do dono é sintoma, não diagnóstico** (mesmo sessão): "sombras demasiado fortes" media
  ~0,80 de rácio sombra/mesa nas duas versões — a sombra não escureceu, foi o fundo que subiu de
  luminosidade e a destacou. "O fundo ficou escuro" era a foto original (madeira a 88 contra 93 no
  original), não o tratamento. **Medir a grandeza que a queixa descreve antes de corrigir a coisa
  errada.**
- **Um "defeito" pode ser o que dá carácter à peça.** Dessaturar a madeira de 247→105 e subir a luz
  de 70→155 foi rejeitado com "parece piores que as originais" — o contraste quente é o que fazia a
  peça branca saltar do fundo (2026-08-31). Corrigir só o que está mesmo mal (aqui: só a
  subexposição), não "profissionalizar" tudo o que a IA acha que devia mudar.

## 2. Duas vias — perguntar, não escolher

| Via | Quando | O que faz |
|---|---|---|
| **A — correcção determinística** | mantém a cena real (mesa, fundo, luz) | script re-executável (PIL/numpy/cv2): endireitar, recortar ao rácio derivado (§0), corrigir exposição/equilíbrio de brancos pela medição (§1), nitidez, exportar |
| **B — cenário gerado + peça real composta** | quando se quer um cenário que a foto não tem (ex.: quarto temático) | `rembg` extrai a peça em PNG com alfa → IA gera **só o cenário** (nunca o produto) → compor por cima |

**Perguntar ao dono qual via** com `AskUserQuestion`, sempre — nunca decidir por ele (§0).

### Via A — parâmetros no topo do script, saída dupla
Perfis nomeados (`--perfil suave|medio|forte|minimo`), cada um para a sua pasta de saída. Exportar
**JPG q92 + WebP q85** ao rácio/resolução derivados (§0).

### Via B — nunca gerar o produto, só o cenário
`gpt-image-2` **redesenha, não retoca**: 5 gerações com instrução explícita para copiar o lettering
mudaram sempre o desenho — outra letra, outra silhueta, ícones diferentes, base diferente (medido
2026-08-31; ver `img-gen.md` §2.5, mesma regra). Os dados de texto **sobrevivem quase sempre**, e é
isso que torna a imagem perigosa: passa uma verificação por texto e falha na forma (uma geração saiu
com um espaço a mais no valor numérico). **Nunca pedir ao modelo para desenhar o produto** — gerar só
o cenário com `img-gen` e compor a peça real por cima do recorte.

⚠ **`rembg` come elementos brancos sobre fundo branco** — contraste insuficiente faz um bloco sólido
sair fino e semi-translúcido no recorte (medido: um plinto de 171×44×10,6 mm ficou lâmina). Verificar
sempre estruturas brancas finas depois do recorte, antes de compor a cena.

## 3. Formatos e ferramentas — medir antes de assumir

- **HEIC**: nem a loja nem um script de tratamento próprio o lê. Converter para JPG à resolução
  completa **ao lado do original** (`sips` no Mac, q95 — TODO: confirmar a sintaxe com `man sips` antes do 1.º uso), nunca por cima — mover o HEIC, criar o JPG, conferir a contagem dos dois lados.
- **Ferramentas confirmam-se na máquina, não de memória**: `rembg`, PIL, numpy, cv2, ffmpeg
  confirmados numa sessão (2026-08-28); **sem ImageMagick** — nunca assumir `convert`/`magick`.
- **Um script escrito para um formato/resolução não está provado noutro.** Um `tratar-fotos.py`
  feito para JPEG 3:4 de telemóvel não tinha o recorte nem a detecção de horizonte provados em
  9:16 muito maior — confirmar em cada foto nova, não reaproveitar às cegas.
- **Resolução de sobra ≠ resolução em falta.** Um original 4536×8064 recortado a 4:5 ainda dá 2,8×
  a resolução pedida pela loja; a via de geração por IA nativa (~1122×1402) fica **abaixo** do
  mesmo alvo. Medir a resolução do original antes de decidir se falta ampliar (`image-upscale`).

## 4. Verificação — abrir cada imagem, uma a uma

- **O relatório do produtor não substitui abrir o ficheiro.** Um lote de 8 imagens foi verificado
  imagem a imagem, não pelo relatório do agente que as tratou (2026-08-28).
- Branco real não pode chapar: `p99.9` do PLA/superfície branca deve ficar ~251-252, não 255
  (0 % de píxeis saturados).
- Cor de fundo/secundária não muda sem se ter pedido — comparar o valor medido antes/depois (§1).
- **Fotos quase-duplicadas** (mesmo enquadramento, ângulo quase igual) — assinalar como redundante
  em vez de entregar as duas.
- Via B: verificar as estruturas finas brancas pós-recorte (§2).

## Anti-patterns

| Errado | Correcto |
|---|---|
| Corrigir a foto pelo que "parece" amador | Medir percentil por canal e saturação por matiz antes de tocar |
| Perseguir um número herdado do contrato | Comparar sempre contra o original antes de optimizar para ele |
| Gerar o produto por descrição para um cenário novo | `rembg` extrai a peça real; a IA gera só o cenário |
| Escolher a via (correcção vs cenário-IA) sozinho, pelo utilizador | `AskUserQuestion` — é decisão dele |
| Rácio de saída "o que a foto já tem" | Derivar do componente/código que consome a imagem |
| Sobrescrever o original | Pasta de saída nova, `test -f` antes |
| Aceitar o relatório do agente que tratou as fotos | Abrir cada imagem, uma a uma |

## Próximo passo (chain)
- Cenário-IA necessário (via B) → `img-gen` — levar o contrato de "nunca gerar o produto" no brief.
- Resolução real por baixo do alvo (não é rácio, é falta de pixels) → `image-upscale`.

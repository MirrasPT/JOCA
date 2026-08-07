---
name: image-upscale
description: "Ampliar ou restaurar imagens para print/large-format/assets de cliente — escolha de modelo ESRGAN por tipo de conteúdo, tiling com blend por feather para imagens grandes, e verificação por recorte antes de correr a imagem toda. MUST be invoked when the user says: upscale, ampliar imagem, aumentar resolução, restaurar imagem, imagem para print, imagem pixelizada, esticar sem perder qualidade. SHOULD also invoke when: um asset entregue tem menos resolução do que o formato final exige."
triggers: upscale, ampliar imagem, aumentar resolução, restaurar imagem, imagem para print, large format, imagem pixelizada, ESRGAN, Remacri, UltraSharp, RealESRGAN, super resolution, melhorar qualidade de imagem
chain: graphic-design, img-gen
metadata:
  origin: user
---
# image-upscale — ampliar sem inventar

Trabalho recorrente (print, lonas, cartazes, assets de cliente) que já foi descoberto do zero uma
sessão inteira: escolher modelo, encontrar um runtime com torch, tiling, verificação.

## 1. Escolher o modelo pelo CONTEÚDO

Não há "o melhor upscaler" — há o certo para o que está na imagem. Errar aqui produz artefactos que
só aparecem à escala final, quando já é tarde.

| Conteúdo | Modelo | Porquê |
|---|---|---|
| **Texto, logótipos, ilustração, linha** | **Remacri** | Mantém arestas duras e legibilidade; é o único que aguenta texto pequeno |
| **Textura agressiva, detalhe que se quer exagerado** | **UltraSharp** | Acentua muito; excelente em textura, mau em pele e gradientes suaves |
| **Fotografia, pele, gradientes** | **RealESRGAN** (`x4plus`) | Suave e natural; não inventa micro-detalhe onde não havia |
| **Foto com rostos** | RealESRGAN + face restore (GFPGAN/CodeFormer) | Rostos degradam-se primeiro; tratá-los à parte |

⛔ **Comparar modelos num RECORTE antes de correr a imagem toda.** Recortar 512×512 da zona mais
exigente (texto pequeno, olho, aresta de logo), passar pelos 2-3 candidatos, comparar lado a lado.
Correr uma imagem grande com o modelo errado custa minutos ou horas e repete-se.

## 2. Onde correr

Por ordem de preferência prática:

1. **gen-ai CLI (Picsart)** — `Read` a skill `gen-ai-use`; tem operação de enhance/upscale por API.
   Sem setup, sem GPU, bom para volume e para quem não quer manter modelos.
2. **ComfyUI local** — já existe instalação (`~/comfy ui` no Mac, `D:\_Comfyui` no Windows) com
   torch; nós de upscale aceitam `.pth` ESRGAN directamente. É o caminho offline e sem custo.
3. **Python + torch avulso** — só se os anteriores não servirem. Precisa de runtime com torch (e CUDA
   no Windows, para não demorar uma eternidade em CPU).

**Modelos `.pth`:** resolver o URL de download em **openmodeldb.info** (ou no Hugging Face do autor)
no momento — os mirrors mudam. **Registar o URL resolvido e a data na memória do projecto** em vez de
o procurar outra vez. Não inventar um URL: se não o encontrares, reporta.

## 3. Tiling — imagens grandes não passam de uma vez

Acima de ~2000 px o modelo rebenta por falta de memória. Cortar, processar, costurar — e **a costura é
onde se vê o defeito**: blend linear deixa bandas visíveis.

- **Tile 512 ou 768**, com **overlap ≥ 64 px** (mais overlap = costura mais segura, mais tempo).
- **Feather coseno** no overlap, não linear: o peso vai de 0 a 1 por `0.5*(1-cos(pi*t))`, que casa as
  derivadas nas bordas e faz a junta desaparecer.
- Processar em **float**, converter a 8 bits só no fim — arredondar por tile deixa degraus.
- Verificar a costura: olhar as linhas de junta a 100% num gradiente suave (céu, fundo liso), que é
  onde qualquer banda salta à vista.

## 4. Verificação (antes de entregar)

- [ ] Recorte de **texto** a 100% — legível, sem halo nem serrilha inventada
- [ ] Costuras invisíveis num gradiente suave
- [ ] Rostos/pele sem aspecto plástico
- [ ] Resolução final bate o que o formato exige (**print: 150 dpi ao tamanho final** para
      large-format visto à distância; 300 dpi para material de mão)
- [ ] Ficheiro **novo**, nome irmão versionado — nunca por cima do original
      (`test -f` antes; ver `rules/task-intake.md`)

## Anti-patterns

| Errado | Correcto |
|---|---|
| Correr a imagem toda para descobrir que o modelo era o errado | Comparar candidatos num recorte de 512 px primeiro |
| Blend linear no overlap | Feather coseno — o linear deixa bandas |
| Upscale de 8× de uma vez | 2× encadeado, avaliando entre passos |
| Aceitar "parece melhor" | Recorte a 100% do detalhe mais exigente |
| Sobrescrever o original | Nome irmão versionado |

## Próximo passo (chain)
- Asset para peça de print → `graphic-design`.
- O que falta é resolução que nunca existiu (não é ampliação, é geração) → `img-gen`.

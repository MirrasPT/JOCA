---
name: acura
description: Acura social media — geração de imagens hero (sem texto) para 3 sub-marcas de desporto ao ar livre (ACURA · BTT · TRAIL)
type: project
directorio: D:\Mega\Acura
---

**Cliente:** Acura
**Directório:** `D:\Mega\Acura\`
**Iniciado:** 2026-07-06
**PRD:** não gerado

**Why:** Conteúdo visual mensal para redes sociais de uma marca de desporto outdoor com 3 sub-marcas/linhas — **ACURA** (guarda-chuva: bicicleta + corrida), **BTT** (btt/mountain bike), **TRAIL** (trail running). Tema recorrente: trilhos, natureza, verão, liberdade, superação.

**How to apply:** Ao receber um lote de posts para este cliente, o brief vem por marca (ACURA/BTT/TRAIL) + `NN_Post_DD_MM` + Copy Design (headline) + Copy Legenda (caption). **A imagem NÃO leva texto** — o texto é aplicado depois em design. Gerar imagens hero e gravar em `2026_<mês>\_material\` com naming `MARCA_NN_Post_DD_MM.png`.

## Convenções (validadas 2026-07-06)
- **Formato:** Feed Instagram **4:5 (1080×1350)** — preferência do Renato para estes posts.
- **Motor:** **Gemini** via agente `img-gen-google` (agy). ⚠ Gemini só gera **1:1** e ignora o rácio pedido → cada imagem sai quadrada e é croppada/escalada para 4:5 com `ffmpeg ... scale=1080:1350:flags=lanczos` (já documentado na skill `img-gen`). Crop preferir manter o **terço superior limpo** (céu/vista) para o overlay de texto.
- **Sem texto/logos:** imagem 100% limpa — sem letras, números, logos, watermark, signage. Texto entra na fase de design.
- **Naming:** `MARCA_NN_Post_DD_MM.png` (ex.: `TRAIL_02_Post_21_07.png`).
- **Variedade no feed:** cada marca com identidade visual distinta e variar a luz (manhã / golden hour / sunset / dia claro) para as 6 imagens não parecerem a mesma foto na grelha.
  - ACURA → paisagem/descoberta (ciclista pequeno em vista ampla; ou silhueta ao pôr-do-sol).
  - BTT → acção MTB (single-track de floresta; crista aberta golden hour).
  - TRAIL → corrida/esforço (subida rochosa; caminho de montanha golden hour).

## Estrutura de ficheiros
```
Acura/
└── 2026_Redes_Sociais/
    └── 07_Junho/           ← ⚠ pasta diz "Junho" mas os posts são de Julho (05/07, 21/07, 25/07). Path usado tal-como-dado pelo Renato.
        └── _material/       ← imagens hero entregues (PNG 1080×1350, sem texto)
```

## Lote Julho 2026 — FEITO (6 imagens, 2 por marca)
| Ficheiro | Post | Copy Design | Conceito da imagem |
|----------|------|-------------|--------------------|
| `ACURA_01_Post_05_07.png` | ACURA 05/07 | Há lugares que só se descobrem a pedalar… ou a correr | Ciclista gravel sobre vale + lago, descoberta/escala, luz manhã |
| `ACURA_02_Post_25_07.png` | ACURA 25/07 | Onde há sol, há aventura | Ciclista em silhueta na crista ao pôr-do-sol |
| `BTT_01_Post_05_07.png` | BTT 05/07 | Às vezes o que precisas é de pegar na bicicleta e desconectar | MTB em single-track de floresta, luz filtrada |
| `BTT_02_Post_25_07.png` | BTT 25/07 | A melhor época: dias maiores para pedalar | MTB em crista aberta, golden hour |
| `TRAIL_01_Post_05_07.png` | TRAIL 05/07 | O teu maior desafio és tu! | Trail runner a subir parede rochosa de montanha |
| `TRAIL_02_Post_21_07.png` | TRAIL 21/07 | Mais horas de sol, mais motivos para sair | Caminhante em trilho de montanha, golden hour verão |

## Decisões tomadas
- 2026-07-06: projecto iniciado. Lote Julho = 6 imagens hero (sem texto), 3 marcas × 2 posts. Formato Feed 4:5, motor Gemini (`img-gen-google`), entregues em `07_Junho\_material\`. Naming `MARCA_NN_Post_DD_MM.png`.
- 2026-07-06: convenção — imagem sempre SEM texto (texto entra em design); terço superior limpo para overlay; variar luz/marca para o feed não repetir.

## Última sessão
2026-07-06: projecto criado + lote Julho de 6 imagens hero geradas (ACURA/BTT/TRAIL × 2), Feed 4:5, sem texto, entregues em `_material\`.

## Pendente
- **Aplicar a copy** (headline Copy Design) sobre cada imagem → mockup final com texto. Sistema de design/brand ainda não definido (sem brandguide fornecido).
- Versões **9:16 story** (se pedido).
- ACURA_02 foi croppada de base 1:1 — se preferir mais céu por cima, regenerar.
- Definir brand (paleta/fonte/logo) e, se o lote se repetir, considerar skill local `RS_Acura` como no Eurico Fertuzinhos.

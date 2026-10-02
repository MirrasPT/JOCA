---
name: h3-prompt-writing
description: "Escrever prompts para o MiniMax H3 na estrutura oficial (T2VA, I2VA, FL2VA, L2VA, Ref2VA). MUST be invoked when the user says: prompt para o H3, prompt MiniMax, escrever prompt de vídeo, integrated_multimodal_description, overall_soundscape, non_diegetic_music, Ref2VA, T2VA, I2VA, FL2VA, L2VA. SHOULD also invoke when: gerar vídeo no MiniMax-H3, o vídeo saiu sem som, o vídeo ignorou o que pedi, a câmara mexeu-se e não devia."
triggers: h3 prompt, prompt minimax, prompt H3, MiniMax H3, integrated_multimodal_description, overall_soundscape, non_diegetic_music, T2VA, I2VA, FL2VA, L2VA, Ref2VA, reference to video, prompt de vídeo estruturado, video sem som, minimax audio silencioso
chain: comfy-mcp-workarounds
origem: MiniMax-AI/MiniMax-H3 (oficial) — instalada 2026-09-03
---

# H3 Prompt Writing (skill oficial da MiniMax, adoptada)

Fonte: `MiniMax-AI/MiniMax-H3`, pasta `skills/h3-prompt-writing/`. Copiada literalmente para
`.claude/reference/minimax-h3-oficial/` a 2026-09-03. **Não reescrever de memória** — os guias
originais são a fonte de verdade e têm exemplos completos que não cabem aqui.

O frontmatter oficial declara a skill portátil: *"no external API calls, MiniMax Hub tools, or
proprietary runtime required"*. Vale para o modelo **local** no ComfyUI.

## A regra que faz esta skill existir

**O H3 não se promptifica em prosa.** Espera campos com nome, por ordem fixa. Um parágrafo bonito
produz um resultado mole, e há indício forte de que produz também **áudio quase silencioso** — o
teste local a 2026-09-03 (prosa simples, 8 passos) deu −58,2 dB de média, contra −22,9 dB de
referência. `POR CONFIRMAR` que a causa é o dialecto; é o primeiro teste a correr.

## Workflow

1. Identificar o modo de entrada: **T2VA · I2VA · FL2VA · L2VA · Ref2VA**.
2. Modos base (texto/keyframe) → `Read(".claude/reference/minimax-h3-oficial/h3-prompt-writing/references/base-en.txt")` e seguir a estrutura final que lá está.
3. Modo full-reference → `Read(".claude/reference/minimax-h3-oficial/h3-prompt-writing/references/ref-en.txt")` e seguir o formato de reescrita de seis secções.
4. Preservar **exactamente** os nomes de campo, a ordem das secções, as etiquetas e a notação de tempo do guia escolhido.

## Os cinco modos

| Modo | Entrada | O que o prompt tem de fazer |
|---|---|---|
| **T2VA** | só texto | construir a timeline audiovisual inteira |
| **I2VA** | primeiro frame | partir da imagem e desenvolver para a frente |
| **FL2VA** | primeiro + último frame | descrever o caminho contínuo entre os dois |
| **L2VA** | só último frame | inferir uma abertura plausível e convergir para a imagem final |
| **Ref2VA** | referências (imagens/vídeos/áudios) | reescrita em seis secções, com etiquetas consistentes |

## Os três campos base

Pela ordem mostrada em `base-en.txt`, depois da linha de instrução (que é a **primeira linha**,
seguida de uma linha em branco):

- `integrated_multimodal_description` — visuais, acções, planos, quem fala, diálogo, canto e som diegético ao longo da timeline. É o corpo do prompt.
- `overall_soundscape` — ambiente, sons de acção física e sons humanos não-verbais, no vídeo inteiro.
- `non_diegetic_music` — música que as personagens **não** ouvem e o público ouve.

⚠ O som divide-se por **três** sítios distintos. Meter tudo num só é a falha comum.

## Ref2VA — seis secções, por esta ordem

`subject_definitions` → `summary` → `retention_analysis` → `detailed_description` →
`overall_soundscape` → `non_diegetic_music`. As etiquetas de referência mantêm-se iguais em todas
as secções.

**A regra que resolve a deriva de rosto:** uma imagem que define identidade, roupa ou estilo cita-se
**dentro de `<Subject N>`** — não leva `<Picture N>` autónomo. O `<Picture N>` solto é só para
âncoras concretas de enquadramento.

**Limites:** ≤9 imagens · ≤3 vídeos · ≤3 áudios · 12 ficheiros no total. **Ref2VA não combina com
first/last-frame.**

## Câmara: tipo + amplitude + velocidade

O guia impõe esta gramática de três partes. Para um corte, usar `the camera cuts to`,
`the shot cuts to`, `the shot transitions to`, `the shot changes to` ou `the shot switches to`.
Um corte tem de trazer informação nova (sujeito, espaço, estado, ponto de vista, tempo); se só muda
a distância ou um ângulo ligeiro, **prefere-se movimento de câmara a corte**.

## Regras de saída (do guia oficial)

- Escrever as secções em **inglês**; preservar diálogo, letra e texto visível na língua original.
- Descrever cada plano por composição, sujeitos, ambiente, acções, câmara, som, e o ponto exacto onde o conteúdo referenciado aparece.
- Evitar resumos de enredo, etiquetas de referência por resolver, e tempos que não batem com a duração pedida.
- Preferir detalhe visual e sonoro concreto a palavras abstractas como *cinematic* ou *beautiful*.
- **Não há prompt negativo.** O que não se quer nega-se pelo nome, dentro do texto. Negação vaga é ignorada: num projecto, *"the frame never moves"* produziu uma inclinação de câmara.

## Duração

**4 a 15 segundos** por geração — limite oficial. Fazer corresponder o total da descrição à duração
pedida. Isto fecha a questão do formato: o H3 faz **planos**, não filmes. Um filme é a montagem de
muitos planos, e a montagem é de outra ferramenta.

## As outras 8 skills oficiais

Ficaram em `.claude/reference/minimax-h3-oficial/` como consulta, **não** como skills activas —
são orientadas à API paga da MiniMax, não ao modelo local. Duas valem a leitura mesmo assim:

- `3d-animation-short-generator/` — o pipeline de produção narrativa completo (brief → outline →
  fichas de personagem e ambiente → shot planning → storyboard → geração plano a plano → montagem →
  BGM → revisão). Traz `storyboard-guidelines.md`, `shot-table-spec.md`, `qc-checklist.md` e
  `fallback-policy.md`. **É a base da skill `video-preproducao` (skill por escrever).**
- `music-video-subtitle-generator/` — base para a skill `videoclipe` (skill por escrever).

## Próximo passo (chain)

Prompt escrito → montar no ComfyUI: não há skill `minimax-h3`; o grafo API provado está em `.claude/reference/minimax-h3-recon/mmh3-grafo-api-provado.json` e a submissão por `/api/prompt` em **`comfy-mcp-workarounds`**.
Se ainda não há storyboard nem personagens fechados → pré-produção primeiro (skill `video-preproducao` por escrever; base em `3d-animation-short-generator/`): o prompt é o
último passo, não o primeiro.

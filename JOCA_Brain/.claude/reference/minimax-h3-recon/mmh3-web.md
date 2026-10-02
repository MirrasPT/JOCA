> ⚠ **RELATÓRIO DE INVESTIGAÇÃO — não é doutrina executável.** Material de fundação para as skills de vídeo por escrever. Os caminhos citados podem apontar a ficheiros ainda por criar ou a paths de repos externos; verificar antes de seguir.

# MiniMax-H3 — investigação pública (verificado 2026-09-03)

Todas as afirmações factuais levam URL. O que não confirmei está na secção final.

---

## Conteúdo

- 0. A distinção que custa dinheiro: H3 local vs Hailuo cloud
- 1. O modelo
- 2. LoRAs e fine-tunes
- 3. Prompting — o achado central
- 4. Multi-referência e consistência (Ref2VA) — o ponto mais importante
- 5. Continuidade entre planos
- 6. Skills e agentes já existentes — não reinventar
- 7. Estado de arte da produção de vídeo com IA
- Prompts reais de exemplo encontrados
- Definições operacionais no ComfyUI (referência rápida)
- O que NÃO consegui confirmar

## 0. A distinção que custa dinheiro: H3 local vs Hailuo cloud

São **três coisas** da mesma empresa (MiniMax) e confundem-se com facilidade:

| Coisa | O que é | Custo |
|---|---|---|
| **MiniMax-H3 open-weights** | Pesos descarregáveis, correm no ComfyUI local. É isto que corre localmente. | Grátis (hardware + electricidade) |
| **API MiniMax H3** (`platform.minimax.io`) | O mesmo modelo servido na nuvem, **+ os módulos que NÃO foram abertos** (H3-Context-IR e H3-Regenerate-2K) | ~$0.13/s a 2K; ~$0.08–0.09/s a 768p (verificado 2026-09-03) |
| **Hailuo / Hailuo 2.3** (`hailuoai.video`) | Produto/app de vídeo da MiniMax; a linhagem anterior (Hailuo 2.3) é um modelo **diferente e mais antigo** | Hailuo 2.3: ~$0.01/s a 512p, ~$0.04/s a 768p, ~$0.08/s a 1080p (verificado 2026-09-03) |

- "Hailuo 3.0" é usado por terceiros como nome comercial do H3 — mesma família. Fonte: https://huggingface.co/blog/ResterChed/minimax-h3-hailuo-3-0
- Preços API: https://openrouter.ai/minimax/hailuo-3 · https://platform.minimax.io/docs/guides/pricing-paygo · https://www.atlascloud.ai/blog/guides/hailuo-ai-pricing-cost
- **Nos nós do ComfyUI há os dois**: nós locais (`MiniMaxH3ImageToVideo`, etc.) e **API nodes** que chamam a nuvem e cobram. Não trocar.

### ⚠ Licença — bandeira vermelha para Portugal
A **MiniMax H3 Community License Agreement** trata **UE, EUA, Reino Unido e Coreia do Sul** como territórios que têm de **pedir licença separada** para usar os pesos.
- Fonte primária (model card): https://huggingface.co/MiniMaxAI/MiniMax-H3 — "application requirement for USA/EU/UK/South Korea"
- Fonte secundária: https://www.deeplearning.ai/the-batch/minimaxs-state-of-the-art-video-model-is-only-minimally-open — utilizadores nesses territórios "must apply for a license"
- Outras cláusulas: proibido **destilar** outro modelo a partir de output do H3; uso comercial obriga a **mostrar o nome "MiniMax H3"** de forma proeminente no produto.
- Um autor de LoRA no Civitai replica a restrição no seu próprio ficheiro: "excludes EU, UK, South Korea, and USA" (https://civitai.com/models/2890588)

**Portugal está na UE.** Uso pessoal/experimental é uma coisa; entregar a cliente é outra. Vale confirmar antes de facturar trabalho feito com isto. `model@minimax.io` é o contacto indicado no repo.

---

## 1. O modelo

Fontes primárias: https://huggingface.co/MiniMaxAI/MiniMax-H3 · https://github.com/MiniMax-AI/MiniMax-H3 · https://blog.comfy.org/p/minimax-h3-day-0-support-in-comfyui

### Arquitectura
- **H3-Omni-Transformer**: Transformer **denso, single-stream, 33B parâmetros**. ~**13B** vivem em ramos **AdaLN**, que são *precomputáveis* e cacheáveis em inferência — daí a leitura frequente de "~20B activos".
- **H3-Encoder**: usa os pesos pré-treinados completos do **Qwen3-VL-32B**. (Confirma o teu ficheiro `qwen3vl_32b_minimax_h3_*.safetensors`.)
- **MM-RoPE 3D** — position embeddings multimodais em tempo + espaço.
- **H3-VisualVAE**: compressão espacial 16×, temporal 4× (latentes `f16t4d24`).
- **H3-AudioVAE**: canais estéreo processados independentemente, taxa temporal de **40 Hz**.
- Checkpoints publicados são **CFG-distilled**, precisão **BF16**.

### Sistema completo (3 módulos — só 1 é aberto)
| Módulo | Função | Aberto? |
|---|---|---|
| **H3-Context-IR** | pré-processa/orquestra os inputs multimodais | ❌ só API |
| **H3-Base** | o gerador 33B a 768p | ✅ aberto |
| **H3-Regenerate-2K** | regeneração in-context para 2K | ❌ só API |

**Consequência prática:** local só dá **768p**. O "até 2K" do marketing é a API. Fonte: https://github.com/MiniMax-AI/MiniMax-H3

### Specs de saída
- **Duração**: 4–15 s (intervalo treinado)
- **FPS**: 24
- **Resolução**: 768p no lado curto por omissão; **1344×768** é o 16:9 nativo
- **Áudio**: **32 kHz estéreo**, nativo
- **Rácios**: 21:9, 16:9, 4:3, 1:1, 3:4, 9:16
- **Línguas estáveis**: árabe, chinês, inglês, francês, alemão, italiano, japonês, coreano, **português**, russo, espanhol
- **Grelha de frames**: snap a **17k+5** (5, 22, 39, … 124, … 362 frames). 5 s → 124 frames → 5.17 s reais. Fonte: https://docs.comfy.org/tutorials/video/minimax/minimax-h3

### Como funciona o áudio conjunto
O Omni-Transformer **prevê latentes de vídeo e de áudio conjuntamente**, num único forward pass; depois **dois VAEs separados** descodificam cada um. Confirma exactamente o que observaste localmente. Comfy: *"Audio is a property of the model, not a post-process. Every audio output is native stereo."*

### Duas variantes de checkpoint (escolha estruturante)
| Variante | Input | Limites |
|---|---|---|
| **H3-Base-FL2VA** | first-frame e/ou last-frame | 0–2 imagens |
| **H3-Base-Ref2VA** | omni-referência | ≤9 imagens, ≤3 vídeos (2–15 s cada), ≤3 áudios — **máx. 12 ficheiros no total** |

⚠ **Ref2VA e first/last-frame não se combinam.** Ou anchoras keyframes, ou dás referências. Fonte: https://runware.ai/docs/models/minimax-h3/guides/reference-driven-consistency

### Memória / quantizações (repo Comfy-Org)
https://huggingface.co/Comfy-Org/MiniMax-H3

Difusão (10 ficheiros): `minimax_h3_{fl2va,ref2va}[_pruned]_{bf16,int8_convrot,fp8_scaled}.safetensors`
Text encoders (3): `qwen3vl_32b_minimax_h3_{bf16,int8_convrot,nvfp4_awq}.safetensors`
VAEs (2): `minimax_h3_video_vae_fp16.safetensors`, `minimax_h3_audio_vae_fp32.safetensors`

Tamanhos (via https://github.com/wildminder/awesome-minimax-H3):
BF16 61.73 GB full / 37.46 GB pruned · INT8 ConvRot 31.70 / 19.53 GB · FP8 scaled pruned 19.52 GB.
Comfy diz que a optimização baixou o footprint **de 123.6 GB (full precision) para 42.5 GB** — "enables a next-generation 2K video model to run locally on a GPU like the RTX 3060".

**Recomendação oficial Comfy-Org**: usar `int8_convrot` se tiveres PyTorch cu130; senão `fp8_scaled`. O text encoder `nvfp4_awq` **não exige GPU Blackwell**.

---

## 2. LoRAs e fine-tunes

**Resumo honesto: o ecossistema de LoRAs é quase todo de *aceleração*, não de estilo.** Há muito poucos LoRAs criativos, e são recentes/imaturos.

### 2a. LoRAs oficiais (turbo — redução de passos)
No próprio repo Comfy-Org:
- `minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors`
- `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors`
- `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`

⚠ **`KENIC-1/Comfy-Org-MiniMax-H3-loras` é apenas um espelho destes três.** Não tem LoRAs próprios, nem trigger words, nem documentação. Verificado: https://huggingface.co/KENIC-1/Comfy-Org-MiniMax-H3-loras — o card diz só "repackaged model files for ComfyUI". **Não vale a pena ir lá.**

### 2b. LoRAs de aceleração da comunidade
Via https://github.com/wildminder/awesome-minimax-H3:
- **lightx2v** — a base de facto dos turbo LoRAs (v0.1 4-step 1.82 GB; v1.0/v1.1 768p 4–8 steps); conversões ComfyUI por **Kijai** (versão resized 300 MB para menos VRAM)
- **PDD** (Parallel Decoding Distillation) — alibaba-pai, 8-step para FL2VA e Ref2VA
- **NFE** — tutututututu, reduz 20→8 steps (738 MB)
- **VSA-DataFree** — barelymining, 4-step + nó ComfyUI companion
- **FastH3-Dense-4-step-v1** — Hippotes (1018 MB)
- **t8star** — variantes ConvRot INT8 (779.9 MB–1.96 GB)

### 2c. LoRAs de estilo/qualidade (Civitai — poucos, todos pós-lançamento)
Via `search_models` na API do Civitai (verificado 2026-09-03):
| Nome | ID | Notas |
|---|---|---|
| **Minimax H3 Authentic cinematic texture** | 2890588 | ficheiro `Minimax H3真实电影质感.safetensors`, 295.61 MB BF16, **trigger `DY`**, **força 0.7** (0.5 em movimento rápido), 19 000 steps / 40 epochs, autor TuTu_1018 |
| Minimax H3 Photorealistic Image Generator | 2884206 | LoRA + workflow |
| Polyhedron: Perfect Eyes // Perfect Skin // Perfect Hands (t2va) | 2899220 | correcção de artefactos |
| Minimax H3 Cinematic Look (No Tensor Errors) | 2908686 | o nome sugere que outros LoRAs dão erros de tensor |

**Conclusão accionável:** para estilo, o caminho mais rentável **não são LoRAs** — são as **embeddings oficiais** (ponto 3) e o prompt estruturado.

### 2d. Embeddings de estilo — subvalorizadas e oficiais
Dez, no repo Comfy-Org, pasta `embeddings/` (verificado: https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main/embeddings):

`minimaxh3_art_is_explosion` (512 kB) · `minimaxh3_blooming_flowers` (1.26 MB) · `minimaxh3_bullet_time` (963 kB) · `minimaxh3_dark_magic` (604 kB) · `minimaxh3_fire_breath` (1.21 MB) · `minimaxh3_four_seasons` (1.45 MB) · `minimaxh3_kiss_camera` (993 kB) · `minimaxh3_spiral_ascent` (1.34 MB) · `minimaxh3_storm_magic` (1.4 MB) · `minimaxh3_truman_show` (922 kB)

**Uso**: pôr em `embeddings/` e invocar no `CLIPTextEncode` com `embedding:minimaxh3_bullet_time`. Custam ~1 MB cada — é o melhor rácio esforço/efeito que existe para este modelo.

---

## 3. Prompting — o achado central

**O H3 NÃO se promptifica em prosa livre.** Espera um **formato estruturado com nomes de campo literais**. Isto é a coisa mais importante deste relatório a seguir ao ponto 4.

Fonte primária (guias oficiais, descarregados para o scratchpad):
- `.claude/reference/minimax-h3-oficial/h3-prompt-writing/references/base-en.txt` (15 773 bytes)
- `.claude/reference/minimax-h3-oficial/h3-prompt-writing/references/ref-en.txt` (23 553 bytes)
- https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing

### 3a. Os cinco modos
`T2VA` (texto) · `I2VA` (first frame) · `FL2VA` (first+last) · `L2VA` (só last frame) · `Ref2VA` (omni-referência).

### 3b. Estrutura base (T2VA/I2VA/FL2VA/L2VA) — 3 campos obrigatórios
```
integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...
```
- **`integrated_multimodal_description`** — visual, acções, planos, falantes, diálogo, som diegético, ao longo da timeline.
- **`overall_soundscape`** — 1–4 frases, **um parágrafo contínuo**: ambiente, sons físicos, sons humanos não-verbais (vento, chuva, passos, tecido, impactos, respiração). **Não repetir diálogo aqui.** `N/A` só se o utilizador pedir silêncio total.
- **`non_diegetic_music`** — 1–3 frases: **instrumentação, velocidade, ritmo, dinâmica**. Explicitamente **proibido** usar palavras abstractas de humor ou explicar a função emocional. `N/A` se não houver música.

**Distinção diegético vs não-diegético é dura**: música de rádio/TV/telemóvel que as personagens ouvem vai na descrição multimodal, **não** em `non_diegetic_music`.

### 3c. Linha de instrução de keyframe (literal, primeira linha, seguida de linha em branco)
- **I2VA**: `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.`
- **FL2VA**: `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.`
- **L2VA**: `How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.`

`S.SS` = duração efectiva com **exactamente duas casas decimais**.

### 3d. Sim, responde a linguagem de cinema — com gramática própria
**Camera motion = tipo + amplitude + velocidade**, escrito como **acção inglesa natural dentro do plano**, nunca empilhado como etiquetas no fim da frase.

Tipos aceites (tabela oficial): `Zoom In/Out` · `Push In / Pull Out` · `Pan Left/Right` · `Truck Left/Right` · `Tilt Up/Down` · `Pedestal Up/Down` · `Arc Shot` · `Tracking Shot` · `Static Shot` · `Shake Slightly/Strongly` · `POV` · `Roll Clockwise/Counterclockwise`
Amplitude: `with small amplitude` / `with large amplitude` — Velocidade: `at slow speed` / `at fast speed`
**Amplitude média e velocidade normal omitem-se.**

Exemplos oficiais verbatim:
```
The camera pushes in with small amplitude at slow speed toward the folded letter in her hands.
The camera pans right with large amplitude at fast speed, revealing the open doorway.
The camera holds a static shot as the runner exits the frame.
```

**Planos e cortes**: o `[Shot 1]` **não leva timestamp**. Os seguintes levam: `[Shot 2] At 00:03.500, the camera cuts to...`. Verbos aceites: `the camera cuts to`, `the shot cuts to`, `the shot transitions to`, `the shot changes to`, `the shot switches to`. Regra editorial oficial: **um corte tem de trazer informação nova**; se só muda a distância ou o ângulo ligeiramente, **usar movimento de câmara, não um corte**.

**Estilo** declara-se no início do `[Shot 1]`: `Cinematic`, `live-action`, `2D-animated`, `3D CG`, `claymation`, `watercolor`, `vintage film`.

### 3e. Como se pede o som (a parte que quase ninguém acerta)
O som divide-se em **três sítios diferentes**, e trocá-los degrada o resultado:
1. **Som sincronizado com a acção** → dentro do `integrated_multimodal_description`, no plano onde acontece.
2. **Ambiente contínuo** → `overall_soundscape`.
3. **Score que só o público ouve** → `non_diegetic_music`.

**Diálogo** usa IDs de falante estáveis `(S1)`, `(S2)`; em coro `(S1,S2)`. Sintaxe:
```
The young woman with a quiet, breathy voice (S1) says: <d>[English] I get off at the next station.</d>
The two children (S1,S2) shout together, <d>[English] Wait for us!</d>
```
- **Fora** de `<d>`: identificação, acção, entrega vocal. **Dentro** de `<d>`: só a tag de língua e as palavras exactas, **verbatim, sem traduzir**.
- Na primeira aparição de um falante, dar tipo de personagem, idade, género, on/off-screen, tom, timbre, ritmo, sotaque.
- **Voiceover**: frase exacta `says in an off-screen voiceover`, e **imediatamente a seguir** declarar que os lábios da personagem ficam fechados:
```
The man (S1) says in an off-screen voiceover: <d>[English] I still remember that road.</d> while his lips remain completely closed.
```
- Diálogo que atravessa um corte: `<scenetrans>` nos dois lados + dizer que o áudio continua (`continues seamlessly across the cut`, `carries over from the previous shot`, `remains audible across the transition`).
- Fala cortada pelo fim do vídeo: `<cutoff>`.
- **Texto no ecrã** (letreiros, néons, legendas) vai entre **aspas duplas inglesas**, verbatim, sem traduzir: `A red neon sign reading "营业中" glows above the doorway.`

### 3f. O que NÃO funciona
- **Não há negative prompt.** Proibições têm de ser reescritas como estados positivos. (Fonte comunitária: https://github.com/teskor-hub/minimax-h3-skill)
- Palavras abstractas — `cinematic`, `beautiful`, `epic` — em vez de detalhe concreto. A skill oficial diz explicitamente: *"Prefer concrete visual and audio details over abstract words like 'cinematic' or 'beautiful'."*
- Resumos de enredo em vez de descrição do que se vê e ouve.
- Labels de referência não resolvidos (declarar `<Picture 2>` e nunca a usar).
- Duração que não bate com o pedido — a descrição tem de caber nos 4–15 s.
- Repetir diálogo nas secções de áudio.
- **Movimento de câmara e movimento do corpo misturados na mesma frase** — "resolvem-se em adereços" (comunitário: teskor-hub).
- **Duração é lida literalmente como velocidade do evento**: uma queda descrita em 1,5 s sai com gravidade lunar (comunitário: teskor-hub).
- Se não descreveres o áudio, **o modelo inventa** — não fica em silêncio (comunitário: teskor-hub).

### 3g. Comprimento
- Modos base: sem número oficial; os exemplos oficiais rondam 80–150 palavras no campo principal.
- **Ref2VA: 350–500 palavras** no `detailed_description` para tarefas de geração (número oficial). Conteúdo com muito diálogo prioriza caber na timeline falada em vez de atingir a contagem.

---

## 4. Multi-referência e consistência (Ref2VA) — o ponto mais importante

Fonte primária: `.claude/reference/minimax-h3-oficial/h3-prompt-writing/references/ref-en.txt` · https://docs.comfy.org/tutorials/video/minimax/minimax-h3

### 4a. Limites duros
**≤9 imagens · ≤3 vídeos (2–15 s cada, com banda sonora) · ≤3 áudios · máx. 12 ficheiros no total.**
No ComfyUI o nó é `MiniMaxH3ReferenceToVideo`, com listas de `ref_images`, `ref_videos`, `ref_video_audios`, `ref_audios`.
Parâmetro `ref_image_size`: **`match`** (mais rápido) ou **`max`** (2048px, **identidade mais forte**).

### 4b. Quatro tipos de label — e a distinção que decide a consistência
| Label | Para quê |
|---|---|
| `<Subject N>` | conteúdo visível reutilizável: pessoas, animais, objectos, cenários, roupa, adereços, estilos, acções, poses |
| `<Picture N>` | imagem que é **âncora concreta de frame** (first/last/keyframe) ou de composição |
| `<Video N>` | relação com o **vídeo inteiro**: editar, continuar, ou referenciar estrutura temporal/cortes/ritmo |
| `<Audio N>` | sinal áudio copiado ou referenciado |

⚠ **A regra que resolve o "face drift"**: se uma imagem serve só para definir **identidade/roupa/estilo**, ela **NÃO leva `<Picture N>` autónomo** — cita-se **dentro** da definição de `<Subject N>`. Só se cria `<Picture N>` quando a imagem é mesmo um frame concreto. Confundir isto é a causa nº 1 de deriva de rosto.

Um subject pode vir de vários assets:
```
<Subject 1> is the woman whose appearance comes from <Picture 1> and whose walking motion comes from <Video 1>.
```
`<Video N>` e `<Audio N>` são **numerados independentemente** — o mesmo ficheiro pode ser `<Video 1>` e `<Audio 2>`.

### 4c. As seis secções do Ref2VA (ordem obrigatória)
1. `subject_definitions` — define cada referência, o seu papel e as características a seguir
2. `summary` — um parágrafo, começa com prefixo de tipo de tarefa entre parênteses rectos
3. `retention_analysis` — uma linha por label, com marcador de relação
4. `detailed_description` — plano a plano, 350–500 palavras
5. `overall_soundscape`
6. `non_diegetic_music`

**Tipos de tarefa** (combináveis com ` + `): `keyframe completion` · `reference generation` · `video editing` · `video continuation` · `audio reuse` · `audio reference`.
Ex.: `[video continuation + keyframe completion]`, `[video editing + audio reuse]`.

**Marcadores de retenção — visual**: `fully_preserved` · `partially_preserved` · `attribute_transfer` · `weak_reference`
**Marcadores — áudio**: `fully_copy` · `partially_copy` · `reference` · `weak_reference`

⚠ Regra oficial: **não tratar acções, fundos ou eventos novos como perda de fidelidade** de referência.

### 4d. Serve para manter uma personagem consistente entre planos?
**Sim — é o mecanismo desenhado para isso, mas com condições.**
- Atribuir **explicitamente** que referência controla o quê. ComfyUI docs: *"Explicit assignments tend to work much better."*
- **Nomear as características a fixar em texto, além de dar a imagem.** Regra repetida em várias fontes: *"Identity markers you spell out survive, while the ones you leave vague drift."* Exemplo concreto (RunDiffusion): *"Preserve her oval face, shoulder-length copper curls, dark brown eyes, small mole below the left eye, athletic build, and forest-green jacket with brass buttons."*
- **Pack de identidade recomendado** (https://www.rundiffusion.com/minimax-h3-prompt-guide): (1) imagem de identidade nítida, frente ou 3/4; (2) segundo ângulo ou corpo inteiro com proporções e guarda-roupa; (3) opcional, detalhe de acessórios/tatuagens.
- **Dar a MESMA referência de identidade a todas as gerações.**
- **Anti-blend com múltiplas personagens**: declarar explicitamente `never blended with <Subject 2>`, senão o modelo faz média das caras (https://github.com/jlucasmcrell/ComfyUI-H3-Multishot).
- **Voz**: `<Audio N>` referencia **timbre e entrega**, não reproduz o sinal. `<Audio 1> is the voice-timbre reference for <Subject 1> (S1).`

### 4e. Armadilhas documentadas (RunDiffusion, tabela problema→causa→fix)
| Problema | Causa | Fix |
|---|---|---|
| Personagem muda entre planos | referências em conflito | pack mais pequeno e compatível; nomear as características estáveis |
| A imagem de abertura muda | tratada como referência solta | usar Start Frame com a instrução oficial de alinhamento |
| O character sheet domina a abertura | foi metido como Start Frame | confirmar que se está a usar Ref2Video |
| Copia a parte errada da imagem | nenhum papel atribuído | dizer se controla identidade, roupa, produto, cenário, estilo ou composição |
| Aparece música não pedida | som e música não separados | `non_diegetic_music: N/A` |
| O clip parece atropelado | demasiada coisa | uma acção principal, uma reacção, uma ou duas decisões de câmara |

---

## 5. Continuidade entre planos

**O nativo são 4–15 s. Tudo acima disso é encadeamento, e o encadeamento tem custos medidos.**

### 5a. Técnicas, da mais ingénua à melhor
1. **Último frame → first_frame do seguinte** (o clássico). Funciona, mas **quebra o áudio no corte** e acumula deriva. É o que as ferramentas boas dizem explicitamente que **evitam**.
2. **First+last frame (FL2VA)** para controlar o destino de um plano. Nota oficial: FL2VA **prefere um único plano**, para o modelo interpolar continuamente — só usar múltiplos planos se for pedido.
3. **`MiniMaxH3AddGuide`** (nó nativo ComfyUI): ancora keyframes, clips ou áudio em **qualquer índice de frame**, incluindo **índices negativos** (contados do fim). Encadeáveis. Clips multi-frame cortam automaticamente para comprimentos válidos (5, 22, 39…).
4. **Denoise masks / inpainting temporal**: 0 preserva a região do latente, 1 regenera. Máscaras de vídeo alinham à grelha de patches latentes 2×2; máscaras de áudio alinham a **frames latentes inteiros**.
5. **Latent pinning + memory bank** (packs da comunidade) — o estado-da-arte.

### 5b. Ferramentas concretas
**`ComfyUI-H3-Multishot`** — https://github.com/jlucasmcrell/ComfyUI-H3-Multishot
Nós: `H3MultishotSampler`, `H3MultishotMemorySampler`, `H3ExtendTake`, `H3Retake`, `H3ChainNormalize`, `H3AutoRefs`, `H3RemoteTextEncoder`, `RiftPromptSource`, `RiftScriptPicker`.
Mecanismo: **latent pinning** (latente final do plano N condiciona o N+1) + **audio locking** (a cauda de áudio anterior faz ponte, evitando cortes na fala) + **seam trimming** (tira 15–25 latent frames de replay no início). Modo `context_pin` por omissão.

**Números de deriva documentados pelo próprio pack** (raros e valiosos):
- **Texture ratcheting ~1.05× por plano** — "spatial accretion": o detalhe inventado acumula porque cada plano condiciona no output anterior. **~+13% por junta a 736×1280.**
- Takes de **4 planos**: deriva subtil. **7+ planos**: sharpening visível.
- **Recomendação: manter takes estendidos abaixo de ~4 janelas (~30–40 s).**
- **Audio dulling**: a energia da banda vocal colapsa em cadeias longas; `audio_tone_control=flatten` faz spectral matching ao plano 1, limitado a ±9 dB — **reduz para metade, não elimina**.
- `master_normalize=luma+contrast` trata o drift de brilho/contraste mas **não** a acreção espacial.

**`MiniMax-H3 Multishot — Seamless Chain`** (Civitai 2833322) — https://civitai.com/models/2833322
"no last-frame chaining, no quality loss from shot to shot". Memory bank; **splice correlation-aligned** (corrigiu um bug em que a cauda re-encodada aterrava 1–2 latent frames adiantada, fazendo as juntas lerem-se como cortes e o áudio escorregar); referências de voz por personagem; nó `H3ChainNormalize` contra o "slow texture/colour ratchet". Settings: `take_seconds` (30 s recomendado à primeira), `bank_pinned`, `x0_clamp_window` (limitado a 0.30). Aviso: *"Keep takes to about 4 windows for now — very long takes slowly sharpen."*

**`MiniMax H3 Continuum`** (Civitai 2860061) — https://civitai.com/models/2860061
Chunks de 5 s (3×5 s → 15 s; 6×5 s → 30 s). Passa **contexto latente de vídeo E áudio em conjunto** para cada chunk de continuação; remove sobreposição na montagem. Modo "Audio Seam" opcional. Honestidade do autor: *"No generative continuation system can guarantee a completely invisible boundary"* — movimento difícil, mudanças de luz ou de prompt produzem flicker visível.

**`ComfyUI-MiniMaxH3-Director`** — https://github.com/seesee75-commits/ComfyUI-MiniMaxH3-Director
Editor de **timeline** com 3 tracks (main / reference video / audio). Arrasta-se media e ele **compila o prompt estruturado H3 em tempo real** (com contagem de palavras e avisos antes de renderizar). Slots de subject (até 9) com os marcadores de retenção. Diálogo escrito como `@ref1: words` recebe `(S1)`, `(S2)` automaticamente. **Retake Mode**: regenera um intervalo ancorando o frame anterior como `first_frame` e o seguinte como `last_frame`; `MiniMax H3 Retake Stitch` remonta head+retake+tail. Requisitos: ComfyUI ≥ 0.30.0, ~16 GB VRAM, 60 GB disco.

### 5c. O que produz deriva visual
- Regenerar plano a plano a partir de **prompts de texto frescos**, sem referência partilhada — o modelo **não tem memória** do plano anterior. Descrever melhor em texto **não resolve**.
- Cadeias longas por last-frame: acreção de textura + colapso da banda vocal.
- Mudanças grandes de prompt ou de iluminação entre chunks.

---

## 6. Skills e agentes já existentes — **não reinventar**

**Achado forte: existe muita coisa, e a base oficial é boa.**

### 6a. Oficiais — MiniMax publicou **nove skills** compatíveis com Claude Code
https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills
Instalação: `npx skills add https://github.com/MiniMax-AI/MiniMax-H3 --skill h3-prompt-writing` (ou `--skill '*'`).
Fonte da instalação: https://comfyui-wiki.com/en/news/2026-08-10-minimax-h3-official-skills

1. **`h3-prompt-writing`** ⭐ — "Write structured MiniMax H3 video generation prompts for all five generation modes". **Frontmatter declara-se portátil: "no external API calls, MiniMax Hub tools, or proprietary runtime required"**. É um `SKILL.md` de ~2.6 kB + `references/base-en.txt` + `references/ref-en.txt`. **Esta é a fundação a adoptar.**
2. `minimalist-product-ad-generator`
3. `3d-animation-short-generator` — "complete stylized 3D animated shorts from a story idea through an ordered production workflow"
4. `papercraft-stop-motion-explainer`
5. `brand-promo-video-generator`
6. `music-video-subtitle-generator`
7. `co-op-game-intro-generator`
8. `paper-collage-explainer-generator`
9. `handdrawn-live-video-generator`

⚠ Nota: as 8 de estilo são descritas por terceiros como **orientadas à API**; a `h3-prompt-writing` é a genuinamente portátil e local.

### 6b. Skills de terceiros para Claude Code (todas encontradas no GitHub)
| Repo | O que faz |
|---|---|
| **https://github.com/alperktt/awesome-minimax-h3-skills** ⭐ | **Índice + 6 skills próprias**: `h3-prompt-writer`, `h3-model-picker` (escolhe checkpoint/quant por VRAM), `h3-local-setup`, `h3-comfyui-runner`, `h3-workflow-recipes` (long-form, continuação, consistência de personagem), `storyboard-grid-prompter`. Traz **12 prompts prontos** em `/skills/h3-prompt-writer/library/` e **6 templates de género** com contagens de frames pré-calculadas. Tem `KNOWLEDGE.md`, `porting-prompts.md` (converter prompts Seedance/Veo/Kling) e `troubleshooting.md` |
| **https://github.com/teskor-hub/minimax-h3-skill** | Skill Claude Code: escolhe checkpoint, escreve no formato oficial, explica falhas. Ficheiros: `SKILL.md` + `references/{prompting,reference-mode,templates,comfyui,troubleshooting}.md`. Tem versões **portáteis** (`portable-prompt.md`, `reels-portable-prompt.md`) |
| https://github.com/hkhdair/minimax-h3-comfyui-skill | construir e depurar workflows H3 no ComfyUI |
| https://github.com/phileiny/h3-storyboard-skill | guião → shot lists H3 "with emotional performance that actually renders" |
| https://github.com/instann/minimax-h3-director | skill de direcção de prompt, Claude Code + Codex |
| https://github.com/chiphoton/MiniMax-H3-Codex-Drama | plugin Codex-first: planeia produção, cria fontes visuais de verdade, encaminha planos |
| https://github.com/elderlansouza/minimax-h3-comfyui-desktop-fox15-mcp | Ref2V no ComfyUI local via MCP, sobre o workflow foxfuressence Advanced v1.5 |

**Bibliotecas de prompts**: https://github.com/flaqai/awesome-minimax-h3-video-prompts · https://github.com/xianyu110/awesome-minimax-h3-prompts · https://github.com/BeatAPI/awesome-minimax-h3-prompts · https://github.com/sjh00/minimax-h3-storyboard-prompt-skills
**Índice de modelos/quantizações**: https://github.com/wildminder/awesome-minimax-H3

### 6c. Custom nodes relevantes
| Pack | Para quê |
|---|---|
| https://github.com/jlucasmcrell/ComfyUI-H3-Multishot | encadeamento, seam trimming, âncora de identidade |
| https://github.com/seesee75-commits/ComfyUI-MiniMaxH3-Director | editor de timeline + compilador de prompt |
| https://github.com/nkxx188/ComfyUI-MiniMaxH3-Easy | input unificado, sintaxe `@` para referências |
| https://github.com/ethanfel/ComfyUI-MiniMax-H3-Guide | compilação de prompt tipada com validação |
| https://github.com/shuaixn/ComfyUI-MiniMaxH3DualClockSampler | corrige áudio com Turbo-LoRA a poucos steps |
| https://github.com/kijai/ComfyUI-KJNodes | `Patch Sage Attention KJ` |
| https://github.com/city96/ComfyUI-GGUF | quantizações GGUF |

**Recomendação:** adoptar `h3-prompt-writing` (oficial) como núcleo + `alperktt/awesome-minimax-h3-skills` como referência operacional. **Não escrever um prompt-writer de raiz.**

---

## 7. Estado de arte da produção de vídeo com IA

Nota: esta secção é a mais fraca em fontes primárias — muito do que existe é conteúdo de marketing de ferramentas SaaS. Separei o concreto.

### 7a. O pipeline que se repete
`conceito → formato de episódio → character sheet → storyboard → shot list → geração de placas de cena → geração de planos → revisão/retake → upscale → montagem → packaging`
Fonte: https://github.com/clipcurator/ai-short-drama-production-workflows (⚠ a página devolveu 404 na verificação directa; a descrição vem do índice de pesquisa — **tratar como NÃO CONFIRMADO**)

### 7b. Fluxos concretos documentados
- **Krea Multi-Shot V2 → grid → H3**: gerar stills com identidade fechada no Krea Multi-Shot V2, compor um **scene board 3×3 ou 4×4 etiquetado**, e alimentar personagem + board ao MiniMax H3 para uma curta plano a plano. Fonte: https://shahzaib632.gumroad.com/l/short-film-director-krea-h3
- **Storyboard como referência única**: mapear painéis explicitamente no prompt — *"Image 4 is a storyboard reference for Shots 1, 2, and 3. Use it only to guide the shot order, camera viewpoint, subject placement, and approximate framing."* (https://www.rundiffusion.com/minimax-h3-prompt-guide). O `storyboard-grid-prompter` do alperktt automatiza exactamente isto.
- **Teste faseado antes da geração final** (RunDiffusion, o mais accionável de todos):
  1. personagem + cenário, câmara estática/lenta, sem diálogo
  2. juntar **uma** instrução de movimento ou um vídeo de referência
  3. juntar vídeo de referência com áudio, **uma** fala curta, separação de som
  4. introduzir storyboard ou segunda personagem
  5. geração final à resolução alvo
- **Pós**: upscale com **SEEDVR2** ou **LTX 2.3** + **NVIDIA VSR** + interpolação de frames — combinações que aparecem nos workflows Civitai 2836319, 2837418, 2831976.
- **Inline Studio** — app de filmmaking em node-canvas com H3 local e adaptação de VRAM: https://github.com/inlineresearch/Inline-Studio

### 7c. Ferramentas nomeadas no espaço (não verificadas em uso)
Storyflow (script/beats/moodboard/storyboard/shot list numa canvas), LTX Studio (script-to-screen), StudioBinder (breakdowns, call sheets), Boords (animatics), Midjourney v7 + LTX Studio para pré-viz, Runway/Krea para pré-viz generativa.

---

## Prompts reais de exemplo encontrados

### P1 — T2VA oficial (verbatim, `base-en.txt`, Case 1)
```
integrated_multimodal_description: [Shot 1] Live-action, cinematic, a medium-wide shot frames a baker opening the shutters of a small street bakery before sunrise. The camera pushes in with small amplitude at slow speed as the middle-aged baker with a calm, slightly raspy voice (S1) places a fresh loaf on the wooden counter and says: <d>[English] First batch of the morning.</d> [Shot 2] At 00:05.000, the camera cuts to a close-up of steam rising from the sliced bread while the baker's final words carry over from the previous shot.

overall_soundscape: Wooden shutters scrape open over a quiet street as trays clink softly inside the bakery. The doorbell rings once, followed by light footsteps and the crisp sound of bread being sliced.

non_diegetic_music: A soft acoustic-guitar pattern at a moderate tempo, joined by sparse upright-bass notes and a gentle fade at the end.
```

### P2 — I2VA oficial (verbatim, Case 2)
```
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, the young woman shown in <Picture 1> remains beside the rain-covered train window, preserving her appearance, clothing, seat position, and the carriage layout. The camera trucks right with small amplitude at slow speed as she lifts her gaze from the folded letter toward the passing city lights. Her reflection moves across the glass while the quiet, breathy young woman (S1) says: <d>[English] I get off at the next station.</d> She folds the letter along its existing crease.

overall_soundscape: The train wheels produce a steady metallic rhythm beneath a low ventilation hum. Rain ticks against the window while paper rustles softly in her hands.

non_diegetic_music: Sustained cello notes at a slow tempo with widely spaced piano tones, gradually decreasing in volume.
```

### P3 — FL2VA oficial, plano único de 8 s (verbatim, Case 3)
```
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the 8.00-second mark of the target video.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, a rain-soaked cyclist begins in the position and framing established by Picture 1, holding a closed black umbrella beside a silver bicycle. The camera pulls out with small amplitude at slow speed as she releases the bicycle handle, raises the umbrella above her shoulder, and presses the runner upward until the canopy opens. Water rolls from the expanding fabric while she steps beneath it, rotates the handle into the final angle, and settles into the pose, spacing, and composition established by Picture 2 at the end of the shot.

overall_soundscape: Rain falls steadily on the pavement, followed by the metallic click of the umbrella runner and the soft snap of the canopy opening. Water drips from the bicycle frame as distant traffic passes.

non_diegetic_music: N/A
```

### P4 — L2VA oficial, plano único de 6 s (verbatim, Case 4)
```
How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the 6.00-second mark of the target video.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, a close shot begins with an intact drinking glass near the edge of a dark wooden table, while the same hand and sleeve visible in <Picture 1> approach from the right. The camera pushes in with small amplitude at slow speed as the fingertips strike the rim. The glass tips, falls, and hits the floor with a sharp impact; cracks spread through it as fragments slide outward. Toward the end, the moving pieces lose momentum and settle into the exact broken arrangement, hand position, camera angle, lighting, and final composition established by <Picture 1>.

overall_soundscape: Fingertips tap the glass before it scrapes across the tabletop, falls, and breaks with a sharp crash. Small fragments scatter and gradually stop sliding across the floor.

non_diegetic_music: A low electronic pulse at a slow tempo, ending immediately after the glass breaks.
```

### P5 — Ref2VA oficial completo (verbatim, `ref-en.txt` §7) — **o modelo a copiar**
```
subject_definitions:
<Subject 1> is the coffee-shop environment in <Picture 1>, featuring an exposed brick wall, an orange tufted sofa with patterned pillows, a neon sign, and a wooden coffee table.
<Subject 2> is the fluffy white Samoyed in <Picture 2>, <Picture 3>, and <Picture 4>, with thick white fur, pointed ears, a dark nose, and a curved tail.
<Subject 3> is the young blonde woman in <Video 1>, with long blonde hair and a light-pink button-down shirt with rolled-up sleeves.
<Subject 4> is the young man in <Video 2>, with short wavy brown hair and a dark-grey hoodie with drawstrings.
<Audio 1> is the voice-timbre reference for <Subject 3> (S1), containing a spoken English vocal layer.

summary:
[reference generation + audio reference] The target video shows <Subject 3> eating a cookie in <Subject 1>. <Subject 4> enters with <Subject 2>, which lunges toward the cookie. The three-shot exchange uses <Audio 1> as the voice-timbre reference for <Subject 3> and ends with a canned audience laugh.

retention_analysis:
<Subject 1> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the exposed brick wall, orange tufted sofa, patterned pillows, neon sign, and wooden coffee table are retained.
<Subject 2> (appears in [Shot 1], [Shot 2]): fully_preserved - the Samoyed's thick white fur, pointed ears, dark nose, and curved tail are retained.
<Subject 3> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the blonde woman's identity, long hair, and light-pink shirt are retained.
<Subject 4> (appears in [Shot 1], [Shot 2]): fully_preserved - the young man's short wavy brown hair and dark-grey hoodie are retained.
<Audio 1>: reference - its vocal timbre guides the dialogue delivery of <Subject 3> without copying the original signal.

detailed_description:
The target video uses a realistic multi-camera sitcom style with warm indoor lighting.
[Shot 1] A medium shot establishes <Subject 1>, the coffee shop with its exposed brick wall, orange tufted sofa, patterned pillows, neon sign, and wooden coffee table. <Subject 3> (S1), the young woman with long blonde hair and a light-pink button-down shirt with rolled-up sleeves, sits on the sofa holding a chocolate-chip cookie. From the left, <Subject 4>, the young man with short wavy brown hair and a dark-grey hoodie with drawstrings, enters holding the leash of <Subject 2>, the thick-furred white Samoyed with pointed ears, a dark nose, and a curved tail. The dog lunges toward the cookie and pulls the leash taut. <Subject 3> (S1) jerks her hand back and, using the clear youthful voice timbre referenced from <Audio 1>, exclaims with light annoyance, <d>[English] Hey! Watch your dog!</d> She closes her lips and guards the cookie while <Subject 4> pulls the dog back.
[Shot 2] At 00:03.000, the shot cuts to a close-up of <Subject 4> (S2), the young man in the dark-grey hoodie from Shot 1, sitting beside <Subject 3> on the sofa and holding <Subject 2> securely in his arms. <Subject 4> (S2) says in a casual young male voice with a playful tone and an easy conversational pace, <d>[English] He just likes cookies more than me.</d> He closes his mouth into an apologetic smile and strokes the dog's thick white fur.
[Shot 3] At 00:05.000, the shot cuts to a close-up of <Subject 3> (S1), the blonde woman in the light-pink shirt from Shot 1. Her annoyance softens as she looks toward the Samoyed. <Subject 3> (S1) replies in the same clear youthful voice referenced from <Audio 1> with an amused cadence, <d>[English] Well, he has good taste at least.</d> She smiles and raises the cookie in a small toast-like gesture. A classic canned audience laugh begins immediately after the line and continues through the final frame.

overall_soundscape:
Soft indoor coffee-shop room tone continues throughout the scene.

non_diegetic_music:
N/A
```

### P6 — Ref2VA comunitário, 8 s (verbatim, RunDiffusion)
```
Cinematic live-action product video with warm sunrise light and restrained color contrast. Image 1 defines the woman's face, copper hair, and green jacket. Image 2 defines the rooftop garden and sunrise lighting. Image 3 defines the matte-black RunDiffusion travel cup, including its shape, finish, silver rim, colored icon, and white RunDiffusion wordmark. Video 1 provides the woman's measured walking pace, slow camera movement, and the warm vocal timbre and calm delivery heard in its audio.
```
Fonte: https://www.rundiffusion.com/minimax-h3-prompt-guide

### P7 — fragmentos oficiais úteis
```
The camera pushes in with small amplitude at slow speed toward the folded letter in her hands.
The man (S1) says in an off-screen voiceover: <d>[English] I still remember that road.</d> while his lips remain completely closed.
A red neon sign reading "营业中" glows above the doorway.
<Audio 1> is the voice-timbre reference for <Subject 1> (S1).
<Picture 3> is a storyboard reference for [Shot 1] and [Shot 2], defining their viewpoint, subject placement, and shot order.
<Subject 1> is the woman whose appearance comes from <Picture 1> and whose walking motion comes from <Video 1>.
```

---

## Definições operacionais no ComfyUI (referência rápida)

Fonte: https://docs.comfy.org/tutorials/video/minimax/minimax-h3

| Parâmetro | T2V/I2V | R2V |
|---|---|---|
| Steps | 20 (default); 25+ melhor qualidade | 20; 25+ |
| Turbo steps | 8 | 4 |
| Resolução | 1344×768 (16:9 nativo), múltiplos de 32 | idem |
| FPS | 24 | 24 |
| Duração | grelha 17k+5 | idem |
| `ref_image_size` | — | `match` (rápido) / `max` (2048px, identidade forte) |

- Alvo ~**0.98 megapixels**; evitar 1.0 MP (ultrapassa o cap de 768×1344).
- Nós: `MiniMaxH3ImageToVideo`, `MiniMaxH3ReferenceToVideo`, `MiniMaxH3AddGuide`, `EmptyMiniMaxH3LatentAV`, `MiniMaxH3SigmaShift` (shift_video 12, shift_audio 3 — defaults confirmados localmente pelo utilizador; **não encontrei documentação pública que os explique**).
- **Sage Attention duplica aproximadamente a velocidade** com perda mínima. `Patch Sage Attention KJ` entre `UNETLoader` e `BasicGuider`, em `auto`. Algumas camadas caem para atenção standard por restrições de dtype — **é esperado, não é bug**.
- Requer **ComfyUI ≥ 0.30.0**.
- Sampler/scheduler: comunidade reporta **20 steps com `res_multistep`** como padrão, e que **a escolha de scheduler pesa mais do que o número de steps** (https://github.com/teskor-hub/minimax-h3-skill — não confirmado em fonte oficial).

---

## O que NÃO consegui confirmar

1. **Paper / relatório técnico formal.** Não encontrei arXiv nem PDF de technical report do H3. O detalhe arquitectural vem do model card e do README do GitHub. **NÃO CONFIRMADO** que exista paper.
2. **Resolução e duração nativas de *treino*.** O model card dá as saídas suportadas (768p, 4–15 s), não os dados de treino. A afirmação comunitária "treinado para ~124–362 frames na grelha 17k+5" vem só do teskor-hub. **NÃO CONFIRMADO oficialmente.**
3. **`MiniMaxH3SigmaShift`** — os defaults (shift_video 12, shift_audio 3) foram observados localmente pelo utilizador; **não achei nenhuma documentação pública** que explique o que fazem nem quando alterá-los.
4. **A tese dos "dois dialectos de prompt"** (formato dos pesos locais ≠ formato da API hospedada, e usar o errado dá **áudio silencioso**) vem só do `alperktt/awesome-minimax-h3-skills`. É plausível — o Director tem um toggle "MiniMax guide notation vs ComfyUI format" — mas **NÃO CONFIRMADO em fonte primária.** Merece teste empírico: é barato de verificar e caro de ignorar.
5. **Requisitos de VRAM oficiais.** A doc do ComfyUI não os declara. Os números (~16 GB VRAM, 60 GB disco) vêm do README do Director; o "RTX 3060" vem do blog da Comfy sem detalhe de configuração. Tempos de geração: **não encontrei nenhum número fiável**.
6. **Alcance exacto da licença para a UE.** Duas fontes concordam que a UE precisa de pedir licença, mas **não li o texto integral do acordo** nem sei se há isenção para uso pessoal/não-comercial. Antes de usar isto em trabalho de cliente, ler https://huggingface.co/MiniMaxAI/MiniMax-H3 (ficheiro de licença) ou contactar `model@minimax.io`.
7. **Threshold de receita de $20M.** Apareceu num resumo de pesquisa (atlascloud); **não confirmado** no texto da licença.
8. **`clipcurator/ai-short-drama-production-workflows`** devolveu **404** na verificação directa. O pipeline do ponto 7a vem do índice de pesquisa — **não verificado**.
9. **Discussões no Reddit (r/comfyui, r/StableDiffusion).** As pesquisas não devolveram threads específicos de MiniMax-H3. Não é prova de que não existam — pode ser limitação do indexador. **Nenhuma prática de prompting deste relatório vem do Reddit.**
10. **LoRAs no Civitai:** obtive nomes e IDs via API, mas os detalhes (ficheiro, trigger, força) só de **um** (2890588). Os outros três não foram abertos individualmente.
11. **Qualidade real das ferramentas de encadeamento.** Os números de deriva (1.05×/plano, +13%/junta) são **auto-reportados pelos autores dos packs**, não medidos independentemente.

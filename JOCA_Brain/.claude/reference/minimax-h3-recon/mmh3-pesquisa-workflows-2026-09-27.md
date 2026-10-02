# MiniMax-H3 local no ComfyUI — workflows rápidos e vídeo longo numa RTX 4070 SUPER 12 GB

**Data:** 2026-09-27 · **Modo:** deep · **Âmbito:** só pesquisa (nada corrido no ComfyUI, nada descarregado)
**Máquina-alvo:** Windows 11, RTX 4070 SUPER 12 GB (Ada, sm_89), 32 GB RAM DDR5-5200, ComfyUI portable 0.30.2 (revisão de 2026-08-05), torch 2.12.0+cu130.

Convenção de marcação: **[H3]** = fonte específica do MiniMax-H3 · **[genérico]** = ferramenta genérica aplicada a H3 por uma fonte citada · **[outro modelo]** = só existe evidência para Wan/LTX/etc., não extrapolado · **por medir** = sem número medido nesta máquina · **sem fonte** = não encontrei fonte.

---

## Conteúdo

- Resumo executivo
- 1. Introdução
- 2. Diagnóstico desta máquina (medido, não estimado)
- 3. Duração máxima por geração e custo
- 4. Vídeo longo
- 5. Acelerações
- 6. Upscale e interpolação
- 7. Workflows partilhados (concretos)
- 8. Custom nodes relevantes
- 9. Síntese
- 10. Limitações e ressalvas
- 11. Recomendações para esta máquina (por ordem)
- Bibliografia
- Apêndice — metodologia

## Resumo executivo

A descoberta mais importante desta pesquisa não está na web: está no log local de hoje. Nos seis planos i2v medidos esta tarde (384×672, 73 frames, 8 passos), cada plano de ~223–271 s gastou **99–121 s a carregar/correr o text encoder**, **82–107 s na fase do modelo de difusão** — dos quais a barra do sampler só mostra **19–44 s** de amostragem — e **~39 s a descodificar** [L1]. O ritmo de amostragem em regime foi ~2,3 s/passo [L1]. Ou seja, **a computação propriamente dita é uma fatia pequena; o resto é leitura de pesos**. A causa provável é física: os ~41 GB de modelos vivem no disco **D:, que é um HDD SATA (WD10EZEX)**, e com 32 GB de RAM o encoder (15,7 GB) e o DiT (21 GB) não cabem os dois em cache, por isso são relidos do disco a cada plano [L2][30]. Um utilizador com RTX 3090 e 31 GB de RAM mediu exactamente isto: mudar os modelos de HDD para NVMe baixou o encode de 90,3 s para 25,0 s [30], e o guia de VRAM mais completo recomenda, para 12 GB com só 32 GB de RAM, «pôr os modelos em NVMe e testar `--fast-disk`» [31]. O C: é um NVMe com 329 GB livres [L2].

Consequência prática: **LoRAs turbo, caches e SageAttention só atacam a fatia de 19–44 s**; nesta máquina, sozinhos, rendem pouco até o I/O estar resolvido. Por ordem de retorno esperado: (1) modelos para o NVMe, (2) separar encode/amostragem/decode por fases para o encoder e o DiT nunca se alternarem [30], (3) actualizar o ComfyUI de 0.30.2 para v0.37.0 — traz, entre ~50 correcções H3, os tokens `<d>`/`</d>` do diálogo que faltavam ao tokenizador [10] e o VAE ~2× mais rápido [28], (4) usar de facto uma LoRA de 8 passos (hoje corre-se a 8 passos **sem** LoRA, abaixo dos 20 por defeito do modelo base [3]), (5) subir a duração para ≥107 frames, porque 73 frames está abaixo do mínimo oficial de 4 s e da gama treinada de 124–362 frames [1][2].

Duração por geração: oficial **4–15 s** [1]; o nó aceita até 3600 frames mas o próprio código diz «trained range is ~124-362, longer is untested» [2]. Vídeo longo faz-se por encadeamento; o ecossistema amadureceu muito desde 2026-09-03 — continuação por latente com 22 frames de contexto e áudio contínuo [60], extensores com validação clip a clip [61] — mas **todas as fontes medem degradação por junta**, sobretudo no áudio e na textura, e recomendam cadeias curtas (~4 janelas, ~30–40 s) [64][60].

---

## 1. Introdução

### Âmbito
Seis perguntas: (1) duração máxima e custo; (2) técnicas de vídeo longo e degradação; (3) acelerações; (4) upscale/interpolação; (5) workflows partilhados; (6) custom nodes. Fora de âmbito: os nós «MiniMax Hailuo» de API paga (categoria `partner/video/MiniMax`).

### Método
- Leitura do log e inventário **locais** (só leitura): `comfyui.log`, `pip list`, `custom_nodes/`, tipo de disco [L1][L2].
- Código-fonte primário do ComfyUI (upstream e local) e ~50 PRs H3 fundidos desde 2026-08-03 [2][9]–[27].
- Model cards e listas de ficheiros via API pública do Hugging Face [5][46]–[56].
- READMEs de 20+ repos GitHub via `gh` [47]–[75].
- Artigos com medições em RTX 4070 12 GB (série «かみもと», note.com) [33]–[43].
- Reddit/X/YouTube via motor `last30days` (o Reddit bloqueia leitura directa; só tenho os excertos que o motor devolveu) [84]–[91].
- Civitai via API pública [77]–[83]; discussões HF [92]–[95].
- Base: a investigação interna de 2026-09-03 [96], revalidada — onde mudou, digo.

### Pressupostos com peso
1. Os tempos do log [L1] são de planos i2v com o workflow `i2v.py` da sessão de hoje (a sequência `VideoVAE → MiniMaxH3` antes da amostragem é o encode do first_frame).
2. «Sem LoRA turbo» deduz-se de não existir nenhuma LoRA H3 em `models/loras` [L2]; não abri o JSON do `i2v.py`.
3. Números de outras máquinas (3090, 5090, 4070 com 48 GB RAM) **não** se transpõem para esta; cito-os como direcção, não como previsão.

---

## 2. Diagnóstico desta máquina (medido, não estimado)

### 2.1 Divisão do tempo por plano [L1]
Seis planos consecutivos entre 20:23 e 20:48 de 2026-09-27, lidos das marcas de tempo do `comfyui.log`:

| Plano | Total | Text encoder | Fase DiT (carga + amostragem) | Barra do sampler | Decode (áudio+vídeo) |
|---|---:|---:|---:|---:|---:|
| 1 | 266,7 s | 117,5 s | 106,6 s | 44 s | 39,4 s |
| 2 | 270,8 s | 120,9 s | 107,0 s | 42 s | 39,7 s |
| 3 | 262,5 s | 113,2 s | 107,3 s | 43 s | 39,0 s |
| 4 | 256,9 s | 117,5 s | 96,8 s | 34 s | 39,3 s |
| 5 | 233,0 s | 102,5 s | 88,2 s | 26 s | 39,3 s |
| 6 | 223,2 s | 99,2 s | 81,6 s | 19 s | 39,2 s |

O ritmo instantâneo reportado pela barra é 2,27–2,33 s/passo em todos os planos [L1]; a média mais alta nos primeiros planos vem dos primeiros passos, quando os pesos ainda estão a entrar. O log mostra também `Model MiniMaxH3TEModel_ prepared for dynamic VRAM loading. 14956MB Staged` e `Model MiniMaxH3 ... 19995MB Staged` em **cada** plano [L1] — os dois modelos grandes são re-preparados a cada prompt.

### 2.2 Porquê [L2]
- `D:` (onde está o ComfyUI e os modelos) = **WDC WD10EZEX, HDD SATA**. `C:` = **WD_BLACK SN770, NVMe**, 329 GB livres.
- RAM 2×16 GB = 32 GB; o ComfyUI arranca com `Enabled pinned memory 13009.0` e `DynamicVRAM support detected and enabled`.
- Encoder 15,68 GB + DiT 20,97 GB + VAE vídeo 5,2 GB = ~42 GB [5] > 32 GB de RAM, pelo que a cache do sistema operativo não os guarda todos.

A mesma assinatura está medida noutra máquina: numa RTX 3090 com 31 GB de RAM, «the 15 GB text encoder is re-read every run (`--cache-none` is load-bearing at 31 GB of RAM)» e passar de HDD para NVMe baixou o encode de **90,3 s para 25,0 s**; o autor mediu o HDD a 227 MB/s e o NVMe a 1,8 GB/s [30]. O mesmo autor descreve que, nessa configuração, «MiniMax H3 spends roughly 80% of its wall clock not sampling» [30]. O guia da InstaSD (lido do master do ComfyUI a 2026-08-08) diz para 12 GB: «With only 32 GB of RAM, put the models on NVMe and test `--fast-disk`» e que «going from 32 to 64 GB of RAM does more for big-model ComfyUI than every flag in this post combined» [31]. O PR #16333 (2026-09-15) passa a detectar automaticamente discos rápidos no Windows e a usar `--fast-disk` por modelo, dando prioridade de RAM aos modelos em discos lentos [15].

**Ganho local de mover para NVMe: por medir.** A causa está identificada com medição local; o tamanho do ganho aqui não.

### 2.3 Outros achados locais [L2]
- Não há `triton` nem `sageattention` instalados (o log mostra `backend triton: ... No module named 'triton'`), nem KJNodes, nem LoRAs H3, nem embeddings H3.
- O `comfy_kitchen` backend CUDA está activo e o torch já é cu130 — o problema de «PyTorch cu129 lento» medido por outro utilizador (12:50 → 5:55 ao passar para cu130) [45] **não se aplica aqui**.
- O portable inclui `run_nvidia_gpu_fast_fp16_accumulation.bat`, que liga `--fast fp16_accumulation` — é esta flag que o VAE novo aproveita (a partir de v0.36.0) [28].

---

## 3. Duração máxima por geração e custo

### 3.1 O que é oficial [H3]
- **4–15 s** de saída, 24 fps, lado curto 768 px por defeito [1].
- O ComfyUI encaixa `length` na grelha **17k+5** (5, 22, 39 … 124 … 362) [3]; a fórmula do template é `max(5, round(a*24)) + (5 - (max(5, round(a*24)) % 17)) % 17` [6]. Mapeamentos citados: 73 = 3 s, 107 = 4 s, 124 = 5 s, 362 = 15 s [63].
- O nó aceita `max=3600`, mas o tooltip no código diz: «124 = ~5s; trained range is ~124-362, longer is untested» [2]. Área máxima: `MAX_PIXELS = 768 * 1344` [2].
- **O teu `length=73` (3,04 s) está abaixo do mínimo oficial de 4 s e da gama treinada.** Efeito na qualidade: por medir.

### 3.2 Para lá dos 15 s numa só geração
Corre, mas fora da gama treinada. Um utilizador gerou 1216×704 × 736 frames (~30 s) numa Blackwell de 96 GB sem ruído, no contexto de testar SageAttention [30]; o mesmo autor viu ruído a 1920×1088 × 362 frames com um kernel FP8 da Sage [25][30]. Não encontrei avaliação de qualidade de gerações únicas >15 s: **sem fonte**. Todos os packs de vídeo longo trabalham em janelas ≤362 frames [63][64][65].

### 3.3 Custo em 12 GB (pontos de dados, todos de outras máquinas)

| Fonte | Hardware | Config | Tempo |
|---|---|---|---|
| Civitai «img2Vid 12GB» (v2.0, 2026-09-18) [78] | «12GB VRAM» (RAM não dita) | 0,2 MP, **15 s**, 4 passos | ~2 min |
| idem [78] | idem | 0,4 MP, **15 s**, 20 passos | ~22 min |
| r/comfyui, via InstaSD (2026-08-12) [31] | RTX 4070 12 GB + **64 GB RAM** | 608×352, 10 s, 20 passos | 167 s |
| idem [31] | idem | 864×480, 10 s | 11 min |
| かみもと (2026-08-04) [33] | RTX 4070 12 GB + 48 GB RAM, v0.30.0 | 864×480, 124 f, 20 passos, t2v | ~4 min 44 s |
| idem [33] | idem | 10 s | 16 min |
| かみもと (2026-08-09) [35] | RTX 4070 12 GB | 544×832, 5 s, Turbo 4 passos + Sage | ~71 s (a quente) |
| かみもと (2026-08-09) [36] | RTX 4070 12 GB | 576×832, 124 f, LoRA v4-600 8 passos | 128 s |
| lumichy (2026-08-15) [44] | RTX 5060 Ti 16 GB | 1344×768, 10 s, LoRA 8 passos | 375 s (vs 830 s sem LoRA) |
| X @neko_shacho0808 (2026-09-27) [91] | RTX 4060 Laptop 8 GB | não dito | 692 s; 10 s em 1464 s |

VRAM: com DynamicVRAM a placa fica sempre «cheia» e o excedente é transmitido; o limite real é a RAM [31]. Uma V100 usou 28 GB de VRAM **e** 54 GB de RAM em simultâneo para 5 s a 0,2 MP [31]. O 4070 com 48 GB de RAM usou 46 GB de RAM [33].

**Relação duração → trabalho (cálculo a partir do código [2], não estimativa de tempo):** o número de frames latentes é `((frames−5)//17)*5+2`. A 384×672: 73 frames → 22 latentes; 124 → 37; 362 → 107. Uma geração de 15 s tem ~4,9× os tokens de uma de 3 s à mesma resolução; a atenção cresce mais do que linearmente. O nó `MiniMax H3 Token Counter` do KJNodes conta os tokens antes de amostrar [75]. Tempo real a 15 s nesta máquina: **por medir**.

---

## 4. Vídeo longo

### 4.1 O que o modelo faz de raiz [H3]
- **FL2VA** (primeiro e/ou último frame) é o próprio checkpoint que tens [1][5]. Os prompts oficiais para FL2VA preferem um só plano entre as duas âncoras [96].
- **`MiniMaxH3AddGuide`** (PR #15439, fundido 2026-08-13 [16]): ancora uma imagem, **um clip de 5/22/39… frames** e/ou áudio em qualquer `frame_idx`, incluindo negativos (contados do fim); encadeável [2]. É o mecanismo nativo para «continuar» um clip com contexto de movimento e som. **Não existe no 0.30.2 local** [2][L2]. O pack H3-Multishot recomenda v0.34+ para âncoras interiores nativas [64].
- **Máscaras de ruído por token** (PR #15375, 2026-08-18): 0 preserva, 1 regenera, vídeo e áudio separados [17][3] — base da continuação «in-place» por latente [62].
- O template oficial `video_minimax_h3_i2v_continuation.json` usa os mesmos nós do i2v, sem nós de continuação latente [7] — na prática é «último frame → first_frame». O `video_minimax_h3_multiframe_reference.json` usa `MiniMaxH3AddGuide` [8].
- **Context Windows do core não servem:** o issue #15982 (aberto, 2026-08-30) documenta cintilação no H3 a partir da segunda janela, porque o modelo não é informado da posição da janela na timeline [24]. Pedido equivalente no KJNodes, aberto [75]. *Sliding window* ao estilo Wan/AnimateDiff: **[outro modelo]**, não funciona no H3 nativo.
- **Loops:** FL2VA com a mesma imagem no primeiro e último frame é a técnica descrita publicamente; só encontrei fontes fracas (páginas de tutorial) e **nenhuma medição H3** — sem fonte de qualidade.

### 4.2 As técnicas, da mais simples à melhor

| Técnica | Como | Custo/risco | Fontes |
|---|---|---|---|
| Último frame → first_frame (o que fazes hoje) | decode → imagem → i2v | cada junta paga decode+resize+re-encode, «where the colour drift and the softening down a long chain come from»; o som recomeça em vez de continuar | [60][96] |
| Planos independentes + montagem (cortes) | refs fixas por cena, sem contexto latente | sem deriva acumulada; é o que o H3 faz melhor («planos, não filmes») | [41][96] |
| AddGuide com clip + áudio do fim do anterior | nativo ≥v0.34 | passa por pixéis; o áudio ancora «para a frente», não continua o que já soou | [2][60] |
| Contexto latente (fatia do latente anterior) | H3-Motion-Context, Extender, Long-Video, TimelineDirector | sem ida a pixéis; áudio contínuo; degradação mais lenta mas existe | [60][61][63][68] |
| Contexto latente protegido por máscara + último frame como «reset» | Herrgotts v1.4 | FL2VA com last frame repetido «pulling composition, identity and image quality back toward a clean reference» | [62] |

### 4.3 Degradação por junta — números publicados (todos auto-reportados pelos autores)
- H3-Multishot: sem controlos, textura «ratchets roughly 1.3x per join»; com todo o conjunto anti-deriva, residual «about 1.02 per hop»; noutra medição, «+13% fine texture per join at 736x1280»; «Under ~4 windows (~30-40 s) it is slight; at 7 windows it is visible sharpening» [64].
- H3-Motion-Context: «Quality degrades down a chain. The big one, and it's mostly audio… after several clips the sound gets duller and more muffled. Picture holds up much better.» Correlação de áudio nas juntas passou de ~0,45 para 0,95+ com o método dele [60].
- かみもと (MV de 30 s, 4070): ao transportar o latente de vídeo viu linhas a engrossar, tom de cor a mudar, estilo a derivar; a solução foi **não** transportar o latente de vídeo — cada clip regenerado das mesmas 3 refs, 5 frames de pré-roll, áudio mestre fixo; ~28 min para 30 s (7 clips de 124 frames) [41].
- MiniMax H3 Continuum (Civitai, citado na investigação de 2026-09-03, não relido hoje): «No generative continuation system can guarantee a completely invisible boundary» [96].

### 4.4 Duração do contexto
- 22 frames é o valor recomendado por dois packs independentes: «5 is just barely fluid, 22 is nearly seamless… 56 spends 2.3 seconds of every render on frames you throw away. Use 22.» [60]; HR Endless: «`22` frames is a good default» [65]. Herrgotts usa 39 por defeito [62]; Long-Video aceita 22 ou 39 [63].
- O contexto sai à cabeça de cada clip e é aparado — custa tempo de amostragem por junta.

### 4.5 Exemplos de vídeo longo em hardware fraco
- 40 s numa RTX 3060 **6 GB** + 16 GB RAM, ~107 min, workflow «MiniMax H3 LongVideos» optimizado (r/comfyui, 2026-09-23, 405 pontos) [84].
- HR Endless: 625 frames a 1080p numa GPU de 16 GB; usa internamente o Gemma4 12B para planear cada chunk [65][87] — **pesado para 32 GB de RAM**, não recomendado aqui.

---

## 5. Acelerações

### 5.1 Tabela-resumo (específico H3 salvo indicação)

| Técnica | Ganho medido | Onde medido | Serve para esta máquina? | Fontes |
|---|---|---|---|---|
| **Modelos em NVMe** | encode 90,3 → 25,0 s | 3090, 31 GB RAM | **Sim, prioridade 1** (causa medida localmente) | [30][31][L1][L2] |
| **Encode/amostragem/decode por fases** (cache de conditioning em disco, sem perdas) | 950 → 352 s por seed; 204 s com modelo+VAE residentes | 3090, 32 GB RAM | **Sim** — encoder e DiT deixam de se alternar | [30] |
| **LoRA turbo 8 passos** | 830 → 375 s (10 s, 1344×768) | 5060 Ti 16 GB | Sim, mas aqui o ganho é **qualidade** (já corres 8 passos sem LoRA) | [44][3] |
| **LoRA turbo 4 passos** + Sage | 342 → ~71 s | 4070 12 GB, 48 GB RAM | Parcial: só encurta a fatia de 19–44 s | [35] |
| SageAttention | 342 → 242 s (−29%), «no major difference» | 4070 12 GB | Parcial; exige triton-windows + wheel | [34] |
| Spectrum | 258 → 176 s (−31%) a 20 passos | 4070 12 GB | Só a 20 passos; não combinar com turbo | [37][59] |
| Sparse attention top-k (core #16072) | 288 → 260 s | 4070 12 GB, 1024×1792 | Exige ComfyUI ≥ set/2026 | [43][21] |
| Sol-Attn | 288 → 268 s; outro utilizador 15–20% | 4070; RTX desconhecida | Builds exigem SM89 — a 4070 SUPER qualifica | [43][92][30] |
| EasyCache (core) | 1,81× (só velocidade) | 3090 | **Não sem cuidado:** artefactos; ver 5.4 | [30][18] |
| TeaCache (Icyoung) | 306 → 102 s a 20 passos | CMP 170HX (Ampere) | Não testado em Ada; pensado para 20 passos | [57] |
| Block cache T8 | 1,09× num smoke test; inerte a 14 passos | vários | Não | [64] |
| VAE int8_convrot + v0.36+ + fp16 accumulation | round-trip 24,3 → 12,7 s | 5090 | Sim, após actualizar | [28][14] |
| comfy kitchen attention | 0 ganho (5090); mais lento que Sage (4070) | 5090; 4070 | Não | [92][43] |
| ClipProj (encoder 4B + projecção) | RAM 45,6 → 31,2 GB; tempo 135 → 132 s | 4070, 48 GB RAM | Talvez — lê 5,3 GB em vez de 15,7 GB; a fala em japonês degradou | [38][32] |
| torch.compile | — | — | **sem fonte H3**. O core tem agora o «Comfy Compiler» (memória + CUDA graphs) [20], com issues H3 abertos [27] | [20][27] |
| Block swap | — | — | Não existe como nó no H3 nativo; o DynamicVRAM faz streaming por tensor [31] | [31] |

### 5.2 LoRAs e checkpoints de poucos passos [H3]
O modelo base é só CFG-destilado; o defeito oficial é **20 passos**, com LoRA turbo **8** (FL2VA) ou **4** (Ref2VA) [3]. O template i2v oficial actual já traz `LoraLoaderModelOnly` com `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` a força 1, e o VAE `int8_convrot` [6]. Um aviso de quem testou: se o log disser `0 patches attached`, a LoRA não está a fazer nada — «you are running an undistilled model at 10 steps» [30].

| LoRA / checkpoint | Tamanho | Passos | Notas | Fontes |
|---|---:|---|---|---|
| lightx2v FL2V 8-step v1.0 (oficial, no repo Comfy-Org) | 1,95 GB | 8 | a do template oficial; o Studio da LightX2V usa a 8-step 768p v1.0 | [5][6][48] |
| lightx2v FL2V 4-step v1.0/v1.1/**v1.2** 768p | 1,95 GB | 4 | v1.1 mais rápida que v1.0 no 4070; «tends to degrade audio quality» | [48][40] |
| Versões redimensionadas (Kijai, drbaph) | 0,29–0,97 GB | 4/8 | menos RAM; Kijai: lightx2v 4-step «0.75 LoRA strength, er_sde» | [49][51] |
| Larry `minimax_h3_turbo_v4_step600_ema` | 0,77 GB (pruned 0,62) | 4–8 | «6–8 steps… where v4 looks its best»; >8 passos sobre-afia; força 1.0 | [46][47] |
| PDD `MiniMax-H3-FL2VA-Acc-8Step_pruned_comfy` (Kijai, alibaba-pai) | 1,72 GB | 8 | no 4070 «PDD is best» (velocidade+imagem+áudio); suporte nativo desde PR #15908 (2026-08-28) | [42][50][19] |
| HyperFlow 8-step (drbaph) | 0,31–3,9 GB | 8 | sigmas manuais publicados | [51] |
| TaoMate 3-step (drbaph / Robert1212star) | 2,48 GB | 3 | experimental | [51] |
| FastH3 (FastVideo) → conversor NikoDemon80 | — | 6 | 6 passos 2:45 vs 20 passos 7:10 (544×960); a LoRA original «does absolutely nothing» no ComfyUI sem conversão | [54][85] |
| FastH3 8-Step V2 int8_convrot (checkpoint completo) | 22,12 GB | 8 | só T2VA — «FL2VA and Ref2VA were not distilled»; shift 10 | [53] |
| MATLOWAI fused turbo int8_convrot | 20,98 GB | 4–8 | turbo 8-step + estilo «Mystic» fundidos; FL2VA e Ref2VA num só ficheiro; workflows `lowvram/` incluídos | [52] |

Ordem de qualidade de áudio medida no 4070: **sem LoRA > PDD > LightX2V > Larry** [42]. Afinação de terceiros para a Larry v4: euler/beta, SigmaShift vídeo 12 / **áudio 5.0** («wrong audio scheduling blows the audio out»), 10 passos como piso porque «6 steps clips the audio at digital full scale» [30]. O PR #15243 (2026-08-06) corrigiu o áudio com samplers estocásticos e poucos passos — **não está no 0.30.2 local** [11].

### 5.3 Quantizações mais leves
- DiT: `int8_convrot` pruned 20,97 GB (o teu) · `fp8_scaled` 20,95 GB (só se não houver cu130) [5] · **Kijai w4a8 12,54 GB**, exige ComfyUI ≥0.31.0 [50] · **GGUF Unsloth** Q4_K 11,42 GB, Q5_0 13,92 GB, Q8_0 21,43 GB [55].
- Encoder: `nvfp4_awq` 15,68 GB (o teu; «does not require Blackwell GPU») · `int8_convrot` 27,14 GB · bf16 51,5 GB [5]. **GGUF do encoder não é mais pequeno:** Q4_K_M 18,21 GB (Unsloth) [55], 19,8 GB (joeygambino, que exige o loader do H3-Multishot) [56]. A InstaSD recomenda GGUF do encoder para 12–16 GB [32], mas os tamanhos publicados contradizem a vantagem face ao nvfp4.
- Velocidade GGUF vs int8: um só dado — 5090 70 s vs 90 s em GGUF [91]. Qualidade GGUF: sem medição independente H3.
- Para esta máquina, um DiT de ~12 GB (w4a8 ou GGUF Q4) + encoder 15,7 GB caberia melhor em 32 GB de RAM. **Ganho e perda de qualidade: por medir.**

### 5.4 Caches — cuidado [H3]
- EasyCache compara latentes com sub-amostragem 8× fixa no código, fica cego ao detalhe fino e salta os passos finais; limitar `end_percent` a 0.70 remove o grão mas mantém só ~31% do ganho [30]. No 0.30.2 local ainda existe o bug de corrupção de áudio com EasyCache, corrigido no PR #15390 (2026-08-07) [18]. Outros relatos de que «EasyCache wrecking output» no H3 [31].
- Caches e turbo não se somam: «Below 6 steps any forecast/cache accelerator is dead weight» [30]; かみもと desaconselha Spectrum + Turbo [37]; o LongForge manda desligar a cache com Turbo [82].
- `lihaoyun6/ComfyUI-MiniMaxH3-Cache` «patches ComfyUI core files» [58] — risco em actualizações.

### 5.5 SageAttention na 4070 SUPER [H3]
- No 4070: `sageattention-2.2.0+cu130torch2.10.0andhigher.post6` + `triton-windows 3.7.1.post27`, via flag `--use-sage-attention`; −29% a 544×832 × 5 s × 20 passos [34].
- Riscos específicos de SM89: o issue #748 do KJNodes descreve corrupção silenciosa (cauda cinzenta a 362 frames) por overflow de 32 bits no kernel FP8 da Sage em sequências longas [75]; relato de vídeo acinzentado a 1088×1920 [75]; ruído com kernel FP8 forçado a ~185k tokens em Blackwell [25]. A resoluções baixas não há relatos de problemas.
- Nesta máquina a Sage só actua nos 19–44 s de amostragem [L1].

### 5.6 VAE e decode [H3]
- O decode passou a ser por chunks com VRAM independente da duração (PR #15446, 2026-08-09) [12]; VAE int8_convrot ~1,5× (PR #15334) [14]; kernels fundidos + `--fast fp16_accumulation` (PR #16187, 2026-09-15) [13]; blog: «Video VAE operations reduced by roughly half», v0.36.0+, int8 a 67,7 dB PSNR do decoder normal [28].
- Tiled decode: correcção de crash em NestedTensor (PR #15477) e mistura de tiles (PR #16436) estão fundidas [9]; um PR de «grid of mismatched tiles» continua aberto [9].
- Pré-visualização rápida: TAE `taeh3` (Kijai, suporte nativo desde PR #15695) [23][76]; «full-resolution draft frames in about 2 seconds, against roughly a minute per shot through the real VAE» [64].

---

## 6. Upscale e interpolação

### 6.1 Resolução de partida importa mais que o upscaler [H3]
- 4070 12 GB: subir 0,4 MP para 2K foi considerado «unreasonable»; 1,3 MP → 2K «looks beautiful even when zoomed in»; 0,4 MP → 2K em 8 min; 1,3 MP + SeedVR2 7B em 31 min; SeedVR2 a 2K dá OOM em 12 GB sem um pipeline em duas fases com tiled decode [39]. **[genérico aplicado a H3]**
- 3090: render a 480p + RealESRGAN ×4 → 720p foi **13% mais lento** do que renderizar a 720p directamente [30].
- Rostos em planos gerais degradam mesmo a 720p [93]; o H3-Multishot diz que «the model distorts faces below ~1 MP» [64] (fonte única). A tua resolução actual é 0,26 MP.

### 6.2 Upscale em latente [H3]
- LBH latent upscaler (671★): amplia o latente de 24 canais sem a ida e volta pelo VAE e depois refina à resolução alvo; «saves time, not VRAM» [71]. No 4070: 832×1216 → 1248×1824 em 3,8 s; total com refinamento 3 min 29 s (Larry 4 passos) vs 8 min 47 s gerando directamente em Full HD — 2,5–3,2× mais rápido [42].
- Two-stage «75% baixa resolução + 25% alta» integrado no TimelineDirector [68]; tutorial «2-STAGE WORKFLOW» para 6 GB [88].

### 6.3 Interpolação de frames [genérico aplicado a H3]
- `ComfyUI-Frame-Interpolation` (Fannovel16) tem nós **RIFE VFI (4.0–4.9)** e **FILM VFI** [73].
- Guia específico de um workflow H3 de videoclipe: RIFE `rife47.pth`, gerar 5× (120 fps) e reduzir para 60 fps «while keeping the original audio»; fazer o upscale **depois** da interpolação [72].
- Uso real num 4070 12 GB: 896×1184 × 10 s gerado com H3, depois upscale + interpolação para 1344×1776 a 60 fps [90]. Tempo da interpolação: não publicado.
- Workflows H3 com RIFE 24 → 48–60 fps: SEED HUNTER [77], Extender Long Video [81], LatentHeart Ref2VA [83].
- A interpolação não altera a duração, por isso o áudio passa sem mexer [72]. Custo do RIFE/FILM nesta placa: **sem fonte**.

### 6.4 Upscalers genéricos usados em workflows H3
- NVIDIA RTX Video Super Resolution (`Comfy-Org/Nvidia_RTX_Nodes_ComfyUI`) — aparece em [79][81][83] e no modo «Standard + Upscale» do workflow 12 GB [78]. **[genérico]**
- SeedVR2 3B/7B e Real-ESRGAN — ver 6.1 [39]. LTX 2.3/2.5 como refinador — [79]. **[outro modelo usado como pós-processamento]**

---

## 7. Workflows partilhados (concretos)

| Workflow | Autor | Data | O que faz | Link |
|---|---|---|---|---|
| Templates oficiais t2v / i2v / r2v / multiframe reference / fun controlnet | Comfy-Org | 2026-08-03 → actual | nativos; i2v com LoRA 8 passos + VAE int8 | [5][6][8] |
| img2Vid MiniMax H3 (12GB VRAM) | theevildarkmage126 | v2.0 2026-09-18 | Quick 0,2 MP 15 s 4 passos ~2 min; Standard 0,4 MP 20 passos ~22 min; upscale RTX VSR | https://civitai.com/models/2841174 [78] |
| Minimax H3 SEED HUNTER v2.1 | foxydits | 2026-09-18 | 3 pré-visualizações baixa res → escolher → upscale latente; continuação; interpolação 48–60 fps | https://civitai.com/models/2881362 [77] |
| Minimax H3 EZ V4.1 | mrweaz | 2026-08-29 | Turbo, RTX upscale, refinamento LTX 2.5; avisa «do NOT use the releases version 0.31.0» | https://civitai.com/models/2831976 [79] |
| MiniMax H3 Ultra Fastest True 4 Steps (6GB/16GB) | RedditUser9811 | 2026-09-11 | 4 passos para placas pequenas | https://civitai.com/models/2835250 [80] |
| MiniMax H3 Extender for Long Video | Caphaomuoi | v1.0 2026-09-23 | sobre o Extender da tritant; Turbo 8 passos, Sol-Attn, Spectrum, RIFE, RTX upscale | https://civitai.com/models/2857494 [81] |
| MiniMax H3 LongForge v3.7 | AIBOB1199 | 2026-09-27 | contexto latente de vídeo+áudio protegido entre cenas; recuperação; refinador | https://civitai.com/models/2926029 [82] |
| MiniMax-H3 Multishot — Seamless Chain | joeygambino | ago/2026 | cadeia multi-plano como um só take; memória | https://civitai.com/models/2833322 [83] |
| sepiablue MV runner (30 s Ref2VA) | かみもと | 2026-08-25 | CLI YAML → API do ComfyUI; 7 clips × 124 frames; áudio mestre fixo; 4070 | https://github.com/sepiablue-ai/minimax-h3-mv-runner [41][67] |
| Acelerações no 4070 (topk + fast VAE) | かみもと | 2026-09-07 | `formal_topk_fastvae_b2_1024x1792.api.json`; flags `--disable-pinned-memory --disable-comfy-compiler --use-sage-attention` | https://note.com/sepiablue/n/n897be0e748da [43] |
| MATLOWAI workflows (4 passos SLA, low-VRAM) | MATLOWAI | 2026-08-29 | 5 workflows + versões `lowvram/` | https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot [52] |
| Music video native audio + RIFE | Shrek3OnVH5 | 2026-08-03 | bloqueia áudio fornecido no latente; ramo RIFE | https://github.com/Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow [72] |

---

## 8. Custom nodes relevantes

| Pack | ★ / datas | Para quê | Requisito | Fonte |
|---|---|---|---|---|
| **NikoDemon80/ComfyUI-H3-Motion-Context** | 1021★ · 2026-08-07 → 09-06 | continuação por latente (bit a bit), áudio que continua, Trim, Save/Load Latent, Seam Probe; `context_length` 22 | ComfyUI ≥0.34.0 (a v0.3.1 corre em mais antigos) | [60] |
| **tritant/ComfyUI_MiniMax_H3_Extender** | 264★ · 08-15 → **09-27** | clip a clip com validação, cache em disco, Ref2VA/FL2VA, até 3 guias por clip, LoRA e cor por clip, retoma de lotes | — | [61] |
| HerrgottMargott/Herrgotts-H3-Infinite-Continuation-Suite | 77★ · 08-11 → 08-22 | FL2VA encadeado, contexto latente protegido por máscara (39 frames), last frame como reset | PR #15375 | [62] |
| palealloy2999-prog/ComfyUI-MiniMax-H3-Long-Video | 4★ · 08-24 → 09-09 | Ref2VA longo com divisão do prompt por timeline, 22/39 frames, checkpoints em SSD, reroll por segmento | — | [63] |
| jlucasmcrell/ComfyUI-H3-Multishot | 65★ · 08-04 → 08-27 | cadeia multi-plano, anti-deriva, encoder remoto, TAE, `low_ram_master` | defaults para 16–24 GB | [64] |
| Songssx/ComfyUI-MiniMaxH3-TimelineDirector | 497★ · 08-22 → 09-22 | segmentação longa numa execução, Drift-Control, two-stage 75/25 | — | [68][89] |
| AIMixer/ComfyUI_MiniMaxH3_Director | 2063★ · 08-04 → 09-24 | «director» multi-segmento; guia entre segmentos com 5/22… frames | — | [69] |
| hradec/ComfyUI-HR-Endless-Sampler | 108★ · 08-17 → 09-26 | chunks + Gemma4 12B a reescrever prompts | pesado em RAM | [65] |
| LeonQ8/ComfyUI-ALLinONE-MinimaxH3 | 334★ · 08-15 → 09-27 | um nó para tudo; modos Extend/Chain via Motion-Context-MultiRef | — | [70] |
| seitanism/ComfyUI-H3-Motion-Context-MultiRef | 242★ · 08-09 → 09-05 | extensão, MV one-shot, keyframes | — | [67] |
| Larryvrh/ComfyUI-MiniMax-H3-Turbo | 587★ · 08-06 → 08-14 | nós Turbo LoRA + Turbo Sampler | — | [47] |
| pepikir/minimax-h3-speedup | 12★ · 08-05 → 08-10 | `H3SaveConditioning`/`H3LoadConditioning`/`H3SaveLatentAV`/`H3LoadLatentAV` — execução por fases sem perdas | usa pickle: só ficheiros próprios | [30] |
| kijai/ComfyUI-KJNodes | 3325★ · push 09-13 | H3: Chunk FeedForward, Low VRAM Attention, Token Counter, Mem Eff Sage Patch | issue SM89 aberto | [75] |
| LBH-123-AI/Comfyui_Minimax_h3_latent_Upscaler | 671★ · 08-17 → 09-17 | upscale no latente + Split Upscale em tiles | modelo em `latent_upscale_models/` | [71] |
| xmarre/ComfyUI-Spectrum-MiniMax-H3 | — | previsão de features para saltar avaliações | — | [59][37] |
| Icyoung/ComfyUI-MiniMaxH3-TeaCache | 17★ · 1 dia de commits | TeaCache | não calibrado | [57] |
| Fannovel16/ComfyUI-Frame-Interpolation | 1078★ | RIFE / FILM **[genérico]** | — | [73] |
| Comfy-Org/Nvidia_RTX_Nodes_ComfyUI | 630★ | RTX VSR **[genérico]** | GPU RTX | [74] |

**WanVideoWrapper-like para H3:** não existe um wrapper do Kijai no estilo do WanVideoWrapper. O Kijai escreveu o suporte nativo do H3 no core (PR #15224) e mantém nós H3 no KJNodes, a TAE e pesos experimentais [9][75][76][50].

---

## 9. Síntese

1. **Nesta máquina o gargalo é I/O, não computação.** A barra do sampler ocupa 8–17% do tempo de cada plano [L1]. Tudo o que actua só dentro do sampler — LoRAs, caches, Sage, sparse attention — tem o ganho limitado por essa fatia até o encoder e o DiT deixarem de ser relidos do HDD.
2. **O ComfyUI local está 7 versões atrás** (0.30.2 vs v0.37.0 [9]), e a distância não é cosmética: diálogo `<d>` tokenizado sem os tokens especiais [10], áudio com samplers estocásticos [11], VAE mais rápido [12][13][28], AddGuide e máscaras por token para continuação [16][17], PDD [19], `--fast-disk` automático [15]. Contrapartida: há regressões abertas em versões recentes (VRAM #16150, compilador #16342/#16230) [26][27] e um autor avisa para não usar a release 0.31.0 [79]. Actualizar exige backup do `python_embeded` e da pasta.
3. **Vídeo longo continua a ser montagem de planos.** As ferramentas de continuação resolvem o movimento e o som na junta, mas nenhuma elimina a deriva acumulada; os autores sérios recomendam cadeias curtas e resets por imagem de referência [60][62][64][41]. O teu fluxo actual (refs Krea por cena → i2v → montagem) é o padrão mais robusto; a continuação latente fica para os momentos que pedem um take contínuo.
4. **Resolução e duração actuais estão abaixo do sítio onde o modelo é bom.** 73 frames < gama treinada [2]; 0,26 MP é baixo para rostos [64][93]. Resolver o I/O primeiro é o que liberta orçamento para subir estas duas coisas.

---

## 10. Limitações e ressalvas

- **Reddit:** o site bloqueia leitura directa (403) e o WebFetch não o acede; só tenho título, data, pontuação e o início de cada post via motor `last30days` [84]–[89]. Os comentários não foram lidos.
- **Instasd:** o WebFetch deu 403; li o HTML com `curl`. As medições de r/comfyui que ela cita [31] são em segunda mão.
- **Números auto-reportados:** as métricas de deriva [60][64] e os ganhos de TeaCache [57] vêm dos próprios autores, sem verificação independente.
- **Hardware diferente:** quase todos os números de 4070 são de uma máquina com **48 GB** de RAM e disco não especificado [33]–[43]; ninguém publicou uma medição com 4070 + 32 GB + HDD.
- **Ganho local de NVMe / fases / actualização: por medir.** A regra da casa proíbe usar estimativas para decidir; a ordem das recomendações assenta na **causa medida** [L1][L2], não num número previsto.
- **Sem fonte:** torch.compile no H3; qualidade de gerações únicas >15 s; qualidade de loops FL2VA; custo do RIFE/FILM numa 4070; qualidade GGUF vs int8 no H3; efeito do ClipProj em fala portuguesa (só há dados para japonês [38]).
- **Licença:** uso local **comercial** exige licença; a Comfy passou a revendê-las a 2026-08-27 [29]. A investigação anterior assinalou que a licença comunitária trata a UE como território que pede autorização [96]. Relevante para trabalho de cliente; os reels pessoais não mudam.

---

## 11. Recomendações para esta máquina (por ordem)

1. **Mover o stack H3 para o NVMe (C:).** São ~42 GB (DiT, encoder, 2 VAEs) [5]; o C: tem 329 GB livres [L2]. A forma menos invasiva é `extra_model_paths.yaml` a apontar para uma pasta no C:, mantendo o resto no D:. Depois medir os mesmos 6 planos e comparar com a tabela 2.1. [30][31][15]
2. **Correr os filmes por fases.** Fase 1: codificar os prompts de todos os planos com o encoder carregado uma vez; fase 2: amostrar todos com o DiT residente; fase 3: descodificar todos. Nós prontos e sem perdas: `pepikir/minimax-h3-speedup` [30]. Os scripts `queue.py`/`i2v.py` já fazem fila por API — é uma reorganização da fila, não um workflow novo.
3. **Actualizar o ComfyUI para v0.37.0**, com backup completo do portable antes. Ganhos directos: tokens `<d>` [10], áudio [11][18], VAE ~2× com `minimax_h3_video_vae_int8_convrot.safetensors` (2,81 GB) + `run_nvidia_gpu_fast_fp16_accumulation.bat` [28][14], AddGuide [16], PDD [19]. Se aparecer instabilidade, `--disable-comfy-compiler` é a saída que o utilizador da 4070 usou [43][27].
4. **Usar de facto uma LoRA de 8 passos.** Hoje são 8 passos sem destilação [L2][3]. Para prioridade ao áudio: **PDD 8-step** (1,72 GB, melhor no 4070) [42][50]; para seguir o template oficial: lightx2v 8-step v1.0 (ou a versão redimensionada de 0,36 GB do Kijai) [6][49]. Confirmar no log `patches attached` ≠ 0 [30].
5. **Subir a duração para ≥107 frames (4,46 s), idealmente 124 (5,17 s),** e, com o I/O resolvido, experimentar ~0,4 MP (ex.: 480×864). 73 frames fica abaixo do mínimo oficial e da gama treinada [1][2]; os rostos sofrem abaixo de ~1 MP em planos gerais [64][93].

Para vídeo contínuo (depois dos pontos 1–3): **tritant Extender** [61] se se quer trabalhar clip a clip com validação — é o que mais se parece com o teu método —, ou **H3-Motion-Context** com `context_length` 22 [60]; cadeias até ~4 janelas [64]; a imagem de referência da cena como last frame para travar a deriva [62]. Para fps: RIFE 24 → 48/60 depois de tudo, com o áudio intacto [72][73]. SageAttention fica para depois: ganho real no 4070 (−29%) [34], mas só na fatia de amostragem e com riscos de SM89 em sequências longas [75].

---

## Bibliografia

**Locais**
- [L1] Log do ComfyUI local, `<COMFYUI_DIR>\ComfyUI\user\comfyui.log`, sessão de 2026-09-27 16:45–20:48 (lido 2026-09-27).
- [L2] Inventário local de 2026-09-27: `pip list` do `python_embeded`, `custom_nodes/`, `models/loras`, `Get-PhysicalDisk`/`Get-Partition`, `df -h`, `Win32_PhysicalMemory`.

**Oficiais e código**
- [1] MiniMax-AI/MiniMax-H3, README — https://github.com/MiniMax-AI/MiniMax-H3 (repo criado 2026-07-30; lido 2026-09-27)
- [2] ComfyUI `comfy_extras/nodes_minimax_h3.py` (master) — https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_minimax_h3.py (lido 2026-09-27)
- [3] ComfyUI Docs, MiniMax H3 native workflows — https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native (sem data; lido 2026-09-27)
- [4] ComfyUI Docs, MiniMax H3 guide — https://docs.comfy.org/tutorials/video/minimax/minimax-h3 (sem data; lido 2026-09-27)
- [5] Comfy-Org/MiniMax-H3 (card + lista de ficheiros) — https://huggingface.co/Comfy-Org/MiniMax-H3 (criado 2026-07-30, modificado 2026-09-24)
- [6] Template `video_minimax_h3_i2v.json` — https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_i2v.json (lido 2026-09-27)
- [7] Template `video_minimax_h3_i2v_continuation.json` — https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_i2v_continuation.json (lido 2026-09-27)
- [8] Template `video_minimax_h3_multiframe_reference.json` — https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_multiframe_reference.json (lido 2026-09-27)
- [9] ComfyUI releases (v0.30.0 2026-08-03 … v0.37.0 2026-09-21) e lista de PRs H3 fundidos — https://github.com/Comfy-Org/ComfyUI/releases
- [10] PR #15808 «Minimax-H3: Add missing special tokens» (kijai, 2026-08-22) — https://github.com/Comfy-Org/ComfyUI/pull/15808
- [11] PR #15243 «Fix sampler issues for audio with minimax» (2026-08-06) — https://github.com/Comfy-Org/ComfyUI/pull/15243
- [12] PR #15446 «Optimize MiniMax-H3 VAE» (2026-08-09) — https://github.com/Comfy-Org/ComfyUI/pull/15446
- [13] PR #16187 «MiniMax-H3 VAE optimizations» (2026-09-15) — https://github.com/Comfy-Org/ComfyUI/pull/16187
- [14] PR #15334 «Support int8_convrot VAE for MiniMax-H3» (2026-08-06) — https://github.com/Comfy-Org/ComfyUI/pull/15334
- [15] PR #16333 «Aimdo 0.5.5 + Auto-detect and enable --fast-disk» (2026-09-15) — https://github.com/Comfy-Org/ComfyUI/pull/16333
- [16] PR #15439 «Add MiniMaxH3AddGuide» (2026-08-13) — https://github.com/Comfy-Org/ComfyUI/pull/15439
- [17] PR #15375 «per-token video and audio latent noise masks» (2026-08-18) — https://github.com/Comfy-Org/ComfyUI/pull/15375
- [18] PR #15390 «Fix MiniMax H3 audio corruption with EasyCache» (2026-08-07) — https://github.com/Comfy-Org/ComfyUI/pull/15390
- [19] PR #15908 «MiniMax-H3: Support PDD LoRA» (2026-08-28) — https://github.com/Comfy-Org/ComfyUI/pull/15908
- [20] PR #15861 «Introduce Comfy Compiler» (2026-09-04) — https://github.com/Comfy-Org/ComfyUI/pull/15861
- [21] PR #16072 «Add Sparse Attention node» (2026-09-06) — https://github.com/Comfy-Org/ComfyUI/pull/16072
- [22] PR #15479 «Implement comfy kitchen attention» (2026-08-11) — https://github.com/Comfy-Org/ComfyUI/pull/15479
- [23] PR #15695 «Add support for taeh3» (2026-08-18) — https://github.com/Comfy-Org/ComfyUI/pull/15695
- [24] Issue #15982 «Context windows: a model is never told where its window sits» (aberto, 2026-08-30) — https://github.com/Comfy-Org/ComfyUI/issues/15982
- [25] Issue #15263 «SageAttention FP8 PV kernels produce noise above ~160k tokens on sm_120» (aberto, 2026-08-03) — https://github.com/Comfy-Org/ComfyUI/issues/15263
- [26] Issue #16150 «Possible VRAM regression… MiniMax H3» (aberto, 2026-09-06) — https://github.com/Comfy-Org/ComfyUI/issues/16150
- [27] Issues #16342 e #16230 (compilador + H3, abertos, set/2026) — https://github.com/Comfy-Org/ComfyUI/issues/16342 · https://github.com/Comfy-Org/ComfyUI/issues/16230
- [28] Comfy Blog, «Making the MiniMax H3 Video VAE 2x Faster» (Jukka Seppänen, 2026-09-22) — https://blog.comfy.org/p/making-the-minimax-h3-video-vae-2x
- [29] Comfy Blog, «Comfy Is Now the Only Official Reseller of MiniMax H3 Commercial Licenses» (2026-08-27) — https://blog.comfy.org/p/comfy-is-now-the-only-official-reseller

**Medições e guias**
- [30] pepikir/minimax-h3-speedup (criado 2026-08-05, update 2026-08-11) — https://github.com/pepikir/minimax-h3-speedup
- [31] InstaSD, «ComfyUI VRAM Guide: Run MiniMax H3 on 8-16 GB Cards» (2026-08-12) — https://www.instasd.com/post/comfyui-vram-offloading-guide
- [32] InstaSD, «MiniMax H3 Text Encoders in ComfyUI» (2026-08-14) — https://www.instasd.com/post/minimax-h3-text-encoder-guide-comfyui
- [33] かみもと, 12 GB t2v/i2v (2026-08-04) — https://note.com/sepiablue/n/n8771bfb47b75
- [34] かみもと, SageAttention 30% num 12 GB (2026-08-08) — https://note.com/sepiablue/n/n1a7096eb9136
- [35] かみもと, Turbo LoRA 5 s em 70 s (2026-08-09) — https://note.com/sepiablue/n/n288431fd520e
- [36] かみもと, 3 configurações de passos (2026-08-09) — https://note.com/sepiablue/n/nf69250dc2542
- [37] かみもと, Spectrum −31% (2026-08-10) — https://note.com/sepiablue/n/ne23f9158c2b6
- [38] かみもと, ClipProj 15,7 → 5,2 GB (2026-08-12) — https://note.com/sepiablue/n/n6a78bb01511a
- [39] かみもと, upscale SeedVR2/Real-ESRGAN (2026-08-20) — https://note.com/sepiablue/n/n5e0993f6eebc
- [40] かみもと, LightX2V v1.1 e SLA (2026-08-22) — https://note.com/sepiablue/n/n36b10cafd581
- [41] かみもと, MV de 30 s com Ref2VA (2026-08-25) — https://note.com/sepiablue/n/n093af913081e
- [42] かみもと, Larry/LightX2V/PDD × upscaler LBH (2026-09-01) — https://note.com/sepiablue/n/nfad87a217eb1
- [43] かみもと, acelerações de novo, −30 s (2026-09-07) — https://note.com/sepiablue/n/n897be0e748da
- [44] lumichy, Qiita, 830 → 375 s com Turbo (2026-08-15) — https://qiita.com/lumichy/items/6538f75ea72653b6e626
- [45] たぬ (tank_ai), PyTorch cu130 2,17× (2026-08-09) — https://note.com/tank_ai/n/nab26edd4ab96

**LoRAs, checkpoints, quantizações**
- [46] larryvrh/MiniMax-H3-Turbo-Lora (criado 2026-08-05, mod. 2026-08-08) — https://huggingface.co/larryvrh/MiniMax-H3-Turbo-Lora
- [47] Larryvrh/ComfyUI-MiniMax-H3-Turbo (587★, 2026-08-06 → 08-14) — https://github.com/Larryvrh/ComfyUI-MiniMax-H3-Turbo
- [48] lightx2v/Minimax-h3-Turbo (criado 2026-08-07, mod. 2026-09-10) — https://huggingface.co/lightx2v/Minimax-h3-Turbo
- [49] Kijai/MiniMax-H3_comfy (criado 2026-08-07, mod. 2026-09-13) — https://huggingface.co/Kijai/MiniMax-H3_comfy
- [50] Kijai/MiniMax-H3-experimental (criado 2026-08-05, mod. 2026-09-22) — https://huggingface.co/Kijai/MiniMax-H3-experimental
- [51] drbaph/MiniMax-H3-Turbo-Lora-ComfyUI (criado 2026-08-06, mod. 2026-09-19) — https://huggingface.co/drbaph/MiniMax-H3-Turbo-Lora-ComfyUI
- [52] MATLOWAI/minimax-h3-fused-turbo-int8-convrot (criado 2026-08-29) — https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot
- [53] FastVideo/FastVideo-FastH3-Comfy (2026-09-08) e FastVideo-FastH3-8-Step-V2 (2026-09-04) — https://huggingface.co/FastVideo/FastVideo-FastH3-Comfy · https://huggingface.co/FastVideo/FastVideo-FastH3-8-Step-V2
- [54] NikoDemon80/ComfyUI-FastH3-Lora-Converter (2026-08-30) — https://github.com/NikoDemon80/ComfyUI-FastH3-Lora-Converter
- [55] unsloth/MiniMax-H3-GGUF (criado 2026-08-07, mod. 2026-08-14) — https://huggingface.co/unsloth/MiniMax-H3-GGUF
- [56] joeygambino/MiniMax-H3-encoder-GGUF (criado 2026-08-04) — https://huggingface.co/joeygambino/MiniMax-H3-encoder-GGUF

**Custom nodes**
- [57] Icyoung/ComfyUI-MiniMaxH3-TeaCache (2026-08-04) — https://github.com/Icyoung/ComfyUI-MiniMaxH3-TeaCache
- [58] lihaoyun6/ComfyUI-MiniMaxH3-Cache (2026-08-03) — https://github.com/lihaoyun6/ComfyUI-MiniMaxH3-Cache
- [59] xmarre/ComfyUI-Spectrum-MiniMax-H3 — https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3
- [60] NikoDemon80/ComfyUI-H3-Motion-Context (1021★, 2026-08-07 → 09-06) — https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context
- [61] tritant/ComfyUI_MiniMax_H3_Extender (264★, 2026-08-15 → 09-27) — https://github.com/tritant/ComfyUI_MiniMax_H3_Extender
- [62] HerrgottMargott/Herrgotts-H3-Infinite-Continuation-Suite (77★, 2026-08-11 → 08-22) — https://github.com/HerrgottMargott/Herrgotts-H3-Infinite-Continuation-Suite
- [63] palealloy2999-prog/ComfyUI-MiniMax-H3-Long-Video (2026-08-24 → 09-09) — https://github.com/palealloy2999-prog/ComfyUI-MiniMax-H3-Long-Video
- [64] jlucasmcrell/ComfyUI-H3-Multishot (65★, 2026-08-04 → 08-27) — https://github.com/jlucasmcrell/ComfyUI-H3-Multishot
- [65] hradec/ComfyUI-HR-Endless-Sampler (108★, 2026-08-17 → 09-26) — https://github.com/hradec/ComfyUI-HR-Endless-Sampler
- [66] pmhaidn/ComfyUI-Minimax-H3-Extender (2026-09-06) — https://github.com/pmhaidn/ComfyUI-Minimax-H3-Extender
- [67] seitanism/ComfyUI-H3-Motion-Context-MultiRef (242★, 2026-08-09 → 09-05) e sepiablue-ai/minimax-h3-mv-runner — https://github.com/seitanism/ComfyUI-H3-Motion-Context-MultiRef · https://github.com/sepiablue-ai/minimax-h3-mv-runner
- [68] Songssx/ComfyUI-MiniMaxH3-TimelineDirector (497★, 2026-08-22 → 09-22) — https://github.com/Songssx/ComfyUI-MiniMaxH3-TimelineDirector
- [69] AIMixer/ComfyUI_MiniMaxH3_Director (2063★, 2026-08-04 → 09-24) — https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director
- [70] LeonQ8/ComfyUI-ALLinONE-MinimaxH3 (334★, 2026-08-15 → 09-27) — https://github.com/LeonQ8/ComfyUI-ALLinONE-MinimaxH3
- [71] LBH-123-AI/Comfyui_Minimax_h3_latent_Upscaler (671★, 2026-08-17 → 09-17) — https://github.com/LBH-123-AI/Comfyui_Minimax_h3_latent_Upscaler
- [72] Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow (2026-08-03) — https://github.com/Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow
- [73] Fannovel16/ComfyUI-Frame-Interpolation (genérico) — https://github.com/Fannovel16/ComfyUI-Frame-Interpolation
- [74] Comfy-Org/Nvidia_RTX_Nodes_ComfyUI (genérico, 2026-03-09) — https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI
- [75] kijai/ComfyUI-KJNodes, `nodes/minimax_nodes.py` e issues #748 (SM89, 2026-08-31), #731, #759 — https://github.com/kijai/ComfyUI-KJNodes · https://github.com/kijai/ComfyUI-KJNodes/issues/748
- [76] Kijai/MiniMax-H3-TAE (2026-08-04) — https://huggingface.co/Kijai/MiniMax-H3-TAE

**Civitai (API pública, lida 2026-09-27)**
- [77] foxydits, «Minimax H3 SEED HUNTER» v2.1 (2026-09-18) — https://civitai.com/models/2881362
- [78] theevildarkmage126, «img2Vid MiniMax H3 Workflow (12GB VRAM)» v2.0 (2026-09-18) — https://civitai.com/models/2841174
- [79] mrweaz, «Minimax H3: EZ» V4.1 (2026-08-29) — https://civitai.com/models/2831976
- [80] RedditUser9811, «MiniMax H3 Ultra Fastest True 4 Steps… 6GB VRAM 16GB RAM» (2026-09-11) — https://civitai.com/models/2835250
- [81] Caphaomuoi, «MiniMax H3 Extender for Long Video» v1.0 (2026-09-23) — https://civitai.com/models/2857494
- [82] AIBOB1199, «MiniMax H3 LongForge» v3.7 (2026-09-27) — https://civitai.com/models/2926029
- [83] joeygambino, «MiniMax-H3 Multishot — Seamless Chain» — https://civitai.com/models/2833322 · ukr8b3g201, «MiniMax H3 Continuum» — https://civitai.com/models/2860061 · LatentHeart, «Ref2VA … Frame Interpolation» — https://civitai.com/models/2837418

**Comunidade (via `last30days`, só excertos)**
- [84] r/comfyui, «MiniMax H3 Long Video 40 Seconds on Just 6GB VRAM» (2026-09-23, 405 pts) — https://www.reddit.com/r/comfyui/comments/1wo2dsg/comfyui_tutorial_minimax_h3_long_video_40_seconds/
- [85] r/StableDiffusion, «FastVideo's new 4-step H3 LoRA doesn't work in ComfyUI. I made a converter» (2026-08-30) — https://www.reddit.com/r/StableDiffusion/comments/1w2ssyd/fastvideos_new_4step_h3_lora_doesnt_work_in/
- [86] r/StableDiffusion, «I Ran 112 MiniMax H3 Tests on an RTX 3090» (2026-09-07) — https://www.reddit.com/r/StableDiffusion/comments/1w9rvz6/i_ran_112_minimax_h3_tests_on_an_rtx_3090/ (dados: https://huggingface.co/datasets/badincite/minimax-h3-soup)
- [87] r/StableDiffusion, «HR Endless Sampler» (2026-08-30) — https://www.reddit.com/r/StableDiffusion/comments/1w25d7g/hr_endless_sampler_now_you_can_create_minimax_h3/
- [88] r/comfyui, «MINIMAX H3 2-STAGE WORKFLOW» (2026-08-29) — https://www.reddit.com/r/comfyui/comments/1w1inqy/comfyui_tutorial_minimax_h3_2stage_workflow/
- [89] r/comfyui, «I open-sourced my ComfyUI workflow for MiniMax H3 long-video generation» (TimelineDirector, 2026-09-17) — https://www.reddit.com/r/comfyui/comments/1wio4eg/i_opensourced_my_comfyui_workflow_for_minimax_h3/
- [90] X @AiPhotorealGirl, H3 num RTX 4070 12GB → 60 fps (2026-09-27) — https://x.com/AiPhotorealGirl/status/2104165305241264614
- [91] X @neko_shacho0808, 5090 vs GGUF vs 4060 Laptop (2026-09-27) — https://x.com/neko_shacho0808/status/2104164154382663873
- [92] HF Comfy-Org/MiniMax-H3 discussão #26 «Just a quick benchmark» (2026-08-04 → 08-16) — https://huggingface.co/Comfy-Org/MiniMax-H3/discussions/26
- [93] HF discussão #30 «Why MiniMax H3 Ruins Faces on Wide Shots?» (2026-08-05) — https://huggingface.co/Comfy-Org/MiniMax-H3/discussions/30
- [94] HF discussão #59 «Measured cost per clip on six rented GPUs» (2026-09-13) — https://huggingface.co/Comfy-Org/MiniMax-H3/discussions/59
- [95] HF discussão #38 «Model Reloads on prompt/image change?» (2026-08-08) — https://huggingface.co/Comfy-Org/MiniMax-H3/discussions/38

**Interno**
- [96] Investigação interna «MiniMax-H3 — investigação pública» (verificada 2026-09-03), `JOCA_Brain/.claude/reference/minimax-h3-recon/mmh3-web.md`

---

## Apêndice — metodologia

- **Skill `deep-research.md`:** não existe no repo; segui `.claude/agents/deep-research/reference/methodology.md`.
- **Ferramentas:** WebSearch (descoberta), WebFetch (note.com, docs, blogs), `gh api` (READMEs, metadados, PRs, issues, código), API pública do Hugging Face (listas de ficheiros e tamanhos), API pública do Civitai, `curl` com UA de browser (InstaSD), motor `last30days` 3.8.3 (Reddit/X/YouTube/HN, janela de 55 dias). Firecrawl não estava disponível nesta sessão.
- **Leitura local só de leitura:** log, `pip list`, listagens de pastas, tipo de disco. Nada foi executado no ComfyUI e nada foi descarregado.
- **Triangulação:** o gargalo de I/O tem 3 fontes independentes (log local [L1], pepikir [30], InstaSD [31]) e uma quarta no core (PR #16333 [15]); a gama de duração tem 3 (README oficial [1], código [2], docs [3]); o ganho da Sage no 4070 tem 1 fonte directa [34] e 2 indirectas [30][92]; a degradação por junta tem 4 autores independentes [41][60][62][64].
- **Mudanças face à investigação de 2026-09-03 [96]:** (a) «Sage duplica a velocidade» (docs) → no 4070 medido −29% [34]; (b) o ecossistema de LoRAs cresceu (PDD, HyperFlow, TaoMate, FastH3, Larry v4); (c) o AddGuide passou a nativo e surgiram 8+ packs de continuação; (d) o VAE int8 e as optimizações de set/2026 são novas; (e) o gargalo de I/O desta máquina é achado novo.

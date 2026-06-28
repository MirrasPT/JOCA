---
name: tcg
description: OmniClash (OC) 1v1 (duelo de cartas) crossover de temas (histórico, mitologia, cultura pop) — Unity (C#), alvo Android
type: project
directorio: C:\Users\renat\Projetos\tcg
---

**Stack:** Unity (C#) · alvo **Android** · motor de regras C# puro (POCO) separado da apresentação
**Objectivo:** OmniClash (OC) é um TCG de duelo 1v1 onde cada jogador comanda um exército temático (civilizações históricas, super-heróis, futebolistas, etc.) liderado por um General. Construir deck ~50 cartas, gerir gold, combate ATK vs DEF, derrubar as 5 muralhas do general adversário.
**Directório:** `C:\Users\renat\Projetos\tcg`
**GitHub:** `MirrasPT/tcg` (PRIVADO) — `master` ≡ local; remote `origin` configurado. Inclui código + arte (`assets/cards/`) + `cards.html`.
**Catálogo online:** `cards.html` (Codex de cartas) **LIVE** em `https://cartastcg.rfdev.pt` (VPS Datalix, vhost estático Caddy: `/var/www/cartastcg/` = `index.html` + `assets/cards/*.png`). Re-deploy: scp `cards.html`→`index.html` + PNGs. Ver `memory/projects/datalix-vps.md`.
**Iniciado:** 2026-06-27
**PRD:** PRD.md existe (GDD com regras core em §5) — actualizar via skill `prd` no /save
**Why:** Projecto pessoal de jogo. Renato (designer/PM) quer um TCG temático próprio.
**How to apply:** Ler skill `unity-gamedev` ANTES de código de gameplay. **Separação dura motor↔UI** (regras = C# puro testável em EditMode, UI consome eventos). Arte de cartas → `img-gen` + `graphic-design`. Conteúdo histórico/mítico afirmado como facto → validar contra fonte real (não inventar lendas/nomes). NÃO confundir com `mediaval-chess` (jogo SEPARADO: grelha+React).

## Conceito (regras-chave — fonte: PRD.md §5)
- **1v1**, deck **~50 cartas**. **General** em campo desde o início, habilidade fixa única (ex.: Romano = +2 limite de gold e buffs de defesa).
- **Estrutura de Cartas:** Custo, ATK/DEF (se Unidade), Raridade (Recruta, Veterano, Campeão, General, Divindade), Habilidade, Facção e **Época** (usada para rotação de formato e evitar powercreep; todas atualmente na Época 1).
- **Gold** = recurso por turno para jogar cartas.
- **3 tipos de carta:**
  - **Unidade** — ATK + DEF. Combate: **ATK atacante ≥ DEF alvo → destrói**; senão nada acontece.
  - **Equipamento** — equipa numa unidade (+ATK / +DEF / habilidade). É destruído com a unidade.
  - **Evento** — uso único (dano, "pesar"/tap, ressuscitar…).
- **Vitória:** atacar o general. Qualquer unidade ataca uma unidade inimiga OU o general directamente. General tem **5 muralhas** (variável); 1 ataque = 1 muralha; **6º ataque mata**.
- **Habilidades:** ressuscitar (cemitério→campo), combo, buff condicional (se carta X em campo → +ATK/+DEF), block (bloquear ataque), quick attack (atacar no turno em que é jogada), reconstruir muralha.
- **Activações:** **on play** (1x), **on cost** (paga gold/sacrifício/destruir muralha → repetível), **on death**.

## Estado actual
**Motor COMPLETO e testado — 63/63 testes verdes** (`dotnet test`). Construído como **biblioteca .NET standalone headless** (`src/Tcg.Core`, netstandard2.1 → consumível por Unity 6) + testes NUnit (`tests/Tcg.Core.Tests`, net8.0). .NET SDK 8 instalado (winget). Inclui partida completa determinística até `GeneralKilled`.
- **Domain:** GameState, Player (zonas+gold+TurnsTaken), General (muralhas), Card→Unit/Equipment/Event defs, Unit runtime (ATK/DEF efectivos, tap, sickness, keywords), shim `IsExternalInit` (records C# 9 em netstandard2.1).
- **Rules:** GoldSystem (min(turno,10+cap)+perTurn, sem carryover), TurnStateMachine (Draw→Main→Attack→End, untap/draw/refill), CombatResolver (ATK>DEF; muralhas; bloqueio só Block+em pé), CardPlay (campo 3/lado, equip), GameEngine (liga play+triggers+combate), GameSetup, DeckValidator.
- **Abilities:** EffectRegistry (id→IEffect, throw em id desconhecido) + 12 efeitos (damage/destroy/weaken/tap/buff_self/buff_target/conditional_buff/resurrect/rebuild_wall/gain_gold/gold_cap/gold_per_turn). Triggers OnPlay/Activated/OnDeath.
- **Data:** catálogo Romanos+Vikings (17 normais cada + legendários Júpiter/Marte/Thor/Odin + neutral Padeira de Aljubarrota), decks demo de 50.
- **Fase 4 FEITA:** event bus no Core (GameEvent + GameState.Log/Emit/Emitted, emitido pelo GameEngine/TurnStateMachine; 60 testes) + **projecto Unity 6** (`unity/`, editor 6000.5.1f1) com `Tcg.Core.dll` (netstandard2.1) em `Assets/Plugins`. **Demo jogável `GameDemo`** (MonoBehaviour OnGUI + bootstrap `RuntimeInitializeOnLoadMethod` → zero setup de cena): hot-seat 1v1, mão/campo/ataques/log. `BuildScript` (Editor) faz builds Windows standalone + Android AAB (IL2CPP/ARM64).
- **VERIFICADO:** build standalone Windows via batchmode → **`unity/Build/Windows/TCG.exe` (93 MB) gerado** (scripts compilam contra o motor). Demo testável por double-click OU abrir `unity/` no Unity Hub → Play.
- **Demo UI em tabuleiro** (sem sobreposições): cartas desenhadas (custo/nome/ATK-DEF/cor por tipo, borda dourada lendários), generais com muralhas em pips, log lateral, realce de selecção/alvo. Layout 100% calculado. Janela 1280×720 windowed. Substitui a lista de botões inicial.
- **Habilidades Activated (on-cost) JOGÁVEIS:** 4 cartas activáveis (Rom Engenheiro=dano-pago, Tribuno=reforçar-aliado; Vik Völva=tapar-pago, Forjador=reforçar-se), nos decks; barra `Activar: <efeito> (Ng)` no demo com modo de alvo pendente; `GameEngine.ActivateAbility` emite `AbilityActivated`. Só custo em **gold** (sacrifício/muralha por fazer). Flag `--showcase` (QA).
- **No GitHub:** `MirrasPT/tcg` (privado), 6 commits em `master` + README. `Build/`/`Library/` gitignored.
- **Arte das cartas FEITA (101 — catálogo 100% com arte, 2026-06-28):** `assets/cards/<id>.png` (nome = `Id` do catálogo, 1:1). Estilo **manga/anime** (cel-shaded), 3:4. **38 em Krea 2 Turbo** (Rom+Vik+4 deuses iniciais) + **63 em ANIMA** (pipeline novo, ~5s/img vs 65s; Astecas+Gregos+Egípcios+restantes Vik/Rom). Estilo Anima afinado p/ casar com o manga punchy do Krea2 (preâmbulo bold lineart/saturado). Gerador reutilizável: scratchpad `anima_gen.ps1` + `batch_prompts*.json` (POST /prompt directo, não o MCP comfy). **Catálogo `cards.html` (100 cartas, 5 facções) LIVE em `cartastcg.rfdev.pt`.** Unidades/deuses=personagem · Equipamentos=objecto em spotlight (sem pessoas) · Eventos=cena de acção. `assets/` agora **commitado + no GitHub**. **Falta:** `leg_padeira` (neutra, não pedida); **integrar a arte na carta da UI** (Unity compõe moldura/nome/stats por cima da ilustração — ainda não feito; o demo desenha cartas planas).
- **Falta:** Fase 5 real (correr o build Android AAB — BuildScript pronto; precisa módulo Android + keystore). Balanceamento. UI gráfica a sério (UGUI/animada) sobre o event bus.
- ⚠ Unity batchmode createProject/build sai com exit-code enganador (≠0) mesmo quando SUCEDE — confirmar pelo log (`Build Finished, Result: Success`) e pelo artefacto no disco, não pelo exit code.

**Desvios ao plano (reversíveis):** dados das cartas em **catálogo C#** (não JSON) — evita dependência System.Text.Json no Core+Unity (YAGNI). General Viking = **+1 gold/turno** + 6 muralhas (Romano = +2 cap). Bloqueio de ataque ao general redirige combate p/ o blocker. Limitações MVP conhecidas: conditional_buff é snapshot OnPlay (não aura contínua); efeito-kills não disparam OnDeath (só combate dispara).

## Decisões tomadas
- 2026-06-28: **5 facções × 20 cartas (100)** no `cards.html` — Romanos/Vikings/Astecas/Gregos/**Egípcios** (5ª e última por agora). Catálogo LIVE em `cartastcg.rfdev.pt`.
- 2026-06-28: **Egípcios = imortalidade+ressurreição** (eixo inevitabilidade, ≠ sacrifício Asteca). Keyword `Imortal (descarta 1 carta)` + trigger `Julgamento`. Deuses Osíris/Rá/Anúbis.
- 2026-06-28: **11 cartas mantêm efeito "difícil" original** (decisão do user, motor cresce); Saqueador/Hírdman adaptados p/ snapshot OnPlay (sem 3º listener on-attack).
- 2026-06-28: **Balanço v1** — ramp Romano capa 2 fontes, recursão Viking 4→2, fodder Asteca + densidade Eventos Grega = levers de deckbuilding (não pool).
- 2026-06-28: **Pipeline de arte = ANIMA** (não Krea2) p/ novas cartas — workflow `Anima_Turbo_t2i`, conduzido por script PowerShell via `POST /prompt` (o `enqueue` do MCP comfy falhava "not running" c/ servidor vivo).
- 2026-06-27: Engine **Unity (C#)**, alvo **Android** (escolha do Renato; vs Godot/Flutter/Nativo).
- 2026-06-27: Cobertura Unity via **skill focada `unity-gamedev`** (não plugin marketplace — evita custo always-on user-scope).
- 2026-06-27: Combate **determinístico ATK>DEF** (sem HP/dano parcial).
- 2026-06-27: General com **5 muralhas** + golpe final (6º ataque) como condição de vitória.
- 2026-06-27: Arquitectura com **separação dura motor↔apresentação** (lição do mediaval-chess).
- 2026-06-27: Arte das cartas em **estilo manga** (escolha do Renato, sobre alternativa pintura semi-realista), gerada com **Krea 2** no ComfyUI, 3:4. Filename = `Id` do catálogo p/ mapeamento directo no Unity.
- 2026-06-27: **Manter gold/turno (sem cartas-recurso/lands)** — benchmark `/last30days` (PRD §13): "solves mana issues" é o argumento de conversão nº1 da comunidade; elimina screw/flood por design.
- 2026-06-27: **Demo = IMGUI em tabuleiro com layout calculado** (não UGUI) — evita risco de input-backend/EventSystem/TMP em build headless; cartas pintadas sem sobreposições. Arte integra-se depois.
- 2026-06-27: **Activated só com custo gold no MVP** (sacrifício/destruir-muralha adiados); repetível enquanto pagas.
- 2026-06-27: Repo **GitHub `MirrasPT/tcg` (privado)** criado e push (código + arte + cards.html + README).

## Benchmark de design (PRD §13, v0.2 — 2026-06-27)
Comparação One Piece/YGO/Magic/Pokémon × nosso motor + sinal `/last30days` (Jun 2026). **Tese:** o nosso desenho alinha com os jogos que a comunidade ADOPTA (One Piece, Star Wars Unlimited) e afasta-se dos abandonados (Magic = mana screw; YGO = combo-solitaire/power creep). **One Piece é o mais próximo** (Leader=General, life cards=muralhas). Queixa nº1 universal = **power creep + scalpers** (controlamos o catálogo → staples substituíveis, não win-conditions deck-defining). 5 lições no PRD; risco a vigiar = **loops infinitos em on-cost repetíveis** (lição YGO — fuzzar no motor headless determinístico).

## Design de cartas — Facções

### Identidade das facções (5 facções × 20 cartas = 100, TODAS com arte)
- **Romanos:** lentos, boa defesa, ramp de economia (gold/turno), late game, formation buff (ATK/DEF por contagem de unidades).
- **Vikings:** aggro rápido + frágil (ATK alto/DEF baixo, Ataque Rápido), recursão de **tempo** (ressuscita p/ manter pressão) + escala por cemitério.
- **Astecas:** **sacrifício-ofensivo** — destruir aliadas/descartar mão → converter em buff/dano/quebrar-muralha. Combustível = corpos baratos (Vítima/Iniciado).
- **Gregos:** **motor de eventos** — quanto mais Eventos jogas/no cemitério, mais o board pumpa (comprar, DEF, muralha). Corpos fracos sem eventos.
- **Egípcios:** **imortalidade + ressurreição + cemitério-importa** (≠ sacrifício Asteca). Pilares: keyword **Imortal (descarta 1 carta)** = cheat-death; trigger **Julgamento** (quando carta entra no cemitério); ressuscitar como plano A; auto-mill + cartas gated pela contagem do cemitério. Deuses: **Osíris** (aura Imortal ao exército) · **Rá** (ressuscita tudo ≤3 do cemitério) · **Anúbis** (1×/turno traz de volta unidade que foi ao cemitério, descartando 1 carta).

### Eixo de diferenciação (3 facções "de morte" NÃO se confundem)
Vikings = cemitério→**tempo** · Astecas = sacrifício→**buff/ofensiva** · Egípcios = cemitério→**inevitabilidade/imortalidade** (não os matas, voltam sempre).

### 4 triggers de habilidade (estabelecidos 2026-06-28)
| Trigger | Quando activa |
|---|---|
| **Ao Jogar** | 1x quando a carta é colocada em campo |
| **Em Campo** | Passivo, enquanto em campo + condição cumprida |
| **Activar (N)** | Paga N gold (ou outro custo) → activa, repetível |
| **Ao Morrer** | 1x quando a unidade morre |

### Habilidades dos Romanos (cards.html v2, 2026-06-28)
| Carta | Trigger | Efeito |
|---|---|---|
| Legionário | Ao Morrer | +1 gold |
| Pretoriano | Activar (2) | concede Bloquear a aliado |
| Centurião | Activar (3) | +1/+1 a romanos em campo |
| Balista | Ao Jogar | causa 2 de dano |
| Hastati | Em Campo | se 3+ aliadas em campo, +1/+1 |
| Príncipes | Em Campo | +1 gold/turno |
| Triarii | Ao Morrer | reconstrói 1 muralha |
| Équites | Ao Jogar | +1 gold |
| Sagittarius | Ao Jogar | causa 1 de dano |
| Onagro | Ao Jogar + Activar (3) | causa 3 de dano (duas vezes) |
| Aquilifer | Ao Jogar + Em Campo | +1/+1 por romana em campo; +1 gold/turno |
| Júpiter | Ao Jogar + Em Campo | reconstrói 2 muralhas; +1 gold/turno |
| Marte | Ao Jogar | +2 ATK a romanos |

## Pendente
- **20ª carta por facção:** Concluído (todas as 5 facções com 20 cartas, total de 100 no catálogo).
- **Habilidades Vikings:** identidade Viking ainda por definir (sessão de design).
- **Raridades a rever:** distribuição de raridade actual (recruta/veterano/campeão/general/divindade) foi atribuída por inferência de custo — confirmar com Renato.
- **Em Campo como trigger novo:** actualizar CLAUDE.md do projecto + motor C# (EffectRegistry precisa de `OnField` trigger além de OnPlay/Activated/OnDeath).
- **formation_buff:** efeito novo no motor (`Em Campo: +ATK/+DEF por contagem de unidades`) — a implementar quando design validado.
- **Motor — primitivos exigidos pelo catálogo de 100 cartas (cards.html está À FRENTE do motor):** OnField/auras + 2 listeners (`sempre-que-Evento`, `sempre-que-carta-entra-no-cemitério`/morte) + `grant_keyword` + `draw` + `count_buff` (campo+cemitério) + `destroy_wall` + `sacrifice`/`discard` (custo) + `resurrect` com filtro de custo + retaliate-to-killer + scry + gold diferido over-cap + modal/multi-alvo + bounce-do-cemitério + **`Imortal`** (intercepta morte→paga descarte→fica) + gate de jogabilidade por contagem do cemitério. 11 cartas mantêm efeito "difícil" original (decisão do user). Saqueador/Hírdman adaptados (sem 3º listener on-attack).
- **Integrar arte no Unity:** levar os 38 PNG de `assets/cards/` para a UI da carta (moldura + nome + stats por cima da ilustração). Gerar `leg_padeira` se quiser a lenda neutra.
- **Habilidades em falta no motor:** **OnDeath** (mortes por efeito a dispará-lo), targeting de eventos mais claro na UI, custos on-cost de sacrifício/destruir-muralha.
- **Fase 5:** build Android (IL2CPP/ARM64, AAB, keystore).
- Balanceamento de cartas/custos (stats actuais são placeholder de design).
- Expandir catálogo (mais facções: Aztecas, Portugueses; mais eventos de intervenção divina).
- **Q8 (PRD §13.3 lição 2):** decidir agência do defensor — Evento "Counter" estilo One Piece **vs** combate determinístico simples.

## Última sessão
2026-06-28 (e) — **Definição de OmniClash (OC), Ordenação, Numeração, Regras e Design clean.** Batizado o TCG de OmniClash (OC) para suportar a visão "multiverso/crossover sandbox". Catálogo index.html atualizado com abas de navegação "Cartas" e "Regras do Jogo" (com as regras do PRD.md). Removida a barra horizontal nos nomes das cartas e centralizada a informação de Tipo · Raridade + Número de carta (EP1001 a EP1105) no rodapé. Altura do plate uniformizada para 165px com auto-escalonamento de texto. Linhas decorativas brilham com a cor de cada raridade.

2026-06-28 (d) — **Adição do campo Época.** Introduzido o campo Época (Season) no catálogo cards.html e tcg.md para controlo de rotação de formatos e prevenção de powercreep. Cartas atuais configuradas por defeito para "Época 1" (EP1) visível no canto superior direito do plate de cada carta.

2026-06-28 (c) — **Remoção de Monarca e Adição de General.** Substituída a raridade Monarca por General. Adicionado 1 General para cada uma das 5 facções com habilidades específicas de faction identity e mecânica de muralhas (rom_augusto, vik_ragnar, azt_montezuma, gre_pericles, egy_cleopatra). Total de 105 cartas no catálogo.

2026-06-28 (b) — **Catálogo COMPLETO + 5ª facção Egípcios + arte toda + deploy.** Deploy do `cards.html` para `https://cartastcg.rfdev.pt` (VPS Datalix, vhost Caddy estático). Balanço v1 (Völva→tapa, Aquilifer→só formação, Macuahuitl-W→buff-aliada; ramp Romano capa 2, recursão Viking 4→2). Saqueador/Hírdman adaptados p/ snapshot OnPlay (sem 3º listener). **11 cartas mantêm efeito difícil original** (Oráculo/Hércules/Arqueiro/Quetzal/Guarda/Filósofo/Vítima/Raio/Poseidon/Chimalli/Oferendas) → motor cresce. **Arte: pipeline novo Anima** (workflow `Anima_Turbo_t2i` + LoRA turbo, ~5s/img vs 65s Krea2; conduzido por script PowerShell via `POST /prompt` — o `enqueue` do MCP comfy falhava). Estilo afinado p/ casar com o manga Krea2 (lineart grossa, saturado). Geradas **63 imagens** (43 faltavam + 20 Egípcios). **Catálogo: 100 cartas, 5 facções (Romanos/Vikings/Astecas/Gregos/Egípcios), TODAS com arte, 0 placeholders, LIVE.** Gerador reutilizável em scratchpad (`anima_gen.ps1` + `batch_prompts*.json`).

2026-06-28 — **Design de cartas romanas** (sessão de design puro, sem código). Adicionadas habilidades aos 13 romanos que não tinham (4 triggers: Ao Jogar / Em Campo / Activar / Ao Morrer). `cards.html` actualizado com novo campo `ab`/`abs`, prefixo `.trg` nas tags de habilidade. Identidade romana formalizada: ramp economy (Príncipes+Aquilifer+Júpiter) + formation buff (Hastati+Centurião+Aquilifer). Triarii = Ao Morrer: muralha (flavor "último reduto").

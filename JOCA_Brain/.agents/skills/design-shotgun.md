---
name: design-shotgun
description: "Explorar várias variantes de design em paralelo antes de codificar — gera N mockups distintos, compara lado-a-lado, recolhe feedback estruturado e itera. Adaptado do design-shotgun do gstack. MUST be invoked when the user says: explorar variantes, opções de design, design shotgun, mostra-me hipóteses, brainstorm visual, não gosto deste look, várias versões. SHOULD also invoke when: o user descreve UI nova mas ainda não viu como pode ficar."
triggers: explorar variantes, variantes de design, opções de design, design shotgun, mostra hipóteses, mostra opções, brainstorm visual, várias versões, não gosto do look, design alternativo, mockups alternativos, explore designs, design options, design variants
chain: design-review, design-html, frontend
---
# /design-shotgun — Explorar variantes de design

Em vez de uma proposta única, gerar **N variantes distintas em paralelo**, compará-las, e iterar a partir da escolhida. Multiplica a velocidade de design e evita fixar na 1ª ideia. Adaptado do `design-shotgun` do gstack.

Diferença para `img-gen` (1 imagem) e `frontend` (implementa): isto é **divergência controlada antes de convergir**.

## Quando usar
- "mostra-me opções", "explorar variantes", "não gosto deste look", UI nova sem direcção visual fechada.
- Proactivo: o user descreve uma feature de UI mas ainda não viu como pode ficar.

## Workflow

### 1. Fundação (sequencial, antes do fan-out)
- Ler o sistema de design se existir: `DESIGN.md`, tokens, `brand-guidelines`. Variantes respeitam o sistema (não inventam paletas do nada, salvo se o brief for "explorar identidade").
- Definir o **brief comum**: o que é a página/componente, o objectivo, a audiência, 1 constraint dura (ex.: "tem de caber above-the-fold").
- **Pedir 2-3 referências concretas ANTES do fan-out** (URLs ou imagens que o utilizador goste) e declarar em 1 linha o que se retém de cada uma. Sem referências, os eixos abstractos não transmitem o que o utilizador tem na cabeça: duas rondas completas (6+6 agentes) foram deitadas fora porque a frase que resolveu tudo — "elegantes, requinte mas moderno, um mais minimalista, um mais bold" + 3 URLs — só chegou depois de ele ver o resultado errado.
- **Benchmark visual sem imagens não é benchmark, é descrição.** Se a referência é um produto que só se conhece por pesquisa textual, pedir capturas — ou dizer explicitamente que o resultado é uma interpretação, não uma adaptação. Pesquisa textual descreve funcionalidades, não anatomia visual.
- **Ler o banco de eixos**: `Read(".claude/reference/design-dataset.md")` — paletas OKLCH verificadas, pares de fontes e estilos nomeados. Cada variante = 1 estilo + 1 paleta + 1 par de fontes, combinações DISTINTAS; registar a combinação no output (`[V2: brutalist-editorial + Ember + Fraunces/Inter]`). Anti-convergence: excluir os eixos usados nos 2-3 projectos anteriores do mesmo tipo (`memory/projects/`).
- Definir **3-6 eixos de divergência** (cada variante explora um). Os eixos têm de ser **estruturais**, não só estéticos: ordem e número de secções, tipo de navegação, densidade, grelha (simétrica vs quebrada), o que ocupa o primeiro viewport, foto-driven vs tipográfico. Trocar só o `<style>` sobre o mesmo markup produz peles da mesma variante, não variantes.
- **Registo/intenção** é o 4º eixo, obrigatório: silencioso · acolhedor · imponente · documental · cinematográfico. Três agentes já convergiram no mesmo registo (arquivo frio, acento azul, numerais tabulares) com três estilos nomeados diferentes — os eixos de estilo/paleta/fonte separam gramática visual, não intenção. Variantes concorrentes têm de diferir aqui.

### 2. Fan-out das variantes (paralelo)
- Despachar **3-5 agentes** em paralelo (`img-gen-openai`/`img-gen-google` para imagem; ou geração de HTML/JSX estático para mockup navegável). Cap 3-5 (custo de contexto).
- **Brief de cada agente** carrega: o brief comum + o SEU eixo + o sistema de design + anti-fabricação (sem inventar copy/dados — usar placeholders marcados) + Step 0 (Read `brand-guidelines`/`design-tokens` se relevante).
- Cada agente escreve o output para disco (`scratchpad/shotgun/<n>/`) e devolve só um resumo + path (padrão "agentes escrevem para disco" — `rules/orchestration-patterns.md`).

### 3. Board de comparação
- **Paridade de pipeline antes de comparar.** Todas as variantes passam pelos mesmos passos (upscale, export, resolução). Uma variante saiu sem o passo ESRGAN (568 KB vs 4,7 MB, ~88 dpi em A3) e a comparação ficou enviesada — a nitidez mascarou o desenho, que era o que estava em avaliação. Comparar tamanhos de ficheiro é o teste barato que apanha isto.
- **Check mecânico de divergência, antes de mostrar seja o que for.** Extrair de cada variante o par tipográfico e as cores e falhar a ronda se duas coincidirem — regenera-se a duplicada, não se apresenta:
  ```bash
  grep -rhoE 'family=[A-Za-z+0-9]+|font-family:[^;]+' scratchpad/shotgun/*/ | sort | uniq -c | sort -rn
  grep -rhoE '#[0-9a-fA-F]{6}|oklch\([^)]*\)' scratchpad/shotgun/*/ | sort -u | head -40
  ```
  É um `grep`, não um agente. Três agentes em paralelo já devolveram o **mesmo par tipográfico** (Unbounded + Manrope + JetBrains Mono) porque leram todos o mesmo `design-dataset.md` e nenhum via os outros — convergência que só se detecta comparando as N variantes depois de prontas.
- Apresentar as variantes lado-a-lado (grelha de thumbnails/links).
- Para cada uma: 1 frase do conceito + a tensão que explora.

### 4. Feedback estruturado + iterar
- Recolher feedback por variante (o que funciona / o que não). `AskUserQuestion` se ajudar a decidir.
- Escolher 1 (ou fundir o melhor de 2). Registar a decisão: `node .claude/scripts/joca-brain.mjs decide --text "design escolhido: <…>" --source user`.
- Iterar a escolhida 1-2x se preciso.

### 5. Autópsia obrigatória à 3ª rejeição
**Três rondas rejeitadas seguidas → parar de produzir.** Não se gera a 4ª ronda: despacha-se **1 agente de autópsia** sobre as rejeitadas, com uma pergunta só — *o que é que estas propostas têm em COMUM?* O que varia entre elas já foi variado; a causa está no que não variou.

O relatório da autópsia entra como constraint dura no brief comum da ronda seguinte, e a ronda só arranca depois de o utilizador confirmar as causas.

Custo real de não o fazer: **oito propostas rejeitadas** antes de alguém perguntar isto. A autópsia (1 agente) achou as três causas em minutos — fotografia com marca de terceiros, a mesma página repintada em todas, zero comércio na página de uma loja — por muito menos do que custou a nona ronda às cegas.

## UX Principles — como os utilizadores se comportam (aplicar a cada variante)

Princípios observados (Steve Krug, *Don't Make Me Think*), não preferências. Avaliar cada variante contra eles.

**3 leis:**
1. **Don't make me think** — cada ecrã auto-evidente. Se o user pára a pensar "o que clico?", o design falhou.
2. **Cliques não importam, pensar importa** — 3 cliques óbvios > 1 clique que exige pensar.
3. **Omite, depois omite outra vez** — corta metade das palavras, depois metade do que resta. Happy-talk e instruções morrem.

**Como se comportam:** os users *fazem scan* (não lêem) → hierarquia visual = importância; *satisficem* (escolhem a 1ª opção razoável) → torna a escolha certa a mais visível; *winguam* (não percebem como funciona, atrapalham-se até dar) → o caminho certo tem de ser o mais óbvio; *não lêem instruções*.

**Billboard design:** usar convenções (logo top-left, nav top, lupa=search — não inovar em navegação por esperteza); hierarquia visual é tudo (tudo grita = nada se ouve; ruído é culpado até prova em contrário); clicável tem de parecer clicável (sem depender de hover — mobile não tem); clareza > consistência.

**Navegação = wayfinding:** responder sempre "que site é? que página? que secções? onde estou?". Nav persistente; secção actual indicada; "trunk test" (tapa tudo menos a nav → ainda sabes onde estás?).

**Reservatório de goodwill:** cada fricção esvazia-o. Esvazia mais rápido: esconder o que o user quer (preço/contacto), punir por não fazer à tua maneira, pedir info desnecessária, pôr "sizzle" no caminho (splash/tours forçados). Repõe: torna óbvio o que o user quer fazer, di-lo à cabeça, poupa passos, fácil recuperar de erros.

**Mobile:** mesmas regras, mais ainda. Touch targets ≥ 44px; afford­ances visíveis (sem cursor = sem hover-to-discover); prioriza sem dó.

## Próximo passo (chain)
- Variante escolhida → `design-review` (validar gosto/slop) → `design-html` (mockup → HTML produção) OU `frontend` (implementar em React). Reversível → encadear; ver `rules/chaining.md`.

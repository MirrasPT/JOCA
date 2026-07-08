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
- **Ler o banco de eixos**: `Read(".claude/reference/design-dataset.md")` — paletas OKLCH verificadas, pares de fontes e estilos nomeados. Cada variante = 1 estilo + 1 paleta + 1 par de fontes, combinações DISTINTAS; registar a combinação no output (`[V2: brutalist-editorial + Ember + Fraunces/Inter]`). Anti-convergence: excluir os eixos usados nos 2-3 projectos anteriores do mesmo tipo (`memory/projects/`).
- Definir **3-6 eixos de divergência** (cada variante explora um): ex.: editorial vs minimal vs bold; grid vs assimétrico; foto-driven vs tipográfico.

### 2. Fan-out das variantes (paralelo)
- Despachar **3-5 agentes** em paralelo (`img-gen-openai`/`img-gen-google` para imagem; ou geração de HTML/JSX estático para mockup navegável). Cap 3-5 (custo de contexto).
- **Brief de cada agente** carrega: o brief comum + o SEU eixo + o sistema de design + anti-fabricação (sem inventar copy/dados — usar placeholders marcados) + Step 0 (Read `brand-guidelines`/`design-tokens` se relevante).
- Cada agente escreve o output para disco (`scratchpad/shotgun/<n>/`) e devolve só um resumo + path (padrão "agentes escrevem para disco" — `rules/orchestration-patterns.md`).

### 3. Board de comparação
- Apresentar as variantes lado-a-lado (grelha de thumbnails/links).
- Para cada uma: 1 frase do conceito + a tensão que explora.

### 4. Feedback estruturado + iterar
- Recolher feedback por variante (o que funciona / o que não). `AskUserQuestion` se ajudar a decidir.
- Escolher 1 (ou fundir o melhor de 2). Registar a decisão: `node .claude/scripts/joca-brain.mjs decide --text "design escolhido: <…>" --source user`.
- Iterar a escolhida 1-2x se preciso.

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

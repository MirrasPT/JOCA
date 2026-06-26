---
name: stop-slop
description: "Remove padrões de escrita-AI (AI slop) de PROSA — tells previsíveis: aberturas throat-clearing, advérbios, voz passiva, contrastes binários, falsa agência, fragmentação dramática, jargão. Pass de polish a aplicar ao ESCREVER/EDITAR/REVER texto. MUST be invoked when the user says: stop slop, soa a AI, parece escrito por AI, tirar tells de AI, limpar a escrita, isto soa a robô, AI slop no texto, polir copy. SHOULD also invoke como passo final de qualquer copy (landing, email, anúncio, post, artigo). Adaptado da skill stop-slop de Hardik Pandya (MIT)."
triggers: stop slop, AI slop, soa a AI, parece AI, escrito por AI, tells de AI, limpar escrita, soa a robo, soa a robô, polir copy, polir texto, remover padroes AI, remover padrões AI, prose slop, sounds AI, de-slop, deslop, anti-slop
chain: pt-pt-translator
---
# stop-slop — Remover AI slop de prosa

Eliminar os padrões previsíveis de escrita-AI. Distinto do `design-review` (slop **visual**) — isto é slop de **texto**. Aplicar ao escrever, editar ou rever qualquer prosa (copy, email, anúncio, post, artigo, README). Adaptado da skill `stop-slop` de Hardik Pandya (MIT, hvpandya.com).

> **pt-PT:** as regras são universais; os exemplos abaixo estão em EN (canónicos). Em português aplicam-se os equivalentes — ex.: throat-clearing "A verdade é que…/No fundo…/Importa referir que…"; advérbios "-mente"; falsa agência "a decisão emerge/o mercado premeia"; jargão "navegar desafios/dar o salto/no panorama actual". Encadeia para `pt-pt-translator` se o alvo for pt-PT.

## 8 regras-núcleo
1. **Corta filler.** Aberturas de throat-clearing, muletas de ênfase, e **todos os advérbios**.
2. **Quebra estruturas formulaicas.** Contrastes binários, listagem negativa, fragmentação dramática, setups retóricos, falsa agência.
3. **Voz activa.** Cada frase tem um sujeito humano a fazer algo. Sem passivas. Sem objectos inanimados a fazer verbos humanos ("a queixa torna-se um fix").
4. **Sê específico.** Sem declarativas vagas ("As razões são estruturais"). Nomeia a coisa. Sem extremos preguiçosos ("todos", "sempre", "nunca") a fazer trabalho vago.
5. **Põe o leitor na sala.** Sem voz de narrador-à-distância. "Tu/você" bate "as pessoas". Específico bate abstracto.
6. **Varia o ritmo.** Mistura comprimentos de frase. Dois itens batem três. Termina parágrafos de forma diferente. **Sem travessões (em dash).**
7. **Confia no leitor.** Afirma factos directamente. Sem amaciar, justificar, dar a mão.
8. **Corta os "quotables".** Se soa a pull-quote, reescreve.

## Frases a remover

**Throat-clearing (aberturas-anúncio)** — qualquer "Here's what/this/that", "Here's the thing:", "The uncomfortable truth is", "It turns out", "The real X is", "Let me be clear", "The truth is", "I'm going to be honest", "Can we talk about". → Corta e afirma o ponto.

**Muletas de ênfase** — "Full stop." / "Period.", "Let that sink in.", "This matters because", "Make no mistake", "Here's why that matters". → Apaga.

**Advérbios (mata todos)** — really, just, literally, genuinely, honestly, simply, actually, deeply, truly, fundamentally, inherently, inevitably, interestingly, importantly, crucially. Filler relacionado: "At its core", "In today's X", "It's worth noting", "At the end of the day", "When it comes to", "In a world where", "The reality is".

**Jargão de negócios** → plain: navigate→handle/address · unpack→explain · lean into→accept · landscape→situation · game-changer→significant · double down→commit · deep dive→analysis · take a step back→reconsider · moving forward→next · circle back→revisit · on the same page→aligned.

**Meta-comentário** — "Hint:", "Plot twist:"/"Spoiler:", "You already know this, but", "X is a feature, not a bug", "The rest of this essay…", "Let me walk you through…", "In this section, we'll…", "As we'll see…". → Apaga; deixa o texto mover-se.

**Declarativas vagas** — "The reasons are structural", "The implications are significant", "The stakes are high", "The consequences are real". → Nomeia a coisa específica ou corta.

## Estruturas a evitar

**Contrastes binários (falso drama)** — "Not because X. Because Y.", "X isn't the problem. Y is.", "The answer isn't X. It's Y.", "It's not this. It's that.", "not just X but also Y", "stops being X and starts being Y". → Afirma Y directamente. Larga a negação.

**Listagem negativa** — "Not a X… Not a Y… A Z.", "It wasn't X. It wasn't Y. It was Z." → Afirma Z. O leitor não precisa da pista de descolagem.

**Fragmentação dramática** — "[Noun]. That's it. That's the [thing].", "X. And Y. And Z.", "This unlocks something. [Word]." → Frases completas. Confia no conteúdo, não na apresentação.

**Setups retóricos** — "What if [reframe]?", "Here's what I mean:", "Think about it:", "And that's okay." → Faz o ponto; deixa o leitor concluir.

**Falsa agência (verbos humanos a inanimados)** — "a complaint becomes a fix" (alguém corrigiu), "the decision emerges" (alguém decidiu), "the culture shifts" (pessoas mudam comportamento), "the data tells us" (alguém leu e concluiu), "the market rewards" (compradores pagam). → Nomeia o humano; se nenhum encaixa, usa "tu/você".

**Narrador-à-distância** — "Nobody designed this.", "This happens because…", "People tend to…". → Põe o leitor na sala: "Não te sentas um dia e decides…" bate "Nobody designed this."

**Voz passiva** — "X was created"→nomeia quem criou; "It is believed that"→quem acredita; "Mistakes were made"→quem os fez. → Encontra o actor, põe-no à frente.

**Sentence starters** — frases a começar por What/When/Where/Which/Who/Why/How → reestrutura (lidera com sujeito/verbo). Parágrafos a começar por "So" → começa com conteúdo. "Look," → remove.

**Ritmo** — listas de três → usa dois ou um. Perguntas respondidas logo → deixa respirar ou corta. Cada parágrafo a terminar com punch → varia. **Em dash → remove** (vírgula/ponto). Stacatto de frases curtas → não empilhar.

**Extremos preguiçosos** — every/always/never/everyone/nobody = falsa autoridade. Usa específicos.

## Quick checks (antes de entregar prosa)
Advérbios? mata. Passiva? acha o actor. Inanimado com verbo humano? nomeia a pessoa. Frase a começar por Wh-? reestrutura. "Here's what/this" throat-clearing? corta. "Not X, it's Y"? afirma Y. 3 frases seguidas do mesmo comprimento? quebra uma. Parágrafo a acabar em one-liner? varia. Em dash? remove. Declarativa vaga? nomeia o específico. Narrador-à-distância? põe o leitor na cena. Meta-joiner ("The rest of this essay…")? apaga.

## Scoring (1-10 por dimensão)
| Dimensão | Pergunta |
|---|---|
| Directness | Afirmações ou anúncios? |
| Rhythm | Variado ou metronómico? |
| Trust | Respeita a inteligência do leitor? |
| Authenticity | Soa humano? |
| Density | Há algo cortável? |

**< 35/50 → reescrever.**

## Exemplos (before → after)
- "Here's the thing: building products is hard. Not because the technology is complex. Because people are complex. Let that sink in." → **"Building products is hard. Technology is manageable. People aren't."**
- "In today's fast-paced landscape, we need to lean into discomfort and navigate uncertainty with clarity. This matters because your competition isn't waiting." → **"Move faster. Your competition is."**
- "What if I told you that the best teams don't optimize for productivity? Here's what I mean: they optimize for learning. Think about it." → **"The best teams optimize for learning, not productivity."**

## Próximo passo (chain)
Passo de polish **terminal** — `copywriting`, `landing-page`, `email-sequence`, `social-content`, `content-strategy`, `seo`/`seo-local` e `paid-ads` encadeiam PARA aqui como passada final antes de entregar. Alvo pt-PT → `pt-pt-translator`. O `design-review` referencia esta skill quando o slop é de copy (não visual).

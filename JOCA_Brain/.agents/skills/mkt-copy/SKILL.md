---
name: mkt-copy
description: "Copys de campanha na voz da marca (F2 do /marketeer): anúncios Google, Meta e LinkedIn, landing, emails, posts, GBP e material offline, com limites de caracteres só com fonte verificada, variantes para teste, CTA e filtro anti-IA. Tem modo chamado por agente (recebe brief, devolve copy sem perguntas). MUST be invoked when the user says: copys da campanha, textos dos anúncios, copy na voz da marca, escrever anúncios para a marca, F2 copys. SHOULD also invoke when: variantes para teste A/B, títulos RSA, texto do flyer, assunto do email da campanha, rever copy que soa a IA."
triggers: mkt-copy, copys da campanha, copy da campanha, textos dos anúncios, anúncios Meta, anúncios LinkedIn, títulos RSA, copy Google Ads, texto do flyer, texto do cartaz, assunto de email, copy da landing, voz da marca, variantes de copy, teste A/B de copy, campaign copy, ad copy, brand voice copy, copy variants
chain: mkt-psicologia, mkt-revisor-agent, mkt-relatorio
---
# mkt-copy

Passo da **F2 Proposta**, em paralelo com a `mkt-medicao`, depois da `mkt-estrategia`. Escreve as copys de
cada peça de «Materiais a produzir» da proposta **na voz da marca**, só com factos aprovados, dentro dos limites de cada formato,
com variantes para testar. Também serve a F3/F4 em **modo chamado por agente**.

## Recebe
- `<RAIZ>/clientes/<slug>/marca.md` — `## Voz` (3-5 amostras reais com URL), `## Ofertas`, `## Público`, `## Restrições`. **Lê-se primeiro.**
- `ciclos/<ciclo>/02-proposta.md` «Estratégia e canais» (oferta e factos aprovados, canais, funil) e «Materiais a produzir».
- «Medição» da proposta (folha de UTMs) quando já existir — os links vêm dali; enquanto não existir, marcar `<URL da folha de UTMs>`.
- Referência: `"<MKT>/referencias/psicologia.md"` (2-4 princípios por peça).
- Google Search: `"<MKT>/modelos/campanha-search.md"` (formato da especificação, 15 títulos e 4 descrições).

## Entrega
- `02-proposta.md` «Mensagens e copy» — só entre `<!-- mkt-copy:inicio -->` e `<!-- mkt-copy:fim -->`.
- Em modo chamado por agente: só a copy (e a lista do que faltou) na resposta ao chamador.

## Regras
- **Nunca inventar factos.** Número, prazo, preço, nome de cliente, prémio, ano ou garantia só se estiver em
  `marca.md`, no site (URL citado) ou nos factos aprovados da oferta («Estratégia e canais»). Falta o facto que tornava a frase forte →
  escreve-se a versão sem ele e regista-se o que faltou.
- **Telefone nunca no texto dos anúncios** Google (o validador recusa-o; vai no recurso de chamada).
- PT-PT, AO90. Registo (`você`/`tu`/impessoal) = o das amostras de `marca.md`; sem amostra → `você` em
  anúncios e landing (padrão do marketeer) e regista-se `[inferência]`.
- **Limites de caracteres só com fonte.** Formato sem limite verificado → `[por confirmar]` e escreve-se curto.
- Um CTA por peça. CTA diz o resultado da ação («Pedir orçamento», «Marcar visita»), nunca «Saber mais» por defeito.
- Psicologia ética: nada de escassez falsa, prova social inventada, medo fabricado (`referencias/psicologia.md`).

## Limites por formato

Resumo para copy. A tabela completa e mantida das specs (Instagram, Reels, carrossel, PMax, vídeo, GBP) é
`"<MKT>/referencias/plataformas.md"` — formato que não está aqui procura-se lá; se as duas divergirem, ganha a
linha com a verificação mais recente, e a divergência reporta-se.

| Formato | Campo | Limite | Fonte |
|---|---|---|---|
| Google Ads RSA | título | 30 (até 15) | `campanha/especificacao.mjs` `LIMITES` + `validar.mjs` (provado nas campanhas reais) |
| | descrição | 90 (até 4) | idem |
| | caminho visível | 15 cada | idem |
| | sitelink / descrição de sitelink | 25 / 35 | idem |
| | frase de destaque · snippet estruturado | 25 · 25 | idem |
| Meta (Facebook, imagem no feed) | texto principal | **recomendado** 50-150 | facebook.com/business/ads-guide/update/image, «Recomendações de texto» (verificado 2026-10-01) |
| | título | **recomendado** 27 | idem |
| | outros posicionamentos (Instagram, Reels, carrossel, vídeo) | ver `referencias/plataformas.md` | — |
| LinkedIn (imagem única) | texto introdutório | 150 sem cortar · máx. 3000 | linkedin.com/help/linkedin/answer/a426534 (verificado 2026-10-01) |
| | título | 70 sem cortar · máx. 200 | idem |
| | descrição | 100 sem cortar · máx. 300 | idem |
| Email | assunto · pré-visualização | sem limite de plataforma; o telemóvel mostra ~30-40 car. do assunto `[inferência: ai-copywriter §Subject lines]` | — |
| Publicação GBP | texto | `[por confirmar]` (a página de ajuda não indica limite em 2026-10-01) | support.google.com/business/answer/7662907 |
| Performance Max (recursos de texto) | títulos · títulos longos · descrições | ver `referencias/plataformas.md` (linhas G-PMAX) | — |
| Flyer, cartaz, roll-up | — | sem limite técnico; cartaz lê-se em segundos → título + 1 frase + CTA + QR `[inferência]` | — |

Contar sempre com a mesma função do validador (conta caracteres Unicode, não bytes) — 1 linha por texto, sai 1 se algum passa:
```bash
cd "<MKT>" && printf '%s\n' "<texto 1>" "<texto 2>" | node --input-type=module -e '
import { comprimento } from "./scripts/campanha/especificacao.mjs";
const lim=Number(process.argv[1]); let mau=0;
for (const l of (await new Promise(r=>{let s="";process.stdin.on("data",d=>s+=d).on("end",()=>r(s))})).split(/\r?\n/).filter(Boolean)) { const n=comprimento(l); if(n>lim) mau++; console.log(`${n>lim?"✗":"✓"} ${String(n).padStart(3)}/${lim}  ${l}`); }
process.exit(mau?1:0);' 30
```

## Passos

### 1. Calibrar a voz (uma vez por marca e ciclo)
1. Ler as amostras de `marca.md` §Voz **antes** de escrever. Sem amostras → parar em modo interativo e pedir
   1-3 URLs/textos por `AskUserQuestion`; em modo agente, escrever neutro e registar «voz sem amostra».
2. Medir, não descrever a olho: comprimento médio de frase, `você`/`tu`, primeira pessoa (nós/eu), pontuação
   (travessões, exclamações, emojis), palavras e expressões que se repetem, como abrem e fecham.
   Com 5+ amostras usar a receita de medição do `padroes-slop.md` do JOCA (`.claude/reference/escrita/padroes-slop.md`).
3. Escrever 4-6 linhas «voz da marca» em «Mensagens e copy» (ex.: «frases de 8-12 palavras; trata por você; sem
   exclamações; usa "orçamento sem compromisso"»). **A amostra manda sobre as regras de estilo**, incluindo
   travessões: se a marca os usa, mantém-se a taxa.

### 2. Antes de cada peça — duas perguntas
1. O que sente a pessoa no momento exato em que a linha lhe chega (a meio do scroll, a pesquisar com
   pressa, a limpar a caixa de email, a passar na rua)? Isso decide tom, comprimento e o que vem primeiro.
2. Qual é a forma mais simples de dizer o que a marca faz, com palavras de conversa? Se não sai, falta
   informação: em modo interativo pergunta-se; em modo agente regista-se.
Escolher 2-4 princípios de `referencias/psicologia.md` para a peça e anotar o porquê numa linha.

### 3. Escrever por canal
- **Google Search (RSA)**: 15 títulos e 4 descrições por grupo, no formato da secção 6 do
  `modelos/campanha-search.md` (colunas `Car.` e `Fixar`). Mistura de ângulos: serviço + zona, oferta,
  prova (só factos aprovados), CTA, objeção. A palavra-chave principal em 2-3 títulos. São rascunho da
  proposta; na F4 passam para `campanhas/<nome>.md` e têm de passar o `campanha/validar.mjs`.
- **Meta**: 3 textos principais (curto · médio · com prova) × 2 títulos; primeira linha com o mais concreto que
  houver; CTA do botão da plataforma escolhido da lista dela `[por confirmar opções em PT]`.
- **LinkedIn**: 2-3 textos introdutórios ≤ 150; título ≤ 70; tom profissional mas na voz da marca; um dado ou caso real.
- **Landing**: título (promessa da oferta em palavras do cliente) · subtítulo (como/prazo) · 3 benefícios com
  prova · objeções frequentes · CTA repetido · texto do formulário com a caixa de marketing separada e não
  pré-marcada (`referencias/lead-magnet.md` §4). *Message match*: o título repete a promessa do anúncio.
- **Email**: 3 assuntos + pré-visualização por email; corpo curto; um CTA; P.S. com o segundo argumento mais
  forte; cancelamento visível. A sequência completa é da F4 (`mkt-email`).
- **Posts orgânicos e GBP**: gancho na 1.ª linha, um assunto por post, CTA para o canal próprio (landing com UTM).
- **Offline**: título legível a distância, uma frase, oferta, CTA, QR + URL curto impresso (`referencias/utm.md` §4).
Cada link usa o URL da folha de UTMs («Medição»); nunca um URL inventado.

### 4. Variantes para teste
- Testar **uma variável de cada vez** (gancho, oferta ou CTA), não tudo junto.
- 2-3 variantes por peça paga; cada variante leva um `utm_content` próprio (`carrossel-a`, `carrossel-b`).
- Escrever a hipótese numa linha («a prova numérica bate o benefício genérico em CTR») e quando se lê o
  resultado (data de revisão do canal em «Campanhas» da proposta). Sem volume para significância → dizê-lo; é sinal, não prova.
- Marcar a variante recomendada e porquê, pelo sentimento do leitor, não por «soa melhor».

### 5. Filtro anti-IA (obrigatório em cada peça, antes de gravar)
Com o JOCA: `Read(".claude/skills/stop-slop.md")` em **modo embebido** e, para textos com mais de um
parágrafo, `.claude/reference/escrita/padroes-slop.md`. Sem o JOCA, aplicar no mínimo:
- cortar aberturas de enchimento («A verdade é que…», «No panorama atual…», «Importa referir…») e
  intensificadores em «-mente»;
- desfazer contrastes encenados («Não é X, é Y», «Mais do que X…») — afirmar Y;
- tríades automáticas → dois itens ou um; fechos de efeito («Simples assim.», aforismos);
- vocabulário de brochura (inovador, soluções, excelência, de ponta, potenciar, alavancar, jornada);
- Title Case em títulos («Cozinhas Por Medida» é sinal forte em PT); aspas “ ” em vez de « »;
- travessões em copy de anúncio e UI (salvo se a voz da marca os usa);
- verbos humanos em coisas («a solução que transforma o seu negócio») — nomear quem faz;
- gerúndio em cauda («…, garantindo qualidade») — também é marca de PT-BR.
Depois, três perguntas a cada linha: (1) o leitor repete o que isto promete depois de uma leitura?
(2) a linha encontra o sentimento do passo 2 ou passa-lhe ao lado? (3) **a copy afirma algum facto, número,
nome ou data que não está nas fontes?** — se sim, é defeito, mesmo que soe melhor.

### 6. Contar e gravar
1. Contar todos os textos com limite (comando acima, por limite) até saírem 0.
2. Re-ler `02-proposta.md` imediatamente antes de escrever e editar **só** entre os marcadores `mkt-copy`
   (a `mkt-medicao` pode estar a escrever no mesmo ficheiro; se a edição falhar porque o ficheiro mudou,
   re-ler e repetir). Estrutura: voz da marca · por peça de «Materiais a produzir»: canal, formato, princípios escolhidos,
   textos com `Car.`, variantes e hipótese, CTA, URL · factos usados (com fonte) · o que faltou.

## Modo chamado por agente
Ativa-se quando outro agente ou skill (F3 `mkt-criativos`, F4 `mkt-*-ads`, `mkt-email`) pede copy com um brief.
- **Recebe** (brief): marca (`<slug>`), peça, canal e formato, oferta, factos aprovados, público e sentimento,
  URL com UTMs, limites, número de variantes.
- **Não faz perguntas.** Escreve com o que há, corre os passos 1-5 internamente, conta os caracteres.
- **Devolve só**: os textos (com `Car.`), a variante recomendada numa linha, e `Faltou:` com o que limitou a copy
  (ex.: «sem prazo de entrega aprovado»). Sem rascunho, sem auditoria, sem explicações.
- Não escreve no `02-proposta.md` neste modo; quem chama decide onde grava.

## Próximo passo (chain)
- «Mensagens e copy» e «Medição» gravadas → **`mkt-psicologia`** modo rever (copys e landing) → **`mkt-revisor-agent`** →
  **`mkt-relatorio`** → gate de aprovação.
- Faltam factos aprovados que mudam a proposta (ex.: sem garantia aprovada) → regista em «Lacunas e por confirmar» para o gate final; não inventa.

## Créditos
- mikiarlo3/ai-copywriter (MIT, inclui blader/humanizer © 2025 Siqi Chen): `SKILL.md` §Voice Calibration,
  §The two questions, §The intake, §The feeling behind each format, §Invocation Modes (modo embebido), §Process and Output, padrões §1-§33 (resumidos e adaptados a PT).
- Skill JOCA `stop-slop` (adaptada de Hardik Pandya, MIT) e `.claude/reference/escrita/padroes-slop.md`.
- coreyhaines31/marketingskills (MIT): `skills/emails/SKILL.md` (estrutura de email), `skills/copywriting` (CTA por resultado).

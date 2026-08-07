---
name: gauntlet-loop
description: "Reformula QUALQUER pedido num workflow de desenvolvimento medido contra uma referência real e nomeada: preenche o aim prompt de três parágrafos do Matt Shumer, EXECUTA-O, faz fan-out de sub-agentes, põe um crítico separado e severo a comparar às cegas com a referência, e repete até o HUMANO travar. Agnóstico de domínio (jogo, app, API, site, deck, marca, refactor). Prompt puro — sem harness, sem state machine, sem scripts auxiliares. MUST be invoked when the user says: gauntlet, gauntlet loop, aim prompt, ao nível de, tão bom como, benchmark contra, loop até ficar perfeito, /gauntlet-loop. SHOULD also invoke when: o user pede algo comparado a um produto real existente e quer qualidade máxima em vez de rapidez."
triggers: gauntlet, gauntlet loop, gauntlet-loop, aim prompt, prompt do Shumer, ao nível de, ao nível do, tão bom como, melhor que o, benchmark contra, comparado com, loop até ficar perfeito, qualidade AAA, top studio quality, build like, as good as
chain: tester-code, design-review, tester-performance
---
# gauntlet-loop — construir contra uma referência real, em loop

**Meta-skill.** Recebe um pedido em linguagem natural sobre **qualquer** assunto e reformula-o no aim prompt
de três parágrafos — depois **corre-o**. Adaptado de
[duolahypercho/gauntlet-loop](https://github.com/duolahypercho/gauntlet-loop), que empacota o aim prompt de
152 palavras do [Matt Shumer](https://github.com/mshumer/Claude-of-Duty). O upstream é só para jogos; **esta
versão é agnóstica de domínio** — o que muda por domínio é a referência e o método de comparação, não o método.

## A ideologia (as 5 peças que fazem isto funcionar)

1. **Referência real e nomeada.** Não "de alta qualidade" — *ao nível do Linear*, *ao nível do Stripe*.
   Um alvo abstracto não se consegue falhar; um alvo concreto sim.
2. **Fan-out.** Cada área do trabalho tem um sub-agente próprio, a correr em paralelo.
3. **Crítico separado e severo.** Um agente **diferente** de quem escreveu, cuja função é reprovar.
   Quem produz nunca se avalia.
4. **Comparação cega lado-a-lado** contra a referência: *qual destes dois é melhor?* sem saber qual é qual.
5. **Sem condição de paragem.** A fasquia é inalcançável de propósito. Qualidade = função do tempo de
   execução. **O humano é o travão.**

Se tiras qualquer uma das cinco, isto vira um workflow normal. Não tires.

## Ao invocar

1. **Inferir o domínio** do pedido (jogo / web app / API-backend / landing / deck / marca / refactor / conteúdo / …).
2. **Preencher os slots** — `THING`, `REFERENCE`, `LOOK`, `TIER`, `AREA_1`, `AREA_2`, `CHECK`, `STACK` — a
   partir dos args, do cwd, do `CLAUDE.md` do projecto e da conversa. **Uma pergunta no máximo**, e só se
   `THING` ou `REFERENCE` faltarem e não forem inferíveis.
3. **Fixar o método de comparação** do domínio (tabela abaixo). Sem método de comparação verificável, o
   passo 4 é teatro — resolve isto antes de arrancar.
4. **Preencher o esqueleto** e guardá-lo como brief interno. **Não despejar o prompt e esperar.**
5. **Executar**: fan-out de `Agent()` no mesmo turno, crítico separado, comparação cega, corrigir, repetir.
6. **Continuar até o humano travar** (ou até um budget declarado). **Nunca perguntar "continuo?"**

Linha de estado, uma vez, depois trabalho:

```text
Gauntlet: [THING] contra [REFERENCE] em [STACK]. Comparação: [CHECK]. Tu és o travão.
```

Linha honesta, uma vez:

> Não acaba pela definição dele. A comparação cega contra [REFERENCE] vai continuar a falhar. É por isso
> que a qualidade continua a subir. Quem pára és tu.

## O prompt (preencher e correr — é o procedimento inteiro)

```text
I want you to build [THING] at the level of [REFERENCE]. It should
be utterly perfect, [LOOK], with every single thing done at
[TIER] quality, from [AREA_1] to [AREA_2] to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the [THING]
is utterly perfect. You should [LOOP_VERB] on each item and have a separate sub-agent check it
[CHECK] to ensure it is [TIER]. That separate sub-agent should
be a really harsh critic, and if it isn't [TIER], it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with
[REFERENCE]. It should literally compare them side by side blind and say which
one looks better. Do this in [STACK]. [LOOP_VERB] until it's utterly perfect.
Fan out sub-agents[CLOSING_TAIL].
```

`LOOP_VERB` = `/loop` · `CLOSING_TAIL` = ` and ultracode` (Claude Code).
Em Codex: `LOOP_VERB` = `/goal`, `CLOSING_TAIL` vazio — nunca misturar verbos de harnesses diferentes.

Mais nada. Sem outro protocolo.

## Escolher a `REFERENCE`

- **Real, nomeada, verificável.** Um produto/repo/artefacto que existe e a que se consegue chegar.
- **Do mesmo desporto.** Comparar um dashboard com o Linear, não com "o Apple".
- **Se o modelo a bate no dia 1 → sobe.** A referência tem de doer.
- Se o user já nomeou uma, é essa. Se não, propor a melhor da categoria **na linha de estado** — não parar a perguntar.
- Se a referência for fechada e inacessível (backend proprietário), usar o **substituto verificável**:
  um repo open source de topo do mesmo tipo, um benchmark público, ou a spec/documentação pública.
  **Nunca inventar como a referência funciona por dentro** — usa o que se consegue observar.

## Perfis por domínio — o que preencher e **como o crítico compara**

O `CHECK` é a peça que a versão original resolvia só para o caso visual. Por domínio:

| Domínio | `REFERENCE` típica | `AREA_1` / `AREA_2` | `CHECK` — como o crítico compara às cegas |
|---|---|---|---|
| Jogo | Call of Duty · Hades · Brotato | texturas / física · combat feel / luz | frame leve in-game vs still real do jogo |
| Web app / produto | Linear · Notion · Stripe Dashboard | densidade de informação / motion | screenshot do ecrã vs screenshot do real, mesmo viewport |
| Landing / marketing | Linear · Vercel · Framer | tipografia / motion | screenshot full-page vs a página real, mesmo viewport |
| API / backend | Stripe API · GitHub API | contratos / erros · performance | ler os dois contratos lado-a-lado (endpoint, payload, erro, paginação, versionamento) + números de latência |
| Código / refactor | um repo de topo do mesmo stack | legibilidade / arquitectura | diff lado-a-lado do mesmo módulo + métricas (complexidade, LOC, cobertura, Larastan/tsc limpos) |
| Performance | orçamento real (LCP<2.0s, p95<200ms) | carga / percepção | número medido vs número alvo — Lighthouse/k6, não opinião |
| Deck / apresentação | um pitch deck famoso nomeado | arco narrativo / craft do slide | ler em voz alta + screenshot de cada slide vs os da referência |
| Marca / identidade | um brand book real nomeado | sistema / aplicação | pranchas lado-a-lado + teste de redução e monocromático |
| Copy / conteúdo | uma peça publicada nomeada | clareza / voz | os dois textos às cegas: qual é que um leitor da audiência prefere e porquê |

Domínio fora da tabela: escolher o `CHECK` **mais barato que ainda seja falsificável** — um artefacto que se
possa pôr ao lado do da referência. Se não existe nenhum, o gauntlet não se aplica: di-lo e propõe a via normal
(`/goal`, skill do domínio).

## Execução no JOCA (só os verbos, não uma máquina nova)

- **Fan-out** = várias chamadas `Agent()` **no mesmo turno**. Cap 3-5 concorrentes
  (`rules/orchestration-patterns.md`). Agrupar por **ficheiro/área disjunta**, nunca por tema — dois agentes
  no mesmo ficheiro pisam-se. Componentes partilhados definem-se numa **fase de fundação sequencial** antes
  do fan-out; os workers importam, não recriam.
- **Brief de cada worker** (obrigatório): objectivo em 2 frases · ficheiros/paths · constraints do projecto ·
  o que NÃO fazer · Step 0 `Read()` das skills do domínio · anti-fabricação (sem credencial → `TODO`, nunca inventar).
- **Crítico** = agente **separado**, brief próprio, só avalia. Nunca quem escreveu o código. O brief do
  crítico leva o `CHECK` do domínio e a instrução de reprovar por defeito.
- **Loop** = skill `loop` do harness. `ultracode`/`Workflow` só se o user o pedir — custo alto.
- Workers escrevem para disco (`scratchpad/gauntlet/<stream>.md`) e devolvem só resumo + path.
  ⚠ fora da árvore do projecto se houver content-scan (Tailwind v4 e afins).
- **Irreversível continua a ser gate**: deploy/push/migration/delete/payment/auth → 1 linha de confirmação.
  O loop não é licença para publicar sozinho.

## Buracos de asset

Defeito que é falta de material, não de código: image gen (`img-gen` → `img-gen-openai`/`img-gen-google`) para
pixels planos — sprites, texturas, ícones, UI; skill `blender` / Blender MCP para malha 3D que a câmara orbita.
O asset aterra **sempre** no artefacto jogável/navegável, e o crítico avalia esse artefacto — nunca a grelha de
geração nem a viewport do Blender.

## Não inventar

É assim que os agentes saem do prompt puro e partem o loop:

- Scripts auxiliares, capture harnesses, ferramentas de blind-compare, templates de relatório, scoreboards
- `GAUNTLET_STATE.md` / ledgers de rondas / contratos de arquitectura **como sendo o trabalho**
- Regras de paragem inventadas ("N rondas planas", "já chega", "pronto para review")
- Amaciar o crítico ou baixar a referência a meio
- Perguntar "queres que continue?" ao fim de um ciclo — continua
- Gastar a run em tooling em vez de no artefacto
- **Fingir a comparação**: descrever a referência de memória em vez de a ir buscar. Se não a consegues
  observar, di-lo e usa o substituto verificável.
- Pegar o sistema para alimentar o crítico (loops headless, captura a 100% CPU). Se a espreitadela trava o
  produto, a espreitadela está errada — tira uma medida mais leve.
- Rondas infinitas de geração de assets que nunca aterram no artefacto

## Compose-only

Só se o user disser "dá-me só o prompt" / "compose only": devolver os três parágrafos preenchidos num bloco
` ```text `. Caso contrário, **executar sempre**.

## Exemplos preenchidos

**Jogo — Call of Duty / ThreeJS** (o original):

```text
I want you to build a first-person shooter at the level of the most recent Call of Duty games. It should be utterly perfect, visually beautiful, with every single thing done at AAA quality—from textures to physics to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the game is utterly perfect. You should /loop on each item and have a separate sub-agent check it visually to ensure it looks triple A. That separate sub-agent should be a really harsh critic, and if it doesn't look triple A, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with the actual Call of Duty game. It should literally compare them side by side blind and say which one looks better. Do this in ThreeJS. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

**API — Stripe / Laravel** (domínio não-visual; repara no `CHECK`):

```text
I want you to build the billing API at the level of the Stripe API. It should be utterly perfect, a joy to integrate against, with every single thing done at top-tier quality, from resource naming and error contracts to pagination and idempotency to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the API is utterly perfect. You should /loop on each item and have a separate sub-agent check it by reading our endpoint contract side by side with Stripe's published contract for the same operation to ensure it is top-tier. That separate sub-agent should be a really harsh critic, and if it isn't top-tier, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with the actual Stripe API docs. It should literally compare them side by side blind and say which one is better to integrate against. Do this in Laravel. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

**Landing — Linear / Next.js:**

```text
I want you to build a marketing site for my product at the level of Linear's website. It should be utterly perfect, visually beautiful, with every single thing done at top studio quality, from typography to motion to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the site is utterly perfect. You should /loop on each item and have a separate sub-agent screenshot it and check it visually to ensure it looks like a top studio built it. That separate sub-agent should be a really harsh critic, and if it doesn't, it should keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with linear.app. It should literally compare them side by side blind and say which one looks better. Do this in Next.js and Tailwind. /loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

Crédito: aim prompt de [Matt Shumer](https://x.com/mattshumer_) · empacotamento de
[duolahypercho/gauntlet-loop](https://github.com/duolahypercho/gauntlet-loop) (MIT) · generalização de domínio: JOCA.

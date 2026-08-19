---
name: planear-ondas
description: "Organiza os issues abertos em ondas de trabalho, com portoes de validacao, analise de paralelismo e agrupamento por sessao. Usar depois de abrir o backlog, ou quando o plano deixou de reflectir a realidade. MUST be invoked when the user says: planear ondas, ondas de trabalho, /planear-ondas, organizar o backlog, por ordem nos issues. SHOULD also invoke when: milestones, por onde comeco, que issues primeiro, plano de trabalho, ONDAS.md, replanear."
triggers: planear ondas, ondas de trabalho, planear-ondas, organizar o backlog, por ordem nos issues, milestones, por onde comeco, que issues primeiro, plano de trabalho, ONDAS.md, replanear
chain: novo-issue
---
# Planear ondas

Organizas o backlog em **ondas**. Nao implementas nada.

## O que e uma onda

**Uma onda e tudo o que avanca sem precisar de uma decisao nova do utilizador.** Termina num portao
de validacao.

Nao e um sprint. Um sprint e uma caixa de tempo — duas semanas, aconteca o que acontecer. Uma onda e
uma caixa de *autonomia*: acaba quando o trabalho volta a precisar dos olhos de alguem. Num projeto
com um so aprovador, a fronteira util e a pessoa, nao o calendario.

Consequencia pratica: uma onda pode durar dois dias ou duas semanas. O que a define e o portao.

## Ler primeiro

```bash
gh issue list --state open --limit 100 \
  --json number,title,state,labels,body,milestone,blockedBy,blocking
```

Inclui sempre `blockedBy` e `blocking` — se replaneares sem os ler, ficas cego as dependencias que ja
existem e voltas a propor o que ja esta ligado.

Mais `docs/PRODUTO.md` (fluxos e entidades), `docs/ARCHITECTURE.md` se existir, e `docs/DESIGN.md`.

## Como ordenar — tres criterios, por esta ordem

### 1. Custo de reversao

**O que e caro de desfazer vai primeiro.** O modelo de dados, o esquema de URLs publicas, o modelo de
autenticacao e permissoes.

Um erro no schema descoberto na onda 3 obriga a refazer tudo o que assenta nele. O mesmo erro
descoberto na onda 1 custa uma migracao. Este criterio ganha aos outros dois quando houver conflito.

### 2. Dependencia tecnica

O que tem de existir antes. Expressa-se nativamente:

```bash
gh issue edit <n> --add-blocked-by <m>
```

**Atencao a direccao:** isto le-se "`<n>` esta bloqueado por `<m>`" — ou seja, **`<m>` vem primeiro**.
A inversa e `--add-blocking`. Trocar as duas produz um grafo de ondas ao contrario, sem erro visivel
em lado nenhum.

Aceita numero (`200`), `#200` ou URL completo, e varios de uma vez. **Nao** aceita `owner/repo#200` —
para outro repositorio, usa o URL.

Limite: 50 issues por tipo de relacao. Se um issue esta bloqueado por tres outros, provavelmente esta
mal dimensionado — ou e um epico disfarcado.

### 3. Momento de validacao

**Agrupa na mesma onda o que precisa dos mesmos olhos.** Se cinco ecras precisam de revisao visual,
reve-los de uma vez custa ao utilizador uma sessao de dez minutos; espalhados por cinco ondas, custa
cinco interrupcoes e cinco recontextualizacoes.

Este e o criterio que mais tempo poupa a quem aprova, e o que mais gente ignora.

## Paralelismo

**Dois issues so correm em paralelo se os conjuntos de ficheiros forem disjuntos.**

Cada issue tem uma seccao **"Ficheiros provaveis"** — e para isto que ela existe. Se faltar num
issue, abre o codigo para a preencher antes de decidir, ou sequencia por precaucao. Se houver
interseccao, sequencia. Sem excepcoes — dois agentes no mesmo ficheiro dao conflito de merge no
melhor caso, e decisoes arquitecturais incompativeis no pior.

> **Se os issues nao tiverem "Ficheiros provaveis"**, o backlog foi criado com uma versao antiga do
> `novo-issue`. Assinala-o e sugere corrigir os issues — nao adivinhes os ficheiros a partir do
> titulo.

Mantem-se: um agente por issue, um issue por branch, maximo duas branches em curso por pessoa.

> **O paralelismo e quase sempre falsa economia num projeto a solo.** O gargalo nao e o tempo de
> maquina — e a capacidade de revisao de quem aprova. Trabalho paralelo nao acelera nada; so cria uma
> fila maior a espera da mesma pessoa. Paraleliza apenas quando as pecas genuinamente nao precisam de
> ser vistas em conjunto.

## Custo de tokens — tres regras

**1. Issues do mesmo modulo vao na mesma sessao, nao em sessoes paralelas.**

Cada sessao nova rele o projeto do zero. Tres sessoes sobre o mesmo modulo pagam tres vezes o mesmo
contexto. E contra-intuitivo: **paralelizar pode custar mais tokens do que sequenciar**, mesmo
poupando tempo de relogio. Agrupa por proximidade no codigo, nao por semelhanca de tema.

**2. Validar cedo e a maior poupanca que existe.**

Retrabalho e o gasto mais caro de todos — reimplementar custa mais do que implementar, porque paga o
contexto outra vez e ainda tem de desfazer. Um portao bem posto poupa mais tokens do que qualquer
optimizacao de sessao.

**3. Uma onda deve caber numa sessao de trabalho.**

Se nao cabe, esta grande demais — divide.

## Produzir

Para cada onda:

```markdown
## Onda N: <nome curto>

**Fica possivel no fim:** <o que o produto passa a fazer, em uma frase>

**Issues:** #a, #b, #c

**Ordem:** #a primeiro (bloqueia os outros) · depois #b e #c em paralelo
**Titulo da milestone:** `Onda N: <nome curto>` — dois pontos, para a correspondencia exacta nao falhar
**Porque paralelo:** #b toca em `app/Http/Controllers/`, #c em `resources/views/` — disjuntos

**Sessoes sugeridas:** 2
  - Sessao 1: #a, #b (mesmo modulo, contexto partilhado)
  - Sessao 2: #c

**Portao de validacao:**
  O que reves: <concreto — "o schema das 4 tabelas e as relacoes">
  Como: <"ler as migracoes e correr php artisan migrate:status">
  Tempo: <~10 min>
  Se estiver errado: <o que se perde — "uma migracao" vs "tres ondas de trabalho">
```

Termina com os riscos: que onda esta mais dependente de um pressuposto por confirmar, e o que
acontece se esse pressuposto cair.

## Gravar

Depois de o utilizador aprovar o plano:

**1. Criar as milestones** — uma por onda:

```bash
gh api repos/{owner}/{repo}/milestones \
  -f title="Onda 1: Fundacao de dados" \
  -f description="<o que fica possivel no fim>"
```

O `{owner}/{repo}` e substituido pelo `gh` — escreve-o com chavetas, a letra. Nao precisa de
`-X POST`: passar parametros ja implica POST.

**Usa dois pontos no titulo, nao travessao.** O `gh issue edit --milestone` procura o titulo por
correspondencia exacta; se numa invocacao escreveres `—` e noutra `-`, falha com `not found` e a
causa e invisivel.

**2. Atribuir os issues** — varios de uma vez:

```bash
gh issue edit 3 5 7 --milestone "Onda 1: Fundacao de dados"
```

A milestone tem de existir antes.

**3. Ligar as dependencias:**

```bash
gh issue edit <n> --add-blocked-by <m>
```

Isto exige **`gh` v2.94.0 ou superior** (a release que introduziu estas flags) e permissao de
*triage* no repositorio. Confirma com `gh --version`.

Se o `gh` for anterior, **nao caias para "registar no corpo do issue"** — a dependencia real continua
a ser criavel pela API:

```bash
ID=$(gh api repos/{owner}/{repo}/issues/<m> --jq .id)
gh api -X POST repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by -F issue_id=$ID
```

Repara que a API usa o **id interno** do issue, nao o numero.

**4. Escrever `docs/ONDAS.md`** com o plano completo — e a versao legivel, que sobrevive a mudancas no
GitHub e explica o *porque* da ordem, que as milestones nao guardam.

**5. Verificar pelo efeito, nao pelo relatorio.** Depois de gravar:

```bash
gh issue list --state open --json number,milestone,blockedBy \
  --jq '.[] | "\(.number) \(.milestone.title // "SEM MILESTONE") bloqueado-por:\(.blockedBy|length)"'
```

Um `gh issue edit` que imprime sucesso e uma milestone que nao ficou atribuida sao indistinguiveis
sem esta leitura.

## Regras

- **Nao inventes issues.** Organizas o que existe. Se faltar trabalho obvio, assinala e sugere
  `/novo-issue`.
- **Nao facas mais de 4 ou 5 ondas.** Mais do que isso e planeamento a fingir: as ondas do fim vao
  mudar antes de la chegares.
- **A primeira onda e a mais importante e a mais curta.** E a que valida os pressupostos caros.
- **Se um issue nao cabe em nenhuma onda sem bloquear tudo**, o problema e o issue. Divide-o.

## Proximo passo (chain)

- Faltou trabalho obvio no backlog → `novo-issue` para o abrir.
- Onda 1 tem ecras por desenhar → `preparar-design` para cada um, antes de implementar.
- Plano aprovado e gravado → comecar a Onda 1. O portao de validacao dela e o proximo momento em que
  o utilizador e preciso.

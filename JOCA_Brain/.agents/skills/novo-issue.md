---
name: novo-issue
description: "Transforma uma ideia ou problema num issue do GitHub estruturado, com criterios de aceitacao verificaveis e a lista de ficheiros que o trabalho vai tocar. Usar antes de escrever codigo para algo novo. MUST be invoked when the user says: novo issue, criar issue, abrir issue, /novo-issue, issue no GitHub. SHOULD also invoke when: transformar isto numa tarefa, criterios de aceitacao, adicionar ao backlog, registar esta ideia, quero implementar X."
triggers: novo issue, criar issue, abrir issue, novo-issue, issue no GitHub, transformar isto numa tarefa, criterios de aceitacao, adicionar ao backlog, registar esta ideia, quero implementar
chain: planear-ondas, preparar-design
---
# Novo issue — pronto a implementar

Cria um issue no GitHub pronto a implementar. **Nao implementes nada nesta skill.**

## Passos

1. **Perguntar ate perceber.** Uma pergunta de cada vez, com `AskUserQuestion` quando as respostas
   forem escolhas fechadas. Precisas de saber:
   - Que problema resolve, e para quem — nao que funcionalidade se vai construir
   - Como se sabe objectivamente que esta feito
   - O que fica deliberadamente de fora

   Se a resposta for vaga, insiste. Ler `docs/PRODUTO.md` para enquadramento.

2. **Verificar o tamanho.** Mais de um dia de trabalho → propor divisao antes de avancar.

3. **Verificar duplicacao:**

```bash
gh issue list --search "<palavras-chave>" --state all --limit 20
```

4. **Verificar se precisa de design.** Se envolve interface que ainda nao existe, o issue depende de
   um mockup — assinalar isso e sugerir `/preparar-design` primeiro.

5. **Apresentar o rascunho** e esperar confirmacao.

6. **Criar o issue.**

```bash
gh issue create --title "<titulo>" --label "<tipo>" --body "<corpo>"
```

Se ja houver ondas planeadas (`docs/ONDAS.md` e milestones no repositorio), passa tudo **no mesmo
comando** — evita ter de descobrir o numero do issue a seguir (o `create` so imprime o URL):

```bash
gh issue create --title "<titulo>" --label "<tipo>" --body "<corpo>" \
  --milestone "Onda 2: <nome>" \
  --blocked-by <m>
```

`--blocked-by <m>` le-se "este issue esta bloqueado por `<m>`" — `<m>` vem primeiro. A inversa e
`--blocking`.

> **Versao do `gh`.** `--blocked-by`/`--blocking` exigem **`gh` v2.94.0 ou superior** (confirmado nas
> notas dessa release). O `--milestone` funciona em qualquer versao recente. Confirmar com
> `gh --version`; se for anterior, ver o fallback por API em `planear-ondas`. **Nao registar a
> dependencia em texto no corpo do issue** — deixa de ser legivel por maquina e o `planear-ondas`
> fica cego a ela.

Se nao for evidente em que onda entra, **pergunta** em vez de adivinhar — meter trabalho na onda
errada desfaz o agrupamento de validacao, que e a razao de as ondas existirem.

### Corpo

```markdown
## Problema
<a dor concreta, em linguagem de utilizador — nao a solucao>

## O que vai ser feito
<o comportamento desejado>

## Feito quando
- [ ] <criterio verificavel>
- [ ] <criterio verificavel>

## Fora de ambito
<o que este issue explicitamente nao faz>

## Design
<link para docs/mockups/<ecra>.html, ou "nao aplicavel">

## Contexto tecnico
<entidades envolvidas, decisoes ja tomadas>

## Ficheiros provaveis
<lista dos ficheiros/pastas que este trabalho vai tocar>

## Depende de
<#N, ou "nada">
```

**A seccao "Ficheiros provaveis" nao e decorativa.** E o que permite decidir se dois issues podem
correr em paralelo — so podem se os conjuntos forem disjuntos. Um issue sem ela obriga a abrir o
codigo para descobrir, ou a sequenciar por precaucao. O `planear-ondas` depende dela directamente.

## Regras

- **Maximo 5 criterios de aceitacao.** Mais do que isso significa que o issue devia estar dividido.
- Cada criterio verificavel por quem nao participou na conversa. "A experiencia deve ser fluida" nao
  serve; "a listagem carrega em menos de 2s com 1000 registos" serve.
- Escrever "Fora de ambito" mesmo quando parece obvio — e o que impede o ambito de crescer durante a
  implementacao. Em produto proprio, onde nao ha cliente a fechar o ambito, isto importa mais, nao
  menos.
- **Se nao conseguires escrever criterios verificaveis, o issue nao esta pronto.** Diz isso em vez de
  o criar.

## Nota

Os criterios de aceitacao sao a fonte a partir da qual os testes vao ser escritos
(`escrever-testes`). Criterios vagos produzem testes que nao verificam nada.

## Proximo passo (chain)

- Issue envolve ecra novo → `preparar-design` antes de implementar.
- Ha 3+ issues abertos sem plano → `planear-ondas` para os organizar em ondas.
- Issue pronto e a implementacao feita → `escrever-testes <n>`, em **sessao separada**.

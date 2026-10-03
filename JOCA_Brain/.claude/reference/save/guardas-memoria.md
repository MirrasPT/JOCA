# /save — PASSO 2: guardas de memória absorvida, substituída e reescrita

Texto integral (regras, comandos e casos reais) apontado pelo PASSO 2 de `.claude/commands/save.md`.

**Memória absorvida = ponteiro de 3 linhas.** Quando uma entrada declara que **absorve** outra (fusão
de entradas, projecto que passou a viver dentro de outro), a absorvida **não fica a existir em
paralelo**: reduzir a três linhas — o que era, para onde foi (`→ memory/projects/<nova>/`), data da
absorção. Em formato pasta, a absorvida passa a **alias** exacto no `aliases:` do index da viva e o corpo vai para
o fim do `arquivo.md` dela (com cabeçalho e data); o ficheiro antigo sai. Duas entradas vivas para o mesmo trabalho divergem em silêncio e a mais velha ganha por
acaso; o `/resume` (2g) avisa quando duas resolvem para o mesmo sítio.

**Memória substituída = inventário de secções antes de a dar por morta.** Substituir uma memória por
outra não é o mesmo que absorver: aqui a nova nasce de raiz e **não herda nada por omissão**. Antes de
declarar uma memória obsoleta: `grep -n "^## " <antiga>.md` → confirmar, secção a secção, que cada uma
**existe na nova** ou foi **deliberadamente descartada** (dizê-lo no relatório). Depois, deixar no
ficheiro antigo um **cabeçalho de 3 linhas** a apontar para a viva (o que era · `→ memory/projects/
<nova>/` · data) — nunca dar por morto e deixar órfão: o `grep` do `/resume` continua a encontrá-lo
e a sessão passa a ler duas versões do mesmo estado.
> Caso real: a `cliente-imagens.md` foi dada por substituída pela `cliente-redes-sociais.md` e a
> nova não herdou a secção do TryPost (workspaces, ids, OAuth, método de troca). O custo apareceu 3
> dias depois, com a sessão a dar informação errada ao utilizador.

**Reescrita estrutural = contar as secções E as linhas antes e depois.** Substituir uma secção por índices de
linha (splice) é a operação que silenciosamente duplica ou come texto. Três guardas, todas baratas:
`assert i < j` antes de cortar (índices trocados apagam o ficheiro entre eles sem erro), a
contagem de secções antes/depois — se o número subiu sem se ter acrescentado secção, duplicou — e a
contagem de **linhas**: trocar o conteúdo de uma secção-diário mantém o nº de secções e apagou ~120
linhas sem nenhuma guarda dar por isso:

```bash
grep -c '^## ' "$F"; wc -l < "$F"   # ANTES
# … a edicao …
grep -c '^## ' "$F"        # DEPOIS: mesmo numero, ou +N deliberados
wc -l < "$F"               # DEPOIS: desceu mais do que o removido de propósito → parar e repor
grep '^## ' "$F" | sort | uniq -d   # titulos repetidos (sem campos `$N` do awk: o expansor de argumentos troca-os)
```

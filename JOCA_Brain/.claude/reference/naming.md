# Naming — escolher um nome (marca, produto, projecto)

Parte da skill `brand-guidelines` — carregado on-demand quando ainda não há nome fechado. Ex-skill `naming` (F2.8, 2026-10-02).

Escolher um nome. **Não** identidade visual (o resto da `brand-guidelines`) nem posicionamento/ICP (`brand-positioning`) — se o utilizador já tem nome fechado e quer sistema de marca, volta à `brand-guidelines`.

## Passo 1 — 3 perguntas mínimas

1. O que é, em 1 frase.
2. **Quem lê mesmo o nome:** autor/loja/ficha técnica, ou também o utilizador final? (decide o peso da verificação #5)
3. Onde o nome vai viver: app store, domínio, pasta em disco, package/bundle id — cada sítio tem regras próprias.

Sem estas 3, os candidatos saem genéricos e o gate do Passo 3 não tem contexto para correr.

## Passo 2 — Gerar por famílias semânticas, nunca lista plana

2-3 famílias (direcção/registo distintos), 3-5 candidatos cada. Uma lista de 15 nomes soltos não dá ao utilizador nenhum eixo de escolha.

Exemplo real (marca industrial, direcção "sem monograma, símbolo mínimo"): família única
gerada foi *Interlock*, *Datum*, *Relay* — todos do registo "mecanismo industrial", nenhum decorativo
(2026-09-07).

## Passo 3 — Gate fixo de 5 verificações (obrigatório, por candidato, antes de recomendar)

Nenhum candidato chega ao utilizador sem passar pelas 5. Tabela, uma linha por candidato.

| # | Verificação | Como correr | Falha real que a originou |
|---|---|---|---|
| 1 | Leitura em voz alta na língua-alvo | Dizer o nome composto em voz alta, sílaba a sílaba, na língua do público | Nome composto `<base>app` em que o acento tónico cai no sufixo — dito em voz alta, a base desaparece. Escrito funciona, falado falha |
| 2 | Raiz/homógrafo | A raiz do nome coincide com a raiz de outra palavra/domínio já carregado de sentido? | A raiz do candidato era a raiz de um termo médico — o nome evocava o domínio errado |
| 3 | Marca já existente | `WebSearch "<nome> marca"` / `"<nome> trademark"` — uso histórico e actual, não só disponibilidade de domínio | O candidato tinha sido marca real de aparelhos no séc. XX (2026-08-21) |
| 4 | Nome como identificador técnico (disco/domínio/package) | Testar o nome no ambiente exacto onde vai viver, não só como palavra | Pasta `<Nome>.app` no Mac: o Finder trata `.app` como *bundle* de aplicação — parte a sincronização entre máquinas |
| 5 | Quem é o leitor real do nome | Separar quem lê o nome (autor, loja, código) de quem usa o produto | App cuja utilizadora final só reconhece o ícone, nunca lê o nome — o nome serve ao autor e à loja, e isso muda qual candidato recomendar |

Falha numa verificação **não elimina automaticamente** o candidato — reporta-se a falha ao utilizador com a verificação que a mostrou; a decisão de aceitar o risco (ex.: marca extinta há décadas) é dele.

## Passo 4 — Aviso obrigatório na entrega

Sem acesso a bases INPI/EUIPO/USPTO — a verificação #3 é sinal de pesquisa web, não busca oficial de
marca registada. Avisar sempre, na mesma linha da recomendação: confirmar disponibilidade legal antes
de investir em identidade visual ou domínio.

## Output

Tabela: família · candidato · verificações #1-#5 (passa/falha + nota) · recomendação final com porquê.

## Próximo passo (chain)

Nome fechado pelo utilizador → resto da `brand-guidelines` (sistema de identidade a partir do nome escolhido).

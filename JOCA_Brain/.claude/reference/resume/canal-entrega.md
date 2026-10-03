# /resume — 2i: respostas no canal de entrega

Se a memória nomeia um **canal de entrega** (DM Mattermost, email, grupo) **e** a data do último envio,
ler as mensagens desse canal **desde essa data** antes de apresentar o estado. Um "à espera de
feedback" pode estar respondido há dias.
```bash
mmctl post list <equipa:canal> --since <YYYY-MM-DDTHH:MM:SS+00:00> --suppress-warnings
```
⚠ **O `--since` exige fuso numérico.** O mmctl faz `time.Parse("2006-01-02T15:04:05-07:00", …)`: `…Z` e a data
sem hora dão `Error: invalid since time` e **zero posts**, que se lêem como «sem resposta». Alternativa que não
depende do formato: `--number 30` e filtrar pela data na leitura.
Email → a pesquisa do Gmail (MCP) ou `gws gmail +triage`, filtrada pelo remetente e pela data.
**O cliente pode responder por fora do canal.** Se a memória nomeia um **intermediário** que reencaminha ao
cliente (ex.: alguém da equipa que lhe passa as peças), pesquisar também o Gmail pelo **domínio do cliente** desde o
último envio (`from:<dominio-cliente> after:<YYYY/MM/DD>`) — uma resposta chegou por email reencaminhado e só
apareceu porque o utilizador a exportou.
**«Já tens isso» / «já existe» sobre um ficheiro do cliente → ler primeiro o canal de entrega (DM) desde a última
sessão, e só depois varrer o Drive.** O material vem muitas vezes anexado na conversa (gastaram-se 5 pesquisas no
Drive para algo que estava numa DM).
Resposta encontrada → entra no resumo como **pendente novo**, com a data e o essencial; nada → dizer
"sem resposta desde <data>" (com o comando corrido), não omitir.

**Projecto cuja FONTE é uma caixa de correio** (documentos administrativos, cartas, pedidos que chegam
por email — a memória declara-o num campo `fonte:`) → não é só o canal de entrega: pesquisar **tudo o que
chegou desde a última sessão** antes de apresentar o estado. No Gmail: `newer_than:<N>d` (N = dias desde
a data da «Última sessão»), filtrado pelos remetentes/assuntos que a memória nomeia. O estado do
projecto é o que está na caixa, não o que a memória diz que estava.

---
name: email-dashboard
description: "Lê a inbox do Gmail (read-only) e entrega um dashboard HTML local, aberto no browser, com os emails triados por Acção / A aguardar / FYI / Ruído. MUST be invoked when the user says: email-dashboard, vê o meu email, vê a minha caixa de correio, dashboard do email, dashboard da inbox, check my email, inbox dashboard, o que tenho no email. SHOULD also invoke when: o user pede um ponto de situação do email ao início do dia, ou pergunta o que ficou por responder e quer o resultado num ficheiro em vez de texto no chat."
triggers: email-dashboard, ve o meu email, dashboard do email, dashboard da inbox, check my email, inbox dashboard, o que tenho no email, ponto de situacao do email, o que ficou por responder
chain: personal-comms, novo-issue
allowed-tools: Bash, Read, Write, ToolSearch, mcp__claude_ai_Gmail__search_threads, mcp__claude_ai_Gmail__get_thread, mcp__claude_ai_Gmail__list_labels
metadata:
  category: produtividade
  origin: user
---

# Email Dashboard

Ciclo fechado, sempre o mesmo: **ler a inbox (read-only) → triar → escrever um `.html` local → abrir no browser**. Nunca marca lido, nunca arquiva, nunca envia, nunca responde.

## Quando usar

- "vê o meu email" / "o que tenho na inbox" / ponto de situação matinal.
- Depois de um dia sem abrir o mail, para saber o que exige acção.

Não usar para: **enviar/responder email, criar eventos, gerir calendário, ou um resumo curto só em texto no chat** → `personal-comms`. O sinal que separa as duas: se o pedido implica ficheiro/dashboard visual para reabrir depois, é esta skill; se é só "diz-me rápido", é `personal-comms`.

## Passo 1 — Tool de leitura (nunca assumir carregada)

As tools Gmail são **deferred** neste ambiente: carregar todas numa única chamada antes de usar qualquer uma.

```
ToolSearch query="select:mcp__claude_ai_Gmail__search_threads,mcp__claude_ai_Gmail__get_thread,mcp__claude_ai_Gmail__list_labels" max_results=3
```

Não devolveu as 3 tools → correr a descoberta do `personal-comms` (Passo 1 dessa skill: `claude mcp list`, config, CLIs). Continua sem tool de leitura → escrever `TODO: tool de email não ligada`, reportar e **parar**. Nunca improvisar IMAP/curl, nunca inventar credenciais.

## Passo 2 — Janela e estado

Estado persistente em `~/Relatorios/email-dashboard/estado.json` (`{"ultima_corrida":"ISO8601"}`).

1. Ler o estado. Existe e é JSON válido → janela = desde `ultima_corrida`. Não existe, ou o JSON não faz parse → janela = `newer_than:2d` (tratar como corrida inicial, não travar).
2. O user manda uma janela explícita ("hoje", "esta semana") → essa sobrepõe-se sempre ao estado.
3. Traduzir para sintaxe Gmail, nunca linguagem natural: `in:inbox newer_than:2d -in:draft`.

## Passo 3 — Buscar (barato primeiro)

```
search_threads(query="in:inbox newer_than:2d -in:draft", pageSize=50, view="THREAD_VIEW_MINIMAL")
```

- `THREAD_VIEW_MINIMAL` já traz `subject`, `snippet`, `sender`, `date`, `label_ids` — chega para triar. **Não abrir corpos por defeito.**
- Resposta `{}` = **zero resultados, não erro** → renderizar o estado vazio do Passo 6, nunca inventar linhas.
- `label:` aceita **IDs**, não nomes visíveis → `list_labels()` primeiro se o user filtrar por etiqueta.
- Precisa de detalhe do corpo (proposta, valor, prazo)? `get_thread(threadId, messageFormat="PLAIN_TEXT")` **só** para candidatos a Acção, máximo **8 threads** por corrida. `FULL_CONTENT` esgota o contexto — nunca usar.
- **Erro duro da tool** (auth expirada, rate limit, 5xx) é diferente de `{}`: não repetir a chamada mais de 1 vez, escrever `TODO: falha na leitura do email (<erro>)`, reportar e **parar** — nunca renderizar um dashboard parcial que se lê como inbox vazia.
- `pageSize` máximo real = 50. Mais que 50 threads na janela → paginar com `pageToken`, máximo **2 páginas extra**; ao fim disso o dashboard diz "janela truncada em N threads" em vez de continuar a paginar.

## Passo 4 — Triagem (4 baldes, um por thread)

| Balde | Regra |
|---|---|
| **Acção** | Pergunta directa ao user, pedido, prazo, factura/pagamento, cliente à espera |
| **A aguardar** | Última mensagem da thread é do próprio user **e pedia resposta** → a bola está do lado do outro. Reencaminhamento ou cópia para o próprio sem pergunta → **FYI**, não aqui |
| **FYI** | Informativo real (equipa, plataforma, entregas) sem acção pedida |
| **Ruído** | Newsletters, marketing, `category:promotions`/`social`, notificações automáticas |

Por thread guardar: `remetente`, `assunto`, `data`, `threadId`, `snippet` (máx. 160 caracteres), balde, e **acção sugerida em 1 linha** (só para Acção).

Marcar o projecto no cartão quando o remetente/assunto casa um projecto do inventário — a lista canónica é `memory/PROJECTOS.md` (ou a tabela de projectos do `~/CLAUDE.md`); **nunca** manter uma cópia de clientes dentro desta skill, que apodrece em silêncio. Sem match → sem etiqueta, **nunca adivinhar o projecto**.

## Passo 5 — Regras de conteúdo (não negociáveis)

- **Zero fabricação**: cada cartão vem de uma resposta real da tool — nenhuma contagem estimada, nenhum remetente plausível.
- **Segredos não entram no HTML**: códigos 2FA/OTP, passwords, tokens, links de reset → o cartão escreve `[código omitido]`. O ficheiro fica no disco e pode ser reaberto por qualquer pessoa.
- **Read-only absoluto**: proibido `label_*`, `trash_*`, `mark_*`, `send_*`, `reply`, `create_draft`. User pede acção a partir de um cartão → `personal-comms`, com confirmação se for envio.

## Passo 6 — Dashboard HTML

Ficheiro: `~/Relatorios/email-dashboard/YYYY-MM-DD-HHMM.html` (`mkdir -p` primeiro). **Timestamp no nome — nunca escrever por cima de um dashboard anterior.**

Conteúdo mínimo:
- Cabeçalho: data/hora da corrida + janela coberta em texto ("desde 2026-09-02 09:14") + 4 contadores.
- 4 secções na ordem **Acção → A aguardar → FYI → Ruído** (Ruído colapsado num `<details>`, só contagem + remetentes).
- Cartão: remetente · assunto · data relativa · projecto (se houver) · snippet · acção sugerida · link `https://mail.google.com/mail/u/0/#inbox/<threadId>` com `target="_blank"`.
- Estado vazio explícito: "Nada novo na janela X" — nunca uma página em branco.

Regras de construção:
- **HTML auto-contido**: CSS inline no `<style>`, zero CDN, zero fetch. Abre offline e daqui a um ano.
- Claro/escuro por `prefers-color-scheme`, ambos com fundo e cor explícitos.
- PT-PT em toda a interface.
- Sem `Artifact()` — o output é sempre local.

Verificação antes de reportar: `test -f <path>` devolve sucesso. Só então:
```bash
open ~/Relatorios/email-dashboard/<ficheiro>.html      # macOS
# Windows: start "" "%USERPROFILE%\Relatorios\email-dashboard\<ficheiro>.html"
```
Escrever `estado.json` com a hora desta corrida **só depois** de o ficheiro existir no disco — se o dashboard falhar a meio, a próxima corrida repete a janela em vez de perder emails.

## Passo 7 — Resposta no terminal

Máximo 4 linhas: contagens dos 4 baldes, os 2-3 accionáveis mais urgentes, o path do ficheiro. O detalhe está no dashboard — não repetir a lista toda no chat.

## Gotchas

| Sintoma | Causa | Fix |
|---|---|---|
| Contexto esgotado a meio | `get_thread` com `FULL_CONTENT` ou em demasiadas threads | `PLAIN_TEXT`, máximo 8 threads |
| `label:Clientes` não devolve nada | `label:` quer o **ID**, não o nome | `list_labels()` e usar o `id` |
| Threads já triadas voltam a aparecer | `estado.json` não foi escrito no fim da corrida anterior | Escrever o estado sempre, mesmo em janela vazia |
| `estado.json` existe mas não abre | JSON corrompido (corrida anterior interrompida) | Tratar como inexistente, `newer_than:2d`, sobrescrever no fim |
| Thread arquivada aparece na inbox | Gmail devolve a thread inteira se **uma** mensagem casar | Filtrar por `label_ids` conter `INBOX` |
| Link do cartão abre a conta errada | `u/0` é o índice do perfil Google no browser, não fixo | Trocar por `u/?authuser=<email>` |
| Dashboard anterior desapareceu | Ficheiro escrito com nome fixo | Timestamp no nome, sempre |

## Próximo passo (chain)

- `personal-comms` — o user quer responder/enviar/marcar reunião a partir de um cartão. **Envio é irreversível** → draft + 1 linha de confirmação antes.
- `novo-issue` — um email accionável é trabalho de um projecto com repo conhecido. Reversível → abrir o issue sem perguntar, e dizer qual.

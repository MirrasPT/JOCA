---
name: joca-terminal
description: Usar o JOCA a partir de dentro de um terminal aberto pelo JOCA_OS — consultar/comentar/mover tarefas do quadro, abrir novos terminais, falar com outros terminais e enviar notificações, tudo contra o JOCA_OS em execução e sem o reiniciar. MUST be invoked when the user says: comenta na tarefa, fecha a tarefa, marca como feito, cria uma tarefa, move a tarefa, abre um terminal, fala com o outro terminal, avisa-me quando acabares. SHOULD also invoke when: o agente acaba um trabalho que veio de uma tarefa do quadro, precisa de delegar a outro terminal, ou quer registar progresso para o utilizador ver.
origin: local
chain: task-router
---

# JOCA a partir do terminal (ponte de agentes)

Todos os terminais abertos pelo JOCA_OS nascem com a ponte no ambiente. Verifica com `echo $JOCA_CLI`.
Se a variável estiver vazia, este terminal **não** foi aberto pelo JOCA — não uses esta skill.

**O JOCA_OS está a correr enquanto usas isto.** Nada do que fizeres aqui o reinicia nem lhe toca no
código: são as operações que a interface já expõe, chamadas por HTTP. O que mudares aparece no ecrã
do utilizador no momento.

```bash
node "$JOCA_CLI" help        # lista tudo o que podes fazer
```

Variáveis disponíveis: `JOCA_CLI` (caminho do CLI), `JOCA_API_URL`, `JOCA_SESSION_ID` (este terminal),
`JOCA_API_TOKEN` (só quando a auth está ligada). Tudo fala com o JOCA_OS **em execução** — nada precisa
de reinício, e o que fizeres aparece na interface imediatamente.

## Regra principal: fecha o ciclo da tua tarefa

Quando executas uma tarefa do quadro, o brief traz o id dela. **Ao terminar, deixa uma nota do que
fizeste** — é assim que o utilizador percebe o que aconteceu sem ler o terminal todo:

```bash
node "$JOCA_CLI" comment <id-tarefa> "Implementei X em src/y.ts. Testes a passar. Ficou por fazer Z."
node "$JOCA_CLI" done <id-tarefa> --note "Resumo do que fiz"   # comenta + move para 'concluida'
```

Usa `done` só quando a tarefa está mesmo concluída. Se ficou a meio, comenta a explicar o estado e
deixa-a onde está — o juiz do JOCA também escreve o veredicto dele na mesma thread.

## Tarefas

```bash
node "$JOCA_CLI" tasks                          # o quadro todo, por coluna
node "$JOCA_CLI" tasks --status a-executar      # filtrar
node "$JOCA_CLI" task <id>                      # detalhe + thread de notas (lê ANTES de agir)
node "$JOCA_CLI" new-task "Corrigir o parser" --desc "..." --status a-definir
node "$JOCA_CLI" move <id> concluida            # a-definir|a-executar|em-execucao|concluida|arquivada
node "$JOCA_CLI" advance <id>                   # empurra uma coluna para a direita
node "$JOCA_CLI" merge <id1> <id2> --title "Tarefa única"
```

Os ids podem ser prefixos curtos (os 8 caracteres que as listagens mostram).

**Descobriste trabalho novo a meio?** Não o faças em silêncio nem alargues a tarefa actual: cria uma
tarefa (`new-task`) e menciona-a na tua nota. Mantém o quadro a ser a verdade do que falta fazer.

## Outros terminais (trabalho em conjunto)

```bash
node "$JOCA_CLI" sessions                                    # quem está aberto (o teu tem ← )
node "$JOCA_CLI" new-session "Testes" --cli codex --project <id> --prompt "corre a suite e reporta"
node "$JOCA_CLI" send <id-sessão> "podes validar o build enquanto eu escrevo os testes?"
node "$JOCA_CLI" read <id-sessão> --tail 3000                # lê o que o outro terminal produziu
```

`--cli` aceita `claude` (default), `codex`, `agy`, `opencode` — abre o terminal no CLI que fizer
sentido para o trabalho (ex.: um segundo parecer noutro modelo).

**Cuidado com loops:** não fiques a fazer `send`/`read` em ciclo à espera de resposta. Envia,
continua o teu trabalho, e lê mais tarde. Nunca mandes mensagens para ti próprio.

## Avisar o utilizador

```bash
node "$JOCA_CLI" notify "Deploy terminado — 3 testes falharam, vê o terminal Testes"
```

Vai para a inbox persistente do JOCA (sobrevive a fechar o browser). Usa para trabalho longo que
acaba quando o utilizador não está a olhar. Não uses para progresso trivial.

## Consultar

```bash
node "$JOCA_CLI" projects        # projectos ligados ao JOCA
node "$JOCA_CLI" runs --limit 20 # histórico de execuções (estado, duração, custo)
```

## Limites (não contornar)

- **Não edites o JOCA_OS nem o JOCA_Brain** a partir de um worker de tarefa a menos que a tarefa o
  peça explicitamente — mexer no motor enquanto ele te executa parte o teu próprio worker.
- **Não apagues tarefas** que não criaste; move para `arquivada` em vez disso.
- **Não abras terminais em catadupa** — cada um é um processo real e o cap é 30 no total.
- O CLI fala com `127.0.0.1`; se der erro de ligação, o JOCA_OS não está a correr — reporta e pára,
  não tentes arrancá-lo tu.

## Próximo passo (chain)

- Trabalho que exija classificação de via (skill/agente/workflow) → `task-router` (reversível, dispara sem perguntar).
- Tarefa concluída com código alterado → deixa a nota e segue o `auto-test-dispatch` normal do JOCA.

---
description: Reformula qualquer pedido num workflow medido contra uma referência real — fan-out + crítico severo + comparação cega, em loop até tu travares
argument-hint: "[o que queres] [opcional: ao nível de REFERÊNCIA] [opcional: em STACK]"
---
# /gauntlet-loop — construir contra uma referência real, em loop

Invoca a skill **gauntlet-loop**. Agnóstico de domínio. **Prompt puro** — sem harness, sem state machine,
sem scripts auxiliares.

`Read(".claude/skills/gauntlet-loop.md")` e depois:

1. **Inferir o domínio** do pedido e preencher os slots (`THING` / `REFERENCE` / `LOOK` / `TIER` /
   `AREA_1` / `AREA_2` / `CHECK` / `STACK`) a partir dos args, do cwd e do `CLAUDE.md` do projecto.
   **Uma pergunta no máximo**, e só se `THING` ou `REFERENCE` não forem inferíveis.
2. **Fixar o `CHECK`** pela tabela de perfis da skill — como é que o crítico compara às cegas neste domínio
   (screenshot · contratos lado-a-lado · diff + métricas · número medido · leitura em voz alta). Sem
   comparação falsificável, dizê-lo e propor a via normal em vez de fingir.
3. **Preencher** os três parágrafos (`LOOP_VERB` = `/loop`, `CLOSING_TAIL` = ` and ultracode`) e guardar como
   brief interno — não despejar e esperar.
4. **Correr**: fundação sequencial do que é partilhado → fan-out de `Agent()` **no mesmo turno** (cap 3-5,
   agrupados por ficheiro/área disjunta) → **crítico separado e severo** num agente próprio → comparação
   **cega** contra a referência real → corrigir → repetir.
5. Continuar até **o humano** travar. Nunca perguntar "continuo?".
6. **Não inventar** ferramentas de captura, contratos, scoreboards, ledgers de rondas nem regras de paragem.
   Não fingir a comparação: se a referência não se consegue observar, usar o substituto verificável.
7. Passos **irreversíveis** (deploy/push/migration/delete/payment/auth) continuam a levar 1 linha de
   confirmação — o loop não publica sozinho.

"compose only" → devolver só o prompt preenchido, sem executar.

⚠ O loop não acaba sozinho, por design. **Tu és o travão.**

Tarefa: $ARGUMENTS

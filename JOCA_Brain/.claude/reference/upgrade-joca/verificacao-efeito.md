# /upgrade-joca — verificação por efeito (Phase 4b)

Lido a partir de `.claude/commands/upgrade-joca.md` §Phase 4b, antes de verificar o primeiro ficheiro tocado.

Nunca se passa da Phase 4 à Phase 5 pelo relatório de quem escreveu. Numa corrida com verificação
adversarial por fora apanharam-se 4 defeitos que teriam entrado em silêncio: um agente apagou 20
linhas inteiras de um comando e não o reportou; outro escreveu um aviso factualmente falso alegando
tê-lo "verificado a correr o script". **O relatório descreve a intenção; só o disco mostra o efeito.**

Para **cada ficheiro tocado**:

```bash
grep -n "<frase exacta que foi acrescentada>" <ficheiro>   # o texto novo existe mesmo?
git diff --stat -- <ficheiro>                               # quanto entrou vs quanto saiu
git diff -- <ficheiro> | grep '^-' | grep -v '^---'         # o que foi APAGADO (deve ser só o previsto)
```

E, conforme o tipo:

| O que a alteração introduziu | Verificação |
|---|---|
| caminho de ficheiro | `ls <caminho completo>` |
| flag de CLI | `<cli> --help` e confirmar a flag na saída |
| `.js` / `.mjs` | `node --check <ficheiro>` |
| `.py` | `python3 -m py_compile <ficheiro>` |
| `.sh` | `bash -n <ficheiro>` |
| triggers de skill | ver 4b.1 |

**Checklist completo — run it for every file touched in Phase 4.** Verify by effect, never by the
report's description. An agent's summary is a lead; the disk is the evidence. Do not skip a file
because the report says the edit was small, obvious, or already checked. One real run let **4 defects
through in silence**: 20 lines deleted from `/install`, a factually false warning written into
`/learn`, a real bug hidden behind an inflated claim, and test junk left in `learnings/*.jsonl` that
`session-intake.js` then injected into every session. Reindexing an unverified change propagates it.

| # | Check | How |
|---|---|---|
| 1 | The new text is really there | `grep -n "<a literal phrase from the new text>" <file>` -- must hit. Claim without a hit = not applied |
| 2 | The edit was additive, not destructive | `git diff --stat <file>` then `git diff <file>` -- read the deletions. An "improvement" that removes more lines than it adds is a regression until proven otherwise |
| 3 | Nothing else was touched | `git status --porcelain` -- files changed but not in the Phase 4 list are unrequested edits; revert them |
| 4 | Every path introduced exists | `ls <path>` for each new file/dir reference in the text |
| 5 | Every command/flag introduced is real | `<cmd> --help` (or `command -v <cmd>`) for each new CLI/flag cited. A plausible flag that does not exist reads exactly like one that does |
| 6 | Code parses | `node --check <f.js/.mjs>` · `python -m py_compile <f.py>` (Windows: `python`) · `bash -n <f.sh>` · `php -l <f.php>` |
| 7 | Factual claims in the new text are true | For each new assertion about the toolkit's behaviour, run the check that proves it. A warning that describes behaviour the code does not have is worse than no warning |
| 8 | No test/scratch residue | `git diff` for junk lines in data files (`*.jsonl`, indexes, logs) that a trial run left behind |

**Failure handling:** any check that fails → the item is **not applied**. Revert that file
(`git checkout -- <file>` if the working tree was clean before, otherwise undo the edit surgically),
and record it as `failed -- verification` in the Phase 6 report with the check that caught it. Never
"fix it in Phase 5" -- Phase 5 only reindexes.

**In workflow mode (fan-out):** one verifier agent per batch of files, dispatched after the batch
returns. The verifier gets the file list + the claims made for each file, runs the checklist above,
and reports pass/fail **per file**. The verifier never edits and is never the same agent that wrote
the change (an author re-reading its own claim confirms its own description, not the disk).

**4b.1 Triggers novos vão para o INÍCIO da lista.** O `build-skill-index.py` guarda no máximo
`MAX_TRIGGERS` triggers por componente (constante no topo do script — ler o valor lá, não daqui) e
corta o resto; avisa com `[index] AVISO skill <x>: … descartados`, mas o aviso perde-se no meio do
output da reindexação. Acrescentar no
fim da lista do frontmatter — o que qualquer editor faz por omissão — produz uma alteração que existe
no ficheiro e **não faz nada**: as skills carregam lazy pelo índice e o termo novo nunca é
encontrado. Depois de reindexar (4c):

```bash
grep -c "<trigger novo>" memory/SKILL_INDEX.json   # 0 = inerte, ficou fora do corte
```

**Em modo backlog:** um verificador por lote, despachado **depois** do lote de escrita e **sem** ter
participado nele. Quem escreveu o código não assina o gate.

Defeito encontrado aqui = reparação nesta corrida, não item para o próximo ciclo.

**4b.9 -- o sistema, não só os ficheiros.** Todos os checks acima são **por ficheiro**. Nada em 4b
olha para o toolkit como um todo, e os três scripts de reindexação vivem na Phase 5 — que esta mesma
fase declara não ser sítio para corrigir nada ("Defeito encontrado aqui = reparação nesta corrida").
Uma corrida pode portanto acabar com **cada ficheiro verificado e o toolkit inconsistente**. É para
isso que existe o bloco de sistema da **Phase 4c** (abaixo): corre **uma vez**, depois de todos os
ficheiros terem passado 4b ou terem sido revertidos, e compara-se sempre contra o baseline da 1.0.

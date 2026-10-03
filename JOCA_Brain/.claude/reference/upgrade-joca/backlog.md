# /upgrade-joca — modo backlog (Phase 1.6)

Lido a partir de `.claude/commands/upgrade-joca.md` §1.6, acima de ~30 issues. As alíneas (a)–(e) mantêm as letras
que outros ficheiros citam (ex.: `session-intake.js` cita a 1.6(e)).

Acima de ~30 issues a Phase 1.3 ("agregar e deduplicar numa lista") e a Phase 3 (tabela para
confirmar) deixam de ser praticáveis — já se chegou a 330 issues em 101 ficheiros. Nesse caso:

**(a) Triagem por fan-out de agentes SÓ-LEITURA.** Um agente por **família de alvos** (comandos ·
rules · skills · agents · scripts · memory), 3-5 em paralelo no mesmo turno. Cada um devolve, por
issue: `estado` + prova + severidade + alvo. Brief obrigatório, além dos 4 campos habituais:

```
NÃO EDITAS NADA. Ferramentas de escrita proibidas — só Read/Grep/Glob/Bash-de-leitura.
Um triador que "aproveita e corrige" destrói a idempotência que a triagem existe para garantir,
e o resultado deixa de ser auditável (não se sabe o que era estado inicial e o que foi acção tua).
Escreve o resultado em .joca/upgrade/triagem-<familia>.md e devolve só o resumo + o path.
```

**Destino dos relatórios — nunca o scratchpad.** Corridas multi-agente longas escrevem os relatórios em
`~/.claude/joca-runs/<YYYY-MM-DD>-<tarefa>/`; o scratchpad fica para rascunhos de minutos. A triagem continua em
`.joca/upgrade/` (acima, porque é auditada e versionada com o repo); **qualquer outro relatório de agente desta
corrida** vai para o `joca-runs/`, e o caminho entra no brief de cada agente. Medido: o scratchpad da sessão
desapareceu a meio de uma corrida longa e levou os relatórios de 8 agentes — só sobreviveu o que tinha sido copiado
a tempo para fora dele.

**(b) Agregar por defeito, não por issue.** Apresentar **clusters** (mesmo defeito, mesmo alvo) na
Phase 3, não 330 linhas. Ficheiros disjuntos por cluster — dois agentes no mesmo ficheiro pisam-se.

**(c) Fatiar por severidade.** Uma corrida = uma banda (`critical`+`high`, depois `medium`+`low`).
No frontmatter de cada ficheiro coberto só em parte:

```yaml
processed: partial
upgrade_run: 2026-08-17
upgrade_covered: [critical, high]
```

Arquivar (Phase 6.3) só quando **todas** as bandas estiverem cobertas.

**(d) Caducidade — expire `medium`/`low` by age (> ~8 weeks).** `medium`/`low` com mais de ~8
semanas num toolkit que mudou entretanto já não descrevem o mesmo gap — e re-derivar o `estado` de
cada um custa uma leitura de ficheiro por corrida, para sempre. Propor arquivo por idade no gate da
Phase 3, com a lista à vista — arquivar por idade é mais honesto do que manter uma fila que nunca se
esvazia. Antes de fatiar, listar os candidatos:

```bash
find memory/feedback -maxdepth 1 -name '*.md' -mtime +56    # candidates (severity checked per file)
```

Para cada candidato cujos issues restantes sejam todos `medium`/`low`: acrescentar
`expired: <YYYY-MM-DD> — caducado por idade, não verificado` ao frontmatter e movê-lo para
`memory/feedback/archive/`. **`critical`/`high` nunca caducam** — esperam.

⚠ **A contagem de "novos" lê-se do FRONTMATTER, nunca de `find -newermt`.** Uma corrida anterior
carimba frontmatter em todos os ficheiros que tocou, logo os `mtime` saltam todos para a data dessa
corrida e o `find` devolve "todos" (medido 2026-08-20: disse 115 novos, eram 34):
```bash
grep -L '^upgrade_run:' memory/feedback/session-*.md | wc -l   # novos desde a última corrida
```

**(e) Entrada vs saída — Report intake vs throughput: the backlog must be shown converging, or shown
not to.** Backlog mode slices the queue; it does not by itself drain it. Reportar sempre: ficheiros
novos desde a última corrida (baseline 1.0) vs processados nesta. Every run measures both ends and
prints the line in Phase 6, even (especially) when the news is bad:

```bash
LAST=$(grep -rhoP '^upgrade_run: *\K\S+' memory/feedback/*.md 2>/dev/null | sort | tail -1)
ls memory/feedback/session-*.md | wc -l                            # total still pending
grep -L '^upgrade_run:' memory/feedback/session-*.md | wc -l       # NEW since last run
```

`IN: <new files since last run> · OUT: <files closed this run>`. Each `/save` session produces
1--2 new files: if `IN >= OUT` across successive runs, **say so in one line** ("the queue is not
converging: N in, M out") instead of letting backlog mode hide it behind a tidy severity slice. Se a
entrada ganhar de forma consistente, o modo backlog está a mascarar o problema, não a resolvê-lo —
dizê-lo no relatório da Phase 6.

> Measured 2026-08-17: 111 files pending, 79 `partial` since 2026-08-12, 32 never touched --
> 26 critical, 152 high, 216 medium, 87 low.

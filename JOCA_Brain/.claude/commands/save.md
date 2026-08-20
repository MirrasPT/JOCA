# /save — Guardar sessao + feedback do projecto

Corre no fim de cada sessao. Guarda estado, actualiza memoria, captura feedback do projecto e do JOCA. Zero perguntas ao utilizador — tudo inferido da sessao.

---

## PASSO 1 — Identificar projecto

Detectar directorio actual. Resolver `memory/projects/<nome>.md`.
Se nao existir, criar entrada minima com frontmatter.

---

## PASSO 2 — Guardar estado da sessao

Actualizar `memory/projects/<nome>.md`:

| Seccao | Accao |
|--------|-------|
| **Estado actual** | Substituir com descricao breve do estado presente |
| **Decisoes tomadas** | Append com data `YYYY-MM-DD` |
| **Pendente** | Substituir com lista actual |
| **Ultima sessao** | Data + resumo de 1 linha |

**⚠ Sessões concorrentes — `Edit`, nunca `Write`.** Se houver outras sessões Claude activas
(`ListAgents`), a memória do projecto tem mais do que um autor. **Reler o ficheiro imediatamente
antes de escrever** e usar sempre `Edit` cirúrgico. Um `Write` teria apagado o trabalho da outra
sessão — só se soube porque o `Edit` avisou "the file had been modified on disk". Entradas do mesmo
dia numeram-se com sufixo `(a)`/`(b)`/`(c)` para não colidirem.

**Sub-repos git (repo aninhado num sub-directório):** alguns projectos têm um repo git PRÓPRIO num subdir (ex.: `<JOCA_ROOT>` = repo `JOCA`, mas `JOCA_OS/` é repo local-only separado). Detectar sub-repos (`git -C <subdir> rev-parse --is-inside-work-tree`) e reportar pendências de commit POR repo no PASSO 8 — senão trabalho num repo aninhado fica por commitar e invisível no `git status` do repo-pai. (Fonte: JOCA 2026-06-25.)

---

## PASSO 2a-bis — PROGRESSO.md (estado partilhado por git)

Se a raiz do projecto tiver `PROGRESSO.md` (formato em
`.claude/reference/start/progresso-formato.md`):
1. Actualizar **Estado actual** (1-3 linhas) e a tabela de **Fases** se alguma mudou — sempre com a
   coluna Prova (caminho/comando), nunca so o ✅.
2. Acrescentar 1 linha ao **Diario**: `- <data> · <maquina/utilizador> · <o que aconteceu>`.
3. **Commitar junto com o resto do trabalho** — e a memoria PARTILHADA: o que nao for commitado nao
   existe para os outros colaboradores. (A memoria do Brain continua individual; as duas apontam uma
   para a outra, nao se duplicam.)
4. **Se NAO existir** e o projecto ja levou trabalho de mais do que uma sessao: cria-o com o estado
   observado (git + docs + issues), sem entrevista. E o estado partilhado; a sua ausencia e a razao
   por que o proximo colaborador pergunta o que ja esta escrito.

## PASSO 2b — Check de Conceito (projectos com regras mutáveis)

Se o projecto tiver um `CLAUDE.md` com secção `### Conceito` (comum em jogos, motores de regras, apps com domínio mutável):
1. Ler a secção `### Conceito` do `CLAUDE.md` do projecto
2. Comparar com o `memory/projects/<nome>.md` actual
3. Se houver divergência (ex.: campo mudou de 9×10 para 7×9, cartas novas adicionadas, regras alteradas) → propor actualização cirúrgica (1 linha de diff, não reescrever a secção inteira)
4. Se não houver divergência ou não existir `### Conceito`: saltar silenciosamente

---

## PASSO 2c — Checkpoint estruturado (restaurável)

Escrever um snapshot machine-readable da sessão (adaptado de gstack context-save) — restaurado pelo `/resume`. Complementa a prosa do PASSO 2, não a substitui.

```bash
printf '## Decisões desta sessão\n- <...>\n## Trabalho restante\n- <...>\n## Próxima acção\n- <...>' | node .claude/scripts/joca-checkpoint.mjs save --slug <projecto> --title "<slug-curto>" --status wip
```
⚠ **`--slug <projecto>`** com o nome do PASSO 1, não o default. Sem ele o slug vem do repo do cwd e
sessões concorrentes misturam checkpoints na mesma pasta — o `latest` do `/resume` passa a devolver o
de outro projecto.
- Body = decisões desta sessão + trabalho restante + próxima acção (1 linha cada).
- `--status done` se a tarefa ficou concluída; senão `wip`.
- O helper escreve `memory/checkpoints/<slug>/<ts>.md` (frontmatter branch/ts/status), poda aos últimos 12, rename atómico.

**Decisões/aprendizagens atómicas** desta sessão (não-óbvias, reutilizáveis) → registar no Brain log (reversível, sem perguntar) — sintaxe do `joca-brain decide/learn`: ver `/learn` (fonte única).

---

## PASSO 2d — Estado que vive fora do git

Guardar a memória não serve de nada se o **conteúdo** do projecto ficar para trás. Antes de fechar:

**a) Artefacto-ponte desactualizado.** Se o `CLAUDE.md` do projecto declarar um artefacto de estado
exportável (padrão `snapshot/`, `*.sql`, `dump/`, `backup/`), comparar o `mtime` do artefacto com o do
estado vivo (volume Docker, BD local, `wp-content/uploads`). Artefacto mais velho → **re-exportar**
(reversível, sem perguntar) ou reportar como pendente **crítico** no PASSO 8.
> Caso real: uma sessão fez trabalho de conteúdo numa BD dentro de um volume Docker e nunca
> re-exportou o snapshot. 12 dias depois a outra máquina abriu um site silenciosamente velho — assets
> de Julho na pasta, BD de Junho no volume — e custou uma migração staging→local completa.

**b) Cloud-sync não é sincronização de projecto.** Uma pasta em MEGA/Drive **não** leva dotfiles
(`.git`, `.env`, `.gitignore`) nem estado de runtime (volumes, BDs). "Está no MEGA, deve estar
actualizado" é falso por omissão. Registar na memória do projecto **qual é o artefacto-ponte** entre
máquinas.

**c) A memória do Brain pode não viajar por git — CONFIRMAR, não presumir.** O que é ignorado e para
onde aponta o `origin` **varia por instalação** (clone público vs privado, `.gitignore` editado à
mão). Não tomar nenhuma das duas coisas como facto: medir, em 2 comandos, antes de decidir.

```bash
git remote -v                                    # o origin daqui é público ou privado?
for p in memory/projects/x.md memory/feedback/x.md memory/decisions/x.md \
         memory/learnings/x.md memory/knowledge/x.md memory/checkpoints/x.md; do
  printf '%-32s ' "$p"; git check-ignore -v "$p" || echo 'NAO IGNORADO'
done
```
⚠ Testar um **ficheiro dentro** da pasta, não a pasta: um padrão `memory/projects/*` ignora o
conteúdo e `git check-ignore memory/projects` devolve **nada** — parece não estar ignorado e está.
⚠ Há **excepções por negação** (`!memory/projects/JOCA.md`): "a pasta está ignorada" não implica que
todos os ficheiros lá dentro estejam.

Leitura do resultado:
| Medição | Consequência |
|---|---|
| Ignorado | Commitar `memory/` não leva nada a lado nenhum → travessia por **`/sync-brain`** (pasta-ponte) |
| Não ignorado + `origin` **privado** | A memória viaja por git → basta commit+push; dizê-lo no PASSO 8 |
| Não ignorado + `origin` **público** | ⚠ **Pendente crítico**: memória de projectos privados a caminho de um repo público — parar e reportar antes de qualquer `git add` |

Se a sessão produziu decisões/checkpoints que a outra máquina precisa, dizê-lo no PASSO 8 com a via
que a medição indicou (`/sync-brain` ou push).

> Foi um facto cravado que criou este defeito: a versão anterior deste passo afirmava "estão todos no
> `.gitignore`" e "o `origin` daqui é o público". Numa instalação de produção as duas eram falsas.

**d) Um aviso na documentação não é um fix.** Se estiveres a escrever "⚠ não corras X", regista-o
também como **pendente de correcção** — um `⚠ não corras npm test` sobreviveu semanas a esconder um
defeito de perda de dados (os testes faziam `fs.rmSync` sobre o `DATA_DIR` real e apagavam
notificações e chat).

---

## PASSO 3 — Feedback do projecto (inline, auto-extract)

Analisar a conversa e extrair aprendizagens com impacto em sessoes futuras:

### A. Terminologia clarificada
Expressoes que causaram ambiguidade, com definicao correcta.

### B. Regras e preferencias descobertas
Constraints ou comportamentos que se revelaram importantes.

### C. Limitacoes de ferramentas
Limitacoes documentaveis de modelos, MCPs, ou APIs que afectaram o resultado.

### D. Templates ou formatos validados
Estruturas testadas e aprovadas durante a sessao.

### E. Correccoes de workflow
Passos do processo do projecto que foram corrigidos ou melhorados.

**Destinos:**
- Glossarios, regras, templates, limitacoes → append cirurgico ao `CLAUDE.md` do projecto (seccao relevante)
- Contexto estrutural novo → append a `memory/projects/<nome>.md`

**Regra:** so escrever o que a sessao trouxe de novo. Edicoes cirurgicas — nao reescrever ficheiros inteiros. Se nao ha nada relevante, saltar este passo silenciosamente.

**Regra de validade — receitas e estado vivo.** Ao registar uma receita de comando (deploy, rsync,
FTP, invocação de CLI), guardar **as condições em que foi validada**: nº de casos, tamanho/tipo de
ficheiro, versão da ferramenta, data. Amostra única marca-se `validado 1×`. Uma receita de FTP
generalizada a partir de um só ficheiro grande foi seguida como facto e partiu um site. O mesmo vale
para afirmações sobre estado vivo (contagens, IDs, credenciais): datar e marcar como perecível — o
`/resume` (2c) lista-as para revalidação.

---

## PASSO 4 — Feedback do JOCA (auto-extract, alimenta /upgrade-joca)

Verificar se a sessao revelou gaps no toolkit JOCA:

| Categoria | Exemplos |
|-----------|----------|
| `workflow-gap` | Passo em falta num processo que causou retrabalho |
| `doc-gap` | Skill/comando documentado diferente do que realmente faz |
| `missing-skill` | Skill ou comando que devia existir e nao existe |
| `skill-improvement` | Skill existente que precisa de melhorias |
| `tool-reliability` | MCP ou ferramenta que falhou, timeout, bloqueado |
| `discovery-gap` | Info que devia ser pedida upfront mas nao foi |
| `command-improvement` | Comando existente que precisa de ajuste |

Se encontrar items, escrever `memory/feedback/session-<YYYY-MM-DD>-<HH-MM>.md` com frontmatter:

```yaml
---
type: feedback-joca
source: auto-extracted-by-save
session_date: <YYYY-MM-DD>
project: <nome>
---
```

Cada entry com: `**Categoria:** ... | **Severidade:** critical/high/medium/low | **Descricao:** ... | **Componente afectado:** ... | **Fix sugerido:** ...`

Se nao ha nada relevante, nao criar ficheiro. Nunca perguntar ao utilizador.

---

## PASSO 5 — Knowledge graphs (opcional, nao bloqueante)

```bash
# Interpretador: Windows usa `python` (o `python3` e o stub vazio da Store); macOS/Linux usam `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
# Tentar rebuild — se graphify nao disponivel, saltar silenciosamente
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path-projecto>'))" 2>/dev/null || true
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || true
```

Nota: usar sempre API Python directamente. CLI `graphify` tem bugs conhecidos.
Nota: o scan exclui `vendor/`, `node_modules/`, `storage/`, `out/`, `public/` por omissao (evitar dezenas de milhar de nos de ruido).

---

## PASSO 6 — Reindexar o toolkit (se o JOCA foi alterado)

Só corre se ficheiros em `.claude/skills/`, `.claude/agents/` ou `.claude/commands/` foram modificados nesta sessao.

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null || true
```

Se foram **adicionadas, renomeadas ou removidas** skills/agents/comandos, o inventario derivado fica a mentir. Realinhar **agora**, nao noutro comando:

```bash
python .claude/scripts/build-skill-index.py    # macOS/Linux: python3 — regenera memory/SKILL_INDEX.json
node   .claude/scripts/joca-doctor.mjs         # apanha paths/indices mortos (exit 1 se houver ✗)
```

Depois, edicao cirurgica em `memory/INDEX.md` (contagens + a linha do componente novo) e, se for um comando novo, na tabela `## Commands` do `JOCA_Brain/CLAUDE.md`. **Um componente que nenhum indice expoe e um componente invisivel** — o matching por relevancia nunca lhe chega.

> Nota historica: isto era o antigo `/sync-questionnaires`, que auditava questionarios de formulario. Os questionarios deixaram de existir (o levantamento passou a ser conversa — ver `/start`), portanto o que sobra e reindexar, e o sitio certo e aqui.

---

## PASSO 7 — Actualizar ~/CLAUDE.md (se aplicavel)

Se a sessao trouxe informacao nova sobre o projecto (novo directorio, mudanca de stack, novo status), actualizar a tabela de projectos em `~/CLAUDE.md`.

---

## PASSO 8 — Relatorio

```
SAVE — <nome-projecto>
═══════════════════════

Estado:
  ✓ memory/projects/<nome>.md actualizado
  ✓ Decisoes: N registadas | Pendentes: N items

Feedback projecto:
  ✓ CLAUDE.md — N actualizacoes (glossario, regras, templates)
  ✓ memory/projects/<nome>.md — contexto novo adicionado
  — Sem aprendizagens novas nesta sessao

Feedback JOCA:
  ✓ memory/feedback/session-<data>.md — N items (X critical, Y high)
    → Considerar /upgrade-joca
  — Sem gaps detectados

Extras:
  [✓ Graphs actualizados]
  [✓ Bridges recompilados]
  [✓ SKILL_INDEX + INDEX.md realinhados | joca-doctor limpo]
  [✓ ~/CLAUDE.md actualizado]

Sessao guardada.
```

---

## Notas

- ZERO perguntas. Tudo inferido da sessao.
- Feedback do projecto (PASSO 3) e do JOCA (PASSO 4) sao auto-extraidos aqui — os antigos comandos `/feedback-projeto` e `/feedback-joca` foram removidos (fundidos neste `/save`).
- Se nao ha nada a guardar num passo, saltar silenciosamente — nao reportar "nada encontrado" para cada seccao vazia.

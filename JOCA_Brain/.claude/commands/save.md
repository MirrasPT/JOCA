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

**Sub-repos git (repo aninhado num sub-directório):** alguns projectos têm um repo git PRÓPRIO num subdir (ex.: `JOCA_FINAL` = repo `JOCA-OS`, mas `JOCA_OS/` é repo local-only separado). Detectar sub-repos (`git -C <subdir> rev-parse --is-inside-work-tree`) e reportar pendências de commit POR repo no PASSO 8 — senão trabalho num repo aninhado fica por commitar e invisível no `git status` do repo-pai. (Fonte: JOCA 2026-06-25.)

---

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
printf '## Decisões desta sessão\n- <...>\n## Trabalho restante\n- <...>\n## Próxima acção\n- <...>' | node .claude/scripts/joca-checkpoint.mjs save --title "<slug-curto>" --status wip
```
- Body = decisões desta sessão + trabalho restante + próxima acção (1 linha cada).
- `--status done` se a tarefa ficou concluída; senão `wip`.
- O helper escreve `memory/checkpoints/<slug>/<ts>.md` (frontmatter branch/ts/status), poda aos últimos 12, rename atómico.

**Decisões/aprendizagens atómicas** desta sessão (não-óbvias, reutilizáveis) → registar no Brain log (reversível, sem perguntar):
```bash
node .claude/scripts/joca-brain.mjs decide --text "<decisão>" --rationale "<porquê>" --source user
node .claude/scripts/joca-brain.mjs learn  --text "<lição>" --tags <a,b>
```

---

## PASSO 3 — Feedback do projecto (inline, substitui /feedback-projeto)

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

## PASSO 6 — Recompilar bridges (se JOCA alterado)

Se ficheiros em `.claude/skills/`, `.claude/agents/`, ou `.claude/commands/` foram modificados nesta sessao:

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null || true
```

Se foram **adicionadas, renomeadas ou removidas** skills/agents nesta sessao, sugerir (nao executar) `/sync-questionnaires` para realinhar os questionarios e contadores (`/install`, `/init-project`, `README.md`, `INDEX.md`) com o inventario real.

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
  [✓ ~/CLAUDE.md actualizado]

Sessao guardada.
```

---

## Notas

- ZERO perguntas. Tudo inferido da sessao.
- Feedback do projecto substitui `/feedback-projeto` — esse comando agora redireciona para aqui.
- Feedback do JOCA e auto-extraido, nao interactivo. Para feedback manual detalhado: `/feedback-joca`.
- Se nao ha nada a guardar num passo, saltar silenciosamente — nao reportar "nada encontrado" para cada seccao vazia.

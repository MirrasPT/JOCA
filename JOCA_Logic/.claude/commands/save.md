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
| **Retoma** | Bloco fixo de 4 campos (ver abaixo) |

**Bloco de retoma (obrigatorio, substitui o anterior):**
```
Next step: <accao concreta seguinte>
Files touched: <lista desta sessao>
Open decisions: <decisoes em aberto ou "nenhuma">
Verify with: <comandos de teste/verificacao>
```

**Regras de escrita (obrigatorias):**
- **NUNCA escrever credenciais em memory/** (passwords, tokens, API keys). Escrever onde encontra-las: "ver backend/.env", "ver seeder X".
- **Anti-contradicao:** antes de escrever um facto, grep ao ficheiro + `~/CLAUDE.md` por factos sobre o mesmo assunto. Conflito → UPDATE in place (git preserva o antigo). Hard rule do CLAUDE.md ganha sempre.
- **Cap de sessoes:** maximo 3 blocos de sessao por ficheiro. Ao escrever o 4º, comprimir o mais antigo para 1 linha numa seccao **Historico**. Alvo: ficheiro ≤120 linhas.

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

**Dedup:** antes de escrever, grep a `memory/feedback/` pelo mesmo issue. Se ja existe → adicionar `recorrencia: N` ao entry existente em vez de duplicar; com `recorrencia >= 2` marcar `promover: true` (o /upgrade-joca ordena estes primeiro).

Se nao ha nada relevante, nao criar ficheiro. Nunca perguntar ao utilizador.

---

## PASSO 5 — Knowledge graphs (opcional, nao bloqueante)

```bash
# Tentar rebuild — se graphify nao disponivel, saltar silenciosamente
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path-projecto>'))" 2>/dev/null || true
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || true
```

Nota: usar sempre API Python directamente. CLI `graphify` tem bugs conhecidos.

---

## PASSO 6 — Recompilar bridges (se JOCA alterado)

Se ficheiros em `.claude/skills/`, `.claude/agents/`, ou `.claude/commands/` foram modificados nesta sessao:

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null || true
```

---

## PASSO 7 — Actualizar ~/CLAUDE.md (se aplicavel)

Se a sessao trouxe informacao nova sobre o projecto (novo directorio, mudanca de stack, novo status), actualizar a tabela de projectos em `~/CLAUDE.md`.

---

## PASSO 7b — Commit da memoria (durabilidade)

```bash
cd <JOCA_Logic> && git add memory/projects/ memory/feedback/ memory/INDEX.md memory/SKILL_INDEX.json 2>/dev/null && git commit -m "memory: save <nome-projecto>" 2>/dev/null || true
```

Sem commits, a estrategia "supersede in place, git preserva historia" nao funciona. Nunca fazer push automatico.

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
  Pendentes no total: N ficheiros (mais antigo: <data>)
    → Se N >= 8 ou ha item critical: recomendar explicitamente /upgrade-joca
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

# /feedback-joca — Feedback estruturado do workflow JOCA

Analisa a sessao actual e cria relatorio estruturado de gaps no **sistema JOCA**.
Scope: o toolkit em si — skills, agentes, comandos, tools, documentacao interna.
Pode ser corrido manualmente ou e triggered implicitamente por `/save` (versao auto-extract).

---

## Categorias

| Categoria | Descricao |
|-----------|-----------|
| `workflow-gap` | Passo em falta num processo JOCA que causou retrabalho |
| `doc-gap` | Skill/comando documentado diferente do que realmente faz |
| `missing-skill` | Skill ou comando que devia existir e nao existe |
| `skill-improvement` | Skill existente que precisa de melhorias ou extensao |
| `tool-reliability` | MCP ou ferramenta que falhou, timeout, bloqueado |
| `discovery-gap` | Info que devia ser pedida upfront mas nao foi — iteracoes evitaveis |
| `command-improvement` | Comando existente que precisa de ajuste no processo ou output |

## Severidades

| Severidade | Criterio |
|------------|----------|
| `critical` | Bloqueou trabalho ou causou perda de dados/output |
| `high` | Causou retrabalho significativo (>15 min ou >3 iteracoes) |
| `medium` | Ineficiencia detectavel — retrabalho menor ou friccao |
| `low` | Melhoria nice-to-have, sem impacto imediato |

---

## O que NAO capturar

- Decisoes do projecto, assets criados, estado → `/save`
- Glossarios, templates, regras do projecto → `/save` (feedback projecto inline)
- Bugs no codigo do projecto
- **Credenciais (NUNCA):** passwords, tokens, API keys. Se relevante, escrever onde encontra-las ("ver backend/.env"), nunca o valor

---

## Processo

### 1. Rever a sessao

Percorrer a conversa. Para cada problema, classificar:
- **Categoria** (da tabela acima)
- **Severidade** (critical/high/medium/low)
- **Componente afectado** (skill, agente, comando, MCP, script)
- **Root cause** — porque aconteceu, nao so o sintoma
- **Fix sugerido** — accao especifica com ficheiro alvo

### 2. Escrever ficheiro de feedback

**Path:** `memory/feedback/session-<YYYY-MM-DD>-<HH-MM>.md`

**Frontmatter:**
```yaml
---
type: feedback-joca
source: manual
session_date: <YYYY-MM-DD>
project: <nome-projecto>
categories:
  workflow-gap: <N>
  doc-gap: <N>
  missing-skill: <N>
  skill-improvement: <N>
  tool-reliability: <N>
  discovery-gap: <N>
  command-improvement: <N>
severity_summary:
  critical: <N>
  high: <N>
  medium: <N>
  low: <N>
---
```

**Formato por issue:**

```markdown
## N. <titulo do issue>

| Campo | Valor |
|-------|-------|
| **Categoria** | `<categoria>` |
| **Severidade** | `<severidade>` |
| **Componente** | `<ficheiro ou componente afectado>` |

**Problema:** O que aconteceu concretamente.

**Root cause:** Porque — falta de doc? pergunta nao feita? skill inexistente?

**Fix sugerido:** Accao especifica.
Ficheiro alvo: `<path relativo dentro de JOCA>`
```

### 3. Tabela resumo (no fim do ficheiro)

```markdown
## Resumo

| # | Categoria | Severidade | Componente | Accao |
|---|-----------|------------|------------|-------|
| 1 | workflow-gap | high | .claude/skills/X.md | Adicionar seccao Y |
| 2 | ... | ... | ... | ... |
```

### 4. Contagem e recomendacao

Mostrar contagem por categoria e severidade:

```
FEEDBACK JOCA — <projecto>
══════════════════════════

Items: N total
  workflow-gap: X | doc-gap: Y | missing-skill: Z | ...

Severidade:
  critical: A | high: B | medium: C | low: D

→ /upgrade-joca recomendado (A critical + B high items pendentes)
```

Se ha items critical ou high: sugerir explicitamente `/upgrade-joca`.

### 5. Oferecer fixes imediatos

Se algum fix e simples e o ficheiro esta no JOCA, perguntar:
> "Queres que resolva ja os fixes simples?"

Nao implementar sem confirmacao.

---

## Qualidade

Um bom feedback-joca tem:
- Categoria e severidade correctas por issue
- Fix especifico (ficheiro + seccao + o que mudar)
- Root cause, nao so o sintoma
- Tabela resumo pronta para `/upgrade-joca`
- Frontmatter com contagens para indexacao automatica

Um mau feedback-joca tem:
- "Melhorar a documentacao" (vago)
- Lista do que foi feito no projecto (isso e `/save`)
- Issues sem categoria ou severidade
- Fixes sem ficheiro alvo

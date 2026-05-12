# /feedback-joca — Feedback do Workflow JOCA

Analisa a sessão actual e cria um relatório de gaps no **sistema JOCA**.
Scope: o toolkit em si — skills, agentes, comandos, tools, documentação interna.

Diferença dos outros comandos:
- `/feedback-joca` → gaps do JOCA (este comando)
- `/feedback-projeto` → aprendizagens do projecto, actualizar memória e docs do projecto
- `/save` → estado da sessão: o que foi feito, decisões, pendentes

---

## O que capturar

| Tipo | Exemplos |
|------|---------|
| `workflow-gap` | Passo em falta num processo JOCA que causou retrabalho |
| `doc-gap` | Skill/comando documentado diferente do que realmente faz |
| `missing-skill` | Skill ou comando que devia existir e não existe |
| `tool-reliability` | MCP ou ferramenta que falhou, timeout, bloqueado |
| `discovery-gap` | Info que devia ser pedida upfront mas não foi → iterações evitáveis |

## O que NÃO capturar

- Decisões do projecto, assets criados, estado → `/save`
- Glossários, templates, regras do projecto → `/feedback-projeto`
- Bugs no código do projecto

---

## Processo

### 1. Rever a sessão

Percorrer a conversa. Para cada problema, perguntar:
- É um gap do JOCA ou do projecto?
- Quanto retrabalho causou?
- Tem fix específico com ficheiro alvo claro?

### 2. Perguntar ao utilizador (se sessão longa ou ambígua)

> "Há algo específico que queres capturar? O que mais falhou no processo JOCA?"

### 3. Escrever ficheiro de feedback

**Path:** `JOCA/memory/feedback/session-<projecto>-<YYYY-MM-DD>.md`

**Frontmatter:**
```
---
name: <título descritivo>
description: <uma linha>
type: feedback-joca
session: <projecto> / <tema>
date: <YYYY-MM-DD>
---
```

**Formato por issue:**

```
## N. <título do issue>

**Tipo:** <workflow-gap | doc-gap | missing-skill | tool-reliability | discovery-gap>
**Problema:** O que aconteceu concretamente.
**Root cause:** Porquê — falta de doc? pergunta não feita? skill inexistente?
**Fix:** Acção específica com ficheiro alvo.
  Exemplo: "adicionar secção X a `.claude/skills/img-gen-google.md`"
**Ficheiro a actualizar:** `.claude/skills/Z.md` | `memory/tools/W.md` | `.claude/commands/Y.md`
```

**Terminar com tabela resumo:**

```
## Resumo de acções

| # | Acção | Ficheiro |
|---|-------|----------|
| 1 | ...   | ...      |
```

### 4. Actualizar INDEX.md

Adicionar entrada em `JOCA/memory/INDEX.md` na secção `## Feedback`:
```
- [session-<nome>-<data>.md](feedback/session-<nome>-<data>.md) — <hook de uma linha>
```

### 5. Oferecer fixes imediatos

Se algum fix é simples e o ficheiro está no JOCA, perguntar:
> "Queres que resolva já os fixes simples?"

Não implementar sem confirmação.

---

## Qualidade

Um bom feedback-joca tem:
- Fix específico por issue (ficheiro + secção + o que mudar)
- Root cause, não só o sintoma
- Tabela resumo no fim — pronta para `/upgrade-joca`

Um mau feedback-joca tem:
- "Melhorar a documentação" (vago)
- Lista do que foi feito no projecto (isso é `/save`)
- Issues sem acção clara

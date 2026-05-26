---
name: feedback-joca
description: "Use when capturing workflow issues, documenting what failed in a JOCA session, or logging improvement opportunities."
triggers:
  - /feedback-joca
  - "feedback sobre o joca"
  - "o que melhorar no joca"
  - "o que correu mal nesta sessão"
---
# Skill: feedback-joca

Analisa a sessão actual e escreve um relatório de workflow para `JOCA/memory/feedback/`. O objectivo é melhorar o sistema JOCA ao longo do tempo, não documentar o projecto.

---

## Distinção crítica

| Feedback JOCA (`/feedback-joca`) | Estado projecto (`/save`) |
|----------------------------------|--------------------------|
| Ferramentas que falharam | O que foi feito |
| Documentação incorrecta | Decisões tomadas |
| Steps em falta no processo | O que fica pendente |
| Erros apanhados tarde | Assets e ficheiros criados |
| Skills/comandos que deviam existir | Stack e contexto técnico |

Se o utilizador misturar os dois — separar e enviar o estado para `/save`.

---

## Taxonomia de issues

| Tipo | Quando usar |
|------|-------------|
| `tool-reliability` | MCP ou CLI que falhou, timeout, bloqueado, não instalado |
| `doc-gap` | Comando documentado que não existe ou funciona diferente |
| `workflow-gap` | Step em falta no processo que causou retrabalho |
| `quality-miss` | Erro óbvio apanhado tarde (que o browser/linter devia ter apanhado) |
| `discovery-gap` | Informação não pedida upfront que levou a iteração desnecessária |
| `missing-skill` | Skill ou comando que devia existir e não existe |

---

## Passos

### 1. Rever a sessão

Percorrer o histórico da conversa. Para cada problema identificado, perguntar:
- Isto é um problema do sistema JOCA ou do projecto?
- Quanto tempo foi perdido por causa disto?
- Tem fix claro e accionável?

### 2. Confirmar com o utilizador (se necessário)

Se a sessão foi longa e complexa, perguntar:
> "Há algo específico que queres capturar? O que mais te irritou no processo?"

### 3. Escrever o ficheiro de feedback

**Path:** `JOCA/memory/feedback/session-<projecto>-<YYYY-MM-DD>.md`

**Formato:**

```markdown
---
name: <título descritivo>
description: <uma linha — o que está documentado aqui>
type: feedback-joca
session: <projecto> / <tema da sessão>
date: <YYYY-MM-DD>
---

# Feedback — <título>

## 1. <Issue title>

**Tipo:** <taxonomia>

**Problema:** O que aconteceu concretamente.

**Why it happened:** Root cause — falta de doc? tool broken? pergunta não feita?

**Fix:** Acção específica. Sem vaguidez ("melhorar X" não chega — "adicionar secção Y ao ficheiro Z" sim).

**Ficheiro a actualizar:** `memory/tools/X.md` · `.claude/skills/Y.md` · etc.

---

## N. <próximo issue>

...

---

## Resumo de acções

| # | Acção | Ficheiro |
|---|-------|----------|
| 1 | ... | ... |
```

### 4. Actualizar INDEX.md

Adicionar entrada em `JOCA/memory/INDEX.md` na secção `## Feedback`:

```markdown
## Feedback
- [session-<nome>-<data>.md](feedback/session-<nome>-<data>.md) — <hook de uma linha>
```

Se a secção `## Feedback` não existir: criar antes de `## Projects`.

### 5. Sugerir próximos passos (opcional)

Se os issues identificados têm fix claro e rápido (ex: corrigir um comando em `tools/graphify.md`), oferecer ao utilizador:
> "Queres que resolva os fixes agora?"

Não implementar sem confirmação.

---

## Qualidade do ficheiro

Um bom feedback-joca tem:
- Issues com **fix específico** (ficheiro + secção + o que mudar)
- **Root cause** por issue, não só o sintoma
- **Resumo de acções** no fim — fácil de copiar para uma task list

Um mau feedback-joca tem:
- "Melhorar a documentação do graphify" (vago)
- Lista de o que foi feito no projecto (isso é `/save`)
- Issues sem acção clara

---
name: feedback-joca
description: "Capturing workflow issues, documenting what failed in a JOCA session, or logging improvement opportunities. MUST be invoked when the user says: - /feedback-joca."
triggers:
  - /feedback-joca
  - "feedback sobre o joca"
  - "o que melhorar no joca"
  - "o que correu mal nesta sessão"
---
# Skill: feedback-joca

Analisa a sessao e escreve relatorio de workflow em `JOCA/memory/feedback/`. Objectivo: melhorar o JOCA, nao documentar o projecto.

---

## Distincao critica

| Feedback JOCA (`/feedback-joca`) | Estado projecto (`/save`) |
|----------------------------------|--------------------------|
| Ferramentas que falharam | O que foi feito |
| Documentacao incorrecta | Decisoes tomadas |
| Steps em falta no processo | O que fica pendente |
| Erros apanhados tarde | Assets e ficheiros criados |
| Skills/comandos que deviam existir | Stack e contexto tecnico |

Se o utilizador misturar os dois — separar e enviar estado para `/save`.

---

## Taxonomia de issues

| Tipo | Quando usar |
|------|-------------|
| `tool-reliability` | MCP ou CLI que falhou, timeout, bloqueado, nao instalado |
| `doc-gap` | Comando documentado que nao existe ou funciona diferente |
| `workflow-gap` | Step em falta que causou retrabalho |
| `quality-miss` | Erro obvio apanhado tarde (browser/linter devia ter apanhado) |
| `discovery-gap` | Informacao nao pedida upfront que levou a iteracao desnecessaria |
| `missing-skill` | Skill ou comando que devia existir e nao existe |

---

## Passos

### 1. Rever a sessao

Percorrer historico da conversa. Para cada problema:
- Problema do JOCA ou do projecto?
- Quanto tempo perdido?
- Tem fix claro e accionavel?

### 2. Confirmar com o utilizador (se necessario)

Se sessao longa e complexa:
> "Ha algo especifico que queres capturar? O que mais te irritou no processo?"

### 3. Escrever ficheiro de feedback

**Path:** `JOCA/memory/feedback/session-<projecto>-<YYYY-MM-DD>.md`

**Formato:**

```markdown
---
name: <titulo descritivo>
description: <uma linha — o que esta documentado aqui>
type: feedback-joca
session: <projecto> / <tema da sessao>
date: <YYYY-MM-DD>
---

# Feedback — <titulo>

## 1. <Issue title>

**Tipo:** <taxonomia>

**Problema:** O que aconteceu concretamente.

**Why it happened:** Root cause — falta de doc? tool broken? pergunta nao feita?

**Fix:** Accao especifica. Sem vaguidez ("melhorar X" nao chega — "adicionar seccao Y ao ficheiro Z" sim).

**Ficheiro a actualizar:** `memory/tools/X.md` · `.claude/skills/Y.md` · etc.

---

## N. <proximo issue>

...

---

## Resumo de accoes

| # | Accao | Ficheiro |
|---|-------|----------|
| 1 | ... | ... |
```

### 4. Actualizar INDEX.md

Adicionar entrada em `JOCA/memory/INDEX.md` na seccao `## Feedback`:

```markdown
## Feedback
- [session-<nome>-<data>.md](feedback/session-<nome>-<data>.md) — <hook de uma linha>
```

Se `## Feedback` nao existir: criar antes de `## Projects`.

### 5. Sugerir proximos passos (opcional)

Se os issues tem fix claro e rapido (ex: corrigir comando em `tools/graphify.md`):
> "Queres que resolva os fixes agora?"

Nao implementar sem confirmacao.

---

## Qualidade do ficheiro

Bom feedback-joca:
- Issues com **fix especifico** (ficheiro + seccao + o que mudar)
- **Root cause** por issue, nao so o sintoma
- **Resumo de accoes** no fim — facil de copiar para task list

Mau feedback-joca:
- "Melhorar a documentacao do graphify" (vago)
- Lista do que foi feito no projecto (isso e `/save`)
- Issues sem accao clara

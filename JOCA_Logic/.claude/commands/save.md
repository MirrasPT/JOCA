# /save — Guardar estado da sessão

Corre no fim de cada sessão de trabalho. Actualiza a memória do projecto e os knowledge graphs.

## Passos

### 1. Identificar projecto actual
Verificar em que pasta estamos. Encontrar `JOCA/memory/projects/<nome>.md`.

### 2. Perguntar ao utilizador (se não for óbvio)
- O que foi feito nesta sessão?
- Alguma decisão importante tomada?
- O que fica pendente?

### 3. Actualizar `JOCA/memory/projects/<nome>.md`
Actualizar as secções:
- **Estado actual** — descrição breve do estado presente
- **Decisões tomadas** — append com data
- **Pendente** — substituir com lista actual

### 4. Actualizar knowledge graphs

```bash
# Graph do projecto (directório actual do projecto)
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path-projecto>'))"

# Graph do JOCA
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
```

Nota: o CLI `graphify` tem bugs (sintaxe `graphify . --update` não existe; `graphify update <path>` falha em projectos HTML-only). Usar sempre a API Python directamente.

Ambos correm incondicionalmente no fim de cada sessão.

### 5. Auto-feedback (implícito)

Antes de fechar, capturar automaticamente:

**Feedback do projecto** — analisar a sessão e identificar:
- O que correu mal (erros, becos sem saída, repetições)
- O que correu bem (abordagens que funcionaram de primeira)
- Padrões detectados (ex: "sempre que toco em X, quebra Y")

Se encontrar algo relevante: guardar em `JOCA/memory/feedback/auto-<data>.md` com frontmatter:
```yaml
---
name: auto-feedback-<data>
type: feedback
source: auto-extracted
session_date: <YYYY-MM-DD>
---
```

**Feedback do JOCA** — verificar se alguma skill/agente:
- Foi invocado incorrectamente (trigger errado)
- Deveria ter sido invocado mas não foi
- Produziu resultado insuficiente

Se detectar: append a `JOCA/memory/feedback/joca-patterns.md` (criado se não existir).

Regra: NUNCA perguntar ao utilizador sobre feedback — extrair implicitamente da sessão. Se não houver nada relevante, não criar ficheiro.

### 6. Recompilar bridges (se JOCA alterado)

Se ficheiros em `.claude/skills/`, `.claude/agents/`, ou `.claude/commands/` foram modificados nesta sessão:

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null
```

### 7. Confirmar

```
✓ Memória actualizada — JOCA/memory/projects/<nome>.md
✓ Graph do projecto actualizado
✓ Graph JOCA actualizado
✓ Auto-feedback capturado (N padrões)
[✓ Bridges recompilados]

Sessão guardada.
```

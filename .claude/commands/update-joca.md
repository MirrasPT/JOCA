# /update-joca — Verificar e aplicar updates do JOCA oficial

Compara a instalação local com o repositório oficial e aplica updates após confirmação.

**Repositório oficial:** https://github.com/MirrasPT/JOCA

**Sentido único: GitHub → local. Nunca push, nunca commit, nunca alterar o remote.**

---

## Fase 1 — Localizar JOCA e verificar git

### 1. Localizar directório JOCA

```bash
JOCA_DIR=$(find ~ -maxdepth 6 -name "CLAUDE.md" -path "*/JOCA/CLAUDE.md" 2>/dev/null | head -1 | sed 's|/CLAUDE.md$||')
echo "JOCA: $JOCA_DIR"
```

Se não encontrar: pedir ao utilizador o path e parar.

### 2. Verificar se é repositório git com remote

```bash
cd "$JOCA_DIR"
git remote get-url origin 2>/dev/null || echo "SEM_REMOTE"
```

**Se SEM_REMOTE ou não é git:**

```bash
git init
git remote add origin https://github.com/MirrasPT/JOCA.git
```

Informar o utilizador e continuar.

---

## Fase 2 — Fetch e comparação

### 3. Fetch silencioso

```bash
cd "$JOCA_DIR"
git fetch origin 2>&1
```

Se fetch falhar (sem rede, auth, etc.): reportar erro e parar.

### 4. Verificar se há updates

```bash
git log HEAD..origin/master --oneline
```

Se output vazio → **JOCA já está actualizado.** Apresentar:

```
JOCA actualizado — nenhum update disponível.
Versão local: <hash curto> — <mensagem do último commit>
```

E parar.

### 5. Identificar ficheiros alterados

```bash
git diff --name-status HEAD..origin/master
```

Categorizar cada ficheiro alterado:

| Categoria | Paths | Acção |
|-----------|-------|-------|
| **Core** | `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `CLAUDE.md`, `README.md`, `install.md`, `CREDITOS.md` | Actualizar (safe) |
| **Pessoal** | `memory/projects/`, `memory/feedback/`, `memory/INDEX.md` | Proteger — não sobrescrever |
| **Misto** | `memory/tools/`, `.claude/settings.json` | Verificar conflito antes |

### 6. Verificar conflitos com ficheiros locais modificados

```bash
git status --short
```

Cruzar ficheiros locais modificados com os ficheiros alterados no upstream.
Se existir sobreposição: listar como potenciais conflitos.

---

## Fase 3 — Apresentar resumo

```
UPDATE DISPONÍVEL — JOCA
────────────────────────

N commits novos:
  abc1234 <mensagem>
  def5678 <mensagem>

Ficheiros core a actualizar (safe):
  M  .claude/skills/base/feedback-joca.md
  A  .claude/commands/novo-comando.md
  M  CLAUDE.md

Ficheiros pessoais protegidos (não tocados):
  memory/projects/<nome-projecto>.md
  memory/feedback/session-*.md

Conflitos potenciais (modificados local + alterados upstream):
  ! .claude/commands/resume.md  ← tens alterações locais

────────────────────────
Aplicar update? [S/n]
```

Se houver conflitos potenciais, avisar antes de confirmar:
> "Tens alterações locais em X ficheiros que também mudaram upstream. Recomendo `git stash` antes de continuar para preservar as tuas alterações."

---

## Fase 4 — Aplicar update (após confirmação)

### Opção A — Sem conflitos locais

```bash
cd "$JOCA_DIR"
git pull --ff-only origin master
```

Se `--ff-only` falhar: avançar para Opção B.

### Opção B — Com alterações locais (stash)

```bash
cd "$JOCA_DIR"
git stash push -m "update-joca backup $(date +%Y-%m-%d)"
git pull origin master
git stash pop
```

Se `stash pop` tiver conflitos: reportar quais ficheiros e instruir o utilizador a resolver manualmente.

---

## Fase 5 — Resumo final

```bash
git log --oneline -5
```

```
JOCA ACTUALIZADO
────────────────
✓ N ficheiros actualizados
  Versão: <hash> — <mensagem do commit mais recente>

Ficheiros actualizados:
- .claude/skills/...
- .claude/commands/...

Próximo:
→ Rever alterações: git diff HEAD~N HEAD
→ Se usas graphify: python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
```

---

## Regras

- Sentido único: só recebe do GitHub, nunca envia — zero `git push`, zero `git commit`
- Nunca sobrescrever `memory/projects/` ou `memory/feedback/` — são dados pessoais
- Nunca fazer reset destrutivo (`--hard`, `checkout .`, `clean -f`)
- Se o pull criar conflitos: parar e reportar, não tentar resolver automaticamente
- Informar sempre o utilizador antes de qualquer operação git que altere ficheiros locais

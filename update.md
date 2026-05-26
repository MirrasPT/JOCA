# JOCA — Update

Actualiza o JOCA a partir do repositório oficial. Lê este ficheiro e segue as instruções.

**Repositório oficial:** https://github.com/MirrasPT/JOCA.git

**Sentido único: GitHub → local. Nunca push, nunca commit, nunca alterar o remote.**

---

## Passo 1 — Localizar JOCA

**macOS/Linux:**
```bash
JOCA_DIR=$(find ~ -maxdepth 6 -name "CLAUDE.md" -path "*/JOCA/CLAUDE.md" 2>/dev/null | head -1 | sed 's|/CLAUDE.md$||')
echo "JOCA: $JOCA_DIR"
```

**Windows (PowerShell):**
```powershell
$jocaLogic = Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_Logic" -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$jocaDir = Split-Path $jocaLogic
Write-Output "JOCA: $jocaDir"
```

Se não encontrar: pedir ao utilizador o path.

---

## Passo 2 — Verificar git remote

```bash
cd "$JOCA_DIR"
git remote get-url origin 2>/dev/null || echo "SEM_REMOTE"
```

**Se SEM_REMOTE ou não é git:**
```bash
git init
git remote add origin https://github.com/MirrasPT/JOCA.git
```

---

## Passo 3 — Fetch e comparação

```bash
git fetch origin 2>&1
git log HEAD..origin/master --oneline
```

Se output vazio → **JOCA já está actualizado.** Parar.

```bash
git diff --name-status HEAD..origin/master
```

Categorizar ficheiros:

| Categoria | Paths | Acção |
|-----------|-------|-------|
| **Core** | `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/scripts/`, `CLAUDE.md`, `README.md`, `install.md`, `update.md` | Actualizar (safe) |
| **Pessoal** | `memory/projects/`, `memory/feedback/`, `memory/INDEX.md` | **Proteger** — não sobrescrever |
| **Misto** | `memory/tools/`, `.claude/settings.json` | Verificar conflito antes |
| **Local** | Ficheiros com `origin: local` no frontmatter | **NUNCA tocar** |
| **UI** | `JOCA_UI/` | Actualizar (rebuild necessário) |

### Proteger componentes locais

```bash
grep -rl "^origin: local" .claude/skills/ .claude/agents/ .claude/commands/ 2>/dev/null
```

Estes ficheiros foram criados localmente. NUNCA sobrescrever.

---

## Passo 4 — Apresentar resumo e confirmar

```
UPDATE DISPONÍVEL — JOCA
────────────────────────

N commits novos:
  abc1234 <mensagem>
  def5678 <mensagem>

Core (safe):       [lista]
Pessoais (skip):   [lista]
Locais (skip):     [lista]
Conflitos:         [lista ou "nenhum"]
────────────────────────
Aplicar? [S/n]
```

---

## Passo 5 — Aplicar

### Sem conflitos locais:
```bash
git pull --ff-only origin master
```

### Com alterações locais:
```bash
git stash push -m "update-joca backup $(date +%Y-%m-%d)"
git pull origin master
git stash pop
```

Se `stash pop` falhar: reportar quais ficheiros e instruir resolução manual.

---

## Passo 6 — Pós-update

### Rebuild JOCA_UI (se ficheiros UI alterados):
```bash
cd JOCA_UI/backend && npm install && npm run build && cd ..
cd JOCA_UI/frontend && npm install && cd ..
```

### Actualizar StatusLine (se script alterado):
```bash
cp JOCA_Logic/.claude/scripts/statusline-command.js ~/.claude/statusline-command.js
```

### Regenerar SKILL_INDEX:
```bash
python3 JOCA_Logic/.claude/scripts/build-skill-index.py
```

### Verificar hooks cross-platform (Node.js):
Confirmar que `JOCA_Logic/.claude/settings.json` usa `node` nos hooks:
```json
"command": "node .claude/hooks/track-changes.js \"$TOOL_INPUT_FILE_PATH\""
"command": "node .claude/hooks/auto-test-dispatch.js"
```

---

## Passo 7 — Relatório

```
JOCA ACTUALIZADO
────────────────
✓ N ficheiros actualizados
  Versão: <hash> — <mensagem>
✓ JOCA_UI rebuilt (se aplicável)
✓ StatusLine actualizada (se aplicável)
✓ SKILL_INDEX regenerado

Próximo:
→ Rever alterações: git diff HEAD~N HEAD
→ Se novos comandos: /help-joca
```

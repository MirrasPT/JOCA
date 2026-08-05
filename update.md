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
$jocaLogic = Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_Brain" -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
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

**Resolver o ramo por defeito — nunca assumir `master`.** O repo usa `main`; um `origin/master`
fixo compara contra uma ref que não existe e o update falha ou reporta "já actualizado" em falso.

```bash
git fetch origin 2>&1
BASE=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main
echo "ramo: $BASE"
git log HEAD..origin/$BASE --oneline
```

Se output vazio → **JOCA já está actualizado.** Parar.

```bash
git diff --name-status HEAD..origin/$BASE
```

Categorizar ficheiros:

| Categoria | Paths | Acção |
|-----------|-------|-------|
| **Core** | `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/scripts/`, `CLAUDE.md`, `README.md`, `install.md`, `update.md` | Actualizar (safe) |
| **Pessoal** | `memory/projects/`, `memory/feedback/`, `memory/INDEX.md`, `memory/soul.md` | **Proteger** — não sobrescrever |
| **UI Data** | `JOCA_OS/data/` — `projects.json`, `project-memory.json`, `ui-settings.json` (inclui tema de marca e modelos dos gestores), `tasks.json`, `automacoes.json`, `notifications.json`, `runs.jsonl`, `room.jsonl` (histórico da Sala), `manager-chats/` | **Proteger** — dados do utilizador |
| **Misto** | `memory/tools/`, `.claude/settings.json` | Verificar conflito antes |
| **Local** | Ficheiros com `origin: local` no frontmatter | **NUNCA tocar** |
| **UI Code** | `JOCA_OS/backend/`, `JOCA_OS/frontend/` | Actualizar (rebuild necessário) |

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
git pull --ff-only origin "$BASE"
```

### Com alterações locais:
```bash
git stash push -m "update-joca backup $(date +%Y-%m-%d)"
git pull origin "$BASE"
git stash pop
```

Se `stash pop` falhar: reportar quais ficheiros e instruir resolução manual.

---

## Passo 5b — Correções pendentes

Bugs apanhados na produção **depois** do último release, que o código publicado ainda não traz. O
`CORRECOES.md` na raiz descreve cada um com o bloco exacto a substituir.

```bash
ls CORRECOES.md 2>/dev/null
```

**Se o ficheiro existir:** lê-o e aplica-o. Ele próprio traz, por correção, uma linha
`Já está aplicada?` — corre-a primeiro e salta as que já estiverem feitas (um update repetido não
pode aplicar a mesma coisa duas vezes). Se um bloco *Antes* não bater certo à letra, **não
adivinhes**: salta essa correção e diz ao dono qual falhou.

Quando **todas** derem `aplicada`, o ficheiro cumpriu o seu papel — o release seguinte já traz as
correções. Aí apaga o `CORRECOES.md` e este passo.

**Se o ficheiro não existir:** salta este passo, não há nada pendente.

---

## Passo 6 — Pós-update

### Rebuild JOCA_OS (se ficheiros UI alterados):
```bash
cd JOCA_OS/backend  && npm install && npm run build && cd ../..
cd JOCA_OS/frontend && npm install && npm run build && cd ../..
```

⚠ O `npm run build` do **frontend** não é opcional — o backend serve `frontend/dist/`, e sem ele a
interface fica na versão anterior apesar de os ficheiros novos já estarem no disco. Assets novos
(ex.: `frontend/public/brand/`) também só entram no `dist` por aqui.

⚠ **O backend corre o build compilado, sem watch.** Alterações ao backend só ganham efeito depois de
reiniciar o processo — e **reiniciar mata os agentes/terminais vivos**. Fecha o que estiveres a
correr antes:
```bash
bash JOCA_OS/stop.sh   # Windows: JOCA_OS\stop.bat
bash JOCA_OS/start.sh  # Windows: JOCA_OS\start.bat
```

### Actualizar StatusLine (se script alterado):
```bash
cp JOCA_Brain/.claude/scripts/statusline-command.js ~/.claude/statusline-command.js
```
(Há também `statusline-command.sh` para quem a tenha configurada em shell — copiar a que estiver
referida no `~/.claude/settings.json`, não as duas às cegas.)

### Regenerar SKILL_INDEX:
```bash
python3 JOCA_Brain/.claude/scripts/build-skill-index.py
```

### Verificar hooks cross-platform (Node.js):
Confirmar que `JOCA_Brain/.claude/settings.json` usa `node` nos hooks:
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
✓ JOCA_OS rebuilt (se aplicável)
✓ StatusLine actualizada (se aplicável)
✓ SKILL_INDEX regenerado

Próximo:
→ Rever alterações: git diff HEAD~N HEAD
→ Se novos comandos: /help-joca
```

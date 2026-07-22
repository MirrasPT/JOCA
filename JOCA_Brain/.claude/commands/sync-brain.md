# /sync-brain — Sincronização multi-PC

Resolve a divergência do repo JOCA entre 2+ máquinas, sincroniza os ficheiros de estado do JOCA_OS, e mantém a pasta-ponte opcional actualizada (se configurada). Zero perguntas excepto no gate do push e em conflitos genuínos fora do conjunto conhecido.

**Step 0 — obrigatório:** `Read(".claude/skills/sync-brain.md")` antes de tocar em qualquer ficheiro — define as regras de resolução por ficheiro e o porquê do `merge=binary`.

---

## FASE 1 — Localizar repo + pasta-ponte

### 1. Repo JOCA
```
git rev-parse --show-toplevel
```
Se não encontrar (`JOCA_Brain/CLAUDE.md` inexistente a partir daqui), subir directórios; se mesmo assim não encontrar, perguntar o caminho.

### 2. Pasta-ponte opcional (cloud sync entre máquinas)
Se o utilizador tiver uma pasta sincronizada por Dropbox/MEGA/Google Drive partilhada entre as máquinas para servir de fallback (ver skill), perguntar o caminho na primeira corrida e guardar a resposta (ex.: em `.claude/settings.local.json` ou equivalente) para não perguntar de novo. Se não quiser uma, saltar a FASE 5 (mirror/log) — o sync git sozinho já resolve o essencial.

### 3. JOCA_OS ao vivo?
Verificar se o backend/frontend do JOCA_OS estão a responder nas portas configuradas. Se estiverem: avisar que os `JOCA_OS/data/*.json` vão continuar a mudar durante a sincronização — perguntar se quer parar o processo antes de continuar. Não parar sozinho.

---

## FASE 2 — Fetch + avaliar divergência

```bash
git fetch origin
git rev-list --left-right --count HEAD...origin/master   # "<ahead>\t<behind>"
```

| ahead | behind | Caso |
|---|---|---|
| 0 | 0 | **Já sincronizado.** Saltar para FASE 5 (ainda regista no log, se houver pasta-ponte). |
| 0 | >0 | **Atrás só.** `git status --porcelain` — se sujo, commitar primeiro (mensagem curta); depois `git pull --ff-only origin master`. Sem conflitos possíveis (fast-forward). |
| >0 | 0 | **À frente só.** Nada para trazer — ir directo ao gate de push (FASE 4). |
| >0 | >0 | **Divergiu — caso real.** Continuar FASE 3. |

---

## FASE 3 — Resolver divergência real

1. `git status --porcelain` — se houver alterações não commitadas, commitar primeiro (mensagem curta, ex.: `chore: estado JOCA_OS <máquina> <data> (pré-merge)`). Working tree tem de ficar limpo antes do merge.
2. `git merge origin/master --no-commit --no-ff` — se `JOCA_OS/data/*.json` estiver marcado `merge=binary` no `.gitattributes`, vai parar em conflito nesses ficheiros (esperado). Ficheiros `.md` novos de um só lado entram sem conflito.
3. `node .claude/scripts/sync-brain-resolve.mjs` — resolve `automacoes.json`, `master-chat.json` (se existir), `projects.json`, `project-memory.json` pelas regras da skill (evento mais recente/completo vence; união dedupe onde aplicável; per-projecto `updatedAt` mais recente).
   - Se o script reportar **conflito genuíno** (ids que mudaram nos dois lados de forma diferente, sem tiebreak seguro) ou **ficheiros fora do conjunto conhecido**: parar, mostrar ao utilizador os ids/ficheiros exactos, não adivinhar.
4. Validar JSON de cada ficheiro resolvido (`JSON.parse`) → deve correr sem erro.
5. `git add JOCA_OS/data/*.json` + quaisquer `.md` novos do merge → `git commit` (mensagem: `merge: sync <máquina-remota> ↔ <máquina-local>`, corpo com o resumo do que cada lado trouxe e como os ficheiros de estado foram resolvidos).

---

## FASE 4 — Gate de push

1 linha de confirmação antes de `git push origin master` (irreversível/partilhado). Só depois de confirmado:
```bash
git push origin master
```
Se recusado ou adiado: reportar que o merge está feito localmente e o push fica pendente.

---

## FASE 5 — Actualizar a pasta-ponte (se configurada)

Sempre que a pasta-ponte existir, mesmo no caso "já sincronizado" (FASE 2, ahead=0/behind=0) — regista a corrida na mesma.

1. **Mirror** de `JOCA_Brain/memory/` para a pasta-ponte (rsync `-a --delete` em macOS/Linux, `robocopy /MIR` em Windows).
2. **Narrativa do último sync** — reescrever com: estado antes (ahead/behind + hashes), o que foi resolvido (ou "nada, já em sync"), hash final do merge (se houve), estado do push.
3. **Índice de sincronizações** — prepend (nunca apagar entradas antigas) de uma secção `## <data> — <máquina> — <resumo curto>`, mesmo no caso "nada a fazer".

---

## FASE 6 — Relatório final

```
SYNC-BRAIN — <máquina>
═══════════════════════

Antes:  ahead=<n> behind=<n>  (<hash-local> vs <hash-origin>)
Acção:  [já em sync | fast-forward | merge]
Conflitos resolvidos:  <lista ou "nenhum">
Commit: <hash> [| pendente]
Push:   [feito | pendente confirmação | não aplicável]

Pasta-ponte actualizada: [sim (+1 entrada no índice) | não configurada]
```

---

## Regras

- Nunca `git reset --hard` / `git checkout .` / `git clean -f` para sair de um conflito.
- Nunca escolher "ours" ou "theirs" cegamente nos `.json` — sempre pelas regras da skill (recência + completude), nunca pela ordem do merge.
- Ficheiro em conflito fora do conjunto conhecido (`automacoes.json`, `master-chat.json`, `projects.json`, `project-memory.json`) → parar e perguntar, nunca adivinhar.
- Push é sempre gate de 1 linha — merge local não.
- O índice da pasta-ponte regista **sempre** que corre, mesmo sem nada para resolver.
- Nunca fabricar o caminho da pasta-ponte se não existir — perguntar.

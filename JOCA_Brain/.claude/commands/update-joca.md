# /update-joca -- Sync local JOCA with upstream

Pull updates from the official repository and apply them safely.

**Repo:** `https://github.com/MirrasPT/JOCA.git`
**Direction:** GitHub -> local only. Never push, never commit, never alter remote.

---

## Phase 0 -- Which kind of installation is this? (GATE)

Run this **before** anything else. There are two shapes of JOCA install, and only one of them can be
updated with a pull. Getting this wrong is the failure mode this phase exists to prevent: a `merge`
between two histories that never shared a commit either refuses outright or, if forced, drags the
public template's `<JOCA_ROOT>` placeholders and depersonalised `soul.md` over a live installation.

```
cd <JOCA_DIR>                       # SEMPRE a raiz do repo (ver aviso do passo de direccao)
git remote -v                       # que remotes existem? qual deles e o publico?
git fetch --all --quiet
# nome do remote publico — DERIVA-SE, nunca se crava: nesta maquina pode ser
# `origin`, `upstream`, `publico`, …
PUB=$(git remote -v | grep -m1 'MirrasPT/JOCA\.git' | cut -f1)   # `git remote -v` separa por TAB; sem awk `$N` (o expansor de argumentos troca-os)
# ramo por omissao DESSE remote — tambem se deriva (`main` num, `master` noutro)
PUBBASE=$(git symbolic-ref --quiet --short "refs/remotes/$PUB/HEAD" 2>/dev/null | sed "s|^$PUB/||")
[ -z "$PUBBASE" ] && PUBBASE=$(git remote show "$PUB" | sed -n 's/.*HEAD branch: //p')
echo "publico: $PUB/$PUBBASE"
[ -n "$PUB" ] && git merge-base HEAD "$PUB/$PUBBASE" >/dev/null 2>&1 && echo "ANCESTOR: yes" || echo "ANCESTOR: no"
```

⚠ **`$PUB` e `$PUBBASE` sao a fonte para TODOS os comandos abaixo.** Escrever `upstream` ou `main`
a mao falha com `unknown revision` na primeira instalacao cujo remote se chame outra coisa — ja
aconteceu (o remote chamava-se `publico`). Mesmo padrao do `$BASE` da Fase 2.

| Shape | How to recognise it | What to do |
|---|---|---|
| **A — clone of the public repo** | `origin` is `MirrasPT/JOCA`, and `ANCESTOR: yes` | Continue to Phase 1. This is the normal path. |
| **B — a working install with its own history** | `origin` is some *other* repo (a private fork/working repo), the public one is a second remote (`upstream`, `publico`, …) or absent, and/or `ANCESTOR: no` | **STOP. Do not pull, do not merge.** Corre o passo de direccao abaixo e so depois o selective-checkout. |
| **C — dois remotes, porte recorrente** | shape B, mas o porte publico↔privado e o **fluxo normal** desta maquina, nao uma excepcao | Mesmo caminho do B. O porte repete-se: nao o tratar como one-shot. |

⚠ **"sem ancestral comum" nao implica "sem updates".** O publico pode ser gerado *a partir* do
privado (downstream) e mesmo assim estar a frente em arquitectura. Quem declara em dia e o passo de
direccao, nao o `merge-base`.

**Why B cannot be pulled.** A working install carries files the public repo will never have — real
memory, per-project state, `JOCA_OS/data/`, personal skills. The two histories have no common
ancestor, so git has no basis to merge them; and the public branch is a *template*, not an
installation, so importing it wholesale also imports things that must not land on a live machine.

### Passo de direccao (obrigatorio ANTES do checkout)

Um selective-checkout de uma foto **mais velha** do proprio codigo e uma regressao silenciosa: num
repo real teria reposto o `JOCA_OS/.gitignore` com `data/` ignorada (o defeito que faz as maquinas
divergirem sem aviso) e apagado as portas configuraveis do `start.bat`/`stop.bat`. Nem o `tsc` nem o
build se queixam. Portanto mede-se primeiro **o que vem de onde**.

```
cd "$(git rev-parse --show-toplevel)"          # ⚠ ver aviso abaixo
PATHS="JOCA_Brain/.claude/skills JOCA_Brain/.claude/agents JOCA_Brain/.claude/commands \
       JOCA_Brain/.claude/rules JOCA_Brain/.claude/reference \
       JOCA_OS/backend/src JOCA_OS/frontend/src JOCA_OS/cli"
git fetch "$PUB" --quiet

git diff --diff-filter=A --name-only HEAD "$PUB/$PUBBASE" -- $PATHS   # so no publico → importar
git diff --diff-filter=A --name-only "$PUB/$PUBBASE" HEAD -- $PATHS   # so aqui → NAO importar
git diff --stat HEAD "$PUB/$PUBBASE" -- $PATHS                        # conteudo que diverge
```

| Resultado | Leitura |
|---|---|
| 1ª lista vazia | Zero ficheiros exclusivos do publico → **nada a importar, parar aqui.** |
| 1ª lista com ficheiros | Ha material novo → seguir para o checkout, so desses caminhos. |
| 2ª lista com ficheiros | Sao locais. O checkout **nao** lhes toca; nao entram na lista de remocoes. |

⚠ **`.claude/rules/` e os `CLAUDE.md` de uma instalação de trabalho (shape B) NÃO vêm do público por checkout.** Podem ter
outra estrutura e outras versões (o `$PUB/$PUBBASE` pode divergir em quase todas as rules): promover o público
reverteria as regras desta instalação. Evoluem por **edição direta** aqui e
**réplica por âncora** no público (a mesma frase-âncora localizada e editada à mão em cada lado), nunca por
`git checkout "$PUB/$PUBBASE" -- <rules>` — mesmo com `rules` dentro do `$PATHS` acima, o que vier de lá
para essas pastas lê-se e porta-se à mão.

⚠ **`git log HEAD..$PUB/$PUBBASE` NAO serve como sinal de direccao.** Historias geradas a parte dao
contagens altas com zero conteudo novo — um caso real deu 9 commits "a mais" e 0 ficheiros novos.

⚠ **`git ls-tree` / `git show <ref>:<path>` / `git diff -- <path>` sao cwd-relativos ao repo LOCAL**,
mesmo para refs de outro historico: corridos de dentro de `JOCA_Brain/` o prefixo do cwd cola-se ao
pathspec e da falso-negativo. Correr sempre da raiz (`git rev-parse --show-toplevel`).

⚠ **Comparar contra a ARVORE DE TRABALHO, nao contra o commit.** `git show HEAD:<f>` ignora o que
esta em staging/working tree — uma comparacao assim deu 14 de 19 ficheiros a divergir quando so 3
divergiam mesmo (`git hash-object <f>` contra `git rev-parse "$PUB/$PUBBASE:<f>"`). Rejeita ficheiros
seguros e subestima muito o que da para trazer.

**The selective-checkout path for shape B** (only writes, never deletes — local-only files survive
untouched by construction):

**0. Check the Brain first (mandatory, before anything is copied).** Mirroring or replacing a tree
has already run over an *active* Brain decision about specific files — a TerminalPane/TerminalView
exception decided the day before — and it was only noticed at `/save`, after commit **and** push.
The decision log is the only place that record exists; the file itself looks unremarkable.

```
node .claude/scripts/joca-brain.mjs active            # active decisions (event-sourced)
node .claude/scripts/joca-brain.mjs search "<path>"   # once per path/component about to be replaced
```

Any hit naming a path you are about to overwrite → **one-line gate to the user before copying**, not
after. Same rule for any mirror/replace of a tree, not just this command.

```
git branch backup/pre-update-$(git rev-parse --short HEAD)      # 1. make it reversible FIRST
: "${PATHS:?PATHS vazio -- ABORTAR}"                            # 2. guard, ver aviso abaixo
git checkout "$PUB/$PUBBASE" -- $PATHS                          # 3. code paths ONLY
```

⚠ **O guard `${PATHS:?}` nao e decorativo: sem ele, `$PATHS` vazio troca a ARVORE INTEIRA.**
`git checkout <ref> -- ` sem pathspec **nao e erro** — o git le-o como troca de ref, entra em
**detached HEAD** e escreve o template publico por cima de tudo, com **exit 0** e sem uma unica
mensagem de aviso alem do banner de detached. `$PATHS` chega vazio com facilidade: bloco corrido
noutra shell que a do passo de direccao, `set -u` ausente, copy-paste so deste bloco. Reproduzido
num repo descartavel: antes `README.md` = conteudo local, depois `README.md` = conteudo do publico e
`git status -sb` = `## HEAD (no branch)`. Com o guard, o mesmo cenario para com exit 1 e a arvore
fica intacta. Vale para qualquer outro `checkout` que use `$PATHS` — verificar a variavel antes,
nunca confiar no exit code depois.

**2b. Verificacao pos-checkout: o checkout TRUNCA em silencio.** Passo obrigatorio, nao opcional.
Este caminho ja truncou **25 ficheiros de toolkit** sem um unico conflito, sem erro, e com `tsc`,
`eslint` e `build` os tres verdes (caiu a Phase 4b do `/upgrade-joca`, o gate de repo publico do
`/ship` e o Passo 0 da `public-release-audit` que ele chama, o banner `⚠ OBSOLETO` do `/migrate`, e 5
seccoes do `joca-doctor`). O comando ja cobria "ausente a montante"; o caso que faltava e o inverso —
**presente dos dois lados e mais pobre no publico**. Um `git checkout` que sai com 0 nao prova nada:
ele escreve a versao do outro lado por cima, feature local incluida, e nao ha marcador de conflito
porque nao ha merge.

```
# (a) rede automatica — todo o ficheiro que ENCOLHEU no checkout le-se antes de aceitar
#     numstat = <adicionadas> TAB <removidas> TAB <ficheiro>; removidas > adicionadas = perdeu mais do que ganhou
#     (sem awk com campos numerados: o expansor de argumentos do comando substitui-os)
git diff --numstat HEAD -- $PATHS | while IFS="$(printf '\t')" read -r add del f; do
  [ "$del" -gt "$add" ] 2>/dev/null && printf '%s\t%s\n' "$((del-add))" "$f"
done | sort -rn
```

```
# (b) rede curada — marcador por feature local, escrito ANTES do checkout (uma frase literal
#     por feature, nao o nome do ficheiro), verificado DEPOIS. Zero hits = feature perdida.
#     Caminhos relativos a RAIZ do repo, como o $PATHS.
cat > /tmp/marcadores.txt <<'EOF'
JOCA_Brain/.claude/commands/upgrade-joca.md|Phase 4b
JOCA_Brain/.claude/commands/ship.md|CHANGELOG
JOCA_Brain/.claude/skills/public-release-audit.md|Passo 0
EOF

while IFS='|' read -r f m; do
  grep -qF -- "$m" "$f" || echo "PERDIDO: [$m] em $f"
done < /tmp/marcadores.txt
```

⚠ **Marcadores em ASCII, e testados ANTES do checkout.** Um literal acentuado pode chegar corrompido
ao `grep -F` e dar **0 hits falso** num ficheiro onde a frase existe — o resultado le-se como feature
apagada. Duas defesas: (1) correr o `while` acima **antes** do checkout, quando todos os marcadores
_tem_ de acertar; um `PERDIDO:` nessa altura e marcador mau, nao feature perdida. (2) Antes de
aceitar qualquer 0 hits, controlo positivo: `grep` por uma frase que se sabe estar no ficheiro.
Este exemplo ja caiu na propria armadilha: o marcador `repo publico` dava `PERDIDO` porque o
`ship.md` tem a palavra com acento (e com gralha).

⚠ **Correr o build nao chega.** Foi exactamente o que se fez: os tres gates estaticos passaram e as
25 truncagens sobreviveram na mesma. Ficheiro que encolheu **le-se**, nao se compila.

**2c. Proveniencia — de quem e a truncagem.** Quando um marcador desaparece, distinguir "a resolucao
escolheu mal" de "o lado de origem ja vinha pobre" decide se se repoe a mao ou se se rejeita o
import inteiro:

```
git diff <lado-A>:<F> <merge>:<F>          # o que a resolucao tirou ao lado A
git diff <merge-base>:<F> <lado-B>:<F>     # o que o lado B ja tinha tirado sozinho
```

Segundo diff vazio → a resolucao escolheu mal (repor do backup). Segundo diff com as mesmas linhas →
o lado B ja vinha truncado (nao importar dele; corrigir a montante).

**3. Removals do not happen by themselves.** `git checkout <ref> -- <paths>` **only writes; it never
deletes.** On a release that *removes* files (one real case: −10546 lines, 22 files deleted),
following the command literally leaves the old code sitting on disk while the new routes no longer
mount it — and neither `tsc` nor the build says a word:

```
git diff --diff-filter=D --name-only HEAD upstream/main -- <the same paths>   # deleted upstream
git rm <the files you decided to drop>
```

⚠ **"absent upstream" ≠ "to be deleted".** The public repo merely *ignores* files a working install
needs (`package-lock.json`, local config); they show up in that list and must **not** be removed.
Delete only what belongs to the toolkit and was genuinely dropped in the release.

Never checkout `memory/`, `JOCA_OS/data/`, `.claude/settings.json` or `soul.md` this way — those are
the installation, not the toolkit. Local-only files under the imported code paths survive the
checkout by construction; the `git rm` step above is the one that can touch them, so read the list
before running it.

### Contagens: uma instalacao de trabalho e o publico NAO tem o mesmo inventario

Escrever num brief "157 skills / 112 agentes" com o numero da **outra** instalacao manda o agente
trabalhar contra um mapa errado (ja aconteceu: instalacao de trabalho 157/112 vs publico 145/103). O numero e
**perecivel e por instalacao** — deriva-se no destino, nunca se cita de memoria nem de uma memoria
antiga:

```
ls .claude/skills/*.md | wc -l ; ls .claude/agents/*.md | wc -l ; ls .claude/commands/*.md | wc -l
```

A divergencia e **deliberada** (o publico nao leva componentes nem estado pessoal) — nao e defeito a
corrigir, e um facto a datar. Registar na memoria do projecto com a data.

### Passo das remocoes (o checkout so escreve)

`git checkout <ref> -- <paths>` **nunca apaga**. Num release que remove ficheiros (aconteceu:
−10 546 linhas, 22 ficheiros apagados) seguir o comando a letra deixa o codigo antigo no disco com as
rotas novas a nao o montar — e nem o `tsc` nem o build se queixam.

```
git diff --diff-filter=D --name-only HEAD "$PUB/$PUBBASE" -- $PATHS   # candidatos a remover
```

⚠ **"ausente a montante" ≠ "a apagar".** Da lista tirar tudo o que o publico apenas **ignora** ou
nunca teve: `package-lock.json`, ficheiros com `origin: local` no frontmatter, e o que apareceu na
2ª lista do passo de direccao (exclusivos locais). O que sobrar, e so isso, sai por `git rm`.

**A regra em prosa nao chega — a prova e um comando.** Num caso real, **50 dos 51 ficheiros ausentes
no publico estavam apenas gitignorados la** (3 `package-lock.json` e 47 GIFs de um tema de
terceiros); seguir a lista a letra teria apagado o tema inteiro e os lockfiles. O que decide nao e a
lista de diferencas — sao **os padroes de ignore do OUTRO lado**:

```
git show "$PUB/$PUBBASE":.gitignore                                  # o da raiz
git ls-tree -r --name-only "$PUB/$PUBBASE" | grep '\.gitignore$'     # ha mais, por subpasta
```

Avaliar os candidatos contra as regras de la exige um worktree descartavel desse ref — dentro dele o
`check-ignore` ve os `.gitignore` do publico, nao os locais:

```
git worktree add --detach /tmp/pub "$PUB/$PUBBASE"
git diff --diff-filter=D --name-only HEAD "$PUB/$PUBBASE" -- $PATHS \
  | git -C /tmp/pub check-ignore --no-index -v -n --stdin
git worktree remove --force /tmp/pub
```

| Linha do output | Leitura |
|---|---|
| `.gitignore:<n>:<padrao>` + TAB + `<ficheiro>` | So **ignorado** la. **NAO sai** por `git rm`. |
| `::` + TAB + `<ficheiro>` (o `-n` mostra os que nao casam) | Nao casa nenhum padrao de la → candidato real a `git rm`. |

⚠ O `-v` diz **que ficheiro de ignore** casou. Se a origem nao for um `.gitignore` do worktree
publico (excludes globais, `core.excludesFile`), o teste nao provou nada — repetir.

`JOCA_Brain/.claude/reference/` viaja com o toolkit (templates do `/start`, playbooks, stacks) —
e codigo, nao estado. Os `PROGRESSO.md` vivem nos repos dos PROJECTOS, nunca neste — o update do
JOCA nao lhes toca por definicao.

**After ANY import from the public branch, three things must be put back** (the template ships them
neutralised, and each one fails *silently* if forgotten):

1. **Real paths** — `.claude/settings.json` ships with the literal `<JOCA_ROOT>` placeholder, and
   **with it in place no hook runs at all**.
2. **User alignment** — `memory/soul.md` ships depersonalised (`<YOUR_NAME>` template block).
3. **The executable bit** — launchers arrive mode 644 (`chmod +x JOCA_OS/start.sh`).

Then run `node .claude/scripts/joca-doctor.mjs` — it is the check that catches 1 and 3.

### Shape B, variant: porting a *range of commits* between the two repos

Selective checkout brings a snapshot. When what you want is a specific range of work that landed in
the other repo (this has been done twice — `e6dc864`, `3cded18`), the path is a patch, not a merge:

```
git -C <other-repo> format-patch <from>..<to> --stdout > /tmp/port.patch
git apply --3way --stat /tmp/port.patch     # dry look first
git apply --3way /tmp/port.patch
```

⚠ **`git apply` is atomic, but its output lies.** It prints `Applied patch to X` for every file that
landed *before* it aborts — so `git apply ... | head -40` shows a wall of successes and hides the
fatal error in the tail. **Verify by effect, never by report:** `git status` must show the expected
number of modified files (214, not 1). One port looked like it had landed and had reverted everything.

⚠ **A resolved conflict in code is not a resolved conflict until the artifact runs.** A
`build-skill-index.py` came out of a 3-way with no markers, syntactically plausible, and blew up on
first execution — `match` out of scope, two constants lost because neighbouring hunks were resolved to
opposite sides and the halves never met. Run every script/build you touched.

---

## Phase 1 -- Locate JOCA and detect platform

### 1. Detect OS

Determine the platform to use the correct shell syntax throughout.

- **Windows:** `$env:OS` contains `Windows_NT`, or `node -e "console.log(process.platform)"` returns `win32`
- **macOS/Linux:** `uname` returns `Darwin` or `Linux`

All subsequent commands use `git` (cross-platform). Avoid bash-only constructs (`find`, `sed`, `date +%F`, `grep -rl`). Use `node -e` or `python -c` one-liners for any string/file processing (Windows: `python`, not `python3` — the Store stub; try `python` first, fall back to `python3` on macOS/Linux).

### 2. Locate JOCA directory

Check these locations in order:
1. Current working directory (if it contains `JOCA_Brain/CLAUDE.md`)
2. Parent of current directory
3. `CLAUDE.md` `@memory` references or known project paths

```
git rev-parse --show-toplevel
```

If JOCA root not found: ask the user for the path and stop.

Store the resolved absolute path as `JOCA_DIR` for all subsequent operations.

### 3. Verify git repository with remote

```
cd <JOCA_DIR>
git remote get-url origin
```

**If no remote or not a git repo:**

```
git init
git remote add origin https://github.com/MirrasPT/JOCA.git
```

Inform the user and continue.

**If remote URL differs from `https://github.com/MirrasPT/JOCA.git`:** that is shape **B** — go back to Phase 0 and take the selective-checkout path. Do not "warn and proceed": proceeding is the bug.

---

## Phase 2 -- Fetch and compare

### 4. Fetch upstream

```
cd <JOCA_DIR>
git fetch origin
```

If fetch fails (no network, auth error): report the error and stop.

**Resolve the default branch — never assume `master`.** The repo's default is `main`, and a
hardcoded `origin/master` makes every step below compare against a ref that does not exist, so the
command silently reports "up to date" while updates pile up:

```
BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -z "$BASE" ] && BASE=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main
echo "branch upstream: origin/$BASE"
```

If `refs/remotes/origin/HEAD` is missing (a fresh clone with `--single-branch`), the second line
asks the remote directly. Use `origin/$BASE` everywhere below.

### 5. Check for updates

```
git log HEAD..origin/$BASE --oneline
```

If output is empty:

```
JOCA up to date -- no updates available.
Local version: <short hash> -- <latest commit message>
```

Stop here.

### 6. Identify changed files

```
git diff --name-status HEAD..origin/$BASE
```

Categorize every changed file:

| Category | Paths | Action |
|----------|-------|--------|
| **Core (safe)** | `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/rules/`, `.claude/scripts/`, `CLAUDE.md`, `README.md`, `AGENTS.md`, `GEMINI.md`, `install.md`, `CREDITOS.md` | Update |
| **UI** | `JOCA_OS/backend/`, `JOCA_OS/frontend/`, `JOCA_OS/start.sh`, `JOCA_OS/start.bat` | Update + trigger post-update rebuild |
| **Protected (NEVER touch)** | `memory/projects/`, `memory/feedback/` | Skip entirely |
| **Protected (NEVER touch)** | `memory/soul.md` | Skip -- user calibration |
| **Protected (NEVER touch)** | `JOCA_OS/data/projects.json`, `JOCA_OS/data/project-memory.json`, `JOCA_OS/data/session-snapshots.json`, `JOCA_OS/data/ui-settings.json` | Skip -- user data |
| **Merge-only** | `.claude/settings.json` | Merge new keys, preserve user hooks/permissions |
| **Mixed** | `memory/tools/`, `memory/INDEX.md` | Check conflict before applying |
| **Local-origin** | Files with `origin: local` in frontmatter | **NEVER touch** |

### 6b. Identify local-origin files

Scan for files with `origin: local` in their frontmatter (use cross-platform approach):

```
node -e "
const fs = require('fs'); const path = require('path');
const dirs = ['.claude/skills', '.claude/agents', '.claude/commands'];
const found = [];
for (const dir of dirs) {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full, {recursive:true})) {
    const fp = path.join(full, f);
    if (!fs.statSync(fp).isFile()) continue;
    const head = fs.readFileSync(fp, 'utf8').slice(0, 500);
    if (/^origin:\s*local/m.test(head)) found.push(path.relative(process.cwd(), fp));
  }
}
found.forEach(f => console.log(f));
"
```

These files were created locally via `/create-skill` or manually. If the upstream introduces a file with the same name:
1. Report the conflict to the user
2. Keep the local version
3. Suggest renaming if the user wants both

### 7. Check for local modifications that overlap with upstream

```
git status --short
```

Cross-reference locally modified files with the upstream changed files.
If overlap exists: flag as potential conflicts.

---

## Phase 3 -- Present summary

```
UPDATE AVAILABLE -- JOCA
------------------------

N new commits:
  abc1234 <message>
  def5678 <message>

Core files to update (safe):
  M  .claude/skills/create-skill.md
  A  .claude/commands/novo-comando.md
  M  CLAUDE.md

UI files to update (will trigger rebuild):
  M  JOCA_OS/backend/src/server.ts

Protected files (will NOT be touched):
  memory/projects/ (pastas <slug>/ e fichas *.md)
  memory/feedback/*.md
  memory/soul.md
  JOCA_OS/data/projects.json
  JOCA_OS/data/project-memory.json
  JOCA_OS/data/session-snapshots.json
  JOCA_OS/data/ui-settings.json

Local-origin files protected:
  .claude/skills/created-skills/minha-skill/SKILL.md
  .claude/agents/meu-agente.md

Merge-only (new keys added, your config preserved):
  .claude/settings.json

Potential conflicts (modified locally + changed upstream):
  ! .claude/commands/resume.md  -- you have local changes

------------------------
Apply update? [Y/n]
```

If potential conflicts exist, warn before confirming:
> "You have local changes in X files that also changed upstream. They will be stashed before pulling and restored after."

---

## Phase 4 -- Apply update (after confirmation)

### Protection rules (enforced before ANY git operation)

These files and directories are NEVER overwritten, deleted, or reset:

| Path | Reason |
|------|--------|
| `memory/projects/` | User project data |
| `memory/feedback/` | User feedback sessions |
| `memory/soul.md` | User personality calibration |
| `JOCA_OS/data/projects.json` | UI project registry |
| `JOCA_OS/data/project-memory.json` | UI project memory |
| `JOCA_OS/data/session-snapshots.json` | UI session history |
| `JOCA_OS/data/ui-settings.json` | UI user preferences |
| Files with `origin: local` frontmatter | User-created skills/agents/commands |
| `.claude/modelos-agentes.local.json` | Escolhas de modelo/effort por agente (repostas no 5d-bis) |

**NEVER use:** `git reset --hard`, `git checkout .`, `git clean -f`, or any destructive git command.

### Option A -- No local modifications

```
cd <JOCA_DIR>
git pull --ff-only origin "$BASE"
```
`$BASE` é o ramo resolvido na Fase 1 — nunca escrever `master` à mão aqui. O repo usa `main`, e um
`origin/master` fixo faz o pull falhar contra uma ref que não existe.

If `--ff-only` fails: proceed to Option B.

### Option B -- With local modifications (stash workflow)

```
cd <JOCA_DIR>
git stash push -m "update-joca backup"
git pull origin "$BASE"
git stash pop
```

**If `stash pop` fails (conflicts):**

1. List conflicted files:
   ```
   git diff --name-only --diff-filter=U
   ```
2. Report each conflicted file to the user
3. Instruct:
   > "These files have merge conflicts. Open each file, resolve the `<<<<<<<` / `=======` / `>>>>>>>` markers, then run `git stash drop` when done."
4. Do NOT attempt automatic resolution
5. Do NOT run `git reset`, `git checkout`, or `git clean`

### Settings.json merge (special handling)

If `.claude/settings.json` changed upstream:

1. Read the upstream version and the local version
2. Deep-merge: keep all local `hooks` and `permissions` entries
3. Add any new upstream keys that don't exist locally
4. If a hook command path changed from `.sh` to `.js` upstream: update the local path too
5. Write the merged result
6. Report what was added/changed

---

## Phase 5 -- Post-update actions

After a successful pull, run these steps based on what changed.

### 5a. JOCA_OS rebuild (if UI files changed)

Check if any `JOCA_OS/` files were in the diff:

```
git diff --name-only HEAD~N HEAD -- JOCA_OS/
```

If backend files changed:
```
cd <JOCA_DIR>/JOCA_OS/backend
npm install
rm -rf dist
npm run build
```
O `rm -rf dist` vem **antes** do build: o `build` do backend é `tsc` (`backend/package.json`), e o
`tsc` escreve por cima mas **não apaga** — o subsistema de Automações, removido na fonte, ficou em
`dist/automations/` com o build verde: código morto que o servidor já não monta, mas que parece vivo (2026-08-20).

If frontend files changed:
```
cd <JOCA_DIR>/JOCA_OS/frontend
npm install
npm run build
```
O `npm run build` não é opcional: o backend serve `frontend/dist/`, portanto sem ele a interface
continua a mostrar a versão anterior mesmo com os ficheiros novos no disco.

Assets estáticos novos (ex.: `frontend/public/brand/`) entram no `dist` por este build — se a
interface aparecer sem logos ou ícones, é sinal de que este passo foi saltado.

Report rebuild results. If `npm install` or `npm run build` fails: report the error but do not block the rest of the update.

**Windows only:** the JOCA_OS is developed and validated on macOS. If the platform detected in Phase 1 is Windows AND any `JOCA_OS/` files changed, read and activate `.claude/skills/joca-os-windows.md` after the rebuild — it re-verifies and fixes the Windows-sensitive layers (node-pty native build, PowerShell PTY, paths, statusline/Keychain, start.bat/stop.bat) in one pass. Notify: `[skill: joca-os-windows]`.

### 5b. Statusline script (if changed)

If `.claude/scripts/statusline-command.js` was in the diff:

```
node -e "
const fs = require('fs'); const path = require('path');
const src = path.join(process.cwd(), '.claude/scripts/statusline-command.js');
const home = process.env.HOME || process.env.USERPROFILE;
const dest = path.join(home, '.claude', 'statusline-command.js');
fs.mkdirSync(path.dirname(dest), {recursive: true});
fs.copyFileSync(src, dest);
console.log('Copied to ' + dest);
"
```

### 5c. Hooks verification (if hook files changed)

If any `.claude/hooks/*.js` files were in the diff:

1. Read `.claude/settings.json`
2. Verify all hook `command` values point to `.js` files, not `.sh`
3. If any hook still references a `.sh` file that now has a `.js` counterpart: update the path
4. Report changes made

### 5d. Regenerate SKILL_INDEX (always)

```
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" .claude/scripts/build-skill-index.py && break; done
```

Python-first (`python` before `python3` — the Windows Store `python3` is an empty stub). If neither works: report and skip.

### 5d-bis. Modelo dos agentes (sempre; passo opcional para o utilizador)

O update traz os agentes com o `model:`/`effort:` do upstream e desfaz as escolhas locais. Primeiro
repõem-se as escolhas já guardadas, sem perguntar (é repor o que o utilizador já decidiu):

```
node .claude/scripts/modelos-agentes.mjs --reaplicar
node .claude/scripts/modelos-agentes.mjs --tabela          # agentes NOVOS ou ainda sem escolha
```

Conflito do `stash pop` (Option B) numa linha `model:`/`effort:` → ficar com a versão do upstream; o
`--reaplicar` repõe a escolha.

Tabela vazia → nada a perguntar, segue. Com linhas → mostrar a tabela (agente · actual · sugestão ·
porquê, agrupada por sugestão) e `AskUserQuestion`:

```
question: "Há N agentes sem escolha de modelo. Aplico as sugestões da tabela?"
header: "Modelos"
options:
  - "Sim, aplicar todas"          # → --tabela --json > <scratchpad>/escolhas.json → --aplicar
  - "Alterar alguns"              # → pedir em prosa «agente: herdar|sonnet|opus|haiku · effort»;
                                  #   editar só esses no escolhas.json; aplicar o resto como sugerido
  - "Manter como está"            # → mesmas linhas com "model": "manter" → --aplicar (não muda ficheiros,
                                  #   só regista; não volta a perguntar)
  - "Saltar por agora"            # → nada muda; volta a perguntar no próximo update
```

```
node .claude/scripts/modelos-agentes.mjs --tabela --json > <scratchpad>/escolhas.json
node .claude/scripts/modelos-agentes.mjs --aplicar <scratchpad>/escolhas.json
```

A sugestão vive no próprio agente (`modelo-sugerido`/`effort-sugerido`/`porque-modelo`, campos que o
Claude Code ignora) e nunca se activa sem este sim. Agente sem sugestão sai como «manter o actual»:
«aplicar todas» não lhe muda o `model:` nem o `effort:`. A escolha fica em
`.claude/modelos-agentes.local.json` — o checkout do update não lhe toca (não está em `$PATHS`).

### 5e. New/updated skills notification (if skills changed)

If any `.claude/skills/` files were added or modified in the diff:

List them and notify the user:

```
New skills available:
  + .claude/skills/new-skill.md

Updated skills:
  ~ .claude/skills/existing-skill.md
```

---

## Phase 6 -- Final summary

```
JOCA UPDATED
------------------------

Commits applied: N
  abc1234 <message>
  def5678 <message>

Files updated: X
  M  .claude/skills/...
  A  .claude/commands/...

Files protected (not touched): Y
  memory/projects/ (user data)
  memory/soul.md (calibration)
  JOCA_OS/data/ (all user data files)
  origin:local files (Z files)

Post-update actions:
  [done] Backend rebuilt (npm install + npm run build)
  [done] Frontend deps installed
  [done] statusline-command.js copied to ~/.claude/
  [done] Hooks verified (.js paths confirmed)
  [done] SKILL_INDEX.json regenerated
  [done] Modelos dos agentes: N escolhas reaplicadas · M novas (aplicadas | mantidas | saltadas)
  [info] 2 new skills, 1 updated skill

Local version: <hash> -- <latest commit message>

Next:
  Review changes: git diff HEAD~N HEAD
  If JOCA_OS was rebuilt: restart the UI (start.bat / start.sh)
```

---

## Rules

- One direction only: GitHub -> local. Never `git push`, never `git commit`
- Nome de remote e de ramo **derivam-se sempre** (`$PUB`/`$PUBBASE` na Fase 0, `$BASE` na Fase 2).
  Nunca escrever `upstream`, `main` ou `master` a mao — falha com `unknown revision`, ou pior,
  reporta "ja actualizado" em falso
- Shape B: passo de **direccao** antes do checkout, passo das **remocoes** depois. O checkout sozinho
  nunca apaga e pode andar para tras
- NEVER overwrite `memory/projects/`, `memory/feedback/`, or `memory/soul.md`
- NEVER overwrite any file in `JOCA_OS/data/` (projects.json, project-memory.json, session-snapshots.json, ui-settings.json)
- NEVER overwrite files with `origin: local` in frontmatter
- NEVER use destructive git commands: `git reset --hard`, `git checkout .`, `git clean -f`
- `.claude/settings.json` is merge-only: preserve user hooks and permissions, add new upstream keys
- If pull creates conflicts: stop, report, instruct manual resolution
- Always inform the user before any git operation that modifies local files
- All commands must work on both Windows (PowerShell) and macOS/Linux (bash) -- use `git` and `node -e` for cross-platform operations

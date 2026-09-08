# JOCA — Update SÓ do JOCA_OS

Traz a interface (`JOCA_OS/`) do repositório público **sem tocar no `JOCA_Brain/`**. Lê este
ficheiro e segue as instruções.

**Repositório público:** https://github.com/MirrasPT/JOCA.git

**Sentido único: GitHub → local. Nunca push, nunca commit, nunca alterar o remote `origin`.**

---

## Quando usar este ficheiro em vez do `update.md`

| Queres | Ficheiro |
|---|---|
| Interface nova (terminais, dashboard, atalhos) e **manter as tuas skills/agentes/memória como estão** | **este** |
| Trazer tudo — motor e interface | `update.md` |

O caso normal de uma instalação de trabalho é **este**: o `JOCA_Brain/` de cada máquina diverge do
público de propósito (skills próprias, memória de projectos, agentes que só existem localmente), e
um update completo obriga a defender tudo isso. A interface não tem nada disso — é só código.

---

## Passo 1 — Localizar a instalação

**macOS/Linux:**
```bash
JOCA_DIR=$(find ~ -maxdepth 6 -type d -name "JOCA_OS" 2>/dev/null | head -1 | sed 's|/JOCA_OS$||')
echo "JOCA: $JOCA_DIR"
cd "$JOCA_DIR" || exit 1
```

**Windows (PowerShell):**
```powershell
$jocaOs = Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_OS" -Depth 5 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$jocaDir = Split-Path $jocaOs
Set-Location $jocaDir
```

Se houver mais do que uma instalação na máquina, **pergunta ao dono qual** — não escolhas a primeira
que aparecer.

---

## Passo 2 — Garantir acesso ao repositório público

O `origin` de uma instalação de trabalho pode ser um repo **privado** (é o caso da instalação de
produção). O público entra como remote à parte, chamado `publico`.

```bash
git remote -v
git remote get-url publico 2>/dev/null || git remote add publico https://github.com/MirrasPT/JOCA.git
git fetch publico
```

Se o `origin` já for `https://github.com/MirrasPT/JOCA.git`, usa `origin` em vez de `publico` nos
passos seguintes.

**Resolver o ramo — nunca assumir.** O repo público usa `main`; instalações privadas usam `master`.
```bash
BASE=$(git remote show publico | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main
REF="publico/$BASE"
echo "ref: $REF"
```

---

## Passo 3 — Ver o que muda, só dentro do JOCA_OS

```bash
git diff --name-status HEAD "$REF" -- JOCA_OS/
```

Se vazio → **a interface já está actualizada.** Parar.

```bash
git log HEAD.."$REF" --oneline -- JOCA_OS/
```

⚠ **Olha para a lista antes de aplicar.** Se aparecer alguma coisa fora de `JOCA_OS/`, o comando
está errado — este update não toca em mais nada.

---

## Passo 4 — ⚠ O `.gitignore` do JOCA_OS: a armadilha que engole estado

Há duas variantes desta pasta, e a diferença é invisível até ser tarde:

| Instalação | `JOCA_OS/data/` | Porquê |
|---|---|---|
| Pública / máquina única | **ignorada** | O estado é local e nunca se publica |
| Trabalho, alternada entre 2 máquinas | **versionada, de propósito** | O estado É o que se quer sincronizar |

O `JOCA_OS/.gitignore` é um ficheiro versionado **dentro** de `JOCA_OS/`, portanto o Passo 5
sobrepõe-no pela versão pública. Numa instalação do segundo tipo isso não apaga nada de imediato —
mas cada chat, ícone ou projecto **novo** deixa de viajar para a outra máquina, sem erro nenhum.
Só se dá por isso quando falta trabalho do outro lado.

Descobre em que caso estás **antes** de aplicar:
```bash
git ls-files JOCA_OS/data/ | wc -l
```
- Devolve `0` → a `data/` é ignorada. Nada a fazer, salta para o Passo 5.
- Devolve **mais do que 0** → a tua instalação versiona o estado. Guarda o ficheiro agora:
```bash
cp JOCA_OS/.gitignore /tmp/joca-os-gitignore-local
```
e repõe-no no Passo 6.

---

## Passo 5 — Aplicar

```bash
git checkout "$REF" -- JOCA_OS/
```

O que este comando faz e não faz, para não haver dúvidas:
- escreve os ficheiros de `JOCA_OS/` que existem no ref;
- **não apaga** ficheiros que só existem localmente — a tua `JOCA_OS/data/` sobrevive mesmo quando é
  ignorada no público;
- **não toca** em `JOCA_Brain/`, nem na raiz, nem em `memory/`;
- deixa as alterações **em staging** (é como o `checkout` de um path funciona). Confirma com
  `git status` e commita quando quiseres — ou não, se a tua instalação não commita.

Se tiveres alterações locais dentro de `JOCA_OS/` que queres manter, **vê-as primeiro** — este
comando escreve por cima delas:
```bash
git status --porcelain JOCA_OS/
git diff JOCA_OS/          # o que perderias
```

---

## Passo 6 — Repor o `.gitignore` local (só se o Passo 4 disse que sim)

```bash
cp /tmp/joca-os-gitignore-local JOCA_OS/.gitignore
git ls-files JOCA_OS/data/ | wc -l    # tem de continuar a devolver o mesmo número de antes
```

---

## Passo 7 — Reconstruir

```bash
cd JOCA_OS/backend  && npm install && npm run build && cd ../..
cd JOCA_OS/frontend && npm install && npm run build && cd ../..
```

⚠ O `npm run build` do **frontend** não é opcional — o backend serve `frontend/dist/`, e sem ele a
interface fica na versão anterior apesar de os ficheiros novos já estarem no disco.

⚠ O `npm install` também não: um update que traga dependências novas parte o build sem isso, e a
mensagem de erro não diz que o problema é esse.

---

## Passo 8 — Reiniciar

**Reiniciar mata os terminais e agentes que estiverem a correr.** O backend corre o build
compilado, sem watch — sem reinício, o código novo do backend não ganha efeito.

```bash
bash JOCA_OS/stop.sh    # Windows: JOCA_OS\stop.bat
bash JOCA_OS/start.sh   # Windows: JOCA_OS\start.bat
```

As conversas fechadas assim deixam de desaparecer em silêncio: ao voltar, o JOCA avisa quantas
foram fechadas e deixa ler o output que cada uma tinha. Não são retomáveis — o contexto do CLI morre
com o processo — mas o registo fica.

Se tiveres duas instalações na mesma máquina, arranca esta nas portas dela:
```bash
JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 bash JOCA_OS/start.sh
```

---

## Passo 9 — Confirmar por efeito, não pelo silêncio dos comandos

```bash
curl -s localhost:7491/runtime | head -c 200     # ou a porta que usaste
```

E **abre a interface no browser.** Um build verde prova que compila, não que funciona: confirma que
os terminais abrem, que o texto chega ao CLI, e que a dashboard carrega.

---

## Passo 10 — Relatório

```
JOCA_OS ACTUALIZADO
───────────────────
✓ N ficheiros de JOCA_OS actualizados — <hash> <mensagem>
✓ JOCA_Brain intacto (git status --porcelain JOCA_Brain/ → vazio)
✓ .gitignore local reposto  (ou: não era necessário)
✓ backend + frontend reconstruídos
✓ reiniciado e aberto no browser

Ficou em staging: git status
```

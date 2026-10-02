# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto.

## Passos

### 1. Identificar projecto actual
Determinar o **path-alvo**: o 1º argumento se dado (ex.: `/resume <YOUR_PROJECTS_DIR>\MeuProjecto`), senão o CWD.
**Placeholder não é caminho:** argumento ou `directorio*` com `<…>` (ex.: `"<por definir>"`) = não definido → o
argumento cai para o CWD, o campo sai do match, e o resumo lista `⚠ caminho por definir: <campo>`.

**Resolver PRIMEIRO por caminho (`directorio:` do frontmatter), e só se o caminho não casar é que se cai para match por nome.** Uma pasta-mãe e um subdir podem ter entradas separadas (umbrella vs sub-projecto); casar pelo nome primeiro carrega a errada.

**Memória = pasta** `memory/projects/<slug>/` (desde 2026-10-01): o frontmatter (`directorio*`, `aliases:`, `umbrella:`)
vive no `index.md`. A ficha plana antiga `memory/projects/<slug>.md` **já não se lê**; se aparecer uma, veio da outra máquina →
avisar no resumo (`⚠ FICHA PLANA ANTIGA: <slug>.md — juntar à pasta com node .claude/scripts/migrar-memoria-pastas.mjs`) e não a carregar.
Detectar: `node .claude/scripts/lib/memoria-projecto.cjs planas` (lista vazia = nada a avisar).
A resolução inteira (Prioridades 1 e 2 abaixo, realpath incluído) está num comando só —
correr este primeiro; os `grep` abaixo ficam como referência do critério:
```bash
node .claude/scripts/lib/memoria-projecto.cjs resolver "<path-alvo>"
# → { via: caminho|caminho-mae|slug|alias|null, slug, area, ficheiro, candidatos, irmas, quaseIguais, ambiguo }
```
`ambiguo: true` → listar `candidatos` e perguntar. `via: null` com `quaseIguais` → **Prioridade 2** (perguntar).
`area` preenchida (caminho `directorio_area_<a>_*` ou alias `x#<a>`) → a sessão é dessa área: ler `<slug>/<area>.md` além do index.

**Prioridade 1 — por CAMINHO** (`directorio:` == path-alvo):
```bash
# match EXACTO do path — cobre TODAS as variantes do campo e as duas formas (1 path OU lista)
ALVO="<path-alvo>"
grep -rIl -E "^directorio[a-z_]*: *\"?${ALVO}\"? *(#.*)?$|^directorio[a-z_]*: *\[.*${ALVO}[],\"]" \
     memory/projects/*/index.md 2>/dev/null
```
⚠ Um `grep` só com a 1ª forma **não casa** entradas com `directorio: [a, b]` e manda a resolução para
o fallback por nome sem motivo — o campo é lista desde que há projectos em várias máquinas.

⚠ **O campo não é só `directorio:` — é uma família, e um matcher ancorado em `^directorio:` é cego a
quase metade das memórias.** Medido numa instalação real: `directorio:` 70 · `directorio_mac:` 66 ·
`directorio_win:` 58 · `directorio_codigo_mac:` 3 · `directorio_design:` 3 · `directorio_drive:` 3,
mais `_entrega_`, `_conteudo_`, `_arquivo_`. Um `/resume` num projecto activo
devolvia **zero** com o padrão antigo e caía para o fallback por nome sem motivo; com
`^directorio[a-z_]*:` resolve para a entrada certa. O `[a-z_]*` cobre a família toda de uma vez —
incluindo `directorio_codigo_*` para os projectos cujo código e cujo design vivem em pastas
diferentes. Nesse caso, **anunciar os DOIS caminhos** no resumo (código e design/conteúdo), e
ordenar candidatas de pasta-mãe pelo `mtime` do directório de **código**, não da pasta-mãe.
⚠ Excluir `directorio_anterior_*` de um match que decida a resolução — é histórico, não estado.
⚠ **Memória absorvida usa `absorvida_directorio*`** — o `^directorio` ancorado já não a casa, e é de
propósito: a absorvida não é candidata à resolução. Não alargar o padrão para `[a-z_]*directorio`.
Encontrada por nome → carregar a que a absorveu (2g).
⚠ **O grep compara strings, não destinos.** `~/Google Drive/…` (symlink) e `~/Library/CloudStorage/GoogleDrive-<conta>/…`
são a mesma pasta e não casam. Sem match exato, repetir com os dois lados normalizados por `realpath` antes de
descer à Prioridade 2 (forma de 1 path; uma lista compara-se elemento a elemento):
```bash
A=$(realpath "<path-alvo>" 2>/dev/null)
grep -HE '^directorio[a-z_]*:' memory/projects/*/index.md 2>/dev/null | grep -v ':directorio_[a-z_]*anterior' | while IFS= read -r l; do
  f=${l%%:*}; v=${l#*: }; v=${v#\"}; v=${v%%\"*}; v=${v%% #*}
  case "$v" in "~/"*) v="$HOME/${v#\~/}";; esac
  [ -n "$A" ] && [ "$(realpath "$v" 2>/dev/null)" = "$A" ] && echo "$f"
done
```
⚠ **Entrada com `directorio_estado: quebrado`** (escrito pelo `/save` quando o `test -d` falha) não casa por
caminho: o campo aponta para uma pasta que não existe. Avisar no resumo (`⚠ directorio quebrado: <entrada>`) e
resolver por nome.
1. **Match exacto** (`directorio:` == path-alvo) → é essa a entrada. Carregar essa.
   **Se o path-alvo também for pasta-mãe** do `directorio*` de outras entradas → listá-las no resumo como
   irmãs (a sessão pode acabar a trabalhar numa delas): `grep -lE "^directorio[a-z_]*: *\"?<path-alvo>/" memory/projects/*/index.md`.
   Casou por `directorio_area_<a>_*` (pasta própria de uma área) → é a entrada `<slug>` **com a área `<a>`**.
2. **Múltiplos matches exactos** (ex.: `<nome>.md` + `<nome>-geral.md` ambos com o mesmo `directorio`) → carregar a **umbrella** primeiro (a que tem `-geral` no nome, ou a de descrição mais abrangente) e listar as irmãs.
3. **Path-alvo é pasta-MÃE de entradas** (nenhum match exacto, mas há entradas cujo `directorio` começa por `<path-alvo>`) → listar todas e apresentar a umbrella se existir, não uma só sub-entrada.
   **Repos irmãos: `rev-parse` por CADA sub-dir declarado**, não só na pasta carregada — um irmão sem
   `.git` passa despercebido (o 2b corre numa pasta só):
   `for d in "<sub-dir-1>" "<sub-dir-2>"; do printf '%s: ' "$d"; git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "SEM GIT"; done`
   **README da pasta-mãe ≠ remotes reais:** comparar o `git -C <sub> remote get-url origin` de cada sub-repo com
   o que o `README.md` da pasta-mãe declara (`grep -nE "github.com|gitlab" README.md`); divergência →
   `⚠ README DA PASTA-MÃE DESACTUALIZADO: <sub> declara <a>, origin é <b>` no resumo.
4. **Path-alvo é SUBDIR de uma entrada** → carregar essa entrada-mãe.

**`directorio:` aceita LISTA.** Um projecto pode viver legitimamente em mais do que um path — quem
alterna entre várias máquinas (ex.: macOS + Windows) tem projectos que existem em mais do que uma. O
frontmatter suporta as duas formas:

```yaml
directorio: /Users/<user>/Projectos/meu-projecto                  # 1 path
directorio: [/Users/<user>/Projectos/meu-projecto, C:\Users\<user>\Projetos\meu-projecto]
```

A Prioridade 1 casa contra **qualquer** elemento da lista. Só se nenhum casar é que se desce ao
fallback por nome — e é aí que o aviso faz sentido.

**Prioridade 2 — por NOME, só IGUALDADE** (fallback, só se a Prioridade 1 não deu nada — ex.: o `directorio:` na memória está desactualizado/movido, ou a pasta não bate certo com nenhum `directorio`): o **basename do path-alvo** (normalizado: minúsculas, `_`/espaços→`-`) tem de ser **igual** ao nome de uma pasta, ou **igual** a um valor de `aliases:` de um index (o alias `x#<area>` resolve para a pasta + área). Se casar, carregar essa entrada **e avisar** que se resolveu por nome porque o `directorio:` não bateu.
Sem igualdade → casar o basename **cru** (sem normalizar) contra o **basename de cada
`directorio*`** (incluindo `_arquivo`, nomes antigos):
`RAW="<basename do path-alvo>"; grep -liE "^directorio[a-z_]*:.*[/\\\\]${RAW}\"? *(#.*)?$" memory/projects/*/index.md`.
Casou só por um `directorio_arquivo*` → carregar e avisar que é pasta de arquivo.
⚠ **Nada casou por igualdade → QUASE-IGUAIS: LISTAR, nunca carregar.** Prefixo, palavra comum ou nome parecido
não é critério de escolha — há famílias inteiras de memórias que partilham prefixo (caso real: resolveu para
`acme` quando o projecto era `acme-redes-sociais`). O `resolver` devolve `quaseIguais`
(Levenshtein ≤2, um nome contém o outro, ou token comum ≥5 letras; os declarados em `distinto_de:` ficam de fora):

```bash
node .claude/scripts/lib/memoria-projecto.cjs quase "<basename do path-alvo>"
```

Zero → projecto novo (sugerir `/start`). **Um ou mais** → `AskUserQuestion` com o `description` + `directorio` de cada,
opções «É o <a>» · «É o <b>» · «Projecto novo» · «Área nova de <x>». Não desempatar por ordem alfabética nem por `mtime`.
Resposta «é o <a>» → oferecer gravar o basename em `aliases:` do index de `<a>` (1 linha). «São diferentes» → `distinto_de:` nos dois.

⚠ **O conselho de correcção depende do caso:** se o path-alvo é uma *segunda máquina* legítima →
**acrescentar** o path à lista `directorio:`, nunca substituir (substituir parte a resolução na
outra máquina). Só sugerir substituição quando o path antigo já não existe.

> Exemplo (por caminho): `/resume <YOUR_PROJECTS_DIR>\MeuProjecto` → umbrella `meu-projecto-geral.md` (`directorio` == pasta-mãe). `/resume <YOUR_PROJECTS_DIR>\MeuProjecto\Plataforma` → `meu-projecto.md` (`directorio` == subdir da plataforma). Nunca o inverso.

**Nenhuma relação nem por caminho nem por nome** → sugerir correr `/start` primeiro.

**Path-alvo (ou `directorio*` resolvido) que NÃO EXISTE nesta máquina → é a 1.ª linha do resumo**
(`⚠ PROJECTO NÃO EXISTE NESTA MÁQUINA: <path>`), não uma nota a meio. Antes de o dar por ausente,
traduzir a raiz de nuvem da outra máquina e listar **um nível** da pasta traduzida:

| macOS | Windows |
|---|---|
| `~/Library/CloudStorage/GoogleDrive-<conta>/Shared drives/` | `G:\Discos partilhados\` |
| `~/Library/CloudStorage/GoogleDrive-<conta>/My Drive/` | `G:\O meu disco\` |

```bash
find ~/Library/CloudStorage -maxdepth 1 -name 'GoogleDrive-*' 2>/dev/null   # a conta montada (Mac); sem glob que parta em zsh
```
Um `directorio_estado:` na memória (`so-mac`, `ambos`, …) confirma à cabeça se o projecto devia cá estar.
> Caso real: path de Mac numa sessão Windows; a cópia `_Codigo` no Drive, com trabalho por commitar,
> só apareceu por um `ls` à mão.

### 1b. Arg opcional: `<git-remote-url>`

Se o comando for invocado com um 2º argumento (URL de remote GitHub/GitLab):
1. Verificar se o repo local tem esse remote: `git remote -v`
2. Se não tiver: `git remote add origin <url>` → `git fetch origin` → comparar working tree vs `origin/<branch-default>`
3. Reportar divergência de forma **não-destrutiva** (nunca `reset --hard` sem confirmação explícita)
4. Se tiver mas apontar para URL diferente: reportar conflito, não alterar automaticamente

### 2. Ler contexto do projecto
Ler a **entrada resolvida no passo 1** — estado actual, decisões tomadas, pendentes. Se for uma umbrella, seguir os `[[links]]` para as sub-entradas relevantes ao que o utilizador for fazer (não despejar todas de uma vez).
**Regras de leitura (norma):**
- **`/resume` lê só o `index.md`** (estado global + mini-estado das áreas + lista de ficheiros). Áreas, fixos e
  `arquivo.md` **não** se carregam no `/resume`.
- **Tarefa de uma área** → `index.md` + `<area>.md` (outras áreas não). Área = igualdade com o nome ou com as palavras
  «ler:» da linha do index; 0 ou ≥2 → `AskUserQuestion` com as áreas + «área nova».
- Peça/código → + `normas.md`. Disco/caminhos → + `pastas.md`. Entrar num sistema → + `acessos.md`. Arrancar/deploy → + `config.md`.
- **`arquivo.md` só quando nada acima responde:** `grep -n "<termo>" arquivo.md` e `Read` só do intervalo, nunca o ficheiro inteiro.

**Antes do 1.º comando de diagnóstico, na pasta do projecto** (por esta ordem):
1. **Documento de retoma** — `ls docs/RETOMAR.md docs/HANDOFF.md RETOMAR.md HANDOFF.md 2>/dev/null` → se
   existir, lê-lo **antes** do disco: é a sessão anterior a dizer onde parou, mais fresco que a memória.
2. **Gotchas do projecto** — ler as secções de gotchas/armadilhas/avisos do `CLAUDE.md` e `AGENTS.md` do
   projecto e listá-las no resumo. Lidas depois do diagnóstico, já não evitam o erro que descrevem.
3. **Paths citados na memória: `ls` a cada um antes de o usar.** A memória cita ficheiros que entretanto
   mudaram de sítio; um path morto usado como facto manda o trabalho para o sítio errado.
   ```bash
   # varre TODOS os .md da pasta menos arquivo.md — o /resume continua a LER só o index; isto é só o aviso de caminhos mortos
   { find memory/projects/<projecto> -maxdepth 1 -name '*.md' ! -name arquivo.md -exec cat {} + 2>/dev/null; } \
     | grep -oE '`(/Users/|~/)[^`]+`' | tr -d '`' | sort -u | while IFS= read -r p; do
     case "$p" in "~/"*) q="$HOME/${p#\~/}";; *) q="$p";; esac
     [ -e "$q" ] || echo "NAO EXISTE: $p"
   done
   ```
   (Só apanha paths entre crases — os com espaços incluídos. Paths Windows confirmam-se na outra máquina.)

**Coerência interna da memória — assinalar, não resolver em silêncio:**
- **`## Pendente` que contradiz o corpo** (item pendente que o corpo dá por feito/fechado) → linha
  `⚠ PENDENTE CONTRADITÓRIO: <item>` no resumo; a correcção é do `/save`.
- **Pendente que depende de terceiro** («falta aprovar/publicar/enviar por X») → `⏳` por omissão, com o
  dono nomeado (`⏳ à espera de X`). Não é trabalho nosso e não entra no flow do 3c como próxima acção.
- **Vocabulário do pedido ausente da memória** — o utilizador pede algo com um termo que a memória do
  projecto nunca usa (`grep -ric "<termo>" memory/projects/<projecto>/ 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'` → 0) → sinal de dúvida de
  âmbito: perguntar em `AskUserQuestion` **antes de produzir**, não adivinhar o que o termo quer dizer.

#### 2a. Restaurar checkpoint + Brain (machine-readable)

Antes da prosa, carregar o estado estruturado (adaptado de gstack context-restore):
```bash
node .claude/scripts/joca-checkpoint.mjs latest --slug <projecto>  # snapshot: decisões/restante/próxima acção
node .claude/scripts/joca-brain.mjs active --slug <projecto>        # decisões activas (event-sourced)
```
⚠ **`--slug <projecto>` é obrigatório nos dois, com o nome resolvido no passo 1.** Sem ele o script deriva o
slug do **repo do cwd**, e duas sessões concorrentes escrevem na mesma pasta: já aconteceu o `latest`
devolver o checkpoint de outro projecto (guardei o do projecto A às 20:54, outra sessão gravou às
21:29, e a minha "próxima acção" ficou invisível ao `/resume`). O ficheiro não se perde — deixa é de
ser encontrado pelo caminho que o `/resume` usa.
Umbrella ↔ sub-entrada (`umbrella:` no frontmatter): sem checkpoints no slug pedido, o `latest` mostra o da outra ponta e avisa no stderr — ler o aviso antes de tomar a «próxima acção» como desta entrada.
- O checkpoint dá a **próxima acção** exacta da sessão anterior (restauro cross-branch).
- As decisões activas do Brain são a fonte de verdade atómica (sobre a prosa, em caso de conflito).
- Nota: o hook `session-intake` já injecta o recall (decisões+aprendizagens) no arranque; este passo é o restauro explícito + próxima-acção dentro do `/resume`.
  ⚠ **O recall do hook é do projecto do cwd, não do resolvido no passo 1** — com o alvo fora do cwd injecta as decisões de outro projecto. Não substitui o `active --slug`; as decisões activas do projecto resolvido vão **listadas no resumo**. (Caso real: 3 tags criadas contra uma decisão activa, com o `/resume` corrido a partir do `JOCA_Brain`.)
- **Cruzar as decisões activas com os `directorio*` da memória.** Uma decisão do Brain que nomeia um
  caminho diferente do `directorio*` do projecto é drift entre as duas fontes → `⚠ DECISÃO × MEMÓRIA:
  <decisão> diz <path A>, memória diz <path B>` no resumo, e confirmar no disco (`ls`) qual existe.

#### 2a-bis. Contrato de continuidade por fechar (`.joca/loop/<session_id>.json`)

A sessão anterior pode ter morrido a meio de um workflow. O contrato fica no disco e ninguém o lê —
o `/resume` carregava a prosa e dava o trabalho por parado, quando havia passos `pendente` a apontar
para ficheiros já mexidos.

Um contrato por sessão: `.joca/loop/<session_id>.json` (o id desta sessão vem na linha `[sessao]` do
arranque). Os de sessões anteriores ficam na mesma pasta; o legado `.joca/loop.json` ainda pode existir.

```bash
for f in $(find .joca/loop -maxdepth 1 -name '*.json' 2>/dev/null; ls .joca/loop.json 2>/dev/null); do test -f "$f" || continue; node -e '
const f=process.argv[1], l=require(require("path").resolve(f));
const p=(l.passos||[]).filter(s=>s.estado!=="verificado");
console.log(f+" · sessao="+(l.sessao||"(sem dono)")+" · criado="+(l.criado||"?")+" · "+(p.length?"POR FECHAR: "+p.length+" passo(s)":"fechado"));
p.forEach(s=>console.log("  ["+s.estado+"] "+(s.descricao||s.desc||s.id)));
' "$f"; done
git status --short
```

⚠ **Contrato de outra sessão não se apaga nem edita** — pode estar viva noutro terminal. Retomar
trabalho de uma sessão morta = copiar os passos para o contrato **desta** sessão; o antigo só se
remove com a sessão dona confirmadamente terminada (ou expirado). Detalhe:
`.claude/reference/sessoes-paralelas.md` § Contrato de continuidade.

**Cruzar as duas saídas:** cada passo `pendente`/`feito` contra os ficheiros sujos do `git status`.
- Passo pendente **com** ficheiros sujos correspondentes → trabalho a meio; retomar daí, e dizê-lo
  no resumo como a próxima acção.
- Passo pendente **sem** nada sujo → ou nunca começou, ou o trabalho foi commitado e o contrato
  ficou por actualizar — verificar no `git log` antes de o refazer.
- Contrato expirado (>6 h, ver `rules/chaining.md`) → **pendente nomeado no resumo final**
  (`Contrato expirado: <ficheiro> · N passo(s) por fechar`) e propor apagá-lo, não continuá-lo às
  cegas: os passos são os que existiam quando foi escrito.

#### 2a-ter. A working tree está viva? — território de outra sessão

Ficheiros sujos não são trabalho abandonado por omissão: outra sessão (ou o utilizador) pode estar a
escrever neles agora. Antes de mexer em qualquer ficheiro sujo:
```bash
git status --porcelain | cut -c4- | while IFS= read -r f; do
  [ -f "$f" ] && node -e 'const m=(Date.now()-require("fs").statSync(process.argv[1]).mtimeMs)/6e4;if(m<30)console.log("VIVO "+Math.round(m)+" min · "+process.argv[1])' "$f"
done
ps -axo pid,command | grep -F "<path-do-projecto>" | grep -v grep     # processos a correr sobre a pasta
lsof -nP -iTCP -sTCP:LISTEN | grep -iE 'node|php|python|ruby'         # servidores de dev à escuta
```
Escrita há **<30 min** ou processo/servidor de dev sobre a pasta → **não tocar**: é território de outra
sessão. Dizê-lo no resumo (`⚠ WORKING TREE VIVA: N ficheiro(s) escritos há <30 min · <processos>`) e
seguir o protocolo de `.claude/reference/sessoes-paralelas.md`. Matar ou reiniciar esses processos é
irreversível (`rules/task-intake.md`).

#### 2b. Detectar drift memória vs git

Após ler a memória do projecto, comparar com o estado real do git:
```bash
git log --oneline -5       # últimos 5 commits reais (branch actual)
git branch -a | head -20   # TODAS as branches (locais + remotas)
git log --oneline --all | head -10  # histórico de TODAS as branches
```

**Clone desactualizado — comparar com o remoto ANTES de ler o histórico local.** Sem `fetch`, um
`origin/<default>` que avançou fica invisível: o histórico local é uma fotografia com data.
```bash
git fetch --quiet origin
DEF=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
git rev-list --left-right --count HEAD...@{u} 2>/dev/null     # "<ahead>\t<behind>" face ao upstream
git rev-list --count HEAD..origin/"${DEF:-main}"               # commits do branch por omissão que não tenho
git log --format='%h %an %ad %s' --date=short HEAD..origin/"${DEF:-main}" | head -10   # quem e o quê
```
`behind > 0` (upstream ou branch por omissão) → **pendente BLOQUEANTE** no resumo: `⚠ CLONE ATRÁS
N commits de origin/<default> (autores: …) — sincronizar antes de trabalhar`. Não se edita antes.
⚠ **O default do remoto pode não ser onde se trabalha** (default `onda-0/front-agenda`, trabalho na `main` 9 commits
à frente: o 1.º cálculo deu 0). Medir também contra `origin/main`/`origin/master` quando existirem e diferirem do
default, e contra o branch de trabalho que a memória nomeia:
```bash
for r in main master "<branch-da-memória>"; do git rev-parse -q --verify "origin/$r" >/dev/null && echo "origin/$r: behind $(git rev-list --count HEAD..origin/"$r")"; done
```

**Branch e PR do disco ≠ os da memória.** A memória nomeia a branch de trabalho / o PR aberto; o disco
pode estar noutra:
```bash
git rev-parse --abbrev-ref HEAD
gh pr list --head "$(git rev-parse --abbrev-ref HEAD)" --state open --json number,title,headRefName
```
Branch diferente da memória, ou PR que a memória dá como aberto e não aparece → **pendente
BLOQUEANTE** (`⚠ BRANCH/PR ≠ MEMÓRIA: disco <b1>, memória <b2>`). Editar na branch errada mistura trabalho.
**Retomar trabalho por issue → o repo das issues é o desta pasta?** Comparar o repo de onde vêm as issues
(`gh issue view <N> --json url -q .url`, ou o URL que a memória/o pedido cita) com `git remote get-url origin`;
diferentes → `⚠ ISSUES DE <repo A>, PASTA É <repo B>` à cabeça do resumo (caso: issues de um repo pedidas noutro clone,
que não tinha a fundação).

**Branches locais vazias ou sem upstream** — listar no resumo (são lixo a limpar ou trabalho por empurrar):
```bash
git for-each-ref --format='%(refname:short) %(upstream:short)' refs/heads | while read -r b up; do
  [ -n "$up" ] || echo "sem upstream: $b · commits próprios: $(git rev-list --count origin/"${DEF:-main}".."$b" 2>/dev/null || echo '?')"
done
```
`commits próprios: 0` = branch vazia (propor apagar, com gate); `> 0` sem upstream = trabalho só neste disco.

**Repo dentro de drive de nuvem → aviso à cabeça do resumo.** O `git log` responde e o `git status`/
`git diff` penduram (o File Stream materializa a árvore inteira), e `vendor/`/`node_modules/` in-place
tornam cada comando lento ou pendurado:
```bash
case "$PWD" in *CloudStorage*|*"Google Drive"*|*MEGA*|*Dropbox*|*OneDrive*) echo "⚠ REPO EM DRIVE DE NUVEM";; esac
```
Nesse caso: `git status` em `run_in_background`, nunca em primeiro plano; e **propor mover o código para
disco local** (`~/Projetos/<nome>`) antes de qualquer comando de dependências — o Drive fica para design.
> Caso real: um clone 51/59 commits atrás passou pelo `/resume` sem aviso; noutro, o `origin/main`
> avançado por outra pessoa só apareceu no push recusado.
- **Antes de declarar trabalho "perdido/nunca committado": correr `git log --all` + `git branch -a` é Step 0 obrigatório.** Branches `backup/*`, `stash/*`, ou outra branch que não a actual escondem trabalho real após um switch de remote. Se detectar `backup/*` → `⚠ Existe branch de backup — verificar antes de reconstruir trabalho`. (Caso real: um backoffice completo estava em `backup/local-pre-dev` e foi declarado perdido.)
- Extrair a data da secção **"Última sessão"** da memória
- Se o commit mais recente for **>14 dias depois** da data de memória: alertar com `⚠ MEMÓRIA DESACTUALIZADA — último commit é X dias mais recente que a memória`
- Se houver commits com mensagens que contradizem o "Estado actual" (ex.: memória diz "backend pendente" mas há commits "feat: complete backend"): alertar e re-inferir estado a partir do git
- **Pendente que nomeia ficheiros → data do último commit de cada um:** `git log -1 --format=%ad --date=short -- <ficheiro>`.
  Ficheiro mudado **depois** da data do pendente → `⚠ PENDENTE POSSIVELMENTE FEITO: <item> (<ficheiro> mudou a <data>)`
  — ler o diff antes de o refazer (caso: «frente 4 a meio» com 5 dos 10 defeitos já commitados).

**Se a pasta não é um repo git**, tudo o que está acima colapsa **em silêncio**: os comandos devolvem
`fatal: not a git repository` e o passo não dá sinal — sem histórico, sem `git diff`, sem
`checkout --`, com o código todo lá e aparentemente saudável. Detectar antes de interpretar:
```bash
git rev-parse --is-inside-work-tree 2>/dev/null || ls -A | head   # pasta cheia + sem repo?
```
Pasta **com ficheiros** mas sem `.git` **não é trabalho perdido** — é o `.git` que desapareceu
(renomear/mover a pasta, cópia sem dotfiles, sync de cloud que não leva dotfiles). Caso real:
`site-exemplo` → `Site-Exemplo`. Fluxo:
1. **Não declarar trabalho perdido** nem reconstruir nada.
2. Localizar o repo remoto pela memória (`**Repo:**`/origin) e comparar a data do último push com os
   mtimes locais — ficheiros locais mais recentes que o push = delta por salvar:
   ```bash
   gh repo view <owner>/<repo> --json pushedAt -q .pushedAt
   ls -lt | head
   ```
3. Reportar como pendente **bloqueante** (não editar antes de restaurar), com a receita: clonar o
   repo para **outro** sítio (`gh repo clone <owner>/<repo> <tmp>`), mover só o `.git` de lá para a
   pasta original, e confirmar com `git status` — limpo == nada perdido; ficheiros modificados == é
   o delta local, rever antes de commitar.
   **Pasta em drive de nuvem → alternativa preferida:** clone de trabalho limpo em `~/Projetos/<nome>`
   (`gh repo clone <owner>/<repo> ~/Projetos/<nome>`) sem mexer na pasta do Drive, que fica só para design —
   a mesma regra do aviso «Repo dentro de drive de nuvem» acima. O delta local da pasta do Drive compara-se
   com o clone novo antes de ser dado por perdido ou por salvo.

⚠ Não confundir com o 2d (pasta **vazia**, projecto vive noutra máquina): aí clona-se para a pasta;
aqui **nunca** — um clone por cima destrói o que está no disco.

**Pasta sem git e sem repo remoto** (design, documentos, cliente) → o drift faz-se por `mtime`: comparar
a data da «Última sessão» da memória com o ficheiro mais recente das pastas activas que a memória nomeia
(`ls -lt "<pasta-activa>" | head -5`, um nível — sem `find` recursivo em nuvem, ver 2e). Disco mais
novo que a memória → `⚠ DISCO MAIS RECENTE QUE A MEMÓRIA: <ficheiro> (<data>) vs última sessão <data>`
no resumo — houve trabalho que nenhum `/save` registou.
**Scripts de build com caminhos absolutos** (`build.py`, `*.sh`, `*.bat` na pasta sem git) partem em silêncio
quando uma montagem morre (MEGA) ou uma arrumação renomeia ficheiros. Testar cada caminho citado:
```bash
grep -nhoiE "([a-z]:[\\\\/]|/Users/|~/)[^\"' )]*|[^\"' ]*MEGA[^\"' )]*" build.py *.sh *.bat 2>/dev/null | cut -d: -f2- | sort -u |
  while IFS= read -r p; do case "$p" in "~/"*) p="$HOME/${p#\~/}";; esac; test -e "$p" || echo "CAMINHO MORTO: $p"; done
```
`CAMINHO MORTO:` → **pendente bloqueante** no resumo (o build não corre até o caminho ser corrigido).

> Caso real: uma mudança de nome de pasta deixou o `.git` para trás. A pasta parecia saudável e
> editou-se lá durante uma sessão inteira sem histórico nenhum.

Nunca confiar cegamente na memória se o git divergir. Ler ficheiros-chave (ex.: `CLAUDE.md` do projecto, `package.json`) para confirmar stack/estado real.

#### 2b-bis. PROGRESSO.md — o estado partilhado

Se a pasta do projecto tiver `PROGRESSO.md` (qualquer projecto — o `/start` cria-o de raiz, o
`/save` cria-o em projectos a meio): lê-lo **antes** da
memória do Brain e mostrar a fase actual no resumo. É a versão partilhada do estado — pode ter sido
actualizado por outro colaborador ou outra máquina desde a tua última sessão, e nesse caso **ganha
ao Brain** no que toca a fases/estado do projecto (o Brain guarda o teu contexto pessoal, não o
estado canónico). Divergência entre os dois → assinalar como drift, igual ao 2b.

**E incoerência dentro do próprio `PROGRESSO.md`** — assinalar no resumo, não escolher uma das versões:
```bash
grep '^## ' PROGRESSO.md | sort | uniq -d     # secções duplicadas (ex.: dois «## Diário»)
```
Duplicado → a entrada nova costuma estar enterrada na 2.ª cópia. Tabela de ondas/fases que diz uma coisa
e secções datadas mais abaixo que dizem outra → `⚠ PROGRESSO.md INCOERENTE: <tabela> vs <secção>`.

#### 2c. Afirmações perecíveis — a memória é pista, não facto

O drift do 2b compara memória ↔ **git**. Não cobre memória ↔ **estado vivo** (BD, infra, contas), que
apodrece em silêncio e é onde mora o risco real:

- A memória dizia "prod tem 2 users (id2 <admin>, id14 <utilizadora>)". Realidade: **4 users, com IDs
  diferentes**, um deles pessoa real registada depois do go-live. Copiar dados staging→prod por
  `user_id` a partir dessa nota teria escrito por cima de um utilizador real.
- A memória e dois docs anunciavam há meses um admin de um projecto de cliente que **não existia**: a BD tinha 0
  users/0 roles. O `curl /admin/login → 200` reforçava a ilusão — a porta estava lá, faltava a chave.
- Uma receita de FTP documentada como *a* solução tinha sido validada **uma vez, com um ficheiro**.
  Falhou nos 2 maiores e partiu o site.
- **Estado que não vive em git** (modelos de IA, media gerada, datasets, exports): a memória diz
  quantos/quais, o disco diz outra coisa. Comparar o **inventário real da pasta** com o que a memória
  afirma antes de a tratar como facto — `du -sh <pasta>` + contagem por extensão (`ls | wc -l`), não
  a nota.
- **Cron / trabalho agendado:** verificar o **CAMINHO na linha do crontab** (staging vs produção — a
  mesma entrada aponta muitas vezes para o ambiente errado) e confirmar pelo **EFEITO na BD do
  ambiente-alvo**, não pela existência da entrada. `crontab -l` a listar a linha não prova que corre,
  nem que corre onde se pensa.

- **Pasta de dados da app** (`~/.<app>/`, `~/Library/Application Support/<app>/`, `%APPDATA%\<app>`):
  se a memória a declara, listar por `mtime` (`ls -lt <pasta> | head`) e ler os registos recentes — o
  estado próprio da app vive lá, não no repo, e o 2b não o vê.
- **Dados de demo com carimbo de data** (seeds, fixtures): «está tudo obsoleto/expirado» num ambiente de
  demo é quase sempre a data do seed a envelhecer, não regressão. Desconfiar antes de diagnosticar, e
  procurar na memória/seeders como se refrescam.
- **Auth dos serviços que os pendentes vão usar** — `gh auth status` e o equivalente de cada CLI em
  `memory/tools/clis.md`, **já no plano**, não à hora de executar: a auth expirada só descoberta na
  execução pára o trabalho a meio.

Marcar como **perecível** qualquer afirmação sobre estado vivo (contagens, IDs, credenciais, infra,
receitas de comando) — datada e com as condições em que foi validada ("validado 1×, ficheiro de
600 MB"). No `/resume`, listá-las como *a revalidar*, não como facto.

**`⏳` que é CONTAGEM de estado vivo mede-se, não se lista.** Correr a consulta que a produz e reportar
`documento: X · real: Y` — listar «a revalidar» deixa a contagem velha a mandar na sessão.

**Idade dos marcadores** — um `⏳` antigo não se revalida sozinho se nenhuma sessão tocar no recurso:
```bash
# todos os .md da pasta menos arquivo.md (só o aviso de idade; ler continua a ser só o index)
{ find memory/projects/<projecto> -maxdepth 1 -name '*.md' ! -name arquivo.md -exec grep -Hn '⏳(verificado' {} + 2>/dev/null; } \
  | node -e '
require("fs").readFileSync(0,"utf8").split("\n").filter(Boolean).forEach(l=>{
  const d=(l.match(/⏳\(verificado (\d{4}-\d{2}-\d{2})\)/)||[])[1]; if(!d) return;
  const n=Math.floor((Date.now()-Date.parse(d))/864e5);
  console.log((n>30?"VELHO ":"")+"há "+n+" dias · "+l.slice(0,100));})'
```
`VELHO` (>30 dias) → avisar no resumo e revalidar antes de o usar.

**Receita marcada `validado 1×` → teste de controlo antes de ir para trabalho real.** Amostra única
prova que correu uma vez, não que a causa descrita é a certa. No 1.º uso a seguir ao `/resume`, correr
a receita num alvo descartável (ou num caso que se sabe bom) e só depois no real; se falhar, corrigir a
memória antes de continuar.
> Caso real: uma receita `validado 1×` foi seguida como facto e estava errada na causa.

**Marcador literal (greppable): `⏳(verificado YYYY-MM-DD)`** imediatamente a seguir à afirmação.
"Marcar como perecível" sem marcador definido não deixa nada para procurar — com este, `grep -rn "⏳"
memory/` devolve a lista a revalidar. Escrito pelo `/save`, lido aqui.

**`⏳` sem o comando que o provou = «por revalidar».** A data diz *quando* se verificou, não *como*.
Uma afirmação (sobretudo de defeito ou de estado) com `⏳` mas sem o comando literal ao lado não se
trata como verificada: lista-se no resumo como *por revalidar* e corre-se o comando que a prova.
> Caso real: uma afirmação falsa durou 3 dias com `⏳` e com a prova do erro escrita ao lado.

**Regra dura: antes de qualquer escrita em produção derivada da memória, revalidar contra a fonte.**

**Regra dura 2: antes de reportar impossibilidade** ("não dá", "não existe", "está bloqueado") com
base num facto perecível, **revalidar contra a fonte** — o facto pode ter apodrecido e a
impossibilidade ser só a nota velha.

**Regra dura 3: uma afirmação de INEXISTÊNCIA herdada é perecível como qualquer outra.** "Não há
brandguide", "o cliente nunca mandou os originais", "essa pasta não existe" entram na memória como
factos e nunca mais são testadas — mas a coisa pode ter aparecido no mês seguinte. Toda a afirmação
de inexistência leva o mesmo marcador `⏳(verificado YYYY-MM-DD)` e revalida-se aqui, com o comando
que a prova:

```bash
test -e "<caminho que a memória diz não existir>" && echo "JA EXISTE: <caminho>" || echo "confirmado ausente"
```

Um `JA EXISTE:` → corrigir a memória **antes** de continuar, e dizê-lo no resumo. Sem o teste, uma
nota de inexistência é um bloqueio que se auto-renova.

**Inexistência tirada de LOG ou métrica exige provar que o instrumento está ligado.** "Zero pedidos no
log", "ninguém acedeu" só vale se o log existe **e** regista aquele alvo: `ls -l <log>` (existe, mexeu
recentemente) + a conf que o liga (`grep -n access_log <conf do vhost>`). Instrumento desligado devolve
zero — e zero lê-se como ausência.
> Caso real: inexistência de acessos concluída de um vhost com `access_log off`.

**"Está deployado" é perecível — medir paridade live ↔ repo.** Um health-check só prova que o
endereço responde; um live um mês atrasado responde 200 na mesma. Se a memória declarar um **URL
live** *e* um **repo**, correr o check barato:
```bash
git log -1 --format=%H                                  # sha local
curl -s <url-do-bundle-js-ou-css> | shasum -a 256              # hash servido
shasum -a 256 <ficheiro-correspondente-no-build-local>         # hash local
curl -s <url-do-bundle> | grep -c "<símbolo-do-último-commit>" # o commit chegou ao ar?
curl -s -o /dev/null -w '%{http_code}\n' https://<dominio>/<rota-que-só-existe-no-último-commit>  # 404 = atrasado
```
Hash diferente, símbolo ausente, ou rota exclusiva do lado novo a 404 → `⚠ LIVE ATRASADO face a <sha>`
no resumo, como pendente. ⚠ **Comparar `content-length` não serve:** uma alteração de igual tamanho
passa como paridade — o hash ou o símbolo é que provam.
> Caso real: o live servia tudo e faltavam duas features. Uma delas era *esconder rascunhos* — o
> efeito visível ("aparece tudo") é indistinguível de não estar deployada. Só a comparação do
> ficheiro estático dos dois lados o revelou.

#### 2d. Pasta local vazia — o projecto vive noutra máquina (ou noutra nuvem)

**Antes de concluir "não está cá": se o path-alvo estiver debaixo de uma montagem de nuvem** (`MEGA`,
`Dropbox`, `OneDrive`, `Google Drive`, `~/Library/CloudStorage/…`), uma pasta vazia ou com 1-2
ficheiros é tantas vezes uma **migração a meio** como uma máquina nova. Medir e procurar o gémeo
antes de clonar seja o que for:
```bash
ls -A <path-alvo> | head            # vazio? stub de 1 ficheiro?
find ~/<outra-raiz-de-nuvem> -mindepth 2 -maxdepth 2 -name '<basename-do-path-alvo>' 2>/dev/null   # o mesmo nome noutra nuvem; sem glob que parta em zsh
```
⚠ Procura **dirigida** (`ls` a paths conhecidos, `find` só com `-maxdepth`), nunca `find` sem limite/`grep -r` a partir de `~`
nem da raiz da montagem: a home **contém** as montagens e o mount materializa cada pasta ao percorrê-la
— estoura o timeout e vai para background sem resultado.
Encontrado o gémeo com conteúdo → é esse o projecto: **corrigir o `directorio:` na memória**
(acrescentar o path novo à lista, não substituir às cegas) e reportar a migração no resumo.
> Caso real: o path de nuvem da memória apareceu como stub de 1 ficheiro e o código estava noutra
> nuvem. Sem esta verificação, trabalha-se por cima de uma pasta incompleta.

**Ausência numa pasta de cloud re-verifica-se antes de reportar perda.** O File Stream materializa
pastas com atraso: uma pasta dada como ausente apareceu 15 min depois. Repetir o `ls` ao path e ao pai
no **fim** do `/resume`; até lá, reportar «ainda não visível», nunca «perdido».

Se o path-alvo existe mas está **vazio** (sem ficheiros de projecto), e a memória tem o projecto com
repo remoto: não é um projecto novo, é esta máquina que ainda não o tem. Fluxo (repetível — 2
máquinas alternadas):

⚠ Pasta **cheia mas sem `.git`** é o caso do 2b, não este — clonar por cima destruiria o disco.

⚠ **Antes disso: `directorio:` numa drive de sincronização (MEGA, Google Drive, Dropbox, OneDrive,
iCloud) verifica-se EXISTE E NÃO ESTÁ VAZIO** — um path que existe não prova que o projecto lá
está. Migrações entre clouds deixam **stubs**: a pasta continua no sítio, com um ficheiro lá dentro,
e o projecto vive noutra montagem.
```bash
ls -A "<path-alvo>" | wc -l      # 0 ou ~1 num path de cloud → stub, não projecto
```
Vazio/stub → **procurar o mesmo nome nas outras montagens** (`G:`, outras letras de drive, `~/MEGA`,
`~/Google Drive`, `~/Library/CloudStorage/…`) **antes** de reportar o projecto como em falta ou de
seguir para o clone.
> Caso real: migração entre duas nuvens a meio — `~/<nuvem-antiga>/<cliente>/<projecto>` apareceu vazio (1
> ficheiro) e o código estava na nuvem nova.

1. `gh repo clone <owner>/<repo> <path>` — para repos **privados** usar o `gh`; o `git clone https`
   pendura à espera de credenciais.
2. Listar o que é **gitignored e portanto não veio**: `.env`, base de dados, `uploads/`, `storage/`.
   Ir buscá-los à origem real (VPS/cPanel/backup) — a memória do projecto diz onde.
3. Instalar dependências — **de CADA projecto do repo**, não só da raiz (um clone com N apps instalava 1):
   ```bash
   find . -maxdepth 3 \( -name package.json -o -name composer.json \) -not -path '*/node_modules/*' -not -path '*/vendor/*'
   ```
   `npm install` / `composer install` na pasta de cada manifesto listado.
4. **Verificar coerência BD ↔ disco**: registos que apontem para ficheiros que não existem localmente.
5. Só depois arrancar. Portas: respeitar as hard rules do projecto.
   **Arrancar com o binário do projecto (`npm run dev` ou `./node_modules/.bin/<x>`), nunca `npx <x>` num projecto com `node_modules`** — o `npx` pode descarregar outra versão e reescrever `package.json`/lock (caso real: `npx next dev` trouxe o Next 16 a um projecto em 15 e o dev rebentou).

Se o projecto envolver geração de imagens: verificar se `Branding.md` ou a entrada de memória define `default_model`. Se sim, incluir no resumo final para evitar usar modelo errado.

**Pasta CHEIA e mesmo assim ilegível — ambiente containerizado sobre drive de nuvem.** O 2d acima
cobre "pasta vazia"; falta o inverso, que é pior porque parece bom: a pasta tem tudo, o `ls` do host
mostra os ficheiros, e o **container** não consegue lê-los. Bind-mounts de Google Drive/Dropbox em
Docker Desktop/Colima falham como `Resource deadlock avoided`, ou montam vazio, sem erro na subida.
Se houver `docker-compose.yml`/`compose.yaml` com binds sob uma montagem de nuvem, ler um ficheiro
montado **de dentro do container** antes de dar o local por bom:

```bash
grep -nE '^\s*-\s.*(CloudStorage|Google Drive|Dropbox|OneDrive|MEGA)' docker-compose.yml compose.yaml 2>/dev/null
docker compose up -d
docker compose exec <servico> ls -la /var/www/html | head    # vazio ou erro = o bind não serve
docker compose exec <servico> head -c 100 /var/www/html/<um-ficheiro-que-existe-no-host>
```

Falha aqui → **não é o projecto, é o mount**: copiar a árvore para disco local (`~/Projetos/<nome>`)
e apontar o bind para lá. Reportar no resumo como bloqueador de ambiente, não como projecto partido.

#### 2e. Varrimento por data — nunca `find` recursivo em drive de cloud

Para ver o que mudou desde a última sessão (sobretudo em projectos **sem git**: pastas de cliente,
design, print), a via óbvia é `find <path> -mtime -N` / `find -iname` a partir da raiz. Em drives de
cloud montadas isso **estoura o timeout de 2 min do Bash** — o File Stream materializa cada pasta que
é tocada (vivido 2×, uma delas ficou em background a correr para nada).

Detectar **antes** de varrer. O path-alvo é de cloud se estiver numa drive mapeada (`G:`, `H:`, …) ou
se contiver `Google Drive`, `GoogleDrive-`, `CloudStorage`, `MEGA` ou `Dropbox`:
- **Cloud → saltar o `find` recursivo.** `ls -lt` (ou `Get-ChildItem`) direccionado às 2-3 pastas que
  interessam — as que a memória do projecto nomeia como activas — um nível de cada vez.
- **Disco local → `find` normal**, excluindo `vendor/`, `node_modules/`, `storage/`, `bootstrap/cache/`, `out/`, `public/`.
- **Código dentro de pasta de cloud = violação de «código nunca no Drive».** Ao listar um `directorio*` de cloud,
  procurar manifestos a 1-2 níveis (o `-maxdepth` é o limite que a cloud aguenta):
  `find "<directorio-cloud>" -maxdepth 2 \( -name composer.json -o -name package.json -o -name .env \) 2>/dev/null`.
  Cada hit → `⚠ CÓDIGO NO DRIVE: <subpasta>` no resumo (com `.env` = credenciais na nuvem); a saída é a do 2b
  (clone de trabalho em `~/Projetos/<nome>`).
- **Cópias a partir da cloud** (`rsync`, `cp -R`) arrancam logo em `run_in_background` — em primeiro
  plano estouram o timeout a meio e deixam a cópia parcial. Ficheiro isolado **>1 MB** a ler/processar
  → copiar para local em background primeiro.
- **I/O a UM ficheiro de cloud que pendura → controlo com um vizinho** antes de concluir
  (`head -c 100 "<outro ficheiro pequeno da mesma pasta>"`): o vizinho responde → é aquele ficheiro a
  materializar, espera-se; o vizinho também pendura → é o mount, reportar como bloqueio de ambiente.
- **Leitura de cloud com timeout por ficheiro e 2.ª via** (MCP Google Drive / `gws`), e processos de leitura presos listados e mortos antes de seguir → receita «ler da cloud» em `.claude/reference/workflows-and-tooling.md`.

Regra genérica (drives de cloud/rede, `tar`, paths Windows): `.claude/reference/workflows-and-tooling.md`.

#### 2f. Endereços live — verificar, não acreditar

Um "**LIVE** em X" na memória é **afirmação a verificar**, não facto (caso particular do 2c). Meia
sessão foi trabalhada a assumir que o live de um portfólio era a VPS porque era o que a memória
dizia: o site real estava noutro alojamento, a correr código de 4 meses antes — e a VPS continuava
no ar com uma **segunda cópia pública** que ninguém tinha em conta.

Para projectos cuja memória cita domínios/subdomínios ou `**Repo:**`, sondar **todos** os endereços
conhecidos (produção, staging, host antigo):
```bash
curl -sI https://<dominio> | head -20     # status, redirects, server, last-modified
curl -s  https://<dominio> | head -40     # marcador de versão/build no HTML servido
```
- Comparar `last-modified`/conteúdo com o repo local (data do último commit que toca o output).
- **Live mais antigo que o repo**, ou HTML que não bate com o build actual → pendente explícito no
  resumo, não nota de rodapé.
- **Vários endereços a servir o mesmo projecto** → listá-los todos e sinalizar as cópias esquecidas;
  continuam públicas (e com o que lá estiver: analytics, versões antigas, dados).
- Endereço na memória que já não responde (DNS/404/host morto) → corrigir a memória no `/save`.
- **API com CORS: sondar COM `Origin`.** Um `curl -sI` sem `Origin` devolve 200 e dá «resolvido» a um
  defeito que só o browser vê. Comparar as duas respostas:
  ```bash
  curl -sI https://<api>/<rota> | grep -i access-control-allow-origin
  curl -sI -H "Origin: https://<dominio-do-frontend>" https://<api>/<rota> | grep -i access-control-allow-origin
  ```
- **Destino de publicação** (outro projecto, loja, canal onde o projecto publica) → sondá-lo também, não só
  os endereços próprios, e comparar por hash (`md5`/`shasum -a 256`) com os originais locais:
  `curl -s <url-do-ficheiro-no-destino> | shasum -a 256` vs `shasum -a 256 <original>`. Diferente → o
  destino tem outra versão; ausente → não foi publicado.
- **CI configurado ≠ CI corrido.** Havendo `.github/workflows/`, ver se correu e com que resultado:
  `ls .github/workflows 2>/dev/null && gh run list --limit 3`. Zero runs → `⚠ CI NUNCA CORREU`, não «CI configurado».
  Run falhado em <10 s sem steps → ler as anotações (`gh api repos/<o>/<r>/check-runs/<id>/annotations`) antes de diagnosticar código: costuma ser faturação/limite de gasto da organização (ver `.claude/agents/pr-repair.md`, «Every job failed in 2-5 s?»).

#### 2g. Memórias absorvidas — duas entradas, o mesmo trabalho

Uma memória pode declarar que **absorve** outra (fusão de entradas, projecto que passou a viver
dentro de outro). Se duas entradas resolvidas no passo 1 apontam para o mesmo trabalho — uma delas a
declarar a absorção da outra, ou ambas com o mesmo `directorio:`/repo — **avisar em 1 linha no
resumo**, com os dois ficheiros nomeados, em vez de carregar as duas como se fossem projectos
distintos. Duas versões do mesmo estado divergem em silêncio e a mais velha ganha por acaso.

O lado da escrita é do `/save`: a entrada absorvida fica reduzida a um **ponteiro de 3 linhas**.
Em formato pasta a absorção é um **alias**: o slug antigo vive no `aliases:` do index da viva (e o corpo no
`arquivo.md` dela) — resolver pelo nome antigo já devolve a viva, não há duas entradas para avisar.

#### 2h. Projectos de design sem código — engenharia inversa dos entregáveis

Sem repo, o 2b não tem nada para comparar e a memória fica sem contraditório. O contraditório são os
**finais já entregues**: listar a pasta de entrega (`_Final/`, `_Publicar/`, `Entregues/` — o que o
projecto usar), **medir dimensões**, amostrar as cores dominantes e registar as bandas de layout
ocupadas (onde está o logo, o texto, a margem).

```bash
ls -lt "<pasta>/_Final" | head -20
python -c "from PIL import Image;import sys,glob
for f in sorted(glob.glob(sys.argv[1]))[:12]:
    im=Image.open(f); print(im.size, f)" "<pasta>/_Final/*.png"
```

**O material do cliente vem ANTES de amostrar cores.** Antes de fazer engenharia inversa dos
pixels, inventariar as pastas de origem (`_material/`, `_ref/`, `_briefing/`, `Fornecido/`) e **ler**
o que lá está escrito — `.rtf`, `.txt`, `.md`, `.docx`. É onde o cliente costuma mandar os códigos de
cor, as fontes e as regras, por escrito. Amostrar a cor dominante de um JPEG comprimido quando o
`.rtf` ao lado diz o hex exacto é inventar um token que já era facto:

```bash
ls -R "<pasta>"/_material "<pasta>"/_ref 2>/dev/null | head -40
find "<pasta>" -maxdepth 3 \( -name '*.rtf' -o -name '*.txt' -o -name '*.md' \) -print 2>/dev/null
textutil -convert txt -stdout "<ficheiro>.rtf" 2>/dev/null | head -40   # macOS: lê RTF sem abrir app
```

Cor/fonte lida de um documento fornecido é **facto documentado**; amostrada de um PNG é **estimativa**
— e marca-se como tal (`soul.md`: sem token medido ou documentado → `TODO: token em falta`).

**Entregas anteriores = espaço ocupado.** Em produção recorrente (posts, campanhas, peças mensais),
listar o que já foi publicado/entregue como **inventário a não repetir** — tema, imagem, frase de
abertura — e pô-lo no resumo antes de produzir peças novas. Sem isto, repete-se um post de há dois meses.

**Um final exportado pelo cliente/designer é o brandguide de facto quando não há documento** — e é a
única forma de saber o **formato-alvo real**.
> Caso real: entregaram-se 6 imagens a 1080×1350 porque era o que a memória dizia; o formato de
> entrega era **1200×1500**, descoberto por acaso ao inspeccionar finais exportados minutos depois.
> Ninguém tinha medido os finais em 2 meses de projecto, e a memória afirmava "o sistema de design
> está por definir" quando existia um sistema completo, visível nos PNG de `_Final/`.

**Projecto de design com site publicado: medir COBERTURA, não só o que foi entregue.** A memória
lista os entregáveis; ninguém compara essa lista com o inventário de páginas do site-alvo, portanto
páginas por redesenhar ficam invisíveis até o cliente perguntar. Puxar o inventário do próprio site
e cruzar:

```bash
curl -s <url>/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//' | sort -u    # inventário real
ls "<pasta>/_Final" | sed 's/\.[a-z]*$//' | sort -u                              # o que existe feito
```

Sem `sitemap.xml`, extrair os `href` internos da homepage. Reportar no resumo em três números:
**páginas do alvo · com entregável · sem entregável**, e nomear as que faltam. Uma cobertura parcial
apresentada como "entregue" é a forma mais comum de um projecto de design parecer fechado e não estar.

#### 2i. Respostas no canal de entrega — o cliente pode já ter respondido

Se a memória nomeia um **canal de entrega** (DM Mattermost, email, grupo) **e** a data do último envio,
ler as mensagens desse canal **desde essa data** antes de apresentar o estado. Um "à espera de
feedback" pode estar respondido há dias.
```bash
mmctl post list <equipa:canal> --since <YYYY-MM-DDTHH:MM:SS+00:00> --suppress-warnings
```
⚠ **O `--since` exige fuso numérico.** O mmctl faz `time.Parse("2006-01-02T15:04:05-07:00", …)`: `…Z` e a data
sem hora dão `Error: invalid since time` e **zero posts**, que se lêem como «sem resposta». Alternativa que não
depende do formato: `--number 30` e filtrar pela data na leitura.
Email → a pesquisa do Gmail (MCP) ou `gws gmail +triage`, filtrada pelo remetente e pela data.
**O cliente pode responder por fora do canal.** Se a memória nomeia um **intermediário** que reencaminha ao
cliente (ex.: alguém da equipa que lhe passa as peças), pesquisar também o Gmail pelo **domínio do cliente** desde o
último envio (`from:<dominio-cliente> after:<YYYY/MM/DD>`) — uma resposta chegou por email reencaminhado e só
apareceu porque o utilizador a exportou.
**«Já tens isso» / «já existe» sobre um ficheiro do cliente → ler primeiro o canal de entrega (DM) desde a última
sessão, e só depois varrer o Drive.** O material vem muitas vezes anexado na conversa (gastaram-se 5 pesquisas no
Drive para algo que estava numa DM).
Resposta encontrada → entra no resumo como **pendente novo**, com a data e o essencial; nada → dizer
"sem resposta desde <data>" (com o comando corrido), não omitir.

**Projecto cuja FONTE é uma caixa de correio** (documentos administrativos, cartas, pedidos que chegam
por email — a memória declara-o num campo `fonte:`) → não é só o canal de entrega: pesquisar **tudo o que
chegou desde a última sessão** antes de apresentar o estado. No Gmail: `newer_than:<N>d` (N = dias desde
a data da «Última sessão»), filtrado pelos remetentes/assuntos que a memória nomeia. O estado do
projecto é o que está na caixa, não o que a memória diz que estava.

### 3. (removido 2026-09-15: verificação de grafos de código retirada do JOCA)

### 3b. Se o projecto actual É o toolkit JOCA

Quando a pasta de trabalho é o próprio repo JOCA (contém `JOCA_Brain/CLAUDE.md`), surgir no resumo as workflows de manutenção disponíveis:
- `/upgrade-joca` — processa feedback acumulado em `memory/feedback/`
- Nota Windows: o JOCA_OS é desenvolvido em macOS; em Windows a skill `joca-os-windows` adapta/testa/corrige o UI.

### 3c. Para projectos com código existente — propor iteration flow

Se o projecto já tem código (detectável por existência de `package.json`, `composer.json`, `src/`, `app/`):
- **Não** apresentar apenas o contexto passivamente
- Propor o flow de iteração adequado ao estado:

| Estado detectado | Flow sugerido |
|-----------------|---------------|
| Tem pendentes de bug/fix | → `[/debug]` ou fix directo |
| Tem pendentes de feature | → `[/plan]` → implement |
| Estado: "completo" mas sem deploy | → `[/deploy-executor]` ou checklist de deploy |
| Sem pendentes claros | → "O que queres fazer? (review, feature, fix, deploy)" |

Indicar o flow em 1 linha no resumo, não como pergunta — o utilizador redirige se quiser outra coisa.

**Projectos com `composer.json` (Laravel/PHP) em Windows:** verificar `php -v 2>&1` no arranque. Se falhar (PHP não está no PATH), alertar com o path do binário PHP local — `<YOUR_PHP_PATH>` — e sugerir add ao PATH ou usar `& <YOUR_PHP_PATH> artisan ...`. Sem isto, qualquer operação artisan/composer falha silenciosamente e acaba-se a usar Python/sqlite directamente para a BD.
O `php -v` não chega para o 1.º pedido HTTPS nem para os testes: `php -r "var_dump(ini_get('curl.cainfo'));"`
vazio/`false` → aviso de `cURL error 60` à vista; e sem `public/build/manifest.json` (`test -f`) os testes que
renderizam vistas falham em massa → `npm run build` antes de correr a suite.

**Projetos móveis** (`mobile_app/`, `app.json` do Expo, `android/`): verificar o ambiente no arranque, não ao
falhar o build — «tenho o Android Studio» pode ser só o SDK de outra ferramenta e um JRE sem compilador:
```bash
javac -version; echo "JAVA_HOME=${JAVA_HOME:-(vazio)}"; emulator -list-avds
```
Falha em qualquer um → `⚠ AMBIENTE MÓVEL INCOMPLETO: <o que falta>` no resumo.

### 4. Apresentar resumo ao utilizador

```
[⚠ PROJECTO NÃO EXISTE NESTA MÁQUINA: <path> — só se aplicar, e é a 1.ª linha]
[⚠ REPO EM DRIVE DE NUVEM · ⚠ WORKING TREE VIVA — avisos de ambiente à cabeça]
Projecto: <nome>
Stack: <stack>

Estado: <estado actual>

Última sessão:
- <o que foi feito>

Bloqueantes:
- <item> — há N dias

Pendente:
- <item 1>
- ⏳ <item à espera de X> — há N dias
- Contrato expirado: <ficheiro> · N passo(s) por fechar

```

**Bloqueantes e `⏳` levam a idade** («há N dias», da data em que entraram na memória ou do marcador):
um bloqueante de 40 dias pede outra conversa que um de ontem.

Pronto para trabalhar.

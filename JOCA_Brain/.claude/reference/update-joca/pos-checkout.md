# /update-joca — depois do selective-checkout (forma B)

Lido a partir do `/update-joca` Phase 0, logo a seguir ao `git checkout "$PUB/$PUBBASE" -- $PATHS`.

## Índice
- 2b. Verificação pós-checkout (truncagem)
- 2c. Proveniência
- 3. Removals
- Passo das remocoes (o checkout so escreve)

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

# /save — Guardar sessao + feedback do projecto

Corre no fim de cada sessao. Guarda estado, actualiza memoria, captura feedback do projecto e do JOCA. Zero perguntas ao utilizador — tudo inferido da sessao.

---

## PASSO 1 — Identificar projecto

Detectar directorio actual. Resolver a memória: `node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/lib/memoria-projecto.cjs resolver "<pwd>"`
(só igualdade: caminho `directorio*` · slug · `aliases:`). Memória = pasta `memory/projects/<nome>/` (`index.md` + áreas);
a ficha plana antiga `<nome>.md` já não se lê nem se escreve (se aparecer, é de uma instalação antiga → `node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/migrar-memoria-pastas.mjs`). Sem match e com
`quaseIguais` → `AskUserQuestion` com os candidatos (nunca escolher sozinho, nem pelo nome mais parecido). Alias `x#<area>` → a área da tarefa é essa.
Se nao existir, criar pasta minima: `index.md` (frontmatter `name` = pasta, `description`, `directorio_*`; §Ficheiros com a linha `- geral.md — …`) + `geral.md`.

**Orçamento do contexto de arranque — medir ANTES de escrever.** Tudo o que é auto-carregado paga-se em
todas as sessões. Fotografar os bytes agora; o PASSO 8 compara:

```bash
wc -c ~/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/.claude/rules/*.md \
  <raiz-projecto>/CLAUDE.md 2>/dev/null | tail -1 > /tmp/joca-save-bytes-<slug>.txt
```

**Sessão que tocou N projectos → N blocos:** PASSOS 2, 2c e 3 correm uma vez por projecto (um `--slug` cada) e o PASSO 8 leva um bloco por projecto — nunca tudo na memória do cwd.

**`/save` repetido sem delta → não duplicar.** Se nada mudou desde o último checkpoint do slug
(`find <raiz-projecto> memory/projects/<nome>/ -type f -newer "memory/checkpoints/<slug>/$(ls -t memory/checkpoints/<slug>/ | grep -v -- '-auto' | head -1)" | head -1` vazio),
saltar 2c e 4 (checkpoint, `decide`/`learn`, feedback) e mostrar só os pendentes. Sem checkpoint anterior = há delta.

**Duas condições, não uma — o delta sozinho deixa passar a corrida abortada.** Um `/save` interrompido escreve o
checkpoint a meio e nunca chega ao PASSO 4: o rasto que deixa convence a corrida seguinte de que não há nada a fazer.
Antes de saltar o PASSO 4, confirmar que **existe ficheiro de feedback desta janela** em `memory/feedback/`:

```bash
ls memory/feedback/session-$(date +%F)-*-<slug>.md 2>/dev/null | head -1   # vazio = o PASSO 4 nunca correu
```

Vazio → **o PASSO 4 corre à mesma**, mesmo sem delta. Só se saltam 2c e 4 quando não há delta **e** o feedback desta
janela já existe.

**`directorio*` valida-se no disco, não se copia.** `test -d` a cada campo da máquina actual
(`directorio` + `directorio_mac` no Mac, `directorio_win` no Windows); falha → `directorio_estado: quebrado` e linha no PASSO 8.
Cruzar também com as decisões activas (`node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/joca-brain.mjs active --slug <nome>`):
decisão que cita um caminho diferente do `directorio*` → drift no PASSO 8 (qual está certo decide o disco, não a mais recente).

**Trabalho no disco que nao resolve para nenhuma memoria.** O `/save` so olha para o projecto da
sessao, portanto um projecto onde se trabalhou noutra sessao e para o qual nunca se criou
memória em `memory/projects/` fica invisivel para sempre — nenhum passo o procura. Varrer as raizes
declaradas por `mtime` e listar o que nao casa (o resultado vai ao PASSO 8, nao se cria memoria a
adivinhar):

```bash
for raiz in <YOUR_PROJECTS_DIR>; do                          # as raizes de projectos desta instalacao
  find "$raiz" -maxdepth 1 -mindepth 1 -type d -mtime -30 2>/dev/null
done | node -e '
const fs = require("fs"), n = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dir = "memory/projects/";
const ler = (f) => fs.existsSync(dir + f + "/index.md") ? fs.readFileSync(dir + f + "/index.md", "utf8") : "";   // o index (directorio* + aliases)
const hay = fs.readdirSync(dir).filter((f) => fs.statSync(dir + f).isDirectory()).map((f) => n(f) + " " + n(ler(f))).join("\n");
for (const p of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) if (!hay.includes(n(p.split("/").pop()))) console.log("SEM MEMORIA: " + p);'
```
⚠ **Os dois lados normalizam-se (sem acentos, minúsculas, `-`) antes de comparar.** O `grep -F` compara
bytes: o nome da pasta vem do disco numa forma Unicode e a memória noutra, e `~/Projetos/Água` saía
«SEM MEMORIA» com `agua-exemplo.md` a existir. Medido 2026-09-15: o grep antigo dava 2 linhas, este dá 1.

Cada linha `SEM MEMORIA:` e trabalho mexido no ultimo mes que nenhuma memoria nomeia. Reportar a
lista no PASSO 8 — a decisao de criar entrada e do utilizador, nao do comando.
**Trabalho pessoal fora das raizes de projectos** (uma colagem em `~/Pictures`, um ficheiro solto) não tem memória onde
cair e nenhum varrimento o encontra depois: a sessão que o fez acrescenta-lhe uma linha em
`memory/projects/varios/geral.md` (secção «Coisas»: o quê · caminho · data).

**⚠ "actualiza/sincroniza o repo X" com X público → desambiguar ANTES de medir seja o que for.**
O `/save` aceita argumentos livres e "actualiza o joca open source no github" tem duas leituras com
riscos incomparáveis:
1. **publicar o que este repo já tem por enviar** (commit+push do clone público) — rotina;
2. **trazer trabalho de outro repo** (portar o delta do privado para o público) — expõe dados de
   cliente/PII e passa obrigatoriamente por `.claude/skills/public-release-audit.md`.
Se o alvo é um repo **público** e a fonte possível tem dados pessoais/cliente, perguntar qual das
duas **antes** de correr o primeiro `git diff` — medir já é começar a operação errada.
> Caso real: chegaram a medir-se 63 ficheiros e a preparar-se a triagem para uma "actualização de
> rotina". Sem o gate, teria sido preparada uma fuga de dados de cliente como tarefa normal.

---

## PASSO 2 — Guardar estado da sessao

Actualizar a memória do projecto. Abaixo, **`$F` = o ficheiro que se escreve**. Regras de escrita (norma):
- **Grava-se só na área da tarefa** (`memory/projects/<nome>/<area>.md`; transversal → `geral.md`) **e** nas ≤3 linhas
  dessa área em §Áreas do `index.md`. Outras áreas não se tocam. O «Estado global» do index só muda quando muda de facto.
- **Index curto:** ≤40 linhas não vazias e ≤4 KB de corpo (o frontmatter conta à parte); sem diário — a «Última sessão» vive na área.
- **Escolher a área:** igualdade entre a tarefa e o nome da área ou as palavras «ler:» do index; 0 ou ≥2 → `AskUserQuestion`.
  Sessão que tocou 2 áreas → 2 blocos.
- **Área nova** = criar `<area>.md` + a sua linha em §Ficheiros + o seu bloco de ≤3 linhas em §Áreas, no mesmo passo.
- Factos transversais vão para o fixo: regra → `normas.md` · caminho → `pastas.md` · porta/hábito → `config.md` · onde está a credencial → `acessos.md` (nunca o valor).
- **`arquivo.md`:** só se escreve para arquivar, e **só quando o utilizador diz que acabou** (o doctor pode sugerir, nunca arquiva).
  Mover o bloco tal qual, com `## <área/parte> — arquivado AAAA-MM-DD (<motivo>)`; contar linhas antes e depois.
- Verificar no fim: `node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/lib/memoria-projecto.cjs lint` sem erros para `<nome>`.

As guardas abaixo (`Edit`, reler antes/depois, contar `## ` e linhas) valem **por ficheiro**.

| Seccao | Accao |
|--------|-------|
| **Estado actual** | Substituir com descricao breve do estado presente |
| **Decisoes tomadas** | Diário: acrescentar entrada com data `YYYY-MM-DD` **no topo**, nunca substituir as anteriores |
| **Pendente** | Substituir com lista actual — item que o corpo da mesma memória já dá como feito **sai no mesmo `Edit`** |
| **Ultima sessao** | Diário: acrescentar **no topo** data + resumo de 1 linha; as entradas anteriores ficam. Antes, `grep -niE -e "não existe" -e inexistente -e perdid -e apagad -e "em branco" -e falta "$F"` — afirmação que a sessão desmentiu (incluindo «secção X em branco»/«falta Y» que um artefacto registado agora desmente) leva o marcador `❌(corrigido …)` do PASSO 3 |

**⚠ Sessões concorrentes — `Edit`, nunca `Write`.** Se houver outras sessões Claude activas
(`ListAgents`), a memória do projecto tem mais do que um autor. **Reler o ficheiro imediatamente
antes de escrever** e usar sempre `Edit` cirúrgico. A regra é pelo **efeito**, não pela ferramenta:
ler-modificar-reescrever o ficheiro inteiro por `python`, `sed -i`, `node` ou redirecção `>` é um `Write` e fica proibido na mesma. Um `Write` teria apagado o trabalho da outra
sessão — só se soube porque o `Edit` avisou "the file had been modified on disk". Entradas do mesmo
dia numeram-se com sufixo `(a)`/`(b)`/`(c)` para não colidirem.
**Reler também DEPOIS de escrever:** `grep -n "<frase literal inserida>" "$F"`
logo a seguir ao `Edit`. Reler antes só protege de um lado — uma sessão par que faça `Write` a seguir
apaga a entrada sem aviso, e só o grep depois o mostra (zero linhas → voltar a inserir e reportar).
**Fecho do PASSO 2 — a linha de hoje existe no diário?** `grep -nE "^(- )?(\*\*)?<YYYY-MM-DD>" "$F"` (a data aparece com e sem negrito, com e sem «- »)
(data de hoje) tem de devolver ≥1 linha dentro da secção «Última sessão»; zero → inserir agora. Atualizar o
«Estado» e o «Pendente» sem esta linha deixa o `/resume` seguinte a mostrar uma sessão de semanas antes.

**Memória absorvida = ponteiro de 3 linhas.** Quando uma entrada declara que **absorve** outra (fusão
de entradas, projecto que passou a viver dentro de outro), a absorvida **não fica a existir em
paralelo**: reduzir a três linhas — o que era, para onde foi (`→ memory/projects/<nova>/`), data da
absorção. Em formato pasta, a absorvida passa a **alias** exacto no `aliases:` do index da viva e o corpo vai para
o fim do `arquivo.md` dela (com cabeçalho e data); o ficheiro antigo sai. Duas entradas vivas para o mesmo trabalho divergem em silêncio e a mais velha ganha por
acaso; o `/resume` (2g) avisa quando duas resolvem para o mesmo sítio.

**Memória substituída = inventário de secções antes de a dar por morta.** Substituir uma memória por
outra não é o mesmo que absorver: aqui a nova nasce de raiz e **não herda nada por omissão**. Antes de
declarar uma memória obsoleta: `grep -n "^## " <antiga>.md` → confirmar, secção a secção, que cada uma
**existe na nova** ou foi **deliberadamente descartada** (dizê-lo no relatório). Depois, deixar no
ficheiro antigo um **cabeçalho de 3 linhas** a apontar para a viva (o que era · `→ memory/projects/
<nova>/` · data) — nunca dar por morto e deixar órfão: o `grep` do `/resume` continua a encontrá-lo
e a sessão passa a ler duas versões do mesmo estado.
> Caso real: a `cliente-imagens.md` foi dada por substituída pela `cliente-redes-sociais.md` e a
> nova não herdou a secção do TryPost (workspaces, ids, OAuth, método de troca). O custo apareceu 3
> dias depois, com a sessão a dar informação errada ao utilizador.

**Reescrita estrutural = contar as secções E as linhas antes e depois.** Substituir uma secção por índices de
linha (splice) é a operação que silenciosamente duplica ou come texto. Três guardas, todas baratas:
`assert i < j` antes de cortar (índices trocados apagam o ficheiro entre eles sem erro), a
contagem de secções antes/depois — se o número subiu sem se ter acrescentado secção, duplicou — e a
contagem de **linhas**: trocar o conteúdo de uma secção-diário mantém o nº de secções e apagou ~120
linhas sem nenhuma guarda dar por isso:

```bash
grep -c '^## ' "$F"; wc -l < "$F"   # ANTES
# … a edicao …
grep -c '^## ' "$F"        # DEPOIS: mesmo numero, ou +N deliberados
wc -l < "$F"               # DEPOIS: desceu mais do que o removido de propósito → parar e repor
grep '^## ' "$F" | sort | uniq -d   # titulos repetidos (sem campos `$N` do awk: o expansor de argumentos troca-os)
```

**Todo o número que entra na memória traz a origem.** `47 ficheiros`, `21 vhosts`, `3 GB` — sem
etiqueta, um número lê-se como medido e sobrevive anos. Escrever sempre uma das três:
**medido agora** (com o comando), **calculado** (a partir de quê), **assumido** (e porquê). Um número
assumido que ninguém marcou como tal foi a origem de mais de um brief contra um mapa errado.

**Sub-repos git (repo aninhado num sub-directório):** alguns projectos têm um repo git PRÓPRIO num subdir (ex.: `<JOCA_ROOT>` = repo `JOCA`, mas `JOCA_OS/` é repo local-only separado). Detectar sub-repos (`git -C <subdir> rev-parse --is-inside-work-tree`) e reportar pendências de commit POR repo no PASSO 8 — senão trabalho num repo aninhado fica por commitar e invisível no `git status` do repo-pai. (Fonte: JOCA 2026-06-25.)

---

## PASSO 2a-bis — PROGRESSO.md (estado partilhado por git)

Se a raiz do projecto tiver `PROGRESSO.md` (formato em
`.claude/reference/start/progresso-formato.md`):
1. Actualizar **Estado actual** (1-3 linhas) e a tabela de **Fases** se alguma mudou — sempre com a
   coluna Prova (caminho/comando), nunca so o ✅.
2. Acrescentar 1 linha ao **Diario**: `- <data> · <maquina/utilizador> · <o que aconteceu>` — **no topo da
   secção existente**, nunca numa secção nova no fim: `grep -cE '^## Di[aá]rio' PROGRESSO.md` tem de dar 1
   (2 → fundir as duas, mais recente primeiro). A tabela de **Ondas** acompanha as secções datadas: onda fechada no diário = linha actualizada na tabela.
3. **Commitar junto com o resto do trabalho** — e a memoria PARTILHADA: o que nao for commitado nao
   existe para os outros colaboradores. (A memoria do Brain continua individual; as duas apontam uma
   para a outra, nao se duplicam.)
4. **Fazer `fetch` ANTES de editar — o disco local e uma fotografia com data.** O `PROGRESSO.md` e
   estado partilhado por git; com mais do que uma maquina (ou outro colaborador), a copia local pode
   estar atras sem que nada o diga. Editar por cima produz um conflito, ou pior, uma reescrita que
   apaga o diario do outro lado:
   ```bash
   git fetch --quiet
   git log --oneline HEAD..@{u} -- PROGRESSO.md    # linhas = o upstream mexeu-lhe; pull ANTES de editar
   ```
   Saida vazia → editar. Saida com commits → `git pull` (ou ler o delta) primeiro. Vale para
   qualquer estado partilhado versionado, nao so o `PROGRESSO.md`.
5. **Se NAO existir** e o projecto ja levou trabalho de mais do que uma sessao: cria-o com o estado
   observado (git + docs + issues), sem entrevista. E o estado partilhado; a sua ausencia e a razao
   por que o proximo colaborador pergunta o que ja esta escrito.

## PASSO 2b — Check de Conceito (projectos com regras mutáveis)

Se o projecto tiver um `CLAUDE.md` com secção `### Conceito` (comum em jogos, motores de regras, apps com domínio mutável):
1. Ler a secção `### Conceito` do `CLAUDE.md` do projecto
2. Comparar com a memória actual (`memory/projects/<nome>/` — index + área)
3. Se houver divergência (ex.: campo mudou de 9×10 para 7×9, cartas novas adicionadas, regras alteradas) → propor actualização cirúrgica (1 linha de diff, não reescrever a secção inteira)
4. Se não houver divergência ou não existir `### Conceito`: saltar silenciosamente

---

## PASSO 2c — Checkpoint estruturado (restaurável)

Escrever um snapshot machine-readable da sessão (adaptado de gstack context-save) — restaurado pelo `/resume`. Complementa a prosa do PASSO 2, não a substitui.

```bash
printf '## Decisões desta sessão\n- <...>\n## Trabalho restante\n- <...>\n## Próxima acção\n- <...>' | node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/joca-checkpoint.mjs save --slug <projecto> --title "<slug-curto>" --status wip
```
⚠ **Caminho absoluto** (`<JOCA_ROOT>` = raiz da instalação): o `/save` corre no cwd do projecto, e `node .claude/scripts/…` relativo falha fora do Brain. Vale para os três comandos `joca-brain.mjs` abaixo.
⚠ **`--slug <projecto>`** com o nome do PASSO 1, não o default. Sem ele o slug vem do repo do cwd e
sessões concorrentes misturam checkpoints na mesma pasta — o `latest` do `/resume` passa a devolver o
de outro projecto.
⚠ **Umbrella vs sub-entrada:** o slug é o da entrada onde o trabalho foi feito — a **sub-entrada** (a ficha com `umbrella: <pai>` no frontmatter), nunca a umbrella. Gravar na umbrella dá aviso com as sub-entradas; o `latest` de uma sem checkpoints cai para a outra, com nota.
- Body = decisões desta sessão + trabalho restante + próxima acção (1 linha cada). Sem pipe: `--body-file <f.md>` — sem stdin o `save` sai com exit 2 em vez de pendurar.
- `--status done` se a tarefa ficou concluída; senão `wip`.
- O helper escreve `memory/checkpoints/<slug>/<ts>-<title>.md` (frontmatter branch/ts/status), rename atómico; poda só os `-auto` (últimos 6) — nomeados têm travão de 200 e o nunca-commitado nunca se poda.

**Decisões/aprendizagens atómicas** desta sessão (não-óbvias, reutilizáveis) → registar no Brain log (reversível, sem perguntar). Sintaxe literal (assinatura completa: `node .claude/scripts/joca-brain.mjs --help`; detalhe em `/learn`):

```bash
node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/joca-brain.mjs decide "texto" [--rationale "..."] [--source user|skill|agent] [--confidence 1-10] --slug <projecto>
node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/joca-brain.mjs learn  "texto" [--tags a,b,c] [--file path] --slug <projecto>
node <JOCA_ROOT>/JOCA_Brain/.claude/scripts/joca-brain.mjs recall --slug <projecto> --limit 5    # DEPOIS: confirmar por efeito
```
Verificar por efeito, não pelo `[brain] … registada`: as entradas desta sessão aparecem no `recall`
(decisões e aprendizagens) **com texto**. Uma linha vazia ou ausente = escrita falhada → repetir.
Flag fora da assinatura sai com exit 1 e «nada foi escrito» — antes aceitava-a e gravava `text: null`.

---

## PASSO 2d — Estado que vive fora do git

Guardar a memória não serve de nada se o **conteúdo** do projecto ficar para trás. Antes de fechar:

**a) Artefacto-ponte desactualizado.** Se o `CLAUDE.md` do projecto declarar um artefacto de estado
exportável (padrão `snapshot/`, `*.sql`, `dump/`, `backup/`), comparar o `mtime` do artefacto com o do
estado vivo (volume Docker, BD local, `wp-content/uploads`). Artefacto mais velho → **re-exportar**
(reversível, sem perguntar) ou reportar como pendente **crítico** no PASSO 8.
Estado vivo inclui o que a app guarda **na HOME**: `~/.<app>/` e `~/Library/Application Support/<app>` (Windows: `%APPDATA%\<app>`)
que o projecto declare → inventariar na memória (path + o que lá vive); **nunca apagar sem o dono** — é dado, não cache.
> Caso real: uma sessão fez trabalho de conteúdo numa BD dentro de um volume Docker e nunca
> re-exportou o snapshot. 12 dias depois a outra máquina abriu um site silenciosamente velho — assets
> de Julho na pasta, BD de Junho no volume — e custou uma migração staging→local completa.

**b) Cloud-sync não é sincronização de projecto.** Uma pasta em MEGA/Drive **não** leva dotfiles
(`.git`, `.env`, `.gitignore`) nem estado de runtime (volumes, BDs). "Está no MEGA, deve estar
actualizado" é falso por omissão. Registar na memória do projecto **qual é o artefacto-ponte** entre
máquinas.

**b-bis) Projecto sem git: verificar o DESTINO, nunca a configuração que promete o backup.** Estar
listado na config de um script de backup não é estar copiado — a alínea (a) compara `mtime` e
pressupõe que o artefacto existe. Para todo o projecto sem `.git`, medir o outro lado:

```bash
test -d "<destino>" || echo "DESTINO INEXISTENTE: <destino>"      # existe?
find -L "<origem>"  -type f | wc -l                               # quantos cá
find -L "<destino>" -type f | wc -l                               # quantos lá — os dois números
```
⚠ **macOS: as pastas de cloud são symlinks** (`~/Google Drive` → `~/Library/CloudStorage/GoogleDrive-…`) — `find` sem `-L` não
as segue e devolve 0 com o destino cheio. Contagem 0 → repetir com `-L` e confirmar com `mdfind -onlyin "<destino>" "<nome>"` antes de a dar por vazia.

Destino em falta, ou contagem muito abaixo da origem → **pendente crítico** no PASSO 8. Um projecto
sem git e sem cópia verificada é trabalho a um `rm` de distância: um projecto de cliente foi apagado e não tinha
cópia nenhuma, apesar de o processo o dar por coberto.

**c) A memória do Brain viaja por git? — DERIVAR, nunca afirmar.** O que é ignorado, e para onde
aponta o `origin`, **varia por instalação** (clone público vs privado, `.gitignore` editado à mão):
a mesma frase herdada da instalação open source esteve aqui meses a afirmar o contrário do que o
disco dizia. Não tomar nenhuma das duas coisas como facto — medir, no momento, antes de decidir:

```bash
git remote -v                                    # o origin daqui é público ou privado?
for p in memory/projects/x/index.md memory/feedback/x.md memory/decisions/x.md \
         memory/learnings/x.md memory/knowledge/x.md memory/checkpoints/x.md; do
  printf '%-32s ' "$p"; git check-ignore -v "$p" || echo 'NAO IGNORADO'
done
```
⚠ Testar um **ficheiro dentro** da pasta, não a pasta: um padrão `memory/projects/*` ignora o
conteúdo e `git check-ignore memory/projects` devolve **nada** — parece não estar ignorado e está.
⚠ Há **excepções por negação** (`!memory/projects/JOCA.md`): "a pasta está ignorada" não implica que
todos os ficheiros lá dentro estejam.

Leitura do resultado:
| Medição | Consequência |
|---|---|
| Ignorado | ⚠ Commitar `memory/` não leva nada a lado nenhum → tirar do `.gitignore` ou o trabalho não chega à outra máquina |
| Não ignorado + `origin` **privado** | A memória viaja por git → commit **cirúrgico** no Brain: `git add memory/projects/<slug>/ memory/checkpoints/<slug>/ …` (caminhos explícitos, nunca `-A`/`.`) + mensagem `save(<slug>): <resumo>`; push depois do `fetch`. Dizê-lo no PASSO 8 |
| Não ignorado + `origin` **público** | ⚠ **Pendente crítico**: memória de projectos privados a caminho de um repo público — parar e reportar antes de qualquer `git add`, e corrigir os remotes primeiro (ver `.claude/skills/public-release-audit.md`, Passo 0) |

Se a sessão produziu decisões/checkpoints que a outra máquina precisa, dizê-lo no PASSO 8 com a via
que a medição indicou (commit + push).

> Foi um facto cravado que criou este defeito: a versão anterior deste passo afirmava "estão todos no
> `.gitignore`" e "o `origin` daqui é o público". Numa instalação de produção as duas eram falsas.

**d) Um aviso na documentação não é um fix.** Se estiveres a escrever "⚠ não corras X", regista-o
também como **pendente de correcção** — um `⚠ não corras npm test` sobreviveu semanas a esconder um
defeito de perda de dados (os testes faziam `fs.rmSync` sobre o `DATA_DIR` real e apagavam
notificações e chat). Duas varreduras no mesmo acto, cada ocorrência → pendente no PASSO 8:
- **documentar uma armadilha** → `grep -rn "<padrão da armadilha>" <raiz-projecto> --exclude-dir=node_modules`: a armadilha continua viva no código?
- **remover um mecanismo** (hook, script, pasta-ponte, flag) → `grep -rn "<nome>" .claude/ memory/`: quem ainda o cita como via ou fallback?

**e) Remover do working tree não remove do histórico.** Ao fechar qualquer remoção por
privacidade/limpeza (PII, credencial, cliente, dado pessoal), **verificar o histórico antes de
declarar limpo**:

```bash
git log --all -S"<termo>" --oneline    # commits que ainda contêm o termo (inclui os já com push)
```

Reportar as duas coisas **em separado** no PASSO 8: `working tree limpo ✓` · `histórico: N commits
ainda com o termo`. Se N>0, apresentar as opções e deixar a escolha ao utilizador — (1) deixar como
está (repo privado, risco aceite e datado); (2) `git filter-repo` + `push --force` + **re-clone na
outra máquina** (o sync multi-PC parte-se com um force-push — é o custo real, não um detalhe); (3)
se era uma credencial, **rotacionar** — sai mais barato do que reescrever história.
> Caso real: um scrub de memória reportou "reversível por git, nada commitado" — verdade sobre o
> dia, falsa sobre o repo: o conteúdo removido continuava em 3-5 commits cada, já com push feito.

**f) O scratchpad da sessão não sobrevive à sessão.** Se a memória do projecto, o `## Pendente` ou o
checkpoint citarem um path dentro do scratchpad da sessão (`.../Temp/claude/.../scratchpad/`), o
artefacto desaparece e fica uma referência pendurada a apontar ao nada. Varrer os paths escritos
nesta sessão **e as citações antigas** (`grep -rlnE "scratchpad|/tmp/claude" memory/` + `test -e` a cada path;
morto → `PERDIDO` na memória); qualquer um que caia no scratchpad → listar no PASSO 8 como pendente.
Três casos que escapam ao varrimento por path:
- **executável promovido** do scratchpad para o projecto → **re-corrê-lo no caminho novo** (imports e paths relativos partem na mudança);
- **gate/teste corrido mais de 1×** → promover para `tests/manual/` do projecto — é teste, não rascunho;
- **«pronto a colar» num relatório de agente** (bloco de texto, comando, diff) → é pendente do caller: aplicá-lo ou listá-lo; o relatório morre com a sessão.
**Regra: um rascunho sai do scratchpad NO MOMENTO em que vira entregável** — move-se para dentro do
projecto logo ali, por quem o criou (main loop ou agente), não à espera do `/save`. Aqui só se
apanha o que escapou: entregáveis que viveram horas no scratchpad e só saíram no fecho.
**Destinos perecíveis não são rede:** scratchpad, `/tmp`, **Lixo** e `~/.gemini/antigravity-cli/scratch/` (o agy sobrescreve por nome na geração seguinte — o entregável sai de lá no mesmo turno). O relatório diz «movido para o
Lixo», nunca «recuperável» — o Lixo despeja-se. O que importa copia-se para destino estável na mesma
operação, **antes** de ir para o Lixo.
> Caso real: doze variantes (~2 M tokens de trabalho de agente) viveram no scratchpad a sessão
> inteira; sobreviveram porque alguém se lembrou de as copiar, não porque o processo o exigisse.

**f-bis) O entregável tem dependências — resolvê-las, não só o ficheiro.** Um HTML/SVG/mockup que
sobreviveu à sessão mas cujas imagens/fontes ficaram no scratchpad é um entregável que já não
renderiza. Antes de o citar na memória, resolver cada referência da fonte e confirmar que aterra
fora do scratchpad:

```bash
grep -oE '(src|href)="[^"]+"' <entregavel>.html | cut -d'"' -f2 | while read -r r; do
  case "$r" in http*|data:*) continue;; esac
  test -e "$(dirname <entregavel>.html)/$r" || echo "REFERENCIA MORTA: $r"
done
```

Qualquer `REFERENCIA MORTA:` → mover o asset para dentro do projecto **antes** do PASSO 8, ou
listá-lo como pendente. O entregável promete-se inteiro ou não se promete.

**f-ter) Ficheiro corrigido que existe em cópia noutras pastas irmãs.** Quando a sessão corrigiu um
ficheiro que é **cópia** de outro (o mesmo script/template em várias pastas de cliente, o mesmo
comando em duas instalações JOCA), a correcção fica numa cópia e as outras continuam erradas —
e ninguém volta lá. Antes de fechar, procurar as irmãs e listá-las como pendente:

```bash
basename <ficheiro-corrigido>                          # o nome
find <raiz-de-projectos> -name "<esse-nome>" -not -path '*/node_modules/*' 2>/dev/null
```

Mais do que um resultado → PASSO 8 com a lista. Propagar é decisão do utilizador; **não** listar é
que garante a divergência.

**Derivados, não só homónimos.** O `find -name` só vê cópias com o mesmo nome. Um retrato do ficheiro
(prévia, screenshot, poster, capa) tem outro nome e fica desactualizado na mesma. Procurar quem cita o
nome e as imagens derivadas mais velhas do que o ficheiro alterado:

```bash
grep -rl "<basename sem extensao>" <raiz-do-projecto> --exclude-dir=node_modules 2>/dev/null
find <raiz-do-projecto> -type f \( -iname '*previa*' -o -iname '*preview*' -o -iname '*thumb*' \
  -o -iname '*screenshot*' -o -iname '*poster*' -o -iname '*capa*' \) ! -newer <ficheiro-alterado> 2>/dev/null
```
Cada derivado mais velho → pendente no PASSO 8 (regenerar é decisão do utilizador).

**f-quater) Contradições entre documentos do próprio projecto.** Com mais de 5 documentos que se citam
uns aos outros, a mesma afirmação (um número, um prazo, uma medida, um nome) repete-se e diverge sem
nenhum passo o ver. Para cada afirmação numérica ou factual que a sessão escreveu ou alterou, procurar
as outras ocorrências e comparar:

```bash
grep -rn -i "<termo da afirmação>" <raiz-do-projecto> --include='*.md' --include='*.html' 2>/dev/null
```
Valores diferentes para o mesmo termo → pendente no PASSO 8 com os dois `ficheiro:linha`. Não se
escolhe o certo aqui: a fonte primária decide (`soul.md`, Hard Limits).
**Documento de fundação substituído** (`DESIGN.md` → `DESIGN-2.md`, PRD novo, brandguide novo) → `grep -rln "<nome do antigo>" <raiz-projecto>`
(inclui `CLAUDE.md` e `.ai/guidelines/`) e tratar cada citação: aponta à nova, ou fica listada no PASSO 8.

**g) Estado que vive fora da MÁQUINA (infra remota).** As alíneas acima cobrem estado fora do git;
esta cobre estado fora do disco. Se a sessão tocou em **VPS, cPanel, DNS, containers** (ou qualquer
inventário remoto), a tabela de recursos na memória do projecto não se copia da versão anterior —
**confirma-se ao vivo** antes de fechar (`ls /etc/caddy/sites`, `docker ps -a`, listagem de vhosts /
subdomínios / zonas), e a verificação **fica datada** com o marcador do PASSO 3
(`⏳(verificado YYYY-MM-DD)`). Sem isso a tabela é herança, não inventário.
> Caso real: 25 vhosts na VPS contra 21 documentados, e **duas** listas de subdomínios contraditórias
> na memória — ambas erradas. Só apareceu porque o utilizador pediu; nenhum passo o exigia.

O mesmo vale para três estados vivos que a sessão costuma tocar sem os reconfirmar:
- **MCPs** instalados/removidos/autenticados → `claude mcp list` contra `memory/tools/mcps.md`; diferença → corrigir a linha com `⏳`.
- **Texto legal/marca** alterado (NIF, entidade, morada, prova social) → confirmar o que os **endereços publicados dizem hoje** (`curl -s <url> | grep -i "<termo>"`), não o que o repo diz.
- **Publicação para fora** (post, email enviado, evento Nostr, release, comentário público) não se desfaz → registar na memória o quê · onde · quando · id/URL, e linha na Higiene.

---

## PASSO 3 — Feedback do projecto (inline, auto-extract)

Analisar a conversa e extrair aprendizagens com impacto em sessoes futuras:

### A. Terminologia clarificada
Expressoes que causaram ambiguidade, com definicao correcta.

### B. Regras e preferencias descobertas
Constraints ou comportamentos que se revelaram importantes.

### C. Limitacoes de ferramentas
Limitacoes documentaveis de modelos, MCPs, ou APIs que afectaram o resultado.

### D. Templates ou formatos validados
Estruturas testadas e aprovadas durante a sessao.

### E. Correccoes de workflow
Passos do processo do projecto que foram corrigidos ou melhorados.

**Destinos:**
- Glossarios, regras, templates, limitacoes, contexto estrutural → `memory/projects/<nome>/` — **destino por omissao**: regra → `normas.md` · caminho → `pastas.md` (e frontmatter do index, se for o principal) · porta/hábito/arranque → `config.md` · credencial → `acessos.md` (**só o sítio**, nunca o valor) · o resto → a área da tarefa (ou `geral.md`). Ficha plana: a secção relevante
- `CLAUDE.md` do projecto → **no máximo 1 linha por `/save`, e só se a regra tem de valer em TODAS as sessões do projecto** (≤250 chars, sem caminhos de disco): a regra em 1 frase + ponteiro `→ memory/projects/<nome>/`. Antes, `grep -n -i "<tema>" CLAUDE.md` — já há linha sobre o tema → **substituir ou fundir, nunca acrescentar outra**. Na dúvida, vai para a memória do projecto: `CLAUDE.md` é contexto pago em cada mensagem, a memória só quando se lê. O `guard-claudemd.js` bloqueia linhas gordas em **todos** os `CLAUDE.md` (decisao de 2026-09-15) — se disparar, o detalhe muda de sitio, o hook nao se contorna

**Regra:** so escrever o que a sessao trouxe de novo. Edicoes cirurgicas — nao reescrever ficheiros inteiros. Se nao ha nada relevante, saltar este passo silenciosamente.

**Regra de validade — receitas e estado vivo.** Ao registar uma receita de comando (deploy, rsync,
FTP, invocação de CLI), guardar **as condições em que foi validada**: nº de casos, tamanho/tipo de
ficheiro, versão da ferramenta, data. Amostra única marca-se `validado 1×` **e leva ao lado «teste
de controlo antes do 1.º uso real»** — uma receita `validada 1×` foi seguida como facto e estava
errada na causa. Uma receita de FTP
generalizada a partir de um só ficheiro grande foi seguida como facto e partiu um site. O mesmo vale
para afirmações sobre estado vivo (contagens, IDs, credenciais): datar e marcar como perecível — o
`/resume` (2c) lista-as para revalidação.
**Escrita num sistema externo por via não óbvia → regista-se a receita, não só o efeito.** Se a sessão escreveu
numa loja, CMS, painel ou API por um caminho que não é o documentado (ex.: GraphQL interno do admin com o CSRF da
sessão, depois de a CLI e o editor em massa falharem), a memória do projeto leva **onde · como · pré-condições**
(sessão/token necessário, o que falhou antes). Sem isso a sessão seguinte redescobre a via às apalpadelas.

**Cliente com histórico: o `DESIGN.md` não se escreve de memória.** Antes de registar tokens,
paleta ou regras de marca de um cliente que já teve entregas, `ls` à pasta das entregas anteriores e
**ler o código-fonte dos finais aprovados** (o HTML/PSD/AI que o cliente assinou), não o resumo da
sessão nem a descrição de um agente. Um token escrito a partir de memória é um facto inventado
(`soul.md`, Hard Limits) e passa despercebido porque compila na mesma. Sem fonte lida →
`TODO: token em falta`, nunca um valor plausível.

**Marcador literal, obrigatório: `⏳(verificado YYYY-MM-DD)`** logo a seguir à afirmação perecível.
Sem um marcador fixo nada é greppable e "marcar como perecível" fica sem efeito — com ele,
`grep -rn "⏳" memory/` devolve a lista. Escrito aqui, lido pelo `/resume` (2c).
**O marcador leva o comando literal que o provou:** ``⏳(verificado YYYY-MM-DD) `<comando>` ``. A data diz
quando se verificou, não como — uma afirmação de defeito falsa durou 3 dias com a prova do erro escrita
ao lado. Sem comando registado, o `/resume` trata-a como «por revalidar».
**Config de app de terceiros: o ✅ exige o efeito, não o ficheiro.** «Escrevi e está lá» é um comando que passa e não
prova nada — uma secção inteira esteve `✅(verificado)` a descrever uma config de RetroArch escrita numa pasta que a app
não lê (`/sdcard/RetroArch/` em vez de `/sdcard/Android/media/com.retroarch/RetroArch/`): sem erro, sem aviso. O caminho
tem de sair de um comando sobre a **config da própria app** (`grep <chave_de_directorio> <config-da-app>`) e o marcador
leva o **efeito observado** (a app a carregar aquilo), nunca o `ls` ao ficheiro acabado de escrever.
**Obrigatório por classe, não por juízo:** afirmação sobre **admin, checkout, pagamento, email ou cron** («funciona na live»,
«envia», «corre às 3h») leva **sempre** `⏳` — é o estado que parte sem ninguém tocar no código. Idem o `Why:` de um cabeçalho de
memória: só razão **estrutural** (porque existe); facto vivo lá dentro leva `⏳` ou sai para o corpo.
**Nota antiga descoberta errada → não se apaga, marca-se:** `❌(corrigido YYYY-MM-DD: <o certo>)` logo a seguir — o erro fica
greppable e ninguém o reintroduz a partir de uma cópia antiga.
**Falhas conhecidas registam-se por nome** (`Classe::metodo`, `ficheiro › teste`), nunca por contagem («3 testes falham»): uma
contagem igual esconde uma falha nova que trocou com uma resolvida.
**Dados de demo com carimbo** (seed com datas, «há 3 dias») → registar **como se refrescam** (comando/seed); sem isso parecem regressão semanas depois.

---

## PASSO 4 — Feedback do JOCA (auto-extract, alimenta /upgrade-joca)

Verificar se a sessao revelou gaps no toolkit JOCA:

| Categoria | Exemplos |
|-----------|----------|
| `workflow-gap` | Passo em falta num processo que causou retrabalho |
| `doc-gap` | Skill/comando documentado diferente do que realmente faz |
| `missing-skill` | Skill ou comando que devia existir e nao existe |
| `skill-improvement` | Skill existente que precisa de melhorias |
| `tool-reliability` | MCP ou ferramenta que falhou, timeout, bloqueado |
| `discovery-gap` | Info que devia ser pedida upfront mas nao foi |
| `command-improvement` | Comando existente que precisa de ajuste |

Se encontrar items, escrever `memory/feedback/session-<YYYY-MM-DD>-<HH-MM>-<slug-projecto>.md` com frontmatter:

```yaml
---
type: feedback-joca
source: auto-extracted-by-save
session_date: <YYYY-MM-DD>
project: <nome>
---
```

Cada entry com: `**Categoria:** ... | **Severidade:** critical/high/medium/low | **Descricao:** ... | **Componente afectado:** ... | **Fix sugerido:** ...`

**⚠ O slug do projecto no nome não é decoração — é o que impede a colisão.** O `<slug-projecto>` é o
do PASSO 1. A 2026-08-18 duas sessões concorrentes (projecto A e projecto B) escreveram no mesmo nome: o
ficheiro das 19:05 foi **sobrescrito às 20:04** e os 6 items originais só se recuperaram porque ainda
estavam no contexto. O minuto no nome **não protege nada** — a segunda sessão carimbou uma hora
diferente da hora real de escrita. Antes de escrever, `test -f <path>`; se existir, sufixo `-b`,
depois `-c`. **A regra "Edit, nunca Write" do PASSO 2 não cobre estes ficheiros** — nascem de raiz,
portanto a protecção é o nome único + o `test -f`.

Se nao ha nada relevante, nao criar ficheiro. Nunca perguntar ao utilizador.

---

## PASSO 5 — (removido 2026-09-15: grafos de código retirados do JOCA)

---

## PASSO 6 — Reindexar o toolkit (se o JOCA foi alterado)

Só corre se ficheiros em `.claude/skills/`, `.claude/agents/` ou `.claude/commands/` foram modificados nesta sessao.

```bash
bash .claude/scripts/compile-bridges.sh 2>/dev/null || true
```

Se foram **adicionadas, renomeadas ou removidas** skills/agents/comandos, o inventario derivado fica a mentir. Realinhar **agora**, nao noutro comando:

```bash
python .claude/scripts/build-skill-index.py    # macOS/Linux: python3 — regenera memory/SKILL_INDEX.json
node   .claude/scripts/joca-doctor.mjs         # apanha paths/indices mortos (exit 1 se houver ✗)
```

Depois, edicao cirurgica em `memory/INDEX.md` (contagens + a linha do componente novo) e, se for um comando novo, na tabela de `.claude/commands/help-joca.md` — **nunca** no `JOCA_Brain/CLAUDE.md`, que só guarda o ponteiro. Nada do `/save` escreve em `.claude/rules/` (auto-carregadas): doutrina nova vai para `.claude/reference/`. **Um componente que nenhum indice expoe e um componente invisivel** — o matching por relevancia nunca lhe chega.

> Nota historica: isto era o antigo `/sync-questionnaires`, que auditava questionarios de formulario. Os questionarios deixaram de existir (o levantamento passou a ser conversa — ver `/start`), portanto o que sobra e reindexar, e o sitio certo e aqui.

---

## PASSO 7 — ~/CLAUDE.md (quase sempre: NAO tocar)

⚠ **Este passo ja foi a origem de tres limpezas.** O `~/CLAUDE.md` e **so regras** e guarda **so o nome**
do projecto. Estado, stack, caminhos, gotchas, credenciais e datas **nunca** entram la.

Memoria em 3 niveis — escreve no nivel certo:

| Nivel | Ficheiro | O que escreves |
|---|---|---|
| 1 | `~/CLAUDE.md` | **so o nome**, e so quando o projecto e **novo** ou deixou de existir |
| 2 | `memory/INDEX.md` | 1 linha de resumo + caminhos (um por maquina) |
| 3 | `memory/projects/<slug>/` (index + áreas) | **tudo o resto** — e o destino por omissao |

Decisao: projecto novo → acrescenta **o nome** a lista do nivel 1 + linha no nivel 2 + ficheiro no nivel 3.
Orçamento lido de `guard-claudemd.js` (`MAX_LINHA = 250`, `MAX_CRESCIMENTO = 200`): linha nova com mais de 250 chars e caminho
é bloqueada; acima do orçamento do ficheiro, o global só cresce até 200 chars por edição — o nome cabe, uma descrição não.
Categoria/dono do projecto indeterminável pela sessão → **não adivinhar** o grupo do nivel 1: fica pendente no PASSO 8.
Projecto que ja existe → **nao acrescentes ao nivel 1**, escreve nos niveis 2 e 3. **Excepção única: podar.** Linha de nivel 1
que carrega estado (e esse estado é falso) reduz-se a nome + ponteiro (`→ memory/projects/<slug>/`) — encolher é permitido, acrescentar não.

Mudou de directorio ou de stack? Isso e nivel 2/3, nao nivel 1.
O hook `guard-claudemd.js` bloqueia linhas gordas com caminhos em qualquer `CLAUDE.md` (global **e** de projecto) — se ele disparar,
a resposta e mover o texto para `memory/projects/<slug>/`, nunca contornar o hook. Linhas gordas **antigas** sao imunes (o hook so ve
linhas novas): `node <JOCA_ROOT>/JOCA_Brain/.claude/hooks/guard-claudemd.js --auditar <CLAUDE.md>` lista-as → pendente no PASSO 8.
Cada edicao que passa deixa copia carimbada em `JOCA_Brain/.joca/backups/claudemd/` (o `~/CLAUDE.md` nao esta em git).

---

## PASSO 8 — Relatorio

**Orçamento do contexto de arranque — comparar com a fotografia do PASSO 1:**

```bash
[ -s /tmp/joca-save-bytes-<slug>.txt ] || echo "SEM FOTOGRAFIA — PASSO 1 saltado: reportar o total, sem delta"
read -r antes _ < /tmp/joca-save-bytes-<slug>.txt      # 1.º campo; sem `awk` (o expansor troca os `$N`)
depois=$(wc -c ~/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/CLAUDE.md <JOCA_ROOT>/JOCA_Brain/.claude/rules/*.md \
  <raiz-projecto>/CLAUDE.md 2>/dev/null | tail -1 | { read -r n _; echo "$n"; })
echo "arranque: $antes → $depois ($((depois-antes)) bytes)"
```
Cresceu mais de **500 bytes** (≈ uma linha acentuada de 250 chars + um nome no `~/CLAUDE.md`) → não fechar: mover o excesso para `memory/projects/<slug>/` (ou `reference/`) e medir outra vez.
O número entra sempre no relatório — é o que torna o inchaço visível sessão a sessão.

**Medir a higiene do PROJECTO antes de escrever o relatório** — o `/save` guarda a memória, não o
código, e uma sessão já fechou com o trabalho todo por commitar sem que o relatório o dissesse:

```bash
git -C <raiz-projecto> status --short | wc -l                      # total sujo
git -C <raiz-projecto> status --short | grep -c '^??'              # untracked
git -C <raiz-projecto> status --short | head -20                   # o quê, em concreto
git -C <raiz-projecto> log --oneline -3                            # contexto do diagnóstico
git -C <raiz-projecto> fetch --quiet
git -C <raiz-projecto> rev-list --count @{u}..HEAD                 # commits por publicar (só neste disco)
git -C <raiz-projecto> rev-list --count HEAD..@{u}                 # behind
git -C <raiz-projecto> ls-remote --heads origin                    # vs `git branch`: ramos locais sem push
gh pr list --state open                                            # PRs por fundir (se o remote é GitHub)
ls memory/checkpoints | sort -f | uniq -di                         # (Brain) pastas que só diferem em maiúsculas
```

**Processos que a sessão arrancou e continuam vivos — listar, NUNCA matar.** O `/save` fecha e as
portas ficam ocupadas para a sessão seguinte. Só contam os processos que **esta sessão** arrancou
(dev servers de gate, builds, túneis): um processo que já lá estava é do utilizador, não é resíduo.
Uma sessão real deixou 5 servidores Next (portas 3500-3504) e só pararam porque alguém se lembrou.

```bash
lsof -nP -i :<porta> -sTCP:LISTEN            # [mac] uma linha por porta arrancada nesta sessão
# rc=0 + linhas COMMAND/PID = vivo · rc=1 e saída vazia = já parou
# [win] netstat -ano | findstr :<porta>   ·   [linux] ss -lptn 'sport = :<porta>'
```

⚠ **Matar um processo do utilizador é irreversível → é gate, não higiene** (`rules/task-intake.md`
§Segurança). O relatório **lista** com o comando de paragem ao lado; a decisão é do utilizador.
⚠ **As portas 7491 (backend) e 7492 (frontend) são do JOCA OS** — não são resíduo de sessão e
**nunca se tocam sem confirmação explícita** (portas por omissão do JOCA OS). Aparecendo na lista,
marcam-se como «JOCA OS — não tocar».

Contagem > 0 → linha **pendente crítico** no bloco Higiene. Repetir por cada sub-repo detectado no
PASSO 2 — o `git status` do repo-pai não vê os aninhados.
**Commitar = `git add` por caminho explícito, nunca `-A`/`.`**: antes, `git diff -- memory/INDEX.md CLAUDE.md PROGRESSO.md` —
ficheiros partilhados trazem alterações de outras sessões que não são deste commit. **Push só depois do `fetch`**; behind > 0 →
não resolver conflitos dentro do `/save`: no Brain e no projecto listar como pendente (`git pull` fora do `/save`).
**Commitar é `git commit --only <caminhos>`.** O `git diff --cached --quiet` não protege contra o índice já sujo:
ficheiros staged por outra sessão entram no commit à mesma — custou 3 deleções alheias, desfeitas com `reset --soft`.
O `--only` commita os caminhos dados e ignora o resto do índice.
**Assets grandes em LFS** (`git add` de mais de ~20 MB: packs de modelos, `.blend`, vídeo) → `git add` e `git commit`
em `run_in_background`: em primeiro plano estouram o timeout de 2 min do Bash a meio (vivido no Windows com ~50 MB).
**Commits por publicar ou ramos sem push = trabalho só neste disco:** o número entra na Higiene **e repete-se no próximo gate
destrutivo** da sessão (`rm`, `reset`, reinstalação, troca de máquina) — um aviso dado uma vez no relatório não chega lá.

```
SAVE — <nome-projecto>
═══════════════════════

Estado:
  ✓ memory/projects/<nome>/<area>.md + index.md (mini-estado) actualizados
  ✓ Decisoes: N registadas | Pendentes: N items

Feedback projecto:
  ✓ CLAUDE.md — 0 ou 1 linha (regra + ponteiro; o detalhe foi para memory/projects/)
  ✓ Arranque: <antes> → <depois> bytes (<delta>; tecto +500)
  ✓ memory/projects/<nome>/<ficheiro>.md — contexto novo adicionado
  — Sem aprendizagens novas nesta sessao

Feedback JOCA:
  ✓ memory/feedback/session-<data>.md — N items (X critical, Y high)
    → Considerar /upgrade-joca
  — Sem gaps detectados

Higiene (só as linhas que se aplicam):
  Git do projecto: <N> ficheiros por commitar, <M> untracked  (git status --short)
  [⚠ PENDENTE CRITICO: trabalho por commitar no projecto — <lista curta>]
  [⚠ Só neste disco: <N> commits por publicar · ramos sem push: <nomes> · behind <M> → git pull]
  [⚠ PRs abertos por fundir: <#n título>]
  [⚠ directorio* quebrado: <campo> → <path> · drift decisão↔directorio: <id>]
  [⚠ Checkpoints em pastas que só diferem em maiúsculas: <A> vs <a> — `git mv A A.tmp && git mv A.tmp a` (2 passos: o disco do Mac não distingue)]
  [⚠ Processos desta sessão ainda vivos (NÃO matar — gate): <porta/PID/comando> · parar com <cmd>]
  [⚠ Publicado para fora (irreversível): <o quê · onde · id/URL>]
  [⚠ Frase sem referente: «<frase>» — guardado só o que a sessão prova]
  [⚠ Projectos sem memória (PASSO 1): <paths>]
  [⚠ Projecto sem git: destino de backup <existe? nº ficheiros origem vs destino>]
  [⚠ Entregável com referências mortas: <paths>]
  [⚠ Cópias irmãs do ficheiro corrigido por propagar: <paths>]
  [⚠ Derivados desactualizados (prévia/screenshot/poster): <paths>]
  [⚠ Contradição entre documentos: <termo> — <ficheiro:linha> vs <ficheiro:linha>]
  [⚠ Memória: <pastas ignoradas> não vão por git — tirar do .gitignore]
  [⚠ Limpeza por privacidade: working tree limpo, histórico com N commits — opções em 2d-e]
  [⚠ Artefactos no scratchpad citados na memória: <paths> — mover para o projecto]

Extras:
  [✓ Bridges recompilados]
  [✓ SKILL_INDEX + INDEX.md realinhados | joca-doctor limpo]
  [✓ ~/CLAUDE.md — nome do projecto novo acrescentado]

Sessao guardada.
```

---

## Notas

- ZERO perguntas. Tudo inferido da sessao. Frase do utilizador sem referente claro («guarda aquilo») → guardar o que a sessão **prova** e listá-la na Higiene, nunca perguntar.
- Feedback do projecto (PASSO 3) e do JOCA (PASSO 4) sao auto-extraidos aqui — os antigos comandos `/feedback-projeto` e `/feedback-joca` foram removidos (fundidos neste `/save`).
- Se nao ha nada a guardar num passo, saltar silenciosamente — nao reportar "nada encontrado" para cada seccao vazia.

# /save — PASSO 2d: estado que vive fora do git

Texto integral das alíneas do PASSO 2d de `.claude/commands/save.md` (comandos, tabelas de leitura e casos reais).
O comando guarda uma linha por alínea; as letras são as mesmas.

## Índice
- a) Artefacto-ponte desatualizado
- b) Cloud-sync não é sincronização de projeto
- b-bis) Projeto sem git: verificar o destino
- c) A memória do Brain viaja por git? — derivar
- d) Um aviso na documentação não é um fix
- e) Remover do working tree não remove do histórico
- f) O scratchpad da sessão não sobrevive à sessão
- f-bis) O entregável tem dependências
- f-ter) Ficheiro corrigido com cópias irmãs (e derivados)
- f-quater) Contradições entre documentos do próprio projeto
- g) Estado que vive fora da máquina (infra remota)

---

Guardar a memória não serve de nada se o **conteúdo** do projecto ficar para trás. Antes de fechar:

**a) Artefacto-ponte desactualizado.** Se o `CLAUDE.md` do projecto declarar um artefacto de estado
exportável (padrão `snapshot/`, `*.sql`, `dump/`, `backup/`), comparar o `mtime` do artefacto com o do
estado vivo (volume Docker, BD local, `wp-content/uploads`). Artefacto mais velho → **re-exportar**
(reversível, sem perguntar) ou reportar como pendente **crítico** no PASSO 8.
Estado vivo inclui o que a app guarda **na HOME**: `~/.<app>/` e `~/Library/Application Support/<app>` (Windows: `%APPDATA%\<app>`)
que o projecto declare → inventariar na memória (path + o que lá vive); **nunca apagar sem o utilizador** — é dado, não cache.
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

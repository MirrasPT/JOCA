---
name: file-organization
description: "Audita uma pasta de ficheiros (assets de design, documentos, exports) e produz um plano de renomeação/reorganização com conteúdo REALMENTE verificado, não adivinhado pelo nome. MUST be invoked when the user says: organizar pasta, arrumar ficheiros, renomear ficheiros, limpar pasta de assets, plano de organização. SHOULD also invoke when: pasta de cliente desorganizada, nomes tipo v1/v2/op1, duplicados de ficheiros, ficheiros soltos na raiz."
triggers: organizar pasta, arrumar ficheiros, renomear ficheiros, limpar pasta, plano de organização, organização de ficheiros, duplicados, ficheiros soltos, nomear assets, rename files, clean up folder, file organization
chain: nenhum — termina no plano aprovado + execução; não encadeia automaticamente
---

# File Organization

Organizar uma pasta de ficheiros reais (design, docs, exports) — não é refactor de código. O valor está em **verificar o conteúdo antes de renomear**, nunca inferir pelo nome actual, e nunca apagar sem aprovação explícita.

## Quando usar

Pedido do tipo "organiza esta pasta", "isto está uma bagunça", nomes genéricos (`v1/v2/v3`, `op1-op4`, `IMG_1234`), pasta de cliente com anos de material acumulado, exports duplicados em formatos diferentes.

**Não é esta skill:** organizar código-fonte (isso é refactor — `laravel-refactor`/`tech-debt-auditor`), nem arrumar `.claude/skills`/repos de código (estrutura já é regida pelo `CLAUDE.md` do projecto).

## Workflow

### 1. Recon — mapear zonas independentes

`find`/`ls` para perceber a árvore e o volume antes de decidir método:
```bash
find . -type f -not -name ".DS_Store" | wc -l
find . -maxdepth 3 -type d
```
Cada subpasta de topo (por projecto/cliente/marca) é uma **zona independente** — candidata a fan-out se o volume justificar (ver secção 6).

### 2. Detectar zonas de exclusão ANTES de propor qualquer rename

Procurar sinais de pipeline activa que renomear parte:
- Scripts que leem nomes fixos: `build.py`, `Makefile`, `package.json` com paths hardcoded, HTML/CSS que referencia asset por nome exacto.
- Pastas `_src/`, `_build/`, `dist/`, `_backup/` junto de um gerador.
- Se existir → **marcar a zona como intocada no plano**, explicar porquê (nome exacto lido por X), e organizar só à volta dela. Não pedir para confirmar — é dado objectivo (grep encontra a referência).

**Pipeline não é a única zona sensível — o registo de projecto também é, e numa pasta pessoal é o mais provável.** Antes de propor seja o que for, grepar os caminhos a arrumar nos ficheiros que os citam:
```bash
grep -rn "<nome da pasta>" ~/CLAUDE.md -r <JOCA_Brain>/memory/projects/
```
(`<JOCA_Brain>` = a pasta `JOCA_Brain` da tua instalação; no Windows, o `~/CLAUDE.md` resolve a partir do Git Bash.)
- Cada acerto é **zona sensível**: o plano diz que ficheiros teriam de ser actualizados se a pasta se mexer. Um caminho citado na memória e movido em silêncio deixa a memória a apontar ao vazio — `~/CLAUDE.md` e `memory/projects/<projecto>.md` ficaram a apontar a `~/Downloads/<pasta-do-projecto>/SVG` depois de a pasta desaparecer.
- Num caso real a pasta de um projecto só escapou ao rename porque alguém se lembrou de grepar o `~/CLAUDE.md` — não porque a skill o exigisse. Passou a exigir.

### 3. Abrir o conteúdo real — nunca renomear pelo nome

Regra dura (soul.md): **design tokens contam como factos** — o mesmo vale aqui para nomes de ficheiro. Um nome plausível não é verificação.
- Imagens/SVG/PDF pequenos → `Read()` directamente (o Read tool renderiza imagem/PDF).
- `.ai`/PSD grandes (>15MB) e binários não renderizáveis → não abrem; inferir por metadata (tamanho, data, nome-irmão já verificado) e marcar explicitamente **"não verificado visualmente"** no plano. Nunca fingir que foi aberto.
- Ficheiros `.md`/`.txt`/`.rtf` → ler o conteúdo real, não só o nome.
- Nomes tipo `v1/v2/v3`, `op1-op4`, `(1)/(2)` **quase sempre escondem uma diferença real** (cor, fundo, variante, versão descartada vs escolhida) — abrir todos os candidatos da série e nomear pela diferença encontrada, não manter o índice genérico.

### 4. Detectar duplicados exactos

`md5`/`md5sum` para pares que parecem redundantes (mesma pasta com nomes diferentes, ou pastas irmãs com o mesmo conteúdo):
```bash
md5 "caminho/a" "caminho/b"        # [mac]
md5sum "caminho/a" "caminho/b"     # [win] Git Bash — não há `md5`
```
- **Nunca apagar automaticamente.** Listar o par, apontar qual parece a cópia canónica (mais completa/recente/melhor nomeada) e deixar a remoção pendente de aprovação explícita do utilizador — mesmo que ele tenha aprovado "o plano" em bloco. Apagar é irreversível; renomear/mover não é.
- Ficheiros de metadata órfã do macOS (`._*`, `.DS_Store`) → sinalizar, não abrir, não renomear.

**Provar que algo NÃO tem duplicado é a afirmação inversa — e é essa que autoriza apagar.** Uma busca que devolve vazio por não atravessar um link lê-se exactamente como um ficheiro que não existe:
- **[mac]** `mdfind -name "<nome>"` (indexa o `~/Library/CloudStorage/`) ou `find -L`. `~/Google Drive`, as pastas de outros clientes de sync e `~/Library/Mobile Documents` são muitas vezes **symlinks** — um `find` sem `-L` devolve **vazio sem erro**.
- **[win]** `Get-ChildItem -Recurse -Force -FollowSymlink -Filter "<nome>"` por cada raiz candidata. Sem `-FollowSymlink`, junctions e symlinks de directório são saltados em silêncio (medido numa máquina Windows: 0 acertos sem a flag, 1 com ela — mesmo modo de falha do `find` sem `-L`, que aqui também dá 0). **Não há equivalente do `mdfind`**: o Windows Search não expõe CLI, portanto as raízes enumeram-se à mão — não há atalho indexado.
- Caso real: a pasta de preview de um cliente foi declarada "a única cópia que resta" depois de um `find ~/"Google Drive" -maxdepth 6` vazio. Havia backup completo no Drive — 39 ficheiros, superconjunto dos 22 locais.

### 5. Cobertura de backup — o que ali dentro não tem rede

Arrumar aumenta a probabilidade de apagar, portanto é aqui que se pergunta **o que não tem cópia**. Para cada subpasta de topo, antes do plano:
```bash
git log --oneline -- "<pasta>" | head -1      # vazio = nunca esteve em git
grep -n "<pasta>" <script de backup/sync>     # se houver: lista de origens (rsync, robocopy, rclone…)
```
⚠ **O script de backup pode não existir nesta máquina** (scripts pessoais nem sempre viajam entre
máquinas). Ficheiro ausente não prova pasta desprotegida: confirma com `ls <script>` e, se faltar, diz
**por verificar**, não **SEM REDE**.

- Sem git **e** fora do script de sync → marcar **SEM REDE** no plano, em destaque, e propor a cópia **antes** de qualquer movimento. Não é um aviso a acrescentar no fim; é um passo que trava o plano.
- **Estar no script não é estar copiado.** Um script de sync manual pode nunca ter corrido — num caso real, uma pasta esteve semanas na lista de origens sem nunca ter chegado ao destino. Confirmar o ficheiro **no destino** (`ls` / `Get-ChildItem` na pasta da cloud), não a linha na lista de origens.
- **Estar na memória não é estar no script.** A memória de um projecto dizia "sem git e fora do script de sync" há semanas. Os 18 ficheiros (4 SVG, 4 3MF já fatiados, uma ilustração, o zip de 5,4 MB) foram apagados uma hora depois de uma arrumação com verificação de conteúdo exemplar. O aviso existia e nenhum passo o accionava.
- **Lixo, Time Machine e snapshots não são rede até serem verificados** — naquele caso o Lixo estava vazio, o Time Machine dava `No destinations configured` e não havia snapshots APFS: a perda foi definitiva. Equivalente [win]: Reciclagem, Histórico de Ficheiros e pontos de Restauro do Sistema — mesma regra, verificar antes de contar com eles.

### 6. Fan-out se o volume justificar

Regra de paralelismo do `task-intake.md`: **≥2 zonas independentes → despachar em paralelo**, um `Agent()` por zona, no mesmo turno. Cada agente:
- Recebe a zona (path) + a convenção de nomes a aplicar + a lista do que NÃO tocar (pipelines já identificadas no passo 2).
- Abre o conteúdo real de cada ficheiro da sua zona (passo 3).
- Devolve Markdown: `caminho actual → caminho/nome proposto` + razão, agrupado, mais secção de duplicados encontrados.
- **Não move nem apaga nada** — só inventaria. A execução acontece depois, centralizada, quando o plano estiver aprovado.

Zonas pequenas (poucos ficheiros óbvios) fazem-se inline, sem agente — não vale o custo de ~15x tokens para 3 ficheiros.

### 7. Convenção de nomes (default, ajustar ao projecto)

- minúsculas, hífen, sem espaços/acentos **no nome do ficheiro** (o conteúdo pode ter acentos);
- idioma segue o resto do projecto (não traduzir nomes de marca/produto);
- preservar extensão e semântica existente se já for uma convenção coerente — só corrigir o que estiver mesmo errado (typo, ambíguo, ou nome que não bate com o conteúdo);
- se uma pasta/projecto já tiver convenção própria e consistente (confirmado por amostragem, não suposição), **não a reescrever só por preferência pessoal** — só sinalizar o que quebra o padrão.

### 8. Apresentar o plano

Por omissão: **texto/tabelas directamente no chat**, agrupado por zona, com secção de duplicados destacada no fim. Não publicar como Artifact salvo pedido explícito do utilizador — plano é para leitura e aprovação rápida, não é um deliverable visual.

Incluir sempre: contagem total revista, quantos renames propostos, quantos duplicados, o que ficou intocado e porquê, as **zonas sensíveis** achadas no passo 2 (com os ficheiros de memória a actualizar) e a lista **SEM REDE** do passo 5 — esta em primeiro, porque é a única parte do plano que pode ficar sem remédio.

### 9. Executar (só depois de aprovação)

- Renomear/mover é reversível → executar sem pedir confirmação extra por ficheiro, uma vez que o plano em si foi aprovado.
- Apagar duplicados → **1 confirmação explícita por grupo**, mesmo que "aplica o plano" tenha sido dito em bloco — a aprovação do plano cobre a reorganização, não a remoção, salvo o utilizador dizer isso de forma inequívoca.
- **Gotcha de filesystem case-insensitive** (macOS local, e a maioria dos mounts de Google Drive/iCloud): `mv Ficheiro.md ficheiro.md` (rename só de maiúscula/minúscula) é tratado como o mesmo ficheiro e o `mv` falha ou não faz nada — silenciosamente, sem erro visível. Passar sempre por um nome temporário:
  ```bash
  mv -n "ANALISE.md" "__tmp_analise.md"
  mv -n "__tmp_analise.md" "analise.md"
  ```
- Usar `mv -n` (no-clobber) sempre — nunca sobrescrever um ficheiro existente sem intenção explícita (regra dura: escrever por cima de um ficheiro existente é irreversível).
- Verificar no fim: `find` a árvore outra vez e confirmar que não sobrou nenhum nome antigo fora das zonas marcadas como intocadas.
- **Renomear cega o critério de remoção seguinte.** Gravar o mapa `nome antigo → nome novo` num `_RENOMEACOES.md` na pasta (ou na memória do projecto) no mesmo passo do `mv`. Caso real: `teste/`→`felinos` e `teste_2/`→`canis` numa ronda; na seguinte, «apaga qualquer teste» deu `find -iname "*test*"` → **zero**. Apagar por critério procura pelo que a coisa **É** (conteúdo, mapa), não pelo nome que ainda tem.
- **Apagar em duas fases: quarentena → conferir → `rm`.** Mover primeiro para `_QUARENTENA_<motivo>/` com log de movimentos (`_log_movimentos.json`, origem de cada ficheiro); `rm` só depois de conferido e da confirmação por grupo. Provado em 733 ficheiros (uma biblioteca de música, 2026-08-18).
- **Guardas ANTES de qualquer `move` em lote** (script, não à mão), a correr como `assert` e a abortar o lote inteiro: destino não existe · todas as origens existem · zero colisões de nome final · `keep ∩ drop = ∅`. No fim, o destino confere com o plano (contagem).

### 10. Migrar entre storages/discos (cloud→cloud, disco→disco)

Receita medida (migração entre dois serviços de cloud, 2026-08-23) — a origem só se apaga quando uma re-listagem prova que nada ficou por copiar:
1. **Dry-run primeiro** — `rsync -a --dry-run --itemize-changes <origem>/ <destino>/` [mac] · `robocopy <origem> <destino> /E /L` [win].
2. **Excluir recriáveis** (`node_modules`, `vendor`, `dist`, `build`, caches) — **nunca** `.git`, que se preserva.
   **Projecto com git:** antes de copiar, `git status --short` + `git status --ignored --short` — o que
   não está commitado e o que é ignorado (`.env`, uploads, dados locais) só existe neste disco. Antes de
   apagar a origem, **listar o que a exclusão deste passo deixou de fora** (`rsync -a --dry-run
   --itemize-changes` sem os `--exclude` [mac] · `robocopy /E /L` sem `/XD` [win]) e confirmar que
   cada linha é mesmo recriável (2026-09-26).
3. **Copiar.** [win] o `robocopy` sai 0-7 em sucesso (1 = «copiou ficheiros»); só ≥8 é erro — validar pelo log, não pelo exit code.
4. **Re-listar:** repetir o dry-run; tem de devolver **0 por copiar**. Contagem origem vs destino (`find … -type f | wc -l`) com os dois números no relatório.
5. **Só então apagar a origem** — e por grupo, com confirmação (passo 9).
- Dados pessoais nunca vão para disco partilhado (Shared drive) sem gate de 1 linha.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Renomear pelo nome do ficheiro sem abrir | Abrir o conteúdo real (imagem/PDF/md) antes de propor nome |
| Apagar duplicados porque "o plano" foi aprovado em bloco | Confirmação explícita por grupo de duplicados, sempre |
| Renomear ficheiros dentro de uma pasta `_src`/`_build` com gerador | Detectar a pipeline primeiro (grep por nomes fixos em scripts), marcar como intocada |
| Fechar a arrumação com nomes bonitos e nenhuma cópia nova | **Arrumar ≠ proteger** — nomear bem um ficheiro não lhe dá backup. Passo 5 por subpasta; **SEM REDE** copia-se antes de mexer |
| Declarar "é a única cópia que resta" com uma busca que devolveu vazio | `mdfind` [mac] · `-FollowSymlink` [win] · `find -L`; uma busca que não atravessa o link lê-se exactamente como um ficheiro que não existe |
| Procurar zonas de exclusão só por pipeline (`_src/`, `Makefile`) | Grepar também `~/CLAUDE.md` e `memory/projects/` (recursivo) — numa pasta pessoal o registo de projecto é a zona sensível mais provável |
| `mv Nome.md nome.md` numa pasta do Google Drive/macOS | Passar por nome temporário — filesystem case-insensitive trata como o mesmo ficheiro |
| Publicar o plano sempre como Artifact | Chat por omissão; Artifact só se pedido |
| Manter `v1/v2/v3` genérico depois de já ter aberto e visto a diferença real | Nomear pela diferença (cor/fundo/variante), não pelo índice |
| Apagar por critério de nome depois de uma ronda de renames | Ler o `_RENOMEACOES.md`; procurar pelo que a coisa É, não pelo nome que ainda tem |
| Apagar a origem de uma migração porque o comando de cópia acabou | Re-listar com dry-run → 0 por copiar → só então apagar |

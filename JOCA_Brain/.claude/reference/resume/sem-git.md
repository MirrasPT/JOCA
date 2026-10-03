# /resume — 2b: pasta que não é repo git

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
   **Pasta em drive de nuvem → alternativa preferida:** clone de trabalho limpo em `<YOUR_PROJECTS_DIR>/<nome>`
   (`gh repo clone <owner>/<repo> <YOUR_PROJECTS_DIR>/<nome>`) sem mexer na pasta do Drive, que fica só para design —
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

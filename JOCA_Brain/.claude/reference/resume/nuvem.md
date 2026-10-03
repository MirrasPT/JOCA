# /resume — drives de nuvem

Lido a partir do `/resume` (passo 1, 2b e 2e) quando o path-alvo ou o repo está numa montagem de nuvem.

## Raízes de nuvem entre máquinas

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

## Repo em drive de nuvem

**Repo dentro de drive de nuvem → aviso à cabeça do resumo.** O `git log` responde e o `git status`/
`git diff` penduram (o File Stream materializa a árvore inteira), e `vendor/`/`node_modules/` in-place
tornam cada comando lento ou pendurado:
```bash
case "$PWD" in *CloudStorage*|*"Google Drive"*|*MEGA*|*Dropbox*|*OneDrive*) echo "⚠ REPO EM DRIVE DE NUVEM";; esac
```
Nesse caso: `git status` em `run_in_background`, nunca em primeiro plano; e **propor mover o código para
disco local** (`<YOUR_PROJECTS_DIR>/<nome>`) antes de qualquer comando de dependências — o Drive fica para design.

## Varrimento por data

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
  (clone de trabalho em `<YOUR_PROJECTS_DIR>/<nome>`).
- **Cópias a partir da cloud** (`rsync`, `cp -R`) arrancam logo em `run_in_background` — em primeiro
  plano estouram o timeout a meio e deixam a cópia parcial. Ficheiro isolado **>1 MB** a ler/processar
  → copiar para local em background primeiro.
- **I/O a UM ficheiro de cloud que pendura → controlo com um vizinho** antes de concluir
  (`head -c 100 "<outro ficheiro pequeno da mesma pasta>"`): o vizinho responde → é aquele ficheiro a
  materializar, espera-se; o vizinho também pendura → é o mount, reportar como bloqueio de ambiente.

# /resume — 2d: pasta local vazia, stub ou ilegível

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
repo remoto: não é um projecto novo, é esta máquina que ainda não o tem. Fluxo (repetível em
cada máquina nova):

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

Falha aqui → **não é o projecto, é o mount**: copiar a árvore para disco local (`<YOUR_PROJECTS_DIR>/<nome>`)
e apontar o bind para lá. Reportar no resumo como bloqueador de ambiente, não como projecto partido.

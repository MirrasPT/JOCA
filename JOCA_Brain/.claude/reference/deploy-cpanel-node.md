# deploy-cpanel — Node.js em cPanel (Passenger)

Referência da skill `deploy-cpanel` (núcleo Laravel/PHP em `.claude/skills/deploy-cpanel.md`). Ler quando a app é Node.js no Setup Node.js App / Passenger.

## Índice
- 1. Criar app no UI · 2. Startup file · 3. Variaveis de ambiente
- 4. Instalar dependencias (virtualenv) · 5. Restart · 6. Deploy via .cpanel.yml (Node.js)
- 7. Persistencia — SQLite e uploads
- 8. Deploy SEM shell (so FTP/File Manager) — o 503 em producao
- Gotchas Node.js/Passenger

## Node.js apps em cPanel (Passenger)

cPanel usa Phusion Passenger + CloudLinux Node.js Selector. Passenger substitui PM2/forever — nao correr process manager proprio.

### 1. Criar app no UI

cPanel → **Setup Node.js App** → Create Application:

| Campo | Valor |
|-------|-------|
| Node.js version | versao desejada (ex: 20) |
| Application mode | Production |
| Application root | `myapp` (relativo a `/home/username/`) — FORA de public_html |
| Application URL | dominio ou subdominio |
| Application startup file | `app.js` (ou `server.js`) — entry point da app |

Passenger cria automaticamente `~/myapp/public/` e `~/myapp/tmp/` e configura o reverse proxy.

### 2. Startup file

O ficheiro definido em "Application startup file" e o entry point. Regras criticas:

```js
// CORRECTO — Passenger injeta PORT via env
app.listen(process.env.PORT);

// ERRADO — porta hardcoded impede Passenger de funcionar
app.listen(3000);
```

Mudar o nome do ficheiro requer actualizar o campo no UI.

### 3. Variaveis de ambiente

Adicionar em cPanel → Setup Node.js App → **Environment variables** (nao commitar `.env`):

```
NODE_ENV=production
DB_PATH=/home/username/myapp/data/app.db
UPLOAD_DIR=/home/username/myapp/uploads
```

Passenger injeta-as no processo. Mais seguro que `.env` ficheiro e sobrevive a restarts. dotenv funciona como fallback mas e secundario.

### 4. Instalar dependencias (virtualenv)

Cada app tem um virtualenv isolado em `~/nodevenv/<app-root>/<version>/`. O comando exacto de activacao aparece na caixa azul da pagina de setup.

**Via SSH** (recomendado para reproducibilidade):
```bash
source /home/username/nodevenv/myapp/20/bin/activate && cd /home/username/myapp
npm ci
```

`npm ci` e preferido sobre `npm install` — instala exactamente o que esta no `package-lock.json`. Requer `package-lock.json` commitado.

Nunca correr `npm` bare fora do virtualenv — usa o binario errado.

O botao "Run NPM Install" no UI e equivalente mas menos determinista.

### 5. Restart

```bash
# Graceful restart (deploy-friendly, sem downtime)
touch ~/myapp/tmp/restart.txt
```

Passenger faz rolling restart na proxima request. Nao requer acesso ao UI. O botao Restart no UI e o equivalente manual.

### 6. Deploy via .cpanel.yml (Node.js)

```yaml
---
deployment:
  tasks:
    - export DEPLOYPATH=/home/username/myapp
    - /bin/cp -R app.js package.json package-lock.json src $DEPLOYPATH
    - source /home/username/nodevenv/myapp/20/bin/activate && cd $DEPLOYPATH && npm ci --omit=dev
    - /bin/mkdir -p $DEPLOYPATH/tmp
    - /bin/touch $DEPLOYPATH/tmp/restart.txt
```

**Regras criticas:**
- Tasks correm como `sh`, uma shell por linha — encadear venv-activate + cd + npm com `&&` na mesma linha
- `npm ci --omit=dev` para producao (exclui devDependencies)
- NAO copiar `node_modules/` do repo
- NAO incluir `data/` ou `uploads/` na lista de copia (ver Persistencia abaixo)
- O numero da versao no path do venv (`/20/`) deve corresponder ao seleccionado no UI

### 7. Persistencia — SQLite e uploads

Guardar base de dados e uploads no app root, FORA de `public/`:

```
~/myapp/data/app.db      <- SQLite
~/myapp/uploads/         <- ficheiros de utilizador
```

Nunca dentro de `~/myapp/public/` — seriam servidos directamente pela web.

**CRITICO para git deploy:** `.cpanel.yml` nao deve sobrescrever nem apagar estes directórios em cada deploy. Excluir da lista de `cp`. Adicionar ao `.gitignore`:
```
data/
uploads/
```

### 8. Deploy SEM shell (so FTP/File Manager) — o caminho que ja deu 503 em producao

Caso real: uma dependencia adicionada meses antes (`cookie-parser`) nunca foi instalada no servidor.
O codigo novo subiu, o `require` rebentou no arranque e a app foi a **503 em producao**. Sem shell nao
se corre `npm install` — o `node_modules` do app root e um **symlink para o nodevenv do CloudLinux**
(`~/nodevenv/<app-root>/<versao>/lib/node_modules`), nao uma pasta normal do projecto.

**1. Comparar `package.json` com o instalado no nodevenv ANTES de enviar codigo.** E o passo que
faltava. Listar o conteudo de `~/nodevenv/<app>/<versao>/lib/node_modules/` (File Manager ou FTP) e
confrontar com as `dependencies` do `package.json` local. Qualquer dependencia que so exista do lado
local = 503 garantido no proximo restart. Fazer isto **antes** do upload, nao depois do incidente.

**2. Sem shell, um pacote isolado pode ir por SFTP — se as deps dele ja existirem.** Copiar a pasta do
pacote de `node_modules/<pkg>/` local para o `node_modules/` do servidor funciona para pacotes
folha/sem dependencias proprias. Verificar as `dependencies` do `package.json` **do pacote** primeiro;
se tiver deps que nao estao la, o problema so muda de nome. Arvores grandes → pedir shell ou usar o
botao "Run NPM Install" do UI.

**3. Reiniciar = `touch <approot>/tmp/restart.txt`.** Nenhuma alteracao a codigo Node tem efeito sem
isto (o Passenger serve o processo antigo). Sem shell: criar/actualizar o ficheiro pelo File Manager,
ou o botao Restart do UI.

**4. O `.env` pode simplesmente nao existir — e nunca se envia um por cima.** Neste padrao as
variaveis vem de `SetEnv` no `.htaccess` (ou de Environment variables no UI), nao de um ficheiro. Um
`.env` local enviado "para garantir" sobrepoe-se a configuracao de producao com valores de
desenvolvimento — apagar do lote de upload. Ler o `.htaccess` do servidor para saber o que ja esta
definido antes de assumir que falta.

**5. Diagnosticar o 503 pelo `stderr.log` do app root.** O browser mostra so a pagina generica do
Passenger; a causa real (`Error: Cannot find module 'x'`, porta hardcoded, sintaxe) esta em
`~/<approot>/stderr.log`. Abrir esse ficheiro e o primeiro passo do debug, nao o ultimo — evita
adivinhar a partir do HTML de erro.

### Gotchas Node.js/Passenger

| Problema | Causa | Fix |
|----------|-------|-----|
| App nao inicia | Porta hardcoded | `app.listen(process.env.PORT)` |
| `npm` usa versao errada | Fora do virtualenv | `source .../nodevenv/.../bin/activate` antes de npm |
| Deploy apaga dados | `.cpanel.yml` copia data/ | Excluir data/ e uploads/ do cp |
| Restart nao funciona | tmp/ nao existe | `/bin/mkdir -p $DEPLOYPATH/tmp` no .cpanel.yml |
| Env vars em branco | Definidas em .env em vez do UI | Mover para Setup Node.js App → Environment variables |
| Versao Node errada no venv | Path `/18/` vs `/20/` | Verificar versao no UI e ajustar path no .cpanel.yml |
| **503 apos deploy** | dependencia no `package.json` que nunca foi instalada no nodevenv | Ler `~/<approot>/stderr.log`; comparar `package.json` com o nodevenv ANTES de enviar |
| `npm install` impossivel sem shell | `node_modules` e symlink para o nodevenv do CloudLinux | Botao "Run NPM Install" no UI, ou SFTP do pacote isolado se as deps dele ja existirem |
| Codigo novo sem efeito | Passenger continua no processo antigo | `touch <approot>/tmp/restart.txt` |
| Config de producao substituida | `.env` local enviado por cima | Nao enviar `.env`; as vars vem de `SetEnv` no `.htaccess` / Environment variables do UI |

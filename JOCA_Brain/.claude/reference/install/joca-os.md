# /install — JOCA_OS: instalação, build e verificação (on-demand)

Lido pelo `/install` na FASE EXECUCAO, passo 8. `<JOCA_ROOT>` = a pasta que contém `JOCA_Brain/` e `JOCA_OS/`
(o valor impresso no passo 7).

## Instalar e construir

O backend serve `frontend/dist` como fallback: sem o build do frontend, qualquer rota desconhecida devolve uma página de
erro `ENOENT` com o caminho absoluto da máquina. Por isso o frontend também se constrói (`npm run build`).

**Windows (PowerShell):**

```powershell
Set-Location "<JOCA_ROOT>\JOCA_OS\backend"
npm install
npm run build
Set-Location "<JOCA_ROOT>\JOCA_OS\frontend"
npm install
npm run build
```

**macOS / Linux (bash):**

```bash
cd "<JOCA_ROOT>/JOCA_OS"
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..
chmod +x start.sh stop.sh 2>/dev/null
```

## Verificar (porta de teste, nunca 7491/7492)

Pode já haver um JOCA OS vivo na 7491/7492: a verificação arranca o backend numa **porta de teste livre** (`PORT`,
ex.: `7591`; se estiver ocupada, outra) e com `JOCA_DATA_DIR` numa pasta temporária, para não tocar no `JOCA_OS/data/`.
Não há rota `/health`: usa-se `GET /runtime`, que responde `200` com um JSON cujo `port` tem de ser a porta de teste
(prova que respondeu esta instância e não outra). Com o `JOCA_DATA_DIR` vazio não há `auth.json`, logo a
autenticação fica desligada (salvo `JOCA_PASSWORD` no ambiente) e o `/runtime` não dá `401`; com ela ligada, usar
`GET /auth/status`, que é público.

**macOS / Linux (bash):**

```bash
cd "<JOCA_ROOT>/JOCA_OS/backend"
curl -s -o /dev/null http://127.0.0.1:7591/ && echo "7591 ocupada — escolhe outra porta"
PORT=7591 JOCA_DATA_DIR="$(mktemp -d)" node dist/server.js & PID=$!
sleep 3
curl -s http://127.0.0.1:7591/runtime          # 200 + JSON com "port":7591
kill $PID
```

**Windows (PowerShell):**

```powershell
Set-Location "<JOCA_ROOT>\JOCA_OS\backend"
$env:PORT = "7591"; $env:JOCA_DATA_DIR = Join-Path $env:TEMP "joca-verif-data"
$p = Start-Process node -ArgumentList "dist/server.js" -PassThru -WindowStyle Hidden
Start-Sleep 3
(Invoke-WebRequest http://127.0.0.1:7591/runtime -UseBasicParsing).Content   # JSON com "port":7591
Stop-Process -Id $p.Id
Remove-Item Env:PORT, Env:JOCA_DATA_DIR
```

Parar **só** o PID que esta verificação arrancou — nunca o que estiver na 7491/7492.

## Arranque

- **Windows:** `start.bat` — cria batch launchers temporários em `%TEMP%\joca-os-<porta>\` para backend e frontend,
  evitando problemas de quoting com caminhos que contêm espaços. Outra instalação na mesma máquina:
  `set JOCA_BACKEND_PORT=7591` e `set JOCA_FRONTEND_PORT=7592` antes do `start.bat`.
- **macOS / Linux:** `bash start.sh` — usa `nohup` + `disown` para manter os processos em background. Outra instalação
  na mesma máquina: `JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 bash start.sh`.

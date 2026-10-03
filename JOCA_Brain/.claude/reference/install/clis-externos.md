# /install — instalação de CLIs externos (on-demand)

Lido pelo `/install` na FASE EXECUCAO, passos 4 (markitdown) e 6 (CLIs externos). Só os CLIs escolhidos na FASE 3.

## Índice
1. markitdown (Knowledge Base / `/know`)
2. CLIs externos (gh, gws, sentry-cli, ffmpeg, yt-dlp, whisperx, stripe-cli, aws-cli, gcloud, huggingface-cli, Antigravity, Codex, CLI Printing Press, Zoho Mail)

## 1. markitdown

**markitdown (Knowledge Base / `/know`):**

```bash
python -m pip install markitdown-mcp        # MCP + core (Windows: python, nao python3)
python -m pip install 'markitdown[all]'     # NAO e opcional — ver aviso abaixo
claude mcp add markitdown --scope user -- python -m markitdown_mcp
```

⚠ **Instalar sempre com `[all]`.** O markitdown do brew (e o `pip install markitdown` simples) vem
sem o extra `[docx]` → converter um `.docx` rebenta com `MissingDependencyException`, sem pista de
qual e o extra em falta. Se nao der para reinstalar: um `.docx` e um zip — `zipfile` + regex sobre
`word/document.xml` extrai o texto.

Verificar: `claude mcp list | grep markitdown` (deve dizer Connected). Ver `memory/tools/mcps.md`.

## 2. CLIs externos

**gh CLI** (se seleccionado e instalado):
```
Correr: gh auth login
Segue as instrucoes interactivas para autenticar via browser.
```

**gws** (se seleccionado):

```bash
npm install -g @googleworkspace/cli
```

Autenticar:
```bash
gws auth setup    # cria projecto Cloud + activa APIs + login (requer gcloud)
gws auth login    # logins subsequentes
```

Sem gcloud: configurar OAuth client manualmente no Cloud Console, download JSON para `~/.config/gws/client_secret.json`, depois `gws auth login`.

Gotchas de auth (vividos — conta **pessoal**, não Workspace):
- `gws auth setup --login` pede **86 scopes** (incl. admin de Workspace, `cloud-identity.devices`) → numa conta pessoal dá `invalid_scope`/Erro 400.
- `gws auth login --services gmail --readonly` **NÃO** restringe scopes — só `--scopes <lista explícita>` restringe (ex.: `https://www.googleapis.com/auth/gmail.readonly`).
- Consent screen em "Testing" sem test users → `403 access_denied` (add user em `console.cloud.google.com/auth/audience?project=<id>`).
- App em "Testing" → Google **expira o refresh token ~7 dias**. Fix: **publicar a app em Production** (conta pessoal não tem via Workspace-Internal).
- Headless/VPS: creds no keyring + `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`. Capacidades p/ automações (e2e): `gws gmail +triage` (não-lidos), `+read`, `+send`/`+reply`/`+forward` — corre non-interactive via `child_process.exec`.
- **`+send` anexos têm de estar no cwd** — `--attach <path>` fora da pasta actual → `validationError 400` ("outside the current directory"). Correr o `+send` a partir da pasta dos ficheiros (subshell `( cd <pasta> && gws ... -a <nome-relativo> )`) ou copiar o anexo para cwd primeiro. Body HTML completo passa bem por `--body "$(cat file.html)" --html`.

**sentry-cli** (se seleccionado):

macOS:
```bash
brew install getsentry/tools/sentry-cli
```

Linux:
```bash
curl -sL https://sentry.io/get-cli/ | sh
```

Windows (Scoop):
```powershell
scoop install sentry-cli
```

Instruir: `sentry-cli login` para autenticar, ou definir `SENTRY_AUTH_TOKEN` em env.

**ffmpeg** (se seleccionado):

macOS:
```bash
brew install ffmpeg
```

Linux (apt):
```bash
sudo apt install ffmpeg
```

Windows (Scoop):
```powershell
scoop install ffmpeg
```

Verificar: `ffmpeg -version`

**yt-dlp** (se seleccionado — usado pelo agent `watch`):

macOS: `brew install yt-dlp`
Linux: `pip3 install -U yt-dlp` ou `sudo apt install yt-dlp`
Windows: `scoop install yt-dlp` ou `pip install -U yt-dlp`

Verificar: `yt-dlp --version`

**whisperx** (se seleccionado — transcricao local sem API):

Prereq: Python 3.10+ e ffmpeg.
```bash
pip install -U whisperx
```
Primeira execucao descarrega modelo (~3GB para `large-v3`).

Verificar: `whisperx --help`

**stripe-cli** (se seleccionado):

macOS: `brew install stripe/stripe-cli/stripe`
Linux: download de github.com/stripe/stripe-cli/releases
Windows: `scoop install stripe`

Instruir: `stripe login` (OAuth interactivo) e usar `stripe listen --forward-to localhost:8000/webhook` para testes locais.

**aws-cli** (se seleccionado):

macOS: `brew install awscli`
Linux: `sudo apt install awscli` ou installer oficial em aws.amazon.com/cli
Windows: `winget install Amazon.AWSCLI`

Instruir: `aws configure` (key, secret, region, output).

**gcloud** (se seleccionado — prereq para `gws auth setup`):

macOS: `brew install --cask google-cloud-sdk`
Linux: `curl https://sdk.cloud.google.com | bash`
Windows: `winget install Google.CloudSDK`

Instruir: `gcloud init` para autenticar e seleccionar projecto.

**huggingface-cli** (se seleccionado):

Windows (PowerShell):
```powershell
pip install -U "huggingface_hub[cli]"
```

macOS / Linux (bash):
```bash
pip3 install -U "huggingface_hub[cli]"
```

Instruir: `huggingface-cli login` para autenticar.

**Antigravity CLI** (`agy`, se seleccionado) — instalador oficial da Google; **não há pacote npm**
(`npm view @anthropic-ai/antigravity` → E404). Fonte: https://antigravity.google/docs/cli/install/ (verificado 2026-10-02).

Windows (PowerShell):
```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

macOS / Linux (bash):
```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Instala o binário nativo em `~/.local/bin/agy` (Windows: `%LOCALAPPDATA%\agy\bin`). Verificar: `agy --version`.
Autenticação: correr `agy` — usa a sessão guardada no keyring ou abre o browser para o login (por SSH dá um URL e pede o
código). Actualizar: `agy update`.

**Codex CLI** (se seleccionado):

Windows (PowerShell):
```powershell
npm install -g @openai/codex
```

macOS / Linux (bash):
```bash
npm install -g @openai/codex
```

Instruir: `codex login` ou definir `OPENAI_API_KEY`.

**CLI Printing Press** (se seleccionado):

Prerequisito — Go 1.26+:
macOS: `brew install go`
Linux: `sudo apt install golang` ou download de golang.org
Windows: download de golang.org/dl

Garantir `$GOPATH/bin` no PATH:
```bash
echo 'export PATH="$HOME/go/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Instalar:
```bash
go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest
```

Verificar: `cli-printing-press --version`

**Zoho Mail CLI** (se seleccionado):

Prerequisito — Java 11+:
- macOS: `brew install openjdk@21` (keg-only, adicionar `/opt/homebrew/opt/openjdk@21/bin` ao PATH)
- Linux: `sudo apt install openjdk-21-jdk` ou equivalente
- Windows: download de adoptium.net (Eclipse Temurin)

Verificar: `java -version` (deve mostrar 11+)

Instalar:
```bash
mkdir -p ~/.local/bin/zmail-cli
curl -L -o ~/.local/bin/zmail-cli/zmail-cli.jar \
  https://www.zohowebstatic.com/mail/3938191/ZMAIL_CLI/zmail-cli.jar
```

Criar wrapper `~/.local/bin/zmail`:
```bash
#!/usr/bin/env bash
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
exec java -jar "$HOME/.local/bin/zmail-cli/zmail-cli.jar" "$@"
```

Tornar executável: `chmod +x ~/.local/bin/zmail`

Verificar: `zmail` (abre prompt interactivo — pede password de encriptação no primeiro arranque para proteger refresh tokens locais).

Instruir: `zmail:>login` para OAuth via browser. Para data centers regionais usar `login --dc <tld>` (`.com`, `.eu`, `.in`, `.au`, `.jp`, `.ca`, `.sa`).

Docs: https://www.zoho.com/mail/help/cli/getting-started-with-cli.html

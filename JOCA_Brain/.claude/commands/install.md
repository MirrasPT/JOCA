# /install — Setup e configuracao do JOCA

Assistente de instalacao e reconfiguracao. Pode correr a qualquer momento — reconfigura sem apagar o que ja existe.

**Repositorio:** https://github.com/MirrasPT/JOCA.git

**A regra que manda neste comando:** *detectar primeiro, perguntar so o que falta.* O sistema
operativo, o que ja esta instalado, o que ja esta configurado — nada disso se pergunta, ve-se.
As perguntas que sobram sao sobre **preferencias** e **intencao**, que nenhum comando adivinha.

> Isto substitui o questionario de multi-select que este comando era (mapa de areas->skills, listas
> de CLIs a marcar um a um). Esse formulario tinha de ser mantido alinhado com o inventario real de
> skills — era esse o trabalho do antigo `/sync-questionnaires`, agora removido — e mesmo assim
> perguntava coisas que um `command -v` responde melhor.

**Dados protegidos (NUNCA sobrescrever em reinstalacao):**
- `memory/projects/` — dados de projectos do utilizador
- `memory/feedback/` — sessoes de feedback
- `memory/soul.md` — calibracao de personalidade
- `JOCA_OS/data/` — projectos, sessoes, settings do UI
- Ficheiros com `origin: local` no frontmatter — skills/agents criados localmente

---

## FASE 0 — Levantamento (zero perguntas)

```bash
node -e "console.log(process.platform, process.version)"     # OS + Node (Node e obrigatorio)
cat ~/CLAUDE.md 2>/dev/null | head -30                        # perfil ja existe?
ls memory/soul.md memory/projects memory/feedback JOCA_OS/data 2>/dev/null
grep -n "autonomy_level\|communication_mode" memory/soul.md 2>/dev/null
grep -c "JOCA_ROOT" .claude/settings.json 2>/dev/null         # >0 = placeholder por substituir
# que CLIs ja existem (nao perguntar por estes):
for c in gh gws gcloud aws agy codex ffmpeg yt-dlp markitdown wp shopify wix ntn \
         sentry-cli stripe python python3; do
  command -v "$c" >/dev/null 2>&1 && echo "TEM $c"
done
```

**O que isto decide sozinho:**

| Sinal | Conclusao — nao perguntar |
|---|---|
| `process.platform` | OS: `win32` -> PowerShell em tudo; `darwin`/`linux` -> bash |
| `~/CLAUDE.md` com perfil | nome e papel do utilizador ja existem |
| `memory/soul.md` com `autonomy_level` preenchido | ja foi calibrado — isto e **reconfiguracao**, nao instalacao |
| `TEM <cli>` | esse CLI ja esta instalado; so entra na lista se faltar |
| `JOCA_OS/data/` existe | o JOCA_OS ja esta a ser usado; nao reinstalar por cima |
| `<JOCA_ROOT>` no `settings.json` | placeholder por substituir — **com ele la, nenhum hook corre** |

Se `node` nao existir: parar e dizer que e obrigatorio.

Se ja houver perfil **e** soul calibrado, mostra o que esta configurado e pergunta uma so coisa:
*manter tudo* · *mudar preferencias* · *so acrescentar ferramentas*. Manter -> saltar para FASE 3.

---

## FASE 1 — Quem es tu (so o que falta)

Se o `~/CLAUDE.md` ja der nome e papel, **confirma numa linha** em vez de perguntar de novo.
Caso contrario: nome, papel (designer · dev · full-stack · marketing · PM · outro) e, opcional, pais
(so importa para `portugal-payments`/`portugal-invoicing` e idioma).

O OS **nao se pergunta** — ja foi detectado na FASE 0. Diz qual e e segue.

---

## FASE 2 — Como queres que o JOCA se comporte

Tres perguntas. Sao preferencias: nenhuma se deduz do disco. Usa `AskUserQuestion`.

**1. Autonomia** — quanto pode agir sem perguntar?
Maxima (recomendado) `0.95` · Alta `0.80` · Moderada `0.60` · Baixa `0.30` -> `autonomy_level`.
Em qualquer nivel, accoes **irreversiveis** (deploy, push, migrations, deletes, pagamentos) pedem
sempre confirmacao — isso nao e calibravel.

**2. Comunicacao** — `lite` (terso, recomendado) · `full` (explica) · `ultra` (fragmentos) -> `communication_mode`.

**3. Testes automaticos** — correr testes sozinho depois de mudar codigo? -> `auto_test`.

Os restantes parametros (`assertiveness`, `error_tolerance`, `explanation_depth`,
`orchestration_threshold`, `loop_max_iterations`) ficam nos defaults do `soul.md` e ajustam-se depois
editando o ficheiro. Perguntar oito parametros a alguem que ainda nao usou o sistema nao produz
melhores respostas — produz respostas inventadas.

### Areas de trabalho — **nao se perguntam**

O JOCA traz **131 skills** que activam por relevancia >= 60% via `SKILL_INDEX.json` (hook `prompt-triage.js`) +
`.claude/reference/trigger-map.md`. Nao ha nada para ligar ou desligar: uma skill de WordPress nunca dispara num projecto
Laravel, porque o trigger nao casa. Escolher "areas" na instalacao so serviria para **esconder**
skills que o utilizador viria a precisar.

O que e especifico de um projecto (stack, plataforma, CLIs desse projecto) e decidido pelo
`/start`, que ve a pasta (absorveu o antigo `/init-project`). Aqui trata-se so da maquina.

---

## FASE 3 — Ferramentas (so as que faltam)

A FASE 0 ja disse o que existe. Apresenta **so o que falta**, agrupado, com uma nota de para que
serve — e deixa escolher em bloco, nao um a um:

```
Ja tens: gh, ffmpeg, python

Faltam (escolhe os grupos que queres):
  [core]      markitdown   -> motor do /know (ingerir PDF/Office/YouTube)
  [git/cloud] gws, gcloud, aws
  [ai]        agy (Gemini, multimodal) · codex (review adversarial) · huggingface-cli
  [media]     yt-dlp, whisperx        -> usados pelo agente `watch`
  [cms]       wp-cli · shopify · wix · ntn (Notion, Node >= 22)
  [dev]       sentry-cli · stripe-cli · cli-printing-press (Go 1.26+)
  [browser]   Playwright CLI (nunca browser-use, nunca MCP)
```

Recomendar `[core]` sempre; o resto so se o papel (FASE 1) o justificar — um designer nao precisa de
`stripe-cli` por defeito. **Instalar CLIs que nao se usam custa tempo e falha em silencio.**

Inventario completo com comandos de instalacao por OS e notas de autenticacao:
`memory/tools/clis.md`. Os comandos concretos correm na FASE EXECUCAO.

### Chaves de API

Perguntar **so** pelas que as ferramentas escolhidas exigem — e nunca as escrever em ficheiros
versionados. Se uma chave nao for dada, a ferramenta fica registada como **PENDENTE** no relatorio,
com o passo manual. Nunca inventar uma chave nem um endpoint para "destrancar" um passo.

---

## FASE 4 — Proposta e gate unico

```
UTILIZADOR: <nome> — <papel> [· <pais>]
SISTEMA:    <OS detectado> · Node <versao>
MODO:       autonomia <x> · comunicacao <y> · auto-test <s/n>

JA INSTALADO:  <lista detectada>            <- nao se toca
VOU INSTALAR:  <lista>                      <- so o que falta e foi escolhido
CHAVES:        <as que foram dadas> | PENDENTE: <as que faltam>

VOU CRIAR/ACTUALIZAR
  memory/soul.md                 <- parametros + alinhamento com o utilizador
  ~/CLAUDE.md                    <- perfil + comandos + lista de nomes de projectos
  .claude/settings.json          <- paths reais (substitui <JOCA_ROOT>)
  JOCA_OS                        <- dependencias + build do frontend
  <launcher>                     <- atalho de arranque
```

`AskUserQuestion`: "Confirmas?" -> *Sim, instalar* · *Deixa-me corrigir*.

Este e o **unico** gate do comando. A partir daqui corre tudo seguido, e o que falhar vai para o
relatorio final como PENDENTE com o comando manual — uma falha de CLI nunca aborta a instalacao.

---

## FASE EXECUCAO

### 1. Preencher soul.md

Ler `memory/soul.md`, substituir todos os placeholders `<...>` com os valores recolhidos nas FASE 1 (identidade) e FASE 2 (comportamento). Actualizar Calibration Parameters.

### 2. ~/CLAUDE.md

Ler ficheiro actual. Adicionar/actualizar sem apagar conteudo existente:

```markdown
## Utilizador
[Nome] — [papel][, localizacao]

## Lingua
Responder sempre em [lingua] — mesmo que o pedido, um ficheiro lido ou o output de uma ferramenta estejam
noutra lingua. Excepcao: codigo, nomes de ficheiros/variaveis, comandos e citacoes exactas.

## JOCA
Toolkit instalado em: [caminho_joca]
Skills activas: 127 (trigger system RFC 2119 — activacao automatica por relevancia)
Comandos: /install, /start (novo projecto ou ligar existente), /resume, /save, /create-skill, /plan, /debug, /review-code, /review-design, /help-joca, /one-shot, /upgrade-joca, /update-joca, /status, /wp-perf, /wp-perf-review
Geracao de imagens: [motores seleccionados]

## JOCA_OS
Interface: / triggers autocomplete de commands, skills e agents (dropdown)
Arranque: start.bat (Windows) ou bash start.sh (macOS/Linux)

## Workspace

## Projectos
> So nomes. Pasta, estado e detalhe -> `memory/INDEX.md` §Projects e `memory/projects/<x>/`.

**Activos:** <!-- so o nome, separado por ` · `; adicionado por /start e /save -->

@[caminho_joca]/JOCA_Brain/CLAUDE.md
```

### 3. Estrutura de memoria

Confirmar que existem (criar se nao existirem):
- `memory/INDEX.md`
- `memory/projects/` (com `.gitkeep`)
- `memory/tools/`
- `memory/feedback/` (com `.gitkeep`)

**Windows (PowerShell):**
```powershell
$dirs = @("memory\projects", "memory\tools", "memory\feedback")
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d }
    $gk = Join-Path $d ".gitkeep"
    if (-not (Test-Path $gk)) { New-Item -ItemType File $gk }
}
if (-not (Test-Path "memory\INDEX.md")) { New-Item -ItemType File "memory\INDEX.md" }
```

**macOS / Linux (bash):**
```bash
mkdir -p memory/projects memory/tools memory/feedback
touch memory/projects/.gitkeep memory/feedback/.gitkeep
[ -f memory/INDEX.md ] || touch memory/INDEX.md
```

### 4. Browser Automation (se seleccionado)

⚠ **`browser-use` está BANIDO — nunca instalar, nunca sugerir.** Política do JOCA (2026-08-05):
verificação ad-hoc → extensão **Claude no Chrome**; automação com script → **Playwright CLI**.
**Nunca instalar o MCP do Playwright** (`@playwright/mcp`) — mesmo que pareça a via mais simples.

**Playwright CLI (única via de automação de browser):**

```bash
npm install -g @playwright/cli
```

Verificar: `playwright-cli --help` (ou `npx playwright --version`). Se não estiver instalado nesta
máquina, pedir ao utilizador para o instalar — nunca usar MCP como atalho.

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

Google connectors: instruir activacao em claude.ai/settings (OAuth nativo).

### 5. API Keys

Para cada chave marcada como "introduzir agora":

**Chaves de agentes** — adicionar ao bloco `env` global de `~/.claude.json`:
```json
{ "env": { "OPENAI_API_KEY": "<valor>", "GEMINI_API_KEY": "<valor>" } }
```

Para chaves PENDENTE — listar com link de obtencao:
- `OPENAI_API_KEY` -> platform.openai.com/api-keys
- `GEMINI_API_KEY` -> aistudio.google.com/apikey
- `SENTRY_AUTH_TOKEN` -> sentry.io/settings/account/api/auth-tokens
- `STRIPE_API_KEY` -> dashboard.stripe.com/apikeys (test mode)

### 6. CLIs externos

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

**Antigravity CLI** (se seleccionado):

Windows (PowerShell):
```powershell
npm install -g @anthropic-ai/antigravity
```

macOS / Linux (bash):
```bash
npm install -g @anthropic-ai/antigravity
```

Instruir: `agy auth login` ou definir `GEMINI_API_KEY`.

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

### 7. settings.json do projecto (âmbito PROJECTO)

**PASSO OBRIGATORIO — sem isto os hooks nao correm.**

> ⚠ Esta seccao trata do `JOCA_Brain/.claude/settings.json`, que so vale **dentro** do repo do JOCA.
> Ha hooks que tem de valer em **qualquer** pasta onde o Claude Code arranque — esses ficam no
> `~/.claude/settings.json` e sao a seccao **7b**, que nao se pode saltar.

O `JOCA_Brain/.claude/settings.json` vem com os **14 hooks** (+ o script `check-skill-paths.sh`) a apontar para o placeholder
`<JOCA_ROOT>`. Substituir **todas** as ocorrencias pelo caminho absoluto onde o JOCA foi
clonado (a pasta que contem `JOCA_Brain/`), sem barra final:

```bash
# macOS / Linux
JOCA_ROOT="$(cd "$(dirname "$0")" && pwd)"        # raiz resolvida na FASE 0
sed -i '' "s|<JOCA_ROOT>|$JOCA_ROOT|g" JOCA_Brain/.claude/settings.json
```
```powershell
# Windows
$JOCA_ROOT = "C:/Users/<utilizador>/Desktop/JOCA"   # caminho real, com barras /
(Get-Content JOCA_Brain\.claude\settings.json -Raw) -replace '<JOCA_ROOT>', $JOCA_ROOT |
  Set-Content JOCA_Brain\.claude\settings.json -NoNewline
```

Verificar (tem de dar **0** e o JSON tem de continuar valido):
```bash
grep -c '<JOCA_ROOT>' JOCA_Brain/.claude/settings.json    # 0
node -e "JSON.parse(require('fs').readFileSync('JOCA_Brain/.claude/settings.json','utf8')); console.log('JSON ok')"
```

**Porque absolutos:** no Windows o cwd dos hooks nao e garantidamente a raiz do repo e a
variavel `$CLAUDE_PROJECT_DIR` pode vir vazia (alem de os hooks poderem correr em `cmd`, que
nao expande `$VAR`). Paths relativos falham **em silencio** — o hook nao corre e nao ha erro.
Usar `/` mesmo em Windows.

⚠ Se mudares a pasta do JOCA de sitio, tens de repetir esta substituicao.

```json
{
  "permissions": {
    "allow": [],
    "deny": []
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-freeze.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-tdd.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/guard-claudemd.js\"" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/check-careful.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/guard-git-add.js\"" }
        ]
      },
      {
        "matcher": "PowerShell",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/guard-git-add.js\"" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/session-intake.js\"" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/prompt-triage.js\"" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/track-changes.js\" \"$TOOL_INPUT_FILE_PATH\"", "async": true },
          { "type": "command", "command": "bash \"<BRAIN>/.claude/scripts/check-skill-paths.sh\" \"$TOOL_INPUT_FILE_PATH\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/skill-lint.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/auto-checkpoint.js\"", "async": true }
        ]
      },
      {
        "matcher": "Read|Skill|Agent|Task|Edit|Write",
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/registo-uso.js\"" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/stop-checkpoint.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/auto-test-dispatch.js\"" },
          { "type": "command", "command": "node \"<BRAIN>/.claude/hooks/stop-continuar.js\"" }
        ]
      }
    ]
  }
}
```

Notas:
- **Ordem no array Stop importa:** `stop-checkpoint.js` → `auto-test-dispatch.js` → `stop-continuar.js`. O checkpoint corre ANTES do dispatch (este limpa a `.joca/test-queue.jsonl`); o `stop-continuar.js` corre **por último**, porque é o único que pode bloquear o fim do turno — e bloqueia **uma vez** por turno (guarda `stop_hook_active`; ver `rules/chaining.md`).
- Runtime `node` para todos os hooks excepto `check-skill-paths.sh` (bash, vive em `.claude/scripts/`).
- Hooks flag-file (`check-freeze`, `check-careful`, `check-tdd`) são no-op sem a flag `.joca/*.flag` — armados pelas skills `freeze`/`careful`/`tdd`, desarmados por `unfreeze`.
- `guard-claudemd.js` trava linhas gordas em `CLAUDE.md`; `guard-git-add.js` trava `git add -A`/`.` com agentes vivos e `git commit` sem `--only` com índice alheio; `auto-checkpoint.js` grava checkpoints `-auto`; `registo-uso.js` conta usos de skills/agentes em `.joca/uso-skills.jsonl` (gitignored).

### 7b. Hooks de ambito-MAQUINA (`~/.claude/settings.json`)

**PASSO OBRIGATORIO — a seccao 7 nao cobre isto.** Um hook registado no `settings.json` do projecto
so corre quando a sessao arranca **dentro** desse projecto. O `guard-claudemd.js` existe para
proteger o `~/CLAUDE.md` de linhas gordas, e o `~/CLAUDE.md` e escrito de **qualquer** pasta — logo
tem de estar registado na maquina, nao no repo. Sem este passo o guard existe no disco e nunca corre:
falha em silencio, exactamente como o placeholder `<JOCA_ROOT>` da seccao 7.

Caminho **absoluto** (o `~/.claude/settings.json` nao tem `$CLAUDE_PROJECT_DIR` util — a sessao pode
arrancar em qualquer sitio). Acrescentar ao ficheiro existente, **sem o substituir**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node <JOCA_ROOT>/JOCA_Brain/.claude/hooks/guard-claudemd.js" }
        ]
      }
    ]
  }
}
```

Verificar (o ficheiro tem de continuar valido **e** o hook tem de aparecer):

```bash
node -e "JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/settings.json','utf8')); console.log('JSON ok')"
grep -c 'guard-claudemd' ~/.claude/settings.json         # >=1
test -f "$(grep -o '/[^\" ]*guard-claudemd.js' ~/.claude/settings.json | head -1)" && echo "alvo existe"
```

⚠ **O `~/.claude/settings.json` costuma ja ter conteudo** (hooks de outras ferramentas, permissoes).
Fundir por `Edit` cirurgico ou por script que faz `JSON.parse` → merge → escrita atomica. Um `Write`
por cima apaga configuracao de outras ferramentas e nao ha aviso.
⚠ Mudar a pasta do JOCA de sitio obriga a repetir **este** passo tambem, nao so o da seccao 7.

### 7c. Lingua (ambito-MAQUINA)

**PASSO OBRIGATORIO — sem ele a instalacao muda para ingles.** O modelo tende a responder em ingles a seguir a texto
de sistema, hooks ou output de ferramentas em ingles. A regra de lingua tem de viver no `~/CLAUDE.md` (carregado em
qualquer pasta), nao so nas instrucoes do repo.

Escrever o bloco `## Lingua` no `~/CLAUDE.md` (template da seccao 2), sem apagar conteudo existente.

Verificar (falha → vai para o relatorio final como PENDENTE):

```bash
grep -q '^## Lingua' ~/CLAUDE.md && echo "OK regra de lingua no ~/CLAUDE.md"
```

### 8. JOCA_OS (instala por defeito)

O JOCA_OS corre em **porta 7491** (backend) e **porta 7492** (frontend). A interface detecta automaticamente o JOCA_Brain como directorio irmao — zero configuracao.

> **macOS e a plataforma de referencia** — o JOCA_OS foi desenvolvido e validado em macOS. Se o OS detectado na FASE 0 for **Windows** (`process.platform === 'win32'`), ler e activar a skill `.claude/skills/joca-os-windows.md` ANTES de correr `npm install`/`npm run build`: ela conduz build do node-pty (requer VS Build Tools + Python), PTY PowerShell, paths, statusline/Keychain e launchers, testando e corrigindo numa so passagem. Notificar: `[skill: joca-os-windows]`.

**Windows (PowerShell):**

Usa a abordagem de temp batch launcher para evitar problemas de quoting em nested processes:

```powershell
Set-Location "<caminho_joca>\..\JOCA_OS\backend"
npm install
npm run build
Set-Location "<caminho_joca>\..\JOCA_OS\frontend"
npm install
```

Verificar: `node <caminho_joca>\..\JOCA_OS\backend\dist\server.js` inicia sem erros.

Arranque Windows: `start.bat` — cria batch launchers temporarios em `%TEMP%\joca-ui\` para backend e frontend, evitando problemas de quoting com caminhos que contem espacos.

**macOS / Linux (bash):**

```bash
cd "<caminho_joca>/../JOCA_OS"
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && cd ..
chmod +x start.sh stop.sh 2>/dev/null
```

Verificar: `node <caminho_joca>/../JOCA_OS/backend/dist/server.js` inicia sem erros.

Arranque macOS/Linux: `bash start.sh` — usa `nohup` + `disown` para manter os processos em background.

**JOCA_OS Slash Command Autocomplete:**
O JOCA_OS suporta autocomplete de comandos, skills e agents — ao digitar `/` no terminal emulado, aparece um dropdown com todos os comandos disponiveis. Mencionar isto ao utilizador.

### 9. Launcher

`AskUserQuestion`:
```
question: "Criar atalho para abrir o JOCA UI com um clique?"
header: "Launcher"
options:
  - "Desktop"
  - "Pasta do JOCA"
  - "Outro caminho"
  - "Nao criar"
```

Se "Outro caminho": pedir caminho em texto livre.

Se seleccionado:

**macOS:**
```bash
cp "<caminho_joca>/../JOCA_OS/JOCA UI.command" "<destino>/JOCA UI.command"
chmod +x "<destino>/JOCA UI.command"
```

**Windows:**
```powershell
Copy-Item "<caminho_joca>\..\JOCA_OS\JOCA UI.vbs" "<destino>\JOCA UI.vbs"
```

### 9b. Modelo dos agentes (opcional)

Cada agente traz uma sugestão de modelo + effort escrita nele (`modelo-sugerido`/`effort-sugerido`/
`porque-modelo` — campos que o Claude Code ignora). Agente sem sugestão (ex.: pack marketeer) aparece
como «manter o actual» e nunca muda. **Por defeito nada muda.** Reinstalação: repor
primeiro as escolhas já feitas, depois ver o que falta.

```bash
node .claude/scripts/modelos-agentes.mjs --reaplicar
node .claude/scripts/modelos-agentes.mjs --tabela        # agentes sem escolha: actual · sugestão · porquê
```

Tabela vazia → salta. Com linhas → mostrar a tabela e `AskUserQuestion`:
```
question: "Aplico as sugestões de modelo da tabela aos N agentes?"
header: "Modelos"
options:
  - "Sim, aplicar todas"
  - "Alterar alguns"        # pedir em prosa «agente: herdar|sonnet|opus|haiku · effort»
  - "Manter como está"      # regista o actual ("model": "manter"); não volta a perguntar
  - "Saltar por agora"      # nada muda; volta a perguntar no próximo /install ou /update-joca
```

```bash
node .claude/scripts/modelos-agentes.mjs --tabela --json > <scratchpad>/escolhas.json   # editar só os alterados
node .claude/scripts/modelos-agentes.mjs --aplicar <scratchpad>/escolhas.json
```

A escolha fica em `.claude/modelos-agentes.local.json` e o `/update-joca` reaplica-a depois de cada update.

### 10. Skills novas (se confirmado)

Executar `/create-skill [nome]` para cada skill nova que tenha sido explicitamente aprovada. Nao ha deteccao de gaps na instalacao: um gap real aparece a trabalhar num projecto (e o `/start` ou o `/upgrade-joca` levantam-no), nao a responder a um formulario.

### 11. Relatorio final

```
OK Soul calibrado — [autonomia], [comunicacao], [erros]
OK ~/CLAUDE.md actualizado
OK Lingua fixada no ~/CLAUDE.md
OK Memoria: estrutura verificada
OK Skills: 127 configuradas (RFC 2119 trigger system)
OK Integracoes: [Browser: playwright-cli/nenhum] · [CLIs: lista]
OK JOCA_OS: instalado (backend :7491, frontend :7492)[ · Windows: skill joca-os-windows aplicada]
OK Modelos dos agentes: [aplicadas N | mantidos | saltado]
OK StatusLine: instalada (rate limits -> %TEMP%/joca-ui/rate-limits.json)
[estado] Deps: node / npm / git / gh / jq / bun / docker

API KEYS
  OK [chave] — configurada
  PENDENTE [chave] — PENDENTE -> [URL]

JOCA pronto.
-> Iniciar interface: JOCA_OS\start.bat (Windows) ou bash JOCA_OS/start.sh (macOS/Linux)
-> Autocomplete: digita / no terminal para ver commands, skills e agents
-> Para comecar/ligar um projecto: navega para a pasta e corre /start
-> Inicio de sessao: /resume
-> Referencia rapida: /help-joca
-> Repo: https://github.com/MirrasPT/JOCA.git
```

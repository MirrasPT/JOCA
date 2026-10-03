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
grep -c "<YOUR_NAME>" memory/soul.md 2>/dev/null           # >0 = soul.md ainda e o template
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
| `memory/soul.md` sem `<YOUR_NAME>` (grep = 0) | ja foi calibrado (o template publico ja traz `autonomy_level`, por isso nao serve de sinal) — isto e **reconfiguracao**, nao instalacao |
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

As skills do JOCA (contagem: linha `disco:` de `node .claude/scripts/joca-doctor.mjs`) activam por relevancia >= 60% via `SKILL_INDEX.json` (hook `prompt-triage.js`) +
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
  ~/.claude/settings.json        <- merge: guard-claudemd (7b) · statusLine (7d)
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
Skills: ativação automática por relevância (índice em JOCA_Brain/memory/SKILL_INDEX.json)
Comandos: `/help-joca` (inventario vivo — nao se transcreve aqui: uma lista a mao desactualiza-se em silencio)
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

**markitdown (Knowledge Base / `/know`):** instalar sempre com `[all]` — receita e verificação em
`Read(".claude/reference/install/clis-externos.md")` §1.

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

Para cada CLI escolhido na FASE 3 → `Read(".claude/reference/install/clis-externos.md")` §2 (instalação por OS, auth e gotchas).

### 7. settings.json do projecto (âmbito PROJECTO)

**PASSO OBRIGATORIO — sem isto os hooks nao correm.**

> ⚠ Esta seccao trata do `JOCA_Brain/.claude/settings.json`, que so vale **dentro** do repo do JOCA.
> Ha hooks que tem de valer em **qualquer** pasta onde o Claude Code arranque — esses ficam no
> `~/.claude/settings.json` e sao a seccao **7b**, que nao se pode saltar.

Se o `JOCA_Brain/.claude/settings.json` trouxer hooks a apontar para o placeholder `<JOCA_ROOT>`,
substituir **todas** as ocorrências pelo caminho absoluto onde o JOCA foi clonado (a pasta que
contém `JOCA_Brain/`), sem barra final. A raiz sai do `git rev-parse --show-toplevel` (barras `/`
também no Windows) e a troca é feita em `node` — sem `sed`, que difere entre GNU e BSD/macOS. O
mesmo comando corre igual em bash (macOS, Linux, Git Bash) e PowerShell, a partir de qualquer pasta
dentro do clone; sem placeholder não mexe no ficheiro:

```bash
node -e "const fs=require('fs'),r=require('child_process').execSync('git rev-parse --show-toplevel').toString().trim(),f=r+'/JOCA_Brain/.claude/settings.json',s=fs.readFileSync(f,'utf8');if(s.includes('<JOCA_ROOT>'))fs.writeFileSync(f,s.split('<JOCA_ROOT>').join(r));console.log('JOCA_ROOT='+r)"
```

Verificar (tem de dar `OK`; o JSON tem de continuar válido):
```bash
node -e "const fs=require('fs'),r=require('child_process').execSync('git rev-parse --show-toplevel').toString().trim(),s=fs.readFileSync(r+'/JOCA_Brain/.claude/settings.json','utf8');JSON.parse(s);console.log(s.includes('<JOCA_ROOT>')?'FALHA placeholder por substituir':'OK 0 placeholders, JSON ok')"
```

O `JOCA_ROOT=` impresso é o valor de `<JOCA_ROOT>` nas secções seguintes (7b, 7c, 7d, 8, 9).

**Porque absolutos:** o `settings.json` deste repo chama todos os hooks (e o
`scripts/check-skill-paths.sh`) por caminho absoluto, `"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/..."`, sem
variaveis de ambiente — o caminho nao depende do cwd em que o hook corre. Enquanto o placeholder la
estiver, o caminho nao existe e o hook falha **em silencio** — nao corre e nao ha erro. Usar `/` mesmo
em Windows.

⚠ Se mudares a pasta do JOCA de sitio, tens de repetir esta substituicao (o `settings.json` ja nao tem
o placeholder: troca-se o caminho antigo pelo novo).

Bloco de hooks esperado (JSON) e notas de ordem → `Read(".claude/reference/install/settings-hooks.md")`.

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
          { "type": "command", "command": "node \"<JOCA_ROOT>/JOCA_Brain/.claude/hooks/guard-claudemd.js\"" }
        ]
      }
    ]
  }
}
```

Verificar (o ficheiro tem de continuar valido, o hook tem de aparecer **e** o alvo tem de existir).
Lê o JSON em `node` em vez de `grep`, para aceitar `C:/...`, `C:\\...` e caminhos com espaços —
corre igual em bash e PowerShell; qualquer `FALHA` vai para o relatório como PENDENTE:

```bash
node -e "const fs=require('fs'),s=JSON.parse(fs.readFileSync(require('os').homedir()+'/.claude/settings.json','utf8'));const cs=Object.values(s.hooks||{}).flat().flatMap(g=>g.hooks||[]).map(h=>h.command||'').filter(c=>c.includes('guard-claudemd.js'));if(!cs.length)console.log('FALHA hook guard-claudemd ausente');for(const c of cs){const p=c.replace(/^\s*node\s+/,'').replace(/[\x22']/g,'').trim();console.log(/\s/.test(p)&&!/[\x22']/.test(c)?'FALHA caminho com espacos sem aspas: '+c:(fs.existsSync(p)?'OK alvo existe: ':'FALHA alvo nao existe: ')+p)}"
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

### 7d. StatusLine e rate limits (âmbito-MÁQUINA)

A barra de estado do Claude Code (modelo, contexto, limites 5h/7d) é o `statusline-command.js`, que também escreve
`<tmpdir>/joca-ui/rate-limits.json` — o ficheiro que o JOCA OS lê em `GET /rate-limits`. Fica em `~/.claude/` e é
ligado no `statusLine` do `~/.claude/settings.json`. Os dois comandos correm iguais em bash e PowerShell; o primeiro
**não escreve por cima** de um script nem de um `statusLine` que já existam (diz `JA EXISTE` e segue):

```bash
node -e "const fs=require('fs'),d=require('os').homedir()+'/.claude/statusline-command.js';if(fs.existsSync(d))console.log('JA EXISTE '+d);else{fs.mkdirSync(require('path').dirname(d),{recursive:true});fs.copyFileSync('<JOCA_ROOT>/JOCA_Brain/.claude/scripts/statusline-command.js',d);console.log('OK copiado '+d)}"
node -e "const fs=require('fs'),h=require('os').homedir().replace(/\x5c/g,'/'),p=h+'/.claude/settings.json',s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};if(s.statusLine)console.log('JA EXISTE statusLine: '+JSON.stringify(s.statusLine));else{s.statusLine={type:'command',command:'node \x22'+h+'/.claude/statusline-command.js\x22'};fs.writeFileSync(p+'.tmp',JSON.stringify(s,null,2));fs.renameSync(p+'.tmp',p);console.log('OK statusLine ligada')}"
```

Verificar (falha → PENDENTE no relatório). No Windows sem `~/.claude/.credentials.json` a barra de 7 dias pode
ficar vazia — ver a skill `joca-os-windows`:

```bash
node -e "const h=require('os').homedir(),o=require('child_process').execFileSync(process.execPath,[h+'/.claude/statusline-command.js'],{input:'{\x22model\x22:{\x22display_name\x22:\x22teste\x22}}'}).toString();console.log(o.includes('teste')?'OK statusline responde':'FALHA statusline: '+o)"
```

### 8. JOCA_OS (instala por defeito)

Portas por defeito: **7491** (backend) e **7492** (frontend); outra instalação na mesma máquina usa outras com
`JOCA_BACKEND_PORT`/`JOCA_FRONTEND_PORT` (`start.sh` e `start.bat`). A interface detecta automaticamente o JOCA_Brain como directorio irmao — zero configuracao.

> **macOS e a plataforma de referencia** — o JOCA_OS foi desenvolvido e validado em macOS. Se o OS detectado na FASE 0 for **Windows** (`process.platform === 'win32'`), ler e activar a skill `.claude/skills/joca-os-windows.md` ANTES de correr `npm install`/`npm run build`: ela conduz build do node-pty (requer VS Build Tools + Python), PTY PowerShell, paths, statusline/Keychain e launchers, testando e corrigindo numa so passagem. Notificar: `[skill: joca-os-windows]`.

Instalar backend **e** frontend (`npm install` + `npm run build` nos dois — sem o `frontend/dist` o backend devolve
`ENOENT` com o caminho absoluto), verificar e arrancar → `Read(".claude/reference/install/joca-os.md")`.
A verificação arranca o backend numa **porta de teste** (ex.: `PORT=7591`) com `JOCA_DATA_DIR` temporário e pede
`GET /runtime` (não existe `/health`) — **nunca** na 7491/7492, que podem ter um JOCA OS vivo.

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
cp "<JOCA_ROOT>/JOCA_OS/JOCA OS.command" "<destino>/JOCA OS.command"
chmod +x "<destino>/JOCA OS.command"
```

**Windows:**
```powershell
Copy-Item "<JOCA_ROOT>\JOCA_OS\JOCA OS.vbs" "<destino>\JOCA OS.vbs"
```

### 9b. Modelo dos agentes (opcional)

Cada agente traz uma sugestão de modelo + effort escrita nele (`modelo-sugerido`/`effort-sugerido`/
`porque-modelo` — campos que o Claude Code ignora). Agente sem sugestão (ex.: pack marketeer) aparece
como «manter o actual» e nunca muda. Sugestão de effort abaixo do actual sai marcada «↓ manter X»:
«aplicar todas» mantém o actual, e a descida só entra se escolhida para esse agente. **Por defeito nada muda.** Reinstalação: repor
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
OK Skills: [N] skills · [N] agents · [N] commands (linha `disco:` do joca-doctor.mjs — nunca escrito à mão)
OK Integracoes: [Browser: playwright-cli/nenhum] · [CLIs: lista]
OK JOCA_OS: instalado e verificado em /runtime na porta de teste (arranque: backend :[7491], frontend :[7492])[ · Windows: skill joca-os-windows aplicada]
OK Modelos dos agentes: [aplicadas N | mantidos | saltado]
[OK|JA EXISTE|PENDENTE] StatusLine: secção 7d (rate limits -> <tmpdir>/joca-ui/rate-limits.json)
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

# JOCA — Bootstrap de Instalação

Estás a executar o bootstrap do JOCA. Segue estas instruções exactamente.
Faz cada passo pela ordem indicada — aguarda resposta antes de avançar.

---

## Passo 1 — Verificar instalação existente

Detectar SO e procurar instalação:

**macOS/Linux:**
```bash
find ~ -maxdepth 5 -name "JOCA_Brain" -type d 2>/dev/null | head -5
```

**Windows (PowerShell):**
```powershell
Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_Brain" -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 5 -ExpandProperty FullName
```

**Se encontrou:** informar o caminho e perguntar:
```
Encontrei JOCA em [caminho]. O que queres fazer?
[1] Reconfigurar esta instalação (corre /install)
[2] Instalar noutra pasta (nova cópia)
[3] Cancelar
```

- Se [1]: navegar para `[caminho]/JOCA_Brain` e executar `/install`. Fim deste bootstrap.
- Se [2]: continuar para Passo 2.
- Se [3]: parar.

**Se não encontrou:** continuar para Passo 2.

---

## Passo 2 — Escolher destino

Texto livre: "Onde queres instalar o JOCA? (ex: `~/`, `~/Documents/`, `~/Dev/`, `C:\Users\[nome]\Desktop\`)"

A pasta `JOCA/` será criada dentro do destino escolhido.

---

## Passo 3 — Clonar repositório

```bash
git clone https://github.com/MirrasPT/JOCA.git "<destino>/JOCA"
```

Se `git` não disponível:
- macOS: `brew install git` ou `xcode-select --install`
- Windows: `winget install Git.Git`
- Linux: `sudo apt install git` ou `sudo dnf install git`

Verificar que a estrutura ficou correcta:

```bash
ls "<destino>/JOCA/JOCA_Brain/.claude/commands/" | head -5
```

---

## Passo 4 — Executar /install

Navegar para `JOCA_Brain/` e executar o comando de instalação:

```
cd "<destino>/JOCA/JOCA_Brain"
```

Executar `/install` — o assistente configura:
- Identidade e personalidade (soul calibration)
- Skills (127 disponíveis, sistema de triggers) + auto-orquestração (task-intake 4 vias)
- Browser automation (browser-use CLI, Playwright Agent CLI)
- MCPs (playwright, markitdown — motor do /know)
- CLIs externos (gh, ffmpeg, codex, agy, gws, …) — inventário completo com comandos de instalação por plataforma em `JOCA_Brain/memory/tools/clis.md`
- API keys (OpenAI, Gemini, etc.)
- JOCA_OS (browser interface)
- StatusLine + Rate Limits tracking (Node.js cross-platform)
- `~/CLAUDE.md` (perfil global)

> **Plataforma:** o JOCA_OS foi desenvolvido e validado em **macOS** (plataforma de referência). Em **Windows**, o `/install` activa automaticamente a skill `joca-os-windows`, que testa, verifica e corrige numa só passagem os pontos sensíveis (build do node-pty — requer Visual Studio Build Tools + Python, PTY PowerShell, paths, statusline/Keychain, launchers).

> **Reinstalação segura:** o `/install` detecta instalação existente e preserva `memory/projects/`, `memory/feedback/`, `memory/soul.md` e `JOCA_OS/data/` (projectos, sessões, settings do utilizador).

---

## Placeholders — o que o `/install` preenche

O repositório é publicado sem estado pessoal. Onde havia um caminho de máquina ou um dado
do utilizador, está um placeholder `<...>`. O `/install` preenche-os a partir das respostas
do questionário; esta secção existe para saberes o que é cada um se precisares de o fazer à mão.

**Obrigatório — sem isto o JOCA não funciona:**

| Placeholder | Onde | O que é |
|-------------|------|---------|
| `<JOCA_ROOT>` | `JOCA_Brain/.claude/settings.json` (10 hooks) | Caminho absoluto da pasta que contém `JOCA_Brain/`, com barras `/` e sem barra final. **Se não for substituído, os 10 hooks falham em silêncio** — sem erro visível. Verificar com `grep -c '<JOCA_ROOT>' JOCA_Brain/.claude/settings.json` (tem de dar `0`). |
| `<YOUR_NAME>` · `<YOUR_ROLE>` · `<YOUR_STRENGTHS>` · `<YOUR_LEARNING_AREAS>` · `<STRONG_DOMAIN>` · `<LEARNING_DOMAIN>` · `<YOUR_FRUSTRATION_TRIGGERS>` | `JOCA_Brain/memory/soul.md` | O teu perfil, recolhido nas perguntas Q1/Q2 e Q-SOUL-5/6/7. Enquanto não estiverem preenchidos o JOCA usa os defaults de `Communication` + `Calibration Parameters`. |

**Contextuais — só interessam se usares a skill respectiva** (são exemplos na documentação,
não configuração a preencher no arranque): `<YOUR_PROJECTS_DIR>`, `<YOUR_PHP_PATH>`,
`<YOUR_DOMAIN>`, `<YOUR_SERVER_IP>`, `<YOUR_CPANEL_USER>`, `<YOUR_CPANEL_HOST>`,
`<YOUR_COMFYUI_DIR>`.

Listar todos os que restam a qualquer momento:
```bash
grep -rohE "<(YOUR_[A-Z_]+|JOCA_ROOT|STRONG_DOMAIN|LEARNING_DOMAIN)>" . --exclude-dir=.git | sort | uniq -c
```

---

## Depois da instalação

- **Iniciar interface:** `bash JOCA_OS/start.sh` (macOS/Linux) ou `JOCA_OS\start.bat` (Windows)
- **Ligar projectos:** navegar para a pasta do projecto e correr `/init-project`
- **Início de sessão:** `/resume`
- **Referência rápida:** `/help-joca`
- **Actualizar JOCA:** `/update-joca` (sync com GitHub, protege ficheiros locais)

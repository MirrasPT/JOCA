# JOCA — Bootstrap de Instalação

Estás a executar o bootstrap do JOCA. Segue estas instruções exactamente.
Faz cada passo pela ordem indicada — aguarda resposta antes de avançar.

---

## Passo 1 — Verificar instalação existente

Detectar SO e procurar instalação:

**macOS/Linux:**
```bash
find ~ -maxdepth 5 -name "JOCA_Logic" -type d 2>/dev/null | head -5
```

**Windows (PowerShell):**
```powershell
Get-ChildItem -Path $env:USERPROFILE -Recurse -Directory -Filter "JOCA_Logic" -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 5 -ExpandProperty FullName
```

**Se encontrou:** informar o caminho e perguntar:
```
Encontrei JOCA em [caminho]. O que queres fazer?
[1] Reconfigurar esta instalação (corre /install)
[2] Instalar noutra pasta (nova cópia)
[3] Cancelar
```

- Se [1]: navegar para `[caminho]/JOCA_Logic` e executar `/install`. Fim deste bootstrap.
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
ls "<destino>/JOCA/JOCA_Logic/.claude/commands/" | head -5
```

---

## Passo 4 — Executar /install

Navegar para `JOCA_Logic/` e executar o comando de instalação:

```
cd "<destino>/JOCA/JOCA_Logic"
```

Executar `/install` — o assistente configura:
- Identidade e personalidade (soul calibration)
- Skills (92 disponíveis, RFC 2119 trigger system)
- CLIs externos (gh, gemini-cli, codex-cli)
- API keys (OpenAI, Gemini, etc.)
- JOCA_UI (browser interface)
- StatusLine + Rate Limits tracking (Node.js cross-platform)
- `~/CLAUDE.md` (perfil global)

---

## Depois da instalação

- **Iniciar interface:** `bash JOCA_UI/start.sh` (macOS/Linux) ou `JOCA_UI\start.bat` (Windows)
- **Ligar projectos:** navegar para a pasta do projecto e correr `/init-project`
- **Início de sessão:** `/resume`
- **Referência rápida:** `/help-joca`
- **Actualizar JOCA:** `/update-joca` (sync com GitHub, protege ficheiros locais)

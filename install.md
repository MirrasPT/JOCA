# JOCA — Bootstrap de Instalação

Estás a executar o bootstrap do JOCA. Segue estas instruções exactamente.
Faz cada passo pela ordem indicada — aguarda resposta antes de avançar.

---

## Passo 1 — Verificar instalação existente

```bash
find ~ -maxdepth 5 -name "JOCA_Logic" -type d 2>/dev/null | head -5
```

**Se encontrou:** informar o caminho e perguntar:
```
Encontrei JOCA em [caminho]. O que queres fazer?
[1] Reconfigurar esta instalação (corre /install)
[2] Instalar noutra pasta (nova cópia)
[3] Cancelar
```

- Se [1]: navegar para `[caminho]` e executar `/install`. Fim deste bootstrap.
- Se [2]: continuar para Passo 2.
- Se [3]: parar.

**Se não encontrou:** continuar para Passo 2.

---

## Passo 2 — Escolher destino

Texto livre: "Onde queres instalar o JOCA? (ex: `~/`, `~/Documents/`, `~/Dev/`)"

A pasta `JOCA/` será criada dentro do destino escolhido.

---

## Passo 3 — Clonar repositório

```bash
git clone https://github.com/MirrasPT/JOCA.git "<destino>/JOCA"
```

Se `git` não disponível: instruir instalação (`brew install git` ou `winget install Git.Git`) e repetir.

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

Executar `/install` — o assistente configura identidade, personalidade (soul), skills, MCPs, API keys, JOCA_UI, StatusLine e `~/CLAUDE.md`.

---

## Depois da instalação

- **Iniciar interface:** `bash JOCA_UI/start.sh` (macOS/Linux) ou `JOCA_UI\start.bat` (Windows)
- **Ligar projectos:** navegar para a pasta do projecto e correr `/init-project`
- **Início de sessão:** `/resume`
- **Referência rápida:** `/help-joca`

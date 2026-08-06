# JOCA — Bootstrap de `/clean-install`

Estás a executar o bootstrap do `/clean-install`. Segue estas instruções exactamente, pela ordem
indicada — aguarda resposta antes de avançar.

**Para quem já tem JOCA nesta máquina** (possivelmente várias cópias antigas) e sente consumo
excessivo de tokens, instalações a conflituar, ou quer simplesmente uma instalação limpa sem perder
memória. Se NUNCA instalaste JOCA nesta máquina, usa antes o
[`install.md`](https://raw.githubusercontent.com/MirrasPT/JOCA/main/install.md).

---

## Porque é que isto corre numa pasta vazia nova (não de dentro do JOCA antigo)

**Nunca correr isto de dentro de uma instalação JOCA já existente.** O `/clean-install` acaba por
arquivar instalações antigas — se corresse de dentro de uma delas, estaria a tentar mover/arquivar a
própria pasta de onde o Claude Code está a correr, a meio da sessão. É um problema evitável: cria
uma pasta nova e vazia, abre um terminal Claude Code lá dentro, e cola o prompt deste ficheiro
(não o conteúdo do ficheiro em si — o PROMPT, ver Passo 1).

---

## Passo 1 — Confirmar pasta vazia

```bash
ls -A   # macOS/Linux
```
```powershell
Get-ChildItem -Force   # Windows
```

Se a pasta NÃO estiver vazia: parar e avisar — "Esta pasta não está vazia. Cria uma pasta nova e
volta a correr o prompt lá." Não continuar com ficheiros de outra coisa já cá dentro.

---

## Passo 2 — Clonar o JOCA para dentro desta pasta

```bash
git clone https://github.com/MirrasPT/JOCA.git .
```

(o `.` no fim é de propósito — clona PARA DENTRO da pasta actual, não cria uma subpasta `JOCA/`
como o `install.md` normal faz. Esta pasta, tal como está, **é** a instalação nova a partir de
agora — não se move outra vez.)

Se `git` não disponível:
- macOS: `brew install git` ou `xcode-select --install`
- Windows: `winget install Git.Git`
- Linux: `sudo apt install git` ou `sudo dnf install git`

Verificar que a estrutura ficou correcta:
```bash
ls JOCA_Brain/.claude/commands/clean-install.md
```

---

## Passo 3 — Executar /clean-install

```bash
cd JOCA_Brain
```

Executar `/clean-install` — o comando vai:
1. Descobrir TODAS as outras instalações JOCA nesta máquina (esta pasta, por ser a que acabou de
   nascer, nunca entra nessa lista — ver "Fase -1" do próprio comando).
2. Auditar cada uma contra este baseline que acabaste de clonar (o mais recente do GitHub).
3. Mostrar uma tabela de optimizações (bloat de tokens, MCPs caros, skills mortas, etc.) e esperar
   a tua aprovação explícita antes de tocar em nada.
4. Consolidar a memória de TODAS as instalações antigas para aqui (a mais recente por data vence
   em conflito, nada se descarta).
5. Arquivar cada instalação antiga encontrada numa pasta `Old/` (nunca apagar).
6. Correr o graphify (obrigatório) sobre todos os projectos ligados + esta instalação.
7. Actualizar `~/CLAUDE.md` para apontar para AQUI como a instalação de produção.

---

## Depois

- Esta pasta é a nova instalação de produção — fica onde a criaste, não se move.
- As instalações antigas ficam em `Old/` (dentro ou ao lado desta pasta, conforme o comando reportar).
- **Iniciar interface:** `bash JOCA_OS/start.sh` (macOS/Linux) ou `JOCA_OS\start.bat` (Windows).
- **Actualizar no futuro:** `/update-joca`.

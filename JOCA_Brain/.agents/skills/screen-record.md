---
name: screen-record
description: "Gravar o ecrã do Windows para uma janela ou monitor específico (não o desktop virtual inteiro), com a janela-alvo posta à frente e maximizada de facto, pré-voo por frame antes do take a sério, e o resultado verificado por frame — nunca pelo exit code do ffmpeg. Não serve para demos de App Review/auditoria de plataforma (TikTok, app stores) — essas grava-as à mão o dono da conta. MUST invoke quando o user diz: gravar o ecrã, screen recording, gravar demo, gravar vídeo do ecrã, capturar janela específica, screen-record. SHOULD invoke quando: a gravação saiu com o monitor errado ou esmagada, a janela não ficou à frente/maximizada na gravação, aparece uma banda/aviso de automação no vídeo, preciso de recortar ou montar uma gravação de ecrã, quero um frame de pré-voo antes de gravar a sério."
triggers: gravar o ecrã, screen recording, screen-record, gravar demo, gravar vídeo do ecrã, capturar janela específica, gdigrab, ffmpeg gravar ecrã, monitor errado na gravação, janela não maximizou na gravação, banda de automação no vídeo, recortar gravação de ecrã, pré-voo de gravação
origin: local
chain: video
---

# Screen Record — captura de ecrã Windows (janela/monitor + montagem)

Receita técnica tirada de uma gravação real (demo de 92s para a app review do TikTok — **rejeitada** por ter sido feita por agente; ver aviso abaixo). Cada armadilha abaixo já custou uma sessão a resolver do zero — usar isto, não reinventar. Vizinha da `site-capture` (essa é DOM/browser; esta é ecrã/SO).

**Estado da verificação [win] 2026-08-20** — medido numa máquina Windows, não copiado da documentação:
- `ffmpeg` **8.1-full_build** (Gyan, via winget) no PATH · `gdigrab` listado em `ffmpeg -devices` ✓
- `offset_x` · `offset_y` · `video_size` · `framerate` · `draw_mouse` **existem todos** em `ffmpeg -h demuxer=gdigrab` ✓
- ⚠ **Por medir:** nenhuma gravação foi corrida ponta a ponta, e o snippet `Add-Type` de P/Invoke (`AttachThreadInput`/`BringWindowToTop`/`ShowWindow`) vem de fontes públicas, não de execução. Trata o §2 como receita a confirmar no primeiro uso — e é por isso que o pré-voo por frame (§ Verificação) não é opcional.
- Se `ffmpeg` faltar noutra máquina: `winget install Gyan.FFmpeg`.

⚠ **Demo para App Review ou auditoria de terceiros (TikTok, app stores) não a grava o Claude.** Grava-a à mão o dono da conta; o Claude só prepara o guião e a checklist (privacidade do §3 incluída). O TikTok rejeitou explicitamente o vídeo do Direct Post gravado por ffmpeg/automação, por ser feito por agente de IA ou ferramenta automática — ~4 dias de review e uma volta inteira (2026-10-01).

---

## 1. Escolher o monitor a partir da janela-alvo

`ffmpeg -f gdigrab -i desktop` sem `offset_x`/`offset_y`/`video_size` capta o **desktop virtual inteiro** — com dois monitores, isso sai esmagado/composto (ex.: 1920×540), não a janela que interessa. Medir o monitor pela janela-alvo, nunca assumir o primário:

```powershell
Add-Type -AssemblyName System.Windows.Forms

$proc = Get-Process | Where-Object { $_.MainWindowTitle -match '<parte do título>' } | Select-Object -First 1
$hwnd = $proc.MainWindowHandle
$screen = [System.Windows.Forms.Screen]::FromHandle($hwnd)
$b = $screen.Bounds
"offset_x=$($b.X) offset_y=$($b.Y) video_size=$($b.Width)x$($b.Height)"
```

Estes 4 valores (`offset_x`, `offset_y`, `width`, `height`) são os que entram no comando de gravação — nunca gravar "desktop" a direito.

---

## 2. Pôr a janela à frente e maximizada de facto

`AppActivate`/`SetForegroundWindow` isolado é recusado pelo Windows fora de contexto de input do utilizador. Padrão que funciona: anexar a thread de input antes de trazer a janela ao topo.

```powershell
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Focus {
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId);
    [DllImport("user32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$targetThread = [Win32Focus]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)
$currentThread = [Win32Focus]::GetCurrentThreadId()
[Win32Focus]::AttachThreadInput($currentThread, $targetThread, $true) | Out-Null
[Win32Focus]::BringWindowToTop($hwnd) | Out-Null
[Win32Focus]::ShowWindow($hwnd, 3)          # 3 = SW_MAXIMIZE
[Win32Focus]::SetForegroundWindow($hwnd) | Out-Null
[Win32Focus]::AttachThreadInput($currentThread, $targetThread, $false) | Out-Null
```

⚠ **`ShowWindow(hwnd, 9)` (SW_RESTORE) DESMAXIMIZA** — armadilha silenciosa: a gravação sai com a janela do tamanho errado e nada avisa. Usar sempre `3` (SW_MAXIMIZE) quando o objectivo é maximizar.

(Estado de verificação deste bloco: ver o aviso no topo da skill — não repetido aqui.)

---

## 3. Limpar o ecrã antes de gravar (privacidade)

O vídeo pode ir para um terceiro (foi o caso: submissão a app review). Inventariar e fechar/ocultar ANTES do take, não editar depois:

| Verificar | Acção |
|---|---|
| Notificações (Focus Assist / Windows notification center) | Desligar antes de gravar |
| Separadores/bookmarks do browser com nomes de clientes | Fechar ou ocultar barra de favoritos |
| Apps de chat (Slack/Teams/email) com preview de mensagens | Fechar ou silenciar |
| Tabuleiro do sistema (relógio, ícones de apps sensíveis) | Aceitar conscientemente ou cortar no crop |
| Nome de utilizador/conta visível na UI | Confirmar se pode ir no vídeo |

---

## 4. Pré-voo — 1 frame antes do take a sério

Um take de dezenas de segundos refeito custa muito mais do que um frame. Extrair e **olhar** antes de gravar a sério:

```powershell
ffmpeg -f gdigrab -offset_x $($b.X) -offset_y $($b.Y) -video_size "$($b.Width)x$($b.Height)" -i desktop -vframes 1 -y preflight.png
```

Depois: `Read()` o `preflight.png` — confirmar janela inteira, enquadramento e ausência de conteúdo privado antes de avançar para o passo 5.

---

## 5. Gravar

```powershell
ffmpeg -y -f gdigrab -framerate 30 `
  -offset_x $($b.X) -offset_y $($b.Y) -video_size "$($b.Width)x$($b.Height)" `
  -i desktop -pix_fmt yuv420p -c:v libx264 -crf 18 out.mp4
```

- `-framerate 30` — suficiente para demo de UI; subir só se houver movimento rápido a justificar.
- `-pix_fmt yuv420p` — compatibilidade universal de playback (sem isto alguns players recusam o mp4).
- `-crf 18` — qualidade visualmente sem perdas; não usar valores altos (>23) em demo que vai a review externo.
- Parar com `q` no terminal onde o ffmpeg corre (não fechar a janela à bruta — pode corromper o `.mp4`).

### 5b. macOS [mac] — `avfoundation`

O `gdigrab` é só Windows. No Mac (2026-09-21, por medir ponta a ponta nesta skill):

```bash
ffmpeg -f avfoundation -list_devices true -i ""          # índice do ecrã ("Capture screen N")
ffmpeg -y -f avfoundation -pixel_format nv12 -framerate 30 -i "<idx>:none" \
  -pix_fmt yuv420p -c:v libx264 -crf 18 out.mp4
```

- **Ecrã inteiro apanha apps pessoais** (o WhatsApp apareceu num frame de teste): pôr o Chrome **à
  frente** (computer-use) **antes do 1.º frame** e recortar no fim só a barra + conteúdo (§6, `crop`).
- **Apagar logo o ficheiro do teste de captura** — é privacidade, não lixo.
- O Chrome MCP abre o OAuth num separador fora do grupo (não controlável): fazer esse passo à mão.

---

## 6. Recortar a banda de automação (se aplicável)

Conduzir o browser por automação (Playwright/CDP) imprime uma faixa ("'Claude' iniciou a depuração deste navegador") que fica **dentro do ficheiro gravado**. Duas saídas: recortar, ou fazer o take à mão sem automação.

⚠ **Nunca medir o corte por limiar/threshold de cor.** Já aconteceu confundir-se o fundo creme da app com a faixa e cortar-se a banda errada, perdendo a montagem inteira. Medir por um **elemento inequívoco** — um botão de cor sólida e única, não a média da imagem:

```python
from PIL import Image
img = Image.open('frame.png')
px = img.getpixel((x_amostra, y_amostra))  # coordenada dentro do elemento-alvo, não da faixa
print(px)  # confirmar visualmente que é a cor do elemento, antes de confiar nele como âncora
```

**Se a UI gravada não tiver nenhum elemento de cor sólida perto da fronteira** (o caso que a receita
acima não cobre): não improvisar por cor. A altura da faixa é constante por versão de Chrome/driver —
medi-la **uma vez**, num take descartável contra uma página de fundo liso e conhecido (`about:blank`),
guardar o valor na memória do projecto com a versão a que corresponde, e reutilizá-lo. Re-medir só
quando o Chrome ou o driver mudarem de versão.

Usar a coordenada Y confirmada como fronteira do crop:

```powershell
ffmpeg -i out.mp4 -vf "crop=iw:ih-<altura_da_banda>:0:<altura_da_banda>" -c:v libx264 -crf 18 -c:a copy cortado.mp4
```

`crop` é um filtro — exige re-encode (`-c:v libx264`), nunca `-c copy` numa passagem com `-vf`.

**Depois de recortar, extrair um novo frame e `Read()`-lo** (passo 7) — não confiar na aritmética do crop sozinha.

---

## 7. Verificação (gate — obrigatório antes de declarar concluído)

Nunca aceitar pelo exit code do ffmpeg. Extrair e olhar:

```powershell
ffmpeg -i cortado.mp4 -vframes 1 -ss 00:00:00 f_inicio.png -y
ffmpeg -i cortado.mp4 -vframes 1 -ss 00:00:<meio> f_meio.png -y
ffmpeg -i cortado.mp4 -vframes 1 -ss 00:00:<fim-1> f_fim.png -y
```

`Read()` os 3 frames e confirmar:
- [ ] Janela-alvo inteira e enquadrada (sem cortes indevidos, sem barras pretas inesperadas)
- [ ] Sem banda/aviso de automação visível
- [ ] Sem dados privados (email, notificações, nomes de clientes) em nenhum dos 3 frames
- [ ] Resolução/proporção batem com o pedido (ex.: 1080×1920 para vertical)
- [ ] Duração real ≈ duração esperada (`ffprobe -i cortado.mp4 -show_entries format=duration -v quiet`)

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| `ffmpeg -f gdigrab -i desktop` sem medir o monitor da janela-alvo | Medir `offset_x`/`offset_y`/`video_size` via `Screen.FromHandle(hwnd)` primeiro (§1) |
| `ShowWindow(hwnd, 9)` para "garantir que a janela aparece" | `ShowWindow(hwnd, 3)` — SW_MAXIMIZE; SW_RESTORE desmaximiza |
| Recortar a banda de automação por limiar de cor da imagem | Localizar por elemento inequívoco + confirmar a cor amostrada antes de usar como âncora (§6) |
| Dar a gravação por boa porque o `ffmpeg` saiu sem erro | Extrair frames início/meio/fim e `Read()`-los (§7) — exit code 0 não prova enquadramento nem conteúdo |
| Editar/cortar com `-c copy` numa passagem que usa `-vf crop`/filtros | `crop` exige re-encode; `-c copy` só serve para trim sem filtros |
| Gravar primeiro, inventariar conteúdo privado depois | Fechar/ocultar notificações, separadores, nomes de clientes ANTES do take (§3) |
| Ir direto ao take de 90s sem pré-voo | 1 frame de pré-voo (§4) — muito mais barato que refazer o take |

---

## Próximo passo (chain)

Gravação verificada e sem edição adicional pedida → entregar. Se precisar de legendas/overlays/composição → `video` (HyperFrames — vídeo em HTML; escolhe também entre geração AI e outras ferramentas). Reversível — encadear sem perguntar, notificar `[chain → video]`.

## Related Skills

- **site-capture** — mesma família de problema (captura visual), alvo diferente: DOM/browser, não ecrã/SO
- **video** — router de vídeo e dona do HyperFrames: composição/legendas/overlay sobre o vídeo já gravado

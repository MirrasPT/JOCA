---
name: pdf-redaction
description: "Redigir/tarjar um PDF antes de o enviar a terceiros, de forma que o texto ocultado deixe mesmo de existir. MUST invoke quando o user diz: redigir PDF, tarjar, ocultar dados no PDF, censurar documento, anonimizar PDF, esconder NIF/IBAN/morada num PDF, mandar factura sem os dados, redact PDF. SHOULD invoke quando: enviar documento a terceiro (advogado, seguradora, operadora, banco, cliente) com dados pessoais lá dentro · pedido para 'pôr um rectângulo preto por cima' · desfocar/blur uma zona de um documento · partilhar contrato/extracto/factura publicamente."
triggers: redigir pdf, redact pdf, tarjar, tarja preta, ocultar dados pdf, censurar documento, anonimizar pdf, esconder nif, esconder iban, esconder morada, rectangulo preto no pdf, blur no documento, mandar factura sem dados, partilhar contrato anonimizado, redaccao de documento
origin: local
allowed-tools: Read, Write, Edit, Bash
chain: gdpr-compliance
---

# PDF redaction — tapar não é redigir

**Desenhar um rectângulo preto (ou branco, ou um blur) por cima de texto num PDF vectorial não
redige nada.** A camada de texto sobrevive por baixo e sai inteira com um comando:

```bash
pdftotext -q documento-redigido.pdf - | grep -o -i -F -f termos.txt | wc -l
```

É a falha de privacidade mais silenciosa que há: o documento **parece** redigido, passa a revisão
visual, e o destinatário extrai os dados sem esforço nenhum. A regra desta skill é uma só:

> **A única redacção fiável é destruir a camada de texto — rasterizar a página e tarjar o pixel.**
> Tudo o resto é decoração por cima de dados vivos.

---

## Ambiente medido (macOS, verificado 2026-09-09 — reconfirmar antes de usar)

| Ferramenta | Estado | Uso |
|---|---|---|
| `pdftotext` 26.04.0 | ✅ | coordenadas (`-bbox-layout`) + **o gate** |
| `pdftoppm` 26.04.0 | ✅ | rasterizar (é isto que mata o texto) |
| `pypdf` 6.11.0 | ✅ | **merge das páginas** + contagem de páginas |
| `PIL` (Pillow) | ✅ | tarjas + nota de honestidade. Codec JPEG disponível (`Image.features.check('jpg') → True`) |
| Chrome | ✅ `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | só se for preciso remontar via HTML — **desnecessário** com pypdf |
| `python3` 3.14.6 | ✅ `/opt/homebrew/bin/python3` — usar `#!/usr/bin/env python3`, não o caminho absoluto (o script também tem de correr em Windows) | os dois scripts |
| `grep` | ✅ **é `ugrep` 7.8.4 no PATH**, não o BSD `/usr/bin/grep` | paridade em `-o -i -F -f` verificada nos dois a 2026-09-09 |
| Arial | ✅ `/System/Library/Fonts/Supplemental/Arial.ttf` | nota de honestidade; sem ela o fallback `load_default()` ignora o `size` em Pillow antigo e a nota sai minúscula |
| `qpdf`, `gs` (Ghostscript) | ⛔ **NÃO instalados nesta máquina** | não receitar; se um dia entrarem, `command -v qpdf` primeiro |

Reconfirmar em 1 linha antes de escrever qualquer script:

```bash
for c in pdftotext pdftoppm qpdf gs; do printf '%-10s %s\n' "$c" "$(command -v $c || echo AUSENTE)"; done
python3 -c "import pypdf, PIL; from PIL import Image; print(pypdf.__version__, PIL.__version__, Image.features.check('jpg'))"
```

⚠ `pdfunite` existe mas **produz PDF malformado ao juntar ficheiros com AcroForm** (herdado de 2026-08-21, **não reproduzido** em 2026-09-09)
(`xref num N not found`, `Reference in Fields array to an invalid or non existent object`) — renderiza
no visualizador e vai partido para o destinatário. **Merge é sempre por `pypdf`.**

---

## O procedimento (5 passos, por esta ordem)

### 0. Nunca escrever por cima da fonte
O original é prova e não se recupera. Saída sempre em ficheiro irmão: `<nome>-redigido.pdf`.
`test -f` antes de escrever; se existir, `-redigido-v2.pdf`.

### 1. Lista de termos, num ficheiro
Um termo por linha, em `termos.txt` (no scratchpad, **fora** da árvore do projecto — contém os dados
sensíveis em claro). Incluir **todas as variantes de escrita**: `123456789`, `123 456 789`,
`123.456.789`. O passo 2 normaliza, mas a lista é a fonte de verdade do gate.

⚠ Termos com <4 caracteres tarjam por acidente (`ana` acerta em `banana`). Usar o valor completo.

### 2. Controlo positivo — **antes** de redigir
```bash
pdftotext -q origem.pdf - | grep -o -i -F -f termos.txt | wc -l
```
Tem de dar **> 0**. Se der 0 na fonte, **pára**: ou a lista está errada, ou o PDF é digitalizado (só
imagem, sem camada de texto — aí o `pdftotext` do gate nunca acusará nada e o gate é cego). Sem este
passo o gate final não vale nada: **um ficheiro inexistente e um ficheiro limpo dão exactamente o
mesmo "0 ocorrências"** — já aconteceu, 9 termos com "0 ocorrências" num ficheiro que não existia
porque o passo anterior tinha falhado.

### 3. Localizar → rasterizar → tarjar → remontar

```python
#!/usr/bin/env python3
# uso: redigir.py origem.pdf saida.pdf termos.txt
import sys, subprocess, unicodedata, shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

SRC, OUT, TERMOS = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
DPI, MARGEM, JANELA = 200, 2.0, 6          # DPI do raster · folga em pontos · nº máx de palavras por termo
assert SRC.exists() and not OUT.exists(), 'fonte em falta ou destino já existe (não sobrescrever)'

norm = lambda s: ''.join(c for c in unicodedata.normalize('NFKD', s or '').lower() if c.isalnum())
alvos = [a for a in (norm(t) for t in TERMOS.read_text().splitlines()) if a]

work = OUT.parent / '_redact_tmp'                     # scratchpad, NUNCA dentro do projecto
shutil.rmtree(work, ignore_errors=True); work.mkdir(parents=True)

# 0) poppler 26.04 ABORTA (SIGABRT, `std::out_of_range`) em -bbox se o /Info tiver um campo de
#    texto VAZIO (`/Keywords ''` do reportlab chega). Reescrever sem os campos vazios — e usar
#    ESTA cópia para bbox E raster, para as coordenadas virem do mesmo ficheiro que se rasteriza.
_r = PdfReader(str(SRC)); _w = PdfWriter(); _w.append_pages_from_reader(_r)
_w.add_metadata({k: v for k, v in (_r.metadata or {}).items() if str(v).strip()})
BASE = work / 'base.pdf'; _w.write(str(BASE)); _w.close()

# 1) coordenadas por palavra (pontos, origem no canto superior esquerdo — igual ao raster)
subprocess.run(['pdftotext', '-bbox-layout', str(BASE), str(work/'bbox.html')], check=True)
paginas = ET.parse(work/'bbox.html').getroot().findall('.//{*}page')

# 2) rasterizar — é AQUI que a camada de texto morre
subprocess.run(['pdftoppm', '-r', str(DPI), '-png', str(BASE), str(work/'p')], check=True)
pngs = sorted(work.glob('p-*.png'), key=lambda p: int(p.stem.rsplit('-', 1)[-1]))
assert len(pngs) == len(paginas), f'{len(pngs)} imagens vs {len(paginas)} páginas — abortar'

esc = DPI / 72.0
try:    fonte = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', int(10*esc))
except OSError: fonte = ImageFont.load_default()

total = 0
for i, (pg, png) in enumerate(zip(paginas, pngs), 1):
    palavras = [(norm(w.text), (float(w.get('xMin')), float(w.get('yMin')),
                                float(w.get('xMax')), float(w.get('yMax'))))
                for w in pg.findall('.//{*}word')]
    # janela deslizante: um NIF/IBAN parte-se em várias <word>
    marcar, n = set(), len(palavras)
    for a in range(n):
        acc, w0 = '', len(palavras[a][0])
        for b in range(a, min(a + JANELA, n)):
            acc += palavras[b][0]
            # o termo tem de COMEÇAR dentro da 1ª palavra da janela — senão arrasta as inocentes
            if any(0 <= acc.find(alvo) < max(w0, 1) for alvo in alvos):
                marcar.update(range(a, b + 1)); break

    img = Image.open(png).convert('RGB'); d = ImageDraw.Draw(img)
    for k in marcar:
        x0, y0, x1, y1 = palavras[k][1]
        d.rectangle([(x0-MARGEM)*esc, (y0-MARGEM)*esc, (x1+MARGEM)*esc, (y1+MARGEM)*esc], fill=(0, 0, 0))
    total += len(marcar)

    if i == len(pngs):                                  # nota de honestidade (ver §4)
        nota = 'Documento redigido: dados pessoais (identificação, contacto e dados bancários) ocultados.'
        d.rectangle([0, img.height - int(26*esc), img.width, img.height], fill=(255, 255, 255))
        d.text((int(12*esc), img.height - int(19*esc)), nota, fill=(90, 90, 90), font=fonte)

    img.save(work / f'red-{i:04d}.pdf', 'PDF', resolution=DPI)

w = PdfWriter()
for p in sorted(work.glob('red-*.pdf')):
    w.append(str(p))
w.write(str(OUT)); w.close()
shutil.rmtree(work)                                     # ⚠ obrigatório: os PNG intermédios NÃO estão tarjados
print(f'{total} palavras tarjadas em {len(pngs)} páginas → {OUT}')
```

Notas do script, todas com custo já pago por alguém:
- `sorted(glob)` sobre `p-1.png … p-10.png` ordena mal em lexicográfico → chave numérica explícita.
- **`pdftotext -bbox`/`-bbox-layout` rebenta com SIGABRT (`std::out_of_range: basic_string`) se o
  `/Info` do PDF tiver **qualquer** campo de texto vazio** (medido em poppler 26.04.0: `/Keywords`,
  `/Title`, `/Author`, `/Subject`, `/Producer` — basta um `''`). Ficheiros do reportlab caem sempre
  nisto. Daí o passo 0: reescrever com pypdf sem os campos vazios. Sem ele o script morre logo na
  1ª linha útil, com `check=True` (falha ruidosa — não silenciosa).
- A janela deslizante **ancora no início**: sem o `acc.find(alvo) < w0`, um termo que aparece 3
  palavras à frente faz tarjar tudo desde a palavra onde a janela começou — as etiquetas
  («Cliente:», «NIF:») e o texto vizinho desaparecem com o valor. Medido: 39 palavras tarjadas sem
  a âncora vs 28 com ela, no mesmo documento.
- `assert len(pngs) == len(paginas)` é o que apanha páginas rodadas/CropBox estranho antes de tarjar o sítio errado.
  ⚠ Mas **não é suficiente**: com `/Rotate 90` ou CropBox deslocado a contagem bate certo à mesma
  (testado — e nesses dois casos as tarjas caíram no sítio certo, porque `pdftotext -bbox` e
  `pdftoppm` aplicam ambos `/Rotate` e a CropBox). A verificação real é o passo 6: olhar.
- **Se `img.save(..., 'PDF')` levantar `KeyError: 'JPEG'`** (Pillow sem codec JPEG — não é o caso
  desta máquina em 2026-09-09, mas foi em 2026-08-21): `img.convert('P', palette=Image.ADAPTIVE)`
  antes de gravar força FlateDecode e dispensa o JPEG.
- O `_redact_tmp/` guarda o raster **por tarjar**. Apagar não é arrumação, é parte da redacção.

### 4. Declarar a ocultação no próprio documento
Um documento redigido que não diz que o foi convida à suspeita de adulteração. A nota vai **no PDF**
(o script põe-na na última página), e diz **o género** do que foi ocultado, nunca o conteúdo:
✅ «dados pessoais (identificação, contacto e dados bancários) ocultados» ·
⛔ «ocultado o NIF 123456789».

### 5. Gate — com controlo positivo, sempre

```bash
#!/bin/bash
# uso: gate.sh origem.pdf saida.pdf termos.txt
set -uo pipefail
SRC="$1"; OUT="$2"; T="$3"
paginas() { python3 -c "import sys;from pypdf import PdfReader;print(len(PdfReader(sys.argv[1]).pages))" "$1"; }

test -s "$OUT" || { echo "FALHA: $OUT não existe ou está vazio"; exit 1; }

n_src=$(pdftotext -q "$SRC" - | grep -o -i -F -f "$T" | wc -l | tr -d ' ')
[ "$n_src" -gt 0 ] || { echo "FALHA (controlo positivo): 0 ocorrências na FONTE — lista de termos errada ou PDF digitalizado. O gate está cego."; exit 1; }

n_out=$(pdftotext -q "$OUT" - | grep -o -i -F -f "$T" | wc -l | tr -d ' ')
resto=$(pdftotext -q "$OUT" - | tr -d '[:space:]' | wc -c | tr -d ' ')
p_src=$(paginas "$SRC"); p_out=$(paginas "$OUT")

echo "fonte : $n_src ocorrências  (controlo positivo OK)  · $p_src págs"
echo "saída : $n_out ocorrências  · texto extraível residual: $resto chars · $p_out págs"
[ "$n_out" -eq 0 ] && [ "$resto" -eq 0 ] && [ "$p_src" = "$p_out" ] \
  && echo "GATE PASSA" || { echo "GATE FALHA"; exit 1; }
```

Três condições, e a do meio é a que não se pode enganar: **um PDF totalmente rasterizado tem ZERO
texto extraível.** Se `resto > 0`, alguma página escapou ao raster e o documento tem camada de texto
viva — independentemente de os termos aparecerem ou não.

### 6. Olhar para o resultado
`open saida.pdf` (ou rasterizar e ver). O gate não vê **assinaturas manuscritas, fotografias,
matrículas, QR codes e códigos de barras** — não têm camada de texto, o `grep` nunca os acusa, e um
QR code devolve o IBAN inteiro a quem o aponte. Passar os olhos página a página é passo, não zelo.

---

## O que se perde, e quando isso é inaceitável

Rasterizar mata a camada de texto **do documento inteiro**: fica sem pesquisa, sem selecção, sem
acessibilidade, e mais pesado. É o preço da segurança e normalmente paga-se. Não paga quando o
destinatário precisa de processar o texto (parser, OCR contratual, assinatura digital).

Nesse caso a **única** alternativa honesta é **não redigir: regerar o documento sem os dados** — pedir
à origem (portal, ERP, facturação) uma versão sem o campo. Editar objectos de texto num PDF com as
ferramentas desta máquina não é uma via: sem `qpdf` nem `gs` não há como reescrever o content stream
com garantias, e "quase apagado" é igual a não apagado.

---

## Anti-patterns

| Errado | Porquê / Correcto |
|---|---|
| Rectângulo preto no PDF **vectorial** (Preview, Acrobat "marcar", Illustrator, `reportlab` por cima) | O texto fica por baixo, intacto. `pdftotext` devolve-o. Rasterizar primeiro |
| Blur / pixelização por cima de texto vectorial | Idem — e mesmo em raster, blur de texto curto e de formato conhecido (NIF, matrícula) reverte-se |
| Rectângulo **branco** ou tapar com uma imagem | Pior: nem sequer parece redigido, e o texto continua lá |
| "Apaguei a página no visualizador" | Objectos órfãos e versões incrementais do PDF guardam o conteúdo. Rasterizar as páginas que ficam e remontar |
| Gate sem controlo positivo | 0 ocorrências num ficheiro que não existe = 0 ocorrências num ficheiro limpo. Sempre a fonte a **acusar** primeiro |
| `pdftotext` só nos termos | Medir também o **texto residual total** (`resto == 0`): prova que o raster cobriu todas as páginas |
| Juntar as páginas com `pdfunite` | Com AcroForm sai PDF malformado. `pypdf` |
| Deixar `_redact_tmp/` para trás | Contém o raster **por tarjar** — e pior se ficar dentro do repo/Drive |
| Escrever por cima do original | Irreversível e destrói a prova. Ficheiro irmão `-redigido.pdf` |
| Enviar sem olhar | Assinaturas, fotos e QR codes não têm camada de texto: o gate passa e os dados vão na imagem |
| Dizer na nota **o que** foi ocultado | Género, não conteúdo. A nota não pode ser o vazamento |
| Termos de 3 letras na lista | Tarjam por acidente meio documento. Valor completo |

---

## Próximo passo (chain)

- Dados pessoais de terceiros no documento → `gdpr-compliance` (base legal da partilha, minimização).
- Se a fonte ou o destino envolve credenciais/chaves → `credential-handling`.
- Envio do ficheiro é **irreversível**: gate de 1 linha ao utilizador antes de anexar/enviar, com o
  resultado do gate colado.

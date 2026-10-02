---
name: pdf-form-fill
description: "Preencher formulários PDF de terceiros: com campos AcroForm pela via nativa (pypdf — texto, checkbox com /V + /AS, NeedAppearances) e, sem campos (formulário achatado/digitalizado, ou vectorial sem widgets), escrevendo texto por cima nas coordenadas certas, com PyMuPDF. MUST invoke quando o user diz: preencher formulário PDF, preencher PDF com campos, preencher PDF sem campos, o PDF não deixa clicar nos campos, formulário PDF sem AcroForm, escrever por cima de um PDF, preencher ficha em PDF digitalizado. SHOULD invoke quando: chega uma ficha/inscrição em PDF sem nenhum campo interactivo e é preciso devolvê-la preenchida · há caixas a marcar (checkbox) num formulário vectorial sem widgets · o PDF preenchido ficou pesado demais para anexar por email."
triggers: preencher formulario pdf, preencher pdf com campos, checkbox acroform, need_appearances, preencher pdf sem acroform, pdf sem campos para preencher, formulario pdf sem campos, escrever por cima do pdf, preencher ficha pdf digitalizada, marcar checkbox pdf sem widget, pdf pesado demais para anexar, subset fonts pdf, reduzir tamanho do pdf preenchido, sobrepor texto em pdf
origin: local
allowed-tools: Read, Write, Edit, Bash
chain: personal-comms
---

# PDF form-fill — campos AcroForm pela via nativa; sobreposição quando não há AcroForm

Um PDF sem campos interactivos (ficha digitalizada, ou exportada de um site sem widgets) não se
preenche — **escreve-se por cima**, alinhado aos rótulos já impressos. A diferença para editar um
AcroForm normal: aqui não há `field.update()`; o texto é inserido como conteúdo novo na página, nas
coordenadas medidas a partir do texto existente.

> **Portão de entrada:** `doc.is_form_pdf` (ou `page.widgets()` não vazio nalguma página) → **o
> overlay não se aplica**. Há AcroForm real: preenche-se pelos widgets — ver §«PDF com campos
> (AcroForm)» abaixo. Sem campos → procedimento de overlay.

## PDF com campos (AcroForm) — caminho nativo

Decisão: `pypdf` `PdfReader(f).get_fields()` não vazio → preencher os campos; vazio → overlay (procedimento abaixo).
- Texto: `writer.update_page_form_field_values(page, {nome: valor})` com os nomes exactos devolvidos por `get_fields()`.
- **Checkbox marca-se em dois sítios:** `/V` no campo pai **e** `/AS` no widget, com o nome do estado «ligado» lido do próprio widget (`/AP` → `/N`, não assumir `/Yes`). Só um dos dois = caixa vazia num leitor e marcada noutro.
- `writer.set_need_appearances_writer(True)` (NeedAppearances) para o leitor redesenhar os valores.
- Gate igual ao do overlay: **rasterizar e olhar** (passo 4) — o exit code não prova que a caixa aparece marcada.

---

## Ambiente (confirmar antes de escrever o script — nunca assumir)

```bash
python3 -c "import pymupdf; print(pymupdf.__doc__)"   # ou "import fitz" em versões antigas
python3 -c "import fontTools; print(fontTools.__version__)"   # exigido por subset_fonts()
```

TODO: confirmar nesta máquina — não medido nesta sessão. Se `pymupdf`/`fitz` faltar, `pip install
pymupdf`. `fontTools` é o que o `subset_fonts()` usa — TODO: confirmar na documentação oficial o que acontece sem ele (erro ou nada); o import acima resolve a dúvida antes de prometer o ganho.

---

## Procedimento (5 passos)

### 0. Nunca escrever por cima da fonte
Saída em ficheiro irmão: `<nome>-preenchido.pdf`. `test -f` antes; se existir, `-v2.pdf`.

### 1. Localizar os rótulos → coordenadas de ancoragem
```python
palavras = page.get_text("words")   # [(x0, y0, x1, y1, "texto", block_no, line_no, word_no), ...]
```
Cada item é a bbox (em pontos, origem no canto superior esquerdo) de **uma palavra**. Não vem
ordenado por leitura — usar `page.get_text("words", sort=True)` se a ordem importar, ou reconstruir
por `block_no`/`line_no`/`word_no`. Encontrar o rótulo (`"Nome:"`, `"NIF:"`) e ancorar a resposta a
partir do `x1`/`y1` dele (à direita, ou na linha de baixo se o rótulo for seguido de espaço em branco
grande).

### 2. Localizar as caixas de marcar
```python
drawings = page.get_drawings()   # [{"rect":..., "type":"s"|"f"|"fs", "items":[...], "color":..., "fill":..., "width":...}, ...]
```
`get_drawings()` devolve **todos** os vectores da página — linhas de tabela e molduras incluídas, não
só checkboxes. Filtrar por `rect` quase quadrado (`abs(w-h) < tolerância`) e pequeno; a tolerância e o
tecto de tamanho **medem-se no documento em mãos** (não há valor universal — TODO por medir a cada
ficha nova). Associar cada candidato ao rótulo de texto mais próximo (passo 1) para saber o que marca.

### 3. Escrever por cima
```python
page.insert_text(point, texto, fontsize=10, fontname="helv", color=(0, 0, 0))
# checkbox: X centrado no rect, ou duas diagonais
page.draw_line(p1, p2, color=(0, 0, 0), width=1.2)
page.draw_line(p3, p4, color=(0, 0, 0), width=1.2)
```
`insert_text` espera `point` como tuplo `(x, y)` — a **baseline**, não o canto superior da caixa de
texto (compensar com a altura da fonte). Fontes embutidas (`helv`, `tiro`, `cour`) cobrem
`TEXT_ENCODING_LATIN`, que inclui os acentos do português — mas quem confirma isso é o passo 4, não a
leitura da documentação.

### 4. Render de controlo — é o gate, não um extra
```python
pix = page.get_pixmap(dpi=200)
pix.save(f"controlo-pag{n}.png")
```
Abrir o PNG e comparar campo a campo com o original (ou com uma ficha em branco de referência). O
render apanha o que o código não vê: texto a cavalo do rótulo, acento partido, X fora da caixa. Sem
este passo, um overlay desalinhado 3 pt só se descobre quando o destinatário se queixa.

### 5. Subset de fontes no fim — só depois de tudo inserido
```python
doc.subset_fonts()                          # exige fontTools; remove glifos não usados
doc.save(out, garbage=4, deflate=True)   # combinação medida no caso real
```
`subset_fonts()` corre-se **no fim, depois de todas as inserções e mesmo antes de gravar** (ordem usada no
caso real). TODO: confirmar na documentação oficial o efeito de o chamar antes de inserir texto ou mais de uma vez. Caso medido: ficha real
1 MB → 128 KB só com `subset_fonts()` + `save(garbage=4, deflate=True)`.

---

## Gotchas

| Situação | Comportamento |
|---|---|
| `doc.is_form_pdf` True, ou alguma página tem `page.widgets()` não vazio | O overlay não se aplica — §«PDF com campos (AcroForm)» |
| `get_drawings()` sem filtro | Devolve linhas de tabela e molduras junto com os checkboxes — filtrar por forma antes de marcar |
| `get_text("words")` sem `sort=True` | Ordem de extracção, não de leitura — usar `sort=True` ou os `_no` para reconstruir a linha |
| `subset_fonts()` sem `fontTools` instalado | TODO: comportamento não confirmado — correr o import de controlo antes de prometer o ganho de tamanho |
| `subset_fonts()` fora do fim (antes das inserções ou repetido) | TODO: efeito não confirmado — manter a ordem medida: inserir tudo → `subset_fonts()` → `save()` |
| Texto acentuado (á, ã, ç, õ) com fonte embutida | Cobrir pelo render de controlo (passo 4) — não dar como garantido só porque `TEXT_ENCODING_LATIN` inclui Latin-1 |

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| Assumir coordenadas fixas copiadas de outro documento | Medir sempre com `get_text("words")` no ficheiro em mãos — o layout muda entre versões da ficha |
| Marcar checkbox por posição estimada | Detectar o `rect` real via `get_drawings()` e centrar nele |
| Gravar sem `subset_fonts()` num PDF que vai por email | Ficheiro fica na ordem do MB; `subset_fonts()` + `save(garbage=4, deflate=True)` corta para dezenas/centenas de KB |
| Dar o overlay como certo sem abrir o render | Alinhamento errado só se vê rasterizado, não no código |
| Escrever por cima do PDF original | Ficheiro irmão `-preenchido.pdf`, nunca sobrescrever a fonte |
| Tratar `get_drawings()` como se só tivesse checkboxes | Filtrar por forma (quase-quadrado, pequeno) antes de assumir |

---

## Próximo passo (chain)

- Documento final vai por email a terceiro → `personal-comms` (anexo via Chrome `file_upload` é a via
  medida quando o conector nativo falha com ficheiros >~100 KB).
- PDF preenchido com dados pessoais sensíveis que vai ser partilhado além do destinatário directo →
  `gdpr-compliance`.

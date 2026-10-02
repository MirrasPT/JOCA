---
name: html-to-pdf
description: "Export a single HTML page to a faithful 1-page PDF via headless Chrome, avoiding the default US-Letter page-split trap on tall content. MUST invoke when the user says: html to pdf, html-to-pdf, exportar PDF, PDF de 1 página, print-to-pdf, gerar PDF de HTML, print-CSS A4. SHOULD invoke when: PDF partido em 2 páginas, Chrome headless PDF, converter página para PDF, PDF fiel ao design, single-page PDF export."
triggers: html to pdf, html-to-pdf, exportar PDF, PDF de 1 página, print-to-pdf, gerar PDF de HTML, print-CSS A4, PDF partido em 2 páginas, Chrome headless PDF, converter HTML para PDF, single-page PDF, virtual-time-budget
origin: local
---
# HTML → PDF — export fiel de 1 página

Padrão validado: HTML com print-CSS `@page` → Chrome headless `--print-to-pdf` → verificar contagem de páginas + re-leitura visual. Sem isto, o Chrome usa **US Letter por defeito e parte conteúdo alto em 2+ páginas** — a armadilha nº1.

---

## 1. Print-CSS no HTML (obrigatório antes de exportar)

Sem `@page`, o Chrome assume US Letter (216×279mm) — conteúdo mais alto que isso spilla para a página 2.

```css
@page {
  size: 210mm 297mm; /* A4 — trocar por tamanho medido se o conteúdo não for A4 */
  margin: 0;
}
html, body { margin: 0; padding: 0; }
-webkit-print-color-adjust: exact;
print-color-adjust: exact; /* preserva fundos/cores no PDF */

@media print {
  .screen-only { display: none; } /* esconder chrome só de ecrã (nav, botões) */
}
```

**Fit exacto a 1 página:** conteúdo com altura variável (não cabe em A4 fixo) → medir `document.body.scrollHeight` (Playwright/DevTools) e injectar `@page { size: <W>mm <H>mm; margin: 0 }` com a altura real convertida para mm (`px / 96 * 25.4`). Altura usável de A4 ≈ 269-297mm (consoante margens) — qualquer excesso spilla.

---

## 2. Servir o HTML

`file://` pode ser bloqueado pelo Chrome headless (fontes/imagens relativas falham). Servir sempre por HTTP:

```bash
python3 -m http.server 8123
# depois apontar o Chrome a http://localhost:8123/page.html
```

macOS: usar `python3`, não `python`.

---

## 3. Exportar via Chrome headless

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --print-to-pdf=out.pdf \
  --no-pdf-header-footer \
  --virtual-time-budget=6000 \
  http://localhost:8123/page.html
```

- `--no-pdf-header-footer` — remove data/URL/título que o Chrome injecta por defeito.
- `--virtual-time-budget=6000` — dá 6s a fontes/imagens assíncronas antes de imprimir; subir se a página tiver assets pesados.
- Alternativa (fallback, se Chrome indisponível): CLI `cli-printing-press` do inventário de tools do user.

### ⚠ `--print-to-pdf` escreve o PDF e **não termina** (Chrome 153, macOS)

**Sintoma:** o PDF fica completo em disco, mas o processo nunca sai; em primeiro plano estoura o
timeout de 300 s e a corrida bloqueia. Medido no **Chrome 153 em macOS (verificado 2026-09-18)**.
No **Windows com Chrome 153.0.8010.48** o mesmo comando devolveu `exit 0` em <1 s
(verificado 2026-09-18) — o contorno é barato e não faz mal onde não há bug, logo usa-se sempre.

**Contorno: correr em background com perfil próprio, esperar por tamanho estável, matar só este Chrome.**

```bash
UDD=$(mktemp -d)                       # perfil descartável desta corrida
"$CHROME" --headless=new --no-pdf-header-footer --virtual-time-budget=6000 \
  --user-data-dir="$UDD" --print-to-pdf=out.pdf http://localhost:8123/page.html &
prev=-1
for _ in $(seq 1 60); do
  sleep 1
  s=$( [ -f out.pdf ] && wc -c < out.pdf || echo 0 )   # `wc -c < ausente` escreve no stderr: testar primeiro
  [ "$s" -gt 0 ] && [ "$s" = "$prev" ] && break        # dois segundos seguidos com o mesmo tamanho
  prev=$s
done
pkill -f "user-data-dir=$UDD"          # mata SÓ este Chrome — nunca `pkill -f Chrome`
```

- O `--user-data-dir` próprio é o que torna o `pkill` seguro: sem ele o padrão apanha o Chrome do
  utilizador. Confirmado que o Chrome aceita `--headless=new --user-data-dir=… --print-to-pdf=…`
  em conjunto (corrida real, Windows, 2026-09-18).
- Ficheiro que nunca estabiliza (fica a 0 bytes 60 s) → não é este bug; é assets a falhar (§2) ou o
  bug de paginação do grid (ver Gotchas) → passar à via screenshot + Pillow, que não usa
  `--print-to-pdf` de todo.
- **`pkill` é macOS/Linux.** No Git Bash do Windows **não existe** (`which pkill` vazio, verificado
  2026-09-18 — um `command -v pkill` pode dar positivo por ser uma *função* do shell da sessão, não
  um binário; confirmar com `which`). Não faz falta: o bug é do macOS e no Windows o comando sai
  sozinho. Se alguma vez for preciso matar por perfil no Windows, é por PowerShell a filtrar
  `Win32_Process.CommandLine` — **por confirmar, não testado**.
- Loop testado nos dois sentidos (2026-09-18): com o PDF a ser escrito sai em **2 iterações** com o
  tamanho certo; com o ficheiro a nunca aparecer corre o cap até ao fim e **não** declara estável.

---

## 4. Verificar (obrigatório — não declarar concluído sem isto)

**a) Contagem de páginas:**
```bash
mdls -name kMDItemNumberOfPages out.pdf                 # macOS (Spotlight)
pdfinfo out.pdf | grep Pages                            # cross-platform (poppler) — fallback
```
⚠ `mdls` pode devolver `(null)` logo a seguir a escrever (Spotlight ainda não indexou) e não existe fora de macOS → usar `pdfinfo` (ou `pdftk out.pdf dump_data | grep NumberOfPages`) como fallback fiável. Tem de dar o número esperado (normalmente `1`). Se der `2+` → o `@page size` não cobre o conteúdo real; voltar ao passo 1 e medir a altura certa.

**a2) Contagem sem browser nem binários externos (fallback mais fiável):** quando o `mdls` devolve `(null)` e o poppler não está instalado, contar `/Type /Page` nos próprios bytes do PDF:
```bash
python3 -c "import re,sys;d=open('out.pdf','rb').read();print(len(re.findall(rb'/Type\s*/Page[^s]',d)))"
```

**a3) Calibrar a altura por sweep (sem Playwright):** em vez de medir `scrollHeight` no browser, gerar 4-5 PDFs para o scratchpad com alturas candidatas de `@page` e ficar com a **menor que dá 1 página**. ~5 s no total e não depende de browser nenhum — foi o caminho que funcionou numa sessão em que o Playwright estava indisponível (`Browser is already in use for ~/Library/Caches/ms-playwright-mcp/mcp-chrome-<id>, use --isolated`; acontece sempre que outra sessão tem o browser MCP aberto).

**b) Re-leitura visual:** ler `out.pdf` com o `Read` tool (ou `pdftoppm out.pdf preview -png` + abrir a imagem) e confirmar visualmente que o layout bate certo com o HTML original — cortes, overflow e fundos que desapareceram só se apanham a olho. Em macOS, `qlmanage -t -s 1000 -o <dir> out.pdf` gera a miniatura sem instalar nada.

**c) `pdftotext | grep` só prova PRESENÇA, nunca ausência.** Em tabelas o `pdftotext -layout` parte as
células entre linhas e intercala colunas: «Prestação pretendida» deu 0 ocorrências estando lá
(2026-08-27). Um termo «em falta» confirma-se com o texto achatado
(`pdftotext out.pdf - | tr '\n' ' ' | grep -c "<termo>"`) ou, melhor, olhando para a página rasterizada (b).

---

## 5. PDF a partir de HTML com imagens (tamanho do ficheiro)

O `--print-to-pdf` do Chrome **re-embebe PNG/WebP como lossless** — um manual com fotografias sai gigante sem nada de errado no HTML. Receita validada: converter os rasters para **JPEG q80 antes do build**, reconstruir o HTML a apontar para eles, e só depois imprimir. Num manual real levou o PDF de **54,6 MB → 13,8 MB** sem diferença visível.

Cuidados: padrões de tiling e regras `@media print` ficam **no fim da cascata** — uma imagem trocada por JPEG pode reaparecer via uma regra de print que continuava a apontar ao PNG antigo. Confirmar o peso final com `ls -lh out.pdf`, não assumir.

---

## 6. Documento longo self-contained (brand book, manual de normas, 50-80 págs)

Padrão redescoberto de raiz em cada manual — fixá-lo poupa ~1h por projecto:
- **Fragmentos por parte** + um `build.py` que concatena. O ficheiro final é grande demais para editar à mão, e a sidebar repetida em ~70 páginas é a maior fonte de drift.
- O compilador **expande tokens**: `%%ASSET%%` (asset → data URI base64, para o HTML ficar self-contained) e `%%NAV%%` (navegação/TOC gerada uma vez, não copiada por página).
- **Extrair assets de um PDF sem inkscape/pdf2svg:** render com `pypdfium2` + keying por distância de cor + trim da bbox.
- **Remover uma página/parte:** grep pelo texto → apagar o bloco no fragmento-fonte → actualizar `PARTS`/TOC no `build.py` → rebuild → reverificar a contagem de páginas e a página vizinha.

Composição da folha (acentos em maiúsculas que somem em barra escura, `min-height` da mancha, rodapé com `margin-top:auto`, `columns:N` que fragmenta) → ver "Print CSS traps" e "Fixed-page pieces" em `.claude/reference/graphic-design-print.md`.

---

## Gotchas

| Problema | Causa | Fix |
|----------|-------|-----|
| PDF com 2+ páginas | Sem `@page size`, Chrome usa US Letter | Definir `@page { size: <W>mm <H>mm; margin: 0 }` no HTML |
| Conteúdo alto continua a spillar mesmo com A4 | Altura real > 297mm | Medir `scrollHeight` real e usar esse valor em `@page size`, não A4 fixo |
| Fundos/cores desaparecem no PDF | Chrome não imprime backgrounds por defeito | `-webkit-print-color-adjust: exact; print-color-adjust: exact` |
| Fontes/imagens em falta no PDF | `file://` bloqueado ou assets ainda a carregar | Servir via `python3 -m http.server` + subir `--virtual-time-budget` |
| Cabeçalho/rodapé com URL e data no PDF | Header/footer default do Chrome | `--no-pdf-header-footer` |
| PDF de dezenas de MB com poucas fotos | Chrome re-embebe PNG/WebP como lossless | Converter rasters para JPEG q80 **antes** do build (§5) |
| `Browser is already in use … use --isolated` | Outra sessão tem o browser MCP do Playwright aberto | Chrome headless directo (§3) + contagem/sweep sem browser (§4 a2/a3) |
| CSS Grid/Flexbox responsivo colapsa para 1 coluna no PDF, mesmo com `@page` correcto (MediaBox confere) | Bug do motor de paginação do `--print-to-pdf` (medido no Chrome 151, `--headless=new` e legacy, com/sem `--window-size`/`--incognito` — sempre o mesmo) | **Não usar `--print-to-pdf` nestas páginas.** Capturar `--headless --window-size=<W>,<H_generoso> --screenshot=out.png` (uma screenshot normal renderiza o grid correctamente à mesma largura), recortar o fundo em excesso com Pillow (última linha não-background) e gravar como PDF de 1 página: `Image.save(path,"PDF",resolution=96.0)`. Validado 2026-08-27, 3 páginas. |

---

## Checklist

- [ ] `@page { size: ...; margin: 0 }` presente no HTML (A4 ou medido)
- [ ] `print-color-adjust: exact` para preservar fundos/cores
- [ ] HTML servido via `python3 -m http.server` (não `file://`)
- [ ] Comando Chrome com `--no-pdf-header-footer` + `--virtual-time-budget`
- [ ] Contagem de páginas = esperado (`mdls`/`pdfinfo`, ou o regex `/Type /Page` do §4 a2 quando não há binários)
- [ ] PDF re-lido visualmente (Read tool / `pdftoppm`) e layout confirmado fiel ao HTML

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

---

## 4. Verificar (obrigatório — não declarar concluído sem isto)

**a) Contagem de páginas:**
```bash
mdls -name kMDItemNumberOfPages out.pdf                 # macOS (Spotlight)
pdfinfo out.pdf | grep Pages                            # cross-platform (poppler) — fallback
```
⚠ `mdls` pode devolver `(null)` logo a seguir a escrever (Spotlight ainda não indexou) e não existe fora de macOS → usar `pdfinfo` (ou `pdftk out.pdf dump_data | grep NumberOfPages`) como fallback fiável. Tem de dar o número esperado (normalmente `1`). Se der `2+` → o `@page size` não cobre o conteúdo real; voltar ao passo 1 e medir a altura certa.

**b) Re-leitura visual:** ler `out.pdf` com o `Read` tool (ou `pdftoppm out.pdf preview -png` + abrir a imagem) e confirmar visualmente que o layout bate certo com o HTML original — cortes, overflow e fundos que desapareceram só se apanham a olho.

---

## Gotchas

| Problema | Causa | Fix |
|----------|-------|-----|
| PDF com 2+ páginas | Sem `@page size`, Chrome usa US Letter | Definir `@page { size: <W>mm <H>mm; margin: 0 }` no HTML |
| Conteúdo alto continua a spillar mesmo com A4 | Altura real > 297mm | Medir `scrollHeight` real e usar esse valor em `@page size`, não A4 fixo |
| Fundos/cores desaparecem no PDF | Chrome não imprime backgrounds por defeito | `-webkit-print-color-adjust: exact; print-color-adjust: exact` |
| Fontes/imagens em falta no PDF | `file://` bloqueado ou assets ainda a carregar | Servir via `python3 -m http.server` + subir `--virtual-time-budget` |
| Cabeçalho/rodapé com URL e data no PDF | Header/footer default do Chrome | `--no-pdf-header-footer` |

---

## Checklist

- [ ] `@page { size: ...; margin: 0 }` presente no HTML (A4 ou medido)
- [ ] `print-color-adjust: exact` para preservar fundos/cores
- [ ] HTML servido via `python3 -m http.server` (não `file://`)
- [ ] Comando Chrome com `--no-pdf-header-footer` + `--virtual-time-budget`
- [ ] `mdls -name kMDItemNumberOfPages out.pdf` = número esperado de páginas
- [ ] PDF re-lido visualmente (Read tool / `pdftoppm`) e layout confirmado fiel ao HTML

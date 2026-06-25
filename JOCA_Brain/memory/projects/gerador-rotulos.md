---
type: project
name: gerador-rotulos
path: D:/_Restauros/Roma/Gerador
created: 2026-06-24
---

# Gerador de Rótulos (Number Composer)

App web local para compor **números de série de garrafas de vinho** a partir de imagens de dígitos, gerir coleções de rótulos e imprimir lotes em PDF A3. Restauro DRC (Domaine de la Romanée-Conti): Romanée-Conti, Échezeaux, Grands Échezeaux, La Tâche, Richebourg, Romanée-St-Vivant — anos 70-89.

## Stack
- React 19 + TypeScript 5.8 + **Vite 6** (app em `rotulos_gerador/`, porta **3000**)
- jsPDF 4.2 (PDF A3), jszip (ZIP), lucide-react
- **Tailwind v3 via PostCSS** (migrado do CDN nesta sessão) + `public/favicon.svg`
- **SEM git.** **SEM backend externo** — persistência via middleware Vite (`vite.config.ts`)
- Arranque: `npm run dev` (no host). ⚠ Se 2 instâncias agarrarem a porta 3000 → estado dividido → `400` no autosave (matar todas + arrancar UMA)

## Arquitectura de dados (importante)
- BD = **um único JSON em disco**: `D:/_Restauros/Roma/Gerador/number_composer_db_2026-03-13.json` (~12 MB)
- `GET/POST /api/db` (middleware Vite). GET por **stream**; POST **atómico** (tmp→rename) + **8 backups rotativos** (`.bak1`–`.bak8`) + guarda anti-wipe (shape + anti-shrink >50%)
- **Imagens de rótulo FORA da BD**: a BD guarda só o caminho (`src: "/labels/<linha>/JPGs/<file>.jpg"`); o middleware **`/labels`** serve `D:/_Restauros/Roma/Rotulos/` **same-origin** (essencial: canvas `toDataURL` não fica tainted). BD passou de **793 MB → 12 MB**. `Cache-Control: no-cache` no `/labels`.
- Imagens-fonte: `D:/_Restauros/Roma/Rotulos/{1_Linha_70-89,2_Linhas_70-89}/JPGs/`
  - 1_Linha (Romanée-Conti): nome ficheiro = `Romanee_Conti_<ano>_<maxnum>.jpg`; coleção = sem sufixo maxnum
  - 2_Linhas (resto): nome = `<Nome>_<ano>.jpg`; coleção = ano preservado

## Scripts utilitários (em D:/_Restauros/Roma/Gerador)
- **`import_labels.js <pasta> <urlPrefix> [--strip-maxnum] [--no-convert]`** — importador CANÓNICO. Lê a BD actual, auto-converte CMYK→sRGB, aplica path-refs, escrita atómica c/ retry anti-lock. `--strip-maxnum` p/ 1_Linha; `--no-convert` se já RGB. Robusto ao path-mangling do Git Bash (recupera `/labels/`).
- **`convert_cmyk_to_srgb.py [pasta...]`** — converte JPGs CMYK→sRGB (PIL+ImageCms, backup em `_CMYK_originais/`). Idempotente.
- **`comprimir_pdf_lossless.py [pasta]`** — comprime PDFs já exportados (Flate lossless aos streams crus). Gera `_comprimido.pdf`. Para PDFs antigos.
- **`add_history.js`** — injecta números no `history` das coleções (atómico).

## Funcionalidades
3 abas: **Compositor** (compor número de imagens 0-9+`.`), **Gerador** (coleções, geração aleatória única c/ dedup por `history`, vistas grid/list/table), **Batch Print** (PDF A3 450×320mm, 9 rótulos/página 3×3, marcas de corte, 300 DPI, replay de lotes via `print_history.json`).

## Estado actual (2026-06-24)
Operacional. Auditoria completa aplicada + várias correcções de cor/UX. App funcional, build verde, `tsc` 0 erros. Imagens 1_Linha + 2_Linhas actualizadas (RGB do user), export branco e PDF comprimido.

## Decisões tomadas
- **2026-06-24** — Imagens movidas para fora da BD (path-refs + middleware `/labels`); BD 793→12 MB.
- **2026-06-24** — Auditoria multi-agente (workflow) → 20+ fixes: **autosave debounced** (~800ms, `App.tsx`, gate `dbLoaded`), escrita atómica + backups, shape/anti-shrink guards, **crash de Rules-of-Hooks** (useMemo após early return em `GeneratorTab`), hydration não-destrutiva (`element:null`), validação pré-impressão, dedup idempotente na geração, `React.memo` no `CanvasPreview`, etc.
- **2026-06-24** — Tailwind **CDN → PostCSS (v3, p/ zero drift)** + favicon.
- **2026-06-24** — **Cor**: JPGs eram CMYK → convertidos a sRGB. Depois o **canvas do Chrome** tingia branco→azulado (gestão de cor imagem→perfil do monitor calibrado); fix: `loadImage` via **`createImageBitmap(blob,{colorSpaceConversion:'none'})`** (pixels crus). Provado pixel-idêntico.
- **2026-06-24** — **PDF lossless menor à saída**: `new jsPDF({compress:true})` + `addImage(...,'FAST')` → imagens FlateDecode em vez de RGB cru. Verificado em node: 3957 KB→11 KB/imagem, SHA-256 dos pixels idêntico. PDF típico ~243→~44 MB.

## Pendente
- Coleção **"St Vivant 1970"** não existe na BD (há JPG `St_Vivant_1970.jpg` órfão) — criar se o user quiser (copiar settings das outras St Vivant).
- (Opcional, oferecido) Indicador "A guardar…/Guardado ✓" + aviso `beforeunload` se houver autosave pendente (fecha a janela de ~800ms de risco).
- (Opcional) `compression:'SLOW'` p/ máximo; remover `importmap` resíduo do `index.html`; extrair `lib/numbers.ts` (dedup duplicado Generator/Batch).

## Gotchas
- **Git Bash converte arg iniciado por `/`** (`/labels/...` → `D:/.../Git/labels/...`). Usar `MSYS_NO_PATHCONV=1` ou PowerShell; `import_labels.js` já recupera `/labels/`.
- **Correr scripts de BD com o dev server parado** (autosave do browser racing → EPERM/lock no rename). Reload do browser após qualquer script (autosave do estado antigo sobreporia).
- **Não confiar em "parece branco"**: validar pixels com PIL. JPGs de prepress vêm CMYK (perfil SWOP) e/ou com perfil que o canvas trata mal.

## Última sessão
2026-06-24 — Auditoria+20 fixes, Tailwind build, imagens off-DB + importador, fix de cor (CMYK + canvas color-management), compressão PDF lossless à saída.

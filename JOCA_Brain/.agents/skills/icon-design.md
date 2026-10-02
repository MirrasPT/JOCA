---
name: icon-design
description: "Derive a favicon/app icon from an existing brand's logo, OR author a vector icon/icon set from scratch — fidelity checked at CONSUMPTION size (16/32px), not just production size. MUST be invoked when the user says: favicon, ícone da marca, app icon, icon set, desenhar ícone, criar favicon, marca para ícone, logomark simplificado. SHOULD also invoke when: a marca já tem logo mas precisa de versão reduzida para favicon/app icon, ou pede-se um conjunto de ícones em vector com grid e peso de traço consistentes."
triggers: favicon, ícone da marca, app icon, icon set, desenhar ícone, criar favicon, marca para ícone, marca-para-icone, logomark, logo simplificado, ícone em vector, conjunto de ícones, icon grid, stroke width, apple-touch-icon
chain: raster-para-vector, design-system, graphic-design
origin: local
---

# icon-design — ícone/favicon de marca existente OU autoria em vector

Dois pedidos que se fundem no mesmo formato de saída (SVG + set de tamanhos). Escolher o caminho pelo
que já existe: **A** quando há marca/logo de origem, **B** quando é desenho novo.

## Caminho A — derivar de marca existente

1. **Fonte é sempre vector.** SVG do logótipo — inventariar por `brand-guidelines.md` §2.1b "Asset
   readiness" (formato/vector/transparente por marca, ANTES de desenhar). Só há PNG/JPEG →
   `raster-para-vector` primeiro, não desenhar de olho por cima do raster.
2. **Isolar o logomark** — símbolo sem wordmark. Um "ícone" com texto ilegível a 16px não serve de
   favicon; se a marca só tem wordmark, o ícone sai de uma letra/monograma, não do texto inteiro.
3. **Simplificar para o tamanho pequeno:** reduzir a 1-2 cores chapadas, remover o que desaparece
   abaixo de 32px (serifas finas, gradiente, sombra, contorno fino a par de outro contorno fino) —
   consequência directa do gate abaixo, não regra à parte.
4. **Margem de segurança ~10% por lado.** Fonte: especificação W3C / guia web.dev de ícones "maskable" (confirmar a secção exacta antes de citar) — a zona
   segura é um círculo centrado com raio de 40% do tamanho do ícone; na prática isso deixa ~10% de
   padding em cada lado sem conteúdo essencial (`(verificado 2026-09-15, W3C Web Application
   Manifest §"Maskable icons")`). Sem esta margem, o launcher (máscara própria em iOS/Android) corta
   o símbolo.
5. **Exportar o set completo**, não só um SVG:
   - `favicon.ico` com 16/32/48px — convenção de mercado (não é requisito formal de nenhuma spec),
     mas o mínimo que o Google Search Central recomenda como **base** é 48×48 antes de escalar para
     baixo `(verificado 2026-09-15, developers.google.com/search/docs/appearance/favicon-in-search)`.
   - `apple-touch-icon.png` 180px — cobre o alvo @3x de 60pt, a densidade mais alta que a Apple
     envia; a página da Apple que descrevia isto formalmente (Safari Web Content Guide) está hoje no
     arquivo — sem doc mantida activa a apontar `(verificado 2026-09-15)`.
   - Ícones Android 192px (`xxxhdpi`, a densidade mais alta do launcher) e 512px (exigido pela Play
     Console para a ficha da loja) `(verificado 2026-09-15, developer.android.com + Play Console)`.
   - `favicon.svg` mestre — escala sem perda, browsers modernos.

## Caminho B — autoria de ícone/vector do zero

Sem marca de origem — ícone novo, avulso ou como parte de um set coerente.

| Regra | Fonte |
|---|---|
| Grid 24×24, 1 grid por set | Material Design System icons: ícones desenhados a 24×24dp `(verificado 2026-09-15, m2.material.io/design/iconography/system-icons.html)` |
| Traço 2px fixo por set (Material; outros sistemas variam 1.5-2px — TODO: confirmar por sistema se o pedido não for Material) | Material Symbols a 24px/peso Regular usa 2px `(verificado 2026-09-15, mesma fonte)` |
| Compensação óptica em curvas | um círculo inscrito num quadrado cobre ~79% da área (π/4) — por isso lê-se mais pequeno; a tipografia usa "overshoot" de ~1-3% do cap-height para compensar formas redondas contra rectas | `(verificado 2026-09-15, en.wikipedia.org/wiki/Overshoot_(typography))`. **Não há valor único** — o skill anterior tinha "+2-4%" sem fonte; corrigido para a gama documentada, e o ajuste final é a olho contra um quadrado de controlo, não um número cravado |
| Pixel-fit (traço em grelha inteira, larguras pares) a tamanhos ≤24px | prática documentada por Material/Adobe Spectrum/IBM Carbon/Firefox Photon: larguras ímpares caem a meio de um pixel e desfocam no rasterizador | `(verificado 2026-09-15, icons8.medium.com/a-guide-to-pixel-perfect-icons)` |
| 1 metáfora por ícone, sem legenda | julgamento de design, não convenção externa — nenhuma citação a dar |

## Gate obrigatório — tamanho de consumo, não de produção

`.claude/reference/gates-runtime.md` ("Ícone · favicon · app icon"): **rasterizar e olhar a 16px e
32px** (ícone de app: no tamanho real do launcher), nunca só no tamanho em que foi desenhado —
detalhe que se lê a 512px vira mancha a 16px. Sem este passo o ícone "parece bem" no editor e falha
na aba do browser.

```bash
# macOS — rasterizar o SVG mestre no tamanho de consumo (via Chrome headless, sem libs extra)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=16,16 --screenshot=favicon-16.png "file:///<path>/favicon.svg"
```

⚠ Comando herdado de `raster-para-vector.md:137-139`, onde está marcado **"não medido nessa
máquina"** — foi testado ponta a ponta no Windows a 200×200, não no macOS, e não a 16×16 em nenhuma
das duas. Quem correr esta skill com Bash+Chrome disponíveis testa uma vez a 16×16 e a 32×32 e
regista o resultado aqui (path + `(medido [mac] AAAA-MM-DD)`); até isso acontecer, tratar o comando
como hipótese, não como facto — e abrir os dois PNGs a olho é o que confirma, não o exit code do
comando.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Desenhar o ícone "de olho" por cima de um logo em PNG | `raster-para-vector` primeiro — fidelidade mensurável (IoU), não opinião |
| Encolher o logótipo inteiro (símbolo + wordmark) para favicon | Isolar só o símbolo; texto não sobrevive a 16px |
| Validar o ícone só no tamanho em que foi desenhado (256/512px) | Rasterizar e olhar a 16px e 32px — gate obrigatório, não opcional |
| Misturar pesos de traço dentro do mesmo set | 1 peso fixo por set, do início |
| Entregar só 1 SVG grande como "o favicon" | Set completo: `.ico` multi-tamanho + `apple-touch-icon` + Android 192/512 |
| Ler o número que "parece certo" (margem, compensação, peso) como spec fechada | Ou tem citação com data acima, ou é julgamento a confirmar a olho contra o resultado |

## Próximo passo (chain)

- Logo de origem só existe em raster → `raster-para-vector` antes deste caminho A.
- Ícone entra num sistema de marca maior → `design-system` (registar como asset) / `brand-guidelines`
  (actualizar `DESIGN.md` com os novos paths).
- Ícone vai para peça de print/social → `graphic-design`.
- Símbolo/nome proposto para uso comercial → avisar falta de verificação INPI/EUIPO (mesma regra de
  `brand-guidelines.md` — não temos acesso a essas bases de dados).

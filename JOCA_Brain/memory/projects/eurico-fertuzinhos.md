---
name: eurico-fertuzinhos
description: WEOPTIMIZE social media — criação de imagens e assets visuais para Instagram, Facebook e LinkedIn
type: project
directorio: D:\Mega\Eurico Fertuzinhos
---

**Cliente:** Eurico Fertuzinhos  
**Marca:** WEOPTIMIZE — Business Performance & Consulting  
**Directório:** `D:\Mega\Eurico Fertuzinhos\`  
**Iniciado:** 2026-06-26  
**PRD:** não gerado

**Why:** Criar conteúdo visual consistente com a brand WEOPTIMIZE para publicação nas redes sociais (Instagram, Facebook, LinkedIn).

**How to apply:** Ao receber um pedido de imagem para este cliente, activar `img-gen` com brand guidelines WEOPTIMIZE (paleta azul, Open Sans, estética de consultoria de negócio). Referências visuais em `Redes_Sociais\2026\06_Junho_Julho\_software\_ref_weoptimize\`.

⚠ **Raiz reorganizada por categoria (2026-07-06)** — ver secção "Reorganização da raiz" no fim.

## Brand (resumo rápido)
- Cores: `#0074B0` (azul principal) · `#133448` (azul escuro) · `#077DB6` · `#0099D5` · `#FFFFFF`
- Fonte: Open Sans
- Tom: profissional, performance, resultados, confiança
- Refs: 5 posts Instagram reais em `_ref/` (imgi_16 a imgi_20)

## Pipeline de produção (validado)
1. Gerar foto com `img-gen-openai` (portrait 4:5, sem texto) → `_gen/post_XX_photo.jpg`
2. Escrever HTML 1080×1350px com layout reference → `_software/XX_Post_DD_MM.html`
3. Render: Chrome headless `--headless=new --no-sandbox --window-size=1080,1350 --screenshot --virtual-time-budget=8000`
4. Converter PNG → JPEG 95%: PowerShell `System.Drawing` → `_Final/XX_Post_DD_MM.jpg`

⚠ **Render via Bash/PowerShell tool exige sandbox OFF.** O sandbox da sessão bloqueia a escrita do screenshot pelo Chrome (`Remove-Item on system path blocked` / PNG nunca aparece). Correr o PowerShell de render com `dangerouslyDisableSandbox: true` **e** passar `--no-sandbox` ao Chrome. Chrome em `C:\Program Files\Google\Chrome\Application\chrome.exe`.

## Layouts dos posts (5 referencias = 5 layouts)
| Ref | Layout | Elementos |
|-----|--------|-----------|
| imgi_16 | Foto + barra azul em baixo | Headline branco na barra, logo Branco.png canto dir |
| imgi_17 | Fundo claro + diagrama central | Sem foto, título azul escuro em cima, logo Cor.png centro baixo |
| imgi_18 | Foto full-bleed + headline azul | Logo Cor.png topo centro, texto #0074B0 sobre foto, 2 linhas diagonais azuis baixo-dir |
| imgi_19 | Foto + barra azul em cima | Headline + lista numerada na barra, logo flutua baixo-dir |
| imgi_20 | Foto + gradiente escuro base | Sem barra sólida, texto/logo sobre gradiente, faixa azul 6px no rodapé |

## Logo — regra de uso
- `Branco.png` → fundos azuis/escuros (barras, gradientes)
- `Cor.png` → fundos claros (foto clara, branco, fundo neutro)
- `Preto.png` → raramente (impressão, fundo muito claro sem azul)
- Path relativo de `_software/`: `../../../../_Marca/_Logo_Weoptimize/PNG/` (4 níveis: `_software→06_Junho_Julho→2026→Redes_Sociais→raiz`, logos em `_Marca/`)

## Noise overlay (grain texture — padrão)
```html
<svg class="noise" xmlns="http://www.w3.org/2000/svg">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.72"
    numOctaves="4" stitchTiles="stitch" result="noise"/>
    <feColorMatrix type="saturate" values="0" in="noise"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>
<!-- CSS: mix-blend-mode:overlay; opacity:0.055; position:absolute;inset:0;z-index:10 -->
```

## Estrutura de ficheiros (raiz reorganizada por categoria — 2026-07-06)
```
Eurico Fertuzinhos/
├── _Marca/                  ← _Logo_Eurico/ + _Logo_Weoptimize/ (canónico; usado pelo pipeline)
├── _Info_Cliente/           ← fontes do cliente (fotos, EBook, logos-dup a limpar)
├── _Diversos/               ← audio/ imagens/ docs/ Varios/ (ficheiros soltos arrumados)
├── Curso/
├── Apresentacoes/           ← 2025_QSP_Summit/ 2026_Apresentacao/ Apresentacoes_Geral/
├── Livro/                   ← 2025_Capa/ 2026_Capa_3_Edicao/ 2026_Capa_A4/ 2025_PDF_Servicos/ 2025_Caderno_Caneta/
├── Marketing/               ← 2024_Newsletter/ 2025_Lona_Weoptimize/
└── Redes_Sociais/
    ├── 2024/
    └── 2026/
        └── 06_Junho_Julho/
            ├── plano.txt           ← briefing de cada post (data + copy)
            ├── _Final/             ← JPEGs 1080×1350 entregues
            └── _software/
                ├── _ref_weoptimize/ ← imgi_16..imgi_20 (5 refs WEOPTIMIZE)
                ├── _ref_eurico/     ← 12 refs marca Eurico
                ├── _gen/            ← fotos AI geradas (post_XX_photo.jpg)
                └── XX_Post_DD_MM.html  ← source de cada post
```

## Sistema de design (2026-06-28 — redesign)

✅ **DUAS direcções INTENCIONAIS no feed** (decisão 2026-06-28: manter ambas — azul + branco como variação):

**A. Direcção "card azul" (posts 01, 02, 05):**
- Fundo azul `#0074B0` sólido (a `.card`); **foto encolhida numa `.frame`** (inset 44px, `border-radius:40px`, `overflow:hidden`) com margem azul à volta toda + cantos arredondados — só a imagem é emoldurada.
- Texto + logo **directamente sobre o azul, sem caixa** (logo `Branco.png`).
- **Seta da marca como overlay** = `_material/arrow_line.png` filtrada a branco (`filter:brightness(0) invert(1)`, opacity ~0.18), **ao nível do card** (z-index 6, NÃO dentro da `.frame`) para cruzar foto + fundo azul.
- **Grão por cima de TUDO** (svg `.noise` é último filho do card, z-index 10).

**B. Direcção "brand claro" (posts 03, 04 — alinhada às refs reais imgi_17/18/20):**
- Fundo claro `#edf2f6`; texto **azul** `#0074B0`; logo a **cor** (`Cor.png`); seta `arrow_line.png` **sem filtro** (fica azul) esbatida (opacity ~0.16); **sem grão**.
- Frase de destaque numa **pill azul** (`#0074B0` sólido, texto branco, `border-radius:14px`) — imgi_20.
- Layout imgi_18 = foto full-bleed + fade claro no topo + logo topo-centro + headline azul centrada.
- Layout imgi_20 = foto emoldurada no topo + texto azul em baixo + pill + logo cor canto.

**Gotcha do grão (resolvido):** `feTurbulence baseFrequency=0.72` = grão sub-pixel que JPEG/ecrã suaviza até desaparecer. Visível só com `baseFrequency=0.5` + `feComponentTransfer` (slope 1.8, intercept -0.4 nos 3 canais p/ contraste) + opacity 0.55, `mix-blend-mode:overlay`. Overlay com cinzento neutro quase não muda nada — o contraste é o que torna o grão visível.

**Anti-espaço-morto (preferência do Renato):** texto deve ser GRANDE e a composição preencher — sem faixas vazias de fundo. Headlines a ~60-68px (não 44-56). Regra para fechar gaps: (1) foto maior (herói) a empurrar o texto, (2) texto maior, (3) compactar o bloco de texto (reduzir `height` da `.content` ao conteúdo real; espaçar listas via `gap`). Pill que parte em 2 linhas preenche melhor que 1 linha curta. Logo ancorado ao canto (`position:absolute` no card) em vez de `space-between` que cria buraco entre texto e logo.

**`_material/`:** `arrow_full.png` (seta sólida azul) + `arrow_line.png` (outline azul) — a marca-seta WEOPTIMIZE para overlays.

## Skill do projecto: `RS_Weoptimize` (2026-06-29)
Skill **local ao projecto** (NÃO no JOCA) em `.claude/skills/RS_Weoptimize/` — gera o lote mensal de posts.
- `SKILL.md` — fluxo mensal + brand + 2 direcções + 5 layouts + recipe de foto-AI + gotchas
- `render.ps1` — HTML → PNG → JPEG 95% (1080×1350). **Fix do URI embutido** (`[System.Uri].AbsoluteUri` p/ codificar espaços do path "Eurico Fertuzinhos" → senão PNG MISSING silencioso). Correr com `dangerouslyDisableSandbox:true`.
- `templates/` — 5 layouts parametrizados (`{{HEADLINE_HTML}}`/`{{PHOTO}}`/etc.): `A1`(foto-topo+headline, post01) · `A2`(lista, post02) · `A3`(foto-topo+subtítulo, post05) · `B1`(full-bleed+headline azul, post03) · `B2`(framed+pill, post04).
- Validado: `render.ps1` reproduz post 03 byte-a-byte (253280 bytes).
- Para gerar mês novo: `[skill: RS_Weoptimize]` + o `plano.txt` do mês.

## Marca 2: Eurico Fertuzinhos (pessoal) — iniciada 2026-06-29
⚠ **Esta pasta hospeda DUAS marcas distintas:** **WEOPTIMIZE** (consultoria, azul — secções acima) e **Eurico Fertuzinhos** (marca pessoal do consultor, laranja). Mesmo pipeline (HTML→Chrome→PNG→JPEG), brand diferente. NÃO misturar.

**Brand (de `_software/_ref_eurico/design info.txt` + 12 refs Instagram reais):** site euricofertuzinhos.pt
- Cores: **laranja `#D45026`/`#9C3A19`** (queimado) · azul `#0F7CBE` · **navy `#030C37`** · claro `#F2F2F2`
- Fontes: **Josefin Sans** (títulos — geométrica, UPPERCASE bold 700) · **Rubik** (textos). Ambas Google Fonts (não instaladas localmente → CDN).
- Logo: **assinatura manuscrita** "Eurico Fertuzinhos" em `_Logo_Eurico/PNG/` (`Logo_Eurico_Branco.png` 5594×1947, `Logo_Eurico_Preto.png`) + SVG/PDF/AI — **sempre topo-centro**, ~270px.
- Footer: `www.euricofertuzinhos.pt` centrado em baixo, esbatido (Rubik 25px, letter-spacing 2px).
- Watermark de marca: **seta ascendente (outline) + `%` gigante + linhas diagonais**, tudo branco esbatido (opacity 0.07–0.10). Sem `_material/` próprio → **recriado em SVG inline** (paths).
- Títulos: Josefin Sans bold uppercase **bicolor** — branco + linha/palavra de ênfase **navy `#030C37`** (sobre laranja/azul) ou tudo branco (sobre navy).

**3 fundos × 4 arquétipos de layout** (das 12 refs `_ref_eurico/`):
- Fundos: gradiente **laranja** · gradiente **azul** (`#0F7CBE`) · **navy sólido** (`#030C37`).
- **A — Citação** (sem foto): aspas grandes esbatidas a flanquear + frase branca + atribuição "EURICO FERTUZINHOS" (refs imgi_31/35/37/39).
- **B — Hook + recorte do Eurico** (PNG transparente, orador/braços cruzados) ao lado/baixo (imgi_21/26/29/32).
- **C — Hook + livro 3D** (mockup *Otimizar Processos 2.ª Ed.*) (imgi_11/17/24).
- **D — Hook + recorte + livro** (imgi_32/42).

**Lote de posts — FEITO** (3 posts, 3 fundos = feed varia laranja→navy→azul):

| Post | Ficheiro | Fundo | Layout | Conteúdo |
|------|----------|-------|--------|----------|
| E01 (24/07) | `E01_Post_24_07` | laranja | A citação | "SEMPRE FIZEMOS ASSIM" + punchline (**CARA** navy) |
| E02 (22/07) | `E02_Post_22_07` | navy `#060E38` | stats | "Resultado com metodologia **O4**?" + 3 stats grandes laranja (−40%/+15%/+25%, flex justify space-between) |
| E03 (liderança, data TBD) | `E03_Post_Lideranca` | azul `#0F7CBE` | A statement | "responsabilidade do **LÍDER**…" (LÍDER navy, 82px, aspas moldura) |

- Todos: assinatura `Logo_Eurico_Branco.png` topo-centro 270px · watermark SVG seta+%+linhas · footer URL. **Watermark esbatido a ~metade** (arrow 0.05 / pct 0.035 / lines 0.045) — pedido do Renato "elementos de fundo mais esbatidos" (2026-07-01). E01 re-renderizado com o novo watermark.
- ⚠ Recorte `2025_PDF_Servicos/_material/Eurico.png` **NÃO é transparente** (tem parede de pedra atrás) → não serve p/ arquétipo B sem reprocessar. Arquétipos B/C/D (recorte/livro) exigem asset transparente novo ou img-gen.
- ⚠ Prefixo `E` nos ficheiros para não colidir com os posts WEOPTIMIZE (`01_Post_...`) na MESMA `_software/`+`_Final/`. **Pendente:** separar Eurico em pasta própria antes do lote (ex.: `2026_Redes_Sociais/_Eurico/`).
- Reaproveitou o `render.ps1` da skill `RS_Weoptimize` (genérico). Skill própria `RS_Eurico` + Branding.md + templates (A citação / stats / statement) = **por construir** (à espera de aprovação do look).

## Estado actual
**WEOPTIMIZE:** 5 posts Jun–Ago 2026 em `_Final/` (JPEG 1080×1350). Skill `RS_Weoptimize` criada 2026-06-29.
**Eurico Fertuzinhos (marca pessoal):** **3 posts renderizados** (E01 citação laranja · E02 stats O4 navy · E03 statement liderança azul) em `_Final/`, watermark esbatido. Feed varia os 3 fundos. A aguardar aprovação do look p/ formalizar skill `RS_Eurico`. Falta: data do post de liderança, legenda do E02 (veio vazia).

| Post | Data | Direcção / Layout | Status |
|------|------|--------|--------|
| 01 | 1 Jul | A — card azul, foto emoldurada, seta+grão | ✅ |
| 02 | 15 Jul | A — card azul, texto topo (lista) + foto emoldurada baixo | ✅ |
| 03 | 29 Jul | B — brand claro (imgi_18): full-bleed + logo topo + headline azul | ✅ |
| 04 | 12 Ago | B — brand claro (imgi_20): foto emoldurada + pill azul | ✅ |
| 05 | 26 Ago | A — card azul, foto emoldurada topo + texto baixo | ✅ (texto re-baixado p/ não entrar na foto, 2026-06-29) |

⚠ `Reel_17_Final.mp4` + `Reel_18_Final.mp4` em `_Final/` — não documentados (origem/datas desconhecidas).

## Decisões tomadas
- 2026-06-26: projecto iniciado, foco em img-gen com brand WEOPTIMIZE
- 2026-06-26: pipeline HTML→Chrome→PNG→JPEG validado; cada post = layout diferente + foto diferente
- 2026-06-26: O4 metodologia real (Observar/Organizar/Operacionalizar/Otimizar) — confirmada do imgi_17
- 2026-06-26: post 03 iterado 3x — versão final = imgi_18 style (foto consultor no quadro de processo)
- 2026-06-28: redesign — foto emoldurada (margem + cantos arredondados) só na imagem; texto fora de caixa; seta `_material/arrow_line.png` como overlay ao nível do card a cruzar fundo+foto; grão (corrigido p/ ser visível) por cima de tudo
- 2026-06-28: refs reais imgi_17/18/20 = sistema de brand verdadeiro → **fundo claro + texto azul + seta azul esbatida + logo a cor + pill azul p/ destaque + sem grão**. Posts 03 e 04 alinhados a este sistema; 01/02/05 ficaram na direcção "card azul"
- 2026-06-28: afinação anti-espaço-morto — headlines ampliadas (01→68px, 05→64px, 04 pre 38/pill 56), fotos maiores, blocos de texto compactados (02 lista espaçada + foto subida). Renato não quer faixas de fundo vazias; texto deve ser grande e preencher
- 2026-06-28: **manter AMBAS as direcções** (azul + branco) no feed como variação intencional — não unificar. Posts futuros alternam entre os 2 sistemas
- 2026-06-29: bug post 05 — 1ª linha do headline entrava na base da foto. Causa: `.content.top`(836) < `.frame` bottom(852). Fix: `content.top`→888. **Regra geral:** `content.top ≥ frame.top + frame.height + ~28px`
- 2026-06-29: criada skill **local** `RS_Weoptimize` (`.claude/skills/` do projecto, fora do JOCA) com pipeline mensal completo + 5 templates + `render.ps1`
- 2026-06-29: gotcha de render — path com espaços ("Eurico Fertuzinhos") parte o `file://` montado à mão → PNG MISSING silencioso. Usar `[System.Uri].AbsoluteUri`
- 2026-06-29: **2ª marca nesta pasta — Eurico Fertuzinhos (pessoal, laranja)**, distinta da WEOPTIMIZE. Sistema de design extraído das 12 refs `_ref_eurico/` (3 fundos × 4 arquétipos A/B/C/D). Post 01 (citação laranja) feito + validado, `render.ps1` da WEOPTIMIZE reaproveitado. Watermark Eurico (seta+%+linhas) recriado em SVG inline (sem `_material/` próprio). Look a aguardar aprovação antes de construir skill `RS_Eurico`+templates.
- 2026-07-01: **+2 posts Eurico** — E02 (resultados O4, navy, 3 stats grandes laranja) + E03 (statement liderança, azul, LÍDER navy). Feed alterna os 3 fundos (laranja/navy/azul). Layout de **stats** (número gigante laranja + label Rubik, flex space-between) = 3º layout do sistema, para conteúdo numérico (não citação). Recorte `Eurico.png` rejeitado (não-transparente).
- 2026-07-01: **watermark (elementos de fundo) esbatido a ~metade** nos 3 posts a pedido do Renato (arrow 0.05 / pct 0.035 / lines 0.045; antes ~0.06–0.10). Textura sem competir com o texto.

## Reorganização da raiz (2026-07-06)
Raiz do cliente reorganizada **por categoria** (era mista ano+tipo + ficheiros soltos). Todos os `mv` no mesmo volume NTFS (instantâneos; MEGA sincroniza como move). Topo agora: `_Marca/ _Info_Cliente/ _Diversos/ Curso/ Apresentacoes/ Livro/ Marketing/ Redes_Sociais/` + `CLAUDE.md`.
- **Pipeline fix:** logos raiz→`_Marca/` e `2026_Redes_Sociais/`→`Redes_Sociais/2026/` (+1 nível) ⇒ os 8 HTMLs + 5 templates + SKILL.md passaram de `../../../_Logo_` para `../../../../_Marca/_Logo_`. **Validado por re-render do post 01** (logo carrega, 479882 bytes).
- **Ficheiros soltos** arrumados: áudios→`_Diversos/audio/`, `MIG_*`+`quartodelua-*`→`_Diversos/imagens/`, `.docx`→`_Diversos/docs/`, `OtimizarProcessos.pdf` (livro)→`_Info_Cliente/EBook/`.
- ⚠ **Logos duplicados por limpar:** `_Info_Cliente/_Logo_Eurico` + `_Info_Cliente/_Logo_Weoptimize` duplicam `_Marca/` (mesmos nomes). `_Marca/` é canónico → apagar os de `_Info_Cliente` depois de confirmar idênticos (não feito nesta passagem).
- **Não feito:** normalização dos nomes internos dos meses antigos (`Software`/`software`/`_Final`/`_Finais`) — Fase 3 opcional.

## Última sessão
2026-07-06: raiz reorganizada por categoria + pipeline de render corrigido e validado (ver secção acima).
2026-07-01: +2 posts Eurico (E02 stats O4 navy · E03 statement liderança azul) renderizados; watermark dos 3 posts esbatido a pedido do Renato. A aguardar aprovação do look p/ formalizar skill `RS_Eurico`.

## Pendente
- **Logos dup:** confirmar `_Info_Cliente/_Logo_*` == `_Marca/_Logo_*` → apagar os de `_Info_Cliente` (GO à parte)
- **Fase 3 (opcional):** normalizar nomes internos dos meses antigos (`Software`/`software`→`_software`, `_Finais`→`_Final`)
- **Eurico:** aprovar look dos 3 posts → construir Branding.md + skill `RS_Eurico` + templates (A citação / stats / statement) + render. Separar Eurico em pasta própria (`_Eurico/`).
- **E03 liderança:** falta a **data de publicação** (só há 24/07 p/ E01 e 22/07 p/ E02) → renomear `E03_Post_Lideranca` → `E03_Post_DD_MM`.
- **Legenda do E02** (O4) veio vazia no plano → escrever ou deixar em branco.
- Arquétipos B/C/D (recorte do Eurico / livro 3D): exigem asset transparente novo (o `Eurico.png` tem fundo) ou geração via img-gen.
- Documentar / decidir destino dos 2 reels (`Reel_17`, `Reel_18`)
- Próximas datas de publicação (set/out 2026) + calendário editorial (alternar azul/branco)
- Próximo lote mensal WEOPTIMIZE: usar a skill `RS_Weoptimize` (criar `plano.txt` do mês primeiro)

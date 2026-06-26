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

**How to apply:** Ao receber um pedido de imagem para este cliente, activar `img-gen` com brand guidelines WEOPTIMIZE (paleta azul, Open Sans, estética de consultoria de negócio). Referências visuais em `2026_Redes_Sociais\06_Junho_Julho\_software\_ref\`.

## Brand (resumo rápido)
- Cores: `#0074B0` (azul principal) · `#133448` (azul escuro) · `#077DB6` · `#0099D5` · `#FFFFFF`
- Fonte: Open Sans
- Tom: profissional, performance, resultados, confiança
- Refs: 5 posts Instagram reais em `_ref/` (imgi_16 a imgi_20)

## Pipeline de produção (validado)
1. Gerar foto com `img-gen-openai` (portrait 4:5, sem texto) → `_gen/post_XX_photo.jpg`
2. Escrever HTML 1080×1350px com layout reference → `_software/XX_Post_DD_MM.html`
3. Render: Chrome headless `--window-size=1080,1350 --screenshot --virtual-time-budget=6000`
4. Converter PNG → JPEG 95%: PowerShell `System.Drawing` → `_Final/XX_Post_DD_MM.jpg`

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
- Path relativo de `_software/`: `../../../_Logo_Weoptimize/PNG/`

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

## Estrutura de ficheiros
```
Eurico Fertuzinhos/
├── _Logo_Weoptimize/PNG/   ← Branco.png, Cor.png, Preto.png
└── 2026_Redes_Sociais/
    └── 06_Junho_Julho/
        ├── plano.txt           ← briefing de cada post (data + copy)
        ├── _Final/             ← JPEGs 1080×1350 entregues
        └── _software/
            ├── _ref/           ← imgi_16..imgi_20 (5 referências de estilo)
            ├── _gen/           ← fotos AI geradas (post_XX_photo.jpg)
            └── XX_Post_DD_MM.html  ← source de cada post
```

## Estado actual
5 posts Jun–Ago 2026 completos e entregues em `_Final/` (JPEG 1080×1350, ~260KB cada).

| Post | Data | Layout | Status |
|------|------|--------|--------|
| 01 | 1 Jul | imgi_16 — barra azul baixo | ✅ |
| 02 | 15 Jul | imgi_19 — barra azul cima + lista | ✅ |
| 03 | 29 Jul | imgi_18 — full-bleed + headline azul + linhas | ✅ |
| 04 | 12 Ago | imgi_20 — gradiente escuro sobre foto | ✅ |
| 05 | 26 Ago | imgi_16 variante — barra azul baixo 2 zonas | ✅ |

## Decisões tomadas
- 2026-06-26: projecto iniciado, foco em img-gen com brand WEOPTIMIZE
- 2026-06-26: pipeline HTML→Chrome→PNG→JPEG validado; cada post = layout diferente + foto diferente
- 2026-06-26: O4 metodologia real (Observar/Organizar/Operacionalizar/Otimizar) — confirmada do imgi_17
- 2026-06-26: post 03 iterado 3x — versão final = imgi_18 style (foto consultor no quadro de processo)

## Pendente
- Próximas datas de publicação (set/out 2026)
- Definir calendário editorial para o resto do ano

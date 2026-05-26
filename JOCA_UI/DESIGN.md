# DESIGN.md — JOCA UI

> Documento vivo. Referência para o redesign completo.
> Não implementar sem decisões confirmadas.

---

## Moodboard — padrões identificados

**Referências analisadas:** macOS widgets, Raycast Wrapped, Alien AI, MonoCloud, Furion PT, Data AI app

### Padrões comuns
- **Cards com glows/halos** — cada sessão/item tem profundidade, borda subtil, glow colorido que indica estado
- **Bento grid** — conteúdo em grelha de cards (não lista plana)
- **Warm accent** — laranja/âmbar como cor de destaque (não azul frio)
- **Sidebar slim e icónica** — navegação por ícones + label curto, não lista de items densos
- **Vista overview + detalhe** — cards no centro, detalhe (terminal) num painel lateral
- **Status visual rico** — glows animados indicam estado sem precisar de ler texto
- **Glassmorphism subtil** — cards com backdrop-blur, bordas semitransparentes
- **Tipografia grande** — informação importante em type grande, não pequeno

---

## Conceito proposto — "Mission Control"

Em vez de: sidebar de lista + um terminal gigante

Passar para: **overview de sessões em cards + terminal focado mais pequeno**

```
┌────────┬──────────────────────────────┬──────────────────┐
│  Nav   │   Session Cards (grid)       │   Terminal       │
│ slim   │                              │   (activo)       │
│        │  ╔══════╗  ╔══════╗         │                  │
│  ◉     │  ║ S1   ║  ║ S2   ║         │  xterm.js        │
│  ○     │  ║ ●work║  ║ ○idle║         │  ~50% largura    │
│  ○     │  ╚══════╝  ╚══════╝         │                  │
│  ○     │                              │                  │
│        │  ╔══════╗  ╔══════╗         │                  │
└────────┴──────────────────────────────┴──────────────────┘
```

---

## Componentes a definir

### Nav sidebar (slim ~56px)
- Ícones: Sessions · Files · Projects · (Settings?)
- Sem texto — só ícones com tooltip
- Branding JOCA no topo (pequeno)
- **A confirmar:** largura exacta, ícones escolhidos

### Session cards grid
- Cada card mostra:
  - Nome da sessão
  - Status visual (glow animado: laranja=working, verde=done/idle, cinza=idle)
  - Preview das últimas linhas de output (truncado, monospace, pequeno)
  - Tempo decorrido desde última actividade
  - Projecto a que pertence (se aplicável)
- Click num card → activa esse terminal no painel direito
- Tamanho dos cards: fixo ou variável?
- **A confirmar:** colunas (2? 3? auto?), altura dos cards

### Terminal panel (direito)
- ~45-50% da largura total
- Título: nome da sessão activa + cwd
- xterm.js normal mas mais pequeno
- Border-left subtil separando do grid
- **A confirmar:** pode fechar/esconder o painel terminal?

### Estado dos chats (indicador visual)
- `working` — glow laranja/âmbar pulsante + spinner subtil no card
- `idle` — sem glow, dot verde estático (pronto para input)  
- `done` — flash verde momentâneo + badge "✓" no card → notificação
- Notificação `done`: badge no card se não for o activo; toast in-app + Notification API do browser (nativa macOS)
- **A confirmar:** som? (toggle nas settings)

### Files panel
- Aparece quando clica ícone Files na nav
- Substitui ou aparece ao lado do grid?
- **A confirmar:** overlay? painel separado?

### Projects
- Cards de projecto (não lista)
- Estado: nr de sessões activas no projecto, última actividade
- **A confirmar:** separado ou integrado no session grid?

---

## Paleta de cores

### Base (escuro quente — não frio)
```
--bg-void:    #080608    (mais escuro, tom quente)
--bg-base:    #0e0b0e    (base app)
--bg-card:    #141118    (cards)
--bg-hover:   #1c1720    (hover)
```

### Accent (laranja/âmbar — inspirado nas refs)
```
--accent:     #e8601c    (laranja principal)
--accent-dim: #f59332    (âmbar secundário)
--accent-soft: rgba(232, 96, 28, 0.12)
```

### Status
```
--working:    #f59332    (âmbar — a trabalhar)
--idle:       #3dba7a    (verde — pronto)
--done:       #3dba7a    (verde brilhante — acabou)
```

### Text
```
--text-bright:  #f0ecf4
--text-normal:  #9088a0
--text-dim:     #50445e
--text-ghost:   #2e2438
```

---

## Decisões confirmadas

| # | Decisão |
|---|---------|
| 1 | Cards em **auto-fit grid** `minmax(220px, 1fr)` |
| 2 | Terminal **hideable** via toggle no NavRail |
| 3 | Files e cards **coexistem** — FilesView toggle à esquerda do grid |
| 4 | Notificações: **in-app toast** + **macOS Notification API** |
| 5 | Accent: **laranja #e8601c** / âmbar #f59332 (não azul) |
| 6 | Status: working=amber pulsante, idle=verde, done=flash verde + notificação |
| 7 | Verificar com **tester-ui-ux** + **tester-accessibility** após implementação |

---

## Questões em aberto — para discussão

1. **Cards grid**: quantas colunas? altura fixa ou variável?
2. **Terminal panel**: sempre visível ou pode fechar?
3. **Files**: overlay ou substitui o grid?
4. **Projects no grid**: misturado com sessions ou separado?
5. **Notificação done**: só in-app ou também nativa do OS?
6. **Som** quando termina: sim ou não?
7. **Drag para reordenar** cards: queres?
8. **Files panel**: continua com o file browser actual ou redesenhamos?

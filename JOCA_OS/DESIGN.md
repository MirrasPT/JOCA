# DESIGN.md — JOCA UI

> Living document. Reference for the complete redesign.
> Do not implement without confirmed decisions.

---

## Moodboard — identified patterns

**References analyzed:** macOS widgets, Raycast Wrapped, Alien AI, MonoCloud, Furion PT, Data AI app

### Common patterns
- **Cards with glows/halos** — each session/item has depth, a subtle border, a colored glow that indicates state
- **Bento grid** — content in a card grid (not a flat list)
- **Warm accent** — orange/amber as the highlight color (not cold blue)
- **Slim, iconic sidebar** — navigation by icons + short label, not a list of dense items
- **Overview + detail view** — cards in the center, detail (terminal) in a side panel
- **Rich visual status** — animated glows indicate state without having to read text
- **Subtle glassmorphism** — cards with backdrop-blur, semitransparent borders
- **Large typography** — important information in large type, not small

---

## Proposed concept — "Mission Control"

Instead of: a list sidebar + one giant terminal

Move to: **overview of sessions in cards + smaller focused terminal**

```
┌────────┬──────────────────────────────┬──────────────────┐
│  Nav   │   Session Cards (grid)       │   Terminal       │
│ slim   │                              │   (active)       │
│        │  ╔══════╗  ╔══════╗         │                  │
│  ◉     │  ║ S1   ║  ║ S2   ║         │  xterm.js        │
│  ○     │  ║ ●work║  ║ ○idle║         │  ~50% width      │
│  ○     │  ╚══════╝  ╚══════╝         │                  │
│  ○     │                              │                  │
│        │  ╔══════╗  ╔══════╗         │                  │
└────────┴──────────────────────────────┴──────────────────┘
```

---

## Components to define

### Nav sidebar (slim ~56px)
- Icons: Sessions · Files · Projects · (Settings?)
- No text — only icons with a tooltip
- JOCA branding at the top (small)
- **To confirm:** exact width, chosen icons

### Session cards grid
- Each card shows:
  - Session name
  - Visual status (animated glow: orange=working, green=done/idle, gray=idle)
  - Preview of the last output lines (truncated, monospace, small)
  - Time elapsed since the last activity
  - Project it belongs to (if applicable)
- Click on a card → activates that terminal in the right panel
- Card size: fixed or variable?
- **To confirm:** columns (2? 3? auto?), card height

### Terminal panel (right)
- ~45-50% of the total width
- Title: name of the active session + cwd
- Normal xterm.js but smaller
- Subtle border-left separating it from the grid
- **To confirm:** can the terminal panel be closed/hidden?

### Chat state (visual indicator)
- `working` — pulsing orange/amber glow + subtle spinner on the card
- `idle` — no glow, static green dot (ready for input)  
- `done` — momentary green flash + "✓" badge on the card → notification
- `done` notification: badge on the card if it is not the active one; in-app toast + the browser's Notification API (native macOS)
- **To confirm:** sound? (toggle in the settings)

### Files panel
- Appears when you click the Files icon in the nav
- Replaces the grid or appears next to it?
- **To confirm:** overlay? separate panel?

### Projects
- Project cards (not a list)
- State: no. of active sessions in the project, last activity
- **To confirm:** separate or integrated into the session grid?

---

## Color palette

### Base (warm dark — not cold)
```
--bg-void:    #080608    (darkest, warm tone)
--bg-base:    #0e0b0e    (app base)
--bg-card:    #141118    (cards)
--bg-hover:   #1c1720    (hover)
```

### Accent (orange/amber — inspired by the refs)
```
--accent:     #e8601c    (main orange)
--accent-dim: #f59332    (secondary amber)
--accent-soft: rgba(232, 96, 28, 0.12)
```

### Status
```
--working:    #f59332    (amber — working)
--idle:       #3dba7a    (green — ready)
--done:       #3dba7a    (bright green — finished)
```

### Text
```
--text-bright:  #f0ecf4
--text-normal:  #9088a0
--text-dim:     #50445e
--text-ghost:   #2e2438
```

---

## Confirmed decisions

| # | Decision |
|---|---------|
| 1 | Cards in an **auto-fit grid** `minmax(220px, 1fr)` |
| 2 | Terminal **hideable** via a toggle in the NavRail |
| 3 | Files and cards **coexist** — FilesView toggle to the left of the grid |
| 4 | Notifications: **in-app toast** + **macOS Notification API** |
| 5 | Accent: **orange #e8601c** / amber #f59332 (not blue) |
| 6 | Status: working=pulsing amber, idle=green, done=green flash + notification |
| 7 | Verify with **tester-ui-ux** + **tester-accessibility** after implementation |

---

## Open questions — for discussion

1. **Cards grid**: how many columns? fixed or variable height?
2. **Terminal panel**: always visible or can it close?
3. **Files**: overlay or does it replace the grid?
4. **Projects in the grid**: mixed with sessions or separate?
5. **done notification**: in-app only or also native to the OS?
6. **Sound** when it finishes: yes or no?
7. **Drag to reorder** cards: do you want it?
8. **Files panel**: keep the current file browser or do we redesign it?

Parte da skill `frontend` — carregado on-demand via `Read(".claude/reference/frontend/game-ui.md")` quando a tarefa é UI de jogo (board/card/tactical, engineStore/uiStore, grelha).

## Game UI

### State architecture

Two separate Zustand stores — **never collapse them:**

| Store | Owns | Rule |
|-------|------|------|
| `useEngineStore` | Board, units, turn, phase, valid moves | Zero React imports. Pure TS. |
| `useUIStore` | Selection, hover, highlights, animation queue | Reads engine state; drives visuals only. |

Use `immer` middleware: mutate draft, never spread deeply nested board arrays.

```ts
// engineStore — pure game logic, no React
export const useEngineStore = create<EngineState>()(immer((set) => ({
  board: initialBoard,
  currentTurn: 0,
  phase: 'deploy' as Phase,
  move: (from, to) => set((s) => { applyMove(s.board, from, to); s.currentTurn++; }),
})));

// uiStore — visual state only, references engine via selectors
export const useUIStore = create<UIState>()(immer((set) => ({
  selectedCell: null,
  highlights: new Map<string, 'valid' | 'selected' | 'danger'>(),
  animationQueue: [] as Animation[],
  select: (cellId) => set((s) => { s.selectedCell = cellId; }),
  setHighlights: (map) => set((s) => { s.highlights = map; }),
})));
```

### Engine / UI separation (hard rule)

`src/engine/` has zero React or Zustand imports — pure TS functions/classes only. UI consumes via selector hooks:

```ts
const board = useEngineStore((s) => s.board);       // selector — only re-renders when board changes
const currentTurn = useEngineStore((s) => s.currentTurn);
```

Never subscribe to the full store (`useEngineStore()`) — always use selectors. If an engine file gains a React import, move the logic back into `src/` hooks.

**Web Worker:** if the engine is compute-heavy, run it in a Worker and communicate via `postMessage`. Never share a Zustand store across threads — the UI store lives on the main thread; the engine Worker sends serialised state diffs.

### Rendering: DOM grid vs Canvas

**Default: DOM grid.** Escalate to Canvas only when the grid exceeds 12×12 **and** animation is per-frame.

| | DOM Grid | Canvas |
|---|---|---|
| Setup | `grid-template-columns: repeat(var(--grid-cols), 1fr)` | `<canvas>` + draw loop |
| Events | Click on each cell | Manual hit-test on `mousedown` |
| Animation | Framer Motion / CSS transitions | RAF draw |
| Accessibility | Native | None |

**Ambiguous case (e.g. 10×10 with per-tile effects):** CSS transitions on `data-highlight` = DOM. Per-frame RAF with arbitrary draw = Canvas. If you're reaching for `requestAnimationFrame` for every tile every frame, switch to Canvas.

### Component performance

- `React.memo` on all card/unit components — numerous and rarely change individually
- Key = stable unit/card ID, never array index
- `useMemo` for derived data (valid moves, reachable cells) keyed to actual reactive slice: `[board, currentTurn]`

### Visual feedback via CSS custom properties

```css
.cell[data-highlight="valid"]    { background: var(--cell-highlight); }
.cell[data-highlight="selected"] { background: var(--cell-selected); }
.cell[data-highlight="danger"]   { background: var(--cell-danger); }
```

Drive from `useUIStore.highlights: Map<cellId, 'valid'|'selected'|'danger'>`. Set in the cell component:

```tsx
<div
  data-highlight={highlights.get(cell.id) ?? undefined}
  onClick={() => select(cell.id)}
/>
```

`undefined` removes the attribute entirely; `null` would set it to the string `"null"`. No inline styles.

### Game UI checklist
- [ ] `src/engine/` — zero React/Zustand imports
- [ ] Two stores: `useEngineStore` (logic) + `useUIStore` (visuals), never merged
- [ ] Store access via selectors, never full-store subscription
- [ ] DOM grid default; Canvas only if grid >12×12 **and** per-frame RAF
- [ ] `React.memo` on cards/units; stable ID keys
- [ ] `data-highlight` + CSS vars for highlights; no inline styles
- [ ] Worker engines communicate via `postMessage`, not shared store

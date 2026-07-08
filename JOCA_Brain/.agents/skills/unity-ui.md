---
name: unity-ui
description: "Build the presentation layer of a Unity card game — choosing UGUI vs UI Toolkit, card prefabs that overlay art + stats, a board view that consumes the deterministic engine's event bus (never reads rules state directly), animation (Awaitable/coroutines/tween), and mobile fit (Canvas Scaler, safe area, touch raycasts). Focused specialist under the unity-gamedev director. MUST be read before writing Unity view/UI code. Triggers: Unity UI, UGUI, UI Toolkit, card prefab, board view, CardView, Canvas, animate card, mobile UI Unity, touch input, safe area, IMGUI to UGUI."
triggers: Unity UI, UGUI, UI Toolkit, card prefab, board view, CardView, Canvas, animate card, mobile UI Unity, touch input, safe area, IMGUI to UGUI, game UI Unity
chain: unity-gamedev, design-review
metadata:
  type: skill
  category: game-dev
---

# Unity UI (card game presentation)

The **View** layer of a Unity card game: turning the deterministic engine's state into something you can see and touch, faithfully to the design (for OmniClash, the board + card look of `cards.html` / cartastcg.rfdev.pt). Specialist under `unity-gamedev` (architecture/build director) — read that first for the engine↔view split.

> **Read-first** before writing any `View/` MonoBehaviour, prefab, or Canvas code. The #1 rule (from `unity-gamedev`): **the View consumes engine events; it never owns or mutates rules state.**

---

## 0. Verify the version + the current view
Confirm `ProjectSettings/ProjectVersion.txt` (OmniClash = Unity **6000.5.1f1**) and `Packages/manifest.json` (TMP? UI Toolkit? Input System?). The current OmniClash view is a **single IMGUI `GameDemo.cs`** (zero scene setup, bootstraps via `RuntimeInitializeOnLoadMethod`, draws art cards from `StreamingAssets/cards/<id>.png` via `Texture2D.LoadImage`). That is the baseline you are likely upgrading.

## 1. Pick the UI system deliberately
| System | Use when | OmniClash note |
|---|---|---|
| **IMGUI** (`OnGUI`) | throwaway/dev tools, zero-setup headless demo | current demo; reliable in batchmode, but no animation/retained scene graph |
| **UGUI** (Canvas + RectTransform) | **the default for a shipped card game** — prefabs, drag, animation, mature touch input | recommended target for the playable build; card = prefab |
| **UI Toolkit** (UXML/USS) | data-heavy menus, editor tooling | great for menus/collection screens; weaker for free-floating animated cards today |
A common split: **UGUI for the board/cards**, **UI Toolkit for menus/deckbuilder**. Don't mix on the same screen.

## 2. The card prefab = art + overlays (mirror the HTML card)
Build one `CardView` prefab, data-driven from a `CardDefinition`/runtime `Unit`:
- Root `RectTransform` (3:4), `Image` background = the art (load by `id`).
- Overlays as children: cost coin (top-left), ATK/DEF badge (top-right), bottom gradient plate `Image` + name `TMP_Text` + type·rarity footer, a rarity-coloured inner frame, a selectable outer outline.
- A `CardView` script caches its child refs in `Awake` and exposes `Bind(Unit u)` / `Bind(CardDefinition d)` to set art/text/stats — **never** `GetComponent`/`Find` in `Update`.
- **One prefab, reused** at hand/field/board scale (scale the RectTransform), exactly like the HTML reuses `cardMarkup` scaled by `--cs`. Don't author separate prefabs per zone.

### Loading card art
- **StreamingAssets + `Texture2D.LoadImage`** (current approach): exact pixels, no importer config, works in editor + Windows standalone. On **Android** StreamingAssets is inside the APK → must read via `UnityWebRequest` (file IO fails). Plan for that before Fase 5.
- **Resources/Sprite** alternative: import PNGs as Sprites, `Resources.Load<Sprite>("cards/"+id)` → assign to `Image.sprite`. Cleaner for UGUI `Image`, but watch non-power-of-2 import settings. Pick one and centralise it in a single `CardArt` loader/cache.

## 3. Consume the engine — event bus, not polling
The Core emits `GameEvent`s (`GameState.Emit/Emitted`, `Log`). The View **subscribes** and reacts; it does not read combat/turn logic. Pattern:
- A thin `BoardPresenter` MonoBehaviour holds the `GameState`/`GameEngine`, subscribes to the event stream, and spawns/updates/animates `CardView`s in response (`UnitPlayed` → instantiate + deal-in animation; `AttackResolved` → lunge + shake; `WallBroken` → break a muralha bar; `GeneralKilled` → win overlay).
- Input handlers call `GameEngine` methods (`PlayCard`, `AttackUnit`, `AttackGeneral`, `ActivateAbility`) and let the resulting events drive the visuals — don't update the view imperatively *and* from events (double-update bugs).
- Keep the presenter free of rules: if you're writing an `if (atk >= def)` in a MonoBehaviour, it belongs in the Core.

## 4. Animation — don't block the rules engine
- Unity 6 **`Awaitable`** or coroutines for sequences (deal, attack lunge, wall break, death fade). The engine resolves instantly and deterministically; the View plays a queue of animations *after* the fact — never gate game logic on an animation finishing.
- Tweening: a lightweight tween (LeanTween/DOTween) or hand-rolled `Awaitable` lerps. Pool `CardView`s and effects (no `Instantiate`/`new` per frame).
- An **animation queue** decouples "many events fired this turn" from "play them one at a time" so the board reads clearly.

## 5. Mobile (Android target)
- **Canvas Scaler** = Scale With Screen Size, reference resolution (e.g. 1280×720 or a phone ratio), match width/height to taste — the board must fit portrait/landscape.
- **Safe area**: inset a root RectTransform by `Screen.safeArea` (notches/rounded corners).
- **Touch**: UGUI `GraphicRaycaster` + `EventSystem` handle taps/drag natively; size tap targets ≥ ~44–48 dp. No spatial-nav/controller needed (touch-first).
- Test at phone aspect ratios early; a board that's perfect at 16:9 desktop often clips at 20:9 phone.

## 6. Fidelity to the design
The visual target is `cards.html` (catalogue card + Tabuleiro). Reuse its language: faction accent, rarity colour on the inner frame, gradient name plate, cost coin, ATK/DEF badge, muralhas as stacked bars over the General, base row Cemitério·Mão·Deck, equipment attached below the unit. Match its proportions; don't redesign the card. → loop a `design-review` after a UI pass.

## Anti-patterns
| Wrong | Right |
|---|---|
| View reads/changes rules state | View subscribes to engine events; calls `GameEngine` methods for input |
| Rules (`atk>=def`) inside a MonoBehaviour | rules in the Core POCO |
| A prefab per zone (hand/field/board) | one `CardView` prefab, scaled |
| `GetComponent`/`Find` in `Update` | cache refs in `Awake` |
| `Instantiate`/`new` per frame | object pools for cards/effects |
| Gate game logic on animation end | engine resolves instantly; View plays a queue after |
| StreamingAssets file-IO on Android | `UnityWebRequest` for StreamingAssets on device |
| Mixing UGUI + UI Toolkit on one screen | UGUI for board, UI Toolkit for menus (separate screens) |

## Próximo passo (chain)
After a UI pass → `design-review` (taste/slop vs the cards.html target) and `tester-ui-ux` (flows, touch targets). Architecture/build questions → `unity-gamedev`. Shipping to device → `unity-build-android`. Art assets → `card-art-pipeline`.

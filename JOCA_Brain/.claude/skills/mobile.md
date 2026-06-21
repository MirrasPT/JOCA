---
name: mobile
description: "Mobile apps, responsive design, PWA, mobile-specific UI patterns. MUST be invoked when the user says: responsivo, responsive, mobile, mobile-first, touch, swipe, bottom sheet, safe area. SHOULD also invoke when: notch, dynamic island, PWA, app móvel, mobile app, tablet."
triggers: responsivo, responsive, mobile, mobile-first, touch, swipe, bottom sheet, safe area, notch, dynamic island, PWA, app móvel, mobile app, tablet, breakpoint, viewport, media query, gesto, gesture, pull to refresh, adaptativo, adaptive, hamburger menu, drawer, off-canvas, mobile navigation, mobile menu, thumb zone, reachability, iOS mockup, Android mockup, device frame, app design, mobile design, mobile layout, small screen
---
# Mobile — Responsive & Mobile Specialist

Takes a design (from `frontend` skill or standalone) and optimises it for mobile. Touch-first, performance-first, native-feel.

Auto-invoked by `frontend` after first draft, or directly by user.

---

## Principles

1. **Mobile-first** -- design for 375px first, expand after. Never "shrink desktop".
2. **Thumb zone** -- primary actions in bottom half of screen, thumb-reachable.
3. **Touch targets** -- min 44x44px (Apple HIG), 48x48dp (Material). 8px gap between targets.
4. **Content-first** -- every pixel counts on mobile. Cut decoration, keep information.
5. **Native feel** -- bottom sheets > modals, swipe > click, momentum scroll, haptic feedback patterns.

---

## Breakpoint System

```css
/* Mobile-first: base e mobile, expandir com min-width */
/* 375px  -- small phone (iPhone SE, base) */
/* 390px  -- standard phone (iPhone 14/15) */
/* 428px  -- large phone (iPhone Pro Max) */
/* 768px  -- tablet portrait */
/* 1024px -- tablet landscape / small desktop */
/* 1280px -- desktop */
/* 1440px -- large desktop */
/* 1920px -- full HD */

/* Tailwind: sm:640 md:768 lg:1024 xl:1280 2xl:1536 */
/* Custom quando necessario */
```

### Rules
- Never disable zoom: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- No horizontal scroll at any breakpoint
- `min-height: 100dvh` (dynamic viewport height, not `100vh`)
- Always test at 375px (iPhone SE) -- smallest common device
- `font-size` min 16px on mobile (prevents iOS auto-zoom on inputs)

---

## Mobile Patterns

### Navigation
```
Desktop: navbar horizontal
Tablet:  navbar com items colapsados
Mobile:  bottom navigation bar (3-5 items) OU hamburger + drawer
```

Bottom nav > hamburger when <= 5 primary actions. Hamburger hides -- bottom nav shows.

### Bottom Sheet (modal alternative)
```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 16px 16px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  transform: translateY(100%);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.bottom-sheet.open { transform: translateY(0); }
```

### Safe Areas (notch, Dynamic Island, home indicator)
```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Bottom fixed elements */
.bottom-bar {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
```

### Touch Interactions
```css
/* Remover 300ms tap delay */
* { touch-action: manipulation; }

/* Feedback visual no tap */
.touchable { -webkit-tap-highlight-color: rgba(0,0,0,0.05); }

/* Prevenir text selection em elementos interactivos */
.interactive { -webkit-user-select: none; user-select: none; }

/* Smooth momentum scroll em containers */
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}
```

### Responsive Images
```html
<picture>
  <source media="(max-width: 768px)" srcset="img-mobile.webp" />
  <source media="(max-width: 1280px)" srcset="img-tablet.webp" />
  <img src="img-desktop.webp" alt="..." width="1200" height="800" loading="lazy" />
</picture>
```
Always set `width` + `height` or `aspect-ratio` to prevent CLS.

### Responsive Typography
```css
/* Fluid type -- escala suave entre breakpoints */
.heading {
  font-size: clamp(1.75rem, 1.2rem + 2vw, 3.5rem);
  line-height: 1.1;
}
.body {
  font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  line-height: 1.6;
}
```

### Forms on Mobile
- Labels above input (never beside)
- Correct `inputmode`: `numeric`, `email`, `tel`, `url`, `search`
- `autocomplete` on all relevant fields
- Keyboard must not hide active input -- scroll into view
- Submit button visible above keyboard
- Inline validation per field, not just at top

---

## Device Frames (prototypes)

### iPhone frame React component
```tsx
function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 393, height: 852,
      borderRadius: 47,
      border: '8px solid #1a1a1a',
      overflow: 'hidden',
      position: 'relative',
      background: '#000',
    }}>
      {/* Dynamic Island */}
      <div style={{
        position: 'absolute', top: 12, left: '50%',
        transform: 'translateX(-50%)',
        width: 124, height: 36,
        borderRadius: 18,
        background: '#000', zIndex: 10,
      }} />
      {/* Status bar */}
      <div style={{
        height: 54, padding: '14px 20px 0',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 14, fontWeight: 600, color: '#fff',
      }}>
        <span>9:41</span>
        <span>&#9679; &#9679; &#9679;</span>
      </div>
      {/* Content */}
      <div style={{ height: 'calc(100% - 88px)', overflow: 'auto' }}>
        {children}
      </div>
      {/* Home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%',
        transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3,
        background: '#fff',
      }} />
    </div>
  );
}
```

---

## PWA Patterns

For PWA or native-feel web apps:

- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="theme-color" content="...">`
- Splash screen via `apple-touch-startup-image`
- `display: standalone` in manifest
- Offline-first: service worker with cache strategy
- Custom pull-to-refresh (disable default with `overscroll-behavior-y: contain`)

---

## Checklist Mobile

- [ ] 375px without horizontal scroll
- [ ] Touch targets >= 44px
- [ ] Safe areas respected (notch, home indicator)
- [ ] Inputs with correct `inputmode`
- [ ] Font size >= 16px body (prevents iOS auto-zoom)
- [ ] Images with `width`/`height` or `aspect-ratio`
- [ ] `prefers-reduced-motion` respected
- [ ] Bottom sheet instead of modal (when applicable)
- [ ] Navigation thumb-reachable (thumb zone)
- [ ] Landscape orientation does not break layout

---

## Integration with frontend

Auto-invoked by `frontend` after first draft. Apply patterns directly without asking. Notify: `[+ mobile]`.

Standalone: can activate directly to improve responsiveness of any existing project.

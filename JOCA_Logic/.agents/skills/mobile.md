---
name: mobile
description: "Use when building mobile applications, responsive design, PWA, or mobile-specific UI patterns."
triggers: responsivo, responsive, mobile, mobile-first, touch, swipe, bottom sheet, safe area, notch, dynamic island, PWA, app móvel, mobile app, tablet, breakpoint, viewport, media query, gesto, gesture, pull to refresh, adaptativo, adaptive, hamburger menu, drawer, off-canvas, mobile navigation, mobile menu, thumb zone, reachability, iOS mockup, Android mockup, device frame, app design, mobile design, mobile layout, small screen
---
# Mobile — Responsive & Mobile Specialist

Pega num design (da skill `frontend` ou standalone) e torna-o excelente em mobile. Touch-first, performance-first, native-feel.

Invocado autonomamente pela skill `frontend` apos primeiro draft, ou directamente pelo utilizador.

---

## Principios

1. **Mobile-first** -- desenhar para 375px primeiro, expandir depois. Nunca "encolher desktop".
2. **Thumb zone** -- accoes primarias na metade inferior do ecra, acessiveis com o polegar.
3. **Touch targets** -- minimo 44x44px (Apple HIG), 48x48dp (Material). Espaco 8px entre targets.
4. **Content-first** -- em mobile, cada pixel conta. Cortar decoracao, manter informacao.
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

### Regras
- Nunca desactivar zoom: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Sem horizontal scroll em nenhum breakpoint
- `min-height: 100dvh` (dynamic viewport height, nao `100vh`)
- Testar sempre em 375px (iPhone SE) -- o mais pequeno comum
- `font-size` minimo 16px em mobile (previne auto-zoom iOS em inputs)

---

## Patterns Mobile

### Navegacao
```
Desktop: navbar horizontal
Tablet:  navbar com items colapsados
Mobile:  bottom navigation bar (3-5 items) OU hamburger + drawer
```

Bottom nav > hamburger quando ha <= 5 accoes primarias. Hamburger esconde -- bottom nav mostra.

### Bottom Sheet (alternativa a modals)
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

### Imagens Responsive
```html
<picture>
  <source media="(max-width: 768px)" srcset="img-mobile.webp" />
  <source media="(max-width: 1280px)" srcset="img-tablet.webp" />
  <img src="img-desktop.webp" alt="..." width="1200" height="800" loading="lazy" />
</picture>
```
Sempre `width` + `height` ou `aspect-ratio` para prevenir CLS.

### Tipografia Responsive
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

### Forms em Mobile
- Labels acima do input (nunca ao lado)
- `inputmode` correcto: `numeric`, `email`, `tel`, `url`, `search`
- `autocomplete` em todos os campos relevantes
- Keyboard nao esconde o input activo -- scroll into view
- Botao submit visivel acima do keyboard
- Validacao inline por campo, nao so no topo

---

## Device Frames (prototipos)

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

Quando o projecto e PWA ou web app que parece nativa:

- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="theme-color" content="...">`
- Splash screen via `apple-touch-startup-image`
- `display: standalone` no manifest
- Offline-first: service worker com cache strategy
- Pull-to-refresh custom (desactivar default com `overscroll-behavior-y: contain`)

---

## Checklist Mobile

- [ ] 375px sem horizontal scroll
- [ ] Touch targets >= 44px
- [ ] Safe areas respeitadas (notch, home indicator)
- [ ] Inputs com `inputmode` correcto
- [ ] Font size >= 16px body (previne iOS auto-zoom)
- [ ] Imagens com `width`/`height` ou `aspect-ratio`
- [ ] `prefers-reduced-motion` respeitado
- [ ] Bottom sheet em vez de modal (quando aplicavel)
- [ ] Navegacao acessivel com polegar (thumb zone)
- [ ] Landscape orientation nao quebra layout

---

## Integracao com frontend

Invocada autonomamente pela skill `frontend` apos primeiro draft. Aplicar patterns directamente sem perguntar ao utilizador. Notificar: `[+ mobile]`.

Standalone: pode ser activada directamente para melhorar responsivo de qualquer projecto existente.

# Starter Components

Componentes pré-fabricados para usar em protótipos. Copiar conteúdo para dentro do `<script type="text/babel">` do HTML — não importar como ficheiro externo (file:// bloqueia cross-origin).

## Componentes disponíveis

| Ficheiro | Quando usar | Fornece |
|----------|-------------|---------|
| `ios_frame.jsx` | iOS App mockup | iPhone bezel + Dynamic Island + status bar + home indicator |
| `android_frame.jsx` | Android App mockup | Device bezel |
| `macos_window.jsx` | Desktop App mockup | Janela chrome + traffic lights |
| `browser_window.jsx` | Web no browser | URL bar + tab bar |
| `design_canvas.jsx` | Comparar ≥2 variações estáticas | Grid com labels |
| `animations.jsx` | Qualquer HTML animado | Stage + Sprite + useTime + Easing + interpolate |

## `ios_frame.jsx` — regras obrigatórias

iPhone 15 Pro: Dynamic Island 124×36px, top:12, centrado. Status bar: tempo/sinal/bateria nos lados, alinhado verticalmente com o island.

**Nunca escrever manualmente:** `.dynamic-island`, `.status-bar`, `.home-indicator`, bezel + shadow. Auto-posicionado na frame.

**Uso:**
```jsx
// 1. Ler ios_frame.jsx e colar o conteúdo no <script type="text/babel">
// 2. Envolver o conteúdo do screen:
<IosFrame time="9:41" battery={85}>
  <YourScreen />  {/* conteúdo a partir de top:54 — não tocar no island */}
</IosFrame>
```

**Excepções:** iPhone 14 não-Pro, Android, device customizado — usar android_frame.jsx ou modificar constantes de ios_frame.jsx.

## `design_canvas.jsx` — variações lado a lado

```jsx
// Colar design_canvas.jsx no script → usar:
<DesignCanvas labels={["Variante A", "Variante B", "Variante C"]}>
  <VariantA />
  <VariantB />
  <VariantC />
</DesignCanvas>
```

## `animations.jsx` — motor de animação

Fornece: `Stage`, `Sprite`, `useTime`, `Easing`, `interpolate`.

**Dois requisitos obrigatórios (gravação de vídeo):**
- Tick no primeiro frame: `window.__ready = true`
- Quando `window.__recording === true` → forçar `loop=false`

## Arquitectura single-file vs multi-file

| Cenário | Arquitectura |
|---------|-------------|
| ≤6 screens, um agente | Single-file inline React (`<script type="text/babel">`) |
| >10 screens OU multi-agente | Multi-HTML + iframe aggregator |

**Regra:** `<script src="components.jsx">` em `file://` é cross-origin — bloqueia. Sempre inline.

**Multi-script scope:** Múltiplos `<script type="text/babel">` não partilham scope. Exportar via `Object.assign(window, { ComponentName })`.

## AppPhone — state machine para flow demos

```jsx
function AppPhone({ initial = 'home' }) {
  const [screen, setScreen] = React.useState(initial);
  const [modal, setModal] = React.useState(null);
  // Renderiza screen component, passa onEnter/onClose/onTabChange/onOpen como props
}
```

Screen components recebem callbacks (não hardcode estado). TabBar + botões + cards com `cursor: pointer` + hover feedback.

**Antes de entregar:** Playwright click test — 3 pontos mínimos: entrar em detalhe / fechar / mudar tab.

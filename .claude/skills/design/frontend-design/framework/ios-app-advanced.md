# iOS / App Prototype — Protocolo Avançado

Complementa a secção #8 do `frontend-design/SKILL.md`. Ler quando a tarefa é um protótipo de app mobile completo.

## Formas de entrega — decidir antes de começar

| Forma | Quando usar | Como implementar |
|-------|-------------|-----------------|
| **Overview** — todos os screens estáticos lado a lado | Design review, comparar layouts | `screens.map(s => <IosFrame><Screen /></IosFrame>)` em grid flex |
| **Flow demo** — único iPhone, clicável | Demo de user flow | `AppPhone` state machine com screen components |

**Regra:** Não assumir flow demo por defeito — é mais trabalho e nem sempre é o que serve. Perguntar.

## Imagens reais — protocolo obrigatório

Em protótipos de app, nunca usar placeholders SVG nem cards cinzentos onde há conteúdo real disponível:

| Tipo de conteúdo | Canal preferencial |
|-----------------|--------------------|
| Arte / museus / história | Wikimedia Commons (público), Met Museum Open Access |
| Geral / lifestyle | Unsplash, Pexels |
| Assets do utilizador | `~/Downloads`, pasta do projecto |

**Wikimedia via Python** (curl falha TLS via proxy):
```python
UA = 'ProjectName/0.1 (https://github.com/you; you@example.com)'
# MediaWiki API: action=query&prop=imageinfo&iiurlwidth=800 → thumburl
```

**Regra de honestidade:** Antes de adicionar imagem, perguntar: "se remover esta imagem, perde-se informação?" Se não → não adicionar (é slop decorativo).

## AppPhone — flow demo detalhado

```jsx
function AppPhone({ initial = 'today' }) {
  const [screen, setScreen] = React.useState(initial);
  const [modal, setModal] = React.useState(null);

  const screens = {
    today: <TodayScreen onOpen={(id) => setModal(id)} onTabChange={setScreen} />,
    graph: <GraphScreen onTabChange={setScreen} />,
    settings: <SettingsScreen onTabChange={setScreen} />,
  };

  return (
    <IosFrame time="9:41" battery={85}>
      {screens[screen]}
      {modal && <ModalOverlay id={modal} onClose={() => setModal(null)} />}
    </IosFrame>
  );
}
```

**Regras de screen components:**
- Recebem `onEnter`, `onClose`, `onTabChange`, `onOpen` como props — não hardcodam estado
- TabBar: `cursor: pointer` + hover state
- Cards/botões: `cursor: pointer` + feedback visual
- Nunca usar `scrollIntoView` — quebra scroll de container

## Testes obrigatórios antes de entregar (flow demo)

```bash
npx playwright test --headed
# OU
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('file:///path/to/prototype.html');
  // 1. Click para entrar em detalhe
  await page.click('[data-testid=item-1]');
  // 2. Click para fechar/voltar
  await page.click('[data-testid=close]');
  // 3. Mudar tab
  await page.click('[data-testid=tab-graph]');
  console.log('errors:', page.listeners('pageerror').length);
  await browser.close();
})();
"
```

`pageerror` deve ser 0 antes de entregar.

## Tweaks — ajuste de parâmetros em tempo real

Para variações experimentais sem reescrever código:

```js
// localStorage-based tweaks
const tweaks = {
  primaryColor: localStorage.getItem('tweak-color') || '#1E3A5F',
  fontSize: localStorage.getItem('tweak-fontSize') || '16px',
};

// UI de ajuste (adicionar ao HTML)
function TweaksPanel() {
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#fff', padding: 12, borderRadius: 8 }}>
      <input type="color" onChange={e => { localStorage.setItem('tweak-color', e.target.value); location.reload(); }} />
    </div>
  );
}
```

## Informação de alta densidade (AI / Dashboard / Tracker)

Para produtos cujo core value é inteligência ou dados (AI tools, analytics, health tracking):

Cada screen deve ter **≥3 elementos de diferenciação visível**: dados não-decorativos, inferências, contexto, estado atual. Não aplicar redução minimalista a estes casos — a densidade IS o produto.

Exemplo errado: screen de AI assistant com apenas um input e um botão.
Exemplo certo: input + histórico de contexto + indicador de estado + sugestão proativa.

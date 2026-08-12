# Modern CSS — o que a plataforma ja faz sem JS

Referencia on-demand. Consumida por `skills/frontend.md`, `skills/tailwind.md` e `skills/anima.md`.
Adaptado de `tponscr-debug/claude-skill-awwwards` (MIT).

Toda a nossa doutrina de movimento assume GSAP. Boa parte do trabalho de scroll e responsividade de
componente ja e nativa — e nativo custa 0 KB de bundle. **Verificar suporte antes de usar em
producao;** estas features sao recentes e o baseline mexe.

---

## Scroll-driven animations (sem JS, sem ScrollTrigger)

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
.scroll-reveal {
  animation: reveal linear both;
  animation-timeline: view();           /* progresso do elemento no viewport */
  animation-range: entry 0% entry 40%;
}
```

Barra de progresso de leitura — `scroll(root)` em vez de `view()`:
```css
.progress-bar {
  position: fixed; top: 0; left: 0; height: 3px;
  background: var(--accent); transform-origin: left;
  animation: grow-width linear;
  animation-timeline: scroll(root);
}
@keyframes grow-width { from { transform: scaleX(0); } to { transform: scaleX(1); } }
```

⚠ **`view()` nao tem `once`.** Um reveal em CSS nativo **repete cada vez que o elemento reentra no
viewport** — inclusive ao voltar para cima. O `once: true` do ScrollTrigger nao tem equivalente nativo.
Se a repeticao incomodar, ou o deslocamento e pequeno ao ponto de nao disputar hierarquia (≤16px), ou
o reveal volta para ScrollTrigger. Decidir de propria vontade, nao descobrir em producao.

**Quando ainda vale GSAP/ScrollTrigger:** `once`, pin, snap, `containerAnimation`, coreografia entre
varios triggers, ou quando e preciso ler/escrever estado em JS. Reveal repetivel e barra de progresso → CSS.

---

## Container queries — responsividade do componente, nao da pagina

```css
.card-wrapper { container-type: inline-size; container-name: card; }

@container card (min-width: 400px) { .card { grid-template-columns: 120px 1fr; } }
@container card (min-width: 600px) { .card { grid-template-columns: 200px 1fr auto; } }
```

Unidades de container (`cqi` = inline do container):
```css
.card-title { font-size: clamp(1rem, 3cqi, 1.5rem); }
```

Um card que se adapta ao **espaco que tem** funciona na sidebar e no grid principal sem variantes.
Media queries continuam certas para layout de pagina.

---

## `:has()` — estilar o pai a partir do filho

```css
.card:has(img)                          { grid-template-rows: 200px 1fr; }
.form-group:has(:invalid)               { --border-color: var(--status-negative); }
body:has(.hero) .nav                    { background: transparent; position: absolute; }
body:has(.sidebar[data-open="true"]) .main { margin-left: 280px; }
```

Mata a maioria dos estados que hoje se resolvem com uma classe posta por JS.

---

## Container + full-bleed (a mecanica)

```css
.container {
  --max-width: 1200px;
  --padding: clamp(20px, 5vw, 80px);
  width: min(var(--max-width), 100% - var(--padding) * 2);
  margin-inline: auto;
}
.full-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
}
```

O `calc(50% - 50vw)` e a peca: puxa o elemento para fora do container sem o tirar do fluxo.

---

## Performance

```css
/* seccoes abaixo da dobra: nao pagar layout/paint ate serem precisas */
.below-fold-section { content-visibility: auto; contain-intrinsic-size: 0 600px; }

/* isolar paint de um card */
.card { contain: layout style paint; }

/* backdrop-filter sem compositing da pagina inteira */
.glass {
  isolation: isolate;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
```

⚠ `contain-intrinsic-size` precisa de uma estimativa de altura credivel — errada, o scrollbar salta.

---

## `color-mix()` — derivar estados em vez de os declarar

```css
.btn        { background: var(--accent); }
.btn:hover  { background: color-mix(in oklch, var(--accent), black 15%); }
```

Um token, todos os estados derivados. Menos tokens a manter sincronizados.

---

## Propriedades logicas

```css
.card {
  margin-inline: auto;
  padding-block: var(--space-md);
  padding-inline: var(--space-lg);
  border-inline-start: 3px solid var(--accent);
}
```

`inline`/`block` em vez de `left`/`right`/`top`/`bottom` — funciona em RTL sem reescrever nada.

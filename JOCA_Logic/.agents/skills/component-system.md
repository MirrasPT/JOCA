---
name: component-system
description: Component inventory and per-component specification documents. Generates system/component-inventory.md (master list) and system/components/<name>.md per component with anatomy, variants, sizes, 6 states (default/hover/focus/active/disabled/loading), exact token references, touch targets, ARIA spec, responsive behaviour, do/don't. The closed contract that Frontend consumes — prevents token fabrication across sessions.
triggers: component system, sistema de componentes, component inventory, inventario de componentes, component spec, component states, estados de componentes, button spec, input spec, card spec, UI components, UI kit, component library, component documentation, anatomia do componente, component anatomy
---

# Component System

Inventario e especificacao de componentes. Contrato fechado que o Frontend consome.

**Activar** apos `design-tokens` gerar tokens/, antes de qualquer implementacao UI.

---

## Output

```
system/
├── component-inventory.md          ← master list
└── components/
    ├── button.md
    ├── input.md
    ├── textarea.md
    ├── select.md
    ├── checkbox.md
    ├── radio.md
    ├── toggle.md
    ├── badge.md
    ├── avatar.md
    ├── card.md
    ├── modal.md
    ├── toast.md
    ├── dropdown.md
    ├── tabs.md
    ├── table.md
    └── ...                         ← adicionar conforme necessario
```

---

## component-inventory.md

Master list. Lido pelo frontend no inicio de CADA sessao.

```markdown
# Component Inventory

**Tokens:** tokens/tokens.css
**Ultima actualizacao:** [data]

## Regra de sessao

> Antes de escrever qualquer UI, ler este ficheiro + tokens/tokens.css.
> Usar APENAS componentes e tokens listados aqui.
> Nunca inventar variantes, estados ou tokens que nao existam neste inventario.

## Componentes

| Componente | Variants | Sizes | Ficheiro |
|-----------|----------|-------|----------|
| Button | primary, secondary, ghost, destructive, link | sm, md, lg | [button.md](components/button.md) |
| Input | default, error | md | [input.md](components/input.md) |
| Textarea | default, error | md | [textarea.md](components/textarea.md) |
| Select | default, error | md | [select.md](components/select.md) |
| Checkbox | default | md | [checkbox.md](components/checkbox.md) |
| Radio | default | md | [radio.md](components/radio.md) |
| Toggle | default | md | [toggle.md](components/toggle.md) |
| Badge | default, success, warning, error | sm, md | [badge.md](components/badge.md) |
| Avatar | default | sm, md, lg | [avatar.md](components/avatar.md) |
| Card | default, interactive | md | [card.md](components/card.md) |
| Modal | default | md, lg | [modal.md](components/modal.md) |
| Toast | success, error, warning, info | md | [toast.md](components/toast.md) |
| Dropdown | default | md | [dropdown.md](components/dropdown.md) |
| Tabs | default | md | [tabs.md](components/tabs.md) |
| Table | default | md | [table.md](components/table.md) |

## Global State Contract

States aplicados uniformemente a TODOS os componentes interactivos:

| Estado | Visual | Token delta | CSS |
|--------|--------|------------|-----|
| **default** | Estado base | — | — |
| **hover** | Lightness +5% no bg | `*-hover` tokens | `:hover` |
| **focus-visible** | Ring 2px, offset 2px, cor `--color-focus-ring` | `--focus-ring-*` | `:focus-visible` |
| **active** | Lightness -5% no bg, scale 0.98 | — | `:active` |
| **disabled** | Opacity 0.4, cursor not-allowed | `--*-disabled-opacity` | `[aria-disabled="true"]` |
| **loading** | Spinner overlay, texto hidden, pointer-events none | — | `[data-loading]` |

### Focus visible (non-negotiable)

```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

NUNCA usar `outline: none` sem alternativa visivel. NUNCA usar `:focus` sem `:focus-visible`.

### Touch targets

Minimo 44x44px para qualquer elemento interactivo (WCAG 2.5.8). Se o componente visual e menor (ex: checkbox 20px), expandir hit area com padding ou pseudo-element.
```

---

## Template por componente

Cada `system/components/<name>.md` segue esta estrutura:

```markdown
# [Component Name]

## Anatomy

[Descricao das partes do componente — ex: container, label, icon-left, icon-right, spinner]

## Variants

| Variant | Uso | Tokens |
|---------|-----|--------|
| primary | CTA principal, accao destrutiva confirmada | bg: `--button-bg-primary`, fg: `--button-fg-primary` |
| secondary | Accao secundaria, cancel | bg: `--button-bg-secondary`, fg: `--button-fg-secondary` |
| ghost | Accao terciaria, inline | bg: transparent, fg: `--color-text` |

## Sizes

| Size | Height | Padding-x | Font size | Icon size |
|------|--------|-----------|-----------|-----------|
| sm | 32px | 12px | 14px | 16px |
| md | 40px | 16px | 16px | 20px |
| lg | 48px | 24px | 18px | 24px |

## States

| Estado | bg | fg | border | transform | extras |
|--------|----|----|--------|-----------|--------|
| default | `--button-bg-primary` | `--button-fg-primary` | none | — | — |
| hover | `--button-bg-primary-hover` | `--button-fg-primary` | none | — | cursor pointer |
| focus-visible | `--button-bg-primary` | `--button-fg-primary` | none | — | ring 2px `--color-focus-ring` offset 2px |
| active | `--button-bg-primary` adjusted -5% L | `--button-fg-primary` | none | scale(0.98) | — |
| disabled | `--button-bg-primary` | `--button-fg-primary` | none | — | opacity 0.4, aria-disabled="true" |
| loading | `--button-bg-primary` | hidden | none | — | spinner centered, pointer-events none |

## Responsive

| Breakpoint | Comportamento |
|-----------|--------------|
| < sm | Full width (block), height lg para touch |
| >= sm | Inline, width auto |

## Accessibility

- **Role:** `button` (ou `<button>` nativo)
- **Disabled:** usar `aria-disabled="true"` (nao `disabled` attr — permite focus para screen readers)
- **Loading:** `aria-busy="true"`, texto do spinner como `aria-label`
- **Icon-only:** obrigatorio `aria-label` descritivo
- **Keyboard:** Enter/Space activa

## Do / Don't

| Do | Don't |
|----|-------|
| Usar primary para 1 CTA por vista | 2+ primary buttons na mesma vista |
| Label com verbo de accao ("Guardar", "Enviar") | Labels vagas ("Ok", "Submeter") |
| Ghost para accoes terciarias | Ghost para accoes destrutivas |
| Disabled com tooltip explicativo | Disabled sem explicacao (frustrating) |
```

---

## Geracao

### Input

1. **tokens/tokens.css** — obrigatorio (token refs para states)
2. **DESIGN.md** — tipografia, espacamento
3. **PRD.md** — se existir, extrair features para identificar componentes necessarios
4. **Codebase existente** — se ja tem componentes, documentar os que existem

### Processo

1. Ler tokens/tokens.css
2. Identificar componentes necessarios:
   - Se PRD existe: mapear features a componentes
   - Se nao: gerar set base (button, input, card, badge, avatar, modal, toast)
3. Gerar component-inventory.md
4. Gerar spec por componente (prioridade: os mais usados primeiro)
5. Apresentar ao utilizador para review
6. Iterar ate aprovacao

### Perguntas minimas

- "Componentes alem do set base? (tabela, dropdown, tabs, sidebar, etc.)"
- "Framework CSS? (Tailwind, vanilla CSS, CSS Modules) — afecta formato dos tokens no spec"

---

## Protocolo sessao-start (CRITICO)

Quando a skill `frontend` e activada, DEVE:

1. `Read("system/component-inventory.md")`
2. `Read("tokens/tokens.css")`
3. Para cada componente a implementar: `Read("system/components/<name>.md")`

Isto fecha o token set — o frontend nao pode inventar variantes, estados ou tokens que nao existam no inventario.

---

## Actualizacao

Actualizar quando:
- Componente novo necessario (adicionar spec + entry no inventory)
- Token mudou (verificar que component refs ainda resolvem)
- Feedback do `design-system-audit` (agent) — states em falta, ARIA incorrectos
- Feature nova no PRD requer variante nova

---

## Workflow

Pipeline desta skill na sequencia JOCA:

→ **antes**: `design-tokens` (tokens como input)
→ **apos**: `design-system-audit` (agente — valida sistema completo) → `frontend` (consome como contrato)

Notificar ao concluir: `→ proximo: design-system-audit`

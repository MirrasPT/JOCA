---
name: design-system
description: "Building or auditing design systems, managing design tokens, component libraries, or style guides. MUST be invoked when the user says: design system, sistema de design, tokens, design tokens, component system, sistema de componentes, visual system, sistema visual. SHOULD also invoke when: UI system, criar design system, setup design, design setup, design foundation, fundacao visual."
triggers: design system, sistema de design, tokens, design tokens, component system, sistema de componentes, visual system, sistema visual, UI system, criar design system, setup design, design setup, design foundation, fundacao visual
---
# Design System -- Router

Contrato visual que o Frontend consome.

## Skills

| Skill | Output | Quando |
|-------|--------|--------|
| `brand-guidelines` | DESIGN.md + BRAND.md -- identidade visual | Inicio de projecto, marca nova, audit |
| `design-tokens` | tokens/*.json + tokens.css -- 3 tiers (global/semantic/component) | Apos DESIGN.md, antes de UI |
| `component-system` | system/component-inventory.md + system/components/*.md | Apos tokens, antes de frontend |

## Agente

| Agente | Funcao | Quando |
|--------|--------|--------|
| `design-system-audit` | Valida tokens, components, WCAG, drift | Apos design system completo |

## Pipeline

```
brand-guidelines → DESIGN.md + BRAND.md (identidade)
       ↓
design-tokens → tokens/global.json + semantic.json + component.json + tokens.css
       ↓
component-system → system/component-inventory.md + system/components/*.md
       ↓
design-system-audit (agente) → audit/design-system-violations.md
       ↓
frontend (camada seguinte) → consome tokens.css + inventory como contrato fechado
```

## Routing

| Input | Activar |
|-------|---------|
| "marca", "brand", "identidade visual", "DESIGN.md" | `brand-guidelines` |
| "tokens", "design tokens", "CSS variables", "global/semantic/component" | `design-tokens` |
| "componentes", "components", "button spec", "states", "inventario" | `component-system` |
| "design system completo", "criar design system do zero" | Pipeline completo (sequencial) |
| "validar design system", "audit", "drift", "verificar tokens" | `design-system-audit` (agente) |

### Projecto novo (pipeline completo)

1. `brand-guidelines` -- gera DESIGN.md
2. `design-tokens` -- transforma DESIGN.md em tokens 3 tiers
3. `component-system` -- documenta componentes com token refs
4. `design-system-audit` -- valida tudo

### Projecto existente (com DESIGN.md)

Detectar o que falta:
- DESIGN.md existe, tokens/ nao -- `design-tokens`
- tokens/ existe, system/ nao -- `component-system`
- Tudo existe -- `design-system-audit` para verificar drift

## Estrutura gerada

```
projecto/
├── DESIGN.md                          ← brand-guidelines
├── BRAND.md                           ← brand-guidelines
├── tokens/
│   ├── global.json                    ← design-tokens (primitivas)
│   ├── semantic.json                  ← design-tokens (aliases)
│   ├── component.json                 ← design-tokens (per-component)
│   └── tokens.css                     ← design-tokens (compilado)
├── system/
│   ├── component-inventory.md         ← component-system (master list)
│   └── components/
│       ├── button.md                  ← component-system (spec)
│       ├── input.md
│       ├── card.md
│       └── ...
└── audit/
    └── design-system-violations.md    ← design-system-audit (agente)
```

## Como activar sub-skills

```
Read(".claude/skills/brand-guidelines.md")
Read(".claude/skills/design-tokens.md")
Read(".claude/skills/component-system.md")
Agent(subagent_type="design-system-audit")
```

## Quality gate
Apos design system completo: "Queres correr `design-system-audit`?" (valida tokens, states, WCAG, drift)

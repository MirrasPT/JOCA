---
name: design-system
description: "Use when building or auditing design systems, managing design tokens, component libraries, or style guides."
triggers: design system, sistema de design, tokens, design tokens, component system, sistema de componentes, visual system, sistema visual, UI system, criar design system, setup design, design setup, design foundation, fundacao visual
---
# Design System — Router

Segunda camada da stack. Estabelece o contrato visual que o Frontend consome.

---

## Skills disponiveis

| Skill | O que produz | Quando usar |
|-------|-------------|-------------|
| `brand-guidelines` | DESIGN.md + BRAND.md — identidade visual | Inicio de projecto, marca nova, audit de marca |
| `design-tokens` | tokens/*.json + tokens.css — 3 tiers (global/semantic/component) | Apos DESIGN.md, antes de qualquer UI |
| `component-system` | system/component-inventory.md + system/components/*.md | Apos tokens, antes de frontend |

## Agente

| Agente | O que faz | Quando correr |
|--------|-----------|---------------|
| `design-system-audit` | Valida tokens, components, WCAG, drift | Apos design system completo |

---

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

---

## Routing

| O utilizador diz | Activar |
|-------------------|---------|
| "marca", "brand", "identidade visual", "DESIGN.md" | `brand-guidelines` |
| "tokens", "design tokens", "CSS variables", "global/semantic/component" | `design-tokens` |
| "componentes", "components", "button spec", "states", "inventario" | `component-system` |
| "design system completo", "criar design system do zero" | Pipeline completo (sequencial) |
| "validar design system", "audit", "drift", "verificar tokens" | `design-system-audit` (agente) |

### Projecto novo (pipeline completo)

1. Activar `brand-guidelines` → gera DESIGN.md
2. Activar `design-tokens` → transforma DESIGN.md em tokens 3 tiers
3. Activar `component-system` → documenta componentes com token refs
4. Correr `design-system-audit` → valida tudo

### Projecto existente (com DESIGN.md)

Detectar o que falta:
- DESIGN.md existe, tokens/ nao → `design-tokens`
- tokens/ existe, system/ nao → `component-system`
- Tudo existe → `design-system-audit` para verificar drift

---

## Estrutura de ficheiros gerada

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

---

## Como activar sub-skills

```
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
Agent(subagent_type="design-system-audit")
```

---

## Quality gate
Apos design system completo: "Queres correr `design-system-audit`?" (valida tokens, states, WCAG, drift)

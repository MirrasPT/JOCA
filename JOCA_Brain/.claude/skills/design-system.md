---
name: design-system
description: "Building or auditing design systems, managing design tokens, component libraries, or style guides. MUST be invoked when the user says: design system, tokens, design tokens, component system, visual system. SHOULD also invoke when: UI system, create design system, setup design, design setup, design foundation, visual foundation."
triggers: design system, tokens, design tokens, component system, visual system, UI system, create design system, setup design, design setup, design foundation, visual foundation
---
# Design System -- Router

The visual contract the Frontend consumes.

## Skills

| Skill | Output | When |
|-------|--------|--------|
| `brand-guidelines` | DESIGN.md + BRAND.md -- visual identity | Project start, new brand, audit |
| `design-tokens` | tokens/*.json + tokens.css -- 3 tiers (global/semantic/component) | After DESIGN.md, before UI |
| `component-system` | system/component-inventory.md + system/components/*.md | After tokens, before frontend |

## Agent

| Agent | Function | When |
|--------|--------|--------|
| `design-system-audit` | Validates tokens, components, WCAG, drift | After the design system is complete |

## Pipeline

```
brand-guidelines → DESIGN.md + BRAND.md (identity)
       ↓
design-tokens → tokens/global.json + semantic.json + component.json + tokens.css
       ↓
component-system → system/component-inventory.md + system/components/*.md
       ↓
design-system-audit (agent) → audit/design-system-violations.md
       ↓
frontend (next layer) → consumes tokens.css + inventory as a closed contract
```

## Routing

| Input | Activate |
|-------|---------|
| "brand", "visual identity", "DESIGN.md" | `brand-guidelines` |
| "tokens", "design tokens", "CSS variables", "global/semantic/component" | `design-tokens` |
| "components", "button spec", "states", "inventory" | `component-system` |
| "complete design system", "create a design system from scratch" | Full pipeline (sequential) |
| "validate design system", "audit", "drift", "check tokens" | `design-system-audit` (agent) |

### New project (full pipeline)

1. `brand-guidelines` -- generates DESIGN.md
2. `design-tokens` -- turns DESIGN.md into 3-tier tokens
3. `component-system` -- documents components with token refs
4. `design-system-audit` -- validates everything

### Existing project (with DESIGN.md)

Detect what is missing:
- DESIGN.md exists, tokens/ does not -- `design-tokens`
- tokens/ exists, system/ does not -- `component-system`
- Everything exists -- `design-system-audit` to check for drift

## Generated structure

```
project/
├── DESIGN.md                          ← brand-guidelines
├── BRAND.md                           ← brand-guidelines
├── tokens/
│   ├── global.json                    ← design-tokens (primitives)
│   ├── semantic.json                  ← design-tokens (aliases)
│   ├── component.json                 ← design-tokens (per-component)
│   └── tokens.css                     ← design-tokens (compiled)
├── system/
│   ├── component-inventory.md         ← component-system (master list)
│   └── components/
│       ├── button.md                  ← component-system (spec)
│       ├── input.md
│       ├── card.md
│       └── ...
└── audit/
    └── design-system-violations.md    ← design-system-audit (agent)
```

## How to activate the sub-skills

```
Read(".claude/skills/brand-guidelines.md")
Read(".claude/skills/design-tokens.md")
Read(".claude/skills/component-system.md")
Agent(subagent_type="design-system-audit")
```

## Quality gate
After the design system is complete: "Do you want to run `design-system-audit`?" (validates tokens, states, WCAG, drift)

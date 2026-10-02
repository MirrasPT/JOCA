---
name: design-system
description: "Building or auditing design systems: design tokens (DTCG, CSS variables, 3 tiers), component inventory and per-component specs, multi-brand token architecture. MUST be invoked when the user says: design system, sistema de design, design tokens, CSS variables, DTCG, component spec, component inventory, estados de componentes, UI kit, multibrand. SHOULD also invoke when: Style Dictionary, anatomia do componente, sistema visual, setup design."
triggers: design tokens, CSS variables, DTCG, Style Dictionary, escala de espaçamentos, component spec, component inventory, inventario de componentes, biblioteca de componentes, component states, estados de componentes, estados do botão, variantes e tamanhos, anatomia do componente, UI kit, sistema de componentes, design system, sistema de design, UI system, design system multi-marca, multibrand, família de marcas, tokens, sistema visual, setup design
chain: frontend
---
# Design System

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

Contrato visual que o Frontend consome: identidade → tokens → componentes → auditoria.
Dona do grupo (F4.2): absorveu `design-tokens` e `component-system`, cujo detalhe vive em referências.

## Ler só a referência certa

| Pedido | Ler |
|--------|-----|
| Sistema completo, "criar design system do zero" | este núcleo (§Pipeline) e, por passo, a referência do passo |
| Tokens: design tokens, CSS variables / custom properties, DTCG, Style Dictionary, espaçamentos, dark mode, tipografia `clamp()` | `Read(".claude/reference/design-system-tokens.md")` |
| Componentes: inventário, spec, anatomia, variantes, tamanhos, estados, UI kit | `Read(".claude/reference/design-system-componentes.md")` |
| N marcas irmãs, cor por tenant, marca-mãe | `Read(".claude/reference/tokens-multibrand.md")` |
| Marca, identidade, `DESIGN.md` | skill `brand-guidelines` |
| Validar, drift, auditar | agente `design-system-audit` |

## Regras de arquitectura (multi-produto)

Aplicar ANTES de escolher a arquitectura, nao depois de ela rebentar em producao.
Arquitectura de tokens para N marcas irmas (escada partilhada, matiz por marca, papeis fixos, familias >9) → `Read(".claude/reference/tokens-multibrand.md")`.

### O eixo de variacao tem um TECTO -- calcula-lo antes de o adoptar

Ao desenhar um eixo de variacao (cor por app, por tema, por tenant), **calcular e escrever o tecto na
propria doutrina**: quantos valores distintos cabem antes de dois se confundirem, e **o que acontece
ao valor N+1**.

Caso real: a arquitectura dava **uma matiz por app** e funcionava lindamente para 8; o produto
revelou-se com **~25 modulos** e a arquitectura **cabia em 9** -- medido: a 25 graus de distancia,
dois degraus da mesma escada de luminosidade sao indistinguiveis, logo 360/40 = 9. O sinal de alarme
existia e foi ignorado: a doutrina escrita ja dizia *"o glifo e o sinal primario, a cor e o segundo"*
enquanto os tokens assumiam cor unica por app. **Documento e arquitectura discordavam, e ninguem
tinha corrido o numero.**

**O que escala e a FORMA, nao a COR.** A cor esgota-se em ~9; a forma nao tem tecto pratico. E o que a
Google Workspace faz com 15 apps e quatro cores: **a cor identifica a familia, a forma identifica o
item**. Se documento e tokens discordarem sobre qual e o sinal primario, o numero decide -- corre-o.

### Um identificador, uma palavra

Um identificador com **tres nomes** e uma armadilha que nao da erro. Um modulo tinha `id: "pos"`,
`nome: "Balcao"` e `subdominio: "balcao"`; o `data-app="balcao"` nao resolvia e o modulo saia com a
cor da marca-mae -- **sem aviso, sem erro, sem nada**. So apareceu numa prova visual, porque uma
linha estava ambar no meio de linhas rosa.

**O id que se escreve no atributo, o subdominio onde vive e a chave no ficheiro gerado sao o mesmo
texto.** Quando nao podem ser (legado), o gerador **valida e falha**: um id que nao resolve deve
**rebentar o build**, nunca pintar-se de outra cor.

Duas armadilhas de CSS que fazem o mecanismo parecer funcionar sem funcionar:
- **`var()` resolve onde e DECLARADO**, nao onde e usado.
- **Entre selectores de igual especificidade ganha o ultimo** -- um bloco `:root` de omissao escrito
  **depois** dos `[data-app]` ganha e mata a troca de tema toda.

Teste obrigatorio: **por o atributo no `<html>`**, que e o uso documentado. Provar num `<div>`
aninhado passa e nao prova nada.

## Passos e onde vivem

| Passo | Output | Onde | Quando |
|-------|--------|------|--------|
| Identidade | DESIGN.md + BRAND.md | skill `brand-guidelines` | Inicio de projecto, marca nova |
| Tokens | tokens/*.json + tokens.css -- 3 tiers (global/semantic/component) | `reference/design-system-tokens.md` | Apos DESIGN.md, antes de UI |
| Componentes | system/component-inventory.md + system/components/*.md | `reference/design-system-componentes.md` | Apos tokens, antes de frontend |
| Auditoria | audit/design-system-violations.md | agente `design-system-audit` | Apos design system completo |

Regras que valem sempre (detalhe e exemplos nas referências):
- **Tokens:** 3 tiers; zero valores crus fora do `global.json`; OKLCH; neutros tingidos; grelha de 4px;
  contraste ≥4.5:1 (inclui assets fornecidos); `prefers-reduced-motion` **reduz** as durations, nunca as zera;
  ligado a `@theme inline` do Tailwind v4, os nomes não podem coincidir (prefixar `--ds-*`).
- **Componentes:** 6 estados (default, hover, focus-visible, active, disabled, loading); `:focus-visible`
  sempre visível; touch target ≥44px; mapa de assets nunca é `Record` fechado (fallback reconhecível).
- **Ficheiro gerado = uma responsabilidade**; mudar a forma → `grep` aos consumidores antes de gerar.

## Pipeline

```
brand-guidelines → DESIGN.md + BRAND.md (identidade)
       ↓
tokens (referência) → tokens/global.json + semantic.json + component.json + tokens.css
       ↓
componentes (referência) → system/component-inventory.md + system/components/*.md
       ↓
design-system-audit (agente) → audit/design-system-violations.md
       ↓
frontend (camada seguinte) → consome tokens.css + inventory como contrato fechado
```

## Routing

| Input | Activar |
|-------|---------|
| "marca", "brand", "identidade visual", "DESIGN.md" | `brand-guidelines` |
| "tokens", "design tokens", "CSS variables", "global/semantic/component" | `reference/design-system-tokens.md` |
| "componentes", "components", "button spec", "states", "inventario" | `reference/design-system-componentes.md` |
| "design system completo", "criar design system do zero" | Pipeline completo (sequencial) |
| "validar design system", "audit", "drift", "verificar tokens" | `design-system-audit` (agente) |

### Cliente com historico -- o passo 0 antes de qualquer pipeline

**Antes de escrever `DESIGN.md` para um cliente que ja teve entregas, `ls` as entregas anteriores e
LER o codigo-fonte dos finais aprovados** -- nao as capturas, nao a descricao na memoria do projecto:
o HTML/CSS, o `.psd`, o `.svg`, o ficheiro que produziu a peca que o cliente aprovou. E onde estao os
valores reais (matiz exacta, escala tipografica, espacamentos) e as decisoes que ja passaram no
cliente.

Um sistema derivado da memoria escrita em vez do artefacto sai plausivel e diferente do que o cliente
ja aprovou -- e a diferenca so aparece quando ele a ve. Sem token medido do artefacto ou documentado
no `DESIGN.md`, escreve-se `TODO: token em falta`, nunca um valor plausivel (`soul.md`, Hard Limits).

```bash
ls -lt <pasta-do-cliente>/*/            # entregas por data, a mais recente primeiro
grep -rhoE '#[0-9A-Fa-f]{6}' <final-aprovado>.html | sort | uniq -c | sort -rn | head
grep -rhoE "font-family:[^;']+" <final-aprovado>.html | sort -u
```

### Projecto novo (pipeline completo)

1. `brand-guidelines` -- gera DESIGN.md
2. tokens (`reference/design-system-tokens.md`) -- transforma DESIGN.md em tokens 3 tiers
3. componentes (`reference/design-system-componentes.md`) -- documenta componentes com token refs
4. `design-system-audit` -- valida tudo

### Projecto existente (com DESIGN.md)

Detectar o que falta:
- DESIGN.md existe, tokens/ nao -- `reference/design-system-tokens.md`
- tokens/ existe, system/ nao -- `reference/design-system-componentes.md`
- Tudo existe -- `design-system-audit` para verificar drift

## Estrutura gerada

```
projecto/
├── DESIGN.md                          ← brand-guidelines
├── BRAND.md                           ← brand-guidelines
├── tokens/
│   ├── global.json                    ← tokens (primitivas)
│   ├── semantic.json                  ← tokens (aliases)
│   ├── component.json                 ← tokens (per-component)
│   └── tokens.css                     ← tokens (compilado)
├── system/
│   ├── component-inventory.md         ← componentes (master list)
│   └── components/
│       ├── button.md                  ← componentes (spec)
│       ├── input.md
│       ├── card.md
│       └── ...
└── audit/
    └── design-system-violations.md    ← design-system-audit (agente)
```

## Como activar cada passo

```
Read(".claude/skills/brand-guidelines.md")
Read(".claude/reference/design-system-tokens.md")
Read(".claude/reference/design-system-componentes.md")
Agent(subagent_type="design-system-audit")
```

## Quality gate
Apos design system completo: "Queres correr `design-system-audit`?" (valida tokens, states, WCAG, drift)

## Próximo passo (chain)
Sistema fechado → `frontend`, que lê `system/component-inventory.md` + `tokens/tokens.css` antes de escrever UI.

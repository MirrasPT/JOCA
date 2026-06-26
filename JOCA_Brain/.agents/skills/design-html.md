---
name: design-html
description: "Transformar um mockup/design aprovado em HTML/CSS de produção limpo e sem dependências — texto reflui, alturas computadas, layout dinâmico, zero deps. Adaptado do design-html do gstack. MUST be invoked when the user says: codificar o design, transformar em HTML, construir esta página, implementar este design, fazer o mockup real, finalizar o design. SHOULD also invoke when: existe um design/mockup aprovado pronto a virar código estático."
triggers: codificar design, transformar em HTML, construir página, implementar design, fazer mockup real, finalizar design, mockup para HTML, design para código, build the design, code the mockup, design para HTML
chain: frontend, design-review
---
# /design-html — Mockup aprovado → HTML/CSS de produção

Pega num design/mockup aprovado e produz **HTML/CSS de produção, limpo e sem dependências**: texto reflui de verdade, alturas computadas, layout responsivo. Adaptado do `design-html` do gstack (que é Pretext-native; aqui é HTML/CSS standard).

Diferença para `frontend`: o `frontend` constrói a app React/Next; o `design-html` materializa um **mockup estático fiel** (landing, página de marketing, e-mail-safe, protótipo navegável) — depois encadeia para `frontend` se for preciso tornar interactivo/React.

## Quando usar
- Existe mockup aprovado (de `design-shotgun`, de imagem, ou descrição) → torná-lo HTML real.
- "constrói esta página", "transforma em HTML", "faz o mockup real", landing estática.

## Princípios
- **Zero deps por defeito** — HTML + CSS nativo (custom properties, grid/flex, container queries). Sem framework salvo se o projecto já o tiver.
- **Fidelidade ao mockup** — replicar fielmente (espaçamento, hierarquia, cor, tipografia). NÃO divergir após a 1ª secção (regra [[renato-design-prototype-fidelity]]: a AI tende a inventar a partir da secção 2 — não fazer).
- **Tokens do design system** — usar `DESIGN.md`/tokens existentes; sem hardcode de cor/spacing inventado (sem token adequado → `TODO: token em falta`, não um valor "que parece bem").
- **Texto reflui / alturas computadas** — nada de alturas fixas que cortam conteúdo; o layout adapta-se ao conteúdo real.
- **Smart routing de padrões** — escolher o padrão certo por tipo de página (hero+rows de marketing; card-grid de catálogo; form de checkout).
- **Acessível à nascença** — semântica (`<main>/<nav>/<header>`), heading order, alt, foco visível, contraste por tokens.

## Workflow
1. **Ingerir o mockup** — ler o design aprovado + o sistema (`DESIGN.md`/tokens/`brand-guidelines`). Skill-first: `Read(".claude/skills/tailwind.md")` se o projecto usa Tailwind; senão CSS nativo.
2. **Estrutura** — semântica primeiro (landmarks, headings), depois layout (grid/flex), depois detalhe visual.
3. **Implementar secção a secção** — fiel ao mockup; conteúdo real onde existe, placeholder marcado onde não (`<!-- TODO: copy real -->`).
4. **Verificar** — render real (Playwright MCP, ou `Start-Process <ficheiro.html>` + pedir confirmação visual ao user — `rules/workflows-and-tooling.md`). Confirmar reflow, responsivo, sem overflow.

## Próximo passo (chain)
- Precisa de interactividade/estado/React → `frontend` (integra). Validar gosto/slop → `design-review` → (se WCAG) `a11y-fixer`. Ver `rules/chaining.md`.

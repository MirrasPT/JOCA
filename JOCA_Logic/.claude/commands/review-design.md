# /review-design — Review de Design (router)

Despacha o reviewer certo por **tipo de alvo** e **necessidade**. Não invoca sempre o mesmo agente.

## 1. Determinar alvo

- PLAN / PRD / spec `.md` (UI ainda não construída) → **plan-mode**
- URL staging/local, ou ficheiro(s) `.tsx`/`.html`/componente → **live/code**
- Nada especificado → perguntar

## 2. Despachar

### Plan-mode (shift-left, antes do código)
`Read(".claude/skills/design-review.md")` → modo §2:
- classificar marketing vs app
- matriz de estados (Loading/Empty/Error/Success/Partial)
- storyboard da user journey + tabela de decisões por resolver
- escreve fixes de volta no plano

### Live / code
Combinar conforme a necessidade (não são mutuamente exclusivos):

| Necessidade | Invocar |
|-------------|---------|
| Gosto · AI-slop · composição · rubrica + lint file:line | `design-review` (skill §1) — `Read(".claude/skills/design-review.md")` |
| Fluxos UX · WCAG profundo · ARIA · screen-reader · keyboard | `tester-ui-ux` (agente) |
| Drift de tokens / componentes vs design system | `design-system-audit` (agente) |
| Performance (Lighthouse / load) | `tester-performance` (agente) |

Default para "é bom?" / "revê o design" → `design-review` skill. Adicionar `tester-ui-ux` quando há fluxos/formulários/a11y a sério.

## 3. Relatório

`design-review`: tabela 3-pilares + reject AI-slop + litmus + findings (Blocking/Major/Minor) + score + verdict + quick wins.
Agentes: secções unificadas Critical / High / Medium.

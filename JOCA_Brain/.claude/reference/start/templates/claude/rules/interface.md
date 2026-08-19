---
paths:
  - "resources/views/*.blade.php"
  - "resources/views/**/*.blade.php"
  - "resources/js/**/*.{vue,jsx,tsx,svelte}"
  - "resources/css/**/*.css"
---

# Regras de interface

Carregadas quando o Claude **lê** um ficheiro de view ou de estilos. Ao criar um ecrã de raiz sem ler nenhuma view antes, podem não estar em contexto — nesse caso, ler `docs/DESIGN.md` explicitamente.

## Antes de alterar

Ler `docs/DESIGN.md`. É a fonte das restrições visuais, não uma sugestão.

## Obrigatório

- Usar os componentes de `resources/views/components/`. Criar componente novo
  exige justificação — se algo aparece em dois sítios, é componente; se aparece
  num, é composição.
- Tokens declarados em `@theme` no `resources/css/app.css` (Tailwind 4).
  **Não existe `tailwind.config.js`.**
- Nenhuma cor, tamanho de fonte ou raio fora dos tokens definidos.
- Uma única ação primária por ecrã.

## Os quatro estados

Qualquer ecrã que mostre dados tem de tratar os quatro. Um ecrã sem estado
vazio definido não está terminado:

1. **Vazio** — explica o que aparecerá aqui e dá a ação para começar
2. **A carregar** — skeleton quando a estrutura é conhecida, não spinner
3. **Erro** — o que falhou, em linguagem humana, e o que fazer a seguir
4. **Cheio** — com muitos dados, onde entra paginação ou scroll

## Acessibilidade — mínimos

- Contraste ≥ 4.5:1 (≥ 3:1 para texto grande)
- Controlos alcançáveis por teclado, com foco visível
- Ícone sozinho como ação leva `aria-label`
- Informação nunca transmitida só por cor

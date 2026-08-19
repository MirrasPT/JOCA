# Delta — Next.js 16 + React 19

Versoes verificadas Agosto 2026: `next` 16.3.1 · `react` 19.2.8 · Tailwind 4.

Aplica-se ao scaffold/testes/tokens/CI da Parte E1 do `executar-projeto`. O resto (contexto, skills, docs,
repositorio, hooks, issues) e igual.

## 2.1 — Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --no-turbopack
```

Se o backend for Laravel separado, o Next vive em `web/` e o Laravel na raiz — nesse caso
`npx create-next-app@latest web ...`.

## 2.2 — Nao ha Boost

O Laravel Boost e especifico de Laravel. O equivalente aqui e ter o `CLAUDE.md` com os comandos
reais e o schema acessivel (Prisma: `prisma/schema.prisma` e legivel directamente).

## 2.3 — Testes: Vitest

```bash
npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

`vitest.config.ts` com `environment: 'jsdom'` e `setupFiles`. Script: `"test": "vitest"`.

## 2.4 — Teste inicial

```ts
import { render, screen } from '@testing-library/react'
import Page from '@/app/page'

it('rende a pagina inicial', () => {
  render(<Page />)
  expect(screen.getByRole('main')).toBeInTheDocument()
})
```

## 2.8 — Tokens

Vao para `app/globals.css` (ou `src/app/globals.css`), no bloco `@theme` do Tailwind 4.
**Nao existe `tailwind.config.js`** no Tailwind 4.

## 2.9 — CI

`ci-nextjs.yml`. **O `eslint` nao e opcional:** `react/jsx-no-undef` e `no-undef` sao a unica coisa
que apanha um componente usado sem import — o `next build` deixa passar e so rebenta no browser.

## Armadilhas

- **`tsc --noEmit` passa onde `tsc -b` falha** em projectos com referencias. Correr o que o CI corre.
- **Server vs Client Components:** `useState`/`useEffect` exigem `"use client"`. O erro so aparece em
  runtime.
- **Tailwind v4 e content-scan:** ficheiros `.md` dentro da arvore sao lidos como fonte de classes.
  Uma classe partida num ficheiro de notas parte o build — e nenhum gate estatico apanha, so o dev
  runtime. Excluir com `@source not`.
- O gate de runtime continua a valer: build verde **nao** prova que a pagina hidrata.

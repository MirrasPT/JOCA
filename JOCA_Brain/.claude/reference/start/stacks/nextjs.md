# Delta — Next.js 16 + React 19

Versoes verificadas Agosto 2026: `next` 16.3.1 · `react` 19.2.8 · Tailwind 4.

Aplica-se ao scaffold/testes/tokens/CI da Parte E1 do `executar-projeto`. O resto (contexto, skills, docs,
repositorio, hooks, issues) e igual.

## 2.1 — Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir
```

**`.` numa pasta com maiusculas falha:** «name can no longer contain capital letters» — o npm deriva o
`name` do nome da pasta (verificado 2026-09-01, pasta `Acme`). As pastas da casa sao quase todas
capitalizadas. Contorno: scaffold numa pasta temporaria minuscula e `rsync` para a real, conferindo
colisoes antes (`rsync -a --dry-run --itemize-changes <tmp>/ <real>/`); depois acertar o `name` do
`package.json`.

**Nao existe `--no-turbopack`** (medido 2026-09-15: `npx create-next-app@latest --help` na 16.3.5 nao a
lista). Turbopack e o bundler por omissao; a unica saida e `--rspack`, e sair do default exige razao
em `docs/DECISIONS.md`.

**Porta fixa no script `dev`:** `"dev": "next dev -p 3000"`. Os terminais do JOCA OS herdam `PORT=7491`
e o `next dev` le o `PORT` do ambiente — sem `-p` arranca na porta do backend do JOCA.

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
- **`tsc --noEmit` falha num CI limpo** por falta de `.next/types` (o `LayoutProps` do Next 16 e
  gerado): localmente passa porque o build ja correu, e no 1.º CI parece erro de codigo. Correr
  `npx next typegen` antes do `tsc` (comando confirmado com `next typegen --help` na 16.3.5, 2026-09-15).
- **Server vs Client Components:** `useState`/`useEffect` exigem `"use client"`. O erro so aparece em
  runtime.
- **Tailwind v4 e content-scan:** ficheiros `.md` dentro da arvore sao lidos como fonte de classes.
  Uma classe partida num ficheiro de notas parte o build — e nenhum gate estatico apanha, so o dev
  runtime. Excluir com `@source not`.
- O gate de runtime continua a valer: build verde **nao** prova que a pagina hidrata.

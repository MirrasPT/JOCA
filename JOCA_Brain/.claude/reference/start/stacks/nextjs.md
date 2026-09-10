# Delta — Next.js 16 + React 19

Versions verified August 2026: `next` 16.3.1 · `react` 19.2.8 · Tailwind 4.

Applies to the scaffold/tests/tokens/CI of Part E1 of `execute-project`. The rest (context, skills, docs,
repository, hooks, issues) is the same.

## 2.1 — Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --no-turbopack
```

If the backend is a separate Laravel, Next lives in `web/` and Laravel at the root — in that case
`npx create-next-app@latest web ...`.

## 2.2 — There is no Boost

Laravel Boost is Laravel-specific. The equivalent here is having `CLAUDE.md` with the real commands
and the schema accessible (Prisma: `prisma/schema.prisma` is readable directly).

## 2.3 — Tests: Vitest

```bash
npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

`vitest.config.ts` with `environment: 'jsdom'` and `setupFiles`. Script: `"test": "vitest"`.

## 2.4 — Initial test

```ts
import { render, screen } from '@testing-library/react'
import Page from '@/app/page'

it('renders the home page', () => {
  render(<Page />)
  expect(screen.getByRole('main')).toBeInTheDocument()
})
```

## 2.8 — Tokens

They go into `app/globals.css` (or `src/app/globals.css`), in Tailwind 4's `@theme` block.
**`tailwind.config.js` does not exist** in Tailwind 4.

## 2.9 — CI

`ci-nextjs.yml`. **`eslint` is not optional:** `react/jsx-no-undef` and `no-undef` are the only thing
that catches a component used without an import — `next build` lets it through and it only blows up in the browser.

## Pitfalls

- **`tsc --noEmit` passes where `tsc -b` fails** in projects with references. Run what CI runs.
- **Server vs Client Components:** `useState`/`useEffect` require `"use client"`. The error only shows up at
  runtime.
- **Tailwind v4 and content-scan:** `.md` files inside the tree are read as a source of classes.
  A broken class in a notes file breaks the build — and no static gate catches it, only the dev
  runtime. Exclude with `@source not`.
- The runtime gate still applies: a green build does **not** prove the page hydrates.

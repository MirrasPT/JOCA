---
name: react-patterns
description: "Writing or reviewing React/Next.js code for performance and correctness — re-renders, effects, data fetching, bundle size, Server Components. MUST be invoked when the user says: react performance, re-render, useEffect, useMemo, useCallback, server component, RSC, suspense, waterfall, slow react, optimize react. SHOULD also invoke when: next.js, app router, use client, bundle size, code split, data fetching, stale closure, react review."
triggers: react performance, re-render, rerender, useEffect, useMemo, useCallback, useState, server component, RSC, suspense, waterfall, slow react, optimize react, next.js, nextjs, app router, use client, use server, bundle size, code split, lazy, dynamic import, data fetching, stale closure, react review, react best practices, memo, react.memo, derived state, key prop, context performance, streaming
---
# React Patterns — Performance + Correctness Specialist

Invoked by `frontend` (or directly) when writing/reviewing React or Next.js code. The *how it runs*, not the *how it looks*.

Bias: **derive, don't store. Render-time over effects. Parallel over waterfall. Server over client.**

Each rule = before/after. Apply silently during implementation. In review mode, output `file:line` + fix.

---

## 1. Re-renders

### Derive in render — never store derived state
```tsx
// ❌ extra state + effect to keep in sync
const [fullName, setFullName] = useState('');
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);

// ✅ compute during render
const fullName = `${first} ${last}`;
```
Rule: if a value can be computed from props/state, compute it. State is only for what can't be derived.

### Memoize only what's expensive or referentially required
```tsx
// useMemo: expensive compute OR stable ref for dependency arrays / memoized children
const sorted = useMemo(() => rows.sort(cmp), [rows]);          // expensive
const config = useMemo(() => ({ id, mode }), [id, mode]);       // stable ref for <Memo config={config}/>

// useCallback: function passed to memoized child or effect dep
const onPick = useCallback((id: string) => select(id), [select]);
```
Do NOT memoize cheap scalars or JSX that re-renders anyway. Premature `useMemo` adds cost.

### Split context to stop cascade re-renders
```tsx
// ❌ one context — any field change re-renders every consumer
<AppContext value={{ user, theme, cart }} />

// ✅ split by change frequency
<UserContext value={user} />
<ThemeContext value={theme} />
<CartContext value={cart} />
```
Or split state from dispatch: `StateContext` + `DispatchContext` (dispatch is stable → consumers that only dispatch never re-render).

### Keys: stable + unique, never index for dynamic lists
```tsx
{items.map((it, i) => <Row key={it.id} />)}   // ✅ id
{items.map((it, i) => <Row key={i} />)}        // ❌ reorder/insert = wrong reconciliation
```

### Move state down / lift content up
Push state to the smallest subtree that needs it. Pass expensive trees as `children` so they don't re-render when parent state changes:
```tsx
function Toggle({ children }) {            // children rendered once by parent
  const [open, setOpen] = useState(false);
  return <div>{open && children}</div>;   // toggling open does NOT re-render children
}
```

---

## 2. Effects — you probably don't need one

| Want to… | Don't use effect | Do |
|----------|------------------|-----|
| Transform data for render | `useEffect`+`setState` | compute in render |
| Reset state on prop change | effect | `key` prop on component |
| Respond to a user event | effect watching state | handle in the event handler |
| Cache expensive calc | effect | `useMemo` |
| Sync with external store | manual subscribe | `useSyncExternalStore` |
| Fetch on mount (client) | bare effect | framework loader / RSC / TanStack Query / SWR |

```tsx
// ❌ event logic in effect — runs on every render path, races
useEffect(() => { if (submitted) postAnalytics(); }, [submitted]);

// ✅ in the handler where the event actually happens
function onSubmit() { post(); postAnalytics(); }
```

Effect rules when you *do* need one:
- Always return cleanup (subscriptions, timers, listeners, aborts).
- Complete dependency array — no lying. Use the lint rule.
- Avoid object/array deps that change identity each render (memoize or move inside).

---

## 3. Data fetching — kill waterfalls

```tsx
// ❌ sequential waterfall — each await blocks the next
const user = await getUser(id);
const posts = await getPosts(user.id);   // could start earlier if independent

// ✅ parallel — independent requests fire together
const [user, settings] = await Promise.all([getUser(id), getSettings(id)]);
```

- **Hoist fetches** to the route/layout level; pass data down. Don't fetch inside leaf components that mount late.
- **Suspense boundaries** for progressive reveal — wrap slow sections so fast content streams first.
- **No client-side fetch waterfalls** from nested `useEffect`. Fetch on the server (RSC/loader) or batch.
- **Preload on intent** (hover/focus) for navigation-critical data.

### Caching decision
| Need | Use |
|------|-----|
| Per-request server dedupe (same data, one render) | `React.cache()` |
| Client cache + revalidation, mutations | SWR / TanStack Query |
| Cross-request server cache, TTL | LRU / framework data cache |
| Static at build | generateStaticParams / SSG |

---

## 4. Bundle size

```tsx
// ❌ barrel import pulls the whole library
import { debounce } from 'lodash';

// ✅ direct path — tree-shakeable
import debounce from 'lodash/debounce';
```

- `dynamic()` / `React.lazy()` for heavy, below-fold, or rarely-used components (charts, editors, modals).
- Defer non-critical client JS; keep it out of the initial bundle.
- Audit with `vite-bundle-visualizer` / `@next/bundle-analyzer`.
- Prefer date-fns/dayjs over moment; native `Intl` over format libs when possible.

---

## 5. Server rendering (Next.js App Router)

- **Server Components by default.** Add `'use client'` only at the leaf that needs interactivity/hooks/browser APIs. Push the boundary down — a `'use client'` high in the tree drags everything below into the client bundle.
- **Pass server data as props** into client components; don't refetch on client.
- **Stream with `loading.tsx` / `<Suspense>`** so TTFB stays low and slow data doesn't block the shell.
- **Server Actions** for mutations instead of client fetch + API route round-trips.
- **Co-locate data fetching** in the Server Component that renders it; React dedupes via `cache()`.
- Mark static vs dynamic intentionally (`export const dynamic`, `revalidate`).

```tsx
// page.tsx (Server Component) — data fetched server-side, streamed
export default async function Page({ params }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Feed userId={params.id} />   {/* async server component */}
    </Suspense>
  );
}
```

---

## 6. JS / state correctness

- **Immutable updates** — never mutate state in place. `setItems(prev => [...prev, x])`, not `items.push`.
- **Functional updaters** when next state depends on previous: `setCount(c => c + 1)`.
- **Stable refs** for mutable values that shouldn't trigger renders (`useRef`).
- **API decimals are strings** (Laravel/Eloquent serializes decimal as string) — `Number(v)` before `.toFixed()`/arithmetic.
- **Number/boolean from inputs** — coerce explicitly; form values are strings.

---

## Review mode

When asked to "review react" / "why is this slow":
1. Scan for: derived-state-in-effect, missing keys / index keys, unstable context value, fetch waterfalls, `'use client'` too high, barrel imports.
2. Output terse `file:line — issue → fix`, ordered by impact (re-renders & waterfalls first).
3. Don't rewrite adjacent code — flag and fix only the issue.

---

## Checklist

- [ ] No derived state stored in `useState`+`useEffect`
- [ ] Effects only for true external sync; all have cleanup + honest deps
- [ ] Independent fetches parallelized; no client waterfalls
- [ ] `'use client'` at the leaf, not the trunk
- [ ] Heavy components lazy-loaded
- [ ] Lists keyed by stable id
- [ ] Context split by change frequency / state vs dispatch
- [ ] Immutable updates, functional updaters

---

## Related skills

- `frontend` — director; invokes this for the code layer
- `react-composition` — component API shape (compound, context, slots)
- `tailwind` — styling layer
- `anima` — animation (useGSAP cleanup overlaps with effect rules)
- Agent `tester-performance` — Lighthouse / load test after build

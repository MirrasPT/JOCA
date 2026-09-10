---
name: yagni
description: "6-rung decision ladder to minimize code and dependencies before writing anything. Formalizes the simplicity principles of soul.md/CLAUDE.md into an activatable skill. MUST be invoked when the user says: yagni, simpler, minimum code, avoid dependency, do you really need this, over-engineering, don't complicate, less abstraction. SHOULD also invoke when: adding a new dependency, creating an abstraction, generic util/helper, premature scaffolding, speculative feature."
triggers: yagni, you arent gonna need it, simpler, simplify, minimum code, less code, avoid dependency, new dependency, npm install, composer require, do you really need, over-engineering, overengineering, dont complicate, less abstraction, premature abstraction, generic helper, generic util, speculative feature, premature scaffolding, preventive refactor
---
# YAGNI — Simplicity Decision Ladder

Adopted from DietrichGebert/ponytail. Formalizes the simplicity of `soul.md`/`CLAUDE.md` into an activatable skill.

Caveman premise: **code you don't write has no bugs.** A dependency you don't add has no CVEs and no breaking changes. An abstraction you don't create confuses nobody.

Bias: **YAGNI > stdlib > framework native > dep already present > one-liner > minimum new code.** Always in this order. Stop at the first rung that solves it.

---

## The ladder (6 rungs, sequential)

Before writing code or adding a dep, walk the ladder **from top to bottom**. Stop at the first one that serves.

| # | Rung | Question | Action |
|---|--------|----------|------|
| 1 | **YAGNI** | Do you really need this? Now? | Real and present requirement? No → don't do it. |
| 2 | **Stdlib** | Does the language already do this? | `Array.map`, `URL`, `crypto`, `str_*`, `Collection`. |
| 3 | **Framework native** | Does the framework already do this? | Laravel: `Str`, `validator`, `Cache`, policies. React: `useState`, Context, `useId`. |
| 4 | **Dep already in the project** | Does something in `package.json`/`composer.json` already solve it? | Reuse before installing a new one. |
| 5 | **One-liner / small util** | Can it be solved with a short inline util? | A 3-5 line helper in the project > a 50KB dep. |
| 6 | **Minimum new code** | Only here do you write new code. | The minimum. No generalizing for hypothetical cases. |

**Rule:** go up a rung (new dep, abstraction) only when the previous ones demonstrably fall short. Justify in 1 line why the rung above fails.

---

## GUARD-RAILS (NEVER simplified/cut)

These are **not** subject to the ladder. Cutting here is not simplicity — it is a bug or damage. Inviolable:

- **Security** — auth, authorization, escaping, secrets, CSRF, rate limit. Never "I'll add it later".
- **Input validation** — every external input validated. "I trust the caller" is not YAGNI, it is a hole.
- **Data loss prevention** — transactions, confirmation on irreversible actions, backups, reversible migrations.
- **Accessibility** — semantics, labels, focus, contrast, keyboard. It is not an optional feature.

YAGNI cuts speculative features and premature abstraction — **never** these four. In doubt whether something is a guard-rail → treat it as a guard-rail.

---

## Examples

```js
// Rung 1 — YAGNI: they asked to list 3 users
// ❌ pagination system + filters + cache "because one day"
// ✅ users.slice(0, 3)
```

```js
// Rung 2 — stdlib instead of a dep
// ❌ npm install lodash.groupby
// ✅ Object.groupBy(items, x => x.cat)   // or a 4-line reduce
```

```php
// Rung 3 — framework native instead of your own helper
// ❌ class SlugMaker { public function make(...) {...} }
// ✅ Str::slug($title);
```

```js
// Rung 5 — one-liner instead of a dep
// ❌ npm install is-empty
// ✅ const isEmpty = v => v == null || v.length === 0;
```

```php
// GUARD-RAIL — do NOT cut even under "simplify it"
// ❌ "validation later, first make it work" → input goes raw into the query
// ✅ $request->validate([...]);  // always, non-negotiable
```

---

## Anti-patterns

| Wrong | Right |
|--------|----------|
| Adding a dep for a 3-line function | Rung 5: inline util |
| Abstracting before the 3rd use | Inline until the pattern repeats 3x |
| Scaffolding "for the future" (config, plugins, hooks) | Build when the requirement exists |
| Generalizing a function for hypothetical cases | Solve the real case at hand |
| Your own wrapper over something from the stdlib/framework | Use the native one directly |
| Cutting validation/auth "to simplify" | Guard-rail: never cut |
| Single-use abstraction layer | Direct code |
| Installing a dep without walking the ladder first | Justify why rungs 1-5 fail |

---

## Interaction with other skills

- Reinforces `caveman`/`soul.md`: surgical simplicity, zero wasted code.
- Invoke before `laravel-specialist`/`frontend` when the instinct is to add a dep or an abstraction.
- `react-composition` solves rung 6 on the component API side (composition > config).

## When to ignore
Guard-rails always win. If simplifying touches security/validation/data/a11y → stop, do not simplify, flag it.

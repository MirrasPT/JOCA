# JOCA_OS analysis — 2026-08-19

Scope: `JOCA_OS/` of the public repo (`MirrasPT/JOCA@main`, HEAD `6f7bf52`), dev instance at
`:7591/7592`. Does not cover `JOCA_Brain/` (running in another session) nor production.

Everything here was **measured** — the commands and the numbers are in each section.

> **Update 2026-08-19 (afternoon): §1–§3 fixed.** See "Fixes applied" at the end.
> §4–§6 stay as continuous hygiene, as the analysis itself recommends.

---

## 1. Touch targets shrink to 21px when there are 4 actions ⚠ regression from this session

**Where:** `frontend/src/App.css:1289`

```css
@media (hover:none) { .project-group-actions { opacity:1; max-width:100px; } }
```

The container reveals the project's actions on hover-less screens with a ceiling of 100px. With 3
buttons the arithmetic closed exactly: `3×28 + 2×6 = 96px`. The **Remove project** button added
today makes 4 on a project **inside a group** (which also shows "remove from the group"):
`4×28 + 3×6 = 130px`. They are not clipped — the flex crushes them.

**Measured** (Playwright, `devices['iPhone 13']`, `hover:none` confirmed at `true`): the 4 buttons
end up at **21×28px** each, against the 28×28 from before. There is no clipping (all inside the
container's right edge), there is target degradation.

**Proposed fix** (a line and a half):
```css
@media (hover:none) { .project-group-actions { opacity:1; max-width:140px; } }
.project-group-action { flex-shrink:0; }
```

Context note: even the 28px are below the recommended 44px, and the CSS already admits it in
writing (`App.css:1301` — "28px visual (not 44px — 3 actions side by side, the full target would
require an overflow-menu, out of scope for now)"). The point here is not to reach 44, it is not to
**worsen** 28 → 21.

---

## 2. There is no eslint — and it is the only gate that catches this class of error 🔴 biggest return

**Verified:** no `eslint.config.*` / `.eslintrc*` and no `lint` script in `package.json`, neither in
the frontend nor in the backend. The project's static gate is only `tsc --noEmit` + `vite build`.

Neither `tsc` nor Vite fail an undefined identifier inside JSX or inside an `.mjs`. Real case found
in this session: `cli/joca.mjs` called `rel(c.ts)` in the output of the `task` command, and `rel`
**was not defined anywhere in the file** — `joca task <id>` blew up with a `ReferenceError`
whenever the task had notes, with a green build and zero warnings. The `no-undef` and
`react/jsx-no-undef` rules close exactly this.

The code was published like that; it only went away because the command was removed for another reason.

---

## 3. Asymmetric test coverage

| | Value |
|---|---|
| HTTP endpoints | 54 |
| Test files that exercise routes | **0** (no supertest) |
| Tests in the frontend | **0** |
| Existing tests | 38, pure unit tests |

The 38 (`backend/src/__tests__/`) cover cron, write chunking into the PTY, CLI profiles,
notifications and path security — good material, but they do not touch the HTTP layer nor the
`session-manager`, which is where `node-pty` and disk access live.

Biggest risk per euro: contract tests on `/projects` and `/sessions`.

---

## 4. Two monoliths

| File | Lines |
|---|---|
| `frontend/src/App.css` | 7361 |
| `frontend/src/components/SessionSidebar.tsx` | 1441 |
| `frontend/src/App.tsx` | 973 (87 hooks; 30 props passed to the sidebar alone) |

The per-component CSS convention **already exists** — there are 9 files next to the components
(`project-modal.css`, `DashboardView.css`, `agents-view.css`, …). It just was not carried through to
the end. Migrating section by section as they get touched is cheap; a big-bang does not pay for itself.

---

## 5. Dead CSS: 180 classes

Tight criterion — neither the name nor the two-segment prefix appears in any `.ts`/`.tsx`
(a looser criterion gave 276, with false positives from names assembled by template literal).
Verified by manual sampling.

| File | Classes |
|---|---|
| `App.css` | 158 |
| `components/DashboardView.css` | 15 |
| `components/TerminalView.css` | 4 |
| `components/agents-view.css` | 3 |

Examples: `action-picker-*`, `create-skill-modal`, `builder-card`, `automation-trigger`,
`av-status-*`. They are leftovers of removed features — the same species as
`.project-group-action--remove`, which had been orphaned ever since the remove button left the bar
and was reused today when it came back.

---

## 6. Bundle in a single chunk

`607 kB` of JS (167 kB gzip) + `204 kB` of CSS, a single chunk, with a Vite warning on every build.
Natural candidates for dynamic `import()`: xterm.js and the project modal.

---

## What is fine (measured, not presumed)

- **0 vulnerabilities** — `npm audit --omit=dev` on both sides
- **0 buttons without an accessible name** out of 29 in the dashboard. Rare, and not by accident: the
  code carries a comment about `htmlFor` not naming elements that render `<button>`
- `(hover:none)` and `(pointer:coarse)` handled deliberately, with the reasoning written in the CSS
  (`App.css:7098` explains why it is `pointer:coarse` and not width)
- Only **4** TODO/FIXME in ~24,500 lines of code
- The comments record the **why**, many with the dated regression that motivated them. It is what
  made it possible to remove the Tasks system without breaking the automations: the boundary was written.

---

## Suggested order

1. **The 21px regression** (§1) — it is a one-minute job and was introduced today
2. **eslint** (§2) — the missing gate, and there is evidence of a real bug it would have caught
3. **Route tests** (§3) — 54 endpoints with no safety net

§4-§6 are hygiene: they are done lightly, as each area gets touched.

---

## How to reproduce

```bash
# sizes
find backend/src frontend/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' | xargs wc -l | sort -rn | head

# eslint (absence)
ls frontend/eslint.config.* backend/eslint.config.* 2>/dev/null; grep '"lint"' */package.json

# endpoints vs route tests
grep -rhoE "r\.(get|post|put|patch|delete)\('[^']+'" backend/src/http/*.ts | wc -l
grep -rl "supertest\|request(app)" backend/src/__tests__/ | wc -l

# vulnerabilities
(cd frontend && npm audit --omit=dev); (cd backend && npm audit --omit=dev)
```

The touch targets and the contrast were measured live with Playwright against `:7592` — measure on
what is **painted** (`getBoundingClientRect`, `getComputedStyle`), never on the declared token.

---

## Fixes applied (2026-08-19, JOCA_Brain session)

**§1 — touch targets:** `max-width` 100→140px in BOTH rules (hover:none **and** the desktop's
hover/focus-within — the same arithmetic crushed in both) + `flex-shrink:0` on
`.project-group-action`. **Verified live** at `:7592` (iPhone 13, `hover:none:true`):
`maxWidth:140px`, `flexShrink:0`.

**§2 — eslint installed in the 3 places:** `backend/eslint.config.mjs` (typescript-eslint),
`frontend/eslint.config.mjs` (typescript-eslint + react-hooks; the compiler's new rules were left at
`warn` — 21 documented refactor warnings, the classic ones are `error`), and `cli/eslint.config.mjs`
with **`no-undef`** — the gate that would have caught the undefined `rel()`. `npm run lint` on both
sides: **0 errors**. The installation raised and closed 19 real errors: 4 dead imports/directives in
the backend and 15 leftovers of the Tasks removal in the frontend (`pinOutput`+callback and
`updateProjectMemory` deleted; useState with a dead value → `[, setX]`; dead props prefixed `_`).

**§3 — contract tests:** `backend/src/__tests__/routes-contract.test.ts` — 11 tests on
`/projects` and `/sessions` (validation, traversal, 409, truncation, PATCH/404, persistence,
nonexistent ids). Suite: **49/49**. Two real contracts documented in the process: `DELETE
/projects/:id` is **idempotent** (always 200) and a session's `interrupt`/`kill` are **soft-fail**
(200 + `ok:false`). Pitfall recorded in the test itself: the isolation comes from the
`JOCA_DATA_DIR` of `vitest.config.ts` — clean via the imported `DATA_DIR`, never your own tmpdir.

**Extra (outside the analysis, requested by the owner):** `start` joined the default quick commands
(`['start','save','compact','plan']` — 3 backend defaults + the frontend's base); the toolkit modal
picks up the new skills from disk with no change.

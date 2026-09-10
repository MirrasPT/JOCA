# Runtime gates — detail (on-demand)

Compressed version (auto-loaded) in `.claude/rules/pipelines.md` §Gates. This file keeps the evidence table by category and the real cases. `Read()` before signing off a phase gate.

## Gates: static ≠ runtime

Green `tsc`/`npm run build`/`php -l` prove that it **compiles**, not that it **works**. Two real
examples: a `<Check>` (lucide) used in JSX without an import passed the Vite build and only blew up when the
user opened the modal; and a whole app was declared done with green `tsc`+`build` when
`next dev` did not even hydrate — nothing interactive, and no static gate would have caught it.

**Whoever writes the code does not sign the gate.** The verifier is an agent other than the producer — if the producer was the main loop, the verification is delegated. Ledger in `.joca/loop.json` (`produtor`/`verificador`), enforced by `stop-continue.js`.

**Static gate (minimum, always):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`**.
eslint is not optional in JS/TS projects: `react/jsx-no-undef` and `no-undef` are the only thing that
catches undefined component identifiers, which Vite lets through.

**Runtime gate (mandatory, not recommended)** — no phase that touches these categories closes
without live evidence:

| Category | Minimum evidence |
|---|---|
| Navigation · header · overlay · modal | `document.elementFromPoint(cx,cy)` at the center of every link/button, on a clean load (fresh `goto`). Auditing `href` **is not** testing the click — this bug reached the user in two consecutive sessions |
| Mobile / responsive | horizontal bleed measured by `getBoundingClientRect().right` vs `innerWidth` per text element. `scrollWidth - clientWidth` gives a **false 0** with `overflow-x:clip\|hidden` on an ancestor — it hid a real defect through 5 audits |
| Auth · session | full end-to-end login, not just the 200 of the login page (a DB with 0 users returns `/admin/login → 200` all the same) |
| Playback · media · streaming | play it and watch; the lifecycle of streams is not proven by compiling |
| Deploy | dependencies derived from the **published HTML**, not from the list of what was uploaded (see Deploy pipeline) |

## The gate as an artifact — `gate-runtime.mjs`

The rule above existed for months with no code: every frontend project rewrote ~250 lines from scratch, and every rewrite lost one of the pitfalls. In one session, `tsc`+`eslint`+`build` were green while 9 controls had no accessible name, 3 routes scrolled horizontally and pagination pushed the page off screen.

```bash
node .claude/scripts/gate-runtime.mjs --base http://localhost:3000 --rotas /,/precos,/sobre
node .claude/scripts/gate-runtime.mjs --config gate-runtime.json --clicar "header button,[data-testid=menu]"
```

| Flag | Effect |
|---|---|
| `--base <url>` | mandatory (or `base` in `--config`) |
| `--rotas a,b,c` | default `/` |
| `--temas a,b` | writes `data-theme` on the `<html>` and repeats the matrix |
| `--viewports WxH,…` | default `1440x900,390x844` |
| `--clicar <selector>` | clicks every matching element and counts new errors |
| `--out <folder>` | default `./.joca/gate-runtime` (JSON report + screenshots) |
| `--esperar <ms>` | wait after load, before measuring (default 500) |

It measures: text contrast against the **painted** pixel (alpha composited over the ancestors; a background with a gradient/image is flagged as *not measurable*, not guessed) · `document.elementFromPoint` at the center of every interactive target · bleed by `getBoundingClientRect().right` **discarding** ancestors with `overflow-x: auto|scroll|hidden|clip` · targets <24 px · buttons with no accessible name (`label[for]` does **not** name a `<button>` — a pitfall common to Radix/shadcn/Headless) · console errors and `pageerror` · HTTP >= 400. It exits with 1 if any combination has a problem.

⚠ **Without `--clicar` it measures the RESTING state.** A gate that never interacts is a layout gate: four published overlays did not open and killed the page's React tree, and the gate reported the route as clean. Targets whose center falls outside the viewport are not measured — the summary says so instead of passing them as good.

Playwright: resolved at runtime (project dependency → `npm root -g` → `PLAYWRIGHT_PATH`), and if there is no downloaded binary it uses the installed Chrome (`CHROME_BIN`). Never a hardcoded path — a gate that does not start is a gate that does not exist.

**Diagnosis is a step with its own gate:** a step that claims "X is broken" only produces output
**after reading the code of X**, with a file:line citation per claim. Comparing file names and
sizes is not reading. A `WORKFLOW.md` committed before the reading brought 2 out of 3
"regressions" misdiagnosed (the failover existed and worked; the leak had a TTL sweeper) and
sent the next piece of work to the wrong place.

**Resolving conflicts is code, not text:** after any merge/port/`git apply --3way`,
**run the artifact**. A `build-skill-index.py` came out of a 3-way with no markers and syntactically
plausible, and blew up on the first run (`match` out of scope, constants lost because neighbouring
hunks were resolved to different sides). It took 3 runs to get it standing.

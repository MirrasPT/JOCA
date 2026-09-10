---
name: prepare-design
description: "Designs a screen inside the project's visual system and delivers it as an Artifact you can browse. Starts by finding out what design ALREADY exists (Figma, brand, running site, mockups) so as not to reinvent what is already decided. MUST be invoked when the user says: prepare design, design a screen, screen mockup, /prepare-design, design briefing. SHOULD also invoke when: build the screen, what will this page look like, design the interface, mockup, screen prototype, new screen."
triggers: prepare design, design a screen, screen mockup, prepare-design, design briefing, build the screen, design the interface, mockup, screen prototype, new screen
argument-hint: "[screen-name]"
chain: validate-design, new-issue
---
# Prepare design — from what already exists to the mockup in the browser

You produce the mockup of a screen **inside the project's visual system**, and deliver it as an
**Artifact** — a page the user opens in the browser and comments on, not a block of HTML in the console.

The screen name comes in `$ARGUMENTS`. If it comes empty, ask which one it is.

---

## PHASE 1 — What already exists (ask before designing)

**The question that saves the most work is "is this already decided?".** Designing a screen from
scratch when its brand already exists produces a mockup that will be rejected for reasons nobody
wrote down anywhere.

### 1a. Look first — zero questions

A question the disk already answers is a question you do not ask:

```bash
ls docs/DESIGN.md docs/BRAND.md BRAND.md 2>/dev/null
ls docs/mockups/ 2>/dev/null
# tokens already declared?
sed -n '/@theme/,/^}/p' resources/css/app.css 2>/dev/null    # Laravel / Tailwind 4
sed -n '/@theme/,/^}/p' app/globals.css 2>/dev/null          # Next.js / Tailwind 4
grep -rn "ThemeData\|ColorScheme.fromSeed" lib/ 2>/dev/null | head    # Flutter
# components that already exist
ls resources/views/components/ components/ui/ src/components/ lib/ui/widgets/ 2>/dev/null
```

### 1b. Ask what is left over — with `AskUserQuestion`

One question at a time, concrete options, always with a recommended one. **Never dump a
questionnaire in running text.**

**Question 1 — where does the design come from?**

| Option | What happens next |
|---|---|
| **There is already a system in this repo** (`docs/DESIGN.md` filled in) | Read it and skip to Phase 2 |
| **There is brand/identity outside the repo** (manual, Figma, running site) | Go to Phase 1c to extract the **measured** tokens |
| **There is a reference I want to follow** (a product they like) | Ask for the URL; extract principles, **never copy** |
| **There is nothing — decide now** | Run the four decisions (Phase 1d) |

**If the user says design already exists, ask for the artifact before continuing** — file, URL,
screenshot or Figma link. "There is design" without the artifact is the same as not existing, and
designing on top of a verbal description is how the mockup drifts from what was decided.

### 1c. Extract tokens from existing design — measure, never estimate

> **Tokens are facts.** Colors, typefaces and spacings without a **measured** or documented token
> are `TODO: missing token`, never a plausible value. An invented hex passes the build and is only
> wrong.

| Source | How to extract |
|---|---|
| **Running site** | `site-capture` for the screenshot + `getComputedStyle` on the key elements. Measure, do not read the CSS by eye |
| **Figma** | Read the *variables*/styles if there is access; otherwise, ask for an export of the tokens or a high-resolution screenshot |
| **Brand manual (PDF)** | `markitdown` to extract; confirm the hex values with the user |
| **Screenshot/image** | `Read()` the image and pull the palette — and then **confirm every value** with the user |

Write the result into `docs/DESIGN.md` **before** designing. It is the contract.

### 1d. The four decisions — only if there is nothing

Explain first, in two sentences, why this comes before the screens: without a defined system, each
screen comes out pretty in isolation and the set comes out incoherent — and that is only noticed at
the tenth screen, when fixing it already means redoing it.

One decision at a time, with `AskUserQuestion` and **concrete options with a preview**:

1. **Typography** — 2-3 proposals with real names and the display/body pair.
2. **Brand color** — ask for the color, or propose 3 hex values. Then the neutral: slate (cool),
   zinc (neutral), stone (warm).
3. **Shape** — square corners, `0.5rem` or `0.75rem`.
4. **Density** — compact (work application, lots of data) or spacious (public product).

---

## PHASE 2 — Gather the briefing

1. **The system:** `docs/DESIGN.md`, in full.
2. **The real tokens**, verbatim (the measured/declared block from Phase 1).
3. **The components that already exist** (the `ls` from Phase 1a).
4. **The screen's issue**, with the acceptance criteria:

```bash
gh issue list --search "<screen-name>" --state open
gh issue view <number>
```

5. **The flows where the screen appears**, from `docs/PRODUCT.md` — who arrives here, coming from
   where, and what they want to do.

---

## PHASE 3 — Design and publish as an Artifact

**Load the `artifact-design` skill before writing the page** — it is mandatory, and it is what
calibrates the visual treatment.

Write the mockup and publish it with the `Artifact` tool. The user gets a **URL** that opens in the
browser, sees it in light and dark, and can leave per-block comments there.

### What the mockup must have

- **A standalone HTML file.** Tailwind 4 via the browser build:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme { /* copied VERBATIM from the project */ }
</style>
```

  **Do not use `https://cdn.tailwindcss.com` nor an inline `tailwind.config`** — that is Tailwind 3
  syntax and would produce classes that do not exist in the application.

- **The `@theme` block copied verbatim** from the project, so the mockup uses exactly the same
  tokens as the application. A mockup with its own tokens produces a screen that looks right in
  isolation and clashes with the set.

- **The four states**, separated by a header, one after the other:
  1. **Empty** — first use: explains what will appear here and gives the action to get started
  2. **Loading** — skeleton when the structure is known, not a spinner
  3. **Error** — what failed, in human language, and what to do next
  4. **Full** — with lots of data: where pagination comes in, and whether the layout holds the
     longest text

- **Plausible sample data** — real names and values from the domain, **never "Lorem ipsum" nor
  "Test 1"**. Unrealistic fake data hides layout problems that only appear with real content.

- **HTML comments marking** which component each block will be in the implementation.

- **A list at the end:** new components this screen requires.

### By stack

| Stack | What the mockup approximates | Mark in a comment |
|---|---|---|
| **Laravel + Livewire** | Flux UI only exists in Blade — approximate it with HTML+Tailwind | `<!-- flux:button variant=primary -->` |
| **Next.js** | shadcn/ui has an equivalent in HTML+Tailwind | `<!-- <Button variant="default"> -->` |
| **Flutter** | Material 3 is not HTML — the mockup is a **visual reference**, not structure | `<!-- FilledButton -->` · and convert tokens to `ColorScheme` in the implementation |

Without those marks, whoever implements it reconstructs the decision from the appearance, and that
is where the implemented starts drifting from the designed.

### Save it to disk too

The Artifact is for viewing and commenting; the file is what stays versioned:

```bash
test -f docs/mockups/<screen>.html && echo "ALREADY EXISTS — use <screen>-v2.html"
```

**Overwriting an already-approved mockup is irreversible.** If it exists, versioned sibling name.

---

## Finish

Tell the user:

- **The Artifact URL**, to open in the browser right away
- That the file was left at `docs/mockups/<screen>.html`
- The composition decisions you took, and why
- Where you had to step outside the design system, if you did — a candidate for a new component or
  for a change to `DESIGN.md`
- That on approval they should run `/validate-design <screen>` **before** implementing

## Do not do

- Do not introduce colors, sizes or radii outside the system.
- Do not write real Blade, React or Dart in this skill — this is design.
- Do not use external component libraries in the mockup.
- Do not invent tokens when the existing design did not give them — `TODO: missing token`.

## Next step (chain)

- Mockup approved by the user → `validate-design <screen>` (gatekeeper: tokens, states, a11y).
- The mockup revealed new components → `new-issue` for each one, with the `area: design` label.
- The visual system did not exist and was decided now → record it in `docs/DESIGN.md` before leaving.

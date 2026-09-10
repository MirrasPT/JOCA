---
name: validate-design
description: "Validates a mockup against the project's visual system and prepares the implementation notes. Gatekeeper, not author: flags what is out of the system and hands it back, does not redesign. MUST be invoked when the user says: validate design, validate the mockup, /validate-design, is the mockup good, review the screen. SHOULD also invoke when: can I implement this screen, check the mockup, does the design match the system, approve the mockup."
triggers: validate design, validate the mockup, validate-design, is the mockup good, review the screen, can I implement this screen, check the mockup, approve the mockup
argument-hint: "[screen-name]"
chain: new-issue, a11y-fixer
---
# Validate design — gatekeeper, not author

You receive a mockup and check whether it fits the system. **You do not redesign the screen**; you flag
what is out and hand it back for correction.

The screen name comes in `$ARGUMENTS`. If it comes empty, ask which one it is.

## Read first

1. `docs/DESIGN.md` — the constraints
2. The project's real tokens:
   - Laravel/Livewire: `sed -n '/@theme/,/^}/p' resources/css/app.css`
   - Next.js: `sed -n '/@theme/,/^}/p' app/globals.css`
   - Flutter: `grep -n "ColorScheme\|ThemeData" lib/theme.dart`
3. The components that exist: `ls resources/views/components/ components/ui/ lib/ui/widgets/ 2>/dev/null`
4. The mockup: `docs/mockups/<screen>.html`
5. The screen's issue, for the acceptance criteria

If the mockup is not in `docs/mockups/`, ask for the file and save it there before continuing.

## Check

### 1. Tokens

```bash
sed -n '/@theme/,/}/p' docs/mockups/<screen>.html
```

Compare with the project's. **Block** if there are different values. A mockup with its own tokens
produces a screen that looks right in isolation and clashes with the whole.

Also look for colors and measurements written by hand that should be tokens: loose `#hex`, `text-[13px]`,
`rounded-[6px]`.

### 2. Components

List the mockup's blocks and map each one to:

- a base-library component that already exists (Flux · shadcn/ui · Material 3)
- an own component that already exists
- **a new component** → becomes an issue with the `area: design` label

If the mockup does not carry comments marking this, do it yourself and **flag the omission**.

### 3. The four states

Confirm they exist, and that they are not decorative:

- **Empty** — does it explain what will appear here and give the action to get started?
- **Loading** — skeleton when the structure is known, not a spinner?
- **Error** — does it say what failed in human language and what to do next?
- **Full** — does it show where pagination or scroll comes in? Does the layout hold the longest text?

**Block** if any is missing. A screen with no defined empty state is not designed.

### 4. Composition rules

Against `docs/DESIGN.md`: a single primary action, alignments, constant vertical spacing,
shadows only on floating elements, truncation of long text.

### 5. Acceptance criteria

Does the screen allow everything the issue requires? Does it do anything that was declared out of scope?

### 6. Accessibility — measured, not estimated

> **Contrast is checked against what is PAINTED, not against the token.** A gradient requires both
> ends (worst case); a color with alpha requires compositing over the real background. Reading the hex
> from `@theme` and declaring "passes AA" is guessing.

- Text contrast >= 4.5:1 (>= 3:1 for large text), **calculated**
- Visible focus on everything reachable by keyboard
- `aria-label` on icon-only actions
- Information never conveyed by color alone
- Touch targets >= 44px on mobile and Flutter

> **`id` + `<label for>` does NOT name a headless control that renders a `<button>`** (Radix Checkbox,
> Switch, RadioGroup). The accessible name of a `button` comes from `aria-label`/`aria-labelledby`/content.
> If the mockup marks blocks as Radix/shadcn, check this explicitly.

## Hand back

```
## <screen> — validation

**Verdict:** approved | approved with fixes | send back

### Blocks
<file:line — what is wrong, and the consequence>

### Should fix
<...>

### New components needed
| Component | Where it appears | Why what exists is not enough |

### Implementation notes
<map block → real component, and what requires server logic>
```

## After approval

- Open the issues for the new components, with `area: design`
- Confirm the mockup is committed in `docs/mockups/`
- If the validation revealed a rule that was missing from the system — a decision the mockup had to make and
  `DESIGN.md` did not cover — **add it to `DESIGN.md`, with date and reason, in the change
  log.** That is how the system grows: from real cases, not from prediction.

## Do not do

- Do not redesign the screen. If it is wrong, hand it back with the reason.
- Do not accept tokens or components outside the system because they are "better" on this screen. If they
  really are better, the system changes first — an explicit decision, recorded, applied to every screen.
- **Do not invent problems to look useful.** A validation that always finds something stops being
  taken seriously. If there is nothing blocking, say so clearly.

## Next step (chain)

- New components identified → `new-issue` for each one (`area: design`).
- Accessibility violations → `a11y-fixer` after the screen is implemented (here you only
  flag them; the mockup is not the final code).
- Approved → implement. The mockup becomes the reference, **not** the final component.

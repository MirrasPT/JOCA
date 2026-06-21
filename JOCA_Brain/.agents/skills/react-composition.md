---
name: react-composition
description: "Designing React component APIs that scale — compound components, context, slots/children, React 19 ref-as-prop, killing boolean-prop proliferation. MUST be invoked when the user says: compound component, component api, boolean props, slots, render props, forwardRef, context provider, reusable component, component library. SHOULD also invoke when: prop drilling, asChild, controlled component, headless component, variant explosion, component design."
triggers: compound component, component api, boolean props, prop proliferation, slots, slot pattern, render props, forwardRef, ref as prop, context provider, reusable component, component library, prop drilling, asChild, controlled component, uncontrolled, headless component, variant explosion, component design, accordion, tabs, select, dropdown composition, children composition, react 19 ref
---
# React Composition — Component API Specialist

Invoked by `frontend` (or directly) when designing the *shape* of a component — how it's used, not how it performs (`react-patterns`) or looks (`tailwind`).

Core problem: **component APIs rot.** Every new requirement adds a boolean prop. After 10 booleans the component is unmaintainable and impossible to use correctly.

Bias: **composition over configuration. children over render-props. context over prop-drilling. explicit parts over boolean soup.**

---

## 1. The boolean-prop smell

```tsx
// ❌ rots over time — invalid combinations, no clear API
<Card
  hasHeader hasFooter headerBordered footerSticky
  collapsible defaultCollapsed elevated interactive
  loading error compact />
```
Symptoms: 5+ booleans, `headerX`/`footerX` prefixed props, `renderHeader`/`renderFooter` callbacks, props that only make sense in combination.

```tsx
// ✅ compound — caller composes the parts they need, structure is explicit
<Card>
  <Card.Header bordered>…</Card.Header>
  <Card.Body>…</Card.Body>
  <Card.Footer sticky>…</Card.Footer>
</Card>
```

**Rule:** when a PR adds a 3rd boolean to a component, stop and consider compound/slots instead.

---

## 2. Compound components (Context-backed)

Parts share implicit state via Context — no prop drilling, no manual wiring.

```tsx
const TabsContext = createContext<{ active: string; setActive: (v: string) => void } | null>(null);
const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
};

function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultValue);
  return <TabsContext value={{ active, setActive }}>{children}</TabsContext>;
}

function TabList({ children }: { children: ReactNode }) {
  return <div role="tablist">{children}</div>;
}

function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { active, setActive } = useTabs();
  return (
    <button role="tab" aria-selected={active === value} onClick={() => setActive(value)}>
      {children}
    </button>
  );
}

function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { active } = useTabs();
  return active === value ? <div role="tabpanel">{children}</div> : null;
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
```
Usage reads like the DOM it produces:
```tsx
<Tabs defaultValue="a">
  <Tabs.List>
    <Tabs.Tab value="a">Account</Tabs.Tab>
    <Tabs.Tab value="b">Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="a">…</Tabs.Panel>
  <Tabs.Panel value="b">…</Tabs.Panel>
</Tabs>
```
The throwing `useTabs` guard makes misuse a loud error, not a silent bug.

---

## 3. children over render-props

```tsx
// ❌ render-prop callbacks — caller can't see structure, hard to style
<Modal renderHeader={() => <h2>Title</h2>} renderFooter={() => <Buttons/>} />

// ✅ children / slots — JSX is the API
<Modal>
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>…</Modal.Body>
  <Modal.Footer><Buttons/></Modal.Footer>
</Modal>
```
Use render-props only when the child genuinely needs internal state the parent owns (e.g. `<Virtualizer>{(item) => …}</Virtualizer>`).

---

## 4. React 19 — ref is a prop, drop forwardRef

```tsx
// ❌ React 18 ceremony
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => <input ref={ref} {...props} />);

// ✅ React 19 — ref is a normal prop
function Input({ ref, ...props }: Props & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```
Also React 19: `<Context value>` directly (no `.Provider`), `use()` to read context/promises conditionally, cleanup functions returned from refs.

---

## 5. Slot / asChild pattern (polymorphism without prop explosion)

Let a component render *as* its child instead of adding `as`/`href`/`to` variants:
```tsx
// <Button asChild> renders its child element with button styles/behavior merged in
<Button asChild>
  <Link href="/pricing">Pricing</Link>
</Button>
```
Use Radix `Slot` (or equivalent) to merge props/refs onto the single child. Avoids `<Button as="a">` union-type sprawl and keeps one styling source.

---

## 6. Controlled / uncontrolled — support both

```tsx
function Toggle({ checked: controlled, defaultChecked = false, onChange }: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = controlled !== undefined;
  const checked = isControlled ? controlled : internal;

  const toggle = () => {
    if (!isControlled) setInternal(!checked);
    onChange?.(!checked);
  };
  return <button role="switch" aria-checked={checked} onClick={toggle} />;
}
```
Controlled (`checked` + `onChange`) for form integration; uncontrolled (`defaultChecked`) for simple cases. Never silently switch modes.

---

## 7. Context provider + state lifting

- Lift state to the **lowest common ancestor** of the components that need it — not to the root by default.
- Provider owns state + exposes a stable API; split state/dispatch contexts if consumers differ (see `react-patterns` §1).
- A provider that wraps the whole app for state that 2 siblings share = over-lifting.

---

## Decision flow

```
New / growing component
  ├─ Adding 3rd boolean? .................. → compound or slots
  ├─ Parts that belong together (Select)? . → compound + Context
  ├─ Caller needs to inject markup? ....... → children, not renderX
  ├─ Need polymorphic element? ............ → asChild / Slot
  ├─ Form field? .......................... → controlled+uncontrolled
  └─ Shared state across subtree? ......... → Context at lowest ancestor
```

---

## Checklist

- [ ] No component with 5+ boolean props
- [ ] Related parts composed (compound), not configured (booleans)
- [ ] `children`/slots instead of `renderHeader`/`renderFooter`
- [ ] React 19 `ref` as prop (no `forwardRef`)
- [ ] Compound sub-components guard their context (throw if used outside)
- [ ] Form components support controlled + uncontrolled
- [ ] State lifted to lowest common ancestor, not root

---

## Related skills

- `frontend` — director; invokes this for component API design
- `react-patterns` — performance/correctness of the same components
- `component-system` — the spec/contract (variants, states) these components implement
- `tailwind` — styling the parts (use `cva` for variants, not booleans)

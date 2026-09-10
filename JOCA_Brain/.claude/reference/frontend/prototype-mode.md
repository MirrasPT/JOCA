Part of the `frontend` skill — loaded on-demand when the mode is Prototype (no existing React repo).

## #8 Prototype mode (single-file)

When no React project exists:
```html
<script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
  // React inline -- opens with file://
</script>
```
- Never `const styles = {...}` without unique names (`heroStyles`, `cardStyles`)
- Multiple babel scripts don't share scope -- export via `Object.assign(window, {...})`

Prototype is the director's own territory (fast, no build) — specialists kick in for production repos.

# React Email — templates (reference — read by `transactional-email`)

> Moved from `skills/react-email.md` (F4.2, email group merge). Owner skill: `transactional-email` — sending, providers and deliverability live there; this file is the authoring layer (build the template, render client-safe HTML).

Reality check: **email ≠ web.** No flexbox/grid reliance, no external CSS, no JS. Tables, inline styles, px units, web-safe fallbacks. React Email's components abstract the table soup but the constraints remain.

## Contents
- [1. Setup](#1-setup)
- [2. Core components](#2-core-components)
- [3. Template skeleton](#3-template-skeleton)
- [4. Client-safe rules](#4-client-safe-rules-non-negotiable)
- [5. Responsive](#5-responsive)
- [6. Dark mode](#6-dark-mode)
- [7. Test workflow](#7-test-workflow)
- [Checklist](#checklist)
- [Static HTML email (no build)](#static-html-email-no-build--colável-num-esp--gws)

---

## 1. Setup

```bash
npm i @react-email/components @react-email/render
npm i -D react-email          # dev preview server
```
```bash
npx react-email dev           # live preview at localhost:3000 (./emails dir)
```

```tsx
import { render } from "@react-email/render";
const html = await render(<WelcomeEmail name="Alice" />);          // for sending
const text = await render(<WelcomeEmail name="Alice" />, { plainText: true });
```

Sending the rendered `html`/`text` (Resend or Postmark): `skills/transactional-email.md` §Send integration.

---

## 2. Core components

```tsx
import {
  Html, Head, Preview, Body, Container, Section, Row, Column,
  Heading, Text, Button, Link, Img, Hr, Font,
} from "@react-email/components";
```

| Component | Role | Note |
|-----------|------|------|
| `Html` `Head` `Body` | Document shell | `Body` carries base bg + font |
| `Preview` | Inbox preview text | First thing after `Head`; 40–90 chars |
| `Container` | Centered max-width wrapper | ~600px standard email width |
| `Section` / `Row` / `Column` | Table-based layout | Use instead of div+flex |
| `Heading` `Text` `Link` | Typography | `Text` for all body copy |
| `Button` | CTA | Renders bulletproof (padding via style, not height) |
| `Img` | Images | Always `width`+`height`+`alt` |
| `Hr` | Divider | |
| `Font` | Web font + fallback | Falls back gracefully in Outlook |

---

## 3. Template skeleton

```tsx
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Button, Img, Hr } from "@react-email/components";

interface WelcomeEmailProps { name: string; ctaUrl: string; }

export default function WelcomeEmail({ name, ctaUrl }: WelcomeEmailProps) {
  return (
    <Html lang="pt">
      <Head />
      <Preview>Bem-vindo — a tua conta está pronta</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src="https://cdn.example.com/logo.png" width="120" height="36" alt="Marca" />
          <Section style={{ padding: "24px 0" }}>
            <Heading style={h1}>Olá {name}</Heading>
            <Text style={text}>A tua conta está ativa. Começa por aqui.</Text>
            <Button href={ctaUrl} style={button}>Abrir dashboard</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Enviado por Marca · <Link href="https://example.com/unsubscribe">cancelar</Link></Text>
        </Container>
      </Body>
    </Html>
  );
}

// Style objects — inline, plain CSS values, px units
const main = { backgroundColor: "#f4f4f5", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" };
const container = { maxWidth: "600px", margin: "0 auto", padding: "24px", backgroundColor: "#ffffff" };
const h1 = { fontSize: "24px", fontWeight: 700, color: "#18181b", margin: "0 0 12px" };
const text = { fontSize: "16px", lineHeight: "24px", color: "#3f3f46" };
const button = { backgroundColor: "#2563eb", color: "#ffffff", fontSize: "16px", fontWeight: 600,
  textDecoration: "none", padding: "12px 24px", borderRadius: "6px", display: "inline-block" };
const hr = { borderColor: "#e4e4e7", margin: "24px 0" };
const footer = { fontSize: "12px", color: "#a1a1aa" };
```

---

## 4. Client-safe rules (non-negotiable)

| Do | Don't |
|----|-------|
| Inline `style={{}}` objects | External / `<style>` CSS (Gmail strips much of it) |
| `Section`/`Row`/`Column` (tables) | `display:flex` / `grid` for layout structure |
| `px` units | `rem`/`em` (inconsistent across clients) |
| Web-safe font stack + `Font` fallback | Single custom font with no fallback (Outlook ignores) |
| Hex colors | `oklch`/`hsl` (patchy support) |
| `width`+`height`+`alt` on every `Img` | Background images as sole content (Outlook drops them) |
| Single column ≤600px, stack on mobile | Multi-column that can't reflow |
| Absolute https URLs for images/links | Relative paths |
| Bulletproof `Button` (padding-based) | `<a>` styled as button with fixed height |

- **Outlook (Word engine):** no border-radius on some elements, no `max-width` on tables reliably → use fixed `width` on `Container`, accept square corners as fallback.
- **Always provide plain-text version** (`render(..., { plainText: true })`) — deliverability + accessibility.

---

## 5. Responsive

Email responsiveness is mobile-stack, not media-query-heavy (many clients ignore `@media`):
```tsx
// Columns that stack on narrow clients
<Row>
  <Column style={{ width: "50%", verticalAlign: "top" }}>…</Column>
  <Column style={{ width: "50%", verticalAlign: "top" }}>…</Column>
</Row>
```
- Keep to one primary column ≤600px; side-by-side only for simple 2-up that degrades acceptably.
- Tap targets ≥44px (CTA padding).
- Font ≥14px body, ≥16px preferred.

---

## 6. Dark mode

Limited + inconsistent (Apple Mail/Outlook auto-invert, Gmail partial).
```tsx
<Head>
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
</Head>
```
- Don't rely on dark mode; design a light template that survives auto-inversion.
- Logos: provide a version readable on both (transparent PNG with adequate contrast, or padding around mark).
- Avoid pure `#000`/`#fff` blocks that invert harshly.

---

## 7. Test workflow

1. `npx react-email dev` — live preview while building.
2. Render + send a test to a real inbox; check **Gmail, Apple Mail, Outlook** (the three that matter).
3. Verify: preview text shows, images load with alt fallback, CTA tappable, plain-text reads cleanly, links absolute.
4. Run through a client-rendering test (Litmus/Email on Acid style) for high-volume sends.

---

## Checklist

- [ ] `Preview` text set (40–90 chars)
- [ ] All styles inline; no external/`<style>` CSS for layout
- [ ] Layout via `Section`/`Row`/`Column`, not flex/grid
- [ ] px units, hex colors, web-safe font stack + fallback
- [ ] Every `Img` has width/height/alt; URLs absolute https
- [ ] Single ≤600px column; degrades on mobile
- [ ] Plain-text version generated
- [ ] Unsubscribe + sender identity in footer
- [ ] Tested in Gmail + Apple Mail + Outlook

---

## Static HTML email (no build — colável num ESP / `gws`)

Quando o entregável é um `.html` **enviável** sem toolchain (cold-reach, newsletter colada num ESP, anexo de `gws +send`), **não** uses os componentes React (precisam de build/render). HTML **table-based** à mão, com as MESMAS regras client-safe da secção 4:

- Layout só com `<table role="presentation" cellpadding="0" cellspacing="0" border="0">` (nunca flex/grid); coluna única ≤600px centrada.
- **Todo o CSS inline** (`style="..."`); zero `<style>`/CSS externo para layout. px + hex + font-stack web-safe.
- **MSO conditionals** para Outlook (`<!--[if mso]> … <![endif]-->`) — botões VML e larguras fixas.
- `<img>` sempre com `width`/`height`/`alt` e **URL absoluto https**; alojar imagens com `?v=N` (cache-bust — ver gotcha Cloudflare na skill `cpanel`).
- Pré-visualizar via Chrome `--headless --screenshot` antes de enviar; gerar versão plain-text.
- Enviar: `( cd <pasta> && gws gmail +send ... --body "$(cat email.html)" --html -a <anexo-no-cwd> )` (os anexos do `gws` têm de estar no cwd).

> Regra: React Email = React/`.tsx` (precisa de build). Para HTML estático colável → este esqueleto table-based. Mesmas regras client-safe, output diferente.

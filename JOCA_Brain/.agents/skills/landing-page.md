---
name: landing-page
description: "End-to-end landing page creation — structure, conversion copy, and HTML scaffold. MUST be invoked when the user says: landing page, create landing page, build landing page, lead gen page, squeeze page, opt-in page, webinar registration, product launch page. SHOULD also invoke when: single page offer, ad landing page, pagina de captura, pagina de conversao."
triggers: landing page, create landing page, build landing page, lead gen page, squeeze page, opt-in page, webinar registration, product launch page, single page offer, ad landing page, pagina de captura, pagina de conversao
---

# Landing Page Builder

Creates high-converting landing pages — structure, copy, optional HTML scaffold. One page, one action, max conversion.

## Before Building

Check for product marketing context: `.agents/product-marketing-context.md`.

Gather what's missing:

**Offer**
- What's offered? (product, free trial, lead magnet, webinar, demo, waitlist)
- Primary CTA — target visitor action?
- Value prop — core benefit in one sentence?

**Audience**
- Target audience?
- Traffic source? (ads, email, organic, social)
- Awareness level?

**Proof**
- Social proof available? (testimonials, logos, user counts, results)
- Key objections?

**Technical**
- HTML/CSS or copy for builder (Webflow, Framer, Carrd)?
- Mobile-first required?

---

## Landing Page Anatomy

```
[ABOVE THE FOLD]
├── Navigation (minimal or removed)
├── Headline — core value proposition
├── Subheadline — expands headline, adds specificity
├── Hero visual — product screenshot, illustration, or video
├── Primary CTA — button with action + outcome copy
└── Trust signal bar — logos, review stars, user count

[BELOW THE FOLD]
├── Problem section — articulate their pain
├── Solution section — your approach, not features
├── Benefits section — 3-5 key outcomes (icon + headline + 1 line)
├── Social proof — testimonials with photo + name + title
├── How it works — 3-4 steps, reduce perceived effort
├── Objection handling — FAQ or comparison table
├── Final CTA section — restate value + repeat CTA + risk reversal
└── Footer (minimal)
```

---

## Headline Formulas

Highest-leverage element (27-104% conversion lift from optimization).

**Outcome-focused:**
`[Achieve X] without [Pain Y]`
`[Verb] your [outcome] in [timeframe]`

**Identity-based:**
`The [category] for [specific audience]`
`Built for [role] who [situation]`

**Problem-led:**
`Tired of [specific frustration]?`
`Stop [doing painful thing]. Do this instead.`

**Social proof-led:**
`How [N] [role]s [achieved outcome]`
`Join [N]+ [audience type] who [benefit]`

**Contrarian:**
`Why [common approach] doesn't work — and what does`

Rules:
- Specific beats generic
- Single-stat heroes lift +18% over generic
- Video heroes underperform text heroes on average (-7%)
- Avoid "welcome to," "introducing," "we are"

---

## CTA Copy

**Weak:** Submit, Sign Up, Learn More, Get Started, Click Here
**Strong:** Action verb + what they get + optional qualifier

Formulas:
- `Start My Free [Thing]`
- `Get the [Specific Asset]`
- `Book My [Demo/Call/Tour]`
- `Try [Product] Free for [Duration]`
- `Create My [First Thing]`

Rules:
- First-person CTAs ("My" vs "Your") outperform by up to 90%
- Sticky-bottom CTAs lift +11% vs control
- Above-fold CTA + sticky = +12%
- One primary CTA per page — never split attention

---

## Social Proof Hierarchy (by lift)

| Type | Conversion Lift | Placement |
|------|:---:|---|
| Named customer count with context | +22% | Above fold |
| Video testimonial | +80% over text-only | Mid-page |
| Single testimonial card (with photo) | +14% | Near CTA |
| Logo strip | +8% | Above fold bar |
| Star rating with count | +12% | Near primary CTA |
| Generic "trusted by thousands" | ~0% | Avoid |

Rules:
- Must be specific — "Used by 8 of the Fortune 50" beats "trusted by top companies"
- Place near CTAs — social proof before CTA button converts best
- Use real photos — stock photos kill credibility
- Show company logo + person name + role in every testimonial

---

## Page Types and Structures

### Lead Generation (Lead Magnet / Free Resource)

```
Headline: [Get/Download] [Specific Resource] [Optional qualifier]
Subheadline: Who it's for + what they'll get + how fast
Opt-in form: Name + Email only (more fields = lower conversion)
CTA: "Send Me the [Resource]"
Below: What's inside (3-5 bullets) + 1-2 testimonials + "No spam" line
```

### Product/Trial (SaaS, App)

```
Headline: Outcome the product delivers
Subheadline: How + for whom + key differentiator
CTA: "Start Free Trial" (no CC required if applicable)
Social proof bar: logos + user count
Problem → Solution sections
Benefits with screenshots
Objection FAQ
Final CTA + risk reversal ("Cancel anytime," "No setup fees")
```

### Webinar/Event Registration

```
Headline: What they'll learn / walk away with
Event details: Date, time, duration, format (bold and visible)
Speaker credibility: Photo + name + 1-line credential
Bullet list: 3-5 specific takeaways
Registration form: Name + Email (+ optional phone for high-ticket)
FOMO: "X spots remaining" or "Recording available for 48 hours"
```

### Paid Ad Landing Page

Copy must mirror the ad (message match).

Rules:
- Remove main site navigation (lifts conversions)
- Headline must match the ad promise exactly
- Single CTA, no exit links
- Mobile-first: form above fold on mobile

---

## Trust Signals Checklist

- [ ] Social proof (logos, counts, testimonials, reviews)
- [ ] Security badges (SSL, payment provider logos, SOC 2 if applicable)
- [ ] Guarantee / risk reversal ("30-day money back," "Cancel anytime," "No credit card required")
- [ ] Press mentions (if credible and recent)
- [ ] Awards / certifications (if verifiable)
- [ ] Named founder or team (human face reduces anxiety)
- [ ] Real testimonials with photos, names, roles

---

## HTML Scaffold (Optional)

If user needs working HTML, generate a single-file landing page:

```html
<header class="nav-minimal"><!-- Logo + CTA only, no full nav --></header>
<section class="hero"><!-- Headline + sub + CTA + trust bar --></section>
<section class="problem"><!-- Pain articulation --></section>
<section class="solution"><!-- Your approach --></section>
<section class="benefits"><!-- 3-5 benefits grid --></section>
<section class="social-proof"><!-- Testimonials + logos --></section>
<section class="how-it-works"><!-- 3-4 steps --></section>
<section class="faq"><!-- Objection handling --></section>
<section class="final-cta"><!-- Repeat CTA + risk reversal --></section>
<footer class="minimal"><!-- Legal + minimal links --></footer>
```

Style guidance:
- 1 primary brand color for CTAs only
- High contrast CTA button — stands out from everything
- Max width 960-1200px, centered content
- Mobile-first breakpoints
- System fonts or Google Fonts (1 typeface, 2 weights max)

---

## Pre-Launch Checklist

- [ ] Page has ONE primary CTA — no competing actions
- [ ] Headline communicates value in <8 words
- [ ] Above-fold visible on mobile without scrolling
- [ ] CTA copy is specific (not "Submit" or "Sign Up")
- [ ] Social proof is specific and near the CTA
- [ ] Navigation removed or minimized
- [ ] UTM parameters ready for all traffic sources
- [ ] Tracking pixel / GA4 event on conversion
- [ ] Page speed <3 seconds (test with PageSpeed Insights)
- [ ] "No spam" or privacy note near email form

---

## Output Format

Deliver in sections:

1. **Page strategy** — goal, audience, traffic source, key message
2. **Full page copy** — every section, headline to footer
3. **CTA options** — 3 variations with rationale
4. **Social proof brief** — what to gather if not yet available
5. **HTML scaffold** (if requested) — single file, ready to customize

---

## Related Skills

- `copywriting` — copy-only (no structure design)
- `page-cro` — analyse and optimize an existing page
- `lead-capture` — opt-in form and lead magnet strategy
- `email-sequence` — post-conversion sequence
- `paid-ads` — driving traffic to the page
- `ab-test-setup` — testing headline and CTA variants

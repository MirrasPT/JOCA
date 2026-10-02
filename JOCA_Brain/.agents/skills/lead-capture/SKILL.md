---
name: lead-capture
description: "Email list building — lead magnet ideation (3-5 concepts with hook and bridge to the paid offer), opt-in forms, popup triggers, delivery workflows, and list segmentation. MUST be invoked when the user says: lead magnet, grow email list, opt-in form, email capture, popup strategy, content upgrade, build my list, email signup, what should I give away for free. SHOULD also invoke when: newsletter growth, lead generation, checklist download, free guide, free template, subscriber growth, free audit offer, top of funnel ideas."
triggers: lead magnet, grow email list, opt-in form, email capture, popup strategy, content upgrade, build my list, email signup, newsletter growth, lead generation, checklist download, free guide, free template, subscriber growth, freebie ideas, opt-in ideas, top of funnel, free audit, capturar leads, lista de email, crescer lista, oferta gratuita, isco digital
chain: landing-page, email-sequence, analytics-tracking
---

# Lead Capture

Build email lists through lead magnets that lead to the paid offer, opt-in forms, and popups. Capture the right subscribers with minimal friction and maximum relevance.

## Before Starting

**Check the brand profile first:**
If a marketeer brand profile exists (`clientes/<slug>/marca.md` under the marketeer workspace — see `.claude/marketeer/CONTRATO.md`), read it first; otherwise ask the 3-5 questions this skill needs.

Gather what the profile does not answer:
1. **Paid offer** — what is eventually sold, and at what price? (the lead magnet is step 1 of it)
2. **Business type** — services (agency, consultancy, professional, local business), SaaS, info product, e-commerce.
3. **Audience** — target segment, the problem they have *now*, what they already tried.
4. **Current state** — list size, existing opt-in forms, email tool (Kit, Mailchimp, ActiveCampaign, Brevo, Klaviyo).
5. **Site tech and resources** — WordPress, Webflow, custom? Popup/form tool? Who builds the asset, and how many hours per lead can they spend (audits cost time per lead)?

**Numbers rule:** no conversion rates or benchmarks without a source and date. Use the client's own data (GA4, ESP) or write `[unverified]`.

---

## Phase 1: Lead Magnet Ideation

### The output: 3-5 distinct concepts

Every business has several valid approaches; deliver options, not one answer. Each concept has:
- **Concept** — what it is, in one sentence
- **Format** — quiz, PDF, checklist, calculator, challenge, audit, template, swipe file…
- **Hook** — the headline/promise that makes someone give their email
- **Bridge** — how consuming it leads to wanting the paid offer
- **Implementation** — difficulty (low/medium/high), what is needed, who builds it

Close with **Recommended starting point:** which concept to test first and why.

### The three principles

1. **Specificity** — narrow beats broad. Specific outcome, timeframe, audience and method ("5-step checklist to pass the energy certificate inspection, for Porto landlords" beats "Real-estate tips"). Test: could a competitor claim exactly the same thing? Then get more specific.
2. **Bridge** — the lead magnet is **step 1 of what you sell**. An agency that sells SEO offers a mini SEO audit, not an Instagram guide. If the bridge is not obvious, the list fills with the wrong people.
3. **Quick win** — solves one specific problem completely, fast (minutes, not weeks). A teaser that needs the paid product to be useful breaks trust.

**Value check (Hormozi's value equation):** Value = (Dream outcome × Perceived likelihood) / (Time delay × Effort). Push outcome and likelihood up; time and effort down.

### Format by business type

| Business type | Formats that fit | Why |
|---|---|---|
| **Services** (agencies, consultancies, local/professional services) | Free audit · diagnostic assessment · case study · ROI/savings calculator · strategy session | Reveals the problems the service fixes, using the prospect's own data |
| **SaaS / tools** | Free tool or constrained version · ROI calculator · templates that work with the product · implementation checklist | Shows the product's value before the trial |
| **Info products** (courses, coaching) | Quiz/assessment · 5-7 day challenge · PDF framework · free module | Demonstrates the teaching style; segments by result |
| **E-commerce / local retail** | Buying guide · fit/size quiz · first-order offer · seasonal checklist | Lowers purchase risk |

### The free audit (services workhorse)

The audit **is** the sales conversation:
- **Before:** qualify (do not audit everyone), set expectations, collect access/data.
- **During:** consistent method, specific findings, prioritised by impact, quick wins and strategic items.
- **Report:** summary → findings → comparison with competitors → recommendations → next step (one CTA).
- **After:** review call, walk through findings, move to proposal.
High-touch magnets (audits, sessions) cost time per lead; match them to the client's capacity and customer value.

**Qualification:** high-intent magnets (audit request, consultation, solution-specific content) → immediate personal follow-up; low-intent (general guides, broad reports) → automated nurture (`email-sequence`).

### Hook types

| Type | Pattern |
|---|---|
| Shortcut | Get [outcome] without [usual pain/time/effort] |
| Secret | The [hidden thing] behind [result] — only if the result is real and sourced |
| System | The [named method] for [specific outcome] |
| Number | [N] [things] to [outcome] |
| Assessment | Discover your [type/score/level] in [time] |
| Transformation | From [current state] to [desired state] |
| Case study | How [real client] achieved [real result] — with permission and source |

Hooks use only facts the client can prove (approved facts in the brand profile). No invented results, testimonials or numbers. For the persuasion levers behind each hook (reciprocity, loss aversion, social proof…) and their ethical limits, see `mkt-psicologia`.

### The test (before delivering)

1. **Specific?** Vague magnets fail.
2. **Solves one problem completely?** Not a teaser.
3. **Bridge obvious?** Consuming it should create the wish for the paid offer.
4. **Would the audience actually want this now?** Not "should want".
5. **Feasible** with the client's resources and time?

This phase delivers the **concept**. Writing the asset, the landing page (`landing-page`), the sequence (`email-sequence`) and the visuals are separate steps.

---

## Phase 2: Opt-In Form

### Form Field Rules

| Fields | Use When |
|--------|---|
| Email only | Priority is volume |
| Name + Email | Personalisation needed |
| Name + Email + 1 segmentation Q | Segmentation priority |
| 3+ fields | Only for high-intent offers (audit, consultation, free tool) |

Every extra field costs conversions. Only ask for data you will use.

### Consent (EU / Portugal)
- Newsletter/marketing needs its **own unticked opt-in**, separate from the contact form; record proof server-side (`gdpr-compliance` §4).
- Email marketing in Portugal falls under Lei 41/2004 (electronic communications) as well as the GDPR — confirm the current rules before sending [unverified: check the legal text in force].
- Delivering the lead magnet does not by itself authorise future marketing emails; the opt-in text must say what they will receive.

### CTA Copy

Weak: "Subscribe," "Sign Up," "Submit"
Strong: "Send Me the [Specific Thing]," "Get My Free [Checklist/Template]," "Book My Free Audit"

### Privacy Micro-copy

Place below the submit button:
- "No spam. Unsubscribe anytime."
- Link to the privacy policy.
- Social proof only with a real, current number ("Join [N]+ [audience]") — never an estimate.

---

## Phase 3: Popup & Trigger Strategy

### Popup Types

| Type | Trigger | Best For |
|------|---------|----------|
| Exit-intent | Cursor moves toward close | Recovering abandoning visitors |
| Scroll-based | After 50-70% of content | Engaged readers |
| Time-based | 30-60 seconds on page | General capture |
| Content upgrade | Inline, within specific post | Highest relevance |
| Sticky bar | Persistent top/bottom bar | Lightweight, always visible |
| Welcome mat | First visit, homepage | High-priority list building |

**Multi-step popup:** Step 1 = low-commitment yes/no ("Want the checklist?"), Step 2 = email form. Test it against single-step on the client's own traffic (`ab-test-setup`).

**Never show:** popup on page load, popup to existing subscribers, popup more than once per session, popup before the cookie banner is answered.

### Popup Tools

| Tool | Best For |
|------|----------|
| ConvertBox | SaaS/content, advanced targeting |
| Sumo | E-commerce, WordPress |
| Privy | E-commerce, Shopify native |
| Hello Bar | Simple sticky bars |
| Mailchimp Popup | Mailchimp users |

Free tiers and prices change — check the vendor page before recommending.

---

## Phase 4: Delivery, Tracking & Segmentation

### Delivery Timeline

```
[Signup] → Immediately: confirmation + lead magnet delivery email
         → Day 1: "Did you get it?" follow-up (if not opened)
         → Day 2: first email of the welcome/nurture sequence → email-sequence skill
```

### Tracking
Every successful signup fires the house lead event: `generate_lead` with `formulario: '<lead-magnet-slug>'` (house standard shared with the marketeer pack; the brand's tracking plan wins if it already uses another name), only after the server/ESP answers 2xx (`analytics-tracking`). Same trigger feeds Meta `Lead` / Google Ads conversion if ads run (`paid-ads`).

### Segmentation Tags at Signup

| Signal | Tag Example |
|--------|-------------|
| Lead magnet topic | `lm:seo-checklist`, `lm:email-template` |
| Traffic source | `src:paid`, `src:organic`, `src:social` (from UTM) |
| Page they converted on | `page:pricing`, `page:blog-seo` |
| Self-selected interest | `interest:social`, `interest:email` |
| Engagement level | `engaged:yes` (opened + clicked delivery email) |

### Platform Patterns

**Kit:** Tags (not lists) for everything. One subscriber, many tags. Never create a new list per lead magnet.

**Mailchimp:** Groups + tags. Groups for broad categories, tags for behavioural signals.

**ActiveCampaign:** Tags + lists. Lists for broad segments, tags for granular behaviour. Automation triggers from tag applied.

**Klaviyo:** Segment-first. Create smart segments from properties.

---

## Phase 5: List Health & Growth

### Key Metrics

Track these on the client's own data; set targets from their baseline, not from generic benchmarks.

| Metric | Action if it drops |
|--------|---|
| Opt-in rate (landing page) | A/B test the lead magnet offer or CTA |
| Opt-in rate (popup) | Test trigger timing or offer |
| Delivery email open rate | Check subject line, deliverability (SPF/DKIM/DMARC) |
| List growth rate (monthly) | Add more capture points |
| Unsubscribe rate | Segment better, reduce frequency |

### Capture Point Placement (priority order)

1. Homepage hero (if the lead magnet fits the homepage audience)
2. Blog posts (content upgrade per topic)
3. High-traffic organic landing pages
4. Exit-intent popup on relevant pages
5. Dedicated landing page (`/free-[resource-name]`)
6. Social media bio links
7. Google Business Profile posts (local businesses)
8. Guest posts / PR mentions

---

## Hand-off to email-sequence

```
→ Event: generate_lead (formulario: <lead-magnet-slug>)
→ Tag: [lead magnet topic]
→ Tag: [traffic source]
→ Sequence: welcome → nurture (see email-sequence skill)
→ First offer: only after the value emails (see email-sequence "When to start selling")
```

---

## Output Format

1. **Lead magnet options** — 3-5 concepts (concept, format, hook, bridge, implementation) + recommended starting point
2. **Opt-in form copy** — headline, CTA button, consent text, privacy micro-copy, 3 variations
3. **Popup strategy** — trigger types, timing, placement
4. **Delivery workflow** — step-by-step automation in their email platform, with the `generate_lead` event
5. **Segmentation map** — tags to apply + when
6. **Growth plan** — capture point placement, priority order

In a `/marketeer` cycle, return this output to the caller (the `marketeer` orchestrator / `mkt-estrategia`) — do not write into `02-proposta.md` or any other cycle file; each section of that file has a single owner (`.claude/marketeer/CONTRATO.md` §6).

---

## Next step (chain)

- Concept approved → `landing-page` (opt-in page) and `email-sequence` (welcome sequence).
- Form ready → `analytics-tracking` (verify `generate_lead`) and `gdpr-compliance` (consent proof).

## Related Skills

- `landing-page` — dedicated opt-in page design
- `email-sequence` — nurture sequences post-capture
- `page-cro` — optimise conversion on pages with forms
- `copywriting` — opt-in copy refinement
- `ab-test-setup` — test lead magnets and form variants
- `analytics-tracking` — measure opt-in conversion (`generate_lead`)
- `gdpr-compliance` — consent on forms, proof in the database
- `mkt-psicologia` — persuasion levers and their ethical limits (marketeer pack)

## Credits

Phase 1 (ideation output, specificity/bridge/quick-win principles, value equation, formats by business type, free audit model, hook types, the test) adapted from the local reference skill `lead-magnet` (`SKILL.md` + `references/services-magnets.md`), collected in `_referencias de skill da net/` (2026-10-01). Its unsourced conversion rates were not imported.

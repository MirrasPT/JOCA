---
name: lead-capture
description: "Email list building — lead magnets, opt-in forms, popup triggers, delivery workflows, and list segmentation. MUST be invoked when the user says: lead magnet, grow email list, opt-in form, email capture, popup strategy, content upgrade, build my list, email signup. SHOULD also invoke when: newsletter growth, lead generation, checklist download, free guide, free template, subscriber growth."
triggers: lead magnet, grow email list, opt-in form, email capture, popup strategy, content upgrade, build my list, email signup, newsletter growth, lead generation, checklist download, free guide, free template, subscriber growth, capturar leads, lista de email, crescer lista
---

# Lead Capture

Build email lists through high-converting lead magnets, opt-in forms, and popup strategies. Capture the right subscribers with minimal friction and maximum relevance.

## Before Starting

Check for product marketing context: `.agents/product-marketing-context.md`.

Gather:
1. **Goal** — newsletter, pre-launch waitlist, or nurture-to-sale?
2. **Audience** — target segment and active problem they face.
3. **Current state** — list size, existing opt-in forms.
4. **Platform** — email tool (Kit, Mailchimp, ActiveCampaign, Brevo).
5. **Site tech** — WordPress, Webflow, custom? Popup/form tool available?

---

## Phase 1: Lead Magnet Design

### What Converts

Short-form content (checklists, toolkits, templates) outperforms long-form 58.6% of the time. Best lead magnets:

- Solve ONE specific problem fast (under 10 min to consume)
- Deliver an immediate "aha" result
- Connect directly to what you sell

Strategic lead magnets: 5-15% opt-in vs. 1.95% without.

### Lead Magnet Types by Conversion Rate

| Type | Best For | Conversion |
|------|----------|:---:|
| Checklist / cheat sheet | Quick reference, saves time | High |
| Template (ready-to-use) | Saves effort, immediate value | High |
| Email mini-course (5-7 days) | Builds relationship + nurture | High |
| Free tool / calculator | High utility, often shared | Very high |
| Exclusive case study | Demonstrates results | Medium-High |
| PDF guide / ebook | Broad awareness | Medium |
| Webinar / free training | High-ticket, complex topics | Medium |
| Quiz with personalized results | Segmentation + engagement | High |
| Waitlist + early access | Pre-launch momentum | Depends |

### Selection Framework

Answer 3 questions:

1. **What's the #1 question my audience asks before needing my product?**
   The lead magnet answers that.

2. **What should they do next after consuming it?**
   The lead magnet leads to that step.

3. **Can someone see results in under 15 minutes?**
   If no, simplify.

**Title formula:** `[Action] [Specific Outcome] [Qualifier]`
- "The 5-Minute SEO Checklist for SaaS Founders"
- "30-Day Email Welcome Sequence Template (Copy-Paste Ready)"
- "The Landing Page Headline Formula That Lifted Conversions 40%"

---

## Phase 2: Opt-In Form Optimization

### Form Field Rules

| Fields | Avg. Conversion | Use When |
|--------|:---:|---|
| Email only | Highest | Priority is volume |
| Name + Email | Standard | Personalization needed |
| Name + Email + 1 segmentation Q | Medium | Segmentation priority |
| 3+ fields | Lowest | Only for high-intent (webinar, free tool) |

Every extra field costs conversions. Only ask for data you will use to personalize.

### CTA Copy

Weak: "Subscribe," "Sign Up," "Submit"
Strong: "Send Me the [Specific Thing]," "Get My Free [Checklist/Template]," "Join the Waitlist"

First-person ("Me/My") outperforms second-person ("You/Your") by up to 90%.

### Privacy Micro-copy

Place below the submit button:
- "No spam. Unsubscribe anytime."
- "Your data is safe. We never share it."
- "Join [N]+ [audience] already on the list."

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

**Multi-step popup:** Step 1 = low-commitment yes/no ("Want the checklist?") then Step 2 = email form. Multi-step averages 5.17% conversion, outperforming single-step by 12%.

### Trigger Timing

| Trigger | Timing | Why |
|---------|--------|-----|
| Time-based | 30+ seconds | Visitor has read enough to care |
| Scroll-based | 50-70% depth | Proven engaged reader |
| Exit-intent | Cursor leaves viewport | Last chance, high intent |
| Page-specific | Only on relevant content | Content upgrade match |

**Never show:** popup on page load, popup to existing subscribers, popup more than once per session.

### Popup Tools

| Tool | Best For | Free Tier |
|------|----------|:---------:|
| ConvertBox | SaaS/content, advanced targeting | No |
| Sumo | E-commerce, WordPress | Yes |
| Privy | E-commerce, Shopify native | Yes |
| Hello Bar | Simple sticky bars | Yes |
| Mailchimp Popup | Mailchimp users | Yes |

---

## Phase 4: Delivery & Segmentation

### Delivery Timeline

```
[Signup] → Immediate (within 5 min): Confirmation + lead magnet delivery email
         → Day 1: "Did you get it?" follow-up (if no open)
         → Day 2: First email of nurture sequence → email-sequence skill
```

Deliver within 5 minutes. Delays kill trust and open rates.

### Segmentation Tags at Signup

| Signal | Tag Example |
|--------|-------------|
| Lead magnet topic | `lm:seo-checklist`, `lm:email-template` |
| Traffic source | `src:paid`, `src:organic`, `src:social` |
| Page they converted on | `page:pricing`, `page:blog-seo` |
| Self-selected interest | `interest:social`, `interest:email` |
| Engagement level | `engaged:yes` (opened + clicked delivery email) |

### Platform Patterns

**Kit:** Tags (not lists) for everything. One subscriber, many tags. Never create a new list per lead magnet.

**Mailchimp:** Groups + tags. Groups for broad categories, tags for behavioral signals.

**ActiveCampaign:** Tags + lists. Lists for broad segments, tags for granular behavior. Automation triggers from tag applied.

**Klaviyo:** Segment-first. Create smart segments from properties. No manual list management needed.

---

## Phase 5: List Health & Growth

### Key Metrics

| Metric | Benchmark | Action if Below |
|--------|:---------:|---|
| Opt-in rate (landing page) | 5-15% | A/B test lead magnet offer or CTA |
| Opt-in rate (popup) | 2-6% | Test trigger timing or offer |
| Delivery email open rate | 60-80% | Check subject line, deliverability |
| List growth rate (monthly) | >5% | Add more capture points |
| Unsubscribe rate | <0.5% | Segment better, reduce frequency |

### Capture Point Placement (priority order)

1. Homepage hero (if lead magnet fits homepage audience)
2. Blog posts (content upgrade per topic)
3. High-traffic organic landing pages
4. Exit-intent popup on all pages
5. Dedicated landing page (`/free-[resource-name]`)
6. Social media bio links (Linktree or direct)
7. Podcast show notes
8. Guest posts / PR mentions

---

## Transactional Upsell Triggers (Bridge to email-sequence)

After confirming the subscriber, hand off to `email-sequence`:

```
→ Trigger: signup_confirmed
→ Tag: [lead magnet topic]
→ Tag: [traffic source]
→ Sequence: lead-nurture (see email-sequence skill)
→ Upsell window: email 4-7 in nurture (after value delivered)
```

---

## Output Format

1. **Lead magnet recommendation** — type, title, format, 3 title options
2. **Opt-in form copy** — headline, CTA button, privacy micro-copy, 3 variations
3. **Popup strategy** — trigger types, timing, placement
4. **Delivery workflow** — step-by-step automation in their email platform
5. **Segmentation map** — tags to apply + when
6. **Growth plan** — capture point placement, priority order

---

## Related Skills

- `landing-page` — dedicated opt-in page design
- `email-sequence` — nurture sequences post-capture
- `page-cro` — optimize conversion on pages with forms
- `copywriting` — opt-in copy refinement
- `ab-test-setup` — test lead magnets and form variants
- `analytics-tracking` — measure opt-in conversion rate

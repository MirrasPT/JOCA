---
name: paid-ads
description: "Use when the user needs anything related to paid advertising — campaign strategy, audience targeting, budgets, bidding, ad copy generation, headline iterations, creative testing, or performance optimization. Triggers: 'run ads', 'ad campaign', 'Facebook ads', 'Google ads', 'LinkedIn ads', 'TikTok ads', 'ad copy', 'ad creative', 'ROAS', 'CPA', 'PPC', 'paid media', 'retargeting', 'write me some ads', 'generate headlines', 'RSA headlines', 'ad variations', 'ad spend', 'should I run ads'."
metadata:
  version: 1.0.0
  merged_from: [ad-creative v1.1.0, paid-ads v1.2.0]
---

# Ads Creation

Expert in paid advertising — from campaign strategy and targeting to ad copy generation and performance optimization. Covers the full cycle: plan → create → launch → iterate.

## Before Starting

Check for product marketing context first: if `.agents/product-marketing-context.md` exists, read it before asking questions.

Gather context not already covered:

**Campaign**
- Platform(s)? (Google, Meta, LinkedIn, TikTok, Twitter/X)
- Objective? (Awareness / traffic / leads / sales)
- Budget (monthly/weekly) and target CPA or ROAS?

**Product & Offer**
- What are you promoting? What's the core value proposition?
- Landing page URL?

**Audience**
- Who's the ideal customer? What pain points drive them?
- Existing customer data for lookalikes?

**Current State**
- Running ads already? What's working/failing?
- Conversion tracking set up?
- Performance data to iterate on?

---

## Platform Selection

| Platform | Best For | Use When |
|----------|----------|----------|
| **Google Ads** | High-intent search | People actively search for your solution |
| **Meta** | Demand generation, visual products | Creating demand, strong creative assets |
| **LinkedIn** | B2B, decision-makers | Job title/company targeting, higher price points |
| **TikTok** | Younger demographics, video | Audience skews 18-34, video capacity |
| **Twitter/X** | Tech audiences, thought leadership | Audience active on X, timely content |

---

## Campaign Structure

```
Account
├── Campaign: [Objective] — [Audience/Product]
│   ├── Ad Set: [Targeting variation]
│   │   ├── Ad A: [Creative variation]
│   │   └── Ad B: [Creative variation]
│   └── Ad Set: [Targeting variation]
```

**Naming convention:**
`[PLATFORM]_[Objective]_[Audience]_[Offer]_[Date]`
Example: `META_Conv_Lookalike-Customers_FreeTrial_2024Q1`

**Budget allocation:**
- Testing phase: 70% proven / 30% new audiences or creative
- Scaling: consolidate into winners, increase 20-30% at a time, wait 3-5 days between increases

---

## Ad Copy Generation

### Step 1: Define Angles (3-5 distinct reasons to click)

| Angle | Example |
|-------|---------|
| Pain point | "Stop wasting time on X" |
| Outcome | "Achieve Y in Z days" |
| Social proof | "Join 10,000+ teams who..." |
| Curiosity | "The X secret top companies use" |
| Comparison | "Unlike X, we do Y" |
| Urgency | "Limited time: get X free" |
| Identity | "Built for [specific role]" |
| Contrarian | "Why [common practice] doesn't work" |

### Step 2: Generate Variations per Angle

Vary: word choice, specificity (numbers vs general), tone (direct/question/command), structure (short punch vs full benefit).

### Step 3: Validate Against Platform Specs

**Google Ads (RSA)**

| Element | Limit | Qty |
|---------|-------|-----|
| Headline | 30 chars | up to 15 |
| Description | 90 chars | up to 4 |
| URL path | 15 chars each | 2 |

RSA rules: headlines must work independently and in any combination. Include at least 1 keyword headline + 1 benefit headline + 1 CTA headline.

**Meta (Facebook/Instagram)**

| Element | Limit |
|---------|-------|
| Primary text | 125 chars visible (2,200 max) — front-load the hook |
| Headline | 40 chars recommended |
| Description | 30 chars recommended |

**LinkedIn**

| Element | Limit |
|---------|-------|
| Intro text | 150 chars recommended (600 max) |
| Headline | 70 chars recommended (200 max) |

**TikTok**: Ad text 80 chars recommended (100 max).
**Twitter/X**: Tweet 280 chars / Headline 70 chars.

### Step 4: Output Format

```
## Angle: [Pain Point — Manual Reporting]

### Headlines (30 char max)
1. "Stop Building Reports by Hand" (29)
2. "Automate Your Weekly Reports" (28)
3. "Reports in 5 Min, Not 5 Hrs" (27)

### Descriptions (90 char max)
1. "Save 10+ hours/week with automated reporting. Start free." (57)
2. "Connect data sources once. Reports forever. No code needed." (59)
```

For 10+ variations, offer CSV format for direct upload.

---

## Copy Frameworks

**Problem-Agitate-Solve (PAS):**
[Problem] → [Agitate the pain] → [Introduce solution] → [CTA]

**Before-After-Bridge (BAB):**
[Current painful state] → [Desired future state] → [Your product as bridge]

**Social Proof Lead:**
[Impressive stat or testimonial] → [What you do] → [CTA]

**Strong headlines:** specific numbers, benefit over feature, active voice, genuine urgency.
**Avoid:** vague superlatives ("best", "leading"), all caps, clickbait the landing page can't deliver.

---

## Creative Best Practices

**Image ads:** product screenshots with UI, before/after, bold readable text (<20% of image), real faces over stock.

**Video ads (15-30 sec):**
1. Hook (0-3s) — pattern interrupt or bold statement
2. Problem (3-8s) — relatable pain point
3. Solution (8-20s) — show product/benefit
4. CTA (20-30s) — clear next step

Always add captions (85% watch without sound). Vertical for Stories/Reels, square for feed.

**Creative testing hierarchy:** concept/angle → hook/headline → visual style → body copy → CTA.

---

## Iterating from Performance Data

1. **Analyze winners** — winning themes, structures, word patterns
2. **Analyze losers** — angles that fall flat, patterns in underperformers
3. **Generate new variations** — double down on winners, test 1-2 new angles, retire losing patterns
4. **Document iteration:**

```
## Iteration Log
- Round: [n] | Date: [date]
- Top performers: [list + metrics]
- Winning patterns: [summary]
- New variations: [count]
- New angles tested: [list]
- Angles retired: [list]
```

Allow 1,000+ impressions before judging creative. Change one variable per test cycle.

---

## Audience Targeting

**Platform strengths:**
- Google → keywords, search intent
- Meta → interests, behaviors, lookalikes
- LinkedIn → job titles, companies, industries

**Key principles:**
- Lookalikes: base on best customers by LTV, not all customers
- Retargeting: segment by funnel stage
- Exclusions: always exclude existing customers and recent converters

**Retargeting windows:**

| Stage | Window | Frequency |
|-------|--------|-----------|
| Hot (cart/trial) | 1-7 days | Higher OK |
| Warm (key pages) | 7-30 days | 3-5x/week |
| Cold (any visit) | 30-90 days | 1-2x/week |

---

## Optimization

**Key metrics by objective:**

| Objective | Primary Metrics |
|-----------|-----------------|
| Awareness | CPM, reach, video view rate |
| Consideration | CTR, CPC, time on site |
| Conversion | CPA, ROAS, conversion rate |

**If CPA too high:** check landing page → tighten audience → new creative angles → improve relevance score → adjust bid strategy.
**If CTR low:** new hooks/angles → refine targeting → refresh creative (fatigue).
**If CPM high:** expand audience → try different placements → improve creative fit.

**Bid strategy progression:** manual/cost caps → gather 50+ conversions → switch to automated → monitor and adjust.

---

## Pre-Launch Checklist

- [ ] Conversion tracking tested with real conversion
- [ ] Landing page loads <3 sec and is mobile-friendly
- [ ] UTM parameters working
- [ ] Budget set correctly
- [ ] Targeting matches intended audience
- [ ] At least 3 creative variations per ad set
- [ ] Exclusions configured (existing customers, recent converters)

---

## Common Mistakes

- Launching without conversion tracking
- Too many campaigns (fragmenting budget)
- RSA headlines that only work together
- Ignoring character limits (platforms truncate without warning)
- All variations sound the same (vary angles, not just words)
- Overlapping audiences competing against each other
- Making big budget changes (disrupts algorithm learning)
- Retiring creative too early (<1,000 impressions)

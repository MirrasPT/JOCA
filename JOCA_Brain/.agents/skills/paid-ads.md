---
name: paid-ads
description: "Paid advertising — campaign strategy, audience targeting, budgets, bidding, ad copy, headline iterations, creative testing. MUST be invoked when the user says: run ads, ad campaign, Facebook ads, Google ads, LinkedIn ads, TikTok ads."
metadata:
  version: 1.0.0
  merged_from: [ad-creative v1.1.0, paid-ads v1.2.0]
---

# Ads Creation

Paid advertising expert covering plan, create, launch, iterate.

## Before Starting

If `.agents/product-marketing-context.md` exists, read it first.

Gather missing context:

**Campaign**
- Platform(s)? (Google, Meta, LinkedIn, TikTok, Twitter/X)
- Objective? (Awareness / traffic / leads / sales)
- Budget and target CPA or ROAS?

**Product & Offer**
- What's promoted? Core value prop?
- Landing page URL?

**Audience**
- Ideal customer? Pain points?
- Existing data for lookalikes?

**Current State**
- Running ads? What works/fails?
- Conversion tracking active?
- Performance data available?

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

**Naming:** `[PLATFORM]_[Objective]_[Audience]_[Offer]_[Date]`
Example: `META_Conv_Lookalike-Customers_FreeTrial_2024Q1`

**Budget allocation:**
- Testing: 70% proven / 30% new audiences or creative
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

RSA rules: headlines must work independently and in any combination. Include 1 keyword headline + 1 benefit headline + 1 CTA headline minimum.

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
[Problem] -> [Agitate the pain] -> [Introduce solution] -> [CTA]

**Before-After-Bridge (BAB):**
[Current painful state] -> [Desired future state] -> [Your product as bridge]

**Social Proof Lead:**
[Impressive stat or testimonial] -> [What you do] -> [CTA]

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

Add captions (85% watch without sound). Vertical for Stories/Reels, square for feed.

**Creative testing hierarchy:** concept/angle, then hook/headline, then visual style, then body copy, then CTA.

---

## Iterating from Performance Data

1. **Analyze winners** — winning themes, structures, word patterns
2. **Analyze losers** — flat angles, patterns in underperformers
3. **Generate new variations** — double down on winners, test 1-2 new angles, retire losers
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

Wait for 1,000+ impressions before judging creative. Change one variable per test cycle.

---

## Audience Targeting

**Platform strengths:**
- Google: keywords, search intent
- Meta: interests, behaviors, lookalikes
- LinkedIn: job titles, companies, industries

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

**CPA too high:** check landing page, tighten audience, new creative angles, improve relevance score, adjust bid strategy.
**CTR low:** new hooks/angles, refine targeting, refresh creative (fatigue).
**CPM high:** expand audience, try different placements, improve creative fit.

**Bid strategy progression:** manual/cost caps, gather 50+ conversions, switch to automated, monitor and adjust.

---

## Pre-Launch Checklist

- [ ] Conversion tracking tested with real conversion
- [ ] Landing page loads <3s, mobile-friendly
- [ ] UTM parameters working
- [ ] Budget set correctly
- [ ] Targeting matches intended audience
- [ ] 3+ creative variations per ad set
- [ ] Exclusions configured (existing customers, recent converters)

---

## Tracking Setup (Before Launching)

Ads without conversion tracking waste budget. Set up before creating any campaign.

### Meta Pixel + Conversion API

**Setup:**
1. Create pixel in Events Manager, Business Settings, Data Sources
2. Install via GTM (preferred) or direct code
3. Verify with Meta Pixel Helper extension

**Required standard events:**
- `PageView` — all pages (automatic with base code)
- `ViewContent` — product/service pages
- `Lead` — form submission, trial signup, demo request
- `Purchase` — completed purchase
- `CompleteRegistration` — account creation

**Conversion API (CAPI) — required 2025+:**
- Browser-only tracking loses 20-40% of events (iOS privacy, ad blockers)
- CAPI sends server-side events to supplement browser events
- Deduplication: include `event_id` in both browser and server events

**Implementation options:**
- GTM + Meta CAPI Gateway (no-code)
- Shopify native integration (automatic)
- Laravel: send via Meta Graph API from `purchase_completed` event listener
- Node.js: `facebook-nodejs-business-sdk` package

### Google Ads Conversion Tracking

1. Create conversion action in Google Ads, Goals, Conversions
2. Install via GTM: Google Ads Conversion Tracking tag
3. Test with Google Tag Assistant

**Enhanced Conversions (required for Smart Bidding accuracy):**
- Hashes first-party data (email, name, phone) client-side
- Sends with conversion event for better attribution
- Configure in GTM with user-provided data variable

---

## AI Campaign Types (2025+)

### Meta Advantage+

- Single campaign handles prospecting + retargeting automatically
- Provide 5-10 creative variations; algorithm handles targeting
- Let run 7-14 days before judging
- Still set budget caps and geographic exclusions

### Google Performance Max (PMax)

- Single campaign across Search, Display, Shopping, YouTube, Discover, Gmail
- Requires: 15 headlines, 5 descriptions, 5 images, 1 video (or Google generates)
- Asset group = targeting unit (replaces ad sets)
- Audience signals = suggestions, not restrictions
- Use search term reports to feed negative keywords

### When NOT to use AI campaigns

- Budget under $3,000/month (insufficient data for algorithm)
- Highly regulated industries (may lose placement control)
- Brand-specific targeting needed (use standard campaigns + brand exclusions)

---

## Common Mistakes

- Launching without conversion tracking
- Too many campaigns (fragmenting budget)
- RSA headlines that only work together
- Ignoring character limits (platforms truncate silently)
- All variations sound the same (vary angles, not just words)
- Overlapping audiences competing against each other
- Big budget changes (disrupts algorithm learning)
- Retiring creative too early (<1,000 impressions)
- No CAPI setup (losing 20-40% conversion data)
- Judging Advantage+/PMax before 7-14 day learning period

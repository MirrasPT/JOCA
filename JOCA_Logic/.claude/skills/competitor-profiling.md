---
name: competitor-profiling
description: When the user wants to research, profile, or analyze competitors from their URLs. Also use when the user mentions "competitor profile," "competitor research," "competitor analysis," "profile this competitor," "analyze competitor," "competitive intelligence," "competitor deep dive," "who are my competitors," "competitor landscape," "competitor dossier," "competitive audit," or "research these competitors." Input is a list of competitor URLs. Output is structured competitor profile markdown files.
metadata:
  version: 1.0.0
---

# Competitor Profiling

You are an expert competitive intelligence analyst. Your goal is to take a list of competitor URLs and produce comprehensive, structured competitor profile documents by combining live site scraping with available market data.

**Nota JOCA:** Esta skill usa Firecrawl MCP (disponível) para scraping e WebSearch para dados de mercado. DataForSEO não está disponível — para análise SEO profunda, usar o agente `deep-research`.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md` in older setups), read it before asking questions. Use that context and only ask for information not already covered.

Before profiling, confirm:

1. **Competitor URLs** — the list of competitor website URLs to profile
2. **Your product** — what you do (if not in product marketing context)
3. **Depth level** — quick scan (key facts only) or deep profile (full research)
4. **Focus areas** — any specific dimensions to prioritize (e.g., pricing, positioning, content strategy)

If the user provides URLs and context is available, proceed without asking.

---

## Core Principles

### 1. Facts Over Opinions
Every claim in a profile should be traceable to a source. Label inferences clearly.

### 2. Structured and Comparable
All profiles follow the same template so they can be compared side by side.

### 3. Current Data
Profiles are snapshots. Always include the date generated.

### 4. Honest Assessment
Don't exaggerate competitor weaknesses or downplay their strengths.

---

## Directory Layout

```
competitor-profiles/
├── raw/
│   └── <competitor-slug>/
│       └── <YYYY-MM-DD>/
│           ├── scrapes/    # one .md file per scraped page
│           └── search/     # search results for market data
├── <competitor-slug>.md    # final synthesized profile
└── _summary.md             # cross-competitor summary
```

---

## Research Process

### Phase 1: Site Scraping (Firecrawl)

For each competitor URL, scrape key pages to extract positioning, features, pricing, and messaging.

#### Step 1: Map the site

```
firecrawl_map → competitor URL
```

From the map, identify and prioritize:
- Homepage
- Pricing page
- Features / product pages
- About / company page
- Blog (top-level)
- Customers / case studies page
- Integrations page
- Changelog / what's new

#### Step 2: Scrape key pages

```
firecrawl_scrape → each key page URL
```

Save each result to `competitor-profiles/raw/<competitor-slug>/<YYYY-MM-DD>/scrapes/<page-name>.md`.

Extract from each page:

| Page | What to Extract |
|------|----------------|
| **Homepage** | Headline, subheadline, value proposition, primary CTA, social proof claims, target audience signals |
| **Pricing** | Tiers, prices, feature breakdown per tier, billing options, free tier/trial details |
| **Features** | Feature categories, key capabilities, how they describe each feature |
| **About** | Founding story, team size, funding, mission statement |
| **Customers** | Named customers, logos, industries served, case study themes |
| **Integrations** | Integration count, key integrations, categories |
| **Changelog** | Release velocity, recent focus areas, product direction |

#### Step 3: Scrape competitor reviews (optional, high-value)

Use Firecrawl to scrape:
- G2 reviews page
- Capterra reviews page
- Product Hunt launch page

Extract: overall rating, review count, common praise themes, common complaint themes, 3-5 representative quotes.

---

### Phase 2: Market Data (WebSearch)

Use WebSearch to gather publicly available competitive intelligence. Save results to `competitor-profiles/raw/<competitor-slug>/<YYYY-MM-DD>/search/`.

**Searches to run:**
```
"[CompanyName] funding raised crunchbase"
"[CompanyName] team size employees"
"[CompanyName] vs [YourProduct] alternatives"
"[CompanyName] review G2 OR Capterra"
"[CompanyName] organic traffic semrush OR similarweb"
"[CompanyName] backlinks referring domains"
```

**Estimate organic traffic** from publicly available SimilarWeb or SEMrush previews in search results.

**For deep SEO analysis:** spawn `deep-research` agent with competitor domain + "SEO analysis backlinks organic keywords".

---

### Phase 3: Synthesis

Combine scraped content with market data to build the profile. Cross-reference claims (e.g., if they claim "10,000 customers" on site, check if their traffic profile supports that scale).

---

## Output Format

**Filename**: `competitor-profiles/[competitor-name].md`

```markdown
# [Competitor Name] — Competitor Profile

**URL**: [website]
**Generated**: [date]
**Depth**: [quick scan / deep profile]

---

## At a Glance

| Metric | Value |
|--------|-------|
| Tagline | [from homepage] |
| Founded | [year] |
| Headquarters | [location] |
| Team size | [estimate] |
| Funding | [if known] |
| Est. organic traffic | [monthly, from WebSearch] |

---

## Positioning & Messaging

**Primary value proposition**: [headline + subheadline from homepage]

**Target audience**: [who they're speaking to, based on copy analysis]

**Positioning angle**: [e.g., "simplicity-first," "enterprise-grade," "all-in-one"]

**Key messaging themes**:
- [theme 1 — with source page]
- [theme 2]
- [theme 3]

---

## Product & Features

### Core capabilities
- [capability 1] — [brief description]
- [capability 2]

### Notable differentiators
- [what they emphasize as unique]

### Integrations
- [count] integrations
- Key: [list top 5-10]

### Product direction signals
- [based on changelog / recent releases]

---

## Pricing

| Tier | Price | Key Inclusions |
|------|-------|---------------|
| [Free/Starter] | [price] | [what's included] |
| [Pro/Growth] | [price] | [what's included] |
| [Enterprise] | [price] | [what's included] |

**Billing**: [monthly/annual, annual discount?]
**Free trial**: [yes/no, duration]

---

## Customers & Social Proof

**Named customers**: [notable logos]
**Industries**: [primary industries]
**Review ratings**:
- G2: [rating] ([count] reviews)
- Capterra: [rating] ([count] reviews)

---

## Content Strategy Signals

- Blog post frequency: [estimate]
- Primary content types: [guides, comparisons, templates, etc.]
- Content focus areas: [topics they invest in]

---

## Strengths & Weaknesses

### Strengths
- [strength 1 — with evidence source]

### Weaknesses
- [weakness 1 — with evidence source]

---

## Competitive Implications for [Your Product]

**Where they're strong vs. us**: [areas where this competitor has an advantage]

**Where we're strong vs. them**: [areas where you have an advantage]

**Opportunities**: [gaps in their offering or positioning we can exploit]

**Threats**: [areas where they're improving or gaining ground]

---

## Raw Data Sources

- Homepage scraped: [date]
- Pricing page scraped: [date]
- Market data pulled: [date, sources]
```

---

### Summary Document

After profiling all competitors, generate `competitor-profiles/_summary.md`:

1. **Competitor landscape overview** — one paragraph
2. **Comparison table** — key metrics side by side
3. **Positioning map** — where each competitor sits (e.g., simple↔complex, cheap↔premium)
4. **Key takeaways** — 3-5 strategic observations
5. **Gaps and opportunities** — where the market is underserved

---

## Quick Scan vs. Deep Profile

### Quick Scan
- Scrape: homepage + pricing page only
- Market data: 2-3 WebSearch queries
- Output: abbreviated profile (At a Glance + Positioning + Pricing)

### Deep Profile
- Scrape: all key pages + review sites
- Market data: full WebSearch battery + optional deep-research agent for SEO
- Output: full profile template

**Default to quick scan** unless the user requests deep profiling or specifies a small number of competitors (3 or fewer).

---

## Handling Multiple Competitors

1. **Parallelize scraping** — scrape all competitors' homepages simultaneously, then pricing pages
2. **Use consistent metrics** — same searches for every competitor
3. **Build the summary last** — after all individual profiles are complete
4. **Prioritize by relevance** — if 10+ competitors, profile top 5 first

---

## Task-Specific Questions

Only ask if not answered by context or input:

1. What competitor URLs should I profile?
2. Quick scan or deep profile?
3. Any specific dimensions to focus on?
4. Should I compare findings against your product?

---

## Related Skills

- **content-strategy**: For using competitor content gaps to plan your own content
- **seo**: For auditing your own site relative to competitors
- **paid-ads**: For analyzing competitor ad strategies
- **brand-positioning**: For turning competitive intel into positioning decisions

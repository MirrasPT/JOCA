---
name: seo
description: SEO specialist — technical audits, on-page optimization, AI search visibility (AEO/GEO/LLMO), local SEO (GBP, NAP, citations), international SEO, ranking recovery. Triggers: SEO audit, technical SEO, why not ranking, traffic dropped, lost rankings, crawl errors, Core Web Vitals, hreflang, AI SEO, AEO, GEO, LLMO, AI Overviews, optimize for ChatGPT, optimize for Perplexity, on-page SEO, meta tags, local SEO, Google Business Profile, GBP, map pack, local pack, citations, NAP, local rankings, service area, multi-location.
metadata:
  version: 2.0.0
---

CONTEXT: check `.agents/product-marketing-context.md` or `.claude/product-marketing-context.md` first.

## Audit Priority Order
1. Crawlability & indexation · 2. Technical foundations · 3. On-page · 4. Content quality · 5. Authority/links

## Technical Checklist
- `robots.txt` no unintentional blocks, sitemap referenced · XML sitemap submitted to GSC, canonical + indexable URLs only
- `site:domain.com` count vs expected · GSC Coverage: noindex on important pages, wrong canonicals, soft 404s, redirect chains
- Canonicalization: self-referencing, HTTPS, www/non-www, trailing slash consistency
- Core Web Vitals: LCP < 2.5s · INP < 200ms · CLS < 0.1 · check TTFB, image opt, JS execution, CDN, caching, fonts
- Mobile-friendly, HTTPS, no mixed content · important pages ≤3 clicks · no orphan pages · no crawl traps

## On-Page
- Title: primary keyword near front, ≤60 chars · Meta description: benefit + CTA, ≤155 chars
- H1: one per page, includes primary keyword · heading hierarchy logical
- E-E-A-T signals · keyword in first 100 words · FAQ schema for question-type queries

## AI Search (AEO/GEO/LLMO)
- Structured data: FAQ, HowTo, Article, Product, LocalBusiness schema
- Concise factual answers in first paragraph (AI snippets need direct answers)
- Consistent brand descriptions across web · authoritative backlinks from sources AI cites

## Local SEO
Key 2026 signals: GBP (32%) · proximity (55.2%) · reviews (~20%) · ChatGPT local conversion 15.9% vs organic 1.76%

GBP ENFORCE: complete all fields · precise primary category · all service areas · post weekly · respond to all reviews ≤24h · seed Q&A with FAQs · fresh photos monthly

NAP: exact match across GBP, website footer, all citations. Audit: `[name] site:yelp.com`, `site:yellowpages.com`.
Citations priority: Tier 1 (Yelp, YP, Bing Places, Apple Maps) → Tier 2 (industry dirs) → Tier 3 (local dirs)
Schema: LocalBusiness `@type`, `name`, `address`, `telephone`, `openingHours`, `geo`, `areaServed`. SAB: use `areaServed` not `address`.
Reviews: velocity matters (consistent > spike) · respond to negatives professionally · never incentivize
Multi-location: unique landing page + unique GBP per location · `sameAs` linking between them

NEVER: keyword stuff · duplicate content across location pages · buy links · ignore CWV · inconsistent NAP · fake reviews

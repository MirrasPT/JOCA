---
name: shopify-store-audit
description: "Use when auditing a public Shopify store across 8 dimensions: trust & credibility, conversion optimisation, page speed (Core Web Vitals), technical SEO, product-page SEO, structured data, AEO (Answer Engine Optimisation), and GEO (Generative Engine Optimisation for AI citations)."
compatibility: "Read-only. Works with any public Shopify store. No API credentials required for public audit; Admin API required for detailed data."
---

# Shopify Store Audit

## When to use

- Auditing a public Shopify store URL
- Pre-launch checklist for a new store
- Competitive analysis of a competitor's store
- Identifying conversion, SEO, or AEO/GEO gaps

**Read-only.** Use `shopify-store-fixer` to implement changes.

## Inputs required

- Public store URL (e.g. `https://example.myshopify.com` or custom domain).
- Audit scope: full (all 8 modules) or specific modules.

## Procedure

Run all 8 modules. Flag each finding as **Critical** / **Warning** / **Info**.

### Module 1 — Trust & Credibility

Check:
- Logo and favicon present and high-quality
- Contact page with real email/phone/address
- About page (brand story, team, mission)
- Branded email (not @gmail.com/@hotmail.com)
- Legal pages: Privacy Policy, Terms of Service, Returns Policy, Shipping Policy
- SSL active (HTTPS)
- Social proof: reviews, ratings, testimonials visible on homepage/PDPs

### Module 2 — Conversion

Check:
- Hero section: clear value proposition, prominent CTA
- Cart type: slide-out preferred over redirect-to-cart for low friction
- Cross-sells / upsells on PDP and cart
- Size charts, fit guides where relevant
- Shipping info and estimated delivery visible on PDP
- Reviews visible on PDP (app: Judge.me, Okendo, Loox, or native)
- Urgency/scarcity signals (if used: must be honest)
- Mobile checkout flow: no friction, Apple/Google Pay enabled

### Module 3 — Page Speed (Core Web Vitals)

Use PageSpeed API or `shopify theme profile`:
- LCP (Largest Contentful Paint) < 2.5s
- CLS (Cumulative Layout Shift) < 0.1
- INP (Interaction to Next Paint) < 200ms
- Count third-party scripts (each adds ~50-200ms)
- Check hero image: format (WebP/AVIF), size, lazy-load disabled for LCP element
- Check render-blocking resources

### Module 4 — Technical SEO

Check:
- `robots.txt` accessible and not blocking crawlers
- XML sitemap present at `/sitemap.xml`
- Canonical tags on all pages (Shopify handles most automatically)
- No duplicate content from pagination without canonicals
- Internal linking: collections → products, blog → products
- Crawl errors via URL inspection

### Module 5 — Product-Page SEO

Check (per key product page):
- Title tag: keyword-rich, unique, 50-60 chars
- Meta description: benefit-led, 150-160 chars
- H1: product name with key modifier
- Product description: 150+ words, covers use cases, materials, care
- Image alt text: descriptive, includes product name + colour/variant
- URL: clean, lowercase, hyphenated

### Module 6 — Structured Data

Check:
- `Product` schema with `Offer` (price, availability, currency)
- `AggregateRating` if reviews present
- Merchant listing eligibility (Google Shopping via Search Console)
- Review markup valid (no manual inflation)
- Test with Google Rich Results Test

### Module 7 — AEO (Answer Engine Optimisation)

Check:
- FAQ sections on key pages (answering purchase-intent questions)
- Policy pages clear and scannable (returns, shipping, warranty)
- "How it works" / explainer content for complex products
- Content answers common questions AI assistants receive about the category

### Module 8 — GEO (Generative Engine Optimisation)

Check:
- AI crawlers not blocked in `robots.txt`:
  - GPTBot, Claude-Web, Google-Extended, PerplexityBot, FacebookBot
- Brand mentioned on high-authority third-party sites (citations)
- About/brand page: clear entity signals (founded year, location, mission)
- Content extractable as plain text (avoid text-in-images)
- Structured data helps AI understand product/brand context

## Output format

```
STORE AUDIT — [store URL]
Generated: [date]

## Summary
[3-line executive summary: biggest wins, critical gaps]

## Module 1 — Trust & Credibility
[CRITICAL] Missing returns policy page
[WARNING]  Contact page has no phone number
[INFO]     About page present but no team photos

[... repeat for all 8 modules ...]

## Priority fixes
1. [Critical fix 1]
2. [Critical fix 2]
3. [Warning fix 1]
```

## Escalation

- To implement fixes: use `shopify-store-fixer` (requires Admin API access)
- For deep technical SEO: use `seo` skill
- For AEO/GEO content strategy: use `content-strategy` skill

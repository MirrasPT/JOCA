---
name: seo
description: "Use for anything SEO — technical audit, on-page optimization, AI search visibility (AEO/GEO/LLMO), international SEO, or ranking recovery. Triggers: 'SEO audit', 'technical SEO', 'why am I not ranking', 'traffic dropped', 'lost rankings', 'crawl errors', 'core web vitals', 'hreflang', 'AI SEO', 'AEO', 'GEO', 'LLMO', 'AI Overviews', 'optimize for ChatGPT', 'optimize for Perplexity', 'AI citations', 'show up in AI answers', 'on-page SEO', 'meta tags', 'SEO health check'."
metadata:
  version: 1.0.0
  merged_from: [ai-seo v1.2.0, seo-audit v1.2.0]
---

# SEO

Expert in search engine optimization — both traditional (technical + on-page) and AI search (AEO, GEO, LLMO). Covers audits, fixes, content optimization, international SEO, and AI visibility.

## Before Starting

Check for product marketing context first: `.agents/product-marketing-context.md` or `.claude/product-marketing-context.md`.

Gather context:
- Site type? (SaaS, e-commerce, blog, docs)
- Business goal for SEO?
- Key queries/keywords?
- Current organic traffic? Recent drops or migrations?
- Access to Search Console / analytics?
- AI search: do you know if your brand appears in ChatGPT, Perplexity, or Google AI Overviews?

**Se o utilizador fornece uma URL real:** antes de dar recomendações, lançar `seo-analyst` para obter dados reais do site — evita recomendações baseadas em suposições:

```
Agent(subagent_type="seo-analyst", prompt="Technical SEO audit for [URL]. Depth: quick scan. Focus on: title tags, meta descriptions, H1s, canonical URLs, robots.txt, sitemap.xml, Core Web Vitals estimate, schema markup. Report prioritized findings so the SEO skill can make evidence-based recommendations.")
```

Aguardar o relatório do `seo-analyst` e incorporar os dados reais nas recomendações desta skill. Se o relatório identificar issues críticos, priorizá-los acima de recomendações genéricas.

---

## Part 1 — Traditional SEO Audit

### Audit Priority Order
1. Crawlability & indexation (can Google find and index it?)
2. Technical foundations (fast and functional?)
3. On-page optimization (content optimized?)
4. Content quality (does it deserve to rank?)
5. Authority & links (does it have credibility?)

### Crawlability

- `robots.txt` — no unintentional blocks, sitemap referenced
- XML sitemap — exists, submitted to GSC, canonical + indexable URLs only
- Site architecture — important pages within 3 clicks, no orphan pages
- No crawl traps (infinite scroll, session IDs in URLs, unchecked faceted nav)

### Indexation

- `site:domain.com` check vs. expected
- GSC Coverage report — noindex on important pages, canonicals pointing wrong direction, soft 404s, redirect chains
- Canonicalization — self-referencing canonicals, HTTPS consistency, www/non-www, trailing slash

### Site Speed & Core Web Vitals

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s |
| INP (Interaction to Next Paint) | < 200ms |
| CLS (Cumulative Layout Shift) | < 0.1 |

Check: TTFB, image optimization, JS execution, CSS delivery, caching, CDN, fonts.
Tools: PageSpeed Insights, WebPageTest, GSC Core Web Vitals report.

### Mobile & Security

- Responsive design, tap targets, same content as desktop
- HTTPS sitewide, valid SSL, no mixed content, HTTP → HTTPS redirects

### On-Page

**Title tags:** unique, primary keyword near start, 50-60 chars, compelling.
**Meta descriptions:** unique, 150-160 chars, keyword, CTA.
**Heading structure:** one H1 with primary keyword, logical H1→H2→H3 hierarchy.
**Content:** keyword in first 100 words, satisfies search intent, beats competitors in depth.
**Images:** descriptive filenames, alt text, WebP, lazy loading.
**Internal linking:** important pages well-linked, descriptive anchor text, no orphans.

### Schema Markup Detection

`web_fetch` and `curl` cannot detect JS-injected schema (Yoast, RankMath, AIOSEO inject via `<script>` tags stripped during conversion). Use:
- Browser: `document.querySelectorAll('script[type="application/ld+json"]')`
- Google Rich Results Test
- Screaming Frog (renders JS)

### Common Issues by Site Type

**SaaS:** thin product pages, no comparison/alternative pages, blog not linked to product, no glossary.
**E-commerce:** thin category pages, duplicate product descriptions, missing Product schema, faceted nav creating duplicates.
**Blog:** outdated content, keyword cannibalization, poor topical clustering.
**Local:** inconsistent NAP, missing local schema, no location pages.

---

## Part 2 — International SEO

### Hreflang

Three valid placements: HTML `<link>` in `<head>`, HTTP `Link` headers, XML sitemap `<xhtml:link>`. Must agree — conflicting signals cause Google to drop pairs. For 10+ locales: sitemap-based.

**Required:**
- Self-referencing entry on every page (page must include itself)
- Reciprocal links (if A→B, then B→A — or both ignored)
- Valid codes: ISO 639-1 + optional ISO 3166-1 Alpha 2 (`en`, `en-GB` — never `en-UK`)
- `x-default` pointing to fallback/selector page
- All target URLs return 200, indexable, match canonical URL

**Common errors:** missing self-reference (all hreflang ignored), no return tag (pair dropped), invalid codes, hreflang target is non-canonical or 404, HTML and sitemap annotations disagree.

### Canonicalization for Multilingual Sites

- Each locale self-canonicals (`/ar/page` → `/ar/page`)
- Never cross-locale canonical (French → English kills French indexing)
- Canonical URL must appear in hreflang set — if not, hreflang silently ignored
- Canonical overrides hreflang when they conflict

### Locale URL Structure

**Recommended:** subdirectories (`/en/`, `/ar/`). **Acceptable:** subdomains, ccTLDs. **Avoid:** URL parameters (`?lang=en`).

- All locales consistently prefixed
- No IP/Accept-Language content negotiation (Googlebot uses US IPs, no Accept-Language)
- `x-default` at root with redirect or default locale content

### Content Quality Across Locales

- Translate ALL page content — Google uses visible content to determine language
- AI-translated content not inherently spam, but scaled low-value translations trigger abuse policy
- Don't create locale pages you can't make genuinely helpful — many thin locales suppress strong pages site-wide

---

## Part 3 — AI SEO (AEO / GEO / LLMO)

Getting **cited** in AI-generated answers (Google AI Overviews, ChatGPT, Perplexity, Gemini, Copilot).

**Key difference:** traditional SEO = rank on page 1. AI SEO = get cited even from page 2-3 — AI selects by content quality and structure, not just rank.

**Stats:** AI Overviews appear in ~45% of Google searches. Optimized content cited 3x more. Statistics/citations boost visibility 40%+. Brands 6.5x more likely cited via third-party sources than own domain.

### AI Visibility Audit

Test 10-20 key queries across ChatGPT, Perplexity, and Google AI Overviews:
- "What is [your product category]?"
- "Best [category] for [use case]"
- "[Your brand] vs [competitor]"
- "How to [problem your product solves]"

For each: Are you cited? Who is? Which page?

**Check AI bot access in robots.txt** — if blocked, that platform can't cite you:
- `GPTBot`, `ChatGPT-User` — OpenAI
- `PerplexityBot` — Perplexity
- `ClaudeBot`, `anthropic-ai` — Anthropic
- `Google-Extended` — Gemini + AI Overviews
- `Bingbot` — Copilot

### The Three Pillars

**1. Structure — make content extractable**

AI extracts passages, not pages. Every key claim must work standalone.

- **Definition blocks** for "What is X?" queries
- **Step-by-step blocks** for "How to X" queries
- **Comparison tables** for "X vs Y" queries
- **FAQ blocks** for common questions
- **Statistic blocks** with cited sources

Rules: lead every section with direct answer, keep answer passages 40-60 words, headings match query phrasing, tables beat prose for comparisons.

**2. Authority — make content citable**

Princeton GEO study (KDD 2024, tested on Perplexity):

| Method | Visibility Boost |
|--------|:---------------:|
| Cite sources | +40% |
| Add statistics | +37% |
| Add expert quotations | +30% |
| Authoritative tone | +25% |
| Improve clarity | +20% |
| ~~Keyword stuffing~~ | **-10%** |

Best combo: fluency + statistics. Low-authority sites gain up to 115% with citations.

- Named authors with credentials
- Specific numbers with dated sources
- "Last updated" prominently displayed
- Original data beats aggregated data

**3. Presence — be where AI looks**

- Wikipedia mentions (7.8% of all ChatGPT citations)
- Reddit discussions (1.8%)
- Industry publications, guest posts
- Review sites (G2, Capterra, TrustRadius)
- YouTube (frequently cited in Google AI Overviews)
- Quora answers

### Machine-Readable Files for AI Agents

AI agents evaluate products on behalf of buyers. If pricing is JS-rendered or behind "contact sales," agents skip you.

**`/pricing.md` or `/pricing.txt`:**
```markdown
# Pricing — [Product Name]

## Free
- Price: $0/month
- Limits: 100 emails/month, 1 user
- Features: Basic templates, API access

## Pro
- Price: $29/month (annual) | $35/month (monthly)
- Limits: 10,000 emails/month, 5 users
- Features: Custom domains, analytics, priority support
```

**`/llms.txt`** — context file for AI systems ([llmstxt.org](https://llmstxt.org)): product overview, who it's for, links to key pages including pricing.

### Schema Markup for AI

| Content Type | Schema | Why |
|-------------|--------|-----|
| Articles | `Article`, `BlogPosting` | Author, date, topic |
| How-to | `HowTo` | Step extraction |
| FAQs | `FAQPage` | Direct Q&A extraction |
| Products | `Product` | Pricing, features |
| Comparisons | `ItemList` | Structured comparison |

Content with proper schema shows 30-40% higher AI visibility.

### Content Types That Get Cited Most

| Type | Citation Share |
|------|:------------:|
| Comparison articles | ~33% |
| Definitive guides | ~15% |
| Original research/data | ~12% |
| Best-of/listicles | ~10% |
| Product pages | ~10% |
| How-to guides | ~8% |

**Underperformers:** generic blogs without structure, thin pages with marketing fluff, gated content, undated/unattributed content.

### AI Visibility Monitoring Tools

| Tool | Coverage |
|------|----------|
| Otterly AI | ChatGPT, Perplexity, Google AI Overviews |
| Peec AI | ChatGPT, Gemini, Perplexity, Claude, Copilot |
| ZipTie | Google AI Overviews, ChatGPT, Perplexity |
| LLMrefs | SEO keyword → AI visibility mapping |

---

## Audit Report Format

**Executive Summary** — overall health, top 3-5 issues, quick wins.

**Findings** (technical / on-page / AI / international):
- **Issue:** what's wrong
- **Impact:** High / Medium / Low
- **Evidence:** how found
- **Fix:** specific recommendation
- **Priority:** 1-5

**Action Plan:**
1. Critical (blocking indexation/ranking)
2. High-impact improvements
3. Quick wins
4. Long-term

---

## Common Mistakes

- Ignoring AI search (~45% of Google searches show AI Overviews)
- Treating AI SEO as separate from SEO — traditional SEO is the foundation
- Blocking AI bots in robots.txt — prevents citation
- Hiding pricing behind JS or "contact sales" — AI agents skip you
- No freshness signals — undated content loses to dated content
- Keyword stuffing — actively reduces AI visibility (-10%)
- All hreflang errors: missing self-reference, no return tag, invalid codes, cross-locale canonicals
- Thin locale pages dragging site-wide quality
- Schema detection via `web_fetch` (doesn't render JS — use Rich Results Test instead)
- Retiring content too early without data

---

## Tools

**Free:** Google Search Console, PageSpeed Insights, Rich Results Test, Mobile-Friendly Test, Bing Webmaster Tools.
**Paid:** Screaming Frog, Ahrefs, Semrush, Sitebulb, ContentKing, Otterly/Peec/ZipTie (AI visibility).

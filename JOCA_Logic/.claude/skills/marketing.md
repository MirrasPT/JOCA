---
name: marketing-router
description: "Detects marketing intent and routes to the correct marketing skill. MUST be invoked when the user says: marketing, grow my business, get more customers, marketing plan, marketing strategy, marketing help, where do I start with marketing, what marketing should I do. SHOULD also invoke when: marketing funnel, marketing workflow, plano de marketing, estrategia de marketing, como crescer."
triggers: marketing, grow my business, get more customers, marketing plan, marketing strategy, marketing help, where do I start with marketing, what marketing should I do, marketing funnel, marketing workflow, plano de marketing, estrategia de marketing, como crescer
---

# Marketing Router

Routes marketing tasks to the correct skill based on intent detection.

---

## Detection Matrix

| If user mentions... | Route to |
|---|---|
| positioning, value prop, ICP, differentiation, messaging | `brand-positioning` |
| landing page, lead gen page, opt-in page, squeeze page | `landing-page` |
| lead magnet, grow email list, email capture, popup, content upgrade | `lead-capture` |
| email sequence, drip campaign, welcome email, nurture, onboarding emails | `email-sequence` |
| Facebook ads, Google ads, Meta ads, LinkedIn ads, TikTok ads, PPC | `paid-ads` |
| SEO audit, technical SEO, rankings, organic traffic, keywords, AI SEO | `seo` |
| local SEO, Google Business Profile, local pack, near me | `seo-local` |
| LinkedIn post, Twitter thread, Instagram, TikTok, social media, calendar | `social-content` |
| CRO, conversion rate, this page isn't converting, optimize my page | `page-cro` |
| write copy, landing page copy, headline, CTA copy, homepage copy | `copywriting` |
| content strategy, blog topics, content pillars, what should I write about | `content-strategy` |
| A/B test, split test, experiment, which version is better | `ab-test-setup` |
| analytics, GA4, tracking, GTM, conversion tracking, UTM | `analytics-tracking` |
| launch, Product Hunt, go-to-market, beta launch, feature release | `launch-strategy` |
| competitor, competitive analysis, who are my competitors | `competitor-profiling` |

---

## Funnel-Stage Routing

If user describes a stage rather than a task:

| Stage described | Skills to activate |
|---|---|
| "I need more awareness / traffic" | `seo` + `social-content` + `content-strategy` |
| "I need to capture more leads" | `lead-capture` + `landing-page` |
| "I need to nurture my leads" | `email-sequence` |
| "I need to convert visitors to customers" | `page-cro` + `copywriting` + `ab-test-setup` |
| "I want to run paid ads" | `paid-ads` + `landing-page` |
| "I'm about to launch something" | `launch-strategy` + `email-sequence` + `social-content` |
| "I want to understand my competitors" | `competitor-profiling` + `brand-positioning` |
| "I don't know where to start" | Brand-first protocol (see below) |

---

## "I don't know where to start" Protocol

When the user is overwhelmed or asks for a full marketing plan:

1. Run a 3-question diagnostic:
   - "Do you have a clear value proposition and ICP defined?" → If no: `brand-positioning`
   - "Do you have a way to capture leads / email subscribers?" → If no: `landing-page` + `lead-capture`
   - "Are you currently generating traffic (organic or paid)?" → If no: `seo` OR `paid-ads`

2. Recommend a starting sequence:
   ```
   brand-positioning → landing-page → lead-capture → email-sequence → seo/paid-ads
   ```

3. Tell the user: "I'll activate [skill name] first — this is the bottleneck in your current funnel."

---

## Pipeline: Full Funnel Setup

```
[AWARENESS]
brand-positioning → content-strategy + competitor-profiling
    → seo + social-content + copywriting (create + distribute)

[CAPTURE]
landing-page (receive traffic)
    → lead-capture (convert visitor to subscriber)
        → email-sequence (nurture subscriber)

[CONVERT]
paid-ads (amplify what works)
    → page-cro (optimize for conversion)
    → ab-test-setup (test variants)
    → analytics-tracking (measure everything)

[RETAIN & GROW]
launch-strategy (announce new things)
    → email-sequence (re-engage + upgrade)
```

### AARRR Mapping

| Stage | JOCA Skills |
|---|---|
| **Awareness** | `seo`, `seo-local`, `social-content`, `content-strategy`, `paid-ads` |
| **Acquisition** | `landing-page`, `lead-capture`, `copywriting` |
| **Activation** | `email-sequence` (welcome/onboarding), `page-cro` |
| **Retention** | `email-sequence` (transactional upsell), `ab-test-setup` |
| **Revenue** | `paid-ads`, `launch-strategy`, `email-sequence` (upgrade flows) |
| **Referral** | `social-content`, `brand-positioning` |

---

## Pipeline Suggestions (after completing a skill)

| Completed | Suggest next |
|---|---|
| `brand-positioning` | "→ proximo: `content-strategy` para planear conteudo." |
| `landing-page` | "→ proximo: `lead-capture` para opt-in form + lead magnet." |
| `lead-capture` | "→ proximo: `email-sequence` para nurture sequence." |
| `email-sequence` | "→ proximo: `paid-ads` para trazer mais trafego ao funil." |
| `paid-ads` | "→ proximo: `page-cro` para optimizar conversao." |
| `page-cro` | "→ proximo: `ab-test-setup` para testar variantes." |
| `content-strategy` | "→ proximo: `seo` para garantir que o conteudo posiciona." |
| `seo` | "→ proximo: `analytics-tracking` para medir resultados." |

---

## How to Activate a Skill

```
Read(".claude/skills/SKILL.md")
```

---

## Escalation

If intent is still unclear after detection, ask ONE question:
> "What's the outcome you're trying to achieve — more traffic, more leads, more conversions, or more sales?"

Route based on the answer.

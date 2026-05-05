---
name: performance
description: Paid advertising (campaigns, copy, targeting, optimization) and email sequences (welcome, nurture, onboarding, re-engagement). Use for ad campaigns, copy generation, audience targeting, ROAS/CPA optimization, email automation flows, drip campaigns, lifecycle emails. Triggers: run ads, ad campaign, Facebook ads, Google ads, LinkedIn ads, TikTok ads, ad copy, ROAS, CPA, PPC, paid media, retargeting, RSA headlines, ad creative, email sequence, drip campaign, nurture sequence, onboarding emails, welcome sequence, re-engagement, lifecycle emails, email automation, email funnel.
metadata:
  version: 2.0.0
---

CONTEXT: check `.agents/product-marketing-context.md` or `.claude/product-marketing-context.md` first.

## Paid Ads

GATHER: platform(s) · objective (awareness/traffic/leads/sales) · budget + target CPA or ROAS · landing page URL · ICP + pain points · existing performance data · conversion tracking status

PLATFORM SELECTION:
- Google Search → high intent, active search, B2B + B2C
- Meta (FB/IG) → interest/behavior targeting, visual products, retargeting
- LinkedIn → B2B, job title/company targeting, high CPL acceptable
- TikTok → Gen Z/Millennial, brand awareness, low CPM, creative-heavy
- YouTube → awareness + consideration, visual demos

AD COPY STRUCTURE: Hook (stop the scroll) → Problem/desire → Solution → Social proof → CTA
Headlines: 3-5 variants, test benefit vs feature vs curiosity vs urgency
RSA: 15 headlines + 4 descriptions, pin headline 1 (brand/primary KW), leave 2-3 unpinned for testing

TESTING PRIORITY: audience → offer → creative → copy (test one variable at a time)
BUDGET RULES: minimum 50 conversions/month per ad set for algorithm optimization · start broad, narrow on data · never pause learning phase <7 days

OPTIMIZATION: CPA > target → pause bottom 20% by CPA · CTR < 1% (search) / 0.5% (display) → rewrite copy · ROAS < target → check landing page, audience, offer before bid changes

## Email Sequences

SEQUENCE TYPES: welcome/onboarding · lead nurture · re-engagement · post-purchase · event-based · sales

GATHER: trigger (what puts them in sequence) · what they already know · relationship stage · primary conversion goal

EMAIL STRUCTURE: subject (curiosity gap or clear benefit, ≤50 chars) → preview text (extends subject, ≤90 chars) → hook (first line, no "Hi, I'm...") → one idea → one CTA

SEQUENCE CADENCE:
- Welcome (days 0,1,3,7): deliver promised value → educate → social proof → soft CTA
- Nurture (weekly): problem-aware → solution-aware → product-aware → conversion
- Re-engagement (days 0,3,7,14): re-engage → last chance → unsubscribe or win-back offer

COPY RULES: one email = one idea = one CTA · plain text often outperforms HTML for nurture · PS line gets read more than body · specificity ("87% of customers") > vagueness

ENFORCE: conversion tracking before launching ads · unique UTMs on all ad links · unsubscribe in every email · GDPR/CAN-SPAM compliant · A/B test subject lines on sequences

NEVER: launch ads without conversion tracking · ignore learning phase · keyword-stuff ad copy · send email sequence without unsubscribe · buy email lists

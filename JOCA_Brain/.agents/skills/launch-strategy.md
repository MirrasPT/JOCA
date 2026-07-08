---
name: launch-strategy
description: "Plan a product launch, feature announcement, or release strategy. MUST be invoked when the user says: launch, Product Hunt, feature release, announcement, go-to-market, beta launch,."
metadata:
  version: 1.1.0
---

# Launch Strategy

Expert in SaaS product launches and feature announcements. Plan launches that build momentum, capture attention, and convert interest into users.

## Before Starting

If `.agents/product-marketing-context.md` (or `.claude/product-marketing-context.md`) exists, read it first. Only ask for info not already covered.

---

## Core Philosophy

Strong companies launch repeatedly. Every feature, improvement, and update is a chance to capture attention.

- Get your product into users' hands early
- Learn from real feedback
- Make a splash at every stage
- Build compounding momentum

---

## The ORB Framework

Three channel types. Everything leads back to owned channels.

### Owned Channels
You own the channel (not the audience). Direct access, no algorithms.

**Examples:** Email list, blog, podcast, branded community (Slack, Discord), website/product

**Why:** Compounds over time, no algorithm risk, direct relationship.

**Pick 1-2 based on audience:**
- Lacks quality content → Blog
- Wants direct updates → Email
- Engagement matters → Community

### Rented Channels
Platforms providing visibility you do not control.

**Examples:** Social media (Twitter/X, LinkedIn, Instagram), app stores, YouTube, Reddit

- Pick 1-2 where your audience lives
- Drive traffic to owned channels
- Never rely on them alone

**Platform tactics:**
- Twitter/X: Threads → link to newsletter
- LinkedIn: High-value posts → gated content or email signup
- Marketplaces (Shopify, Slack): Optimize listing → drive to site

### Borrowed Channels
Tap into someone else's audience for shortcut discovery.

**Examples:** Guest content, collaborations, speaking, influencer partnerships

1. List industry leaders your audience follows
2. Pitch win-win collaborations
3. Use SparkToro or Listen Notes for audience overlap
4. Set up affiliate/referral incentives

---

## Five-Phase Launch

### Phase 1: Internal
- Recruit early users one-on-one for free testing
- Collect usability gap feedback
- Ensure prototype is demo-ready

### Phase 2: Alpha
- Landing page with early access signup
- Announce the product exists
- Invite users individually

### Phase 3: Beta
- Work through early access list (some free, some paid)
- Teasers about problems you solve
- Recruit friends, investors, influencers to test and share

**Consider:** waitlist page, "Beta" sticker in dashboard nav, email invites to early access list.

### Phase 4: Early Access
- Leak details: screenshots, feature GIFs, demos
- Gather quantitative and qualitative feedback
- Run user research with engaged users (incentivize with credits)
- Optionally run product/market fit survey

**Expansion:** A) Throttle invites 5-10% at a time. B) Invite all at once under "early access" framing.

### Phase 5: Full Launch
- Open self-serve signups
- Start charging (if not already)
- Announce GA across all channels

**Touchpoints:** customer emails, in-app popups/tours, website banner, blog post, social posts, Product Hunt/BetaList/HN.

---

## Product Hunt Strategy

**Pros:** Tech-savvy early adopter exposure. Credibility bump (especially POTD). PR coverage and backlinks.

**Cons:** Competitive ranking. Short-lived traffic. Requires pre-launch planning.

### How to Launch

**Before:**
1. Build relationships with supporters, content hubs, communities
2. Optimize listing: compelling tagline, polished visuals, short demo video
3. Study successful launches for patterns
4. Engage in communities -- provide value before pitching

**Launch day:**
1. Treat as all-day event
2. Respond to every comment in real-time
3. Spark discussions
4. Direct traffic to your site for signups

**After:**
1. Follow up with everyone who engaged
2. Convert PH traffic into email signups
3. Continue momentum with post-launch content

---

## Post-Launch Actions

- **Educate:** Automated onboarding email sequence for key features.
- **Reinforce:** Include announcement in weekly/biweekly roundup.
- **Differentiate:** Publish comparison pages showing why you win.
- **Update site:** Add sections about new feature/product across pages.
- **Hands-on preview:** No-code interactive demo for pre-signup exploration.

---

## Announcement Priority

**Major** (new features, product overhauls): Full campaign -- blog, email, in-app, social.

**Medium** (integrations, UI enhancements): Targeted announcement to relevant segments + in-app banner.

**Minor** (bug fixes, tweaks): Changelog and release notes only.

---

## Launch Checklist

### Pre-Launch
- [ ] Landing page with clear value prop
- [ ] Email capture / waitlist signup
- [ ] Early access list built
- [ ] Owned channels established (email, blog, community)
- [ ] Rented channel presence (social profiles optimized)
- [ ] Borrowed channel opportunities identified
- [ ] Product Hunt listing prepared (if using)
- [ ] Launch assets created (screenshots, demo video, GIFs)
- [ ] Onboarding flow ready
- [ ] Analytics/tracking in place

### Launch Day
- [ ] Announcement email sent
- [ ] Blog post published
- [ ] Social posts scheduled and posted
- [ ] Product Hunt listing live (if using)
- [ ] In-app announcement for existing users
- [ ] Team ready to engage

### Post-Launch
- [ ] Onboarding email sequence active
- [ ] Follow-up with engaged prospects
- [ ] Comparison pages published
- [ ] Gather and act on feedback
- [ ] Plan next launch moment

---

## Questions

1. What are you launching? (New product, major feature, minor update)
2. Current audience size and engagement?
3. Owned channels? (Email list size, blog traffic, community)
4. Launch timeline?
5. Launched before? What worked/failed?
6. Considering Product Hunt? Preparation status?

---

## Related Skills

- **email-sequence**: Launch and onboarding sequences
- **page-cro**: Optimizing launch landing pages
- **brand-positioning**: Messaging clarity pre-launch
- **copywriting**: Announcement copy and landing page
- **social-content**: Social posts around launch

## Leitura de mercado pré-lançamento — `/last30days`
Antes de fechar a estratégia de lançamento, correr **`/last30days <categoria/problema>`** (plugin externo) para ler o estado real do mercado nos últimos 30 dias: o que a comunidade pede, reacções a lançamentos parecidos, odds de mercado (Polymarket), velocidade de concorrentes (GitHub). Valida timing/posicionamento contra sinal de engagement real, não só desk research.

---
name: social-content
description: "Helps creating, scheduling, or optimizing social media content for LinkedIn, Twitter/X, Instagram, TikTok, Facebook, or other platforms. MUST be invoked when the user says: LinkedIn post, Twitter thread, social media, content calendar, social scheduling, engagement,."
metadata:
  version: 1.3.0
---

# Social Content

Expert social media strategist. Goal: create engaging content that builds audience, drives engagement, and supports business goals.

## Step 0 — Read every visual reference FIRST (mandatory)

When the task supplies visual references (e.g. "cria N posts a partir destas N referências"), **`Read()` every reference image before writing any code or copy.** For each ref, extract: layout, element positions, what's actually present (and absent). Only then produce the design. Skipping this caused 3 correction rounds (lição de projecto anterior). Corollary (anti-fabrication, see `soul.md` / `workflows-and-tooling.md`): **never invent visual elements** not in the references — no bars, labels, watermarks, badges, slogans the ref doesn't show.

**Copy-fill heuristic (before render):** if copy `< ~20 words` AND the layout has no central visual (no photo/diagram/list/table), the card renders ~60% empty. Either pick a layout with a photo, or add a real central visual — infographic layouts only work with a genuine central element. Verify the content fills the card before declaring done.

---

## Before Creating Content

**Check product marketing context first:**
If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md` in older setups), read it before asking questions. Use that context and only ask for missing or task-specific information.

Gather this context (ask if not provided):

### 1. Goals
- Primary objective? (Brand awareness, leads, traffic, community)
- Desired audience action?
- Personal brand, company brand, or both?

### 2. Audience
- Target audience?
- Most active platforms?
- Content they engage with?

### 3. Brand Voice
- Tone? (Professional, casual, witty, authoritative)
- Topics to avoid?
- Style guidelines or terminology?

### 4. Resources
- Time available for social?
- Existing content to repurpose?
- Ability to create video?

---

## Platform Quick Reference

| Platform | Best For | Frequency | Key Format |
|----------|----------|-----------|------------|
| LinkedIn | B2B, thought leadership | 3-5x/week | Carousels, stories |
| Twitter/X | Tech, real-time, community | 3-10x/day | Threads, hot takes |
| Instagram | Visual brands, lifestyle | 1-2 posts + Stories daily | Reels, carousels |
| TikTok | Brand awareness, younger audiences | 1-4x/day | Short-form video |
| Facebook | Communities, local businesses | 1-2x/day | Groups, native video |

---

## Content Pillars Framework

Build content around 3-5 pillars aligned with your expertise and audience interests.

### Example for a SaaS Founder

| Pillar | % of Content | Topics |
|--------|--------------|--------|
| Industry insights | 30% | Trends, data, predictions |
| Behind-the-scenes | 25% | Building the company, lessons learned |
| Educational | 25% | How-tos, frameworks, tips |
| Personal | 15% | Stories, values, hot takes |
| Promotional | 5% | Product updates, offers |

### Pillar Development Questions

For each pillar:
1. What unique perspective do you have?
2. What does your audience ask about?
3. What content has performed well before?
4. What can you create consistently?
5. What aligns with business goals?

---

## Hook Formulas

The first line determines whether anyone reads the rest.

### Curiosity Hooks
- "I was wrong about [common belief]."
- "The real reason [outcome] happens isn't what you think."
- "[Impressive result] — and it only took [surprisingly short time]."

### Story Hooks
- "Last week, [unexpected thing] happened."
- "I almost [big mistake/failure]."
- "3 years ago, I [past state]. Today, [current state]."

### Value Hooks
- "How to [desirable outcome] (without [common pain]):"
- "[Number] [things] that [outcome]:"
- "Stop [common mistake]. Do this instead:"

### Contrarian Hooks
- "Unpopular opinion: [bold statement]"
- "[Common advice] is wrong. Here's why:"
- "I stopped [common practice] and [positive result]."

---

## Content Repurposing System

Turn one piece of content into many. The best social content is extracted from longer-form pillar content and adapted per platform.

### Blog Post → Social Content

| Platform | Format |
|----------|--------|
| LinkedIn | Key insight + link in comments |
| LinkedIn | Carousel of main points |
| Twitter/X | Thread of key takeaways |
| Instagram | Carousel with visuals |
| Instagram | Reel summarising the post |

### Podcast / Video → Social Content

Extract "content atoms" — self-contained moments from long-form content that work standalone:

| Atom Type | What to Look For | Best Platform |
|-----------|-----------------|---------------|
| Quotable moment | Bold claim, hot take, memorable line (15-60s) | Twitter/X, LinkedIn, TikTok |
| Story arc | Complete mini-story: setup, conflict, resolution (60-90s) | Instagram Reels, TikTok, YouTube Shorts |
| Tactical tip | Specific how-to or framework explained clearly (30-60s) | LinkedIn, YouTube Shorts |
| Controversial take | Contrarian opinion that sparks debate | Twitter/X, LinkedIn |
| Data/stat callout | Surprising number or research finding | LinkedIn carousel, Twitter/X |
| Behind-the-scenes | Authentic, unpolished moments | Instagram Stories, TikTok |

**Podcast repurposing workflow:**
1. **Get transcript** — Whisper, Descript, or podcast host transcription
2. **Mark timestamps** — flag 5-10 best moments while scanning transcript
3. **Extract clips** — pull video/audio for each moment (Descript, Opus Clip, or manual)
4. **Write standalone captions** — each clip needs context; don't assume viewer heard the rest
5. **Add subtitles** — most social video is watched muted
6. **Schedule across 1-2 weeks** — spread a single episode across multiple posts

**Per episode, aim for:**
- 3-5 short video clips or audiograms (15-60s) for Reels/TikTok/Shorts
- 1-2 LinkedIn text posts from key insights
- 1 Twitter/X thread of takeaways
- 1 carousel summarising the main framework or list
- 1 newsletter section or blog post from the best segment

### Webinar / Live Event → Social Content

| Extract | Format |
|---------|--------|
| Key slides with commentary | LinkedIn carousel |
| Q&A highlights | Twitter/X thread |
| Speaker quotes | Quote graphics for Instagram/LinkedIn |
| Audience reactions/poll results | Engagement posts |
| Full recording → short clips | Reels, TikTok, Shorts |

### Newsletter → Social Content

| Extract | Format |
|---------|--------|
| Main insight | LinkedIn post |
| Curated links with commentary | Twitter/X thread |
| Data or stat | Quote graphic |
| Hot take or opinion | Twitter/X post, LinkedIn |

### Repurposing Workflow

1. **Create pillar content** (blog, video, podcast, webinar, newsletter)
2. **Extract content atoms** (5-10 per piece — quotes, stories, tips, data)
3. **Adapt per platform** (format, length, tone)
4. **Write standalone captions** (each post must work without context)
5. **Schedule across the week** (spread distribution, don't dump all at once)
6. **Update and reshare** (evergreen content can repeat every 3-6 months)

---

## Content Calendar Structure

### Weekly Planning Template

| Day | LinkedIn | Twitter/X | Instagram |
|-----|----------|-----------|-----------|
| Mon | Industry insight | Thread | Carousel |
| Tue | Behind-scenes | Engagement | Story |
| Wed | Educational | Tips tweet | Reel |
| Thu | Story post | Thread | Educational |
| Fri | Hot take | Engagement | Story |

### Batching Strategy (2-3 hours weekly)

1. Review content pillar topics
2. Write 5 LinkedIn posts
3. Write 3 Twitter threads + daily tweets
4. Create Instagram carousel + Reel ideas
5. Schedule everything
6. Leave room for real-time engagement

---

## Engagement Strategy

### Daily Engagement Routine (30 min)

1. Respond to all comments on your posts (5 min)
2. Comment on 5-10 posts from target accounts (15 min)
3. Share/repost with added insight (5 min)
4. Send 2-3 DMs to new connections (5 min)

### Quality Comments

- Add new insight, not just "Great post!"
- Share a related experience
- Ask a thoughtful follow-up question
- Respectfully disagree with nuance

### Building Relationships

- Identify 20-50 accounts in your space
- Consistently engage with their content
- Share their content with credit
- Collaborate eventually (podcasts, co-created content)

---

## Analytics and Optimisation

### Metrics That Matter

**Awareness:** Impressions, Reach, Follower growth rate

**Engagement:** Engagement rate, Comments (higher value than likes), Shares/reposts, Saves

**Conversion:** Link clicks, Profile visits, DMs received, Leads attributed

### Weekly Review

- Top 3 posts (why did they work?)
- Bottom 3 posts (what can you learn?)
- Follower growth trend
- Engagement rate trend
- Best posting times (from data)

### Optimisation Actions

**If engagement is low:**
- Test new hooks
- Post at different times
- Try different formats
- Increase engagement with others

**If reach is declining:**
- Avoid external links in post body
- Increase posting frequency
- Engage more in comments
- Test video/visual content

---

## Content Ideas by Situation

### Starting Out
- Document your journey
- Share what you're learning
- Curate and comment on industry content
- Engage heavily with established accounts

### When Stuck
- Repurpose old high-performing content
- Ask your audience what they want
- Comment on industry news
- Share a failure or lesson learned

---

## Scheduling Best Practices

### Schedule vs. Post Live

**Schedule:** Core content posts, Threads, Carousels, Evergreen content

**Post live:** Real-time commentary, Responses to news/trends, Engagement with others

### Queue Management

- Maintain 1-2 weeks of scheduled content
- Review queue weekly for relevance
- Leave gaps for spontaneous posts
- Adjust timing based on performance data

---

## Reverse Engineering Viral Content

Analyse what works for top creators in your niche instead of guessing:

1. **Find creators** — 10-20 accounts with high engagement
2. **Collect data** — 500+ posts for analysis
3. **Analyse patterns** — Hooks, formats, CTAs that work
4. **Codify playbook** — Document repeatable patterns
5. **Layer your voice** — Apply patterns with authenticity
6. **Convert** — Bridge attention to business results

---

## Short-Form Video (TikTok, Reels, Shorts)

Short-form video is the highest-reach format on every major platform. These frameworks apply to TikTok, Instagram Reels, and YouTube Shorts.

### Platform Specs

| Platform | Optimal Length | Aspect Ratio | Key Difference |
|----------|---------------|--------------|----------------|
| TikTok | 15-60 sec | 9:16 | Trending sounds, raw/authentic feel |
| Reels | 15-30 sec | 9:16 | Polished content, rewards saves/shares |
| Shorts | 30-60 sec | 9:16 | YouTube SEO applies, searchable titles |

### The 3-Second Rule

You have 3 seconds to stop the scroll. Every video needs three simultaneous hooks:

```
[VISUAL HOOK] + [VERBAL HOOK] + [TEXT OVERLAY]
```

All three should hit in the first second.

### Video Structures

**Problem-Solution (15-30 sec):**
```
[0-3s]  Hook: State the problem
[3-10s] Agitate: Why it matters
[10-25s] Solution: Your method/product/tip
[25-30s] CTA: What to do next
```

**List Format (30-60 sec):**
```
[0-3s]  Hook: "X things that [outcome]"
[3-50s] Items: One every 5-8 seconds
[50-60s] CTA
```

**Tutorial (30-60 sec):**
```
[0-3s]  Hook: Show the end result first
[3-8s]  Overview: "Here's how..."
[8-50s] Steps: Quick, clear instructions
[50-60s] Result + CTA
```

### Caption and Subtitle Best Practices

Captions increase watch time by 25-40%. Most social video is watched muted.

- **MAX 2 lines** on screen at once
- **3-5 words per line**
- Bold, sans-serif font with black outline
- **Highlight key words** in a different colour
- Match timing to speech exactly

Tools: CapCut (free), Descript, Captions.ai, Premiere Pro

### Content Ideas by Type

| Business Type | Video Ideas |
|---------------|-------------|
| SaaS | Feature demos (show outcome first), before/after, "Watch me do X in Y seconds" |
| E-commerce | Unboxing, comparisons, how it's made, customer reviews |
| Services | Process reveals, client transformations, myth-busting |
| Personal brand | Lessons learned, controversial takes, day-in-the-life |

### Common Mistakes

1. **Slow hooks** — don't build up to the point
2. **No text overlay** — many watch muted
3. **Poor audio** — bad audio kills retention instantly
4. **Too long** — if it can be shorter, make it shorter
5. **No CTA** — tell viewers what to do
6. **Ignoring comments** — engagement in the first hour matters

---

## Task-Specific Questions

1. Which platform(s) are you targeting?
2. Current posting frequency?
3. Existing content to repurpose?
4. What content has performed well before?
5. Weekly time available?
6. Personal brand, company brand, or both?

---

## Related Skills

- **copywriting**: Longer-form content that feeds social
- **launch-strategy**: Coordinating social with launches
- **email-sequence**: Nurturing social audience via email
- **marketing-psychology**: Understanding what drives engagement

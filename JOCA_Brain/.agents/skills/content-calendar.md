---
name: content-calendar
description: "Produces a multi-platform content/publishing calendar with per-platform cadence, timezone-aware optimal posting slots, caption/hook generation, asset-to-slot mapping, and release rollout sequencing. MUST be invoked when the user says: plano de publicacao, calendario social, rollout de lancamento, captions por plataforma, content schedule, posting schedule, asset schedule, waterfall release, episodic rollout, quando publicar, sequencia de publicacao."
origin: local
metadata:
  version: 1.0.0
  pairs_with: [social-content, content-strategy, launch-strategy]
---

# Content Calendar

Specialist for building actionable multi-platform publishing calendars. Produces: slot grid, asset-to-slot assignments, per-platform captions/hooks, rollout sequence. Covers music releases, e-commerce launches, and portfolio drops.

Does NOT duplicate platform strategy, copywriting, or launch sequencing theory — those live in `social-content`, `content-strategy`, and `launch-strategy`. Read those skills if the user also needs platform strategy or launch architecture.

---

## Before Starting

Check `.agents/product-marketing-context.md` or `.claude/product-marketing-context.md` first. If it exists, extract context from it and only ask for gaps.

Clarify before generating any calendar:

```
1. What is being published? (music release, product launch, portfolio)
2. Asset inventory — list every asset you have (videos, images, clips, tracks, copy).
   For each asset: format, length, theme, which platforms it suits.
3. Platforms — which platforms? (TikTok / Reels / Shorts / YouTube / LinkedIn / other)
4. Rollout type — waterfall (sequential singles), episodic (fixed-count weekly drops), or burst (all-at-once)?
5. Campaign duration — start date, end date or number of weeks.
6. Audience timezone(s) — city or IANA tz (e.g. Europe/Lisbon, America/Sao_Paulo).
   For multi-region: list each region separately.
7. Posting authority — scheduling tool available? (Buffer, Metricool, manual)
```

Do not proceed until items 1-6 are answered. Item 7 is optional.

---

## Platform Cadence Defaults

All times = **audience local timezone**. Store internally as UTC + IANA tz; render in local. Never use fixed UTC offsets (DST-unsafe).

| Platform | Cadence | Best Days | Best Time (local) | Avoid |
|---|---|---|---|---|
| TikTok | 3-5/week | Tue, Thu, Fri | 18:00-21:00 | Sun |
| Instagram Reels | 3-5/week | Wed, Fri | 18:00-21:00 | Sun |
| YouTube Shorts | 3-5/week | Mon-Fri | 12:00-15:00 | — |
| YouTube Long-form | 1-2/week | Thu, Fri | publish by 16:00 | Mon |
| LinkedIn | 3-5/week | Tue, Wed, Thu | 08:00-10:00 | Sat, Sun |

**Override rule:** these are defaults. If the user has real analytics showing different peaks for their niche, their data wins. Flag this explicitly when building the grid.

---

## Rollout Models

### Waterfall (music / staged product drops)
- Release singles every 4-6 weeks; each new single re-bundles all prior tracks.
- Full EP/album bundles all tracks at the end → multiple algorithmic entry points.
- Post-release tail: 8-12 weeks of connective content between drops (acoustic, remix, BTS, alt versions) to reactivate algorithm slots.

### Episodic (fixed-count weekly drops)
- Fixed number of drops at fixed cadence with a hard end date (e.g. 10 tracks, 10 weeks).
- End date creates urgency; communicate it publicly from week 1.
- One anchor content piece per week + 2-3 supporting social posts per platform.

### Burst (e-commerce launch / portfolio reveal)
- All assets live on day 1 or within a 7-day window.
- Sequence: Teaser (D-7) → Pre-launch (D-3) → Launch (D-0) → Social proof (D+3, D+7) → Tail (D+14, D+30).

---

## Asset-to-Slot Mapping

Model as bin-packing: assets = items (tagged by platform eligibility, format, theme); slots = recurring grid from cadence table above.

**Tagging each asset before assignment:**
```
Asset ID | Format (video/image/text) | Length | Platforms | Theme/Episode | Rollout order
```

**Assignment rules:**
1. Same asset on multiple platforms: re-cut aspect ratio and rewrite caption per slot (do not cross-post verbatim).
2. Spacing: avoid placing the same core asset within 48h cross-platform unless it is the launch day burst.
3. Rollout constraint: waterfall/episodic order is a hard ordering constraint on slot dates — assign earlier slots only to earlier-sequence assets.
4. Leave 1 gap/week per platform for reactive/trending content.

---

## Hook + Caption Generation

**Short-form video structure (TikTok / Reels / Shorts):**

```
[0-3s]  Hook — pattern break + curiosity or problem statement
[4-15s] Value drop — quick answer or proof of concept
[16-45s] Story / payoff — context, demonstration, narrative
[final ~5s] CTA — single action only
```

Hook patterns that work (73% preference for educational short-form):
- "Here's why [common assumption] is wrong..."
- "You won't believe what happens when [action]..."
- "The one thing [industry] never tells you about [topic]..."
- "Before you [common action], watch this."

**Caption rules by platform:**

| Platform | Caption style | Max length | Key rule |
|---|---|---|---|
| TikTok | Hook line 1 → line breaks → CTA | ~150 chars visible | Feed truncates; hook must be in line 1 |
| Instagram Reels | Engaging first line → hashtags below fold | ~125 chars visible | Saves/shares weigh more than likes |
| YouTube Shorts | Descriptive, keyword-rich | 500+ chars OK | Aids search; title matters more than description |
| YouTube Long-form | Full description with timestamps | 1000+ chars | Include chapters, links, keywords |
| LinkedIn | Insight-led opener, no link in body | ~210 chars visible | External links in comments, not post body |

**Burned-in captions (video):** mandatory — 80-85% of short-form is watched muted. Max 2 lines on screen, 3-5 words/line, lower-center position, tightly synced. This is both an accessibility baseline and a performance driver (+40% completion rate).

---

## Output Format

### 1. Calendar Table

Produce one table per week (or compress to full campaign if ≤ 4 weeks):

```
| Date | Day | Platform | Time (local tz) | Asset ID | Content type | Caption hook (first line) | Status |
|---|---|---|---|---|---|---|---|
| 2025-09-01 | Mon | TikTok | 19:00 WEST | V01 | Reel teaser | "You've never heard a drop like this." | Schedule |
| 2025-09-01 | Mon | Reels | 20:00 WEST | V01-recut | Reel teaser | "This one took 3 cities to finish." | Schedule |
| 2025-09-03 | Wed | YouTube Shorts | 13:00 WEST | V02 | Shorts clip | "Behind the session no one saw." | Schedule |
```

Status values: `Schedule` / `Draft needed` / `Asset missing` / `Live`.

### 2. Asset Sheet

```
| Asset ID | Raw file | Format | Platforms | Rollout order | Re-cuts needed | Caption written |
|---|---|---|---|---|---|---|
```

### 3. Per-Platform Captions

For each slot marked `Draft needed`, generate:
- **Hook line** (≤ 10 words)
- **Body** (platform-length, platform-tone)
- **CTA** (one action)
- **Hashtag set** (3-5 for TikTok/Reels; 0-1 for LinkedIn)

### 4. Rollout Sequence Summary

For waterfall/episodic: one-paragraph narrative of the sequence logic, flagging connective content windows and tail activation dates.

---

## Failure Cases

**Asset inventory incomplete:** generate a blank Asset Sheet, mark all status as `Asset missing`, and tell the user which slots are blocked before building captions.

**Timezone not provided:** default to Europe/Lisbon (base do utilizador), flag it explicitly, and ask for confirmation before finalising.

**Cadence conflicts (too many assets for slot count):** surface the conflict — list which assets can't fit — and ask whether to extend the campaign window or drop lower-priority assets.

**Multi-region audience:** duplicate the slot grid per region, tag each row with tz, and warn that same-asset posts across regions may fire within hours of each other on the same platform (algorithm may suppress).

---

## Related Skills

- **social-content**: platform strategy, content pillars, hook formulas, engagement tactics
- **content-strategy**: editorial planning, audience research, content mix
- **launch-strategy**: launch architecture, pre/post-launch sequencing, channel coordination
- **copywriting**: long-form captions, ad copy, CTA optimisation

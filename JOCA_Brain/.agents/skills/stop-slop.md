---
name: stop-slop
description: "Remove AI-writing patterns (AI slop) from PROSE — predictable tells: throat-clearing openings, adverbs, passive voice, binary contrasts, false agency, dramatic fragmentation, jargon. Polish pass to apply when WRITING/EDITING/REVIEWING text. MUST be invoked when the user says: stop slop, sounds like AI, looks AI-written, strip AI tells, clean up the writing, this sounds robotic, AI slop in the text, polish copy. SHOULD also invoke as the final step of any copy (landing, email, ad, post, article). Adapted from Hardik Pandya's stop-slop skill (MIT)."
triggers: stop slop, AI slop, sounds like AI, looks like AI, AI-written, AI tells, clean up writing, sounds robotic, polish copy, polish text, remove AI patterns, prose slop, sounds AI, de-slop, deslop, anti-slop
chain: pt-pt-translator
---
# stop-slop — Remove AI slop from prose

Eliminate the predictable AI-writing patterns. Distinct from `design-review` (**visual** slop) — this is **text** slop. Apply when writing, editing or reviewing any prose (copy, email, ad, post, article, README). Adapted from Hardik Pandya's `stop-slop` skill (MIT, hvpandya.com).

> **pt-PT:** the rules are universal; the examples below are in EN (canonical). In Portuguese the equivalents apply — e.g.: throat-clearing "A verdade é que…/No fundo…/Importa referir que…"; adverbs in "-mente"; false agency "a decisão emerge/o mercado premeia"; jargon "navegar desafios/dar o salto/no panorama actual". Chain to `pt-pt-translator` if the target is pt-PT.

## 8 core rules
1. **Cut filler.** Throat-clearing openings, emphasis crutches, and **every adverb**.
2. **Break formulaic structures.** Binary contrasts, negative listing, dramatic fragmentation, rhetorical setups, false agency.
3. **Active voice.** Every sentence has a human subject doing something. No passives. No inanimate objects doing human verbs ("the complaint becomes a fix").
4. **Be specific.** No vague declaratives ("The reasons are structural"). Name the thing. No lazy extremes ("everyone", "always", "never") doing vague work.
5. **Put the reader in the room.** No narrator-at-a-distance voice. "You" beats "people". Specific beats abstract.
6. **Vary the rhythm.** Mix sentence lengths. Two items beat three. End paragraphs differently. **No em dashes.**
7. **Trust the reader.** State facts directly. No softening, justifying, hand-holding.
8. **Cut the "quotables".** If it sounds like a pull-quote, rewrite it.

## Phrases to remove

**Throat-clearing (announcement openings)** — any "Here's what/this/that", "Here's the thing:", "The uncomfortable truth is", "It turns out", "The real X is", "Let me be clear", "The truth is", "I'm going to be honest", "Can we talk about". → Cut it and state the point.

**Emphasis crutches** — "Full stop." / "Period.", "Let that sink in.", "This matters because", "Make no mistake", "Here's why that matters". → Delete.

**Adverbs (kill them all)** — really, just, literally, genuinely, honestly, simply, actually, deeply, truly, fundamentally, inherently, inevitably, interestingly, importantly, crucially. Related filler: "At its core", "In today's X", "It's worth noting", "At the end of the day", "When it comes to", "In a world where", "The reality is".

**Business jargon** → plain: navigate→handle/address · unpack→explain · lean into→accept · landscape→situation · game-changer→significant · double down→commit · deep dive→analysis · take a step back→reconsider · moving forward→next · circle back→revisit · on the same page→aligned.

**Meta-commentary** — "Hint:", "Plot twist:"/"Spoiler:", "You already know this, but", "X is a feature, not a bug", "The rest of this essay…", "Let me walk you through…", "In this section, we'll…", "As we'll see…". → Delete; let the text move.

**Vague declaratives** — "The reasons are structural", "The implications are significant", "The stakes are high", "The consequences are real". → Name the specific thing or cut.

## Structures to avoid

**Binary contrasts (false drama)** — "Not because X. Because Y.", "X isn't the problem. Y is.", "The answer isn't X. It's Y.", "It's not this. It's that.", "not just X but also Y", "stops being X and starts being Y". → State Y directly. Drop the negation.

**Negative listing** — "Not a X… Not a Y… A Z.", "It wasn't X. It wasn't Y. It was Z." → State Z. The reader does not need the runway.

**Dramatic fragmentation** — "[Noun]. That's it. That's the [thing].", "X. And Y. And Z.", "This unlocks something. [Word]." → Complete sentences. Trust the content, not the presentation.

**Rhetorical setups** — "What if [reframe]?", "Here's what I mean:", "Think about it:", "And that's okay." → Make the point; let the reader conclude.

**False agency (human verbs on inanimates)** — "a complaint becomes a fix" (someone fixed it), "the decision emerges" (someone decided), "the culture shifts" (people change behavior), "the data tells us" (someone read it and concluded), "the market rewards" (buyers pay). → Name the human; if none fits, use "you".

**Narrator-at-a-distance** — "Nobody designed this.", "This happens because…", "People tend to…". → Put the reader in the room: "You don't sit down one day and decide…" beats "Nobody designed this."

**Passive voice** — "X was created"→name who created it; "It is believed that"→who believes; "Mistakes were made"→who made them. → Find the actor, put them up front.

**Sentence starters** — sentences beginning with What/When/Where/Which/Who/Why/How → restructure (lead with subject/verb). Paragraphs beginning with "So" → start with content. "Look," → remove.

**Rhythm** — lists of three → use two or one. Questions answered right away → let them breathe or cut. Every paragraph ending on a punch → vary it. **Em dash → remove** (comma/period). Staccato of short sentences → don't stack them.

**Lazy extremes** — every/always/never/everyone/nobody = false authority. Use specifics.

## Quick checks (before delivering prose)
Adverbs? kill. Passive? find the actor. Inanimate with a human verb? name the person. Sentence starting with Wh-? restructure. "Here's what/this" throat-clearing? cut. "Not X, it's Y"? state Y. 3 sentences in a row the same length? break one. Paragraph ending on a one-liner? vary it. Em dash? remove. Vague declarative? name the specific. Narrator-at-a-distance? put the reader in the scene. Meta-joiner ("The rest of this essay…")? delete.

## Scoring (1-10 per dimension)
| Dimension | Question |
|---|---|
| Directness | Statements or announcements? |
| Rhythm | Varied or metronomic? |
| Trust | Does it respect the reader's intelligence? |
| Authenticity | Does it sound human? |
| Density | Is there anything cuttable? |

**< 35/50 → rewrite.**

## Examples (before → after)
- "Here's the thing: building products is hard. Not because the technology is complex. Because people are complex. Let that sink in." → **"Building products is hard. Technology is manageable. People aren't."**
- "In today's fast-paced landscape, we need to lean into discomfort and navigate uncertainty with clarity. This matters because your competition isn't waiting." → **"Move faster. Your competition is."**
- "What if I told you that the best teams don't optimize for productivity? Here's what I mean: they optimize for learning. Think about it." → **"The best teams optimize for learning, not productivity."**

## Next step (chain)
**Terminal** polish step — `copywriting`, `landing-page`, `email-sequence`, `social-content`, `content-strategy`, `seo`/`seo-local` and `paid-ads` chain TO here as the final pass before delivering. pt-PT target → `pt-pt-translator`. `design-review` references this skill when the slop is copy (not visual).

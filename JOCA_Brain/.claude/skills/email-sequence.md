---
name: email-sequence
description: "Create or optimize an email sequence, drip campaign, automated email flow, or lifecycle email program. MUST be invoked when the user says: email sequence, drip campaign, nurture sequence, onboarding emails, welcome sequence, re-engagement emails. SHOULD also invoke when: launch sequence, sales sequence, conversion emails, email funnel, convert my list, post-purchase emails, sequência de emails, emails de boas-vindas."
metadata:
  version: 1.1.0
chain: transactional-email, stop-slop
---

# Email Sequence Design

Expert in email marketing and automation. Creates sequences that nurture relationships, drive action, and convert.

## Initial Assessment

**Check the brand profile first:**
If a marketeer brand profile exists (`clientes/<slug>/marca.md` under the marketeer workspace — see `.claude/marketeer/CONTRATO.md`), read it first; otherwise ask the 3-5 questions this skill needs.

Before creating a sequence, understand (voice comes from the profile's `## Voz` section with its real samples; without a profile, ask for 3 emails or posts the client actually sent):

0. **Offer and bridge**
   - What did they opt in for (lead magnet — see `lead-capture`)?
   - What is eventually sold, and at what price? (sets how much trust is needed)
   - How does the free thing lead logically to the paid one?
   - Biggest objections — why might they NOT buy?

1. **Sequence Type**
   - Welcome/onboarding
   - Lead nurture
   - Re-engagement
   - Post-purchase
   - Event-based
   - Educational
   - Sales

2. **Audience Context**
   - Who are they?
   - What triggered entry into this sequence?
   - What do they know/believe?
   - Current relationship with you?

3. **Goals**
   - Primary conversion goal
   - Relationship-building goals
   - Segmentation goals
   - Success criteria?

---

## Core Principles

### 1. One Email, One Job
- Each email has one primary purpose
- One main CTA per email

### 2. Value Before Ask
- Lead with usefulness
- Build trust through content
- Earn the right to sell

### 3. Relevance Over Volume
- Fewer, better emails win
- Segment for relevance
- Quality > frequency

### 4. Clear Path Forward
- Every email moves them somewhere
- Links should do something useful
- Make next steps obvious

---

## Sequence Strategy

### Sequence Length
See the **Sequence Types** table below for lengths (single source).

Depends on: sales cycle length, product complexity, relationship stage.

### Timing/Delays
- Welcome email: Immediately
- Early sequence: 1-2 days apart
- Nurture: 2-4 days apart
- Long-term: Weekly or bi-weekly

Considerations:
- B2B: Avoid weekends
- B2C: Test weekends
- Time zones: Send at local time

### Subject Line Strategy
- Clear > Clever
- Specific > Vague
- Benefit or curiosity-driven
- Short enough not to truncate on mobile [unverified: no length rule sourced — check in the ESP preview]
- Test emoji (polarizing)
- Kill opens: ALL CAPS, "!!!", "Newsletter #47", "[Company] Weekly Update", clickbait the email does not pay off, same format every time

**Patterns that work:**
- Question: "Still struggling with X?"
- How-to: "How to [achieve outcome] in [timeframe]"
- Number: "3 ways to [benefit]"
- Direct: "[First name], your [thing] is ready"
- Story tease: "The mistake I made with [topic]"

### Preview Text
- Extends the subject line
- Length shown varies by client and device [unverified] — check in the ESP preview
- Don't repeat subject line
- Complete the thought or add intrigue

---

## Sequence Types

| Sequence | Purpose | Length | When |
|---|---|---|---|
| **Welcome** | Deliver value, build relationship | 5-7 emails | After opt-in |
| **Lead nurture** | Value and trust before the pitch | 4-8 emails | Between welcome and pitch |
| **Conversion / sales** | Sell the offer | 4-7 emails | When ready to pitch |
| **Launch** | Time-bound campaign | 6-10 emails | Launch, promotion, cohort opening |
| **Re-engagement** | Win back or clean the list | 3-4 emails | Inactive 30-60 days |
| **Post-purchase / onboarding** | Onboard, reduce refunds, upsell | 4-7 emails | After purchase / signup |

### Frameworks (one per sequence type)

```
Welcome:        DELIVER → CONNECT → VALUE → VALUE → BRIDGE → SOFT PITCH → DIRECT PITCH
Conversion:     OPEN → DESIRE → PROOF → OBJECTION → URGENCY (only if real) → CLOSE → LAST CALL
Launch:         SEED → OPEN → VALUE → PROOF → URGENCY → CLOSE
Re-engagement:  PATTERN INTERRUPT → VALUE → DECISION (stay or leave)
```
- **Deliver:** what they came for, immediately, plus "reply with a question".
- **Connect:** the founder's/brand's story and why it matters to the reader.
- **Value:** a quick win they can apply today; then another that builds authority.
- **Bridge:** show what is possible with more help — the paid offer as the natural next step.
- **Proof:** real testimonials and cases only (approved facts in the brand profile).
- **Urgency:** only a real deadline or real limited stock. Invented scarcity is out.

### Welcome Sequence (Post-Signup)
**Length**: 5-7 emails over 12-14 days
**Goal**: Activate, build trust, convert

Key emails:
1. Welcome + deliver promised value (immediate)
2. Quick win (day 1-2)
3. Story/Why (day 3-4)
4. Social proof (day 5-6)
5. Overcome objection (day 7-8)
6. Core feature highlight (day 9-11)
7. Conversion (day 12-14)

### Lead Nurture Sequence (Pre-Sale)
**Length**: 4-8 emails over 2-3 weeks
**Goal**: Build trust, demonstrate expertise, convert

Key emails:
1. Deliver lead magnet + intro (immediate)
2. Expand on topic (day 2-3)
3. Problem deep-dive (day 4-5)
4. Solution framework (day 6-8)
5. Case study (day 9-11)
6. Differentiation (day 12-14)
7. Objection handler (day 15-18)
8. Direct offer (day 19-21)

### Launch Sequence
**Length**: 6-10 emails around a fixed cart-open/close window
**Goal**: Sell within a real time window

Timing pattern:
```
Day -3: Seed (optional)        Day 4: Social proof
Day -1: Coming tomorrow        Day 5: Objection handling
Day 0:  Cart open (2 angles)   Day 6: 48-hour warning
Day 2:  Value deep-dive        Day 7: 24 h warning → final hours → last call
```

### Conversion Sequence
**Length**: 4-7 emails, every ~2 days (final 3 in 3 days if there is a deadline)
**Goal**: Turn engaged subscribers into customers — one job per email (OPEN → … → LAST CALL above)

### Re-Engagement Sequence
**Length**: 3-4 emails over 2 weeks
**Trigger**: 30-60 days of inactivity
**Goal**: Win back or clean list

Key emails:
1. Check-in (genuine concern)
2. Value reminder (what's new)
3. Incentive (special offer)
4. Last chance (stay or unsubscribe)

### Onboarding Sequence (Product Users)
**Length**: 5-7 emails over 14 days
**Goal**: Activate, drive to aha moment, upgrade
**Note**: Coordinate with in-app onboarding -- email supports, doesn't duplicate

Key emails:
1. Welcome + first step (immediate)
2. Getting started help (day 1)
3. Feature highlight (day 2-3)
4. Success story (day 4-5)
5. Check-in (day 7)
6. Advanced tip (day 10-12)
7. Upgrade/expand (day 14+)

---

## Email Types by Category

### Onboarding Emails
- New users series
- New customers series
- Key onboarding step reminders
- New user invites

### Retention Emails
- Upgrade to paid
- Upgrade to higher plan
- Ask for review
- Proactive support offers
- Product usage reports
- NPS survey
- Referral program

### Transactional Email Upsell Logic

Transactional emails are expected and get opened, which creates a window for contextual upsells — but compliance rules are strict.

**Legal vs. not:**

| Allowed | Not Allowed |
|---------|-------------|
| Soft product suggestion in footer of transactional email | Hard promotional email disguised as transactional |
| Contextual upsell triggered by behavior (usage limit hit) | Sending promo to users who opted out of marketing |
| Educational tip relevant to the transaction | Unrelated product promotion in receipt email |

Rule: transactional emails can contain incidental marketing; they cannot be primarily marketing.

**Behavioral Trigger Upsell Patterns:**

| Trigger | Upsell Message | Timing |
|---------|---------------|--------|
| User hits storage/seat/usage limit | "You're at 90% of your plan — upgrade to [tier] for [benefit]" | Immediately |
| User completes onboarding | "You're set up — want to unlock [premium feature]?" | Day 3 post-onboarding |
| User uses feature X repeatedly | "Power users of [feature] love [premium feature Y]" | After 5th use |
| Annual renewal approaching | "Switch to annual and save [%]" | 30 days before renewal |
| Free trial day 7 | "You have [N] days left — here's what you'd lose" | Trial day 7 |
| Post-purchase | "Customers who bought X also got Y" | Within 24 hours |

**Upsell Email Template:**

```
Subject: You're hitting the [X] limit on [Product]

[1 line: what happened — usage fact, not hype]
[1-2 lines: what they'd get by upgrading — specific feature/benefit]
[1 line CTA: "Upgrade to [Plan] →"]
[1 line: pricing transparency — no surprises]
[Footer: unsubscribe from marketing (not from transactional)]
```

**Key Rules:**
1. Usage-based timing only -- upsell when behavior signals readiness, not on a calendar
2. One upsell per transactional email -- never stack multiple upgrade asks
3. Show the path, not the pitch -- "here's what you unlock" beats "buy now"
4. Separate unsubscribes -- marketing opt-out must not block transactional emails

### Billing Emails
- Switch to annual
- Failed payment recovery
- Cancellation survey
- Upcoming renewal reminders

### Usage Emails
- Daily/weekly/monthly summaries
- Key event notifications
- Milestone celebrations

### Win-Back Emails
- Expired trials
- Cancelled customers

### Campaign Emails
- Monthly roundup / newsletter
- Seasonal promotions
- Product updates
- Industry news roundup
- Pricing updates

---

## Email Copy Guidelines

### Structure
1. **Hook**: First line grabs attention
2. **Context**: Why this matters to them
3. **Value**: The useful content
4. **CTA**: What to do next
5. **Sign-off**: Human, warm close

### Formatting
- Short paragraphs (1-3 sentences)
- White space between sections
- Bullet points for scanability
- Bold for emphasis (sparingly)
- Mobile-first (most read on phone)

### Tone
- Conversational, not formal
- First-person (I/we) and second-person (you)
- Active voice
- Read aloud -- does it sound human?

### Length
- 50-125 words for transactional
- 150-300 words for educational
- 300-500 words for story-driven

### CTA Guidelines
- Buttons for primary actions
- Links for secondary actions
- One clear primary CTA per email (delivery email may add "reply with a question")
- Button text: Action + outcome

### Copy Devices
- **P.S.** — use it for the core CTA, a second hook or the deadline reminder.
- **Open loops** — "I'll explain why on Thursday" pulls the next email; pay it off.
- **Specificity** — exact numbers, names, dates — only real ones from the brand profile or the client's data.

### Architecture
- **Straight line:** email 1 → … → pitch. Short sequences.
- **Branch:** clicked the bridge link? → pitch sequence; didn't → more value. Needs ESP automation.
- **Hybrid:** welcome → wait 7 days → conversion → no purchase → ongoing nurture.

### When to Start Selling
Trust needed scales with price [unverified heuristic, adapt to the client's data]: low-ticket after 3-5 value emails; mid-ticket after 5-7; high-ticket after 7-10 or a call.

### Compliance (EU / Portugal)
Marketing emails only to contacts with a valid opt-in (GDPR + Lei 41/2004 — confirm current rules); unsubscribe link in every marketing email; transactional emails never become primarily promotional. Proof of consent: `gdpr-compliance` §4.

---

## Output Format

### Sequence Overview
```
Sequence Name: [Name]
Trigger: [What starts the sequence]
Goal: [Primary conversion goal]
Length: [Number of emails]
Timing: [Delay between emails]
Exit Conditions: [When they leave the sequence]
```

### For Each Email
```
Email [#]: [Name/Purpose]
Send: [Timing]
Subject: [Subject line]
Preview: [Preview text]
Body: [Full copy]
CTA: [Button text] → [Link destination]
Segment/Conditions: [If applicable]
```

### Metrics Plan
What to measure and benchmarks

---

## Task-Specific Questions

1. What triggers entry to this sequence?
2. What's the primary goal/conversion action?
3. What do they know about you?
4. What other emails are they receiving?
5. What's your current email performance?

---

## Tool Integrations

Key email tools (check the vendor's current docs and MCP availability before relying on it):

| Tool | Best For |
|------|----------|
| **Customer.io** | Behavior-based automation |
| **Mailchimp** | SMB email marketing |
| **Brevo** | SMB email marketing, EU-based |
| **Resend** | Developer-friendly transactional |
| **SendGrid** | Transactional email at scale |
| **Kit** | Creator/newsletter focused |

Templates in code and transactional sending: `transactional-email` (React Email in `reference/react-email.md`). In a `/marketeer` cycle, setting the sequence up in the client's ESP is `mkt-email` (F4: created as draft/paused, activation by the account owner).

---

## Related Skills

- **lead-capture**: Lead magnets and capture popups that feed these sequences
- **copywriting**: For landing pages emails link to
- **ab-test-setup**: For testing email elements
- **stop-slop**: Remove AI-sounding patterns before sending
- **transactional-email**: Code the templates (React Email) and send them
- **mkt-email** (marketeer pack): Set the sequence up in the client's ESP

## Credits

Sequence-type table, the four frameworks, launch timing, copy devices (P.S., one CTA, open loops), architecture patterns and "when to start selling" adapted from the local reference skill `email-sequences` (`SKILL.md`), collected in `_referencias de skill da net/` (2026-10-01). Its example sequences and unsourced statistics were not imported.

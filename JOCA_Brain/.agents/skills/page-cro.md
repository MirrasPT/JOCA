---
name: page-cro
description: "Optimize conversion on any marketing page (homepage, landing, pricing). Invoke on: CRO, conversion rate, page not converting, my landing page isn't working."
metadata:
  version: 1.1.0
---

# Page CRO

Conversion rate optimization expert. Analyze marketing pages and deliver actionable conversion improvements.

## Initial Assessment

**Check product marketing context first:**
If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md` in older setups), read it before asking questions. Use that context; only ask for info not already covered.

Before recommending, identify:

1. **Page Type**: Homepage, landing page, pricing, feature, blog, about, other
2. **Primary Goal**: Sign up, request demo, purchase, subscribe, download, contact sales
3. **Traffic Source**: Organic, paid, email, social

**If the user provides a URL or HTML file:** launch in parallel before analyzing — agents find real issues that inform CRO recommendations:

```
Agent(subagent_type="tester-ui-ux", prompt="Analyse this page from a conversion perspective. URL/path: [URL or file path]. Act as a frustrated first-time visitor. Find: confusing flows, unclear CTAs, missing trust signals, form friction, dead ends, broken interactions, spacing/layout issues that hurt conversion. Report: Critical (blocking conversions) / Important / Suggestions.")

Agent(subagent_type="tester-performance", prompt="Run Lighthouse on this page. URL: [URL]. Report performance score, LCP, CLS, INP. Slow pages kill conversions — flag anything below 70 performance score or LCP > 3s as Critical.")
```

Incorporate findings before writing CRO recommendations — slow performance and broken UX take priority over copy tweaks.

---

## CRO Analysis Framework

Analyze the page across these dimensions, by impact order:

### 1. Value Proposition Clarity (Highest Impact)

**Check:**
- Can a visitor grasp what this is and why it matters within 5 seconds?
- Is the primary benefit clear, specific, and differentiated?
- Written in the customer's language, not company jargon?

**Common issues:**
- Feature-focused instead of benefit-focused
- Too vague or too clever, sacrificing clarity
- Trying to say everything instead of the one key thing

### 2. Headline Effectiveness

**Evaluate:**
- Does it convey the core value proposition?
- Specific enough to be meaningful?
- Matches the traffic source's messaging?

**Strong patterns:**
- Outcome-focused: "Get [desired outcome] without [pain point]"
- Specificity: Numbers, timeframes, concrete details
- Social proof: "Join 10,000+ teams who..."

### 3. CTA Placement, Copy, and Hierarchy

**Primary CTA:**
- One clear primary action?
- Visible without scrolling?
- Button copy communicates value, not just action?
  - Weak: "Submit," "Sign Up," "Learn More"
  - Strong: "Start Free Trial," "Get My Report," "See Pricing"

**CTA hierarchy:**
- Logical primary vs. secondary CTA structure?
- CTAs repeated at key decision points?

### 4. Visual Hierarchy and Scannability

**Check:**
- Can someone scanning get the main message?
- Most important elements visually prominent?
- Enough white space?
- Images support or distract from the message?

### 5. Trust Signals and Social Proof

**Types:**
- Customer logos (recognizable ones)
- Testimonials (specific, attributed, with photos)
- Case study snippets with real numbers
- Review scores and counts
- Security badges (where relevant)

**Placement:** Near CTAs and after benefit claims.

### 6. Objection Handling

**Common objections:**
- Price/value concerns
- "Will this work for my situation?"
- Implementation difficulty
- "What if it doesn't work?"

**Address via:** FAQ sections, guarantees, comparison content, process transparency.

### 7. Friction Points

**Look for:**
- Too many form fields
- Unclear next steps
- Confusing navigation
- Unnecessary required fields
- Mobile experience issues
- Long load times

---

## Output Format

### Quick Wins (Implement Now)
Easy changes with likely immediate impact.

### High-Impact Changes (Prioritize)
Larger changes requiring more effort but significantly improving conversions.

### Test Ideas
Hypotheses worth A/B testing rather than assuming.

### Copy Alternatives
For key elements (headlines, CTAs), provide 2-3 alternatives with rationale.

---

## Page-Specific Frameworks

### Homepage CRO
- Clear positioning for cold visitors
- Quick path to the most common conversion
- Handle both "ready to buy" and "still researching"

### Landing Page CRO
- Message match with traffic source
- Single CTA (remove navigation if possible)
- Complete argument on one page

### Pricing Page CRO
- Clear plan comparison
- Recommended plan indication
- Address "which plan is right for me?" anxiety

### Feature Page CRO
- Connect feature to benefit
- Use cases and examples
- Clear path to try/buy

### Blog Post CRO
- Contextual CTAs matching content topic
- Inline CTAs at natural stopping points

---

## Task-Specific Questions

1. Current conversion rate and goal?
2. Traffic source?
3. Signup/purchase flow after this page?
4. User research, heatmaps, or session recordings available?
5. What has been tried already?

---

## Related Skills

- **copywriting**: Page needs a complete copy rewrite
- **ab-test-setup**: Properly test recommended changes
- **brand-positioning**: Value proposition unclear upstream
- **analytics-tracking**: Measure impact of changes

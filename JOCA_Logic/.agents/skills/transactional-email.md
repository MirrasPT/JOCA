---
name: transactional-email
description: Router skill for transactional email. Routes to the appropriate provider sub-skill. Covers Postmark, Resend, and email deliverability patterns. Use when sending emails, setting up email infrastructure, handling bounces, or debugging email deliverability.
triggers: transactional email, email sending, postmark, resend, email api, bounce, deliverability, spf, dkim, dmarc, email template
---

# Transactional Email Router

## Decision Table

| Situation | Action |
|-----------|--------|
| Using Postmark or considering Postmark | Activate `transactional-email/postmark` |
| Using Resend + React Email (modern TS stack) | Use general knowledge (Resend skill not yet created) |
| General deliverability questions (SPF/DKIM/DMARC) | Activate `transactional-email/postmark` — deliverability section applies universally |

## How to Activate Sub-skills

```
Read(".claude/skills/SKILL.md")
```

## Universal Email Rules

1. **Queue sends** — never block API responses waiting for email delivery
2. **Always include `TextBody`** alongside `HtmlBody`
3. **SPF + DKIM + DMARC** must be configured on sending domain
4. **Process bounces immediately** — hard bounces must suppress, or provider will suspend account
5. **Unsubscribe link** required in all marketing/bulk emails (CAN-SPAM, GDPR)
6. **Log provider MessageID** to correlate delivery/bounce webhooks
7. **Separate transactional from marketing** — different sending reputation, different streams

## Provider Comparison

| Provider | Best for | Pricing model |
|----------|----------|---------------|
| Postmark | Reliable transactional, strict focus | Per email |
| Resend | Modern DX, React Email templates | Per email |
| SendGrid | High volume, marketing + transactional | Tiered |
| AWS SES | Cheapest at scale, more ops overhead | Per email |

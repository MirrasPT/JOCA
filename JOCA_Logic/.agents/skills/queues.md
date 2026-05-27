---
name: queues
description: "Router skill for job queues and background processing. MUST be invoked when the user says: queue, bullmq, background jobs, worker, job processing, task queue, inngest, trigger.dev. SHOULD also invoke when: celery, sidekiq, redis queue."
triggers: queue, bullmq, background jobs, worker, job processing, task queue, inngest, trigger.dev, celery, sidekiq, redis queue
---

# Queues Router

## Decision Table

| Situation | Action |
|-----------|--------|
| Node.js + Redis, BullMQ, self-hosted queues | Activate `queues/bullmq` |
| Serverless/managed queues (Inngest, Trigger.dev) | Use general knowledge |
| Laravel Horizon / Redis queues (PHP) | Activate `queues/horizon` |
| General background job patterns | Activate `queues/bullmq` -- patterns section applies broadly |

## Activate Sub-skills

```
Read(".claude/skills/SKILL.md")
Read(".claude/skills/SKILL.md")
```

## Universal Queue Rules

1. **Offload slow work** -- emails, image processing, webhooks, reports, AI calls go to queue
2. **Every job idempotent** -- safe to retry without side effects
3. **Retry with exponential backoff** -- 3-5 attempts, delays: 1s, 10s, 60s, 5min
4. **Dead letter queue** -- after max retries, retain failed jobs for investigation; never drop silently
5. **Small payloads** -- pass IDs and references, not full objects
6. **Separate queues by priority** -- `critical` (payments) / `default` (emails) / `low` (analytics)
7. **Monitor queue depth** -- alert on backlog; alert on failure spikes
8. **Respond fast, process async** -- API handler enqueues, worker processes

## Queue Solution Comparison

| Solution | Runtime | Hosting | Best for |
|----------|---------|---------|----------|
| **BullMQ** | Node.js | Self-hosted (Redis) | Production Node.js, full control |
| **Inngest** | Any (serverless) | Managed | Serverless, event-driven, complex workflows |
| **Trigger.dev** | Node.js | Managed/self-hosted | Long-running jobs, retries, scheduling |
| **Laravel Horizon** | PHP | Self-hosted (Redis) | Laravel apps -- see `queues/horizon` |
| **Sidekiq** | Ruby | Self-hosted (Redis) | Rails apps |

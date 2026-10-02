---
name: queues
description: "Job queues and background processing (owner skill): BullMQ on Node.js + Redis (code in reference/bullmq.md), Inngest, Trigger.dev, choosing a solution, retries, dead letter queues. Laravel queues and Horizon (PHP) go to the horizon skill. MUST be invoked when the user says: bullmq, bull mq, job queue, task queue, background jobs, redis queue, fila de jobs, jobs em background. SHOULD also invoke when: delayed jobs, jobs agendados, job retry, dead letter queue, queue monitoring, inngest, trigger.dev."
triggers: bullmq, bull mq, bull board, delayed jobs, jobs agendados, scheduled jobs, job retry, dead letter queue, queue monitoring, job queue, redis queue, task queue, background jobs, jobs em background, processar em background, fila de jobs, jobs assíncronos, processamento assíncrono, queue, worker, job processing, inngest, trigger.dev, celery, sidekiq
---

# Queues

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

## Decision Table

| Situation | Action |
|-----------|--------|
| Node.js + Redis, BullMQ, self-hosted queues | `Read(".claude/reference/bullmq.md")` — setup, workers, retries, DLQ, Bull Board, shutdown |
| Serverless/managed queues (Inngest, Trigger.dev) | Universal rules below + vendor docs |
| Laravel queues / Horizon (PHP) | `Read(".claude/skills/horizon.md")` — not this skill |
| General background job patterns | Universal rules below; code examples in `reference/bullmq.md` |

## Universal Queue Rules

1. **Offload slow work** -- emails, image processing, webhooks, reports, AI calls go to queue
2. **Every job idempotent** -- safe to retry without side effects
3. **Retry with exponential backoff** -- 3-5 attempts, delays: 1s, 10s, 60s, 5min
4. **Dead letter queue** -- after max retries, retain failed jobs for investigation; never drop silently
5. **Small payloads** -- pass IDs and references, not full objects
6. **Separate queues by priority** -- `critical` (payments) / `default` (emails) / `low` (analytics)
7. **Monitor queue depth** -- alert on backlog; alert on failure spikes
8. **Respond fast, process async** -- API handler enqueues, worker processes
9. **Graceful shutdown** -- workers finish the current job on SIGTERM before exiting

## Queue Solution Comparison

| Solution | Runtime | Hosting | Best for |
|----------|---------|---------|----------|
| **BullMQ** | Node.js | Self-hosted (Redis) | Production Node.js, full control -- `reference/bullmq.md` |
| **Inngest** | Any (serverless) | Managed | Serverless, event-driven, complex workflows |
| **Trigger.dev** | Node.js | Managed/self-hosted | Long-running jobs, retries, scheduling |
| **Laravel Horizon** | PHP | Self-hosted (Redis) | Laravel apps -- `horizon` skill |
| **Sidekiq** | Ruby | Self-hosted (Redis) | Rails apps |

---
name: bullmq
description: "Implement Redis-based job queues with BullMQ for Node.js. MUST be invoked when the user says: bullmq, bull mq, job queue, task queue, background jobs, worker, redis queue, job processing. SHOULD also invoke when: scheduled jobs, delayed jobs, job retry, dead letter queue, queue monitoring."
triggers: bullmq, bull mq, job queue, task queue, background jobs, worker, redis queue, job processing, scheduled jobs, delayed jobs, job retry, dead letter queue, queue monitoring
---

# BullMQ

Redis-based job queues for Node.js. Production-ready background processing.

## Setup

```bash
npm install bullmq ioredis
```

```ts
import { Queue, Worker, QueueEvents } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // required for BullMQ
});
```

## Basic Queue + Worker

```ts
// queues/email.queue.ts
import { Queue } from "bullmq";

export const emailQueue = new Queue("emails", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 }, // 1s, 2s, 4s
    removeOnComplete: { count: 100 },  // keep last 100 completed jobs
    removeOnFail: { count: 500 },      // keep last 500 failed jobs for inspection
  },
});

// Add a job
await emailQueue.add("send-welcome", { userId: "123", email: "user@example.com" });

// Delayed job (fires after 5 minutes)
await emailQueue.add("send-reminder", { userId: "123" }, { delay: 5 * 60 * 1000 });

// Priority job (lower = higher priority)
await emailQueue.add("send-receipt", { orderId: "456" }, { priority: 1 });
```

```ts
// workers/email.worker.ts
import { Worker, Job } from "bullmq";

const worker = new Worker("emails", async (job: Job) => {
  // Processor must be idempotent (safe to retry)
  switch (job.name) {
    case "send-welcome":
      await sendWelcomeEmail(job.data.userId);
      break;
    case "send-reminder":
      await sendReminderEmail(job.data.userId);
      break;
    case "send-receipt":
      await sendReceiptEmail(job.data.orderId);
      break;
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}, {
  connection,
  concurrency: 5,                 // process up to 5 jobs in parallel
  limiter: { max: 10, duration: 1000 }, // max 10 jobs/second
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
  // After maxAttempts, job moves to failed state (acts as DLQ)
});
```

## Queue Patterns

### Priority Queues (separate queues)

```ts
// Separate queues by priority with different concurrency
export const criticalQueue = new Queue("critical", { connection }); // payments
export const defaultQueue = new Queue("default", { connection });   // emails
export const lowQueue = new Queue("low", { connection });           // analytics, reports

const criticalWorker = new Worker("critical", processor, { connection, concurrency: 10 });
const defaultWorker = new Worker("default", processor, { connection, concurrency: 5 });
const lowWorker = new Worker("low", processor, { connection, concurrency: 2 });
```

### Repeatable Jobs (Cron)

```ts
// Runs every day at 9am UTC
await reportQueue.add(
  "daily-report",
  { type: "daily" },
  {
    repeat: { pattern: "0 9 * * *" }, // cron syntax
    jobId: "daily-report-unique",      // unique ID prevents duplicates
  }
);

// Remove a repeatable job
const repeatableJobs = await reportQueue.getRepeatableJobs();
const job = repeatableJobs.find(j => j.name === "daily-report");
if (job) await reportQueue.removeRepeatableByKey(job.key);
```

### Job Dependencies (Flow)

```ts
import { FlowProducer } from "bullmq";

const flow = new FlowProducer({ connection });

// Parent waits for all children to complete before processing
await flow.add({
  name: "process-order",
  queueName: "orders",
  data: { orderId: "123" },
  children: [
    { name: "charge-payment", queueName: "payments", data: { orderId: "123" } },
    { name: "reserve-inventory", queueName: "inventory", data: { orderId: "123" } },
    { name: "send-confirmation", queueName: "emails", data: { orderId: "123" } },
  ],
});
```

### Job Progress & Logging

```ts
const worker = new Worker("reports", async (job) => {
  const items = await fetchItems();

  for (let i = 0; i < items.length; i++) {
    await processItem(items[i]);
    // Update progress (0-100)
    await job.updateProgress(Math.round((i / items.length) * 100));
    // Log messages visible in Bull Board
    await job.log(`Processed item ${items[i].id}`);
  }
}, { connection });
```

## Retry Strategies

```ts
// Exponential backoff
const jobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000, // 1s, 2s, 4s, 8s, 16s
  },
};

// Custom backoff function
const jobOptions = {
  attempts: 5,
  backoff: {
    type: "custom",
  },
};

const worker = new Worker("queue", processor, {
  connection,
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Return delay in ms per attempt
      return [1000, 10000, 60000, 300000][attemptsMade - 1] ?? 300000;
    },
  },
});
```

## Dead Letter Queue Pattern

BullMQ has no built-in DLQ; failed jobs are retained instead:

```ts
// Check failed jobs (manual DLQ)
const failedJobs = await emailQueue.getFailed(0, 50);
for (const job of failedJobs) {
  console.log(`Failed job ${job.id}:`, job.failedReason);
  // Retry manually:
  await job.retry();
  // Or move to a separate queue for investigation:
  await deadLetterQueue.add(job.name, job.data, { ...job.opts });
  await job.remove();
}

// Auto-process DLQ events
const events = new QueueEvents("emails", { connection });
events.on("failed", async ({ jobId, failedReason }) => {
  await alerting.notify({ jobId, failedReason });
});
```

## Monitoring

### Queue Stats

```ts
const emailStats = await emailQueue.getJobCounts(
  "waiting", "active", "completed", "failed", "delayed", "paused"
);
// { waiting: 12, active: 3, completed: 1042, failed: 2, delayed: 5, paused: 0 }
```

### Bull Board (Web UI)

```bash
npm install @bull-board/hono @bull-board/api
```

```ts
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";

const serverAdapter = new HonoAdapter(serveStatic);
createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(criticalQueue),
  ],
  serverAdapter,
});

app.route("/admin/queues", serverAdapter.registerPlugin());
// Visit /admin/queues for the dashboard
```

## Graceful Shutdown

```ts
async function gracefulShutdown() {
  console.log("Shutting down workers...");

  // Stop accepting new jobs, wait for current to finish
  await Promise.all([
    worker.close(),
    otherWorker.close(),
  ]);

  await connection.quit();
  console.log("Workers stopped gracefully");
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
```

## Idempotency

Every job must be safe to run multiple times:

```ts
const worker = new Worker("payments", async (job) => {
  const { orderId } = job.data;

  // Check if already processed
  const existing = await db.payment.findUnique({
    where: { orderId, jobId: job.id },
  });
  if (existing) {
    console.log(`Payment for order ${orderId} already processed, skipping`);
    return { skipped: true };
  }

  // Process and record atomically
  await db.$transaction(async (tx) => {
    await tx.payment.create({ data: { orderId, jobId: job.id, status: "paid" } });
    await tx.order.update({ where: { id: orderId }, data: { status: "paid" } });
  });
}, { connection });
```

## Job Payload Best Practices

```ts
// Pass IDs, not full objects
await emailQueue.add("send-invoice", { userId: "123", invoiceId: "456" });

// Don't store full objects in Redis
await emailQueue.add("send-invoice", { user: { ...fullUserObject }, invoice: { ...fullInvoiceObject } });

// Worker fetches from DB as needed
const worker = new Worker("emails", async (job) => {
  const { userId, invoiceId } = job.data;
  const [user, invoice] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.invoice.findUnique({ where: { id: invoiceId } }),
  ]);
  await sendInvoiceEmail(user!, invoice!);
}, { connection });
```

## Quality Checklist

- [ ] All jobs have unique, traceable IDs
- [ ] Job payloads validated before processing
- [ ] Jobs are idempotent -- safe to run multiple times
- [ ] Retry strategy with exponential backoff
- [ ] Failed jobs retained for inspection (DLQ pattern)
- [ ] Concurrency limits set to prevent resource exhaustion
- [ ] Graceful shutdown implemented (SIGTERM/SIGINT)
- [ ] Queue depth monitored with alerts
- [ ] High-availability Redis (Sentinel or Cluster) in production
- [ ] Separate queues for critical/default/low priority work

## Avoid

- Non-idempotent jobs -- retries cause double processing
- Large job payloads -- store data in DB, pass IDs
- Unbounded concurrency -- exhausts DB connections and memory
- Slow tasks in API handlers -- respond fast, process async
- Missing `maxRetriesPerRequest: null` in Redis config (BullMQ requires it)

## Resources

- [BullMQ Docs](https://docs.bullmq.io)
- [BullMQ GitHub](https://github.com/taskforcesh/bullmq)
- [Bull Board UI](https://github.com/felixmosh/bull-board)
- [Redis Configuration](https://docs.bullmq.io/guide/connections)

<!-- Adapted from: https://github.com/0xfurai/claude-code-subagents (bullmq-expert.md) + https://github.com/YepAPI/skills (background-jobs) -->

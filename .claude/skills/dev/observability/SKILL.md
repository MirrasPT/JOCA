---
name: observability
description: Router skill for observability, error monitoring, logging, and application performance monitoring. Routes to Sentry for error tracking, or provides general observability guidance. Use when setting up error monitoring, debugging production issues, configuring alerts, tracing, or structured logging.
triggers: observability, error monitoring, logging, tracing, alerting, sentry, apm, production debug, stack trace, performance monitoring, structured logs
---

# Observability Router

## Decision Table

| Situation | Action |
|-----------|--------|
| Sentry errors, production bugs, triage exceptions, Sentry MCP | Activate `observability/sentry` |
| Sentry SDK setup, error capture, performance tracing | Activate `observability/sentry` |
| Structured JSON logging, correlation IDs, Monolog, Laravel Telescope, Sentry SDK, N+1 detection | Activate `observability/structured-logging` |
| Distributed tracing (OpenTelemetry) | Use general knowledge |
| Uptime/health checks | Use general knowledge |

## How to Activate Sub-skills

```
Read(".claude/skills/dev/observability/sentry/SKILL.md")
Read(".claude/skills/dev/observability/structured-logging/SKILL.md")
```

## Observability Pillars

| Pillar | Tools | Purpose |
|--------|-------|---------|
| **Logs** | Pino, Winston, Monolog | Debug, audit, event trail |
| **Metrics** | Prometheus, Datadog, CloudWatch | Counters, gauges, histograms |
| **Traces** | Sentry, OpenTelemetry, Jaeger | Request flow, span timing |
| **Errors** | Sentry, Rollbar, Bugsnag | Exception capture, triage |

## Logging Principles

- Structured JSON logs (not free-text) — easier to query
- Log at appropriate levels: `error` (needs action) / `warn` (investigate) / `info` (business events) / `debug` (development)
- Never log PII, passwords, or secrets
- Include correlation IDs (requestId, traceId, userId) in every log entry
- Log security events: failed logins, permission denials, suspicious input

---
name: wp-performance
description: "Profile and fix WordPress backend performance via WP-CLI profile/doctor, Server-Timing, Query Monitor headless. Invoke on: WordPress slow, TTFB alto, admin lento."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+). Backend-only agent; prefers WP-CLI (doctor/profile) when available."
---

# WP Performance (backend-only)

## When to use

- WordPress site/page/endpoint is slow (TTFB, admin, REST, WP-Cron)
- Need profiling plan and tooling (WP-CLI profile/doctor, Query Monitor, Xdebug/XHProf, APMs)
- Optimizing DB queries, autoloaded options, object caching, cron, or remote HTTP calls

No browser UI. Prefer WP-CLI, logs, and HTTP requests.

> **Reviewing code for anti-patterns?** Use `wp-performance-review` instead -- static analysis, file-type checks, grep patterns, structured output. Commands: `/wp-perf-review` (full) / `/wp-perf` (quick triage).

## Inputs required

- Environment and safety: dev/staging/prod, restrictions (no writes, no plugin installs).
- WP root `--path=<path>`, optionally `--url=<url>` for multisite.
- Performance symptom: which URL/REST route/admin screen, when it happens (always vs sporadic; logged-in vs logged-out).

## Procedure

### 0) Guardrails: measure first, avoid risky ops

1. Confirm whether write operations are allowed (plugin installs, config changes, cache flush).
2. Pick a reproducible target (URL or REST route) and capture baseline:
   - TTFB/time with `curl` if possible
   - WP-CLI profiling if available

### 1) Generate backend-only performance report (deterministic)

Verificar manualmente (o script perf_inspect não existe nesta instalação):

- WP-CLI availability and core version
- `wp doctor` / `wp profile` availability
- Autoloaded options size
- Object-cache drop-in presence

### 2) Fast wins: diagnostics before deep profiling

With WP-CLI access, prefer:

- `wp doctor check`

Catches common production issues (autoload bloat, SAVEQUERIES/WP_DEBUG, plugin counts, updates).

### 3) Deep profiling (no browser required)

Preferred order:

1. `wp profile stage` -- where time goes (bootstrap/main_query/template).
2. `wp profile hook` (optionally `--url=`) -- slow hooks/callbacks.
3. `wp profile eval` -- targeted code paths.

### 4) Query Monitor (backend-only usage)

Query Monitor works headlessly via REST API response headers and `_envelope` responses:

- Authenticate (nonce or Application Password).
- Inspect `x-qm-*` headers and/or `qm` property with `?_envelope`.

### 5) Fix by category (pick dominant bottleneck)

Use profile output to target *one* primary bottleneck:

- **DB queries** -- reduce count, fix N+1, improve indexes, avoid expensive meta queries.
- **Autoloaded options** -- identify largest autoloaded options, stop autoloading large blobs.
- **Object cache misses** -- add caching or fix cache key/group usage; add persistent object cache.
- **Remote HTTP calls** -- add timeouts, caching, batching; avoid per-request API calls.
- **Cron** -- reduce due-now spikes, de-duplicate events, move heavy tasks off request path.
- **Code-level anti-patterns** (hooks, assets, sessions, JS polling, meta queries).
- **Pre-launch / high-traffic prep**: load testing, traffic event prep.

### 6) Verify (repeat same measurement)

- Re-run `wp profile` / `wp doctor` / REST request.
- Confirm performance delta and unchanged behavior.
- If risky, ship behind feature flag or staged rollout.

## WordPress 6.9 performance improvements

Key 6.9 changes relevant to profiling:

**On-demand CSS for classic themes:**
- Classic themes now get on-demand CSS loading (previously block themes only).
- Reduces CSS payload 30-65% by loading styles only for blocks on page.

**Block themes with zero render-blocking resources:**
- Block themes without custom stylesheets (e.g. Twenty Twenty-Three/Four) load with zero render-blocking CSS.
- Styles from global styles (theme.json) and separate block styles, all inlined.
- Improves LCP significantly.

**Inline CSS limit increased:**
- Higher threshold for inlining small stylesheets reduces render-blocking resources.

Reference: https://make.wordpress.org/core/2025/11/18/wordpress-6-9-frontend-performance-field-guide/

## Verification

- Baseline vs after numbers captured (same environment, same URL/route).
- `wp doctor check` clean (or improved) when applicable.
- No new PHP errors or warnings in logs.
- No cache flush required for correctness (cache flush = last resort).

## Failure modes / debugging

- "No change" after code changes:
  - Measured different URL/site (`--url` mismatch), caches masked results, or opcode cache stale
- Noisy profiling data:
  - Eliminate background tasks, test with warmed caches, run multiple samples
- `SAVEQUERIES`/Query Monitor overhead:
  - Never run in production without explicit approval

## Escalation

- Production without explicit approval: do not install plugins, enable `SAVEQUERIES`, run load tests, or flush caches during traffic.
- System-level profiling (APM, PHP profiler extensions): coordinate with ops/hosting.

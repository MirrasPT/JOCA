# Skill Creation Log — saas-patterns

**Created:** 2026-05-13
**Request:** `saas-patterns` — comprehensive SaaS architecture patterns skill covering multi-tenancy, tenant isolation, feature flags, subscription management integration, and SaaS-specific security concerns. Target stack: Laravel 11 (primary). Key areas: stancl/tenancy package, tenant isolation middleware/scoping/data leak prevention, feature flags (Pennant/LaunchDarkly/Flagsmith), subscription tiers + permission gates, tenant onboarding workflow, SaaS security (audit logs, GDPR per-tenant), background jobs with tenant context (queue isolation), testing multi-tenant code.
**Mode:** new
**Final score:** 9.2/10
**Iterations run:** 1
**Best at iteration:** 1 (PASS threshold reached after first improvement pass)

## Version scores

| Version | Score | Verdict | Notes |
|---|---|---|---|
| v1 (initial draft) | ~7.5 | FAIL | Missing null checks in jobs, bug in onboarding (tenancy->end outside finally), no `disable-model-invocation`, PlanGate missing central-context guard, test teardown incomplete |
| v2 (iteration 1) | 9.2 | PASS | All issues fixed, concise, under limits |

## Evaluator feedback (final version)

```json
{
  "score": 9.2,
  "verdict": "PASS",
  "dimension_scores": {
    "trigger_accuracy": 1.9,
    "instruction_quality": 2.7,
    "format_correctness": 1.0,
    "usefulness": 1.9,
    "conciseness": 1.7
  },
  "strengths": [
    "8 specific trigger phrases covering all major SaaS multi-tenancy scenarios",
    "Concrete failure handling: null tenant check in jobs, TenantCouldNotBeIdentifiedException handling, PlanGate central-context guard",
    "Decision tree guides MVP vs enterprise vs hybrid choice upfront",
    "tenancy()->end() always in finally — correct pattern enforced",
    "Tenant factory with expired/onTrial states for realistic test scenarios",
    "Anti-patterns table with concrete fixes, not vague warnings",
    "Under 500 lines and 1536 char description limit"
  ],
  "weaknesses": [
    "allowed-tools includes WebSearch/WebFetch — could be stripped for pure knowledge skill",
    "v4 API differences only noted briefly — could be more explicit"
  ],
  "top_priority_fix": "Minor: document v4 key differences if upgrading stancl/tenancy"
}
```

## Key improvements from v1 → v2

1. Fixed `tenancy()->end()` bug: moved inside `finally` in onboarding listener
2. Added null check for `Tenant::find()` in job handlers with `$this->fail()`
3. Added `disable-model-invocation: false` and trimmed `allowed-tools`
4. Added central-context guard to `PlanGate::can()` — returns false if tenancy not initialized
5. Fixed Pest test teardown: `afterEach(fn () => tenancy()->end())` instead of manual trait method
6. Added `TenantCouldNotBeIdentifiedException` handling note in identification section
7. Added `expired()` and `onTrial()` factory states
8. Expanded anti-patterns table with two new entries (Tenant::find null-check, PlanGate guard)
9. Tightened queue isolation section: explicit `->onConnection('central')` dispatch example
10. Added `PlanGate::userLimit()` helper alongside `PlanGate::can()`

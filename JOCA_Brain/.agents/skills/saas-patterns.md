---
name: saas-patterns
description: "SaaS architecture patterns for Laravel 11 multi-tenant platforms. MUST be invoked when the user says: multi-tenancy Laravel, tenant isolation, feature flags SaaS, subscription tiers gate, tenant onboarding workflow, queue tenant context."
when_to_use: Activate for any multi-tenant SaaS on Laravel. Covers stancl/tenancy v3/v4, single-DB vs multi-DB vs hybrid, BelongsToTenant global scope, Laravel Pennant feature flags, Cashier subscription tiers, PlanGate helper, tenant-aware Horizon queues, per-tenant audit logs, GDPR export/delete, Pest isolation tests. Complementary to laravel-specialist.
disable-model-invocation: false
allowed-tools: Read WebSearch WebFetch
chain: tester-code, security-review
---

# SaaS Patterns -- Laravel 11 Multi-Tenant

Target: stancl/tenancy v3 (v4 differences noted). Laravel 11-first; patterns are framework-adaptable.

---

## 0. Strategy Decision Tree

```
MVP or early SaaS (< 500 tenants)?
├─ YES → Single DB + row-level (tenant_id). Start here always.
│         Upgrade path: add per-tenant DB for enterprise later (~2 sprints).
└─ NO → Enterprise/compliance required?
         ├─ YES → Multi-DB via stancl/tenancy automatic mode
         └─ NO → Hybrid: shared DB default, dedicated DB on-request for whales
```

Skip multi-DB unless compliance demands it on day one.

---

## Referências (carregar on-demand)

| Tema | Reference | Carregar quando |
|---|---|---|
| Tenancy setup (§1-3: install stancl, Tenant model, modos auto/manual, bootstrappers, identificação, isolamento `BelongsToTenant` + leak-prevention checklist) | `Read(".claude/reference/saas-patterns/tenancy-setup.md")` | montar tenancy, scoping, isolamento de dados |
| Onboarding + flags + billing (§4-6: `OnboardTenant` async, Pennant, PlanGate, Cashier) | `Read(".claude/reference/saas-patterns/onboarding-flags-billing.md")` | onboarding de tenant, feature flags, planos/limites/billing |
| Queues + segurança (§7-8: tenant context em jobs, queue isolation, Horizon, audit log, GDPR, security rules) | `Read(".claude/reference/saas-patterns/tenant-queues-security.md")` | jobs tenant-aware, audit, GDPR, rate limiting |
| Testes multi-tenant (§9: trait Pest, isolation test em CI, flag tests, factory) | `Read(".claude/reference/saas-patterns/testing.md")` | escrever testes de isolamento/flags |

---

## 10. Anti-Patterns

| Anti-pattern | Correct approach |
|---|---|
| Eloquent model in job constructor | Store only scalar IDs (`string $tenantId`) |
| `withoutGlobalScopes()` in tenant code | Central/admin only -- guard with `isSuperAdmin()` |
| Single queue connection for central + tenant | Separate connections; never mix |
| `tenancy()->end()` outside `finally` | Always `try { ... } finally { tenancy()->end(); }` |
| `Tenant::find()` result not null-checked | `$this->fail(...)` on null -- don't proceed |
| Tenant ID as integer in URLs | UUID or slug for all tenant-owned resources |
| Feature check scattered inline | `PlanGate::can()` or Policy -- one place |
| Sync tenant DB provisioning on creation | Always async via `OnboardTenant` job |
| Raw `DB::table()` without tenant filter | Eloquent + `BelongsToTenant` trait |
| Assuming tenancy initialized in PlanGate | Check `tenancy()->initialized` -- return false if not |

---

## References
- stancl/tenancy v3: https://tenancyforlaravel.com/docs/v3/
- Laravel Pennant: https://laravel.com/docs/pennant
- Laravel Cashier: https://laravel.com/docs/cashier
- Spatie multitenancy (alternative): https://spatie.be/docs/laravel-multitenancy/v4/

---

## Workflow

Pipeline sequence:

-> **antes**: `plan` -- arquitectura multi-tenant, single-DB vs multi-DB decision
-> **implementacao**: `laravel-specialist` (Eloquent, queues, auth) in parallel
-> **pos-setup**: `tester-code` -- cross-tenant data isolation
-> **security review**: `tester-security` -- tenant escape, data leakage
-> **auth SaaS**: `auth`

Notify on scaffold complete: `-> proximo: laravel-specialist`

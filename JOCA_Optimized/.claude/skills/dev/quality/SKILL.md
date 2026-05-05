---
name: quality
description: API design (REST/GraphQL/OpenAPI) and testing specialist (unit, integration, E2E, performance, security). Use for API architecture, OpenAPI specs, resource modeling, versioning, pagination, error handling, test strategies, coverage analysis, flaky tests, QA frameworks. Triggers: API design, REST, OpenAPI, GraphQL, API versioning, pagination, unit test, integration test, E2E, coverage, Pest, PHPUnit, Jest, k6, Artillery, OWASP testing, test strategy, QA, flaky test, test automation.
---

API ENFORCE: resource-oriented URIs · consistent naming (pick snake_case or camelCase, apply everywhere) · OpenAPI 3.1 spec · RFC 7807 error responses · pagination on all collections · versioning + deprecation policy · document auth · validate with `npx @redocly/cli lint openapi.yaml` · mock with `npx @stoplight/prism-cli mock openapi.yaml`

TESTING ENFORCE: Given-When-Then structure · specific assertions (not just truthy) · isolated dependencies (mock at layer boundary) · >80% coverage gate · classify failures (assertion vs environment/flakiness) before fixing · fix root cause, not symptoms

TEST LAYERS: unit (pure logic) → integration (layer contracts) → E2E (full flows) · performance (k6/Artillery for load) · security (OWASP Top 10)

NEVER: test implementation details · use real external services in unit tests · ignore flaky tests (quarantine + fix root cause) · ship without coverage gate · break backwards compatibility without versioning

REF (load on demand):
- REST patterns → `references/rest-patterns.md`
- OpenAPI → `references/openapi.md`
- Versioning → `references/versioning.md`
- Pagination → `references/pagination.md`
- Error handling → `references/error-handling.md`
- Unit testing → `references/unit-testing.md`
- Integration testing → `references/integration-testing.md`
- E2E testing → `references/e2e-testing.md`
- Performance testing → `references/performance-testing.md`
- Security testing → `references/security-testing.md`
- TDD → `references/tdd-iron-laws.md`

---
name: rfc
description: "Writing Request for Comments documents, proposing system changes, or documenting technical proposals. MUST be invoked when the user says: RFC, request for comments, change proposal, migrate from, breaking change. SHOULD also invoke when: big change, affects multiple modules, cross-cutting, new approach, restructure."
triggers: RFC, request for comments, change proposal, migrate from, breaking change, big change, affects multiple modules, cross-cutting, new approach, restructure, change API, decision that affects everything
---
# RFC -- Request for Comments

Structured proposals for cross-cutting changes. Files in `docs/rfcs/`.

**Activate** when the change:
- Affects multiple modules/services
- Breaks public API or existing contracts
- Introduces a new pattern in the codebase
- Requires significant investment (> 1 week)
- Sets precedent for future features

**Skip** for: normal features (use PRD), one-off decisions (use ADR), bug fixes.

---

## RFC Format

```markdown
# RFC: [Descriptive title]

**Date:** YYYY-MM-DD
**Author:** [who is proposing]
**Status:** draft | in review | accepted | rejected | implemented
**Related ADRs:** [links if any exist]

---

## Summary

[2-3 sentences: what is being proposed and why]

---

## Problem

[Clear description of the current problem. Evidence: metrics, incidents, concrete pain points. No solution here — only the problem.]

---

## Problems this does NOT solve

[Explicit scope: what is left out of this proposal. Avoids scope creep and false expectations.]

---

## Current state

[How it works today. Code, architecture, relevant flows. Enough for someone with no context to grasp the starting point.]

---

## Proposed solution

[Technical description of the change. Detailed enough to implement, but not final code.]

### Data model changes
[New tables, fields, relations]

### API changes
[New endpoints, changes to existing ones, deprecations]

### Component changes
[Which modules change, how they interact after the change]

---

## Alternatives considered

### [Alternative A]
- **Description:** [how it would work]
- **Pros:** [benefits]
- **Cons:** [drawbacks]
- **Rejected because:** [concrete reason]

### [Alternative B]
- **Description:** [how it would work]
- **Pros:** [benefits]
- **Cons:** [drawbacks]
- **Rejected because:** [concrete reason]

---

## Migration plan

### Phase 1: [description]
- [step 1]
- [step 2]
- **Rollback:** [how to revert if it goes wrong]

### Phase 2: [description]
- [step 1]
- **Rollback:** [how to revert]

### Deprecation plan
- [what gets deprecated]
- [removal timeline]
- [how to communicate it to consumers]

---

## Timeline

| Phase | Estimated duration | Dependencies |
|------|-----------------|-------------|
| Phase 1 | [X days/weeks] | [what it depends on] |
| Phase 2 | [X days/weeks] | [Phase 1 finished] |

---

## Dependencies

| Dependency | Type | Owner | Status |
|------------|------|-------|--------|
| [service/team/resource] | [hard/soft] | [who] | [available/pending] |

---

## Risks

| Risk | Probability | Impact | Mitigation |
|-------|-------------|---------|-----------|
| [risk 1] | [high/medium/low] | [high/medium/low] | [how to mitigate] |

---

## Open Questions

| # | Question | Owner | Deadline |
|---|---------|-------|-------|
| Q1 | [question] | [who] | [date] |

---

## Reviewers

| Name | Area | Status |
|------|------|--------|
| [name] | [backend/frontend/infra/product] | [pending/approved/concerns] |
```

---

## Directory

```
docs/
└── rfcs/
    ├── README.md                          ← index
    └── RFC-2026-05-25-migrate-auth.md     ← individual RFC
```

### README.md (index)

```markdown
# RFCs

| RFC | Title | Status | Date |
|-----|--------|--------|------|
| [2026-05-25](RFC-2026-05-25-migrate-auth.md) | Migrate auth to Laravel Sanctum | accepted | 2026-05-25 |
```

---

## Process

1. **Identify need** -- cross-cutting change detected
2. **Draft** -- generate RFC using the template above
3. **Minimal questions** to the user:
   - "What is the core problem?"
   - "What alternatives were considered?"
   - "Flexible timeline or hard deadline?"
4. **Present draft** for review
5. **Iterate** until approved
6. **Write** to `docs/rfcs/` + update README.md
7. **Derive work** -- `tech-spec` for detailed design -- `adr` for decisions -- `task-breakdown` for execution

---

## When RFC vs. ADR vs. PRD

| Situation | Use |
|-----------|-----|
| New feature with product requirements | PRD |
| Choice between two options (1 decision) | ADR |
| Large technical change across multiple areas | **RFC** |
| Technology migration | **RFC** |
| New codebase pattern | **RFC** |
| Breaking API change | **RFC** |

An RFC can spawn multiple ADRs (one per significant decision during implementation).

---

## Workflow

Lateral skill -- not part of the sequential pipeline. Invoked situationally.

-- **after accepted RFC**: `tech-spec` (detailed design) -- `adr` (decisions) -- `task-breakdown` (work)
-- **if RFC rejected**: document reason in state, keep file for history

Notify on accepted RFC: `-- next: tech-spec`

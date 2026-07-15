---
name: prd
description: "Generates and maintains PRD.md — living requirements doc optimised for Claude Code parsing. Activated by /init-project, updated by /save on scope changes. MUST be invoked when the user mentions: PRD, requirements doc, product spec."
metadata:
  type: skill
  category: base
chain: tech-spec
---

# PRD

## Activation

- Always on `/init-project` — ask if user wants PRD
- Explicit request: "create PRD", "requirements doc", "product spec"
- New feature or scope change without documentation
- `/save` when `PRD.md` exists and scope changed during session

---

## PRD.md Structure

Parsing rules: unique hierarchical headers. Atomic User Stories (1 per story). Acceptance Criteria as verifiable bullets. Constraints in separate section, never buried in prose.

```markdown
# PRD — [Project Name]

**Version:** 0.1
**Status:** Draft | In Development | Stable
**Updated:** [date]
**North Star Metric:** [1 metric proving product works]

---

## 1. Overview

### Problem
[1-3 sentences: what problem, for whom, with what evidence]

### Solution
[1-3 sentences: what product does — not how, what]

### Out of Scope
- [explicitly not in this version]

---

## 2. Success Metrics

**North Star:** [single metric defining success]

| Type | Metric | Baseline | Target | Deadline |
|------|--------|----------|--------|----------|
| Leading | [early indicator] | [current] | [target] | [date] |
| Lagging | [outcome metric] | [current] | [target] | [date] |

*Framework: AARRR | HEART | OKRs — pick one, stay consistent*

---

## 3. Target Users

| Persona | Description | Job-to-be-Done | Main Pain |
|---------|-------------|----------------|-----------|
| [P1] | [who] | When [situation], want [motivation], to [outcome] | [pain] |

---

## 4. Features

### MVP — P0 (required to launch)

| ID | Feature | Description | Persona |
|----|---------|-------------|---------|
| F1 | [name] | [what, not how] | [P] |

### Phase 2 — P1 (post-MVP)

| ID | Feature | Description | Persona |
|----|---------|-------------|---------|
| F-2-1 | [name] | [description] | [P] |

---

## 5. User Stories & Acceptance Criteria

Format: 1 story per item. AC in Given/When/Then. Include happy path + edge case + error state.

### [F1] [Feature Name]

**As** [persona], **I want** [action] **to** [benefit].

**AC:**
- Given [context], When [action], Then [expected result]
- Given [edge case], When [action], Then [error result]

---

## 6. Non-Functional Requirements

| Category | Requirement | Threshold | Priority |
|----------|-------------|-----------|----------|
| Performance | p95 response time | < 200ms | P0 |
| Security | Auth | [standard] | P0 |
| Accessibility | Standard | WCAG 2.1 AA | P1 |
| Reliability | Uptime | 99.9% | P0 |
| Maintainability | Test coverage | > 80% | P1 |

---

## 7. Technical Constraints

- Stack: [detected from project]
- [additional constraint — e.g. "must use existing API X"]
- [business constraint — e.g. "GDPR: no user data outside EU"]

---

## 8. Analytics & Telemetry

| Event | Properties | Purpose |
|-------|-----------|---------|
| [event_name] | [prop1, prop2] | [what it measures] |

Alert if [metric] < [threshold] for [period] → [action]

---

## 9. Phases & Timeline

| Phase | Deliverable | Done Criteria | Date |
|-------|-------------|---------------|------|
| Phase 0 | Design / PRD | PRD approved, prototype validated | [date] |
| Phase 1 | MVP | P0 features in prod, baseline metrics set | [date] |

---

## 10. Rollout

| Phase | Audience | Mechanism | Duration |
|-------|----------|-----------|----------|
| Alpha | Internal team | No flag | [X days] |
| Beta | [% early adopters] | Feature flag `[name]` | [X days] |
| GA | 100% | Remove flag | — |

Rollback: error rate > [X]% → auto rollback. [Critical metric] < [threshold] → pause.

---

## 11. Open Questions

| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| Q1 | [question] | [who] | [date/TBD] | Open |

---

## 12. Decision Log

| Date | Decision | Alternatives | Rationale |
|------|----------|-------------|-----------|
| [date] | [decision] | [alt A, alt B] | [why] |

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| [term] | [precise definition — eliminates ambiguity] |

---

## 14. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | [date] | ADDED: initial draft |

*Semantics: ADDED · CHANGED · REMOVED · DECIDED*
```

---

## Generation in /init-project

After Phase 1 (context gathered), before execution:

1. Ask with `AskUserQuestion`: "Generate PRD.md for this project?" → Yes / No
2. If yes, ask minimum questions not covered by questionnaire:
   - "Core problem this product solves? (1-2 sentences)"
   - "3 mandatory MVP features?"
   - "North Star Metric — number proving it works?"
   - "Main users and what they're trying to do?"
3. Generate `PRD.md` at project root with structure above
4. Add to project CLAUDE.md: `**PRD:** [PRD.md](PRD.md)`
5. Register in project memory: `**PRD:** PRD.md exists — update via prd skill on /save`

---

## PRD Updates

### Trigger criteria
- Feature implemented or discarded
- Scope change (in or out)
- Phase completed
- KPI or North Star redefined
- Open question answered → move to Decision Log
- Significant technical decision → register in Decision Log
- New constraint discovered

### Process
1. Read current `PRD.md`
2. Identify outdated sections (diagnosis in ≤ 3 lines)
3. Propose: "PRD outdated in: [sections]. Update?"
4. If yes: edit surgically, move resolved questions to Decision Log, increment version, update date, add History line

### Validation on /save

If `PRD.md` exists, check and alert (1 line per gap, don't block /save):
- P0 feature without Acceptance Criteria
- NFRs completely empty
- Open Questions without owner or deadline
- North Star Metric blank
- Missing Rollout plan for feature about to launch

---

## Alternative Formats

**Lean PRD (small features, < 1 week):**
Keep: Problem · Solution · User Stories + AC · Critical NFRs · Definition of Done.
Skip: Analytics, Rollout, Glossary, full Personas.

**Technical PRD (no PM, eng only):**
Emphasise: NFRs · Constraints · Decision Log · AC as tests.
Reduce: Personas, JTBD, business metrics.

---

## Workflow

Pipeline sequence:
→ after PRD generated: `prd-reviewer` agent — validates completeness + AI-parsability
→ after PRD approved: `plan` — technical architecture from requirements
→ continuous: re-run `prd-reviewer` after each major update

Notify on completion: `→ next: prd-reviewer`

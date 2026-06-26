# GStack Skills Analysis for JOCA Borrowing
## A1 Comparative Review: Review, Investigate, QA, QA-Only, DevEx-Review, Design-Review, Codex, Benchmark

---

## 1. /review — Pre-Landing PR Review

**What it does (1-2 sentences):**
Analyzes the current branch's diff against the base branch for structural issues: SQL safety, LLM trust boundary violations, conditional side effects, and other architectural smell. Produces before/after health scores and fix evidence.

**Mechanism / Notable Idea:**
- Detects platform (GitHub/GitLab) and base branch automatically
- **Scope drift detection**: checks stated intent (from TODOS.md, PR description, commit messages) against actual file changes — catches both scope creep and missing requirements
- Outputs structured report with findings, not prose
- Suggests /ship next or escalates to /investigate if deeper issues found
- **No auto-fix loop** — pure review; fixes are user-responsibility or suggested to other skills

**Borrowability for JOCA:**
**BORROW** — Scope drift detection is gold; JOCA already has code review but needs this "stated intent vs. actual diff" gate to avoid scope creep in autonomous workflows.

**JOCA mapping:**
→ Enhance security-review or codex-review with scope drift checking. Add a "intent capture" phase at skill start.

---

## 2. /investigate — Systematic Debugging with Root Cause Investigation

**What it does (1-2 sentences):**
Four-phase debugging: investigate (collect symptoms), analyze (trace code path), hypothesize (form root cause), implement (fix). **Iron law: no fixes without root cause.** Avoids whack-a-mole debugging.

**Mechanism / Notable Idea:**
- **Phase 1 collects symptoms** — error messages, stack traces, repro steps via ONE AskUserQuestion at a time (not a barrage)
- **Phase 2 reads code** — uses Grep to find all references, Read to understand logic
- **Checks recent changes** — git log --oneline -20 -- <files> to detect regressions
- **Checks investigation history** — queries prior learnings for patterns on same files (RECURRING BUGS = ARCHITECTURAL SMELL)
- **No fix without root cause** — blocks symptom fixes upfront
- **Escalation protocol** — after 3 failed attempts, escalates and logs via gstack-learnings-log

**Borrowability for JOCA:**
**BORROW — CRITICAL** — This is the "iron law" enforcement JOCA needs. Autonomous debug loops fail when they fix symptoms. This skill's "check prior learnings on same files" pattern is architectural leverage.

**JOCA mapping:**
→ Core to log-debugger and query-debugger. Use Phase 1-2 structure for **skill chaining**: /investigate → /review (check scope) → auto-fix skill (if safe).

---

## 3. /qa — Systematically QA Test a Web Application and Fix Bugs Found

**What it does (1-2 sentences):**
Runs QA testing, then **iteratively fixes bugs in source code**, committing each fix atomically and re-verifying. Produces health scores (before/after), fix evidence, and ship-readiness summary. Uses browse daemon.

**Mechanism / Notable Idea:**
- **Parse tier parameter** — Quick (critical/high only), Standard (+ medium), Exhaustive (+ cosmetic)
- **Check working tree** — STOP if dirty; asks user to commit or stash first (ensures atomic fix commits)
- **Browse + click everything** — real user testing, fill every form, check every state
- **BUG FIND → CODE FIX → COMMIT → RE-VERIFY loop**: atomically commits each bug fix, then re-verifies
- **Proactively suggest** when user says "does this work?"
- **Diff-aware mode** — auto-detects feature branch, focuses on changed areas
- **Iterative fixes** — not a one-pass; loops until no more bugs above tier

**Borrowability for JOCA:**
**BORROW — HIGHEST PRIORITY** — This is the **test-fix-verify loop with atomic commits** that JOCA's autonomous workflows MUST replicate. The "check working tree" gate and "atomic commit per fix" discipline is architectural gold.

**JOCA mapping:**
→ Merge into tester-ui-ux as a **unified test+fix skill**. Use the "parse tier parameter" and "iterative loop" structure for tester-code/tester-api as well.

---

## 4. /qa-only — Report-Only QA Testing

**What it does (1-2 sentences):**
Systematically tests a web application and produces structured report with health score, screenshots, repro steps — **NEVER fixes anything**. Browse-based.

**Mechanism / Notable Idea:**
- Mirrors /qa setup and testing, but zero mutations
- Read-only output; pairs with /qa when user wants "just tell me what's broken"
- Useful as a checkpoint — run /qa-only before /qa to assess scope of work

**Borrowability for JOCA:**
**JÁ-TEM** — This is a variant of existing tester skills; JOCA already has "report-only" modes. Lower priority.

---

## 5. /devex-review — Live Developer Experience Audit

**What it does (1-2 sentences):**
**Actually TESTS the developer experience** — navigates docs, tries getting-started flow, times TTHW (time to hello world), screenshots error messages, evaluates CLI help text. Produces DX scorecard with evidence.

**Mechanism / Notable Idea:**
- Browse tool to REALLY TRY onboarding (not just read docs)
- Timing measurements (TTHW)
- Screenshots of error messages, help output
- Compares against /plan-devex-review scores if they exist (the "boomerang": plan said 3 min, reality says 8 min)
- Proactively invoke after shipping developer-facing feature

**Borrowability for JOCA:**
**JÁ-TEM / SKIP** — JOCA doesn't have explicit DX review, but the concept is niche. Lower priority than test-fix loops.

---

## 6. /design-review — Designer's Eye QA: Find Visual Issues, Then Fix Them

**What it does (1-2 sentences):**
Iteratively **fixes issues in source code** with atomic commits and before/after screenshots. Finds visual inconsistency, spacing issues, hierarchy problems, AI slop patterns, slow interactions — then fixes.

**Mechanism / Notable Idea:**
- **Check DESIGN.md** if exists; all decisions calibrated against project's design system (deviations = higher severity)
- **Check working tree** — STOP if dirty; same gate as /qa
- **Browse + visual inspection** — exacting standards on typography, spacing, hierarchy, zero tolerance for generic/AI-generated-looking
- **FIX → ATOMIC COMMIT → RE-VERIFY with screenshots**: iterative loop like /qa
- **Produces before/after evidence** — screenshots prove the fix
- **Proactively suggest** when user mentions visual inconsistencies or wants polish

**Borrowability for JOCA:**
**BORROW** — The "fix → atomic commit → re-verify with visual proof" pattern is excellent. JOCA has design-review but can adopt this iterative discipline and the "check DESIGN.md calibration" pattern.

**JOCA mapping:**
→ Enhance design-review with **atomic-commit discipline** and **screenshot proof** loop. Add "read DESIGN.md for calibration" phase.

---

## 7. /codex — OpenAI Codex CLI Wrapper: Three Modes

**What it does (1-2 sentences):**
Independent diff review via Codex (different AI = second opinion), adversarial challenge mode (try to break the code), or open consultation mode with session continuity. Pass/fail gate for code review mode.

**Mechanism / Notable Idea:**
- Wraps external Codex CLI binary
- **Three invocation modes**: review (pass/fail gate), challenge (adversarial), consult (open Q&A)
- Codex described as "200 IQ autistic developer" — direct, terse, technically precise, challenges assumptions
- **Checks Codex binary & auth** before expensive prompts
- **Dry-run or plan-mode safe** — no mutations, just review/consult

**Borrowability for JOCA:**
**JÁ-TEM / SKIP** — JOCA has codex-review skill already. This is a wrapper; lower novelty.

---

## 8. /benchmark — Performance Regression Detection

**What it does (1-2 sentences):**
Establishes baselines for page load times, Core Web Vitals, resource sizes. Compares before/after on every PR. Tracks performance trends over time via browse daemon + JavaScript evaluation.

**Mechanism / Notable Idea:**
- Browse daemon's perf command + JavaScript performance.getEntriesByType() API
- **Baseline capture mode** — run before changes to set baseline
- **Comparison mode** — current metrics vs. baseline; thresholds for REGRESSION (>50% OR >500ms) and WARNING (>20%)
- **Trend analysis** — historical baselines show performance degradation over time
- **Resource analysis** — slowest resources, bundle size checks, performance budget checks
- **Purely read-only** — measures, doesn't modify code

**Borrowability for JOCA:**
**SKIP** — Pure measurement/reporting. JOCA has tester-performance but doesn't need Codex-style "second opinion" for performance. Measurement-only, lower priority.

---

## Summary Table

| Skill | What it does | BORROW? | JOCA Mapping |
|-------|-------------|---------|-------------|
| review | Pre-landing PR review + scope drift detection | **BORROW** | Enhance codex-review with scope drift |
| investigate | Root cause investigation (iron law: no fixes without root cause) | **BORROW — CRITICAL** | Core to log-debugger, adds "prior learnings" check |
| qa | Test → Fix → Verify loop, atomic commits, tiers | **BORROW — HIGHEST** | Merge into tester-ui-ux, replicate for tester-code/api |
| qa-only | Report-only testing | JÁ-TEM | Already has variants |
| devex-review | Live DX audit (TTHW, screenshots) | JÁ-TEM / SKIP | Niche; lower priority |
| design-review | Visual issues + atomic-fix loop + screenshots | **BORROW** | Enhance design-review with discipline + proof |
| codex | Second-opinion code review wrapper | JÁ-TEM | Skill already exists |
| benchmark | Performance baseline + regression detection | SKIP | Measurement-only; lower priority |

---

## Top 3 BORROW Candidates (Highest Leverage for JOCA Autonomy)

### 1. **/qa — Test → Fix → Verify with Atomic Commits**
**Why**: This is the **archetypal autonomous loop** — find bug, fix code, commit atomically, re-verify. Non-negotiable for JOCA to scale to zero-human-touch workflows. The "check working tree" gate and "iterate until no more bugs above tier" discipline is structural.

**Mechanism to steal**:
- Parse tier parameter (quick/standard/exhaustive)
- Gate: if dirty working tree, ask user to commit/stash (enforces hygiene)
- Loop: find bug → edit code → test → commit → re-verify
- Use browse daemon for real testing

### 2. **/investigate — Iron Law + Prior Learnings Check**
**Why**: Prevents JOCA from entering fix-symptom whack-a-mole hell. The "check prior learnings for patterns on same files" is architectural: **recurring bugs = architecture smell**. This unlocks escalation (when 3 attempts fail, escalate and log).

**Mechanism to steal**:
- Four phases: investigate → analyze → hypothesize → implement
- Gate: "no fix without root cause" — blocks symptom fixes upfront
- Check ~/.gstack/projects/{SLUG}/learnings.jsonl for prior investigations on same files
- Escalation protocol: after 3 attempts, fail explicitly + log + offer architectural review

### 3. **/design-review — Atomic-Fix Loop with Visual Proof**
**Why**: The JOCA design-review skill exists but lacks discipline. This version adds **atomic commits + before/after screenshots** as proof. The "read DESIGN.md for calibration" pattern is excellent — deviations from stated design system = higher severity.

**Mechanism to steal**:
- Gate: if dirty, commit first (same as /qa)
- Loop: find visual issue → fix CSS/HTML → screenshot → commit → re-screenshot → compare
- Read DESIGN.md (if exists) and calibrate severity against stated system
- Proactively invoke on "visual inconsistency" or "polish" mention

---

## Chaining Implications for JOCA Autonomy

The three BORROW candidates form a **natural skill chain**:

1. **User says "fix this bug"** → invoke /investigate (root cause gate)
2. /investigate discovers it's a code bug → chain to /qa or /tester-code (test-fix-verify)
3. /qa or test-fix skill auto-commits each fix, loops until clean
4. **If design issue surfaces** → chain to /design-review (visual + atomic commits)
5. **At end, invoke /review** (scope drift check) to ensure no scope creep

This is **maximum autonomy**: the user says one thing, the JOCA orchestrates the full pipeline without manual intervention between skills.

---

## Not Stolen (and Why)

- **/qa-only**: Already have report-only modes; variant, not novel
- **/devex-review**: Niche (DX audits); not on critical path
- **/codex**: Wrapper; /codex-review already exists in JOCA
- **/benchmark**: Measurement-only; lower ROI than fix loops
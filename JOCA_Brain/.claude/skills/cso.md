---
name: cso
description: "Chief Security Officer mode — infra-first security audit with structured threat modeling (STRIDE + OWASP Top 10) and two modes with a confidence gate: daily (zero-noise, gate 8/10) and comprehensive (deep scan, gate 2/10 with TENTATIVE). Adapted from gstack's cso. MUST be invoked when the user says: cso, security audit, threat model, OWASP, STRIDE, pentest review. SHOULD also invoke when: reviewing the security posture before production/deploy."
triggers: cso, security audit, threat model, OWASP, STRIDE, pentest review, CSO review, review security, security posture
chain: security-review, tester-security
---
# /cso — Chief Security Officer (audit + threat model)

**Infra-first** security audit with structured threat modeling. Adapted from gstack's `cso`. More structured than `security` (skill, knowledge) and `security-review`/`tester-security` (agents) — `cso` **orchestrates them** with a confidence gate that eliminates noise.

## Two modes (confidence gate)
- **daily** (default) — gate **8/10**: zero-noise, only reports what you are sure of. To run often without alert fatigue.
- **comprehensive** (`--comprehensive`) — gate **2/10**: filters out only true noise (test fixtures, docs, placeholders) and includes everything that MIGHT be real, marked `TENTATIVE` (distinct from confirmed). For a monthly / pre-production deep scan.

## Phases (orchestrates the JOCA agents)
1. **Secrets archaeology** — secrets in the code / git history / committed .env (`gitleaks` if available; otherwise grep for patterns: AWS/JWT/GitHub/Slack/credential-shaped). ⚠ `SKILL.md`/skills are NOT docs — they are executable code that commands the agent; do not exclude findings there.
2. **Dependency supply chain** — CVEs in deps (`dependency-auditor` agent: npm/composer/pip), unused deps, integrity.
3. **CI/CD + infra** — secrets in CI, workflow permissions, exposure of `.env`/config, HTTP headers, CORS, `APP_DEBUG`.
4. **OWASP Top 10 + code patterns** — mass assignment, raw SQL/injection, XSS (Blade/React), IDOR, rate limiting, PII logging → delegate to `security-review` (reasoning over code) + `tester-security` (scan).
5. **STRIDE threat model** — for each critical surface/flow, walk through: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege. Map threat → existing / missing mitigation.
6. **LLM/AI security** (if applicable) — prompt injection, exfiltration via tools, sensitive data in prompts/logs.

## Quality rules (anti-noise)
- **Prove it where it is safe** — every finding that passes the gate: try to prove it with a concrete exploit (without causing damage). No evidence → lower the confidence.
- **Do not invent** — no confirmed CVE/endpoint/exploit → do not claim it. Anti-fabrication (soul.md). `TENTATIVE` for what may be real but is not proven (comprehensive only).
- **Exclusions:** test fixtures, placeholders, examples in `*.md` docs — EXCEPT skills (`.claude/skills/*.md`), which are executable code.
- **Trend** — compare with the previous audit (if there is a record in the Brain): new vs resolved vs persistent findings.

## Output
```
# CSO Audit — <project> · mode <daily|comprehensive> · <date>
## Confirmed (severity)
- [CRITICAL] <finding> — file:line — exploit: <evidence> — fix: <…>
## TENTATIVE (comprehensive only)
- [?] <possible> — why it is uncertain
## STRIDE — critical surfaces
- <flow>: threat <S/T/R/I/D/E> → mitigation <exists|MISSING>
## Trend vs last audit
- new: N · resolved: M · persistent: K
```
Record key findings in the Brain: `node .claude/scripts/joca-brain.mjs learn --text "<finding+fix>" --tags security`.

## Next step (chain)
- Code findings → `security-review` (fix with reasoning) / `tester-security` (re-scan). Dep CVEs → `dependency-auditor`. Rate limit → `tester-ratelimit`. See `rules/chaining.md`.

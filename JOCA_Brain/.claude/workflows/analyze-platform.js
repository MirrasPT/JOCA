export const meta = {
  name: 'analyze-platform',
  description: 'Total analysis of a platform: 8 audit lenses in parallel, adversarial verification of the findings and a consolidated report',
  whenToUse: 'When the user asks for a complete analysis/audit of a platform or codebase (bugs, security, performance, dead code, production readiness). Args: { path, nome?, reportDir?, lentes?, dataISO? }',
  phases: [
    { title: 'Recon', detail: 'map the stack and surfaces of the project' },
    { title: 'Audit', detail: '8 read-only lenses in parallel' },
    { title: 'Verification', detail: 'adversarial refutation of Critical/High' },
    { title: 'Synthesis', detail: 'dedupe + ranking + report in docs/' },
  ],
}

// ── parameters ───────────────────────────────────────────────────────────────
// args.path      (mandatory) root of the project, e.g. '<YOUR_PROJECTS_DIR>/my-platform'
// A.nome      (optional) human name of the platform for the report
// A.reportDir (optional) where to write the report (default: <path>/docs)
// A.lentes    (optional) subset of lens keys to run (default: all)
// A.dataISO   (optional) date for the report header (Date.now does not exist in workflows)
// The runtime may hand args over as a JSON string — normalize before using.
const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
if (!A.path) {
  throw new Error("args.path missing — invoke with { path: '<project root>' }")
}
const ROOT = String(A.path).replace(/\\/g, '/')
const NOME = A.nome ?? ROOT.split('/').filter(Boolean).pop()
const REPORT_DIR = (A.reportDir ?? ROOT + '/docs').replace(/\\/g, '/')
const DATA = A.dataISO ?? 'sem-data'

// ── rules common to ALL the agents (soul.md hard limits + audit lessons) ──
const REGRAS = `
MANDATORY RULES:
- READ-ONLY: do not edit any file, do not run commands that change state (no migrate/seed/install/commit).
- NEVER fabricate paths, APIs or facts. Every finding has to cite a real file:line that YOU read.
- NEGATIVE CLAIMS ("X does not exist", "there is no Y") require evidence: state the exact grep command you ran and that returned 0 results. Without that, do not report the claim.
- Missing a credential/endpoint? Report "not verifiable" — never invent.
- Distinguish: a real bug (with repro) vs a deliberate decision (look for TODO/parked/decision comments before classifying it as a bug).
- Severities: Critical (loss of money/data/access), High (broken functionality), Medium (real degradation), Low (polish).
`

// ── audit lenses ─────────────────────────────────────────────────────────────
const LENTES = [
  {
    key: 'backend-correctness',
    prompt: `Audit the BACKEND of ${NOME} in ${ROOT} looking for correctness bugs: money edge cases (totals, discounts, commissions, VAT, refunds), race conditions (check-then-act without a lock, concurrent webhooks), authorization/IDOR (endpoints without authorize/scoping), mass assignment, null-safety, missing transactions. Focus on controllers, services and domain models. ${REGRAS}`,
  },
  {
    key: 'frontend-runtime',
    prompt: `Audit the FRONTEND of ${NOME} in ${ROOT} looking for runtime bugs: badly handled error/loading states (eternal skeleton, a silent error presented as empty), mutation race conditions (shared busy state, double-submit), missing cache invalidations, end-to-end broken flows (referenced routes that do not exist, email links with no page), null-safety. ${REGRAS}`,
  },
  {
    key: 'security',
    prompt: `Audit the SECURITY of ${NOME} in ${ROOT} (OWASP): exposure of secrets in the code/config, APP_DEBUG and the like, CORS, rate limiting on the sensitive flows (auth, checkout, public submissions), webhook validation (signatures), tokens/sessions (fixation, cookies), XSS (rendering raw HTML), SQL injection (raw queries), file upload, personal data in logs. ${REGRAS}`,
  },
  {
    key: 'performance',
    prompt: `Audit the PERFORMANCE of ${NOME} in ${ROOT}: N+1 queries (loops with queries, relations without eager loading), missing indexes for frequent queries (compare the migrations with the where/orderBy of the controllers), excessive payloads (endpoints without pagination, get() without a limit), frontend bundle (heavy imports outside lazy, duplicate dependencies), avoidable re-renders with a real cost. Only report problems with a plausible impact in production — no micro-optimizations. ${REGRAS}`,
  },
  {
    key: 'dead-code',
    prompt: `Audit DEAD CODE and OVER-ENGINEERING in ${NOME} in ${ROOT}: exports/components/methods with no consumers (check by grepping for real usage, not by intuition), routes with no handler or handlers with no route, copy-paste duplication between files, single-use abstractions. WARNING: methods/relations resolved by STRING (e.g. Filament ->relationship('x'), dynamic config) look orphaned but are not — classify them as "reported, not deletable". External integrations and mobile apps may consume non-obvious surfaces. ${REGRAS}`,
  },
  {
    key: 'admin-coverage',
    prompt: `Audit the ADMIN COVERAGE of ${NOME} in ${ROOT}: for each feature the end user has (frontend pages/actions), check whether the internal admin/backoffice can SEE and INTERVENE when operationally relevant (approve, cancel, adjust, reply, audit). Flag concrete gaps "the client can X but the admin cannot Y". Prioritize by operational support impact. ${REGRAS}`,
  },
  {
    key: 'production-readiness',
    prompt: `Audit the PRODUCTION READINESS of ${NOME} in ${ROOT}, reading config/env/code (never assume): payment gateways (sandbox vs live, what is missing to go live), invoicing/integrations (stub vs real — look for commented-out HTTP calls), email (real driver vs log), queues and scheduler (driver + what needs a worker/cron on the server), legacy data migration (does the tooling exist? has it been run?), RGPD (export/deletion of personal data), deploy (Dockerfile/CI/scripts), monitoring. Classify each item: ready / partial (what is missing) / non-existent. ${REGRAS}`,
  },
  {
    key: 'ux-a11y',
    prompt: `Audit UX/ACCESSIBILITY of ${NOME} in ${ROOT} by reading the code: labels/aria in critical forms (login, checkout, submissions), focus management in modals/drawers (trap, Escape, restore), touch targets and mobile patterns (sidebars without a toggle, fixed widths > 320px, flex inputs without min-w-0), empty states vs error states that are indistinguishable, actionable error texts. Focus on the money and registration flows first. ${REGRAS}`,
  },
]

const lentesActivas = Array.isArray(A.lentes) && A.lentes.length > 0
  ? LENTES.filter((l) => A.lentes.includes(l.key))
  : LENTES

// ── schemas ──────────────────────────────────────────────────────────────────
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'file', 'evidence'],
        properties: {
          title: { type: 'string', description: 'one sentence: the defect' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string', description: 'file:line cited' },
          evidence: { type: 'string', description: 'code excerpt or grep output that proves the finding' },
          repro: { type: 'string', description: 'how to reproduce / concrete failure scenario' },
          fixDirection: { type: 'string', description: 'fix direction in 1-2 sentences' },
        },
      },
    },
    verifiedSolid: { type: 'array', items: { type: 'string' }, description: 'areas checked and OK (so as not to re-audit them)' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reasoning'],
  properties: {
    refuted: { type: 'boolean', description: 'true if the finding does NOT hold up in the real code' },
    reasoning: { type: 'string', description: '2-3 sentences: why, with file:line' },
    severityAdjust: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'keep'], description: 'corrected severity, or keep' },
  },
}

// ── Phase 1: Recon ───────────────────────────────────────────────────────────
phase('Recon')
log(`Analyzing ${NOME} (${ROOT}) with ${lentesActivas.length} lenses`)

const recon = await agent(
  `Quickly map the project in ${ROOT} (READ-ONLY): stack (languages/frameworks/versions from the manifests), top-level folder structure with the role of each one, entry points (routes/pages), where controllers/services/models/tests live, and visible external integrations (payments, email, APIs). Be concise — this is orientation context for other auditors, not an audit. ${REGRAS}`,
  {
    label: 'recon:stack',
    schema: {
      type: 'object',
      required: ['stack', 'mapa'],
      properties: {
        stack: { type: 'string' },
        mapa: { type: 'string', description: 'structure + where what is, in compact markdown' },
        integracoes: { type: 'string' },
      },
    },
  },
)

const contexto = recon
  ? `\n\nPROJECT CONTEXT (from the recon):\nStack: ${recon.stack}\n${recon.mapa}\nIntegrations: ${recon.integracoes ?? '—'}`
  : ''

// ── Phases 2+3: Audit → Verification (pipeline, no barrier) ───────────────
// Each lens verifies its own Critical/High as soon as it finishes — without waiting for the others.
const porLente = await pipeline(
  lentesActivas,
  (lente) => agent(lente.prompt + contexto, { label: `audit:${lente.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA }),
  async (resultado, lente) => {
    if (!resultado) return { key: lente.key, findings: [], solid: [] }
    const graves = resultado.findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
    const leves = resultado.findings.filter((f) => f.severity !== 'critical' && f.severity !== 'high')
    // Adversarial verification: a skeptic tries to REFUTE each Critical/High in the real code.
    const verificados = await parallel(
      graves.map((f) => () =>
        agent(
          `You are a skeptic. Try to REFUTE this audit finding in the REAL code in ${ROOT} — read the cited files and around them. Finding: "${f.title}" (${f.severity}) in ${f.file}. Alleged evidence: ${f.evidence}. Scenario: ${f.repro ?? '—'}. Consider: is the behavior deliberate (TODO/parked/decision comment)? does the evidence support the conclusion? is the severity exaggerated? If you cannot refute it BASED on the code, refuted=false. ${REGRAS}`,
          { label: `verify:${lente.key}:${(f.file ?? '').split('/').pop()}`, phase: 'Verification', schema: VERDICT_SCHEMA },
        ).then((v) => ({ ...f, verdict: v })),
      ),
    )
    const confirmados = verificados
      .filter(Boolean)
      .filter((f) => f.verdict && !f.verdict.refuted)
      .map((f) => ({ ...f, severity: f.verdict.severityAdjust && f.verdict.severityAdjust !== 'keep' ? f.verdict.severityAdjust : f.severity }))
    const refutados = verificados.filter(Boolean).filter((f) => f.verdict?.refuted)
    log(`[${lente.key}] ${resultado.findings.length} findings → ${confirmados.length} severe confirmed, ${refutados.length} refuted, ${leves.length} med/low`)
    return { key: lente.key, findings: [...confirmados, ...leves], refutados, solid: resultado.verifiedSolid ?? [] }
  },
)

// ── Phase 4: Synthesis ─────────────────────────────────────────────────────────
phase('Synthesis')
const todas = porLente.filter(Boolean)
const totalFindings = todas.reduce((n, l) => n + l.findings.length, 0)
const totalRefutados = todas.reduce((n, l) => n + (l.refutados?.length ?? 0), 0)
log(`${totalFindings} final findings (${totalRefutados} refuted in verification) — synthesizing`)

const dump = todas
  .map((l) => `## Lens: ${l.key}\n` + l.findings
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.title} — ${f.file}\n  Evidence: ${f.evidence}\n  Repro: ${f.repro ?? '—'}\n  Fix: ${f.fixDirection ?? '—'}${f.verdict ? `\n  Verified: ${f.verdict.reasoning}` : ''}`)
    .join('\n'))
  .join('\n\n')
const solidDump = todas.flatMap((l) => l.solid.map((s) => `- [${l.key}] ${s}`)).join('\n')

const sintese = await agent(
  `Synthesize this audit of ${NOME} into a final report in English. Dedupe findings repeated across lenses (same file+problem = 1 entry, note the lenses that saw it). Order by severity and, within it, by impact on money/data > functionality > the rest. Structure: (1) Overall verdict in 3-4 sentences; (2) table of counts by severity and lens; (3) Critical/High findings with evidence+repro+fix; (4) compact Medium/Low; (5) "Verified solid — do not re-audit"; (6) recommended next steps in order. WRITE the complete report to the file ${REPORT_DIR}/platform-analysis-${DATA}.md (use the Write tool) and return only an executive summary of ~12 lines.\n\nFINDINGS:\n${dump}\n\nSOLID:\n${solidDump}`,
  { label: 'synthesis:report', phase: 'Synthesis', agentType: 'general-purpose' },
)

return {
  relatorio: `${REPORT_DIR}/platform-analysis-${DATA}.md`,
  resumo: sintese,
  contagens: todas.map((l) => ({ lente: l.key, achados: l.findings.length, refutados: l.refutados?.length ?? 0 })),
}

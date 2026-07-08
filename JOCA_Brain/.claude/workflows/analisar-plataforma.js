export const meta = {
  name: 'analisar-plataforma',
  description: 'Análise total de uma plataforma: 8 lentes de auditoria em paralelo, verificação adversarial dos achados e relatório consolidado',
  whenToUse: 'Quando o Renato pede uma análise/auditoria completa de uma plataforma ou codebase (bugs, segurança, performance, código morto, prontidão de produção). Args: { path, nome?, reportDir?, lentes?, dataISO? }',
  phases: [
    { title: 'Recon', detail: 'mapear stack e superfícies do projecto' },
    { title: 'Auditoria', detail: '8 lentes read-only em paralelo' },
    { title: 'Verificação', detail: 'refutação adversarial de Critical/High' },
    { title: 'Síntese', detail: 'dedupe + ranking + relatório em docs/' },
  ],
}

// ── parâmetros ───────────────────────────────────────────────────────────────
// args.path      (obrigatório) raiz do projecto, ex. 'D:/Mega/Livro_De_Elogios/2026_Nova_Plataforma'
// A.nome      (opcional) nome humano da plataforma para o relatório
// A.reportDir (opcional) onde escrever o relatório (default: <path>/docs)
// A.lentes    (opcional) subset de chaves de lente para correr (default: todas)
// A.dataISO   (opcional) data para o cabeçalho do relatório (Date.now não existe em workflows)
// O runtime pode entregar args como string JSON — normalizar antes de usar.
const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
if (!A.path) {
  throw new Error("args.path em falta — invocar com { path: '<raiz do projecto>' }")
}
const ROOT = String(A.path).replace(/\\/g, '/')
const NOME = A.nome ?? ROOT.split('/').filter(Boolean).pop()
const REPORT_DIR = (A.reportDir ?? ROOT + '/docs').replace(/\\/g, '/')
const DATA = A.dataISO ?? 'sem-data'

// ── regras comuns a TODOS os agentes (hard limits do soul.md + lições de auditoria) ──
const REGRAS = `
REGRAS OBRIGATÓRIAS:
- READ-ONLY: não edites nenhum ficheiro, não corras comandos que alterem estado (nada de migrate/seed/install/commit).
- NUNCA fabriques paths, APIs ou factos. Cada achado tem de citar ficheiro:linha real que TU leste.
- CLAIMS NEGATIVOS ("X não existe", "não há Y") exigem evidência: indica o comando grep exacto que correste e que devolveu 0 resultados. Sem isso, não reportes o claim.
- Falta-te uma credencial/endpoint? Reporta "não verificável" — nunca inventes.
- Distingue: bug real (com repro) vs decisão deliberada (procura comentários TODO/parked/decisão antes de classificar como bug).
- Severidades: Critical (perda de dinheiro/dados/acesso), High (funcionalidade partida), Medium (degradação real), Low (polimento).
`

// ── lentes de auditoria ──────────────────────────────────────────────────────
const LENTES = [
  {
    key: 'backend-correctness',
    prompt: `Audita o BACKEND de ${NOME} em ${ROOT} à procura de bugs de correcção: edge cases de dinheiro (totais, descontos, comissões, IVA, reembolsos), race conditions (check-then-act sem lock, webhooks concorrentes), autorização/IDOR (endpoints sem authorize/scoping), mass assignment, null-safety, transacções em falta. Foca-te em controllers, services e models de domínio. ${REGRAS}`,
  },
  {
    key: 'frontend-runtime',
    prompt: `Audita o FRONTEND de ${NOME} em ${ROOT} à procura de bugs de runtime: estados de erro/loading mal tratados (skeleton eterno, erro silencioso apresentado como vazio), race conditions de mutations (busy state partilhado, double-submit), invalidações de cache em falta, fluxos quebrados fim-a-fim (rotas referenciadas que não existem, links de email sem página), null-safety. ${REGRAS}`,
  },
  {
    key: 'security',
    prompt: `Audita a SEGURANÇA de ${NOME} em ${ROOT} (OWASP): exposição de segredos no código/config, APP_DEBUG e afins, CORS, rate limiting nos fluxos sensíveis (auth, checkout, submissões públicas), validação de webhooks (assinaturas), tokens/sessões (fixation, cookies), XSS (render de HTML cru), SQL injection (raw queries), upload de ficheiros, dados pessoais em logs. ${REGRAS}`,
  },
  {
    key: 'performance',
    prompt: `Audita a PERFORMANCE de ${NOME} em ${ROOT}: N+1 queries (loops com queries, relações sem eager loading), índices em falta para queries frequentes (compara migrations com where/orderBy dos controllers), payloads excessivos (endpoints sem paginação, get() sem limite), bundle frontend (imports pesados fora de lazy, dependências duplicadas), re-renders evitáveis com custo real. Só reporta problemas com impacto plausível em produção — nada de micro-optimizações. ${REGRAS}`,
  },
  {
    key: 'dead-code',
    prompt: `Audita CÓDIGO MORTO e OVER-ENGINEERING em ${NOME} em ${ROOT}: exports/componentes/métodos sem consumidores (verifica por grep de uso real, não por intuição), rotas sem handler ou handlers sem rota, duplicação copy-paste entre ficheiros, abstracções de uso único. ATENÇÃO: métodos/relações resolvidos por STRING (ex.: Filament ->relationship('x'), config dinâmica) parecem órfãos mas não são — classifica-os como "reportado, não apagável". Integrações externas e apps mobile podem consumir superfícies não óbvias. ${REGRAS}`,
  },
  {
    key: 'admin-coverage',
    prompt: `Audita a COBERTURA DO ADMIN de ${NOME} em ${ROOT}: para cada funcionalidade que o utilizador final tem (páginas/acções do frontend), verifica se o admin/backoffice interno consegue VER e INTERVIR quando operacionalmente relevante (aprovar, cancelar, ajustar, responder, auditar). Sinaliza gaps concretos "o cliente pode X mas o admin não consegue Y". Prioriza por impacto operacional de suporte. ${REGRAS}`,
  },
  {
    key: 'production-readiness',
    prompt: `Audita a PRONTIDÃO PARA PRODUÇÃO de ${NOME} em ${ROOT}, lendo config/env/código (nunca assumir): gateways de pagamento (sandbox vs live, o que falta para ligar), facturação/integrações (stub vs real — procura chamadas HTTP comentadas), email (driver real vs log), filas e scheduler (driver + o que precisa de worker/cron no servidor), migração de dados legacy (tooling existe? foi corrido?), RGPD (export/eliminação de dados pessoais), deploy (Dockerfile/CI/scripts), monitorização. Classifica cada item: pronto / parcial (o que falta) / inexistente. ${REGRAS}`,
  },
  {
    key: 'ux-a11y',
    prompt: `Audita UX/ACESSIBILIDADE de ${NOME} em ${ROOT} por leitura de código: labels/aria em forms críticos (login, checkout, submissões), focus management em modais/drawers (trap, Escape, restore), touch targets e padrões mobile (sidebars sem toggle, larguras fixas > 320px, inputs flex sem min-w-0), estados vazios vs estados de erro indistinguíveis, textos de erro accionáveis. Foca nos fluxos de dinheiro e de registo primeiro. ${REGRAS}`,
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
          title: { type: 'string', description: 'uma frase: o defeito' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string', description: 'ficheiro:linha citado' },
          evidence: { type: 'string', description: 'excerto de código ou output de grep que prova o achado' },
          repro: { type: 'string', description: 'como reproduzir / cenário de falha concreto' },
          fixDirection: { type: 'string', description: 'direcção de correcção em 1-2 frases' },
        },
      },
    },
    verifiedSolid: { type: 'array', items: { type: 'string' }, description: 'áreas verificadas e OK (para não re-auditar)' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reasoning'],
  properties: {
    refuted: { type: 'boolean', description: 'true se o achado NÃO se sustenta no código real' },
    reasoning: { type: 'string', description: '2-3 frases: porquê, com ficheiro:linha' },
    severityAdjust: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'keep'], description: 'severidade corrigida, ou keep' },
  },
}

// ── Fase 1: Recon ────────────────────────────────────────────────────────────
phase('Recon')
log(`A analisar ${NOME} (${ROOT}) com ${lentesActivas.length} lentes`)

const recon = await agent(
  `Mapeia rapidamente o projecto em ${ROOT} (READ-ONLY): stack (linguagens/frameworks/versões dos manifests), estrutura de pastas de topo com o papel de cada uma, pontos de entrada (rotas/páginas), onde vivem controllers/services/models/testes, e integrações externas visíveis (pagamentos, email, APIs). Sê conciso — isto é contexto de orientação para outros auditores, não uma auditoria. ${REGRAS}`,
  {
    label: 'recon:stack',
    schema: {
      type: 'object',
      required: ['stack', 'mapa'],
      properties: {
        stack: { type: 'string' },
        mapa: { type: 'string', description: 'estrutura + onde está o quê, em markdown compacto' },
        integracoes: { type: 'string' },
      },
    },
  },
)

const contexto = recon
  ? `\n\nCONTEXTO DO PROJECTO (do recon):\nStack: ${recon.stack}\n${recon.mapa}\nIntegrações: ${recon.integracoes ?? '—'}`
  : ''

// ── Fases 2+3: Auditoria → Verificação (pipeline, sem barreira) ──────────────
// Cada lente verifica os seus Critical/High assim que termina — sem esperar pelas outras.
const porLente = await pipeline(
  lentesActivas,
  (lente) => agent(lente.prompt + contexto, { label: `audit:${lente.key}`, phase: 'Auditoria', schema: FINDINGS_SCHEMA }),
  async (resultado, lente) => {
    if (!resultado) return { key: lente.key, findings: [], solid: [] }
    const graves = resultado.findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
    const leves = resultado.findings.filter((f) => f.severity !== 'critical' && f.severity !== 'high')
    // Verificação adversarial: um céptico tenta REFUTAR cada Critical/High no código real.
    const verificados = await parallel(
      graves.map((f) => () =>
        agent(
          `És um céptico. Tenta REFUTAR este achado de auditoria no código REAL em ${ROOT} — lê os ficheiros citados e à volta. Achado: "${f.title}" (${f.severity}) em ${f.file}. Evidência alegada: ${f.evidence}. Cenário: ${f.repro ?? '—'}. Considera: o comportamento é deliberado (TODO/parked/comentário de decisão)? a evidência sustenta a conclusão? a severidade é exagerada? Se não conseguires refutar COM base no código, refuted=false. ${REGRAS}`,
          { label: `verify:${lente.key}:${(f.file ?? '').split('/').pop()}`, phase: 'Verificação', schema: VERDICT_SCHEMA },
        ).then((v) => ({ ...f, verdict: v })),
      ),
    )
    const confirmados = verificados
      .filter(Boolean)
      .filter((f) => f.verdict && !f.verdict.refuted)
      .map((f) => ({ ...f, severity: f.verdict.severityAdjust && f.verdict.severityAdjust !== 'keep' ? f.verdict.severityAdjust : f.severity }))
    const refutados = verificados.filter(Boolean).filter((f) => f.verdict?.refuted)
    log(`[${lente.key}] ${resultado.findings.length} achados → ${confirmados.length} graves confirmados, ${refutados.length} refutados, ${leves.length} med/low`)
    return { key: lente.key, findings: [...confirmados, ...leves], refutados, solid: resultado.verifiedSolid ?? [] }
  },
)

// ── Fase 4: Síntese ──────────────────────────────────────────────────────────
phase('Síntese')
const todas = porLente.filter(Boolean)
const totalFindings = todas.reduce((n, l) => n + l.findings.length, 0)
const totalRefutados = todas.reduce((n, l) => n + (l.refutados?.length ?? 0), 0)
log(`${totalFindings} achados finais (${totalRefutados} refutados na verificação) — a sintetizar`)

const dump = todas
  .map((l) => `## Lente: ${l.key}\n` + l.findings
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.title} — ${f.file}\n  Evidência: ${f.evidence}\n  Repro: ${f.repro ?? '—'}\n  Fix: ${f.fixDirection ?? '—'}${f.verdict ? `\n  Verificado: ${f.verdict.reasoning}` : ''}`)
    .join('\n'))
  .join('\n\n')
const solidDump = todas.flatMap((l) => l.solid.map((s) => `- [${l.key}] ${s}`)).join('\n')

const sintese = await agent(
  `Sintetiza esta auditoria de ${NOME} num relatório final em PT-PT. Dedupe achados repetidos entre lentes (mesmo ficheiro+problema = 1 entrada, nota as lentes que o viram). Ordena por severidade e, dentro dela, por impacto em dinheiro/dados > funcionalidade > resto. Estrutura: (1) Veredicto global em 3-4 frases; (2) tabela de contagens por severidade e lente; (3) achados Critical/High com evidência+repro+fix; (4) Medium/Low compactos; (5) "Verificado sólido — não re-auditar"; (6) próximos passos recomendados em ordem. ESCREVE o relatório completo no ficheiro ${REPORT_DIR}/analise-plataforma-${DATA}.md (usa a tool Write) e devolve só um resumo executivo de ~12 linhas.\n\nACHADOS:\n${dump}\n\nSÓLIDO:\n${solidDump}`,
  { label: 'síntese:relatório', phase: 'Síntese', agentType: 'general-purpose' },
)

return {
  relatorio: `${REPORT_DIR}/analise-plataforma-${DATA}.md`,
  resumo: sintese,
  contagens: todas.map((l) => ({ lente: l.key, achados: l.findings.length, refutados: l.refutados?.length ?? 0 })),
}

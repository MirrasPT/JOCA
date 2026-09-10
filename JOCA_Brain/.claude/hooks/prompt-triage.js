#!/usr/bin/env node
// UserPromptSubmit hook — triage of the request on every turn.
//
// The previous version was a blind nudge: it always injected the same sentence ("classify the task")
// without looking at the request. A constant, identical reminder stops being read — and it said NOTHING
// about the concrete request, so the decision to escalate was left entirely to the judgement of the moment.
//
// This version reads the prompt and counts objective signals: independent parts of work, domains
// involved, marks of scale. It returns a concrete recommendation with the reason. The model still
// decides — the hook neither blocks nor forces — but it decides with data instead of with a slogan.
//
// Rule calibrated by the user: from 2 independent parts on, it is worth parallelizing.
// Fail-silent, always exit 0: an error here can never stop the turn.

const PARALLEL_THRESHOLD = 2;   // independent parts from which a fan-out is recommended

// Domains with a dedicated execution agent (.claude/agents/<x>-agent.md). Word → domain.
const DOMAINS = {
  frontend: ['frontend', 'react', 'ui', 'interface', 'componente', 'component', 'tailwind', 'css', 'shadcn', 'landing', 'página', 'pagina', 'page'],
  backend: ['backend', 'api', 'endpoint', 'laravel', 'servidor', 'server', 'base de dados', 'database', 'mysql', 'queue', 'fila', 'webhook', 'auth', 'login'],
  design: ['design', 'mockup', 'visual', 'layout', 'cor', 'cores', 'color', 'colors', 'paleta', 'palette', 'tipografia', 'typography', 'logo', 'ícone', 'icone', 'icon', 'animação', 'animacao', 'animation'],
  content: ['copy', 'texto', 'text', 'conteúdo', 'conteudo', 'content', 'artigo', 'article', 'post', 'newsletter', 'email', 'seo', 'traduz', 'translate', 'escreve', 'write'],
  deploy: ['deploy', 'publicar', 'publish', 'vps', 'servidor', 'server', 'docker', 'cpanel', 'dns', 'produção', 'producao', 'production'],
  wordpress: ['wordpress', 'wp', 'gutenberg', 'plugin', 'woocommerce', 'elementor'],
  shopify: ['shopify', 'liquid', 'loja', 'store'],
  testing: ['teste', 'testes', 'test', 'vitest', 'phpunit', 'cobertura', 'coverage'],
};

// Marks that the request contains MORE THAN ONE thing to do.
const SPLIT_MARKERS = [
  /\be\s+(?:também|tambem|depois|a seguir|ainda)\b/gi,
  /\band\s+(?:also|then|next|too)\b/gi,
  /\b(?:além disso|alem disso|para além|para alem|e ainda|e depois)\b/gi,
  /\b(?:besides|in addition|furthermore|and also|and then)\b/gi,
  /\b(?:primeiro|segundo|terceiro|por fim|finalmente)\b/gi,
  /\b(?:first|second|third|lastly|finally)\b/gi,
  /^\s*[-*•]\s+/gm,              // bullets
  /^\s*\d+[.)]\s+/gm,            // numbered lists
  /;/g,                          // a semicolon separates work clauses
];

// Scale: the same work repeated in N places is the most profitable case for a fan-out.
const SCALE_MARKERS = /\b(?:todos|todas|cada|várias|varias|vários|varios|em todo|por todo|uma a uma|um a um|all|every|each|several|throughout|one by one)\b/gi;

// Signals that REQUIRE a plan before executing (rules/task-intake.md → "Plan before executing").
// Irreversible arms it on its own; large scope arms it by itself.
const IRREVERSIBLE_MARKERS = /\b(?:migration|migrations|migrate|migra|deploy|deployar|publicar|publish|produção|producao|production|apaga|apagar|delete|elimina|eliminar|remove|drop|reset|force[- ]push|pagamento|pagamentos|payment|payments|stripe|checkout|auth|autenticação|autenticacao|authentication)\b/i;
const SCOPE_MARKERS = /\b(?:feature|funcionalidade|plataforma|platform|refactor|refactoriza|refatoriza|reestrutura|restructure|arquitectura|arquitetura|architecture|migrar|integra|integrar|integrate|do zero|de raiz|from scratch)\b/i;

// Requests that are NOT work: questions, decisions, conversation. Escalating here is a waste.
const QUESTION_START = /^\s*(?:o que|qual|quais|quando|onde|porque|porquê|porque|como|quem|será|sera|achas|podes explicar|explica|mostra|lista|vale a pena|devo|posso|what|which|when|where|why|how|who|is it|is it worth|do you think|can you explain|explain|show|list|should i|can i)\b/i;

// Action verbs. They serve to tell TWO JOBS apart from ONE job that happens to mention
// vocabulary from two domains: "refactor the login component in react" touches frontend and
// backend in the lexicon, but has a single verb — it is one task, not two.
const ACTION_VERBS = /\b(?:cria|criar|create|faz|fazer|make|muda|mudar|change|altera|alterar|actualiza|actualizar|atualiza|update|escreve|escrever|write|refactoriza|refatoriza|refactor|adiciona|adicionar|add|remove|remover|apaga|apagar|delete|corrige|corrigir|fix|implementa|implementar|implement|instala|instalar|install|configura|configurar|configure|testa|testar|test|publica|publicar|publish|traduz|traduzir|translate|migra|migrar|migrate|integra|integrar|integrate|optimiza|otimiza|optimize|revê|rever|review|constrói|constroi|build|gera|gerar|generate)\b/gi;

function analyse(prompt) {
  const text = (prompt || '').trim();
  if (!text) return null;

  const words = text.split(/\s+/).length;

  // Domains mentioned, ordered by how many keywords each one hit: when a sentence
  // touches several domains in the lexicon ("login component in react"), the dominant one is what matters.
  const lower = text.toLowerCase();
  const scored = Object.entries(DOMAINS)
    .map(([d, kws]) => [d, kws.filter((k) => lower.includes(k)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const domains = scored.map(([d]) => d);

  // Independent parts
  let splits = 0;
  for (const re of SPLIT_MARKERS) splits += (text.match(re) || []).length;

  const scale = (text.match(SCALE_MARKERS) || []).length > 0;
  const isQuestion = QUESTION_START.test(text) || (text.includes('?') && words < 30);

  // A short question is conversation, not work — do not escalate.
  if (isQuestion && splits === 0 && !scale) {
    return { via: 'directa', motivo: 'question with no decomposable work' };
  }

  const actions = (text.match(ACTION_VERBS) || []).length;

  // Independent parts. Explicit split marks ("and also", bullets) are direct evidence.
  // Distinct domains only count as separate parts if there is more than one action requested or
  // an explicit split — otherwise it is one task that mentions vocabulary from several sides.
  const domainParts = (actions >= 2 || splits > 0) ? domains.length : 1;
  const parts = Math.max(splits > 0 ? splits + 1 : 0, domainParts);

  if (scale) {
    return {
      via: 'fan-out',
      motivo: `work repeated in several places${domains.length ? ` (${domains.join(', ')})` : ''}`,
      sugestao: 'one agent per place or file, in parallel',
      domains,
    };
  }

  if (parts >= PARALLEL_THRESHOLD) {
    return {
      via: 'fan-out',
      motivo: `${parts} independent parts${domains.length > 1 ? ` in ${domains.length} domains (${domains.join(', ')})` : ''}`,
      sugestao: domains.length > 1
        ? `dispatch ${domains.map((d) => `${d}`).join(' + ')} in parallel`
        : 'dispatch the parts in parallel',
      domains,
    };
  }

  // Only one task, but with an identified domain → the skill of that domain must be read all the same.
  if (domains.length >= 1) {
    return { via: 'skill-ou-agente', motivo: `single domain (${domains[0]})`, domains };
  }

  return { via: 'directa', motivo: 'small, indivisible work' };
}

// Attaches the plan reason to the triage result (null-safe; the route does not change).
function comPlano(a, irreversivel, scopeGrande) {
  if (!a) return a;
  if (irreversivel) a.plano = 'irreversible action detected';
  else if (a.via === 'fan-out') a.plano = 'fan-out: file boundaries per agent';
  else if (scopeGrande) a.plano = 'feature/architecture scope';
  return a;
}

try {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    let prompt = '';
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      prompt = payload.prompt || payload.user_prompt || '';
    } catch { /* no usable payload → generic nudge */ }

    const a = comPlano(analyse(prompt), IRREVERSIBLE_MARKERS.test(prompt), SCOPE_MARKERS.test(prompt));
    let context;

    if (!a) {
      context = '[task-intake] Classify before answering: direct / skill / agent / fan-out (rules/task-intake.md).';
    } else if (a.via === 'fan-out') {
      context = `[task-intake] Signal: ${a.motivo}. → Worth a fan-out: ${a.sugestao}. `
        + `Dispatch the agents IN A SINGLE turn (parallel in fact). `
        + `Execution agents by domain: .claude/agents/<skill>-agent.md. `
        + `If you decide to do it inline, that is a valid choice — but make it deliberately.`;
    } else if (a.via === 'skill-ou-agente') {
      context = `[task-intake] Signal: ${a.motivo}. → Read the domain skill before writing code; `
        + `if the work is isolable and long, dispatch <skill>-agent instead of doing it inline.`;
    } else {
      context = `[task-intake] Signal: ${a.motivo}. → Answer directly; do not escalate.`;
    }

    // Plan gate: it is added to the route signal, it does not replace it.
    if (a && a.plano) {
      context += ` [plan] ${a.plano} → write the visible plan (objective · files per agent · `
        + `success criterion) BEFORE the first Write/Agent. rules/task-intake.md.`;
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
    }));
    process.exit(0);
  });
  // If stdin never closes, do not hang the turn.
  setTimeout(() => { try { process.stdout.write('{}'); } catch (_) {} process.exit(0); }, 1500).unref?.();
} catch (_) {
  process.exit(0);
}

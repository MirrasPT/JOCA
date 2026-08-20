#!/usr/bin/env node
// UserPromptSubmit hook — triagem do pedido a cada turno.
//
// A versão anterior era um nudge cego: injectava sempre a mesma frase ("classifica a tarefa") sem
// olhar para o pedido. Um lembrete constante e idêntico deixa de ser lido — e não dizia NADA sobre
// o pedido concreto, portanto a decisão de escalar ficava inteiramente ao critério do momento.
//
// Esta versão lê o prompt e conta sinais objectivos: partes de trabalho independentes, domínios
// envolvidos, marcas de escala. Devolve uma recomendação concreta com o motivo. Continua a ser o
// modelo a decidir — o hook não bloqueia nem obriga — mas decide com dados em vez de com um slogan.
//
// Regra calibrada pelo utilizador: a partir de 2 partes independentes, vale a pena paralelizar.
// Fail-silent, exit 0 sempre: um erro aqui nunca pode impedir o turno.

const PARALLEL_THRESHOLD = 2;   // partes independentes a partir das quais se recomenda fan-out

// Domínios com agente de execução dedicado (.claude/agents/<x>-agent.md). Palavra → domínio.
const DOMAINS = {
  frontend: ['frontend', 'react', 'ui', 'interface', 'componente', 'component', 'tailwind', 'css', 'shadcn', 'landing', 'página', 'pagina', 'page'],
  backend: ['backend', 'api', 'endpoint', 'laravel', 'servidor', 'server', 'base de dados', 'database', 'mysql', 'queue', 'fila', 'webhook', 'auth', 'login'],
  design: ['design', 'mockup', 'visual', 'layout', 'cor', 'cores', 'paleta', 'tipografia', 'logo', 'ícone', 'icone', 'animação', 'animacao'],
  conteúdo: ['copy', 'texto', 'conteúdo', 'conteudo', 'artigo', 'post', 'newsletter', 'email', 'seo', 'traduz', 'escreve'],
  deploy: ['deploy', 'publicar', 'vps', 'servidor', 'docker', 'cpanel', 'dns', 'produção', 'producao'],
  wordpress: ['wordpress', 'wp', 'gutenberg', 'plugin', 'woocommerce', 'elementor'],
  shopify: ['shopify', 'liquid', 'loja'],
  testes: ['teste', 'testes', 'test', 'vitest', 'phpunit', 'cobertura'],
};

// Marcas de que o pedido contém MAIS DO QUE UMA coisa a fazer.
const SPLIT_MARKERS = [
  /\be\s+(?:também|tambem|depois|a seguir|ainda)\b/gi,
  /\b(?:além disso|alem disso|para além|para alem|e ainda|e depois)\b/gi,
  /\b(?:primeiro|segundo|terceiro|por fim|finalmente)\b/gi,
  /^\s*[-*•]\s+/gm,              // bullets
  /^\s*\d+[.)]\s+/gm,            // listas numeradas
  /;/g,                          // ponto e vírgula separa cláusulas de trabalho
];

// Escala: o mesmo trabalho repetido em N sítios é o caso mais rentável de fan-out.
const SCALE_MARKERS = /\b(?:todos|todas|cada|várias|varias|vários|varios|em todo|por todo|uma a uma|um a um)\b/gi;

// Sinais que EXIGEM plano antes de executar (rules/task-intake.md → "Plano antes de executar").
// Irreversível sozinho activa; scope grande activa por si.
const IRREVERSIBLE_MARKERS = /\b(?:migration|migrations|migrate|migra|deploy|deployar|publicar|produção|producao|apaga|apagar|elimina|eliminar|drop|reset|force[- ]push|pagamento|pagamentos|payment|stripe|checkout|auth|autenticação|autenticacao)\b/i;
const SCOPE_MARKERS = /\b(?:feature|funcionalidade|plataforma|refactor|refactoriza|refatoriza|reestrutura|arquitectura|arquitetura|migrar|integra|integrar|do zero|de raiz)\b/i;

// Pedidos que NÃO são trabalho: perguntas, decisões, conversa. Escalar aqui é desperdício.
const QUESTION_START = /^\s*(?:o que|qual|quais|quando|onde|porque|porquê|porque|como|quem|será|sera|achas|podes explicar|explica|mostra|lista|vale a pena|devo|posso)\b/i;

// Verbos de acção. Servem para distinguir DOIS TRABALHOS de UM trabalho que por acaso menciona
// vocabulário de dois domínios: "refactoriza o componente de login em react" toca frontend e
// backend no léxico, mas tem um só verbo — é uma tarefa, não duas.
const ACTION_VERBS = /\b(?:cria|criar|faz|fazer|muda|mudar|altera|alterar|actualiza|actualizar|atualiza|escreve|escrever|refactoriza|refatoriza|adiciona|adicionar|remove|remover|apaga|apagar|corrige|corrigir|implementa|implementar|instala|instalar|configura|configurar|testa|testar|publica|publicar|traduz|traduzir|migra|migrar|integra|integrar|optimiza|otimiza|revê|rever|constrói|constroi|gera|gerar)\b/gi;

function analyse(prompt) {
  const text = (prompt || '').trim();
  if (!text) return null;

  const words = text.split(/\s+/).length;

  // Domínios mencionados, ordenados por quantas palavras-chave cada um acertou: quando uma frase
  // toca vários domínios no léxico ("componente de login em react"), o dominante é o que interessa.
  const lower = text.toLowerCase();
  const scored = Object.entries(DOMAINS)
    .map(([d, kws]) => [d, kws.filter((k) => lower.includes(k)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const domains = scored.map(([d]) => d);

  // Partes independentes
  let splits = 0;
  for (const re of SPLIT_MARKERS) splits += (text.match(re) || []).length;

  const scale = (text.match(SCALE_MARKERS) || []).length > 0;
  const isQuestion = QUESTION_START.test(text) || (text.includes('?') && words < 30);

  // Uma pergunta curta é conversa, não trabalho — não escalar.
  if (isQuestion && splits === 0 && !scale) {
    return { via: 'directa', motivo: 'pergunta sem trabalho decomponível' };
  }

  const actions = (text.match(ACTION_VERBS) || []).length;

  // Partes independentes. Marcas de divisão explícitas ("e também", bullets) são prova directa.
  // Domínios distintos só contam como partes separadas se houver mais do que uma acção pedida ou
  // uma divisão explícita — caso contrário é uma tarefa que menciona vocabulário de vários lados.
  const domainParts = (actions >= 2 || splits > 0) ? domains.length : 1;
  const parts = Math.max(splits > 0 ? splits + 1 : 0, domainParts);

  if (scale) {
    return {
      via: 'fan-out',
      motivo: `trabalho repetido em vários sítios${domains.length ? ` (${domains.join(', ')})` : ''}`,
      sugestao: 'um agente por sítio ou ficheiro, em paralelo',
      domains,
    };
  }

  if (parts >= PARALLEL_THRESHOLD) {
    return {
      via: 'fan-out',
      motivo: `${parts} partes independentes${domains.length > 1 ? ` em ${domains.length} domínios (${domains.join(', ')})` : ''}`,
      sugestao: domains.length > 1
        ? `despachar ${domains.map((d) => `${d}`).join(' + ')} em paralelo`
        : 'despachar as partes em paralelo',
      domains,
    };
  }

  // Uma tarefa só, mas com domínio identificado → a skill desse domínio deve ser lida na mesma.
  if (domains.length >= 1) {
    return { via: 'skill-ou-agente', motivo: `domínio único (${domains[0]})`, domains };
  }

  return { via: 'directa', motivo: 'trabalho pequeno e indivisível' };
}

// Anexa o motivo de plano ao resultado da triagem (null-safe; a via não muda).
function comPlano(a, irreversivel, scopeGrande) {
  if (!a) return a;
  if (irreversivel) a.plano = 'acção irreversível detectada';
  else if (a.via === 'fan-out') a.plano = 'fan-out: fronteiras de ficheiro por agente';
  else if (scopeGrande) a.plano = 'scope de feature/arquitectura';
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
    } catch { /* sem payload utilizável → nudge genérico */ }

    const a = comPlano(analyse(prompt), IRREVERSIBLE_MARKERS.test(prompt), SCOPE_MARKERS.test(prompt));
    let context;

    if (!a) {
      context = '[task-intake] Classifica antes de responder: directa / skill / agente / fan-out (rules/task-intake.md).';
    } else if (a.via === 'fan-out') {
      context = `[task-intake] Sinal: ${a.motivo}. → Vale fan-out: ${a.sugestao}. `
        + `Despacha os agentes NUM SÓ turno (paralelos de facto). `
        + `Agentes de execução por domínio: .claude/agents/<skill>-agent.md. `
        + `Se decidires fazer inline, é escolha válida — mas fá-la de propósito.`;
    } else if (a.via === 'skill-ou-agente') {
      context = `[task-intake] Sinal: ${a.motivo}. → Lê a skill do domínio antes de escrever código; `
        + `se o trabalho for isolável e longo, despacha <skill>-agent em vez de o fazer inline.`;
    } else {
      context = `[task-intake] Sinal: ${a.motivo}. → Responde directamente; não escales.`;
    }

    // Gate de plano: acrescenta-se ao sinal de via, não o substitui.
    if (a && a.plano) {
      context += ` [plano] ${a.plano} → escreve o plano visível (objectivo · ficheiros por agente · `
        + `critério de sucesso) ANTES do primeiro Write/Agent. rules/task-intake.md.`;
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
    }));
    process.exit(0);
  });
  // Se o stdin nunca fechar, não pendurar o turno.
  setTimeout(() => { try { process.stdout.write('{}'); } catch (_) {} process.exit(0); }, 1500).unref?.();
} catch (_) {
  process.exit(0);
}

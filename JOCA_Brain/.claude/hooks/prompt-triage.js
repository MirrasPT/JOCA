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
  infra: ['cloudflare', 'analytics', 'visitas', 'tráfego', 'trafego', 'bots', 'uptime', 'monitorização', 'monitorizacao'],
};

// Marcas de que o pedido contém MAIS DO QUE UMA coisa a fazer.
const SPLIT_MARKERS = [
  /\be\s+(?:também|tambem|depois|a seguir|ainda)\b/gi,
  /\b(?:além disso|alem disso|para além|para alem|e ainda|e depois)\b/gi,
  /\b(?:primeiro|segundo|terceiro|por fim|finalmente)\b/gi,
  /^\s*[-*•]\s+/gm,              // bullets
  /^\s*\d+[.)]\s+/gm,            // listas numeradas
  /;/g,                          // ponto e vírgula separa cláusulas de trabalho
  /(?:,|\.|…)\s*depois\b/gi,       // «… depois atualiza» / «. Depois publica» (T003)
  /\be\s+(?:manda|envia)\b/gi,      // «e manda as duas versões ao cliente» — entrega para fora (T003)
];

// Escala: o mesmo trabalho repetido em N sítios é o caso mais rentável de fan-out.
const SCALE_MARKERS = /\b(?:todos|todas|cada|várias|varias|vários|varios|em todo|por todo|uma a uma|um a um|ambas|ambos|as duas|os dois)\b/gi;

// Sinais que EXIGEM plano antes de executar (rules/task-intake.md → "Plano antes de executar").
// Irreversível sozinho activa; scope grande activa por si.
// Verbos git/publicação (push · PR · branch · merge) contam como irreversível qualquer que seja o
// domínio detectado — um «cria um branch e abre um PR» saiu como «domínio único → não escales».
const IRREVERSIBLE_MARKERS = /\b(?:migration|migrations|migrate|migra|deploy|deployar|publicar|produção|producao|apaga|apagar|elimina|eliminar|drop|reset|force[- ]push|push|pull request|PR|branch|merge|pagamento|pagamentos|payment|stripe|checkout|auth|autenticação|autenticacao)\b/i;

// Turnos que NÃO são pedido do utilizador (notificação de agente em fundo, lembrete do sistema):
// triagem aqui é ruído — contava «6 domínios» numa notificação de fim de auditoria.
const NOTIFICATION = /^\s*<(?:task-notification|system-reminder)\b/i;

// Invocação de comando (`/save`, `/ship x`): o comando traz a sua via e os seus gates. Um caminho
// absoluto (`/Users/...`) não casa — o nome do comando termina em espaço ou fim.
const SLASH_COMMAND = /^\s*\/[a-z][\w:-]*(?:\s|$)/i;

// O utilizador disse para NÃO executar, ou pergunta se é viável — via A (rules/task-intake.md →
// «Pergunta de viabilidade é via A, não trabalho»), antes de contar partes ou domínios.
const NAO_EXECUTAR = /\b(?:não|nao)\s+(?:faças|facas|mexas|implementes|avances|toques)\b|\b(?:só|so)\s+a\s+discutir\b|\bpor\s+agora\s+(?:não|nao)\b/i;
const VIABILIDADE = /^\s*(?:(?:não|nao)\s+)?(?:dá para|da para|consegues|conseguimos|é possível|e possivel|será possível|sera possivel)\b/i;
const SCOPE_MARKERS = /\b(?:feature|funcionalidade|plataforma|refactor|refactoriza|refatoriza|reestrutura|arquitectura|arquitetura|migrar|integra|integrar|do zero|de raiz)\b/i;

// Mensagem que cita caminho, nome de ficheiro ou código de erro de ferramenta NÃO é via A:
// localiza-se o artefacto antes da 1.ª hipótese (rules/task-intake.md → Segurança, viabilidade).
const ARTEFACT_MARKERS = /(?:[~.]?\/[\w.@-]+\/[\w.@/-]+|\b[\w-]+\.(?:gcode|3mf|stl|blend|psd|pdf|png|jpe?g|svg|mp4|mov|js|mjs|cjs|ts|tsx|jsx|php|py|json|ya?ml|toml|md|html|css|sh|log|sql|zip)\b|\b(?:E[A-Z]{3,}|ERR_[A-Z_]{3,})\b|\b(?:erro|error)\s+\d{3}\b)/;

// Pedidos que NÃO são trabalho: perguntas, decisões, conversa. Escalar aqui é desperdício.
const QUESTION_START = /^\s*(?:o que|qual|quais|quando|onde|porque|porquê|porque|como|quem|será|sera|achas|podes explicar|explica|mostra|lista|vale a pena|devo|posso)\b/i;

// Verbos de acção. Servem para distinguir DOIS TRABALHOS de UM trabalho que por acaso menciona
// vocabulário de dois domínios: "refactoriza o componente de login em react" toca frontend e
// backend no léxico, mas tem um só verbo — é uma tarefa, não duas.
const ACTION_VERBS = /\b(?:cria|criar|faz|fazer|muda|mudar|altera|alterar|actualiza|actualizar|atualiza|escreve|escrever|refactoriza|refatoriza|adiciona|adicionar|remove|remover|apaga|apagar|corrige|corrigir|implementa|implementar|instala|instalar|configura|configurar|testa|testar|publica|publicar|traduz|traduzir|migra|migrar|integra|integrar|optimiza|otimiza|revê|rever|constrói|constroi|gera|gerar)\b/gi;

function analyse(prompt) {
  const text = (prompt || '').trim();
  if (!text) return null;
  if (NOTIFICATION.test(text)) return { via: 'silencio' };
  if (SLASH_COMMAND.test(text)) return { via: 'comando', motivo: `invocação de ${text.split(/\s+/)[0]}` };
  if (NAO_EXECUTAR.test(text)) return { via: 'directa', motivo: 'o pedido diz para não executar', semSkill: true };
  if (VIABILIDADE.test(text)) return { via: 'directa', motivo: 'pergunta de viabilidade — responde, não começa a fazer', viabilidade: true };

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

  // Uma pergunta curta é conversa, não trabalho — não escalar, nem com «todos/cada» lá dentro
  // («qual o acesso do admin em todos os ambientes?» saía como fan-out).
  if (isQuestion && splits === 0) {
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
  if (!a || a.via === 'comando' || a.via === 'silencio' || a.semSkill || a.viabilidade) return a;
  if (irreversivel) a.plano = 'acção irreversível detectada';
  else if (a.via === 'fan-out') a.plano = 'fan-out: fronteiras de ficheiro por agente';
  else if (scopeGrande) a.plano = 'scope de feature/arquitectura';
  return a;
}

// Encaminhamento de skills — corre em TODAS as vias de trabalho (antes só na via A: «deploy no
// ploi» caía em «domínio único» e nunca via a skill). A tabela de gatilhos saiu do CLAUDE.md, por
// isso este casamento é o que resta para activar skills; tem de aguentar PT flexionado e sinónimos.
// Fontes (geradas, lidas do Brain onde o hook vive, não do cwd; cada uma com fallback silencioso):
//   memory/SKILL_INDEX.json (triggers + nome) · .claude/reference/trigger-map.md (coluna Detected).
// Pontuação: frase exacta (4) > todas as palavras distintivas, ordem livre (3) > nome da skill (2)
// > gatilho de uma palavra (1.5; 1 por flexão). Sem rede, sem modelos: só tokens e prefixos.
const STOP = new Set(('de do da dos das um uma uns umas para pra com sem em no na nos nas por pelo pela ao aos que '
  + 'the and for from with into your you this that why not how what are was its our all ate mais isto isso esse essa '
  + 'este esta ser ter tem meu minha seu sua como quando onde qual ja so ou nao sim muito bem mal').split(' '));

// PT → EN (e grafias): expande o token do PEDIDO para casar gatilhos em inglês. Lista curta de propósito.
const SIN = {
  imagem: 'image', imagens: 'image', gera: 'generate', gerar: 'generate', gere: 'generate', cria: 'create',
  criar: 'create', crie: 'create', produto: 'product', produtos: 'product', anima: 'animate', animar: 'animate',
  animacao: 'animation', logotipo: 'logo', lento: 'slow', lenta: 'slow', lentos: 'slow', teste: 'test',
  testes: 'test', pagamento: 'payment', pagamentos: 'payment', factura: 'fatura', faturas: 'fatura',
  apresentacao: 'presentation', servidor: 'server', loja: 'store', tema: 'theme', envio: 'sending',
  enviar: 'send', transaccional: 'transactional', transacional: 'transactional', migra: 'migrate',
  migrar: 'migrate', escreve: 'write', escrever: 'write', corrige: 'fix', corrigir: 'fix', pagina: 'page',
  auditoria: 'audit', audita: 'audit', tecnica: 'technical', tecnico: 'technical', compilar: 'build',
  video: 'video', videos: 'video', ampliar: 'upscale', amplia: 'upscale', seguranca: 'security',
};

const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const toks = (s) => norm(s).split(/[^a-z0-9#+]+/).filter(Boolean);
const distintivo = (t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t);
// Flexão simples PT/EN: plural, vogal/infinitivo final, -m/-n («imagem/imagens»).
const raiz = (t) => { let r = t.replace(/(?:oes|aes|es|s)$/, ''); r = r.replace(/m$/, 'n'); const v = r.replace(/(?:ar|er|ir|a|e|o)$/, ''); return v.length >= 4 ? v : r; };
// Só raiz igual — prefixo livre casava «produto»→«production», «esta»→«estanque», «lista»→«listener».
const flexiona = (a, b) => a === b || (raiz(a) === raiz(b) && raiz(a).length >= 4);

function carregarGatilhos() {
  const fs = require('fs'); const path = require('path');
  const brain = path.join(__dirname, '..', '..');
  const entradas = new Map(); // nome → { kind, termos:Set }
  const add = (nome, kind, termo, dominio) => {
    if (!nome) return;
    if (!entradas.has(nome)) entradas.set(nome, { kind, termos: new Set(), dominio: '' });
    const e = entradas.get(nome); if (kind === 'agente') e.kind = 'agente';
    if (dominio) e.dominio = dominio;
    if (termo) e.termos.add(String(termo));
  };
  let idx = [];
  try { idx = JSON.parse(fs.readFileSync(path.join(brain, 'memory', 'SKILL_INDEX.json'), 'utf8')); } catch (_) {}
  const skills = new Set((Array.isArray(idx) ? idx : []).filter((s) => s && s.type === 'skill').map((s) => s.name));
  for (const s of Array.isArray(idx) ? idx : []) {
    if (!s || !s.name) continue;
    // Agente gémeo (<skill>-agent) repete a skill — sugere-se a skill, não o gémeo.
    if (s.type === 'agent' && s.name.endsWith('-agent') && skills.has(s.name.slice(0, -6))) continue;
    add(s.name, s.type === 'agent' ? 'agente' : 'skill', '', s.dominio);
    for (const t of Array.isArray(s.triggers) ? s.triggers : []) add(s.name, s.type === 'agent' ? 'agente' : 'skill', t);
  }
  try {
    for (const linha of fs.readFileSync(path.join(brain, '.claude', 'reference', 'trigger-map.md'), 'utf8').split('\n')) {
      const m = linha.match(/^\|\s*(.+?)\s*\|\s*`([\w:.-]+)`\s*(.*)\|\s*$/);
      if (!m || m[1] === 'Detected') continue;
      const kind = /\(agent\b/.test(m[3]) ? 'agente' : (entradas.get(m[2])?.kind || 'skill');
      for (const t of m[1].split(' · ')) add(m[2], kind, t);
    }
  } catch (_) {}
  return entradas;
}

// F4.1 — encaminhamento em 2 níveis: domínio → ramo. O `dominio` de cada entrada vem do SKILL_INDEX
// (build-skill-index.py). 1.º nível: o domínio do pedido = soma das pontuações dos ramos casados + os
// tokens do pedido que existem no vocabulário (gatilhos) do domínio, pesados pela raridade entre
// domínios; só conta se bater o 2.º por RAMO_MARGEM. 2.º nível: dentro das 3 escolhidas, os ramos desse
// domínio sobem RAMO_BONUS. Só reordena as 3 — nunca troca nomes, logo o top-3, os falsos e o tamanho
// injectado ficam iguais. Medido no banco F1.3: top-1 80,4 → 81,4 %, nenhuma skill desce
// (bónus 0,5 ou domínio a filtrar as 3 fizeram descer anima, brand-guidelines, html-to-pdf).
const RAMO_BONUS = 0.25;
const RAMO_MARGEM = 1.2;
function dominioDoPedido(hits, entradas, forma) {
  const pontos = {}; const voc = {};
  for (const h of hits) if (h.dominio) pontos[h.dominio] = (pontos[h.dominio] || 0) + h.score;
  for (const [, e] of entradas) {
    if (!e.dominio) continue;
    const v = voc[e.dominio] || (voc[e.dominio] = new Set());
    for (const t of e.termos) for (const x of toks(t)) if (distintivo(x)) { v.add(x); v.add(`~${raiz(x)}`); }
  }
  const doms = Object.keys(voc);
  for (const p of new Set(forma.filter(distintivo))) {
    const r = raiz(p);
    const em = doms.filter((d) => voc[d].has(p) || (r.length >= 4 && voc[d].has(`~${r}`)));
    if (!em.length || em.length === doms.length) continue;
    const peso = Math.log(doms.length / em.length);
    for (const d of em) pontos[d] = (pontos[d] || 0) + peso;
  }
  const ord = Object.entries(pontos).sort((a, b) => b[1] - a[1]);
  return ord.length && (ord.length < 2 || ord[0][1] > ord[1][1] * RAMO_MARGEM) ? ord[0][0] : '';
}

function skillsCasadas(prompt) {
  try {
    const pt = toks(prompt);
    const frase = ` ${pt.join(' ')} `;
    const forma = [...new Set([...pt, ...pt.map((t) => SIN[t]).filter(Boolean)])];
    const tem = (t) => forma.some((p) => flexiona(p, t));
    const hits = [];
    const entradas = carregarGatilhos();
    for (const [nome, e] of entradas) {
      if (e.kind === 'skill' && !e.termos.size) continue; // stub de redireção (sem gatilhos)
      let best = 0; let termo = ''; let extra = 0;
      const marca = (w, t) => { if (w > best) { if (best) extra++; best = w; termo = t; } else extra++; };
      for (const t of e.termos) {
        const tt = toks(t); if (!tt.length || tt.join('').length < 2) continue;
        if (frase.includes(` ${tt.join(' ')} `)) { marca(tt.length > 1 ? 4 : 1.5, t); continue; }
        const d = tt.filter(distintivo);
        if (tt.length > 1) { if (d.length >= 2 && d.every(tem)) marca(3, t); }
        else if (d.length === 1 && d[0].length >= 4 && tem(d[0])) marca(1, t);
      }
      const nt = toks(nome).filter(distintivo);
      if (nt.length >= 2 && nt.every(tem)) marca(2, nome);
      if (best) hits.push({ nome, kind: e.kind, termo, dominio: e.dominio, score: best + Math.min(extra, 4) * 0.25 });
    }
    const pelaPontuacao = (a, b) => b.score - a.score || a.nome.length - b.nome.length;
    const ramo = dominioDoPedido(hits, entradas, forma);
    const nota = (h) => h.score + (ramo && h.dominio === ramo ? RAMO_BONUS : 0);
    return hits.sort(pelaPontuacao).slice(0, 3).sort((a, b) => nota(b) - nota(a) || pelaPontuacao(a, b));
  } catch (_) { return []; }
}

let sessaoTriagem = ''; // session_id do payload — só para o registo de sugestões (F1.1, registo-uso.js)
// Linha [skill] curta (vai em cada mensagem): nomes + termo casado, cortada a ~200 chars.
function linhaSkill(prompt, isQuestion, trabalho) {
  const min = isQuestion ? 2 : (trabalho ? 1 : 1.5);
  const hits = skillsCasadas(prompt).filter((h) => h.score >= min);
  try { require('./registo-uso.js').registar(hits.map((h) => ({ tipo: 'sugerida', nome: h.nome })), sessaoTriagem); } catch (_) {} // F1.1
  if (!hits.length) {
    // Só com verbo de acção que não seja «faz/fazer» («faz sentido», «vamos fazer o resto amanhã»).
    const t = String(prompt).trim(); const forte = String(t.match(new RegExp(ACTION_VERBS.source, 'gi')) || '').split(',').some((v) => v && !/^faz/i.test(v));
    return trabalho && forte && !isQuestion && t.split(/\s+/).length >= 3
      ? ' [skill] sem gatilho casado — grep a memory/SKILL_INDEX.json antes de responder de memória.' : '';
  }
  const fmt = (comTermo) => hits.map((h) => `${h.nome}${h.kind === 'agente' ? ' (agente)' : ''}`
    + (comTermo ? ` «${h.termo.slice(0, 22)}»` : '')).join(', ');
  const cauda = ' → Read(".claude/skills/<nome>.md") antes de agir; agente → Agent().';
  const l = ` [skill] ${fmt(true)}${cauda}`;
  return l.length <= 200 ? l : ` [skill] ${fmt(false)}${cauda}`;
}

// Projecto mencionado (N02): a triagem casava skills mas não fichas — um pedido sobre um tema pessoal
// respondeu-se só com o Gmail, com tudo já na memória do projecto. Barato: nomes de pasta/ficha + `aliases:`
// do frontmatter dos index (lib memoria-projecto; só pastas — a ficha plana antiga já não se lê), sem ler o corpo.
// Só IGUALDADE manda ler (desenho 2026-10-01 §2.1): o slug inteiro («loja-exemplo», «loja exemplo») ou
// um alias inteiro. Alias de uma palavra só conta depois de «projecto/projeto» (`acmecorp` é a empresa).
// O resto — uma palavra ≥4 letras que só existe num slug, ou um nome a ≤2 letras de um slug
// («iacmetrix» vs «acmetrix») — vira [projecto?] com os candidatos: listados, nunca adivinhados.
const PROJ_COMUNS = new Set(('vida video vendas site loja app web geral manual dashboard backend frontend api '
  + 'github open source studio premium setup tech sync documentos drive musica imagens icons hosting agent '
  + 'assistente archive teste demo novo nova marketing design redes sociais').split(' '));
function projectosCasados(prompt) {
  try {
    const path = require('path');
    const memoria = require(path.join(__dirname, '..', 'scripts', 'lib', 'memoria-projecto.cjs'));
    // JOCA_PROJECTS_DIR: memória alternativa (os testes apontam-na a uma pasta de fixtures fictícias).
    const projDir = process.env.JOCA_PROJECTS_DIR || path.join(__dirname, '..', '..', 'memory', 'projects');
    const projs = memoria.listarProjectos(projDir);
    const slugs = projs.map((p) => p.slug);
    const pt = toks(prompt); const frase = ` ${pt.join(' ')} `; const tem = new Set(pt);
    const diz = (nome, umaPalavraComum) => {
      const st = toks(nome).join(' ');
      if (!st || nome.length < 3 || STOP.has(nome)) return false;
      return umaPalavraComum ? frase.includes(` projecto ${st} `) || frase.includes(` projeto ${st} `) : frase.includes(` ${st} `);
    };
    const conta = new Map();
    for (const s of slugs) for (const t of new Set(s.split('-'))) conta.set(t, (conta.get(t) || 0) + 1);
    const hits = new Map(); const cand = new Set();
    for (const p of projs) {
      const s = p.slug; const partes = s.split('-');
      // slug de uma só palavra comum («vendas», «exemplo») só dispara depois de «projecto/projeto»
      if (diz(s, partes.length === 1 && PROJ_COMUNS.has(s))) { hits.set(s, { s, area: null, rel: memoria.caminhoRelativo(s, projDir), st: toks(s).join(' ') }); continue; }
      for (const a of memoria.aliasesDe(memoria.lerFrontmatter(p.ficheiro, 4000))) {
        if (diz(a.nome, toks(a.nome).length === 1)) { hits.set(s, { s, area: a.area, rel: memoria.caminhoRelativo(s, projDir), st: toks(a.nome).join(' ') }); break; }
      }
      if (hits.has(s)) continue;
      if (partes.some((t) => t.length >= 4 && !/\d/.test(t) && conta.get(t) === 1
        && !PROJ_COMUNS.has(t) && !STOP.has(t) && tem.has(t))) cand.add(s);
      else if (s.length >= 5 && !PROJ_COMUNS.has(s) && pt.some((t) => t.length >= 5 && t !== s && !STOP.has(t)
        && !PROJ_COMUNS.has(t) && memoria.levenshtein(t, s) <= (Math.min(t.length, s.length) >= 7 ? 2 : 1))) cand.add(s);
    }
    // Match mais longo ganha: «acme pink» casa `acme-pink` E `acme`; um nome cujas ocorrências
    // estão TODAS dentro da de um nome mais comprido (mesma posição) não conta — nem como candidato.
    const ocorr = (st) => { const r = []; let i = frase.indexOf(` ${st} `); while (i !== -1) { r.push([i, i + st.length + 1]); i = frase.indexOf(` ${st} `, i + 1); } return r; };
    const todos = [...hits.values()].map((h) => ({ ...h, oc: ocorr(h.st) }));
    const tapado = (h) => h.oc.length > 0 && h.oc.every(([a, b]) => todos.some((o) => o !== h && o.st.length > h.st.length
      && o.oc.some(([c, d]) => c <= a && b <= d)));
    const engolidos = new Set(todos.filter(tapado).map((h) => h.s));
    const certos = todos.filter((h) => !engolidos.has(h.s)).slice(0, 3).map(({ s, area, rel }) => ({ s, area, rel }));
    return { certos, candidatos: [...cand].filter((s) => !hits.has(s)).slice(0, 4) };
  } catch (_) { return { certos: [], candidatos: [] }; }
}

try {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    let prompt = '';
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      prompt = payload.prompt || payload.user_prompt || '';
      sessaoTriagem = payload.session_id || '';
    } catch { /* sem payload utilizável → nudge genérico */ }

    const a = comPlano(analyse(prompt), IRREVERSIBLE_MARKERS.test(prompt), SCOPE_MARKERS.test(prompt));
    let context;

    if (a && a.via === 'silencio') {
      process.stdout.write('{}');
      process.exit(0);
    }

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
    } else if (a.via === 'comando') {
      context = `[task-intake] Sinal: ${a.motivo}. → Segue o comando (traz a sua via e os seus gates); não escales pela triagem.`;
    } else {
      context = `[task-intake] Sinal: ${a.motivo}. → Responde directamente; não escales.`;
    }

    // Skill em todas as vias de trabalho (não só na A); calado em comando, notificação e «não faças».
    if (a && a.via !== 'comando' && !a.semSkill) {
      const t = prompt.trim();
      const isQuestion = QUESTION_START.test(t) || /\?\s*$/.test(t) || VIABILIDADE.test(t);
      const trabalho = new RegExp(ACTION_VERBS.source, 'i').test(t) || /\b(?:deploy|anima|prepara|emite|amplia|monta|desenha)\b/i.test(t);
      context += linhaSkill(prompt, isQuestion, trabalho);
    }

    // Gate de plano: acrescenta-se ao sinal de via, não o substitui.
    if (a && a.plano) {
      context += ` [plano] ${a.plano} → escreve o plano visível (objectivo · ficheiros por agente · `
        + `critério de sucesso) ANTES do primeiro Write/Agent. rules/task-intake.md.`;
    }

    if (a && ARTEFACT_MARKERS.test(prompt)) {
      context += ' [localizar] a mensagem cita ficheiro/caminho/erro → não é via A: `find`/`ls` ao artefacto '
        + 'antes da 1.ª hipótese.';
    }

    // Projecto mencionado → a ficha lê-se antes de responder (em todas as vias, perguntas incluídas),
    // e o recall do slug (decisões activas + aprendizagens): estavam no Brain e não se liam (T039 T106 T175).
    if (a) {
      const brain = require('path').join(__dirname, '..', 'scripts', 'joca-brain.mjs').replace(/\\/g, '/');
      const pc = projectosCasados(prompt);
      for (const { s, area, rel } of pc.certos) {
        const extra = area ? ` + área ${rel.replace(/index\.md$/, '')}${area}.md` : '';
        context += ` [projecto] ${s} → ler ${rel}${extra} + \`node "${brain}" recall --slug ${s}\` antes de responder.`;
      }
      if (pc.candidatos.length) {
        context += ` [projecto?] candidatos: ${pc.candidatos.join(', ')} — nome parcial ou parecido; `
          + 'confirmar com o utilizador qual (ou nenhum) antes de ler a memória.';
      }
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

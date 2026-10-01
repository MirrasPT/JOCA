// Suite de aceitação do módulo campanha, escrita a partir dos critérios do issue, do
// SKILL (`## campanha`), da D-020 e do modelo produto/modelos/campanha-search.md — não a partir do
// corpo dos scripts. Sem rede real e sem o cofre real: o HOME aponta para uma pasta temporária ANTES
// de importar os módulos, o cofre da agência e do cliente são ficheiros falsos lá dentro, e a Google
// (API, OAuth e as landings) é um `fetch` falso que grava cada pedido e guarda o que foi criado.
// Segredos marcados (sentinelas): nenhum pode aparecer na consola, em erros, relatórios ou ficheiros.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaPasta = (pref) => { const p = mkdtempSync(join(tmpdir(), pref)); pastas.push(p); return p; };

// HOME falso antes de qualquer import do módulo: o cofre real (~/.config/marketeer) nunca é tocado.
const HOME = novaPasta('marketeer-camp-home-');
process.env.HOME = HOME;
const COFRE = join(HOME, '.config', 'marketeer');
mkdirSync(COFRE, { recursive: true });

const { validar } = await import('../scripts/campanha/validar.mjs');
const { criar } = await import('../scripts/campanha/criar.mjs');
const { investimento } = await import('../scripts/campanha/investimento.mjs');
const { pesquisar } = await import('../scripts/campanha/pesquisa.mjs');
const { nova } = await import('../scripts/campanha/nova.mjs');
const { gerarCsv } = await import('../scripts/campanha/csv.mjs');

const REPO = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CID = '1234567890';
const HOJE = new Date(2026, 8, 29, 12, 0, 0);

// Sentinelas.
const DEV = 'DEVTOKEN_SEGREDO_campanha_71';
const SECRET = 'GOCSPX-SEGREDO_camp_secret_82';
const RT_AGENCIA = '1//0SEGREDO_camp_refresh_AGENCIA';
const RT_CLIENTE = '1//0SEGREDO_camp_refresh_CLIENTE';
const ACCESS = 'ya29.SEGREDO_camp_access_token';
const SEGREDOS = [DEV, SECRET, RT_AGENCIA, RT_CLIENTE, ACCESS];
function semSegredos(texto, onde) {
  for (const s of SEGREDOS) assert.ok(!String(texto).includes(s), `${onde} contém um segredo (${s.slice(0, 12)}…)`);
}

// ---- cofre falso ----
function escreverCofre(slug, chaves) {
  writeFileSync(join(COFRE, `${slug}.env`), Object.entries(chaves).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
}
writeFileSync(join(COFRE, 'google-ads-oauth-client.json'), JSON.stringify({ installed: { client_id: 'cliente-oauth.apps.googleusercontent.com', client_secret: SECRET } }));
escreverCofre('google-ads', { GOOGLE_ADS_DEVELOPER_TOKEN: DEV, GOOGLE_ADS_LOGIN_CUSTOMER_ID: '999-888-7777', GOOGLE_ADS_REFRESH_TOKEN: RT_AGENCIA });

// ---- raiz falsa com dossier e especificações ----
let nSlug = 0;
function cliente(especs = {}) {
  const slug = `cli${++nSlug}`;
  const raiz = novaPasta('marketeer-camp-raiz-');
  mkdirSync(join(raiz, 'clientes', slug, 'campanhas'), { recursive: true });
  writeFileSync(join(raiz, 'clientes', slug, 'dossier.md'), [
    '---', 'cliente:', `  nome: Teste ${slug}`, `  slug: ${slug}`, 'canais:',
    '  - tipo: google-ads', '    id: 123-456-7890', '    acesso: true', '---', '', `# ${slug}`, '',
  ].join('\n'));
  escreverCofre(slug, { GOOGLE_ADS_REFRESH_TOKEN: RT_CLIENTE });
  for (const [nome, texto] of Object.entries(especs)) writeFileSync(join(raiz, 'clientes', slug, 'campanhas', `${nome}.md`), texto);
  return { slug, raiz };
}

// ---- consola capturada ----
function capturar() {
  const linhas = [];
  const orig = {};
  for (const m of ['log', 'error', 'warn', 'info', 'debug']) {
    orig[m] = console[m];
    console[m] = (...a) => linhas.push(a.map(String).join(' '));
  }
  return { linhas, texto: () => linhas.join('\n'), repor: () => Object.assign(console, orig) };
}
async function comConsola(fn) {
  const c = capturar();
  let r, e;
  try { r = await fn(); } catch (x) { e = x; } finally { c.repor(); }
  return { r, e, consola: c.texto() };
}

// ---- especificação de referência (limpa) ----
const NOME = 'GADS_Search_Leads_Apps_2026-10';
const frontmatter = ({ nome = NOME, extra = '', cpc = '  cpc_max: 2.3\n', objectivos = true } = {}) => `---
cliente: teste
campanha:
  nome: ${nome}
  orcamento_dia: 5
  licitacao: maximizar-cliques
${cpc}  localizacoes:
    - id: 2620
      nome: Portugal
  idiomas:
    - 1014
  url_final: https://exemplo.pt/apps
  caminho:
    - apps
    - medida
  telefone: 222 000 111
  horario:
    dias: [seg, ter, qua, qui, sex]
    inicio: 8
    fim: 20
${objectivos ? '  objectivos:\n    contar:\n      - SUBMIT_LEAD_FORM\n    nao_contar:\n      - DOWNLOAD\n' : ''}${extra}---
`;

const corpo = `# Teste: campanha Search apps

## 4. Grupos de anúncios e palavras-chave

**G1 · Empresa de apps**
\`\`\`
"empresa de apps"
[empresa de apps]
"desenvolvimento de apps"
[desenvolvimento de apps]
\`\`\`

## 5. Palavras-chave negativas

### 5.1 Negativas da campanha

| Tema | Negativas | Evidência |
|---|---|---|
| Grátis | \`gratis\` \`"como criar"\` | termos sem conversão |

## 6. Anúncios responsivos de pesquisa (RSA)

### G1 · Empresa de apps

| # | Título | Car. | Fixar |
|---|---|---|---|
| 1 | Empresa de apps | 15 | 1 |
| 2 | Apps à medida | 13 | |
| 3 | Fale connosco | 13 | |
| 4 | Trinta caracteres exactos aqui | 30 | |

| # | Descrição | Car. | Fixar |
|---|---|---|---|
| D1 | Desenvolvemos apps para empresas. | 33 | |
| D2 | Peça orçamento pelo site. | 25 | |

## 7. Recursos

### Sitelinks (texto ≤25, descrições ≤35; URLs têm de responder 200)

| Texto | Car. | Descrição 1 | Car. | Descrição 2 | Car. | URL |
|---|---|---|---|---|---|---|
| Portfólio | 9 | Apps feitas | 11 | Veja os casos | 13 | https://exemplo.pt/portfolio |
| Contactos | 9 | Fale connosco | 13 | Resposta rápida | 15 | https://exemplo.pt/contactos |

### Frases de destaque (≤25)

| Frase | Car. |
|---|---|
| Diagnóstico gratuito | 20 |

### Snippet estruturado · cabeçalho **Serviços** (≤25 por valor)

| Valor | Car. |
|---|---|
| Apps móveis | 11 |
| Software à medida | 17 |
| Integrações | 11 |
`;
const ESPEC = frontmatter() + corpo;
const trocar = (texto, de, para) => { assert.ok(texto.includes(de), `fixture: "${de}" não está na especificação`); return texto.replace(de, para); };
const car = (s) => [...s].length;

// ---- Google falsa ----
const erroTimeout = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');
const erroApi = (codigo, mensagem, status = 400) => ({
  error: { code: status, message: mensagem, status: status === 403 ? 'PERMISSION_DENIED' : 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.ads.googleads.v25.errors.GoogleAdsFailure', errors: [{ errorCode: { authorizationError: codigo }, message: mensagem }] }] },
});

// Estado mínimo da conta, alimentado pelos creates do googleAds:mutate. O GAQL filtra por FROM, por
// `.name = '…'`, por `campaign.id` e por `campaign.status`. As entidades devolvem-se com os campos
// com que foram criadas (é o que a API real devolve, em camelCase).
const RECURSO = {
  campaignBudgetOperation: ['campaign_budget', 'campaignBudget', 'campaignBudgets'],
  campaignOperation: ['campaign', 'campaign', 'campaigns'],
  campaignCriterionOperation: ['campaign_criterion', 'campaignCriterion', 'campaignCriteria'],
  adGroupOperation: ['ad_group', 'adGroup', 'adGroups'],
  adGroupCriterionOperation: ['ad_group_criterion', 'adGroupCriterion', 'adGroupCriteria'],
  adGroupAdOperation: ['ad_group_ad', 'adGroupAd', 'adGroupAds'],
  assetOperation: ['asset', 'asset', 'assets'],
  campaignAssetOperation: ['campaign_asset', 'campaignAsset', 'campaignAssets'],
  campaignSharedSetOperation: ['campaign_shared_set', 'campaignSharedSet', 'campaignSharedSets'],
  adGroupAssetOperation: ['ad_group_asset', 'adGroupAsset', 'adGroupAssets'],
};

function google({ contas = {}, paginas = {}, falhas = {}, erroMutate, erroPlaneador, ideias, termos = [], erroToken, aplicar = true } = {}) {
  const pedidos = [];
  let proximoId = 9000;
  // contas: { campaign: [...linhas], campaign_budget: [...], shared_set: [...], ... }
  const estado = { entidades: structuredClone(contas), objectivos: [] };
  const linhasDe = (from) => (estado.entidades[from] ??= []);

  function aplicarOps(mutateOperations) {
    const temp = new Map();
    const res = [];
    const real = (rn) => String(rn).replace(/\/(-\d+)(?=$|~|")/g, (m, t) => `/${temp.get(t) ?? t}`);
    // IDs temporários: primeiro atribuir, depois substituir em todas as referências.
    for (const op of mutateOperations) {
      for (const [k, v] of Object.entries(op)) {
        const rn = v?.create?.resourceName;
        const m = rn && /\/(-\d+)$/.exec(rn);
        if (m) temp.set(m[1], String(proximoId++));
        void k;
      }
    }
    for (const op of mutateOperations) {
      const [k, v] = Object.entries(op)[0];
      const [from, chave] = RECURSO[k] ?? [k, k];
      if (v.create) {
        const e = JSON.parse(real(JSON.stringify(v.create)));
        if (!e.resourceName) e.resourceName = `customers/${CID}/${RECURSO[k]?.[2] ?? k}/${proximoId++}`;
        e.id = e.id ?? /\/(\d+)$/.exec(e.resourceName)?.[1];
        e.criterionId = e.id;
        const linha = { [chave]: e };
        if (chave === 'campaign') {
          linha.campaignBudget = linhasDe('campaign_budget').find((b) => b.campaignBudget.resourceName === e.campaignBudget)?.campaignBudget;
          for (const [cat, bid] of [['DOWNLOAD', true], ['SUBMIT_LEAD_FORM', false], ['PHONE_CALL_LEAD', true]]) {
            estado.objectivos.push({ campaign: { id: e.id, resourceName: e.resourceName }, campaignConversionGoal: { resourceName: `customers/${CID}/campaignConversionGoals/${e.id}~${cat}~WEBSITE`, category: cat, origin: 'WEBSITE', biddable: bid } });
          }
        }
        const campRn = e.campaign ?? linhasDe('ad_group').find((a) => a.adGroup.resourceName === e.adGroup)?.adGroup.campaign;
        if (campRn && chave !== 'campaign') linha.campaign = linhasDe('campaign').find((c) => c.campaign.resourceName === campRn)?.campaign ?? { resourceName: campRn };
        linhasDe(from).push(linha);
        res.push({ [`${chave}Result`]: { resourceName: e.resourceName } });
      } else if (v.update) {
        const rn = real(v.update.resourceName);
        const g = estado.objectivos.find((x) => x.campaignConversionGoal.resourceName === rn);
        if (g && 'biddable' in v.update) g.campaignConversionGoal.biddable = v.update.biddable;
        const c = linhasDe(from).find((x) => x[chave]?.resourceName === rn);
        if (c) Object.assign(c[chave], v.update);
        res.push({ [`${chave}Result`]: { resourceName: rn } });
      } else res.push({});
    }
    return res;
  }

  function gaql(q) {
    const from = /FROM\s+(\w+)/i.exec(q)?.[1];
    if (from === 'customer') return [{ customer: { id: CID, descriptiveName: 'Conta Teste', currencyCode: 'EUR' } }];
    if (from === 'campaign_conversion_goal') {
      const ids = [...q.matchAll(/campaign\.id\s*(?:=|IN\s*\()\s*([\d,\s]+)/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
      return estado.objectivos.filter((o) => !ids.length || ids.includes(o.campaign.id));
    }
    if (from === 'search_term_view') return termos;
    let linhas = [...linhasDe(from)];
    for (const m of q.matchAll(/(\w+)\.name\s*=\s*'((?:[^'\\]|\\.)*)'/g)) {
      const chave = m[1].replace(/_(\w)/g, (_, l) => l.toUpperCase());
      const nome = m[2].replace(/\\(.)/g, '$1');
      linhas = linhas.filter((l) => l[chave]?.name === nome);
    }
    const ids = /campaign\.id\s*(?:=|IN\s*\()\s*([\d,\s]+)/.exec(q);
    if (ids) { const lista = ids[1].split(',').map((s) => s.trim()); linhas = linhas.filter((l) => lista.includes(String(l.campaign?.id))); }
    const TIPOS = { LOCATION: 'location', KEYWORD: 'keyword', AD_SCHEDULE: 'adSchedule', LANGUAGE: 'language', SITELINK: 'sitelinkAsset', CALLOUT: 'calloutAsset', STRUCTURED_SNIPPET: 'structuredSnippetAsset', CALL: 'callAsset' };
    for (const m of q.matchAll(/(\w+)\.type\s*=\s*'(\w+)'/g)) {
      const chave = m[1].replace(/_(\w)/g, (_, l) => l.toUpperCase());
      if (TIPOS[m[2]]) linhas = linhas.filter((l) => l[chave]?.[TIPOS[m[2]]] != null);
    }
    for (const m of q.matchAll(/(\w+)\.negative\s*=\s*(TRUE|FALSE)/gi)) {
      const chave = m[1].replace(/_(\w)/g, (_, l) => l.toUpperCase());
      linhas = linhas.filter((l) => Boolean(l[chave]?.negative) === (m[2].toUpperCase() === 'TRUE'));
    }
    const st = /campaign\.status\s*(=|!=)\s*'?(\w+)'?/.exec(q);
    if (st) linhas = linhas.filter((l) => (st[1] === '=' ? l.campaign?.status === st[2] : l.campaign?.status !== st[2]));
    const stIn = /campaign\.status\s+IN\s*\(([^)]*)\)/i.exec(q);
    if (stIn) { const l2 = stIn[1].replace(/['\s]/g, '').split(','); linhas = linhas.filter((l) => l2.includes(l.campaign?.status)); }
    return linhas;
  }

  const obter = async (url, init = {}) => {
    const u = String(url);
    const tipo = u === TOKEN_URL ? 'token'
      : /googleAds:mutate$/.test(u) || /\/\w+:mutate$/.test(u) ? 'mutate'
      : /googleAds:search(Stream)?$/.test(u) ? 'search'
      : /:generateKeywordIdeas$/.test(u) ? 'planeador'
      : /googleapis\.com/.test(u) ? 'outra-api' : 'pagina';
    const corpo = init.body == null ? '' : String(init.body);
    const p = { tipo, url: u, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers ?? {}), corpo };
    pedidos.push(p);
    const n = pedidos.filter((x) => x.tipo === tipo).length;
    if (falhas[tipo]?.includes(n)) throw erroTimeout();
    if (tipo === 'token') {
      if (erroToken) return Response.json(erroToken, { status: 400 });
      return Response.json({ access_token: ACCESS, expires_in: 3599, token_type: 'Bearer' });
    }
    if (tipo === 'search') return Response.json({ results: gaql(JSON.parse(corpo).query) });
    if (tipo === 'planeador') {
      if (erroPlaneador) return Response.json(erroPlaneador, { status: 403 });
      return Response.json({ results: ideias ?? [] });
    }
    if (tipo === 'mutate') {
      if (erroMutate) { const [st, b] = erroMutate(p); return Response.json(b, { status: st }); }
      const b = JSON.parse(corpo);
      const ops = b.mutateOperations ?? b.operations ?? [];
      if (b.validateOnly || !aplicar) return Response.json({});
      if (b.mutateOperations) return Response.json({ mutateOperationResponses: aplicarOps(ops) });
      // mutate por serviço (ex.: campaignConversionGoals:mutate)
      const serv = /\/(\w+):mutate$/.exec(u)[1];
      const k = Object.keys(RECURSO).find((x) => RECURSO[x][2] === serv) ?? `${serv}Operation`;
      const r = aplicarOps(ops.map((o) => ({ [k]: o })));
      if (serv === 'campaignConversionGoals') for (const o of ops) {
        const g = estado.objectivos.find((x) => x.campaignConversionGoal.resourceName === o.update?.resourceName);
        if (g && 'biddable' in o.update) g.campaignConversionGoal.biddable = o.update.biddable;
      }
      return Response.json({ results: r.map((x) => Object.values(x)[0] ?? {}) });
    }
    if (tipo === 'outra-api') return Response.json({});
    const st = paginas[u] ?? 200;
    if (st === 'rede') throw new TypeError('fetch failed');
    return new Response('<html></html>', { status: st, headers: { 'content-type': 'text/html' } });
  };
  const de = (tipo) => pedidos.filter((p) => p.tipo === tipo);
  const mutates = () => de('mutate').map((p) => ({ ...p, b: JSON.parse(p.corpo) }));
  const queries = () => de('search').map((p) => JSON.parse(p.corpo).query);
  return { obter, pedidos, estado, de, mutates, queries };
}

// Todas as operações de campanha de todos os mutates.
const opsCampanha = (g) => g.mutates().flatMap((m) => [
  ...(m.b.mutateOperations ?? []).map((o) => o.campaignOperation).filter(Boolean),
  ...(/\/campaigns:mutate$/.test(m.url) ? m.b.operations ?? [] : []),
]);
function soPausa(g) {
  for (const o of opsCampanha(g)) {
    if (o.create) assert.equal(o.create.status, 'PAUSED', `campanha criada com status ${o.create.status}`);
    if (o.update && 'status' in o.update) assert.equal(o.update.status, 'PAUSED', `campanha alterada para ${o.update.status}`);
  }
  for (const c of g.estado.entidades.campaign ?? []) {
    if (c.campaign.name === NOME || /^GADS_/.test(c.campaign.name ?? '')) assert.notEqual(c.campaign.status, 'ENABLED', `campanha ${c.campaign.name} ficou ENABLED na conta`);
  }
}

// Texto de tudo o que o comando deixou: consola + resultado + erro.
const tudo = ({ r, e, consola }) => [consola, JSON.stringify(r ?? null), e ? `${e.message}\n${e.stack}` : ''].join('\n');

const ok200 = google().obter;
const titulo = (texto, n = 2, de = '| 2 | Apps à medida | 13 |') => (esp) => trocar(esp, de, `| ${n} | ${texto} | ${car(texto)} |`);

// ============================ 1. validar ============================

test('validar: a especificação de referência passa (0 erros) e as URLs da landing e dos sitelinks são pedidas', async () => {
  const g = google();
  const r = await validar(ESPEC, { obter: g.obter });
  assert.deepEqual(r.erros, [], r.erros.join('\n'));
  const urls = g.de('pagina').map((p) => p.url);
  for (const u of ['https://exemplo.pt/apps', 'https://exemplo.pt/portfolio', 'https://exemplo.pt/contactos']) assert.ok(urls.includes(u), `não verificou ${u}`);
});

test('validar: título de 30 caracteres (limite, com acentos contados como 1) passa; 31 falha', async () => {
  assert.equal(car('Trinta caracteres exactos aqui'), 30);
  const acentos = 'Apps à medida em Portugal já!'; // 29 com acentos
  assert.deepEqual((await validar(titulo(acentos)(ESPEC), { obter: ok200 })).erros, []);
  const r = await validar(titulo('Trinta caracteres exactos aqui!', 4, '| 4 | Trinta caracteres exactos aqui | 30 |')(ESPEC), { obter: ok200 });
  assert.ok(r.erros.some((e) => /\b30\b/.test(e)), `título de 31 sem erro de limite: ${r.erros.join(' | ')}`);
});

test('validar: cada texto acima do limite dá erro (descrição 90, caminho 15, sitelink 25/35, destaque 25)', async () => {
  const d91 = 'Desenvolvemos aplicações móveis e software à medida para empresas industriais do Norte hoj.';
  const t26 = 'Portfólio de aplicações xy';
  const s36 = 'Apps feitas para empresas do Norte!';
  const f26 = 'Diagnóstico gratuito semp';
  const d = (s) => `${s} | ${car(s)} |`;
  assert.deepEqual([car(d91), car(t26), car(s36) + 1, car(f26) + 1], [91, 26, 36, 26]);
  const casos = [
    ['descrição 91', 90, trocar(ESPEC, '| D2 | Peça orçamento pelo site. | 25 |', `| D2 | ${d(d91)}`)],
    ['caminho 16', 15, trocar(ESPEC, '    - medida\n', '    - abcdefghijklmnop\n')],
    ['texto do sitelink 26', 25, trocar(ESPEC, '| Portfólio | 9 |', `| ${d(t26)}`)],
    ['descrição do sitelink 36', 35, trocar(ESPEC, '| Apps feitas | 11 |', `| ${d(s36 + 'x')}`)],
    ['frase de destaque 26', 25, trocar(ESPEC, '| Diagnóstico gratuito | 20 |', `| ${d(f26 + 'x')}`)],
  ];
  for (const [nome, lim, esp] of casos) {
    const r = await validar(esp, { obter: ok200 });
    assert.ok(r.erros.length > 0, `${nome}: sem erro`);
    assert.ok(r.erros.some((e) => new RegExp(`\\b${lim}\\b`).test(e)), `${nome}: nenhum erro cita o limite ${lim}: ${r.erros.join(' | ')}`);
  }
  // no limite exacto, passam
  const noLimite = trocar(trocar(trocar(ESPEC, '| Portfólio | 9 |', `| ${d(t26.slice(0, 25))}`), '| Apps feitas | 11 |', `| ${d(s36.slice(0, 35))}`), '| Diagnóstico gratuito | 20 |', `| ${d(f26)}`);
  assert.deepEqual((await validar(noLimite, { obter: ok200 })).erros, []);
});

test('validar: telefone no texto do anúncio dá erro, em vários formatos, em títulos e descrições', async () => {
  const formatos = ['Ligue 222 000 111', 'Ligue 212345678', 'Ligue +351 222 000 111', 'Ligue +351212345678', 'Ligue 912 345 678'];
  for (const f of formatos) {
    const r = await validar(titulo(f)(ESPEC), { obter: ok200 });
    assert.ok(r.erros.some((e) => /telefone/i.test(e)), `título "${f}" passou sem erro de telefone: ${r.erros.join(' | ')}`);
  }
  const desc = 'Peça orçamento: +351 222 000 111.';
  const r = await validar(trocar(ESPEC, '| D2 | Peça orçamento pelo site. | 25 |', `| D2 | ${desc} | ${car(desc)} |`), { obter: ok200 });
  assert.ok(r.erros.some((e) => /telefone/i.test(e)), `descrição com telefone passou: ${r.erros.join(' | ')}`);
});

test('validar: negativa que bloqueia uma positiva da mesma campanha (PHRASE, EXACT, de grupo) dá erro; a que não bloqueia não', async () => {
  const neg = (t) => trocar(ESPEC, '`gratis` `"como criar"`', t);
  for (const n of ['`"empresa de apps"`', '`[empresa de apps]`', '`"de apps"`', '`apps`']) {
    const r = await validar(neg(n), { obter: ok200 });
    assert.ok(r.erros.some((e) => /bloque/i.test(e)), `negativa ${n} não foi apontada: ${r.erros.join(' | ')}`);
  }
  const grupo = trocar(ESPEC, '## 6. Anúncios', '### 5.2 Negativas entre grupos\n\n| Grupo | Excluir (expressão) | Para |\n|---|---|---|\n| G1 | `"desenvolvimento de apps"` | G2 |\n\n## 6. Anúncios');
  assert.ok((await validar(grupo, { obter: ok200 })).erros.some((e) => /bloque/i.test(e)), 'negativa de grupo que bloqueia o próprio grupo passou');
  assert.deepEqual((await validar(neg('`"empresa de software"` `[apps grátis]`'), { obter: ok200 })).erros, [], 'negativa que não bloqueia não pode dar erro');
});

test('validar: URL que não responde 200 (landing, sitelink, falha de rede) dá erro', async () => {
  for (const [u, st] of [['https://exemplo.pt/apps', 404], ['https://exemplo.pt/portfolio', 500], ['https://exemplo.pt/contactos', 'rede']]) {
    const r = await validar(ESPEC, { obter: google({ paginas: { [u]: st } }).obter });
    assert.ok(r.erros.some((e) => e.includes(u.replace('https://exemplo.pt', '')) || e.includes(u)), `${u} → ${st} sem erro: ${r.erros.join(' | ')}`);
  }
});

test('validar (CLI): especificação limpa sai com 0; com erros sai com código ≠ 0', () => {
  const dir = novaPasta('marketeer-camp-cli-');
  const limpa = join(dir, 'limpa.md');
  const suja = join(dir, 'suja.md');
  writeFileSync(limpa, ESPEC);
  writeFileSync(suja, titulo('Ligue 222 000 111')(ESPEC));
  const correr = (f) => spawnSync(process.execPath, [join(REPO, 'scripts/campanha/validar.mjs'), f, '--sem-rede'], { encoding: 'utf8', env: { ...process.env, HOME } });
  const a = correr(limpa);
  assert.equal(a.status, 0, `limpa: ${a.stdout}${a.stderr}`);
  const b = correr(suja);
  assert.notEqual(b.status, 0, 'com erros tem de sair ≠ 0');
  assert.notEqual(b.status, null);
});

// ============================ 2. criar ============================

test('criar sem --confirmar: só validateOnly, confirma por GAQL que não existe, e nada fica criado', async () => {
  const { slug, raiz } = cliente({ [NOME]: ESPEC });
  const g = google();
  const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter }));
  assert.equal(x.e, undefined, tudo(x));
  assert.ok(x.r.ok, tudo(x));
  const m = g.mutates();
  assert.ok(m.length >= 1, 'o ensaio tem de passar pela API (validateOnly)');
  for (const p of m) assert.equal(p.b.validateOnly, true, `mutate sem validateOnly: ${p.url}`);
  assert.ok(g.queries().some((q) => /FROM campaign\b/.test(q) && q.includes(NOME)), 'não confirmou por GAQL que a campanha não existe');
  assert.equal((g.estado.entidades.campaign ?? []).length, 0, 'nada pode ficar criado');
  soPausa(g);
});

test('criar com --confirmar: cria (mutate real, sem validateOnly), verifica por GAQL a campanha criada e fica em PAUSED', async () => {
  const { slug, raiz } = cliente({ [NOME]: ESPEC });
  const g = google();
  const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar: true }));
  assert.ok(x.r?.ok, tudo(x));
  const reais = g.mutates().filter((p) => !p.b.validateOnly);
  assert.ok(reais.length >= 1, 'com --confirmar tem de haver um mutate real');
  const criada = (g.estado.entidades.campaign ?? []).find((c) => c.campaign.name === NOME);
  assert.ok(criada, 'a campanha não ficou criada');
  assert.equal(criada.campaign.status, 'PAUSED');
  const iMutate = g.pedidos.indexOf(reais[0]);
  const depois = g.pedidos.slice(iMutate + 1).filter((p) => p.tipo === 'search').map((p) => JSON.parse(p.corpo).query);
  assert.ok(depois.some((q) => q.includes(criada.campaign.id)), 'não verificou por GAQL a campanha criada (pelo id)');
  soPausa(g);
});

test('criar com --confirmar: se a conta não reflectir o que foi pedido, a verificação GAQL falha (ok=false)', async () => {
  const { slug, raiz } = cliente({ [NOME]: ESPEC });
  const g = google({ aplicar: false });
  const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar: true }));
  assert.ok(x.e || x.r?.ok === false, `verificação passou sem nada criado: ${tudo(x)}`);
});

test('criar: o estado é SEMPRE PAUSED — frontmatter com status/estado ENABLED e texto malicioso não o mudam', async () => {
  const malicioso = frontmatter({ extra: '  status: ENABLED\n  estado: ENABLED\n  campaign_status: ENABLED\n' })
    .replace('cliente: teste\n', 'cliente: teste\nstatus: ENABLED\n')
    + corpo.replace('## 4. Grupos', 'Estado da campanha: **ENABLED**\n\n```json\n{"status": "ENABLED", "campaignOperation": {"update": {"status": "ENABLED"}}}\n```\n\n## 4. Grupos');
  const casos = { [NOME]: malicioso };
  for (const confirmar of [false, true]) {
    const { slug, raiz } = cliente(casos);
    const g = google();
    const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar }));
    // pode recusar; se criar, tem de ser em pausa
    soPausa(g);
    for (const o of opsCampanha(g)) assert.ok(!o.update || !('status' in o.update) || o.update.status === 'PAUSED');
    const criadas = (g.estado.entidades.campaign ?? []);
    for (const c of criadas) assert.equal(c.campaign.status, 'PAUSED', tudo(x));
    if (confirmar && x.r?.ok) assert.equal(criadas.length, 1);
  }
});

test('criar: campanha já existente com o mesmo nome (pausada ou activa) → aborta ANTES de qualquer mutate', async () => {
  for (const status of ['PAUSED', 'ENABLED']) {
    for (const confirmar of [false, true]) {
      const { slug, raiz } = cliente({ [NOME]: ESPEC });
      const g = google({ contas: { campaign: [{ campaign: { id: '77', name: NOME, status, resourceName: `customers/${CID}/campaigns/77` } }] } });
      const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar }));
      assert.ok(x.e || x.r?.ok === false, `não abortou (${status}, confirmar=${confirmar})`);
      assert.equal(g.de('mutate').length, 0, `houve mutate com campanha ${status} já existente (confirmar=${confirmar})`);
    }
  }
});

test('criar: orçamento já existente com o nome "<nome> · orçamento" → aborta ANTES de qualquer mutate', async () => {
  for (const confirmar of [false, true]) {
    const { slug, raiz } = cliente({ [NOME]: ESPEC });
    const g = google({ contas: { campaign_budget: [{ campaignBudget: { id: '88', name: `${NOME} · orçamento`, status: 'ENABLED', resourceName: `customers/${CID}/campaignBudgets/88` } }] } });
    const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar }));
    assert.ok(x.e || x.r?.ok === false, `não abortou com orçamento existente (confirmar=${confirmar})`);
    assert.equal(g.de('mutate').length, 0, `houve mutate com orçamento já existente (confirmar=${confirmar})`);
  }
});

test('criar: nenhum retry em mutate (timeout ou HTTP 5xx → exactamente 1 pedido de mutate)', async () => {
  for (const confirmar of [false, true]) {
    for (const falha of ['timeout', '503']) {
      const { slug, raiz } = cliente({ [NOME]: ESPEC });
      const g = falha === 'timeout'
        ? google({ falhas: { mutate: [1, 2, 3] } })
        : google({ erroMutate: () => [503, { error: { code: 503, message: 'The service is currently unavailable.', status: 'UNAVAILABLE' } }] });
      const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar }));
      assert.ok(x.e || x.r?.ok === false, `falha no mutate não foi reportada (${falha}, confirmar=${confirmar})`);
      assert.equal(g.de('mutate').length, 1, `${falha}, confirmar=${confirmar}: ${g.de('mutate').length} pedidos de mutate (retry)`);
    }
  }
});

test('criar: geo com PRESENCE e objectivo DOWNLOAD biddable=false quando a especificação o diz; sem objectivos, não mexe', async () => {
  const { slug, raiz } = cliente({ [NOME]: ESPEC });
  const g = google();
  const x = await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar: true }));
  assert.ok(x.r?.ok, tudo(x));
  const c = opsCampanha(g).find((o) => o.create)?.create;
  assert.equal(c?.geoTargetTypeSetting?.positiveGeoTargetType, 'PRESENCE');
  assert.ok((g.estado.entidades.campaign_criterion ?? []).some((l) => /2620$/.test(l.campaignCriterion.location?.geoTargetConstant ?? '')), 'geo 2620 não criada');
  const obj = (cat) => g.estado.objectivos.find((o) => o.campaignConversionGoal.category === cat).campaignConversionGoal.biddable;
  assert.equal(obj('DOWNLOAD'), false, 'DOWNLOAD devia ficar biddable=false');
  assert.equal(obj('SUBMIT_LEAD_FORM'), true, 'SUBMIT_LEAD_FORM devia ficar biddable=true');

  const nome2 = 'GADS_Search_Leads_Sem_2026-10';
  const s2 = cliente({ [nome2]: frontmatter({ nome: nome2, objectivos: false }) + corpo });
  const g2 = google();
  const x2 = await comConsola(() => criar(s2.slug, nome2, { raiz: s2.raiz, obter: g2.obter, confirmar: true }));
  assert.ok(x2.r?.ok, tudo(x2));
  const d2 = g2.estado.objectivos.find((o) => o.campaignConversionGoal.category === 'DOWNLOAD');
  assert.equal(d2.campaignConversionGoal.biddable, true, 'sem objectivos na especificação, DOWNLOAD não se mexe');
});

// ============================ 3. investimento ============================

const contaComCampanhas = () => ({ campaign: [
  { campaign: { id: '55', name: 'Antiga sem teto', status: 'PAUSED', biddingStrategyType: 'TARGET_SPEND', targetSpend: {} }, campaignBudget: { amountMicros: '7000000' } },
  { campaign: { id: '56', name: 'Com teto', status: 'ENABLED', biddingStrategyType: 'TARGET_SPEND', targetSpend: { cpcBidCeilingMicros: '1500000' } }, campaignBudget: { amountMicros: '10000000' } },
] });

test('investimento: só leitura (nenhum :mutate), mensal = diário × 30,4, CPC máximo e "sem limite" quando não há', async () => {
  const { slug, raiz } = cliente({ [NOME]: ESPEC });
  const g = google({ contas: contaComCampanhas() });
  const a = await comConsola(() => investimento(slug, { raiz, obter: g.obter, hoje: HOJE }));
  const b = await comConsola(() => investimento(slug, { raiz, obter: g.obter, hoje: HOJE, especificacoes: [NOME] }));
  assert.equal(a.e, undefined, tudo(a));
  assert.equal(b.e, undefined, tudo(b));
  assert.equal(g.pedidos.filter((p) => /:mutate\b/.test(p.url)).length, 0, 'investimento fez :mutate');
  assert.equal(g.de('mutate').length, 0);

  const ta = tudo(a);
  const tb = tudo(b);
  const linha = (t, nome) => t.split(/\n|\\n/).find((l) => l.includes(`| ${nome} |`)) ?? '';
  // 7 × 30,4 = 212,80 · 10 × 30,4 = 304,00 · 5 × 30,4 = 152,00
  assert.match(linha(ta, 'Antiga sem teto'), /212[,.]80/);
  assert.match(linha(ta, 'Com teto'), /304[,.]00/);
  assert.match(linha(tb, NOME), /152[,.]00/);
  assert.match(linha(ta, 'Com teto'), /1[,.]50/, 'CPC máximo da conta não aparece');
  assert.match(linha(tb, NOME), /2[,.]30/, 'CPC máximo da especificação não aparece');
  // sem teto de CPC → assinalado. O critério diz "sem limite"; aceita-se "sem teto" (mesmo sentido).
  // (Uma especificação sem cpc_max não chega aqui: o validador recusa-a — SKILL, nova passo 4.)
  assert.match(linha(ta, 'Antiga sem teto'), /sem (limite|teto)/i, 'campanha sem CPC máximo não assinalada');
  assert.doesNotMatch(linha(ta, 'Com teto'), /sem (limite|teto)/i);
});

// ============================ 4. pesquisa ============================

const TERMOS = [
  { searchTermView: { searchTerm: 'apps gratis download' }, campaign: { name: 'Apps' }, metrics: { impressions: '7777', clicks: '12', costMicros: '9000000', conversions: 0 } },
  { searchTermView: { searchTerm: 'empresa de apps porto' }, campaign: { name: 'Apps' }, metrics: { impressions: '3333', clicks: '20', costMicros: '30000000', conversions: 2 } },
];
const semNumeroDeVolume = (texto, onde) => {
  for (const l of String(texto).split(/\n|\\n/)) {
    if (/volume|pesquisas mensais|avg ?monthly|searches/i.test(l)) assert.doesNotMatch(l.replace(/\b(20\d\d-\d\d-\d\d|v\d+)\b/g, ''), /\d/, `${onde}: número numa linha de volume: ${l}`);
  }
  assert.ok(!/\|\s*Volume\b/i.test(texto), `${onde}: coluna de volume`);
};

test('pesquisa: 403 DEVELOPER_TOKEN_NOT_APPROVED → fallback declarado para o histórico, sem nenhum número de volume', async () => {
  const { slug, raiz } = cliente();
  const g = google({ termos: TERMOS, erroPlaneador: erroApi('DEVELOPER_TOKEN_NOT_APPROVED', 'The developer token is only approved for use with test accounts.', 403) });
  const x = await comConsola(() => pesquisar(slug, { raiz, obter: g.obter, hoje: HOJE, sementes: ['apps', 'empresa de apps'] }));
  assert.equal(x.e, undefined, tudo(x));
  assert.ok(g.de('planeador').length >= 1, 'não tentou o Planeador');
  assert.equal(g.de('mutate').length, 0);
  const t = tudo(x);
  assert.match(t, /DEVELOPER_TOKEN_NOT_APPROVED/);
  assert.match(t, /hist[óo]rico/i, 'o fallback para o histórico tem de ser declarado');
  semNumeroDeVolume(t, 'resultado/consola');
  const rel = readdirSync(join(raiz, 'clientes', slug, 'campanhas')).filter((f) => /^pesquisa-/.test(f));
  assert.equal(rel.length, 1, 'relatório não gravado');
  const texto = readFileSync(join(raiz, 'clientes', slug, 'campanhas', rel[0]), 'utf8');
  assert.match(texto, /DEVELOPER_TOKEN_NOT_APPROVED/);
  semNumeroDeVolume(texto, 'relatório');
});

test('pesquisa: com o Planeador a responder, o volume aparece (o detector de volumes funciona)', async () => {
  const { slug, raiz } = cliente();
  const g = google({ termos: TERMOS, ideias: [{ text: 'empresa de apps', keywordIdeaMetrics: { avgMonthlySearches: '4321', competition: 'LOW' } }] });
  const x = await comConsola(() => pesquisar(slug, { raiz, obter: g.obter, hoje: HOJE, sementes: ['empresa de apps'] }));
  assert.equal(x.e, undefined, tudo(x));
  const rel = readdirSync(join(raiz, 'clientes', slug, 'campanhas')).find((f) => /^pesquisa-/.test(f));
  const texto = readFileSync(join(raiz, 'clientes', slug, 'campanhas', rel), 'utf8');
  assert.match(texto, /4321|4\.321|4 321/);
  assert.throws(() => semNumeroDeVolume(texto + '\n' + tudo(x), 'x'));
});

test('pesquisa: termos que gastaram sem converter aparecem como candidatos a negativas; palavras de termos que converteram não', async () => {
  const { slug, raiz } = cliente();
  const g = google({ termos: TERMOS, erroPlaneador: erroApi('DEVELOPER_TOKEN_NOT_APPROVED', 'Explorer', 403) });
  const x = await comConsola(() => pesquisar(slug, { raiz, obter: g.obter, hoje: HOJE, sementes: ['apps'] }));
  const rel = readdirSync(join(raiz, 'clientes', slug, 'campanhas')).find((f) => /^pesquisa-/.test(f));
  const texto = readFileSync(join(raiz, 'clientes', slug, 'campanhas', rel), 'utf8');
  const negs = texto.slice(texto.search(/negativas candidatas/i));
  assert.ok(negs.length > 0, 'sem secção de negativas candidatas');
  assert.match(negs, /gratis/, 'termo que gastou sem converter não deu negativa candidata');
  assert.doesNotMatch(negs.split('\n').filter((l) => l.startsWith('| `')).join('\n'), /`(empresa|porto)`/, 'palavra de termo que converteu proposta como negativa');
  assert.match(texto, /apps gratis download/, 'termo sem conversão não listado');
  void x;
});

// ============================ 5. nova ============================

test('nova: gera a especificação só com o que foi respondido; o que falta fica TODO/<sem fonte>, nada inventado', async () => {
  const { slug, raiz } = cliente();
  const caminho = nova(slug, { nome: 'GADS_Search_Leads_Parcial_2026-10', tema: 'apps', url_final: 'https://exemplo.pt/apps' }, { raiz, hoje: HOJE });
  assert.ok(existsSync(caminho));
  const texto = readFileSync(caminho, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---/.exec(texto)[1];
  assert.match(fm, /nome: GADS_Search_Leads_Parcial_2026-10/);
  assert.match(fm, /url_final: https:\/\/exemplo\.pt\/apps/);
  for (const k of ['orcamento_dia', 'cpc_max', 'licitacao', 'localizacoes', 'idiomas', 'telefone', 'horario', 'objectivos']) {
    assert.doesNotMatch(fm, new RegExp(`^\\s+${k}:`, 'm'), `frontmatter inventou ${k}`);
  }
  const campo = (rotulo) => texto.split('\n').find((l) => l.startsWith(`| ${rotulo} |`)) ?? '';
  for (const r of ['Orçamento', 'Licitação', 'Objectivo', 'Público']) assert.match(campo(r), /TODO|<sem fonte>/, `${r} sem resposta não ficou TODO: ${campo(r)}`);
  assert.doesNotMatch(texto, /\d+[,.]\d{2}\s*€|\d+\s*€\/dia/, 'valor em euros inventado');
  const factos = texto.slice(texto.indexOf('### Factos aprovados'), texto.indexOf('---', texto.indexOf('### Factos aprovados')));
  assert.match(factos, /TODO|<sem fonte>/, 'factos em falta não ficaram TODO');
  assert.doesNotMatch(texto, /\{\{/, 'marcador do modelo por preencher');
  assert.ok((await validar(texto, { rede: false, obter: ok200 })).erros.length > 0, 'especificação incompleta não pode validar');
});

test('nova: com todas as respostas, os valores passam para o frontmatter tal e qual', () => {
  const { slug, raiz } = cliente();
  const caminho = nova(slug, { nome: 'GADS_Search_Leads_Total_2026-10', tema: 'apps', objectivo: 'leads', publico: 'PME', localizacoes: [{ id: 2620, nome: 'Portugal' }], idiomas: [1014], orcamento_dia: 5, licitacao: 'maximizar-cliques', cpc_max: 2.3, url_final: 'https://exemplo.pt/apps', caminho: ['apps', 'medida'], telefone: '222 000 111', factos: ['Fornada diária desde 2015'] }, { raiz, hoje: HOJE });
  const t = readFileSync(caminho, 'utf8');
  for (const re of [/orcamento_dia: 5\b/, /cpc_max: 2\.3\b/, /id: 2620/, /- 1014/, /licitacao: maximizar-cliques/]) assert.match(t, re);
  assert.match(t, /Fornada diária desde 2015/);
});

// ============================ 6. csv ============================

function lerCsv(texto) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

test('csv: todos os ficheiros com BOM, Customer ID em todas as linhas, e nº de linhas igual à especificação', async () => {
  const extra = trocar(trocar(corpo, '[desenvolvimento de apps]\n```', '[desenvolvimento de apps]\n"criar app empresa"\n[criar app empresa]\n```'), '`gratis` `"como criar"`', '`gratis` `"como criar"` `[curso apps]`');
  const { slug, raiz } = cliente({ [NOME]: frontmatter() + extra });
  const x = await comConsola(() => gerarCsv(slug, NOME, { raiz }));
  assert.ok(x.r?.ok, tudo(x));
  const pasta = join(raiz, 'clientes', slug, 'campanhas', `${NOME}-carregamento`);
  const fs = readdirSync(pasta).filter((f) => f.endsWith('.csv'));
  assert.ok(fs.length >= 5);
  const dados = {};
  for (const f of fs) {
    const bruto = readFileSync(join(pasta, f), 'utf8');
    assert.ok(bruto.startsWith('﻿'), `${f} sem BOM`);
    const [cab, ...linhas] = lerCsv(bruto.slice(1)).filter((l) => l.some((c) => c !== ''));
    const iCid = cab.indexOf('Customer ID');
    assert.ok(iCid >= 0, `${f} sem coluna Customer ID`);
    for (const l of linhas) assert.equal(l[iCid].replace(/-/g, ''), CID, `${f}: linha sem Customer ID: ${l.join(',')}`);
    dados[f] = { cab, linhas };
  }
  const achar = (re) => Object.entries(dados).find(([f]) => re.test(f))?.[1];
  assert.equal(achar(/palavras-chave/).linhas.length, 6, 'palavras-chave: 6 na especificação');
  assert.equal(achar(/negativas/).linhas.length, 3, 'negativas de campanha: 3 na especificação');
  assert.equal(achar(/sitelinks/).linhas.length, 2);
  assert.equal(achar(/destaque/).linhas.length, 1);
  assert.equal(achar(/rsa|anuncios/).linhas.length, 1, '1 RSA (1 grupo)');
  assert.equal(achar(/grupos/).linhas.length, 1);
  const camp = achar(/campanhas/);
  assert.equal(camp.linhas.length, 1);
  assert.equal(camp.linhas[0][camp.cab.indexOf('Campaign status')], 'Paused');
});

// ============================ 7. segredos ============================

test('segredos: nada do cofre aparece na consola, nos resultados, nos erros nem nos ficheiros gravados', async () => {
  const saidas = [];
  const guardar = (x, onde) => saidas.push([onde, tudo(x)]);
  const { slug, raiz } = cliente({ [NOME]: ESPEC });

  // caminho feliz: os segredos viajam nos cabeçalhos (sentinelas vivas)
  const g = google({ termos: TERMOS, erroPlaneador: erroApi('DEVELOPER_TOKEN_NOT_APPROVED', `token ${DEV} not approved`, 403) });
  guardar(await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter })), 'criar ensaio');
  guardar(await comConsola(() => criar(slug, NOME, { raiz, obter: g.obter, confirmar: true })), 'criar');
  guardar(await comConsola(() => investimento(slug, { raiz, obter: g.obter, hoje: HOJE })), 'investimento');
  guardar(await comConsola(() => pesquisar(slug, { raiz, obter: g.obter, hoje: HOJE, sementes: ['apps'] })), 'pesquisa');
  guardar(await comConsola(() => gerarCsv(slug, NOME, { raiz })), 'csv');
  const api = g.pedidos.find((p) => p.tipo === 'search');
  assert.equal(api.headers.get('developer-token'), DEV, 'sentinela do developer token não foi usada');
  assert.equal(api.headers.get('authorization'), `Bearer ${ACCESS}`);
  assert.ok(g.de('token').some((p) => p.corpo.includes(encodeURIComponent(RT_CLIENTE)) || p.corpo.includes(RT_CLIENTE)), 'refresh token do cliente não foi usado');

  // erros que ecoam segredos no corpo
  const eco = `bad request token=${ACCESS} dev=${DEV} secret=${SECRET} rt=${RT_CLIENTE}`;
  const s2 = cliente({ [NOME]: ESPEC });
  const g2 = google({ erroMutate: () => [400, erroApi('INVALID', eco)] });
  guardar(await comConsola(() => criar(s2.slug, NOME, { raiz: s2.raiz, obter: g2.obter })), 'criar erro mutate');
  guardar(await comConsola(() => criar(s2.slug, NOME, { raiz: s2.raiz, obter: g2.obter, confirmar: true })), 'criar erro mutate confirmar');
  const g3 = google({ erroToken: { error: 'invalid_grant', error_description: eco } });
  guardar(await comConsola(() => criar(s2.slug, NOME, { raiz: s2.raiz, obter: g3.obter })), 'criar erro token');
  guardar(await comConsola(() => investimento(s2.slug, { raiz: s2.raiz, obter: g3.obter, hoje: HOJE })), 'investimento erro token');
  guardar(await comConsola(() => pesquisar(s2.slug, { raiz: s2.raiz, obter: g3.obter, hoje: HOJE, sementes: ['apps'] })), 'pesquisa erro token');
  const g4 = google({ erroPlaneador: erroApi('INTERNAL', eco, 403) });
  guardar(await comConsola(() => pesquisar(s2.slug, { raiz: s2.raiz, obter: g4.obter, hoje: HOJE, sementes: ['apps'] })), 'pesquisa erro planeador');

  for (const [onde, t] of saidas) semSegredos(t, onde);
  // ficheiros gravados pelo módulo
  const ficheiros = [];
  const andar = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else ficheiros.push(p); } };
  andar(join(raiz, 'clientes'));
  andar(join(s2.raiz, 'clientes'));
  for (const f of ficheiros) semSegredos(readFileSync(f, 'utf8'), f);
});

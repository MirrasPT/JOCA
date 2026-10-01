// Testes do módulo de contas — parte GA4 do #8 — escritos a partir dos critérios de aceitação do
// issue, do comentário do #10 (I1: tabela canal → chave num sítio; notas de erro limpas) e de
// D-008/D-016/D-017. Não a partir do corpo de contas.mjs / limpar.mjs.
// Sem rede e sem a chave real: a service account é FALSA (chave RSA gerada aqui, JSON num mkdtemp),
// e o cofre, a leitura do ficheiro, o fetch e o relógio são sempre injectados.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { auditar } from '../scripts/auditoria/contas.mjs';
import { limparErro } from '../scripts/auditoria/limpar.mjs';
import { CHAVES_DO_COFRE } from '../scripts/chaves.mjs';
import { auditarCliente } from '../scripts/auditoria/correr.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SLUG = 'padaria-teste';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const AGORA_MS = 1_790_000_000_123;
const AGORA_S = Math.floor(AGORA_MS / 1000);

// Segredos marcados: nenhum pode aparecer no resultado, nas notas nem nos logs.
const TOKEN = 'ya29.TESTE_token_SEGREDO_0123456789abcdef';
const EMAIL = 'marketeer-teste-segredo@projecto-falso.iam.gserviceaccount.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const PEM_MIOLO = PEM.split('\n')[2]; // uma linha de base64 do corpo da chave
const PEM_ESCAPADO = JSON.stringify(PEM).slice(1, -1); // como vem dentro de um corpo JSON

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaPasta = (pref = 'marketeer-contas-') => {
  const p = mkdtempSync(join(tmpdir(), pref));
  pastas.push(p);
  return p;
};

const PASTA_SA = novaPasta();
const CAMINHO_SA = join(PASTA_SA, 'service-account-falsa.json');
writeFileSync(CAMINHO_SA, JSON.stringify({
  type: 'service_account',
  project_id: 'projecto-falso',
  private_key_id: 'id-falso',
  private_key: PEM,
  client_email: EMAIL,
  token_uri: TOKEN_URL,
}));

const cliente = (canais) => ({ slug: SLUG, canais });
const ga4 = (id) => ({ tipo: 'ga4', id, acesso: true });

// Cofre falso: regista cada leitura; devolve o caminho do JSON para GOOGLE_SERVICE_ACCOUNT.
function cofre(valor = CAMINHO_SA) {
  const leituras = [];
  const lerCofre = (slug, chave) => {
    leituras.push({ slug, chave });
    return typeof valor === 'function' ? valor(slug, chave) : valor;
  };
  return { lerCofre, leituras };
}

const cabecalhos = (init) => new Headers(init?.headers ?? {});
const corpoTexto = (init) => (init?.body == null ? '' : typeof init.body === 'string' ? init.body : String(init.body));

// fetch falso: grava todos os pedidos. `eventos` = { id: n } (eventCount por propriedade);
// `semRows` = ids que respondem sem `rows`; `respostaReport(id)` / `respostaToken()` sobrepõem.
function rede({ eventos = {}, semRows = [], respostaReport, respostaToken, lancar } = {}) {
  const pedidos = [];
  const obter = async (url, init = {}) => {
    const u = String(url);
    pedidos.push({ url: u, metodo: (init.method ?? 'GET').toUpperCase(), headers: cabecalhos(init), corpo: corpoTexto(init) });
    if (lancar) throw lancar;
    if (u === TOKEN_URL) {
      if (respostaToken) return respostaToken();
      return Response.json({ access_token: TOKEN, expires_in: 3600, token_type: 'Bearer' });
    }
    const m = u.match(/\/properties\/(\d+):runReport$/);
    if (m) {
      const id = m[1];
      if (respostaReport) {
        const r = respostaReport(id);
        if (r) return r;
      }
      if (semRows.includes(id)) return Response.json({ rowCount: 0, metricHeaders: [] });
      const pedidas = (JSON.parse(corpoTexto(init)).metrics ?? []).map((x) => x.name);
      const valores = { activeUsers: String(Math.floor((eventos[id] ?? 0) / 10)), eventCount: String(eventos[id] ?? 0) };
      return Response.json({ rows: [{ metricValues: pedidas.map((n) => ({ value: valores[n] ?? '0' })) }], rowCount: 1 });
    }
    return new Response('inesperado', { status: 599 });
  };
  return { obter, pedidos };
}

// Captura console.* durante a chamada — "nenhum token nos logs".
async function comLogs(fn) {
  const linhas = [];
  const orig = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
    orig[k] = console[k];
    console[k] = (...a) => linhas.push(a.map(String).join(' '));
  }
  try {
    return { r: await fn(), logs: linhas.join('\n') };
  } finally {
    Object.assign(console, orig);
  }
}

async function correr(canais, redeOpts = {}, extra = {}) {
  const net = rede(redeOpts);
  const cf = cofre(extra.valorCofre);
  const { r, logs } = await comLogs(() => auditar({
    site: 'https://padaria.invalid',
    cliente: cliente(canais),
    obter: net.obter,
    lerCofre: extra.lerCofre ?? cf.lerCofre,
    ...(extra.lerFicheiro ? { lerFicheiro: extra.lerFicheiro } : {}),
    agora: () => AGORA_MS,
  }));
  return { r, logs, pedidos: net.pedidos, leituras: cf.leituras };
}

const area = (r, nome) => r.areas.find((a) => a.area === nome);

function semSegredos(r, logs = '', extra = []) {
  const json = JSON.stringify(r);
  for (const s of [TOKEN, 'ya29.', EMAIL, PEM_MIOLO, 'BEGIN PRIVATE KEY', 'eyJ', CAMINHO_SA, PASTA_SA, ...extra]) {
    assert.ok(!json.includes(s), `segredo no resultado: ${s.slice(0, 24)}…\n${json}`);
    assert.ok(!logs.includes(s), `segredo nos logs: ${s.slice(0, 24)}…`);
  }
}

const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

// ---------------------------------------------------------------------------------------------
// Critério 1: sem credencial no cofre → nao-verificado, sem chamadas
// ---------------------------------------------------------------------------------------------

const casosSemRede = [
  ['sem canal ga4', [{ tipo: 'instagram', id: 'padaria' }], {}],
  ['sem canais', [], {}],
  ['id <sem fonte>', [ga4('<sem fonte>')], {}],
  ['id vazio', [ga4('')], {}],
  ['id measurement G-…', [ga4('G-ABC123XYZ')], {}],
  ['cofre devolve null', [ga4('123456789')], { valorCofre: null }],
  ['cofre lança', [ga4('123456789')], { lerCofre: () => { throw new Error(`slug inválido ${TOKEN}`); } }],
];

for (const [nome, canais, extra] of casosSemRede) {
  test(`sem rede — ${nome}: contas.ga4 nao-verificado com nota e 0 chamadas`, async () => {
    const { r, logs, pedidos } = await correr(canais, {}, extra);
    assert.equal(pedidos.length, 0, `chamadas feitas: ${pedidos.map((p) => p.url)}`);
    const a = area(r, 'contas.ga4');
    assert.equal(a?.estado, 'nao-verificado');
    assert.ok(a.nota?.trim(), 'nao-verificado sem nota (D-012)');
    assert.deepEqual(r.achados, []);
    semSegredos(r, logs);
  });
}

test('cliente sem campo canais (undefined): nao-verificado, 0 chamadas, não lança', async () => {
  const net = rede();
  const r = await auditar({ cliente: { slug: SLUG }, obter: net.obter, lerCofre: () => CAMINHO_SA, agora: () => AGORA_MS });
  assert.equal(net.pedidos.length, 0);
  assert.equal(area(r, 'contas.ga4')?.estado, 'nao-verificado');
});

test('id G-… (measurement ID): a nota explica que é preciso o property ID numérico', async () => {
  const { r } = await correr([ga4('G-ABC123XYZ')]);
  assert.match(area(r, 'contas.ga4').nota, /measurement|property|num[eé]ric/i);
});

test('I1: a credencial GA4 lê-se no cofre pela chave da tabela CHAVES_DO_COFRE, com o slug do cliente', async () => {
  const { leituras } = await correr([ga4('123456789')], { eventos: { 123456789: 50 } });
  assert.ok(leituras.length >= 1, 'cofre não foi lido');
  for (const l of leituras) {
    assert.equal(l.slug, SLUG);
    assert.ok(CHAVES_DO_COFRE.ga4.includes(l.chave), `chave fora da tabela: ${l.chave}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Critério 2: GA4 sem eventos nos últimos 7 dias → achado
// ---------------------------------------------------------------------------------------------

test('0 eventos → achado contas.ga4.sem-eventos, severidade alta, alvo = property id', async () => {
  const { r, logs } = await correr([ga4('123456789')], { eventos: { 123456789: 0 } });
  assert.equal(r.achados.length, 1, JSON.stringify(r.achados));
  const [a] = r.achados;
  assert.equal(a.regra, 'contas.ga4.sem-eventos');
  assert.equal(a.severidade, 'alta');
  assert.equal(a.alvo, '123456789');
  assert.equal(a.area, 'contas.ga4');
  assert.ok(a.evidencia?.trim(), 'achado sem evidência');
  assert.ok(a.recomendacao?.trim(), 'achado sem recomendação');
  semSegredos(r, logs);
});

test('resposta sem `rows` conta como 0 eventos → achado', async () => {
  const { r } = await correr([ga4('123456789')], { semRows: ['123456789'] });
  assert.deepEqual(r.achados.map((a) => [a.regra, a.alvo]), [['contas.ga4.sem-eventos', '123456789']]);
  assert.notEqual(area(r, 'contas.ga4').estado, 'erro', 'sem rows tratado como erro');
});

test('eventos > 0 → contas.ga4 verificado, sem achados, nota com os números', async () => {
  const { r, logs } = await correr([ga4('123456789')], { eventos: { 123456789: 4321 } });
  const a = area(r, 'contas.ga4');
  assert.equal(a.estado, 'verificado');
  assert.deepEqual(r.achados, []);
  assert.match(a.nota ?? '', /4321|4\s?321|4\.321/, `nota sem o nº de eventos: ${a.nota}`);
  semSegredos(r, logs);
});

test('o pedido runReport pede activeUsers e eventCount de 7daysAgo a yesterday, com o Bearer do token', async () => {
  const { pedidos } = await correr([ga4('123456789')], { eventos: { 123456789: 10 } });
  const rep = pedidos.find((p) => p.url.endsWith(':runReport'));
  assert.ok(rep, 'sem runReport');
  assert.match(rep.url, /^https:\/\/analyticsdata\.googleapis\.com\/v1beta\/properties\/123456789:runReport$/);
  assert.equal(rep.headers.get('authorization'), `Bearer ${TOKEN}`);
  const corpo = JSON.parse(rep.corpo);
  assert.deepEqual(corpo.dateRanges, [{ startDate: '7daysAgo', endDate: 'yesterday' }]);
  assert.deepEqual(corpo.metrics.map((m) => m.name).sort(), ['activeUsers', 'eventCount']);
});

// ---------------------------------------------------------------------------------------------
// Critério 4: nenhuma escrita — só o scope readonly e só os dois pedidos permitidos (D-008)
// ---------------------------------------------------------------------------------------------

test('JWT: RS256 assinado pela chave da service account, scope só analytics.readonly, aud, iat/exp', async () => {
  const { pedidos } = await correr([ga4('123456789')], { eventos: { 123456789: 10 } });
  const tok = pedidos.filter((p) => p.url === TOKEN_URL);
  assert.equal(tok.length, 1);
  assert.equal(tok[0].metodo, 'POST');
  const params = new URLSearchParams(tok[0].corpo);
  assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const jwt = params.get('assertion');
  assert.ok(jwt, 'sem assertion no pedido do token');
  const [h, p, s] = jwt.split('.');
  assert.equal(b64json(h).alg, 'RS256');
  assert.ok(verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url')), 'assinatura inválida');
  const c = b64json(p);
  assert.equal(c.iss, EMAIL);
  assert.equal(c.scope, SCOPE, `scope não é exactamente o readonly: ${c.scope}`);
  assert.equal(c.aud, TOKEN_URL);
  assert.equal(c.iat, AGORA_S);
  assert.equal(c.exp, AGORA_S + 3600);
});

test('só POST ao token endpoint ou a …/properties/<id>:runReport — nenhum outro pedido', async () => {
  const casos = [
    { eventos: { 111: 5, 222: 0 } },
    { respostaReport: () => new Response('{}', { status: 403 }) },
    { respostaReport: () => new Response('{}', { status: 500 }) },
  ];
  for (const opts of casos) {
    const { pedidos } = await correr([ga4('111'), ga4('222')], opts);
    assert.ok(pedidos.length > 0);
    for (const p of pedidos) {
      assert.equal(p.metodo, 'POST', `${p.metodo} ${p.url}`);
      const ok = p.url === TOKEN_URL || /^https:\/\/analyticsdata\.googleapis\.com\/v1beta\/properties\/\d+:runReport$/.test(p.url);
      assert.ok(ok, `pedido fora do permitido: ${p.url}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Vários canais: um só token
// ---------------------------------------------------------------------------------------------

test('vários canais ga4 → 1 pedido de token, 1 runReport por propriedade; achado só na que tem 0', async () => {
  const { r, pedidos } = await correr([ga4('111'), ga4('222'), ga4('333')], { eventos: { 111: 9, 222: 0, 333: 70 } });
  assert.equal(pedidos.filter((p) => p.url === TOKEN_URL).length, 1, 'token pedido mais de uma vez');
  assert.deepEqual(pedidos.filter((p) => p.url.endsWith(':runReport')).map((p) => p.url.match(/properties\/(\d+)/)[1]).sort(), ['111', '222', '333']);
  assert.deepEqual(r.achados.map((a) => [a.regra, a.alvo]), [['contas.ga4.sem-eventos', '222']]);
});

test('vários canais todos a 0 → um achado por propriedade (regra+alvo únicos, D-016)', async () => {
  const { r } = await correr([ga4('111'), ga4('222')], { eventos: {} });
  const chaves = r.achados.map((a) => `${a.regra}|${a.alvo}`);
  assert.deepEqual(chaves.sort(), ['contas.ga4.sem-eventos|111', 'contas.ga4.sem-eventos|222']);
});

// ---------------------------------------------------------------------------------------------
// Erros → área `erro` com nota; nota e resultado sem segredos (critério 5)
// ---------------------------------------------------------------------------------------------

// Corpo de erro "venenoso": traz o token, a chave (escapada como em JSON) e o email.
const VENENO = `{"error":{"message":"Bearer ${TOKEN} key ${PEM_ESCAPADO} sa ${EMAIL}"}}`;
const casosErro = [
  ['403', { respostaReport: () => new Response(VENENO, { status: 403 }) }, /permiss/i, true],
  ['404', { respostaReport: () => new Response(VENENO, { status: 404 }) }, /errad|n[ãa]o existe|n[ãa]o encontr|404/i, true],
  ['401', { respostaReport: () => new Response(VENENO, { status: 401 }) }, /token|recus|401/i, false],
  ['500', { respostaReport: () => new Response(VENENO, { status: 500 }) }, /500|HTTP|servidor/i, false],
  ['503', { respostaReport: () => new Response(VENENO, { status: 503 }) }, /503|HTTP|servidor|indispon/i, false],
  ['rede (fetch lança)', { lancar: new TypeError(`fetch failed: Bearer ${TOKEN} ${PEM} ${EMAIL}`) }, /rede|liga[çc][ãa]o|fetch/i, false],
  ['token endpoint recusa', { respostaToken: () => new Response(`{"error":"invalid_grant","error_description":"${PEM_ESCAPADO} ${EMAIL}"}`, { status: 400 }) }, /token|credencial|recus|autentica/i, false],
];

for (const [nome, opts, nota, comId] of casosErro) {
  test(`erro ${nome} → contas.ga4 "erro" com nota esperada, sem achados nem segredos`, async () => {
    const { r, logs } = await correr([ga4('123456789')], opts);
    const a = area(r, 'contas.ga4');
    assert.equal(a?.estado, 'erro');
    assert.match(a.nota ?? '', nota, `nota: ${a.nota}`);
    if (comId) assert.ok(a.nota.includes('123456789'), `nota sem o property id: ${a.nota}`);
    assert.deepEqual(r.achados, [], 'erro virou achado (D-017: 403 é erro, não achado)');
    semSegredos(r, logs);
  });
}

test('token endpoint recusa → nenhum runReport é pedido', async () => {
  const { pedidos } = await correr([ga4('123456789')], { respostaToken: () => new Response('{"error":"invalid_grant"}', { status: 400 }) });
  assert.equal(pedidos.filter((p) => p.url.endsWith(':runReport')).length, 0);
});

test('um canal com 403 e outro com eventos: área em erro, e o bom não perde o seu resultado', async () => {
  const { r, pedidos } = await correr([ga4('111'), ga4('222')], {
    eventos: { 222: 0 },
    respostaReport: (id) => (id === '111' ? new Response(VENENO, { status: 403 }) : null),
  });
  assert.equal(area(r, 'contas.ga4').estado, 'erro');
  assert.equal(pedidos.filter((p) => p.url.endsWith(':runReport')).length, 2, 'parou no primeiro erro');
  assert.deepEqual(r.achados.map((a) => a.alvo), ['222']);
  semSegredos(r);
});

const casosChave = [
  ['JSON ilegível', () => `isto não é json ${PEM} ${EMAIL}`],
  ['JSON sem private_key', () => JSON.stringify({ client_email: EMAIL })],
  ['JSON sem client_email', () => JSON.stringify({ private_key: PEM })],
  ['ficheiro inexistente', (p) => { const e = new Error(`ENOENT: no such file or directory, open '${p}' ${PEM}`); e.code = 'ENOENT'; throw e; }],
];
for (const [nome, lerFicheiro] of casosChave) {
  test(`chave da service account: ${nome} → erro com nota, sem caminho nem conteúdo, 0 chamadas`, async () => {
    const { r, logs, pedidos } = await correr([ga4('123456789')], {}, { lerFicheiro });
    assert.equal(pedidos.length, 0, 'rede chamada sem chave utilizável');
    const a = area(r, 'contas.ga4');
    assert.equal(a?.estado, 'erro');
    assert.ok(a.nota?.trim());
    assert.deepEqual(r.achados, []);
    semSegredos(r, logs, ['isto não é json']);
  });
}

test('caso nominal: resultado e logs sem token, chave, email nem JWT', async () => {
  const { r, logs } = await correr([ga4('111'), ga4('222')], { eventos: { 111: 3, 222: 0 } });
  semSegredos(r, logs);
});

// ---------------------------------------------------------------------------------------------
// Search Console: fora do âmbito — sempre nao-verificado
// ---------------------------------------------------------------------------------------------

test('contas.search-console é sempre nao-verificado com nota, com ou sem canal/credencial', async () => {
  for (const canais of [[], [ga4('111')], [{ tipo: 'search-console', id: 'sc-domain:padaria.invalid' }]]) {
    const { r } = await correr(canais, { eventos: { 111: 5 } });
    const a = area(r, 'contas.search-console');
    assert.equal(a?.estado, 'nao-verificado');
    assert.ok(a.nota?.trim());
    assert.equal(r.areas.length, 2);
    assert.ok(!r.achados.some((x) => x.area === 'contas.search-console'));
  }
});

// ---------------------------------------------------------------------------------------------
// limparErro — o sanitizador único (D-017)
// ---------------------------------------------------------------------------------------------

test('limparErro: Bearer, ya29., JWT e email de service account saem', () => {
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJ4In0.c2lnbmF0dXJhU0VHUkVETw';
  const t = limparErro(`falhou Authorization: Bearer abc.DEF-ghi_SEGREDO1 e ${TOKEN} jwt ${jwt} sa ${EMAIL} fim`);
  for (const s of ['abc.DEF-ghi_SEGREDO1', 'SEGREDO1', 'ya29', 'TESTE_token', 'eyJ', 'c2lnbmF0dXJhU0VHUkVETw', 'eyJpc3MiOiJ4In0', EMAIL, 'iam.gserviceaccount']) {
    assert.ok(!t.includes(s), `ficou ${s}: ${t}`);
  }
  assert.match(t, /^falhou/);
  assert.match(t, /fim$/);
});

test('limparErro: bloco PEM completo (multi-linha) sai, e o texto à volta fica', () => {
  const t = limparErro(`antes ${PEM.trim()} depois`);
  assert.ok(!t.includes(PEM_MIOLO) && !t.includes('BEGIN') && !t.includes('END PRIVATE'), t);
  assert.match(t, /antes/);
  assert.match(t, /depois/, 'limpou depois de cortar à 1.ª linha (a ordem é limpar → 1.ª linha)');
});

test('limparErro: PEM sem END (truncado) sai até ao fim', () => {
  const t = limparErro(`erro: -----BEGIN RSA PRIVATE KEY-----MIIEowIBAAKCAQEAsegredoTRUNCADO`);
  assert.ok(!t.includes('MIIEowIBAAKCAQEAsegredoTRUNCADO'), t);
  assert.ok(!t.includes('BEGIN'), t);
  assert.match(t, /^erro/);
});

test('limparErro: PEM escapado numa linha (como vem num corpo JSON) sai', () => {
  const t = limparErro(`{"private_key":"${PEM_ESCAPADO}","x":1}`);
  assert.ok(!t.includes(PEM_MIOLO), t);
  assert.ok(!t.includes('BEGIN'), t);
});

test('limparErro: fica só com a 1.ª linha', () => {
  assert.equal(limparErro('linha um\nlinha dois com Bearer x'), 'linha um');
  assert.equal(limparErro('linha um\r\nlinha dois').trim(), 'linha um');
});

test('limparErro: corta a 200 por omissão e a `max` quando dado', () => {
  assert.ok(limparErro('a'.repeat(500)).length <= 200);
  assert.ok(limparErro('a'.repeat(500)).length >= 100, 'cortou demais');
  assert.ok(limparErro('b'.repeat(500), 50).length <= 50);
  assert.equal(limparErro('curto'), 'curto');
});

test('limparErro: token perto do limite não deixa pedaço (limpa antes de cortar)', () => {
  const t = limparErro(`${'x'.repeat(190)} ${TOKEN}`);
  assert.ok(!t.includes('ya29') && !t.includes('TESTE'), t);
  const t2 = limparErro(`${'x'.repeat(185)} Bearer SEGREDOLONGO123456789`);
  assert.ok(!t2.includes('SEGR'), t2);
});

test('limparErro: null/undefined/não-texto não lançam e devolvem texto', () => {
  assert.equal(typeof limparErro(null), 'string');
  assert.equal(typeof limparErro(undefined), 'string');
  assert.equal(typeof limparErro(new Error(`x Bearer SEGREDO9`)), 'string');
  assert.ok(!limparErro(new Error(`x Bearer SEGREDO9`)).includes('SEGREDO9'));
});

// ---------------------------------------------------------------------------------------------
// correr.mjs: a nota de erro de módulo gravada vem limpa
// ---------------------------------------------------------------------------------------------

const dossier = `---
cliente:
  nome: Padaria Teste
  slug: ${SLUG}
  sector: restauração
  site: https://padaria.invalid
  responsavel: equipa
marca: <sem fonte>
publico: <sem fonte>
objectivos: []
concorrentes: []
canais: []
estado: dossier criado
actualizado: 2026-09-24
---

# Padaria Teste
`;

function todosOsFicheiros(raiz) {
  const r = [];
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else r.push([relative(raiz, p), readFileSync(p, 'utf8')]);
    }
  };
  andar(raiz);
  return r;
}

test('correr.mjs: módulo que lança com Bearer e PEM → nota gravada limpa', async () => {
  const raiz = novaPasta('marketeer-contas-correr-');
  mkdirSync(join(raiz, 'clientes', SLUG), { recursive: true });
  writeFileSync(join(raiz, 'clientes', SLUG, 'dossier.md'), dossier);
  const pemLinha = `-----BEGIN PRIVATE KEY-----MIIEsegredoPEMlinha-----END PRIVATE KEY-----`;
  const modulos = [
    { nome: 'seo', web: true, importar: async () => ({ auditar: async () => { throw new Error(`HTTP 403 Bearer xSEGREDOx ${pemLinha} ${TOKEN}`); } }) },
    { nome: 'presenca', web: true, importar: async () => ({ auditar: async () => { throw new Error(`falhou\n${PEM}`); } }) },
  ];
  const { caminho, auditoria } = await comLogs(() => auditarCliente(SLUG, { raiz, modulos, hoje: new Date(2026, 8, 25, 12) })).then((x) => x.r);
  const gravado = readFileSync(caminho, 'utf8');
  for (const s of ['xSEGREDOx', 'MIIEsegredoPEMlinha', 'BEGIN', PEM_MIOLO, 'ya29', 'TESTE_token']) {
    assert.ok(!gravado.includes(s), `segredo na auditoria gravada: ${s}`);
    assert.ok(!JSON.stringify(auditoria).includes(s), `segredo na auditoria devolvida: ${s}`);
  }
  for (const [ficheiro, conteudo] of todosOsFicheiros(raiz)) {
    assert.ok(!conteudo.includes('xSEGREDOx') && !conteudo.includes(PEM_MIOLO), `segredo gravado em ${ficheiro}`);
  }
  const seo = auditoria.areas.find((a) => a.area === 'seo');
  assert.equal(seo.estado, 'erro');
  assert.ok(seo.nota?.trim());
});

// ---------------------------------------------------------------------------------------------
// I1: a tabela canal → chave vive só em scripts/chaves.mjs
// ---------------------------------------------------------------------------------------------

test('CHAVES_DO_COFRE: ga4 → GOOGLE_SERVICE_ACCOUNT (D-017)', () => {
  assert.deepEqual(CHAVES_DO_COFRE.ga4, ['GOOGLE_SERVICE_ACCOUNT']);
});

test('I1: CHAVES_DO_COFRE define-se só em scripts/chaves.mjs; resumo.mjs e contas.mjs importam-na', () => {
  const ficheiros = [];
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(mjs|js)$/.test(n)) ficheiros.push(p);
    }
  };
  andar(join(RAIZ, 'scripts'));
  const definem = ficheiros.filter((f) => /\b(?:const|let|var)\s+CHAVES_DO_COFRE\b|\bCHAVES_DO_COFRE\s*=/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(definem.map((f) => relative(RAIZ, f).split('\\').join('/')), ['scripts/chaves.mjs']);
  const importa = /import\s*\{[^}]*\bCHAVES_DO_COFRE\b[^}]*\}\s*from\s*['"][./]*\/?chaves\.mjs['"]/;
  for (const f of ['scripts/resumo.mjs', 'scripts/auditoria/contas.mjs']) {
    const src = readFileSync(join(RAIZ, f), 'utf8');
    assert.match(src, importa, `${f} não importa CHAVES_DO_COFRE de chaves.mjs`);
    // nenhuma outra tabela canal → chave (literal com GOOGLE_SERVICE_ACCOUNT como valor de um canal)
    assert.doesNotMatch(src, /['"]?(?:ga4|search-console)['"]?\s*:\s*\[\s*['"]GOOGLE_SERVICE_ACCOUNT/, `${f} redefine a tabela`);
  }
});

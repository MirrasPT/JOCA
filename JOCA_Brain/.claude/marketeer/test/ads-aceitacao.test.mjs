// Suite de aceitação do módulo ads, escrita a partir dos critérios do issue, do
// SKILL (`## ads`) e da D-019 — não a partir do corpo dos scripts. Sem rede real e sem o cofre real:
// o HOME aponta para uma pasta temporária ANTES de importar os módulos, o cofre da agência e do
// cliente são ficheiros falsos lá dentro, e a Google é um `fetch` falso que grava cada pedido.
// Segredos marcados (sentinelas): nenhum pode aparecer na consola, em erros, relatórios ou resultados.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaPasta = (pref) => { const p = mkdtempSync(join(tmpdir(), pref)); pastas.push(p); return p; };

// HOME falso antes de qualquer import do módulo: o cofre real (~/.config/marketeer) nunca é tocado.
const HOME = novaPasta('marketeer-ads-home-');
process.env.HOME = HOME;
const COFRE = join(HOME, '.config', 'marketeer');
mkdirSync(COFRE, { recursive: true });

const { ligar, SCOPE_ADS } = await import('../scripts/ads/ligar.mjs');
const { diagnosticar } = await import('../scripts/ads/diagnostico.mjs');
const alterar = await import('../scripts/ads/alterar.mjs');
const { pausar, mudarObjectivos, planearPausa } = alterar;
const { CHAVES_DO_COFRE } = await import('../scripts/chaves.mjs');

const REPO = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CID = '1234567890';
const MCC_COFRE = '9998887777';

// Sentinelas.
const DEV = 'DEVTOKEN_SEGREDO_agencia_77';
const SECRET = 'GOCSPX-SEGREDO_client_secret_88';
const RT_AGENCIA = '1//0SEGREDO_refresh_AGENCIA_aaaa';
const RT_CLIENTE = '1//0SEGREDO_refresh_CLIENTE_bbbb';
const RT_NOVO = '1//0SEGREDO_refresh_LIGAR_cccc';
const ACCESS = 'ya29.SEGREDO_access_token_dddd';
const SEGREDOS = [DEV, SECRET, RT_AGENCIA, RT_CLIENTE, RT_NOVO, ACCESS];

function semSegredos(texto, onde) {
  for (const s of SEGREDOS) assert.ok(!String(texto).includes(s), `${onde} contém um segredo (${s.slice(0, 12)}…)`);
}

// ---- cofre falso (ficheiros no HOME temporário) ----
function escreverCofre(slug, chaves) {
  const linhas = Object.entries(chaves).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`);
  writeFileSync(join(COFRE, `${slug}.env`), linhas.join('\n') + '\n', { mode: 0o600 });
}
function cofreAgencia({ refresh = RT_AGENCIA, mcc = '999-888-7777' } = {}) {
  writeFileSync(join(COFRE, 'google-ads-oauth-client.json'), JSON.stringify({ installed: { client_id: 'cliente-oauth.apps.googleusercontent.com', client_secret: SECRET } }));
  escreverCofre('google-ads', { GOOGLE_ADS_DEVELOPER_TOKEN: DEV, GOOGLE_ADS_LOGIN_CUSTOMER_ID: mcc, GOOGLE_ADS_REFRESH_TOKEN: refresh });
}
const lerFicheiroCofre = (slug) => { try { return readFileSync(join(COFRE, `${slug}.env`), 'utf8'); } catch { return ''; } };

// ---- raiz falsa com dossiers ----
function raizCom(...slugs) {
  const raiz = novaPasta('marketeer-ads-raiz-');
  for (const slug of slugs) {
    mkdirSync(join(raiz, 'clientes', slug), { recursive: true });
    writeFileSync(join(raiz, 'clientes', slug, 'dossier.md'), [
      '---', 'cliente:', `  nome: Teste ${slug}`, `  slug: ${slug}`, 'canais:',
      '  - tipo: google-ads', '    id: 123-456-7890', '    acesso: false', '---', '', `# ${slug}`, '',
    ].join('\n'));
  }
  return raiz;
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

// ---- Google falsa ----
const camp = (id, name, status, experimentType = 'BASE') => ({
  campaign: { id: String(id), name, status, experimentType, resourceName: `customers/${CID}/campaigns/${id}` },
});
const goal = (campId, category, origin, biddable) => ({
  campaign: { id: String(campId) },
  campaignConversionGoal: { resourceName: `customers/${CID}/campaignConversionGoals/${campId}~${category}~${origin}`, category, origin, biddable },
});
const erroTimeout = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');
const erroApi = (codigo, mensagem) => ({
  error: { code: 400, message: mensagem, status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.ads.googleads.v25.errors.GoogleAdsFailure', errors: [{ errorCode: codigo, message: mensagem }] }] },
});

function google({ campanhas = [], objectivos = [], landing = [], anuncios = [], paginas = {}, falhas = {}, aplicar = true, erroMutate, erroSearch, erroToken, refreshDevolvido = RT_NOVO } = {}) {
  const pedidos = [];
  const estado = { campanhas: structuredClone(campanhas), objectivos: structuredClone(objectivos) };
  const obter = async (url, init = {}) => {
    const u = String(url);
    const tipo = u === TOKEN_URL ? 'token' : /:mutate$/.test(u) ? 'mutate' : /googleAds:search(Stream)?$/.test(u) ? 'search' : 'pagina';
    const corpo = init.body == null ? '' : String(init.body);
    const p = { tipo, url: u, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers ?? {}), corpo };
    pedidos.push(p);
    const n = pedidos.filter((x) => x.tipo === tipo).length;
    if (falhas[tipo]?.includes(n)) throw erroTimeout();

    if (tipo === 'token') {
      const f = new URLSearchParams(corpo);
      if (erroToken) return Response.json(erroToken, { status: 400 });
      if (f.get('grant_type') === 'authorization_code') return Response.json({ access_token: ACCESS, refresh_token: refreshDevolvido, scope: SCOPE_ADS, expires_in: 3599, token_type: 'Bearer' });
      return Response.json({ access_token: ACCESS, expires_in: 3599, token_type: 'Bearer' });
    }
    if (tipo === 'search') {
      if (erroSearch) return Response.json(erroSearch(p), { status: 400 });
      const q = JSON.parse(corpo).query;
      let results = [];
      if (/FROM customer\b/.test(q)) results = [{ customer: { id: CID, descriptiveName: 'Conta Teste', currencyCode: 'EUR' } }];
      else if (/FROM campaign_conversion_goal\b/.test(q)) {
        const m = /campaign\.id = (\d+)/.exec(q);
        results = estado.objectivos.filter((o) => !m || o.campaign.id === m[1]);
      } else if (/FROM landing_page_view\b/.test(q)) results = landing;
      else if (/FROM ad_group_ad\b/.test(q)) results = anuncios;
      else if (/FROM campaign\b/.test(q) && !/metrics\.|segments\./.test(q)) {
        const m = /campaign\.id IN \(([^)]*)\)/.exec(q);
        const ids = m ? m[1].split(',').map((s) => s.trim()) : null;
        results = estado.campanhas.filter((c) => !ids || ids.includes(c.campaign.id));
      }
      return Response.json({ results });
    }
    if (tipo === 'mutate') {
      if (erroMutate) return Response.json(erroMutate, { status: 400 });
      const b = JSON.parse(corpo);
      if (!b.validateOnly && aplicar) {
        for (const o of b.operations ?? []) {
          const c = estado.campanhas.find((x) => x.campaign.resourceName === o.update?.resourceName);
          if (c && o.update.status) c.campaign.status = o.update.status;
          const g = estado.objectivos.find((x) => x.campaignConversionGoal.resourceName === o.update?.resourceName);
          if (g && 'biddable' in o.update) g.campaignConversionGoal.biddable = o.update.biddable;
        }
      }
      return Response.json({ results: (b.operations ?? []).map((o) => ({ resourceName: o.update?.resourceName })) });
    }
    return new Response('', { status: paginas[u] ?? 200 });
  };
  const de = (tipo) => pedidos.filter((p) => p.tipo === tipo);
  const mutates = () => de('mutate').map((p) => ({ ...p, b: JSON.parse(p.corpo) }));
  return { obter, pedidos, estado, de, mutates };
}

// Nenhuma operação de mutate enviada pode escrever outro estado de campanha que não PAUSED.
function soPausa(g) {
  for (const m of g.mutates()) {
    for (const o of m.b.operations ?? []) {
      if (o.update && 'status' in o.update) assert.equal(o.update.status, 'PAUSED', `mutate com status ${o.update.status}`);
    }
    assert.ok(!/ENABLED/i.test(JSON.stringify(m.b.operations)), `mutate com ENABLED: ${m.corpo}`);
  }
}

const HOJE = new Date(2026, 8, 29, 12, 0, 0);

// ============================ 1. ligar ============================

async function arrancarLigar(slug, raiz, g, opts = {}) {
  const saida = capturar();
  const promessa = ligar(slug, { semBrowser: true, raiz, obter: g.obter, ...opts }).then(() => null, (e) => e);
  let url;
  for (let i = 0; i < 200 && !url; i++) {
    url = saida.linhas.join('\n').match(/https:\/\/accounts\.google\.com\/\S+/)?.[0];
    if (!url) await new Promise((r) => setTimeout(r, 10));
  }
  return { saida, promessa, url: url ? new URL(url) : null };
}

test('ligar: URL de autorização com loopback 127.0.0.1, state, PKCE S256, offline, consent e scope adwords', async () => {
  cofreAgencia();
  const raiz = raizCom('ligar-url');
  const g = google();
  const { saida, promessa, url } = await arrancarLigar('ligar-url', raiz, g);
  try {
    assert.ok(url, 'o URL de autorização tem de ser impresso');
    const p = url.searchParams;
    const redirect = new URL(p.get('redirect_uri'));
    assert.equal(redirect.protocol, 'http:');
    assert.equal(redirect.hostname, '127.0.0.1', 'loopback 127.0.0.1 (não localhost)');
    assert.ok(Number(redirect.port) > 0);
    assert.equal(p.get('response_type'), 'code');
    assert.equal(p.get('access_type'), 'offline');
    assert.equal(p.get('prompt'), 'consent');
    assert.ok(p.get('scope').split(' ').includes('https://www.googleapis.com/auth/adwords'));
    assert.ok((p.get('state') ?? '').length >= 16, 'state com entropia');
    assert.equal(p.get('code_challenge_method'), 'S256', 'PKCE (SKILL/commit: state e PKCE)');
    assert.match(p.get('code_challenge') ?? '', /^[A-Za-z0-9_-]{43}$/);
    await fetch(`${redirect.origin}/?state=${p.get('state')}&error=access_denied`);
  } finally {
    const e = await promessa;
    saida.repor();
    assert.ok(e, 'recusa no browser → erro');
  }
});

test('ligar: state aleatório (difere entre execuções) e state inválido é recusado sem guardar nada', async () => {
  cofreAgencia();
  const raiz = raizCom('ligar-state');
  const states = [];
  for (let i = 0; i < 2; i++) {
    const g = google();
    const { saida, promessa, url } = await arrancarLigar('ligar-state', raiz, g);
    const redirect = new URL(url.searchParams.get('redirect_uri'));
    states.push(url.searchParams.get('state'));
    const r = await fetch(`${redirect.origin}/?state=${'0'.repeat(32)}&code=codigo-do-atacante`);
    await r.text();
    const e = await promessa;
    saida.repor();
    assert.ok(e instanceof Error, 'state inválido tem de rejeitar');
    assert.match(e.message, /state/i);
    assert.equal(g.de('token').length, 0, 'com state inválido não se troca o código');
    assert.ok(!lerFicheiroCofre('ligar-state').includes('GOOGLE_ADS_REFRESH_TOKEN'), 'nada guardado no cofre');
  }
  assert.notEqual(states[0], states[1], 'state tem de ser aleatório');
});

test('ligar: fluxo completo — refresh token vai para o cofre do cliente e nunca para a consola', async () => {
  cofreAgencia();
  const slug = 'ligar-ok';
  const raiz = raizCom(slug);
  const g = google();
  const { saida, promessa, url } = await arrancarLigar(slug, raiz, g);
  const redirect = new URL(url.searchParams.get('redirect_uri'));
  const r = await fetch(`${redirect.origin}/?state=${url.searchParams.get('state')}&code=codigo-bom`);
  const pagina = await r.text();
  const e = await promessa;
  saida.repor();
  assert.equal(e, null, e?.message);
  // PKCE: o verificador enviado na troca corresponde ao desafio do URL.
  const troca = new URLSearchParams(g.de('token')[0].corpo);
  assert.equal(troca.get('grant_type'), 'authorization_code');
  assert.equal(troca.get('code'), 'codigo-bom');
  assert.equal(troca.get('redirect_uri'), url.searchParams.get('redirect_uri'));
  assert.equal(createHash('sha256').update(troca.get('code_verifier') ?? '').digest('base64url'), url.searchParams.get('code_challenge'));
  // Cofre do cliente (chave da tabela única), não o da agência.
  assert.ok(lerFicheiroCofre(slug).includes(`${CHAVES_DO_COFRE['google-ads'][0]}=${RT_NOVO}`));
  assert.ok(!lerFicheiroCofre('google-ads').includes(RT_NOVO), 'não vai para o cofre da agência');
  // Confirma com leitura (GAQL) usando o token novo, sem mutate.
  assert.ok(g.de('search').length >= 1);
  assert.equal(g.de('mutate').length, 0);
  assert.equal(new URLSearchParams(g.de('token').at(-1).corpo).get('refresh_token'), RT_NOVO);
  semSegredos(saida.texto(), 'consola do ligar');
  semSegredos(pagina, 'página do redirect');
});

test('ligar: troca falhada ou erro na confirmação — nada do token na consola nem na mensagem de erro', async () => {
  cofreAgencia();
  // (a) a Google recusa a troca do código
  {
    const slug = 'ligar-troca-falha';
    const raiz = raizCom(slug);
    const g = google({ erroToken: { error: 'invalid_grant', error_description: 'Bad Request' } });
    const { saida, promessa, url } = await arrancarLigar(slug, raiz, g);
    await (await fetch(`${new URL(url.searchParams.get('redirect_uri')).origin}/?state=${url.searchParams.get('state')}&code=c`)).text();
    const e = await promessa;
    saida.repor();
    assert.ok(e instanceof Error);
    assert.ok(!lerFicheiroCofre(slug).includes('GOOGLE_ADS_REFRESH_TOKEN'), 'troca falhada → nada guardado');
    semSegredos(e.message + '\n' + saida.texto(), 'erro da troca');
  }
  // (b) token guardado, mas a leitura de confirmação falha com uma resposta que ecoa segredos
  {
    const slug = 'ligar-confirma-falha';
    const raiz = raizCom(slug);
    const g = google({ erroSearch: () => erroApi({ authorizationError: 'USER_PERMISSION_DENIED' }, `Bearer ${ACCESS} sem permissão (refresh ${RT_NOVO})`) });
    const { saida, promessa, url } = await arrancarLigar(slug, raiz, g);
    await (await fetch(`${new URL(url.searchParams.get('redirect_uri')).origin}/?state=${url.searchParams.get('state')}&code=c`)).text();
    const e = await promessa;
    saida.repor();
    assert.ok(e instanceof Error, 'confirmação falhada tem de dar erro');
    semSegredos(e.message, 'mensagem de erro do ligar');
    semSegredos(saida.texto(), 'consola do ligar');
  }
});

test('ligar: slug reservado google-ads é recusado (e o cofre da agência fica intacto)', async () => {
  cofreAgencia();
  const antes = lerFicheiroCofre('google-ads');
  const raiz = raizCom('google-ads');
  const g = google();
  const saida = capturar();
  let e;
  try { await ligar('google-ads', { semBrowser: true, raiz, obter: g.obter }); } catch (x) { e = x; } finally { saida.repor(); }
  assert.ok(e instanceof Error, 'google-ads não pode ser cliente');
  assert.match(e.message, /google-ads/);
  assert.equal(g.pedidos.length, 0);
  assert.equal(lerFicheiroCofre('google-ads'), antes);
});

// ============================ 2. diagnóstico ============================

test('diagnóstico: só leitura — nenhum :mutate, grava clientes/<slug>/ads/diagnostico-<data>.md, não em auditorias/', async () => {
  cofreAgencia();
  const slug = 'diag-ok';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(1, 'Pesquisa', 'ENABLED'), camp(2, 'Marca', 'PAUSED')] });
  const saida = capturar();
  let r;
  try { r = await diagnosticar(slug, { raiz, obter: g.obter, hoje: HOJE }); } finally { saida.repor(); }
  assert.ok(g.de('search').length > 0, 'fez leituras');
  assert.equal(g.pedidos.filter((p) => /:mutate/.test(p.url)).length, 0, 'nenhum pedido a :mutate');
  for (const p of g.pedidos) assert.ok(!/validateOnly|"operations"/.test(p.corpo), `pedido de escrita: ${p.url}`);
  const esperado = join(raiz, 'clientes', slug, 'ads', 'diagnostico-2026-09-29.md');
  assert.equal(r.caminho, esperado);
  assert.ok(existsSync(esperado));
  assert.ok(!existsSync(join(raiz, 'clientes', slug, 'auditorias')), 'não escreve em auditorias/');
  const texto = readFileSync(esperado, 'utf8');
  semSegredos(texto, 'relatório');
  semSegredos(r.resumo + '\n' + saida.texto() + '\n' + JSON.stringify(r.dados), 'resumo/dados');
  // Nunca sobrescreve: segunda corrida no mesmo dia → ficheiro novo.
  const r2 = await diagnosticar(slug, { raiz, obter: g.obter, hoje: HOJE });
  assert.equal(r2.caminho, join(raiz, 'clientes', slug, 'ads', 'diagnostico-2026-09-29-2.md'));
  assert.equal(readFileSync(esperado, 'utf8'), texto, 'o primeiro fica intacto');
});

test('diagnóstico: conta sem dados (todas as consultas vazias) não rebenta', async () => {
  cofreAgencia();
  const slug = 'diag-vazio';
  const raiz = raizCom(slug);
  const g = google();
  const r = await diagnosticar(slug, { raiz, obter: g.obter, hoje: HOJE });
  assert.ok(existsSync(r.caminho));
  assert.equal(typeof r.resumo, 'string');
  assert.ok(!/NaN|undefined/.test(readFileSync(r.caminho, 'utf8')), 'relatório sem NaN/undefined');
  assert.ok(!/NaN|undefined/.test(r.resumo), 'resumo sem NaN/undefined');
});

test('diagnóstico: landing page com 404 aparece assinalada (relatório e resumo)', async () => {
  cofreAgencia();
  const slug = 'diag-404';
  const raiz = raizCom(slug);
  const LP = 'https://exemplo-teste.pt/pagina-que-morreu';
  const OK = 'https://exemplo-teste.pt/viva';
  const g = google({
    campanhas: [camp(1, 'Pesquisa', 'ENABLED')],
    landing: [
      { landingPageView: { unexpandedFinalUrl: LP }, metrics: { costMicros: '12000000', clicks: '9', conversions: 0 } },
      { landingPageView: { unexpandedFinalUrl: OK }, metrics: { costMicros: '1000000', clicks: '1', conversions: 1 } },
    ],
    paginas: { [LP]: 404, [OK]: 200 },
  });
  const r = await diagnosticar(slug, { raiz, obter: g.obter, hoje: HOJE });
  assert.ok(g.pedidos.some((p) => p.url === LP && p.metodo === 'GET'), 'o estado HTTP é medido agora');
  const texto = readFileSync(r.caminho, 'utf8');
  assert.ok(texto.split('\n').some((l) => l.includes(LP) && l.includes('404')), 'linha do relatório com o URL e 404');
  assert.ok(r.resumo.split('\n').some((l) => l.includes(LP) && l.includes('404')), '404 assinalado no resumo');
  assert.ok(!r.resumo.split('\n').some((l) => l.includes(OK) && /404/.test(l)), 'a página viva não é assinalada');
});

test('diagnóstico: erro da API sai sem tokens nem headers', async () => {
  cofreAgencia();
  const slug = 'diag-erro';
  const raiz = raizCom(slug);
  const g = google({
    erroSearch: (p) => erroApi({ authorizationError: 'USER_PERMISSION_DENIED' },
      `authorization: ${p.headers.get('authorization')} developer-token: ${p.headers.get('developer-token')} refresh=${RT_AGENCIA}`),
  });
  const saida = capturar();
  let e;
  try { await diagnosticar(slug, { raiz, obter: g.obter, hoje: HOJE }); } catch (x) { e = x; } finally { saida.repor(); }
  assert.ok(e instanceof Error);
  assert.match(e.message, /USER_PERMISSION_DENIED/, 'o código do erro fica visível');
  semSegredos(e.message, 'erro do diagnóstico');
  semSegredos(saida.texto(), 'consola do diagnóstico');
  assert.equal(g.pedidos.filter((p) => /:mutate/.test(p.url)).length, 0);
});

// ============================ 3. alterar ============================

test('pausar sem --confirmar: só validateOnly:true, nada muda na conta', async () => {
  cofreAgencia();
  const slug = 'alt-ensaio';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(11, 'Pesquisa', 'ENABLED')] });
  const r = await pausar(slug, ['Pesquisa'], { raiz, obter: g.obter });
  assert.ok(r.ok, r.linhas.join('\n'));
  const ms = g.mutates();
  assert.ok(ms.length >= 1, 'o ensaio passa pela API');
  for (const m of ms) assert.equal(m.b.validateOnly, true, 'sem --confirmar só validateOnly');
  assert.equal(g.estado.campanhas[0].campaign.status, 'ENABLED', 'nada escrito');
  soPausa(g);
});

test('objectivos sem --confirmar: só validateOnly:true, nada muda', async () => {
  cofreAgencia();
  const slug = 'alt-obj-ensaio';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(12, 'C', 'ENABLED')], objectivos: [goal(12, 'DOWNLOAD', 'APP', true)] });
  const r = await mudarObjectivos(slug, 'C', { raiz, obter: g.obter, naoContar: [{ categoria: 'DOWNLOAD' }] });
  assert.ok(r.ok, r.linhas.join('\n'));
  const ms = g.mutates();
  assert.ok(ms.length >= 1);
  for (const m of ms) assert.equal(m.b.validateOnly, true);
  assert.equal(g.estado.objectivos[0].campaignConversionGoal.biddable, true);
  soPausa(g);
});

test('pausar com --confirmar: escreve e depois verifica por GAQL', async () => {
  cofreAgencia();
  const slug = 'alt-confirma';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(21, 'Pesquisa', 'ENABLED')] });
  const r = await pausar(slug, ['21'], { raiz, obter: g.obter, confirmar: true });
  assert.ok(r.ok, r.linhas.join('\n'));
  const reais = g.pedidos.map((p, i) => ({ p, i })).filter(({ p }) => p.tipo === 'mutate' && JSON.parse(p.corpo).validateOnly === false);
  assert.equal(reais.length, 1, 'uma escrita real');
  const iMut = reais[0].i;
  assert.ok(g.pedidos.slice(iMut + 1).some((p) => p.tipo === 'search' && /campaign\.status/.test(p.corpo)), 'lê o estado por GAQL depois de escrever');
  assert.equal(g.estado.campanhas[0].campaign.status, 'PAUSED');
  soPausa(g);
});

test('pausar com --confirmar: se a API aceita mas a campanha não fica em pausa, a verificação falha', async () => {
  cofreAgencia();
  const slug = 'alt-verifica';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(22, 'Pesquisa', 'ENABLED')], aplicar: false });
  const r = await pausar(slug, ['Pesquisa'], { raiz, obter: g.obter, confirmar: true });
  assert.equal(r.ok, false, 'saída 1 quando o GAQL não confirma');
  assert.equal(g.mutates().filter((m) => m.b.validateOnly === false).length, 1, 'não repete às cegas');
});

test('objectivos com --confirmar: escreve biddable e verifica por GAQL', async () => {
  cofreAgencia();
  const slug = 'alt-obj-confirma';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(23, 'C', 'ENABLED')], objectivos: [goal(23, 'DOWNLOAD', 'APP', true), goal(23, 'SUBMIT_LEAD_FORM', 'WEBSITE', false)] });
  const r = await mudarObjectivos(slug, '23', { raiz, obter: g.obter, confirmar: true, naoContar: [{ categoria: 'DOWNLOAD' }], contar: [{ categoria: 'SUBMIT_LEAD_FORM', origem: 'WEBSITE' }] });
  assert.ok(r.ok, r.linhas.join('\n'));
  assert.equal(g.estado.objectivos[0].campaignConversionGoal.biddable, false);
  assert.equal(g.estado.objectivos[1].campaignConversionGoal.biddable, true);
  const iMut = g.pedidos.findIndex((p) => p.tipo === 'mutate' && JSON.parse(p.corpo).validateOnly === false);
  assert.ok(iMut >= 0);
  assert.ok(g.pedidos.slice(iMut + 1).some((p) => p.tipo === 'search' && /campaign_conversion_goal/.test(p.corpo)), 'verificação GAQL depois');
  soPausa(g);
});

test('NUNCA activar: inputs maliciosos não produzem nenhum mutate com ENABLED', async () => {
  cofreAgencia();
  const slug = 'alt-nunca';
  const raiz = raizCom(slug);
  const campanhas = [
    camp(31, 'ENABLED', 'PAUSED'),
    camp(32, 'enabled', 'PAUSED'),
    camp(33, 'Promo ENABLED verão', 'PAUSED'),
    camp(34, 'status: ENABLED', 'ENABLED'),
    camp(35, 'Normal', 'PAUSED'),
  ];
  const alvos = ['ENABLED', 'enabled', 'Promo ENABLED verão', 'status: ENABLED', '35', 'ENABLE', 'Enabled', '{"status":"ENABLED"}'];
  for (const confirmar of [false, true]) {
    const g = google({ campanhas });
    try { await pausar(slug, alvos, { raiz, obter: g.obter, confirmar }); } catch { /* recusar também serve */ }
    soPausa(g);
    for (const c of g.estado.campanhas) {
      const antes = campanhas.find((x) => x.campaign.id === c.campaign.id).campaign.status;
      if (antes === 'PAUSED') assert.equal(c.campaign.status, 'PAUSED', `campanha ${c.campaign.name} passou de PAUSED para ${c.campaign.status}`);
    }
  }
  // Alvos todos válidos (sem erros que abortem o plano): campanhas activas com "ENABLED" no nome.
  for (const confirmar of [false, true]) {
    const g = google({ campanhas: [camp(37, 'ENABLED', 'ENABLED'), camp(38, 'enabled', 'ENABLED'), camp(39, 'Promo ENABLED', 'ENABLED')] });
    const r = await pausar(slug, ['ENABLED', 'enabled', '39'], { raiz, obter: g.obter, confirmar });
    assert.ok(r.ok, r.linhas.join('\n'));
    assert.ok(g.mutates().length >= 1, 'chegou a haver mutate');
    soPausa(g);
    if (confirmar) for (const c of g.estado.campanhas) assert.equal(c.campaign.status, 'PAUSED');
  }
  // Também pelos objectivos: categorias com "ENABLED" não mexem no estado de campanhas.
  const g = google({ campanhas: [camp(36, 'X', 'PAUSED')], objectivos: [goal(36, 'DOWNLOAD', 'APP', true)] });
  try {
    await mudarObjectivos(slug, 'X', { raiz, obter: g.obter, confirmar: true, contar: [{ categoria: 'ENABLED' }], naoContar: [{ categoria: 'DOWNLOAD' }] });
  } catch { /* recusar também serve */ }
  for (const m of g.mutates()) assert.ok(!m.url.endsWith('/campaigns:mutate'), 'objectivos não escrevem em campaigns');
  soPausa(g);
  assert.equal(g.estado.campanhas[0].campaign.status, 'PAUSED');
});

test('NUNCA activar: planearPausa só gera PAUSED, qualquer que seja o alvo', () => {
  const campanhas = [camp(41, 'ENABLED', 'ENABLED'), camp(42, 'enabled', 'PAUSED'), camp(43, 'A ENABLED B', 'REMOVED'), camp(44, 'Z', 'UNKNOWN')];
  const p = planearPausa(campanhas, ['ENABLED', 'enabled', '42', 'A ENABLED B', 'Z', '44']);
  for (const o of p.ops) {
    const campos = Object.entries(o.update).filter(([k]) => k !== 'resourceName');
    assert.deepEqual(campos, [['status', 'PAUSED']], `op escreve ${JSON.stringify(o.update)}`);
  }
});

test('NUNCA activar: o módulo não exporta nenhum caminho de activação', () => {
  const nomes = Object.keys(alterar);
  assert.ok(!nomes.some((n) => /activ|enabl|retom|resum|unpause|despaus|ligar/i.test(n)), `exports: ${nomes.join(', ')}`);
});

test('campanha de experiência: mensagem clara e nenhum mutate (nem ensaio)', async () => {
  cofreAgencia();
  const slug = 'alt-exp';
  const raiz = raizCom(slug);
  for (const confirmar of [false, true]) {
    const g = google({ campanhas: [camp(51, 'Teste A/B', 'ENABLED', 'EXPERIMENT')] });
    const r = await pausar(slug, ['Teste A/B'], { raiz, obter: g.obter, confirmar });
    assert.equal(r.ok, false);
    const t = r.linhas.join('\n');
    assert.match(t, /experiência/i);
    assert.match(t, /Experiências|campanha base/, 'diz a alternativa');
    assert.equal(g.de('mutate').length, 0, 'sem mutate');
  }
});

test('MUTATE_NOT_ALLOWED: mensagem aponta a alternativa (objectivo por campanha)', async () => {
  cofreAgencia();
  const slug = 'alt-naopermitido';
  const raiz = raizCom(slug);
  const g = google({
    campanhas: [camp(61, 'C', 'ENABLED')],
    objectivos: [goal(61, 'DOWNLOAD', 'APP', true)],
    erroMutate: erroApi({ mutateError: 'MUTATE_NOT_ALLOWED' }, 'Mutates are not allowed for the requested resource.'),
  });
  let e;
  try { await mudarObjectivos(slug, 'C', { raiz, obter: g.obter, naoContar: [{ categoria: 'DOWNLOAD' }], confirmar: true }); } catch (x) { e = x; }
  assert.ok(e instanceof Error, 'tem de falhar');
  assert.match(e.message, /MUTATE_NOT_ALLOWED/);
  assert.match(e.message, /objectivo por campanha|ads objectivos/, 'nomeia a alternativa');
  semSegredos(e.message, 'erro MUTATE_NOT_ALLOWED');
  assert.equal(g.mutates().length, 1, 'sem repetição');
});

// ============================ 4. credenciais ============================

test('credenciais: slug google-ads recusado no diagnóstico e no alterar, sem pedidos', async () => {
  cofreAgencia();
  const raiz = raizCom('google-ads');
  const g = google({ campanhas: [camp(71, 'A', 'ENABLED')] });
  await assert.rejects(diagnosticar('google-ads', { raiz, obter: g.obter, hoje: HOJE }), /google-ads/);
  await assert.rejects(pausar('google-ads', ['A'], { raiz, obter: g.obter, confirmar: true }), /google-ads/);
  await assert.rejects(mudarObjectivos('google-ads', 'A', { raiz, obter: g.obter, contar: [{ categoria: 'DOWNLOAD' }] }), /google-ads/);
  assert.equal(g.pedidos.length, 0);
  assert.ok(!existsSync(join(raiz, 'clientes', 'google-ads', 'ads')));
});

const refreshUsado = (g) => new URLSearchParams(g.de('token')[0].corpo).get('refresh_token');

test('credenciais: token do cliente tem precedência; sem ele, fallback para o legado da agência; sem nenhum, erro claro', async () => {
  const raiz = raizCom('cred-cliente', 'cred-legado', 'cred-nada');
  cofreAgencia({ refresh: RT_AGENCIA });
  escreverCofre('cred-cliente', { GOOGLE_ADS_REFRESH_TOKEN: RT_CLIENTE });
  const g1 = google();
  await diagnosticar('cred-cliente', { raiz, obter: g1.obter, hoje: HOJE });
  assert.equal(refreshUsado(g1), RT_CLIENTE, 'cliente primeiro');

  const g2 = google();
  await diagnosticar('cred-legado', { raiz, obter: g2.obter, hoje: HOJE });
  assert.equal(refreshUsado(g2), RT_AGENCIA, 'legado da agência');

  cofreAgencia({ refresh: null });
  const g3 = google();
  let e;
  try { await diagnosticar('cred-nada', { raiz, obter: g3.obter, hoje: HOJE }); } catch (x) { e = x; }
  assert.ok(e instanceof Error);
  assert.match(e.message, /scripts\/ads\/ligar\.mjs/, 'diz como resolver');
  assert.equal(g3.pedidos.length, 0);
  // o token de programador e o client da agência vão nos pedidos certos
  assert.equal(g1.de('search')[0].headers.get('developer-token'), DEV);
  assert.equal(new URLSearchParams(g1.de('token')[0].corpo).get('client_secret'), SECRET);
});

test('credenciais: nenhum segredo em stdout (diagnóstico e alterar, sucesso e ensaio)', async () => {
  cofreAgencia();
  const slug = 'cred-stdout';
  const raiz = raizCom(slug);
  escreverCofre(slug, { GOOGLE_ADS_REFRESH_TOKEN: RT_CLIENTE });
  const g = google({ campanhas: [camp(81, 'A', 'ENABLED')], objectivos: [goal(81, 'DOWNLOAD', 'APP', true)] });
  const saida = capturar();
  let res = [];
  try {
    const d = await diagnosticar(slug, { raiz, obter: g.obter, hoje: HOJE });
    res.push(d.resumo, readFileSync(d.caminho, 'utf8'));
    for (const confirmar of [false, true]) {
      res.push(...(await pausar(slug, ['A'], { raiz, obter: g.obter, confirmar })).linhas);
      res.push(...(await mudarObjectivos(slug, 'A', { raiz, obter: g.obter, confirmar, naoContar: [{ categoria: 'DOWNLOAD' }] })).linhas);
    }
  } finally { saida.repor(); }
  semSegredos(res.join('\n'), 'resultados');
  semSegredos(saida.texto(), 'consola');
});

// ============================ 5. rede ============================

test('rede: timeout numa leitura → exactamente 1 retry', async () => {
  cofreAgencia();
  const slug = 'rede-leitura';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(91, 'A', 'ENABLED')], falhas: { search: [1] } });
  const r = await pausar(slug, ['A'], { raiz, obter: g.obter });
  assert.ok(r.ok, r.linhas.join('\n'));
  assert.equal(g.de('search').length, 2, 'falhou 1, repetiu 1');

  const g2 = google({ falhas: { search: [1, 2, 3] } });
  await assert.rejects(diagnosticar(slug, { raiz, obter: g2.obter, hoje: HOJE }));
  assert.equal(g2.de('search').length, 2, 'só 1 retry, não mais');
});

test('rede: mutate que dá timeout NÃO é repetido (nem com --confirmar, nem no ensaio)', async () => {
  cofreAgencia();
  const slug = 'rede-mutate';
  const raiz = raizCom(slug);
  for (const confirmar of [true, false]) {
    const g = google({ campanhas: [camp(92, 'A', 'ENABLED')], falhas: { mutate: [1] } });
    let e;
    try { await pausar(slug, ['A'], { raiz, obter: g.obter, confirmar }); } catch (x) { e = x; }
    assert.ok(e instanceof Error, 'o timeout do mutate tem de chegar ao operador');
    assert.equal(g.de('mutate').length, 1, `mutate repetido (confirmar=${confirmar})`);
    semSegredos(e.message, 'erro de rede');
  }
  const g = google({ campanhas: [camp(93, 'C', 'ENABLED')], objectivos: [goal(93, 'DOWNLOAD', 'APP', true)], falhas: { mutate: [1] } });
  await assert.rejects(mudarObjectivos(slug, 'C', { raiz, obter: g.obter, confirmar: true, naoContar: [{ categoria: 'DOWNLOAD' }] }));
  assert.equal(g.de('mutate').length, 1, 'mutate de objectivos repetido');
});

test('rede: mutate com 5xx também não é repetido', async () => {
  cofreAgencia();
  const slug = 'rede-5xx';
  const raiz = raizCom(slug);
  const g = google({ campanhas: [camp(94, 'A', 'ENABLED')] });
  const obter = async (url, init) => {
    if (/:mutate$/.test(String(url))) { g.pedidos.push({ tipo: 'mutate', url: String(url), corpo: String(init.body), headers: new Headers() }); return Response.json({ error: { message: 'backend' } }, { status: 503 }); }
    return g.obter(url, init);
  };
  await assert.rejects(pausar(slug, ['A'], { raiz, obter, confirmar: true }));
  assert.equal(g.de('mutate').length, 1);
});

// ============================ 6. login-customer-id ============================

test('login-customer-id: por omissão a conta do cliente; --login mcc usa a MCC do cofre da agência', async () => {
  cofreAgencia({ mcc: '999-888-7777' });
  const slug = 'login';
  const raiz = raizCom(slug);
  const g1 = google({ campanhas: [camp(95, 'A', 'ENABLED')] });
  await diagnosticar(slug, { raiz, obter: g1.obter, hoje: HOJE });
  await pausar(slug, ['A'], { raiz, obter: g1.obter });
  for (const p of [...g1.de('search'), ...g1.de('mutate')]) assert.equal(p.headers.get('login-customer-id'), CID);
  assert.ok(g1.de('mutate').length > 0);

  const g2 = google({ campanhas: [camp(95, 'A', 'ENABLED')] });
  await diagnosticar(slug, { raiz, obter: g2.obter, hoje: HOJE, login: 'mcc' });
  await pausar(slug, ['A'], { raiz, obter: g2.obter, login: 'mcc' });
  for (const p of [...g2.de('search'), ...g2.de('mutate')]) assert.equal(p.headers.get('login-customer-id'), MCC_COFRE);
  // o pedido continua a ser à conta do cliente, só o login muda
  for (const p of g2.de('search')) assert.match(p.url, new RegExp(`/customers/${CID}/`));
});

// ============================ CLI (processo à parte, fetch falso) ============================

// O CLI corre com MARKETEER_RAIZ = test/fixtures (dossier fictício exemplo-ads, customer 111-222-3333), o HOME falso e
// um fetch falso carregado por --import — nunca sai para a rede.
const CID_REPO = '1112223333';
function correrCli(args) {
  const dir = novaPasta('marketeer-ads-cli-');
  const log = join(dir, 'pedidos.jsonl');
  const preload = join(dir, 'fetch-falso.mjs');
  writeFileSync(preload, `
import { appendFileSync } from 'node:fs';
const LOG = ${JSON.stringify(log)};
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const corpo = init.body == null ? '' : String(init.body);
  appendFileSync(LOG, JSON.stringify({ url: u, corpo, headers: Object.fromEntries(new Headers(init.headers ?? {})) }) + '\\n');
  if (u === ${JSON.stringify(TOKEN_URL)}) return Response.json({ access_token: ${JSON.stringify(ACCESS)} });
  if (u.endsWith(':mutate')) return Response.json({ results: [] });
  if (u.endsWith('googleAds:search')) {
    const q = JSON.parse(corpo).query;
    if (/FROM campaign\\b/.test(q) && !/metrics\\.|segments\\./.test(q)) {
      const st = /campaign\\.id IN/.test(q) ? 'PAUSED' : 'ENABLED';
      return Response.json({ results: [
        { campaign: { id: '1', name: 'ENABLED', status: st, experimentType: 'BASE', resourceName: 'customers/${CID_REPO}/campaigns/1' } },
        { campaign: { id: '2', name: 'Pesquisa', status: st, experimentType: 'BASE', resourceName: 'customers/${CID_REPO}/campaigns/2' } },
      ] });
    }
    return Response.json({ results: [] });
  }
  throw new Error('rede proibida no teste: ' + u);
};
`);
  cofreAgencia();
  const r = spawnSync(process.execPath, ['--import', preload, join(REPO, 'scripts', 'ads', 'alterar.mjs'), ...args], {
    env: { ...process.env, HOME, MARKETEER_RAIZ: join(REPO, 'test', 'fixtures') }, encoding: 'utf8', timeout: 20_000,
  });
  const pedidos = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { ...r, pedidos, mutates: pedidos.filter((p) => p.url.endsWith(':mutate')).map((p) => JSON.parse(p.corpo)) };
}

test('CLI alterar: sem --confirmar → validateOnly:true; com --confirmar → false; sem segredos na saída', () => {
  const ensaio = correrCli(['pausar', 'exemplo-ads', 'Pesquisa']);
  assert.equal(ensaio.status, 0, ensaio.stderr);
  assert.equal(ensaio.mutates.length, 1);
  assert.equal(ensaio.mutates[0].validateOnly, true);
  semSegredos(ensaio.stdout + ensaio.stderr, 'CLI ensaio');

  const real = correrCli(['pausar', 'exemplo-ads', 'Pesquisa', '--confirmar']);
  assert.equal(real.status, 0, real.stdout + real.stderr);
  assert.equal(real.mutates.length, 1);
  assert.equal(real.mutates[0].validateOnly, false);
  assert.ok(real.pedidos.every((p) => !p.url.includes('googleads') || p.headers['login-customer-id'] === CID_REPO));
  semSegredos(real.stdout + real.stderr, 'CLI confirmar');
});

test('CLI alterar: não há acção de activar, e argumentos com ENABLED nunca escrevem ENABLED', () => {
  for (const accao of ['activar', 'ativar', 'enable', 'enabled', 'retomar', 'ENABLED']) {
    const r = correrCli([accao, 'exemplo-ads', 'Pesquisa', '--confirmar']);
    assert.notEqual(r.status, 0, `acção "${accao}" aceite`);
    assert.equal(r.mutates.length, 0, `acção "${accao}" fez mutate`);
  }
  const r = correrCli(['pausar', 'exemplo-ads', 'ENABLED', '--status', 'ENABLED', '--confirmar']);
  for (const m of r.mutates) {
    assert.ok(!/ENABLED/.test(JSON.stringify(m.operations)), JSON.stringify(m));
    for (const o of m.operations) assert.equal(o.update.status, 'PAUSED');
  }
  semSegredos(r.stdout + r.stderr, 'CLI malicioso');
});

// Garante que esta suite nunca escreveu fora do HOME/raiz temporários.
test('isolamento: o HOME usado é o temporário', () => {
  assert.equal(process.env.HOME, HOME);
  assert.ok(readdirSync(COFRE).includes('google-ads.env'));
});

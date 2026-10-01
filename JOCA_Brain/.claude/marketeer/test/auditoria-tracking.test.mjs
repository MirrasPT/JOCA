// Testes da auditoria de tracking (#5), escritos a partir dos critérios de aceitação do issue.
// A lógica corre com um renderizar falso (rápido); o chromium real entra em 3 testes, para provar
// a renderização e que os hits de recolha nunca saem para a rede (D-008). Nenhum pedido a sites
// reais: o browser é servido por obterDeFixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { auditar, detectar } from '../scripts/auditoria/tracking.mjs';
import { renderizarPagina, eHitDeRecolha } from '../scripts/auditoria/renderizar.mjs';
import { obterDeFixtures } from '../scripts/auditoria/pagina.mjs';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';

const SITE = 'https://cliente-ficticio.pt/';
const fixture = (nome) => readFileSync(new URL(`./fixtures/tracking/${nome}.html`, import.meta.url), 'utf8');

// renderizar falso: devolve o DOM tal como está e os pedidos indicados.
const renderizarFalso = (dom, pedidos = []) => async ({ url }) => ({ ok: true, status: 200, url, dom, pedidos, erro: null });
const auditarDom = (dom, pedidos) => auditar({ site: SITE, renderizar: renderizarFalso(dom, pedidos) });
const regras = (r) => r.achados.map((a) => a.regra);

const validarFormato = (r) => validarAuditoria(
  JSON.stringify({ cliente: '_exemplo', data: '2026-09-24', metodo: '0.1.0', ...r }), '_exemplo', '2026-09-24');

// No chromium real: sem browser instalado o teste FALHA com a indicação do que fazer (o CI instala-o).
const exigirBrowser = (r) => assert.ok(r.ok,
  `o render no chromium falhou (${r.erro ?? `HTTP ${r.status}`}) — se faltar o browser: npx playwright install --only-shell chromium`);

// ---------------------------------------------------------------------------------------------
// Critério 1: detecta GA4 (G-…), GTM (GTM-…) e Meta Pixel no HTML renderizado de uma página local
// ---------------------------------------------------------------------------------------------

test('chromium real: renderiza a página local e detecta GA4, GTM e Meta Pixel', async () => {
  const r = await renderizarPagina({ url: SITE, obter: obterDeFixtures({ [SITE]: fixture('limpo') }) });
  exigirBrowser(r);
  const d = detectar(r);
  assert.deepEqual(d.ga4, ['G-TESTE12345']);
  assert.deepEqual(d.gtm, ['GTM-TESTE01']);
  assert.deepEqual(d.meta, ['100000000000001']);
});

test('chromium real: a auditoria completa corre sobre o render e sai no formato de #3', async () => {
  const r = await auditar({ site: SITE, obter: obterDeFixtures({ [SITE]: fixture('antes-do-consentimento') }) });
  assert.notEqual(r.areas[0]?.estado, 'erro', `área em erro: ${r.areas[0]?.nota} (browser instalado?)`);
  assert.deepEqual(r.areas.map((a) => [a.area, a.estado]), [['tracking', 'verificado']]);
  assert.ok(r.achados.some((a) => a.regra === 'tracking.disparo-antes-consentimento' && a.skill === 'gdpr-compliance'),
    `sem achado de disparo antes do consentimento: ${JSON.stringify(regras(r))}`);
  assert.deepEqual(validarFormato(r), []);
});

test('detecta IDs injectados por JavaScript (só visíveis no DOM renderizado)', () => {
  // O que o render devolve depois de o GTM ter injectado o gtag.js.
  const dom = '<html><head><script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>'
    + '<script async src="https://www.googletagmanager.com/gtag/js?id=G-XYZ789"></script></head><body></body></html>';
  const d = detectar({ dom, pedidos: [] });
  assert.deepEqual(d.gtm, ['GTM-ABC123']);
  assert.deepEqual(d.ga4, ['G-XYZ789']);
});

test('detecta os IDs a partir dos hits de rede mesmo sem rasto no DOM', () => {
  const d = detectar({ dom: '<html><body></body></html>', pedidos: [
    { url: 'https://region1.google-analytics.com/g/collect?v=2&tid=G-REDE0001&gcs=G111&en=page_view', metodo: 'POST', tipo: 'ping' },
    { url: 'https://www.facebook.com/tr?id=200000000000002&ev=PageView', metodo: 'GET', tipo: 'image' },
  ] });
  assert.deepEqual(d.ga4, ['G-REDE0001']);
  assert.deepEqual(d.meta, ['200000000000002']);
});

test('página sem tracking: nenhum ID detectado e achado ga4-ausente', async () => {
  const d = detectar({ dom: fixture('sem-tracking'), pedidos: [] });
  assert.deepEqual([d.ga4, d.gtm, d.meta], [[], [], []]);
  const r = await auditarDom(fixture('sem-tracking'));
  assert.deepEqual(r.areas.map((a) => a.estado), ['verificado']);
  assert.deepEqual(regras(r), ['tracking.ga4-ausente']);
});

test('um ID parecido mas fora do formato não é detectado (UA-, texto solto)', () => {
  const d = detectar({ dom: '<html><body><p>O nosso G-code e o GTM falam de medição.</p>'
    + "<script>ga('create', 'UA-12345-1');</script></body></html>", pedidos: [] });
  assert.deepEqual([d.ga4, d.gtm, d.meta], [[], [], []]);
});

// ---------------------------------------------------------------------------------------------
// Critério 2: tags duplicadas geram achado
// ---------------------------------------------------------------------------------------------

test('GA4 instalado duas vezes gera achado de tag duplicada', async () => {
  const r = await auditarDom(fixture('duplicado'));
  const dup = r.achados.filter((a) => a.regra === 'tracking.tag-duplicada');
  assert.ok(dup.length >= 1, `sem achado de duplicado: ${JSON.stringify(regras(r))}`);
  assert.ok(dup.some((a) => a.evidencia.includes('G-TESTE12345')), 'a evidência tem de nomear o ID duplicado');
});

test('GTM duplicado gera achado', async () => {
  const gtm = '<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-DUP001"></script>';
  const r = await auditarDom(`<html><head>${gtm}${gtm}</head><body><div id="cookie-banner"></div></body></html>`);
  assert.ok(r.achados.some((a) => a.regra === 'tracking.tag-duplicada' && a.evidencia.includes('GTM-DUP001')), JSON.stringify(regras(r)));
});

test('Meta Pixel inicializado duas vezes gera achado', async () => {
  const init = "<script>fbq('init', '300000000000003');</script>";
  const r = await auditarDom(`<html><head>${init}${init}</head><body><div id="cookie-banner"></div></body></html>`);
  assert.ok(r.achados.some((a) => a.regra === 'tracking.tag-duplicada' && a.evidencia.includes('300000000000003')), JSON.stringify(regras(r)));
});

test('dois hits page_view do mesmo tid (ou PageView do mesmo pixel) geram achado de duplicado', async () => {
  const pv = (tid) => ({ url: `https://region1.google-analytics.com/g/collect?v=2&tid=${tid}&gcs=G100&en=page_view`, metodo: 'POST', tipo: 'ping' });
  const r = await auditarDom(fixture('limpo'), [pv('G-TESTE12345'), pv('G-TESTE12345'), hitMeta, hitMeta]);
  const dup = r.achados.filter((a) => a.regra === 'tracking.tag-duplicada').map((a) => a.evidencia);
  assert.ok(dup.some((e) => e.includes('G-TESTE12345') && e.includes('page_view')), JSON.stringify(dup));
  assert.ok(dup.some((e) => e.includes('100000000000001') && e.includes('PageView')), JSON.stringify(dup));
  const um = await auditarDom(fixture('limpo'), [pv('G-TESTE12345'), pv('G-OUTRO0001')]);
  assert.ok(!regras(um).includes('tracking.tag-duplicada'), 'tids diferentes não são duplicado');
});

test("fbq('init', 123) sem aspas e o GTM só pelo noscript ns.html são detectados", () => {
  const d = detectar({ dom: '<html><body><script>fbq("init", 400000000000004);</script>'
    + '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NOSCR1" height="0" width="0"></iframe></noscript></body></html>', pedidos: [] });
  assert.deepEqual(d.meta, ['400000000000004']);
  assert.deepEqual(d.gtm, ['GTM-NOSCR1']);
});

test('snippet GTM completo (gtm.js + ns.html) não é duplicado', () => {
  const d = detectar({ dom: '<html><head><script src="https://www.googletagmanager.com/gtm.js?id=GTM-UM0001"></script></head>'
    + '<body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-UM0001"></iframe></noscript></body></html>', pedidos: [] });
  assert.deepEqual(d.gtm, ['GTM-UM0001']);
  assert.deepEqual(d.duplicados, []);
});

test('Consent Mode detectado pelos parâmetros gcs/gcd dos hits, mesmo sem gtag("consent") no HTML', () => {
  const hit = (q) => ({ url: `https://region1.google-analytics.com/g/collect?v=2&tid=G-X1&${q}`, metodo: 'POST', tipo: 'ping' });
  assert.equal(detectar({ dom: '<html></html>', pedidos: [hit('gcs=G100')] }).consentMode, true);
  assert.equal(detectar({ dom: '<html></html>', pedidos: [hit('gcd=13l3l3l3l1')] }).consentMode, true);
  assert.equal(detectar({ dom: '<html></html>', pedidos: [hit('en=page_view')] }).consentMode, false);
});

test('instalação única (script + config do mesmo ID) não é duplicado', async () => {
  const r = await auditarDom(fixture('limpo'));
  assert.ok(!regras(r).includes('tracking.tag-duplicada'), JSON.stringify(regras(r)));
});

// ---------------------------------------------------------------------------------------------
// Critério 3: tag disparada antes do consentimento gera achado com referência a gdpr-compliance
// ---------------------------------------------------------------------------------------------

const hitGa4 = { url: 'https://region1.google-analytics.com/g/collect?v=2&tid=G-TESTE12345&gcs=G111&en=page_view', metodo: 'POST', tipo: 'ping' };
const hitMeta = { url: 'https://www.facebook.com/tr?id=100000000000001&ev=PageView', metodo: 'GET', tipo: 'image' };
const antesDoConsentimento = (r) => r.achados.filter((a) => a.regra === 'tracking.disparo-antes-consentimento');

test('hit GA4 durante o carregamento, com banner à espera, gera achado gdpr-compliance', async () => {
  const r = await auditarDom(fixture('antes-do-consentimento'), [hitGa4]);
  const a = antesDoConsentimento(r);
  assert.equal(a.length, 1, JSON.stringify(regras(r)));
  assert.equal(a[0].skill, 'gdpr-compliance');
  assert.match(a[0].evidencia, /collect/);
});

test('hit do Meta Pixel antes do consentimento também gera achado gdpr-compliance', async () => {
  const r = await auditarDom(fixture('antes-do-consentimento'), [hitMeta]);
  const a = antesDoConsentimento(r);
  assert.equal(a.length, 1, JSON.stringify(regras(r)));
  assert.equal(a[0].skill, 'gdpr-compliance');
  assert.match(a[0].evidencia, /facebook\.com\/tr/);
});

const hitGa4Gcs = (gcs) => ({ ...hitGa4, url: hitGa4.url.replace('gcs=G111', `gcs=${gcs}`) });

test('hit GA4 com gcs=G100 (tudo recusado: ping sem cookies do Consent Mode) não é disparo', async () => {
  const r = await auditarDom(fixture('antes-do-consentimento'), [hitGa4Gcs('G100')]);
  assert.deepEqual(antesDoConsentimento(r), []);
});

test('hit GA4 com gcs=G110 (ad_storage concedido sem interacção) é disparo antes do consentimento', async () => {
  const r = await auditarDom(fixture('antes-do-consentimento'), [hitGa4Gcs('G110')]);
  const a = antesDoConsentimento(r);
  assert.equal(a.length, 1, JSON.stringify(regras(r)));
  assert.match(a[0].evidencia, /gcs=G110/);
});

test('carregar a biblioteca sem enviar hits não é disparo antes do consentimento', async () => {
  const r = await auditarDom(fixture('limpo'), [
    { url: 'https://www.googletagmanager.com/gtag/js?id=G-TESTE12345', metodo: 'GET', tipo: 'script' },
    { url: 'https://connect.facebook.net/en_US/fbevents.js', metodo: 'GET', tipo: 'script' },
  ]);
  assert.deepEqual(antesDoConsentimento(r), []);
});

test('tags de medição sem banner nenhum geram achado gdpr-compliance', async () => {
  const r = await auditarDom(fixture('sem-banner'));
  assert.ok(r.achados.some((a) => a.skill === 'gdpr-compliance'), JSON.stringify(r.achados));
});

const comGa4 = (corpo, cabeca = '') => `<html><head>${cabeca}<script async src="https://www.googletagmanager.com/gtag/js?id=G-TESTE12345"></script></head>${corpo}</html>`;
const semBanner = (r) => regras(r).includes('tracking.banner-consentimento-ausente');

for (const [caso, dom] of [
  ['<link id="cookie-notice-front-css">', comGa4('<body></body>', '<link id="cookie-notice-front-css" rel="stylesheet" href="/x.css">')],
  ['<body class="cookies-not-set">', comGa4('<body class="home cookies-not-set"><p>Olá</p></body>')],
  ['<input id="consent-newsletter">', comGa4('<body><form><input id="consent-newsletter" type="checkbox"></form></body>')],
  ['<script id="cookie-script">', comGa4('<body><script id="cookie-script">var x=1;</script></body>')],
  ['"Klaro" no texto (não é o CMP)', comGa4('<body><p>Somos a Klaro Consultores</p></body>')],
]) {
  test(`não conta como banner: ${caso}`, async () => {
    const r = await auditarDom(dom);
    assert.ok(semBanner(r), `devia faltar o banner: ${r.areas[0].nota}`);
  });
}

test('o Klaro conta pelo script ou pelo id="klaro"', async () => {
  assert.equal(detectar({ dom: comGa4('<body></body>', '<script src="/js/klaro.js"></script>'), pedidos: [] }).banner, 'Klaro');
  assert.equal(detectar({ dom: comGa4('<body><div id="klaro"></div></body>'), pedidos: [] }).banner, 'Klaro');
});

test('banner próprio em bloco (div/section/aside/dialog) continua a contar', async () => {
  for (const tag of ['div', 'section', 'aside', 'dialog']) {
    const r = await auditarDom(comGa4(`<body><${tag} class="aviso-cookies">Usamos cookies</${tag}></body>`));
    assert.ok(!semBanner(r), `${tag}: ${r.areas[0].nota}`);
  }
});

test('chromium real: banner próprio escondido não conta; visível conta', async () => {
  const pagina = (estilo) => comGa4(`<body><div id="cookie-banner" style="${estilo}">Usamos cookies. <button>Aceitar</button></div></body>`);
  const escondido = await auditar({ site: SITE, obter: obterDeFixtures({ [SITE]: pagina('display:none') }) });
  assert.notEqual(escondido.areas[0].estado, 'erro', escondido.areas[0].nota);
  assert.ok(semBanner(escondido), `banner escondido contou: ${escondido.areas[0].nota}`);
  const visivel = await auditar({ site: SITE, obter: obterDeFixtures({ [SITE]: pagina('position:fixed;bottom:0') }) });
  assert.ok(!semBanner(visivel), `banner visível não contou: ${visivel.areas[0].nota}`);
});

// ---------------------------------------------------------------------------------------------
// Critério 4: site inacessível → área em erro, sem achados inventados
// ---------------------------------------------------------------------------------------------

test('site inacessível (erro de rede) → área tracking em erro, com nota, sem achados', async () => {
  const r = await auditar({ site: SITE, renderizar: async ({ url }) => ({ ok: false, status: 0, url, dom: '', pedidos: [], erro: 'ENOTFOUND' }) });
  assert.deepEqual(r.areas.map((a) => [a.area, a.estado]), [['tracking', 'erro']]);
  assert.ok(r.areas[0].nota?.trim(), 'a área em erro tem de dizer porquê');
  assert.deepEqual(r.achados, []);
  assert.deepEqual(validarFormato(r), []);
});

test('chromium em falta → área em erro "não foi possível renderizar", não "site inacessível"', () => {
  // Processo à parte com PLAYWRIGHT_BROWSERS_PATH numa pasta vazia: o Playwright não encontra o browser.
  const vazia = mkdtempSync(join(tmpdir(), 'sem-browser-'));
  try {
    const modulo = new URL('../scripts/auditoria/tracking.mjs', import.meta.url).href;
    const codigo = `import { auditar } from ${JSON.stringify(modulo)};
      const r = await auditar({ site: 'https://cliente-ficticio.pt/', obter: async (url) => ({ ok: true, status: 200, url, texto: '<p>x</p>', erro: null }) });
      process.stdout.write(JSON.stringify(r));`;
    const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo],
      // Temporários do processo dentro de `vazia`: o Playwright cria perfil e artifacts em
      // os.tmpdir() antes de ver que o browser falta e não os apaga (#29); o finally leva-os.
      { env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: vazia, TMPDIR: vazia, TEMP: vazia, TMP: vazia }, encoding: 'utf8' }));
    assert.deepEqual(r.areas.map((a) => [a.area, a.estado]), [['tracking', 'erro']]);
    assert.equal(r.areas[0].nota, 'não foi possível renderizar: chromium em falta (npx playwright install --only-shell chromium)');
    assert.deepEqual(r.achados, []);
  } finally {
    rmSync(vazia, { recursive: true, force: true });
  }
});

test('site que responde HTTP 500 → área em erro, sem achados (nem ga4-ausente)', async () => {
  const r = await auditar({ site: SITE, renderizar: async ({ url }) => ({ ok: false, status: 500, url, dom: '<html>erro</html>', pedidos: [], erro: null }) });
  assert.deepEqual(r.areas.map((a) => a.estado), ['erro']);
  assert.deepEqual(r.achados, []);
  assert.deepEqual(validarFormato(r), []);
});

test('auditar não lança quando o renderizar falha', async () => {
  await assert.doesNotReject(auditar({ site: SITE, renderizar: async ({ url }) => ({ ok: false, status: 0, url, dom: '', pedidos: [], erro: 'timeout' }) }));
});

// ---------------------------------------------------------------------------------------------
// Critério 5: output valida contra o formato de #3
// ---------------------------------------------------------------------------------------------

for (const nome of ['limpo', 'duplicado', 'antes-do-consentimento', 'sem-banner', 'sem-tracking']) {
  test(`o output para a fixture ${nome} valida contra o formato de #3`, async () => {
    const r = await auditarDom(fixture(nome), nome === 'antes-do-consentimento' ? [hitGa4, hitMeta] : []);
    assert.ok(r.achados.every((a) => a.area === 'tracking'), 'todos os achados são da área tracking');
    assert.deepEqual(validarFormato(r), []);
  });
}

// ---------------------------------------------------------------------------------------------
// D-008: os hits de recolha nunca saem para a rede real
// ---------------------------------------------------------------------------------------------

test('chromium real: hits GA4 /g/collect e facebook.com/tr ficam registados mas nunca chegam ao obter', async () => {
  const pedidosAoObter = [];
  const base = obterDeFixtures({ [SITE]: fixture('antes-do-consentimento') });
  const espiao = async (url) => { pedidosAoObter.push(url); return base(url); };

  const r = await renderizarPagina({ url: SITE, obter: espiao });
  exigirBrowser(r);

  const registados = r.pedidos.map((p) => p.url);
  assert.ok(registados.some((u) => u.includes('google-analytics.com/g/collect')), `hit GA4 não registado: ${registados.join(' | ')}`);
  assert.ok(registados.some((u) => u.includes('facebook.com/tr')), `hit Meta não registado: ${registados.join(' | ')}`);
  assert.ok(pedidosAoObter.includes(SITE), 'o documento é servido pelo obter');
  const fugas = pedidosAoObter.filter((u) => /\/g\/collect|facebook\.com\/tr/.test(u));
  assert.deepEqual(fugas, [], 'os hits de recolha foram entregues ao obter (sairiam para a rede)');
});

// Servidor HTTP local (127.0.0.1) só para o que o obter não sabe fazer: redireccionamentos e
// WebSockets. Regista tudo o que lhe chega — é a "rede" que não pode receber hits.
async function servidorLocal(responder) {
  const vistos = [];
  const upgrades = [];
  const srv = createServer((req, res) => { vistos.push(req.url); responder(req, res); });
  srv.on('upgrade', (req, socket) => { upgrades.push(req.url); socket.destroy(); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const porta = srv.address().port;
  return { porta, vistos, upgrades, fechar: () => new Promise((ok) => srv.close(ok)) };
}

test('chromium real (D-008): beacon/fetch/img/xhr/script/iframe/WebSocket de medição, conversão e remarketing não chegam ao obter nem à rede', async () => {
  const ws = await servidorLocal((req, res) => res.end());
  try {
    const pedidosAoObter = [];
    const base = obterDeFixtures({ [SITE]: fixture('fugas-d008').replace('__WS__', `ws://127.0.0.1:${ws.porta}/api/v2/client/ws`) });
    const espiao = async (url) => { pedidosAoObter.push(url); return base(url); };

    const r = await renderizarPagina({ url: SITE, obter: espiao });
    exigirBrowser(r);

    assert.deepEqual(pedidosAoObter, [SITE], 'só o documento pode ser servido; o resto sairia para a rede real');
    assert.deepEqual(ws.upgrades, [], 'o WebSocket chegou a ligar ao servidor');
    const registados = r.pedidos.map((p) => p.url);
    for (const trecho of ['google-analytics.com/collect', 'google-analytics.com/j/collect', 'stats.g.doubleclick.net/g/collect',
      'sst.cliente-ficticio.pt/g/collect', 'cliente-ficticio.pt/tr', 'google.com/ccm/collect', 'pagead/viewthroughconversion/123',
      'googleadservices.com/pagead/conversion', 'pagead/1p-user-list', 'px.ads.linkedin.com/collect', 'analytics.tiktok.com/api',
      'in.hotjar.com/api', 'clarity.ms/collect', 'td.doubleclick.net/td/rul', `127.0.0.1:${ws.porta}/api/v2/client/ws`]) {
      assert.ok(registados.some((u) => u.includes(trecho)), `pedido não registado (o achado não o veria): ${trecho}`);
    }
  } finally {
    await ws.fechar();
  }
});

test('chromium real (D-008): cada salto de um redireccionamento passa pela mesma regra', async () => {
  // Site em 127.0.0.1; "terceiro" em localhost. O Playwright não encaminha redireccionamentos pelo
  // route — um script permitido que redirecciona para /g/collect escapava.
  const srv = await servidorLocal((req, res) => {
    const terceiro = `http://localhost:${srv.porta}`;
    if (req.url === '/entrada') { res.writeHead(302, { location: '/' }); return res.end(); }
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return res.end(`<html><head><script src="${terceiro}/r.js"></script><link rel="stylesheet" href="${terceiro}/c.css"></head><body><h1>ok</h1></body></html>`);
    }
    if (req.url === '/r.js') { res.writeHead(302, { location: '/g/collect?v=2&tid=G-REDIR001&en=page_view' }); return res.end(); }
    if (req.url === '/c.css') { res.writeHead(302, { location: '/ok.css' }); return res.end(); }
    if (req.url === '/ok.css') { res.setHeader('content-type', 'text/css'); return res.end('h1{color:red}'); }
    res.writeHead(404); res.end();
  });
  try {
    const r = await renderizarPagina({ url: `http://127.0.0.1:${srv.porta}/entrada` });
    exigirBrowser(r);
    assert.deepEqual(srv.vistos.filter((u) => u.includes('collect')), [], 'o redireccionamento levou o hit à rede');
    assert.ok(srv.vistos.includes('/ok.css'), `um redireccionamento permitido tem de continuar a funcionar: ${srv.vistos.join(' ')}`);
    assert.equal(r.url, `http://127.0.0.1:${srv.porta}/`, 'o documento principal fica com o URL final');
    assert.ok(r.pedidos.some((p) => p.url.includes('/g/collect')), 'o salto bloqueado fica registado');
  } finally {
    await srv.fechar();
  }
});

test('os hits de conversão, remarketing e de outros fornecedores são classificados; as bibliotecas não', () => {
  const casos = {
    'https://www.google-analytics.com/collect?v=1&tid=UA-1-1': 'ua',
    'https://stats.g.doubleclick.net/g/collect?v=2&tid=G-X': 'ga4',
    'https://sst.cliente.pt/g/collect?v=2&tid=G-X': 'ga4',
    'https://www.google.com/ccm/collect?tid=G-X': 'google-ads',
    'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123/': 'google-ads',
    'https://www.googleadservices.com/pagead/conversion/123/': 'google-ads',
    'https://px.ads.linkedin.com/collect?pid=1': 'linkedin',
    'https://analytics.tiktok.com/api/v2/pixel': 'tiktok',
    'https://in.hotjar.com/api/v2/client/sites/1/visit-data': 'hotjar',
    'https://x.clarity.ms/collect': 'clarity',
    'https://www.facebook.com/privacy_sandbox/pixel/register/trigger/?id=1': 'meta',
    'https://www.googletagmanager.com/gtag/js?id=G-X': null,
    'https://www.googleadservices.com/pagead/conversion.js': null,
    'https://snap.licdn.com/li.lms-analytics/insight.min.js': null,
    'https://analytics.tiktok.com/i18n/pixel/events.js': null,
    'https://static.hotjar.com/c/hotjar-1.js': null,
    'https://www.clarity.ms/tag/abc': null,
  };
  for (const [url, vendor] of Object.entries(casos)) assert.equal(eHitDeRecolha(url), vendor, url);
});

test('hit do LinkedIn antes do consentimento gera achado gdpr-compliance', async () => {
  const r = await auditarDom(fixture('antes-do-consentimento'), [{ url: 'https://px.ads.linkedin.com/collect?pid=1', metodo: 'GET', tipo: 'fetch' }]);
  const a = antesDoConsentimento(r);
  assert.equal(a.length, 1, JSON.stringify(regras(r)));
  assert.match(a[0].evidencia, /LinkedIn/);
});

// Troca o chromium.launch durante um teste (o renderizar usa o mesmo objecto chromium).
async function comLaunch(falso, corpo) {
  const original = chromium.launch;
  chromium.launch = falso;
  try {
    return await corpo();
  } finally {
    chromium.launch = original;
  }
}

test('o chromium arranca sempre com sandbox', async () => {
  const opcoes = [];
  await comLaunch(async (o) => { opcoes.push(o); throw new Error('parar aqui'); },
    () => renderizarPagina({ url: SITE, obter: obterDeFixtures({}) }));
  assert.equal(opcoes.length, 1);
  assert.equal(opcoes[0]?.chromiumSandbox, true, `launch sem sandbox: ${JSON.stringify(opcoes[0])}`);
});

test('sandbox recusada pelo SO → área em erro com nota que explica, sem tentar de novo sem sandbox', async () => {
  const opcoes = [];
  const r = await comLaunch(async (o) => {
    opcoes.push(o);
    throw new Error('browserType.launch: Target page, context or browser has been closed\n[pid=1][err] No usable sandbox! If you are running on Ubuntu 23.10+ or another Linux distro that has disabled unprivileged user namespaces with AppArmor, see ...');
  }, () => auditar({ site: SITE, obter: obterDeFixtures({ [SITE]: fixture('limpo') }) }));
  assert.equal(opcoes.length, 1, 'tentou arrancar outra vez (sem sandbox?)');
  assert.ok(opcoes.every((o) => o?.chromiumSandbox === true), JSON.stringify(opcoes));
  assert.deepEqual(r.areas.map((a) => a.estado), ['erro']);
  assert.match(r.areas[0].nota, /não foi possível renderizar/);
  assert.match(r.areas[0].nota, /sandbox/);
  assert.doesNotMatch(r.areas[0].nota, /site inacessível/);
  assert.deepEqual(r.achados, []);
  assert.deepEqual(validarFormato(r), []);
});

test('chromium real: página que prende o renderer depois do load termina dentro do prazo, com erro timeout', { timeout: 60000 }, async () => {
  const html = "<html><body><script>addEventListener('load', () => setTimeout(() => { while (true) {} }, 50));</script></body></html>";
  const inicio = Date.now();
  // prazo curto para o teste ser rápido; o mecanismo é o mesmo do default (45 s).
  const r = await renderizarPagina({ url: SITE, obter: obterDeFixtures({ [SITE]: html }), prazo: 5000 });
  const ms = Date.now() - inicio;
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'timeout');
  assert.ok(ms < 15000, `demorou ${ms} ms`);
});

// ---------------------------------------------------------------------------------------------
// Controlo: página limpa com banner não gera achados
// ---------------------------------------------------------------------------------------------

test('controlo: página limpa com banner e Consent Mode não gera achados', async () => {
  const r = await auditarDom(fixture('limpo'));
  assert.deepEqual(r.areas.map((a) => [a.area, a.estado]), [['tracking', 'verificado']]);
  assert.deepEqual(r.achados, []);
});

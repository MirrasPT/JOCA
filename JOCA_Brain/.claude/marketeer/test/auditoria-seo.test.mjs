// Testes da auditoria de SEO técnico (#6), escritos a partir dos critérios de aceitação do issue.
// Sem rede: tudo passa por obterDeFixtures com o conteúdo de test/fixtures/seo/. Cada caso parte do
// site "limpo" (página completa + robots.txt + sitemap.xml) e muda uma coisa só.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditar } from '../scripts/auditoria/seo.mjs';
import { obterDeFixtures } from '../scripts/auditoria/pagina.mjs';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';

const fixture = (nome) => readFileSync(new URL(`./fixtures/seo/${nome}`, import.meta.url), 'utf8');

const SITE = 'https://exemplo.pt/';
const ROBOTS = 'https://exemplo.pt/robots.txt';
const SITEMAP = 'https://exemplo.pt/sitemap.xml';

// Site sem problemas; os casos substituem ou retiram entradas deste mapa.
const siteLimpo = () => ({
  [SITE]: fixture('pagina-completa.html'),
  [ROBOTS]: fixture('robots.txt'),
  [SITEMAP]: fixture('sitemap.xml'),
});

const correr = (mapa) => auditar({ site: SITE, obter: obterDeFixtures(mapa) });
const regras = (r) => r.achados.map((a) => a.regra);
const areaSeo = (r) => r.areas.find((a) => a.area === 'seo');

// Critério "output valida contra o formato de #3": o agregador junta cliente/data/metodo.
const validar = (r) => validarAuditoria(
  JSON.stringify({ cliente: 'exemplo', data: '2026-09-24', metodo: '0.1.0', ...r }), 'exemplo', '2026-09-24');

// ---------------------------------------------------------------------------------------------
// Base: um site limpo não gera achados
// ---------------------------------------------------------------------------------------------

test('site limpo: área seo verificada e sem achados', async () => {
  const r = await correr(siteLimpo());
  assert.equal(areaSeo(r)?.estado, 'verificado');
  assert.deepEqual(r.achados, [], `achados inesperados: ${regras(r).join(', ')}`);
  assert.deepEqual(validar(r), []);
});

// ---------------------------------------------------------------------------------------------
// Critério: cada verificação produz achado com a URL como evidência
// ---------------------------------------------------------------------------------------------

test('página sem SEO: title, description, canonical e dados estruturados geram achados', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-vazia.html') });
  for (const regra of ['seo.title-ausente', 'seo.meta-description-ausente', 'seo.canonical-ausente', 'seo.dados-estruturados-ausentes']) {
    assert.ok(regras(r).includes(regra), `falta o achado ${regra} (achados: ${regras(r).join(', ')})`);
  }
});

test('title comentado ou só com espaços conta como ausente', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-vazia.html') });
  assert.ok(regras(r).includes('seo.title-ausente'));
});

test('JSON-LD com JSON partido gera achado de dados estruturados inválidos', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-noindex.html') });
  assert.ok(regras(r).includes('seo.dados-estruturados-invalidos'), `achados: ${regras(r).join(', ')}`);
});

test('todos os achados da página têm a URL da página como evidência', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-vazia.html') });
  assert.ok(r.achados.length > 0);
  for (const a of r.achados) assert.ok(a.evidencia.includes(SITE), `${a.regra} sem a URL na evidência: "${a.evidencia}"`);
});

test('achados de robots e sitemap têm a URL do ficheiro como evidência', async () => {
  const mapa = siteLimpo();
  delete mapa[ROBOTS];
  delete mapa[SITEMAP];
  const r = await correr(mapa);
  const robots = r.achados.find((a) => a.regra === 'seo.robots-ausente');
  const sitemap = r.achados.find((a) => a.regra === 'seo.sitemap-ausente');
  assert.ok(robots?.evidencia.includes(ROBOTS), `evidência do robots: ${robots?.evidencia}`);
  assert.ok(sitemap?.evidencia.includes(SITEMAP), `evidência do sitemap: ${sitemap?.evidencia}`);
});

test('todo o achado tem area seo, regra seo.*, recomendação e skill', async () => {
  const r = await correr({ [SITE]: fixture('pagina-vazia.html') });
  assert.ok(r.achados.length > 0);
  for (const a of r.achados) {
    assert.equal(a.area, 'seo');
    assert.match(a.regra, /^seo\.[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(a.recomendacao?.trim(), `${a.regra} sem recomendação`);
    assert.ok(a.skill?.trim(), `${a.regra} sem skill`);
  }
});

// ---------------------------------------------------------------------------------------------
// Critério: noindex numa página pública gera achado de severidade crítica
// ---------------------------------------------------------------------------------------------

test('meta robots noindex na página pública → achado crítico com a URL', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-noindex.html') });
  const a = r.achados.find((x) => x.regra === 'seo.noindex');
  assert.ok(a, `falta seo.noindex (achados: ${regras(r).join(', ')})`);
  assert.equal(a.severidade, 'critica');
  assert.ok(a.evidencia.includes(SITE));
});

test('meta googlebot noindex (maiúsculas, aspas duplas) também é crítico', async () => {
  const html = fixture('pagina-completa.html').replace(
    '<meta name="robots" content="index, follow">', '<meta name="GoogleBot" content="NOINDEX">');
  const r = await correr({ ...siteLimpo(), [SITE]: html });
  assert.equal(r.achados.find((x) => x.regra === 'seo.noindex')?.severidade, 'critica', `achados: ${regras(r).join(', ')}`);
});

test('index, follow não gera achado de noindex', async () => {
  const r = await correr(siteLimpo());
  assert.ok(!regras(r).includes('seo.noindex'));
});

test('robots.txt com Disallow: / para todos → achado crítico', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: fixture('robots-bloqueia-tudo.txt') });
  const a = r.achados.find((x) => x.regra === 'seo.robots-bloqueia-tudo');
  assert.ok(a, `achados: ${regras(r).join(', ')}`);
  assert.equal(a.severidade, 'critica');
  assert.ok(a.evidencia.includes(ROBOTS));
});

test('Disallow: /admin/ não é bloqueio total', async () => {
  const r = await correr(siteLimpo());
  assert.ok(!regras(r).includes('seo.robots-bloqueia-tudo'));
});

// ---------------------------------------------------------------------------------------------
// Critério: ausência de sitemap/robots detectada
// ---------------------------------------------------------------------------------------------

test('sem robots.txt (404) → achado robots-ausente, e não erro', async () => {
  const mapa = siteLimpo();
  delete mapa[ROBOTS];
  const r = await correr(mapa);
  assert.ok(regras(r).includes('seo.robots-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.equal(areaSeo(r).estado, 'verificado', `área em ${areaSeo(r).estado}: ${areaSeo(r).nota}`);
  assert.deepEqual(validar(r), []);
});

test('sem sitemap.xml (404) → achado sitemap-ausente', async () => {
  const mapa = siteLimpo();
  delete mapa[SITEMAP];
  const r = await correr(mapa);
  assert.ok(regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.equal(areaSeo(r).estado, 'verificado');
});

test('sem robots nem sitemap → os dois achados', async () => {
  const r = await correr({ [SITE]: fixture('pagina-completa.html') });
  assert.ok(regras(r).includes('seo.robots-ausente'));
  assert.ok(regras(r).includes('seo.sitemap-ausente'));
});

test('/sitemap.xml com 200 mas HTML (fallback do CMS) conta como ausente', async () => {
  const r = await correr({ ...siteLimpo(), [SITEMAP]: fixture('pagina-completa.html') });
  const a = r.achados.find((x) => x.regra === 'seo.sitemap-ausente');
  assert.ok(a, `achados: ${regras(r).join(', ')}`);
  assert.ok(a.evidencia.includes(SITEMAP));
});

test('sitemap declarado no robots.txt noutro caminho é encontrado', async () => {
  const outro = 'https://exemplo.pt/mapa-do-site.xml';
  const r = await correr({
    [SITE]: fixture('pagina-completa.html'),
    [ROBOTS]: `User-agent: *\nDisallow:\n\nSitemap: ${outro}\n`,
    [outro]: fixture('sitemap.xml'),
  });
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
});

// ---------------------------------------------------------------------------------------------
// Site inacessível: área em erro com nota, sem achados inventados
// ---------------------------------------------------------------------------------------------

test('site inacessível (sem resposta) → área erro com nota e zero achados', async () => {
  const obter = async (url) => ({ ok: false, status: 0, url, texto: '', erro: 'ENOTFOUND' });
  const r = await auditar({ site: SITE, obter });
  assert.equal(areaSeo(r)?.estado, 'erro');
  assert.ok(areaSeo(r).nota?.trim(), 'área em erro sem nota');
  assert.deepEqual(r.achados, []);
  assert.deepEqual(validar(r), []);
});

test('página inicial com HTTP 500 → área erro com nota e zero achados', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: { status: 500, texto: 'erro interno' } });
  assert.equal(areaSeo(r)?.estado, 'erro');
  assert.ok(areaSeo(r).nota?.trim());
  assert.deepEqual(r.achados, []);
});

test('auditar não lança quando obter() falha em tudo', async () => {
  await assert.doesNotReject(auditar({ site: SITE, obter: obterDeFixtures({}) }));
});

// ---------------------------------------------------------------------------------------------
// Critério: output valida contra o formato de #3 (em todos os cenários acima)
// ---------------------------------------------------------------------------------------------

test('output valida contra o formato em todos os cenários', async () => {
  const semRobotsNemSitemap = { [SITE]: fixture('pagina-completa.html') };
  const cenarios = {
    limpo: siteLimpo(),
    vazia: { ...siteLimpo(), [SITE]: fixture('pagina-vazia.html') },
    noindex: { ...siteLimpo(), [SITE]: fixture('pagina-noindex.html') },
    bloqueiaTudo: { ...siteLimpo(), [ROBOTS]: fixture('robots-bloqueia-tudo.txt') },
    semRobotsNemSitemap,
    sitemapHtml: { ...siteLimpo(), [SITEMAP]: '<!doctype html><html><body>404</body></html>' },
    inacessivel: {},
  };
  for (const [nome, mapa] of Object.entries(cenarios)) {
    const r = await correr(mapa);
    assert.deepEqual(Object.keys(r).sort(), ['achados', 'areas'], `${nome}: o módulo não devolve só { areas, achados }`);
    assert.deepEqual(validar(r), [], `${nome}: não valida`);
  }
});

// ---------------------------------------------------------------------------------------------
// Regressões da revisão do PR #20
// ---------------------------------------------------------------------------------------------

test('Sitemap: relativo no robots.txt resolve-se contra o robots.txt', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: *\nDisallow:\n\nSitemap: /sitemap.xml\n' });
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.equal(areaSeo(r).estado, 'verificado', areaSeo(r).nota);
});

test('Sitemap: inválido no robots.txt é ignorado e cai no /sitemap.xml', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: *\nDisallow:\n\nSitemap: http://[::1\n' });
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
});

test('robots: grupo Googlebot próprio que permite tudo anula o Disallow: / de *', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: Googlebot\nDisallow:\n\nUser-agent: *\nDisallow: /\n' });
  assert.ok(!regras(r).includes('seo.robots-bloqueia-tudo'), `achados: ${regras(r).join(', ')}`);
});

test('robots: Allow: / com Disallow: / não é bloqueio total', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: *\nAllow: /\nDisallow: /\n' });
  assert.ok(!regras(r).includes('seo.robots-bloqueia-tudo'), `achados: ${regras(r).join(', ')}`);
});

test('robots: Disallow: /* também é bloqueio total', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: *\nDisallow: /*\n' });
  const a = r.achados.find((x) => x.regra === 'seo.robots-bloqueia-tudo');
  assert.equal(a?.severidade, 'critica', `achados: ${regras(r).join(', ')}`);
  assert.ok(a.evidencia.includes('Disallow: /*'), a.evidencia);
});

test('robots: grupo Googlebot bloqueado é crítico mesmo com * livre, e a evidência nomeia o user-agent', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: *\nDisallow:\n\nUser-agent: bingbot\nUser-agent: Googlebot\nDisallow: /\n' });
  const a = r.achados.find((x) => x.regra === 'seo.robots-bloqueia-tudo');
  assert.ok(a, `achados: ${regras(r).join(', ')}`);
  assert.ok(a.evidencia.includes('Googlebot'), a.evidencia);
});

test('robots: user-agents seguidos partilham o grupo (bingbot + * com Disallow: /)', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: 'User-agent: bingbot\nUser-agent: *\nDisallow: /\n' });
  const a = r.achados.find((x) => x.regra === 'seo.robots-bloqueia-tudo');
  assert.ok(a?.evidencia.includes('User-agent: *'), `achados: ${regras(r).join(', ')}`);
});

// Página limpa com um extra no <head>.
const comExtraNaCabeca = (extra) => fixture('pagina-completa.html').replace('</head>', `${extra}\n</head>`);

test('<meta noindex> dentro de uma string de <script> não conta', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: comExtraNaCabeca(`<script>var t = '<meta name="robots" content="noindex">';</script>`) });
  assert.ok(!regras(r).includes('seo.noindex'), `achados: ${regras(r).join(', ')}`);
});

test('<meta noindex> dentro de <template> não conta', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: comExtraNaCabeca('<template><meta name="robots" content="noindex"></template>') });
  assert.ok(!regras(r).includes('seo.noindex'), `achados: ${regras(r).join(', ')}`);
});

test('"<!--" numa string de <script> não apaga o resto do documento', async () => {
  // O "-->" mais à frente (um comentário real no body) é o que fazia o "<!--" do script comer a cabeça.
  const html = fixture('pagina-completa.html')
    .replace('<title>', '<script>var a = "<!--";</script>\n  <title>')
    .replace('</body>', '<!-- fim -->\n</body>');
  const r = await correr({ ...siteLimpo(), [SITE]: html });
  assert.deepEqual(r.achados, [], `achados: ${regras(r).join(', ')}`);
});

test('<script> JSON-LD comentado não conta como dados estruturados', async () => {
  const html = fixture('pagina-completa.html').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, (m) => `<!-- ${m} -->`);
  const r = await correr({ ...siteLimpo(), [SITE]: html });
  assert.ok(regras(r).includes('seo.dados-estruturados-ausentes'), `achados: ${regras(r).join(', ')}`);
});

test('metadados no <body> (streaming do Next.js) são lidos', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-metadados-no-body.html') });
  assert.deepEqual(regras(r), ['seo.noindex'], `achados: ${regras(r).join(', ')}`);
});

test('site inválido (sem esquema) → área erro com nota, sem achados e sem lançar', async () => {
  const r = await auditar({ site: 'exemplo.pt', obter: obterDeFixtures(siteLimpo()) });
  assert.equal(areaSeo(r)?.estado, 'erro');
  assert.match(areaSeo(r).nota, /^site inválido: exemplo\.pt/);
  assert.deepEqual(r.achados, []);
  assert.deepEqual(validar(r), []);
});

// ---------------------------------------------------------------------------------------------
// Ramo parcial: robots/sitemap que não respondem deixam a área em erro sem inventar achados
// ---------------------------------------------------------------------------------------------

test('robots.txt com 503 → área erro com nota, mantendo os achados da página', async () => {
  const r = await correr({ ...siteLimpo(), [SITE]: fixture('pagina-vazia.html'), [ROBOTS]: { status: 503, texto: '' } });
  assert.equal(areaSeo(r).estado, 'erro');
  assert.match(areaSeo(r).nota, /robots\.txt não verificado \(HTTP 503\)/);
  assert.ok(regras(r).includes('seo.title-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.ok(!regras(r).includes('seo.robots-ausente'));
  assert.deepEqual(validar(r), []);
});

test('sitemap com 500 → área erro, sem sitemap-ausente', async () => {
  const r = await correr({ ...siteLimpo(), [SITEMAP]: { status: 500, texto: '' } });
  assert.equal(areaSeo(r).estado, 'erro');
  assert.match(areaSeo(r).nota, /sitemap não verificado/);
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.deepEqual(validar(r), []);
});

test('sitemap com timeout → área erro, sem sitemap-ausente', async () => {
  const fixtures = obterDeFixtures(siteLimpo());
  const obter = async (url) => (url === SITEMAP ? { ok: false, status: 0, url, texto: '', erro: 'timeout' } : fixtures(url));
  const r = await auditar({ site: SITE, obter });
  assert.equal(areaSeo(r).estado, 'erro');
  assert.match(areaSeo(r).nota, /timeout/);
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
});

test('redirect: evidência e robots.txt vêm da origem final', async () => {
  const FINAL = 'https://www.exemplo.pt/';
  const pedidos = [];
  const fixtures = obterDeFixtures({ 'https://www.exemplo.pt/robots.txt': fixture('robots-bloqueia-tudo.txt') });
  const obter = async (url) => {
    pedidos.push(url);
    if (url === 'http://exemplo.pt/') return { ok: true, status: 200, url: FINAL, texto: fixture('pagina-vazia.html'), erro: null };
    return fixtures(url);
  };
  const r = await auditar({ site: 'http://exemplo.pt/', obter });
  assert.ok(pedidos.includes('https://www.exemplo.pt/robots.txt'), `pedidos: ${pedidos.join(', ')}`);
  assert.ok(!pedidos.includes('http://exemplo.pt/robots.txt'));
  assert.ok(regras(r).includes('seo.robots-bloqueia-tudo'), `achados: ${regras(r).join(', ')}`);
  for (const a of r.achados) assert.ok(a.evidencia.includes('https://www.exemplo.pt/'), `${a.regra}: ${a.evidencia}`);
});

// ---------------------------------------------------------------------------------------------
// Sugestões da revisão
// ---------------------------------------------------------------------------------------------

test('área verificada declara os limites na nota', async () => {
  const r = await correr(siteLimpo());
  assert.equal(areaSeo(r).nota, 'página inicial; HTML estático; X-Robots-Tag não verificado');
  assert.deepEqual(validar(r), []);
});

test('robots.txt com 200 mas HTML (fallback de SPA) conta como ausente', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: fixture('pagina-completa.html') });
  const a = r.achados.find((x) => x.regra === 'seo.robots-ausente');
  assert.ok(a, `achados: ${regras(r).join(', ')}`);
  assert.ok(a.evidencia.includes(ROBOTS));
});

test('sitemap .xml.gz declarado → verificação parcial, sem sitemap-ausente', async () => {
  const gz = 'https://exemplo.pt/sitemap.xml.gz';
  const r = await correr({ ...siteLimpo(), [ROBOTS]: `User-agent: *\nDisallow:\n\nSitemap: ${gz}\n`, [gz]: '\x1f\x8b\x08\x00lixo' });
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.equal(areaSeo(r).estado, 'erro');
  assert.match(areaSeo(r).nota, /\.gz/);
  assert.deepEqual(validar(r), []);
});

// ---------------------------------------------------------------------------------------------
// #26: sitemap declarado partido ≠ sitemap ausente (escritos a partir dos critérios do issue)
// ---------------------------------------------------------------------------------------------

const DECLARADO = 'https://exemplo.pt/sitemap_index.xml';
const robotsDeclara = (url) => `User-agent: *\nDisallow: /admin/\n\nSitemap: ${url}\n`;

test('#26: declarado 404 + /sitemap.xml válido → sitemap-declarado-partido, sem sitemap-ausente', async () => {
  // O DECLARADO não está no mapa: obterDeFixtures responde 404.
  const r = await correr({ ...siteLimpo(), [ROBOTS]: robotsDeclara(DECLARADO) });
  const a = r.achados.find((x) => x.regra === 'seo.sitemap-declarado-partido');
  assert.ok(a, `falta seo.sitemap-declarado-partido (achados: ${regras(r).join(', ')})`);
  assert.ok(a.evidencia.includes(DECLARADO), `evidência sem o sitemap declarado: "${a.evidencia}"`);
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.deepEqual(validar(r), []);
});

test('#26: declarado 404 + sem /sitemap.xml → sitemap-ausente', async () => {
  const mapa = { ...siteLimpo(), [ROBOTS]: robotsDeclara(DECLARADO) };
  delete mapa[SITEMAP];
  const r = await correr(mapa);
  assert.ok(regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.ok(!regras(r).includes('seo.sitemap-declarado-partido'), `achados: ${regras(r).join(', ')}`);
  assert.deepEqual(validar(r), []);
});

test('#26: declarado 404 + /sitemap.xml com HTML (fallback do CMS) → sitemap-ausente', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: robotsDeclara(DECLARADO), [SITEMAP]: fixture('pagina-completa.html') });
  assert.ok(regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.ok(!regras(r).includes('seo.sitemap-declarado-partido'), `achados: ${regras(r).join(', ')}`);
});

test('#26: declarado 5xx + /sitemap.xml válido → nem declarado-partido nem sitemap-ausente', async () => {
  // Um 5xx pode ser temporário: não se afirma que o declarado está partido.
  const r = await correr({ ...siteLimpo(), [ROBOTS]: robotsDeclara(DECLARADO), [DECLARADO]: { status: 503, texto: '' } });
  assert.ok(!regras(r).includes('seo.sitemap-declarado-partido'), `achados: ${regras(r).join(', ')}`);
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
  assert.deepEqual(validar(r), []);
});

test('#26: declarado válido → nenhum dos dois achados', async () => {
  const r = await correr({ ...siteLimpo(), [ROBOTS]: robotsDeclara(DECLARADO), [DECLARADO]: fixture('sitemap.xml') });
  assert.ok(!regras(r).includes('seo.sitemap-declarado-partido'), `achados: ${regras(r).join(', ')}`);
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
});

test('#26 (aceitação): sem robots.txt + /sitemap.xml válido → nenhum dos dois achados', async () => {
  const mapa = siteLimpo();
  delete mapa[ROBOTS];
  const r = await correr(mapa);
  assert.ok(!regras(r).includes('seo.sitemap-declarado-partido'), `achados: ${regras(r).join(', ')}`);
  assert.ok(!regras(r).includes('seo.sitemap-ausente'), `achados: ${regras(r).join(', ')}`);
});

test('#26: sem rede — a auditoria só pede URLs presentes no mapa ou devolve 404 local', async () => {
  // Critério "testado com fixtures, sem rede": obter é um stub que regista pedidos e nunca chama fetch.
  const pedidos = [];
  const fixtures = obterDeFixtures({ ...siteLimpo(), [ROBOTS]: robotsDeclara(DECLARADO) });
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('rede real chamada num teste'); };
  try {
    await auditar({ site: SITE, obter: async (url) => { pedidos.push(url); return fixtures(url); } });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  assert.ok(pedidos.includes(DECLARADO), `pedidos: ${pedidos.join(', ')}`);
  assert.ok(pedidos.includes(SITEMAP), `o /sitemap.xml não foi tentado depois do declarado falhar: ${pedidos.join(', ')}`);
});

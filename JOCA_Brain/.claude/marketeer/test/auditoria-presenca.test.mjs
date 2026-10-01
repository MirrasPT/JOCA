// Testes da auditoria de presença local e redes (#7), escritos a partir dos critérios de aceitação
// do issue e do contrato em scripts/auditoria/pagina.mjs — não da implementação.
// Sem rede: o obter() é um espião que serve HTML inline e regista cada pedido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditar } from '../scripts/auditoria/presenca.mjs';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';
import { readFileSync } from 'node:fs';

const SITE = 'https://cliente.pt/';
const IG = 'https://www.instagram.com/padaria.aurora/';
const FB = 'https://www.facebook.com/padariaaurora/';
const LI = 'https://www.linkedin.com/company/padaria-aurora/';

// Números de seguidores que só existem nas páginas dos perfis: nunca podem aparecer no output.
const SEGUIDORES = ['12 345', '12345', '12.345', '4.321', '4321', '987'];

// obter() espião: serve { url: texto | { status, texto } | { erro } }, tolerante à barra final,
// e conta pedidos por URL. Resto → 404.
function espiao(mapa) {
  const norm = (u) => String(u).replace(/\/+$/, '');
  const chaves = new Map(Object.entries(mapa).map(([k, v]) => [norm(k), v]));
  const pedidos = [];
  const obter = async (url) => {
    pedidos.push(url);
    const v = chaves.get(norm(url));
    if (v === undefined) return { ok: false, status: 404, url, texto: '', erro: null };
    if (typeof v === 'object' && v.erro) return { ok: false, status: 0, url, texto: '', erro: v.erro };
    if (typeof v === 'object' && v.redirige) return { ok: true, status: 200, url: v.redirige, texto: v.texto ?? '', erro: null };
    const { status = 200, texto = '' } = typeof v === 'string' ? { texto: v } : v;
    return { ok: status < 400, status, url, texto, erro: null };
  };
  obter.pedidos = pedidos;
  obter.contar = (url) => pedidos.filter((p) => norm(p) === norm(url)).length;
  return obter;
}

function pagina({ corpo = '', jsonld = null, titulo = 'Padaria Aurora' } = {}) {
  const ld = jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : '';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${titulo}</title>${ld}</head><body>${corpo}</body></html>`;
}

const NEGOCIO = {
  '@context': 'https://schema.org',
  '@type': 'Bakery',
  name: 'Padaria Aurora',
  telephone: '+351 912 345 678',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua das Flores 12',
    postalCode: '4050-262',
    addressLocality: 'Porto',
    addressCountry: 'PT',
  },
};

const RODAPE_NAP = `
  <footer>
    <h2>Padaria Aurora</h2>
    <address>Rua das Flores 12, 4050-262 Porto</address>
    <p>Telefone: <a href="tel:+351912345678">+351 912 345 678</a></p>
  </footer>`;

const LINKS_PERFIS = `
  <nav class="redes">
    <a href="${IG}">Instagram</a>
    <a href="${FB}">Facebook</a>
    <a href="${LI}">LinkedIn</a>
  </nav>`;

const PERFIL_FB_PUBLICO = pagina({ titulo: 'Padaria Aurora | Facebook', corpo: '<h1>Padaria Aurora</h1><p>12 345 gostos · 12.345 seguidores</p>' });
const PERFIL_IG_LOGIN = pagina({ titulo: 'Login • Instagram', corpo: '<form><input name="username"><input type="password"></form>' });

// Cenário completo: 3 perfis (1 público, 1 atrás de login, 1 bloqueado com HTTP 999) e NAP coerente.
function cenarioCompleto(extra = {}) {
  return espiao({
    [SITE]: pagina({ jsonld: NEGOCIO, corpo: `${LINKS_PERFIS}${RODAPE_NAP}` }),
    [FB]: PERFIL_FB_PUBLICO,
    [IG]: PERFIL_IG_LOGIN,
    [LI]: { status: 999, texto: '' },
    ...extra,
  });
}

// Critério 4: o output junta cliente/data/metodo e valida contra o formato de #3.
function validaNoFormato(r) {
  const auditoria = { cliente: 'padaria-aurora', data: '2026-09-24', metodo: '0.1.0', ...r };
  return validarAuditoria(JSON.stringify(auditoria), 'padaria-aurora', '2026-09-24');
}

const areaDe = (r, rede) => r.areas.find((a) => a.area === `presenca.${rede}`);
const areasDeRede = (r) => r.areas.filter((a) => /^presenca\./.test(a.area));
const achadosNap = (r) => r.achados.filter((a) => /nap/i.test(a.regra ?? ''));

// ---------------------------------------------------------------------------------------------
// Forma geral do output (contrato de pagina.mjs)
// ---------------------------------------------------------------------------------------------

test('auditar devolve { areas, achados } e todas as áreas começam por "presenca"', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  assert.ok(Array.isArray(r.areas) && r.areas.length > 0, 'sem áreas');
  assert.ok(Array.isArray(r.achados), 'sem lista de achados');
  for (const a of r.areas) assert.match(a.area, /^presenca(\.|$)/, `área fora do módulo: ${a.area}`);
  for (const a of r.achados) assert.match(a.area, /^presenca(\.|$)/, `achado fora do módulo: ${a.area}`);
});

// ---------------------------------------------------------------------------------------------
// Critério 1: lista os perfis sociais ligados no site
// ---------------------------------------------------------------------------------------------

test('lista cada perfil social ligado no site, com a URL do perfil', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  for (const [rede, url] of [['instagram', IG], ['facebook', FB], ['linkedin', LI]]) {
    const a = areaDe(r, rede);
    assert.ok(a, `perfil ${rede} ligado no site não foi listado`);
    assert.ok(a.nota && a.nota.includes(url.replace(/\/$/, '')), `a nota de ${rede} não identifica o perfil (${url}): ${a.nota}`);
  }
});

test('não lista redes que o site não liga', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  for (const rede of ['tiktok', 'youtube', 'x']) assert.equal(areaDe(r, rede), undefined, `listou ${rede} sem link no site`);
});

test('site sem perfis ligados: nenhuma área de rede e o output continua válido', async () => {
  const obter = espiao({ [SITE]: pagina({ jsonld: NEGOCIO, corpo: RODAPE_NAP }) });
  const r = await auditar({ site: SITE, obter });
  assert.equal(areasDeRede(r).filter((a) => a.area !== 'presenca.nap').length, 0, `inventou perfis: ${JSON.stringify(r.areas)}`);
  assert.deepEqual(validaNoFormato(r), []);
  assert.equal(obter.pedidos.length, 1, `pediu mais do que o site: ${obter.pedidos}`);
});

test('o mesmo perfil ligado várias vezes é listado uma vez', async () => {
  const obter = espiao({
    [SITE]: pagina({ corpo: `<header><a href="${FB}">fb</a></header><footer><a href="${FB}">Facebook</a><a href="${FB.replace(/\/$/, '')}">f</a></footer>` }),
    [FB]: PERFIL_FB_PUBLICO,
  });
  const r = await auditar({ site: SITE, obter });
  assert.equal(r.areas.filter((a) => a.area === 'presenca.facebook').length, 1);
  assert.ok(obter.contar(FB) <= 1, `pediu o perfil ${obter.contar(FB)} vezes`);
});

// Cobre também: links de partilha não contam como perfis.
test('links de partilha (sharer, intent, shareArticle) não contam como perfis', async () => {
  const obter = espiao({
    [SITE]: pagina({
      corpo: `
        <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcliente.pt%2F">Partilhar</a>
        <a href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fcliente.pt%2F">Tweet</a>
        <a href="https://x.com/intent/post?text=ola">Post</a>
        <a href="https://www.linkedin.com/shareArticle?mini=true&url=https%3A%2F%2Fcliente.pt%2F">LinkedIn</a>`,
    }),
  });
  const r = await auditar({ site: SITE, obter });
  for (const rede of ['facebook', 'x', 'linkedin']) assert.equal(areaDe(r, rede), undefined, `link de partilha contado como perfil ${rede}`);
  assert.deepEqual(obter.pedidos, [SITE], `pediu links de partilha: ${obter.pedidos}`);
  assert.deepEqual(validaNoFormato(r), []);
});

test('link de partilha ao lado do perfil real: só o perfil conta', async () => {
  const obter = espiao({
    [SITE]: pagina({ corpo: `<a href="${FB}">Facebook</a><a href="https://www.facebook.com/sharer/sharer.php?u=https://cliente.pt/">Partilhar</a>` }),
    [FB]: PERFIL_FB_PUBLICO,
  });
  const r = await auditar({ site: SITE, obter });
  const a = areaDe(r, 'facebook');
  assert.ok(a, 'o perfil real deixou de ser listado');
  assert.doesNotMatch(a.nota, /sharer/, 'a nota aponta para o link de partilha');
  assert.ok(!obter.pedidos.some((p) => /sharer/.test(p)), 'pediu o link de partilha');
});

// ---------------------------------------------------------------------------------------------
// Critério 2: NAP do site vs dados estruturados — incoerência gera achado
// ---------------------------------------------------------------------------------------------

const SITE_NAP_INCOERENTE = pagina({
  jsonld: { ...NEGOCIO, telephone: '+351 222 000 111', address: { ...NEGOCIO.address, streetAddress: 'Avenida da Boavista 900', postalCode: '4100-111' } },
  corpo: RODAPE_NAP,
});

test('telefone e morada do site diferentes do JSON-LD geram um achado de NAP', async () => {
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: SITE_NAP_INCOERENTE }) });
  const nap = achadosNap(r);
  assert.equal(nap.length >= 1, true, `sem achado de NAP: ${JSON.stringify(r.achados)}`);
  const a = nap[0];
  assert.match(a.regra, /^presenca(\.[a-z0-9-]+)*\.[a-z0-9-]*nap[a-z0-9-]*$/, `regra fora do padrão: ${a.regra}`);
  assert.ok(a.evidencia && a.evidencia.trim(), 'achado sem evidência');
  assert.ok(/222 ?000 ?111|222000111/.test(a.evidencia) || /Boavista/.test(a.evidencia),
    `a evidência não mostra o valor divergente: ${a.evidencia}`);
  assert.ok(a.recomendacao && a.recomendacao.trim(), 'achado sem recomendação');
  assert.deepEqual(validaNoFormato(r), []);
});

test('só o telefone diverge: gera achado de NAP', async () => {
  const html = pagina({ jsonld: { ...NEGOCIO, telephone: '+351 222 000 111' }, corpo: RODAPE_NAP });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.ok(achadosNap(r).length >= 1, 'telefone divergente não gerou achado');
});

test('só o nome diverge: gera achado de NAP', async () => {
  const html = pagina({ jsonld: { ...NEGOCIO, name: 'Confeitaria Boreal Lda' }, corpo: RODAPE_NAP });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.ok(achadosNap(r).length >= 1, 'nome divergente não gerou achado');
});

// Cobre também: controlo — NAP coerente não gera achado.
test('NAP coerente não gera achado (controlo)', async () => {
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: pagina({ jsonld: NEGOCIO, corpo: RODAPE_NAP }) }) });
  assert.deepEqual(achadosNap(r), [], `achado de NAP num site coerente: ${JSON.stringify(r.achados)}`);
});

test('telefone igual escrito de outra forma (espaços, sem +351) não é incoerência', async () => {
  // O site só mostra o número com +351; o JSON-LD tem-no sem indicativo e sem espaços.
  const html = pagina({ jsonld: { ...NEGOCIO, telephone: '912345678' }, corpo: RODAPE_NAP });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), [], `formatação diferente do mesmo número deu achado: ${JSON.stringify(r.achados)}`);
});

test('sem dados estruturados não se inventa achado de NAP', async () => {
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: pagina({ corpo: RODAPE_NAP }) }) });
  assert.deepEqual(achadosNap(r), []);
  assert.deepEqual(validaNoFormato(r), []);
});

// ---------------------------------------------------------------------------------------------
// Critério 3: perfil que não se consegue ler publicamente → nao-verificado, com nota
// ---------------------------------------------------------------------------------------------

test('perfil que devolve a página de login fica nao-verificado, com nota', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const a = areaDe(r, 'instagram');
  assert.equal(a?.estado, 'nao-verificado');
  assert.ok(a.nota && a.nota.trim(), 'nao-verificado sem nota');
});

test('perfil que redirige para o login fica nao-verificado', async () => {
  // Título neutro: o único sinal é o destino do redirect.
  const obter = cenarioCompleto({ [IG]: { redirige: 'https://www.instagram.com/accounts/login/?next=%2Fpadaria.aurora%2F', texto: pagina({ titulo: 'Instagram' }) } });
  const r = await auditar({ site: SITE, obter });
  assert.equal(areaDe(r, 'instagram')?.estado, 'nao-verificado');
});

test('perfil bloqueado (HTTP 999 do LinkedIn) fica nao-verificado, com nota', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const a = areaDe(r, 'linkedin');
  assert.equal(a?.estado, 'nao-verificado');
  assert.ok(a.nota && a.nota.trim(), 'nao-verificado sem nota');
});

// #27, critério 1: timeout/5xx num perfil → erro com nota (era nao-verificado).
test('perfil com falha de rede fica erro, com nota, e não lança', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto({ [LI]: { erro: 'timeout' } }) });
  const a = areaDe(r, 'linkedin');
  assert.equal(a?.estado, 'erro');
  assert.ok(a.nota && a.nota.trim());
});

test('perfil lido publicamente não fica nao-verificado (controlo)', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  assert.equal(areaDe(r, 'facebook')?.estado, 'verificado');
});

test('perfis nao-verificado não têm achados', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const nv = new Set(r.areas.filter((a) => a.estado === 'nao-verificado').map((a) => a.area));
  assert.ok(nv.size >= 2);
  for (const ac of r.achados) assert.ok(!nv.has(ac.area), `achado numa área nao-verificado: ${ac.area}`);
});

// ---------------------------------------------------------------------------------------------
// Cobre também: dados do perfil nunca inventados — nada de números de seguidores
// ---------------------------------------------------------------------------------------------

test('nenhum achado nem nota contém números de seguidores', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const textos = [...r.areas.map((a) => a.nota ?? ''), ...r.achados.flatMap((a) => [a.evidencia, a.recomendacao, a.regra])].join('\n');
  for (const n of SEGUIDORES) assert.ok(!textos.includes(n), `o output contém "${n}" (seguidores/gostos do perfil)`);
  assert.doesNotMatch(textos, /\d[\d .]*\s*(seguidores|followers|gostos|likes)/i, 'o output cita métricas do perfil');
});

// ---------------------------------------------------------------------------------------------
// Cobre também: no máximo 1 pedido por perfil
// ---------------------------------------------------------------------------------------------

test('no máximo 1 pedido por perfil e 1 ao site', async () => {
  const obter = cenarioCompleto();
  await auditar({ site: SITE, obter });
  assert.equal(obter.contar(SITE), 1, `pediu o site ${obter.contar(SITE)} vezes`);
  for (const url of [IG, FB, LI]) assert.ok(obter.contar(url) <= 1, `pediu ${url} ${obter.contar(url)} vezes`);
  const porHost = {};
  for (const p of obter.pedidos) { const h = new URL(p).hostname; porHost[h] = (porHost[h] ?? 0) + 1; }
  for (const [h, n] of Object.entries(porHost)) assert.ok(n <= 1, `${n} pedidos a ${h}: ${obter.pedidos}`);
});

test('um perfil que falha não é repetido', async () => {
  const obter = cenarioCompleto({ [LI]: { erro: 'timeout' }, [IG]: { status: 500, texto: '' } });
  await auditar({ site: SITE, obter });
  assert.ok(obter.contar(LI) <= 1, `repetiu o LinkedIn ${obter.contar(LI)} vezes`);
  assert.ok(obter.contar(IG) <= 1, `repetiu o Instagram ${obter.contar(IG)} vezes`);
});

// ---------------------------------------------------------------------------------------------
// Cobre também: site ilegível fica em erro, com nota
// ---------------------------------------------------------------------------------------------

for (const [caso, resposta] of [['HTTP 500', { status: 500, texto: 'erro' }], ['falha de rede', { erro: 'ENOTFOUND' }], ['404', undefined]]) {
  test(`site ilegível (${caso}) fica em erro, com nota, sem achados`, async () => {
    const obter = espiao(resposta === undefined ? {} : { [SITE]: resposta });
    const r = await auditar({ site: SITE, obter });
    const erros = r.areas.filter((a) => a.estado === 'erro');
    assert.ok(erros.length >= 1, `nenhuma área em erro: ${JSON.stringify(r.areas)}`);
    for (const a of erros) assert.ok(a.nota && a.nota.trim(), 'erro sem nota');
    assert.ok(!r.areas.some((a) => a.estado === 'verificado'), 'área verificada com o site ilegível');
    assert.deepEqual(r.achados, [], 'achados inventados com o site ilegível');
    assert.deepEqual(validaNoFormato(r), []);
  });
}

// ---------------------------------------------------------------------------------------------
// Critério 4: o output valida contra o formato de #3
// ---------------------------------------------------------------------------------------------

const CENARIOS = {
  'completo (3 perfis, NAP coerente)': () => cenarioCompleto(),
  'NAP incoerente': () => espiao({ [SITE]: SITE_NAP_INCOERENTE }),
  'NAP incoerente com perfis': () => cenarioCompleto({ [SITE]: pagina({ jsonld: { ...NEGOCIO, telephone: '+351 222 000 111' }, corpo: `${LINKS_PERFIS}${RODAPE_NAP}` }) }),
  'site sem nada': () => espiao({ [SITE]: pagina() }),
};

for (const [nome, fazer] of Object.entries(CENARIOS)) {
  test(`o output valida no formato de #3: ${nome}`, async () => {
    const r = await auditar({ site: SITE, obter: fazer() });
    assert.deepEqual(validaNoFormato(r), []);
  });
}

test('a validação do formato apanha um output partido (controlo do próprio teste)', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const partido = structuredClone(r);
  partido.areas.find((a) => a.estado === 'nao-verificado').nota = '';
  assert.ok(validaNoFormato(partido).length > 0);
});

// ---------------------------------------------------------------------------------------------
// Regressões da revisão do PR #22 (C1): NAP sem achados falsos. Na dúvida, não há achado.
// ---------------------------------------------------------------------------------------------

// Fixo do Porto: o JSON-LD tem-no em 3-3-3 e o site mostra-o noutro agrupamento ou nem o liga.
const NEGOCIO_FIXO = { ...NEGOCIO, telephone: '+351 222 080 000' };

test('C1: fixo escrito em 2-3-4 no texto confirma o telefone do JSON-LD (e o móvel ao lado não é achado)', async () => {
  const html = pagina({ jsonld: NEGOCIO_FIXO, corpo: '<p>Padaria Aurora · Rua das Flores 12, 4050-262 Porto · Tel. 22 208 0000 · Tlm. 912 345 678</p>' });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), [], `achado falso: ${JSON.stringify(r.achados)}`);
  assert.doesNotMatch(r.areas[0].nota, /telefone não confirmado/);
});

for (const nif of ['Contribuinte n.º 253000999', 'NIF PT253000999', 'NIPC: 253 000 999']) {
  test(`C1: NIF no texto ("${nif}") nunca gera achado de telefone`, async () => {
    const html = pagina({ jsonld: NEGOCIO_FIXO, corpo: `<p>Padaria Aurora · 4050-262 Porto · ${nif}</p>` });
    const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
    assert.deepEqual(achadosNap(r), [], `NIF lido como telefone: ${JSON.stringify(r.achados)}`);
  });
}

test('C1: telefone só no texto e diferente do JSON-LD → sem achado, nota "telefone não confirmado"', async () => {
  const html = pagina({ jsonld: NEGOCIO_FIXO, corpo: '<p>Padaria Aurora · 4050-262 Porto · Encomendas: 912 345 678</p>' });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), []);
  assert.match(r.areas[0].nota, /telefone não confirmado/);
  assert.deepEqual(validaNoFormato(r), []);
});

for (const [linha, jsonTel] of [['Apoio 808 200 300', '808 200 300'], ['Linha 707 100 200', '+351 707 100 200'], ['Grátis 800 100 200', '800100200']]) {
  test(`C1: número ${jsonTel.replace(/\D/g, '').slice(-9, -6)} no JSON-LD e no texto, com um móvel ao lado, não gera achado`, async () => {
    const html = pagina({ jsonld: { ...NEGOCIO, telephone: jsonTel }, corpo: `<p>Padaria Aurora 4050-262 · ${linha} · 912 345 678</p>` });
    const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
    assert.deepEqual(achadosNap(r), [], `achado falso: ${JSON.stringify(r.achados)}`);
  });
}

test('C1: o telefone compara-se contra tel: — tel: diferente e número ausente do texto dá achado', async () => {
  const html = pagina({ jsonld: NEGOCIO_FIXO, corpo: '<p>Padaria Aurora 4050-262 <a href="tel:+351912345678">Ligue-nos</a></p>' });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.equal(achadosNap(r).length, 1);
  assert.match(achadosNap(r)[0].evidencia, /222 080 000/);
});

test('C1: postalCode com a localidade ("4050-262 Porto") bate com o CP do site', async () => {
  const html = pagina({ jsonld: { ...NEGOCIO, address: { ...NEGOCIO.address, postalCode: '4050-262 Porto' } }, corpo: RODAPE_NAP });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), [], `achado falso: ${JSON.stringify(r.achados)}`);
});

test('C1: entidades nomeadas no texto (S&eacute;) descodificam-se antes de comparar o nome', async () => {
  const html = pagina({
    titulo: 'Início',
    jsonld: { ...NEGOCIO, name: 'Pastelaria Sé' },
    corpo: '<p>Pastelaria S&eacute; &middot; Rua das Flores 12, 4050-262 Porto &middot; <a href="tel:+351912345678">ligar</a></p>',
  });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), [], `achado falso: ${JSON.stringify(r.achados)}`);
});

test('C1: entidade desconhecida no texto põe o nome em dúvida — nota, não achado', async () => {
  const html = pagina({
    titulo: 'Início',
    jsonld: { ...NEGOCIO, name: 'Pastelaria Sé' },
    corpo: '<p>Pastelaria S&ecaron;x · 4050-262 · <a href="tel:+351912345678">ligar</a></p>',
  });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), []);
  assert.match(r.areas[0].nota, /nome não confirmado/);
});

test('C1: várias lojas em @graph — basta o site mostrar a 2.ª para não haver achado', async () => {
  const html = pagina({
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Bakery', name: 'Padaria Aurora', telephone: '+351 222 080 000', address: { postalCode: '4050-262' } },
        { '@type': 'Bakery', name: 'Padaria Aurora Boavista', telephone: '+351 912 345 678', address: { postalCode: '4100-111' } },
      ],
    },
    corpo: '<p>Padaria Aurora · Loja Boavista 4100-111 Porto · <a href="tel:+351912345678">ligar</a></p>',
  });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), [], `achado falso: ${JSON.stringify(r.achados)}`);
});

test('C1: várias lojas em @graph e nenhuma bate com o site — achado com todos os valores do JSON-LD', async () => {
  const html = pagina({
    jsonld: { '@graph': [
      { '@type': 'Bakery', name: 'Padaria Aurora', address: { postalCode: '4050-262' } },
      { '@type': 'Bakery', name: 'Padaria Aurora Boavista', address: { postalCode: '4100-111' } },
    ] },
    corpo: '<p>Padaria Aurora · 4200-999 Porto</p>',
  });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.equal(achadosNap(r).length, 1);
  assert.match(achadosNap(r)[0].evidencia, /4050-262.*4100-111/);
});

// I1: uma entidade numérica fora do Unicode não pode fazer o módulo lançar (contrato: nunca lançar).
for (const ent of ['&#x110000;', '&#1114112;', '&#99999999999;']) {
  test(`I1: entidade numérica fora do Unicode (${ent}) não lança e fica como está`, async () => {
    const html = pagina({ jsonld: NEGOCIO, corpo: `<p>Padaria Aurora ${ent}</p>${RODAPE_NAP}<a href="https://www.instagram.com/x${ent}/">ig</a>` });
    const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
    assert.deepEqual(achadosNap(r), []);
    assert.deepEqual(validaNoFormato(r), []);
  });
}

// ---------------------------------------------------------------------------------------------
// I2: "verificado" só afirma o que se mediu; soft-404 e muro com \b; GBP só com URLs de lugar
// ---------------------------------------------------------------------------------------------

test('I2: a nota de um perfil verificado diz o que se mediu (HTTP 200, sem muro de login no título), não "acessível publicamente"', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const a = areaDe(r, 'facebook');
  assert.equal(a.estado, 'verificado');
  assert.match(a.nota, /HTTP 200/);
  assert.match(a.nota, /sem muro de login no título/);
  assert.doesNotMatch(a.nota, /acess[ií]vel publicamente/);
});

for (const [caso, titulo, corpo] of [
  ['PT no texto', 'Facebook', '<p>Este conteúdo não está disponível de momento</p>'],
  ['EN no título', "This content isn't available right now", ''],
  ['Page not found', 'Page not found • Instagram', ''],
]) {
  test(`I2: soft-404 (HTTP 200 com página indisponível, ${caso}) fica nao-verificado`, async () => {
    const r = await auditar({ site: SITE, obter: cenarioCompleto({ [FB]: pagina({ titulo, corpo }) }) });
    const a = areaDe(r, 'facebook');
    assert.equal(a.estado, 'nao-verificado');
    assert.match(a.nota, /indispon[ií]vel/);
    assert.deepEqual(validaNoFormato(r), []);
  });
}

for (const titulo of ['Centrar Fisioterapia | Facebook', 'Blog Inês Pastelaria | Facebook']) {
  test(`I2: título "${titulo}" não é muro de login`, async () => {
    const r = await auditar({ site: SITE, obter: cenarioCompleto({ [FB]: pagina({ titulo }) }) });
    assert.equal(areaDe(r, 'facebook')?.estado, 'verificado');
  });
}

test('I2: link de direcções (maps?q=morada) não é Google Business Profile e não se pede', async () => {
  const MAPA = 'https://maps.google.com/maps?q=Rua+das+Flores+12+Porto';
  const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${MAPA}">Como chegar</a><a href="https://www.google.com/maps?q=Padaria+Aurora">Mapa</a>` }), [MAPA]: pagina({ titulo: 'Google Maps' }) });
  const r = await auditar({ site: SITE, obter });
  assert.equal(areaDe(r, 'gbp'), undefined, `maps?q= classificado como GBP: ${JSON.stringify(r.areas)}`);
  assert.deepEqual(obter.pedidos, [SITE]);
});

for (const url of [
  'https://www.google.com/maps/place/Padaria+Aurora/@41.1,-8.6,17z',
  'https://maps.google.com/?cid=1234567890',
  'https://g.page/padaria-aurora',
  'https://maps.app.goo.gl/AbC123',
  'https://search.google.com/local/writereview?placeid=ChIJ123',
  'https://share.google/AbC123',
  'https://padaria-aurora.business.site/',
]) {
  test(`I2: URL de lugar ${new URL(url).hostname}${new URL(url).pathname.slice(0, 20)} é Google Business Profile`, async () => {
    const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${url}">Encontre-nos</a>` }), [url]: pagina({ titulo: 'Padaria Aurora - Google Maps' }) });
    const r = await auditar({ site: SITE, obter });
    const a = areaDe(r, 'gbp');
    assert.ok(a, `não classificou ${url} como GBP`);
    assert.ok(a.nota.includes(url.replace(/\/$/, '')), a.nota);
  });
}

// ---------------------------------------------------------------------------------------------
// I3: HTML minificado — type= e href= sem aspas
// ---------------------------------------------------------------------------------------------

test('I3: JSON-LD com type=application/ld+json sem aspas é lido (NAP comparado)', async () => {
  const html = `<html><head><title>Padaria Aurora</title><script type=application/ld+json>${JSON.stringify({ ...NEGOCIO, telephone: '+351 222 000 111' })}</script></head><body>${RODAPE_NAP}</body></html>`;
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.match(r.areas[0].nota, /NAP comparado/);
  assert.equal(achadosNap(r).length, 1, 'telefone divergente no JSON-LD sem aspas não gerou achado');
});

test('I3: href sem aspas conta como perfil (e tel: sem aspas também)', async () => {
  const html = pagina({ jsonld: NEGOCIO, corpo: `<a href=${IG}>ig</a><p>Padaria Aurora 4050-262 <a href=tel:+351912345678>ligar</a></p>` });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html, [IG]: PERFIL_IG_LOGIN }) });
  assert.ok(areaDe(r, 'instagram'), `perfil com href sem aspas ignorado: ${JSON.stringify(r.areas)}`);
  assert.match(areaDe(r, 'instagram').nota, /padaria\.aurora/);
  assert.match(r.areas[0].nota, /telefone/);
  assert.deepEqual(achadosNap(r), []);
});

// ---------------------------------------------------------------------------------------------
// I4: a exclusão de partilhas é ancorada — /share/<id>/ e handles com "share" são perfis
// ---------------------------------------------------------------------------------------------

for (const [rede, url] of [['facebook', 'https://www.facebook.com/share/1Ab2Cd3Ef/'], ['instagram', 'https://www.instagram.com/share.cafe/']]) {
  test(`I4: ${url} é um perfil, não um link de partilha`, async () => {
    const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${url}">${rede}</a>` }), [url]: pagina({ titulo: 'Share Café' }) });
    const r = await auditar({ site: SITE, obter });
    assert.ok(areaDe(r, rede), `perfil ${url} descartado como partilha`);
  });
}

test('I4: variantes de partilha (sharer.php, share.php, /share?url, /sharing/share-offsite) continuam fora', async () => {
  const obter = espiao({
    [SITE]: pagina({
      corpo: `
        <a href="https://www.facebook.com/sharer.php?u=https://cliente.pt/">fb</a>
        <a href="https://www.facebook.com/share.php?u=https://cliente.pt/">fb</a>
        <a href="https://twitter.com/share?url=https://cliente.pt/">tw</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://cliente.pt/">li</a>`,
    }),
  });
  const r = await auditar({ site: SITE, obter });
  assert.deepEqual(obter.pedidos, [SITE], `pediu links de partilha: ${obter.pedidos}`);
  assert.equal(areasDeRede(r).length, 0);
});

// ---------------------------------------------------------------------------------------------
// I5: sameAs no nó de topo e em nós aninhados (publisher, mainEntity)
// ---------------------------------------------------------------------------------------------

test('I5: sameAs no nó de topo lista o perfil (controlo)', async () => {
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: pagina({ jsonld: { ...NEGOCIO, sameAs: [IG] } }), [IG]: PERFIL_IG_LOGIN }) });
  assert.ok(areaDe(r, 'instagram'));
});

for (const chave of ['publisher', 'mainEntity']) {
  test(`I5: sameAs aninhado em ${chave} lista o perfil`, async () => {
    const jsonld = { '@context': 'https://schema.org', '@type': 'WebPage', [chave]: { '@type': 'Organization', name: 'Padaria Aurora', sameAs: [IG, FB] } };
    const r = await auditar({ site: SITE, obter: espiao({ [SITE]: pagina({ jsonld }), [IG]: PERFIL_IG_LOGIN, [FB]: PERFIL_FB_PUBLICO }) });
    assert.ok(areaDe(r, 'instagram'), `sameAs em ${chave} ignorado`);
    assert.ok(areaDe(r, 'facebook'), `sameAs em ${chave} ignorado`);
  });
}

test('I5: JSON-LD muito aninhado não rebenta (descida limitada)', async () => {
  // Construído como texto: o próprio JSON.stringify rebentaria com esta profundidade.
  const fundo = `${'{"filho":'.repeat(5000)}{"sameAs":["${IG}"]}${'}'.repeat(5000)}`;
  const html = `<html><head><title>x</title><script type="application/ld+json">${fundo}</script></head><body></body></html>`;
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(validaNoFormato(r), []);
});

// ---------------------------------------------------------------------------------------------
// I6/I7: as fixtures de test/fixtures/presenca/ ligadas a testes
// ---------------------------------------------------------------------------------------------

const fixture = (nome) => readFileSync(new URL(`./fixtures/presenca/${nome}`, import.meta.url), 'utf8');
const SITE_FX = 'https://padaria.example/';

test('fixture site-coerente: NAP coerente (com NIF no texto), 4 perfis, partilha fora, GBP por maps.app.goo.gl', async () => {
  const IG_FX = 'https://www.instagram.com/padaria.exemplo.ficticia/';
  const FB_FX = 'https://www.facebook.com/padariaexemploficticia';
  const obter = espiao({ [SITE_FX]: fixture('site-coerente.html'), [IG_FX]: fixture('instagram-login.html'), [FB_FX]: fixture('facebook-publico.html') });
  const r = await auditar({ site: SITE_FX, obter });
  assert.deepEqual(achadosNap(r), [], `achado falso: ${JSON.stringify(r.achados)}`);
  assert.match(r.areas[0].nota, /NAP comparado entre site e JSON-LD \(nome, telefone, morada\)/);
  assert.deepEqual(r.areas.map((a) => a.area), ['presenca', 'presenca.instagram', 'presenca.facebook', 'presenca.linkedin', 'presenca.gbp']);
  assert.equal(areaDe(r, 'instagram').estado, 'nao-verificado');
  assert.equal(areaDe(r, 'facebook').estado, 'verificado');
  assert.ok(!obter.pedidos.some((p) => /sharer/.test(p)), 'pediu o link de partilha');
  assert.deepEqual(validaNoFormato(r), []);
});

test('fixture site-incoerente: @graph com AutoRepair, telefone e CP divergentes → um achado com as duas diferenças', async () => {
  const r = await auditar({ site: SITE_FX, obter: espiao({ [SITE_FX]: fixture('site-incoerente.html') }) });
  const nap = achadosNap(r);
  assert.equal(nap.length, 1);
  assert.match(nap[0].evidencia, /220 000 222/);
  assert.match(nap[0].evidencia, /4000-001.*4000-999/);
  assert.doesNotMatch(nap[0].evidencia, /nome/, 'o nome coincide e não pode ser diferença');
  assert.ok(areaDe(r, 'tiktok'));
  assert.deepEqual(validaNoFormato(r), []);
});

test('fixture site-sem-perfis: sem perfis, sem JSON-LD, 1 pedido e nenhum achado', async () => {
  const obter = espiao({ [SITE_FX]: fixture('site-sem-perfis.html') });
  const r = await auditar({ site: SITE_FX, obter });
  assert.equal(areasDeRede(r).length, 0);
  assert.deepEqual(r.achados, []);
  assert.match(r.areas[0].nota, /sem JSON-LD/);
  assert.deepEqual(obter.pedidos, [SITE_FX]);
});

// Subtipos de LocalBusiness/Organization também são o negócio.
for (const tipo of ['Dentist', ['LocalBusiness', 'Bakery'], 'Organization']) {
  test(`subtipo ${JSON.stringify(tipo)}: telefone divergente em tel: gera achado`, async () => {
    const html = pagina({ jsonld: { ...NEGOCIO, '@type': tipo, telephone: '+351 222 000 111' }, corpo: RODAPE_NAP });
    const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
    assert.equal(achadosNap(r).length, 1);
  });
}

test('@graph: um WebSite com outro nome não é o negócio', async () => {
  const html = pagina({ jsonld: { '@graph': [{ '@type': 'WebSite', name: 'Site Institucional XPTO' }, NEGOCIO] }, corpo: RODAPE_NAP });
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: html }) });
  assert.deepEqual(achadosNap(r), []);
});

// ---------------------------------------------------------------------------------------------
// Sugestões da revisão: URLs limpas, publicações fora, telefones sem repetidos na evidência
// ---------------------------------------------------------------------------------------------

test('a URL do perfil guardada na nota não leva query (utm, igshid, fbclid) nem fragmento', async () => {
  const sujo = 'https://www.instagram.com/padaria.aurora/?utm_source=site&igshid=ABC123#topo';
  const fb = 'https://www.facebook.com/padariaaurora/?fbclid=XYZ789';
  const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${sujo}">ig</a><a href="${fb}">fb</a>` }), [IG]: PERFIL_IG_LOGIN, [FB]: PERFIL_FB_PUBLICO });
  const r = await auditar({ site: SITE, obter });
  const notas = r.areas.map((a) => a.nota).join('\n');
  assert.doesNotMatch(notas, /igshid|utm_|fbclid|ABC123|XYZ789|#topo/);
  assert.ok(areaDe(r, 'instagram').nota.includes(IG));
  assert.ok(!obter.pedidos.some((p) => /igshid|fbclid/.test(p)), `pediu a URL com query: ${obter.pedidos}`);
});

test('facebook.com/profile.php?id= mantém o id (e só o id)', async () => {
  const url = 'https://www.facebook.com/profile.php?id=100012345678901&ref=bookmarks';
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: pagina({ corpo: `<a href="${url}">fb</a>` }) }) });
  const nota = areaDe(r, 'facebook')?.nota ?? '';
  assert.match(nota, /profile\.php\?id=100012345678901/);
  assert.doesNotMatch(nota, /ref=bookmarks/);
});

for (const url of ['https://www.instagram.com/p/Cx1AbC/', 'https://www.instagram.com/reel/Cx1AbC/', 'https://x.com/padaria/status/1234567890', 'https://www.tiktok.com/@padaria/video/7234567890']) {
  test(`publicação (${new URL(url).pathname}) não conta como perfil`, async () => {
    const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${url}">post</a>` }) });
    const r = await auditar({ site: SITE, obter });
    assert.equal(areasDeRede(r).length, 0, `publicação listada como perfil: ${JSON.stringify(r.areas)}`);
    assert.deepEqual(obter.pedidos, [SITE]);
  });
}

test('telefones repetidos (mesmos dígitos, formas diferentes) aparecem uma vez na evidência', async () => {
  const corpo = '<p>Padaria Aurora 4050-262 <a href="tel:+351912345678">a</a> <a href="tel:912 345 678">b</a> <a href="tel:00351912345678">c</a></p>';
  const r = await auditar({ site: SITE, obter: espiao({ [SITE]: pagina({ jsonld: NEGOCIO_FIXO, corpo }) }) });
  const ev = achadosNap(r)[0]?.evidencia ?? '';
  assert.equal((ev.match(/912|00351912/g) ?? []).length, 1, `telefone repetido na evidência: ${ev}`);
});

// ---------------------------------------------------------------------------------------------
// #27 — escritos a partir dos critérios do issue (sessão separada da implementação)
// ---------------------------------------------------------------------------------------------

// Sobrepõe a resposta crua de um URL ao espião (ex.: status 0 sem erro, que o espião não gera).
function comResposta(base, url, resposta) {
  const norm = (u) => String(u).replace(/\/+$/, '');
  const obter = async (u) => (norm(u) === norm(url) ? { url: u, texto: '', erro: null, ...resposta } : base(u));
  obter.pedidos = base.pedidos;
  obter.contar = base.contar;
  return obter;
}

const achadosLinkPartido = (r) => r.achados.filter((a) => a.regra === 'presenca.perfil-link-partido');

// Critério 1: timeout/5xx num perfil → erro com nota
test('#27 c1: timeout no perfil (obter devolve erro) → presenca.<rede> em erro, com nota', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto({ [IG]: { erro: 'timeout' } }) });
  const a = areaDe(r, 'instagram');
  assert.equal(a?.estado, 'erro', `timeout não deu erro: ${JSON.stringify(a)}`);
  assert.ok(a.nota && a.nota.trim(), 'erro sem nota');
  assert.deepEqual(achadosLinkPartido(r), [], 'timeout tratado como link partido');
  assert.deepEqual(validaNoFormato(r), []);
});

test('#27 c1: status 0 sem mensagem de erro → erro, com nota', async () => {
  const obter = comResposta(cenarioCompleto(), FB, { ok: false, status: 0 });
  const r = await auditar({ site: SITE, obter });
  const a = areaDe(r, 'facebook');
  assert.equal(a?.estado, 'erro', `status 0 não deu erro: ${JSON.stringify(a)}`);
  assert.ok(a.nota && a.nota.trim(), 'erro sem nota');
});

for (const status of [503, 500]) {
  test(`#27 c1: HTTP ${status} no perfil → erro, com nota (não nao-verificado, não link partido)`, async () => {
    const r = await auditar({ site: SITE, obter: cenarioCompleto({ [FB]: { status, texto: 'Service Unavailable' } }) });
    const a = areaDe(r, 'facebook');
    assert.equal(a?.estado, 'erro', `${status} não deu erro: ${JSON.stringify(a)}`);
    assert.ok(a.nota && a.nota.trim(), 'erro sem nota');
    assert.deepEqual(achadosLinkPartido(r), []);
    assert.deepEqual(validaNoFormato(r), []);
  });
}

// Critério 2: login / conteúdo indisponível → nao-verificado (inalterado)
test('#27 c2: redirect para a página de login (por URL) → nao-verificado, com nota, sem achado', async () => {
  const obter = cenarioCompleto({ [IG]: { redirige: 'https://www.instagram.com/accounts/login/?next=%2Fpadaria.aurora%2F', texto: pagina({ titulo: 'Instagram' }) } });
  const r = await auditar({ site: SITE, obter });
  const a = areaDe(r, 'instagram');
  assert.equal(a?.estado, 'nao-verificado');
  assert.ok(a.nota && a.nota.trim());
  assert.ok(!r.achados.some((x) => x.area === 'presenca.instagram'), 'achado num perfil atrás de login');
});

test('#27 c2: soft-404 (HTTP 200 "conteúdo não está disponível") → nao-verificado, não link partido', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto({ [FB]: pagina({ titulo: 'Facebook', corpo: '<p>Este conteúdo não está disponível de momento</p>' }) }) });
  const a = areaDe(r, 'facebook');
  assert.equal(a?.estado, 'nao-verificado');
  assert.ok(a.nota && a.nota.trim());
  assert.deepEqual(achadosLinkPartido(r), [], 'soft-404 tratado como 404');
});

// Irmão negativo: o 999 do LinkedIn continua nao-verificado
test('#27 negativo: HTTP 999 do LinkedIn continua nao-verificado (nem erro, nem link partido)', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto() });
  const a = areaDe(r, 'linkedin');
  assert.equal(a?.estado, 'nao-verificado');
  assert.ok(!achadosLinkPartido(r).some((x) => x.evidencia.includes('linkedin')), '999 tratado como link partido');
});

// Critério 3: 404 → achado presenca.perfil-link-partido com a URL
test('#27 c3: perfil com HTTP 404 gera achado presenca.perfil-link-partido com a URL na evidência', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto({ [IG]: { status: 404, texto: 'Not Found' } }) });
  const partidos = achadosLinkPartido(r);
  assert.equal(partidos.length, 1, `sem achado de link partido: ${JSON.stringify(r.achados)}`);
  const a = partidos[0];
  assert.ok(a.evidencia.includes(IG.replace(/\/$/, '')), `a evidência não traz a URL do perfil: ${a.evidencia}`);
  assert.match(a.area, /^presenca(\.|$)/);
  assert.ok(a.recomendacao && a.recomendacao.trim(), 'achado sem recomendação');
  assert.deepEqual(validaNoFormato(r), []);
});

test('#27 c3: só o perfil com 404 gera o achado (os outros não)', async () => {
  const r = await auditar({ site: SITE, obter: cenarioCompleto({ [FB]: { status: 404, texto: '' } }) });
  const partidos = achadosLinkPartido(r);
  assert.equal(partidos.length, 1);
  assert.ok(partidos[0].evidencia.includes(FB.replace(/\/$/, '')));
  assert.ok(!partidos[0].evidencia.includes('instagram'));
});

// Critério 4: URL GBP guardada só com cid/placeid/q
test('#27 c4: URL GBP com cid e lixo de query guarda-se só com cid=123', async () => {
  const url = 'https://www.google.com/maps?cid=123&g_st=ic&g_ep=abc';
  const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${url}">Encontre-nos</a>` }), [url]: pagina({ titulo: 'Padaria Aurora - Google Maps' }), 'https://www.google.com/maps?cid=123': pagina({ titulo: 'Padaria Aurora - Google Maps' }) });
  const r = await auditar({ site: SITE, obter });
  const a = areaDe(r, 'gbp');
  assert.ok(a, `não classificou ${url} como GBP`);
  assert.match(a.nota, /cid=123/);
  assert.doesNotMatch(a.nota, /g_st|g_ep|=ic\b|=abc\b/, `query extra guardada: ${a.nota}`);
  const textos = [...r.areas.map((x) => x.nota ?? ''), ...r.achados.map((x) => x.evidencia)].join('\n');
  assert.doesNotMatch(textos, /g_st|g_ep/, 'query extra noutro sítio do output');
});

test('#27 c4 (aceitação): URL GBP com placeid e q mantém os dois e larga o resto', async () => {
  const url = 'https://search.google.com/local/writereview?placeid=ChIJ123&q=Padaria+Aurora&hl=pt&g_ep=abc';
  const obter = espiao({ [SITE]: pagina({ corpo: `<a href="${url}">Avalie-nos</a>` }), [url]: pagina({ titulo: 'Padaria Aurora - Google' }) });
  const r = await auditar({ site: SITE, obter });
  const a = areaDe(r, 'gbp');
  assert.ok(a, `não classificou ${url} como GBP`);
  assert.match(a.nota, /placeid=ChIJ123/);
  assert.match(a.nota, /q=Padaria(\+|%20)Aurora/);
  assert.doesNotMatch(a.nota, /hl=pt|g_ep/, `query extra guardada: ${a.nota}`);
});

// Cenário misto: todos os casos do #27 juntos passam o validarAuditoria
test('#27: cenário misto (timeout, 503, 404, login, 999, GBP sujo) valida no formato', async () => {
  const GBP = 'https://www.google.com/maps?cid=123&g_st=ic&g_ep=abc';
  const TT = 'https://www.tiktok.com/@padaria.aurora';
  const YT = 'https://www.youtube.com/@padariaaurora';
  const X = 'https://x.com/padariaaurora';
  const corpo = `${LINKS_PERFIS}<a href="${TT}">tt</a><a href="${YT}">yt</a><a href="${X}">x</a><a href="${GBP}">gbp</a>${RODAPE_NAP}`;
  const obter = espiao({
    [SITE]: pagina({ jsonld: NEGOCIO, corpo }),
    [IG]: PERFIL_IG_LOGIN,
    [FB]: { status: 503, texto: '' },
    [LI]: { status: 999, texto: '' },
    [TT]: { erro: 'timeout' },
    // YT fica de fora do mapa → 404
    [X]: pagina({ titulo: 'Padaria Aurora (@padariaaurora) / X' }),
    // Servido com e sem a query suja: o pedido pode sair já com a URL sanitizada.
    [GBP]: pagina({ titulo: 'Padaria Aurora - Google Maps' }),
    'https://www.google.com/maps?cid=123': pagina({ titulo: 'Padaria Aurora - Google Maps' }),
  });
  const r = await auditar({ site: SITE, obter });
  assert.equal(areaDe(r, 'facebook')?.estado, 'erro');
  assert.equal(areaDe(r, 'tiktok')?.estado, 'erro');
  assert.equal(areaDe(r, 'instagram')?.estado, 'nao-verificado');
  assert.equal(areaDe(r, 'linkedin')?.estado, 'nao-verificado');
  assert.equal(achadosLinkPartido(r).length, 1);
  assert.ok(achadosLinkPartido(r)[0].evidencia.includes(YT));
  assert.deepEqual(validaNoFormato(r), []);
});

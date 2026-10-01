// Testes mínimos do módulo gbp (D-023) — escritos com a implementação; a suite de
// aceitação vem à parte, a partir dos critérios. Sem rede: o fetch da Places API, o site e o cofre
// são sempre injectados. A chave é falsa e marcada: nunca pode aparecer no resultado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditar, COFRE_AGENCIA, CHAVE } from '../scripts/auditoria/gbp.mjs';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';

const SITE = 'https://padaria.pt/';
const ID = 'ChIJ_TESTE_place_id_0123456789';
const CHAVE_FALSA = 'AIzaTESTE_chave_SEGREDO_0123456789abcdefghi';
const cofre = (v = CHAVE_FALSA) => (slug, chave) => (slug === COFRE_AGENCIA && chave === CHAVE ? v : null);

function pagina({ jsonld, corpo = '' } = {}) {
  const ld = jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : '';
  return `<!doctype html><html><head><title>Padaria Aurora</title>${ld}</head><body>${corpo}</body></html>`;
}
const NEGOCIO = {
  '@type': 'Bakery',
  name: 'Padaria Aurora, Lda',
  telephone: '+351 222 080 000',
  address: { '@type': 'PostalAddress', streetAddress: 'Rua das Flores 10', postalCode: '4050-262', addressLocality: 'Porto' },
  geo: { latitude: 41.1456, longitude: -8.6110 },
};
const site = (texto, ok = true) => async (url) => (ok ? { ok: true, status: 200, url, texto, erro: null } : { ok: false, status: 0, url, texto: '', erro: 'timeout' });

const LUGAR_BOM = {
  id: ID,
  displayName: { text: 'Padaria Aurora', languageCode: 'pt' },
  formattedAddress: 'R. das Flores 10, 4050-262 Porto, Portugal',
  postalAddress: { postalCode: '4050-262' },
  nationalPhoneNumber: '222 080 000',
  internationalPhoneNumber: '+351 222 080 000',
  websiteUri: 'https://padaria.pt/?utm_source=google&utm_medium=organic',
  primaryType: 'bakery',
  primaryTypeDisplayName: { text: 'Padaria', languageCode: 'pt-PT' },
  regularOpeningHours: { weekdayDescriptions: ['segunda-feira: 07:00–19:00'] },
  businessStatus: 'OPERATIONAL',
  rating: 4.6,
  userRatingCount: 42,
  photos: [{ name: 'a' }, { name: 'b' }],
  googleMapsUri: 'https://maps.google.com/?cid=1',
};

// fetch falso: { detalhe, pesquisa, lancar, status } — grava pedidos.
function api({ detalhe = LUGAR_BOM, pesquisa = [], lancar, status = 200, erro } = {}) {
  const pedidos = [];
  const obter = async (url, init = {}) => {
    pedidos.push({ url: String(url), init, headers: new Headers(init.headers) });
    if (lancar) throw lancar;
    if (status !== 200) return Response.json(erro ?? {}, { status });
    if (String(url).includes(':searchText')) return Response.json({ places: pesquisa });
    return Response.json(detalhe);
  };
  obter.pedidos = pedidos;
  return obter;
}

const semSegredo = (r) => assert.ok(!JSON.stringify(r).includes(CHAVE_FALSA), 'a chave apareceu no resultado');
const valido = (r) => assert.deepEqual(validarAuditoria(JSON.stringify({ cliente: 'x', data: '2026-10-01', metodo: '0.1.0', ...r }), 'x'), []);
const regras = (r) => r.achados.map((a) => `${a.regra}${a.alvo ? `:${a.alvo}` : ''}`).sort();

test('sem chave no cofre: nao-verificado com o comando, sem nenhum pedido', async () => {
  const obter = api();
  let lidoSite = 0;
  const r = await auditar({ site: SITE, cliente: { canais: [] }, obter, obterSite: async () => { lidoSite++; return {}; }, lerCofre: cofre(null) });
  assert.equal(r.areas[0].estado, 'nao-verificado');
  assert.match(r.areas[0].nota, /guardar-credencial\.mjs" google-places GOOGLE_PLACES_API_KEY/);
  assert.equal(obter.pedidos.length + lidoSite, 0);
  valido(r);
});

test('Place ID do dossier, perfil completo e NAP igual: verificado sem achados; chave só no header', async () => {
  const obter = api();
  const r = await auditar({ site: SITE, cliente: { canais: [{ tipo: 'gbp', id: ID, acesso: false }] }, obter, obterSite: site(pagina({ jsonld: NEGOCIO, corpo: '<a href="tel:222080000">ligar</a>' })), lerCofre: cofre() });
  assert.equal(r.areas[0].estado, 'verificado', r.areas[0].nota);
  assert.deepEqual(r.achados, []);
  assert.match(r.areas[0].nota, new RegExp(`Place ID ${ID}`));
  assert.match(r.areas[0].nota, /Padaria; média 4,6 em 42 avaliações; 2 fotografia/);
  assert.equal(obter.pedidos.length, 1);
  const [p] = obter.pedidos;
  assert.ok(p.url.startsWith(`https://places.googleapis.com/v1/places/${ID}`));
  assert.ok(!p.url.includes(CHAVE_FALSA));
  assert.equal(p.headers.get('x-goog-api-key'), CHAVE_FALSA);
  assert.match(p.headers.get('x-goog-fieldmask'), /businessStatus/);
  semSegredo(r);
  valido(r);
});

test('perfil com falhas: um achado por regra, NAP por campo com alvo', async () => {
  const detalhe = {
    id: ID,
    displayName: { text: 'Aurora Pastelaria' },
    formattedAddress: 'Av. Central 1, 4000-001 Porto',
    nationalPhoneNumber: '220 000 111',
    websiteUri: 'https://outro-site.pt/',
    businessStatus: 'CLOSED_TEMPORARILY',
    rating: 3.2,
    userRatingCount: 4,
  };
  const r = await auditar({ site: SITE, cliente: { canais: [{ tipo: 'gbp', id: ID, acesso: false }] }, obter: api({ detalhe }), obterSite: site(pagina({ jsonld: NEGOCIO })), lerCofre: cofre() });
  assert.deepEqual(regras(r), [
    'gbp.media-baixa', 'gbp.nap-diferente:morada', 'gbp.nap-diferente:nome', 'gbp.nap-diferente:telefone',
    'gbp.perfil-nao-operacional', 'gbp.poucas-avaliacoes', 'gbp.sem-fotografias', 'gbp.sem-horario', 'gbp.site-noutro-dominio',
  ]);
  assert.equal(r.achados.find((a) => a.regra === 'gbp.perfil-nao-operacional').severidade, 'critica');
  for (const a of r.achados) assert.equal(a.skill, 'seo-local');
  valido(r);
});

test('site no domínio certo sem UTM → baixa; sem websiteUri → média', async () => {
  const sem = await auditar({ site: SITE, cliente: { canais: [{ tipo: 'gbp', id: ID, acesso: false }] }, obter: api({ detalhe: { ...LUGAR_BOM, websiteUri: 'https://www.padaria.pt/' } }), obterSite: site(pagina({ jsonld: NEGOCIO })), lerCofre: cofre() });
  assert.deepEqual(regras(sem), ['gbp.site-sem-utm']);
  const { websiteUri, ...semSite } = LUGAR_BOM;
  const aus = await auditar({ site: SITE, cliente: { canais: [{ tipo: 'gbp', id: ID, acesso: false }] }, obter: api({ detalhe: semSite }), obterSite: site(pagina({ jsonld: NEGOCIO })), lerCofre: cofre() });
  assert.deepEqual(regras(aus), ['gbp.site-ausente']);
});

test('link ?cid= no site: Text Search, aceita o lugar a ≤ 250 m do geo e põe o Place ID na nota', async () => {
  const obter = api({ pesquisa: [
    { id: 'ChIJ_longe_000000000000', displayName: { text: 'Padaria Aurora' }, location: { latitude: 41.16, longitude: -8.61 } },
    { id: ID, displayName: { text: 'Padaria Aurora' }, location: { latitude: 41.1457, longitude: -8.6111 } },
  ] });
  const html = pagina({ jsonld: NEGOCIO, corpo: '<a href="https://maps.google.com/?cid=123456789">mapa</a><a href="tel:222080000">t</a>' });
  const r = await auditar({ site: SITE, cliente: { canais: [] }, obter, obterSite: site(html), lerCofre: cofre() });
  assert.equal(r.areas[0].estado, 'verificado', r.areas[0].nota);
  assert.match(r.areas[0].nota, new RegExp(`Place ID ${ID} \\(encontrado por pesquisa.*confirmar e pôr no canal gbp`));
  assert.match(r.areas[0].nota, /cid=123456789/);
  const pesquisa = obter.pedidos[0];
  assert.ok(pesquisa.url.endsWith('/places:searchText'));
  assert.equal(JSON.parse(pesquisa.init.body).textQuery, 'Padaria Aurora, Lda, Rua das Flores 10 4050-262 Porto');
});

test('pesquisa sem resultado a ≤ 250 m: nao-verificado, sem pedir detalhes', async () => {
  const obter = api({ pesquisa: [{ id: 'ChIJ_longe_000000000000', displayName: { text: 'Outra' }, location: { latitude: 41.2, longitude: -8.6 } }] });
  const r = await auditar({ site: SITE, cliente: { canais: [] }, obter, obterSite: site(pagina({ jsonld: NEGOCIO })), lerCofre: cofre() });
  assert.equal(r.areas[0].estado, 'nao-verificado');
  assert.match(r.areas[0].nota, /250 m/);
  assert.equal(obter.pedidos.length, 1);
  valido(r);
});

test('sem geo: aceita só com nome e código postal iguais', async () => {
  const { geo, ...semGeo } = NEGOCIO;
  const certo = { id: ID, displayName: { text: 'Padaria Aurora' }, postalAddress: { postalCode: '4050-262' } };
  const ok = await auditar({ site: SITE, cliente: { canais: [] }, obter: api({ pesquisa: [certo] }), obterSite: site(pagina({ jsonld: semGeo })), lerCofre: cofre() });
  assert.equal(ok.areas[0].estado, 'verificado', ok.areas[0].nota);
  const errado = await auditar({ site: SITE, cliente: { canais: [] }, obter: api({ pesquisa: [{ ...certo, postalAddress: { postalCode: '1000-001' } }] }), obterSite: site(pagina({ jsonld: semGeo })), lerCofre: cofre() });
  assert.equal(errado.areas[0].estado, 'nao-verificado');
});

test('HTTP ≠ 2xx e timeout → erro com mensagem limpa, sem a chave', async () => {
  const canais = [{ tipo: 'gbp', id: ID, acesso: false }];
  const http = await auditar({ site: SITE, cliente: { canais }, obter: api({ status: 400, erro: { error: { status: 'INVALID_ARGUMENT', message: `API key not valid: ${CHAVE_FALSA}` } } }), obterSite: site(pagina({ jsonld: NEGOCIO })), lerCofre: cofre() });
  assert.equal(http.areas[0].estado, 'erro');
  assert.match(http.areas[0].nota, /HTTP 400 \(INVALID_ARGUMENT/);
  semSegredo(http);
  const lento = await auditar({ site: SITE, cliente: { canais }, obter: api({ lancar: new DOMException('t', 'TimeoutError') }), obterSite: site(''), lerCofre: cofre() });
  assert.equal(lento.areas[0].estado, 'erro');
  assert.match(lento.areas[0].nota, /timeout/);
  valido(http);
  valido(lento);
});

test('resposta com campos em falta não rebenta', async () => {
  const r = await auditar({ site: SITE, cliente: { canais: [{ tipo: 'gbp', id: ID, acesso: false }] }, obter: api({ detalhe: {} }), obterSite: site(pagina({ jsonld: NEGOCIO })), lerCofre: cofre() });
  assert.equal(r.areas[0].estado, 'verificado');
  assert.ok(r.achados.some((a) => a.regra === 'gbp.sem-horario'));
  assert.ok(!r.achados.some((a) => a.regra === 'gbp.perfil-nao-operacional'));
  valido(r);
});

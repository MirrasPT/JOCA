// Testes de fumo do módulo ads (#INT-5). A suite completa do issue é escrita noutra sessão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ligarApi } from '../scripts/ads/api.mjs';
import { planearPausa, pausar, mudarObjectivos } from '../scripts/ads/alterar.mjs';
import { agregar, sinais } from '../scripts/ads/diagnostico.mjs';

// Dossier fictício em test/fixtures/clientes/exemplo-ads (google-ads 111-222-3333).
const RAIZ = new URL('./fixtures', import.meta.url).pathname;
const resp = (status, corpo) => ({ ok: status < 400, status, json: async () => corpo });
const camp = (id, name, status, experimentType = 'BASE') => ({
  campaign: { id, name, status, experimentType, resourceName: `customers/1112223333/campaigns/${id}` },
});

test('api: token trocado, GAQL paginado, 1 retry em erro de rede, segredos fora dos erros', async () => {
  const cofre = { GOOGLE_ADS_DEVELOPER_TOKEN: 'dev-x', GOOGLE_ADS_REFRESH_TOKEN: '1//0segredo' };
  let falhou = false;
  const pedidos = [];
  const obter = async (url, init) => {
    pedidos.push({ url, init });
    if (url.includes('oauth2')) return resp(200, { access_token: 'ya29.tokensecreto' });
    if (!falhou) { falhou = true; throw Object.assign(new Error('x'), { cause: { code: 'ETIMEDOUT' } }); }
    const corpo = JSON.parse(init.body);
    return corpo.pageToken ? resp(200, { results: [{ n: 2 }] }) : resp(200, { results: [{ n: 1 }], nextPageToken: 'p2' });
  };
  const api = await ligarApi({
    slug: 'cliente', customerId: '111-222-3333', obter,
    lerCofre: (_s, k) => cofre[k] ?? null,
    lerFicheiro: () => JSON.stringify({ installed: { client_id: 'id', client_secret: 's' } }),
  });
  assert.deepEqual(await api.gaql('SELECT campaign.id FROM campaign'), [{ n: 1 }, { n: 2 }]);
  const h = pedidos.at(-1).init.headers;
  assert.equal(h['login-customer-id'], '1112223333', 'por omissão, a própria conta');
  assert.match(pedidos.at(-1).url, /\/v25\/customers\/1112223333\/googleAds:search$/);

  const apiErro = await ligarApi({
    slug: 'cliente', customerId: '1112223333',
    obter: async (url) => (url.includes('oauth2') ? resp(200, { access_token: 'ya29.tokensecreto' }) : resp(400, { error: { message: 'Bearer ya29.tokensecreto recusado' } })),
    lerCofre: (_s, k) => cofre[k] ?? null,
    lerFicheiro: () => JSON.stringify({ installed: { client_id: 'id', client_secret: 's' } }),
  });
  await assert.rejects(apiErro.gaql('SELECT x FROM y'), (e) => !e.message.includes('tokensecreto'));
});

test('planearPausa: só PAUSED, experiência recusada, já em pausa ignorada, nome repetido pede ID', () => {
  const campanhas = [camp(1, 'A', 'ENABLED'), camp(2, 'Exp', 'ENABLED', 'EXPERIMENT'), camp(3, 'P', 'PAUSED'), camp(4, 'D', 'ENABLED'), camp(5, 'D', 'ENABLED')];
  const p = planearPausa(campanhas, ['A', '2', 'P', 'D', 'nao-existe']);
  assert.equal(p.ops.length, 1);
  assert.deepEqual(p.ops.map((o) => o.update.status), ['PAUSED']);
  assert.ok(p.erros.some((e) => /experiência/.test(e)));
  assert.ok(p.erros.some((e) => /usar o ID/.test(e)));
  assert.ok(p.erros.some((e) => /não encontrada/.test(e)));
  assert.ok(p.avisos.some((a) => /já está em pausa/.test(a)));
});

function apiFalsa(estado, { codigos } = {}) {
  const mutates = [];
  return {
    mutates,
    ligar: async () => ({
      gaql: async (q) => {
        if (q.includes('FROM campaign_conversion_goal')) return estado.objectivos;
        return estado.campanhas;
      },
      mutate: async (servico, ops, { validar }) => {
        mutates.push({ servico, ops, validar });
        if (codigos) throw Object.assign(new Error('mutate falhou'), { codigos });
        if (!validar) {
          for (const o of ops) {
            const c = estado.campanhas.find((x) => x.campaign.resourceName === o.update.resourceName);
            if (c) c.campaign.status = o.update.status;
            const g = estado.objectivos.find((x) => x.campaignConversionGoal.resourceName === o.update.resourceName);
            if (g) g.campaignConversionGoal.biddable = o.update.biddable;
          }
        }
        return {};
      },
    }),
  };
}

test('pausar: sem --confirmar é validateOnly; com --confirmar aplica e verifica por GAQL', async () => {
  const estado = { campanhas: [camp(1, 'A', 'ENABLED')], objectivos: [] };
  const f = apiFalsa(estado);
  const ensaio = await pausar('exemplo-ads', ['A'], { raiz: RAIZ, ligar: f.ligar });
  assert.equal(f.mutates[0].validar, true);
  assert.equal(estado.campanhas[0].campaign.status, 'ENABLED');
  assert.ok(ensaio.ok);
  const real = await pausar('exemplo-ads', ['A'], { raiz: RAIZ, ligar: f.ligar, confirmar: true });
  assert.equal(f.mutates[1].validar, false);
  assert.ok(real.ok && real.linhas.at(-1).includes('verificado por GAQL'));
});

test('objectivos: muda biddable, e MUTATE_NOT_ALLOWED aponta para o objectivo por campanha', async () => {
  const goal = (cat, origin, biddable) => ({ campaignConversionGoal: { resourceName: `g/${cat}~${origin}`, category: cat, origin, biddable } });
  const estado = { campanhas: [camp(7, 'C', 'PAUSED')], objectivos: [goal('SUBMIT_LEAD_FORM', 'WEBSITE', true), goal('DOWNLOAD', 'APP', true)] };
  const f = apiFalsa(estado);
  const r = await mudarObjectivos('exemplo-ads', 'C', { raiz: RAIZ, ligar: f.ligar, naoContar: [{ categoria: 'DOWNLOAD', origem: null }], confirmar: true });
  assert.ok(r.ok, r.linhas.join('\n'));
  assert.equal(estado.objectivos[1].campaignConversionGoal.biddable, false);
  assert.equal(estado.objectivos[0].campaignConversionGoal.biddable, true);

  const g = apiFalsa({ campanhas: [camp(7, 'C', 'PAUSED')], objectivos: [goal('DOWNLOAD', 'APP', true)] }, { codigos: ['MUTATE_NOT_ALLOWED'] });
  await assert.rejects(
    mudarObjectivos('exemplo-ads', 'C', { raiz: RAIZ, ligar: g.ligar, naoContar: [{ categoria: 'DOWNLOAD', origem: null }] }),
    /objectivo por campanha/,
  );
});

test('diagnóstico: agrega e sinaliza gasto sem conversão, 404 e campanha activa sem objectivo', () => {
  const d = agregar({
    conta: [{ customer: { id: '1', currencyCode: 'EUR' } }],
    campanhas: [{ campaign: { id: 1, name: 'A', status: 'ENABLED' }, campaignBudget: { amountMicros: '5000000' } }],
    metricas: [{ campaign: { id: 1 }, metrics: { costMicros: '10000000', clicks: '4', conversions: 0 } }],
    termos: [{ searchTermView: { searchTerm: 't' }, campaign: { name: 'A' }, metrics: { costMicros: '10000000', conversions: 0 } }],
    palavras: [], palavrasMetricas: [], conversoes: [], conversoesMetricas: [],
    objectivos: [{ campaign: { id: 1, name: 'A' }, campaignConversionGoal: { category: 'DOWNLOAD', biddable: false } }],
  });
  d.landing = [{ url: 'https://x.pt/lp', status: 404 }];
  const s = sinais(d, 'EUR').join('\n');
  assert.match(s, /1 campanha\(s\) activa\(s\): A/);
  assert.match(s, /sem conversão: 10\.00 EUR/);
  assert.match(s, /https:\/\/x\.pt\/lp \(404\)/);
  assert.match(s, /sem nenhum objectivo de conversão a contar: A/);
});
